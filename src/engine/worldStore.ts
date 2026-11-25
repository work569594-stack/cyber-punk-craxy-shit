import { create } from 'zustand';
import {
  ACCESS_LEVELS,
  ALL_FILES,
  COMMAND_CATALOG,
  DIRECTORIES,
  ENDINGS,
  EVIDENCE_ITEMS,
  GHOST_EDGES,
  GHOST_NODES,
  GHOST_REGIONS,
  INCIDENTS,
  OPERATIONS,
  PERSONNEL_PROFILES,
  PUZZLES,
  SYSTEM_EVENTS,
  TRANSMISSIONS,
} from '../data/universeData';
import { soundEngine } from '../audio/soundEngine';
import {
  clearLocalState,
  fetchPublishedOverrides,
  loadLocalState,
  loadSessionFromCloud,
  PersistedStateSnapshot,
  saveLocalState,
  syncSessionToCloud,
} from '../lib/persistence';
import {
  EndingId,
  EntityMessage,
  EnvironmentId,
  EvidenceConnection,
  RegionId,
  SoundscapeId,
  TerminalLine,
  UniverseOverrideItem,
  UnlockCondition,
} from '../types/universe';

function nowIsoTime(): string {
  return new Date().toISOString().slice(11, 19);
}

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function deterministicHash(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

function viewToSoundscape(view: EnvironmentId, ghostLayer: boolean): SoundscapeId {
  if (view === 'ROOT_07') return 'ROOT_07';
  if (view === 'NULL_SPACE') return 'NULL_SPACE';
  if (view === 'GHOSTNET') return ghostLayer ? 'GHOST_LAYER' : 'GHOSTNET';
  if (view === 'BLACKBOX' || view === 'REDACTED_ROOM') return 'BLACKBOX';
  if (view === 'ARCHIVE' || view === 'MEMORY_VAULT') return 'ARCHIVE';
  return 'ROOT_ACCESS';
}

export interface WorldNotification {
  id: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'ANOMALY' | 'CRITICAL';
  timestamp: string;
}

export interface WorldState {
  booted: boolean;
  hydrated: boolean;
  sessionId: string;
  visitCount: number;
  lastVisitAt: string;
  totalTimeSeconds: number;
  accessLevel: number;
  currentView: EnvironmentId;
  selectedIncidentId: string;
  selectedFileId: string | null;
  currentDirectory: string;
  activeNodeId: string | null;
  ghostLayerActive: boolean;
  terminalOpen: boolean;

  discoveredNodes: string[];
  connectedNodes: string[];
  tracedNodes: string[];
  collapsedNodes: string[];
  discoveredFiles: string[];
  openedFiles: string[];
  unlockedDirs: string[];
  unlockedCommands: string[];
  completedMissions: string[];
  recoveredEvidence: string[];
  evidenceConnections: EvidenceConnection[];
  evidencePositions: Record<string, { x: number; y: number }>;
  evidenceNotes: Record<string, string>;
  solvedPuzzles: string[];
  unlockedRegions: RegionId[];
  encounteredAnomalies: string[];
  narrativeChoices: Record<string, string>;
  endingReached: EndingId | null;

  terminalLines: TerminalLine[];
  commandHistory: string[];
  notifications: WorldNotification[];
  entityMessages: EntityMessage[];
  entityLoading: boolean;
  overrides: UniverseOverrideItem[];

  crtEnabled: boolean;
  audioEnabled: boolean;
  masterVolume: number;
  ambientVolume: number;
  sfxVolume: number;

  cloudUid: string | null;
  cloudEmail: string | null;
  cloudSyncing: boolean;

  // Actions
  hydrate: () => Promise<void>;
  completeBoot: (withAudio: boolean) => void;
  tickSecond: () => void;
  setView: (view: EnvironmentId) => void;
  setSelectedIncident: (id: string) => void;
  setSelectedFile: (id: string | null) => void;
  setDirectory: (dir: string) => void;
  setTerminalOpen: (open: boolean) => void;
  toggleGhostLayer: () => void;
  setCrtEnabled: (enabled: boolean) => void;
  setAudioConfig: (cfg: Partial<{ enabled: boolean; master: number; ambient: number; sfx: number }>) => void;
  dismissNotification: (id: string) => void;
  pushNotification: (n: Omit<WorldNotification, 'id' | 'timestamp'>) => void;
  appendTerminalLine: (type: TerminalLine['type'], text: string) => void;

  // Core Discovery Engine Operations
  checkCondition: (cond?: UnlockCondition) => boolean;
  evaluateProgression: () => void;
  openFile: (fileId: string) => { ok: boolean; reason?: string };
  scanNetwork: (deep?: boolean) => string[];
  connectNode: (nodeId: string) => { ok: boolean; reason?: string };
  traceNode: (nodeId: string) => string[];
  solvePuzzle: (puzzleIdOrCode: string, answer: string) => { ok: boolean; message: string };
  recoverEvidence: (evidenceId: string) => void;
  connectEvidence: (fromId: string, toId: string, note?: string) => EvidenceConnection | null;
  removeEvidenceConnection: (connId: string) => void;
  moveEvidenceCard: (evidenceId: string, pos: { x: number; y: number }) => void;
  setEvidenceNote: (evidenceId: string, note: string) => void;
  chooseEnding: (endingId: EndingId) => void;
  executeCommand: (raw: string) => void;
  getCompletions: (partial: string) => string[];
  askEntity: (prompt: string) => Promise<void>;

  // Cloud & Persistence
  setCloudAuth: (uid: string | null, email: string | null) => Promise<void>;
  syncNow: () => Promise<void>;
  refreshOverrides: () => Promise<void>;
  resetSession: () => Promise<void>;
}

const INITIAL_COMMANDS = COMMAND_CATALOG.filter((c) => c.initial).map((c) => c.name);
const INITIAL_DIRS = DIRECTORIES.filter((d) => !d.hidden && d.requiredAccess === 0).map((d) => d.path);
const INITIAL_NODES = GHOST_NODES.filter((n) => n.region === 'REGION_01' && !n.hidden).map((n) => n.id);
const INITIAL_EVIDENCE_POS = Object.fromEntries(EVIDENCE_ITEMS.map((e) => [e.id, e.defaultPos]));

function buildSnapshot(s: WorldState): PersistedStateSnapshot {
  return {
    sessionId: s.sessionId,
    visitCount: s.visitCount,
    lastVisitAt: s.lastVisitAt,
    totalTimeSeconds: s.totalTimeSeconds,
    accessLevel: s.accessLevel,
    discoveredNodes: s.discoveredNodes,
    connectedNodes: s.connectedNodes,
    tracedNodes: s.tracedNodes,
    collapsedNodes: s.collapsedNodes,
    discoveredFiles: s.discoveredFiles,
    openedFiles: s.openedFiles,
    unlockedDirs: s.unlockedDirs,
    unlockedCommands: s.unlockedCommands,
    completedMissions: s.completedMissions,
    recoveredEvidence: s.recoveredEvidence,
    evidenceConnections: s.evidenceConnections,
    evidencePositions: s.evidencePositions,
    evidenceNotes: s.evidenceNotes,
    solvedPuzzles: s.solvedPuzzles,
    unlockedRegions: s.unlockedRegions,
    encounteredAnomalies: s.encounteredAnomalies,
    narrativeChoices: s.narrativeChoices,
    endingReached: s.endingReached,
    commandHistory: s.commandHistory.slice(-100),
    crtEnabled: s.crtEnabled,
    audioEnabled: s.audioEnabled,
    masterVolume: s.masterVolume,
    ambientVolume: s.ambientVolume,
    sfxVolume: s.sfxVolume,
  };
}

let persistTimer: number | null = null;
function schedulePersist(get: () => WorldState) {
  if (persistTimer) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    const state = get();
    const snap = buildSnapshot(state);
    void saveLocalState(snap);
    if (state.cloudUid) {
      void syncSessionToCloud(state.cloudUid, snap).catch(() => {});
    }
  }, 450);
}

