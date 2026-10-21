import { createPocketFiClient, pocketFiPaymentId } from './pocketfi.ts';
import { ProviderError as AdapterError } from './provider-contract.ts';
import { ProviderError } from './instagram.ts';
import { must } from './runtime.ts';
import { env, requirePaymentLaunch, type DB, type Row } from './marketplace.ts';

export const pocket = () => createPocketFiClient({ apiKey: env('POCKETFI_API_TOKEN')||env('POCKETFI_SECRET_KEY'), businessId: env('POCKETFI_BUSINESS_ID') });
type PaymentProvider = ReturnType<typeof createPocketFiClient>;
type PaymentState = 'succeeded' | 'pending' | 'unknown' | 'failed';
async function confirmBoundPayment(db:DB,payment:Row,provider:PaymentProvider):Promise<PaymentState> {
  if(payment.currency!=='NGN'||!Number.isSafeInteger(Number(payment.amount_kobo))||Number(payment.amount_kobo)<=0) throw new ProviderError(409,'The saved payment details need investigation.');
  if(payment.direction==='collection') {
    return (await provider.confirmCheckout({paymentId:payment.provider_id,expectedAmountKobo:Number(payment.amount_kobo)})).state;
  }
  if(payment.direction!=='payout') throw new ProviderError(409,'The saved payment type needs investigation.');
  const beneficiary=must(await db.from('rr_beneficiaries').select('account_number').eq('id',payment.beneficiary_id).eq('owner_id',payment.owner_id).single());
  if(!beneficiary) throw new ProviderError(409,'The saved bank account is unavailable. Contact support.');
  return (await provider.confirmTransfer({providerId:payment.provider_id,expectedAmountKobo:Number(payment.amount_kobo),expectedAccountNumber:beneficiary.account_number})).state;
}
async function finishPayment(db:DB,payment:Row,state:PaymentState) {
  must(await db.rpc('rr_market_finish_payment',{p_id:payment.id,p_state:state,p_reference:payment.reference,p_amount:Number(payment.amount_kobo),p_currency:'NGN',p_provider_id:payment.provider_id}));
}
export async function refreshPayment(db: DB, payment: Row, dependencies:{provider?:()=>PaymentProvider}={}) {
  if (['succeeded','failed'].includes(payment.status)) return payment;
  if (!payment.provider_id) {
    // A lost payout response may still have paid the recipient. Without a
    // provider reference only support reconciliation can resolve it safely.
    if (payment.submitted_at && Date.now()-Date.parse(payment.submitted_at)<180_000) return payment;
    if (payment.submitted_at) {
      const changed=must(await db.from('rr_payments').update({status:'unknown',checked_at:new Date().toISOString()}).eq('id',payment.id).is('provider_id',null).not('status','in','(succeeded,failed)').select('id'));
      if(!changed?.length) return must(await db.from('rr_payments').select('*').eq('id',payment.id).single());
      must(await db.from('rr_jobs').update({state:'attention',reason:'Provider reference unavailable; reconcile before any further transfer',lease_id:null,lease_until:null}).eq('payment_id',payment.id).neq('state','done'));
    }
    return {...payment,status:payment.submitted_at ? 'unknown' : payment.status};
  }
  const state=await confirmBoundPayment(db,payment,(dependencies.provider??pocket)());
  await finishPayment(db,payment,state);
  const current=must(await db.from('rr_payments').select('*').eq('id',payment.id).single());
  if(!current) throw new ProviderError(409,'The saved payment is unavailable. Refresh before checking again.');
  return current;
}

export type PaymentRecoveryResult = {
  id:string; status:string; outcome:'confirmed'|'not_paid'|'pending'|'unknown'|'provider_support_required'|'risk_review';
  message:string; provider_state?:PaymentState;
};
/** Server-only recovery, callable only after the controller verifies singleton
 * admin + AAL2. It never dispatches, refunds, replaces a binding or clears holds.
 * An operator-entered reference is not evidence that an older equal-amount
 * transaction belongs to this request. PocketFi documents no correlation field
 * that permits safe recovery of a completely lost binding. */
