import { test } from 'node:test';
import assert from 'node:assert/strict';

const ev = await import('../js/planner/view-events.js');
const fam = await import('../js/planner/view-family.js');
const vend = await import('../js/planner/view-vendors.js');
const acc = await import('../js/planner/view-access.js');

// ===== EVENTS =====
const LAB = [
  { id: 'd1', group: 'day', name: 'Haldi', eventId: 'e1' },
  { id: 'd2', group: 'day', name: 'Sangeet' },
  { id: 'd3', group: 'day', name: 'Wedding', eventId: 'e9' },
  { id: 'c1', group: 'category', name: 'Food' },
];

test('day label helpers see only day labels and ignore unknown ids', () => {
  assert.equal(fam.dayLabelOf(LAB, 'e1').id, 'd1');
  assert.equal(fam.dayLabelOf(LAB, 'nope'), null);
  assert.deepEqual(ev.linkableLabels(LAB, 'e1').map((l) => l.id), ['d1', 'd2']);
  assert.deepEqual(ev.linkableLabels(LAB, null).map((l) => l.id), ['d2']);
});

test('tasksForEvent lists the visible tasks that carry the linked label', () => {
  const tasks = [{ id: 'a', labels: ['d1'] }, { id: 'b', labels: ['c1'] }, { id: 'c' }];
  assert.deepEqual(fam.tasksForEvent(tasks, LAB, 'e1').map((t) => t.id), ['a']);
  assert.deepEqual(fam.tasksForEvent(tasks, LAB, 'e2'), []);
});

test('linkOps unlinks the old label and links the new one, only for everyone events', () => {
  const base = { eventId: 'e1', visibility: 'everyone', labels: LAB };
  assert.deepEqual(ev.linkOps({ ...base, chosen: 'd2' }), [['d1', null], ['d2', 'e1']]);
  assert.deepEqual(ev.linkOps({ ...base, chosen: 'd1' }), []);
  assert.deepEqual(ev.linkOps({ ...base, chosen: '' }), [['d1', null]]);
  assert.deepEqual(ev.linkOps({ ...base, chosen: 'd3' }), [['d1', null]], 'taken by another event');
  assert.deepEqual(ev.linkOps({ ...base, chosen: 'gone' }), [['d1', null]], 'unknown id');
  assert.deepEqual(ev.linkOps({ ...base, visibility: 'planners', chosen: 'd2' }), [], 'data layer unlinks');
  assert.deepEqual(ev.linkOps({ eventId: 'e2', visibility: 'everyone', labels: LAB, chosen: 'd2' }), [['d2', 'e2']]);
});

test('event draft, build and validation', () => {
  const d = ev.eventDraft({ id: 'e1', date: '2027-01-23', time: '', title: ' Haldi ', place: 'Hall', host: '', note: 'n', visibility: 'planners' }, LAB);
  assert.equal(d.labelId, 'd1');
  assert.deepEqual(ev.buildEvent(d), { date: '2027-01-23', time: '', title: 'Haldi', place: 'Hall', host: '', note: 'n', visibility: 'planners' });
  assert.equal(ev.eventDraft(null, LAB).visibility, 'everyone');
  assert.equal(ev.eventError({ ...d, title: ' ' }), 'title');
  assert.equal(ev.eventError({ ...d, date: '' }), 'date');
  assert.equal(ev.eventError(d), null);
});

test('persistEvent creates once, then links labels with the new id', async () => {
  const calls = [];
  const data = {
    addEvent: async (f) => { calls.push(['add', f.title]); return 'new1'; },
    updateEvent: async (id) => { calls.push(['upd', id]); },
    setLabelEvent: async (id, eventId) => { calls.push(['lab', id, eventId]); },
  };
  const draft = { ...ev.eventDraft(null, LAB), title: 'Dinner', date: '2027-01-22', labelId: 'd2' };
  const state = {};
  await ev.persistEvent(data, null, draft, LAB, state);
  await ev.persistEvent(data, null, draft, LAB, state);
  assert.deepEqual(calls.filter((c) => c[0] !== 'lab'), [['add', 'Dinner'], ['upd', 'new1']]);
  assert.deepEqual(calls.filter((c) => c[0] === 'lab')[0], ['lab', 'd2', 'new1']);
});

// ===== VENDORS =====
test('amounts parse as whole non-negative rupees', () => {
  assert.equal(vend.parseAmount('4,20,000'), 420000);
  assert.equal(vend.parseAmount(' 500 '), 500);
  assert.equal(vend.parseAmount(''), null);
  assert.equal(vend.parseAmount('12.5'), null);
  assert.equal(vend.parseAmount('-3'), null);
  assert.equal(vend.amountOrZero(''), 0);
  assert.equal(vend.amountOrZero('x'), null);
});

test('vendor draft, build and validation', () => {
  const d = vend.vendorDraft({ category: 'Food', name: ' Caterer ', contact: '99', status: 'booked', quote: 1000, paid: 250, owner: 'both', notes: '' });
  assert.equal(d.quote, '1000');
  const choices = [{ value: 'both', name: 'Both families' }];
  assert.deepEqual(vend.buildVendor({ ...d, quote: '2,000', paid: '' }, choices), {
    category: 'Food', name: 'Caterer', contact: '99', status: 'booked', quote: 2000, paid: 0, owner: 'both',
    ownerName: 'Both families', notes: '',
  });
  assert.equal(vend.vendorDraft(null).status, 'to_find');
  assert.equal(vend.vendorError({ ...d, name: ' ' }), 'name');
  assert.equal(vend.vendorError({ ...d, quote: 'x' }), 'quote');
  assert.equal(vend.vendorError({ ...d, paid: '1.5' }), 'paid');
  assert.equal(vend.vendorError(d), null);
});

