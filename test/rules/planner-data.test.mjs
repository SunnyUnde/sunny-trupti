import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, collection, getDoc, getDocs } from 'firebase/firestore';
import { seed, npmFs, asGuest, asOwner, asPlannerEditor, asReader } from './helpers.mjs';
import { createPlannerData } from '../../js/planner/planner-data.js';

// Own project id: node --test runs files in parallel.
const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;
let dbs;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-wedding-data',
    firestore: { rules, host: '127.0.0.1', port: 8080 },
  });
});
after(async () => { await env.cleanup(); });

const at = new Date('2026-11-11T00:00:00Z');
const VIS = { t_all: 'everyone', t_pl: 'planners', t_g: 'groom', t_b: 'bride' };
const MEMBERS = {
  sunny: { role: 'owner', side: 'groom' },
  trupti: { role: 'owner', side: 'bride' },
  aai: { role: 'editor', side: 'bride' },
  kaka: { role: 'reader', side: null },
};

const task = (visibility, extra = {}) => ({
  title: 'Book hall', due: '2026-12-01', owner: 'both', ownerName: 'Both', status: 'todo',
  labels: [], visibility, createdBy: 'trupti', createdAt: at, updatedAt: at, ...extra,
});

beforeEach(async () => {
  await env.clearFirestore();
  dbs = {
    sunny: await asOwner(env, 'sunny', 'groom'),
    trupti: await asOwner(env, 'trupti', 'bride'),
    aai: await asPlannerEditor(env, 'aai', 'bride'),
    kaka: await asReader(env, 'kaka'),
    guest: asGuest(env, 'guest'),
  };
  for (const [id, v] of Object.entries(VIS)) await seed(env, `tasks/${id}`, task(v));
  await seed(env, 'events/ev_all', { title: 'Sangeet', date: '2027-01-20', visibility: 'everyone' });
  await seed(env, 'labels/l1', { name: 'Sangeet', group: 'day', color: '#f00', eventId: 'ev_all' });
});

const data = (uid, fs = npmFs) => createPlannerData({ db: dbs[uid], fs, uid });

// Resolves with the first snapshot that satisfies `ok`, then unsubscribes;
// rejects on a listener error. A client's first snapshot can come from its
// local cache alone, so waits after a write match the expected server state.
const first = (watch, ok = () => true) => new Promise((resolve, reject) => {
  const unsub = watch((v) => {
    if (!ok(v)) return;
    Promise.resolve().then(() => unsub());
    resolve(v);
  }, reject);
});

const raw = async (path) => {
  let out;
  await env.withSecurityRulesDisabled(async (ctx) => {
    const segs = path.split('/');
    const db = ctx.firestore();
    if (segs.length % 2) {
      out = (await getDocs(collection(db, path))).docs.map((d) => ({ id: d.id, ...d.data() }));
    } else {
      const s = await getDoc(doc(db, path));
      out = s.exists() ? s.data() : null;
    }
  });
  return out;
};

const ids = (list) => list.map((x) => x.id).sort();

test('family preview uses reader queries', async () => {
  const calls = [];
  const spyFs = { ...npmFs, where: (...a) => { calls.push(a); return npmFs.where(...a); } };
  const list = await first((cb, e) => data('aai', spyFs).watchTasks(MEMBERS.aai, { family: true }, cb, e));
  assert.deepEqual(ids(list), ['t_all']);
  assert.deepEqual(calls, [['visibility', '==', 'everyone']]);
});

test('planner and reader task watches return their visible sets', async () => {
  const mine = await first((cb, e) => data('aai').watchTasks(MEMBERS.aai, { family: false }, cb, e));
  assert.deepEqual(ids(mine), ['t_all', 't_b', 't_pl']);
  const read = await first((cb, e) => data('kaka').watchTasks(MEMBERS.kaka, { family: false }, cb, e));
  assert.deepEqual(ids(read), ['t_all']);
});

test('event watches filter by visibility', async () => {
  await seed(env, 'events/ev_g', { title: 'Haldi', date: '2027-01-21', visibility: 'groom' });
  assert.deepEqual(ids(await first((cb, e) => data('kaka').watchEvents(MEMBERS.kaka, {}, cb, e))), ['ev_all']);
  assert.deepEqual(ids(await first((cb, e) => data('sunny').watchEvents(MEMBERS.sunny, {}, cb, e))), ['ev_all', 'ev_g']);
});

