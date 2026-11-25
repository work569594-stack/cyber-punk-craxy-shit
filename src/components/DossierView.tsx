import { useMemo, useState } from 'react';
import { Check, CloudUpload, Copy, Download, Printer } from 'lucide-react';
import { ACCESS_LEVELS, ALL_FILES, ENDINGS, EVIDENCE_ITEMS, OPERATIONS } from '../data/universeData';
import { useWorldStore } from '../engine/worldStore';
import { saveDossierToCloud } from '../lib/persistence';

export function DossierView() {
  const {
    sessionId,
    accessLevel,
    visitCount,
    totalTimeSeconds,
    discoveredNodes,
    connectedNodes,
    openedFiles,
    recoveredEvidence,
    evidenceConnections,
    solvedPuzzles,
    completedMissions,
    endingReached,
    cloudUid,
    cloudEmail,
    pushNotification,
  } = useWorldStore();

  const [copied, setCopied] = useState(false);
  const [savingCloud, setSavingCloud] = useState(false);

  const contradictions = evidenceConnections.filter((c) => c.status === 'CONTRADICTION');
  const tier = ACCESS_LEVELS[accessLevel] ?? ACCESS_LEVELS[0];
  const mins = Math.floor(totalTimeSeconds / 60);
  const secs = totalTimeSeconds % 60;
  const ending = endingReached ? ENDINGS[endingReached] : null;

  const dossierText = useMemo(() => {
    return [
      '============================================================',
      'PROJECT ROOT // CLASSIFIED SESSION INTELLIGENCE DOSSIER',
      '============================================================',
      `SESSION ID        : ${sessionId}`,
      `OBSERVER          : ${cloudEmail ?? 'UNREGISTERED OBSERVER'}`,
      `CLEARANCE LEVEL   : LEVEL 0${accessLevel} (${tier.name})`,
      `VISITS / DURATION : ${visitCount} visits // ${mins}m ${secs}s`,
      `GHOSTNET TOPOLOGY : ${connectedNodes.length} connected / ${discoveredNodes.length} indexed`,
      `ARCHIVE FILES     : ${openedFiles.length} / ${ALL_FILES.length} examined`,
      `BLACKBOX LEDGER   : ${recoveredEvidence.length} / ${EVIDENCE_ITEMS.length} evidence items`,
      `CONTRADICTIONS    : ${contradictions.length} verified`,
      `CIPHERS SOLVED    : ${solvedPuzzles.length}`,
      `OPERATIONS        : ${completedMissions.length} / ${OPERATIONS.length} completed`,
      `FINAL RESOLUTION  : ${ending ? `${ending.code} — ${ending.title}` : 'UNRESOLVED / IN PROGRESS'}`,
      '',
      '--- VERIFIED CONTRADICTIONS ---',
      ...(contradictions.length > 0
        ? contradictions.map((c, idx) => `${idx + 1}. ${c.note}`)
        : ['None verified yet.']),
      '',
      '--- CONNECTED GHOSTNET NODES ---',
      connectedNodes.join(', ') || 'None connected yet.',
      '',
      '--- CONCLUSIONS ---',
      ending ? ending.narrative : 'Incident 0917 investigation remains active across Root Access, Ghostnet, and Blackbox.',
    ].join('\n');
  }, [
    sessionId,
    cloudEmail,
    accessLevel,
    tier.name,
    visitCount,
    mins,
    secs,
    connectedNodes,
    discoveredNodes.length,
    openedFiles.length,
    recoveredEvidence.length,
    contradictions,
    solvedPuzzles.length,
    completedMissions.length,
    ending,
  ]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(dossierText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      pushNotification({ title: 'CLIPBOARD BLOCKED', message: 'Use Download .TXT instead.', severity: 'WARNING' });
    }
  };

  const handleDownload = () => {
    const blob = new Blob([dossierText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ROOT07_DOSSIER_${sessionId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCloudSave = async () => {
    if (!cloudUid) return;
    setSavingCloud(true);
    try {
      const code = `${sessionId}_${Date.now().toString(36).toUpperCase()}`;
      await saveDossierToCloud(cloudUid, code, accessLevel, endingReached, dossierText);
      pushNotification({
        title: 'DOSSIER ARCHIVED TO CLOUD',
        message: `Stored encrypted ledger ${code} under your verified session.`,
        severity: 'INFO',
      });
    } catch (err) {
      pushNotification({
        title: 'CLOUD ARCHIVE ERROR',
        message: err instanceof Error ? err.message : 'Unable to save dossier.',
        severity: 'WARNING',
      });
    } finally {
      setSavingCloud(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#020403] p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#506454]/30 pb-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[#506454]">
            Investigation Output
          </div>
          <h2 className="mt-1 font-editorial text-2xl sm:text-3xl font-semibold text-[#D6E2D8]">
            Session Intelligence Dossier
          </h2>
          <p className="mt-1 font-mono-tabular text-xs text-[#00FF41]">
            {sessionId} · Level 0{accessLevel} ({tier.name})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center gap-1.5 border border-[#506454]/40 bg-[#071009] px-3 py-1.5 text-xs text-[#D6E2D8] hover:border-[#00FF41] hover:text-[#00FF41] whitespace-nowrap shrink-0"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 border border-[#506454]/40 bg-[#071009] px-3 py-1.5 text-xs text-[#D6E2D8] hover:border-[#00FF41] hover:text-[#00FF41] whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Download .TXT
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 border border-[#506454]/40 bg-[#071009] px-3 py-1.5 text-xs text-[#D6E2D8] hover:border-[#C68A2A] hover:text-[#C68A2A] whitespace-nowrap shrink-0"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / PDF
          </button>
          {cloudUid && (
            <button
              type="button"
              disabled={savingCloud}
              onClick={() => void handleCloudSave()}
              className="inline-flex items-center gap-1.5 border border-[#00FF41]/50 bg-[#00FF41]/10 px-3 py-1.5 text-xs text-[#00FF41] hover:bg-[#00FF41]/20 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <CloudUpload className="h-3.5 w-3.5" />
              {savingCloud ? 'Archiving...' : 'Archive to Cloud'}
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border border-[#506454]/25 bg-[#071009] p-4 font-mono-tabular">
        <div>
          <div className="text-[11px] text-[#506454]">Elapsed Time</div>
          <div className="mt-1 text-lg text-[#D6E2D8]">{mins}m {secs}s</div>
        </div>
        <div>
          <div className="text-[11px] text-[#506454]">Nodes Connected</div>
          <div className="mt-1 text-lg text-[#D6E2D8]">{connectedNodes.length} / {discoveredNodes.length}</div>
        </div>
        <div>
          <div className="text-[11px] text-[#506454]">Contradictions</div>
          <div className="mt-1 text-lg text-[#FF2424]">{contradictions.length}</div>
        </div>
        <div>
          <div className="text-[11px] text-[#506454]">Operations Complete</div>
          <div className="mt-1 text-lg text-[#00FF41]">{completedMissions.length} / {OPERATIONS.length}</div>
        </div>
      </div>

      <pre className="whitespace-pre-wrap border border-[#506454]/30 bg-[#000000] p-6 font-terminal text-xs leading-relaxed text-[#D6E2D8]">
        {dossierText}
      </pre>
    </div>
  );
}
