// Offline real HTTP/controller and heartbeat tests. No hosted DB/provider calls.
import assert from 'node:assert/strict';
import {createMarketplaceHandler} from '../supabase/functions/_shared/marketplace-handler.ts';
import {adminOperations} from '../supabase/functions/_shared/marketplace-operations-admin.ts';
import {createMarketplaceJobsHandler} from '../supabase/functions/marketplace-jobs/handler.ts';
import {type DB,type authenticated} from '../supabase/functions/_shared/marketplace.ts';

const id='10000000-0000-4000-8000-000000000001',now=Date.parse('2026-10-21T20:00:00Z');
const at=(minutes=0)=>new Date(now-minutes*60_000).toISOString();
const counts={pending_payments:0,uncertain_payments:0,stalled_payments:0,missing_references:0,pending_checks:0,review_checks:0,overdue_checks:0,risk_holds:0,support_open:0,support_overdue:0};
const findings={unbalanced_journals:0,account_mismatches:0,campaign_mismatches:0,withdrawal_mismatches:0};
const report=()=>({id,status:'clean',checked_at:at(),findings:{...findings},error:null});
const empty=()=>({snapshot:null,worker:{last_seen_at:null,last_success_at:null,last_failure_at:null,processed:0,last_error:null},reconciliation:null,alerts:[],alerting:{last_created_at:null,reminder_hours:6}});
const healthy=()=>({...empty(),snapshot:{collected_at:at(),counts:{...counts},incidents:[]},worker:{last_seen_at:at(),last_success_at:at(),last_failure_at:null,processed:3,last_error:null},reconciliation:report()});
type Query={name:string;args:unknown};
function fixture(options:{admin?:boolean;aal?:string;identityError?:boolean;rpcError?:boolean}={}) {
  const calls:Query[]=[],writes:Query[]=[],rates:unknown[][]=[];
  const results:Record<string,unknown>={rr_ops_overview:empty(),rr_ops_reconcile:report(),rr_job_authorized:true};
  const db={auth:{getClaims:async()=>({data:{claims:{aal:options.aal??'aal2'}},error:null})},
    rpc:(name:string,args?:unknown)=>{
      calls.push({name,args});const request={abortSignal:(_signal:AbortSignal)=>request,then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:results[name],error:options.rpcError?{message:'secret fixture SQL provider body customer@example.test'}:null}).then(resolve)};return request;
    },from:(table:string)=>({insert:(value:unknown)=>{
      writes.push({name:table,args:value});const request={abortSignal:(_signal:AbortSignal)=>request,then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:null,error:null}).then(resolve)};return request;
    }})} as unknown as DB;
  const auth={db,user:{id,email:'operator@example.test'},token:'fixture-token',profile:{account_type:'worker',display_name:'Operator'},admin:options.admin??true} as Awaited<ReturnType<typeof authenticated>>;
  const handler=createMarketplaceHandler({authenticate:async()=>{if(options.identityError){const {ProviderError}=await import('../supabase/functions/_shared/instagram.ts');throw new ProviderError(401,'Your session ended.');}return auth;},rateLimit:async(...args)=>{rates.push(args);}});
  const send=async(body:unknown,status=200)=>{const response=await handler(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));assert.equal(response.status,status);return response.json();};
  return {db,results,calls,writes,rates,send};
}
const projection={now:()=>now,configuration:()=>({configured:false,reason:'missing_key'})};

