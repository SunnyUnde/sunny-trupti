import { test } from 'node:test';
import assert from 'node:assert/strict';

const { formatDate, groupEventsByDate, isWaiting, taskRow, taskRows, filterByLabels, statusWords } =
  await import('../js/planner/view-family.js');

const L = [
  { id: 'd1', name: 'Haldi', group: 'day' },
  { id: 'd2', name: 'Sangeet', group: 'day' },
  { id: 'c1', name: 'Food', group: 'category' },
  { id: 'c2', name: 'Decor', group: 'category' },
];
const byId = new Map(L.map((l) => [l.id, l]));
const T = (o) => ({ id: o.title, title: 'x', due: '2026-12-01', status: 'todo', ownerName: 'Aai', labels: [], ...o });

test('formatDate gives weekday and date', () => {
  assert.equal(formatDate('2027-01-24', 'en'), 'Sunday, 24 January 2027');
  assert.equal(formatDate('2027-01-24', 'en', { weekday: false }), '24 January 2027');
  assert.ok(formatDate('2027-01-24', 'mr').length > 0);
});

test('groupEventsByDate sorts dates, timed first, normalises blanks', () => {
  const g = groupEventsByDate([
    { id: 'a', date: '2027-01-24', title: 'B', time: '' },
    { id: 'b', date: '2027-01-23', title: 'Z', time: '10:00 AM', place: ' Hall ', host: null },
    { id: 'c', date: '2027-01-24', title: 'A', time: '9:00 AM' },
  ]);
  assert.deepEqual(g.map((d) => d.date), ['2027-01-23', '2027-01-24']);
  assert.deepEqual(g[1].events.map((e) => e.id), ['c', 'a']);
  assert.equal(g[1].events[1].time, '');
  assert.equal(g[0].events[0].place, 'Hall');
  assert.equal(g[0].events[0].host, '');
  assert.deepEqual(groupEventsByDate([]), []);
});

test('isWaiting: only missed and not done', () => {
  assert.equal(isWaiting(T({ due: '2026-11-10' }), '2026-11-11'), true);
  assert.equal(isWaiting(T({ due: '2026-11-11' }), '2026-11-11'), false);
  assert.equal(isWaiting(T({ due: '2026-11-10', status: 'done' }), '2026-11-11'), false);
  assert.equal(isWaiting(T({ due: '' }), '2026-11-11'), false);
});

test('taskRow: former member, unknown labels dropped, waiting flag', () => {
  const r = taskRow(T({ ownerName: '  ', labels: ['c1', 'gone'], due: '2026-11-01' }), byId, '2026-11-11');
  assert.equal(r.ownerName, null);
  assert.deepEqual(r.labels.map((l) => l.id), ['c1']);
  assert.equal(r.waiting, true);
  assert.equal(taskRow(T({ ownerName: 'Aai' }), byId, '2026-11-11').ownerName, 'Aai');
});

test('filterByLabels: OR within a group, AND across groups, unknown ids ignored', () => {
  const tasks = [
    T({ title: 'a', labels: ['d1', 'c1'] }),
    T({ title: 'b', labels: ['d2', 'c1'] }),
    T({ title: 'c', labels: ['d1', 'c2'] }),
    T({ title: 'd', labels: [] }),
  ];
  const names = (sel) => filterByLabels(tasks, byId, sel).map((t) => t.title);
  assert.deepEqual(names({ day: [], category: [] }), ['a', 'b', 'c', 'd']);
  assert.deepEqual(names({ day: ['d1', 'd2'], category: [] }), ['a', 'b', 'c']);
  assert.deepEqual(names({ day: ['d1'], category: ['c1'] }), ['a']);
  assert.deepEqual(names({ day: ['gone'], category: [] }), ['a', 'b', 'c', 'd']);
  assert.deepEqual(names({ day: ['c1'], category: [] }), ['a', 'b', 'c', 'd']);
});

test('taskRows sorts by due then title and filters', () => {
  const rows = taskRows(
    [T({ title: 'b', due: '2026-12-02' }), T({ title: 'a', due: '2026-12-02' }), T({ title: 'c', due: '2026-12-01' })],
    L, { day: [], category: [] }, '2026-11-11',
  );
  assert.deepEqual(rows.map((r) => r.title), ['c', 'a', 'b']);
});

test('statusWords', () => {
  assert.deepEqual(statusWords('progress'), ['In progress', 'सुरू आहे']);
  assert.deepEqual(statusWords('weird'), ['To do', 'करायचे आहे']);
});
