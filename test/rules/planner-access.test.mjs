import { test, before, after, beforeEach } from 'node:test';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { setupEnv, seed, asAnon, asGuest, asOwner, asPlannerEditor, asReader } from './helpers.mjs';

let env;
let sunny, trupti, aai, kaka, guest, anon;

before(async () => { env = await setupEnv(); });
after(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  sunny = await asOwner(env, 'sunny', 'groom');
  trupti = await asOwner(env, 'trupti', 'bride');
  aai = await asPlannerEditor(env, 'aai', 'bride');
  kaka = await asReader(env, 'kaka');
  guest = asGuest(env, 'guest');
  anon = asAnon(env);
});

const request = (uid, extra = {}) => ({
  email: `${uid}@example.com`,
  name: uid,
  photoURL: null,
  requestedAt: serverTimestamp(),
  ...extra,
});

const seedRequest = (uid) => seed(env, `access_requests/${uid}`, {
  email: `${uid}@example.com`,
  name: uid,
  photoURL: null,
  requestedAt: new Date('2026-11-11T00:00:00Z'),
});

const approval = (uid, role, side, approver, extra = {}) => ({
  role,
  side,
  email: `${uid}@example.com`,
  name: uid,
  photoURL: null,
  approvedAt: serverTimestamp(),
  approvedBy: approver,
  ...extra,
});

const m = (db, uid) => doc(db, `members/${uid}`);
const r = (db, uid) => doc(db, `access_requests/${uid}`);
const p = (db, uid) => doc(db, `prefs/${uid}`);

// ===== access_requests =====

test('guest creates its own request with its token email and name', async () => {
  await assertSucceeds(setDoc(r(guest, 'guest'), request('guest')));
});

test('guest request without photoURL is allowed', async () => {
  const { photoURL, ...rest } = request('guest');
  await assertSucceeds(setDoc(r(guest, 'guest'), rest));
});

test('guest cannot create a request with another email', async () => {
  await assertFails(setDoc(r(guest, 'guest'), request('guest', { email: 'evil@example.com' })));
});

test('guest cannot create a request with another name', async () => {
  await assertFails(setDoc(r(guest, 'guest'), request('guest', { name: 'Sunny' })));
});

test('guest cannot create a request with extra fields', async () => {
  await assertFails(setDoc(r(guest, 'guest'), request('guest', { role: 'owner' })));
});

test('guest cannot create access_requests/other', async () => {
  await assertFails(setDoc(r(guest, 'other'), request('guest')));
});

test('anonymous cannot create or read requests', async () => {
  await seedRequest('guest');
  await assertFails(setDoc(r(anon, 'anon'), request('anon')));
  await assertFails(getDoc(r(anon, 'guest')));
});

test('guest reads its own request but not others or the list', async () => {
  await seedRequest('guest');
  await seedRequest('other');
  await assertSucceeds(getDoc(r(guest, 'guest')));
  await assertFails(getDoc(r(guest, 'other')));
  await assertFails(getDocs(collection(guest, 'access_requests')));
});

test('guest cannot update its request, but can delete it', async () => {
  await seedRequest('guest');
  await assertFails(updateDoc(r(guest, 'guest'), { name: 'x' }));
  await assertSucceeds(deleteDoc(r(guest, 'guest')));
});

test('guest cannot delete another request', async () => {
  await seedRequest('other');
  await assertFails(deleteDoc(r(guest, 'other')));
});

test('an existing member cannot create a request', async () => {
  await assertFails(setDoc(r(kaka, 'kaka'), request('kaka')));
  await assertFails(setDoc(r(aai, 'aai'), request('aai')));
});

test('owners read and list all requests and may delete any', async () => {
  await seedRequest('guest');
  await assertSucceeds(getDoc(r(sunny, 'guest')));
  await assertSucceeds(getDocs(collection(trupti, 'access_requests')));
  await assertSucceeds(deleteDoc(r(trupti, 'guest')));
});

test('owners cannot create or update requests', async () => {
  await seedRequest('guest');
  await assertFails(setDoc(r(sunny, 'x'), request('sunny')));
  await assertFails(updateDoc(r(sunny, 'guest'), { name: 'x' }));
});

test('editor aai cannot read, create, update or delete access_requests', async () => {
  await seedRequest('guest');
  await assertFails(getDoc(r(aai, 'guest')));
  await assertFails(getDocs(collection(aai, 'access_requests')));
  await assertFails(setDoc(r(aai, 'x'), request('aai')));
  await assertFails(updateDoc(r(aai, 'guest'), { name: 'x' }));
  await assertFails(deleteDoc(r(aai, 'guest')));
});

