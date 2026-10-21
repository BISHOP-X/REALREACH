// Isolated PostgreSQL/WASM checks. No Supabase URL, credential or live data used.
// Run: deno run --no-config --node-modules-dir=none --allow-read --allow-env --allow-sys tests/marketplace-database.mjs
import { PGlite } from 'npm:@electric-sql/pglite@0.5.11';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { predecessorSchema as schema } from './marketplace-db-fixture.mjs';

const db = new PGlite();
const sql = async (query, params=[]) => (await db.query(query,params)).rows;
let passed=0;
const test=async(name,fn)=>{await fn();passed++;console.log(`PASS ${name}`);};
const throws=async(fn,message)=>{await assert.rejects(fn,message);};
const call=async(name,args)=>{
 const keys=Object.keys(args);return (await sql(`select public.${name}(${keys.map((key,index)=>`${key} => $${index+1}`).join(',')}) result`,Object.values(args).map(value=>value&&typeof value==='object'&&!Array.isArray(value)?JSON.stringify(value):value)))[0]?.result;
};
const command=(actor,action,input={})=>call('rr_market_command',{p_actor:actor,p_action:action,p_input:input});
const actor=(number)=>`10000000-0000-4000-8000-${String(number).padStart(12,'0')}`;
const business=actor(1),worker=actor(2),worker2=actor(3),other=actor(4),admin=actor(5);
async function asRole(role,user,fn){await db.exec(`set role ${role}`);await sql("select set_config('request.jwt.claim.sub',$1,false)",[user??'']);try{return await fn();}finally{await db.exec('reset role');}}
async function quote(campaignId){
 const c=(await sql('select * from public.rr_campaigns where id=$1',[campaignId]))[0];
 const s=(await sql('select * from public.rr_settings'))[0];
 const total=c.quantity*Number(c.action==='follow'?s.follow_reward_kobo:s.comment_reward_kobo)+c.quantity*Number(c.action==='follow'?s.follow_fee_kobo:s.comment_fee_kobo);
 await sql('insert into public.rr_quotes(campaign_id,owner_id,campaign_updated_at,terms_version,total_kobo) values($1,$2,$3,$4,$5)',[c.id,c.owner_id,c.updated_at,s.terms_version,total]);
 return {id:c.id,target_id:c.owner_id===business?'111':'444',target_url:'https://www.instagram.com/testbusiness/',media_id:c.action==='comment'?'555':null,terms_version:s.terms_version,expected_updated_at:c.updated_at,expected_total_kobo:total};
}
async function draft(quantity=3,action='follow'){return (await command(business,'campaign-save',{title:'Test campaign',action,target_url:action==='follow'?'':'https://www.instagram.com/p/AbCdE123/',instructions:'A thoughtful, relevant comment.',quantity,ends_at:null})).id;}
async function leased(assignmentId,phase){
 await sql("update public.rr_jobs set due_at=now()-interval '1 minute' where assignment_id=$1 and phase=$2 and state='queued'",[assignmentId,phase]);
 await call('rr_market_lease',{p_limit:20});
 return (await sql("select * from public.rr_jobs where assignment_id=$1 and phase=$2 and state='running'",[assignmentId,phase]))[0];
}
const finish=(job,result,commentId=null)=>call('rr_market_finish_check',{p_job:job.id,p_lease:job.lease_id,p_result:result,p_reason:'Isolated provider observation fixture',p_comment_id:commentId});
const balance=async(owner,bucket='available')=>Number((await sql('select coalesce(sum(balance_kobo),0) balance from public.rr_ledger_accounts where owner_id=$1 and bucket=$2',[owner,bucket]))[0].balance);
try {
  await db.exec(schema);
  await sql("insert into auth.users(id,email,email_confirmed_at) values($1,'legacy@example.test',now())",[actor(99)]);
  await sql("insert into public.profiles(id,account_type,display_name) values($1,'business','Legacy business owner')",[actor(99)]);
  const legacyBusiness=(await sql("insert into public.businesses(owner_id,name) values($1,'Legacy company') returning id",[actor(99)]))[0].id;
  const legacyDraft=(await sql("insert into public.campaign_drafts(business_id,owner_id,title,action,quantity) values($1,$2,'Saved before migration','follow',7) returning id",[legacyBusiness,actor(99)]))[0].id;
  await db.exec(await readFile(new URL('../supabase/migrations/20261021165450_marketplace_production_core.sql',import.meta.url),'utf8'));
  await test('migration executes on PostgreSQL',async()=>assert.equal((await sql("select count(*)::int n from pg_tables where schemaname='public' and tablename like 'rr_%'"))[0].n>=17,true));
  await test('additive migration preserves real predecessor draft and profile',async()=>{const c=(await sql('select * from public.rr_campaigns where id=$1',[legacyDraft]))[0];assert.equal(c.title,'Saved before migration');assert.equal(c.quantity,7);assert.equal(c.status,'draft');assert.equal(c.reserved_kobo,0);assert.equal((await sql('select display_name from public.profiles where id=$1',[actor(99)]))[0].display_name,'Legacy business owner');});
  for (const [n,type] of [[1,'business'],[2,'worker'],[3,'worker'],[4,'business'],[5,'worker']]) {
    await sql("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",[actor(n),`test${n}@example.test`]);
    await sql('insert into public.profiles(id,account_type,display_name) values($1,$2,$3)',[actor(n),type,`Fixture ${n}`]);
  }
  await sql('insert into public.sole_admin(user_id) values($1)',[admin]);
  await sql('insert into auth.sessions(id,user_id) values($1,$2)',[actor(800),worker]);
  await test('service role has no direct auth table permission',async()=>asRole('service_role',null,()=>throws(()=>sql('select * from auth.users'),/permission denied/)));
  await test('narrow definer allows authenticated service commands without exposing auth rows',async()=>asRole('service_role',null,()=>command(business,'business-save',{name:'Test Business'})));
  await test('session checker rejects wrong owner and revoked/expired sessions',async()=>{assert.equal(await call('rr_market_session',{p_actor:worker,p_session:actor(800)}),true);assert.equal(await call('rr_market_session',{p_actor:worker2,p_session:actor(800)}),false);await sql("update auth.sessions set not_after=now()-interval '1 second'");assert.equal(await call('rr_market_session',{p_actor:worker,p_session:actor(800)}),false);});
  await command(business,'business-save',{name:'Test Business'});await command(other,'business-save',{name:'Other Business'});
  for(const [owner,ig,name] of [[business,'111','testbusiness'],[worker,'222','testworker'],[worker2,'333','testworker2'],[other,'444','otherbusiness']]) await sql("insert into public.rr_instagram_accounts(user_id,instagram_id,username,status,verified_at) values($1,$2,$3,'verified',now())",[owner,ig,name]);
  await test('prices start unapproved and no invented balances exist',async()=>{assert.equal((await sql('select approved from public.rr_settings'))[0].approved,false);assert.equal(await balance(business),0);});
  await test('all marketplace tables use RLS',async()=>assert.equal((await sql("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r' and relname like 'rr_%' and not relrowsecurity"))[0].n,0));
  await test('anonymous cannot run state commands',async()=>asRole('anon',null,()=>throws(()=>command(business,'business-save',{name:'Intruder'}),/permission denied/)));
  await test('authenticated cannot call service-only command with another actor',async()=>asRole('authenticated',worker,()=>throws(()=>command(business,'business-save',{name:'Intruder'}),/permission denied/)));
  await test('no authenticated financial/privileged function execution grants',async()=>{const rows=await sql("select p.oid::regprocedure::text f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where ((n.nspname='public' and proname like 'rr_market_%') or (n.nspname='private' and proname like 'rr_%')) and has_function_privilege('authenticated',p.oid,'execute')");assert.equal(rows.length,0);});
  await test('ordinary users cannot write balances directly',async()=>asRole('authenticated',worker,()=>throws(()=>sql("insert into public.rr_ledger_accounts(owner_id,bucket,reference_id,balance_kobo) values($1,'available',$1,999999)",[worker]),/permission denied/)));
  await test('worker cannot create a business campaign through service command',async()=>throws(()=>command(worker,'campaign-save',{title:'Intrusion',action:'follow',quantity:1}),/cannot perform/));
  const first=await draft();
  await test('owner reads own draft under actual database RLS',async()=>asRole('authenticated',business,async()=>assert.equal((await sql('select id from public.rr_campaigns where id=$1',[first])).length,1)));
  await test('different owner cannot read draft under actual database RLS',async()=>asRole('authenticated',other,async()=>assert.equal((await sql('select id from public.rr_campaigns where id=$1',[first])).length,0)));
  await test('different owner cannot edit draft',async()=>throws(()=>command(other,'campaign-save',{id:first,title:'Stolen',action:'follow',quantity:1}),/Only your/));
  await test('unapproved pricing cannot publish',async()=>throws(async()=>command(business,'campaign-publish',await quote(first)),/Pricing changed/));
  const prices={approved:true,follow_reward_kobo:10000,follow_fee_kobo:2000,comment_reward_kobo:15000,comment_fee_kobo:3000,retention_hours:1,claim_minutes:30,minimum_withdrawal_kobo:10000,withdrawal_fee_kobo:500,max_campaign_quantity:10000,payouts_paused:false};
  await test('ordinary actor cannot update commercial settings',async()=>throws(()=>call('rr_market_admin',{p_actor:worker,p_action:'admin-settings',p_input:prices}),/restricted/));
  await call('rr_market_admin',{p_actor:admin,p_action:'admin-settings',p_input:prices});
  await test('publish refuses insufficient confirmed money',async()=>throws(async()=>command(business,'campaign-publish',await quote(first)),/check constraint/));
  const payment=await command(business,'payment-create',{amount_kobo:300000,idempotency_key:'collection_fixture_1'});
  await sql('update public.rr_payments set provider_id=$2 where id=$1',[payment.id,'PFI|fixture123']);
  const settlePayment=(overrides={})=>call('rr_market_finish_payment',{p_id:payment.id,p_state:'succeeded',p_reference:payment.reference,p_amount:300000,p_currency:'NGN',p_provider_id:'PFI|fixture123',...overrides});
  await test('payment amount mismatch cannot credit money',async()=>throws(()=>settlePayment({p_amount:300001}),/details did not match/));
  await test('provider reference mismatch cannot credit money',async()=>throws(()=>settlePayment({p_provider_id:'PFI|wrong'}),/reference did not match/));
  await test('public return/status cannot credit money without service permissions',async()=>asRole('authenticated',business,()=>throws(()=>settlePayment(),/permission denied/)));
  await test('verified provider funding credits exactly once across replay',async()=>{await settlePayment();await settlePayment();assert.equal(await balance(business),300000);});
  await test('same payment idempotency key cannot change amount',async()=>throws(()=>command(business,'payment-create',{amount_kobo:300001,idempotency_key:'collection_fixture_1'}),/another amount/));
  const stale=await quote(first);
  await sql("update public.rr_campaigns set updated_at=updated_at+interval '1 second' where id=$1",[first]);
  await test('changed draft rejects stale accepted quote',async()=>throws(()=>command(business,'campaign-publish',stale),/quote changed/));
  const accepted=await quote(first);
  await test('wrong accepted total cannot spend',async()=>throws(()=>command(business,'campaign-publish',{...accepted,expected_total_kobo:1}),/quote changed/));
  await test('expired quotes cannot publish',async()=>{await sql("update public.rr_quotes set expires_at=now()-interval '1 minute' where campaign_id=$1",[first]);await throws(()=>command(business,'campaign-publish',accepted),/quote changed/);});
  const publish=await quote(first);
  await test('publish atomically reserves exact budget once',async()=>{await command(business,'campaign-publish',publish);await command(business,'campaign-publish',publish);assert.equal(await balance(business),264000);assert.equal(await balance(business,'campaign'),36000);});
  await test('business cannot accept its own campaign',async()=>throws(()=>command(business,'task-claim',{id:first}),/cannot perform/));
  const claim=(await command(worker,'task-claim',{id:first})).id;
  await test('replayed claims return one assignment and allocate one place',async()=>{const repeated=await Promise.all(Array.from({length:10},()=>command(worker,'task-claim',{id:first})));assert.ok(repeated.every(value=>value.id===claim));assert.equal((await sql('select active_count from public.rr_campaigns where id=$1',[first]))[0].active_count,1);});
  await test('worker cannot submit before baseline completes',async()=>throws(()=>command(worker,'task-check',{id:claim}),/not ready/));
  await test('another worker cannot check or cancel a claim',async()=>{await throws(()=>command(worker2,'task-check',{id:claim}),/unavailable/);await throws(()=>command(worker2,'task-cancel',{id:claim}),/unavailable/);});
  let job=await leased(claim,'baseline');
  await test('wrong job lease cannot change task state',async()=>{await finish({...job,lease_id:actor(900)},'not_found');assert.equal((await sql('select phase from public.rr_assignments where id=$1',[claim]))[0].phase,'baseline');});
  await test('unknown provider result does not approve or release money',async()=>{await finish(job,'unknown');assert.equal((await sql('select phase from public.rr_assignments where id=$1',[claim]))[0].phase,'baseline');assert.equal(await balance(worker),0);});
  job=await leased(claim,'baseline');
  await test('durable pagination commits cursor without spending retry budget',async()=>{await call('rr_market_continue',{p_job:job.id,p_lease:job.lease_id,p_cursor:'cursor-1',p_pages:2});const j=(await sql('select cursor,scanned_pages,state from public.rr_jobs where id=$1',[job.id]))[0];assert.equal(j.cursor,'cursor-1');assert.equal(j.scanned_pages,2);assert.equal(j.state,'queued');});
  job=await leased(claim,'baseline');await finish(job,'not_found');
  await test('completed baseline opens a timed task',async()=>{const a=(await sql('select phase,expires_at,status from public.rr_assignments where id=$1',[claim]))[0];assert.equal(a.phase,'completion');assert.equal(a.status,'reserved');assert.ok(a.expires_at);});
  await command(worker,'task-check',{id:claim});job=await leased(claim,'completion');await finish(job,'verified');
  await test('first observation creates held earnings, not spendable reward',async()=>{assert.equal((await sql('select status from public.rr_assignments where id=$1',[claim]))[0].status,'pending');assert.equal(await balance(worker),0);assert.equal((await call('rr_market_totals',{p_actor:worker})).pending_kobo,10000);});
  job=await leased(claim,'retention');
  await test('settlement cannot bypass retention interval',async()=>throws(()=>finish(job,'verified'),/not due/));
  await sql("update public.rr_assignments set hold_until=now()-interval '1 second' where id=$1",[claim]);await finish(job,'verified');
  await test('final check settles reward and fee atomically once',async()=>{await finish(job,'verified');assert.equal(await balance(worker),10000);assert.equal(await balance(business,'campaign'),24000);const c=(await sql('select delivered_count,spent_kobo,active_count from public.rr_campaigns where id=$1',[first]))[0];assert.equal(c.delivered_count,1);assert.equal(Number(c.spent_kobo),12000);assert.equal(c.active_count,0);});
  const claim2=(await command(worker2,'task-claim',{id:first})).id;
  await command(business,'campaign-state',{id:first,state:'cancelled'});
  await test('closing refunds unclaimed funds but keeps active allocation',async()=>{assert.equal(await balance(business),276000);assert.equal(await balance(business,'campaign'),12000);assert.equal((await sql('select status from public.rr_campaigns where id=$1',[first]))[0].status,'closing');});
  await command(worker2,'task-cancel',{id:claim2});
  await test('cancelled outstanding claim releases only its own allocation',async()=>{assert.equal(await balance(business),288000);assert.equal(await balance(business,'campaign'),0);assert.equal((await sql('select status from public.rr_campaigns where id=$1',[first]))[0].status,'cancelled');});
  const comments=await draft(2,'comment');await command(business,'campaign-publish',await quote(comments));
  const commentClaim=(await command(worker,'task-claim',{id:comments})).id;
  job=await leased(commentClaim,'baseline');await call('rr_market_comment_ready',{p_job:job.id,p_lease:job.lease_id});
  await test('new-comment eligibility does not invent a negative provider observation',async()=>assert.equal((await sql('select count(*)::int n from public.rr_evidence where assignment_id=$1',[commentClaim]))[0].n,0));
  await command(worker,'task-check',{id:commentClaim,comment_text:'I like this collection.'});job=await leased(commentClaim,'completion');
  await test('comment completion requires stable comment ID',async()=>throws(()=>finish(job,'verified'),/stable comment ID/));
  await finish(job,'verified','900001');await sql("update public.rr_assignments set hold_until=now()-interval '1 second' where id=$1",[commentClaim]);job=await leased(commentClaim,'retention');await finish(job,'verified','900001');
  await test('comment receipt and reward use stable evidence',async()=>{assert.equal(await balance(worker),25000);const a=(await sql('select comment_id,evidence_id,status from public.rr_assignments where id=$1',[commentClaim]))[0];assert.equal(a.comment_id,'900001');assert.ok(a.evidence_id);assert.equal(a.status,'settled');});
  const secondComment=(await command(worker2,'task-claim',{id:comments})).id;job=await leased(secondComment,'baseline');await call('rr_market_comment_ready',{p_job:job.id,p_lease:job.lease_id});await command(worker2,'task-check',{id:secondComment,comment_text:'Copied comment.'});job=await leased(secondComment,'completion');
  await test('same stable comment cannot earn two rewards',async()=>throws(()=>finish(job,'verified','900001'),/duplicate key/));
  const bank=(await sql("insert into public.rr_beneficiaries(owner_id,bank_code,bank_name,account_number,account_name) values($1,'001','Fixture Bank','1234567890','Fixture Worker') returning id",[worker]))[0].id;
  const withdrawalTerms={expected_fee_kobo:500,terms_version:(await sql('select terms_version from public.rr_settings'))[0].terms_version};
  await test('withdrawal refuses missing or stale fee consent before reserving funds',async()=>{
    for(const consent of [{},{...withdrawalTerms,expected_fee_kobo:0},{...withdrawalTerms,terms_version:'stale'}])await throws(()=>command(worker,'withdraw',{amount_kobo:10000,beneficiary_id:bank,idempotency_key:'withdraw_stale_terms',...consent}),/terms changed/);
    assert.equal(await balance(worker),25000);assert.equal(await balance(worker,'withdrawal'),0);
  });
  await test('another worker cannot use a saved beneficiary',async()=>throws(()=>command(worker2,'withdraw',{amount_kobo:10000,beneficiary_id:bank,idempotency_key:'withdraw_bad_owner',...withdrawalTerms}),/bank account/));
  const withdrawal=await command(worker,'withdraw',{amount_kobo:10000,beneficiary_id:bank,idempotency_key:'withdraw_fixture_1',...withdrawalTerms});
  await test('existing withdrawal replay retains its accepted fee despite new pricing',async()=>{
    await sql("update public.rr_settings set withdrawal_fee_kobo=1000,terms_version='repriced'");
    const replay=await command(worker,'withdraw',{amount_kobo:10000,beneficiary_id:bank,idempotency_key:'withdraw_fixture_1',...withdrawalTerms});assert.equal(replay.id,withdrawal.id);assert.equal(replay.fee_kobo,500);
    await throws(()=>command(worker,'withdraw',{amount_kobo:10000,beneficiary_id:bank,idempotency_key:'withdraw_new_stale',...withdrawalTerms}),/terms changed/);
    await throws(()=>command(worker,'withdraw',{amount_kobo:10000,beneficiary_id:actor(999),idempotency_key:'withdraw_fixture_1',...withdrawalTerms}),/another bank account/);
    await sql('update public.rr_settings set withdrawal_fee_kobo=500,terms_version=$1',[withdrawalTerms.terms_version]);
  });
  await test('withdrawal atomically holds amount and agreed fee',async()=>{assert.equal(await balance(worker),14500);assert.equal(await balance(worker,'withdrawal'),10500);});
  await test('withdrawal dispatch is a durable once-only gate',async()=>{const values=await Promise.all(Array.from({length:8},()=>call('rr_market_dispatch',{p_id:withdrawal.id})));assert.equal(values.filter(Boolean).length,1);});
  await sql("update public.rr_payments set provider_id='WDfixture00001',provider_fee_kobo=250 where id=$1",[withdrawal.id]);
  const withdrawResult=(state)=>call('rr_market_finish_payment',{p_id:withdrawal.id,p_state:state,p_reference:withdrawal.reference,p_amount:10000,p_currency:'NGN',p_provider_id:'WDfixture00001'});
  await withdrawResult('unknown');
  await test('uncertain withdrawal keeps hold and cannot resend',async()=>{assert.equal(await balance(worker,'withdrawal'),10500);assert.equal(await call('rr_market_dispatch',{p_id:withdrawal.id}),false);});
  await withdrawResult('succeeded');await withdrawResult('succeeded');
  await test('confirmed withdrawal settles once and records provider expense separately',async()=>{assert.equal(await balance(worker,'withdrawal'),0);assert.equal(await balance(worker),14500);assert.equal(Number((await sql("select sum(balance_kobo) n from public.rr_ledger_accounts where bucket='provider_expense'"))[0].n),-250);});
  await test('verified discrepancy opens one case without changing balances',async()=>{const args={p_id:withdrawal.id,p_event_hash:'a'.repeat(64),p_reason:'Signed provider event conflicts with the recorded payment.'};await call('rr_market_payment_discrepancy',args);await call('rr_market_payment_discrepancy',args);assert.equal((await sql('select count(*)::int n from public.rr_cases where reference=$1',[withdrawal.id]))[0].n,1);assert.equal(await balance(worker),14500);});
  await test('financial history rejects edits',async()=>{await throws(()=>sql("update public.rr_journals set label='tampered'"),/append-only/);await throws(()=>sql('delete from public.rr_ledger_entries'),/append-only/);});
  await test('unbalanced journal cannot commit',async()=>throws(()=>sql("insert into public.rr_journals(reference,kind,label) values('unbalanced','deposit','Invalid')"),/Unbalanced journal/));
  await test('all journals balance and account cache equals entries',async()=>{assert.equal((await sql('select journal_id from public.rr_ledger_entries group by journal_id having sum(amount_kobo)<>0')).length,0);assert.equal((await sql('select a.id from public.rr_ledger_accounts a left join public.rr_ledger_entries e on e.account_id=a.id group by a.id having a.balance_kobo<>coalesce(sum(e.amount_kobo),0)')).length,0);});
  await test('customer RLS does not reveal another wallet or support case',async()=>asRole('authenticated',worker2,async()=>{assert.equal((await sql('select * from public.rr_ledger_accounts where owner_id=$1',[worker])).length,0);assert.equal((await sql('select * from public.rr_cases where owner_id=$1',[worker])).length,0);}));
  await test('singleton admin resolution is audited without arbitrary balance override',async()=>{const c=(await sql('select id from public.rr_cases where reference=$1',[withdrawal.id]))[0];await call('rr_market_admin',{p_actor:admin,p_action:'admin-case',p_input:{id:c.id,status:'resolved',resolution:'Confirmed with payment provider support.'}});assert.equal((await sql("select count(*)::int n from public.rr_audit where action='admin-case'"))[0].n,1);assert.equal(await balance(worker),14500);});
  const followAgain=await draft(1);await command(business,'campaign-publish',await quote(followAgain));
  await test('paid worker cannot repeat follow after changing Instagram identity',async()=>{await sql("update public.rr_instagram_accounts set instagram_id='22299' where user_id=$1",[worker]);await throws(()=>command(worker,'task-claim',{id:followAgain}),/already participated/);await sql("update public.rr_instagram_accounts set instagram_id='222' where user_id=$1",[worker]);});
  const commentAgain=await draft(1,'comment');await command(business,'campaign-publish',await quote(commentAgain));
  await test('same actor cannot earn another comment reward on the same post',async()=>throws(()=>command(worker,'task-claim',{id:commentAgain}),/already participated/));
  await test('feed excludes prior participation across different campaigns',async()=>{const rows=await sql('select * from public.rr_market_feed($1)',[worker]);assert.ok(!rows.some(c=>[followAgain,commentAgain].includes(c.id)));});
  const recovering=(await command(worker2,'task-claim',{id:followAgain})).id;job=await leased(recovering,'baseline');await sql('update public.rr_jobs set attempts=8 where id=$1',[job.id]);await finish(job,'unknown');
  await test('unknown baseline reaches review without freeing allocated money',async()=>{assert.equal((await sql('select status from public.rr_assignments where id=$1',[recovering]))[0].status,'needs_review');assert.equal((await sql('select active_count from public.rr_campaigns where id=$1',[followAgain]))[0].active_count,1);});
  await call('rr_market_admin',{p_actor:admin,p_action:'admin-retry',p_input:{id:job.id}});job=await leased(recovering,'baseline');await finish(job,'not_found');
  await test('admin retry restores baseline task to a usable reserved state',async()=>{const a=(await sql('select status,phase from public.rr_assignments where id=$1',[recovering]))[0];assert.equal(a.status,'reserved');assert.equal(a.phase,'completion');await command(worker2,'task-check',{id:recovering});});
  const race=await command(business,'payment-create',{amount_kobo:10000,idempotency_key:'checkout_provider_race'});await call('rr_market_dispatch',{p_id:race.id});await sql("update public.rr_payments set status='unknown' where id=$1",[race.id]);
  await test('late provider result binds after a concurrent uncertain refresh',async()=>{await call('rr_market_bind_payment',{p_id:race.id,p_provider_id:'PFI|latefixture',p_status:'pending',p_checkout_url:'https://pocketfi.ng/checkout/PFI%7Clatefixture'});const p=(await sql('select provider_id,status from public.rr_payments where id=$1',[race.id]))[0];assert.equal(p.provider_id,'PFI|latefixture');assert.equal(p.status,'pending');});
  await test('bound provider reference cannot be replaced',async()=>throws(()=>call('rr_market_bind_payment',{p_id:race.id,p_provider_id:'PFI|different',p_status:'pending'}),/another provider reference/));
  await test('workspace metrics aggregate all records independently of page limits',async()=>{const t=await call('rr_market_totals',{p_actor:worker});assert.equal(t.metrics.completed_assignments,2);assert.equal(t.earned_kobo,25000);});
  await test('operator cost limits are not readable or writable by customers',async()=>asRole('authenticated',worker,()=>throws(()=>sql('select * from public.rr_operational_limits'),/permission denied/)));
  await test('queue wait does not consume the scan-age window before first lease',async()=>{
    await sql("update public.rr_jobs set created_at=now()-interval '2 days',due_at=now()-interval '2 days' where assignment_id=$1 and phase='completion'",[recovering]);
    assert.equal((await sql("select scan_started_at from public.rr_jobs where assignment_id=$1 and phase='completion'",[recovering]))[0].scan_started_at,null);
    job=await leased(recovering,'completion');assert.ok(Date.now()-Date.parse(job.scan_started_at)<5000);
  });
  await test('all intermediate pagination cursors persist across batches',async()=>{
    await call('rr_market_continue',{p_job:job.id,p_lease:job.lease_id,p_cursor:'last',p_pages:3,p_seen:['first','middle','last']});
    assert.deepEqual((await sql('select seen_cursors from public.rr_jobs where id=$1',[job.id]))[0].seen_cursors,['first','middle','last']);
  });
  await test('repeated intermediate cursor immediately enters review, no reward is paid',async()=>{
    const before=await balance(worker2);job=await leased(recovering,'completion');
    await call('rr_market_continue',{p_job:job.id,p_lease:job.lease_id,p_cursor:'new',p_pages:2,p_seen:['middle','new']});
    assert.equal((await sql('select state from public.rr_jobs where id=$1',[job.id]))[0].state,'attention');assert.equal((await sql('select status from public.rr_assignments where id=$1',[recovering]))[0].status,'needs_review');assert.equal(await balance(worker2),before);
  });
  await call('rr_market_admin',{p_actor:admin,p_action:'admin-retry',p_input:{id:job.id}});job=await leased(recovering,'completion');
  await test('page limit produces a finite review state without repeated spending',async()=>{
    await call('rr_market_continue',{p_job:job.id,p_lease:job.lease_id,p_cursor:'over-budget',p_pages:500});
    assert.equal((await sql('select state from public.rr_jobs where id=$1',[job.id]))[0].state,'attention');
  });
  await call('rr_market_admin',{p_actor:admin,p_action:'admin-retry',p_input:{id:job.id}});job=await leased(recovering,'completion');
  await test('stale scan is quarantined rather than resumed as negative evidence',async()=>{
    await sql("update public.rr_jobs set scan_started_at=now()-interval '31 minutes' where id=$1",[job.id]);
    await call('rr_market_continue',{p_job:job.id,p_lease:job.lease_id,p_cursor:'late',p_pages:1});assert.equal((await sql('select state from public.rr_jobs where id=$1',[job.id]))[0].state,'attention');
  });
  await sql("insert into auth.users(id,email,email_confirmed_at) values($1,'queue@example.test',now())",[actor(6)]);await sql("insert into public.profiles(id,account_type) values($1,'worker')",[actor(6)]);await sql("insert into public.rr_instagram_accounts(user_id,instagram_id,username,status) values($1,'666','queueworker','verified')",[actor(6)]);
  const queueCampaign=await draft(1);await command(business,'campaign-publish',await quote(queueCampaign));
  await call('rr_market_admin',{p_actor:admin,p_action:'admin-retry',p_input:{id:job.id}});
  await sql("update public.rr_operational_limits set claim_queue_limit=1");
  await sql("update public.rr_jobs set due_at=now()+interval '10 seconds' where assignment_id=$1 and phase='completion'",[recovering]);
  await test('active pagination/backoff queue applies admission pressure even between cron ticks',async()=>throws(()=>command(actor(6),'task-claim',{id:queueCampaign}),/checks are busy/));
  await sql("update public.rr_jobs set state='attention' where assignment_id is not null and state in ('running','queued')");
  await sql("update public.rr_jobs set state='queued',due_at=now()+interval '48 hours',scan_started_at=null where assignment_id=$1 and phase='retention'",[commentClaim]);
  await test('future retention holds do not consume immediate-check admission capacity',async()=>{const a=await command(actor(6),'task-claim',{id:queueCampaign});assert.ok(a.id);const row=(await sql('select expires_at from public.rr_assignments where id=$1',[a.id]))[0];assert.equal(row.expires_at,null);});
  await test('admin health reports real queue counts and server-owned workload limits',async()=>{const health=await call('rr_market_health',{});assert.equal(health.limits.claim_queue_limit,1);assert.ok(health.queued_checks>=2);assert.ok(health.due_checks>=1);assert.ok(health.oldest_due_at);});
  await sql('update public.rr_operational_limits set claim_queue_limit=100');
  await call('rr_market_admin',{p_actor:admin,p_action:'admin-retry',p_input:{id:job.id}});job=await leased(recovering,'completion');await sql('update public.rr_jobs set attempts=8 where id=$1',[job.id]);await finish(job,'unknown');
  const closeArgs={p_actor:admin,p_action:'admin-assignment-close',p_input:{id:recovering,reason:'Instagram cannot provide a reliable result for this task.'}};
  await test('only the singleton admin can close a review task',async()=>{
    await throws(()=>call('rr_market_admin',{...closeArgs,p_actor:worker}),/restricted/);
    await asRole('authenticated',admin,()=>throws(()=>call('rr_market_admin',closeArgs),/permission denied/));
  });
  await test('review closure requires a meaningful reason and refuses settled assignments',async()=>{
    await throws(()=>call('rr_market_admin',{...closeArgs,p_input:{id:recovering,reason:'No'}}),/10 to 1000/);
    await throws(()=>call('rr_market_admin',{...closeArgs,p_input:{id:commentClaim,reason:'Cannot override a settled task.'}}),/Only unresolved/);
  });
  const beforeClosure={wallet:await balance(worker2),reserve:await balance(business,'campaign'),evidence:Number((await sql('select count(*) n from public.rr_evidence where assignment_id=$1',[recovering]))[0].n)};
  const closed=await call('rr_market_admin',closeArgs);
  await test('closing review without payment returns exactly one live campaign place',async()=>{
    assert.equal(closed.status,'cancelled');assert.equal(closed.closure.release_destination,'campaign_budget');assert.equal(Number(closed.closure.amount_kobo),12000);
    assert.equal(await balance(worker2),beforeClosure.wallet);assert.equal(await balance(business,'campaign'),beforeClosure.reserve);
    const c=(await sql('select remaining_count,active_count from public.rr_campaigns where id=$1',[followAgain]))[0];assert.deepEqual(c,{remaining_count:1,active_count:0});
    assert.equal(Number((await sql('select count(*) n from public.rr_evidence where assignment_id=$1',[recovering]))[0].n),beforeClosure.evidence);
  });
  await test('review closure replay is idempotent and invalidates every active lease',async()=>{
    const again=await call('rr_market_admin',{...closeArgs,p_input:{id:recovering,reason:'A duplicate retry must retain the original reason.'}});assert.deepEqual(again.closure,closed.closure);
    assert.equal(Number((await sql("select count(*) n from public.rr_audit where action='admin-assignment-close' and reference=$1",[recovering]))[0].n),1);
    assert.equal(Number((await sql("select count(*) n from public.rr_jobs where assignment_id=$1 and (state<>'done' or lease_id is not null or lease_until is not null)",[recovering]))[0].n),0);
    await finish(job,'verified');assert.equal((await sql('select status from public.rr_assignments where id=$1',[recovering]))[0].status,'cancelled');
    await throws(()=>call('rr_market_admin',{p_actor:admin,p_action:'admin-retry',p_input:{id:job.id}}),/Only checks/);
  });
  await test('closure provenance is append-only and visible only to the two affected parties',async()=>{
    for(const owner of [worker2,business])await asRole('authenticated',owner,async()=>assert.equal((await sql('select * from public.rr_assignment_closures where assignment_id=$1',[recovering])).length,1));
    await asRole('authenticated',worker,async()=>assert.equal((await sql('select * from public.rr_assignment_closures where assignment_id=$1',[recovering])).length,0));
    await throws(()=>sql("update public.rr_assignment_closures set reason='Changed after the fact'"),/append-only/);
    for(const owner of [worker2,business])assert.ok(Number((await sql("select count(*) n from public.rr_notifications where owner_id=$1 and (title='Task updated' or title='Unresolved task closed')",[owner]))[0].n)>0);
  });
  const otherFunding=await command(other,'payment-create',{amount_kobo:100000,idempotency_key:'other_recovery_funding'});await sql("update public.rr_payments set provider_id='PFI|otherRecovery' where id=$1",[otherFunding.id]);await call('rr_market_finish_payment',{p_id:otherFunding.id,p_state:'succeeded',p_reference:otherFunding.reference,p_amount:100000,p_currency:'NGN',p_provider_id:'PFI|otherRecovery'});
  const closingCampaign=(await command(other,'campaign-save',{title:'Closing recovery fixture',action:'follow',quantity:2,instructions:''})).id;await command(other,'campaign-publish',await quote(closingCampaign));
  const closingAssignment=(await command(worker2,'task-claim',{id:closingCampaign})).id;let closingJob=await leased(closingAssignment,'baseline');await sql('update public.rr_jobs set attempts=8 where id=$1',[closingJob.id]);await finish(closingJob,'unknown');await command(other,'campaign-state',{id:closingCampaign,state:'cancelled'});
  await test('closing-campaign review release returns precisely reward plus fee to wallet once',async()=>{
    const before=await balance(other);const args={p_actor:admin,p_action:'admin-assignment-close',p_input:{id:closingAssignment,reason:'Provider cannot complete this check; no reward is approved.'}};
    const result=await call('rr_market_admin',args);await call('rr_market_admin',args);assert.equal(result.closure.release_destination,'wallet');assert.equal(await balance(other),before+12000);assert.equal(await balance(other,'campaign'),0);assert.equal(await balance(worker2),0);
  });
  const businessBeforeHold=await balance(business);const businessReserveBeforeHold=await balance(business,'campaign');
  const dispute={p_id:payment.id,p_event_hash:'b'.repeat(64),p_reason:'Signed provider reversal conflicts with a previously succeeded collection.'};
  await call('rr_market_payment_discrepancy',dispute);await call('rr_market_payment_discrepancy',dispute);
  await test('succeeded payment discrepancy creates one immutable hold without invented clawback',async()=>{
    assert.equal(Number((await sql('select count(*) n from public.rr_payment_risk_holds where payment_id=$1',[payment.id]))[0].n),1);
    assert.equal(await balance(business),businessBeforeHold);assert.equal(await balance(business,'campaign'),businessReserveBeforeHold);
    assert.equal((await sql('select status from public.rr_payments where id=$1',[payment.id]))[0].status,'succeeded');
    assert.equal(Number((await sql("select count(*) n from public.rr_notifications where owner_id=$1 and title='A payment needs review'",[business]))[0].n),1);
    await throws(()=>sql('delete from public.rr_payment_risk_holds where payment_id=$1',[payment.id]),/append-only/);
  });
  await test('payment holds are owner-readable, cross-owner isolated and not browser-writable',async()=>{
    await asRole('authenticated',business,async()=>assert.equal((await sql('select * from public.rr_payment_risk_holds where payment_id=$1',[payment.id])).length,1));
    await asRole('authenticated',other,async()=>assert.equal((await sql('select * from public.rr_payment_risk_holds where payment_id=$1',[payment.id])).length,0));
    await asRole('authenticated',business,()=>throws(()=>sql('delete from public.rr_payment_risk_holds where payment_id=$1',[payment.id]),/permission denied/));
  });
  const heldDraft=await draft(1);
  await test('held business cannot publish or resume but can still pause safely',async()=>{
    await throws(async()=>command(business,'campaign-publish',await quote(heldDraft)),/New spending is paused/);
    await command(business,'campaign-state',{id:followAgain,state:'paused'});await throws(()=>command(business,'campaign-state',{id:followAgain,state:'live'}),/New spending is paused/);
  });
  await sql("insert into auth.users(id,email,email_confirmed_at) values($1,'hold@example.test',now())",[actor(7)]);await sql("insert into public.profiles(id,account_type) values($1,'worker')",[actor(7)]);await sql("insert into public.rr_instagram_accounts(user_id,instagram_id,username,status) values($1,'777','holdworker','verified')",[actor(7)]);
  await test('held business disappears from the feed and cannot fund new task allocations',async()=>{
    const rows=await sql('select * from public.rr_market_feed($1)',[actor(7)]);assert.ok(!rows.some(c=>c.owner_id===business));
    await throws(()=>command(actor(7),'task-claim',{id:commentAgain}),/New spending is paused/);
  });
  await test('a held worker cannot reserve a new withdrawal',async()=>throws(()=>command(worker,'withdraw',{amount_kobo:10000,beneficiary_id:bank,idempotency_key:'held_worker_withdrawal'}),/New spending is paused/));
  const existing=(await sql('select id from public.rr_assignments where worker_id=$1 and campaign_id=$2',[actor(6),queueCampaign]))[0].id;
  let existingJob=await leased(existing,'baseline');await finish(existingJob,'not_found');await command(actor(6),'task-check',{id:existing});existingJob=await leased(existing,'completion');await finish(existingJob,'verified');await sql("update public.rr_assignments set hold_until=now()-interval '1 second' where id=$1",[existing]);existingJob=await leased(existing,'retention');
  await test('hold preserves and settles already-funded worker obligations',async()=>{await finish(existingJob,'verified');assert.equal(await balance(actor(6)),10000);assert.equal((await sql('select status from public.rr_assignments where id=$1',[existing]))[0].status,'settled');assert.equal(Number((await sql('select count(*) n from public.rr_payment_risk_holds where owner_id=$1',[business]))[0].n),1);});
  await test('successful recheck and case resolution cannot clear an active financial hold',async()=>{
    await settlePayment();const support=(await sql('select id from public.rr_cases where reference=$1',[payment.id]))[0];await call('rr_market_admin',{p_actor:admin,p_action:'admin-case',p_input:{id:support.id,status:'resolved',resolution:'This note is not proof of returned funds.'}});
    assert.equal(Number((await sql('select count(*) n from public.rr_payment_risk_holds where payment_id=$1',[payment.id]))[0].n),1);
  });
  await test('pending-payment discrepancy raises a case without pretending it was a successful debit',async()=>{
    await call('rr_market_payment_discrepancy',{p_id:race.id,p_event_hash:'c'.repeat(64),p_reason:'Signed event amount does not match this still-pending payment.'});assert.equal((await sql('select * from public.rr_payment_risk_holds where payment_id=$1',[race.id])).length,0);
  });
  await test('admin payment view is service-only, invoker-secure and flags succeeded held payments',async()=>{
    await asRole('anon',null,()=>throws(()=>sql('select * from public.rr_admin_payment_view'),/permission denied/));await asRole('authenticated',business,()=>throws(()=>sql('select * from public.rr_admin_payment_view'),/permission denied/));
    await asRole('service_role',null,async()=>{const row=(await sql('select * from public.rr_admin_payment_view where id=$1',[payment.id]))[0];assert.equal(row.risk_held,true);assert.equal(row.status,'succeeded');assert.equal('account_number' in row,false);assert.equal('checkout_url' in row,false);});
    assert.ok((await sql("select reloptions from pg_class where oid='public.rr_admin_payment_view'::regclass"))[0].reloptions.includes('security_invoker=true'));
  });
  const pendingPayment=async(key)=>{
    const p=await command(other,'payment-create',{amount_kobo:12000,idempotency_key:key});await sql('update public.rr_payments set provider_id=$2 where id=$1',[p.id,'PFI|'+p.id]);return p;
  };
  const confirm=(p,state)=>call('rr_market_finish_payment',{p_id:p.id,p_state:state,p_reference:p.reference,p_amount:12000,p_currency:'NGN',p_provider_id:'PFI|'+p.id});
  await test('discrepancy before confirmation becomes an atomic hold when funds are credited',async()=>{
    const p=await pendingPayment('reversal_before_success');const args={p_id:p.id,p_event_hash:'d'.repeat(64),p_reason:'Signed provider reversal arrived before confirmation.'};
    await call('rr_market_payment_discrepancy',args);assert.equal((await sql('select * from public.rr_payment_risk_holds where payment_id=$1',[p.id])).length,0);
    const before=await balance(other);await confirm(p,'succeeded');await call('rr_market_payment_discrepancy',args);await confirm(p,'succeeded');
    assert.equal(await balance(other),before+12000);assert.equal((await sql('select * from public.rr_payment_risk_holds where payment_id=$1',[p.id])).length,1);
    assert.equal(Number((await sql("select count(*) n from public.rr_audit where action='payment-risk-hold' and reference=$1",[p.id]))[0].n),1);
  });
  await test('ordinary unpaid failure is retained without an unnecessary financial dispute',async()=>{
    const p=await pendingPayment('normal_unpaid_failure');await call('rr_market_payment_discrepancy',{p_id:p.id,p_event_hash:'e'.repeat(64),p_reason:'Signed provider notification reports payment failure',p_expected_state:'failed'});await confirm(p,'failed');
    assert.equal((await sql('select * from public.rr_payment_risk_holds where payment_id=$1',[p.id])).length,0);assert.equal((await sql('select * from public.rr_cases where reference=$1',[p.id])).length,0);
    const before=await balance(other);await confirm(p,'succeeded');assert.equal(await balance(other),before);assert.equal((await sql('select * from public.rr_cases where reference=$1',[p.id])).length,1);
  });
  await test('a pending failure observation followed by success creates quarantine not spendable unreviewed money',async()=>{
    const p=await pendingPayment('failed_observation_then_success');await call('rr_market_payment_discrepancy',{p_id:p.id,p_event_hash:'f'.repeat(64),p_reason:'Signed provider notification reports payment failure',p_expected_state:'failed'});await confirm(p,'succeeded');
    assert.equal((await sql('select * from public.rr_payment_risk_holds where payment_id=$1',[p.id])).length,1);assert.equal((await sql('select * from public.rr_cases where reference=$1',[p.id])).length,1);
  });
  await test('stale contradictory confirmation cannot silently skip a settled payment discrepancy',async()=>{
    const p=await pendingPayment('stale_confirmation_after_success');await confirm(p,'succeeded');const before=await balance(other);await confirm(p,'failed');await confirm(p,'failed');
    assert.equal(await balance(other),before);assert.equal((await sql('select status from public.rr_payments where id=$1',[p.id]))[0].status,'succeeded');assert.equal((await sql('select * from public.rr_payment_risk_holds where payment_id=$1',[p.id])).length,1);
    assert.equal((await sql('select * from public.rr_payment_events where payment_id=$1',[p.id])).length,1);
  });
  await test('delayed pending or unknown confirmations do not quarantine a recorded terminal payment',async()=>{
    for(const terminal of ['succeeded','failed']) {
      const p=await pendingPayment('nonterminal_after_'+terminal);await confirm(p,terminal);const before=await balance(other);
      await confirm(p,'pending');await confirm(p,'unknown');assert.equal(await balance(other),before);
      assert.equal((await sql('select status from public.rr_payments where id=$1',[p.id]))[0].status,terminal);
      assert.equal((await sql('select * from public.rr_payment_risk_holds where payment_id=$1',[p.id])).length,0);assert.equal((await sql('select * from public.rr_payment_events where payment_id=$1',[p.id])).length,0);
    }
  });
} finally {await db.close();}
console.log(`${passed} PostgreSQL checks passed`);
