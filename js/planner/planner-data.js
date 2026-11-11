// Planner data layer. Every UI read and write goes through here, shaped to
// the contracts in firestore.rules. Firebase is injected: {db, fs, uid}.
import { visibleSet, familySet } from './planner-core.js';

const BATCH_LIMIT = 400;

export function createPlannerData({ db, fs, uid }) {
  const ref = (path) => fs.doc(db, path);
  const col = (path) => fs.collection(db, path);
  const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const watchDoc = (path, cb) =>
    fs.onSnapshot(ref(path), (s) => cb(s.exists() ? s.data() : null));
  const watchCol = (q, cb) => fs.onSnapshot(q, (s) => cb(rows(s)));
  const write = (fn) => { const b = fs.writeBatch(db); fn(b); return b.commit(); };
  const now = () => fs.serverTimestamp();

  const create = async (path, data) => {
    const r = fs.doc(col(path));
    await write((b) => b.set(r, data));
    return r.id;
  };
  const update = (path, patch) => write((b) => b.update(ref(path), patch));
  const remove = (path) => write((b) => b.delete(ref(path)));
  const mySide = async () => (await fs.getDoc(ref(`members/${uid}`))).data().side;

  // A single visibility uses '==', the form reader rules accept.
  const visibleQuery = (path, member, family) => {
    const set = family ? familySet() : visibleSet(member);
    const clause = set.length === 1
      ? fs.where('visibility', '==', set[0])
      : fs.where('visibility', 'in', set);
    return fs.query(col(path), clause);
  };

  // Labels may only point at 'everyone' events, so unlink them first-hand.
  const unlinkLabels = async (eventId) => {
    const snap = await fs.getDocs(fs.query(col('labels'), fs.where('eventId', '==', eventId)));
    for (const d of snap.docs) await update(`labels/${d.id}`, { eventId: fs.deleteField() });
  };

  return {
    // ===== MEMBERS AND ACCESS =====
    watchMember: (cb) => fs.onSnapshot(ref(`members/${uid}`),
      (s) => cb(s.exists() ? { uid, ...s.data() } : null)),

    async requestAccess({ email, name, photoURL }) {
      const r = ref(`access_requests/${uid}`);
      if ((await fs.getDoc(r)).exists()) return;
      await write((b) => b.set(r, { email, name, photoURL: photoURL ?? null, requestedAt: now() }));
    },

    watchRequests: (cb) => watchCol(col('access_requests'), cb),
    watchMembers: (cb) => watchCol(col('members'), cb),

    async approve(target, role) {
      const req = (await fs.getDoc(ref(`access_requests/${target}`))).data();
      const side = role === 'editor' ? await mySide() : null;
      await write((b) => b.set(ref(`members/${target}`), {
        role,
        side,
        email: req.email,
        name: req.name,
        photoURL: req.photoURL ?? null,
        approvedAt: now(),
        approvedBy: uid,
      }));
      await remove(`access_requests/${target}`);
    },

    decline: (target) => remove(`access_requests/${target}`),

    async setRole(target, role) {
      await update(`members/${target}`, { role, side: role === 'editor' ? await mySide() : null });
    },

    removeMember: (target) => remove(`members/${target}`),

    // ===== TASKS =====
    watchTasks: (member, { family } = {}, cb) => watchCol(visibleQuery('tasks', member, family), cb),

    addTask: (data) => create('tasks', { ...data, createdBy: uid, createdAt: now(), updatedAt: now() }),

    updateTask: (id, patch) => update(`tasks/${id}`, { ...patch, updatedAt: now() }),

    // Children go first, one write each: their rules read the parent task.
    async deleteTask(id) {
      const children = [ref(`tasks/${id}/private/notes`)];
      for (const sub of ['comments', 'history']) {
        children.push(...(await fs.getDocs(col(`tasks/${id}/${sub}`))).docs.map((d) => d.ref));
      }
      for (const c of children) await write((b) => b.delete(c));
      await remove(`tasks/${id}`);
    },

    setStatus: (id, from, to) => write((b) => {
      b.update(ref(`tasks/${id}`), { status: to, updatedAt: now() });
      b.set(fs.doc(col(`tasks/${id}/history`)), { from, to, by: uid, at: now() });
    }),

    watchNotes: (id, cb) => watchDoc(`tasks/${id}/private/notes`, cb),
    saveNotes: (id, text) => write((b) => b.set(ref(`tasks/${id}/private/notes`), { text })),

    watchComments: (id, cb) => watchCol(fs.query(col(`tasks/${id}/comments`), fs.orderBy('at')), cb),
    addComment: (id, text) => create(`tasks/${id}/comments`, { text, by: uid, at: now() }),
    deleteComment: (id, cid) => remove(`tasks/${id}/comments/${cid}`),

    watchHistory: (id, cb) => watchCol(fs.query(col(`tasks/${id}/history`), fs.orderBy('at')), cb),

    // ===== EVENTS =====
    watchEvents: (member, { family } = {}, cb) => watchCol(visibleQuery('events', member, family), cb),
    addEvent: (data) => create('events', data),

    async updateEvent(id, patch) {
      await update(`events/${id}`, patch);
      if ('visibility' in patch && patch.visibility !== 'everyone') await unlinkLabels(id);
    },

    async deleteEvent(id) {
      await remove(`events/${id}`);
      await unlinkLabels(id);
    },

    // ===== LABELS =====
    watchLabels: (cb) => watchCol(col('labels'), cb),
    addLabel: (data) => create('labels', data),
    updateLabel: (id, patch) => update(`labels/${id}`, patch),

    // Strips the label from every task the caller can see, then deletes it.
    async deleteLabel(id) {
      const me = (await fs.getDoc(ref(`members/${uid}`))).data();
      const snap = await fs.getDocs(fs.query(col('tasks'),
        fs.where('visibility', 'in', visibleSet(me)),
        fs.where('labels', 'array-contains', id)));
      for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
        await write((b) => snap.docs.slice(i, i + BATCH_LIMIT)
          .forEach((d) => b.update(d.ref, { labels: fs.arrayRemove(id), updatedAt: now() })));
      }
      await remove(`labels/${id}`);
    },

    // ===== VENDORS, BUDGET, PREFS =====
    watchVendors: (cb) => watchCol(col('vendors'), cb),
    addVendor: (data) => create('vendors', data),
    updateVendor: (id, patch) => update(`vendors/${id}`, patch),
    deleteVendor: (id) => remove(`vendors/${id}`),

    watchBudget: (cb) => watchDoc('settings/budget', cb),
    setBudget: (total) => write((b) => b.set(ref('settings/budget'), { total })),

    watchPrefs: (cb) => watchDoc(`prefs/${uid}`, cb),
    setMode: (mode) => write((b) => b.set(ref(`prefs/${uid}`), { mode })),
  };
}
