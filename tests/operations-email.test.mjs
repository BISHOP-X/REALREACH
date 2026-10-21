import test from 'node:test';
import assert from 'node:assert/strict';
import {operationsEmailConfiguration,buildOperationsEmail,validateOperationsEmail,createOperationsMailer,AlertSendError} from '../supabase/functions/_shared/operations-email.ts';
const id='00000000-0000-4000-8000-000000000510',key=`rr-ops/${id}`;
const env={RESEND_API_KEY:'offline-fixture',REALREACH_ALERT_FROM:'alerts@realreach.com.ng',REALREACH_ALERT_TO:'operator@ui-test.invalid'};
const config=(values=env)=>operationsEmailConfiguration(name=>values[name]);
const snapshot={collected_at:'2026-10-21T19:00:00Z',incidents:[{code:'payment_uncertain',count:2,severity:'warning'}],secret:'never-copy-me',customer_email:'never-copy@ui-test.invalid'};
const body=()=>buildOperationsEmail(snapshot,config());
const errorIs=(code,outcome)=>(error)=>error instanceof AlertSendError&&error.code===code&&error.outcome===outcome&&!error.message.includes('secret');
test('operator alert configuration requires private key and one valid sender/recipient',()=>{
  assert.equal(config().configured,true);
  for(const [change,reason] of [
    [{RESEND_API_KEY:''},'missing_key'],[{RESEND_API_KEY:'secret\nvalue'},'missing_key'],
    [{REALREACH_ALERT_FROM:''},'missing_sender'],[{REALREACH_ALERT_FROM:'alerts@realreach.com.ng.attacker.test'},'invalid_sender'],
    [{REALREACH_ALERT_FROM:'Name <alerts@realreach.com.ng>'},'invalid_sender'],[{REALREACH_ALERT_TO:''},'missing_recipient'],
    [{REALREACH_ALERT_TO:'a@example.com,b@example.com'},'invalid_recipient'],[{REALREACH_ALERT_TO:'operator@example.com\r\nBcc:secret@example.com'},'invalid_recipient'],
  ]) {assert.equal(config({...env,...change}).configured,false);assert.equal(config({...env,...change}).reason,reason);}
  assert.equal(config({...env,REALREACH_ALERT_FROM:'alerts@mail.realreach.com.ng'}).configured,true);
});
test('alert body includes only bounded aggregate evidence and a fixed RealReach admin link',()=>{
  const request=body();validateOperationsEmail(request);
  assert.deepEqual(Object.keys(request).sort(),['from','subject','text','to']);
  assert.match(request.text,/Payments with an unknown result: 2/);assert.match(request.text,/https:\/\/www\.realreach\.com\.ng\/admin/);
  assert.equal(JSON.stringify(request).includes('never-copy'),false);
  const unknown=buildOperationsEmail({...snapshot,incidents:[{code:'new_future_category',count:1}]},config());
  assert.match(unknown.text,/Another operational issue: 1/);assert.equal(unknown.text.includes('new_future_category'),false);
});
test('invalid or empty incident snapshots cannot send a misleading all-clear alert',()=>{
  for(const payload of [null,{}, {...snapshot,collected_at:'bad'}, {...snapshot,incidents:[]},{...snapshot,incidents:[{code:'unknown_payments',count:-1}]},{...snapshot,incidents:[{code:'secret\nheader',count:1}]}]){
    assert.throws(()=>buildOperationsEmail(payload,config()),errorIs('invalid_request','failed'));
  }
});
test('alert provider sends the frozen body with stable idempotency header and no redirect following',async()=>{
  const calls=[];const request=body();
  const mailer=createOperationsMailer({apiKey:'offline-fixture',fetch:async(url,init)=>{calls.push({url,init});return Response.json({id});}});
  assert.deepEqual(await mailer.send(request,key),{id});assert.deepEqual(await mailer.send(request,key),{id});
  assert.equal(calls.length,2);for(const call of calls){assert.equal(call.url,'https://api.resend.com/emails');assert.equal(call.init.method,'POST');assert.equal(call.init.redirect,'error');assert.equal(call.init.headers['Idempotency-Key'],key);assert.equal(call.init.headers.Authorization,'Bearer offline-fixture');assert.deepEqual(JSON.parse(call.init.body),request);}
  assert.equal(calls[0].init.body,calls[1].init.body);
});
test('unconfigured or malformed requests never reach the provider',async()=>{
  let calls=0;const transport=async()=>{calls++;return Response.json({id});};
  await assert.rejects(()=>createOperationsMailer({apiKey:'',fetch:transport}).send(body(),key),errorIs('not_configured','failed'));
  const mailer=createOperationsMailer({apiKey:'offline-fixture',fetch:transport});
  for(const request of [{...body(),bcc:['secret@example.com']},{...body(),subject:'unsafe\nheader'},{...body(),from:'test@resend.dev'},{...body(),text:'x'.repeat(8001)}])await assert.rejects(()=>mailer.send(request,key),errorIs('invalid_request','failed'));
  await assert.rejects(()=>mailer.send(body(),'another-service/key'),errorIs('invalid_request','failed'));assert.equal(calls,0);
});
test('rejections, throttles and idempotency conflicts keep distinct safe outcomes',async()=>{
  for(const [status,payload,code,outcome] of [
    [401,{},'unauthorized','failed'],[403,{},'unauthorized','failed'],[422,{},'rejected','failed'],[429,{},'rate_limited','retry'],
    [409,{name:'invalid_idempotent_request',message:'raw-secret'},'idempotency_conflict','failed'],
    [409,{name:'concurrent_idempotent_requests'},'concurrent_request','retry'],[500,{},'transport_uncertain','uncertain'],[408,{},'transport_uncertain','uncertain'],
  ]) {const mailer=createOperationsMailer({apiKey:'offline-fixture',fetch:async()=>Response.json(payload,{status})});await assert.rejects(()=>mailer.send(body(),key),errorIs(code,outcome));}
});
test('accepted HTTP without an exact provider ID remains uncertain, never delivered',async()=>{
  for(const response of [Response.json({success:true}),Response.json({id:'not-an-id'}),new Response('not json'),Response.json({id},{headers:{'content-length':'1000000'}}),new Response('x'.repeat(17000))]){
    await assert.rejects(()=>createOperationsMailer({apiKey:'offline-fixture',fetch:async()=>response}).send(body(),key),errorIs('transport_uncertain','uncertain'));
  }
});
test('transport failures and timeouts do not expose keys, upstream messages or claim failure to deliver',async()=>{
  await assert.rejects(()=>createOperationsMailer({apiKey:'offline-fixture',fetch:async()=>{throw new Error('upstream-secret');}}).send(body(),key),errorIs('transport_uncertain','uncertain'));
  const mailer=createOperationsMailer({apiKey:'offline-fixture',timeoutMs:5,fetch:async(_url,init)=>new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(new Error('upstream-secret')),{once:true}))});
  await assert.rejects(()=>mailer.send(body(),key),errorIs('transport_uncertain','uncertain'));
});