Deno.test('operations and ledger-check actions reject ordinary users and unverified admins before ops reads',async()=>{
  for(const options of [{admin:false},{aal:'aal1'}])for(const action of ['admin-operations','admin-reconcile-run']) {
    const f=fixture(options);await f.send({action,confirmation:'CHECK LEDGER',admin:true,aal:'aal2'},403);assert.equal(f.calls.length,0);assert.equal(f.writes.length,0);
  }
});
Deno.test('operations actions cannot bypass a revoked or missing authenticated session',async()=>{
  const f=fixture({identityError:true});for(const action of ['admin-operations','admin-reconcile-run'])await f.send({action,confirmation:'CHECK LEDGER'},401);
  assert.equal(f.calls.length,0);assert.equal(f.writes.length,0);
});
Deno.test('missing durable runs remain never-run, not a fabricated healthy or sent state',async()=>{
  const f=fixture();const result=await adminOperations(f.db,projection);
  assert.equal(result.snapshot_status,'never_run');assert.equal(result.worker.status,'never_run');assert.equal(result.reconciliation_status,'never_run');assert.equal(result.alerting.configured,false);assert.equal(result.alerting.configuration_reason,'missing_key');assert.deepEqual(result.alerts,[]);
  assert.deepEqual(f.calls,[{name:'rr_ops_overview',args:undefined}]);assert.equal(f.writes.length,0);
});
Deno.test('fresh monitor, idle worker and old financial report are independently described',async()=>{
  const f=fixture();const value=healthy();value.worker.last_seen_at=at(120);value.worker.last_success_at=at(120);value.reconciliation.checked_at=at(27*60);f.results.rr_ops_overview=value;
  let result=await adminOperations(f.db,projection);assert.equal(result.snapshot_status,'fresh');assert.equal(result.worker.status,'healthy');assert.equal(result.reconciliation_status,'stale');
  f.results.rr_ops_overview={...value,snapshot:{...value.snapshot,incidents:[{code:'worker_stale',severity:'critical',count:1}]}};
  result=await adminOperations(f.db,projection);assert.equal(result.worker.status,'stale');
  f.results.rr_ops_overview={...value,snapshot:{...value.snapshot,collected_at:at(16)}};
  result=await adminOperations(f.db,projection);assert.equal(result.worker.status,'unknown');
  f.results.rr_ops_overview={...value,snapshot:{...value.snapshot,collected_at:at(16)},worker:{...value.worker,last_error:'Worker run did not complete'},reconciliation:{...value.reconciliation,status:'failed',error:'reconciliation_failed'}};
  result=await adminOperations(f.db,projection);assert.equal(result.snapshot_status,'stale');assert.equal(result.worker.status,'failed');assert.equal(result.reconciliation_status,'failed');
});
Deno.test('operations projection is bounded and excludes email bodies contacts provider errors and secrets',async()=>{
  const f=fixture();const alert={id,status:'accepted',last_outcome:'accepted',created_at:at(),last_attempt_at:at(),retry_until:at(-60),attempts:1,provider_id:id,error_code:null,to:'customer@example.test',body:'private body',secret:'private-key'};
  f.results.rr_ops_overview={...healthy(),alerts:Array.from({length:40},()=>alert),apiKey:'private-key',customer_email:'customer@example.test',worker:{...healthy().worker,provider_payload:'private body'}};
  const result=await adminOperations(f.db,{...projection,configuration:()=>({configured:true,reason:'ready',apiKey:'private-key',from:'secret@example.test',to:'customer@example.test'})});
  assert.equal(result.alerts.length,20);assert.equal(result.alerts[0].status,'accepted');assert.equal(result.alerting.configured,true);
  assert.doesNotMatch(JSON.stringify(result),/customer@|secret@|private body|private-key|provider_payload|delivered/);
  assert.deepEqual(result.thresholds,{snapshot_stale_minutes:15,worker_stale_minutes:10,reconciliation_stale_hours:26});
});
Deno.test('malformed count timestamps states and raw provider errors cannot masquerade as healthy data',async()=>{
  for(const invalid of [
    {...healthy(),snapshot:{...healthy().snapshot,counts:{...counts,risk_holds:NaN}}},
    {...healthy(),snapshot:{...healthy().snapshot,counts:{...counts,pending_checks:-1}}},
    {...healthy(),snapshot:{...healthy().snapshot,collected_at:'today'}},
    {...healthy(),worker:{...healthy().worker,last_error:'customer@example.test private-key'}},
    {...healthy(),snapshot:{...healthy().snapshot,incidents:[{code:'private-key',severity:'critical',count:1}]}},
    {...healthy(),reconciliation:{...report(),status:'paid'}},
  ]) {
    const f=fixture();f.results.rr_ops_overview=invalid;const result=await f.send({action:'admin-operations'},503);assert.match(result.error,/Operations status is unavailable/);assert.doesNotMatch(JSON.stringify(result),/private-key|customer@/);
  }
});
Deno.test('operations RPC failure is redacted and never triggers a financial command',async()=>{
  const f=fixture({rpcError:true});const result=await f.send({action:'admin-operations'},503);assert.doesNotMatch(JSON.stringify(result),/secret|SQL|customer@/);assert.deepEqual(f.calls.map(q=>q.name),['rr_ops_overview']);assert.equal(f.writes.length,0);
});
Deno.test('manual ledger check requires explicit confirmation and ignores caller financial instructions',async()=>{
  const f=fixture();await f.send({action:'admin-reconcile-run'},400);assert.equal(f.calls.length,0);
  const result=await f.send({action:'admin-reconcile-run',confirmation:'CHECK LEDGER',p_source:'scheduled',amount_kobo:999999,refund:true,email:'customer@example.test',actor:'attacker'});
  assert.deepEqual(result,{reconciliation:report()});assert.deepEqual(f.calls,[{name:'rr_ops_reconcile',args:{p_source:'manual'}}]);
  assert.deepEqual(f.writes,[{name:'rr_audit',args:{actor_id:id,action:'admin-reconcile-run',reference:id,details:{status:'clean'}}}]);assert.ok(f.rates.every(args=>args[3]===5));
});
Deno.test('stored reconciliation failure is a visible result, not a successful ledger check',async()=>{
  const f=fixture();f.results.rr_ops_reconcile={...report(),status:'failed',findings:{},error:'reconciliation_failed'};
  const result=await f.send({action:'admin-reconcile-run',confirmation:'CHECK LEDGER'});assert.equal(result.reconciliation.status,'failed');assert.equal(result.reconciliation.error,'reconciliation_failed');assert.equal(result.reconciliation.findings,null);
});
Deno.test('concurrent ledger scan is reported as busy rather than reusing an old success',async()=>{
  const f=fixture();f.results.rr_ops_reconcile={busy:true};const result=await f.send({action:'admin-reconcile-run',confirmation:'CHECK LEDGER'},409);
  assert.match(result.error,/already running/);assert.equal(f.writes.length,0);
});

