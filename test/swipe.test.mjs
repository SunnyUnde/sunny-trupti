import { test } from 'node:test';
import assert from 'node:assert/strict';

const { swipeDecision } = await import('../js/planner/swipe.js');

test('swipeDecision: past 30% of the width decides, short of it does not', () => {
  assert.equal(swipeDecision(0.31 * 300, 300, 0.3), 'right');
  assert.equal(swipeDecision(-0.31 * 300, 300, 0.3), 'left');
  assert.equal(swipeDecision(0.29 * 300, 300, 0.3), null);
  assert.equal(swipeDecision(-0.29 * 300, 300, 0.3), null);
  assert.equal(swipeDecision(0, 300, 0.3), null);
});