test('undo appends history', async () => {
  const d = data('aai');
  await d.setStatus('t_b', 'todo', 'done');
  await d.setStatus('t_b', 'done', 'todo');
  assert.equal((await raw('tasks/t_b')).status, 'todo');
  const hist = await first((cb, e) => d.watchHistory('t_b', cb, e), (h) => h.length === 2);
  assert.deepEqual(hist.map(({ from, to, by }) => ({ from, to, by })), [
    { from: 'todo', to: 'done', by: 'aai' },
    { from: 'done', to: 'todo', by: 'aai' },
  ]);
});

test('deleting a label strips it from tasks', async () => {
  await seed(env, 'labels/attire', { name: 'Attire', group: 'category', color: '#0f0' });
  await seed(env, 'tasks/t_b', task('bride', { labels: ['attire', 'l1'] }));
  await seed(env, 'tasks/t_all', task('everyone', { labels: ['x', 'attire'] }));
  await data('trupti').deleteLabel('attire');
  assert.deepEqual((await raw('tasks/t_b')).labels, ['l1']);
  assert.deepEqual((await raw('tasks/t_all')).labels, ['x']);
  assert.equal(await raw('labels/attire'), null);
});

test('approve as editor uses approver side', async () => {
  await seed(env, 'access_requests/guest', {
    email: 'guest@example.com', name: 'guest', photoURL: null, requestedAt: at,
  });
  await data('trupti').approve('guest', 'editor');
  const m = await raw('members/guest');
  assert.deepEqual(Object.keys(m).sort(), ['approvedAt', 'approvedBy', 'email', 'name', 'photoURL', 'role', 'side']);
  assert.equal(m.role, 'editor');
  assert.equal(m.side, 'bride');
  assert.equal(m.approvedBy, 'trupti');
  assert.equal(m.email, 'guest@example.com');
  assert.equal(await raw('access_requests/guest'), null);
});

test('approve as reader has no side; setRole promotes onto approver side and back', async () => {
  await seed(env, 'access_requests/guest', {
    email: 'guest@example.com', name: 'guest', photoURL: null, requestedAt: at,
  });
  const d = data('sunny');
  await d.approve('guest', 'reader');
  assert.equal((await raw('members/guest')).side, null);
  await d.setRole('guest', 'editor');
  assert.deepEqual([(await raw('members/guest')).role, (await raw('members/guest')).side], ['editor', 'groom']);
  await d.setRole('guest', 'reader');
  assert.deepEqual([(await raw('members/guest')).role, (await raw('members/guest')).side], ['reader', null]);
  await d.removeMember('guest');
  assert.equal(await raw('members/guest'), null);
});

test('a denied watch calls onError with permission-denied', async () => {
  const asPlanner = { role: 'editor', side: 'bride' };
  const err = await new Promise((resolve) => {
    data('kaka').watchTasks(asPlanner, { family: false }, () => resolve(null), resolve);
  });
  assert.equal(err?.code, 'permission-denied');
  await assert.rejects(first((cb, e) => data('kaka').watchVendors(cb, e)), { code: 'permission-denied' });
});

test('approve when the request is gone rejects with request_gone', async () => {
  await assert.rejects(data('trupti').approve('guest', 'editor'), { message: 'request_gone' });
  assert.equal(await raw('members/guest'), null);
});

test('requestAccess twice does not fail; owner sees and declines it', async () => {
  const d = data('guest');
  const req = { email: 'guest@example.com', name: 'guest', photoURL: null };
  await d.requestAccess(req);
  await d.requestAccess(req);
  assert.equal((await raw('access_requests/guest')).email, 'guest@example.com');
  assert.deepEqual(ids(await first((cb, e) => data('trupti').watchRequests(cb, e))), ['guest']);
  await data('trupti').decline('guest');
  assert.equal(await raw('access_requests/guest'), null);
});

test('a requester watches only their own request', async () => {
  const d = data('guest');
  assert.equal(await first((cb, e) => d.watchMyRequest(cb, e)), null);
  await d.requestAccess({ email: 'guest@example.com', name: 'guest', photoURL: null });
  assert.equal((await first((cb, e) => d.watchMyRequest(cb, e))).email, 'guest@example.com');
  assert.equal(await first((cb, e) => data('kaka').watchMyRequest(cb, e)), null);
  await data('trupti').decline('guest');
});

