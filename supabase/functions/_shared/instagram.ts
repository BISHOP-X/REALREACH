// Public contract sources are recorded in docs/RealReach-Passes-1-2-QA.md.
// No mock responses are used by deployed handlers.
export type Observation = { result: 'positive' | 'negative' | 'unknown'; reason: string | null };
export class ProviderError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export const object = (value: unknown): Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
export function followObservation(value: unknown, account: string, sender: string): Observation {
  const data = object(value);
  if (data.accountId !== account || data.userId !== sender) return { result: 'unknown', reason: 'identity_mismatch' };
  if (data.isFollower === true) return { result: 'positive', reason: null };
  if (data.isFollower === false) return { result: 'negative', reason: null };
  return { result: 'unknown', reason: ['consent_required','dm_access_disabled','not_messageable','error'].includes(data.unavailableReason) ? data.unavailableReason : 'incomplete_response' };
}
export function commentObservation(value: unknown, account: string, post: string, comment: string, sender: string, now = Date.now()): Observation {
  const data = object(value), meta = object(data.meta), item = object(data.comment);
  const updated = Date.parse(meta.lastUpdated);
  if (meta.accountId !== account || meta.postId !== post || !Number.isFinite(updated) || updated > now + 60_000 || now - updated > 60_000) return { result: 'unknown', reason: 'stale_or_unscoped_comment' };
  if (item.id !== comment || object(item.from).id !== sender) return { result: 'unknown', reason: 'comment_identity_unproven' };
  if (item.isHidden === true) return { result: 'unknown', reason: 'comment_hidden' };
  return { result: 'positive', reason: null };
}
export function authorizationUrl(value: unknown): string {
  if (typeof value !== 'string') throw new ProviderError(502,'Provider did not return an authorization URL.');
  const url = new URL(value);
  const allowed = ['instagram.com','facebook.com','zernio.com'];
  if (url.protocol !== 'https:' || url.username || url.password || !allowed.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) throw new ProviderError(502,'Unexpected authorization destination.');
  return url.toString();
}
export class InstagramProvider {
  key: string;
  transport: typeof fetch;
  constructor(key: string, transport: typeof fetch = fetch) { this.key = key; this.transport = transport; }
  async request(path: string, method = 'GET', body?: unknown, idempotencyKey?: string) {
    if (!this.key) throw new ProviderError(503,'Instagram connection is awaiting provider setup.');
    const response = await this.transport(`https://zernio.com/api/v1${path}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new ProviderError(response.status, response.status === 429 ? 'Provider is busy; verification will retry.' : 'Instagram provider request could not be completed.');
    return object(await response.json());
  }
  async profile(businessId: string) {
    // Same body/key on every retry. Never include an editable business name.
    const data = await this.request('/profiles','POST',{ name: `RealReach ${businessId}` },`rr-profile-${businessId}`);
    if (typeof data.profile?._id !== 'string') throw new ProviderError(502,'Incomplete provider profile.');
    return data.profile._id as string;
  }
  async connect(profile: string, redirect: string) {
    const query = new URLSearchParams({ profileId: profile, redirect_url: redirect, loginMethod: 'instagram_login' });
    const data = await this.request(`/connect/instagram?${query}`);
    return authorizationUrl(data.authUrl);
  }
  async connectedAccount(profile: string, id: string) {
    const data = await this.request(`/accounts?${new URLSearchParams({ profileId: profile, platform: 'instagram', status: 'connected' })}`);
    const account = Array.isArray(data.accounts) ? data.accounts.find((item: any) => item._id === id && item.platform === 'instagram' && item.isActive === true && (item.profileId === profile || item.profileId?._id === profile)) : null;
    if (!account || typeof account.username !== 'string' || !/^[\w.]{1,30}$/.test(account.username.replace(/^@/,''))) throw new ProviderError(409,'The connected account could not be confirmed. Please reconnect.');
    return { id: String(account._id), username: account.username.replace(/^@/,'') as string };
  }
  async follow(account: string, sender: string): Promise<Observation> {
    try { return followObservation(await this.request(`/accounts/${encodeURIComponent(account)}/follow-status/${encodeURIComponent(sender)}?refresh=true`),account,sender); }
    catch (error) { return { result: 'unknown', reason: error instanceof ProviderError && error.status === 429 ? 'rate_limited' : 'provider_unavailable' }; }
  }
  async comment(account: string, post: string, comment: string, sender: string) {
    try { return commentObservation(await this.request(`/inbox/comments/${encodeURIComponent(post)}?${new URLSearchParams({ accountId: account, commentId: comment })}`),account,post,comment,sender); }
    catch { return { result: 'unknown', reason: 'provider_unavailable' } as Observation; }
  }
}
export async function digest(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b => b.toString(16).padStart(2,'0')).join('');
}
export function randomToken() { return crypto.randomUUID().replaceAll('-','') + crypto.randomUUID().replaceAll('-',''); }
export async function verifySignature(raw: string, signature: string | null, secret: string) {
  if (!secret || !signature || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{ name:'HMAC',hash:'SHA-256' },false,['verify']);
  const bytes = Uint8Array.from(signature.match(/../g)!, hex => parseInt(hex,16));
  return crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(raw));
}
export function webhookEvent(value: unknown) {
  const data = object(value), account = object(data.account), message = object(data.message), sender = object(message.sender);
  if (typeof data.id !== 'string' || data.id.length > 150 || typeof data.event !== 'string' || !Number.isFinite(Date.parse(data.timestamp))) throw new ProviderError(400,'Malformed webhook.');
  const challenge = typeof message.text === 'string' && /^RR-[A-F0-9]{20}$/.test(message.text.trim()) ? message.text.trim() : null;
  const platform = data.platform ?? account.platform;
  return { id: data.id, type: data.event, account: typeof account.accountId === 'string' ? account.accountId : null, challenge: !platform || platform === 'instagram' ? challenge : null, sender: typeof sender.id === 'string' && sender.id.length <= 100 ? sender.id : null, occurred: new Date(data.timestamp).toISOString() };
}
