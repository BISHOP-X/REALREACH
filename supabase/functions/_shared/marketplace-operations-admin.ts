import {ProviderError} from './instagram.ts';
import {type DB} from './marketplace.ts';
import {operationsEmailConfiguration} from './operations-email.ts';

const counts=['pending_payments','uncertain_payments','stalled_payments','missing_references','pending_checks','review_checks','overdue_checks','risk_holds','support_open','support_overdue'] as const;
const findings=['unbalanced_journals','account_mismatches','campaign_mismatches','withdrawal_mismatches'] as const;
const incidentCodes=['payment_uncertain','payment_stalled','payment_missing_reference','verification_review','verification_overdue','risk_hold','support_waiting','worker_stale','reconciliation_discrepancy','reconciliation_failed','reconciliation_stale'] as const;
const alertStates=['queued','sending','retry','accepted','failed','needs_review','superseded'] as const;
const alertOutcomes=['accepted','retry','uncertain','failed'] as const;
const alertErrors=['rate_limited','provider_unavailable','transport_uncertain','request_rejected','configuration_error','lease_expired','retry_window_closed','attempt_limit'] as const;
const thresholds={snapshot_stale_minutes:15,worker_stale_minutes:10,reconciliation_stale_hours:26} as const;
type ObjectValue=Record<string,unknown>;
const unavailable=()=>new ProviderError(503,'Operations status is unavailable. Refresh and try again.');
function object(value:unknown):ObjectValue {
  if(!value||typeof value!=='object'||Array.isArray(value))throw unavailable();
  return value as ObjectValue;
}
function integer(value:unknown):number {
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw unavailable();
  return value;
}
function timestamp(value:unknown):string {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))throw unavailable();
  return value;
}
function nullableTime(value:unknown){return value===null?null:timestamp(value);}
function uuid(value:unknown):string {
  if(typeof value!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value))throw unavailable();
  return value;
}
function choice<T extends string>(value:unknown,allowed:readonly T[]):T {
  if(typeof value!=='string'||!allowed.includes(value as T))throw unavailable();
  return value as T;
}
function numericFields<T extends string>(value:unknown,keys:readonly T[]):Record<T,number> {
  const row=object(value);return Object.fromEntries(keys.map(key=>[key,integer(row[key])])) as Record<T,number>;
}
export function operationsReconciliationView(value:unknown) {
  const row=object(value);
  const status=choice(row.status,['clean','discrepancy','failed'] as const);
  return {id:uuid(row.id),status,checked_at:timestamp(row.checked_at),findings:status==='failed'?null:numericFields(row.findings,findings),error:row.error===null?null:choice(row.error,['reconciliation_failed'] as const)};
}
async function rpc(db:DB,name:string,args?:ObjectValue) {
  try {
    const {data,error}=await db.rpc(name,args).abortSignal(AbortSignal.timeout(12_000));
    if(error)throw unavailable();return data;
  }catch {throw unavailable();}
}

/** The controller enforces singleton admin + AAL2. Project only bounded,
 * allowlisted operational data; never forward arbitrary SQL rows, provider
 * messages, customer contacts, email bodies or server configuration secrets. */
export async function adminOperations(db:DB,dependencies:{now?:()=>number;configuration?:()=>{configured:boolean;reason:string}}={}) {
  const value=object(await rpc(db,'rr_ops_overview'));
  const now=(dependencies.now??Date.now)();if(!Number.isFinite(now))throw unavailable();
  const row=value.snapshot===null?null:object(value.snapshot);
  const snapshot=row?{collected_at:timestamp(row.collected_at),counts:numericFields(row.counts,counts),incidents:(()=>{
    if(!Array.isArray(row.incidents)||row.incidents.length>incidentCodes.length)throw unavailable();
    return row.incidents.map(value=>{const item=object(value);return {code:choice(item.code,incidentCodes),severity:choice(item.severity,['critical','warning'] as const),count:integer(item.count)};});
  })()}:null;
  const worker=object(value.worker),lastSeen=nullableTime(worker.last_seen_at),lastError=worker.last_error===null?null:choice(worker.last_error,['Worker run did not complete'] as const);
  const reconciliation=value.reconciliation===null?null:operationsReconciliationView(value.reconciliation);
  if(!Array.isArray(value.alerts))throw unavailable();
  const alerts=value.alerts.slice(0,20).map(value=>{
    const item=object(value);return {id:uuid(item.id),status:choice(item.status,alertStates),last_outcome:item.last_outcome===null?null:choice(item.last_outcome,alertOutcomes),
      created_at:timestamp(item.created_at),last_attempt_at:nullableTime(item.last_attempt_at),retry_until:nullableTime(item.retry_until),attempts:integer(item.attempts),
      provider_id:item.provider_id===null?null:uuid(item.provider_id),error_code:item.error_code===null?null:choice(item.error_code,alertErrors)};
  });
  const alerting=object(value.alerting);
  const config=(dependencies.configuration??(()=>operationsEmailConfiguration(name=>Deno.env.get(name))))();
  const reason=choice(config.reason,['ready','missing_key','missing_sender','invalid_sender','missing_recipient','invalid_recipient'] as const);
  if(typeof config.configured!=='boolean'||config.configured!==(reason==='ready'))throw unavailable();
  const snapshotStatus=!snapshot?'never_run':now-Date.parse(snapshot.collected_at)>thresholds.snapshot_stale_minutes*60_000?'stale':'fresh';
  const workerStatus=!lastSeen?'never_run':lastError?'failed':snapshotStatus!=='fresh'?'unknown':snapshot?.incidents.some(item=>item.code==='worker_stale')?'stale':'healthy';
  const reconciliationStatus=!reconciliation?'never_run':reconciliation.status==='failed'?'failed':now-Date.parse(reconciliation.checked_at)>thresholds.reconciliation_stale_hours*3_600_000?'stale':reconciliation.status;
  return {checked_at:new Date(now).toISOString(),snapshot,snapshot_status:snapshotStatus,
    worker:{last_seen_at:lastSeen,last_success_at:nullableTime(worker.last_success_at),last_failure_at:nullableTime(worker.last_failure_at),processed:integer(worker.processed),last_error:lastError,status:workerStatus},
    reconciliation,reconciliation_status:reconciliationStatus,alerts,
    alerting:{last_created_at:nullableTime(alerting.last_created_at),reminder_hours:integer(alerting.reminder_hours),configured:config.configured,configuration_reason:reason},thresholds};
}

export async function adminReconcileRun(db:DB,actor:string) {
  // A fixed source, no caller-provided SQL, limits, amounts, recipients or refs.
  const result=await rpc(db,'rr_ops_reconcile',{p_source:'manual'});
  if(result!==null&&typeof result==='object'&&(result as ObjectValue).busy===true)throw new ProviderError(409,'A ledger check is already running. Wait a moment and refresh.');
  const reconciliation=operationsReconciliationView(result);
  try {
    const {error}=await db.from('rr_audit').insert({actor_id:actor,action:'admin-reconcile-run',reference:reconciliation.id,details:{status:reconciliation.status}}).abortSignal(AbortSignal.timeout(5000));
    if(error)throw unavailable();
  }catch {throw unavailable();}
  return {reconciliation};
}
