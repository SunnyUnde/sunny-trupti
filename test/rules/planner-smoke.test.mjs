import { test, before, after } from 'node:test';
import { assertFails } from '@firebase/rules-unit-testing';
import { setupEnv, asGuest, npmFs } from './helpers.mjs';

let env;
before(async () => { env = await setupEnv(); });
after(async () => { await env.cleanup(); });

test('signed-in non-member reads nothing', async () => {
  const db = await asGuest(env, 'guest1');
  await assertFails(npmFs.getDoc(npmFs.doc(db, 'tasks/x')));
});
