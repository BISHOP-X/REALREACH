import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { createPocketFiClient, koboToNaira, nairaToKobo, pocketFiPaymentId, verifyPocketFiWebhook } from '../supabase/functions/_shared/pocketfi.ts'
import { ProviderError } from '../supabase/functions/_shared/provider-contract.ts'
import { createPocketFiWebhookHandler } from '../supabase/functions/pocketfi-webhook/handler.ts'

const paymentId = 'PFI|fixture12345'
const checkout = { amountKobo: 150025, email: 'payer@example.test', firstName: 'Amina', lastName: 'Test', phone: '+2348090000001', redirectUrl: 'https://www.realreach.com.ng/business/wallet?payment=fixture' }
const beneficiary = { accountNumber: '0123456789', bankCode: '044', accountName: 'AMINA TEST' }
const payout = { ...beneficiary, reference: 'rr-test-once', amountKobo: 100000 }
function transport(responses, mode = 'live') {
  const calls = []
  const fetch = async (url, init) => {
    calls.push({ url, ...init, data: init.body ? JSON.parse(init.body) : undefined })
    const next = responses.shift()
    assert.notEqual(next, undefined, `Unexpected provider call ${url}`)
    if (next instanceof Error) throw next
    return next instanceof Response ? next : Response.json(next)
  }
  return { calls, client: createPocketFiClient({ apiKey: 'fixture-only', businessId: '1234', fetch, mode }) }
}

