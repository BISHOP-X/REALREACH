import { createPocketFiWebhookHandler } from './handler.ts'
import { service, must } from '../_shared/runtime.ts'
import { refreshPayment } from '../_shared/marketplace-payments.ts'

Deno.serve(createPocketFiWebhookHandler({
  secret: () => Deno.env.get('POCKETFI_WEBHOOK_SECRET') || Deno.env.get('POCKETFI_SECRET_KEY') || '',
  businessId: () => Deno.env.get('POCKETFI_BUSINESS_ID') || '',
  async findPayment(providerId) {
    return must(await service().from('rr_payments').select('*').eq('provider_id', providerId).maybeSingle())
  },
  async reconcile(payment) { return await refreshPayment(service(), payment) },
  async flagDiscrepancy(payment, eventHash, reason, expectedState) {
    must(await service().rpc('rr_market_payment_discrepancy', { p_id: payment.id, p_event_hash: eventHash, p_reason: reason, p_expected_state: expectedState ?? null }))
  },
}))
