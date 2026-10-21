// Offline HTTP boundary tests: real handler + injected identity/database doubles.
// These do not claim Google login, JWT signatures, or hosted RLS were tested.
import assert from 'node:assert/strict';
import { createMarketplaceHandler } from '../supabase/functions/_shared/marketplace-handler.ts';
import { authenticated, transactionViews, capabilityView } from '../supabase/functions/_shared/marketplace.ts';
import {startCheckout,startWithdrawal} from '../supabase/functions/_shared/marketplace-payments.ts';
import { ProviderError } from '../supabase/functions/_shared/instagram.ts';

const actor='10000000-0000-4000-8000-000000000001';
const foreign='10000000-0000-4000-8000-000000000002';
const session='10000000-0000-4000-8000-000000000003';
type Call={name:string;args:Record<string,unknown>};
type QueryCall={table:string;method:string;args:unknown[]};
function fixture(type='worker',admin=false,aal='aal1') {
  const calls:Call[]=[];const queries:QueryCall[]=[];
  const tables:Record<string,unknown>={};
  let rpcResult:unknown={id:actor};let rpcError:unknown=null;
  const db={
    auth:{getClaims:async()=>({data:{claims:{aal,session_id:session}},error:null})},
    rpc:async(name:string,args:Record<string,unknown>={})=>{calls.push({name,args});return {data:rpcResult,error:rpcError};},
    from:(table:string)=>{
      const q:Record<string,unknown>={then:(resolve:(r:unknown)=>unknown)=>Promise.resolve({data:tables[table]??null,error:null}).then(resolve)};
      for(const method of ['select','eq','in','or','order','limit','range','is','neq','not','like','ilike','single','maybeSingle']) q[method]=(...args:unknown[])=>{queries.push({table,method,args});return q;};
      return q;
    },
  };
  const auth={db,user:{id:actor,email:'fixture@example.test'},token:'fixture-token',profile:{account_type:type,display_name:'Fixture'},admin} as unknown as Awaited<ReturnType<typeof authenticated>>;
  const handler=createMarketplaceHandler({authenticate:async()=>auth,rateLimit:async()=>{}});
  return {calls,queries,auth,handler,setResult:(data:unknown,error:unknown=null)=>{rpcResult=data;rpcError=error;},setTable:(name:string,data:unknown)=>{tables[name]=data;}};
}
function request(body:unknown,origin='https://www.realreach.com.ng') {
  return new Request('https://example.test/realreach-marketplace',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
}
async function status(f:ReturnType<typeof fixture>,body:unknown,expected:number) {
  const response=await f.handler(request(body));assert.equal(response.status,expected);return await response.json();
}
async function providerConfigured(fn:()=>Promise<void>) {
  const values={POCKETFI_API_TOKEN:'offline-fixture-token',POCKETFI_BUSINESS_ID:'offline-fixture-business',ROCKET_API_KEY:'offline-fixture-key'};
  const prior=Object.fromEntries(Object.keys(values).map(key=>[key,Deno.env.get(key)]));
  for(const [key,value] of Object.entries(values))Deno.env.set(key,value);
  try{await fn();}finally{for(const [key,value] of Object.entries(prior))value===undefined?Deno.env.delete(key):Deno.env.set(key,value);}
}

Deno.test('HTTP methods and disallowed origins never invoke identity',async()=>{
  let used=false;const h=createMarketplaceHandler({authenticate:async()=>{used=true;throw new Error();}});
  assert.equal((await h(new Request('https://example.test',{method:'GET'}))).status,405);
  const preflight=await h(new Request('https://example.test',{method:'OPTIONS',headers:{Origin:'https://attacker.test'}}));
  assert.equal(preflight.status,200);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),null);
  assert.equal((await h(request({action:'workspace'},'https://attacker.test'))).status,403);assert.equal(used,false);
});
Deno.test('HTTP malformed and oversized requests fail before database access',async()=>{
  const f=fixture();assert.equal((await f.handler(new Request('https://example.test',{method:'POST',body:'{'}))).status,400);
  await status(f,{action:'workspace',padding:'a'.repeat(17000)},413);await status(f,{},400);await status(f,null,400);assert.equal(f.calls.length,0);
});
Deno.test('HTTP protected actions propagate missing or invalid identity as401',async()=>{
  const h=createMarketplaceHandler({authenticate:async()=>{throw new ProviderError(401,'Sign in');}});
  assert.equal((await h(request({action:'workspace',user_id:actor,admin:true}))).status,401);
});
Deno.test('HTTP workspace ignores client actor and role fields',async()=>{
  const f=fixture();let actual='';
  const h=createMarketplaceHandler({authenticate:async()=>f.auth,rateLimit:async()=>{},getWorkspace:async(_db,owner)=>{actual=owner;return {owner} as never;}});
  assert.equal((await h(request({action:'workspace',actor:foreign,account_type:'business',admin:true}))).status,200);assert.equal(actual,actor);
});
Deno.test('HTTP workers cannot invoke business writes or scoped business lists',async()=>{
  const f=fixture();for(const action of ['campaign-save','campaign-quote','campaign-publish','campaign-detail','business-save','payment-create'])await status(f,{action,id:actor},403);
  await status(f,{action:'campaign-state',id:actor,state:'live'},403);await status(f,{action:'list',resource:'campaigns'},403);assert.equal(f.calls.length,0);
});
Deno.test('HTTP businesses cannot claim, submit, withdraw, or list worker assignments',async()=>{
  const f=fixture('business');for(const action of ['task-detail','task-claim','task-check','task-cancel','banks','bank-verify','withdraw'])await status(f,{action,id:actor},403);
  await status(f,{action:'list',resource:'assignments'},403);assert.equal(f.calls.length,0);
});
Deno.test('HTTP client-supplied role or email cannot grant administration',async()=>{
  const f=fixture();await status(f,{action:'admin-settings',admin:true,email:'admin@realreach.com.ng',aal:'aal2'},403);assert.equal(f.calls.length,0);
});
Deno.test('HTTP singleton admin must have verified AAL2',async()=>{
  const f=fixture('worker',true,'aal1');await status(f,{action:'admin-settings',aal:'aal2'},403);assert.equal(f.calls.length,0);
});
Deno.test('HTTP AAL2 admin uses server actor and explicit settings only',async()=>{
  const f=fixture('worker',true,'aal2');await status(f,{action:'admin-settings',actor:foreign,settings:{approved:false,p_actor:foreign}},200);
  assert.equal(f.calls[0].name,'rr_market_admin');assert.equal(f.calls[0].args.p_actor,actor);assert.deepEqual(f.calls[0].args.p_input,{approved:false,p_actor:foreign});
});
Deno.test('HTTP invalid money cannot create a funding intent',async()=>providerConfigured(async()=>{
  const f=fixture('business');for(const amount_kobo of [-1,0,1.5,9999,1000000001,Number.MAX_SAFE_INTEGER,'10000',null])await status(f,{action:'payment-create',amount_kobo,idempotency_key:'safe_fixture_key',phone:'08012345678'},400);
  await status(f,{action:'payment-create',amount_kobo:10000,idempotency_key:'safe_fixture_key'},400);assert.equal(f.calls.length,0);
}));
Deno.test('HTTP withdrawals reject fractional naira and invalid beneficiary IDs before debit',async()=>providerConfigured(async()=>{
  const f=fixture();await status(f,{action:'withdraw',amount_kobo:10001,idempotency_key:'safe_fixture_key',beneficiary_id:actor},400);
  await status(f,{action:'withdraw',amount_kobo:10000,idempotency_key:'safe_fixture_key',beneficiary_id:'bad'},400);assert.equal(f.calls.length,0);
}));
Deno.test('HTTP payment refresh always scopes lookup to verified owner',async()=>providerConfigured(async()=>{
  const f=fixture();await status(f,{action:'payment-refresh',id:foreign,owner_id:foreign},404);
  assert.ok(f.queries.some(q=>q.table==='rr_payments'&&q.method==='eq'&&q.args[0]==='owner_id'&&q.args[1]===actor));assert.equal(f.calls.length,0);
}));
Deno.test('HTTP withdrawal requires explicit fee and terms consent before any database command',async()=>providerConfigured(async()=>{
  const f=fixture();const base={action:'withdraw',amount_kobo:10000,idempotency_key:'safe_fixture_key',beneficiary_id:actor};
  for(const consent of [{},{expected_fee_kobo:-1,terms_version:'v1'},{expected_fee_kobo:0},{expected_fee_kobo:0,terms_version:''}])await status(f,{...base,...consent},409);
  assert.equal(f.calls.length,0);
  f.setTable('rr_settings',{collections_enabled:true,payouts_enabled:true,payouts_paused:false});
  f.setResult(null,{code:'P0001',message:'Withdrawal terms changed. Review the current fee before continuing'});
  await status(f,{...base,expected_fee_kobo:500,terms_version:'accepted-v1'},409);
  assert.equal((f.calls[0].args.p_input as Record<string,unknown>).expected_fee_kobo,500);assert.equal((f.calls[0].args.p_input as Record<string,unknown>).terms_version,'accepted-v1');
}));
Deno.test('HTTP payment lists expose explicit fields and owner/direction filters',async()=>{
  const f=fixture();await status(f,{action:'list',resource:'payments',filter:'payout',owner_id:foreign},200);
  assert.ok(f.queries.some(q=>q.method==='eq'&&q.args[0]==='owner_id'&&q.args[1]===actor));
  assert.ok(f.queries.some(q=>q.method==='eq'&&q.args[0]==='direction'&&q.args[1]==='payout'));
  assert.ok(f.queries.some(q=>q.method==='select'&&String(q.args[0]).includes('checkout_url')&&!String(q.args[0]).includes('account_number')));
});
Deno.test('payment launch capabilities stay off with configured keys unless each gate is explicitly true',async()=>providerConfigured(async()=>{
  assert.equal(capabilityView({approved:true,payouts_paused:false}).payments,false);assert.equal(capabilityView({approved:true,payouts_paused:false}).payouts,false);
  const c=capabilityView({collections_enabled:true,payouts_enabled:false,payouts_paused:false});assert.equal(c.payments,true);assert.equal(c.payouts,false);
}));
Deno.test('disabled launch gates deny valid payment and withdrawal requests before command or provider',async()=>providerConfigured(async()=>{
  const b=fixture('business');b.setTable('rr_settings',{collections_enabled:false,payouts_enabled:false,payouts_paused:false});
  await status(b,{action:'payment-create',amount_kobo:10000,idempotency_key:'gated_collection',phone:'08012345678'},503);assert.equal(b.calls.length,0);
  const w=fixture();w.setTable('rr_settings',{collections_enabled:false,payouts_enabled:false,payouts_paused:false});
  await status(w,{action:'withdraw',amount_kobo:10000,idempotency_key:'gated_withdrawal',beneficiary_id:actor,expected_fee_kobo:0,terms_version:'v1'},503);assert.equal(w.calls.length,0);
}));
Deno.test('direct checkout replay and payout start cannot bypass launch gates',async()=>providerConfigured(async()=>{
  const f=fixture();f.setTable('rr_settings',{collections_enabled:false,payouts_enabled:false,payouts_paused:false});
  await assert.rejects(()=>startCheckout(f.auth.db,{id:actor,checkout_url:'https://checkout.example.test/old'},{email:'fixture@example.test',name:'Fixture',phone:'08012345678'}),e=>e instanceof ProviderError&&e.status===503);
  await assert.rejects(()=>startWithdrawal(f.auth.db,{id:actor}),e=>e instanceof ProviderError&&e.status===503);assert.equal(f.calls.length,0);
}));
Deno.test('HTTP internal verification and arbitrary admin commands are not exposed',async()=>{
  const f=fixture();await status(f,{action:'instagram-confirm',id:actor,instagram_id:'123'},400);await status(f,{action:'rr_market_finish_payment',p_state:'succeeded'},400);
  const a=fixture('worker',true,'aal2');await status(a,{action:'admin-credit-wallet',amount_kobo:900000},400);assert.equal(f.calls.length+a.calls.length,0);
});
Deno.test('HTTP transaction filters apply to owner-scoped inner joined journals',async()=>{
  for(const filter of ['reserve','withdrawal','deposit','reward']) {
    const f=fixture();f.setTable('rr_ledger_accounts',[{id:actor}]);
    await status(f,{action:'list',resource:'transactions',filter},200);
    assert.ok(f.queries.some(q=>q.table==='rr_ledger_accounts'&&q.method==='eq'&&q.args[0]==='owner_id'&&q.args[1]===actor));
    assert.ok(f.queries.some(q=>q.table==='rr_ledger_entries'&&q.method==='in'&&q.args[0]==='account_id'));
    assert.ok(f.queries.some(q=>q.method==='select'&&String(q.args[0]).includes('rr_journals!inner')));
    if(filter==='withdrawal')assert.ok(f.queries.some(q=>q.method==='like'&&q.args[0]==='rr_journals.reference'&&q.args[1]==='withdraw-hold:%'));
    else assert.ok(f.queries.some(q=>q.method==='eq'&&q.args[0]==='rr_journals.kind'&&q.args[1]===filter));
    if(filter==='reserve')assert.ok(f.queries.some(q=>q.method==='not'&&q.args[0]==='rr_journals.reference'));
  }
});
Deno.test('withdrawal journal projection preserves unknown provider status, not completed',async()=>{
  const f=fixture();f.setTable('rr_payments',[{id:foreign,status:'unknown',reference:'RR-fixture'}]);
  const rows=await transactionViews(f.auth.db,actor,[{id:session,amount_kobo:-10500,created_at:'2026-10-21T00:00:00Z',rr_journals:{kind:'reserve',label:'Withdrawal reserved',reference:`withdraw-hold:${foreign}`}}]);
  assert.equal(rows[0].kind,'withdrawal');assert.equal(rows[0].status,'unknown');assert.equal(rows[0].amount_kobo,-10500);assert.equal(rows[0].reference,'RR-fixture');
});
Deno.test('HTTP SQL details are redacted, intentional application messages remain visible',async()=>{
  const f=fixture('business');f.setResult(null,{code:'XX000',message:'SECRET_DATABASE_DETAIL'});
  const body=await status(f,{action:'business-save',name:'Valid business'},409);assert.equal(JSON.stringify(body).includes('SECRET_DATABASE_DETAIL'),false);
  f.setResult(null,{code:'P0001',message:'Choose a business name'});assert.equal((await status(f,{action:'business-save'},409)).error,'Choose a business name');
});
Deno.test('HTTP rate limits stop commands without falling through',async()=>{
  const f=fixture();const h=createMarketplaceHandler({authenticate:async()=>f.auth,rateLimit:async()=>{throw new ProviderError(429,'Wait');}});
  assert.equal((await h(request({action:'case-create',subject:'Help'}))).status,429);assert.equal(f.calls.length,0);
});

