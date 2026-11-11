import { test } from 'node:test';
import assert from 'node:assert/strict';

const { greeting, badgeNumbers, olderLine, requestsLine } = await import('../js/planner/view-planner-simple.js');

test('greeting follows the hour', () => {
  assert.equal(greeting(9, 'Aai').en, 'Good morning, Aai');
  assert.equal(greeting(13, 'Aai').en, 'Good afternoon, Aai');
  assert.equal(greeting(20, 'Aai').mr, 'शुभ संध्याकाळ, Aai');
});

test('badgeNumbers counts the top card by its place in the week', () => {
  const base = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(badgeNumbers(base, base), { i: 1, total: 3 });
  assert.deepEqual(badgeNumbers([base[1], base[2], base[0]], base), { i: 2, total: 3 });
  assert.deepEqual(badgeNumbers([], []), { i: 0, total: 0 });
});

test('older and request lines pluralise in both languages', () => {
  assert.equal(olderLine(1).en, '1 older task is waiting.');
  assert.equal(olderLine(2).en, '2 older tasks are waiting.');
  assert.equal(olderLine(2).mr, '२ जुन्या कामांची प्रतीक्षा आहे.');
  assert.equal(requestsLine(1).en, '1 person asked for access');
  assert.equal(requestsLine(3).en, '3 people asked for access');
});
