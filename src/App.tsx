import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  Activity,
  Archive,
  Cloud,
  Compass,
  Cpu,
  Database,
  EyeOff,
  FileCheck2,
  Ghost,
  Layers,
  Menu,
  MessageSquareWarning,
  Network,
  Radio,
  ShieldAlert,
  Sliders,
  Target,
  X,
} from 'lucide-react';
import { ACCESS_LEVELS, OPERATIONS } from './data/universeData';
import { useWorldStore } from './engine/worldStore';
import { auth, testFirestoreConnection } from './lib/firebase';
import { BootSequence } from './components/BootSequence';
import { PersistentTerminal } from './components/PersistentTerminal';
import { CoreView } from './components/CoreView';
import { GhostnetView } from './components/GhostnetView';
import { BlackboxView } from './components/BlackboxView';
import { ArchiveView } from './components/ArchiveView';
import { ObservatoryView } from './components/ObservatoryView';
import { MemoryVaultView, RedactedRoomView } from './components/MemoryAndRedactedViews';
import { NullSpaceView } from './components/NullSpaceView';
import { LiveSignalsView } from './components/LiveSignalsView';
import { Root07View } from './components/Root07View';
import { DossierView } from './components/DossierView';
import { UnknownProcessPanel } from './components/UnknownProcessPanel';
import { AdminCmsView } from './components/AdminCmsView';
import {
  AudioControlPopover,
  AuthCloudModal,
  ErrorBoundary,
  NotificationToastStack,
  OperationsDrawer,
} from './components/SystemOverlays';
import { EnvironmentId } from './types/universe';

interface NavDestination {
  id: EnvironmentId;
  label: string;
  code: string;
  icon: React.ComponentType<{ className?: string }>;
  visible: boolean;
}