test('budgetFigures: total, quoted, paid, left; unset total has no left', () => {
  const vs = [{ quote: 1000, paid: 400 }, { quote: 500 }, { paid: 100 }];
  assert.deepEqual(vend.budgetFigures(vs, { total: 5000 }), { total: 5000, quoted: 1500, paid: 500, left: 4500 });
  assert.deepEqual(vend.budgetFigures(vs, null), { total: null, quoted: 1500, paid: 500, left: null });
  assert.equal(vend.budgetFigures([], { total: 100 }).left, 100);
});

test('vendorOwnerLabel uses the copied name, else the bilingual fallback', () => {
  assert.deepEqual(vend.vendorOwnerLabel({ ownerName: 'Aai' }), { en: 'Aai', mr: 'Aai' });
  assert.deepEqual(vend.vendorOwnerLabel({}), { en: 'A planner', mr: 'एक नियोजक' });
});

test('vendorSide: family buckets direct, a planner maps to their side, else shared', () => {
  const members = [{ uid: 'g1', side: 'groom' }, { uid: 'b1', side: 'bride' }];
  assert.equal(vend.vendorSide({ owner: 'groom_family' }, members), 'groom');
  assert.equal(vend.vendorSide({ owner: 'bride_family' }, members), 'bride');
  assert.equal(vend.vendorSide({ owner: 'both' }, members), 'both');
  assert.equal(vend.vendorSide({ owner: 'g1' }, members), 'groom');
  assert.equal(vend.vendorSide({ owner: 'b1' }, members), 'bride');
  assert.equal(vend.vendorSide({ owner: 'unknown' }, members), 'both');
  assert.equal(vend.vendorSide({ owner: 'g1' }, []), 'both');
});

test('sideSpending sums paid into groom / bride / both', () => {
  const members = [{ uid: 'g1', side: 'groom' }];
  const vs = [
    { owner: 'groom_family', paid: 1000 },
    { owner: 'g1', paid: 500 },
    { owner: 'bride_family', paid: 2000 },
    { owner: 'both', paid: 300 },
    { owner: 'both' },
  ];
  assert.deepEqual(vend.sideSpending(vs, members), { groom: 1500, bride: 2000, both: 300 });
  assert.deepEqual(vend.sideSpending([], members), { groom: 0, bride: 0, both: 0 });
});

test('ownerChoices fallback carries en and mr', async () => {
  const { ownerChoices } = await import('../js/planner/task-editor.js');
  const c = ownerChoices({ uid: 'u1', name: 'S' }, [], { owner: 'u9', ownerName: '', en: 'A planner', mr: 'एक नियोजक' });
  assert.deepEqual(c.at(-1), { value: 'u9', name: '', en: 'A planner', mr: 'एक नियोजक' });
});

// ===== ACCESS =====
// Mirrors firestore.rules members: validChange (promote / demote) and removable.
const sunny = { role: 'owner', side: 'groom' };
const trupti = { role: 'owner', side: 'bride' };

test('allowedActions follows the members rules', () => {
  assert.deepEqual(acc.allowedActions(sunny, { role: 'reader', side: null }), ['promote', 'remove']);
  assert.deepEqual(acc.allowedActions(trupti, { role: 'reader', side: null }), ['promote', 'remove']);
  assert.deepEqual(acc.allowedActions(sunny, { role: 'editor', side: 'groom' }), ['demote', 'remove']);
  assert.deepEqual(acc.allowedActions(sunny, { role: 'editor', side: 'bride' }), []);
  assert.deepEqual(acc.allowedActions(trupti, { role: 'editor', side: 'groom' }), []);
  assert.deepEqual(acc.allowedActions(trupti, { role: 'editor', side: 'bride' }), ['demote', 'remove']);
  assert.deepEqual(acc.allowedActions(sunny, { role: 'owner', side: 'bride' }), []);
  assert.deepEqual(acc.allowedActions(sunny, { role: 'owner', side: 'groom' }), []);
});

test('side words and approve-as-editor hint come from the owner side', () => {
  assert.equal(acc.joinsSide('groom').en, 'Joins the groom side');
  assert.equal(acc.joinsSide('bride').en, 'Joins the bride side');
  assert.match(acc.joinsSide('bride').mr, /वधू/);
});

test('sortMembers puts owners, then editors, then readers, by name', () => {
  const out = acc.sortMembers([
    { id: 'r', role: 'reader', name: 'Kaka' }, { id: 'e', role: 'editor', name: 'Aai' },
    { id: 'o2', role: 'owner', name: 'Trupti' }, { id: 'o1', role: 'owner', name: 'Sunny' },
  ]);
  assert.deepEqual(out.map((m) => m.id), ['o1', 'o2', 'e', 'r']);
});

test('requestedWhen formats a Firestore timestamp in IST, both languages', () => {
  const ts = { toDate: () => new Date('2026-11-11T10:00:00Z') };
  assert.match(acc.requestedWhen(ts).en, /11 Nov/);
  assert.ok(acc.requestedWhen(ts).mr.length > 0);
  assert.equal(acc.requestedWhen(null), null);
});
