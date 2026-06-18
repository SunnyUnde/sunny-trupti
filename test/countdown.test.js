const { test } = require('node:test');
const assert = require('node:assert');
const { getRemaining } = require('../js/countdown.js');

const DAY = 86400000, HOUR = 3600000, MIN = 60000, SEC = 1000;

test('computes days/hours/minutes/seconds for a future target', () => {
  const now = 0;
  const target = 2 * DAY + 3 * HOUR + 4 * MIN + 5 * SEC;
  assert.deepStrictEqual(getRemaining(target, now), { days: 2, hours: 3, minutes: 4, seconds: 5 });
});

test('clamps to all zeros once the target has passed', () => {
  assert.deepStrictEqual(getRemaining(0, 5 * DAY), { days: 0, hours: 0, minutes: 0, seconds: 0 });
});

test('treats the exact target moment as zero', () => {
  assert.deepStrictEqual(getRemaining(1000, 1000), { days: 0, hours: 0, minutes: 0, seconds: 0 });
});
