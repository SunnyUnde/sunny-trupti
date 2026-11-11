// Seeds the 'demo-wedding' emulators (Firestore :8080, Auth :9099) for manual
// walks. Re-runnable: it clears both first. Run: node test/rules/seed-dev.mjs
// Headless sign-in: email and password 'password' of the users below (uid sunny, trupti, aai, dada, kaka).

import { starterLabels, labelId } from './starter-labels.mjs';

const PROJECT = 'demo-wedding';
const FS = 'http://127.0.0.1:8080';
const AUTH = 'http://127.0.0.1:9099';

await fetch(`${FS}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });

// Writes bypass rules: the emulator treats this bearer token as admin.
const admin = { Authorization: 'Bearer owner' };
const put = async (path, data) => {
  const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, val(v)]));
  const val = (v) =>
    v === null ? { nullValue: null }
    : typeof v === 'string' ? { stringValue: v }
    : typeof v === 'number' ? { integerValue: String(v) }
    : Array.isArray(v) ? { arrayValue: { values: v.map(val) } }
    : v instanceof Date ? { timestampValue: v.toISOString() }
    : { mapValue: { fields: fields(v) } };
  const res = await fetch(`${FS}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', ...admin }, body: JSON.stringify({ fields: fields(data) }),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
};

// Auth emulator users; the Google popup matches on email.
const people = [
  ['sunny', 'owner', 'groom'], ['trupti', 'owner', 'bride'], ['aai', 'editor', 'bride'], ['dada', 'editor', 'groom'], ['kaka', 'reader', null],
];
for (const [uid, role, side] of people) {
  await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...admin },
    body: JSON.stringify({ localId: uid, email: `${uid}@example.com`, password: 'password', displayName: uid }),
  });
  await put(`members/${uid}`, {
    role, side, email: `${uid}@example.com`, name: uid, photoURL: null,
    approvedAt: new Date('2026-11-11T00:00:00Z'), approvedBy: 'seed',
  });
}

for (const { id, name, group, color } of starterLabels()) await put(`labels/${id}`, { name, group, color });

const L = (...names) => names.map(labelId);
const tasks = [
  ['t1', 'Book the photographer', '2026-11-05', 'sunny', 'Sunny', 'todo', L('Photo/Video'), 'everyone'], // overdue
  ['t2', 'Order the invitations', '2026-11-20', 'trupti', 'Trupti', 'progress', L('Invitations', 'Wedding day (24 Jan)', 'Sangeet (23 Jan)'), 'everyone'],
  ['t3', 'Confirm the caterer menu', '2026-12-10', 'aai', 'Aai', 'done', L('Food', 'Kelvan'), 'everyone'],
  ['t4', 'Shortlist jewellers', '2026-12-01', 'sunny', 'Sunny', 'todo', L('Jewellery'), 'planners'],
  ['t5', 'Groom family outfits', '2026-12-15', 'sunny', 'Sunny', 'todo', L('Attire'), 'groom'],
  ['t6', 'Bride family gift list', '2026-12-18', 'trupti', 'Trupti', 'progress', L('Guests'), 'bride'],
];
for (const [id, title, due, owner, ownerName, status, labels, visibility] of tasks) {
  await put(`tasks/${id}`, {
    title, due, owner, ownerName, status, labels, visibility, createdBy: 'seed',
    createdAt: new Date('2026-11-11T00:00:00Z'), updatedAt: new Date('2026-11-11T00:00:00Z'),
  });
}

const events = [
  ['e1', '2027-01-23', '10:00 AM', 'Haldi', 'Laxmi Trimbak Mangal Karyalay', 'Bride family', 'everyone'],
  ['e2', '2027-01-23', '7:00 PM', 'Sangeet', 'Laxmi Trimbak Mangal Karyalay', 'Both families', 'everyone'],
  ['e3', '2027-01-24', '', 'Muhurt', 'Laxmi Trimbak Mangal Karyalay', '', 'everyone'],
  ['e4', '2027-01-22', '5:00 PM', 'Planners dinner', 'Home', 'Sunny', 'planners'],
];
for (const [id, date, time, title, place, host, visibility] of events) {
  await put(`events/${id}`, { date, time, title, place, host, note: '', visibility });
}
// A day label linked to an 'everyone' event.
await put(`labels/${labelId('Sangeet (23 Jan)')}`, { name: 'Sangeet (23 Jan)', group: 'day', color: 'gold', eventId: 'e2' });
await put('settings/budget', { total: 2500000 });
const vendors = [
  ['v1', 'Venue', 'Laxmi Trimbak Mangal Karyalay', '98220 00001', 'booked', 400000, 100000, 'both'],
  ['v2', 'Photo/Video', 'Frame Story', '98220 00002', 'shortlisted', 180000, 0, 'sunny'],
  ['v3', 'Food', 'Shree Caterers', '98220 00003', 'to_find', 0, 0, 'bride_family'],
];
const ownerNames = { both: 'Both families', sunny: 'Sunny', bride_family: "Bride's family" };
for (const [id, category, name, contact, status, quote, paid, owner] of vendors) {
  await put(`vendors/${id}`, { category, name, contact, status, quote, paid, owner, ownerName: ownerNames[owner], notes: '' });
}
// Pending requests, as Google users would write them.
for (const [uid, name] of [['mama', 'Mama'], ['mavshi', 'Mavshi']]) {
  await put(`access_requests/${uid}`, { email: `${uid}@example.com`, name, photoURL: null, requestedAt: new Date('2026-11-11T08:30:00Z') });
}
console.log('seeded: members sunny trupti aai dada kaka, 20 labels, 6 tasks, 4 events, 3 vendors, 2 requests (mama, mavshi)');
