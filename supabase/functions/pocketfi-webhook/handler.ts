import { nairaToKobo, pocketFiPaymentId, verifyPocketFiWebhook } from '../_shared/pocketfi.ts'
import { object, parseProviderJson } from '../_shared/provider-contract.ts'

export type WebhookPayment = {
  id: string; provider_id: string | null; owner_id: string; direction: string;
  amount_kobo: number | string; currency: string; status: string;
  [key: string]: unknown;
}
export type PocketFiWebhookDependencies = {
  secret(): string;
  businessId(): string;
  findPayment(providerId: string): Promise<WebhookPayment | null>;
  reconcile(payment: WebhookPayment): Promise<unknown>;
  flagDiscrepancy(payment: WebhookPayment, eventHash: string, reason: string, expectedState?: 'failed'): Promise<void>;
}

function reply(status: string, http = 200): Response {
  return Response.json({ status }, { status: http, headers: { 'Cache-Control': 'no-store', ...(http === 503 ? { 'Retry-After': '60' } : {}) } })
}
async function bodyBytes(req: Request): Promise<Uint8Array | null> {
  if (Number(req.headers.get('content-length')) > 256_000 || !req.body) return null
  const reader = req.body.getReader(), chunks: Uint8Array[] = []
  let length = 0, timedOut = false
  const timeout = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}) }, 10_000)
  try {
    for (;;) {
      const next = await reader.read()
      if (timedOut) return null
      if (next.done) break
      length += next.value.length
      if (length > 256_000) { await reader.cancel(); return null }
      chunks.push(next.value)
    }
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    return bytes
  } finally { clearTimeout(timeout); reader.releaseLock() }
}
async function eventHash(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
}

/** The signed notification wakes server reconciliation. It never decides who
 * receives money or whether a payment succeeded. Those facts come from the
 * persisted intent and a fresh authenticated PocketFi confirmation. */
export function createPocketFiWebhookHandler(deps: PocketFiWebhookDependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'GET') return reply('ok')
    if (req.method !== 'POST') return reply('method_not_allowed', 405)
    try {
      const secret = deps.secret(), businessId = deps.businessId()
      if (!secret || !businessId) return reply('configuration_unavailable', 503)
      const bytes = await bodyBytes(req)
      if (!bytes) return reply('payload_rejected', 413)
      if (!await verifyPocketFiWebhook(bytes, req.headers, secret)) return reply('invalid_signature', 401)
      let payload: Record<string, unknown>
      try { payload = object(parseProviderJson(new TextDecoder().decode(bytes))) }
      catch { return reply('invalid_json', 400) }
      const data = object(payload.data ?? payload), transaction = object(data.transaction), order = object(data.order), customer = object(data.customer)
      const merchantIds = [data.businessId, data.business_id, transaction.businessId, customer.businessId].filter(value => value !== undefined && value !== null)
      if (merchantIds.some(value => String(value) !== businessId)) return reply('wrong_business', 403)
      const references = [data.payment_id, transaction.reference, data.reference].filter(value => value !== undefined && value !== null)
      if (!references.length || new Set(references).size !== 1) return reply('invalid_reference', 400)
      let providerId: string
      try { providerId = pocketFiPaymentId(references[0]) }
      catch { return reply('invalid_reference', 400) }
      const payment = await deps.findPayment(providerId)
      // The provider notification can beat persistence of its checkout ID.
      // Retry instead of losing the notification; scheduled polling also heals.
      if (!payment) return reply('payment_not_available', 503)
      if (payment.provider_id !== providerId || !payment.owner_id || payment.currency !== 'NGN') return reply('payment_mismatch', 409)
      const amounts = [data.amount, order.amount, transaction.amount].filter(value => value !== undefined && value !== null)
      let mismatch = data.currency != null && data.currency !== 'NGN'
      try { mismatch ||= amounts.some(value => nairaToKobo(value) !== Number(payment.amount_kobo)) }
      catch { mismatch = true }
      if (mismatch) {
        await deps.flagDiscrepancy(payment, await eventHash(bytes), 'Signed payment amount or currency differs from the saved request')
        return reply('payment_terms_mismatch', 409)
      }
      const events = [payload.status, payload.event, payload.type, data.status, data.event, data.type, transaction.status].filter((value): value is string => typeof value === 'string').map(value => value.trim().toLowerCase())
      const adverse = events.some(value => /^(?:payment[.:])?(?:reversed|reversal|refund|refunded|chargeback)$/.test(value))
      const failed = events.some(value => /^(?:payment[.:])?failed$/.test(value))
      const succeeded = events.some(value => /^(?:payment[.:])?(?:completed|success|successful|succeeded)$/.test(value))
      if (adverse || payment.status === 'failed' && succeeded) {
        await deps.flagDiscrepancy(payment, await eventHash(bytes), 'Signed PocketFi event conflicts with payment completion or reports a reversal')
        return reply('review_recorded', 202)
      }
      // Record even if this snapshot predates a concurrent successful commit.
      // SQL treats an ordinary unpaid failure as an observation, not a freeze.
      if (failed) {
        await deps.flagDiscrepancy(payment, await eventHash(bytes), 'Signed PocketFi notification reports payment failure', 'failed')
        if (payment.status === 'succeeded') return reply('review_recorded', 202)
      }
      if (['succeeded', 'failed'].includes(payment.status)) return reply('already_processed')
      await deps.reconcile(payment)
      return reply('received')
    } catch {
      // No raw payloads, account details, provider errors or secrets in logs.
      return reply('reconciliation_pending', 503)
    }
  }
}