test('reader kaka cannot read or delete others requests', async () => {
  await seedRequest('guest');
  await assertFails(getDoc(r(kaka, 'guest')));
  await assertFails(getDocs(collection(kaka, 'access_requests')));
  await assertFails(deleteDoc(r(kaka, 'guest')));
});

// ===== no client writes role owner =====

test('sunny cannot create a member with role owner', async () => {
  await seedRequest('x');
  await assertFails(setDoc(m(sunny, 'x'), approval('x', 'owner', 'groom', 'sunny')));
});

test('nobody can update members/sunny or members/trupti', async () => {
  for (const db of [sunny, trupti, aai, kaka, guest]) {
    for (const uid of ['sunny', 'trupti']) {
      await assertFails(updateDoc(m(db, uid), { approvedBy: 'sunny' }));
      await assertFails(updateDoc(m(db, uid), { role: 'reader', side: null }));
    }
  }
});

test('nobody can delete members/sunny or members/trupti', async () => {
  for (const db of [sunny, trupti, aai, kaka, guest]) {
    for (const uid of ['sunny', 'trupti']) {
      await assertFails(deleteDoc(m(db, uid)));
    }
  }
});

test('owners cannot promote a reader or editor to owner', async () => {
  await assertFails(updateDoc(m(sunny, 'kaka'), { role: 'owner', side: 'groom' }));
  await assertFails(updateDoc(m(trupti, 'aai'), { role: 'owner' }));
});

// ===== approval =====

test('sunny approves guest as reader with side null', async () => {
  await seedRequest('guest');
  await assertSucceeds(setDoc(m(sunny, 'guest'), approval('guest', 'reader', null, 'sunny')));
});

test('sunny approves guest as editor on groom side', async () => {
  await seedRequest('guest');
  await assertSucceeds(setDoc(m(sunny, 'guest'), approval('guest', 'editor', 'groom', 'sunny')));
});

test('sunny cannot approve guest as editor on bride side', async () => {
  await seedRequest('guest');
  await assertFails(setDoc(m(sunny, 'guest'), approval('guest', 'editor', 'bride', 'sunny')));
});

test('trupti approves guest as editor on bride side', async () => {
  await seedRequest('guest');
  await assertSucceeds(setDoc(m(trupti, 'guest'), approval('guest', 'editor', 'bride', 'trupti')));
});

test('an owner doc without a side cannot grant a sideless editor', async () => {
  const odd = await asOwner(env, 'odd', null);
  await seedRequest('guest');
  await assertFails(setDoc(m(odd, 'guest'), approval('guest', 'editor', null, 'odd')));
  await assertFails(updateDoc(m(odd, 'kaka'), { role: 'editor', side: null }));
});

test('reader approval with a side is denied', async () => {
  await seedRequest('guest');
  await assertFails(setDoc(m(sunny, 'guest'), approval('guest', 'reader', 'groom', 'sunny')));
});

test('approval without an access request is denied', async () => {
  await assertFails(setDoc(m(sunny, 'guest'), approval('guest', 'reader', null, 'sunny')));
});

test('approval with mismatched email or name is denied', async () => {
  await seedRequest('guest');
  await assertFails(setDoc(m(sunny, 'guest'),
    approval('guest', 'reader', null, 'sunny', { email: 'evil@example.com' })));
  await assertFails(setDoc(m(sunny, 'guest'),
    approval('guest', 'reader', null, 'sunny', { name: 'Evil' })));
});

test('approval with approvedBy not the caller is denied', async () => {
  await seedRequest('guest');
  await assertFails(setDoc(m(sunny, 'guest'), approval('guest', 'reader', null, 'trupti')));
});

test('approval with extra fields, missing fields or bad role is denied', async () => {
  await seedRequest('guest');
  await assertFails(setDoc(m(sunny, 'guest'),
    approval('guest', 'reader', null, 'sunny', { extra: true })));
  const { approvedAt, ...noAt } = approval('guest', 'reader', null, 'sunny');
  await assertFails(setDoc(m(sunny, 'guest'), noAt));
  await assertFails(setDoc(m(sunny, 'guest'), approval('guest', 'admin', null, 'sunny')));
});

