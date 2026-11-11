import { test } from 'node:test';
import assert from 'node:assert/strict';

const full = await import('../js/planner/view-planner-full.js');
const editor = await import('../js/planner/task-editor.js');
const detail = await import('../js/planner/task-detail.js');

const T = (o) => ({ id: o.title, title: 'x', due: '2026-12-01', status: 'todo', owner: 'sunny', ownerName: 'Sunny', labels: [], visibility: 'everyone', ...o });
const L = [
  { id: 'd1', name: 'Haldi', group: 'day' },
  { id: 'c1', name: 'Food', group: 'category' },
];

test('groupByWindow buckets by deadline window, sorted, skipping empty windows', () => {
  const g = full.groupByWindow([
    T({ title: 'b', due: '2026-11-22' }),
    T({ title: 'a', due: '2026-11-01' }),
    T({ title: 'late', due: '2027-02-01' }),
    T({ title: 'nodue', due: '' }),
    T({ title: 'wk', due: '2027-01-24' }),
  ]);
  assert.deepEqual(g.map((x) => x.key), ['w1', 'w5', 'w6']);
  assert.deepEqual(g[0].tasks.map((t) => t.title), ['a', 'b']);
  assert.deepEqual(g[2].tasks.map((t) => t.title), ['late', 'nodue']);
  assert.equal(full.WINDOWS.w1[0], 'By 22 Nov');
});

test('homeSummary counts progress, vendors, overdue and next due', () => {
  const s = full.homeSummary(
    [
      T({ title: 'o2', due: '2026-11-05' }),
      T({ title: 'o1', due: '2026-11-01', status: 'progress' }),
      T({ title: 'doneold', due: '2026-10-01', status: 'done' }),
      T({ title: 'n2', due: '2026-11-20' }),
      T({ title: 'n1', due: '2026-11-11' }),
      T({ title: 'nodue', due: '' }),
    ],
    [{ status: 'booked' }, { status: 'paid' }, { status: 'to_find' }],
    '2026-11-11',
  );
  assert.deepEqual([s.done, s.total, s.booked, s.vendorTotal], [1, 6, 2, 3]);
  assert.deepEqual(s.overdue.map((t) => t.title), ['o1', 'o2']);
  assert.equal(s.nextDue.title, 'n1');
});

test('homeSummary has no next due when nothing is upcoming', () => {
  assert.equal(full.homeSummary([], [], '2026-11-11').nextDue, null);
});

test('budgetSummary adds paid and reports total', () => {
  assert.deepEqual(full.budgetSummary([{ paid: 100 }, { paid: 50 }, {}], { total: 1000 }), { paid: 150, total: 1000 });
  assert.deepEqual(full.budgetSummary([], null), { paid: 0, total: null });
});

test('nextEvent is the earliest event today or later, timed first', () => {
  const e = full.nextEvent(
    [
      { id: 'a', date: '2026-11-01', title: 'past' },
      { id: 'b', date: '2027-01-23', title: 'Sangeet', time: '7:00 PM' },
      { id: 'c', date: '2027-01-23', title: 'Haldi', time: '10:00 AM' },
    ],
    '2026-11-11',
  );
  assert.equal(e.title, 'Haldi');
  assert.equal(e.date, '2027-01-23');
  assert.equal(full.nextEvent([], '2026-11-11'), null);
});

test('ownerChips lists each distinct owner once with its name', () => {
  const chips = full.ownerChips([T({ owner: 'sunny' }), T({ owner: 'both', ownerName: 'Both families' }), T({ owner: 'sunny' })]);
  assert.deepEqual(chips, [{ value: 'sunny', name: 'Sunny' }, { value: 'both', name: 'Both families' }]);
});

test('filterTasks combines status, owner, visibility and label groups; filterCount counts them', () => {
  const tasks = [
    T({ title: 'a', status: 'todo', labels: ['d1', 'c1'], visibility: 'planners' }),
    T({ title: 'b', status: 'done', labels: ['d1'] }),
    T({ title: 'c', status: 'todo', owner: 'both', labels: ['c1'] }),
  ];
  const none = { statuses: [], owners: [], visibilities: [], day: [], category: [] };
  assert.equal(full.filterTasks(tasks, none, L).length, 3);
  assert.deepEqual(full.filterTasks(tasks, { ...none, statuses: ['todo'] }, L).map((t) => t.title), ['a', 'c']);
  assert.deepEqual(full.filterTasks(tasks, { ...none, statuses: ['todo'], day: ['d1'] }, L).map((t) => t.title), ['a']);
  assert.deepEqual(full.filterTasks(tasks, { ...none, visibilities: ['planners'] }, L).map((t) => t.title), ['a']);
  assert.deepEqual(full.filterTasks(tasks, { ...none, owners: ['both'] }, L).map((t) => t.title), ['c']);
  assert.equal(full.filterCount({ ...none, statuses: ['todo'], day: ['d1', 'gone'] }, L), 2);
});

test('statusMessage gives one plain sentence per status', () => {
  assert.deepEqual(full.statusMessage('progress'), ['Moved to In progress.', 'सुरू आहे मध्ये हलवले.']);
  assert.equal(full.statusMessage('done')[0], 'Marked as done.');
  assert.equal(full.statusMessage('todo')[0], 'Moved back to To do.');
});

const groomOwner = { uid: 'sunny', role: 'owner', side: 'groom', name: 'Sunny' };
const brideEditor = { uid: 'aai', role: 'editor', side: 'bride', name: 'Aai' };

