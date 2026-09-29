import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const auth = readFileSync(new URL('../src/live/AuthPages.tsx', import.meta.url), 'utf8');
const menu = readFileSync(new URL('../src/live/MobileMenu.tsx', import.meta.url), 'utf8');

test('Google signup is available without a hidden checkbox prerequisite', () => {
  assert.match(auth, /<GoogleSignIn mode=\{mode\} front=\{front\} disabled=\{busy\}/);
  assert.doesNotMatch(auth, /!consent|setConsent|type="checkbox"/);
  assert.match(auth, /By creating an account with Google or email/);
  assert.match(auth, /to="\/terms">Terms/);
  assert.match(auth, /to="\/privacy">Privacy Policy/);
});

test('mobile navigation is modal and closes cleanly when returning to desktop', () => {
  assert.match(menu, /<dialog/);
  assert.match(menu, /panel\.showModal\(\)/);
  assert.match(menu, /aria-haspopup="dialog"/);
  assert.match(menu, /aria-label="Close menu"/);
  assert.match(menu, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(menu, /desktop\.removeEventListener/);
  for (const route of ['#how', '#businesses', '#workers', '/help', '/signup', '/login']) {
    assert.ok(menu.includes(`="${route}" onClick={close}`), `${route} should close the menu`);
  }
});
