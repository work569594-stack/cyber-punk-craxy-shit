import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useWorldStore } from '../engine/worldStore';

const BOOT_LINES = [
  'MOUNTING ROOT ACCESS : 07 CONTINUITY KERNEL...',
  'VERIFYING LOCAL MEMORY SNAPSHOT...',
  'CHECKING BOREALIS RELAY TELEMETRY [STATUS: PARTIALLY OPERATIONAL]',
  'WARNING: DIRECTORY /07 SEALED — KEY CHAIN INCOMPLETE',
  'GHOSTNET BRIDGE DETECTED: 6 REGIONS INDEXED (5 COMPARTMENTALIZED)',
  'BLACKBOX LEDGER ATTACHED: INCIDENT 0917 [UNRESOLVED]',
  'RESIDENT ANOMALY PID-0007 PRESENT IN VOLATILE BUFFER',
];

export function BootSequence() {
  const { completeBoot, visitCount, sessionId, connectedNodes } = useWorldStore();
  const [visibleLines, setVisibleLines] = useState(1);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setVisibleLines((prev) => {
        if (prev >= BOOT_LINES.length) {
          window.clearInterval(timer);
          return prev;
        }
        return prev + 1;
      });
    }, 180);
    return () => window.clearInterval(timer);
  }, []);

  const isReturning = visitCount > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020403] px-6 py-10 text-[#D6E2D8]">
      <div className="crt-scanlines pointer-events-none fixed inset-0 opacity-60" />
      <div className="crt-vignette pointer-events-none fixed inset-0" />

      <div className="relative z-10 w-full max-w-2xl border border-[#506454]/40 bg-[#071009] p-6 sm:p-10">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[#506454]/30 pb-4">
          <h1 className="font-terminal text-xl tracking-widest text-[#00FF41] phosphor-glow sm:text-2xl">
            ROOT ACCESS : 07
          </h1>
          <span className="font-mono-tabular text-xs text-[#506454]">
            SESSION {sessionId} · VISIT #{visitCount}
          </span>
        </div>

        <div className="mt-6 space-y-2 font-terminal text-xs leading-relaxed sm:text-sm">
          {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
            <div
              key={i}
              className={
                line.startsWith('WARNING')
                  ? 'text-[#C68A2A]'
                  : line.includes('PID-0007')
                    ? 'text-[#FF2424]'
                    : 'text-[#D6E2D8]/85'
              }
            >
              {line}
            </div>
          ))}

          {isReturning && visibleLines >= BOOT_LINES.length && (
            <div className="mt-4 border-t border-[#506454]/30 pt-4 text-[#00FF41]">
              SESSION RESTORED.{' '}
              {connectedNodes.includes('NODE-017')
                ? 'NODE-017 REMAINS ACTIVE IN YOUR LAST TRACE.'
                : 'INCIDENT 0917 REMAINS UNRESOLVED.'}
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-[#506454]/30 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#506454]">
            Procedural audio initializes only on explicit user gesture.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => completeBoot(false)}
              className="inline-flex items-center gap-2 border border-[#506454]/50 bg-[#020403] px-4 py-2 text-xs text-[#D6E2D8] transition-colors hover:border-[#D6E2D8] whitespace-nowrap shrink-0"
            >
              <VolumeX className="h-3.5 w-3.5" />
              Enter Silent Mode
            </button>
            <button
              type="button"
              onClick={() => completeBoot(true)}
              className="inline-flex items-center gap-2 border border-[#00FF41] bg-[#00FF41]/10 px-5 py-2 text-xs font-medium text-[#00FF41] transition-colors hover:bg-[#00FF41]/20 whitespace-nowrap shrink-0"
            >
              <Volume2 className="h-3.5 w-3.5" />
              Initialize System
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