test('PocketFi requires both server secret and merchant identity', () => {
  for (const config of [{ apiKey: '', businessId: '1234' }, { apiKey: 'fixture', businessId: '' }]) assert.throws(() => createPocketFiClient(config), { code: 'not_configured' })
})
test('kobo/naira conversions do not round, multiply currency twice or accept unsafe values', () => {
  assert.equal(koboToNaira(150025), '1500.25')
  assert.equal(nairaToKobo('1500.25'), 150025)
  assert.equal(nairaToKobo('10.1'), 1010)
  assert.equal(nairaToKobo('0', true), 0)
  for (const value of ['1.009', '-1', '1e5', '1,000', '', null, true]) assert.throws(() => nairaToKobo(value))
  for (const value of [0, -1, 1.2, Number.MAX_SAFE_INTEGER + 1, Infinity]) assert.throws(() => koboToNaira(value))
})
test('payment references support official WD format and current PFI format only', () => {
  assert.equal(pocketFiPaymentId('WD1743604443863AA1E7D90A'), 'WD1743604443863AA1E7D90A')
  assert.equal(pocketFiPaymentId(paymentId), paymentId)
  for (const id of ['../../payment', '', 'arbitrary-reference', 123]) assert.throws(() => pocketFiPaymentId(id))
})
test('checkout calls documented endpoint and sends naira with correct business_id field', async () => {
  const { client, calls } = transport([{ status: 'success', payment_id: paymentId, payment_link: `https://pocketfi.ng/checkout/${paymentId}` }])
  assert.equal((await client.createCheckout(checkout)).paymentId, paymentId)
  assert.equal(calls[0].url, 'https://api.pocketfi.ng/api/v1/checkout/request')
  assert.deepEqual(calls[0].data, { first_name: 'Amina', last_name: 'Test', phone: '08090000001', email: 'payer@example.test', amount: '1500.25', business_id: '1234', redirect_link: checkout.redirectUrl })
  assert.equal(calls[0].headers.Authorization, 'Bearer fixture-only')
  assert.equal(calls[0].redirect, 'error')
})
test('sandbox uses explicit API test mode without changing production default', async () => {
  const { client, calls } = transport([{ status: 'success', payment_id: paymentId, payment_link: `https://pocketfi.ng/checkout/${paymentId}` }], 'test')
  await client.createCheckout({ ...checkout, redirectUrl: 'http://localhost:5173/business/wallet' })
  assert.equal(calls[0].url, 'https://api.pocketfi.ng/api/test/checkout/request')
})
test('invalid phone, email and external callback never reach provider', async () => {
  const { client, calls } = transport([])
  for (const override of [{ phone: '090999' }, { email: 'broken' }, { redirectUrl: 'https://www.realreach.com.ng.evil.test/' }, { redirectUrl: 'https://evil@www.realreach.com.ng/' }, { redirectUrl: 'http://localhost:5173/' }]) await assert.rejects(client.createCheckout({ ...checkout, ...override }), { code: 'invalid_input' })
  assert.equal(calls.length, 0)
})
test('checkout rejects malicious checkout host or mismatched payment reference', async () => {
  for (const link of ['https://pocketfi.ng.evil.test/checkout/' + paymentId, 'javascript:alert(1)', 'https://pocketfi.ng/checkout/PFI|wrong1234']) {
    const { client } = transport([{ status: 'success', payment_id: paymentId, payment_link: link }])
    await assert.rejects(client.createCheckout(checkout), error => error.code === 'transport_uncertain' && error.providerId === paymentId)
  }
})
test('checkout success requires exact amount and server-generated provider reference', async () => {
  const { client } = transport([{ status: 'completed', payment_id: paymentId, amount: '1500.25', account: '0123456789' }])
  assert.deepEqual(await client.confirmCheckout({ paymentId, expectedAmountKobo: 150025 }), { state: 'succeeded', paymentId, amountKobo: 150025, account: '0123456789' })
})
test('wrong amount, reference, merchant and currency cannot credit a checkout', async () => {
  for (const mismatch of [{ amount: '1500.24' }, { payment_id: 'PFI|other1234' }, { currency: 'USD' }, { businessId: '9876' }]) {
    const { client } = transport([{ status: 'completed', payment_id: paymentId, amount: '1500.25', ...mismatch }])
    await assert.rejects(client.confirmCheckout({ paymentId, expectedAmountKobo: 150025 }), { code: 'terms_mismatch' })
  }
})
test('unrecognized and boolean checkout statuses never imply payment', async () => {
  for (const status of [true, 'ok', 'paid-ish', 'submitted']) {
    const { client } = transport([{ status, payment_id: paymentId, amount: '1500.25' }])
    assert.equal((await client.confirmCheckout({ paymentId, expectedAmountKobo: 150025 })).state, 'unknown')
  }
})
test('bank list uses strings to preserve bank-code leading zeroes and rejects duplicates', async () => {
  const { client } = transport([{ banks: [{ code: '044', name: 'Access Bank' }, { code: '058', name: 'GT Bank' }] }])
  assert.equal((await client.listBanks())[0].code, '044')
  const bad = transport([{ banks: [{ code: '044', name: 'Access Bank' }, { code: '044', name: 'Different Bank' }] }])
  await assert.rejects(bad.client.listBanks(), { code: 'invalid_response' })
})
test('beneficiary resolution checks live catalogue and exact bank code', async () => {
  const { client, calls } = transport([{ banks: [{ code: '044', name: 'Access Bank' }] }, { status: 'success', bank_code: '044', account_name: 'AMINA TEST' }])
  assert.deepEqual(await client.resolveBank({ accountNumber: '0123456789', bankCode: '044' }), beneficiary)
  assert.equal(calls[1].url, 'https://api.pocketfi.ng/api/v1/payout/verify-bank')
})
test('another bank or account in resolution response is rejected', async () => {
  for (const mismatch of [{ bank_code: '058' }, { account_number: '9876543210' }]) {
    const { client } = transport([{ banks: [{ code: '044', name: 'Access Bank' }] }, { status: 'success', bank_code: '044', account_name: 'AMINA TEST', ...mismatch }])
    await assert.rejects(client.resolveBank(beneficiary), { code: 'terms_mismatch' })
  }
})
const submitted = { status: true, transaction: { reference: paymentId, amount: '1000', fee: '30', account: '0123456789', businessId: 1234, status: 'Completed' } }
test('payout POST is single-shot and Completed submission remains pending confirmation', async () => {
  const { client, calls } = transport([submitted])
  const result = await client.submitTransfer(payout)
  assert.equal(result.state, 'pending')
  assert.equal(result.feeKobo, 3000)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api.pocketfi.ng/api/v1/payout/send')
  assert.deepEqual(calls[0].data, { account_name: 'AMINA TEST', account_number: '0123456789', bank_code: '044', amount: '1000' })
  assert.equal('Idempotency-Key' in calls[0].headers, false)
})
test('payout fractional naira is rejected, never rounded from ledger debit', async () => {
  const { client, calls } = transport([])
  await assert.rejects(client.submitTransfer({ ...payout, amountKobo: 100001 }), { code: 'invalid_input' })
  assert.equal(calls.length, 0)
})
test('unknown payout outcomes are never retried by transport', async () => {
  for (const response of [new Error('timeout after accepted fixture-only'), new Response('bad gateway', { status: 502 }), new Response('not-json')]) {
    const { client, calls } = transport([response])
    await assert.rejects(client.submitTransfer(payout), error => error.code === 'transport_uncertain' && !error.message.includes('fixture-only'))
    assert.equal(calls.length, 1)
  }
})
test('mismatched payout keeps provider ID for reconciliation instead of discarding it', async () => {
  const { client } = transport([{ ...submitted, transaction: { ...submitted.transaction, amount: '999' } }])
  await assert.rejects(client.submitTransfer(payout), error => error.code === 'transport_uncertain' && error.providerId === paymentId)
})
test('payout confirmation validates account and amount before marking succeeded', async () => {
  const { client, calls } = transport([{ status: 'completed', payment_id: paymentId, amount: '1000.00', account: '0123456789' }])
  assert.equal((await client.confirmTransfer({ providerId: paymentId, expectedAmountKobo: 100000, expectedAccountNumber: '0123456789' })).state, 'succeeded')
  assert.equal(calls[0].url, 'https://api.pocketfi.ng/api/v1/transaction/confirm')
})
test('failed/reversed payout confirmation stays unknown, preventing automatic refund or resend', async () => {
  for (const status of ['failed', 'reversed', 'success', true]) {
    const { client } = transport([{ status, payment_id: paymentId, amount: '1000', account: '0123456789' }])
    assert.equal((await client.confirmTransfer({ providerId: paymentId, expectedAmountKobo: 100000, expectedAccountNumber: '0123456789' })).state, 'unknown')
  }
})
test('webhook signature uses exact bytes, rejects modifications, missing secret and conflicting aliases', async () => {
  const raw = new TextEncoder().encode('{"payment_id":"PFI|fixture12345"}')
  const secret = 'fixture-webhook-only'
  const signature = createHmac('sha512', secret).update(raw).digest('hex')
  const headers = new Headers({ HTTP_POCKETFI_SIGNATURE: signature })
  assert.equal(await verifyPocketFiWebhook(raw, headers, secret), true)
  assert.equal(await verifyPocketFiWebhook(new TextEncoder().encode('{}'), headers, secret), false)
  assert.equal(await verifyPocketFiWebhook(raw, headers, ''), false)
  assert.equal(await verifyPocketFiWebhook(raw, new Headers(), secret), false)
  headers.set('pocketfi_signature', '0'.repeat(128))
  assert.equal(await verifyPocketFiWebhook(raw, headers, secret), false)
})
test('webhook rejects generic signature header and oversized body', async () => {
  const raw = new TextEncoder().encode('{}'), secret = 'fixture-only'
  const signature = createHmac('sha512', secret).update(raw).digest('hex')
  assert.equal(await verifyPocketFiWebhook(raw, new Headers({ signature }), secret), false)
  assert.equal(await verifyPocketFiWebhook(new Uint8Array(256001), new Headers({ pocketfi_signature: signature }), secret), false)
})
test('authorization failures return sanitized setup error', async () => {
  const { client } = transport([new Response('secret leaked upstream fixture-only', { status: 403 })])
  await assert.rejects(client.listBanks(), error => error instanceof ProviderError && error.code === 'unauthorized' && !error.message.includes('fixture-only'))
})

