// Local-only recovery contracts. Injected PocketFi transport; no live payment,
// authenticated service connection, provider credentials or transaction occurs.
import assert from 'node:assert/strict';
import { recheckPayment, refreshPayment } from '../supabase/functions/_shared/marketplace-payments.ts';
import { createPocketFiClient } from '../supabase/functions/_shared/pocketfi.ts';
import { ProviderError } from '../supabase/functions/_shared/provider-contract.ts';
import { type DB, type Row } from '../supabase/functions/_shared/marketplace.ts';

const id='10000000-0000-4000-8000-000000000010';
const owner='10000000-0000-4000-8000-000000000011';
const providerId='PFI|recovery12345';
function fixture(overrides:Row={},responses:unknown[]=[]) {
  const payment:Row={id,owner_id:owner,beneficiary_id:'10000000-0000-4000-8000-000000000012',direction:'collection',reference:'RR-recovery-test',amount_kobo:100000,currency:'NGN',status:'unknown',provider_id:providerId,submitted_at:'2026-10-21T12:00:00Z',...overrides};
  const rpcCalls:{name:string;args:Row}[]=[];const requests:{url:string;body:Row}[]=[];const reads:{table:string;field:string;value:unknown}[]=[];
  let hold=false;let providerUsed=0;let committed=false;
  const db={
    from:(table:string)=>{
      const filters:Row={};
      const result=()=>({data:table==='rr_payments'?{...payment}:table==='rr_beneficiaries'?{account_number:'0123456789'}:table==='rr_payment_risk_holds'&&hold?{id:'hold-fixture'}:null,error:null});
      const q={select:()=>q,eq:(field:string,value:unknown)=>{filters[field]=value;reads.push({table,field,value});return q;},single:async()=>result(),maybeSingle:async()=>result()};return q;
    },
    rpc:async(name:string,args:Row)=>{
      rpcCalls.push({name,args});
      if(name==='rr_market_finish_payment') {
        assert.equal(args.p_id,id);assert.equal(args.p_provider_id,payment.provider_id);assert.equal(args.p_amount,payment.amount_kobo);
        if(!['succeeded','failed'].includes(payment.status)){payment.status=args.p_state;committed=args.p_state==='succeeded';}
      } else if(name==='rr_market_payment_discrepancy') {
        assert.equal(args.p_id,id);assert.match(args.p_event_hash,/^[a-f0-9]{64}$/);if(payment.status==='succeeded')hold=true;
      } else assert.fail(`Unexpected recovery mutation: ${name}`);
      return {data:null,error:null};
    },
  } as unknown as DB;
  const provider=()=>{
    providerUsed++;
    return createPocketFiClient({apiKey:'offline-fixture',businessId:'merchant-fixture',fetch:async(url,init)=>{
      const body=JSON.parse(String(init?.body));requests.push({url:String(url),body});
      assert.ok(String(url).endsWith('/checkout/confirm')||String(url).endsWith('/transaction/confirm'),'Recovery may only confirm; never dispatch');
      const response=responses.shift();assert.notEqual(response,undefined,'Unexpected provider call');
      if(response instanceof Error)throw response;
      return Response.json(response);
    }});
  };
  return {db,payment,rpcCalls,requests,reads,provider,get committed(){return committed;},get providerUsed(){return providerUsed;},setHold:()=>{hold=true;}};
}
const response=(status='completed',extra:Row={})=>({status,payment_id:providerId,amount:'1000.00',businessId:'merchant-fixture',currency:'NGN',account:'0123456789',...extra});
const run=(f:ReturnType<typeof fixture>,candidateProviderId?:string)=>recheckPayment(f.db,f.payment,{candidateProviderId},{provider:f.provider});

