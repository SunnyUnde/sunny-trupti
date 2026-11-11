import { test } from 'node:test';
import assert from 'node:assert/strict';

const { gateState, gateBody } = await import('../js/planner/planner-gate.js');

const CHROME = 'Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36';
const WA = 'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 Instagram 300.0';
const user = { uid: 'u1' };
const member = { uid: 'u1', role: 'editor' };
const request = { email: 'a@b.c' };

test('in-app browser wins over everything', () => {
  assert.equal(gateState({ ua: WA, user, member, request }), 'in_app_browser');
  assert.equal(gateState({ ua: WA, user: null }), 'in_app_browser');
});

test('no user is signed_out', () => {
  assert.equal(gateState({ ua: CHROME, user: null, member, request }), 'signed_out');
});

test('member doc means member, even with a stale request', () => {
  assert.equal(gateState({ ua: CHROME, user, member, request }), 'member');
});

test('request without member is pending', () => {
  assert.equal(gateState({ ua: CHROME, user, member: null, request }), 'pending');
});

test('no member and no request is no_access', () => {
  assert.equal(gateState({ ua: CHROME, user, member: null, request: null }), 'no_access');
});

test('member removed mid-session returns no_access', () => {
  assert.equal(gateState({ ua: CHROME, user, member, request: null }), 'member');
  assert.equal(gateState({ ua: CHROME, user, member: null, request: null }), 'no_access');
});

test('gateBody: an error is shown instead of Loading forever', () => {
  const base = { state: 'no_access', authKnown: true, ready: false };
  assert.equal(gateBody({ ...base, error: false }), 'loading');
  assert.equal(gateBody({ ...base, error: true }), 'error');
  assert.equal(gateBody({ ...base, ready: true, error: true }), 'no_access');
});

test('gateBody: signed out waits for auth, in-app browser never does', () => {
  assert.equal(gateBody({ state: 'signed_out', authKnown: false }), 'loading');
  assert.equal(gateBody({ state: 'signed_out', authKnown: true }), 'signed_out');
  assert.equal(gateBody({ state: 'in_app_browser', authKnown: false }), 'in_app_browser');
});

const { requestPayload } = await import('../js/planner/planner-gate.js');

test('request payload sends the display name as is, empty when absent', () => {
  assert.deepEqual(requestPayload({ email: 'a@b.c', displayName: 'Aai', photoURL: 'https://x/y.png' }),
    { email: 'a@b.c', name: 'Aai', photoURL: 'https://x/y.png' });
  assert.equal(requestPayload({ email: 'a@b.c', displayName: null, photoURL: null }).name, '');
  assert.equal(requestPayload({ email: 'a@b.c', photoURL: 'javascript:1' }).photoURL, null);
});
