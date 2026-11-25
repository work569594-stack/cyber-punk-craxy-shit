import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Terminal as TerminalIcon, Trash2 } from 'lucide-react';
import { useWorldStore } from '../engine/worldStore';
import { soundEngine } from '../audio/soundEngine';

export function PersistentTerminal() {
  const {
    terminalLines,
    terminalOpen,
    setTerminalOpen,
    currentDirectory,
    executeCommand,
    commandHistory,
    getCompletions,
    unlockedCommands,
  } = useWorldStore();

  const [input, setInput] = useState('');
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [terminalLines, terminalOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    executeCommand(input);
    setInput('');
    setHistoryIdx(-1);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const nextIdx = historyIdx < commandHistory.length - 1 ? historyIdx + 1 : historyIdx;
      setHistoryIdx(nextIdx);
      setInput(commandHistory[commandHistory.length - 1 - nextIdx] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx <= 0) {
        setHistoryIdx(-1);
        setInput('');
      } else {
        const nextIdx = historyIdx - 1;
        setHistoryIdx(nextIdx);
        setInput(commandHistory[commandHistory.length - 1 - nextIdx] ?? '');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const matches = getCompletions(input);
      if (matches.length === 1) {
        const parts = input.trimStart().split(/\s+/);
        if (parts.length <= 1) {
          setInput(`${matches[0]} `);
        } else {
          parts[parts.length - 1] = matches[0];
          setInput(parts.join(' '));
        }
        setSuggestions([]);
      } else if (matches.length > 1) {
        setSuggestions(matches.slice(0, 6));
      }
    } else {
      soundEngine.playClick();
    }
  };

  return (
    <section
      aria-label="ROOT Command Terminal"
      className="border-t border-[#506454]/35 bg-[#020403] text-[#D6E2D8]"
    >
      <div className="flex items-center justify-between border-b border-[#506454]/20 bg-[#071009] px-4 py-1.5">
        <button
          type="button"
          onClick={() => setTerminalOpen(!terminalOpen)}
          className="flex items-center gap-2 text-xs text-[#00FF41] hover:text-[#D6E2D8] whitespace-nowrap shrink-0"
        >
          <TerminalIcon className="h-3.5 w-3.5" />
          <span className="font-terminal tracking-wider">ROOT TERMINAL</span>
          <span className="font-mono-tabular text-[#506454]">
            {currentDirectory} · {unlockedCommands.length} verbs
          </span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => executeCommand('help')}
            className="hidden sm:inline-block px-2 py-0.5 text-[11px] text-[#506454] hover:text-[#00FF41] whitespace-nowrap shrink-0"
          >
            help
          </button>
          <button
            type="button"
            onClick={() => executeCommand('scan')}
            className="hidden sm:inline-block px-2 py-0.5 text-[11px] text-[#506454] hover:text-[#00FF41] whitespace-nowrap shrink-0"
          >
            scan
          </button>
          <button
            type="button"
            onClick={() => executeCommand('mission')}
            className="hidden sm:inline-block px-2 py-0.5 text-[11px] text-[#506454] hover:text-[#00FF41] whitespace-nowrap shrink-0"
          >
            mission
          </button>
          <button
            type="button"
            onClick={() => executeCommand('clear')}
            title="Clear terminal"
            className="p-1 text-[#506454] hover:text-[#D6E2D8]"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setTerminalOpen(!terminalOpen)}
            aria-label={terminalOpen ? 'Collapse terminal' : 'Expand terminal'}
            className="p-1 text-[#506454] hover:text-[#00FF41]"
          >
            {terminalOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {terminalOpen && (
        <div className="flex flex-col">
          <div
            ref={scrollRef}
            onClick={() => inputRef.current?.focus()}
            className="h-36 sm:h-44 overflow-y-auto px-4 py-2.5 font-terminal text-xs leading-relaxed space-y-1 cursor-text"
          >
            {terminalLines.map((line) => (
              <div
                key={line.id}
                className={`whitespace-pre-wrap break-words ${
                  line.type === 'input'
                    ? 'text-[#00FF41]'
                    : line.type === 'error'
                      ? 'text-[#FF2424]'
                      : line.type === 'warning'
                        ? 'text-[#C68A2A]'
                        : line.type === 'success'
                          ? 'text-[#00FF41]/90'
                          : line.type === 'entity'
                            ? 'text-[#FF2424]/90 italic'
                            : line.type === 'transmission'
                              ? 'text-[#C68A2A]'
                              : line.type === 'system'
                                ? 'text-[#D6E2D8] font-medium'
                                : 'text-[#D6E2D8]/80'
                }`}
              >
                <span className="mr-2 font-mono-tabular text-[10px] text-[#506454]">{line.timestamp}</span>
                {line.text}
              </div>
            ))}
          </div>

          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-[#506454]/20 bg-[#071009] px-4 py-1 text-[11px] text-[#506454]">
              <span>Completions:</span>
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    const parts = input.trimStart().split(/\s+/);
                    if (parts.length <= 1) setInput(`${s} `);
                    else {
                      parts[parts.length - 1] = s;
                      setInput(parts.join(' '));
                    }
                    setSuggestions([]);
                    inputRef.current?.focus();
                  }}
                  className="text-[#00FF41] hover:underline"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-[#506454]/25 bg-[#000000] px-4 py-2"
          >
            <span className="font-terminal text-xs text-[#00FF41] whitespace-nowrap shrink-0">
              {currentDirectory} &gt;
            </span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command (help, scan, ls, cat README.07, connect NODE-001)..."
              aria-label="Terminal command input"
              className="w-full bg-transparent font-terminal text-xs text-[#D6E2D8] placeholder-[#506454] focus:outline-none"
            />
          </form>
        </div>
      )}
    </section>
  );
}
