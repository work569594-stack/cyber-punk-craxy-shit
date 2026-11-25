export type EnvironmentId =
  | 'CORE'
  | 'GHOSTNET'
  | 'BLACKBOX'
  | 'ARCHIVE'
  | 'OBSERVATORY'
  | 'MEMORY_VAULT'
  | 'REDACTED_ROOM'
  | 'NULL_SPACE'
  | 'LIVE_SIGNALS'
  | 'ROOT_07'
  | 'DOSSIER'
  | 'ADMIN_CMS';

export type SoundscapeId =
  | 'ROOT_ACCESS'
  | 'GHOSTNET'
  | 'BLACKBOX'
  | 'ARCHIVE'
  | 'NULL_SPACE'
  | 'GHOST_LAYER'
  | 'ROOT_07';

export type NodeCategory =
  | 'SERVER'
  | 'ARCHIVE'
  | 'RESEARCH_STATION'
  | 'IDENTITY'
  | 'TRANSMISSION'
  | 'INCIDENT'
  | 'OPERATOR'
  | 'MEMORY'
  | 'DEAD_NODE'
  | 'RESTRICTED_NODE'
  | 'UNKNOWN_ENTITY'
  | 'ANOMALY'
  | 'HIDDEN_LOCATION';

export type NodeStatus =
  | 'ONLINE'
  | 'OFFLINE'
  | 'CORRUPTED'
  | 'ENCRYPTED'
  | 'UNKNOWN'
  | 'RESTRICTED'
  | 'UNSTABLE'
  | 'GHOST'
  | 'DELETED';

export type RegionId =
  | 'REGION_01'
  | 'REGION_02'
  | 'REGION_03'
  | 'REGION_04'
  | 'REGION_05'
  | 'REGION_06';

export interface GhostRegion {
  id: RegionId;
  code: string;
  name: string;
  description: string;
  unlockRequirementText: string;
  color: string;
  center: [number, number, number];
}

export interface GhostNode {
  id: string;
  name: string;
  region: RegionId;
  category: NodeCategory;
  status: NodeStatus;
  position: [number, number, number];
  signalStrength: number;
  lastActivity: string;
  requiredAccess: number;
  hidden?: boolean;
  ghostLayerOnly?: boolean;
  unlockCondition?: UnlockCondition;
  description: string;
  recoveredData: string;
  linkedFiles: string[];
  linkedIncidents: string[];
  linkedPersonnel: string[];
  linkedTransmission?: string;
  linkedCommand?: string;
  linkedPuzzle?: string;
  disappearsOnInspect?: boolean;
}

export interface GhostEdge {
  id: string;
  from: string;
  to: string;
  hidden?: boolean;
  ghostLayerOnly?: boolean;
  contradictory?: boolean;
  label?: string;
  unlockCondition?: UnlockCondition;
}

export interface FileVersion {
  version: string;
  timestamp: string;
  author: string;
  content: string;
}

export interface VirtualFile {
  id: string;
  name: string;
  directory: string;
  classification: 'PUBLIC' | 'INTERNAL' | 'CLASSIFIED' | 'TOP_SECRET' | 'CORRUPTED' | 'UNKNOWN';
  requiredAccess: number;
  hidden?: boolean;
  unlockCondition?: UnlockCondition;
  sizeBytes: number;
  timestamp: string;
  author: string;
  checksum: string;
  summary: string;
  content: string;
  mutatedContent?: {
    condition: UnlockCondition;
    content: string;
    note: string;
  };
  versions?: FileVersion[];
  redactions?: {
    token: string;
    revealCondition: UnlockCondition;
    revealedText: string;
  }[];
  linkedNodes?: string[];
  linkedIncidents?: string[];
  linkedPersonnel?: string[];
  unlocksCommand?: string;
  unlocksEvidence?: string;
  unlocksNode?: string;
}

export interface VirtualDirectory {
  path: string;
  name: string;
  requiredAccess: number;
  hidden?: boolean;
  unlockCondition?: UnlockCondition;
  description: string;
}

export type EvidenceCategory =
  | 'TEXT_REPORT'
  | 'AUDIO_LOG'
  | 'CCTV_FRAGMENT'
  | 'PERSONNEL_FILE'
  | 'SERVER_LOG'
  | 'INTERNAL_COMMS'
  | 'CORRUPTED_RECORD'
  | 'EXPERIMENTAL_DATA'
  | 'TRANSMISSION';

export interface EvidenceItem {
  id: string;
  code: string;
  title: string;
  category: EvidenceCategory;
  incidentId: string;
  origin: string;
  timestamp: string;
  classification: string;
  reliability: 'VERIFIED' | 'CONTESTED' | 'CORRUPTED' | 'ANOMALOUS';
  summary: string;
  content: string;
  unlockCondition?: UnlockCondition;
  defaultPos: { x: number; y: number };
  relatedIds: string[];
  contradictsIds?: string[];
  contradictionNote?: string;
}