test('owner watches members; a member watches itself', async () => {
  assert.deepEqual(ids(await first((cb, e) => data('trupti').watchMembers(cb, e))), ['aai', 'kaka', 'sunny', 'trupti']);
  const me = await first((cb, e) => data('aai').watchMember(cb, e));
  assert.deepEqual([me.uid, me.role, me.side], ['aai', 'editor', 'bride']);
  assert.equal(await first((cb, e) => data('guest').watchMember(cb, e)), null);
});

test('deleteTask leaves no docs', async () => {
  await seed(env, 'tasks/t_b/private/notes', { text: 'secret' });
  await seed(env, 'tasks/t_b/comments/c1', { text: 'hi', by: 'trupti', at });
  await seed(env, 'tasks/t_b/comments/c2', { text: 'yo', by: 'aai', at });
  await seed(env, 'tasks/t_b/history/h1', { from: 'todo', to: 'progress', by: 'trupti', at });
  await data('aai').deleteTask('t_b');
  assert.equal(await raw('tasks/t_b'), null);
  assert.equal(await raw('tasks/t_b/private/notes'), null);
  assert.deepEqual(await raw('tasks/t_b/comments'), []);
  assert.deepEqual(await raw('tasks/t_b/history'), []);
});

test('add and update a task; notes and comments round trip', async () => {
  const d = data('aai');
  const id = await d.addTask(task('bride', { createdBy: undefined, ownerName: 'Aai' }));
  await d.updateTask(id, { title: 'Book caterer' });
  const t = await raw(`tasks/${id}`);
  assert.deepEqual([t.title, t.createdBy, t.ownerName], ['Book caterer', 'aai', 'Aai']);
  await d.saveNotes(id, 'call at 5');
  assert.equal((await first((cb, e) => d.watchNotes(id, cb, e), (n) => n?.text === 'call at 5')).text, 'call at 5');
  await d.addComment(id, 'done?');
  const [c] = await first((cb, e) => d.watchComments(id, cb, e), (l) => l.length === 1);
  assert.deepEqual([c.text, c.by], ['done?', 'aai']);
  await data('trupti').deleteComment(id, c.id);
  assert.deepEqual(await raw(`tasks/${id}/comments`), []);
});

test('updateEvent off everyone clears label eventId', async () => {
  await data('trupti').updateEvent('ev_all', { visibility: 'planners' });
  assert.equal((await raw('events/ev_all')).visibility, 'planners');
  const l = await raw('labels/l1');
  assert.equal(l.eventId ?? null, null);
  assert.equal(l.group, 'day');
});

test('deleteEvent clears label eventId; addEvent creates', async () => {
  const d = data('trupti');
  const id = await d.addEvent({ title: 'Haldi', date: '2027-01-21', visibility: 'bride' });
  assert.equal((await raw(`events/${id}`)).title, 'Haldi');
  await d.deleteEvent('ev_all');
  assert.equal(await raw('events/ev_all'), null);
  assert.equal((await raw('labels/l1')).eventId ?? null, null);
});

test('labels, vendors, budget and prefs', async () => {
  const d = data('aai');
  const lid = await d.addLabel({ name: 'Food', group: 'category', color: '#00f' });
  await d.updateLabel(lid, { eventId: 'ev_all' });
  assert.deepEqual(ids(await first((cb, e) => d.watchLabels(cb, e), (l) => l.length === 2)), [lid, 'l1'].sort());
  const vid = await d.addVendor({ name: 'Annapurna', status: 'to_find' });
  await d.updateVendor(vid, { status: 'booked' });
  assert.equal((await first((cb, e) => d.watchVendors(cb, e), (l) => l[0]?.status === 'booked'))[0].status, 'booked');
  await d.deleteVendor(vid);
  assert.equal(await raw(`vendors/${vid}`), null);
  await d.setBudget(900000);
  assert.equal((await first((cb, e) => d.watchBudget(cb, e), (b) => b?.total === 900000)).total, 900000);
  await d.setMode('simple');
  assert.equal((await first((cb, e) => d.watchPrefs(cb, e), (p) => p?.mode === 'simple')).mode, 'simple');
});
