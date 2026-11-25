import { useCallback, useEffect, useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { Lock, LogIn, LogOut, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { ADMIN_EMAIL, auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { useWorldStore } from '../engine/worldStore';
import { UniverseOverrideItem } from '../types/universe';

interface OverrideDoc extends UniverseOverrideItem {
  authorUid: string;
}

export function AdminCmsView() {
  const {
    cloudUid,
    cloudEmail,
    refreshOverrides,
    pushNotification,
    accessLevel,
    discoveredNodes,
    openedFiles,
    completedMissions,
  } = useWorldStore();

  const isAdmin = Boolean(cloudUid && cloudEmail === ADMIN_EMAIL);

  const [items, setItems] = useState<OverrideDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [kind, setKind] = useState<UniverseOverrideItem['kind']>('event');
  const [entityId, setEntityId] = useState('OVERRIDE_01');
  const [title, setTitle] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [published, setPublished] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadAllOverrides = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'universe_overrides'), orderBy('updatedAt', 'desc'));
      const snap = await getDocs(q);
      setItems(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            kind: data.kind,
            entityId: data.entityId,
            title: data.title,
            payload: data.payload ?? {},
            published: Boolean(data.published),
            authorUid: data.authorUid,
          };
        })
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'universe_overrides');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadAllOverrides();
  }, [loadAllOverrides]);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      pushNotification({
        title: 'SIGN-IN INTERRUPTED',
        message: err instanceof Error ? err.message : 'Google authentication cancelled.',
        severity: 'WARNING',
      });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !cloudUid || !title.trim() || !entityId.trim()) return;
    setSubmitting(true);
    const cleanEntityId = entityId.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
    const docId = `ovr_${cleanEntityId}_${Date.now().toString(36)}`;
    const path = `universe_overrides/${docId}`;

    try {
      await setDoc(doc(db, 'universe_overrides', docId), {
        kind,
        entityId: cleanEntityId,
        title: title.trim().slice(0, 200),
        payload: { message: bodyText.trim().slice(0, 1500) },
        published,
        authorUid: cloudUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setTitle('');
      setBodyText('');
      await Promise.all([loadAllOverrides(), refreshOverrides()]);
      pushNotification({
        title: 'OVERRIDE COMMITTED',
        message: `${docId} written to Firestore universe_overrides.`,
        severity: 'INFO',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublished = async (item: OverrideDoc) => {
    if (!isAdmin) return;
    const path = `universe_overrides/${item.id}`;
    try {
      await updateDoc(doc(db, 'universe_overrides', item.id), {
        published: !item.published,
        updatedAt: serverTimestamp(),
      });
      await Promise.all([loadAllOverrides(), refreshOverrides()]);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleDelete = async (item: OverrideDoc) => {
    if (!isAdmin) return;
    const path = `universe_overrides/${item.id}`;
    try {
      await deleteDoc(doc(db, 'universe_overrides', item.id));
      await Promise.all([loadAllOverrides(), refreshOverrides()]);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  if (!cloudUid) {
    return (
      <div className="flex h-full items-center justify-center bg-[#020403] p-6">
        <div className="max-w-md border border-[#506454]/35 bg-[#071009] p-8 space-y-5">
          <div className="flex items-center gap-2 font-terminal text-xs text-[#C68A2A]">
            <Lock className="h-4 w-4" />
            ARCHITECT CMS // AUTHENTICATION REQUIRED
          </div>
          <p className="text-xs leading-relaxed text-[#D6E2D8]/85">
            Universe Override management is restricted to the verified Project ROOT administrator account via Firebase Authentication and Firestore Security Rules.
          </p>
          <button
            type="button"
            onClick={() => void handleSignIn()}
            className="inline-flex items-center gap-2 border border-[#00FF41] bg-[#00FF41]/10 px-4 py-2 text-xs text-[#00FF41] hover:bg-[#00FF41]/20"
          >
            <LogIn className="h-3.5 w-3.5" />
            Sign In with Google
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center bg-[#020403] p-6">
        <div className="max-w-md border border-[#FF2424]/40 bg-[#071009] p-8 space-y-4">
          <div className="flex items-center gap-2 font-terminal text-xs text-[#FF2424]">
            <ShieldAlert className="h-4 w-4" />
            CLEARANCE INSUFFICIENT
          </div>
          <p className="text-xs leading-relaxed text-[#D6E2D8]/85">
            Signed in as <span className="text-[#00FF41]">{cloudEmail}</span>. Only the designated administrator account may publish or edit global Universe Overrides. Your personal session progress remains synced normally.
          </p>
          <button
            type="button"
            onClick={() => void signOut(auth)}
            className="inline-flex items-center gap-2 border border-[#506454]/50 px-3.5 py-1.5 text-xs text-[#D6E2D8] hover:border-[#FF2424]"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#020403] p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#506454]/25 pb-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[#C68A2A]">
            Architect Controls · {cloudEmail}
          </div>
          <h2 className="mt-1 font-editorial text-2xl sm:text-3xl font-semibold text-[#D6E2D8]">
            Universe CMS & Live Overrides
          </h2>
        </div>

        <button
          type="button"
          onClick={() => void signOut(auth)}
          className="inline-flex items-center gap-1.5 border border-[#506454]/40 bg-[#071009] px-3 py-1.5 text-xs text-[#D6E2D8] hover:border-[#FF2424]"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border border-[#506454]/25 bg-[#071009] p-4 font-mono-tabular text-xs">
        <div>
          <div className="text-[#506454]">Current Level</div>
          <div className="mt-1 text-base text-[#00FF41]">L0{accessLevel}</div>
        </div>
        <div>
          <div className="text-[#506454]">Indexed Nodes</div>
          <div className="mt-1 text-base text-[#D6E2D8]">{discoveredNodes.length}</div>
        </div>
        <div>
          <div className="text-[#506454]">Opened Files</div>
          <div className="mt-1 text-base text-[#D6E2D8]">{openedFiles.length}</div>
        </div>
        <div>
          <div className="text-[#506454]">Completed Ops</div>
          <div className="mt-1 text-base text-[#D6E2D8]">{completedMissions.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form onSubmit={handleCreate} className="lg:col-span-5 border border-[#506454]/30 bg-[#071009] p-5 space-y-4">
          <div className="text-xs uppercase tracking-widest text-[#00FF41]">
            Publish Live Override
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs">
              <span className="text-[#506454]">Target Kind</span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as UniverseOverrideItem['kind'])}
                className="w-full border border-[#506454]/40 bg-[#020403] px-2.5 py-2 text-xs text-[#D6E2D8]"
              >
                <option value="event">event</option>
                <option value="transmission">transmission</option>
                <option value="file">file</option>
                <option value="node">node</option>
                <option value="incident">incident</option>
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-[#506454]">Entity ID (alphanumeric/_/-)</span>
              <input
                type="text"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                required
                className="w-full border border-[#506454]/40 bg-[#020403] px-2.5 py-2 text-xs text-[#D6E2D8]"
              />
            </label>
          </div>

          <label className="block space-y-1 text-xs">
            <span className="text-[#506454]">Override Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., BOREALIS PARITY ALERT"
              required
              className="w-full border border-[#506454]/40 bg-[#020403] px-2.5 py-2 text-xs text-[#D6E2D8]"
            />
          </label>

          <label className="block space-y-1 text-xs">
            <span className="text-[#506454]">Directive / Transmission Payload</span>
            <textarea
              rows={4}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Bulletin content surfaced to active explorers..."
              className="w-full border border-[#506454]/40 bg-[#020403] p-2.5 text-xs text-[#D6E2D8]"
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-[#D6E2D8]">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="accent-[#00FF41]"
            />
            Publish immediately to all explorers
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 border border-[#00FF41] bg-[#00FF41]/10 px-4 py-2 text-xs text-[#00FF41] hover:bg-[#00FF41]/20 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {submitting ? 'Writing...' : 'Commit Override'}
          </button>
        </form>

        <div className="lg:col-span-7 border border-[#506454]/30 bg-[#071009] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-[#506454]">
              Stored Overrides ({items.length})
            </span>
            {loading && <span className="text-xs text-[#00FF41]">Syncing...</span>}
          </div>

          <div className="divide-y divide-[#506454]/20">
            {items.map((item) => (
              <div key={item.id} className="py-3 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-terminal text-xs text-[#D6E2D8]">
                    [{item.kind.toUpperCase()}] {item.title}{' '}
                    <span className="text-[#506454]">({item.entityId})</span>
                  </div>
                  {item.payload?.message && (
                    <p className="text-xs text-[#D6E2D8]/75">{item.payload.message}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleTogglePublished(item)}
                    className={`border px-2.5 py-1 text-[11px] ${
                      item.published
                        ? 'border-[#00FF41]/50 text-[#00FF41]'
                        : 'border-[#506454]/40 text-[#506454]'
                    }`}
                  >
                    {item.published ? 'PUBLISHED' : 'DRAFT'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(item)}
                    aria-label="Delete override"
                    className="p-1.5 text-[#506454] hover:text-[#FF2424]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="py-6 text-xs text-[#506454]">
                No custom universe overrides created yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
