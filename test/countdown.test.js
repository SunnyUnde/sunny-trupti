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

const { formatUnits } = require('../js/countdown.js');

test('pads each unit to two digits in English', () => {
  const parts = { days: 7, hours: 3, minutes: 9, seconds: 41 };
  assert.deepStrictEqual(formatUnits(parts, 'en'), { days: '07', hours: '03', minutes: '09' });
});

test('leaves day counts above 99 unpadded and untruncated', () => {
  const parts = { days: 497, hours: 0, minutes: 0, seconds: 0 };
  assert.strictEqual(formatUnits(parts, 'en').days, '497');
});

test('substitutes Devanagari digits when Marathi is active', () => {
  const parts = { days: 10, hours: 23, minutes: 45, seconds: 0 };
  assert.deepStrictEqual(formatUnits(parts, 'mr'), { days: '१०', hours: '२३', minutes: '४५' });
});

test('drops seconds from the rendered output', () => {
  const out = formatUnits({ days: 1, hours: 1, minutes: 1, seconds: 59 }, 'en');
  assert.deepStrictEqual(Object.keys(out), ['days', 'hours', 'minutes']);
});

const { easeOutCubic } = require('../js/countdown.js');

test('easing spans exactly 0 to 1 across the tween', () => {
  assert.strictEqual(easeOutCubic(0), 0);
  assert.strictEqual(easeOutCubic(1), 1);
});

test('easing decelerates, so it is past halfway at the midpoint', () => {
  assert.ok(easeOutCubic(0.5) > 0.5, 'ease-out should lead a linear tween');
  assert.ok(easeOutCubic(0.5) < 1);
});

test('easing clamps outside the tween window', () => {
  assert.strictEqual(easeOutCubic(-0.4), 0);
  assert.strictEqual(easeOutCubic(2.5), 1);
});

const { shouldCountUp } = require('../js/countdown.js');

test('counts up only when motion is allowed, rAF exists and the tab is visible', () => {
  assert.strictEqual(shouldCountUp(false, true, false), true);
});

test('never counts up under reduced motion', () => {
  assert.strictEqual(shouldCountUp(true, true, false), false);
});

test('never counts up without requestAnimationFrame', () => {
  assert.strictEqual(shouldCountUp(false, false, false), false);
});

test('never counts up in a hidden tab, where rAF is throttled', () => {
  assert.strictEqual(shouldCountUp(false, true, true), false);
});
