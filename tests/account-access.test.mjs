import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { accountHome, canUseFront } from '../src/live/access.ts';

test('worker and business accounts cannot switch fronts',()=>{
  assert.equal(canUseFront('worker',false,'business'),false);
  assert.equal(canUseFront('business',false,'worker'),false);
  assert.equal(canUseFront('worker',false,'worker'),true);
  assert.equal(canUseFront('business',false,'business'),true);
});
test('only assigned admin can open admin and switch fronts',()=>{
  for(const type of [null,'worker','business'])assert.equal(canUseFront(type,false,'admin'),false);
  for(const front of ['worker','business','admin'])assert.equal(canUseFront(null,true,front),true);
});
test('new accounts finish onboarding, returning users land in their own front',()=>{
  assert.equal(accountHome(null),'/onboarding');
  assert.equal(accountHome('worker'),'/earn');
  assert.equal(accountHome('business'),'/business');
  assert.equal(accountHome(null,true),'/admin');
});
test('production entry has no simulator and no imported legacy application',()=>{
  const entry=readFileSync('src/main.tsx','utf8');
  assert.doesNotMatch(entry,/from ["']\.\/App|\/demo|<App\s/);
  const live=readFileSync('src/live/LiveApp.tsx','utf8');
  assert.doesNotMatch(live,/from ['"]\.\.\/App|\/demo/);
});
test('customer-facing components do not use pilot or demo copy',()=>{
  for(const file of ['AuthPages','LandingPage','LiveApp','Workspace','Campaigns','Onboarding']){
    assert.doesNotMatch(readFileSync(`src/live/${file}.tsx`,'utf8'),/\b(pilot|demo|baseline|early.access)\b/i,file);
  }
});