Deno.test('recovery missing reference rejects correlation by matching amount, owner or timestamp without any provider call',async()=>{
  const f=fixture({provider_id:null});
  const result=await run(f,'PFI|older_real_same_amount');
  assert.equal(result.outcome,'provider_support_required');assert.equal(f.providerUsed,0);assert.equal(f.rpcCalls.length,0);assert.equal(f.payment.provider_id,null);assert.equal(f.payment.status,'unknown');
  assert.match(result.message,/No reference was attached/);
});
Deno.test('recovery cannot replace a bound reference with another older real transaction',async()=>{
  const f=fixture();await assert.rejects(()=>run(f,'PFI|older_real_same_amount'),/different PocketFi reference/);
  assert.equal(f.providerUsed,0);assert.equal(f.rpcCalls.length,0);
});
Deno.test('recovery validates candidate format and saved dispatch without provider calls',async()=>{
  const f=fixture();await assert.rejects(()=>run(f,'https://attacker.test'),/valid PocketFi/);assert.equal(f.providerUsed,0);
  const missing=fixture({submitted_at:null});assert.equal((await run(missing)).outcome,'provider_support_required');assert.equal(missing.providerUsed,0);
});
Deno.test('recovery uses the authoritative saved payment rather than caller-supplied fields',async()=>{
  const f=fixture({},[response()]);
  const result=await recheckPayment(f.db,{...f.payment,amount_kobo:1,owner_id:'attacker',provider_id:'PFI|other_saved_id'},{},{provider:f.provider});
  assert.equal(result.outcome,'confirmed');assert.equal(f.rpcCalls[0].args.p_amount,100000);assert.equal(f.requests[0].body.payment_id,providerId);
});
Deno.test('bound collection recovery confirms and settles once; replay never dispatches or credits again',async()=>{
  const f=fixture({},[response(),response()]);
  assert.equal((await run(f,providerId)).outcome,'confirmed');assert.equal(f.committed,true);
  assert.equal((await run(f)).outcome,'confirmed');assert.equal(f.requests.length,2);
  assert.equal(f.rpcCalls.filter(call=>call.name==='rr_market_finish_payment').length,1);
});
Deno.test('bound payout recovery verifies owner-scoped recipient and never calls payout send',async()=>{
  const f=fixture({direction:'payout'},[response()]);assert.equal((await run(f)).outcome,'confirmed');
  assert.ok(f.reads.some(read=>read.table==='rr_beneficiaries'&&read.field==='owner_id'&&read.value===owner));
  assert.equal(f.requests[0].url,'https://api.pocketfi.ng/api/v1/transaction/confirm');assert.equal(f.requests.length,1);
});
Deno.test('recovery wrong amount, merchant, currency or provider reference records discrepancy without credit',async()=>{
  for(const extra of [{amount:'999.00'},{businessId:'another-merchant'},{currency:'USD'},{payment_id:'PFI|other_confirmed_id'}]) {
    const f=fixture({},[response('completed',extra)]);assert.equal((await run(f)).outcome,'risk_review');assert.equal(f.committed,false);
    assert.deepEqual(f.rpcCalls.map(call=>call.name),['rr_market_payment_discrepancy']);
  }
});
Deno.test('recovery wrong payout recipient records discrepancy without settlement',async()=>{
  const f=fixture({direction:'payout'},[response('completed',{account:'9999999999'})]);
  assert.equal((await run(f)).outcome,'risk_review');assert.equal(f.committed,false);assert.equal(f.rpcCalls[0].name,'rr_market_payment_discrepancy');
});
Deno.test('provider missing setup errors are actionable and cannot mutate money',async()=>{
  const f=fixture();await assert.rejects(()=>recheckPayment(f.db,f.payment,{},{provider:()=>createPocketFiClient({apiKey:'',businessId:''})}),error=>error instanceof ProviderError&&error.code==='not_configured');assert.equal(f.rpcCalls.length,0);
});
Deno.test('pending or unknown payouts stay held; failed/reversed are never a refund authority',async()=>{
  for(const status of ['pending','failed','reversed','unexpected']) {
    const f=fixture({direction:'payout'},[response(status)]);const result=await run(f);
    assert.equal(result.outcome,status==='pending'?'pending':'unknown');assert.equal(f.committed,false);
    assert.equal(f.rpcCalls[0].args.p_state,status==='pending'?'pending':'unknown');assert.equal(f.requests.length,1);
  }
});
Deno.test('collection failure is explicitly unpaid rather than a successful confirmation',async()=>{
  const f=fixture({},[response('failed')]);const result=await run(f);assert.equal(result.outcome,'not_paid');assert.equal(result.status,'failed');assert.equal(f.committed,false);
});
Deno.test('provider outage makes no financial mutation and does not disclose transport detail',async()=>{
  const f=fixture({},[new Error('private-upstream-body')]);await assert.rejects(()=>run(f),error=>error instanceof ProviderError&&error.code==='unavailable'&&!error.message.includes('private-upstream'));assert.equal(f.rpcCalls.length,0);
});
Deno.test('completed payment recheck disagreement flags a risk hold, never clawback or refund',async()=>{
  const f=fixture({status:'succeeded'},[response('failed'),response('failed')]);
  const result=await run(f);assert.equal(result.outcome,'risk_review');assert.equal(result.status,'succeeded');assert.equal(f.payment.status,'succeeded');
  await run(f);assert.equal(f.rpcCalls[0].args.p_event_hash,f.rpcCalls[1].args.p_event_hash);
  assert.ok(f.rpcCalls.every(call=>call.name==='rr_market_payment_discrepancy'));
});
Deno.test('successful recheck cannot clear an existing risk hold',async()=>{
  const f=fixture({status:'succeeded'},[response()]);f.setHold();
  const result=await run(f);assert.equal(result.outcome,'risk_review');assert.equal(result.provider_state,'succeeded');assert.equal(result.status,'succeeded');assert.equal(f.rpcCalls.length,0);assert.match(result.message,/does not.*release the hold/);
});
Deno.test('recovery reports a concurrent terminal disagreement as risk, not a misleading confirmed or unpaid result',async()=>{
  for(const [observed,current] of [['failed','succeeded'],['completed','failed']]) {
    const f=fixture({},[response(observed)]);
    const provider=()=>{const client=f.provider();return {...client,confirmCheckout:async(args:Parameters<typeof client.confirmCheckout>[0])=>{
      const result=await client.confirmCheckout(args);f.payment.status=current;return result;
    }};};
    const result=await recheckPayment(f.db,f.payment,{},{provider});
    assert.equal(result.outcome,'risk_review');assert.equal(result.status,current);assert.equal(f.committed,false);
    assert.equal(f.rpcCalls[0].name,'rr_market_finish_payment');assert.match(result.message,/concurrent confirmation/);
  }
});
Deno.test('customer refresh returns committed terminal state rather than its stale provider observation',async()=>{
  for(const [observed,current] of [['failed','succeeded'],['completed','failed']]) {
    const f=fixture({status:'pending'},[response(observed)]);const original={...f.payment};
    const provider=()=>{const client=f.provider();return {...client,confirmCheckout:async(args:Parameters<typeof client.confirmCheckout>[0])=>{
      const result=await client.confirmCheckout(args);f.payment.status=current;return result;
    }};};
    const result=await refreshPayment(f.db,original,{provider});assert.equal(result.status,current);assert.equal(f.committed,false);
    assert.equal(f.rpcCalls[0].name,'rr_market_finish_payment');
  }
});
Deno.test('nonterminal recheck of a recorded completion or failure is not reversal evidence',async()=>{
  for(const terminal of ['succeeded','failed'])for(const status of ['pending','unexpected']) {
    const f=fixture({status:terminal},[response(status)]);const result=await run(f);
    assert.equal(result.status,terminal);assert.equal(result.outcome,terminal==='succeeded'?'confirmed':'not_paid');
    assert.equal(f.rpcCalls.length,0);assert.match(result.message,/latest provider response is not final/);
  }
});
