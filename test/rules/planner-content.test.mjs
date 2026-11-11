import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  doc, collection, query, where, getDoc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { seed, asAnon, asGuest, asOwner, asPlannerEditor, asReader } from './helpers.mjs';

// Own project id: node --test runs files in parallel, and planner-access
// clears demo-wedding before every test.
const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');

let env;
let sunny, trupti, aai, kaka, guest, anon;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-wedding-content',
    firestore: { rules, host: '127.0.0.1', port: 8080 },
  });
});
after(async () => { await env.cleanup(); });

const VIS = { t_all: 'everyone', t_pl: 'planners', t_g: 'groom', t_b: 'bride' };
const EVS = { ev_all: 'everyone', ev_pl: 'planners', ev_g: 'groom', ev_b: 'bride' };
const at = new Date('2026-11-11T00:00:00Z');

const task = (visibility, extra = {}) => ({
  title: 'Book hall',
  due: '2026-12-01',
  owner: 'both',
  ownerName: 'Both',
  status: 'todo',
  labels: [],
  visibility,
  createdBy: 'trupti',
  createdAt: at,
  updatedAt: at,
  ...extra,
});

const event = (visibility, extra = {}) => ({
  date: '2027-01-20',
  time: 'evening',
  title: 'Sangeet',
  place: 'Hall',
  host: 'Bride family',
  note: '',
  visibility,
  ...extra,
});

beforeEach(async () => {
  await env.clearFirestore();
  sunny = await asOwner(env, 'sunny', 'groom');
  trupti = await asOwner(env, 'trupti', 'bride');
  aai = await asPlannerEditor(env, 'aai', 'bride');
  kaka = await asReader(env, 'kaka');
  guest = asGuest(env, 'guest');
  anon = asAnon(env);
  for (const [id, v] of Object.entries(VIS)) {
    await seed(env, `tasks/${id}`, task(v));
    await seed(env, `tasks/${id}/private/notes`, { text: 'secret' });
    await seed(env, `tasks/${id}/comments/c1`, { text: 'hi', by: 'trupti', at });
    await seed(env, `tasks/${id}/history/h1`, { from: 'todo', to: 'progress', by: 'trupti', at });
  }
  for (const [id, v] of Object.entries(EVS)) await seed(env, `events/${id}`, event(v));
  await seed(env, 'labels/l1', { name: 'Day 1', group: 'day', color: '#f00', eventId: 'ev_all' });
  await seed(env, 'vendors/v1', {
    category: 'Catering', name: 'Annapurna', contact: '123', status: 'shortlisted',
    quote: 1000, paid: 0, owner: 'both', ownerName: 'Both', notes: '',
  });
  await seed(env, 'settings/budget', { total: 500000 });
});

const t = (db, id) => doc(db, `tasks/${id}`);
const notes = (db, id) => doc(db, `tasks/${id}/private/notes`);
const comment = (db, id, cid = 'c1') => doc(db, `tasks/${id}/comments/${cid}`);
const hist = (db, id, hid = 'h1') => doc(db, `tasks/${id}/history/${hid}`);
const ev = (db, id) => doc(db, `events/${id}`);
const visQuery = (db, coll, op, value) => query(collection(db, coll), where('visibility', op, value));

// ===== reader kaka =====

test('reader lists tasks constrained to everyone', async () => {
  const snap = await assertSucceeds(getDocs(visQuery(kaka, 'tasks', '==', 'everyone')));
  if (snap.size !== 1) throw new Error(`expected 1 task, got ${snap.size}`);
});

test('reader unconstrained or wider tasks query fails', async () => {
  await assertFails(getDocs(collection(kaka, 'tasks')));
  await assertFails(getDocs(visQuery(kaka, 'tasks', 'in', ['everyone', 'planners'])));
  await assertFails(getDocs(visQuery(kaka, 'tasks', '==', 'planners')));
});

test('reader gets only the everyone task', async () => {
  await assertSucceeds(getDoc(t(kaka, 't_all')));
  for (const id of ['t_pl', 't_g', 't_b']) await assertFails(getDoc(t(kaka, id)));
});

test('reader never reads notes, comments or history, even of an everyone task', async () => {
  await assertFails(getDoc(notes(kaka, 't_all')));
  await assertFails(getDoc(comment(kaka, 't_all')));
  await assertFails(getDocs(collection(kaka, 'tasks/t_all/comments')));
  await assertFails(getDoc(hist(kaka, 't_all')));
  await assertFails(getDocs(collection(kaka, 'tasks/t_all/history')));
});

