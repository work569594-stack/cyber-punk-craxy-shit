import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Link2, Trash2, Unlink } from 'lucide-react';
import { EVIDENCE_ITEMS, INCIDENTS } from '../data/universeData';
import { useWorldStore } from '../engine/worldStore';

export function BlackboxView() {
  const {
    selectedIncidentId,
    setSelectedIncident,
    recoveredEvidence,
    evidenceConnections,
    evidencePositions,
    evidenceNotes,
    moveEvidenceCard,
    connectEvidence,
    removeEvidenceConnection,
    setEvidenceNote,
  } = useWorldStore();

  const [tab, setTab] = useState<'BOARD' | 'TIMELINE' | 'STAGES'>('BOARD');
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [activeEvidenceId, setActiveEvidenceId] = useState<string | null>('ev_official_0917');
  const draggingRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const incident = useMemo(
    () => INCIDENTS.find((i) => i.id === selectedIncidentId) ?? INCIDENTS[0],
    [selectedIncidentId]
  );

  const visibleEvidence = useMemo(
    () => EVIDENCE_ITEMS.filter((e) => recoveredEvidence.includes(e.id)),
    [recoveredEvidence]
  );

  const contradictionsCount = evidenceConnections.filter((c) => c.status === 'CONTRADICTION').length;
  const incidentStatus =
    incident.id === 'INC-0917' && contradictionsCount > 0 ? 'RECONSTRUCTION_AVAILABLE' : incident.status;

  const activeEvidence = visibleEvidence.find((e) => e.id === activeEvidenceId) ?? visibleEvidence[0];

  const handlePointerDownCard = (e: React.PointerEvent, id: string) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = evidencePositions[id] ?? { x: 80, y: 80 };
    draggingRef.current = {
      id,
      offsetX: e.clientX - rect.left + (boardRef.current?.scrollLeft ?? 0) - pos.x,
      offsetY: e.clientY - rect.top + (boardRef.current?.scrollTop ?? 0) - pos.y,
    };
    setActiveEvidenceId(id);
  };

  const handlePointerMoveBoard = (e: React.PointerEvent) => {
    if (!draggingRef.current || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = Math.max(16, Math.min(1150, e.clientX - rect.left + boardRef.current.scrollLeft - draggingRef.current.offsetX));
    const y = Math.max(16, Math.min(820, e.clientY - rect.top + boardRef.current.scrollTop - draggingRef.current.offsetY));
    moveEvidenceCard(draggingRef.current.id, { x: Math.round(x), y: Math.round(y) });
  };

  const handlePointerUpBoard = () => {
    draggingRef.current = null;
  };

  const handleLinkClick = (id: string) => {
    if (!linkingFrom) {
      setLinkingFrom(id);
      return;
    }
    if (linkingFrom === id) {
      setLinkingFrom(null);
      return;
    }
    connectEvidence(linkingFrom, id);
    setLinkingFrom(null);
  };

  const timelineSorted = useMemo(
    () => [...visibleEvidence].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    [visibleEvidence]
  );

  return (
    <div className="flex h-full flex-col bg-[#020403] overflow-hidden">
      {/* Top Incident Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#506454]/25 bg-[#071009] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {INCIDENTS.map((inc) => (
            <button
              key={inc.id}
              type="button"
              onClick={() => setSelectedIncident(inc.id)}
              className={`px-3 py-1 font-terminal text-xs border whitespace-nowrap shrink-0 ${
                incident.id === inc.id
                  ? 'border-[#C68A2A] bg-[#C68A2A]/15 text-[#C68A2A]'
                  : 'border-[#506454]/30 bg-[#020403] text-[#D6E2D8]/80 hover:border-[#D6E2D8]'
              }`}
            >
              INC-{inc.code}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('BOARD')}
            className={`px-3 py-1 text-xs border whitespace-nowrap ${
              tab === 'BOARD' ? 'border-[#00FF41] text-[#00FF41]' : 'border-[#506454]/30 text-[#506454] hover:text-[#D6E2D8]'
            }`}
          >
            Evidence Board
          </button>
          <button
            type="button"
            onClick={() => setTab('TIMELINE')}
            className={`px-3 py-1 text-xs border whitespace-nowrap ${
              tab === 'TIMELINE' ? 'border-[#00FF41] text-[#00FF41]' : 'border-[#506454]/30 text-[#506454] hover:text-[#D6E2D8]'
            }`}
          >
            Timeline
          </button>
          <button
            type="button"
            onClick={() => setTab('STAGES')}
            className={`px-3 py-1 text-xs border whitespace-nowrap ${
              tab === 'STAGES' ? 'border-[#00FF41] text-[#00FF41]' : 'border-[#506454]/30 text-[#506454] hover:text-[#D6E2D8]'
            }`}
          >
            Briefing &amp; Stages
          </button>
        </div>
      </div>

      {/* Sub-header status */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#506454]/20 bg-[#020403] px-4 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-terminal font-semibold text-[#D6E2D8]">
            INCIDENT {incident.code} — {incident.title}
          </span>
          <span className="text-[#506454]">·</span>
          <span className={incidentStatus === 'RECONSTRUCTION_AVAILABLE' ? 'text-[#00FF41]' : 'text-[#C68A2A]'}>
            {incidentStatus}
          </span>
        </div>
        <div className="font-mono-tabular text-[#506454]">
          Evidence: {visibleEvidence.length}/{EVIDENCE_ITEMS.length} · Contradictions Verified: {contradictionsCount}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'BOARD' && (
          <div className="grid h-full grid-cols-1 lg:grid-cols-12">
            {/* Interactive Drag Board */}
            <div
              ref={boardRef}
              onPointerMove={handlePointerMoveBoard}
              onPointerUp={handlePointerUpBoard}
              onPointerLeave={handlePointerUpBoard}
              className="relative lg:col-span-8 overflow-auto bg-[#020403] select-none"
              style={{
                backgroundImage:
                  'radial-gradient(rgba(80, 100, 84, 0.22) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            >
              <div className="relative min-w-[1160px] min-h-[860px]">
                {/* Connection Wires SVG */}
                <svg className="pointer-events-none absolute inset-0 h-full w-full">
                  {evidenceConnections.map((conn) => {
                    const p1 = evidencePositions[conn.fromId] ?? { x: 80, y: 80 };
                    const p2 = evidencePositions[conn.toId] ?? { x: 360, y: 80 };
                    const color =
                      conn.status === 'CONTRADICTION'
                        ? '#FF2424'
                        : conn.status === 'VALID'
                          ? '#00FF41'
                          : '#C68A2A';
                    return (
                      <line
                        key={conn.id}
                        x1={p1.x + 120}
                        y1={p1.y + 45}
                        x2={p2.x + 120}
                        y2={p2.y + 45}
                        stroke={color}
                        strokeWidth={conn.status === 'CONTRADICTION' ? 2.2 : 1.5}
                        strokeDasharray={conn.status === 'HYPOTHESIS' ? '5 4' : undefined}
                      />
                    );
                  })}
                </svg>

                {/* Evidence Cards */}
                {visibleEvidence.map((ev) => {
                  const pos = evidencePositions[ev.id] ?? ev.defaultPos;
                  const isActive = activeEvidence?.id === ev.id;
                  const isLinking = linkingFrom === ev.id;
                  return (
                    <div
                      key={ev.id}
                      onPointerDown={(e) => handlePointerDownCard(e, ev.id)}
                      style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)` }}
                      className={`absolute top-0 left-0 w-60 cursor-grab active:cursor-grabbing border bg-[#071009] p-3 transition-colors ${
                        isLinking
                          ? 'border-[#C68A2A]'
                          : isActive
                            ? 'border-[#00FF41]'
                            : 'border-[#506454]/45 hover:border-[#D6E2D8]/60'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono-tabular">
                        <span className="text-[#00FF41]">{ev.code} · {ev.category}</span>
                        <span
                          className={
                            ev.reliability === 'ANOMALOUS' || ev.reliability === 'CONTESTED'
                              ? 'text-[#FF2424]'
                              : 'text-[#506454]'
                          }
                        >
                          {ev.reliability}
                        </span>
                      </div>
                      <div className="mt-1 text-xs font-medium text-[#D6E2D8]">{ev.title}</div>
                      <div className="mt-1 font-mono-tabular text-[10px] text-[#506454]">{ev.timestamp}</div>
                      <p className="mt-1.5 text-[11px] leading-snug text-[#D6E2D8]/80">{ev.summary}</p>
                      <div className="mt-2.5 flex items-center justify-between border-t border-[#506454]/20 pt-2">
                        <button
                          type="button"
                          onClick={() => handleLinkClick(ev.id)}
                          className={`inline-flex items-center gap-1 text-[11px] ${
                            isLinking
                              ? 'text-[#C68A2A]'
                              : linkingFrom
                                ? 'text-[#00FF41]'
                                : 'text-[#506454] hover:text-[#00FF41]'
                          }`}
                        >
                          <Link2 className="h-3 w-3" />
                          {isLinking ? 'Cancel Link' : linkingFrom ? 'Connect Here' : 'Link'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveEvidenceId(ev.id)}
                          className="text-[11px] text-[#506454] hover:text-[#D6E2D8]"
                        >
                          Inspect
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Inspector & Connections */}
            <aside className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-[#506454]/25 bg-[#071009] p-4 overflow-y-auto space-y-4">
              {activeEvidence && (
                <div className="space-y-3 border-b border-[#506454]/25 pb-4">
                  <div className="flex items-center justify-between text-xs font-mono-tabular text-[#506454]">
                    <span>{activeEvidence.code} · {activeEvidence.origin}</span>
                    <span>{activeEvidence.classification}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-[#D6E2D8]">{activeEvidence.title}</h4>
                  <p className="text-xs leading-relaxed text-[#D6E2D8]/90">{activeEvidence.content}</p>
                  <div>
                    <label className="block text-[11px] text-[#506454] mb-1">Investigator Note</label>
                    <textarea
                      value={evidenceNotes[activeEvidence.id] ?? ''}
                      onChange={(e) => setEvidenceNote(activeEvidence.id, e.target.value)}
                      rows={2}
                      placeholder="Record observation or timestamp conflict..."
                      className="w-full border border-[#506454]/40 bg-[#020403] p-2 text-xs text-[#D6E2D8] placeholder-[#506454] focus:border-[#00FF41] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-[#506454]">
                    Evidence Links ({evidenceConnections.length})
                  </span>
                  {linkingFrom && (
                    <button
                      type="button"
                      onClick={() => setLinkingFrom(null)}
                      className="inline-flex items-center gap-1 text-[11px] text-[#C68A2A]"
                    >
                      <Unlink className="h-3 w-3" /> Cancel link
                    </button>
                  )}
                </div>

                {evidenceConnections.length === 0 ? (
                  <p className="text-xs text-[#506454]">
                    Click "Link" on any evidence card, then click another card to test relationships and uncover contradictions.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {evidenceConnections.map((conn) => {
                      const a = EVIDENCE_ITEMS.find((e) => e.id === conn.fromId);
                      const b = EVIDENCE_ITEMS.find((e) => e.id === conn.toId);
                      return (
                        <div
                          key={conn.id}
                          className="border border-[#506454]/30 bg-[#020403] p-2.5 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`inline-flex items-center gap-1 font-mono-tabular text-[11px] ${
                                conn.status === 'CONTRADICTION'
                                  ? 'text-[#FF2424]'
                                  : conn.status === 'VALID'
                                    ? 'text-[#00FF41]'
                                    : 'text-[#C68A2A]'
                              }`}
                            >
                              {conn.status === 'CONTRADICTION' ? (
                                <AlertTriangle className="h-3 w-3" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3" />
                              )}
                              {a?.code} ↔ {b?.code} ({conn.status})
                            </span>
                            <button
                              type="button"
                              onClick={() => removeEvidenceConnection(conn.id)}
                              aria-label="Remove connection"
                              className="text-[#506454] hover:text-[#FF2424]"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                          <p className="text-[11px] text-[#D6E2D8]/80">{conn.note}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

        {tab === 'TIMELINE' && (
          <div className="h-full overflow-y-auto p-6 space-y-4">
            <h3 className="font-editorial text-2xl text-[#D6E2D8]">Chronological Reconstruction</h3>
            <div className="space-y-2.5 max-w-4xl">
              {timelineSorted.map((ev) => (
                <div
                  key={ev.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-[#506454]/30 bg-[#071009] p-3.5"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-mono-tabular text-xs">
                      <Clock className="h-3.5 w-3.5 text-[#00FF41]" />
                      <span className="text-[#00FF41]">{ev.timestamp}</span>
                      <span className="text-[#506454]">·</span>
                      <span className="text-[#D6E2D8] font-medium">{ev.code}: {ev.title}</span>
                    </div>
                    <p className="text-xs text-[#D6E2D8]/80">{ev.summary}</p>
                  </div>
                  <span
                    className={`font-mono-tabular text-[11px] shrink-0 ${
                      ev.reliability === 'ANOMALOUS' || ev.reliability === 'CONTESTED'
                        ? 'text-[#FF2424]'
                        : 'text-[#506454]'
                    }`}
                  >
                    {ev.reliability}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'STAGES' && (
          <div className="h-full overflow-y-auto p-6 space-y-6 max-w-4xl">
            <div className="space-y-2 border-b border-[#506454]/25 pb-4">
              <div className="text-xs font-mono-tabular text-[#506454]">
                {incident.facility} · {incident.dateOccurred} · {incident.classification}
              </div>
              <h3 className="font-editorial text-2xl text-[#D6E2D8]">{incident.title}</h3>
              <p className="text-sm leading-relaxed text-[#D6E2D8]/85">{incident.briefing}</p>
              <div className="mt-3 border border-[#506454]/30 bg-[#071009] p-3 text-xs text-[#C68A2A]">
                Official Narrative: {incident.officialNarrative}
              </div>
              {contradictionsCount > 0 && (
                <div className="mt-2 border border-[#FF2424]/40 bg-[#FF2424]/10 p-3 text-xs text-[#D6E2D8]">
                  Reconstructed Assessment: {incident.hiddenTruth}
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              <div className="text-xs uppercase tracking-wider text-[#506454]">Investigation Progression</div>
              {incident.stages.map((st) => {
                const unlocked = visibleEvidence.length >= st.requiredEvidenceCount;
                return (
                  <div
                    key={st.stageNumber}
                    className={`border p-3.5 ${
                      unlocked
                        ? 'border-[#00FF41]/40 bg-[#071009]'
                        : 'border-[#506454]/20 bg-[#020403] opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-terminal">
                      <span className={unlocked ? 'text-[#00FF41]' : 'text-[#506454]'}>{st.title}</span>
                      <span className="font-mono-tabular text-[11px] text-[#506454]">
                        {unlocked ? 'UNLOCKED' : `Requires ${st.requiredEvidenceCount} evidence`}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#D6E2D8]/80">
                      {unlocked ? st.summary : 'Recover additional evidence across files and Ghostnet nodes.'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
