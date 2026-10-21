import { reply, origins, must, service } from './runtime.ts';
import { ProviderError } from './instagram.ts';
import { ProviderError as AdapterError } from './provider-contract.ts';
import { createRocketClient, instagramUsername, canonicalInstagramPost, verifyProfileChallenge } from './rocket.ts';
import { authenticated, requireAdmin, command, rate, workspace, settings, capabilityView, configured, requirePaymentLaunch, taskDetail, campaignView, pricingView, env, type Row } from './marketplace.ts';
import { pocket, startCheckout, startWithdrawal, refreshPayment, recheckPayment } from './marketplace-payments.ts';
import { listRecords } from './marketplace-lists.ts';
import {adminList,adminDetail,adminHistory} from './marketplace-admin.ts';
import {adminOperations,adminReconcileRun} from './marketplace-operations-admin.ts';

const id = (value: unknown) => { if(typeof value!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)) throw new ProviderError(400,'This link or request is invalid.'); return value; };
const rocket = () => createRocketClient({apiKey:env('ROCKET_API_KEY')});
const requireReady = (type:'instagram'|'payments'|'payouts') => { if (!configured()[type]) throw new ProviderError(503,type==='instagram'?'Instagram verification is not available yet. You can finish setting up your account.':'Payments are not available yet. Your saved details are safe.'); };
function money(value:unknown) { if(!Number.isSafeInteger(value)||Number(value)<10000||Number(value)>1_000_000_000) throw new ProviderError(400,'Enter an amount between ₦100 and ₦10,000,000.'); return Number(value); }
function key(value:unknown) { if(typeof value!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(value)) throw new ProviderError(400,'Refresh this page before trying again.'); return value; }

