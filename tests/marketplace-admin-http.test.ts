// Offline real-handler tests. No provider traffic or hosted database access.
import assert from 'node:assert/strict';
import {createMarketplaceHandler} from '../supabase/functions/_shared/marketplace-handler.ts';
import {type authenticated} from '../supabase/functions/_shared/marketplace.ts';
import {readRecordCursor,writeRecordCursor} from '../supabase/functions/_shared/marketplace-cursor.ts';

const id='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
type Trace={table:string;method:string;args:unknown[]};
function fixture(admin=true,aal='aal2') {
  const tables:Record<string,unknown>={},queries:Trace[]=[],rpcs:Array<{name:string;args:unknown}>=[];
  const db={auth:{getClaims:async()=>({data:{claims:{aal}},error:null})},
    rpc:async(name:string,args:unknown)=>{rpcs.push({name,args});return {data:{ok:true},error:null};},
    from:(table:string)=>{const local:Trace[]=[];const q:Record<string,unknown>={then:(resolve:(r:unknown)=>unknown)=>Promise.resolve({data:typeof tables[table]==='function'?(tables[table] as (trace:Trace[])=>unknown)(local):tables[table]??null,error:null}).then(resolve)};
      for(const method of ['select','eq','in','or','order','limit','range','is','neq','not','like','ilike','single','maybeSingle','insert'])q[method]=(...args:unknown[])=>{const trace={table,method,args};queries.push(trace);local.push(trace);return q;};return q;}};
  const auth={db,user:{id,email:'operator@example.test'},token:'offline',profile:{account_type:'worker',display_name:'Operator'},admin} as unknown as Awaited<ReturnType<typeof authenticated>>;
  const handler=createMarketplaceHandler({authenticate:async()=>auth,rateLimit:async()=>{}});
  const send=async(body:unknown,status=200)=>{const response=await handler(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));assert.equal(response.status,status);return response.json();};
  return {tables,queries,rpcs,send};
}
const payment={id,owner_id:other,direction:'payout',reference:'RR-ORIGINAL',provider_id:null,amount_kobo:'10000',fee_kobo:'500',currency:'NGN',status:'unknown',created_at:'2026-10-21T10:00:00.123456+00:00',submitted_at:'2026-10-21T10:00:01Z',checked_at:null,beneficiary_id:other};
async function configured(fn:()=>Promise<void>) {
  const names=['POCKETFI_API_TOKEN','POCKETFI_BUSINESS_ID'],saved=names.map(name=>Deno.env.get(name));
  names.forEach(name=>Deno.env.set(name,'isolated-fixture'));
  try{await fn();}finally{names.forEach((name,index)=>saved[index]===undefined?Deno.env.delete(name):Deno.env.set(name,saved[index]!));}
}

