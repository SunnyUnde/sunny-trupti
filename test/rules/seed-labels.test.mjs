import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedLabels } from './seed-labels.mjs';
import { starterLabels, labelId } from './starter-labels.mjs';

const project = 'demo-wedding-labels';
const base = `http://${process.env.FIRESTORE_EMULATOR_HOST}`;
const docs = `${base}/v1/projects/${project}/databases/(default)/documents`;
const admin = { Authorization: 'Bearer owner' };

test('starter labels: 8 day and 12 category with unique fixed ids', () => {
  const labels = starterLabels();
  assert.equal(labels.filter((l) => l.group === 'day').length, 8);
  assert.equal(labels.filter((l) => l.group === 'category').length, 12);
  assert.equal(new Set(labels.map((l) => l.id)).size, 20);
  assert.equal(labelId('Haldi & Mehendi (23 Jan)'), 'lbl-haldi-mehendi-23-jan');
});

test('seedLabels creates all 20, then re-runs without touching edited labels', async () => {
  await fetch(docs, { method: 'DELETE', headers: admin });
  assert.equal((await seedLabels({ project, base, token: 'owner' })).length, 20);

  const venue = `${docs}/labels/${labelId('Venue')}?updateMask.fieldPaths=name`;
  await fetch(venue, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...admin }, body: JSON.stringify({ fields: { name: { stringValue: 'Karyalay' } } }) });

  assert.deepEqual(await seedLabels({ project, base, token: 'owner' }), []);
  const after = await (await fetch(`${docs}/labels/${labelId('Venue')}`, { headers: admin })).json();
  assert.equal(after.fields.name.stringValue, 'Karyalay');
});