test('the requester cannot approve itself', async () => {
  await seedRequest('guest');
  await assertFails(setDoc(m(guest, 'guest'), approval('guest', 'reader', null, 'guest')));
});

test('editor aai and reader kaka cannot create members', async () => {
  await seedRequest('guest');
  await assertFails(setDoc(m(aai, 'guest'), approval('guest', 'reader', null, 'aai')));
  await assertFails(setDoc(m(kaka, 'guest'), approval('guest', 'reader', null, 'kaka')));
});

test('approve then delete the request as two writes', async () => {
  await seedRequest('guest');
  await assertSucceeds(setDoc(m(sunny, 'guest'), approval('guest', 'reader', null, 'sunny')));
  await assertSucceeds(deleteDoc(r(sunny, 'guest')));
  await assertSucceeds(getDoc(m(guest, 'guest')));
});

// ===== role changes and removal =====

test('trupti demotes aai to reader', async () => {
  await assertSucceeds(updateDoc(m(trupti, 'aai'),
    { role: 'reader', side: null, approvedAt: serverTimestamp(), approvedBy: 'trupti' }));
});

test('trupti removes aai', async () => {
  await assertSucceeds(deleteDoc(m(trupti, 'aai')));
});

test('sunny cannot demote, remove or edit aai', async () => {
  await assertFails(updateDoc(m(sunny, 'aai'), { role: 'reader', side: null }));
  await assertFails(deleteDoc(m(sunny, 'aai')));
  await assertFails(updateDoc(m(sunny, 'aai'), { approvedBy: 'sunny' }));
});

test('demoting an editor must clear side', async () => {
  await assertFails(updateDoc(m(trupti, 'aai'), { role: 'reader' }));
});

test('sunny promotes reader kaka to editor on groom side only', async () => {
  await assertFails(updateDoc(m(sunny, 'kaka'), { role: 'editor', side: 'bride' }));
  await assertFails(updateDoc(m(sunny, 'kaka'), { role: 'editor' }));
  await assertSucceeds(updateDoc(m(sunny, 'kaka'), { role: 'editor', side: 'groom' }));
});

test('trupti promotes reader kaka to editor on bride side', async () => {
  await assertSucceeds(updateDoc(m(trupti, 'kaka'),
    { role: 'editor', side: 'bride', approvedAt: serverTimestamp(), approvedBy: 'trupti' }));
});

test('role update with approvedBy not the caller is denied', async () => {
  await assertFails(updateDoc(m(trupti, 'kaka'),
    { role: 'editor', side: 'bride', approvedBy: 'sunny' }));
});

test('either owner can remove reader kaka', async () => {
  await assertSucceeds(deleteDoc(m(sunny, 'kaka')));
  await asReader(env, 'kaka');
  await assertSucceeds(deleteDoc(m(trupti, 'kaka')));
});

test('side is immutable: groom and bride never swap', async () => {
  await asPlannerEditor(env, 'gopal', 'groom');
  await assertFails(updateDoc(m(trupti, 'aai'), { side: 'groom' }));
  await assertFails(updateDoc(m(sunny, 'aai'), { side: 'groom' }));
  await assertFails(updateDoc(m(sunny, 'gopal'), { side: 'bride' }));
  await assertFails(updateDoc(m(trupti, 'gopal'), { side: 'bride' }));
  await assertFails(updateDoc(m(sunny, 'kaka'), { side: 'groom' }));
});

test('email, name and photoURL are immutable', async () => {
  await assertFails(updateDoc(m(trupti, 'aai'), { email: 'x@example.com' }));
  await assertFails(updateDoc(m(trupti, 'aai'), { name: 'x' }));
  await assertFails(updateDoc(m(sunny, 'kaka'), { photoURL: 'https://x' }));
});

test('members cannot edit or delete their own doc', async () => {
  await assertFails(updateDoc(m(aai, 'aai'), { role: 'reader', side: null }));
  await assertFails(deleteDoc(m(aai, 'aai')));
  await assertFails(updateDoc(m(kaka, 'kaka'), { role: 'editor', side: 'groom' }));
  await assertFails(deleteDoc(m(kaka, 'kaka')));
});

test('editor aai cannot create, update or delete any member', async () => {
  await assertFails(setDoc(m(aai, 'x'), approval('x', 'reader', null, 'aai')));
  await assertFails(updateDoc(m(aai, 'kaka'), { role: 'editor', side: 'bride' }));
  await assertFails(deleteDoc(m(aai, 'kaka')));
});