test('reader never writes tasks or their subcollections', async () => {
  await assertFails(setDoc(t(kaka, 'new'), task('everyone', { createdBy: 'kaka' })));
  await assertFails(updateDoc(t(kaka, 't_all'), { status: 'done' }));
  await assertFails(deleteDoc(t(kaka, 't_all')));
  await assertFails(setDoc(notes(kaka, 't_all'), { text: 'x' }));
  await assertFails(deleteDoc(notes(kaka, 't_all')));
  await assertFails(setDoc(comment(kaka, 't_all', 'c2'), { text: 'x', by: 'kaka', at: serverTimestamp() }));
  await assertFails(deleteDoc(comment(kaka, 't_all')));
  await assertFails(setDoc(hist(kaka, 't_all', 'h2'), { from: 'todo', to: 'done', by: 'kaka', at: serverTimestamp() }));
  await assertFails(deleteDoc(hist(kaka, 't_all')));
});

test('reader sees only everyone events', async () => {
  const snap = await assertSucceeds(getDocs(visQuery(kaka, 'events', '==', 'everyone')));
  if (snap.size !== 1) throw new Error(`expected 1 event, got ${snap.size}`);
  await assertSucceeds(getDoc(ev(kaka, 'ev_all')));
  for (const id of ['ev_pl', 'ev_g', 'ev_b']) await assertFails(getDoc(ev(kaka, id)));
  await assertFails(getDocs(collection(kaka, 'events')));
});

test('reader never writes events', async () => {
  await assertFails(setDoc(ev(kaka, 'new'), event('everyone')));
  await assertFails(updateDoc(ev(kaka, 'ev_all'), { title: 'x' }));
  await assertFails(deleteDoc(ev(kaka, 'ev_all')));
});

test('reader reads labels but cannot write them', async () => {
  await assertSucceeds(getDoc(doc(kaka, 'labels/l1')));
  await assertSucceeds(getDocs(collection(kaka, 'labels')));
  await assertFails(setDoc(doc(kaka, 'labels/l2'), { name: 'x', group: 'category', color: '#000' }));
  await assertFails(updateDoc(doc(kaka, 'labels/l1'), { name: 'x' }));
  await assertFails(deleteDoc(doc(kaka, 'labels/l1')));
});

test('reader cannot read or write vendors or budget', async () => {
  await assertFails(getDoc(doc(kaka, 'vendors/v1')));
  await assertFails(getDocs(collection(kaka, 'vendors')));
  await assertFails(updateDoc(doc(kaka, 'vendors/v1'), { paid: 10 }));
  await assertFails(getDoc(doc(kaka, 'settings/budget')));
  await assertFails(setDoc(doc(kaka, 'settings/budget'), { total: 1 }));
});

// ===== planner reads =====

test('bride editor lists tasks within her set, not beyond it', async () => {
  const snap = await assertSucceeds(getDocs(visQuery(aai, 'tasks', 'in', ['everyone', 'planners', 'bride'])));
  if (snap.size !== 3) throw new Error(`expected 3 tasks, got ${snap.size}`);
  await assertFails(getDocs(visQuery(aai, 'tasks', 'in', ['everyone', 'planners', 'bride', 'groom'])));
  await assertFails(getDocs(visQuery(aai, 'tasks', '==', 'groom')));
  await assertFails(getDocs(collection(aai, 'tasks')));
});

test('bride editor gets her tasks but not the groom task or its subcollections', async () => {
  for (const id of ['t_all', 't_pl', 't_b']) await assertSucceeds(getDoc(t(aai, id)));
  await assertFails(getDoc(t(aai, 't_g')));
  await assertFails(getDoc(notes(aai, 't_g')));
  await assertFails(getDoc(comment(aai, 't_g')));
  await assertFails(getDocs(collection(aai, 'tasks/t_g/comments')));
  await assertFails(getDoc(hist(aai, 't_g')));
  await assertFails(getDocs(collection(aai, 'tasks/t_g/history')));
});

