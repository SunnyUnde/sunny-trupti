import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import * as firestore from 'firebase/firestore';

const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');

// Same keys as `fs` in js/firebase-init.js.
export const npmFs = {
  doc: firestore.doc,
  collection: firestore.collection,
  collectionGroup: firestore.collectionGroup,
  getDoc: firestore.getDoc,
  getDocs: firestore.getDocs,
  onSnapshot: firestore.onSnapshot,
  query: firestore.query,
  where: firestore.where,
  orderBy: firestore.orderBy,
  runTransaction: firestore.runTransaction,
  writeBatch: firestore.writeBatch,
  serverTimestamp: firestore.serverTimestamp,
  Timestamp: firestore.Timestamp,
  increment: firestore.increment,
  arrayUnion: firestore.arrayUnion,
  arrayRemove: firestore.arrayRemove,
  deleteField: firestore.deleteField,
};

export function setupEnv() {
  return initializeTestEnvironment({
    projectId: 'demo-wedding',
    firestore: { rules, host: '127.0.0.1', port: 8080 },
  });
}

export async function seed(env, path, data) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await firestore.setDoc(firestore.doc(ctx.firestore(), path), data);
  });
}

const googleToken = (uid) => ({
  email: `${uid}@example.com`,
  name: uid,
  firebase: { sign_in_provider: 'google.com' },
});

const authed = (env, uid) => env.authenticatedContext(uid, googleToken(uid)).firestore();

async function seedMember(env, uid, role, side) {
  await seed(env, `members/${uid}`, {
    role,
    side,
    email: `${uid}@example.com`,
    name: uid,
    photoURL: null,
    approvedAt: new Date('2026-11-11T00:00:00Z'),
    approvedBy: 'seed',
  });
}

export const asAnon = (env) => env.unauthenticatedContext().firestore();
export const asGuest = (env, uid) => authed(env, uid);
export async function asOwner(env, uid, side = 'groom') {
  await seedMember(env, uid, 'owner', side);
  return authed(env, uid);
}
export async function asPlannerEditor(env, uid, side = 'groom') {
  await seedMember(env, uid, 'editor', side);
  return authed(env, uid);
}
export async function asReader(env, uid) {
  await seedMember(env, uid, 'reader', null);
  return authed(env, uid);
}
