import React, { Component, useEffect, useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { CheckCircle2, Cloud, LogIn, LogOut, RotateCcw, Sliders, Volume2, VolumeX, X } from 'lucide-react';
import { OPERATIONS } from '../data/universeData';
import { useWorldStore } from '../engine/worldStore';
import { soundEngine } from '../audio/soundEngine';
import { auth, googleProvider } from '../lib/firebase';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message || 'Subsystem fault encountered.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#020403] p-6 text-[#D6E2D8]">
          <div className="max-w-lg border border-[#FF2424]/50 bg-[#071009] p-6 space-y-4">
            <div className="font-terminal text-sm text-[#FF2424]">KERNEL RECOVERY MODE</div>
            <p className="text-xs text-[#D6E2D8]/85">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="border border-[#00FF41] px-4 py-2 text-xs text-[#00FF41]"
            >
              Reinitialize Shell
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function AudioControlPopover({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { audioEnabled, masterVolume, ambientVolume, sfxVolume, crtEnabled, setAudioConfig, setCrtEnabled } =
    useWorldStore();
  const [bars, setBars] = useState<number[]>(() => new Array(12).fill(10));

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => {
      const data = soundEngine.getSpectrumData();
      const next = Array.from({ length: 12 }, (_, i) => Math.max(8, Math.round(((data[i] ?? 12) / 255) * 100)));
      setBars(next);
    }, 110);
    return () => window.clearInterval(id);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed right-4 top-14 z-50 w-72 border border-[#506454]/45 bg-[#071009] p-4 shadow-2xl space-y-4">
      <div className="flex items-center justify-between border-b border-[#506454]/25 pb-2">
        <span className="flex items-center gap-2 font-terminal text-xs text-[#00FF41]">
          <Sliders className="h-3.5 w-3.5" />
          AUDIO & DISPLAY
        </span>
        <button type="button" onClick={onClose} className="text-[#506454] hover:text-[#D6E2D8]">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Live Procedural Audio Spectrum */}
      <div className="flex h-10 items-end gap-1 border border-[#506454]/20 bg-[#020403] px-2 py-1.5">
        {bars.map((pct, i) => (
          <div
            key={i}
            style={{ height: `${audioEnabled ? pct : 8}%` }}
            className="flex-1 bg-[#00FF41]/70 transition-[height] duration-100"
          />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-[#D6E2D8]">Audio Output</span>
        <button
          type="button"
          onClick={() => setAudioConfig({ enabled: !audioEnabled })}
          className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs ${
            audioEnabled ? 'border-[#00FF41]/50 text-[#00FF41]' : 'border-[#506454]/40 text-[#506454]'
          }`}
        >
          {audioEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          {audioEnabled ? 'ACTIVE' : 'MUTED'}
        </button>
      </div>

      <div className="space-y-2.5 text-xs">
        <label className="block space-y-1">
          <div className="flex justify-between text-[#506454]">
            <span>Master Gain</span>
            <span className="font-mono-tabular">{Math.round(masterVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={masterVolume}
            onChange={(e) => setAudioConfig({ master: Number(e.target.value) })}
            className="w-full accent-[#00FF41]"
          />
        </label>
        <label className="block space-y-1">
          <div className="flex justify-between text-[#506454]">
            <span>Ambient Drone</span>
            <span className="font-mono-tabular">{Math.round(ambientVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={ambientVolume}
            onChange={(e) => setAudioConfig({ ambient: Number(e.target.value) })}
            className="w-full accent-[#00FF41]"
          />
        </label>
        <label className="block space-y-1">
          <div className="flex justify-between text-[#506454]">
            <span>Telemetry SFX</span>
            <span className="font-mono-tabular">{Math.round(sfxVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={sfxVolume}
            onChange={(e) => setAudioConfig({ sfx: Number(e.target.value) })}
            className="w-full accent-[#00FF41]"
          />
        </label>
      </div>

      <div className="flex items-center justify-between border-t border-[#506454]/20 pt-3">
        <span className="text-xs text-[#D6E2D8]">CRT Scanlines</span>
        <button
          type="button"
          onClick={() => setCrtEnabled(!crtEnabled)}
          className={`border px-2.5 py-1 text-xs ${
            crtEnabled ? 'border-[#00FF41]/50 text-[#00FF41]' : 'border-[#506454]/40 text-[#506454]'
          }`}
        >
          {crtEnabled ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
}

export function OperationsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { completedMissions } = useWorldStore();
  if (!open) return null;

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-[#506454]/40 bg-[#020403] shadow-2xl">
      <div className="flex items-center justify-between border-b border-[#506454]/30 bg-[#071009] px-5 py-3.5">
        <span className="font-terminal text-xs tracking-widest text-[#00FF41]">
          OPERATIONS ({completedMissions.length}/{OPERATIONS.length})
        </span>
        <button type="button" onClick={onClose} className="text-[#506454] hover:text-[#D6E2D8]">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {OPERATIONS.map((op) => {
          const done = completedMissions.includes(op.id);
          return (
            <div
              key={op.id}
              className={`border p-4 space-y-1.5 ${
                done ? 'border-[#00FF41]/40 bg-[#071009]' : 'border-[#506454]/25 bg-[#071009]/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-terminal text-xs text-[#00FF41]">
                  {op.code} — {op.title}
                </span>
                {done && <CheckCircle2 className="h-3.5 w-3.5 text-[#00FF41] shrink-0" />}
              </div>
              <p className="text-xs text-[#D6E2D8]/85">{op.objective}</p>
              <p className="text-[11px] text-[#506454]">
                {done ? op.consequenceText : `Bonus thread: ${op.hiddenObjective}`}
              </p>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export function AuthCloudModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { cloudUid, cloudEmail, cloudSyncing, syncNow, resetSession, sessionId, pushNotification } =
    useWorldStore();
  const [confirmReset, setConfirmReset] = useState(false);

  if (!open) return null;

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      pushNotification({
        title: 'AUTH CANCELLED',
        message: err instanceof Error ? err.message : 'Unable to sign in.',
        severity: 'WARNING',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md border border-[#506454]/45 bg-[#071009] p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-[#506454]/25 pb-3">
          <span className="flex items-center gap-2 font-terminal text-xs text-[#00FF41]">
            <Cloud className="h-4 w-4" />
            PERSISTENCE & CLOUD SYNC
          </span>
          <button type="button" onClick={onClose} className="text-[#506454] hover:text-[#D6E2D8]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 text-xs text-[#D6E2D8]/85">
          <div>
            Local Session: <span className="font-mono-tabular text-[#00FF41]">{sessionId}</span>
          </div>
          <p className="text-[#506454]">
            All exploration progress automatically persists locally in IndexedDB without requiring an account. Sign in with Google optionally to sync across devices or save classified dossiers to Firestore.
          </p>
        </div>

        {cloudUid ? (
          <div className="border border-[#00FF41]/30 bg-[#020403] p-3.5 space-y-3 text-xs">
            <div className="text-[#00FF41]">Synced Account: {cloudEmail}</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={cloudSyncing}
                onClick={() => void syncNow()}
                className="border border-[#00FF41]/50 px-3 py-1.5 text-xs text-[#00FF41] hover:bg-[#00FF41]/10"
              >
                {cloudSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
              <button
                type="button"
                onClick={() => void signOut(auth)}
                className="inline-flex items-center gap-1.5 border border-[#506454]/50 px-3 py-1.5 text-xs text-[#D6E2D8] hover:border-[#FF2424]"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            className="inline-flex items-center gap-2 border border-[#00FF41] bg-[#00FF41]/10 px-4 py-2 text-xs text-[#00FF41] hover:bg-[#00FF41]/20"
          >
            <LogIn className="h-3.5 w-3.5" />
            Sign In with Google (Optional)
          </button>
        )}

        <div className="border-t border-[#506454]/25 pt-4 space-y-2">
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 text-xs text-[#506454] hover:text-[#FF2424]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Local Investigation Session
            </button>
          ) : (
            <div className="flex items-center justify-between gap-2 border border-[#FF2424]/40 bg-[#FF2424]/10 p-3 text-xs">
              <span className="text-[#FF2424]">Erase local discoveries and reboot?</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="border border-[#506454]/50 px-2.5 py-1 text-[#D6E2D8]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void resetSession()}
                  className="border border-[#FF2424] bg-[#FF2424]/20 px-2.5 py-1 text-[#FF2424]"
                >
                  Confirm Reset
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function NotificationToastStack() {
  const { notifications, dismissNotification } = useWorldStore();
  if (notifications.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-52 z-40 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`pointer-events-auto border bg-[#071009] p-3.5 shadow-xl ${
            n.severity === 'CRITICAL'
              ? 'border-[#FF2424]'
              : n.severity === 'ANOMALY'
                ? 'border-[#FF2424]/60'
                : n.severity === 'WARNING'
                  ? 'border-[#C68A2A]'
                  : 'border-[#00FF41]/50'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="font-terminal text-[11px] font-semibold tracking-wider text-[#D6E2D8]">
              {n.title}
            </div>
            <button
              type="button"
              onClick={() => dismissNotification(n.id)}
              className="text-[#506454] hover:text-[#D6E2D8]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1 text-xs leading-snug text-[#D6E2D8]/85">{n.message}</p>
        </div>
      ))}
    </div>
  );
}
