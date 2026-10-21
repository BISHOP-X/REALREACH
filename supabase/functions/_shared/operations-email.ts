/** Server-only operator alerts. No customer addresses, balances, free-text cases
 * or raw provider responses belong in these messages. */
export type OperationsEmailConfiguration = {
  configured: boolean;
  reason: 'ready' | 'missing_key' | 'missing_sender' | 'invalid_sender' | 'missing_recipient' | 'invalid_recipient';
  apiKey: string; from: string; to: string;
};
export type OperationsEmail = {from: string; to: [string]; subject: string; text: string};
export type AlertErrorCode = 'not_configured' | 'invalid_request' | 'unauthorized' | 'rejected' | 'idempotency_conflict' | 'rate_limited' | 'concurrent_request' | 'transport_uncertain';
export class AlertSendError extends Error {
  readonly code: AlertErrorCode;
  readonly outcome: 'retry' | 'uncertain' | 'failed';
  constructor(code: AlertErrorCode, outcome: 'retry' | 'uncertain' | 'failed') {
    super(`Alert sending needs attention: ${code}`);
    this.name = 'AlertSendError';
    this.code = code; this.outcome = outcome;
  }
}
const mailbox = (value: unknown): value is string => typeof value === 'string' && value.length <= 254
  && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(value)
  && !value.split('@')[0].startsWith('.') && !value.split('@')[0].endsWith('.') && !value.split('@')[0].includes('..');
const sender = (value: unknown): value is string => mailbox(value) && /@(?:[A-Za-z0-9-]+\.)*realreach\.com\.ng$/i.test(value);
const keyValid = (value: string) => !!value && value.length <= 500 && !/[\s\u0000-\u001f\u007f]/.test(value);

/** Only configured/reason may be returned to a browser. Never serialize this
 * complete object: it contains a private API key and operator addresses. */
export function operationsEmailConfiguration(getEnv: (name: string) => string | undefined): OperationsEmailConfiguration {
  const apiKey = getEnv('RESEND_API_KEY')?.trim() ?? '';
  const from = getEnv('REALREACH_ALERT_FROM')?.trim() ?? '';
  const to = getEnv('REALREACH_ALERT_TO')?.trim() ?? '';
  const reason = !keyValid(apiKey) ? 'missing_key' : !from ? 'missing_sender' : !sender(from) ? 'invalid_sender'
    : !to ? 'missing_recipient' : !mailbox(to) ? 'invalid_recipient' : 'ready';
  return {configured: reason === 'ready', reason, apiKey, from, to};
}

const labels: Record<string, string> = {
  verification_overdue: 'Checks waiting too long', verification_review: 'Checks needing review',
  payment_uncertain: 'Payments with an unknown result', payment_stalled: 'Payments waiting too long',
  payment_missing_reference: 'Payments missing a provider reference', risk_hold: 'Payments with spending holds',
  support_waiting: 'Support cases waiting for a response', worker_stale: 'Task worker heartbeat is overdue',
  reconciliation_failed: 'Ledger check could not finish', reconciliation_stale: 'Ledger check is overdue',
  reconciliation_discrepancy: 'Ledger differences need investigation',
};
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function buildOperationsEmail(payload: unknown, config: OperationsEmailConfiguration): OperationsEmail {
  if (!config.configured) throw new AlertSendError('not_configured', 'failed');
  const snapshot = record(payload);
  const date = typeof snapshot.collected_at === 'string' ? new Date(snapshot.collected_at) : null;
  if (!date || !Number.isFinite(date.getTime()) || !Array.isArray(snapshot.incidents) || snapshot.incidents.length > 30) {
    throw new AlertSendError('invalid_request', 'failed');
  }
  const lines: string[] = [];
  for (const value of snapshot.incidents) {
    const item = record(value);
    if (typeof item.code !== 'string' || !/^[a-z_]{1,60}$/.test(item.code) || !Number.isSafeInteger(item.count) || Number(item.count) < 1 || Number(item.count) > 1_000_000_000) {
      throw new AlertSendError('invalid_request', 'failed');
    }
    // Unknown future categories are deliberately generic, never copied as text.
    lines.push(`- ${labels[item.code] ?? 'Another operational issue'}: ${item.count}`);
  }
  if (!lines.length) throw new AlertSendError('invalid_request', 'failed');
  return {from: config.from, to: [config.to], subject: 'RealReach needs attention', text: [
    'RealReach operations alert', '', `Snapshot: ${date.toISOString()}`, '', ...lines, '',
    'Open the admin dashboard to review the latest records:', 'https://www.realreach.com.ng/admin', '',
    'These are recorded exceptions, not instructions to resend a payment or change a balance.',
    'This message contains a saved snapshot. Newer results may be available in the dashboard.',
  ].join('\n')};
}

