"""
Copilot route: server-side LLM proxy grounded in the simulated DigitalTwinState.

API keys are read only from the backend environment (GEMINI_API_KEY, GROQ_API_KEY).
They are never returned to the client. When no key is configured or the provider fails,
a template summary built only from real simulated values is returned.
"""

import json
import os
import re
import time
import urllib.request
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...db.database import get_db
from ...db.models import WellModel
from twin.cycle import CSSCycleSimulator, CycleConfig

router = APIRouter(prefix="/copilot", tags=["Copilot"])

_TIMEOUT_S = 20
# Pictographic / emoji code points stripped from provider output.
_EMOJI_RE = re.compile("[\U0001F000-\U0001FAFF\u2600-\u27BF\uFE0F\u200D]")


class CopilotRequest(BaseModel):
    well_id: str
    query: str = Field(..., min_length=1, max_length=2000)
    provider: str = "auto"  # auto | gemini | groq
    day: Optional[int] = None


class CopilotResponse(BaseModel):
    answer: str
    provider: str
    model: str
    latency_ms: int
    context: Dict[str, Any]
    provenance: str = "SIMULATED"


def _build_state_context(well: WellModel, day: Optional[int]) -> Dict[str, Any]:
    cfg = CycleConfig(
        well_id=well.well_id,
        cycle_number=int(well.current_cycle_number or 1),
        steam_volume_tonnes=float(well.steam_volume_tonnes),
        injection_pressure_bar=float(well.injection_pressure_bar),
        soak_duration_days=float(well.soak_duration_days),
        spm=float(well.spm),
        stroke_length_inch=float(well.stroke_length_inch),
        vfd_downstroke_ratio=float(well.vfd_downstroke_ratio),
        economic_cutoff_oil_rate_bpd=float(well.economic_cutoff_oil_rate_bpd),
    )
    res = CSSCycleSimulator(cfg).run_simulation()
    if not res.states:
        return {"well_id": well.well_id}
    idx = len(res.states) - 1 if day is None else max(0, min(len(res.states) - 1, day - 1))
    s = res.states[idx].to_dict()
    s["depth_m"] = well.depth_m
    s["pump_depth_m"] = well.pump_depth_m
    s["formation"] = well.formation
    s["field_name"] = well.field_name
    s["float_days_in_cycle"] = res.total_float_events_count
    s["cycle_days_simulated"] = len(res.states)
    return s


def _system_prompt(ctx: Dict[str, Any]) -> str:
    return (
        "You are an engineering assistant for a simulated CSS + sucker-rod-pump digital twin "
        "(Baghewala heavy oil field, Bikaner-Nagaur Basin). All values below are SIMULATED, not field "
        "measurements. Use only these values; do not invent citations, formations, or numbers. "
        "If the data cannot answer the question, say so. Plain text or simple Markdown, no emoji, "
        "SI/metric units first.\n\nSimulated twin state (JSON):\n" + json.dumps(ctx, default=str)
    )


def _post_json(url: str, payload: Dict[str, Any], headers: Dict[str, str]) -> Dict[str, Any]:
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=_TIMEOUT_S) as r:  # noqa: S310 (fixed https hosts)
        return json.loads(r.read().decode("utf-8"))


def _call_gemini(key: str, system: str, query: str) -> str:
    data = _post_json(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
        {
            "contents": [{"parts": [{"text": system}, {"text": f"Question: {query}"}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 900},
        },
        {"x-goog-api-key": key},
    )
    parts = data["candidates"][0]["content"]["parts"]
    return "".join(p.get("text", "") for p in parts)


def _call_groq(key: str, system: str, query: str) -> str:
    data = _post_json(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            "model": "openai/gpt-oss-120b",
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": query}],
            "temperature": 0.2,
            "max_tokens": 900,
        },
        {"Authorization": f"Bearer {key}"},
    )
    return data["choices"][0]["message"]["content"]


def template_summary(ctx: Dict[str, Any]) -> str:
    """Deterministic summary interpolating only simulated values present in ctx."""
    def g(k: str, fmt: str = "{:.1f}") -> str:
        v = ctx.get(k)
        return fmt.format(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else "n/a"

    fm = ctx.get("float_margin_index")
    float_note = "below 1.0 (rod float on downstroke)" if isinstance(fm, (int, float)) and fm < 1.0 else "at or above 1.0"
    return (
        "Template summary (LLM offline)\n\n"
        f"Well {ctx.get('well_id', 'n/a')}, cycle {ctx.get('cycle_number', 'n/a')}, production day {ctx.get('day', 'n/a')} (simulated).\n"
        f"- Bottomhole temperature {g('reservoir_temperature_c')} °C, oil viscosity {g('oil_viscosity_cp', '{:.0f}')} cP\n"
        f"- Oil rate {g('oil_rate_bpd')} bbl/d, water cut {g('water_cut_pct')} %\n"
        f"- Pump intake pressure {g('pump_intake_pressure_bar')} bar, fillage {g('pump_fillage_pct')} %\n"
        f"- SPM {g('spm', '{:.2f}')}, stroke {g('stroke_length_inch', '{:.0f}')} in, VFD downstroke ratio {g('vfd_downstroke_ratio', '{:.2f}')}\n"
        f"- Float margin {g('float_margin_index', '{:.3f}')} ({float_note}); float-days this cycle {g('float_days_in_cycle', '{:.0f}')}\n"
        f"- Goodman ratio {g('goodman_stress_ratio', '{:.3f}')}, SOR {g('steam_oil_ratio', '{:.2f}')} t/t"
    )


@router.post("", response_model=CopilotResponse)
def copilot(req: CopilotRequest, db: Session = Depends(get_db)) -> CopilotResponse:
    t0 = time.time()
    well = db.query(WellModel).filter(WellModel.well_id == req.well_id).first()
    if not well:
        raise HTTPException(status_code=404, detail=f"Well '{req.well_id}' not found.")
    ctx = _build_state_context(well, req.day)
    system = _system_prompt(ctx)

    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    groq_key = os.environ.get("GROQ_API_KEY", "").strip()
    order = ["groq", "gemini"] if req.provider == "groq" else ["gemini", "groq"]
    if req.provider == "gemini":
        order = ["gemini"]

    for p in order:
        try:
            if p == "gemini" and gemini_key:
                text, model = _call_gemini(gemini_key, system, req.query), "gemini-2.5-flash-lite"
            elif p == "groq" and groq_key:
                text, model = _call_groq(groq_key, system, req.query), "openai/gpt-oss-120b"
            else:
                continue
            text = _EMOJI_RE.sub("", text)
            return CopilotResponse(answer=text, provider=p, model=model,
                                   latency_ms=int((time.time() - t0) * 1000), context=ctx)
        except Exception:  # provider failure falls through to next option
            continue

    return CopilotResponse(answer=template_summary(ctx), provider="template", model="none",
                           latency_ms=int((time.time() - t0) * 1000), context=ctx)
