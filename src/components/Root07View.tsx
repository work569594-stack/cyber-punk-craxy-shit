import { ArrowRight, CheckCircle2, FileText, ShieldCheck } from 'lucide-react';
import { ENDINGS } from '../data/universeData';
import { useWorldStore } from '../engine/worldStore';
import { EndingId } from '../types/universe';

const ENDING_LIST = Object.values(ENDINGS);

export function Root07View() {
  const {
    endingReached,
    chooseEnding,
    connectedNodes,
    openedFiles,
    evidenceConnections,
    solvedPuzzles,
    setView,
    openFile,
  } = useWorldStore();

  const contradictions = evidenceConnections.filter((c) => c.status === 'CONTRADICTION').length;
  const activeEnding = endingReached ? ENDINGS[endingReached] : null;

  return (
    <div className="h-full overflow-y-auto bg-[#020403] p-6 space-y-8">
      <header className="border-b border-[#00FF41]/30 pb-5">
        <div className="text-[11px] uppercase tracking-[0.24em] text-[#00FF41]">
          Directory /07 · Continuity Chamber B
        </div>
        <h2 className="mt-1 font-editorial text-3xl sm:text-4xl font-semibold text-[#D6E2D8]">
          ROOT-07 — Convergence Point
        </h2>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-[#D6E2D8]/85">
          All three layers converge here. Incident 0917 was not an accidental coolant failure: Directorate Order 44-B sealed Sub-Level 3 remotely while Dr. Elena Vance anchored her continuity profile inside NODE-017, sustained by Sub-Level 4 geothermal relays and Mirror Instance 05.
        </p>

        <div className="mt-4 flex flex-wrap gap-6 font-mono-tabular text-xs text-[#506454]">
          <span>Connected Nodes: {connectedNodes.length}</span>
          <span>Files Examined: {openedFiles.length}</span>
          <span>Contradictions Confirmed: {contradictions}</span>
          <span>Ciphers Decoded: {solvedPuzzles.length}</span>
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            openFile('core_truth_07');
            setView('ARCHIVE');
          }}
          className="inline-flex items-center gap-2 border border-[#00FF41]/50 bg-[#071009] px-4 py-2 text-xs text-[#00FF41] hover:bg-[#00FF41]/10 whitespace-nowrap shrink-0"
        >
          <FileText className="h-3.5 w-3.5" />
          Read /07/project_root_truth.07
        </button>
        <button
          type="button"
          onClick={() => setView('DOSSIER')}
          className="inline-flex items-center gap-2 border border-[#C68A2A]/50 bg-[#071009] px-4 py-2 text-xs text-[#C68A2A] hover:bg-[#C68A2A]/10 whitespace-nowrap shrink-0"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Compile Session Dossier
        </button>
      </div>

      {activeEnding && (
        <section className="border border-[#00FF41] bg-[#071009] p-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-terminal text-xs tracking-widest text-[#00FF41]">
              PROTOCOL EXECUTED // {activeEnding.code}: {activeEnding.title}
            </span>
            <CheckCircle2 className="h-4 w-4 text-[#00FF41]" />
          </div>
          <p className="text-sm leading-relaxed text-[#D6E2D8]">{activeEnding.narrative}</p>
          <p className="border-t border-[#506454]/25 pt-3 font-terminal text-xs text-[#C68A2A]">
            {activeEnding.epilogue}
          </p>
          <p className="text-[11px] text-[#506454]">
            Free exploration remains open across all environments. You may revisit files or evaluate alternative resolutions below.
          </p>
        </section>
      )}

      <section className="space-y-3">
        <div className="text-xs uppercase tracking-widest text-[#506454]">
          Select Continuity Resolution
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ENDING_LIST.map((end) => {
            const isChosen = endingReached === end.id;
            return (
              <div
                key={end.id}
                className={`flex flex-col justify-between border p-5 transition-colors ${
                  isChosen
                    ? 'border-[#00FF41] bg-[#00FF41]/10'
                    : 'border-[#506454]/30 bg-[#071009] hover:border-[#506454]'
                }`}
              >
                <div className="space-y-2">
                  <div className="font-mono-tabular text-[11px] text-[#00FF41]">{end.code}</div>
                  <h3 className="font-editorial text-xl font-semibold text-[#D6E2D8]">{end.title}</h3>
                  <p className="text-xs leading-relaxed text-[#D6E2D8]/80">{end.subtitle}</p>
                </div>

                <button
                  type="button"
                  onClick={() => chooseEnding(end.id as EndingId)}
                  className="mt-5 inline-flex items-center justify-between border border-[#506454]/50 bg-[#020403] px-3.5 py-2 text-xs text-[#D6E2D8] hover:border-[#00FF41] hover:text-[#00FF41] whitespace-nowrap"
                >
                  <span>{isChosen ? 'Resolution Active' : 'Execute Protocol'}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
