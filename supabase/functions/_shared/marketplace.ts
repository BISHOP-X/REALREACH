import { service, identity, must } from './runtime.ts';
import { ProviderError } from './instagram.ts';

export type DB = ReturnType<typeof service>;
export type Row = Record<string, any>;
export const env = (name: string) => Deno.env.get(name) ?? '';
export const configured = () => ({ instagram: Boolean(env('ROCKET_API_KEY')), payments: Boolean((env('POCKETFI_API_TOKEN')||env('POCKETFI_SECRET_KEY')) && env('POCKETFI_BUSINESS_ID')), payouts: Boolean((env('POCKETFI_API_TOKEN')||env('POCKETFI_SECRET_KEY')) && env('POCKETFI_BUSINESS_ID')) });
export async function command(db: DB, actor: string, action: string, input: Row = {}) {
  const { data, error } = await db.rpc('rr_market_command', { p_actor: actor, p_action: action, p_input: input });
  if (error) {
    if (error.code === '23505') throw new ProviderError(409, 'This account or action is already linked to another record.');
    if (error.code === '23514') throw new ProviderError(409, 'Check the amount and details. Your available funds must cover this request.');
    // Only intentional application exceptions are safe to expose.
    throw new ProviderError(409, error.code === 'P0001' ? error.message : 'This request could not be saved. Check the details and try again.');
  }
  return data;
}
export async function authenticated(req: Request, resolveIdentity:typeof identity=identity) {
  const auth = await resolveIdentity(req);
  const claims=await auth.db.auth.getClaims(auth.token);
  const sessionId=claims.data?.claims.session_id;
  if(claims.error||typeof sessionId!=='string'||!/^[a-f0-9-]{36}$/i.test(sessionId)
    ||must(await auth.db.rpc('rr_market_session',{p_actor:auth.user.id,p_session:sessionId}))!==true) throw new ProviderError(401,'Your session ended. Please sign in again.');
  const profile = must(await auth.db.from('profiles').select('account_type,display_name').eq('id', auth.user.id).single());
  if (!profile) throw new ProviderError(409, 'Your account profile is unavailable. Please contact support.');
  const admin = must(await auth.db.from('sole_admin').select('user_id').eq('user_id', auth.user.id).maybeSingle());
  if (!profile?.account_type && !admin) throw new ProviderError(409, 'Finish setting up your account first.');
  return { ...auth, profile, admin: Boolean(admin) };
}
export async function requireAdmin(auth: Awaited<ReturnType<typeof authenticated>>) {
  if (!auth.admin) throw new ProviderError(403, 'This workspace is restricted.');
  const { data, error } = await auth.db.auth.getClaims(auth.token);
  if (error || data?.claims.aal !== 'aal2') throw new ProviderError(403, 'Verify your authenticator before opening administration.');
}
export async function rate(db: DB, actor: string, action: string, limit = 30) {
  const allowed = must(await db.rpc('rr_market_rate', { p_actor: actor, p_action: action, p_limit: limit }));
  if (!allowed) throw new ProviderError(429, 'Please wait a minute and try again.');
}
export function campaignView(c: Row, businessName = 'Business', pending = 0) {
  return { id: c.id, business_id: c.business_id, owner_id: c.owner_id, business_name: businessName, title: c.title, action: c.action, status: c.status,
    target_url: c.target_url, target_username: c.target_username, target_id: c.target_id, instructions: c.instructions, quantity: c.quantity,
    unit_reward_kobo: Number(c.unit_reward_kobo), unit_fee_kobo: Number(c.unit_fee_kobo), reserved_kobo: Number(c.reserved_kobo), spent_kobo: Number(c.spent_kobo),
    delivered_count: c.delivered_count, active_count: c.active_count, pending_count: pending, created_at: c.created_at, updated_at: c.updated_at, ends_at: c.ends_at, retention_hours: c.retention_hours };
}
export function assignmentView(a: Row, c: Row, businessName: string, jobs: Row[] = []) {
  return { id: a.id, campaign_id: a.campaign_id, campaign_title: c.title, business_name: businessName, action: c.action, target_url: c.target_url,
    target_username: c.target_username, instructions: c.instructions, status: a.phase==='baseline'&&a.status==='reserved'?'checking':a.status, reason: a.reason ?? (a.phase === 'baseline' ? 'Checking that this is a new action for your Instagram account. Wait for this check before doing the task.' : null),
    reward_kobo: Number(a.reward_kobo), created_at: a.created_at, expires_at: a.expires_at, submitted_at: a.submitted_at, hold_until: a.hold_until, settled_at: a.settled_at,
    next_check_at: jobs.find(j => j.assignment_id === a.id && ['queued', 'running'].includes(j.state))?.due_at ?? null, comment_text: a.comment_text, evidence_id: a.evidence_id };
}
export function pricingView(s: Row) {
  return Object.fromEntries(['approved','follow_reward_kobo','follow_fee_kobo','comment_reward_kobo','comment_fee_kobo','retention_hours','claim_minutes','minimum_withdrawal_kobo','withdrawal_fee_kobo','max_campaign_quantity','terms_version'].map(key => [key, s[key]]));
}
export async function settings(db: DB) { return must(await db.from('rr_settings').select('*').eq('singleton', true).single()) as Row; }
export function capabilityView(s: Row) { const providers=configured(); return { ...providers, payments:providers.payments&&s.collections_enabled===true, payouts:providers.payouts&&s.payouts_enabled===true, pricing: s.approved, payouts_paused: s.payouts_paused }; }
export async function requirePaymentLaunch(db:DB,direction:'collection'|'payout') {
  const s=await settings(db);
  if(!s || (direction==='collection'?s.collections_enabled!==true:s.payouts_enabled!==true||s.payouts_paused!==false))
    throw new ProviderError(503,direction==='collection'?'Wallet top-ups are currently unavailable.':'Withdrawals are currently unavailable.');
}
const sum = (rows: Row[], field: string) => rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
export async function transactionViews(db:DB,actor:string,rows:Row[]) {
  const paymentId=(e:Row)=>/^withdraw-hold:([a-f0-9-]{36})$/i.exec(e.rr_journals.reference)?.[1];
  const ids=rows.map(paymentId).filter((value):value is string=>Boolean(value));
  const payments=ids.length?must(await db.from('rr_payments').select('id,status,reference').eq('owner_id',actor).eq('direction','payout').in('id',ids))??[]:[];
  return rows.map(e=>{
    const payoutId=paymentId(e);const payout=payments.find(p=>p.id===payoutId);const j=e.rr_journals;
    return {id:e.id,kind:payoutId?'withdrawal':j.kind,label:payoutId?(payout?.status==='succeeded'?'Bank withdrawal completed':payout?.status==='failed'?'Withdrawal did not complete':'Bank withdrawal pending'):j.label,
      amount_kobo:Number(e.amount_kobo),status:payoutId?(payout?.status??'unknown'):'completed',created_at:e.created_at??j.created_at,reference:payout?.reference??j.reference};
  });
}
export async function workspace(db: DB, actor: string) {
  const totals=must(await db.rpc('rr_market_totals',{p_actor:actor}));
  const [s, business, instagram, campaigns, feed, assignments, accounts, payments, beneficiaries, cases, notifications, holds] = await Promise.all([
    settings(db), db.from('businesses').select('id,name,category,website').eq('owner_id',actor).maybeSingle().then(must),
    db.from('rr_instagram_accounts').select('id,username,instagram_id,status,profile_url,avatar_url,verified_at,challenge,challenge_expires_at').eq('user_id',actor).maybeSingle().then(must),
    db.from('rr_campaigns').select('*').eq('owner_id',actor).order('created_at',{ascending:false}).limit(200).then(must),
    db.rpc('rr_market_feed',{p_actor:actor,p_limit:100}).then(must),
    db.from('rr_assignments').select('*').eq('worker_id',actor).order('created_at',{ascending:false}).limit(200).then(must),
    db.from('rr_ledger_accounts').select('id,bucket,balance_kobo').eq('owner_id',actor).then(must),
    db.from('rr_payments').select('id,reference,amount_kobo,direction,status,checkout_url,created_at').eq('owner_id',actor).order('created_at',{ascending:false}).limit(100).then(must),
    db.from('rr_beneficiaries').select('id,bank_code,bank_name,account_name,account_number,status').eq('owner_id',actor).order('created_at',{ascending:false}).limit(10).then(must),
    db.from('rr_cases').select('id,subject,message,status,resolution,reference,created_at').eq('owner_id',actor).order('created_at',{ascending:false}).limit(100).then(must),
    db.from('rr_notifications').select('id,title,body,href,read_at,created_at').eq('owner_id',actor).order('created_at',{ascending:false}).limit(100).then(must),
    db.from('rr_payment_risk_holds').select('id').eq('owner_id',actor).limit(1).then(must),
  ]);
  const ids = [...new Set([...(campaigns ?? []), ...(feed ?? [])].map(c=>c.id).concat((assignments ?? []).map(a=>a.campaign_id)))];
  const allCampaigns: Row[] = ids.length ? must(await db.from('rr_campaigns').select('*').in('id',ids)) ?? [] : [];
  const businesses = allCampaigns.length ? must(await db.from('businesses').select('id,name').in('id',[...new Set(allCampaigns.map(c=>c.business_id))])) ?? [] : [];
  const name = (id: string) => businesses.find(b=>b.id===id)?.name ?? 'Business';
  const jobs: Row[] = assignments?.length ? must(await db.from('rr_jobs').select('assignment_id,state,due_at').in('assignment_id',assignments.map(a=>a.id))) ?? [] : [];
  const availableIds=(accounts??[]).filter(a=>a.bucket==='available').map(a=>a.id);
  const ledger: Row[] = availableIds.length ? must(await db.from('rr_ledger_entries').select('id,account_id,amount_kobo,rr_journals(id,kind,label,created_at,reference)').in('account_id',availableIds).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(200)) ?? [] : [];
  // An assignment's pending earnings are a liability allocated in the funded
  // campaign reserve, not spendable money or fabricated ledger credits.
  return { business, instagram, campaigns:(campaigns ?? []).map(c=>campaignView(c,name(c.business_id),Number(totals.pending_by_campaign[c.id]??0))),
    feed:((feed ?? []) as Row[]).map(c=>campaignView(c,name(c.business_id))),
    assignments:(assignments ?? []).map(a=>{ const c=allCampaigns.find(c=>c.id===a.campaign_id)!; return assignmentView(a,c,name(c.business_id),jobs); }),
    wallet:{ currency:'NGN', available_kobo:sum((accounts ?? []).filter(a=>a.bucket==='available'),'balance_kobo'), pending_kobo:Number(totals.pending_kobo),
      reserved_kobo:sum((accounts ?? []).filter(a=>a.bucket==='campaign'),'balance_kobo'), withdrawing_kobo:sum((accounts ?? []).filter(a=>a.bucket==='withdrawal'),'balance_kobo'),
      earned_kobo:Number(totals.earned_kobo), spent_kobo:Number(totals.spent_kobo) },
    transactions:await transactionViews(db,actor,ledger),
    payments, beneficiaries:(beneficiaries ?? []).map(({account_number,...b})=>({...b,account_last4:account_number.slice(-4)})), cases, notifications, account_hold:Boolean(holds?.length), metrics:totals.metrics, pricing:pricingView(s), capabilities:capabilityView(s) };
}
export async function taskDetail(db: DB, actor: string, id: string) {
  const selected = must(await db.from('rr_assignments').select('*').eq('id',id).eq('worker_id',actor).maybeSingle());
  const c = must(await db.from('rr_campaigns').select('*').eq('id',selected?.campaign_id ?? id).maybeSingle());
  if (!c || (!selected && c.status!=='live')) throw new ProviderError(404,'This task is no longer available.');
  const a = selected ?? must(await db.from('rr_assignments').select('*').eq('campaign_id',c.id).eq('worker_id',actor).maybeSingle());
  const b = must(await db.from('businesses').select('name').eq('id',c.business_id).single());
  const ig = must(await db.from('rr_instagram_accounts').select('instagram_id,status').eq('user_id',actor).maybeSingle());
  let reason: string | null = null;
  if (a) reason='You have already accepted this task.';
  else if (!ig || ig.status!=='verified') reason='Connect your Instagram account before accepting a task.';
  else if (c.owner_id===actor || ig.instagram_id===c.target_id) reason='You cannot work on your own campaign.';
  else if (c.status!=='live' || c.remaining_count<1 || (c.ends_at && new Date(c.ends_at)<=new Date())) reason='This task is no longer available.';
  if(!reason) {
    const holds=must(await db.from('rr_payment_risk_holds').select('id').eq('owner_id',c.owner_id).limit(1));
    if(holds?.length)reason='This campaign is not accepting new work while a payment is reviewed.';
  }
  if(!reason && ig) {
    const prior=must(await db.from('rr_assignments').select('id').eq('target_key',`${c.action}:${c.media_id??c.target_id}`)
      .or(`worker_id.eq.${actor},instagram_id.eq.${ig.instagram_id}`).in('status',['reserved','checking','pending','settled','needs_review','ineligible']).limit(1));
    if(prior?.length) reason='You have already taken a task for this Instagram account or post.';
  }
  const jobs = a ? must(await db.from('rr_jobs').select('assignment_id,state,due_at').eq('assignment_id',a.id)) ?? [] : [];
  return {campaign:campaignView(c,b?.name),assignment:a ? assignmentView(a,c,b?.name,jobs) : null,eligible:!reason,reason};
}