test('bride editor reads notes, comments and history of tasks she can see', async () => {
  for (const id of ['t_all', 't_pl', 't_b']) {
    await assertSucceeds(getDoc(notes(aai, id)));
    await assertSucceeds(getDocs(collection(aai, `tasks/${id}/comments`)));
    await assertSucceeds(getDocs(collection(aai, `tasks/${id}/history`)));
  }
});

test('groom owner sees groom, not bride, tasks and subcollections', async () => {
  await assertSucceeds(getDocs(visQuery(sunny, 'tasks', 'in', ['everyone', 'planners', 'groom'])));
  await assertFails(getDocs(visQuery(sunny, 'tasks', 'in', ['everyone', 'planners', 'bride'])));
  await assertSucceeds(getDoc(t(sunny, 't_g')));
  await assertSucceeds(getDoc(notes(sunny, 't_g')));
  await assertFails(getDoc(t(sunny, 't_b')));
  await assertFails(getDoc(notes(sunny, 't_b')));
  await assertFails(getDocs(collection(sunny, 'tasks/t_b/comments')));
});

test('planners list events within their set only', async () => {
  await assertSucceeds(getDocs(visQuery(aai, 'events', 'in', ['everyone', 'planners', 'bride'])));
  await assertFails(getDocs(visQuery(aai, 'events', 'in', ['everyone', 'planners', 'groom'])));
  await assertFails(getDoc(ev(aai, 'ev_g')));
  await assertSucceeds(getDoc(ev(sunny, 'ev_g')));
  await assertFails(getDoc(ev(sunny, 'ev_b')));
});

// ===== task writes =====

test('bride editor creates tasks with visibility in her set only', async () => {
  for (const v of ['everyone', 'planners', 'bride']) {
    await assertSucceeds(setDoc(t(aai, `n_${v}`), task(v, { createdBy: 'aai' })));
  }
  await assertFails(setDoc(t(aai, 'n_groom'), task('groom', { createdBy: 'aai' })));
});

test('task create requires createdBy to be the caller', async () => {
  await assertFails(setDoc(t(aai, 'n1'), task('bride', { createdBy: 'trupti' })));
  const { createdBy, ...rest } = task('bride');
  await assertFails(setDoc(t(aai, 'n2'), rest));
});

test('task create validates status, visibility, due and labels', async () => {
  const ok = (extra) => task('bride', { createdBy: 'aai', ...extra });
  await assertSucceeds(setDoc(t(aai, 'n0'), ok({ status: 'progress', labels: ['l1'] })));
  await assertFails(setDoc(t(aai, 'n1'), ok({ status: 'blocked' })));
  await assertFails(setDoc(t(aai, 'n2'), ok({ visibility: 'secret' })));
  await assertFails(setDoc(t(aai, 'n3'), ok({ due: new Date() })));
  await assertFails(setDoc(t(aai, 'n4'), ok({ labels: 'l1' })));
});

test('bride editor updates her tasks but cannot move them to groom', async () => {
  await assertSucceeds(updateDoc(t(aai, 't_b'), { status: 'done' }));
  await assertSucceeds(updateDoc(t(aai, 't_b'), { visibility: 'planners' }));
  await assertFails(updateDoc(t(aai, 't_b'), { visibility: 'groom' }));
  await assertFails(updateDoc(t(aai, 't_b'), { status: 'nope' }));
});

test('bride editor cannot update the groom task, even to make it visible to her', async () => {
  await assertFails(updateDoc(t(aai, 't_g'), { visibility: 'bride' }));
  await assertFails(updateDoc(t(aai, 't_g'), { status: 'done' }));
});

test('createdBy is immutable', async () => {
  await assertFails(updateDoc(t(aai, 't_b'), { createdBy: 'aai' }));
  await assertFails(updateDoc(t(trupti, 't_b'), { createdBy: 'aai' }));
});

test('bride editor deletes her tasks but not the groom task', async () => {
  await assertSucceeds(deleteDoc(t(aai, 't_b')));
  await assertSucceeds(deleteDoc(t(aai, 't_all')));
  await assertFails(deleteDoc(t(aai, 't_g')));
});

// ===== event writes =====

test('planners create events with visibility in their set only', async () => {
  await assertSucceeds(setDoc(ev(aai, 'n1'), event('bride')));
  await assertSucceeds(setDoc(ev(aai, 'n2'), event('everyone', { dayLabelId: 'l1' })));
  await assertFails(setDoc(ev(aai, 'n3'), event('groom')));
  await assertFails(setDoc(ev(aai, 'n4'), event('secret')));
  await assertSucceeds(setDoc(ev(sunny, 'n5'), event('groom')));
});

