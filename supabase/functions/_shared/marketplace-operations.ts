import {type DB} from './marketplace.ts';
import {AlertSendError,buildOperationsEmail,createOperationsMailer,operationsEmailConfiguration,validateOperationsEmail,type OperationsEmail,type OperationsEmailConfiguration} from './operations-email.ts';

type Mailer = {send:(body:OperationsEmail,key:string)=>Promise<{id:string}>};
type Lease = {id:string;attempt_token:string;idempotency_key:string;payload:unknown;request_body:unknown;retry_until:string};
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const invalid=()=>new Error('operations_unavailable');
async function rpc(db:DB,name:string,args?:Record<string,unknown>):Promise<unknown>{
  const {data,error}=await db.rpc(name,args).abortSignal(AbortSignal.timeout(10_000));
  if(error)throw invalid();return data;
}
function readLease(value:unknown):Lease{
  if(!value||typeof value!=='object'||Array.isArray(value))throw invalid();
  const row=value as Record<string,unknown>;
  if(!uuid(row.id)||!uuid(row.attempt_token)||row.idempotency_key!==`rr-ops/${row.id}`||typeof row.retry_until!=='string'||!Number.isFinite(Date.parse(row.retry_until)))throw invalid();
  return row as Lease;
}
function codeFor(error:AlertSendError){
  if(['not_configured','unauthorized'].includes(error.code))return 'configuration_error';
  if(error.code==='rate_limited')return 'rate_limited';
  if(error.code==='concurrent_request')return 'provider_unavailable';
  if(error.outcome==='uncertain')return 'transport_uncertain';
  return 'request_rejected';
}

/** One leased digest per invocation. SQL collects independently of email and
 * freezes the full request. An acceptance-write outage leaves the lease for a
 * same-key retry, never a second newly constructed email. */
export async function runMarketplaceOperations(db:DB,dependencies:{
  configuration?:()=>OperationsEmailConfiguration;
  mailer?:(config:OperationsEmailConfiguration)=>Mailer;
  now?:()=>number;
}={}){
  const config=(dependencies.configuration??(()=>operationsEmailConfiguration(name=>Deno.env.get(name))))();
  if(!config.configured)return {state:'not_configured',accepted:0};
  const raw=await rpc(db,'rr_ops_lease');
  if(raw===null)return {state:'idle',accepted:0};
  const lease=readLease(raw);
  const finish=(outcome:string,providerId:string|null,errorCode:string|null)=>rpc(db,'rr_ops_finish',{
    p_id:lease.id,p_attempt_token:lease.attempt_token,p_outcome:outcome,p_provider_id:providerId,p_error_code:errorCode,
  });
  const deadline=Date.parse(lease.retry_until);
  const now=dependencies.now??Date.now;
  // Leave a margin for transport timeout. Never send a retry outside the
  // provider's idempotency retention, even if the database call was delayed.
  if(deadline-now()<20_000){await finish('uncertain',null,'retry_window_closed');return {state:'review_required',accepted:0};}
  let candidate:OperationsEmail;
  try {
    if(lease.request_body!==null){validateOperationsEmail(lease.request_body);candidate=lease.request_body;}
    else candidate=buildOperationsEmail(lease.payload,config);
  }catch(error){
    if(!(error instanceof AlertSendError))throw invalid();
    await finish('failed',null,codeFor(error));return {state:'failed',accepted:0};
  }
  // Await the durable frozen body before making any external request. Re-read
  // even on retries so an expired or replaced lease cannot send.
  const prepared=await rpc(db,'rr_ops_prepare',{p_id:lease.id,p_attempt_token:lease.attempt_token,p_request_body:candidate});
  validateOperationsEmail(prepared);
  if(deadline-now()<10_000){await finish('uncertain',null,'retry_window_closed');return {state:'review_required',accepted:0};}
  let accepted:{id:string};
  try {
    accepted=await (dependencies.mailer??(value=>createOperationsMailer({apiKey:value.apiKey})))(config).send(prepared,lease.idempotency_key);
    if(!uuid(accepted.id))throw new AlertSendError('transport_uncertain','uncertain');
  }catch(error){
    const safe=error instanceof AlertSendError?error:new AlertSendError('transport_uncertain','uncertain');
    await finish(safe.outcome,null,codeFor(safe));
    return {state:safe.outcome,accepted:0};
  }
  // Do not catch this as a send failure: the provider has already accepted.
  await finish('accepted',accepted.id,null);
  return {state:'accepted',accepted:1};
}
