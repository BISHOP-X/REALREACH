import { object, ProviderError, providerRequest, requiredText, type JsonObject, type ProviderOptions } from './provider-contract.ts'

export type PocketFiOptions = ProviderOptions & { businessId: string; mode?: 'live' | 'test' }
export type PocketFiBank = { code: string; name: string }
export type PocketFiBeneficiary = { accountNumber: string; bankCode: string; accountName: string }
export type CheckoutObservation = { state: 'succeeded' | 'pending' | 'failed' | 'unknown'; paymentId: string; amountKobo: number; account: string }
export type TransferSubmission = { state: 'pending' | 'unknown'; reference: string; providerId: string; amountKobo: number; feeKobo: number; providerStatus: string }
export type TransferObservation = { state: 'succeeded' | 'pending' | 'unknown'; providerId: string; amountKobo: number; accountNumber: string; providerStatus: string }

export function koboToNaira(value: number): string {
  if (!Number.isSafeInteger(value) || value <= 0) throw new ProviderError('pocketfi', 'invalid_input', 'Enter a valid payment amount.')
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`
}
export function nairaToKobo(value: unknown, allowZero = false): number {
  const text = typeof value === 'number' && Number.isFinite(value) ? String(value) : value
  if (typeof text !== 'string' || !/^\d{1,12}(?:\.\d{1,2})?$/.test(text)) throw new ProviderError('pocketfi', 'invalid_response', 'The payment amount could not be checked.')
  const [whole, fraction = ''] = text.split('.')
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(result) || result < (allowZero ? 0 : 1)) throw new ProviderError('pocketfi', 'invalid_response', 'The payment amount could not be checked.')
  return result
}
export function pocketFiPaymentId(value: unknown): string {
  if (typeof value !== 'string' || !/^(?:PFI\|[A-Za-z0-9_-]{4,100}|WD[A-Za-z0-9_-]{8,100})$/.test(value)) throw new ProviderError('pocketfi', 'invalid_response', 'The payment reference could not be checked.')
  return value
}
function bankCode(value: string): string {
  if (!/^\d{1,20}$/.test(value)) throw new ProviderError('pocketfi', 'invalid_input', 'Choose a bank from the current bank list.')
  return value
}
function accountNumber(value: string): string {
  if (!/^\d{10}$/.test(value)) throw new ProviderError('pocketfi', 'invalid_input', 'Enter a 10-digit bank account number.')
  return value
}
function providerStatus(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : 'unknown'
}
function validSuccess(value: unknown): boolean { return value === true || value === 'success' }
function checkConfirmation(row: JsonObject, id: string, expectedAmountKobo: number): number {
  if (pocketFiPaymentId(row.payment_id) !== id || row.currency != null && row.currency !== 'NGN') throw new ProviderError('pocketfi', 'terms_mismatch', 'The payment details do not match this request.', { providerId: id })
  const amount = nairaToKobo(row.amount)
  if (amount !== expectedAmountKobo) throw new ProviderError('pocketfi', 'terms_mismatch', 'The payment amount does not match this request.', { providerId: id })
  return amount
}

export function createPocketFiClient(options: PocketFiOptions) {
  if (!options.apiKey?.trim() || !options.businessId?.trim()) throw new ProviderError('pocketfi', 'not_configured', 'Payments are not available yet.', { retryable: false })
  const businessId = requiredText(options.businessId, 'pocketfi', 'business ID', 100)
  const base = options.mode === 'test' ? 'https://api.pocketfi.ng/api/test' : 'https://api.pocketfi.ng/api/v1'
  async function request(path: string, payload?: JsonObject, mutation = false): Promise<JsonObject> {
    return await providerRequest('pocketfi', options, base + path, {
      method: payload ? 'POST' : 'GET', headers: { Authorization: `Bearer ${options.apiKey}`, Accept: 'application/json', 'Content-Type': 'application/json' }, ...(payload ? { body: JSON.stringify(payload) } : {}),
    }, mutation)
  }
  async function createCheckout(input: { amountKobo: number; email: string; firstName: string; lastName: string; phone: string; redirectUrl: string }): Promise<{ paymentId: string; checkoutUrl: string }> {
    const amount = koboToNaira(input.amountKobo)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || input.email.length > 254) throw new ProviderError('pocketfi', 'invalid_input', 'Add a valid email address for payment receipts.')
    if (!/^(?:0\d{10}|\+?234\d{10})$/.test(input.phone)) throw new ProviderError('pocketfi', 'invalid_input', 'Add a Nigerian phone number for your payment.')
    let redirect: URL
    try { redirect = new URL(input.redirectUrl) } catch { throw new ProviderError('pocketfi', 'invalid_input', 'Invalid payment return address.') }
    const allowed = ['https://realreach.com.ng', 'https://www.realreach.com.ng', 'https://realreach-ng.vercel.app']
    if (options.mode === 'test') allowed.push('http://localhost:5173', 'http://127.0.0.1:5173')
    if (!allowed.includes(redirect.origin) || redirect.username || redirect.password) throw new ProviderError('pocketfi', 'invalid_input', 'Invalid payment return address.')
    const row = await request('/checkout/request', {
      first_name: requiredText(input.firstName, 'pocketfi', 'first name', 60), last_name: requiredText(input.lastName, 'pocketfi', 'last name', 60),
      email: input.email.trim().toLowerCase(), phone: input.phone.replace(/^\+?234/, '0'), business_id: businessId, redirect_link: redirect.href, amount,
    }, true)
    const paymentId = pocketFiPaymentId(row.payment_id)
    let link: URL
    try { link = new URL(String(row.payment_link)) } catch { throw new ProviderError('pocketfi', 'transport_uncertain', 'Your checkout could not be opened.', { providerId: paymentId }) }
    if (!validSuccess(row.status) || link.protocol !== 'https:' || !['pocketfi.ng', 'www.pocketfi.ng'].includes(link.hostname) || link.username || link.password || link.port || !link.pathname.startsWith('/checkout/') || decodeURIComponent(link.pathname.slice('/checkout/'.length)) !== paymentId) throw new ProviderError('pocketfi', 'transport_uncertain', 'Your checkout details need checking.', { providerId: paymentId })
    return { paymentId, checkoutUrl: link.href }
  }
  async function confirmCheckout(input: { paymentId: string; expectedAmountKobo: number }): Promise<CheckoutObservation> {
    const id = pocketFiPaymentId(input.paymentId)
    const row = await request('/checkout/confirm', { payment_id: id })
    const amountKobo = checkConfirmation(row, id, input.expectedAmountKobo)
    if (row.businessId != null && String(row.businessId) !== businessId || row.business_id != null && String(row.business_id) !== businessId) throw new ProviderError('pocketfi', 'terms_mismatch', 'The payment belongs to another business.', { providerId: id })
    const status = providerStatus(row.status)
    const state = status === 'completed' || status === 'success' || status === 'successful' ? 'succeeded' : status === 'pending' || status === 'processing' ? 'pending' : status === 'failed' || status === 'cancelled' || status === 'expired' ? 'failed' : 'unknown'
    return { state, paymentId: id, amountKobo, account: typeof row.account === 'string' ? row.account : '' }
  }
  async function listBanks(): Promise<PocketFiBank[]> {
    const row = await request('/payout/bank-list')
    if (!Array.isArray(row.banks) || row.status === false || row.status === 'error') throw new ProviderError('pocketfi', 'invalid_response', 'The bank list is unavailable right now.')
    const banks = new Map<string, string>()
    for (const entry of row.banks) {
      const bank = object(entry)
      if (typeof bank.code !== 'string' || typeof bank.name !== 'string') throw new ProviderError('pocketfi', 'invalid_response', 'The bank list could not be checked.')
      const code = bankCode(bank.code), name = requiredText(bank.name, 'pocketfi', 'bank name', 180)
      if (banks.has(code) && banks.get(code) !== name) throw new ProviderError('pocketfi', 'invalid_response', 'The bank list contains an ambiguous bank code.')
      banks.set(code, name)
    }
    if (!banks.size) throw new ProviderError('pocketfi', 'unavailable', 'The bank list is unavailable right now.')
    return [...banks].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name))
  }
  async function resolveBank(input: { accountNumber: string; bankCode: string }): Promise<PocketFiBeneficiary> {
    const number = accountNumber(input.accountNumber), code = bankCode(input.bankCode)
    const banks = await listBanks()
    if (!banks.some(bank => bank.code === code)) throw new ProviderError('pocketfi', 'invalid_input', 'Choose a bank from the current bank list.')
    const row = await request('/payout/verify-bank', { account_number: number, bank_code: code })
    if (!validSuccess(row.status) || row.bank_code !== code || row.account_number != null && row.account_number !== number) throw new ProviderError('pocketfi', 'terms_mismatch', 'The bank account details could not be confirmed.')
    return { accountNumber: number, bankCode: code, accountName: requiredText(row.account_name, 'pocketfi', 'account name', 180) }
  }
  /** Call once AFTER a durable dispatch claim. PocketFi documents no idempotency
   * token/client-reference lookup; this function NEVER retries a payout POST. */
  async function submitTransfer(input: PocketFiBeneficiary & { reference: string; amountKobo: number }): Promise<TransferSubmission> {
    const reference = requiredText(input.reference, 'pocketfi', 'withdrawal reference', 120)
    koboToNaira(input.amountKobo)
    if (input.amountKobo % 100) throw new ProviderError('pocketfi', 'invalid_input', 'Withdraw a whole-naira amount.')
    const number = accountNumber(input.accountNumber), code = bankCode(input.bankCode)
    const row = await request('/payout/send', { account_name: requiredText(input.accountName, 'pocketfi', 'account name', 180), account_number: number, bank_code: code, amount: String(input.amountKobo / 100) }, true)
    const transaction = object(row.transaction)
    let providerId: string
    try { providerId = pocketFiPaymentId(transaction.reference) }
    catch { throw new ProviderError('pocketfi', 'transport_uncertain', 'Your withdrawal is being checked. Do not submit it again.') }
    try {
      if (!validSuccess(row.status) || transaction.account !== number || nairaToKobo(transaction.amount) !== input.amountKobo || transaction.businessId != null && String(transaction.businessId) !== businessId || transaction.currency != null && transaction.currency !== 'NGN') throw new Error('terms')
      const feeKobo = nairaToKobo(transaction.fee, true)
      // Even a submission response saying Completed is reconciled independently.
      return { state: 'pending', reference, providerId, amountKobo: input.amountKobo, feeKobo, providerStatus: providerStatus(transaction.status) }
    } catch { throw new ProviderError('pocketfi', 'transport_uncertain', 'Your withdrawal details need checking. Do not submit it again.', { providerId }) }
  }
  async function confirmTransfer(input: { providerId: string; expectedAmountKobo: number; expectedAccountNumber: string }): Promise<TransferObservation> {
    const id = pocketFiPaymentId(input.providerId), number = accountNumber(input.expectedAccountNumber)
    // Used by the existing MONEY integration. Not currently listed in the public
    // PocketFi navigation; validate this endpoint with the merchant account.
    const row = await request('/transaction/confirm', { payment_id: id })
    const amountKobo = checkConfirmation(row, id, input.expectedAmountKobo)
    if (row.account !== number || row.businessId != null && String(row.businessId) !== businessId) throw new ProviderError('pocketfi', 'terms_mismatch', 'The withdrawal recipient does not match.', { providerId: id })
    const status = providerStatus(row.status)
    // An observed false failed response in the existing MONEY integration means
    // failed/reversed is REVIEW, never proof permitting a fresh payout or refund.
    return { state: status === 'completed' ? 'succeeded' : status === 'pending' || status === 'processing' ? 'pending' : 'unknown', providerId: id, amountKobo, accountNumber: number, providerStatus: status }
  }
  return { createCheckout, confirmCheckout, listBanks, resolveBank, submitTransfer, confirmTransfer }
}

/** HMAC-SHA512 over exact request bytes. PHP's HTTP_ prefix can refer to the
 * server variable rather than wire-header; accept only documented/reference
 * aliases, and reject conflicting aliases instead of arbitrarily choosing one. */
export async function verifyPocketFiWebhook(rawBody: Uint8Array, headers: Headers, secret: string): Promise<boolean> {
  if (!secret || rawBody.byteLength > 256_000) return false
  const signatures = ['http_pocketfi_signature', 'pocketfi_signature', 'pocketfi-signature', 'x-pocketfi-signature']
    .map(name => headers.get(name)?.trim().toLowerCase()).filter((value): value is string => Boolean(value))
  if (!signatures.length || new Set(signatures).size !== 1 || !/^[a-f0-9]{128}$/.test(signatures[0])) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['verify'])
  const signature = Uint8Array.from(signatures[0].match(/../g)!, part => parseInt(part, 16))
  return await crypto.subtle.verify('HMAC', key, signature, new Uint8Array(rawBody))
}
