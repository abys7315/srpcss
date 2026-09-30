import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { analyzeQuery, type AIAnalysisResult, type CopilotProvider } from '../../services/aiService';

interface AssistantDockProps {
  selectedWellId: string;
  onClose: () => void;
}

interface Turn { q: string; r?: AIAnalysisResult; error?: string }

const PROVIDER_LABEL: Record<string, string> = {
  gemini: 'Gemini (backend)',
  groq: 'Groq (backend)',
  template: 'Template summary (LLM offline)',
};

/**
 * Docked engineering assistant. Queries go to POST /api/v1/copilot; the backend builds the
 * context from the simulated DigitalTwinState of the selected well.
 */
export const AssistantDock: React.FC<AssistantDockProps> = ({ selectedWellId, onClose }) => {
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState<CopilotProvider>('auto');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [turns]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setQuery('');
    setBusy(true);
    setTurns((t) => [...t, { q }]);
    try {
      const r = await analyzeQuery(q, selectedWellId, provider);
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, r } : x)));
    } catch (e: any) {
      const msg = e?.response?.status ? `Request failed (HTTP ${e.response.status}).` : 'Backend unreachable.';
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: msg } : x)));
    } finally {
      setBusy(false);
    }
  };

  const prompts = [
    `Is ${selectedWellId} at risk of rod float at the current SPM?`,
    `Summarise the thermal state of ${selectedWellId}.`,
    `Which constraint is closest to its limit on ${selectedWellId}?`,
  ];

  return (
    <aside aria-label="Engineering assistant" className="w-[360px] shrink-0 border-l border-rule bg-panel flex flex-col h-[calc(100vh-7rem)] sticky top-[7rem]">
      <header className="flex items-center justify-between px-3 py-2 border-b border-rule">
        <div>
          <h2 className="font-cond text-[14px] font-semibold">Assistant</h2>
          <div className="text-[12px] text-muted">Context: simulated state of <span className="num">{selectedWellId}</span></div>
        </div>
        <button onClick={onClose} className="text-[12px] text-muted hover:text-ink px-1" aria-label="Close assistant">Close</button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 text-[13px]">
        {turns.length === 0 && (
          <div className="space-y-1.5">
            <p className="text-muted">Answers use only the twin's simulated values. Without a backend LLM key a template summary is returned.</p>
            {prompts.map((p) => (
              <button key={p} onClick={() => ask(p)} className="block w-full text-left px-2 py-1 border border-rule rounded-sm hover:bg-sunk transition-colors">
                {p}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className="animate-enter">
            <div className="text-muted">Q: {t.q}</div>
            {!t.r && !t.error && <div className="text-muted mt-1">Working…</div>}
            {t.error && <div className="text-alarm mt-1">{t.error}</div>}
            {t.r && (
              <div className="mt-1 border-l-2 border-rule pl-2">
                <div className="text-[11px] text-muted mb-1">
                  {PROVIDER_LABEL[t.r.provider] ?? t.r.provider} · <span className="num">{t.r.latencyMs} ms</span> · {t.r.timestamp}
                </div>
                {t.r.provider === 'template'
                  ? <pre className="whitespace-pre-wrap font-sans text-[13px]">{t.r.answer}</pre>
                  : <div className="ai-markdown" dangerouslySetInnerHTML={{ __html: marked.parse(t.r.answer) as string }} />}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(query); }} className="border-t border-rule p-2 space-y-1.5">
        <label className="sr-only" htmlFor="assistant-q">Question</label>
        <textarea
          id="assistant-q"
          rows={2}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(query); } }}
          placeholder="Ask about the selected well"
          className="w-full border rounded-sm px-2 py-1 text-[13px] resize-none"
        />
        <div className="flex items-center justify-between">
          <select value={provider} onChange={(e) => setProvider(e.target.value as CopilotProvider)} className="h-7 border rounded-sm px-1 text-[12px]" aria-label="Provider">
            <option value="auto">Provider: auto</option>
            <option value="gemini">Gemini</option>
            <option value="groq">Groq</option>
          </select>
          <button type="submit" disabled={busy || !query.trim()} className="h-7 px-3 bg-accent text-panel rounded-sm text-[12px] disabled:opacity-50">
            {busy ? 'Working…' : 'Ask'}
          </button>
        </div>
      </form>
    </aside>
  );
};
