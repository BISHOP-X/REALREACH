/** Server-only provider primitives. Never import into the browser bundle. */
export type ProviderName = 'rocket' | 'pocketfi'
export type ProviderErrorCode = 'not_configured' | 'invalid_input' | 'unauthorized' | 'rate_limited' | 'unavailable' | 'not_found' | 'invalid_response' | 'terms_mismatch' | 'transport_uncertain'

export class ProviderError extends Error {
  readonly provider: ProviderName
  readonly code: ProviderErrorCode
  readonly retryable: boolean
  readonly providerId?: string
  constructor(provider: ProviderName, code: ProviderErrorCode, message: string, options: { retryable?: boolean; providerId?: string } = {}) {
    super(message)
    this.name = 'ProviderError'
    this.provider = provider
    this.code = code
    this.retryable = options.retryable ?? ['rate_limited', 'unavailable', 'transport_uncertain'].includes(code)
    this.providerId = options.providerId
  }
}

export type ProviderOptions = { apiKey: string; fetch?: typeof fetch; timeoutMs?: number }
export type JsonObject = Record<string, unknown>
export function object(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
}

// Instagram IDs exceed Number.MAX_SAFE_INTEGER. Preserve integer tokens before
// JSON.parse, while leaving quoted strings and decimal values completely intact.
export function parseProviderJson(text: string): unknown {
  return JSON.parse(text.replace(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, token => {
    if (/^-?\d+$/.test(token) && !Number.isSafeInteger(Number(token))) return JSON.stringify(token)
    return token
  }))
}

export function stableId(value: unknown, provider: ProviderName): string {
  if (typeof value === 'string' && /^\d{1,30}$/.test(value)) return value
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value)
  throw new ProviderError(provider, 'invalid_response', 'The provider did not return a valid account or content ID.')
}

export function requiredText(value: unknown, provider: ProviderName, name: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) {
    throw new ProviderError(provider, 'invalid_input', `Enter a valid ${name}.`)
  }
  return value.trim()
}

export async function providerRequest(provider: ProviderName, options: ProviderOptions, url: string, init: RequestInit, mutation = false): Promise<JsonObject> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000)
  try {
    const response = await (options.fetch ?? fetch)(url, { ...init, redirect: 'error', signal: controller.signal })
    if (response.status === 401 || response.status === 403) throw new ProviderError(provider, 'unauthorized', 'The service credentials need attention.', { retryable: false })
    if (response.status === 429) throw new ProviderError(provider, 'rate_limited', 'This check is delayed. Please try again shortly.')
    if (!response.ok) throw new ProviderError(provider, mutation ? 'transport_uncertain' : response.status === 404 ? 'not_found' : 'unavailable', mutation ? 'The request outcome needs checking before another attempt.' : 'The service is temporarily unavailable.')
    if (Number(response.headers.get('content-length')) > 2_000_000) throw new ProviderError(provider, mutation ? 'transport_uncertain' : 'invalid_response', 'The provider response could not be checked safely.')
    const reader = response.body?.getReader()
    if (!reader) throw new ProviderError(provider, 'invalid_response', 'The provider returned an empty response.')
    const chunks: Uint8Array[] = []
    let length = 0
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      length += chunk.value.length
      if (length > 2_000_000) { await reader.cancel(); throw new ProviderError(provider, mutation ? 'transport_uncertain' : 'invalid_response', 'The provider response could not be checked safely.') }
      chunks.push(chunk.value)
    }
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    let parsed: unknown
    try { parsed = parseProviderJson(new TextDecoder().decode(bytes)) }
    catch { throw new ProviderError(provider, mutation ? 'transport_uncertain' : 'invalid_response', 'The provider returned an unreadable response.') }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new ProviderError(provider, mutation ? 'transport_uncertain' : 'invalid_response', 'The provider returned an unexpected response.')
    return parsed as JsonObject
  } catch (error) {
    if (error instanceof ProviderError) throw error
    throw new ProviderError(provider, mutation ? 'transport_uncertain' : 'unavailable', mutation ? 'The request outcome needs checking before another attempt.' : 'The service could not be reached. Please try again shortly.')
  } finally { clearTimeout(timer) }
}