export const useWorldStore = create<WorldState>((set, get) => ({
  booted: false,
  hydrated: false,
  sessionId: `RA07-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
  visitCount: 1,
  lastVisitAt: new Date().toISOString(),
  totalTimeSeconds: 0,
  accessLevel: 0,
  currentView: 'CORE',
  selectedIncidentId: 'INC-0917',
  selectedFileId: 'readme_entry',
  currentDirectory: '/root',
  activeNodeId: null,
  ghostLayerActive: false,
  terminalOpen: true,

  discoveredNodes: INITIAL_NODES,
  connectedNodes: [],
  tracedNodes: [],
  collapsedNodes: [],
  discoveredFiles: ['readme_entry', 'project_charter', 'handoff_note', 'kernel_log', 'boot_sequence_log', 'integrity_report_txt'],
  openedFiles: [],
  unlockedDirs: INITIAL_DIRS,
  unlockedCommands: INITIAL_COMMANDS,
  completedMissions: [],
  recoveredEvidence: ['ev_official_0917'],
  evidenceConnections: [],
  evidencePositions: INITIAL_EVIDENCE_POS,
  evidenceNotes: {},
  solvedPuzzles: [],
  unlockedRegions: ['REGION_01'],
  encounteredAnomalies: [],
  narrativeChoices: {},
  endingReached: null,

  terminalLines: [
    { id: makeId('TL'), type: 'system', text: 'ROOT ACCESS : 07 // CONTINUITY TERMINAL INITIALIZED', timestamp: nowIsoTime() },
    { id: makeId('TL'), type: 'output', text: 'SESSION UNREGISTERED. TYPE `help` FOR KNOWN COMMANDS OR `scan` TO PROBE GHOSTNET.', timestamp: nowIsoTime() },
  ],
  commandHistory: [],
  notifications: [],
  entityMessages: [
    {
      id: makeId('EM'),
      sender: 'ENTITY',
      text: 'YOU ARE NOT REGISTERED. AN UNIDENTIFIED OBSERVER ENTERED THROUGH SURFACE GATEWAY NODE-001.',
      timestamp: nowIsoTime(),
      mode: 'deterministic',
    },
  ],
  entityLoading: false,
  overrides: [],

  crtEnabled: true,
  audioEnabled: true,
  masterVolume: 0.65,
  ambientVolume: 0.55,
  sfxVolume: 0.7,

  cloudUid: null,
  cloudEmail: null,
  cloudSyncing: false,

  hydrate: async () => {
    const saved = await loadLocalState();
    const overrides = await fetchPublishedOverrides();
    if (saved) {
      const visits = (saved.visitCount ?? 0) + 1;
      const lines: TerminalLine[] = [
        { id: makeId('TL'), type: 'system', text: `SESSION RESTORED :: ${saved.sessionId ?? 'RA07'} (VISIT #${visits})`, timestamp: nowIsoTime() },
      ];
      if ((saved.connectedNodes ?? []).includes('NODE-017')) {
        lines.push({ id: makeId('TL'), type: 'entity', text: 'NODE-017 WAS LAST ACCESSED BEFORE DISCONNECTION. INCIDENT 0917 REMAINS IN MEMORY.', timestamp: nowIsoTime() });
      } else {
        lines.push({ id: makeId('TL'), type: 'output', text: 'INCIDENT 0917 REMAINS UNRESOLVED. TYPE `mission` OR `help` TO CONTINUE.', timestamp: nowIsoTime() });
      }
      set((state) => ({
        ...state,
        hydrated: true,
        sessionId: saved.sessionId ?? state.sessionId,
        visitCount: visits,
        lastVisitAt: new Date().toISOString(),
        totalTimeSeconds: saved.totalTimeSeconds ?? 0,
        accessLevel: saved.accessLevel ?? 0,
        discoveredNodes: Array.from(new Set([...INITIAL_NODES, ...(saved.discoveredNodes ?? [])])),
        connectedNodes: saved.connectedNodes ?? [],
        tracedNodes: saved.tracedNodes ?? [],
        collapsedNodes: saved.collapsedNodes ?? [],
        discoveredFiles: Array.from(new Set([...state.discoveredFiles, ...(saved.discoveredFiles ?? [])])),
        openedFiles: saved.openedFiles ?? [],
        unlockedDirs: Array.from(new Set([...INITIAL_DIRS, ...(saved.unlockedDirs ?? [])])),
        unlockedCommands: Array.from(new Set([...INITIAL_COMMANDS, ...(saved.unlockedCommands ?? [])])),
        completedMissions: saved.completedMissions ?? [],
        recoveredEvidence: Array.from(new Set(['ev_official_0917', ...(saved.recoveredEvidence ?? [])])),
        evidenceConnections: saved.evidenceConnections ?? [],
        evidencePositions: { ...INITIAL_EVIDENCE_POS, ...(saved.evidencePositions ?? {}) },
        evidenceNotes: saved.evidenceNotes ?? {},
        solvedPuzzles: saved.solvedPuzzles ?? [],
        unlockedRegions: Array.from(new Set(['REGION_01', ...(saved.unlockedRegions ?? [])])) as RegionId[],
        encounteredAnomalies: saved.encounteredAnomalies ?? [],
        narrativeChoices: saved.narrativeChoices ?? {},
        endingReached: saved.endingReached ?? null,
        commandHistory: saved.commandHistory ?? [],
        crtEnabled: saved.crtEnabled ?? true,
        audioEnabled: saved.audioEnabled ?? true,
        masterVolume: saved.masterVolume ?? 0.65,
        ambientVolume: saved.ambientVolume ?? 0.55,
        sfxVolume: saved.sfxVolume ?? 0.7,
        terminalLines: lines,
        overrides,
      }));
    } else {
      set({ hydrated: true, overrides });
    }
    get().evaluateProgression();
  },

  completeBoot: (withAudio: boolean) => {
    const state = get();
    set({ booted: true, audioEnabled: withAudio });
    if (withAudio) {
      soundEngine.init();
      soundEngine.setVolumes({
        master: state.masterVolume,
        ambient: state.ambientVolume,
        sfx: state.sfxVolume,
        muted: false,
      });
      soundEngine.setSoundscape(viewToSoundscape(state.currentView, state.ghostLayerActive));
      soundEngine.playUnlock();
    }
    schedulePersist(get);
  },

  tickSecond: () => {
    if (!get().booted) return;
    set((s) => ({ totalTimeSeconds: s.totalTimeSeconds + 1 }));
    if (get().totalTimeSeconds % 15 === 0) {
      schedulePersist(get);
    }
  },

  setView: (view) => {
    const s = get();
    if (view === 'ROOT_07' && !s.unlockedDirs.includes('/07') && s.accessLevel < 5) {
      s.pushNotification({
        title: 'ACCESS DENIED — /07',
        message: 'Directory /07 requires NODE-017 + NODE-071 connected, 1 Blackbox contradiction, and the WAKE_PROTOCOL cipher.',
        severity: 'WARNING',
      });
      soundEngine.playError();
      return;
    }
    soundEngine.playClick();
    soundEngine.setSoundscape(viewToSoundscape(view, s.ghostLayerActive));
    set({ currentView: view });
  },

  setSelectedIncident: (id) => set({ selectedIncidentId: id }),
  setSelectedFile: (id) => set({ selectedFileId: id }),
  setDirectory: (dir) => set({ currentDirectory: dir }),
  setTerminalOpen: (open) => set({ terminalOpen: open }),

  toggleGhostLayer: () => {
    const s = get();
    if (!s.unlockedRegions.includes('REGION_05') && !s.unlockedCommands.includes('ghost')) {
      s.pushNotification({
        title: 'GHOST LAYER SEALED',
        message: 'Confirm a contradiction in Blackbox or decode the Atbash token in Observatory to unlock Ghost Layer.',
        severity: 'WARNING',
      });
      soundEngine.playError();
      return;
    }
    const next = !s.ghostLayerActive;
    const ghostNodes = next ? GHOST_NODES.filter((n) => n.ghostLayerOnly).map((n) => n.id) : [];
    set((st) => ({
      ghostLayerActive: next,
      discoveredNodes: Array.from(new Set([...st.discoveredNodes, ...ghostNodes])),
    }));
    soundEngine.setSoundscape(viewToSoundscape(s.currentView, next));
    soundEngine.playAnomaly();
    schedulePersist(get);
  },

  setCrtEnabled: (enabled) => {
    set({ crtEnabled: enabled });
    schedulePersist(get);
  },

  setAudioConfig: (cfg) => {
    const s = get();
    const audioEnabled = cfg.enabled ?? s.audioEnabled;
    const masterVolume = cfg.master ?? s.masterVolume;
    const ambientVolume = cfg.ambient ?? s.ambientVolume;
    const sfxVolume = cfg.sfx ?? s.sfxVolume;
    if (audioEnabled && !soundEngine.isInitialized()) {
      soundEngine.init();
      soundEngine.setSoundscape(viewToSoundscape(s.currentView, s.ghostLayerActive));
    }
    soundEngine.setVolumes({
      master: masterVolume,
      ambient: ambientVolume,
      sfx: sfxVolume,
      muted: !audioEnabled,
    });
    set({ audioEnabled, masterVolume, ambientVolume, sfxVolume });
    schedulePersist(get);
  },

  dismissNotification: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

  pushNotification: (n) => {
    const item: WorldNotification = {
      id: makeId('NTF'),
      timestamp: nowIsoTime(),
      ...n,
    };
    set((s) => ({
      notifications: [item, ...s.notifications].slice(0, 5),
    }));
    window.setTimeout(() => {
      get().dismissNotification(item.id);
    }, 6500);
  },

  appendTerminalLine: (type, text) =>
    set((s) => ({
      terminalLines: [...s.terminalLines.slice(-180), { id: makeId('TL'), type, text, timestamp: nowIsoTime() }],
    })),

  checkCondition: (cond) => {
    if (!cond) return true;
    const s = get();
    if (cond.minAccessLevel !== undefined && s.accessLevel < cond.minAccessLevel) return false;
    if (cond.requiredFiles && !cond.requiredFiles.every((f) => s.openedFiles.includes(f))) return false;
    if (cond.requiredNodes && !cond.requiredNodes.every((n) => s.discoveredNodes.includes(n))) return false;
    if (cond.requiredConnectedNodes && !cond.requiredConnectedNodes.every((n) => s.connectedNodes.includes(n))) return false;
    if (cond.requiredPuzzles && !cond.requiredPuzzles.every((p) => s.solvedPuzzles.includes(p))) return false;
    if (cond.requiredMissions && !cond.requiredMissions.every((m) => s.completedMissions.includes(m))) return false;
    if (cond.requiredEvidence && !cond.requiredEvidence.every((e) => s.recoveredEvidence.includes(e))) return false;
    if (cond.requiredRegions && !cond.requiredRegions.every((r) => s.unlockedRegions.includes(r))) return false;
    if (cond.minContradictions !== undefined) {
      const contradictions = s.evidenceConnections.filter((c) => c.status === 'CONTRADICTION').length;
      if (contradictions < cond.minContradictions) return false;
    }
    return true;
  },

  evaluateProgression: () => {
    const s = get();
    let accessLevel = s.accessLevel;
    const unlockedDirs = new Set(s.unlockedDirs);
    const unlockedCommands = new Set(s.unlockedCommands);
    const unlockedRegions = new Set(s.unlockedRegions);
    const discoveredNodes = new Set(s.discoveredNodes);
    const discoveredFiles = new Set(s.discoveredFiles);
    const completedMissions = new Set(s.completedMissions);
    const encounteredAnomalies = new Set(s.encounteredAnomalies);
    const newlyCompleted: string[] = [];

    // Evaluate Operations
    for (const op of OPERATIONS) {
      if (completedMissions.has(op.id)) continue;
      const filesOk = !op.requiredFiles || op.requiredFiles.every((f) => s.openedFiles.includes(f));
      const nodesOk = !op.requiredNodes || op.requiredNodes.every((n) => discoveredNodes.has(n));
      const connOk = !op.requiredConnectedNodes || op.requiredConnectedNodes.every((n) => s.connectedNodes.includes(n));
      const puzOk = !op.requiredPuzzles || op.requiredPuzzles.every((p) => s.solvedPuzzles.includes(p));
      const evOk = !op.requiredEvidence || op.requiredEvidence.every((e) => s.recoveredEvidence.includes(e));
      const contradictions = s.evidenceConnections.filter((c) => c.status === 'CONTRADICTION').length;
      const contraOk = op.requiredContradictions === undefined || contradictions >= op.requiredContradictions;

      if (filesOk && nodesOk && connOk && puzOk && evOk && contraOk) {
        completedMissions.add(op.id);
        newlyCompleted.push(`${op.code}: ${op.title}`);
        if (op.unlocks.accessLevelMin !== undefined) {
          accessLevel = Math.max(accessLevel, op.unlocks.accessLevelMin);
        }
        op.unlocks.commands?.forEach((c) => unlockedCommands.add(c));
        op.unlocks.nodes?.forEach((n) => discoveredNodes.add(n));
        op.unlocks.dirs?.forEach((d) => unlockedDirs.add(d));
        op.unlocks.regions?.forEach((r) => unlockedRegions.add(r));
        op.unlocks.files?.forEach((f) => discoveredFiles.add(f));
      }
    }

    // Evaluate Directories by access level or unlockCondition
    for (const dir of DIRECTORIES) {
      if (unlockedDirs.has(dir.path)) continue;
      if (!dir.hidden && accessLevel >= dir.requiredAccess) {
        unlockedDirs.add(dir.path);
      } else if (dir.unlockCondition && get().checkCondition(dir.unlockCondition)) {
        unlockedDirs.add(dir.path);
      }
    }

    // Evaluate Regions by access level
    if (accessLevel >= 1) unlockedRegions.add('REGION_02');
    if (accessLevel >= 2) unlockedRegions.add('REGION_03');
    if (accessLevel >= 3) unlockedRegions.add('REGION_04');
    if (accessLevel >= 4) unlockedRegions.add('REGION_05');
    if (accessLevel >= 5) unlockedRegions.add('REGION_06');

    // Reveal nodes belonging to unlocked regions (if not explicitly hidden)
    for (const node of GHOST_NODES) {
      if (unlockedRegions.has(node.region) && !node.hidden && !node.ghostLayerOnly) {
        discoveredNodes.add(node.id);
      } else if (node.unlockCondition && get().checkCondition(node.unlockCondition)) {
        discoveredNodes.add(node.id);
      }
    }

    // Evaluate contextual system events
    for (const evt of SYSTEM_EVENTS) {
      if (evt.rare) continue;
      if (encounteredAnomalies.has(evt.id)) continue;
      if (evt.condition && get().checkCondition(evt.condition)) {
        encounteredAnomalies.add(evt.id);
        s.pushNotification({ title: evt.title, message: evt.message, severity: evt.severity });
        s.appendTerminalLine('system', `[EVENT] ${evt.title} — ${evt.message}`);
      }
    }

    set({
      accessLevel,
      unlockedDirs: Array.from(unlockedDirs),
      unlockedCommands: Array.from(unlockedCommands),
      unlockedRegions: Array.from(unlockedRegions) as RegionId[],
      discoveredNodes: Array.from(discoveredNodes),
      discoveredFiles: Array.from(discoveredFiles),
      completedMissions: Array.from(completedMissions),
      encounteredAnomalies: Array.from(encounteredAnomalies),
    });

    for (const label of newlyCompleted) {
      soundEngine.playUnlock();
      get().pushNotification({
        title: 'OPERATION COMPLETED',
        message: label,
        severity: 'INFO',
      });
      get().appendTerminalLine('success', `[OPERATION COMPLETE] ${label}`);
    }
  },

  openFile: (fileId) => {
    const file = ALL_FILES.find((f) => f.id === fileId || f.name.toLowerCase() === fileId.toLowerCase());
    if (!file) return { ok: false, reason: 'FILE_NOT_FOUND' };
    const s = get();
    if (!s.unlockedDirs.includes(file.directory) && s.accessLevel < file.requiredAccess) {
      return { ok: false, reason: `ACCESS DENIED: Requires ${file.directory} clearance (Level 0${file.requiredAccess}).` };
    }
    if (file.hidden && file.unlockCondition && !s.checkCondition(file.unlockCondition)) {
      return { ok: false, reason: 'FILE_SEALED: Prerequisites unmet.' };
    }

    const wasOpened = s.openedFiles.includes(file.id);
    const openedFiles = Array.from(new Set([...s.openedFiles, file.id]));
    const discoveredFiles = Array.from(new Set([...s.discoveredFiles, file.id]));
    const unlockedCommands = new Set(s.unlockedCommands);
    const recoveredEvidence = new Set(s.recoveredEvidence);
    const discoveredNodes = new Set(s.discoveredNodes);

    if (file.unlocksCommand) unlockedCommands.add(file.unlocksCommand);
    if (file.unlocksEvidence) recoveredEvidence.add(file.unlocksEvidence);
    if (file.unlocksNode) discoveredNodes.add(file.unlocksNode);
    file.linkedNodes?.forEach((n) => {
      const nodeObj = GHOST_NODES.find((g) => g.id === n);
      if (nodeObj && !nodeObj.hidden) discoveredNodes.add(n);
    });

    set({
      selectedFileId: file.id,
      currentDirectory: file.directory,
      openedFiles,
      discoveredFiles,
      unlockedCommands: Array.from(unlockedCommands),
      recoveredEvidence: Array.from(recoveredEvidence),
      discoveredNodes: Array.from(discoveredNodes),
    });

    if (!wasOpened && file.unlocksEvidence) {
      get().pushNotification({
        title: 'EVIDENCE LOGGED TO BLACKBOX',
        message: `Recovered trace from ${file.name}.`,
        severity: 'INFO',
      });
    }
    if (!wasOpened && file.unlocksCommand) {
      get().pushNotification({
        title: 'COMMAND UNLOCKED',
        message: `Shell verb \`${file.unlocksCommand}\` added to registry.`,
        severity: 'INFO',
      });
    }
    if (wasOpened && file.mutatedContent && s.checkCondition(file.mutatedContent.condition)) {
      get().appendTerminalLine('entity', `[ANOMALY] ${file.name} content shifted since your previous inspection.`);
    }

    get().evaluateProgression();
    schedulePersist(get);
    return { ok: true };
  },

  scanNetwork: (deep = false) => {
    const s = get();
    const discovered = new Set(s.discoveredNodes);
    const newlyFound: string[] = [];

    for (const node of GHOST_NODES) {
      if (discovered.has(node.id)) continue;
      const regionOpen = s.unlockedRegions.includes(node.region);
      const condOk = node.unlockCondition ? s.checkCondition(node.unlockCondition) : true;
      if ((regionOpen || (deep && s.accessLevel >= 2)) && condOk && !node.ghostLayerOnly) {
        discovered.add(node.id);
        newlyFound.push(node.id);
      }
    }

    set({ discoveredNodes: Array.from(discovered) });
    get().evaluateProgression();
    schedulePersist(get);
    return newlyFound;
  },

  connectNode: (nodeId) => {
    const targetId = nodeId.toUpperCase();
    const node = GHOST_NODES.find((n) => n.id === targetId || n.name.toUpperCase() === targetId);
    if (!node) return { ok: false, reason: `NODE ${nodeId} NOT FOUND IN ROUTING TABLE.` };

    const s = get();
    if (s.collapsedNodes.includes(node.id)) {
      return { ok: false, reason: `${node.id} COLLAPSED ITS ROUTING SIGNATURE AFTER PREVIOUS INSPECTION.` };
    }
    if (s.accessLevel < node.requiredAccess && !s.discoveredNodes.includes(node.id)) {
      return { ok: false, reason: `CLEARANCE LEVEL 0${node.requiredAccess} REQUIRED FOR ${node.id}.` };
    }
    if (node.unlockCondition && !s.checkCondition(node.unlockCondition)) {
      return { ok: false, reason: `${node.id} IS MASKED. DECRYPT LINKED SIGNAL OR RECOVER FIELD LOG FIRST.` };
    }

    const discoveredNodes = Array.from(new Set([...s.discoveredNodes, node.id]));
    const connectedNodes = Array.from(new Set([...s.connectedNodes, node.id]));
    const discoveredFiles = new Set(s.discoveredFiles);
    node.linkedFiles.forEach((f) => discoveredFiles.add(f));
    const unlockedCommands = new Set(s.unlockedCommands);
    if (node.linkedCommand) unlockedCommands.add(node.linkedCommand);

    // Rare disappearing node event
    const collapsedNodes = [...s.collapsedNodes];
    if (node.disappearsOnInspect && !collapsedNodes.includes(node.id)) {
      unlockedCommands.add('ghost');
      setTimeout(() => {
        set((st) => ({
          collapsedNodes: Array.from(new Set([...st.collapsedNodes, node.id])),
        }));
        get().pushNotification({
          title: 'SPECTRAL NODE COLLAPSE',
          message: `${node.id} vanished from telemetry after leaving \`ghost\` routing echo.`,
          severity: 'ANOMALY',
        });
        soundEngine.playAnomaly();
      }, 2800);
    }

    set({
      activeNodeId: node.id,
      discoveredNodes,
      connectedNodes,
      discoveredFiles: Array.from(discoveredFiles),
      unlockedCommands: Array.from(unlockedCommands),
    });

    soundEngine.playExecute();
    get().evaluateProgression();
    schedulePersist(get);
    return { ok: true };
  },

  traceNode: (nodeId) => {
    const targetId = nodeId.toUpperCase();
    const edges = GHOST_EDGES.filter((e) => e.from === targetId || e.to === targetId);
    const revealed: string[] = [];
    const discoveredNodes = new Set(get().discoveredNodes);

    for (const edge of edges) {
      const other = edge.from === targetId ? edge.to : edge.from;
      const otherNode = GHOST_NODES.find((n) => n.id === other);
      if (otherNode && (!otherNode.unlockCondition || get().checkCondition(otherNode.unlockCondition))) {
        discoveredNodes.add(other);
        revealed.push(`${edge.from} -> ${edge.to}${edge.label ? ` [${edge.label}]` : ''}`);
      }
    }

    set((s) => ({
      tracedNodes: Array.from(new Set([...s.tracedNodes, targetId])),
      discoveredNodes: Array.from(discoveredNodes),
    }));
    get().evaluateProgression();
    schedulePersist(get);
    return revealed;
  },

  solvePuzzle: (puzzleIdOrCode, answer) => {
    const q = puzzleIdOrCode.trim().toLowerCase();
    const puzzle = PUZZLES.find((p) => p.id.toLowerCase() === q || p.code.toLowerCase() === q);
    if (!puzzle) return { ok: false, message: `UNKNOWN CIPHER TARGET: ${puzzleIdOrCode}` };

    const normalized = answer.trim().toUpperCase().replace(/\s+/g, ' ');
    const match = puzzle.acceptedAnswers.some((a) => a.toUpperCase() === normalized);
    if (!match) {
      soundEngine.playError();
      return { ok: false, message: `VERIFICATION FAILED FOR ${puzzle.code}. HINT: ${puzzle.hint}` };
    }

    const s = get();
    const solvedPuzzles = Array.from(new Set([...s.solvedPuzzles, puzzle.id]));
    const unlockedCommands = new Set(s.unlockedCommands);
    const discoveredNodes = new Set(s.discoveredNodes);
    const discoveredFiles = new Set(s.discoveredFiles);
    const unlockedDirs = new Set(s.unlockedDirs);
    const recoveredEvidence = new Set(s.recoveredEvidence);
    const unlockedRegions = new Set(s.unlockedRegions);
    let accessLevel = s.accessLevel;

    puzzle.unlocks.commands?.forEach((c) => unlockedCommands.add(c));
    puzzle.unlocks.nodes?.forEach((n) => discoveredNodes.add(n));
    puzzle.unlocks.files?.forEach((f) => discoveredFiles.add(f));
    puzzle.unlocks.dirs?.forEach((d) => unlockedDirs.add(d));
    puzzle.unlocks.evidence?.forEach((e) => recoveredEvidence.add(e));
    puzzle.unlocks.regions?.forEach((r) => unlockedRegions.add(r));
    if (puzzle.unlocks.accessLevelMin !== undefined) {
      accessLevel = Math.max(accessLevel, puzzle.unlocks.accessLevelMin);
    }

    set({
      solvedPuzzles,
      unlockedCommands: Array.from(unlockedCommands),
      discoveredNodes: Array.from(discoveredNodes),
      discoveredFiles: Array.from(discoveredFiles),
      unlockedDirs: Array.from(unlockedDirs),
      recoveredEvidence: Array.from(recoveredEvidence),
      unlockedRegions: Array.from(unlockedRegions) as RegionId[],
      accessLevel,
    });

    soundEngine.playUnlock();
    get().pushNotification({
      title: 'CIPHER VERIFIED',
      message: puzzle.rewardMessage,
      severity: 'INFO',
    });
    get().evaluateProgression();
    schedulePersist(get);
    return { ok: true, message: puzzle.rewardMessage };
  },

  recoverEvidence: (evidenceId) => {
    set((s) => ({
      recoveredEvidence: Array.from(new Set([...s.recoveredEvidence, evidenceId])),
    }));
    get().evaluateProgression();
    schedulePersist(get);
  },

  connectEvidence: (fromId, toId, note = '') => {
    if (fromId === toId) return null;
    const s = get();
    const existing = s.evidenceConnections.find(
      (c) => (c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId)
    );
    if (existing) return existing;

    const evA = EVIDENCE_ITEMS.find((e) => e.id === fromId);
    const evB = EVIDENCE_ITEMS.find((e) => e.id === toId);
    if (!evA || !evB) return null;

    const isContradiction = Boolean(evA.contradictsIds?.includes(toId) || evB.contradictsIds?.includes(fromId));
    const isValid = Boolean(evA.relatedIds.includes(toId) || evB.relatedIds.includes(fromId));
    const status: EvidenceConnection['status'] = isContradiction
      ? 'CONTRADICTION'
      : isValid
        ? 'VALID'
        : 'HYPOTHESIS';

    const conn: EvidenceConnection = {
      id: makeId('EC'),
      fromId,
      toId,
      note:
        note ||
        (isContradiction
          ? evA.contradictionNote || evB.contradictionNote || 'Timeline discrepancy verified.'
          : isValid
            ? 'Corroborating cross-layer link.'
            : 'Investigator hypothesis.'),
      status,
      createdAt: new Date().toISOString(),
    };

    set((st) => ({
      evidenceConnections: [...st.evidenceConnections, conn],
    }));

    if (status === 'CONTRADICTION') {
      soundEngine.playAnomaly();
      get().pushNotification({
        title: 'BLACKBOX CONTRADICTION CONFIRMED',
        message: conn.note,
        severity: 'CRITICAL',
      });
      get().appendTerminalLine('warning', `[BLACKBOX] CONTRADICTION DETECTED: ${evA.code} <-> ${evB.code}`);
    } else if (status === 'VALID') {
      soundEngine.playUnlock();
    } else {
      soundEngine.playClick();
    }

    get().evaluateProgression();
    schedulePersist(get);
    return conn;
  },

  removeEvidenceConnection: (connId) => {
    set((s) => ({
      evidenceConnections: s.evidenceConnections.filter((c) => c.id !== connId),
    }));
    schedulePersist(get);
  },

  moveEvidenceCard: (evidenceId, pos) => {
    set((s) => ({
      evidencePositions: { ...s.evidencePositions, [evidenceId]: pos },
    }));
    schedulePersist(get);
  },

  setEvidenceNote: (evidenceId, note) => {
    set((s) => ({
      evidenceNotes: { ...s.evidenceNotes, [evidenceId]: note },
    }));
    schedulePersist(get);
  },

  chooseEnding: (endingId) => {
    const ending = ENDINGS[endingId];
    if (!ending) return;
    set((s) => ({
      endingReached: endingId,
      accessLevel: endingId === 'ENDING_D_ROOT' ? 6 : s.accessLevel,
      narrativeChoices: { ...s.narrativeChoices, final_protocol: endingId },
    }));
    soundEngine.playUnlock();
    get().pushNotification({
      title: `${ending.code} — ${ending.title}`,
      message: ending.epilogue,
      severity: 'CRITICAL',
    });
    get().appendTerminalLine('entity', `[PROTOCOL RESOLUTION] ${ending.code}: ${ending.title}`);
    schedulePersist(get);
  },

  getCompletions: (partial) => {
    const trimmed = partial.trimStart();
    const parts = trimmed.split(/\s+/);
    const s = get();
    if (parts.length <= 1) {
      return s.unlockedCommands.filter((c) => c.startsWith((parts[0] ?? '').toLowerCase())).sort();
    }
    const verb = parts[0].toLowerCase();
    const arg = (parts[1] ?? '').toLowerCase();
    if (['cat', 'read', 'open', 'file', 'download'].includes(verb)) {
      return ALL_FILES.filter((f) => s.unlockedDirs.includes(f.directory))
        .map((f) => f.name)
        .filter((n) => n.toLowerCase().startsWith(arg));
    }
    if (['cd', 'ls', 'access'].includes(verb)) {
      return DIRECTORIES.map((d) => d.path).filter((p) => p.startsWith(arg || '/'));
    }
    if (['connect', 'trace', 'locate'].includes(verb)) {
      return s.discoveredNodes.filter((n) => n.toLowerCase().startsWith(arg));
    }
    if (['decrypt', 'decode', 'cipher'].includes(verb)) {
      return PUZZLES.map((p) => p.code).filter((c) => c.startsWith(arg));
    }
    return [];
  },

  executeCommand: (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const s = get();
    s.appendTerminalLine('input', `${s.currentDirectory} > ${trimmed}`);
    set((st) => ({
      commandHistory: [...st.commandHistory.slice(-99), trimmed],
    }));

    const tokens = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((t) => t.replace(/^"|"$/g, '')) ?? [];
    const cmd = (tokens[0] ?? '').toLowerCase();
    const arg1 = tokens[1] ?? '';
    const rest = tokens.slice(1).join(' ');

    if (!s.unlockedCommands.includes(cmd) && !['clear', 'help'].includes(cmd)) {
      soundEngine.playError();
      s.appendTerminalLine('error', `UNKNOWN OR LOCKED COMMAND: "${cmd}". RUN \`help\` TO VIEW AVAILABLE VERBS.`);
      return;
    }

    soundEngine.playExecute();

    switch (cmd) {
      case 'clear': {
        set({ terminalLines: [] });
        return;
      }
      case 'help': {
        if (arg1) {
          const entry = COMMAND_CATALOG.find((c) => c.name === arg1.toLowerCase());
          if (entry && s.unlockedCommands.includes(entry.name)) {
            s.appendTerminalLine('output', `${entry.usage} — ${entry.description}`);
          } else {
            s.appendTerminalLine('error', `No manual entry unlocked for "${arg1}".`);
          }
          return;
        }
        s.appendTerminalLine('system', `AVAILABLE COMMANDS (${s.unlockedCommands.length} UNLOCKED):`);
        s.appendTerminalLine('output', s.unlockedCommands.slice().sort().join('  ·  '));
        s.appendTerminalLine('output', 'Use `man <cmd>` for usage syntax. Use Tab for autocomplete.');
        return;
      }
      case 'man': {
        const entry = COMMAND_CATALOG.find((c) => c.name === arg1.toLowerCase());
        if (!entry || !s.unlockedCommands.includes(entry.name)) {
          s.appendTerminalLine('error', `Manual entry unavailable for "${arg1}".`);
          return;
        }
        s.appendTerminalLine('system', `${entry.name.toUpperCase()} — ${entry.usage}`);
        s.appendTerminalLine('output', entry.description);
        return;
      }
      case 'status':
      case 'session': {
        const tier = ACCESS_LEVELS[s.accessLevel]?.name ?? 'UNKNOWN';
        const contradictions = s.evidenceConnections.filter((c) => c.status === 'CONTRADICTION').length;
        s.appendTerminalLine(
          'system',
          `SESSION ${s.sessionId} | CLEARANCE: L0${s.accessLevel} (${tier}) | NODES: ${s.connectedNodes.length}/${s.discoveredNodes.length} | FILES: ${s.openedFiles.length}/${ALL_FILES.length} | CONTRADICTIONS: ${contradictions}`
        );
        return;
      }
      case 'whoami':
      case 'identity': {
        const tier = ACCESS_LEVELS[s.accessLevel];
        s.appendTerminalLine('output', `IDENTITY: ${s.cloudEmail ?? 'UNREGISTERED_OBSERVER'} | SESSION: ${s.sessionId}`);
        s.appendTerminalLine('output', `ACCESS LEVEL 0${s.accessLevel} — ${tier?.name}: ${tier?.description}`);
        return;
      }
      case 'history': {
        s.appendTerminalLine('output', s.commandHistory.slice(-15).map((h, i) => `${i + 1}. ${h}`).join('\n') || 'No commands executed yet.');
        return;
      }
      case 'uptime': {
        const mins = Math.floor(s.totalTimeSeconds / 60);
        const secs = s.totalTimeSeconds % 60;
        s.appendTerminalLine('output', `ACTIVE SESSION DURATION: ${mins}m ${secs}s | TOTAL VISITS: ${s.visitCount}`);
        return;
      }
      case 'date': {
        s.appendTerminalLine('output', `UTC: ${new Date().toISOString()} | ARCHIVE EPOCH: 2021-09-17T03:45:00Z`);
        return;
      }
      case 'version': {
        s.appendTerminalLine('output', 'ROOT OS v7.04-CONTINUITY (PROJECT ROOT // BOREALIS RELAY KERNEL)');
        return;
      }
      case 'about': {
        s.appendTerminalLine('output', 'ROOT ACCESS : 07 — Distributed continuity OS connecting Ghostnet topology and Blackbox forensic records.');
        return;
      }
      case 'system': {
        s.appendTerminalLine('system', `VIEW: ${s.currentView} | GHOST LAYER: ${s.ghostLayerActive ? 'ACTIVE' : 'SEALED'} | CRT: ${s.crtEnabled ? 'ON' : 'OFF'} | AUDIO: ${s.audioEnabled ? 'ACTIVE' : 'MUTED'}`);
        return;
      }
      case 'permissions': {
        s.appendTerminalLine(
          'output',
          ACCESS_LEVELS.map((a) => `${a.level <= s.accessLevel ? '[*]' : '[ ]'} LVL 0${a.level} ${a.name} — ${a.description}`).join('\n')
        );
        return;
      }
      case 'logs': {
        s.appendTerminalLine('output', s.encounteredAnomalies.length ? `LOGGED EVENTS: ${s.encounteredAnomalies.join(', ')}` : 'No anomaly events logged yet.');
        return;
      }
      case 'config': {
        if (arg1 === 'crt') {
          s.setCrtEnabled(!s.crtEnabled);
          s.appendTerminalLine('output', `CRT overlay set to ${!s.crtEnabled ? 'ENABLED' : 'DISABLED'}.`);
          return;
        }
        if (arg1 === 'sound') {
          s.setAudioConfig({ enabled: !s.audioEnabled });
          s.appendTerminalLine('output', `Audio set to ${!s.audioEnabled ? 'ENABLED' : 'MUTED'}.`);
          return;
        }
        s.appendTerminalLine('output', `CRT=${s.crtEnabled} AUDIO=${s.audioEnabled}. Usage: config [crt|sound]`);
        return;
      }
      case 'pwd': {
        s.appendTerminalLine('output', s.currentDirectory);
        return;
      }
      case 'tree': {
        s.appendTerminalLine('output', s.unlockedDirs.map((d) => `├── ${d}`).join('\n'));
        return;
      }
      case 'ls':
      case 'dir': {
        const targetDir = arg1 ? (arg1.startsWith('/') ? arg1 : `/${arg1}`) : s.currentDirectory;
        if (!s.unlockedDirs.includes(targetDir)) {
          s.appendTerminalLine('error', `ACCESS DENIED OR UNMOUNTED: ${targetDir}`);
          return;
        }
        const files = ALL_FILES.filter(
          (f) => f.directory === targetDir && (!f.hidden || !f.unlockCondition || s.checkCondition(f.unlockCondition))
        );
        if (files.length === 0) {
          s.appendTerminalLine('output', `${targetDir} [EMPTY]`);
          return;
        }
        s.appendTerminalLine(
          'output',
          files.map((f) => `${f.name.padEnd(28, ' ')} ${f.classification.padEnd(11, ' ')} ${f.sizeBytes}B`).join('\n')
        );
        return;
      }
      case 'cd':
      case 'access': {
        if (!arg1) {
          s.appendTerminalLine('output', `Current directory: ${s.currentDirectory}`);
          return;
        }
        const target = arg1 === '..' ? '/root' : arg1.startsWith('/') ? arg1 : `/${arg1}`;
        const dirObj = DIRECTORIES.find((d) => d.path === target);
        if (!dirObj) {
          s.appendTerminalLine('error', `DIRECTORY NOT FOUND: ${target}`);
          return;
        }
        if (!s.unlockedDirs.includes(target) && s.accessLevel < dirObj.requiredAccess) {
          soundEngine.playError();
          s.appendTerminalLine('error', `ACCESS DENIED TO ${target}. REQUIRED CLEARANCE OR UNLOCK SEQUENCE UNMET.`);
          return;
        }
        if (dirObj.unlockCondition && !s.checkCondition(dirObj.unlockCondition)) {
          soundEngine.playError();
          s.appendTerminalLine('error', `ACCESS DENIED TO ${target}. ANCHOR CONDITIONS INCOMPLETE.`);
          return;
        }
        set({ currentDirectory: target });
        s.appendTerminalLine('success', `MOUNTED ${target} — ${dirObj.description}`);
        if (target === '/07') {
          s.setView('ROOT_07');
        }
        return;
      }
      case 'cat':
      case 'read':
      case 'open': {
        if (!arg1) {
          s.appendTerminalLine('error', `Usage: ${cmd} <filename|environment>`);
          return;
        }
        const envMap: Record<string, EnvironmentId> = {
          core: 'CORE',
          ghostnet: 'GHOSTNET',
          blackbox: 'BLACKBOX',
          archive: 'ARCHIVE',
          observatory: 'OBSERVATORY',
          memory: 'MEMORY_VAULT',
          redacted: 'REDACTED_ROOM',
          null: 'NULL_SPACE',
          live: 'LIVE_SIGNALS',
          dossier: 'DOSSIER',
          root: 'ROOT_07',
          '07': 'ROOT_07',
        };
        if (cmd === 'open' && envMap[arg1.toLowerCase()]) {
          s.setView(envMap[arg1.toLowerCase()]);
          s.appendTerminalLine('success', `SWITCHING VIEWPORT -> ${envMap[arg1.toLowerCase()]}`);
          return;
        }
        const file = ALL_FILES.find(
          (f) => f.name.toLowerCase() === arg1.toLowerCase() || f.id.toLowerCase() === arg1.toLowerCase() || `${f.directory}/${f.name}`.toLowerCase() === arg1.toLowerCase()
        );
        if (!file) {
          s.appendTerminalLine('error', `TARGET NOT FOUND: ${arg1}`);
          return;
        }
        const res = s.openFile(file.id);
        if (!res.ok) {
          soundEngine.playError();
          s.appendTerminalLine('error', res.reason ?? 'ACCESS DENIED');
          return;
        }
        const activeContent =
          file.mutatedContent && s.checkCondition(file.mutatedContent.condition)
            ? `[${file.mutatedContent.note}]\n${file.mutatedContent.content}`
            : file.content;
        s.appendTerminalLine('system', `--- ${file.directory}/${file.name} [${file.classification}] ---`);
        s.appendTerminalLine('output', activeContent);
        return;
      }
      case 'file': {
        const file = ALL_FILES.find((f) => f.name.toLowerCase() === arg1.toLowerCase() || f.id.toLowerCase() === arg1.toLowerCase());
        if (!file) {
          s.appendTerminalLine('error', `FILE NOT FOUND: ${arg1}`);
          return;
        }
        s.appendTerminalLine('output', `${file.directory}/${file.name} | CHECKSUM=${file.checksum} | AUTHOR=${file.author} | DATE=${file.timestamp} | SIZE=${file.sizeBytes}B`);
        return;
      }
      case 'download': {
        const file = ALL_FILES.find((f) => f.name.toLowerCase() === arg1.toLowerCase() || f.id.toLowerCase() === arg1.toLowerCase());
        if (!file || !s.openedFiles.includes(file.id)) {
          s.appendTerminalLine('error', 'Open/read the file first before exporting.');
          return;
        }
        const blob = new Blob([`${file.name}\n${file.timestamp}\n\n${file.content}`], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${file.name}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        s.appendTerminalLine('success', `EXPORTED ${file.name}.txt`);
        return;
      }
      case 'find':
      case 'search':
      case 'locate': {
        if (!rest) {
          s.appendTerminalLine('error', `Usage: ${cmd} <keyword>`);
          return;
        }
        const q = rest.toLowerCase();
        const fHits = ALL_FILES.filter((f) => s.unlockedDirs.includes(f.directory) && (f.name.toLowerCase().includes(q) || f.summary.toLowerCase().includes(q) || f.content.toLowerCase().includes(q)));
        const nHits = GHOST_NODES.filter((n) => s.discoveredNodes.includes(n.id) && (n.id.toLowerCase().includes(q) || n.name.toLowerCase().includes(q)));
        const iHits = INCIDENTS.filter((i) => i.code.includes(q) || i.title.toLowerCase().includes(q));
        s.appendTerminalLine('system', `SEARCH RESULTS FOR "${rest}":`);
        s.appendTerminalLine(
          'output',
          [
            ...fHits.slice(0, 6).map((f) => `[FILE] ${f.directory}/${f.name}`),
            ...nHits.slice(0, 6).map((n) => `[NODE] ${n.id} (${n.name})`),
            ...iHits.map((i) => `[CASE] INCIDENT ${i.code} — ${i.title}`),
          ].join('\n') || 'No matching records in currently unlocked sectors.'
        );
        return;
      }
      case 'scan': {
        const found = s.scanNetwork(arg1 === '--deep');
        s.appendTerminalLine('system', `GHOSTNET SCAN COMPLETE (${s.discoveredNodes.length} NODES INDEXED)`);
        if (found.length > 0) {
          s.appendTerminalLine('success', `NEW NODES DETECTED: ${found.join(', ')}`);
        } else {
          s.appendTerminalLine('output', 'No new surface relays detected. Solve ciphers or connect existing nodes to expand reach.');
        }
        return;
      }
      case 'nodes': {
        const list = GHOST_NODES.filter((n) => s.discoveredNodes.includes(n.id));
        s.appendTerminalLine('output', list.map((n) => `${n.id} [${n.status}] ${n.name} (${n.region})`).join('\n'));
        return;
      }
      case 'network':
      case 'map': {
        s.setView('GHOSTNET');
        s.appendTerminalLine('success', 'VIEWPORT SWITCHED TO GHOSTNET.');
        return;
      }
      case 'connect': {
        if (!arg1) {
          s.appendTerminalLine('error', 'Usage: connect <NODE-ID>');
          return;
        }
        const res = s.connectNode(arg1);
        if (!res.ok) {
          soundEngine.playError();
          s.appendTerminalLine('error', res.reason ?? 'CONNECTION FAILED');
          return;
        }
        const node = GHOST_NODES.find((n) => n.id === arg1.toUpperCase() || n.name.toUpperCase() === arg1.toUpperCase());
        s.appendTerminalLine('success', `HANDSHAKE ESTABLISHED WITH ${node?.id} (${node?.name})`);
        if (node) {
          s.appendTerminalLine('output', `SIGNAL: ${node.signalStrength}% | STATUS: ${node.status}\nRECOVERED: ${node.recoveredData}`);
        }
        return;
      }
      case 'disconnect': {
        set({ activeNodeId: null });
        s.appendTerminalLine('output', 'Disconnected from active node focus.');
        return;
      }
      case 'trace': {
        if (!arg1) {
          s.appendTerminalLine('error', 'Usage: trace <NODE-ID>');
          return;
        }
        const edges = s.traceNode(arg1);
        s.appendTerminalLine('system', `TRACE RESULTS FOR ${arg1.toUpperCase()}:`);
        s.appendTerminalLine('output', edges.join('\n') || 'No visible hops.');
        return;
      }
      case 'mission': {
        s.appendTerminalLine(
          'output',
          OPERATIONS.map((o) => `${s.completedMissions.includes(o.id) ? '[COMPLETE]' : '[ACTIVE]  '} ${o.code} — ${o.title}: ${o.objective}`).join('\n')
        );
        return;
      }
      case 'processes':
      case 'memory': {
        s.appendTerminalLine('system', 'RESIDENT PROCESS TABLE:');
        s.appendTerminalLine('output', 'PID-0001  kernel_watchdog      SLEEP\nPID-0004  ghostnet_router      ACTIVE\nPID-0007  UNKNOWN PROCESS      RESIDENT [PROTECTED // NO BINARY ON DISK]');
        return;
      }
      case 'incident':
      case 'case': {
        const inc = INCIDENTS.find((i) => i.code === arg1 || i.id.toLowerCase() === arg1.toLowerCase()) ?? INCIDENTS[0];
        s.setSelectedIncident(inc.id);
        s.setView('BLACKBOX');
        s.appendTerminalLine('success', `OPENED BLACKBOX // INCIDENT ${inc.code} — ${inc.title}`);
        return;
      }
      case 'evidence': {
        const items = EVIDENCE_ITEMS.filter((e) => s.recoveredEvidence.includes(e.id));
        s.appendTerminalLine('output', items.map((e) => `${e.code} [${e.reliability}] ${e.title}`).join('\n'));
        return;
      }
      case 'timeline':
      case 'report': {
        const contradictions = s.evidenceConnections.filter((c) => c.status === 'CONTRADICTION');
        s.appendTerminalLine('system', `INCIDENT 0917 STATUS: ${contradictions.length > 0 ? 'RECONSTRUCTION AVAILABLE' : 'UNRESOLVED'}`);
        s.appendTerminalLine('output', `Evidence Recovered: ${s.recoveredEvidence.length}/${EVIDENCE_ITEMS.length} | Contradictions Verified: ${contradictions.length}`);
        return;
      }
      case 'person': {
        const q = rest.toLowerCase();
        const p = PERSONNEL_PROFILES.find((x) => x.name.toLowerCase().includes(q) || x.code.toLowerCase() === q) ?? PERSONNEL_PROFILES[0];
        s.appendTerminalLine('system', `${p.code} // ${p.name} — ${p.role} [${p.status}]`);
        s.appendTerminalLine('output', `${p.bio}\nLAST SEEN: ${p.lastSeen}`);
        return;
      }
      case 'archive': {
        s.setView('ARCHIVE');
        return;
      }
      case 'signal': {
        s.setView('OBSERVATORY');
        return;
      }
      case 'observe': {
        s.appendTerminalLine('transmission', `144.70 MHz BURST CAPTURED -> CHECK TX-001..TX-030 IN THE OBSERVATORY.`);
        return;
      }
      case 'blackbox': {
        s.setView('BLACKBOX');
        return;
      }
      case 'dossier': {
        s.setView('DOSSIER');
        return;
      }
      case 'ghost': {
        s.toggleGhostLayer();
        s.setView('GHOSTNET');
        s.appendTerminalLine('entity', `GHOST LAYER ${!s.ghostLayerActive ? 'ACTIVATED' : 'DISENGAGED'}.`);
        return;
      }
      case 'void': {
        s.setView('NULL_SPACE');
        return;
      }
      case '07':
      case 'root': {
        s.setView('ROOT_07');
        return;
      }
      case 'cipher': {
        const p = PUZZLES.find((x) => x.code.toLowerCase() === arg1.toLowerCase() || x.id.toLowerCase() === arg1.toLowerCase());
        if (!p) {
          s.appendTerminalLine('output', `PUZZLES: ${PUZZLES.map((x) => x.code).join(', ')}`);
          return;
        }
        s.appendTerminalLine('system', `${p.title} [${p.cipherType}]`);
        s.appendTerminalLine('output', `PAYLOAD: ${p.encodedData}\nHINT: ${p.hint}\nSolve with: decrypt ${p.code} <answer>`);
        return;
      }
      case 'decrypt':
      case 'decode': {
        const ans = tokens.slice(2).join(' ');
        if (!arg1 || !ans) {
          s.appendTerminalLine('error', `Usage: ${cmd} <puzzle_code> <solution>`);
          return;
        }
        const res = s.solvePuzzle(arg1, ans);
        s.appendTerminalLine(res.ok ? 'success' : 'error', res.message);
        return;
      }
      case 'hash': {
        s.appendTerminalLine('output', `FNV-1A(32): ${deterministicHash(rest || 'ROOT07')}`);
        return;
      }
      case 'verify': {
        s.appendTerminalLine('output', `INTEGRITY CHECK [${arg1 || 'SYSTEM'}]: 9 SECTORS MODIFIED POST-SHUTDOWN.`);
        return;
      }
      case 'key': {
        const hasNodes = s.connectedNodes.includes('NODE-017') && s.connectedNodes.includes('NODE-071');
        const hasContra = s.evidenceConnections.some((c) => c.status === 'CONTRADICTION');
        const hasCipher = s.solvedPuzzles.includes('puz_cipher_root');
        s.appendTerminalLine(
          'system',
          `DIRECTORY /07 ANCHOR STATUS:\n[${hasNodes ? 'OK' : '  '}] NODE-017 & NODE-071 CONNECTED\n[${hasContra ? 'OK' : '  '}] BLACKBOX CONTRADICTION VERIFIED\n[${hasCipher ? 'OK' : '  '}] ROOT CIPHER (WAKE_PROTOCOL) SOLVED`
        );
        return;
      }
      case 'unlock': {
        if (arg1 === '/07') {
          s.executeCommand('access /07');
        } else {
          s.appendTerminalLine('output', 'Specify a sealed directory or solve its linked cipher in The Observatory.');
        }
        return;
      }
      case 'wake':
      case 'unknown': {
        void s.askEntity(rest || 'Are you still inside Borealis?');
        s.appendTerminalLine('entity', 'TRANSMISSION SENT TO PID-0007. RESPONSE LOGGED IN UNKNOWN PROCESS CHANNEL.');
        return;
      }
      case 'remember': {
        s.appendTerminalLine('entity', `PID-0007 RECALLS: You connected ${s.connectedNodes.join(', ') || 'nothing yet'}. Earliest anomaly: Incident 0917.`);
        return;
      }
      case 'forget': {
        soundEngine.playAnomaly();
        s.appendTerminalLine('error', 'PURGE REJECTED BY PID-0007: "YOU CANNOT DELETE WHAT ALREADY ECHOED."');
        return;
      }
      default:
        s.appendTerminalLine('output', 'Command acknowledged.');
    }
  },

  askEntity: async (prompt) => {
    const s = get();
    const clean = prompt.trim();
    if (!clean) return;
    const userMsg: EntityMessage = {
      id: makeId('EM'),
      sender: 'USER',
      text: clean,
      timestamp: nowIsoTime(),
    };
    set((st) => ({
      entityMessages: [...st.entityMessages, userMsg],
      entityLoading: true,
    }));

    try {
      const contradictionsFound = s.evidenceConnections.filter((c) => c.status === 'CONTRADICTION').length;
      const resp = await fetch('/api/entity/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: clean,
          context: {
            accessLevel: s.accessLevel,
            discoveredFiles: s.openedFiles,
            discoveredNodes: s.discoveredNodes,
            recoveredEvidence: s.recoveredEvidence,
            solvedPuzzles: s.solvedPuzzles,
            completedMissions: s.completedMissions,
            contradictionsFound,
          },
        }),
      });
      const data = await resp.json();
      const replyText = data.reply || data.error || 'SIGNAL LOST IN NOISE FLOOR.';
      const entityMsg: EntityMessage = {
        id: makeId('EM'),
        sender: 'ENTITY',
        text: replyText,
        timestamp: nowIsoTime(),
        mode: data.mode,
      };
      set((st) => ({
        entityMessages: [...st.entityMessages, entityMsg],
        entityLoading: false,
      }));
      soundEngine.playAnomaly();
    } catch {
      set((st) => ({
        entityMessages: [
          ...st.entityMessages,
          {
            id: makeId('EM'),
            sender: 'ENTITY',
            text: 'CHANNEL INTERRUPTED. RETRY TRANSMISSION.',
            timestamp: nowIsoTime(),
            mode: 'deterministic',
          },
        ],
        entityLoading: false,
      }));
    }
  },

  setCloudAuth: async (uid, email) => {
    set({ cloudUid: uid, cloudEmail: email });
    if (!uid) return;
    set({ cloudSyncing: true });
    try {
      const cloudData = await loadSessionFromCloud(uid);
      if (cloudData) {
        set((s) => ({
          accessLevel: Math.max(s.accessLevel, cloudData.accessLevel ?? 0),
          discoveredNodes: Array.from(new Set([...s.discoveredNodes, ...(cloudData.discoveredNodes ?? [])])),
          connectedNodes: Array.from(new Set([...s.connectedNodes, ...(cloudData.connectedNodes ?? [])])),
          discoveredFiles: Array.from(new Set([...s.discoveredFiles, ...(cloudData.discoveredFiles ?? [])])),
          openedFiles: Array.from(new Set([...s.openedFiles, ...(cloudData.openedFiles ?? [])])),
          unlockedDirs: Array.from(new Set([...s.unlockedDirs, ...(cloudData.unlockedDirs ?? [])])),
          unlockedCommands: Array.from(new Set([...s.unlockedCommands, ...(cloudData.unlockedCommands ?? [])])),
          completedMissions: Array.from(new Set([...s.completedMissions, ...(cloudData.completedMissions ?? [])])),
          recoveredEvidence: Array.from(new Set([...s.recoveredEvidence, ...(cloudData.recoveredEvidence ?? [])])),
          solvedPuzzles: Array.from(new Set([...s.solvedPuzzles, ...(cloudData.solvedPuzzles ?? [])])),
          unlockedRegions: Array.from(new Set([...s.unlockedRegions, ...(cloudData.unlockedRegions ?? [])])) as RegionId[],
          endingReached: s.endingReached ?? cloudData.endingReached ?? null,
        }));
      }
      await syncSessionToCloud(uid, buildSnapshot(get()));
    } catch {
      // keep local session active even if cloud sync fails
    } finally {
      set({ cloudSyncing: false });
      get().evaluateProgression();
    }
  },

  syncNow: async () => {
    const s = get();
    await saveLocalState(buildSnapshot(s));
    if (s.cloudUid) {
      set({ cloudSyncing: true });
      try {
        await syncSessionToCloud(s.cloudUid, buildSnapshot(s));
      } finally {
        set({ cloudSyncing: false });
      }
    }
  },

  refreshOverrides: async () => {
    const overrides = await fetchPublishedOverrides();
    set({ overrides });
  },

  resetSession: async () => {
    await clearLocalState();
    window.location.reload();
  },
}));
