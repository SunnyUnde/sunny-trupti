const { test } = require('node:test');
const assert = require('node:assert');
const { shouldPlayIntro } = require('../js/intro.js');

test('plays the intro when motion is not reduced', () => {
  assert.strictEqual(shouldPlayIntro(false), true);
});

test('skips the intro when the user prefers reduced motion', () => {
  assert.strictEqual(shouldPlayIntro(true), false);
});
