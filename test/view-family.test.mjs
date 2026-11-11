import { test } from 'node:test';
import assert from 'node:assert/strict';

const { tabFailed, activeFilterCount, timeMinutes, usedLabels, formatDate, groupEventsByDate, isWaiting, taskRow, taskRows, filterByLabels, statusWords } =
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

test('timeMinutes parses 12 hour and 24 hour, rest is last', () => {
  assert.equal(timeMinutes('9:00 AM'), 540);
  assert.equal(timeMinutes('12:00 PM'), 720);
  assert.equal(timeMinutes('12:30 AM'), 30);
  assert.equal(timeMinutes('1:00 PM'), 780);
  assert.equal(timeMinutes('14:30'), 870);
  assert.equal(timeMinutes('to confirm'), Infinity);
  assert.equal(timeMinutes(''), Infinity);
});

test('events sort by clock time, not text', () => {
  const ev = (id, time) => ({ id, date: '2027-01-24', title: id, time });
  const ids = (list) => groupEventsByDate(list)[0].events.map((e) => e.id);
  assert.deepEqual(ids([ev('b', '10:00 AM'), ev('a', '9:00 AM')]), ['a', 'b']);
  assert.deepEqual(ids([ev('b', '1:00 PM'), ev('a', '12:00 PM')]), ['a', 'b']);
  assert.deepEqual(ids([ev('c', ''), ev('b', 'to confirm'), ev('a', '8:00 AM')]), ['a', 'b', 'c']);
});

test('usedLabels keeps only labels a task carries', () => {
  const tasks = [T({ labels: ['d1', 'gone'] }), T({ labels: ['c2'] })];
  assert.deepEqual(usedLabels(tasks, L).map((l) => l.id), ['d1', 'c2']);
  assert.deepEqual(usedLabels([], L), []);
});

test('tabFailed: each tab only reacts to its own watchers', () => {
  assert.equal(tabFailed('progress', { tasks: true }), true);
  assert.equal(tabFailed('progress', { labels: true }), true);
  assert.equal(tabFailed('progress', { events: true }), false);
  assert.equal(tabFailed('schedule', { events: true }), true);
  assert.equal(tabFailed('schedule', { tasks: true, labels: true }), false);
  assert.equal(tabFailed('venue', { tasks: true, events: true, labels: true }), false);
  assert.equal(tabFailed('progress', { tasks: false }), false);
});

test('activeFilterCount counts only chips that exist', () => {
  assert.equal(activeFilterCount({ day: ['d1'], category: ['c1', 'gone'] }, L), 2);
  assert.equal(activeFilterCount({ day: [], category: [] }, L), 0);
});
