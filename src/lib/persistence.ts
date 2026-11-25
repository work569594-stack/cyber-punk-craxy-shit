import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { EndingId, EvidenceConnection, RegionId, UniverseOverrideItem } from '../types/universe';

const DB_NAME = 'root_access_07_db';
const DB_VERSION = 1;
const STORE_NAME = 'session_state';
const STATE_KEY = 'primary';

export interface PersistedStateSnapshot {
  sessionId: string;
  visitCount: number;
  lastVisitAt: string;
  totalTimeSeconds: number;
  accessLevel: number;
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
  commandHistory: string[];
  crtEnabled: boolean;
  audioEnabled: boolean;
  masterVolume: number;
  ambientVolume: number;
  sfxVolume: number;
}

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const database = req.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadLocalState(): Promise<Partial<PersistedStateSnapshot> | null> {
  try {
    const database = await openIndexedDb();
    return await new Promise((resolve) => {
      const tx = database.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(STATE_KEY);
      req.onsuccess = () => resolve((req.result as Partial<PersistedStateSnapshot>) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveLocalState(snapshot: PersistedStateSnapshot): Promise<void> {
  try {
    const database = await openIndexedDb();
    await new Promise<void>((resolve) => {
      const tx = database.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(snapshot, STATE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // IndexedDB unavailable in restricted mode
  }
}

export async function clearLocalState(): Promise<void> {
  try {
    const database = await openIndexedDb();
    await new Promise<void>((resolve) => {
      const tx = database.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(STATE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

export async function syncSessionToCloud(uid: string, snapshot: PersistedStateSnapshot): Promise<void> {
  const path = `sessions/${uid}`;
  try {
    const ref = doc(db, 'sessions', uid);
    const existing = await getDoc(ref);
    const payload = {
      ownerId: uid,
      sessionId: snapshot.sessionId.slice(0, 64),
      accessLevel: Math.max(0, Math.min(6, Math.floor(snapshot.accessLevel))),
      discoveredNodes: snapshot.discoveredNodes.slice(0, 200),
      connectedNodes: snapshot.connectedNodes.slice(0, 200),
      discoveredFiles: snapshot.discoveredFiles.slice(0, 200),
      openedFiles: snapshot.openedFiles.slice(0, 200),
      unlockedDirs: snapshot.unlockedDirs.slice(0, 50),
      unlockedCommands: snapshot.unlockedCommands.slice(0, 100),
      completedMissions: snapshot.completedMissions.slice(0, 50),
      recoveredEvidence: snapshot.recoveredEvidence.slice(0, 100),
      evidenceConnections: snapshot.evidenceConnections.slice(0, 100),
      solvedPuzzles: snapshot.solvedPuzzles.slice(0, 50),
      unlockedRegions: snapshot.unlockedRegions.slice(0, 20),
      encounteredAnomalies: snapshot.encounteredAnomalies.slice(0, 100),
      narrativeChoices: snapshot.narrativeChoices,
      endingReached: snapshot.endingReached,
      totalTimeSeconds: Math.max(0, Math.floor(snapshot.totalTimeSeconds)),
      updatedAt: serverTimestamp(),
    };

    if (!existing.exists()) {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        ref,
        {
          ...payload,
          createdAt: existing.data().createdAt ?? serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function loadSessionFromCloud(uid: string): Promise<Partial<PersistedStateSnapshot> | null> {
  const path = `sessions/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'sessions', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      sessionId: data.sessionId,
      accessLevel: data.accessLevel,
      discoveredNodes: data.discoveredNodes,
      connectedNodes: data.connectedNodes,
      discoveredFiles: data.discoveredFiles,
      openedFiles: data.openedFiles,
      unlockedDirs: data.unlockedDirs,
      unlockedCommands: data.unlockedCommands,
      completedMissions: data.completedMissions,
      recoveredEvidence: data.recoveredEvidence,
      evidenceConnections: data.evidenceConnections,
      solvedPuzzles: data.solvedPuzzles,
      unlockedRegions: data.unlockedRegions,
      encounteredAnomalies: data.encounteredAnomalies,
      narrativeChoices: data.narrativeChoices,
      endingReached: data.endingReached ?? null,
      totalTimeSeconds: data.totalTimeSeconds,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function saveDossierToCloud(
  uid: string,
  dossierCode: string,
  accessLevel: number,
  endingReached: string | null,
  summary: string
): Promise<void> {
  const safeId = dossierCode.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  const path = `sessions/${uid}/dossiers/${safeId}`;
  try {
    await setDoc(doc(db, 'sessions', uid, 'dossiers', safeId), {
      ownerId: uid,
      dossierCode: safeId,
      accessLevel,
      endingReached,
      summary: summary.slice(0, 4000),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function fetchPublishedOverrides(): Promise<UniverseOverrideItem[]> {
  const path = 'universe_overrides';
  try {
    const q = query(collection(db, path), where('published', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        kind: data.kind,
        entityId: data.entityId,
        title: data.title,
        payload: data.payload ?? {},
        published: Boolean(data.published),
      };
    });
  } catch {
    return [];
  }
}
