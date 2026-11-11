import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { seed, asOwner, asPlannerEditor } from './helpers.mjs';

// Own project id: node --test runs files in parallel.
const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;
let sunny, aai;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-wedding-registry',
    firestore: { rules, host: '127.0.0.1', port: 8080 },
  });
});
after(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  sunny = await asOwner(env, 'sunny', 'groom');
  aai = await asPlannerEditor(env, 'aai', 'bride');
  await seed(env, 'registry/item1', { name: 'Kettle' });
});

test('owner cannot read or write registry', async () => {
  await assertFails(getDoc(doc(sunny, 'registry/item1')));
  await assertFails(setDoc(doc(sunny, 'registry/item2'), { name: 'Toaster' }));
});

test('editor cannot read or write registry', async () => {
  await assertFails(getDoc(doc(aai, 'registry/item1')));
  await assertFails(setDoc(doc(aai, 'registry/item2'), { name: 'Toaster' }));
});