test('planners update and delete only events they can see, and cannot move them out', async () => {
  await assertSucceeds(updateDoc(ev(aai, 'ev_b'), { title: 'Mehendi' }));
  await assertFails(updateDoc(ev(aai, 'ev_b'), { visibility: 'groom' }));
  await assertFails(updateDoc(ev(aai, 'ev_g'), { visibility: 'bride' }));
  await assertFails(deleteDoc(ev(aai, 'ev_g')));
  await assertSucceeds(deleteDoc(ev(aai, 'ev_b')));
});

// ===== notes =====

test('planners write notes of tasks they can see only', async () => {
  await assertSucceeds(setDoc(notes(aai, 't_b'), { text: 'updated' }));
  await assertSucceeds(setDoc(notes(aai, 't_pl'), { text: 'updated' }));
  await assertFails(setDoc(notes(aai, 't_g'), { text: 'x' }));
  await assertFails(setDoc(notes(sunny, 't_b'), { text: 'x' }));
  await assertFails(deleteDoc(notes(sunny, 't_b')));
  await assertSucceeds(deleteDoc(notes(aai, 't_b')));
});

test('notes hold only a text string', async () => {
  await assertFails(setDoc(notes(aai, 't_b'), { text: 1 }));
  await assertFails(setDoc(notes(aai, 't_b'), { text: 'x', visibility: 'everyone' }));
});

test('other private docs are denied', async () => {
  await assertFails(setDoc(doc(aai, 'tasks/t_b/private/other'), { text: 'x' }));
});

// ===== comments =====

test('comment create requires by == caller and a visible task', async () => {
  const c = (by) => ({ text: 'ok', by, at: serverTimestamp() });
  await assertSucceeds(setDoc(comment(aai, 't_b', 'c2'), c('aai')));
  await assertFails(setDoc(comment(aai, 't_b', 'c3'), c('trupti')));
  await assertFails(setDoc(comment(aai, 't_g', 'c4'), c('aai')));
});

test('only the author edits comment text, and only the text', async () => {
  await assertSucceeds(updateDoc(comment(trupti, 't_b'), { text: 'edited' }));
  await assertFails(updateDoc(comment(trupti, 't_b'), { by: 'aai' }));
  await assertFails(updateDoc(comment(trupti, 't_b'), { at: serverTimestamp() }));
  await assertFails(updateDoc(comment(aai, 't_b'), { text: 'hijack' }));
});

test('only the author deletes a comment', async () => {
  await assertFails(deleteDoc(comment(aai, 't_b')));
  await assertSucceeds(deleteDoc(comment(trupti, 't_b')));
});

// ===== history =====

test('history create by planners who can see the task, as themselves, with valid statuses', async () => {
  const h = (extra = {}) => ({ from: 'todo', to: 'done', by: 'aai', at: serverTimestamp(), ...extra });
  await assertSucceeds(setDoc(hist(aai, 't_b', 'h2'), h()));
  await assertFails(setDoc(hist(aai, 't_b', 'h3'), h({ by: 'trupti' })));
  await assertFails(setDoc(hist(aai, 't_b', 'h4'), h({ from: 'started' })));
  await assertFails(setDoc(hist(aai, 't_b', 'h5'), h({ to: 'finished' })));
  await assertFails(setDoc(hist(aai, 't_g', 'h6'), h()));
});

test('history is never updated, even by its author', async () => {
  await assertFails(updateDoc(hist(trupti, 't_b'), { to: 'done' }));
  await assertFails(setDoc(hist(trupti, 't_b'), { from: 'todo', to: 'done', by: 'trupti', at }));
});

test('history delete only by planners who can see the task', async () => {
  await assertFails(deleteDoc(hist(kaka, 't_all')));
  await assertFails(deleteDoc(hist(sunny, 't_b')));
  await assertSucceeds(deleteDoc(hist(aai, 't_b')));
});

test('task delete cascades: subcollections first, then the task', async () => {
  await assertSucceeds(deleteDoc(notes(trupti, 't_b')));
  await assertSucceeds(deleteDoc(comment(trupti, 't_b')));
  await assertSucceeds(deleteDoc(hist(trupti, 't_b')));
  await assertSucceeds(deleteDoc(t(trupti, 't_b')));
});

