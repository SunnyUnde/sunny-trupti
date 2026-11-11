// Creates the 20 starter labels in a Firestore project. Labels that already
// exist are left alone, so re-running never undoes a rename or recolour.
//
// Real project (credentials of a project owner bypass security rules):
//   ACCESS_TOKEN=$(gcloud auth print-access-token) node test/rules/seed-labels.mjs <project-id>
// Emulator: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node test/rules/seed-labels.mjs demo-wedding
import { starterLabels } from './starter-labels.mjs';

export async function seedLabels({ project, base, token }) {
  const created = [];
  for (const { id, name, group, color } of starterLabels()) {
    const fields = { name: { stringValue: name }, group: { stringValue: group }, color: { stringValue: color } };
    const res = await fetch(`${base}/v1/projects/${project}/databases/(default)/documents/labels?documentId=${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fields }),
    });
    if (res.ok) created.push(id);
    else if (res.status !== 409) throw new Error(`${id}: ${res.status} ${await res.text()}`);
  }
  return created;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const project = process.argv[2];
  if (!project) throw new Error('usage: node test/rules/seed-labels.mjs <project-id>');
  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  const created = await seedLabels({
    project,
    base: emulator ? `http://${emulator}` : 'https://firestore.googleapis.com',
    token: emulator ? 'owner' : process.env.ACCESS_TOKEN,
  });
  console.log(`created ${created.length} of 20 starter labels in ${project}`);
}
