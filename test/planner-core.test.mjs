import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = await import('../js/planner/planner-core.js');
const {
  todayIST, visibleSet, familySet, canSee, nextStatus, thisWeek, deadlineWindow,
  applyFilters, progress, formatRupees, isInAppBrowser, daysTo,
} = core;

const T = (o) => ({ id: o.id, title: o.id, due: '2026-11-16', owner: 'both', status: 'todo', labels: [], visibility: 'everyone', ...o });

test('todayIST', () => {
  assert.equal(todayIST(new Date('2026-11-11T19:00:00Z')), '2026-11-12');
  assert.equal(todayIST(new Date('2026-11-11T18:00:00Z')), '2026-11-11');
});

test('visibleSet, familySet, canSee', () => {
  assert.deepEqual(visibleSet({ role: 'editor', side: 'bride' }), ['everyone', 'planners', 'bride']);
  assert.deepEqual(visibleSet({ role: 'owner', side: 'groom' }), ['everyone', 'planners', 'groom']);
  assert.deepEqual(visibleSet({ role: 'reader', side: 'bride' }), ['everyone']);
  assert.deepEqual(familySet(), ['everyone']);
  assert.equal(canSee({ visibility: 'bride' }, { role: 'editor', side: 'bride' }), true);
  assert.equal(canSee({ visibility: 'groom' }, { role: 'editor', side: 'bride' }), false);
  assert.equal(canSee({ visibility: 'planners' }, { role: 'reader', side: null }), false);
});

test('nextStatus', () => {
  assert.equal(nextStatus('todo'), 'progress');
  assert.equal(nextStatus('progress'), 'done');
  assert.equal(nextStatus('done'), 'done');
});

test('thisWeek boundaries', () => {
  const member = { uid: 'u1', side: 'bride' };
  const tasks = [
    T({ id: 'in-edge', due: '2026-11-22' }),
    T({ id: 'out-edge', due: '2026-11-23' }),
    T({ id: 'older', due: '2026-11-10' }),
    T({ id: 'older-done', due: '2026-11-10', status: 'done' }),
    T({ id: 'done', due: '2026-11-16', status: 'done' }),
    T({ id: 'groom', due: '2026-11-16', owner: 'groom_family' }),
    T({ id: 'bride', due: '2026-11-17', owner: 'bride_family' }),
    T({ id: 'mine', due: '2026-11-18', owner: 'u1' }),
    T({ id: 'other', due: '2026-11-18', owner: 'u2' }),
    T({ id: 'prog', due: '2026-11-20', status: 'progress' }),
    T({ id: 'today', due: '2026-11-15' }),
  ];
  const r = thisWeek(tasks, member, '2026-11-15');
  assert.deepEqual(r.stack.map((t) => t.id), ['prog', 'today', 'bride', 'mine', 'in-edge']);
  assert.equal(r.olderCount, 1);
  assert.equal(r.total, 5);
  assert.ok(!r.stack.some((t) => ['older', 'out-edge', 'done', 'groom', 'other'].includes(t.id)));
  const g = thisWeek(tasks, { uid: 'u9', side: 'groom' }, '2026-11-15');
  assert.ok(g.stack.some((t) => t.id === 'groom') && !g.stack.some((t) => t.id === 'bride'));
});

test('deadlineWindow', () => {
  assert.equal(deadlineWindow('2026-11-22'), 'w1');
  assert.equal(deadlineWindow('2026-11-23'), 'w2');
  assert.equal(deadlineWindow('2026-12-15'), 'w2');
  assert.equal(deadlineWindow('2027-01-10'), 'w3');
  assert.equal(deadlineWindow('2027-01-22'), 'w4');
  assert.equal(deadlineWindow('2027-01-24'), 'w5');
  assert.equal(deadlineWindow('2027-01-25'), 'w6');
  assert.equal(deadlineWindow(undefined), 'w6');
});

