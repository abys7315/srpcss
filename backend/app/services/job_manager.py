"""
Minimal in-process job runner for long optimizations.

One joint NSGA-II run costs on the order of a minute or more, so the API exposes it as
POST /optimize/joint/jobs -> job_id, then GET /optimize/jobs/{job_id} for status, progress and the result.
Jobs live in memory (lost on restart) and are purged after an hour. Two workers run at a time.
"""

import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Dict, Optional

_EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="opt-job")
_JOBS: Dict[str, Dict[str, Any]] = {}
_LOCK = threading.Lock()
_TTL_S = 3600.0


def _purge() -> None:
    now = time.time()
    for k in [k for k, v in _JOBS.items() if v["finished"] and now - v["finished"] > _TTL_S]:
        _JOBS.pop(k, None)


def submit(work: Callable[[Callable[[int, int], None]], Any], label: str) -> str:
    """`work(progress)` runs on a worker thread; call progress(done, total) as it advances."""
    job_id = uuid.uuid4().hex[:12]
    rec: Dict[str, Any] = {"job_id": job_id, "label": label, "status": "QUEUED", "done": 0, "total": 0,
                           "result": None, "error": None, "created": time.time(), "started": None, "finished": None}
    with _LOCK:
        _purge()
        _JOBS[job_id] = rec

    def progress(done: int, total: int) -> None:
        rec["done"], rec["total"] = int(done), int(total)

    def run() -> None:
        rec["status"], rec["started"] = "RUNNING", time.time()
        try:
            rec["result"] = work(progress)
            rec["status"] = "COMPLETED"
        except Exception as exc:  # surfaced to the client, not swallowed
            rec["error"] = f"{type(exc).__name__}: {exc}"
            rec["status"] = "FAILED"
        finally:
            rec["finished"] = time.time()

    _EXECUTOR.submit(run)
    return job_id


def get(job_id: str) -> Optional[Dict[str, Any]]:
    rec = _JOBS.get(job_id)
    if rec is None:
        return None
    now = time.time()
    end = rec["finished"] or now
    elapsed = round(end - rec["started"], 1) if rec["started"] else 0.0
    return {"job_id": rec["job_id"], "label": rec["label"], "status": rec["status"],
            "done": rec["done"], "total": rec["total"], "elapsed_s": elapsed,
            "result": rec["result"] if rec["status"] == "COMPLETED" else None, "error": rec["error"]}