function RootOsShell() {
  const {
    booted,
    hydrated,
    hydrate,
    tickSecond,
    currentView,
    setView,
    accessLevel,
    unlockedDirs,
    unlockedRegions,
    ghostLayerActive,
    toggleGhostLayer,
    crtEnabled,
    audioEnabled,
    cloudUid,
    completedMissions,
    discoveredNodes,
    connectedNodes,
    endingReached,
    appendTerminalLine,
    setCloudAuth,
  } = useWorldStore();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [entityOpen, setEntityOpen] = useState(false);
  const [opsOpen, setOpsOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    void hydrate();
    void testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, (user) => {
      void setCloudAuth(user?.uid ?? null, user?.email ?? null);
    });
    return () => unsub();
  }, [hydrate, setCloudAuth]);

  useEffect(() => {
    const id = window.setInterval(() => {
      tickSecond();
    }, 1000);
    return () => window.clearInterval(id);
  }, [tickSecond]);

  // Leave an unresolved transmission if observer attempts to close while investigation is incomplete
  useEffect(() => {
    const onBeforeUnload = () => {
      if (!endingReached && booted) {
        appendTerminalLine(
          'entity',
          'SESSION INTERRUPT DETECTED // PID-0007: "Closing the viewport does not close NODE-017."'
        );
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [endingReached, booted, appendTerminalLine]);

  const tier = ACCESS_LEVELS[accessLevel] ?? ACCESS_LEVELS[0];

  const navItems: NavDestination[] = useMemo(
    () => [
      { id: 'CORE', label: 'The Core', code: 'SYS', icon: Cpu, visible: true },
      { id: 'GHOSTNET', label: 'Ghostnet', code: `${connectedNodes.length}/${discoveredNodes.length}`, icon: Network, visible: true },
      { id: 'BLACKBOX', label: 'Blackbox', code: '0917', icon: ShieldAlert, visible: true },
      { id: 'ARCHIVE', label: 'Archive', code: `${unlockedDirs.length} DIR`, icon: Archive, visible: true },
      { id: 'OBSERVATORY', label: 'Observatory', code: 'MHZ', icon: Radio, visible: true },
      { id: 'MEMORY_VAULT', label: 'Memory Vault', code: '12', icon: Layers, visible: true },
      { id: 'REDACTED_ROOM', label: 'Redacted', code: 'SEC', icon: EyeOff, visible: true },
      {
        id: 'NULL_SPACE',
        label: 'Null Space',
        code: '090',
        icon: Compass,
        visible: accessLevel >= 2 || unlockedDirs.includes('/void'),
      },
      {
        id: 'ROOT_07',
        label: 'ROOT-07',
        code: '/07',
        icon: Target,
        visible: unlockedDirs.includes('/07') || accessLevel >= 5,
      },
      { id: 'LIVE_SIGNALS', label: 'Live Signals', code: 'EXT', icon: Activity, visible: true },
      { id: 'DOSSIER', label: 'Dossier', code: 'RPT', icon: FileCheck2, visible: true },
      { id: 'ADMIN_CMS', label: 'CMS', code: 'ADM', icon: Database, visible: true },
    ],
    [connectedNodes.length, discoveredNodes.length, unlockedDirs, accessLevel]
  );

  const visibleNav = navItems.filter((n) => n.visible);
  const canGhostLayer = unlockedRegions.includes('REGION_05');

  const renderViewport = () => {
    switch (currentView) {
      case 'CORE':
        return <CoreView />;
      case 'GHOSTNET':
        return <GhostnetView />;
      case 'BLACKBOX':
        return <BlackboxView />;
      case 'ARCHIVE':
        return <ArchiveView />;
      case 'OBSERVATORY':
        return <ObservatoryView />;
      case 'MEMORY_VAULT':
        return <MemoryVaultView />;
      case 'REDACTED_ROOM':
        return <RedactedRoomView />;
      case 'NULL_SPACE':
        return <NullSpaceView />;
      case 'LIVE_SIGNALS':
        return <LiveSignalsView />;
      case 'ROOT_07':
        return <Root07View />;
      case 'DOSSIER':
        return <DossierView />;
      case 'ADMIN_CMS':
        return <AdminCmsView />;
      default:
        return <CoreView />;
    }
  };

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#020403] font-terminal text-xs text-[#00FF41]">
        MOUNTING CONTINUITY STORAGE...
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#020403] text-[#D6E2D8]">
      {!booted && <BootSequence />}

      {/* Top OS Bar — 3 clean zones */}
      <header className="z-20 flex h-12 shrink-0 items-center justify-between border-b border-[#506454]/30 bg-[#071009] px-4 print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label="Toggle navigation rail"
            className="lg:hidden p-1.5 text-[#506454] hover:text-[#00FF41]"
          >
            {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => setView('CORE')}
            className="font-terminal text-sm font-semibold tracking-widest text-[#00FF41] phosphor-glow whitespace-nowrap shrink-0"
          >
            ROOT ACCESS : 07
          </button>

          <span className="hidden sm:inline text-[#506454]">·</span>
          <span className="hidden sm:inline truncate font-mono-tabular text-xs text-[#D6E2D8]/80">
            L0{accessLevel} {tier.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {canGhostLayer && (
            <button
              type="button"
              onClick={() => toggleGhostLayer()}
              className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs whitespace-nowrap shrink-0 transition-colors ${
                ghostLayerActive
                  ? 'border-[#C68A2A] bg-[#C68A2A]/15 text-[#C68A2A]'
                  : 'border-[#506454]/40 text-[#506454] hover:border-[#C68A2A] hover:text-[#C68A2A]'
              }`}
            >
              <Ghost className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Ghost Layer</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setOpsOpen(true)}
            className="inline-flex items-center gap-1.5 border border-[#506454]/40 bg-[#020403] px-2.5 py-1 text-xs text-[#D6E2D8] hover:border-[#00FF41] hover:text-[#00FF41] whitespace-nowrap shrink-0"
          >
            <Target className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ops</span>
            <span className="font-mono-tabular text-[#00FF41]">
              {completedMissions.length}/{OPERATIONS.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setEntityOpen(true)}
            className="inline-flex items-center gap-1.5 border border-[#FF2424]/45 bg-[#FF2424]/10 px-2.5 py-1 text-xs text-[#FF2424] hover:bg-[#FF2424]/20 whitespace-nowrap shrink-0"
          >
            <MessageSquareWarning className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">PID-0007</span>
          </button>

          <button
            type="button"
            onClick={() => setAudioOpen(!audioOpen)}
            aria-label="Audio and display settings"
            className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs whitespace-nowrap shrink-0 ${
              audioEnabled
                ? 'border-[#506454]/40 text-[#D6E2D8] hover:border-[#00FF41]'
                : 'border-[#506454]/30 text-[#506454]'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setAuthOpen(true)}
            aria-label="Persistence and cloud sync"
            className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs whitespace-nowrap shrink-0 ${
              cloudUid
                ? 'border-[#00FF41]/50 text-[#00FF41]'
                : 'border-[#506454]/40 text-[#506454] hover:text-[#D6E2D8]'
            }`}
          >
            <Cloud className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{cloudUid ? 'Synced' : 'Local'}</span>
          </button>
        </div>
      </header>

      {/* Main Workspace: Left Rail + Active Viewport */}
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop Navigation Rail */}
        <nav
          aria-label="Environments"
          className="hidden lg:flex w-48 shrink-0 flex-col justify-between border-r border-[#506454]/25 bg-[#071009] py-3 print:hidden"
        >
          <div className="space-y-0.5 px-2 overflow-y-auto">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const active = currentView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-l-2 border-[#00FF41] bg-[#00FF41]/10 text-[#00FF41]'
                      : 'border-l-2 border-transparent text-[#D6E2D8]/80 hover:bg-[#020403] hover:text-[#D6E2D8]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {item.label}
                  </span>
                  <span className="font-mono-tabular text-[10px] text-[#506454]">{item.code}</span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-[#506454]/20 px-4 pt-3 text-[11px] font-mono-tabular text-[#506454]">
            {endingReached ? 'PROTOCOL RESOLVED' : 'CASE 0917 ACTIVE'}
          </div>
        </nav>

        {/* Mobile Navigation Drawer */}
        {mobileNavOpen && (
          <div className="fixed inset-0 top-12 z-30 flex lg:hidden">
            <nav className="w-64 border-r border-[#506454]/35 bg-[#071009] p-3 space-y-1 overflow-y-auto">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const active = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setView(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-xs ${
                      active
                        ? 'border-l-2 border-[#00FF41] bg-[#00FF41]/10 text-[#00FF41]'
                        : 'text-[#D6E2D8]/85'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    <span className="font-mono-tabular text-[10px] text-[#506454]">{item.code}</span>
                  </button>
                );
              })}
            </nav>
            <div className="flex-1 bg-black/60" onClick={() => setMobileNavOpen(false)} />
          </div>
        )}

        {/* Active Environment */}
        <main className="flex-1 min-w-0 min-h-0 overflow-hidden">{renderViewport()}</main>
      </div>

      {/* Persistent Terminal */}
      <div className="shrink-0 print:hidden">
        <PersistentTerminal />
      </div>

      {/* Overlays & Drawers */}
      <AudioControlPopover open={audioOpen} onClose={() => setAudioOpen(false)} />
      <OperationsDrawer open={opsOpen} onClose={() => setOpsOpen(false)} />
      <UnknownProcessPanel open={entityOpen} onClose={() => setEntityOpen(false)} />
      <AuthCloudModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <NotificationToastStack />

      {/* Subtle Optional CRT Scanlines & Vignette */}
      {crtEnabled && (
        <>
          <div className="crt-scanlines pointer-events-none fixed inset-0 z-50 opacity-35 print:hidden" />
          <div className="crt-vignette pointer-events-none fixed inset-0 z-50 opacity-55 print:hidden" />
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <RootOsShell />
    </ErrorBoundary>
  );
}