function jobFixture(options:{authorized?:boolean;runError?:boolean;heartbeatError?:boolean}={}) {
  const f=fixture();f.results.rr_job_authorized=options.authorized??true;const sequence:string[]=[],heartbeats:Array<{ok:boolean;processed:number}>=[],logs:string[]=[];
  const handler=createMarketplaceJobsHandler({database:()=>f.db,fingerprint:async token=>{assert.equal(token,'fixture-token');return 'a'.repeat(64);},
    run:async()=>{sequence.push('work');if(options.runError)throw new Error('private provider/customer@example.test');return 4;},
    heartbeat:async(_db,ok,processed)=>{sequence.push('heartbeat');heartbeats.push({ok,processed});if(options.heartbeatError)throw new Error('secret RPC payload');},reportFailure:code=>logs.push(code)});
  return {...f,sequence,heartbeats,logs,handler};
}
const jobRequest=(token='fixture-token')=>new Request('https://example.test',{method:'POST',headers:{authorization:`Bearer ${token}`}});
Deno.test('job heartbeat cannot be forged through method token or authorization checks',async()=>{
  const f=jobFixture({authorized:false});assert.equal((await f.handler(new Request('https://example.test'))).status,405);assert.equal((await f.handler(jobRequest(''))).status,401);assert.equal((await f.handler(jobRequest('x'.repeat(201)))).status,401);assert.equal((await f.handler(jobRequest())).status,401);
  assert.equal(f.sequence.length,0);assert.deepEqual(f.calls,[{name:'rr_job_authorized',args:{p_hash:'a'.repeat(64)}}]);
});
Deno.test('completed jobs record heartbeat afterward without changing processing result',async()=>{
  const f=jobFixture();const response=await f.handler(jobRequest());assert.deepEqual(await response.json(),{processed:4});assert.deepEqual(f.sequence,['work','heartbeat']);assert.deepEqual(f.heartbeats,[{ok:true,processed:4}]);assert.equal(response.headers.get('Cache-Control'),'no-store');
});
Deno.test('default heartbeat writes only the fixed status and integer count through its server RPC',async()=>{
  const f=fixture();const handler=createMarketplaceJobsHandler({database:()=>f.db,fingerprint:async()=> 'a'.repeat(64),run:async()=>2});
  const response=await handler(jobRequest());assert.equal(response.status,200);
  assert.deepEqual(f.calls,[{name:'rr_job_authorized',args:{p_hash:'a'.repeat(64)}},{name:'rr_ops_heartbeat',args:{p_ok:true,p_processed:2}}]);assert.equal(f.writes.length,0);
});
Deno.test('heartbeat failure cannot skip jobs or turn completed work into an HTTP error',async()=>{
  const f=jobFixture({heartbeatError:true});const response=await f.handler(jobRequest());assert.equal(response.status,200);assert.deepEqual(f.sequence,['work','heartbeat']);assert.deepEqual(f.logs,['rr_marketplace_heartbeat_failed']);assert.doesNotMatch(JSON.stringify(f.logs),/secret|payload/);
});
Deno.test('worker failure records a fixed failed heartbeat and redacts the exception',async()=>{
  const f=jobFixture({runError:true,heartbeatError:true});const response=await f.handler(jobRequest());assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'Verification run deferred'});assert.deepEqual(f.heartbeats,[{ok:false,processed:0}]);assert.deepEqual(f.logs,['rr_marketplace_heartbeat_failed']);
});
Deno.test('hung heartbeat is bounded after processing and its request is aborted',async()=>{
  const f=fixture();let worked=false,aborted=false;const logs:string[]=[];
  const handler=createMarketplaceJobsHandler({database:()=>f.db,run:async()=>{worked=true;return 1;},fingerprint:async()=> 'a'.repeat(64),heartbeatTimeoutMs:5,
    heartbeat:async(_db,_ok,_processed,signal)=>{assert.equal(worked,true);signal.addEventListener('abort',()=>{aborted=true;});await new Promise(()=>{});},reportFailure:code=>logs.push(code)});
  const response=await handler(jobRequest());assert.equal(response.status,200);assert.equal(aborted,true);assert.deepEqual(logs,['rr_marketplace_heartbeat_failed']);
});
Deno.test('database initialization failures and invalid job counts are sanitized',async()=>{
  const initial=createMarketplaceJobsHandler({database:()=>{throw new Error('service secret');}});const response=await initial(jobRequest());assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/secret/);
  const f=fixture();const heartbeats:boolean[]=[];const handler=createMarketplaceJobsHandler({database:()=>f.db,fingerprint:async()=> 'a'.repeat(64),run:async()=>Infinity,heartbeat:async(_db,ok)=>{heartbeats.push(ok);}});
  assert.equal((await handler(jobRequest())).status,503);assert.deepEqual(heartbeats,[false]);
});