export interface EvidenceConnection {
  id: string;
  fromId: string;
  toId: string;
  note: string;
  status: 'VALID' | 'CONTRADICTION' | 'HYPOTHESIS';
  createdAt: string;
}

export interface IncidentStage {
  stageNumber: number;
  title: string;
  summary: string;
  requiredEvidenceCount: number;
  requiredEvidenceIds?: string[];
}

export interface IncidentCase {
  id: string;
  code: string;
  title: string;
  classification: string;
  status: 'UNRESOLVED' | 'ACTIVE' | 'CONTRADICTION_DETECTED' | 'RECONSTRUCTION_AVAILABLE' | 'RECONSTRUCTED';
  investigator: string;
  facility: string;
  dateOccurred: string;
  briefing: string;
  officialNarrative: string;
  hiddenTruth: string;
  unlockCondition?: UnlockCondition;
  stages: IncidentStage[];
  evidenceIds: string[];
  personnelIds: string[];
  nodeIds: string[];
}

export interface PersonnelProfile {
  id: string;
  code: string;
  name: string;
  role: string;
  clearance: string;
  status: 'MISSING' | 'PRESUMED_LOST' | 'DELETED_FROM_ROSTER' | 'UNACCOUNTED' | 'REASSIGNED';
  lastSeen: string;
  facility: string;
  bio: string;
  memoryFragmentTitle: string;
  memoryFragmentAudioHint: string;
  memoryFragmentText: string;
  linkedIncidents: string[];
  linkedNodes: string[];
  unlockCondition?: UnlockCondition;
}

export interface TransmissionItem {
  id: string;
  code: string;
  frequencyMhz: number;
  sourceNodeId: string;
  timestamp: string;
  recipient: string;
  encrypted: boolean;
  cipherType?: 'CAESAR' | 'BINARY' | 'HEX' | 'BASE64' | 'MORSE' | 'SUBSTITUTION' | 'PATTERN' | 'CODEWORD';
  rawPayload: string;
  decodedPayload: string;
  hint: string;
  puzzleId?: string;
  unlockCondition?: UnlockCondition;
}

export interface PuzzleDef {
  id: string;
  code: string;
  title: string;
  cipherType: 'CAESAR' | 'BINARY' | 'HEX' | 'BASE64' | 'MORSE' | 'SUBSTITUTION' | 'PATTERN' | 'TIMESTAMP' | 'CODEWORD';
  prompt: string;
  encodedData: string;
  acceptedAnswers: string[];
  hint: string;
  unlocks: {
    commands?: string[];
    nodes?: string[];
    files?: string[];
    dirs?: string[];
    evidence?: string[];
    regions?: RegionId[];
    accessLevelMin?: number;
  };
  rewardMessage: string;
}

export interface OperationMission {
  id: string;
  code: string;
  title: string;
  briefing: string;
  objective: string;
  hiddenObjective: string;
  requiredFiles?: string[];
  requiredNodes?: string[];
  requiredConnectedNodes?: string[];
  requiredPuzzles?: string[];
  requiredEvidence?: string[];
  requiredContradictions?: number;
  requiredRegions?: RegionId[];
  consequenceText: string;
  unlocks: {
    accessLevelMin?: number;
    commands?: string[];
    nodes?: string[];
    dirs?: string[];
    regions?: RegionId[];
    files?: string[];
  };
}

export interface UnlockCondition {
  minAccessLevel?: number;
  requiredFiles?: string[];
  requiredNodes?: string[];
  requiredConnectedNodes?: string[];
  requiredPuzzles?: string[];
  requiredMissions?: string[];
  requiredEvidence?: string[];
  requiredRegions?: RegionId[];
  minContradictions?: number;
}

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'system' | 'warning' | 'error' | 'success' | 'entity' | 'transmission';
  text: string;
  timestamp: string;
}

export interface SystemEventDef {
  id: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'ANOMALY' | 'CRITICAL';
  rare?: boolean;
  condition?: UnlockCondition;
  targetView?: EnvironmentId;
}

export interface EntityMessage {
  id: string;
  sender: 'USER' | 'ENTITY' | 'SYSTEM';
  text: string;
  timestamp: string;
  mode?: 'gemini' | 'deterministic';
}

export type EndingId =
  | 'ENDING_A_OBSERVER'
  | 'ENDING_B_OPERATOR'
  | 'ENDING_C_GHOST'
  | 'ENDING_D_ROOT'
  | 'ENDING_E_UNRESOLVED';

export interface UniverseOverrideItem {
  id: string;
  kind: 'node' | 'file' | 'transmission' | 'incident' | 'event';
  entityId: string;
  title: string;
  payload: Record<string, string>;
  published: boolean;
}