export function validateOperationsEmail(value: unknown): asserts value is OperationsEmail {
  const body = record(value);
  if (Object.keys(body).sort().join(',') !== 'from,subject,text,to' || !sender(body.from) || !Array.isArray(body.to)
    || body.to.length !== 1 || !mailbox(body.to[0]) || body.subject !== 'RealReach needs attention'
    || typeof body.text !== 'string' || body.text.length < 50 || body.text.length > 8000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body.text)) {
    throw new AlertSendError('invalid_request', 'failed');
  }
}

async function boundedJson(response: Response): Promise<Record<string, unknown>> {
  const reader = response.body?.getReader();
  if (!reader) throw new AlertSendError('transport_uncertain', 'uncertain');
  if (Number(response.headers.get('content-length')) > 16_384) {
    await reader.cancel();
    throw new AlertSendError('transport_uncertain', 'uncertain');
  }
  let bytes = 0; const parts: Uint8Array[] = [];
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    bytes += next.value.length;
    if (bytes > 16_384) {await reader.cancel(); throw new AlertSendError('transport_uncertain', 'uncertain');}
    parts.push(next.value);
  }
  const buffer = new Uint8Array(bytes); let offset = 0;
  for (const part of parts) {buffer.set(part, offset); offset += part.length;}
  try {return record(JSON.parse(new TextDecoder().decode(buffer)));}
  catch {throw new AlertSendError('transport_uncertain', 'uncertain');}
}

/** The caller persists this complete request BEFORE calling and reuses it with
 * the same idempotency key. Resend retains keys for 24h; DB retries stop at23h.
 * A returned ID proves provider acceptance only, not inbox delivery. */
export function createOperationsMailer(options: {apiKey: string; fetch?: typeof fetch; timeoutMs?: number}) {
  return {async send(body: OperationsEmail, idempotencyKey: string): Promise<{id: string}> {
    if (!keyValid(options.apiKey)) throw new AlertSendError('not_configured', 'failed');
    validateOperationsEmail(body);
    if (!/^rr-ops\/[a-f0-9-]{36}$/.test(idempotencyKey)) throw new AlertSendError('invalid_request', 'failed');
    const controller = new AbortController();
    const timeout = Number.isFinite(options.timeoutMs) ? Math.max(1, Math.min(15_000, options.timeoutMs!)) : 8000;
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await (options.fetch ?? fetch)('https://api.resend.com/emails', {method: 'POST', redirect: 'error', signal: controller.signal,
        headers: {'Authorization': `Bearer ${options.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey}, body: JSON.stringify(body)});
      if (response.status === 401 || response.status === 403) throw new AlertSendError('unauthorized', 'failed');
      if (response.status === 429) throw new AlertSendError('rate_limited', 'retry');
      if (response.status === 409) {
        const detail = await boundedJson(response);
        throw new AlertSendError(detail.name === 'concurrent_idempotent_requests' ? 'concurrent_request' : 'idempotency_conflict', detail.name === 'concurrent_idempotent_requests' ? 'retry' : 'failed');
      }
      if (response.status >= 400 && response.status < 500 && response.status !== 408) throw new AlertSendError('rejected', 'failed');
      if (!response.ok) throw new AlertSendError('transport_uncertain', 'uncertain');
      const result = await boundedJson(response);
      if (typeof result.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(result.id)) throw new AlertSendError('transport_uncertain', 'uncertain');
      return {id: result.id};
    } catch (error) {
      if (error instanceof AlertSendError) throw error;
      throw new AlertSendError('transport_uncertain', 'uncertain');
    } finally {clearTimeout(timer);}
  }};
}