export function createMarketplaceHandler(dependencies: {authenticate?:typeof authenticated; rateLimit?:typeof rate; getWorkspace?:typeof workspace; getCapabilities?:()=>Promise<Row>}={}) {
 return async (req:Request)=>{
  if(req.method==='OPTIONS') return reply(req,{ok:true});
  if(req.method!=='POST') return reply(req,{error:'Method not allowed'},405);
  const origin=req.headers.get('origin');
  if(origin&&!origins().includes(origin)) return reply(req,{error:'Origin not allowed'},403);
  try {
    const raw=await req.text(); if(raw.length>16384) throw new ProviderError(413,'This request is too large.');
    const body=JSON.parse(raw) as Row;
    if (!body || typeof body.action!=='string') throw new ProviderError(400,'Choose an action.');
    if(body.action==='capabilities') return reply(req,await (dependencies.getCapabilities??(async()=>capabilityView(await settings(service()))))());
    const auth=await (dependencies.authenticate??authenticated)(req); const {db,user}=auth; const actor=user.id;
    await (dependencies.rateLimit??rate)(db,actor,body.action,['instagram-verify','bank-verify','campaign-publish','payment-create','withdraw','admin-payment-recheck','admin-reconcile-run'].includes(body.action)?5:60);
    const worker=()=>{if(auth.profile.account_type!=='worker'&&!auth.admin) throw new ProviderError(403,'A worker account is required.');};
    const business=()=>{if(auth.profile.account_type!=='business'&&!auth.admin) throw new ProviderError(403,'A business account is required.');};
    if(body.action==='workspace') return reply(req,await (dependencies.getWorkspace??workspace)(db,actor));
    if(body.action==='list') {
      if(body.resource==='campaigns') business();
      if(body.resource==='assignments'||body.resource==='feed')worker();
      return reply(req,await listRecords(db,actor,body));
    }
    if(body.action==='task-detail') {worker(); return reply(req,await taskDetail(db,actor,id(body.id)));}
    if(body.action==='campaign-save') {
      business(); const c=body.campaign;
      if(!c||typeof c!=='object'||typeof c.title!=='string'||c.title.trim().length<3||c.title.length>100||!['follow','comment'].includes(c.action)||!Number.isInteger(c.quantity)||typeof c.instructions!=='string'||c.instructions.length>1000) throw new ProviderError(400,'Check your campaign name, task type and quantity.');
      if(c.id) id(c.id);
      if(c.ends_at && (!Number.isFinite(Date.parse(c.ends_at))||new Date(c.ends_at)<=new Date())) throw new ProviderError(400,'Choose an end date in the future.');
      if(c.action==='comment'&&c.target_url) c.target_url=canonicalInstagramPost(c.target_url).url;
      return reply(req,await command(db,actor,'campaign-save',c));
    }
    if(body.action==='campaign-quote') {
      business(); const c=must(await db.from('rr_campaigns').select('*').eq('id',id(body.id)).eq('owner_id',actor).single());
      const s=await settings(db); const reward=Number(c.action==='follow'?s.follow_reward_kobo:s.comment_reward_kobo); const fee=Number(c.action==='follow'?s.follow_fee_kobo:s.comment_fee_kobo);
      const account=must(await db.from('rr_ledger_accounts').select('balance_kobo').eq('owner_id',actor).eq('bucket','available').maybeSingle());
      const total=(reward+fee)*c.quantity;
      const quote=must(await db.from('rr_quotes').insert({campaign_id:c.id,owner_id:actor,campaign_updated_at:c.updated_at,terms_version:s.terms_version,total_kobo:total}).select('expires_at').single());
      return reply(req,{reward_kobo:reward*c.quantity,fee_kobo:fee*c.quantity,total_kobo:total,shortfall_kobo:Math.max(0,total-Number(account?.balance_kobo??0)),approved:s.approved,quantity:c.quantity,retention_hours:s.retention_hours,expires_at:quote?.expires_at,terms_version:s.terms_version,campaign_updated_at:c.updated_at});
    }
    if(body.action==='campaign-publish') {
      business(); requireReady('instagram');
      if(typeof body.terms_version!=='string') throw new ProviderError(409,'Review the campaign price before publishing.');
      const c=must(await db.from('rr_campaigns').select('*').eq('id',id(body.id)).eq('owner_id',actor).single());
      const ig=must(await db.from('rr_instagram_accounts').select('*').eq('user_id',actor).eq('status','verified').maybeSingle());
      if(!ig) throw new ProviderError(409,'Connect your Instagram account before publishing.');
      const profile=await rocket().profileById(ig.instagram_id);
      if(profile.isPrivate) throw new ProviderError(409,'Use a public Instagram account for your campaign.');
      let mediaId:string|null=null; let targetUrl=`https://www.instagram.com/${profile.username}/`;
      if(c.action==='comment') {const media=await rocket().resolveMedia(c.target_url); if(media.ownerId!==ig.instagram_id||media.commentsDisabled) throw new ProviderError(409,'Choose your own public post with comments enabled.'); mediaId=media.id;targetUrl=media.url;}
      else if(c.target_url) {
        let requested:URL;try{requested=new URL(c.target_url);}catch{throw new ProviderError(400,'Use the Instagram profile link for your connected account.');}
        const name=/^\/([A-Za-z0-9_.]{1,30})\/?$/.exec(requested.pathname)?.[1]?.toLowerCase();
        if(requested.protocol!=='https:'||!['instagram.com','www.instagram.com'].includes(requested.hostname)||requested.username||requested.password||requested.port||name!==profile.username.toLowerCase()) throw new ProviderError(409,'The profile link must match your connected Instagram account. Update the campaign before publishing.');
      }
      return reply(req,await command(db,actor,'campaign-publish',{id:c.id,target_id:profile.id,target_username:profile.username,media_id:mediaId,target_url:targetUrl,terms_version:body.terms_version,expected_total_kobo:body.expected_total_kobo,expected_updated_at:body.expected_updated_at}));
    }
    if(body.action==='campaign-detail') {
      business(); const c=must(await db.from('rr_campaigns').select('*').eq('id',id(body.id)).eq('owner_id',actor).maybeSingle());
      if(!c) throw new ProviderError(404,'Campaign not found.');
      const b=must(await db.from('businesses').select('name').eq('id',c.business_id).single());
      const offset=Number.isSafeInteger(body.offset)&&body.offset>=0&&body.offset<=100000?body.offset:0;
      const query=await db.from('rr_assignments').select('id,instagram_id,settled_at,reward_kobo,status',{count:'exact'}).eq('campaign_id',c.id).eq('status','settled').order('settled_at',{ascending:false}).range(offset,offset+499);
      const rows=must(query)??[];const totals=must(await db.rpc('rr_market_totals',{p_actor:actor}));
      const accounts=rows.length?must(await db.from('rr_instagram_accounts').select('username,instagram_id').in('instagram_id',rows.map(a=>a.instagram_id)))??[]:[];
      return reply(req,{campaign:campaignView(c,b?.name??'Business',Number(totals.pending_by_campaign[c.id]??0)),receipts_total:query.count??0,receipts_offset:offset,receipts_limit:500,receipts:rows.map(a=>({id:a.id,action:c.action,username:accounts.find(ig=>ig.instagram_id===a.instagram_id)?.username??'Instagram account',checked_at:a.settled_at,reward_kobo:Number(a.reward_kobo),status:a.status}))});
    }
    if(['campaign-state','task-claim','task-check','task-cancel'].includes(body.action)) {
      id(body.id); if(body.action==='campaign-state') business(); else worker();
      if(['task-claim','task-check'].includes(body.action)) requireReady('instagram');
      return reply(req,await command(db,actor,body.action,{id:body.id,state:body.state,comment_text:body.comment_text}));
    }
    if(body.action==='instagram-start') return reply(req,await command(db,actor,'instagram-start',{username:instagramUsername(String(body.username??''))}));
    if(body.action==='instagram-verify') {
      requireReady('instagram');
      const account=await command(db,actor,'instagram-attempt',{id:id(body.id)});
      const profile=await rocket().resolveProfile(account.username);
      // The random challenge proves control of the observed stable ID. An old
      // linked ID is not reused when a user deliberately changes usernames.
      if(!verifyProfileChallenge(profile,profile.id,account.challenge)) throw new ProviderError(409,'We could not find your code in your public Instagram bio. Save it on Instagram, then check again.');
      return reply(req,await command(db,actor,'instagram-confirm',{id:account.id,instagram_id:profile.id,username:profile.username,challenge:account.challenge}));
    }
    if(body.action==='instagram-disconnect') return reply(req,await command(db,actor,body.action));
    if(body.action==='payment-create') {
      business(); requireReady('payments'); money(body.amount_kobo);key(body.idempotency_key);
      if(typeof body.phone!=='string'||!/^(?:0\d{10}|\+?234\d{10})$/.test(body.phone)) throw new ProviderError(400,'Enter your Nigerian phone number for the payment receipt.');
      await requirePaymentLaunch(db,'collection');
      const p=await command(db,actor,'payment-create',{amount_kobo:body.amount_kobo,idempotency_key:body.idempotency_key});
      const checkout=await startCheckout(db,p,{email:user.email!,name:auth.profile.display_name,phone:body.phone});
      const saved=must(await db.from('rr_payments').select('id,reference,amount_kobo,status,checkout_url,created_at').eq('id',p.id).eq('owner_id',actor).single());
      return reply(req,{...saved,...checkout});
    }
    if(body.action==='payment-refresh') {
      requireReady('payments'); const p=must(await db.from('rr_payments').select('*').eq('id',id(body.id)).eq('owner_id',actor).maybeSingle());
      if(!p) throw new ProviderError(404,'Payment not found.');
      const result=await refreshPayment(db,p);return reply(req,{id:p.id,status:result.status});
    }
    if(body.action==='banks') {worker(); requireReady('payouts'); return reply(req,{banks:await pocket().listBanks()});}
    if(body.action==='bank-verify') {
      worker();requireReady('payouts');
      if(typeof body.bank_code!=='string'||typeof body.account_number!=='string') throw new ProviderError(400,'Enter a bank and account number.');
      const banks=await pocket().listBanks();const bank=banks.find(b=>b.code===body.bank_code);if(!bank) throw new ProviderError(400,'Select a bank from the list.');
      const b=await pocket().resolveBank({accountNumber:body.account_number,bankCode:body.bank_code});
      const saved=must(await db.from('rr_beneficiaries').upsert({owner_id:actor,bank_code:b.bankCode,bank_name:bank.name,account_number:b.accountNumber,account_name:b.accountName},{onConflict:'owner_id,bank_code,account_number'}).select('id').single());
      if(!saved) throw new ProviderError(409,'The bank account could not be saved. Please try again.');
      return reply(req,{id:saved.id,account_name:b.accountName});
    }
    if(body.action==='withdraw') {
      worker();requireReady('payouts'); money(body.amount_kobo);key(body.idempotency_key);id(body.beneficiary_id);
      if(body.amount_kobo%100!==0) throw new ProviderError(400,'Enter a whole-naira amount for your withdrawal.');
      if(!Number.isSafeInteger(body.expected_fee_kobo)||body.expected_fee_kobo<0||typeof body.terms_version!=='string'||!body.terms_version||body.terms_version.length>100) throw new ProviderError(409,'Review the withdrawal fee before continuing.');
      await requirePaymentLaunch(db,'payout');
      const p=await command(db,actor,'withdraw',{amount_kobo:body.amount_kobo,idempotency_key:body.idempotency_key,beneficiary_id:body.beneficiary_id,expected_fee_kobo:body.expected_fee_kobo,terms_version:body.terms_version});
      return reply(req,await startWithdrawal(db,p));
    }
    if(['business-save','case-create','notification-read'].includes(body.action)) {
      if(body.action==='business-save') business();
      return reply(req,await command(db,actor,body.action,body));
    }
    if(body.action.startsWith('admin-')) {
      await requireAdmin(auth);
      if(body.action==='admin-operations')return reply(req,await adminOperations(db));
      if(body.action==='admin-reconcile-run') {
        if(body.confirmation!=='CHECK LEDGER')throw new ProviderError(400,'Confirm checking the ledger. This check does not change balances.');
        return reply(req,await adminReconcileRun(db,actor));
      }
      if(body.action==='admin-list')return reply(req,await adminList(db,body));
      if(body.action==='admin-detail')return reply(req,await adminDetail(db,body.resource,id(body.id)));
      if(body.action==='admin-history')return reply(req,await adminHistory(db,{resource:body.resource,id:id(body.id),history:body.history,cursor:body.cursor}));
      if(body.action==='admin-payment-recheck') {
        requireReady('payments');
        const payment=must(await db.from('rr_payments').select('*').eq('id',id(body.id)).maybeSingle());
        if(!payment)throw new ProviderError(404,'Payment not found.');
        if(body.provider_reference!==undefined&&(typeof body.provider_reference!=='string'||body.provider_reference.length>120))throw new ProviderError(400,'Check the PocketFi reference.');
        must(await db.from('rr_audit').insert({actor_id:actor,action:'admin-payment-recheck-requested',reference:payment.id,details:{candidate_reference:body.provider_reference??null}}));
        const result=await recheckPayment(db,payment,{candidateProviderId:body.provider_reference});
        must(await db.from('rr_audit').insert({actor_id:actor,action:'admin-payment-recheck-result',reference:payment.id,details:{outcome:result.outcome,status:result.status}}));
        return reply(req,result);
      }
      if(body.action==='admin-assignment-close') {
        id(body.id);
        if(body.confirmation!=='CLOSE WITHOUT PAYMENT'||typeof body.reason!=='string'||body.reason.trim().length<10||body.reason.trim().length>1000)throw new ProviderError(400,'Review the task, explain the decision and confirm closing without payment.');
        const {data,error}=await db.rpc('rr_market_admin',{p_actor:actor,p_action:body.action,p_input:{id:body.id,reason:body.reason.trim()}});
        if(error)throw new ProviderError(409,error.code==='P0001'?error.message:'The task could not be closed. Refresh its status and try again.');
        return reply(req,data);
      }
      if(body.action==='admin-overview') {
        const s=await settings(db);
        const count=async(table:string,column:string,value:string)=>{const r=await db.from(table).select('id',{count:'exact',head:true}).eq(column,value);if(r.error) throw new Error('count unavailable');return r.count??0;};
        const [workers,businesses,liveCampaigns,openCases,pendingChecks]=await Promise.all([count('profiles','account_type','worker'),count('profiles','account_type','business'),count('rr_campaigns','status','live'),count('rr_cases','status','open'),count('rr_jobs','state','queued')]);
        const payoutCount=await db.from('rr_payments').select('id',{count:'exact',head:true}).eq('direction','payout').not('status','in','(succeeded,failed)');if(payoutCount.error)throw new Error('payout count unavailable');
        const cases=must(await db.from('rr_cases').select('id,subject,message,status,resolution,reference,created_at').neq('status','resolved').order('created_at').limit(100));
        const jobs=must(await db.from('rr_jobs').select('id,phase,state,attempts,due_at,reason').neq('state','done').order('due_at').limit(100));
        const payouts=must(await db.from('rr_payments').select('id,reference,amount_kobo,status,created_at').eq('direction','payout').not('status','in','(succeeded,failed)').order('created_at').limit(100));
        const audit=must(await db.from('rr_audit').select('id,action,created_at,reference').order('created_at',{ascending:false}).limit(100));
        const health=must(await db.rpc('rr_market_health'));
        return reply(req,{counts:{workers,businesses,live_campaigns:liveCampaigns,open_cases:openCases,pending_checks:pendingChecks,pending_payouts:payoutCount.count??0},health,cases,jobs,payouts,audit,capabilities:capabilityView(s),pricing:pricingView(s)});
      }
      if(!['admin-case','admin-settings','admin-retry'].includes(body.action)) throw new ProviderError(400,'Unknown administrative action.');
      const input=body.settings??body;
      const {data,error}=await db.rpc('rr_market_admin',{p_actor:actor,p_action:body.action,p_input:input});
      if(error) throw new ProviderError(409,error.code==='P0001'?error.message:'Check the settings and try again.');
      return reply(req,data);
    }
    throw new ProviderError(400,'Unknown request.');
  } catch(error) {
    if(error instanceof ProviderError) return reply(req,{error:error.message},error.status);
    if(error instanceof AdapterError) return reply(req,{error:error.message,code:error.code},error.code==='not_configured'?503:error.code==='invalid_input'?400:503);
    if(error instanceof SyntaxError) return reply(req,{error:'Invalid request.'},400);
    return reply(req,{error:'Unable to complete this request. Please try again.'},500);
  }
 };
}