Deno.test('admin recovery/read actions reject customers before any database access',async()=>{
  const f=fixture(false);for(const action of ['admin-list','admin-detail','admin-history','admin-assignment-close','admin-payment-recheck'])await f.send({action,admin:true,aal:'aal2',id},403);
  assert.equal(f.queries.length,0);assert.equal(f.rpcs.length,0);
});
Deno.test('every new operator action requires actual AAL2 even for singleton admin',async()=>{
  const f=fixture(true,'aal1');for(const action of ['admin-list','admin-detail','admin-history','admin-assignment-close','admin-payment-recheck'])await f.send({action,id,aal:'aal2'},403);
  assert.equal(f.queries.length,0);assert.equal(f.rpcs.length,0);
});
Deno.test('admin list rejects unsupported resources filters and oversized searches',async()=>{
  const f=fixture();await f.send({action:'admin-list',resource:'auth.users'},400);await f.send({action:'admin-list',resource:'payments',filter:'refunded'},400);await f.send({action:'admin-list',resource:'cases',query:'x'.repeat(101)},400);assert.equal(f.queries.length,0);
});
Deno.test('admin payment pagination is bounded and preserves PostgreSQL microseconds',async()=>{
  const f=fixture();f.tables.rr_admin_payment_view=Array.from({length:51},(_,i)=>({...payment,beneficiary_id:undefined,id:`10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,risk_held:i===0}));f.tables.profiles=[{id:other,display_name:'Owner',account_type:'worker'}];
  const result=await f.send({action:'admin-list',resource:'payments'});assert.equal(result.items.length,50);assert.equal(result.items[0].amount_kobo,10000);assert.equal(result.items[0].owner.display_name,'Owner');
  assert.equal(readRecordCursor(result.next_cursor)?.at,payment.created_at);assert.ok(f.queries.some(q=>q.method==='limit'&&q.args[0]===51));
  const select=f.queries.find(q=>q.table==='rr_admin_payment_view'&&q.method==='select')?.args[0] as string;
  assert.doesNotMatch(select,/account_number|checkout_url|idempotency_key|\*/);
});
Deno.test('attention and cursor constraints are ANDed; settled payments with holds remain visible',async()=>{
  const f=fixture();await f.send({action:'admin-list',resource:'payments',filter:'attention',cursor:writeRecordCursor(payment)});
  const filters=f.queries.filter(q=>q.method==='or');assert.equal(filters.length,1);const expression=String(filters[0].args[0]);
  assert.match(expression,/^and\(or\(created_at/);assert.match(expression,/status.in.\(created,pending,unknown\),risk_held.eq.true/);assert.ok(expression.includes('.123456+00:00'));
});
Deno.test('cursor rejects PostgREST expression injection and invalid identifiers',()=>{
  for(const at of ['2026-10-21T10:00:00Z),id.neq.x','today','2026-10-21'])assert.throws(()=>readRecordCursor(btoa(JSON.stringify({at,id}))));
  assert.throws(()=>readRecordCursor(btoa(JSON.stringify({at:payment.created_at,id:'-'.repeat(36)}))));
  assert.deepEqual(readRecordCursor(writeRecordCursor(payment)),{at:payment.created_at,id});
});
Deno.test('admin search treats wildcard characters literally and combines check UUID constraints',async()=>{
  const f=fixture();await f.send({action:'admin-list',resource:'payments',query:'50%_paid'});
  assert.ok(f.queries.some(q=>q.method==='ilike'&&q.args[1]==='%50\\%\\_paid%'));
  await f.send({action:'admin-list',resource:'checks',query:id,cursor:writeRecordCursor(payment)});
  const filter=String(f.queries.filter(q=>q.table==='rr_jobs'&&q.method==='or')[0].args[0]);assert.match(filter,/and\(or\(created_at/);assert.ok(filter.includes(`assignment_id.eq.${id}`));
});
Deno.test('payment investigation exposes masked recipient and no raw bank credentials',async()=>{
  const f=fixture();f.tables.rr_payments=payment;f.tables.rr_beneficiaries={bank_name:'Fixture Bank',account_name:'Test Worker',account_number:'0123456789'};
  f.tables.profiles={id:other,display_name:'Test Worker',account_type:'worker'};f.tables.rr_payment_risk_holds={id:other,payment_id:id,reason:'Review',created_at:payment.created_at};
  const result=await f.send({action:'admin-detail',resource:'payment',id});assert.deepEqual(result.beneficiary,{bank_name:'Fixture Bank',account_name:'Test Worker',account_last4:'6789'});
  assert.equal(result.payment.amount_kobo,10000);assert.equal(result.payment.beneficiary_id,undefined);assert.doesNotMatch(JSON.stringify(result),/0123456789/);assert.equal(result.risk_hold.payment_id,id);assert.match(result.recovery_note,/does not automatically clear/);
  assert.ok(f.queries.some(q=>q.table==='rr_beneficiaries'&&q.method==='eq'&&q.args[0]==='owner_id'&&q.args[1]===other));
});
Deno.test('unknown or missing investigation targets fail explicitly',async()=>{
  const f=fixture();await f.send({action:'admin-detail',resource:'user',id},400);await f.send({action:'admin-detail',resource:'payment',id:'not-id'},400);await f.send({action:'admin-detail',resource:'payment',id},404);await f.send({action:'admin-detail',resource:'task',id},404);
});
Deno.test('task closure requires an explicit phrase and reason, strips arbitrary payment claims',async()=>{
  const f=fixture();await f.send({action:'admin-assignment-close',id,reason:'Reviewed carefully'},400);await f.send({action:'admin-assignment-close',id,confirmation:'CLOSE WITHOUT PAYMENT',reason:'short'},400);
  await f.send({action:'admin-assignment-close',id,confirmation:'CLOSE WITHOUT PAYMENT',reason:'  Evidence remains unavailable after review.  ',p_actor:other,amount_kobo:999999,verified:true});
  assert.deepEqual(f.rpcs,[{name:'rr_market_admin',args:{p_actor:id,p_action:'admin-assignment-close',p_input:{id,reason:'Evidence remains unavailable after review.'}}}]);
});
Deno.test('lost-reference recheck is audited but cannot bind, refund or dispatch',async()=>configured(async()=>{
  const f=fixture();f.tables.rr_payments=payment;
  const result=await f.send({action:'admin-payment-recheck',id,provider_reference:'PFI|1234567'});
  assert.equal(result.outcome,'provider_support_required');assert.equal(f.rpcs.length,0);
  const writes=f.queries.filter(q=>q.method==='insert');assert.equal(writes.length,2);assert.ok(writes.every(q=>q.table==='rr_audit'));
  const recorded=writes[0].args[0] as Record<string,unknown>;assert.equal(recorded.actor_id,id);assert.equal(recorded.reference,id);
}));
Deno.test('unknown administrative money override remains unavailable',async()=>{
  const f=fixture();await f.send({action:'admin-force-paid',id,amount_kobo:10000},400);await f.send({action:'admin-clear-hold',id},400);assert.equal(f.rpcs.length,0);
});

const third='10000000-0000-4000-8000-000000000003',fourth='10000000-0000-4000-8000-000000000004';
const uid=(value:number)=>`10000000-0000-4000-8000-${String(value).padStart(12,'0')}`;
const supportCase=(reference:string|null,owner_id=other)=>({id:crypto.randomUUID(),owner_id,reference,subject:'Help with this record',message:'Please review',status:'open',created_at:payment.created_at});
const campaign={id:third,owner_id:fourth,business_id:fourth,title:'Fixture campaign',action:'follow',status:'live',target_url:'https://www.instagram.com/fixture/',target_username:'fixture',target_id:'999',quantity:10,unit_reward_kobo:'10000',unit_fee_kobo:'500',reserved_kobo:'105000',spent_kobo:'0',created_at:payment.created_at,terms_version:1};
const assignment={id,worker_id:other,campaign_id:third,instagram_id:'123456789',status:'needs_review',phase:'initial',reward_kobo:'10000',fee_kobo:'500',created_at:payment.created_at};
function taskFixture(){
  const f=fixture();f.tables.rr_assignments=assignment;f.tables.rr_campaigns=campaign;
  f.tables.profiles=[{id:other,display_name:'Worker',account_type:'worker'},{id:fourth,display_name:'Business owner',account_type:'business'}];
  f.tables.businesses={name:'Fixture business'};return f;
}

Deno.test('support references resolve payment task and campaign without assuming every UUID is a payment',async()=>{
  const f=fixture();f.tables.rr_cases=[supportCase(id),supportCase(third),supportCase(third,fourth),supportCase(fourth)];
  f.tables.rr_payments=[{...payment,id,owner_id:other}];
  f.tables.rr_assignments=[{id:third,worker_id:other,campaign_id:fourth}];
  f.tables.rr_campaigns=[{id:fourth,owner_id:other},{id:uid(5),owner_id:fourth}];
  const result=await f.send({action:'admin-list',resource:'cases'});
  assert.deepEqual(result.items.map((row:Record<string,unknown>)=>row.related_record),[{resource:'payment',id},{resource:'task',id:third},null,{resource:'campaign',id:fourth}]);
  assert.deepEqual(result.items.map((row:Record<string,unknown>)=>row.reference_resolution),['resolved','resolved','unavailable','resolved']);
  assert.equal(f.rpcs.length,0);assert.ok(f.queries.some(q=>q.table==='rr_payments'&&q.method==='in'&&q.args[0]==='owner_id'));
});
Deno.test('a business case may resolve its own worker assignment but cannot resolve another business assignment',async()=>{
  const f=fixture();f.tables.rr_cases=[supportCase(id,fourth),supportCase(id,uid(8))];f.tables.rr_assignments=[assignment];f.tables.rr_campaigns=[campaign];
  const result=await f.send({action:'admin-list',resource:'cases'});
  assert.deepEqual(result.items[0].related_record,{resource:'task',id});assert.equal(result.items[1].related_record,null);
});
Deno.test('foreign-owned malformed empty and ambiguous support references never create guessed links',async()=>{
  const f=fixture();f.tables.rr_cases=[supportCase(id),supportCase(third),supportCase('https://example.test/payments/anything'),supportCase(null)];
  f.tables.rr_payments=[{id,owner_id:fourth},{id:third,owner_id:other}];f.tables.rr_assignments=[{id:third,worker_id:other,campaign_id:fourth}];f.tables.rr_campaigns=[];
  const result=await f.send({action:'admin-list',resource:'cases'});
  assert.ok(result.items.every((row:Record<string,unknown>)=>row.related_record===null));
  assert.deepEqual(result.items.map((row:Record<string,unknown>)=>row.reference_resolution),['unavailable','ambiguous','unavailable','missing']);
  assert.ok(!f.queries.some(q=>JSON.stringify(q.args).includes('https://example.test')));
});
Deno.test('historic internal and provider payment references still require the exact case owner',async()=>{
  const internal=`RR-${'a'.repeat(32)}`,provider='PFI|123456789';const f=fixture();
  f.tables.rr_cases=[supportCase(internal),supportCase(provider),supportCase(provider,fourth)];
  f.tables.rr_payments=[{...payment,reference:internal,provider_id:provider}];
  const result=await f.send({action:'admin-list',resource:'cases'});
  assert.deepEqual(result.items.map((row:Record<string,unknown>)=>row.related_record),[{resource:'payment',id},{resource:'payment',id},null]);
  assert.ok(f.queries.some(q=>q.table==='rr_payments'&&q.method==='in'&&q.args[0]==='provider_id'));
});
Deno.test('task investigation uses the stable Instagram registry and does not borrow a replacement username',async()=>{
  const f=taskFixture();f.tables.rr_instagram_registry={instagram_id:assignment.instagram_id,user_id:other};
  f.tables.rr_instagram_accounts={instagram_id:assignment.instagram_id,user_id:other,username:'verified.worker'};
  let result=await f.send({action:'admin-detail',resource:'task',id});
  assert.deepEqual(result.worker_instagram,{instagram_id:assignment.instagram_id,username:'verified.worker'});
  assert.ok(f.queries.some(q=>q.table==='rr_instagram_registry'&&q.method==='eq'&&q.args[0]==='user_id'&&q.args[1]===other));
  f.tables.rr_instagram_accounts={instagram_id:'987654321',user_id:other,username:'replacement.worker'};
  result=await f.send({action:'admin-detail',resource:'task',id});assert.deepEqual(result.worker_instagram,{instagram_id:assignment.instagram_id,username:null});
  f.tables.rr_instagram_registry={instagram_id:assignment.instagram_id,user_id:fourth};
  result=await f.send({action:'admin-detail',resource:'task',id});assert.equal(result.worker_instagram,null);
  assert.equal(f.rpcs.length,0);assert.ok(!f.queries.some(q=>q.method==='insert'));
});
Deno.test('campaign investigation remains a read-only admin view with bounded history metadata',async()=>{
  const f=fixture();f.tables.rr_campaigns={...campaign,internal_only:'not for projection'};f.tables.profiles={id:fourth,display_name:'Owner',account_type:'business'};f.tables.businesses={name:'Fixture business'};
  const result=await f.send({action:'admin-detail',resource:'campaign',id:third});
  assert.equal(result.campaign.business_name,'Fixture business');assert.equal(result.campaign.internal_only,undefined);assert.equal(result.campaign.terms_version,1);
  assert.deepEqual(result.history_cursors,{cases:null,audit:null});assert.deepEqual(result.history_limits,{cases:50,audit:50});assert.equal(result.allowed_actions,undefined);assert.equal(f.rpcs.length,0);
});

function pagedRows(rows:Record<string,unknown>[],key='id') {
  return (trace:Trace[])=>{
    const expression=trace.find(q=>q.method==='or')?.args[0] as string|undefined;
    const boundary=expression?.match(new RegExp(`${key}\\.lt\\.([a-z0-9-]+)`))?.[1];
    return rows.filter(row=>!boundary||String(row[key])<boundary).slice(0,Number(trace.find(q=>q.method==='limit')?.args[0]??rows.length));
  };
}
Deno.test('older task evidence is parent-scoped and pages timestamp ties once without losing microseconds',async()=>{
  const f=taskFixture();const rows=Array.from({length:75},(_,i)=>({id:uid(100-i),checked_at:payment.created_at,actor_id:assignment.instagram_id,result:'unknown'}));
  f.tables.rr_evidence=pagedRows(rows);
  const first=await f.send({action:'admin-detail',resource:'task',id});assert.equal(first.evidence.length,50);assert.equal(first.history_limits.evidence,50);
  const decoded=JSON.parse(atob(first.history_cursors.evidence));assert.deepEqual(decoded,{v:1,resource:'task',parent:id,history:'evidence',at:payment.created_at,key:uid(51)});
  const older=await f.send({action:'admin-history',resource:'task',id,history:'evidence',cursor:first.history_cursors.evidence});
  assert.equal(older.items.length,25);assert.equal(older.next_cursor,null);assert.equal(new Set([...first.evidence,...older.items].map(row=>row.id)).size,75);
  const evidenceQueries=f.queries.filter(q=>q.table==='rr_evidence');assert.ok(evidenceQueries.filter(q=>q.method==='eq').every(q=>q.args[0]==='assignment_id'&&q.args[1]===id));
  assert.ok(evidenceQueries.some(q=>q.method==='or'&&String(q.args[0]).includes('checked_at.eq.2026-10-21T10:00:00.123456+00:00,id.lt.')));
  assert.ok(evidenceQueries.some(q=>q.method==='order'&&q.args[0]==='id'));assert.ok(evidenceQueries.filter(q=>q.method==='limit').every(q=>q.args[0]===51));assert.equal(f.rpcs.length,0);
});
Deno.test('older payment discrepancies use their hash tie breaker and retain the payment scope',async()=>{
  const f=fixture();f.tables.rr_payments=payment;const rows=Array.from({length:55},(_,i)=>({event_hash:(100-i).toString(16).padStart(64,'0'),reason:'Confirmation mismatch',created_at:payment.created_at}));
  f.tables.rr_payment_events=pagedRows(rows,'event_hash');
  const first=await f.send({action:'admin-history',resource:'payment',id,history:'events'});assert.equal(first.items.length,50);
  const older=await f.send({action:'admin-history',resource:'payment',id,history:'events',cursor:first.next_cursor});assert.equal(older.items.length,5);assert.equal(older.next_cursor,null);
  assert.equal(new Set([...first.items,...older.items].map(row=>row.event_hash)).size,55);
  assert.ok(f.queries.some(q=>q.table==='rr_payment_events'&&q.method==='eq'&&q.args[0]==='payment_id'&&q.args[1]===id));
  assert.ok(f.queries.some(q=>q.table==='rr_payment_events'&&q.method==='order'&&q.args[0]==='event_hash'));
});
Deno.test('history cursors reject cross-record replay cross-resource replay and query injection before database access',async()=>{
  const base={v:1,resource:'task',parent:id,history:'evidence',at:payment.created_at,key:other};
  for(const change of [{parent:other},{resource:'payment'},{history:'jobs'},{at:'2026-10-21T10:00:00Z),id.neq.x'},{key:'anything),or(id.neq.null)'},{v:2}]) {
    const f=fixture();await f.send({action:'admin-history',resource:'task',id,history:'evidence',cursor:btoa(JSON.stringify({...base,...change}))},400);assert.equal(f.queries.length,0);
  }
  const f=fixture();await f.send({action:'admin-history',resource:'payment',id,history:'events',cursor:btoa(JSON.stringify({...base,resource:'payment',history:'events'}))},400);assert.equal(f.queries.length,0);
});
Deno.test('invalid histories and missing parents fail without returning any unrelated records',async()=>{
  const f=fixture();for(const [resource,history] of [['task','events'],['payment','evidence'],['campaign','jobs'],['auth.users','audit']])await f.send({action:'admin-history',resource,history,id},400);
  assert.equal(f.queries.length,0);await f.send({action:'admin-history',resource:'payment',history:'events',id},404);
  assert.ok(!f.queries.some(q=>q.table==='rr_payment_events'));
});
Deno.test('case history is constrained by record reference and rightful owners including provider references',async()=>{
  const f=fixture();f.tables.rr_payments={...payment,provider_id:'PFI|123456789'};
  await f.send({action:'admin-history',resource:'payment',id,history:'cases'});
  assert.ok(f.queries.some(q=>q.table==='rr_cases'&&q.method==='in'&&q.args[0]==='reference'&&JSON.stringify(q.args[1])===JSON.stringify([id,payment.reference,'PFI|123456789'])));
  assert.ok(f.queries.some(q=>q.table==='rr_cases'&&q.method==='in'&&q.args[0]==='owner_id'&&JSON.stringify(q.args[1])===JSON.stringify([other])));
  const task=taskFixture();await task.send({action:'admin-history',resource:'task',id,history:'cases'});
  assert.ok(task.queries.some(q=>q.table==='rr_cases'&&q.method==='in'&&q.args[0]==='owner_id'&&JSON.stringify(q.args[1])===JSON.stringify([other,fourth])));
});
