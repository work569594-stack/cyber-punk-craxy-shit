import { useState } from 'react';
import { Eye, Lock, Shield, UserCheck } from 'lucide-react';
import { ALL_FILES, PERSONNEL_PROFILES } from '../data/universeData';
import { useWorldStore } from '../engine/worldStore';

export function MemoryVaultView() {
  const { accessLevel, setView, connectNode, setSelectedIncident } = useWorldStore();
  const [selectedId, setSelectedId] = useState(PERSONNEL_PROFILES[0].id);
  const person = PERSONNEL_PROFILES.find((p) => p.id === selectedId) ?? PERSONNEL_PROFILES[0];

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-12 bg-[#020403] overflow-hidden">
      <aside className="md:col-span-4 border-b md:border-b-0 md:border-r border-[#506454]/25 bg-[#071009] overflow-y-auto divide-y divide-[#506454]/15">
        <div className="px-4 py-3 border-b border-[#506454]/25">
          <h2 className="font-editorial text-xl text-[#D6E2D8]">The Memory Vault</h2>
          <p className="text-[11px] text-[#506454]">12 Borealis &amp; Project ROOT Personnel Records</p>
        </div>
        {PERSONNEL_PROFILES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelectedId(p.id)}
            className={`w-full px-4 py-3 text-left transition-colors ${
              p.id === person.id ? 'bg-[#020403] text-[#00FF41]' : 'hover:bg-[#020403]/50 text-[#D6E2D8]'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-mono-tabular">
              <span>{p.code} · {p.name}</span>
              <span className={p.status === 'DELETED_FROM_ROSTER' ? 'text-[#FF2424]' : 'text-[#506454]'}>
                {p.status}
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-[#506454]">{p.role}</div>
          </button>
        ))}
      </aside>

      <div className="md:col-span-8 overflow-y-auto p-6 space-y-6">
        <div className="border-b border-[#506454]/25 pb-4 space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono-tabular text-[#506454]">
            <UserCheck className="h-3.5 w-3.5 text-[#00FF41]" />
            <span>{person.code}</span>
            <span>·</span>
            <span>{person.clearance}</span>
            <span>·</span>
            <span className="text-[#C68A2A]">{person.status}</span>
          </div>
          <h3 className="font-editorial text-3xl text-[#D6E2D8]">{person.name}</h3>
          <div className="text-xs text-[#506454]">{person.role} · Last Seen: {person.lastSeen}</div>
        </div>

        <p className="text-sm leading-relaxed text-[#D6E2D8]/90">{person.bio}</p>

        <div className="border border-[#506454]/35 bg-[#071009] p-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-terminal text-[#00FF41]">
            <span>{person.memoryFragmentTitle}</span>
            <span className="text-[11px] text-[#506454]">{person.memoryFragmentAudioHint}</span>
          </div>
          {accessLevel >= 1 || person.id === 'PER-VANCE' || person.id === 'PER-THORNE' ? (
            <blockquote className="font-editorial text-xl italic leading-relaxed text-[#D6E2D8]">
              "{person.memoryFragmentText}"
            </blockquote>
          ) : (
            <div className="flex items-center gap-2 text-xs text-[#506454]">
              <Lock className="h-3.5 w-3.5" /> Reach Access Level 01 (OBSERVER) to reconstruct this neural fragment.
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {person.linkedNodes.map((nid) => (
            <button
              key={nid}
              type="button"
              onClick={() => {
                connectNode(nid);
                setView('GHOSTNET');
              }}
              className="border border-[#00FF41]/40 bg-[#071009] px-3 py-1.5 text-xs text-[#00FF41] hover:bg-[#00FF41]/10"
            >
              Connect {nid}
            </button>
          ))}
          {person.linkedIncidents.map((iid) => (
            <button
              key={iid}
              type="button"
              onClick={() => {
                setSelectedIncident(iid);
                setView('BLACKBOX');
              }}
              className="border border-[#C68A2A]/40 bg-[#071009] px-3 py-1.5 text-xs text-[#C68A2A] hover:bg-[#C68A2A]/10"
            >
              Open {iid}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RedactedRoomView() {
  const { checkCondition, setView } = useWorldStore();
  const redactedFiles = ALL_FILES.filter((f) => f.redactions && f.redactions.length > 0);

  return (
    <div className="h-full overflow-y-auto bg-[#020403] p-6 space-y-6">
      <div className="max-w-4xl space-y-2 border-b border-[#506454]/25 pb-4">
        <div className="flex items-center gap-2 text-xs font-terminal text-[#FF2424]">
          <Shield className="h-4 w-4" />
          COMPARTMENTALIZED CENSORSHIP ARCHIVE
        </div>
        <h2 className="font-editorial text-3xl text-[#D6E2D8]">The Redacted Room</h2>
        <p className="text-xs text-[#506454]">
          Censored segments declassify automatically as you recover matching evidence, nodes, and ciphers across the universe.
        </p>
      </div>

      <div className="grid max-w-4xl gap-5">
        {redactedFiles.map((f) => {
          let display = f.content;
          let revealedCount = 0;
          const totalCount = f.redactions?.length ?? 0;

          f.redactions?.forEach((r) => {
            if (checkCondition(r.revealCondition)) {
              revealedCount += 1;
              display = display.replace(r.token, `[DECLASSIFIED: ${r.revealedText}]`);
            } else {
              display = display.replace(r.token, '████████████████');
            }
          });

          return (
            <div key={f.id} className="border border-[#506454]/35 bg-[#071009] p-5 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono-tabular">
                <span className="text-[#D6E2D8] font-medium">{f.directory}/{f.name}</span>
                <span className={revealedCount === totalCount ? 'text-[#00FF41]' : 'text-[#C68A2A]'}>
                  {revealedCount}/{totalCount} segments declassified
                </span>
              </div>
              <pre className="whitespace-pre-wrap font-terminal text-xs leading-relaxed text-[#D6E2D8]/90">
                {display}
              </pre>
            </div>
          );
        })}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setView('BLACKBOX')}
            className="inline-flex items-center gap-2 border border-[#506454]/40 bg-[#071009] px-4 py-2 text-xs text-[#D6E2D8] hover:border-[#00FF41]"
          >
            <Eye className="h-3.5 w-3.5" /> Investigate in Blackbox
          </button>
        </div>
      </div>
    </div>
  );
}