function identityFixture(options:{session?:unknown;sessionValid?:boolean;claimsError?:boolean;profile?:unknown;admin?:boolean}={}) {
  const calls:Call[]=[];
  const identity=async()=>({user:{id:actor},token:'not-a-real-token',db:{
    auth:{getClaims:async()=>({data:{claims:{session_id:options.session??session}},error:options.claimsError?{}:null})},
    rpc:async(name:string,args:Record<string,unknown>)=>{calls.push({name,args});return {data:options.sessionValid??true,error:null};},
    from:(table:string)=>{const value=table==='profiles'?(options.profile===undefined?{account_type:'worker',display_name:'Fixture'}:options.profile):(options.admin?{user_id:actor}:null);const q={select:()=>q,eq:()=>q,single:async()=>({data:value,error:null}),maybeSingle:async()=>({data:value,error:null})};return q;},
  }}) as unknown as Awaited<ReturnType<Parameters<typeof authenticated>[1] extends (...args:never[])=>infer R?()=>R:never>>;
  return {calls,identity:identity as NonNullable<Parameters<typeof authenticated>[1]>};
}
Deno.test('session guard rejects revoked sessions and binds session lookup to verified user',async()=>{
  const f=identityFixture({sessionValid:false});await assert.rejects(()=>authenticated(request({}),f.identity),error=>error instanceof ProviderError&&error.status===401);
  assert.deepEqual(f.calls[0],{name:'rr_market_session',args:{p_actor:actor,p_session:session}});
});
Deno.test('session guard rejects malformed or unverified claims before session lookup',async()=>{
  for(const options of [{session:'fake'}, {claimsError:true}]){const f=identityFixture(options);await assert.rejects(()=>authenticated(request({}),f.identity),error=>error instanceof ProviderError&&error.status===401);assert.equal(f.calls.length,0);}
});
Deno.test('session guard requires a profile and completed fixed account type',async()=>{
  for(const profile of [null,{account_type:null}]){const f=identityFixture({profile});await assert.rejects(()=>authenticated(request({}),f.identity),error=>error instanceof ProviderError&&error.status===409);}
  assert.equal((await authenticated(request({}),identityFixture({profile:{account_type:null},admin:true}).identity)).admin,true);
});
