import { test } from 'node:test';
import assert from 'node:assert/strict';

const { dialogRegistry } = await import('../js/planner/planner-ui.js');

// Minimal stand-in: close() fires 'close' like a real dialog, plus the dialog's own cleanup.
const fakeDialog = (log, name) => {
  const t = new EventTarget();
  t.close = () => { log.push(name); t.dispatchEvent(new Event('close')); };
  return t;
};

test('closeAll closes every open dialog and runs each close listener', () => {
  const log = [];
  const reg = dialogRegistry();
  const a = fakeDialog(log, 'a');
  const b = fakeDialog(log, 'b');
  let cleaned = 0;
  a.addEventListener('close', () => { cleaned++; });
  reg.add(a);
  reg.add(b);
  reg.closeAll();
  assert.deepEqual(log, ['a', 'b']);
  assert.equal(cleaned, 1);
  reg.closeAll();
  assert.deepEqual(log, ['a', 'b']);
});

test('a dialog closed on its own is forgotten', () => {
  const log = [];
  const reg = dialogRegistry();
  const a = fakeDialog(log, 'a');
  reg.add(a);
  a.close();
  reg.closeAll();
  assert.deepEqual(log, ['a']);
});
