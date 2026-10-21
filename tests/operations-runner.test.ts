// Offline orchestration contracts. No provider requests or hosted database.
import assert from 'node:assert/strict';
import {runMarketplaceOperations} from '../supabase/functions/_shared/marketplace-operations.ts';
import {AlertSendError,buildOperationsEmail,operationsEmailConfiguration,type OperationsEmail} from '../supabase/functions/_shared/operations-email.ts';
import {createMarketplaceOperationsHandler} from '../supabase/functions/marketplace-operations/handler.ts';
import {type DB} from '../supabase/functions/_shared/marketplace.ts';

const id='10000000-0000-4000-8000-000000000001';
const attempt='10000000-0000-4000-8000-000000000002';
const providerId='10000000-0000-4000-8000-000000000003';
const now=Date.parse('2026-10-21T20:00:00Z');
const env:Record<string,string>={RESEND_API_KEY:'offline-fixture',REALREACH_ALERT_FROM:'alerts@realreach.com.ng',REALREACH_ALERT_TO:'operator@ui-test.invalid'};
const config=()=>operationsEmailConfiguration(name=>env[name]);
const payload={collected_at:new Date(now).toISOString(),incidents:[{code:'payment_uncertain',count:2}]};
const lease=()=>({id,attempt_token:attempt,idempotency_key:`rr-ops/${id}`,payload,request_body:null as unknown,retry_until:new Date(now+60_000).toISOString()});
type Call={name:string;args?:Record<string,unknown>};
function fixture(){
  const calls:Call[]=[],sent:{body:OperationsEmail;key:string}[]=[];
  const results:Record<string,unknown>={rr_ops_lease:lease(),rr_ops_finish:null,rr_job_authorized:true,rr_ops_liveness:true};
  const failures=new Set<string>();
  const db={rpc:(name:string,args?:Record<string,unknown>)=>{
    calls.push({name,args});
    const query={abortSignal:(_signal:AbortSignal)=>query,then:(resolve:(value:unknown)=>unknown)=>{
      const data=name==='rr_ops_prepare'&&!Object.hasOwn(results,name)?args?.p_request_body:results[name];
      return Promise.resolve({data,error:failures.has(name)?{message:'private SQL details'}:null}).then(resolve);
    }};return query;
  }} as unknown as DB;
  const deps={configuration:config,now:()=>now,mailer:()=>({send:async(body:OperationsEmail,key:string)=>{sent.push({body,key});return {id:providerId};}})};
  return {db,deps,results,failures,calls,sent,run:()=>runMarketplaceOperations(db,deps)};
}

