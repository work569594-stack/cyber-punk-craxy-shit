import { useMemo, useState } from 'react';
import { CheckCircle2, KeyRound, Lock, Radio } from 'lucide-react';
import { PUZZLES, TRANSMISSIONS } from '../data/universeData';
import { useWorldStore } from '../engine/worldStore';

const FREQ_BANDS = [7.07, 144.7, 218.4, 312.0, 433.92, 512.0, 600.0, 707.0, 868.1];

export function ObservatoryView() {
  const { solvedPuzzles, solvePuzzle } = useWorldStore();
  const [selectedBand, setSelectedBand] = useState<number | 'ALL'>('ALL');
  const [selectedPuzzleId, setSelectedPuzzleId] = useState(PUZZLES[0].id);
  const [answerInput, setAnswerInput] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const filteredTx = useMemo(
    () =>
      TRANSMISSIONS.filter((t) => selectedBand === 'ALL' || Math.abs(t.frequencyMhz - selectedBand) < 0.5),
    [selectedBand]
  );

  const activePuzzle = useMemo(
    () => PUZZLES.find((p) => p.id === selectedPuzzleId) ?? PUZZLES[0],
    [selectedPuzzleId]
  );

  const handleDecodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answerInput.trim()) return;
    const res = solvePuzzle(activePuzzle.id, answerInput);
    setFeedback({ ok: res.ok, msg: res.message });
    if (res.ok) setAnswerInput('');
  };

  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-12 bg-[#020403] overflow-hidden">
      {/* Left: Transmissions & Frequency Tuner */}
      <div className="lg:col-span-7 flex flex-col border-b lg:border-b-0 lg:border-r border-[#506454]/25 overflow-hidden">
        <div className="border-b border-[#506454]/25 bg-[#071009] px-5 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-editorial text-xl text-[#D6E2D8]">The Observatory — Dead Drop Receiver</h2>
            <span className="font-mono-tabular text-xs text-[#00FF41]">
              {TRANSMISSIONS.length} Intercepts
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedBand('ALL')}
              className={`px-2.5 py-1 font-mono-tabular text-[11px] border ${
                selectedBand === 'ALL'
                  ? 'border-[#00FF41] bg-[#00FF41]/10 text-[#00FF41]'
                  : 'border-[#506454]/30 text-[#506454] hover:text-[#D6E2D8]'
              }`}
            >
              ALL BANDS
            </button>
            {FREQ_BANDS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setSelectedBand(f)}
                className={`px-2.5 py-1 font-mono-tabular text-[11px] border ${
                  selectedBand === f
                    ? 'border-[#00FF41] bg-[#00FF41]/10 text-[#00FF41]'
                    : 'border-[#506454]/30 text-[#506454] hover:text-[#D6E2D8]'
                }`}
              >
                {f.toFixed(2)} MHz
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#506454]/15 p-4 space-y-2">
          {filteredTx.map((tx) => {
            const unlocked = !tx.puzzleId || solvedPuzzles.includes(tx.puzzleId);
            return (
              <div key={tx.id} className="pt-3 first:pt-0 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 font-mono-tabular text-[11px] text-[#506454]">
                  <span>
                    {tx.code} · {tx.frequencyMhz.toFixed(2)} MHz · {tx.sourceNodeId} → {tx.recipient}
                  </span>
                  <span>{tx.timestamp}</span>
                </div>
                <div className="font-terminal text-xs text-[#D6E2D8]">
                  {unlocked ? tx.decodedPayload : tx.rawPayload}
                </div>
                {tx.encrypted && !unlocked && tx.puzzleId && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#C68A2A]">
                      Encrypted [{tx.cipherType}] — {tx.hint}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPuzzleId(tx.puzzleId!);
                        setFeedback(null);
                      }}
                      className="border border-[#C68A2A]/50 px-2.5 py-0.5 text-[11px] text-[#C68A2A] hover:bg-[#C68A2A]/10"
                    >
                      Load in Decoder
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Cipher Workbench */}
      <aside className="lg:col-span-5 flex flex-col bg-[#071009] overflow-hidden">
        <div className="border-b border-[#506454]/25 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-terminal text-[#00FF41]">
            <KeyRound className="h-4 w-4" />
            CIPHER DECODER ({solvedPuzzles.length}/{PUZZLES.length} SOLVED)
          </div>
          <Radio className="h-4 w-4 text-[#506454]" />
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[#506454] mb-1.5">
              Select Intercepted Cipher
            </label>
            <select
              value={activePuzzle.id}
              onChange={(e) => {
                setSelectedPuzzleId(e.target.value);
                setFeedback(null);
              }}
              className="w-full border border-[#506454]/40 bg-[#020403] px-3 py-2 text-xs text-[#D6E2D8] focus:border-[#00FF41] focus:outline-none"
            >
              {PUZZLES.map((p) => (
                <option key={p.id} value={p.id}>
                  {solvedPuzzles.includes(p.id) ? '[SOLVED] ' : '[LOCKED] '}
                  {p.title} ({p.cipherType})
                </option>
              ))}
            </select>
          </div>

          <div className="border border-[#506454]/30 bg-[#020403] p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono-tabular">
              <span className="text-[#C68A2A]">{activePuzzle.cipherType}</span>
              {solvedPuzzles.includes(activePuzzle.id) ? (
                <span className="inline-flex items-center gap-1 text-[#00FF41]">
                  <CheckCircle2 className="h-3.5 w-3.5" /> VERIFIED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[#506454]">
                  <Lock className="h-3.5 w-3.5" /> LOCKED
                </span>
              )}
            </div>
            <p className="text-xs text-[#D6E2D8]/90">{activePuzzle.prompt}</p>
            <div className="border border-[#506454]/25 bg-[#071009] p-3 font-terminal text-xs text-[#00FF41] break-all">
              {activePuzzle.encodedData}
            </div>
            <div className="text-[11px] text-[#506454]">Hint: {activePuzzle.hint}</div>
          </div>

          <form onSubmit={handleDecodeSubmit} className="space-y-3">
            <input
              type="text"
              value={answerInput}
              onChange={(e) => setAnswerInput(e.target.value)}
              placeholder="Enter decoded plaintext or codeword..."
              className="w-full border border-[#506454]/40 bg-[#020403] px-3 py-2 font-terminal text-xs text-[#D6E2D8] placeholder-[#506454] focus:border-[#00FF41] focus:outline-none"
            />
            <button
              type="submit"
              className="w-full border border-[#00FF41] bg-[#00FF41]/10 py-2 text-xs font-medium text-[#00FF41] hover:bg-[#00FF41]/20"
            >
              Verify Decryption
            </button>
          </form>

          {feedback && (
            <div
              className={`border p-3 text-xs ${
                feedback.ok
                  ? 'border-[#00FF41]/50 bg-[#00FF41]/10 text-[#00FF41]'
                  : 'border-[#FF2424]/50 bg-[#FF2424]/10 text-[#FF2424]'
              }`}
            >
              {feedback.msg}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
