import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {InstagramProvider, followObservation, commentObservation, verifySignature, webhookEvent, authorizationUrl} from '../supabase/functions/_shared/instagram.ts';
const account='account-1',sender='scoped-1';
test('follow truth requires matching account AND scoped identity',()=>{
  assert.equal(followObservation({accountId:account,userId:sender,isFollower:true},account,sender).result,'positive');
  assert.equal(followObservation({accountId:account,userId:sender,isFollower:false},account,sender).result,'negative');
  assert.equal(followObservation({accountId:'other',userId:sender,isFollower:true},account,sender).result,'unknown');
  assert.equal(followObservation({accountId:account,userId:'other',isFollower:true},account,sender).result,'unknown');
});
test('null, missing, string boolean and unscoped answers never pass or fail',()=>{
  for(const value of [null,undefined,'true',1])assert.equal(followObservation({accountId:account,userId:sender,isFollower:value},account,sender).result,'unknown');
  assert.equal(followObservation({},account,sender).result,'unknown');
});
test('fresh account-level call uses refresh=true and server authorization header',async()=>{
  const provider=new InstagramProvider('fixture-only',async(url,options)=>{
    assert.equal(url,'https://zernio.com/api/v1/accounts/account-1/follow-status/scoped-1?refresh=true');
    assert.equal(options.headers.Authorization,'Bearer fixture-only');
    return Response.json({accountId:account,userId:sender,isFollower:true});
  });
  assert.equal((await provider.follow(account,sender)).result,'positive');
});
test('rate limit and transport failure stay unknown',async()=>{
  const throttled=new InstagramProvider('fixture',async()=>new Response('',{status:429}));
  assert.deepEqual(await throttled.follow(account,sender),{result:'unknown',reason:'rate_limited'});
  const broken=new InstagramProvider('fixture',async()=>{throw new Error('timeout');});
  assert.equal((await broken.follow(account,sender)).result,'unknown');
});
test('missing API key does not fabricate a connection or make a request',async()=>{
  const provider=new InstagramProvider('',async()=>{assert.fail('Must not call provider');});
  await assert.rejects(()=>provider.connect('profile','https://www.realreach.com.ng/business/instagram'),/awaiting provider setup/);
});
test('profile creation retries use a stable identity and body',async()=>{
  const bodies=[];const provider=new InstagramProvider('fixture',async(_url,options)=>{bodies.push([options.headers['Idempotency-Key'],options.body]);return Response.json({profile:{_id:'p'}});});
  await provider.profile('business-1');await provider.profile('business-1');assert.deepEqual(bodies[0],bodies[1]);
});
test('authorization URLs reject non-HTTPS, credentials and lookalike hosts',()=>{
  for(const url of ['javascript:alert(1)','https://instagram.com.evil.test','https://evil.test','http://instagram.com','https://user:password@instagram.com'])assert.throws(()=>authorizationUrl(url));
  assert.equal(new URL(authorizationUrl('https://www.instagram.com/oauth')).hostname,'www.instagram.com');
});
test('callback account must really belong to the expected provider profile',async()=>{
  const provider=new InstagramProvider('fixture',async()=>Response.json({accounts:[{_id:'a',platform:'instagram',isActive:true,username:'demo',profileId:{_id:'wrong'}}]}));
  await assert.rejects(()=>provider.connectedAccount('p','a'),/could not be confirmed/);
});
test('HMAC verification rejects forged, missing and mutated raw bodies',async()=>{
  const raw=JSON.stringify({id:'fixture-event'}),secret='fixture-webhook-secret';
  const signature=createHmac('sha256',secret).update(raw).digest('hex');
  assert.equal(await verifySignature(raw,signature,secret),true);
  assert.equal(await verifySignature(raw+' ',signature,secret),false);
  assert.equal(await verifySignature(raw,'0'.repeat(64),secret),false);
  assert.equal(await verifySignature(raw,null,secret),false);
  assert.equal(await verifySignature(raw,signature,''),false);
});
test('webhook parser only extracts exact challenges; no unrelated DM retention',()=>{
  const source={id:'event',event:'message.received',timestamp:'2026-09-28T12:00:00Z',platform:'instagram',account:{accountId:account},message:{text:'RR-0123456789ABCDEF0123',sender:{id:sender},attachments:['private']}};
  assert.equal(webhookEvent(source).challenge,source.message.text);
  assert.equal('message' in webhookEvent(source),false);
  assert.equal(webhookEvent({...source,message:{text:'hi '+source.message.text,sender:{id:sender}}}).challenge,null);
  assert.throws(()=>webhookEvent({...source,timestamp:'not-a-date'}));
});
test('comments are conservative about cache, author, hidden state and absence',()=>{
  const now=Date.now(),value={meta:{accountId:account,postId:'post',lastUpdated:new Date(now).toISOString()},comment:{id:'comment',from:{id:sender},isHidden:false}};
  assert.equal(commentObservation(value,account,'post','comment',sender,now).result,'positive');
  assert.equal(commentObservation({...value,comment:{...value.comment,isHidden:true}},account,'post','comment',sender,now).result,'unknown');
  assert.equal(commentObservation(value,account,'post','comment','different',now).result,'unknown');
  assert.equal(commentObservation(value,account,'post','comment',sender,now+11*60_000).result,'unknown');
  assert.equal(commentObservation({...value,comment:null},account,'post','comment',sender,now).result,'unknown');
});