Deno.test('operations missing configuration consumes no lease or send attempt',async()=>{
  const f=fixture();f.deps.configuration=()=>operationsEmailConfiguration(()=>undefined);
  assert.deepEqual(await f.run(),{state:'not_configured',accepted:0});assert.deepEqual(f.calls,[]);assert.deepEqual(f.sent,[]);
});
Deno.test('operations idle queue makes no preparation, send or financial calls',async()=>{
  const f=fixture();f.results.rr_ops_lease=null;
  assert.deepEqual(await f.run(),{state:'idle',accepted:0});assert.deepEqual(f.calls.map(c=>c.name),['rr_ops_lease']);assert.equal(f.sent.length,0);
});
Deno.test('operations persists the full request before sending and records acceptance only afterwards',async()=>{
  const f=fixture();f.deps.mailer=()=>({send:async(body,key)=>{
    assert.deepEqual(f.calls.map(c=>c.name),['rr_ops_lease','rr_ops_prepare']);
    assert.deepEqual(body,f.calls[1].args?.p_request_body);f.sent.push({body,key});return {id:providerId};
  }});
  assert.deepEqual(await f.run(),{state:'accepted',accepted:1});
  assert.equal(f.sent[0].key,`rr-ops/${id}`);
  assert.deepEqual(f.calls[2],{name:'rr_ops_finish',args:{p_id:id,p_attempt_token:attempt,p_outcome:'accepted',p_provider_id:providerId,p_error_code:null}});
});
Deno.test('operations retries retain the saved recipient and body when configuration changes',async()=>{
  const f=fixture(),saved=buildOperationsEmail(payload,{...config(),to:'previous@ui-test.invalid'});
  f.results.rr_ops_lease={...lease(),request_body:saved};await f.run();
  assert.deepEqual(f.sent[0].body,saved);assert.equal(f.sent[0].body.to[0],'previous@ui-test.invalid');
});
Deno.test('operations honors the durable prepared body rather than the new candidate',async()=>{
  const f=fixture(),saved=buildOperationsEmail(payload,{...config(),to:'previous@ui-test.invalid'});
  f.results.rr_ops_prepare=saved;await f.run();assert.deepEqual(f.sent[0].body,saved);
});
Deno.test('operations preparation failure or malformed stored body cannot send',async()=>{
  const f=fixture();f.failures.add('rr_ops_prepare');await assert.rejects(f.run,/operations_unavailable/);assert.equal(f.sent.length,0);
  const malformed=fixture();malformed.results.rr_ops_prepare={...buildOperationsEmail(payload,config()),to:['a@ui-test.invalid','b@ui-test.invalid']};
  await assert.rejects(malformed.run,/invalid_request/);assert.equal(malformed.sent.length,0);
});
Deno.test('operations acceptance-write failure never marks a successfully sent message failed',async()=>{
  const f=fixture();f.failures.add('rr_ops_finish');await assert.rejects(f.run,/operations_unavailable/);
  assert.equal(f.sent.length,1);assert.equal(f.calls.filter(c=>c.name==='rr_ops_finish').length,1);
  assert.equal(f.calls.at(-1)?.args?.p_outcome,'accepted');
  const frozen=f.sent[0];f.results.rr_ops_lease={...lease(),request_body:frozen.body};f.failures.clear();
  assert.deepEqual(await f.run(),{state:'accepted',accepted:1});assert.deepEqual(f.sent[1],frozen);
});
Deno.test('operations provider outcomes become bounded safe retry codes',async()=>{
  const cases:[AlertSendError,string][]=[
    [new AlertSendError('unauthorized','failed'),'configuration_error'],
    [new AlertSendError('rate_limited','retry'),'rate_limited'],
    [new AlertSendError('concurrent_request','retry'),'provider_unavailable'],
    [new AlertSendError('idempotency_conflict','failed'),'request_rejected'],
    [new AlertSendError('transport_uncertain','uncertain'),'transport_uncertain'],
  ];
  for(const [error,code] of cases){const f=fixture();f.deps.mailer=()=>({send:async()=>{throw error;}});
    assert.equal((await f.run()).state,error.outcome);assert.equal(f.calls.at(-1)?.args?.p_error_code,code);assert.equal(f.calls.at(-1)?.args?.p_provider_id,null);
  }
});
Deno.test('operations unexpected transport errors and invalid acceptance IDs remain uncertain without raw errors',async()=>{
  for(const send of [async()=>{throw new Error('secret customer details');},async()=>({id:'invalid'})]){
    const f=fixture();f.deps.mailer=()=>({send});assert.deepEqual(await f.run(),{state:'uncertain',accepted:0});
    assert.equal(f.calls.at(-1)?.args?.p_error_code,'transport_uncertain');assert.doesNotMatch(JSON.stringify(f.calls),/secret customer details/);
  }
});
Deno.test('operations refuses to send near the retry deadline before or after durable preparation',async()=>{
  const before=fixture();before.results.rr_ops_lease={...lease(),retry_until:new Date(now+19_000).toISOString()};
  assert.equal((await before.run()).state,'review_required');assert.equal(before.sent.length,0);assert.equal(before.calls.some(c=>c.name==='rr_ops_prepare'),false);
  const after=fixture();let reads=0;after.deps.now=()=>now+(reads++?55_000:0);
  assert.equal((await after.run()).state,'review_required');assert.equal(after.sent.length,0);assert.equal(after.calls.at(-1)?.args?.p_error_code,'retry_window_closed');
});
Deno.test('operations rejects malformed lease identities without any send',async()=>{
  for(const fields of [{id:'other'},{attempt_token:'bad'},{idempotency_key:`rr-ops-${id}`},{retry_until:'bad'}]){
    const f=fixture();f.results.rr_ops_lease={...lease(),...fields};await assert.rejects(f.run,/operations_unavailable/);assert.equal(f.sent.length,0);assert.equal(f.calls.length,1);
  }
});
Deno.test('operations invalid aggregate payload is terminal and cannot include arbitrary message text',async()=>{
  const f=fixture();f.results.rr_ops_lease={...lease(),payload:{...payload,incidents:[]}};
  assert.equal((await f.run()).state,'failed');assert.equal(f.sent.length,0);assert.equal(f.calls.at(-1)?.args?.p_error_code,'request_rejected');
});

