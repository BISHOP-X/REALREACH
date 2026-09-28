import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createGoogleAttempt } from '../src/live/googleIdentity.ts';

test('Google receives a SHA-256 hash; Supabase receives the original random nonce', async () => {
  const attempt = await createGoogleAttempt();
  let received;
  await attempt.exchange('test-credential', async request => { received = request; });
  assert.equal(received.provider, 'google');
  assert.equal(received.token, 'test-credential');
  assert.match(received.nonce, /^[a-f0-9]{64}$/);
  assert.notEqual(attempt.hashedNonce, received.nonce);
  assert.equal(attempt.hashedNonce, createHash('sha256').update(received.nonce).digest('hex'));
  assert.notEqual(attempt.hashedNonce, (await createGoogleAttempt()).hashedNonce);
});

test('Duplicate Google callbacks cannot exchange the same attempt twice', async () => {
  const attempt = await createGoogleAttempt();
  let calls = 0;
  const exchange = async () => { calls++; return 'session'; };
  const results = await Promise.allSettled([attempt.exchange('token', exchange), attempt.exchange('token', exchange)]);
  assert.equal(calls, 1);
  assert.equal(results[0].value, 'session');
  assert.equal(results[1].status, 'rejected');
});

test('Missing Google credentials never reach Supabase', async () => {
  const attempt = await createGoogleAttempt();
  await assert.rejects(attempt.exchange(undefined, async () => assert.fail('must not exchange')), /did not complete/);
});

test('Expired Google attempt requires retry without exchanging a token', async t => {
  t.mock.timers.enable({ apis: ['Date'] });
  const attempt = await createGoogleAttempt();
  t.mock.timers.tick(600_001);
  await assert.rejects(attempt.exchange('token', async () => assert.fail('must not exchange')), /expired/);
});

test('A failed exchange consumes the attempt and retry uses a new nonce', async () => {
  const attempt = await createGoogleAttempt();
  await assert.rejects(attempt.exchange('token', async () => { throw new Error('rejected'); }), /rejected/);
  await assert.rejects(attempt.exchange('token', async () => {}), /already used/);
  assert.notEqual((await createGoogleAttempt()).hashedNonce, attempt.hashedNonce);
});