test('visibilityChoices are limited to the caller visible set', () => {
  assert.deepEqual(editor.visibilityChoices(groomOwner).map((v) => v.value), ['everyone', 'planners', 'groom']);
  assert.deepEqual(editor.visibilityChoices(brideEditor).map((v) => v.value), ['everyone', 'planners', 'bride']);
});

test('ownerChoices: self, three family options, other members, and the current owner', () => {
  const base = editor.ownerChoices(brideEditor, [], null).map((c) => c.value);
  assert.deepEqual(base, ['aai', 'groom_family', 'bride_family', 'both']);
  const members = [{ uid: 'sunny', role: 'owner', name: 'Sunny' }, { uid: 'kaka', role: 'reader', name: 'Kaka' }, { uid: 'aai', role: 'editor', name: 'Aai' }];
  const withMembers = editor.ownerChoices(groomOwner, members, null);
  assert.deepEqual(withMembers.map((c) => c.value), ['sunny', 'groom_family', 'bride_family', 'both', 'aai']);
  const keep = editor.ownerChoices(brideEditor, [], { owner: 'zed', ownerName: 'Zed' });
  assert.deepEqual(keep.at(-1), { value: 'zed', name: 'Zed', en: 'Zed', mr: 'Zed' });
});

test('draftError wants a title; buildTask trims, copies ownerName, drops unknown labels', () => {
  assert.equal(editor.draftError({ title: '   ' }), 'title');
  assert.equal(editor.draftError({ title: 'Book' }), null);
  const choices = editor.ownerChoices(groomOwner, [], null);
  const data = editor.buildTask(
    { title: '  Book hall ', due: '2026-12-01', owner: 'groom_family', status: 'progress', labels: ['d1', 'gone'], visibility: 'groom' },
    choices,
    L,
  );
  assert.deepEqual(data, {
    title: 'Book hall', due: '2026-12-01', owner: 'groom_family', ownerName: "Groom's family",
    status: 'progress', labels: ['d1'], visibility: 'groom',
  });
});

test('draftFromTask fills a blank draft or copies a task', () => {
  assert.deepEqual(editor.draftFromTask(null, groomOwner), {
    title: '', due: '', owner: 'sunny', status: 'todo', labels: [], visibility: 'everyone', notes: '',
  });
  const d = editor.draftFromTask(T({ title: 'A', labels: ['d1'], visibility: 'groom', owner: 'both' }), groomOwner);
  assert.deepEqual([d.title, d.owner, d.labels, d.visibility], ['A', 'both', ['d1'], 'groom']);
});

test('safePhoto only passes http(s) urls', () => {
  assert.equal(detail.safePhoto('https://x.test/a.png'), 'https://x.test/a.png');
  assert.equal(detail.safePhoto('javascript:alert(1)'), null);
  assert.equal(detail.safePhoto(null), null);
});

test('personName prefers self, then member names, then a plain fallback', () => {
  const byId = new Map([['kaka', { name: 'Kaka' }]]);
  assert.equal(detail.personName('aai', brideEditor, byId), 'Aai');
  assert.equal(detail.personName('kaka', brideEditor, byId), 'Kaka');
  assert.equal(detail.personName('zed', brideEditor, byId), null);
});

test('formatStamp is IST, per language; null means just now', () => {
  const d = new Date('2026-11-12T10:10:00Z');
  assert.equal(detail.formatStamp(d, 'en'), '12 Nov, 3:40 pm');
  assert.ok(detail.formatStamp(d, 'mr').length > 0);
  assert.equal(detail.formatStamp(null, 'en'), 'just now');
  assert.equal(detail.formatStamp(null, 'mr'), 'आत्ताच');
});

test('an edit draft carries no status, so buildTask omits it', () => {
  const d = editor.draftFromTask(T({ title: 'A', status: 'done' }), groomOwner);
  assert.equal('status' in d, false);
  const choices = editor.ownerChoices(groomOwner, [], null);
  assert.equal('status' in editor.buildTask(d, choices, L), false);
});

const fakeData = (failNotes = 0) => {
  const calls = [];
  let left = failNotes;
  return {
    calls,
    addTask: async (f) => { calls.push(['add', f]); return 'new1'; },
    updateTask: async (id, p) => { calls.push(['update', id, p]); },
    saveNotes: async (id, t) => { calls.push(['notes', id, t]); if (left-- > 0) throw new Error('x'); },
  };
};

test('persistTask updates an existing task without status, then saves notes', async () => {
  const d = fakeData();
  await editor.persistTask(d, { id: 't1' }, { title: 'A', status: 'done' }, 'n', {});
  assert.deepEqual(d.calls, [['update', 't1', { title: 'A' }], ['notes', 't1', 'n']]);
});

test('persistTask retry after a failed notes save never adds a second task', async () => {
  const d = fakeData(1);
  const state = {};
  await assert.rejects(editor.persistTask(d, null, { title: 'A', status: 'todo' }, 'n', state));
  await editor.persistTask(d, null, { title: 'A', status: 'todo' }, 'n', state);
  assert.equal(d.calls.filter((c) => c[0] === 'add').length, 1);
  assert.deepEqual(d.calls.at(-2), ['update', 'new1', { title: 'A' }]);
  assert.deepEqual(d.calls.at(-1), ['notes', 'new1', 'n']);
});

test('persistTask skips notes for a new task with none', async () => {
  const d = fakeData();
  await editor.persistTask(d, null, { title: 'A' }, '  ', {});
  assert.deepEqual(d.calls.map((c) => c[0]), ['add']);
});