function endpoint(f:ReturnType<typeof fixture>,run?:()=>Promise<{state:string;accepted:number}>){
  return createMarketplaceOperationsHandler({database:()=>f.db,fingerprint:async token=>`hash:${token}`,run:run??f.run});
}
const request=(method='GET',token?:string,body?:string)=>new Request('https://example.test/marketplace-operations',{method,headers:token?{authorization:token}:undefined,body});
Deno.test('operations public liveness is minimal and cannot disclose incidents or configuration',async()=>{
  const f=fixture(),handler=endpoint(f);let response=await handler(request());
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});assert.equal(response.headers.get('Cache-Control'),'no-store');
  f.results.rr_ops_liveness=false;response=await handler(request());assert.equal(response.status,503);assert.deepEqual(await response.json(),{ok:false});
  f.failures.add('rr_ops_liveness');response=await handler(request());assert.equal(response.status,503);assert.deepEqual(await response.json(),{ok:false});
  assert.ok(f.calls.every(c=>c.name==='rr_ops_liveness'));assert.equal(f.sent.length,0);
});
Deno.test('operations unsupported methods and missing or oversized tokens cannot access the database',async()=>{
  const f=fixture(),handler=endpoint(f);
  assert.equal((await handler(request('DELETE'))).status,405);
  assert.equal((await handler(request('POST'))).status,401);
  assert.equal((await handler(request('POST',`Bearer ${'a'.repeat(201)}`))).status,401);
  assert.equal(f.calls.length,0);
});
Deno.test('operations invalid job token cannot lease or email even with caller-supplied commands',async()=>{
  const f=fixture();f.results.rr_job_authorized=false;
  const response=await endpoint(f)(request('POST','Bearer bad',JSON.stringify({admin:true,send:true,recipient:'attacker@ui-test.invalid'})));
  assert.equal(response.status,401);assert.deepEqual(f.calls,[{name:'rr_job_authorized',args:{p_hash:'hash:bad'}}]);assert.equal(f.sent.length,0);
});
Deno.test('operations authorized invocation ignores request body and returns only bounded run outcome',async()=>{
  const f=fixture();let runs=0;const response=await endpoint(f,async()=>{runs++;return {state:'idle',accepted:0};})(request('POST','Bearer job-token','arbitrary non-JSON'));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{state:'idle',accepted:0});assert.equal(runs,1);
  assert.deepEqual(f.calls,[{name:'rr_job_authorized',args:{p_hash:'hash:job-token'}}]);
});
Deno.test('operations runtime failures never expose provider keys, customer records or SQL details',async()=>{
  const f=fixture(),handler=endpoint(f,async()=>{throw new Error('private token and customer details');});
  const response=await handler(request('POST','Bearer job-token'));assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'Operations run deferred'});
});