test('applyFilters', () => {
  const tasks = [
    T({ id: 'a', labels: ['attire'] }),
    T({ id: 'b', labels: ['food'] }),
    T({ id: 'c', labels: ['music'] }),
    T({ id: 'd', labels: ['food'], status: 'done' }),
    T({ id: 'e', labels: ['attire'], owner: 'u1', visibility: 'bride' }),
  ];
  assert.deepEqual(applyFilters(tasks, { statuses: ['todo'], labelIds: ['attire', 'food'] }).map((t) => t.id), ['a', 'b', 'e']);
  assert.deepEqual(applyFilters(tasks, { owners: ['u1'] }).map((t) => t.id), ['e']);
  assert.deepEqual(applyFilters(tasks, { visibilities: ['bride'] }).map((t) => t.id), ['e']);
  assert.equal(applyFilters(tasks, {}).length, 5);
  assert.equal(applyFilters(tasks, { statuses: [] }).length, 5);
});

test('progress', () => {
  assert.deepEqual(progress([]), { done: 0, total: 0, pct: 0 });
  assert.deepEqual(progress([T({ id: 'a', status: 'done' }), T({ id: 'b' }), T({ id: 'c' })]), { done: 1, total: 3, pct: 33 });
});

test('formatRupees', () => {
  assert.equal(formatRupees(420000), '₹4,20,000');
  assert.equal(formatRupees(-1000), '-₹1,000');
  assert.equal(formatRupees(null), '₹0');
  assert.equal(formatRupees(undefined), '₹0');
  assert.equal(formatRupees(1234.6), '₹1,235');
});

test('isInAppBrowser', () => {
  assert.equal(isInAppBrowser('Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A; wv) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 WhatsApp/2.23'), true);
  assert.equal(isInAppBrowser('Mozilla/5.0 (iPhone) Instagram 300.0'), true);
  assert.equal(isInAppBrowser('Mozilla/5.0 [FBAN/FBIOS;FBAV/400.0]'), true);
  assert.equal(isInAppBrowser('Mozilla/5.0 (Linux; Android 13; Pixel 7; wv) Safari'), true);
  assert.equal(isInAppBrowser('Mozilla/5.0 (iPhone) Line/12.0'), true);
  assert.equal(isInAppBrowser('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'), false);
  assert.equal(isInAppBrowser(undefined), false);
});

test('daysTo', () => {
  assert.equal(daysTo('2026-11-22', '2026-11-15'), 7);
  assert.equal(daysTo('2026-11-10', '2026-11-15'), -5);
  assert.equal(daysTo('2026-11-15', '2026-11-15'), 0);
  assert.equal(daysTo('2027-03-29', '2027-03-28'), 1);
});

test('nextUp, viewMode and orderStack', async () => {
  const { nextUp, viewMode, orderStack, thisWeek } = await import('../js/planner/planner-core.js');
  const m = { uid: 'aai', side: 'bride' };
  const t = (id, o) => ({ id, title: id, due: '2026-12-01', status: 'todo', owner: 'aai', ...o });
  const tasks = [t('far', { due: '2026-12-20' }), t('near', { due: '2026-12-05' }), t('old', { due: '2026-11-01' }),
    t('theirs', { owner: 'sunny', due: '2026-11-12' }), t('fin', { status: 'done', due: '2026-11-12' })];
  assert.equal(nextUp(tasks, m, '2026-11-11').id, 'near');
  assert.equal(nextUp([t('old', { due: '2026-11-01' })], m, '2026-11-11'), null);
  assert.equal(thisWeek(tasks, m, '2026-11-11').olderCount, 1);
  assert.equal(viewMode(null), 'simple');
  assert.equal(viewMode({ mode: 'simple' }), 'simple');
  assert.equal(viewMode({ mode: 'full' }), 'full');
  const stack = [t('a'), t('b'), t('c')];
  assert.deepEqual(orderStack(stack, []).map((x) => x.id), ['a', 'b', 'c']);
  assert.deepEqual(orderStack(stack, ['a', 'c']).map((x) => x.id), ['b', 'a', 'c']);
  assert.deepEqual(orderStack(stack, ['gone', 'a']).map((x) => x.id), ['b', 'c', 'a']);
});
