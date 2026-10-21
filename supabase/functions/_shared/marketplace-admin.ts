import {ProviderError} from './instagram.ts';
import {must} from './runtime.ts';
import {readRecordCursor,writeRecordCursor} from './marketplace-cursor.ts';
import {type DB,type Row,configured,assignmentView,campaignView} from './marketplace.ts';

const PAYMENT_FIELDS='id,owner_id,direction,reference,provider_id,amount_kobo,fee_kobo,currency,status,created_at,submitted_at,checked_at';
const JOB_FIELDS='id,assignment_id,payment_id,phase,state,attempts,due_at,reason,scanned_pages,created_at';
const CASE_FIELDS='id,owner_id,subject,message,status,resolution,reference,created_at';
const AUDIT_FIELDS='id,actor_id,action,reference,created_at';
const PROFILE_FIELDS='id,display_name,account_type';
const HOLD_FIELDS='id,payment_id,reason,created_at';
const EVIDENCE_FIELDS='id,result,phase,actor_id,target_id,comment_id,reason,checked_at,provider';
const uuid=(value:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const literalSearch=(value:string)=>value.replace(/[\\%_]/g,'\\$&');
const moneyView=(row:Row)=>({...row,amount_kobo:Number(row.amount_kobo),fee_kobo:Number(row.fee_kobo)});

type RelatedRecord={resource:'payment'|'task'|'campaign';id:string};
/** A customer can type any support reference. Resolve only an exact record
 * belonging to that case's owner, never infer payment from UUID shape alone. */
async function relatedCases(db:DB,records:Row[]):Promise<Row[]> {
  const refs=[...new Set(records.map(row=>typeof row.reference==='string'?row.reference.trim():'').filter(Boolean))];
  const ids=refs.filter(uuid).map(value=>value.toLowerCase());
  const paymentRefs=refs.filter(value=>/^(?:RR-[a-f0-9]{32}|PFI\|[A-Za-z0-9_-]{4,100}|WD[A-Za-z0-9_-]{8,100})$/i.test(value));
  const ownerIds=[...new Set(records.map(row=>row.owner_id).filter(Boolean))];
  const [paymentsById,paymentsByRef,paymentsByProvider,assignments]=await Promise.all([
    ids.length?db.from('rr_payments').select('id,owner_id,reference,provider_id').in('id',ids).in('owner_id',ownerIds).then(must):Promise.resolve([]),
    paymentRefs.length?db.from('rr_payments').select('id,owner_id,reference,provider_id').in('reference',paymentRefs).in('owner_id',ownerIds).then(must):Promise.resolve([]),
    paymentRefs.length?db.from('rr_payments').select('id,owner_id,reference,provider_id').in('provider_id',paymentRefs).in('owner_id',ownerIds).then(must):Promise.resolve([]),
    ids.length?db.from('rr_assignments').select('id,worker_id,campaign_id').in('id',ids).then(must):Promise.resolve([]),
  ]);
  const tasks=(assignments??[]) as Row[];
  const campaignIds=[...new Set([...ids,...tasks.map(row=>row.campaign_id)])];
  const campaigns:Row[]=campaignIds.length?must(await db.from('rr_campaigns').select('id,owner_id').in('id',campaignIds))??[]:[];
  const payments=[...(paymentsById??[]),...(paymentsByRef??[]),...(paymentsByProvider??[])] as Row[];
  return records.map(record=>{
    const ref=typeof record.reference==='string'?record.reference.trim():'';
    const identity=uuid(ref)?ref.toLowerCase():ref;
    const candidates:RelatedRecord[]=[];
    for(const payment of payments)if(payment.owner_id===record.owner_id&&(payment.id===identity||payment.reference===ref||payment.provider_id===ref))candidates.push({resource:'payment',id:payment.id});
    for(const task of tasks)if(task.id===identity&&(task.worker_id===record.owner_id||campaigns.some(c=>c.id===task.campaign_id&&c.owner_id===record.owner_id)))candidates.push({resource:'task',id:task.id});
    for(const campaign of campaigns)if(campaign.id===identity&&campaign.owner_id===record.owner_id)candidates.push({resource:'campaign',id:campaign.id});
    const distinct=[...new Map(candidates.map(value=>[`${value.resource}:${value.id}`,value])).values()];
    return {...record,related_record:distinct.length===1?distinct[0]:null,
      reference_resolution:!ref?'missing':distinct.length===1?'resolved':distinct.length>1?'ambiguous':'unavailable'};
  });
}

type DetailResource='payment'|'task'|'campaign';
type History='jobs'|'evidence'|'cases'|'audit'|'events';
type DetailContext={resource:DetailResource;id:string;payment?:Row;assignment?:Row;campaign?:Row};
const supportedHistory={payment:['jobs','cases','audit','events'],task:['jobs','evidence','cases','audit'],campaign:['cases','audit']} as const;
async function detailContext(db:DB,resource:string,id:string):Promise<DetailContext> {
  if(!Object.hasOwn(supportedHistory,resource))throw new ProviderError(400,'Choose a payment, task or campaign.');
  if(resource==='payment') {
    const payment=must(await db.from('rr_payments').select(`${PAYMENT_FIELDS},beneficiary_id`).eq('id',id).maybeSingle());
    if(!payment)throw new ProviderError(404,'Payment not found.');
    return {resource,id,payment};
  }
  if(resource==='campaign') {
    const campaign=must(await db.from('rr_campaigns').select('*').eq('id',id).maybeSingle());
    if(!campaign)throw new ProviderError(404,'Campaign not found.');
    return {resource,id,campaign};
  }
  const assignment=must(await db.from('rr_assignments').select('id,campaign_id,worker_id,instagram_id,status,phase,reason,reward_kobo,fee_kobo,created_at,expires_at,submitted_at,hold_until,settled_at,comment_text,comment_id,evidence_id').eq('id',id).maybeSingle());
  if(!assignment)throw new ProviderError(404,'Task not found.');
  const campaign=must(await db.from('rr_campaigns').select('*').eq('id',assignment.campaign_id).single());
  if(!campaign)throw new ProviderError(404,'The task campaign is unavailable.');
  return {resource:'task',id,assignment,campaign};
}
function historyCursor(value:unknown,context:Pick<DetailContext,'resource'|'id'>,history:History):{at:string;key:string}|null {
  if(value===undefined||value===null||value==='')return null;
  try {
    if(typeof value!=='string'||value.length>1000)throw new Error();
    const row=JSON.parse(atob(value));
    if(row.v!==1||row.resource!==context.resource||row.parent!==context.id||row.history!==history
      ||typeof row.at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(row.at)||!Number.isFinite(Date.parse(row.at))
      ||typeof row.key!=='string'||(history==='events'?!/^[a-f0-9]{64}$/.test(row.key):!uuid(row.key)))throw new Error();
    return {at:row.at,key:row.key};
  }catch {throw new ProviderError(400,'This history link expired. Reopen the record and try again.');}
}
function validateHistory(resource:unknown,history:unknown):asserts history is History {
  if(typeof resource!=='string'||!Object.hasOwn(supportedHistory,resource)||typeof history!=='string'
    ||!(supportedHistory[resource as DetailResource] as readonly string[]).includes(history))throw new ProviderError(400,'Choose an available record history.');
}
async function historyPage(db:DB,context:DetailContext,history:History,cursor?:unknown) {
  const after=historyCursor(cursor,context,history);
  const table={jobs:'rr_jobs',evidence:'rr_evidence',cases:'rr_cases',audit:'rr_audit',events:'rr_payment_events'}[history];
  const fields={jobs:JOB_FIELDS,evidence:EVIDENCE_FIELDS,cases:CASE_FIELDS,audit:AUDIT_FIELDS,events:'event_hash,reason,created_at'}[history];
  const time=history==='evidence'?'checked_at':'created_at';const key=history==='events'?'event_hash':'id';
  let query=db.from(table).select(fields);
  if(history==='jobs')query=query.eq(context.resource==='payment'?'payment_id':'assignment_id',context.id);
  else if(history==='evidence')query=query.eq('assignment_id',context.id);
  else if(history==='events')query=query.eq('payment_id',context.id);
  else {
    const references=context.payment?[context.id,context.payment.reference,context.payment.provider_id].filter(Boolean):[context.id];
    query=query.in('reference',references);
    if(history==='cases')query=query.in('owner_id',context.payment?[context.payment.owner_id]:context.assignment?[context.assignment.worker_id,context.campaign!.owner_id]:[context.campaign!.owner_id]);
  }
  if(after)query=query.or(`${time}.lt.${after.at},and(${time}.eq.${after.at},${key}.lt.${after.key})`);
  const rows=(must(await query.order(time,{ascending:false}).order(key,{ascending:false}).limit(51))??[]) as Row[];
  const selected=rows.slice(0,50),last=selected.at(-1);
  const next=rows.length>50&&last?btoa(JSON.stringify({v:1,resource:context.resource,parent:context.id,history,at:last[time],key:last[key]})):null;
  return {items:history==='cases'?await relatedCases(db,selected):selected,next_cursor:next};
}
export async function adminHistory(db:DB,input:Row) {
  validateHistory(input.resource,input.history);
  // Reject mismatched/injected cursors before any service-role record access.
  historyCursor(input.cursor,{resource:input.resource,id:input.id},input.history);
  return await historyPage(db,await detailContext(db,input.resource,input.id),input.history,input.cursor);
}
async function firstHistories(db:DB,context:DetailContext) {
  const histories=supportedHistory[context.resource];
  const pages=await Promise.all(histories.map(history=>historyPage(db,context,history)));
  return {rows:Object.fromEntries(histories.map((history,index)=>[history,pages[index].items])),
    history_cursors:Object.fromEntries(histories.map((history,index)=>[history,pages[index].next_cursor])),
    history_limits:Object.fromEntries(histories.map(history=>[history,50]))};
}

/** Internal admin reads. The HTTP caller MUST enforce singleton identity and
 * current AAL2 before invoking these; no direct customer endpoint exposes them. */
export async function adminList(db:DB,input:Row) {
  const tables={cases:'rr_cases',checks:'rr_jobs',payments:'rr_admin_payment_view',audit:'rr_audit'} as const;
  const resource=input.resource as keyof typeof tables;
  if(!Object.hasOwn(tables,resource))throw new ProviderError(400,'Choose a valid review queue.');
  const fields={cases:CASE_FIELDS,checks:JOB_FIELDS,payments:`${PAYMENT_FIELDS},risk_held`,audit:AUDIT_FIELDS}[resource];
  const filters={cases:['all','open','in_review','resolved'],checks:['all','attention','queued','running','done'],payments:['all','attention','payout','collection','succeeded','failed'],audit:['all']}[resource];
  const filter=input.filter??'all';
  if(typeof filter!=='string'||!filters.includes(filter))throw new ProviderError(400,'Choose a valid status filter.');
  if(input.query!==undefined&&(typeof input.query!=='string'||input.query.length>100))throw new ProviderError(400,'Keep your search under 100 characters.');
  const search=(input.query??'').trim();
  const after=readRecordCursor(input.cursor);
  let request=db.from(tables[resource]).select(fields);
  const groups:string[]=[];
  if(after)groups.push(`or(created_at.lt.${after.at},and(created_at.eq.${after.at},id.lt.${after.id}))`);
  if(filter!=='all') {
    if(resource==='payments'&&filter==='attention')groups.push('or(status.in.(created,pending,unknown),risk_held.eq.true)');
    else if(resource==='payments'&&['payout','collection'].includes(filter))request=request.eq('direction',filter);
    else request=request.eq(resource==='checks'?'state':'status',filter);
  }
  if(search) {
    if(uuid(search)&&resource==='checks')groups.push(`or(id.eq.${search},assignment_id.eq.${search},payment_id.eq.${search})`);
    else if(uuid(search)&&resource==='payments')request=request.eq('id',search);
    else request=request.ilike({cases:'subject',checks:'reason',payments:'reference',audit:'action'}[resource],`%${literalSearch(search)}%`);
  }
  if(groups.length)request=request.or(`and(${groups.join(',')})`);
  const rows=(must(await request.order('created_at',{ascending:false}).order('id',{ascending:false}).limit(51))??[]) as Row[];
  const more=rows.length>50;const selected=rows.slice(0,50);const last=selected.at(-1);
  const ownerIds=[...new Set(selected.map(row=>row.owner_id).filter(Boolean))];
  const owners:Row[]=ownerIds.length?must(await db.from('profiles').select(PROFILE_FIELDS).in('id',ownerIds))??[]:[];
  const visible=resource==='cases'?await relatedCases(db,selected):selected;
  return {items:visible.map(row=>({...(resource==='payments'?moneyView(row):row),...(row.owner_id?{owner:owners.find(owner=>owner.id===row.owner_id)??null}:{})})),
    next_cursor:more&&last?writeRecordCursor({created_at:last.created_at,id:last.id}):null};
}

export async function adminDetail(db:DB,resource:string,id:string) {
  const context=await detailContext(db,resource,id);
  const history=await firstHistories(db,context);
  if(resource==='payment') {
    const payment=context.payment!;
    const [owner,beneficiary,hold]=await Promise.all([
      db.from('profiles').select(PROFILE_FIELDS).eq('id',payment.owner_id).maybeSingle().then(must),
      payment.beneficiary_id?db.from('rr_beneficiaries').select('bank_name,account_name,account_number').eq('id',payment.beneficiary_id).eq('owner_id',payment.owner_id).maybeSingle().then(must):Promise.resolve(null),
      db.from('rr_payment_risk_holds').select(HOLD_FIELDS).eq('payment_id',id).maybeSingle().then(must),
    ]);
    // No full bank number, checkout URL, idempotency key or provider payload.
    const {beneficiary_id:_,...safePayment}=payment;
    return {payment:moneyView(safePayment),owner,beneficiary:beneficiary?{bank_name:beneficiary.bank_name,account_name:beneficiary.account_name,account_last4:beneficiary.account_number.slice(-4)}:null,
      ...history.rows,evidence:[],risk_hold:hold,
      allowed_actions:{recheck:configured().payments,close_without_payment:false},
      recovery_note:hold?'New spending is on hold. A payment recheck does not automatically clear a dispute.':!payment.provider_id?'PocketFi must identify this payment before it can be reconciled. Do not send another payout or release held funds.':'Recheck the saved reference with PocketFi. Only a matching provider confirmation can complete payment.',
      history_limits:history.history_limits,history_cursors:history.history_cursors};
  }
  const campaign=context.campaign!;
  if(resource==='campaign') {
    const [owner,business]=await Promise.all([
      db.from('profiles').select(PROFILE_FIELDS).eq('id',campaign.owner_id).maybeSingle().then(must),
      db.from('businesses').select('name').eq('id',campaign.business_id).maybeSingle().then(must),
    ]);
    return {campaign:{...campaignView(campaign,business?.name??'Business'),terms_version:campaign.terms_version},owner,
      ...history.rows,history_limits:history.history_limits,history_cursors:history.history_cursors};
  }
  const assignment=context.assignment!;
  const [people,closure,business,registry,instagram]=await Promise.all([
    db.from('profiles').select(PROFILE_FIELDS).in('id',[assignment.worker_id,campaign.owner_id]).then(must),
    db.from('rr_assignment_closures').select('assignment_id,reason,created_at,actor_id,amount_kobo,release_destination').eq('assignment_id',id).maybeSingle().then(must),
    db.from('businesses').select('name').eq('id',campaign.business_id).maybeSingle().then(must),
    db.from('rr_instagram_registry').select('instagram_id,user_id').eq('instagram_id',assignment.instagram_id).eq('user_id',assignment.worker_id).maybeSingle().then(must),
    db.from('rr_instagram_accounts').select('instagram_id,username,user_id').eq('instagram_id',assignment.instagram_id).eq('user_id',assignment.worker_id).maybeSingle().then(must),
  ]);
  const jobs=history.rows.jobs??[];
  const identityMatches=registry?.instagram_id===assignment.instagram_id&&registry?.user_id===assignment.worker_id;
  const currentMatches=instagram?.instagram_id===assignment.instagram_id&&instagram?.user_id===assignment.worker_id;
  return {assignment:{...assignment,...assignmentView(assignment,campaign,business?.name??'Business',jobs??[]),fee_kobo:Number(assignment.fee_kobo)},campaign:{...campaignView(campaign,business?.name??'Business'),terms_version:campaign.terms_version},
    worker:people?.find(p=>p.id===assignment.worker_id)??null,owner:people?.find(p=>p.id===campaign.owner_id)??null,
    worker_instagram:identityMatches?{instagram_id:assignment.instagram_id,username:currentMatches?instagram!.username:null}:null,
    ...history.rows,closure:closure?{id:closure.assignment_id,reason:closure.reason,created_at:closure.created_at,actor_id:closure.actor_id,amount_kobo:Number(closure.amount_kobo),release_destination:closure.release_destination}:null,
    allowed_actions:{retry:assignment.status==='needs_review'&&(jobs??[]).some(j=>j.state==='attention'),close_without_payment:assignment.status==='needs_review'&&!closure},
    history_limits:history.history_limits,history_cursors:history.history_cursors};
}