const webhookSecret = 'fixture-hook-not-a-key'
function signedRequest(payload, overrides = {}) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload)
  const signature = createHmac('sha512', webhookSecret).update(body).digest('hex')
  return new Request('https://project.example.test/functions/v1/pocketfi-webhook', { method: 'POST', body, headers: { 'Content-Type': 'application/json', pocketfi_signature: signature, ...overrides } })
}
function webhookFixture(overrides = {}) {
  const row = { id: 'internal-payment-1', provider_id: paymentId, owner_id: 'actual-owner', direction: 'collection', amount_kobo: 150025, currency: 'NGN', status: 'pending' }
  const found = [], reconciled = [], flags = new Map()
  const handler = createPocketFiWebhookHandler({
    secret: () => webhookSecret, businessId: () => '1234',
    async findPayment(id) { found.push(id); return id === paymentId ? { ...row } : null },
    async reconcile(payment) { reconciled.push(payment); row.status = 'succeeded' },
    async flagDiscrepancy(payment, hash, reason, expectedState) { flags.set(hash, { payment, reason, expectedState }) },
    ...overrides,
  })
  return { handler, row, found, reconciled, flags }
}
const notification = { transaction: { reference: paymentId }, order: { amount: '1500.25', settlement_amount: '1480.25' }, customer: { businessId: '1234' } }
test('signed webhook routes only by persisted provider ID and ignores claimed user/email', async () => {
  const { handler, reconciled } = webhookFixture()
  const response = await handler(signedRequest({ ...notification, owner_id: 'attacker', customer: { businessId: '1234', email: 'attacker@example.test' }, status: 'completed' }))
  assert.equal(response.status, 200)
  assert.equal(reconciled.length, 1)
  assert.equal(reconciled[0].owner_id, 'actual-owner')
  assert.equal(reconciled[0].amount_kobo, 150025)
})
test('webhook replay after settlement is acknowledged without a second reconciliation', async () => {
  const { handler, reconciled } = webhookFixture()
  assert.equal((await handler(signedRequest(notification))).status, 200)
  assert.equal((await (await handler(signedRequest(notification))).json()).status, 'already_processed')
  assert.equal(reconciled.length, 1)
})
test('forged signature never looks up or modifies payment records', async () => {
  const { handler, found, reconciled } = webhookFixture()
  assert.equal((await handler(signedRequest(notification, { pocketfi_signature: '0'.repeat(128) }))).status, 401)
  assert.equal(found.length, 0)
  assert.equal(reconciled.length, 0)
})
test('wrong merchant is rejected even when its notification is validly signed', async () => {
  const { handler, found } = webhookFixture()
  assert.equal((await handler(signedRequest({ ...notification, customer: { businessId: 'other' } }))).status, 403)
  assert.equal(found.length, 0)
})
test('wrong webhook amount creates a deduplicated discrepancy without crediting', async () => {
  const { handler, reconciled, flags, row } = webhookFixture()
  const wrong = { ...notification, order: { amount: '1500.26' } }
  assert.equal((await handler(signedRequest(wrong))).status, 409)
  assert.equal((await handler(signedRequest(wrong))).status, 409)
  assert.equal(reconciled.length, 0)
  assert.equal(flags.size, 1)
  assert.equal(row.status, 'pending')
})
test('unknown webhook ID retries instead of routing by customer or internal ID', async () => {
  const { handler, reconciled } = webhookFixture()
  const response = await handler(signedRequest({ ...notification, transaction: { reference: 'PFI|unknown12345' }, id: 'internal-payment-1', owner_id: 'actual-owner' }))
  assert.equal(response.status, 503)
  assert.equal(response.headers.get('Retry-After'), '60')
  assert.equal(reconciled.length, 0)
})
test('webhook completed text alone cannot settle; confirmation outage returns retry', async () => {
  const { handler } = webhookFixture({ async reconcile() { throw new Error('fixture-only provider secret') } })
  const response = await handler(signedRequest({ ...notification, status: 'completed' }))
  assert.equal(response.status, 503)
  assert.equal((await response.text()).includes('fixture-only'), false)
})
test('signed reversal after completed payment flags review without changing balance/status', async () => {
  const { handler, row, flags, reconciled } = webhookFixture()
  row.status = 'succeeded'
  const reversed = { ...notification, event: 'payment.reversed' }
  assert.equal((await handler(signedRequest(reversed))).status, 202)
  assert.equal((await handler(signedRequest(reversed))).status, 202)
  assert.equal(flags.size, 1)
  assert.equal(reconciled.length, 0)
  assert.equal(row.status, 'succeeded')
})
test('conflicting signed reference aliases and malformed JSON are rejected', async () => {
  const { handler, found } = webhookFixture()
  assert.equal((await handler(signedRequest({ ...notification, payment_id: 'PFI|different1234' }))).status, 400)
  assert.equal((await handler(signedRequest('{broken'))).status, 400)
  assert.equal(found.length, 0)
})
test('signed reversal is recorded while pending, before any later confirmation can credit', async () => {
  for(const status of ['pending','unknown','created','failed']) {
    const {handler,row,flags,reconciled}=webhookFixture();row.status=status;
    assert.equal((await handler(signedRequest({...notification,event:'payment.reversed'}))).status,202);
    assert.equal(flags.size,1);assert.equal(reconciled.length,0);assert.equal(row.status,status);
  }
})
test('ordinary pending failure is durably observed and still reconciled without being declared paid', async () => {
  const {handler,row,flags,reconciled}=webhookFixture();
  assert.equal((await handler(signedRequest({...notification,status:'failed'}))).status,200);
  assert.equal([...flags.values()][0].expectedState,'failed');assert.equal(reconciled.length,1);
  // The fixture confirmation succeeds; SQL tests prove the earlier observation
  // creates a protective hold in the same transaction as that later success.
  assert.equal(row.status,'succeeded');
})
test('success notification contradicting saved failure is recorded rather than silently acknowledged', async () => {
  const {handler,row,flags,reconciled}=webhookFixture();row.status='failed';
  assert.equal((await handler(signedRequest({...notification,status:'completed'}))).status,202);
  assert.equal(flags.size,1);assert.equal(reconciled.length,0);
})
test('unrecognized text containing failure or refund is not treated as a recognized adverse event', async () => {
  const {handler,flags}=webhookFixture();
  await handler(signedRequest({...notification,event:'refund_policy_updated',type:'not_failed'}));assert.equal(flags.size,0);
})
test('signed outer event aliases survive supported data-wrapper normalization', async () => {
  for(const event of ['payment.reversed','payment.failed']) {
    const {handler,row,flags,reconciled}=webhookFixture();row.status='succeeded';
    assert.equal((await handler(signedRequest({event,data:notification}))).status,202);
    assert.equal(flags.size,1);assert.equal(reconciled.length,0);
    assert.equal([...flags.values()][0].expectedState,event==='payment.failed'?'failed':undefined);
  }
})
test('webhook bounds payload before lookup and rejects unsupported methods', async () => {
  const { handler, found } = webhookFixture()
  assert.equal((await handler(signedRequest({ large: 'x'.repeat(256001) }))).status, 413)
  assert.equal((await handler(new Request('https://example.test', { method: 'PUT', body: '{}' }))).status, 405)
  assert.equal(found.length, 0)
})
