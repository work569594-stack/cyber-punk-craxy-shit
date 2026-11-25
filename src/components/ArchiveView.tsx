import { useMemo, useState } from 'react';
import { Download, FileText, Folder, FolderLock, History, Search } from 'lucide-react';
import { ALL_FILES, DIRECTORIES } from '../data/universeData';
import { useWorldStore } from '../engine/worldStore';

export function ArchiveView() {
  const {
    currentDirectory,
    setDirectory,
    selectedFileId,
    openFile,
    unlockedDirs,
    openedFiles,
    checkCondition,
    setView,
    connectNode,
    setSelectedIncident,
  } = useWorldStore();

  const [query, setQuery] = useState('');
  const [showVersionDiff, setShowVersionDiff] = useState(false);

  const dirFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_FILES.filter((f) => {
      if (q) {
        if (!unlockedDirs.includes(f.directory)) return false;
        return (
          f.name.toLowerCase().includes(q) ||
          f.summary.toLowerCase().includes(q) ||
          f.content.toLowerCase().includes(q)
        );
      }
      if (f.directory !== currentDirectory) return false;
      if (f.hidden && f.unlockCondition && !checkCondition(f.unlockCondition)) return false;
      return true;
    });
  }, [currentDirectory, query, unlockedDirs, checkCondition]);

  const activeFile = useMemo(
    () => ALL_FILES.find((f) => f.id === selectedFileId) ?? dirFiles[0],
    [selectedFileId, dirFiles]
  );

  const isMutated = Boolean(activeFile?.mutatedContent && checkCondition(activeFile.mutatedContent.condition));

  const renderedContent = useMemo(() => {
    if (!activeFile) return '';
    let text =
      isMutated && activeFile.mutatedContent ? activeFile.mutatedContent.content : activeFile.content;
    if (activeFile.redactions) {
      for (const r of activeFile.redactions) {
        if (checkCondition(r.revealCondition)) {
          text = text.replace(r.token, `[DECLASSIFIED: ${r.revealedText}]`);
        }
      }
    }
    return text;
  }, [activeFile, isMutated, checkCondition]);

  const handleDownload = () => {
    if (!activeFile) return;
    const blob = new Blob([`${activeFile.directory}/${activeFile.name}\n${activeFile.timestamp}\n\n${renderedContent}`], {
      type: 'text/plain',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeFile.name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-12 bg-[#020403] overflow-hidden">
      {/* Directory Column */}
      <aside className="md:col-span-3 border-b md:border-b-0 md:border-r border-[#506454]/25 bg-[#071009] flex flex-col overflow-hidden">
        <div className="p-3 border-b border-[#506454]/25">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-[#506454]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search unlocked archive..."
              className="w-full border border-[#506454]/40 bg-[#020403] pl-8 pr-2.5 py-1.5 text-xs text-[#D6E2D8] placeholder-[#506454] focus:border-[#00FF41] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {DIRECTORIES.map((d) => {
            const isUnlocked = unlockedDirs.includes(d.path);
            const isSelected = currentDirectory === d.path && !query;
            return (
              <button
                key={d.path}
                type="button"
                disabled={!isUnlocked}
                onClick={() => {
                  setQuery('');
                  setDirectory(d.path);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-left font-terminal text-xs border transition-colors ${
                  !isUnlocked
                    ? 'border-transparent text-[#506454]/60 cursor-not-allowed'
                    : isSelected
                      ? 'border-[#00FF41] bg-[#00FF41]/10 text-[#00FF41]'
                      : 'border-transparent text-[#D6E2D8]/85 hover:border-[#506454]/40'
                }`}
              >
                <span className="flex items-center gap-2">
                  {isUnlocked ? <Folder className="h-3.5 w-3.5" /> : <FolderLock className="h-3.5 w-3.5" />}
                  {d.path}
                </span>
                <span className="font-mono-tabular text-[10px] text-[#506454]">
                  {isUnlocked ? `L0${d.requiredAccess}` : 'SEALED'}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* File List Column */}
      <div className="md:col-span-3 border-b md:border-b-0 md:border-r border-[#506454]/25 bg-[#020403] flex flex-col overflow-hidden">
        <div className="border-b border-[#506454]/25 px-3 py-2 text-xs text-[#506454] font-mono-tabular">
          {query ? `Matches (${dirFiles.length})` : `${currentDirectory} (${dirFiles.length} files)`}
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-[#506454]/15">
          {dirFiles.map((f) => {
            const isSelected = activeFile?.id === f.id;
            const isRead = openedFiles.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setShowVersionDiff(false);
                  openFile(f.id);
                }}
                className={`w-full p-3 text-left transition-colors ${
                  isSelected ? 'bg-[#071009] text-[#00FF41]' : 'hover:bg-[#071009]/60 text-[#D6E2D8]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-terminal text-xs truncate">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    {f.name}
                  </span>
                  <span className="font-mono-tabular text-[10px] text-[#506454] shrink-0">
                    {isRead ? 'READ' : 'NEW'}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-[#506454] line-clamp-1">{f.summary}</div>
              </button>
            );
          })}
          {dirFiles.length === 0 && (
            <div className="p-4 text-xs text-[#506454]">No accessible files in this view.</div>
          )}
        </div>
      </div>

      {/* File Content Viewer */}
      <div className="md:col-span-6 flex flex-col overflow-hidden bg-[#020403]">
        {activeFile ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#506454]/25 bg-[#071009] px-5 py-3">
              <div>
                <div className="font-terminal text-sm text-[#D6E2D8]">
                  {activeFile.directory}/{activeFile.name}
                </div>
                <div className="mt-0.5 font-mono-tabular text-[11px] text-[#506454]">
                  {activeFile.classification} · {activeFile.author} · {activeFile.timestamp} · {activeFile.checksum}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeFile.versions && activeFile.versions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowVersionDiff(!showVersionDiff)}
                    className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs ${
                      showVersionDiff
                        ? 'border-[#C68A2A] text-[#C68A2A]'
                        : 'border-[#506454]/40 text-[#D6E2D8] hover:border-[#00FF41]'
                    }`}
                  >
                    <History className="h-3.5 w-3.5" />
                    Versions ({activeFile.versions.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 border border-[#506454]/40 px-2.5 py-1 text-xs text-[#D6E2D8] hover:border-[#00FF41]"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {isMutated && activeFile.mutatedContent && (
                <div className="border border-[#FF2424]/40 bg-[#FF2424]/10 px-3.5 py-2 text-xs text-[#FF2424]">
                  ANOMALY: {activeFile.mutatedContent.note}
                </div>
              )}

              <pre className="whitespace-pre-wrap font-terminal text-xs sm:text-sm leading-relaxed text-[#D6E2D8]">
                {renderedContent}
              </pre>

              {showVersionDiff && activeFile.versions && (
                <div className="border-t border-[#506454]/30 pt-4 space-y-3">
                  <div className="text-xs uppercase tracking-wider text-[#C68A2A]">Version History</div>
                  {activeFile.versions.map((v, idx) => (
                    <div key={idx} className="border border-[#506454]/30 bg-[#071009] p-3 space-y-1">
                      <div className="font-mono-tabular text-[11px] text-[#00FF41]">
                        {v.version} · {v.timestamp} · {v.author}
                      </div>
                      <p className="text-xs text-[#D6E2D8]/85">{v.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {(activeFile.linkedNodes?.length || activeFile.linkedIncidents?.length) && (
                <div className="border-t border-[#506454]/25 pt-4 flex flex-wrap gap-2">
                  {activeFile.linkedNodes?.map((nid) => (
                    <button
                      key={nid}
                      type="button"
                      onClick={() => {
                        connectNode(nid);
                        setView('GHOSTNET');
                      }}
                      className="border border-[#00FF41]/40 bg-[#071009] px-3 py-1 text-xs text-[#00FF41] hover:bg-[#00FF41]/10"
                    >
                      Trace {nid} in Ghostnet
                    </button>
                  ))}
                  {activeFile.linkedIncidents?.map((iid) => (
                    <button
                      key={iid}
                      type="button"
                      onClick={() => {
                        setSelectedIncident(iid);
                        setView('BLACKBOX');
                      }}
                      className="border border-[#C68A2A]/40 bg-[#071009] px-3 py-1 text-xs text-[#C68A2A] hover:bg-[#C68A2A]/10"
                    >
                      Inspect {iid} in Blackbox
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="p-6 text-xs text-[#506454]">Select a file from the index to inspect its contents.</div>
        )}
      </div>
    </div>
  );
}