test('reader kaka cannot update or delete other members', async () => {
  await assertFails(updateDoc(m(kaka, 'aai'), { role: 'reader', side: null }));
  await assertFails(deleteDoc(m(kaka, 'aai')));
});

// ===== reads =====

test('kaka reads only members/kaka', async () => {
  await assertSucceeds(getDoc(m(kaka, 'kaka')));
  await assertFails(getDoc(m(kaka, 'aai')));
  await assertFails(getDoc(m(kaka, 'sunny')));
  await assertFails(getDocs(collection(kaka, 'members')));
});

test('editor aai reads only members/aai', async () => {
  await assertSucceeds(getDoc(m(aai, 'aai')));
  await assertFails(getDoc(m(aai, 'kaka')));
  await assertFails(getDocs(collection(aai, 'members')));
});

test('owners read all members', async () => {
  await assertSucceeds(getDocs(collection(sunny, 'members')));
  await assertSucceeds(getDocs(collection(trupti, 'members')));
  await assertSucceeds(getDoc(m(sunny, 'trupti')));
});

test('guest reads its own (missing) member doc and nothing else', async () => {
  const snap = await assertSucceeds(getDoc(m(guest, 'guest')));
  if (snap.exists()) throw new Error('expected missing');
  await assertFails(getDoc(m(guest, 'kaka')));
  await assertFails(getDocs(collection(guest, 'members')));
});

test('anonymous reads no members', async () => {
  await assertFails(getDoc(m(anon, 'kaka')));
  await assertFails(getDocs(collection(anon, 'members')));
});

test('removed member reads members/kaka as missing and nothing else', async () => {
  await seed(env, 'prefs/kaka', { mode: 'simple' });
  await assertSucceeds(deleteDoc(m(sunny, 'kaka')));
  const snap = await assertSucceeds(getDoc(m(kaka, 'kaka')));
  if (snap.exists()) throw new Error('expected missing');
  await assertFails(getDoc(m(kaka, 'aai')));
  await assertFails(getDocs(collection(kaka, 'members')));
  await assertFails(getDoc(p(kaka, 'kaka')));
  await assertFails(getDoc(doc(kaka, 'tasks/t1')));
});

// ===== prefs =====

test('member reads and writes own prefs with mode simple or full', async () => {
  await assertSucceeds(setDoc(p(kaka, 'kaka'), { mode: 'simple' }));
  await assertSucceeds(setDoc(p(kaka, 'kaka'), { mode: 'full' }));
  await assertSucceeds(getDoc(p(kaka, 'kaka')));
  await assertSucceeds(setDoc(p(sunny, 'sunny'), { mode: 'full' }));
  await assertSucceeds(deleteDoc(p(kaka, 'kaka')));
});

test('prefs reject bad mode or extra fields', async () => {
  await assertFails(setDoc(p(kaka, 'kaka'), { mode: 'expert' }));
  await assertFails(setDoc(p(kaka, 'kaka'), { mode: 'simple', role: 'owner' }));
  await assertFails(setDoc(p(kaka, 'kaka'), {}));
});

test('prefs of others are neither readable nor writable, even by owners', async () => {
  await seed(env, 'prefs/kaka', { mode: 'simple' });
  await assertFails(getDoc(p(sunny, 'kaka')));
  await assertFails(setDoc(p(sunny, 'kaka'), { mode: 'full' }));
  await assertFails(deleteDoc(p(aai, 'kaka')));
  await assertFails(getDocs(collection(sunny, 'prefs')));
});

test('non-members cannot read or write prefs, even their own', async () => {
  await seed(env, 'prefs/guest', { mode: 'simple' });
  await assertFails(getDoc(p(guest, 'guest')));
  await assertFails(setDoc(p(guest, 'guest'), { mode: 'full' }));
  await assertFails(getDoc(p(anon, 'guest')));
});

// ===== rest of planner stays denied =====

test('tasks stay denied for everyone in Task 3', async () => {
  await seed(env, 'tasks/t1', { title: 'x' });
  await assertFails(getDoc(doc(sunny, 'tasks/t1')));
  await assertFails(setDoc(doc(sunny, 'tasks/t2'), { title: 'y' }));
});

test('unknown collections stay denied', async () => {
  await assertFails(getDoc(doc(sunny, 'other/x')));
  await assertFails(setDoc(doc(sunny, 'other/x'), { a: 1 }));
});