// ===== labels =====

test('planners write labels; event links must point at an everyone event', async () => {
  const l = (extra = {}) => ({ name: 'Day 2', group: 'day', color: '#0f0', ...extra });
  await assertSucceeds(setDoc(doc(aai, 'labels/a'), l()));
  await assertSucceeds(setDoc(doc(aai, 'labels/b'), l({ group: 'category' })));
  await assertSucceeds(setDoc(doc(aai, 'labels/c'), l({ eventId: 'ev_all' })));
  await assertFails(setDoc(doc(aai, 'labels/d'), l({ eventId: 'ev_pl' })));
  await assertFails(setDoc(doc(aai, 'labels/e'), l({ eventId: 'ev_b' })));
  await assertFails(setDoc(doc(sunny, 'labels/f'), l({ eventId: 'ev_g' })));
  await assertFails(setDoc(doc(aai, 'labels/g'), l({ eventId: 'missing' })));
  await assertFails(setDoc(doc(aai, 'labels/h'), l({ group: 'other' })));
});

test('planners update and delete labels, keeping the event rule', async () => {
  await assertSucceeds(updateDoc(doc(aai, 'labels/l1'), { name: 'Day One' }));
  await assertFails(updateDoc(doc(aai, 'labels/l1'), { eventId: 'ev_b' }));
  await assertSucceeds(deleteDoc(doc(sunny, 'labels/l1')));
});

// ===== vendors and budget =====

test('planners read and write vendors', async () => {
  for (const db of [sunny, aai]) {
    await assertSucceeds(getDoc(doc(db, 'vendors/v1')));
    await assertSucceeds(getDocs(collection(db, 'vendors')));
  }
  await assertSucceeds(updateDoc(doc(aai, 'vendors/v1'), { status: 'booked', paid: 500 }));
  await assertFails(updateDoc(doc(aai, 'vendors/v1'), { status: 'maybe' }));
  await assertSucceeds(deleteDoc(doc(sunny, 'vendors/v1')));
});

test('planners read and write the budget', async () => {
  await assertSucceeds(getDoc(doc(aai, 'settings/budget')));
  await assertSucceeds(setDoc(doc(aai, 'settings/budget'), { total: 600000 }));
  await assertSucceeds(updateDoc(doc(sunny, 'settings/budget'), { total: 700000 }));
  await assertFails(setDoc(doc(aai, 'settings/other'), { total: 1 }));
});

// ===== non-members =====

test('guest and anonymous read and write nothing', async () => {
  for (const db of [guest, anon]) {
    await assertFails(getDoc(t(db, 't_all')));
    await assertFails(getDocs(visQuery(db, 'tasks', '==', 'everyone')));
    await assertFails(getDoc(notes(db, 't_all')));
    await assertFails(getDocs(collection(db, 'tasks/t_all/comments')));
    await assertFails(getDocs(collection(db, 'tasks/t_all/history')));
    await assertFails(getDoc(ev(db, 'ev_all')));
    await assertFails(getDocs(visQuery(db, 'events', '==', 'everyone')));
    await assertFails(getDoc(doc(db, 'labels/l1')));
    await assertFails(getDocs(collection(db, 'labels')));
    await assertFails(getDoc(doc(db, 'vendors/v1')));
    await assertFails(getDoc(doc(db, 'settings/budget')));
    await assertFails(setDoc(t(db, 'n'), task('everyone', { createdBy: 'guest' })));
    await assertFails(deleteDoc(t(db, 't_all')));
    await assertFails(setDoc(ev(db, 'n'), event('everyone')));
    await assertFails(setDoc(doc(db, 'labels/n'), { name: 'x', group: 'day', color: '#000' }));
    await assertFails(setDoc(doc(db, 'vendors/n'), { name: 'x', status: 'to_find' }));
    await assertFails(setDoc(doc(db, 'settings/budget'), { total: 1 }));
  }
});

test('a sideless owner cannot write a null visibility', async () => {
  const solo = await asOwner(env, 'solo', null);
  await assertFails(setDoc(t(solo, 'n1'), task(null, { createdBy: 'solo' })));
  await assertFails(setDoc(ev(solo, 'n2'), event(null)));
  await assertSucceeds(setDoc(t(solo, 'n3'), task('planners', { createdBy: 'solo' })));
});