export async function recheckPayment(
  db:DB,payment:Row,input:{candidateProviderId?:string}={},dependencies:{provider?:()=>PaymentProvider}={},
):Promise<PaymentRecoveryResult> {
  const saved=must(await db.from('rr_payments').select('*').eq('id',payment.id).single());
  if(!saved) throw new ProviderError(404,'Payment not found.');
  if(input.candidateProviderId!==undefined) {
    try { pocketFiPaymentId(input.candidateProviderId); }
    catch { throw new ProviderError(400,'Enter a valid PocketFi payment reference.'); }
    if(saved.provider_id&&input.candidateProviderId!==saved.provider_id) throw new ProviderError(409,'This payment already has a different PocketFi reference. It cannot be replaced.');
  }
  if(!saved.provider_id) return {id:saved.id,status:saved.status,outcome:'provider_support_required',message:
    'PocketFi support must identify the original request. Its documented API cannot prove that a recovered reference belongs to this payment. No reference was attached, funds released or payment resent.'};
  if(!saved.submitted_at) return {id:saved.id,status:saved.status,outcome:'provider_support_required',message:'This payment has no saved dispatch record. Investigate it with PocketFi before any further action. No money was moved.'};
  const flag=async(reason:string)=>{
    const bytes=new TextEncoder().encode(JSON.stringify(['admin-recheck-v1',saved.id,saved.provider_id,reason]));
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    const eventHash=[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
    must(await db.rpc('rr_market_payment_discrepancy',{p_id:saved.id,p_event_hash:eventHash,p_reason:reason}));
  };
  let state:PaymentState;
  try { state=await confirmBoundPayment(db,saved,(dependencies.provider??pocket)()); }
  catch(error) {
    if(!(error instanceof AdapterError)||error.code!=='terms_mismatch') throw error;
    await flag('PocketFi recheck returned details that differ from the saved payment');
    return {id:saved.id,status:saved.status,outcome:'risk_review',message:'PocketFi returned different payment details. A reconciliation case is recorded; no balance was changed or hold released.'};
  }
  const terminal=['succeeded','failed'].includes(saved.status);
  const definitive=['succeeded','failed'].includes(state);
  if(terminal&&definitive&&state!==saved.status) {
    await flag(`PocketFi recheck contradicts the saved ${saved.status} payment: ${state}`);
    return {id:saved.id,status:saved.status,provider_state:state,outcome:'risk_review',message:'PocketFi no longer agrees with the saved outcome. The payment needs reconciliation; no balance was changed or hold released.'};
  }
  if(!terminal) await finishPayment(db,saved,state);
  // Read the committed state, not a stale pending observation after a concurrent
  // webhook has settled the same payment. Settlement is already idempotent SQL.
  const current=must(await db.from('rr_payments').select('id,status').eq('id',saved.id).single());
  if(!current) throw new ProviderError(409,'The saved payment is unavailable. Refresh before checking again.');
  if(['succeeded','failed'].includes(current.status)&&definitive&&current.status!==state) return {id:saved.id,status:current.status,provider_state:state,outcome:'risk_review',message:'A concurrent confirmation recorded a different payment outcome. The discrepancy is saved for reconciliation; no balance was overridden or payment resent.'};
  const hold=must(await db.from('rr_payment_risk_holds').select('id').eq('payment_id',saved.id).maybeSingle());
  if(hold) return {id:saved.id,status:current.status,provider_state:state,outcome:'risk_review',message:'The provider status was checked. This payment still has a risk hold; a successful recheck does not resolve the underlying discrepancy or release the hold.'};
  const outcome=current.status==='succeeded'?'confirmed':current.status==='failed'?'not_paid':current.status==='pending'?'pending':'unknown';
  if(['succeeded','failed'].includes(current.status)&&!definitive) return {id:saved.id,status:current.status,provider_state:state,outcome,message:`This payment remains recorded as ${current.status==='succeeded'?'completed':'failed'}. The latest provider response is not final; no balance was changed or payment resent.`};
  return {id:saved.id,status:current.status,provider_state:state,outcome,message:
    outcome==='confirmed'?'PocketFi confirms this payment. Its saved settlement is reflected in the wallet.':
    outcome==='not_paid'?'PocketFi confirms this collection did not complete. No payment was resent.':
    outcome==='pending'?'PocketFi is still processing this payment. No payment was resent.':
    'PocketFi has not confirmed a definitive outcome. Keep the funds held and reconcile with PocketFi; do not resend or refund.'};
}
async function uncertain(db:DB,payment:Row,error:unknown) {
  const providerId=error instanceof AdapterError ? error.providerId : undefined;
  if(providerId)must(await db.rpc('rr_market_bind_payment',{p_id:payment.id,p_provider_id:providerId,p_status:'unknown'}));
  else must(await db.from('rr_payments').update({status:'unknown'}).eq('id',payment.id).is('provider_id',null).not('status','in','(succeeded,failed)'));
  must(await db.from('rr_jobs').update({state:providerId?'queued':'attention',reason:'The payment provider has not confirmed this request',due_at:new Date(Date.now()+60_000).toISOString(),lease_id:null,lease_until:null}).eq('payment_id',payment.id).neq('state','done'));
}
export async function startCheckout(db:DB,payment:Row,input:{email:string;name:string;phone:string}) {
  await requirePaymentLaunch(db,'collection');
  if (payment.checkout_url) return {id:payment.id,url:payment.checkout_url,checkout_url:payment.checkout_url};
  const provider=pocket();
  const claimed=must(await db.rpc('rr_market_dispatch',{p_id:payment.id}));
  if (!claimed) return {id:payment.id,status:payment.status};
  const names=input.name.trim().split(/\s+/);
  try {
    const result=await provider.createCheckout({amountKobo:Number(payment.amount_kobo),email:input.email,firstName:names[0]||'RealReach',lastName:names.slice(1).join(' ')||'Customer',phone:input.phone,
      redirectUrl:`https://www.realreach.com.ng/business/wallet?payment=${payment.id}`});
    must(await db.rpc('rr_market_bind_payment',{p_id:payment.id,p_provider_id:result.paymentId,p_status:'pending',p_checkout_url:result.checkoutUrl}));
    return {id:payment.id,url:result.checkoutUrl,checkout_url:result.checkoutUrl};
  } catch(error) { await uncertain(db,payment,error); throw new ProviderError(503,'Your payment request is being checked. Refresh its status before trying again.'); }
}
export async function startWithdrawal(db:DB,payment:Row) {
  await requirePaymentLaunch(db,'payout');
  const provider=pocket();
  const b=must(await db.from('rr_beneficiaries').select('*').eq('id',payment.beneficiary_id).eq('owner_id',payment.owner_id).single());
  const claimed=must(await db.rpc('rr_market_dispatch',{p_id:payment.id}));
  if (!claimed) return {id:payment.id,status:payment.status};
  try {
    const result=await provider.submitTransfer({reference:payment.reference,amountKobo:Number(payment.amount_kobo),accountNumber:b.account_number,bankCode:b.bank_code,accountName:b.account_name});
    must(await db.rpc('rr_market_bind_payment',{p_id:payment.id,p_provider_id:result.providerId,p_status:result.state,p_fee:result.feeKobo}));
    return {id:payment.id,status:result.state};
  } catch(error) { await uncertain(db,payment,error); return {id:payment.id,status:'unknown'}; }
}
