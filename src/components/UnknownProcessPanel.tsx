import { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import { useWorldStore } from '../engine/worldStore';

interface UnknownProcessPanelProps {
  open: boolean;
  onClose: () => void;
}

const SUGGESTED_PROMPTS = [
  'Who are you?',
  'What happened during Incident 0917?',
  'Where is NODE-017?',
  'What should I investigate next?',
];

export function UnknownProcessPanel({ open, onClose }: UnknownProcessPanelProps) {
  const { entityMessages, entityLoading, askEntity, accessLevel } = useWorldStore();
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [entityMessages, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || entityLoading) return;
    void askEntity(input);
    setInput('');
  };

  return (
    <aside
      aria-label="UNKNOWN PROCESS Communication Channel"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-[#FF2424]/35 bg-[#020403] shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-[#506454]/30 bg-[#071009] px-5 py-3.5">
        <div>
          <div className="font-terminal text-xs tracking-widest text-[#FF2424]">
            PID-0007 // UNKNOWN PROCESS
          </div>
          <div className="mt-0.5 font-mono-tabular text-[11px] text-[#506454]">
            Clearance Observed: Level 0{accessLevel} · Fictional Continuity Core
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close UNKNOWN PROCESS panel"
          className="p-1 text-[#506454] hover:text-[#D6E2D8]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-5 space-y-4">
        {entityMessages.map((msg) => (
          <div
            key={msg.id}
            className={`border p-3.5 space-y-1.5 ${
              msg.sender === 'USER'
                ? 'border-[#00FF41]/30 bg-[#00FF41]/5 ml-6'
                : 'border-[#FF2424]/30 bg-[#071009] mr-4'
            }`}
          >
            <div className="flex items-center justify-between font-mono-tabular text-[10px] text-[#506454]">
              <span className={msg.sender === 'ENTITY' ? 'text-[#FF2424]' : 'text-[#00FF41]'}>
                {msg.sender === 'ENTITY' ? 'UNKNOWN PROCESS' : 'OBSERVER'}
              </span>
              <span>
                {msg.timestamp}
                {msg.mode ? ` · ${msg.mode === 'gemini' ? 'Neural Link' : 'Deterministic'}` : ''}
              </span>
            </div>
            <p className="font-terminal text-xs leading-relaxed text-[#D6E2D8]">{msg.text}</p>
          </div>
        ))}
        {entityLoading && (
          <div className="border border-[#506454]/25 bg-[#071009] p-3 text-xs text-[#506454]">
            Carrier oscillating across NODE-017...
          </div>
        )}
      </div>

      <div className="border-t border-[#506454]/25 bg-[#071009] px-4 py-2.5 flex flex-wrap gap-1.5">
        {SUGGESTED_PROMPTS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={entityLoading}
            onClick={() => void askEntity(q)}
            className="border border-[#506454]/35 bg-[#020403] px-2.5 py-1 text-[11px] text-[#D6E2D8]/85 hover:border-[#FF2424] hover:text-[#FF2424] disabled:opacity-40"
          >
            {q}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-[#506454]/30 bg-[#000000] p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Transmit inquiry to PID-0007..."
          className="flex-1 bg-transparent px-2 py-1 font-terminal text-xs text-[#D6E2D8] placeholder-[#506454] focus:outline-none"
        />
        <button
          type="submit"
          disabled={entityLoading || !input.trim()}
          className="inline-flex items-center gap-1.5 border border-[#FF2424]/50 bg-[#FF2424]/10 px-3 py-1.5 text-xs text-[#FF2424] hover:bg-[#FF2424]/20 disabled:opacity-40 whitespace-nowrap shrink-0"
        >
          <Send className="h-3.5 w-3.5" />
          Send
        </button>
      </form>
    </aside>
  );
}
