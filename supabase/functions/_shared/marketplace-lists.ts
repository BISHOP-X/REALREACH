import { ProviderError } from './instagram.ts';
import { must } from './runtime.ts';
import { assignmentView, campaignView, transactionViews, type DB, type Row } from './marketplace.ts';
import {readRecordCursor,writeRecordCursor} from './marketplace-cursor.ts';
export async function listRecords(db:DB,actor:string,input:Row) {
  const resource=input.resource as string;
  if(!['feed','assignments','campaigns','transactions','payments','notifications','cases'].includes(resource))throw new ProviderError(400,'Unknown list.');
  const after=readRecordCursor(input.cursor);
  const filter=typeof input.filter==='string'?input.filter.slice(0,40):null;
  const query=typeof input.query==='string'?input.query.trim().slice(0,100):null;
  let rows:Row[];
  if(resource==='feed') {
    rows=must(await db.rpc('rr_market_feed',{p_actor:actor,p_before:after?.at??null,p_before_id:after?.id??null,p_filter:filter,p_query:query,p_limit:51}))??[];
  } else {
    const table={assignments:'rr_assignments',campaigns:'rr_campaigns',transactions:'rr_ledger_entries',payments:'rr_payments',notifications:'rr_notifications',cases:'rr_cases'}[resource]!;
    let request=db.from(table).select(resource==='transactions'?'id,amount_kobo,created_at,rr_journals!inner(kind,label,reference,created_at)':resource==='payments'?'id,reference,direction,amount_kobo,status,checkout_url,created_at':'*');
    if(resource==='transactions') {
      const accounts=must(await db.from('rr_ledger_accounts').select('id').eq('owner_id',actor).eq('bucket','available'))??[];
      if(!accounts.length)return {items:[],next_cursor:null};
      request=request.in('account_id',accounts.map(a=>a.id));
    } else request=request.eq(resource==='assignments'?'worker_id':'owner_id',actor);
    if(after)request=request.or(`created_at.lt.${after.at},and(created_at.eq.${after.at},id.lt.${after.id})`);
    if(filter&&filter!=='all') {
      if(resource==='transactions'&&filter==='withdrawal')request=request.like('rr_journals.reference','withdraw-hold:%');
      else if(resource==='transactions'&&filter==='reserve')request=request.eq('rr_journals.kind','reserve').not('rr_journals.reference','like','withdraw-hold:%');
      else if(resource==='transactions'&&['deposit','reward','release','refund','fee'].includes(filter))request=request.eq('rr_journals.kind',filter);
      else if(resource==='transactions')throw new ProviderError(400,'Unknown transaction filter.');
      else if(resource==='assignments'&&filter==='active')request=request.in('status',['reserved','checking','pending','needs_review']);
      else if(resource==='assignments'&&filter==='completed')request=request.eq('status','settled');
      else if(resource==='campaigns'&&filter==='active')request=request.in('status',['live','paused','closing']);
      else if(resource==='campaigns'&&filter==='finished')request=request.in('status',['completed','cancelled']);
      else if(resource==='notifications'&&filter==='unread')request=request.is('read_at',null);
      else if(resource==='payments'&&['collection','payout'].includes(filter))request=request.eq('direction',filter);
      else if(['assignments','campaigns','cases'].includes(resource))request=request.eq('status',filter);
    }
    if(query&&resource==='campaigns')request=request.ilike('title',`%${query}%`);
    if(query&&resource==='cases')request=request.ilike('subject',`%${query}%`);
    rows=must(await request.order('created_at',{ascending:false}).order('id',{ascending:false}).limit(51)) as Row[]??[];
  }
  const next=rows.length>50;rows=rows.slice(0,50);
  const last=rows.at(-1);const nextCursor=next&&last?writeRecordCursor({created_at:last.created_at,id:last.id}):null;
  if(resource==='feed'||resource==='campaigns') {
    const businesses=rows.length?must(await db.from('businesses').select('id,name').in('id',[...new Set(rows.map(c=>c.business_id))]))??[]:[];
    const totals=resource==='campaigns'?must(await db.rpc('rr_market_totals',{p_actor:actor})):null;
    return {items:rows.map(c=>campaignView(c,businesses.find(b=>b.id===c.business_id)?.name??'Business',Number(totals?.pending_by_campaign[c.id]??0))),next_cursor:nextCursor};
  }
  if(resource==='assignments') {
    const campaigns=rows.length?must(await db.from('rr_campaigns').select('*').in('id',[...new Set(rows.map(a=>a.campaign_id))]))??[]:[];
    const businesses=campaigns.length?must(await db.from('businesses').select('id,name').in('id',[...new Set(campaigns.map(c=>c.business_id))]))??[]:[];
    const jobs=rows.length?must(await db.from('rr_jobs').select('assignment_id,state,due_at').in('assignment_id',rows.map(a=>a.id)))??[]:[];
    return {items:rows.map(a=>{const c=campaigns.find(c=>c.id===a.campaign_id)!;return assignmentView(a,c,businesses.find(b=>b.id===c.business_id)?.name??'Business',jobs);}),next_cursor:nextCursor};
  }
  if(resource==='transactions')return {items:await transactionViews(db,actor,rows),next_cursor:nextCursor};
  // Whitelist support and notification fields; internal owner IDs are omitted.
  return {items:rows.map(({owner_id:_,...row})=>row),next_cursor:nextCursor};
}
