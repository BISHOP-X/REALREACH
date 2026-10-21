import test from 'node:test';
import assert from 'node:assert/strict';
import {withdrawalBlockReason} from '../src/live/marketplace.types.ts';

const workspace = () => ({account_hold:false,capabilities:{payouts:true,payouts_paused:false},pricing:{approved:true,terms_version:'terms-1',minimum_withdrawal_kobo:100000,withdrawal_fee_kobo:5000},wallet:{available_kobo:105000},beneficiaries:[{id:'bank-one',status:'verified'}]});
test('withdrawal eligibility includes the displayed fee and accepts exact available funds',()=>{
  const data=workspace();
  assert.equal(withdrawalBlockReason(data,'1000','bank-one'),null);
  data.wallet.available_kobo=104999;
  assert.match(withdrawalBlockReason(data,'1000','bank-one'),/₦1,050.*fee/);
});
test('withdrawal guards explain a hold, provider downtime, pause and missing approved terms',()=>{
  for(const [change,reason] of [
    [d=>d.account_hold=true,/review a payment/],
    [d=>d.capabilities.payouts=false,/unavailable/],
    [d=>d.capabilities.payouts_paused=true,/temporarily paused/],
    [d=>d.pricing.approved=false,/fees and limits/],
    [d=>d.pricing.terms_version='',/fees and limits/],
  ]) {const data=workspace();change(data);assert.match(withdrawalBlockReason(data,'1000','bank-one'),reason);}
});
test('pending or foreign bank records cannot pass the withdrawal form guard',()=>{
  const data=workspace();
  assert.match(withdrawalBlockReason(data,'1000','another-bank'),/verified bank/);
  data.beneficiaries[0].status='pending';
  assert.match(withdrawalBlockReason(data,'1000','bank-one'),/verified bank/);
});
test('withdrawal amounts obey minimum, whole-naira and absolute limits before requests',()=>{
  const data=workspace();data.wallet.available_kobo=9_999_999_900;
  assert.match(withdrawalBlockReason(data,'999','bank-one'),/minimum/);
  for(const amount of ['','1000.01','0','-10','1e3','1000.001']) assert.match(withdrawalBlockReason(data,amount,'bank-one'),/whole-naira/);
  assert.match(withdrawalBlockReason(data,'10000001','bank-one'),/no more than/);
  assert.match(withdrawalBlockReason(null,'1000','bank-one'),/Reload/);
});
