import { object, ProviderError, providerRequest, requiredText, stableId, type JsonObject, type ProviderOptions } from './provider-contract.ts'

export type InstagramProfile = { id: string; username: string; biography: string; isPrivate: boolean }
export type InstagramMedia = { id: string; shortcode: string; ownerId: string; url: string; caption: string; commentsDisabled: boolean }
export type InstagramComment = { id: string; authorId: string; username: string; text: string; createdAt: string }
export type Observation = { state: 'verified' | 'not_found' | 'unknown'; reason: string; pages: number; checkedAt: string; nextCursor?: string | null; complete?: boolean; visitedCursors?: string[] }
export type CommentClaim = { workerId: string; since: string; commentId?: string; expectedText?: string }
export type CommentResult = Observation & { workerId: string; comment?: InstagramComment }

export function instagramUsername(value: string): string {
  const username = value.trim().replace(/^@/, '').toLowerCase()
  if (!/^[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$/.test(username)) throw new ProviderError('rocket', 'invalid_input', 'Enter a valid Instagram username.')
  return username
}

export function canonicalInstagramPost(value: string): { url: string; shortcode: string } {
  let url: URL
  try { url = new URL(value) } catch { throw new ProviderError('rocket', 'invalid_input', 'Paste the Instagram post or reel link.') }
  const match = /^\/(p|reel|tv)\/([A-Za-z0-9_-]{5,30})\/?$/.exec(url.pathname)
  if (url.protocol !== 'https:' || !['instagram.com', 'www.instagram.com'].includes(url.hostname) || url.username || url.password || url.port || !match) throw new ProviderError('rocket', 'invalid_input', 'Use a direct instagram.com post or reel link.')
  return { url: `https://www.instagram.com/${match[1]}/${match[2]}/`, shortcode: match[2] }
}

export function verifyProfileChallenge(profile: InstagramProfile, expectedId: string, challenge: string): boolean {
  if (profile.isPrivate || profile.id !== expectedId || !/^RR-[A-Z0-9]{16,64}$/.test(challenge)) return false
  return profile.biography.split(/\s+/).includes(challenge)
}

function profileFrom(value: unknown): InstagramProfile {
  const row = object(value)
  if (typeof row.is_private !== 'boolean' || typeof row.biography !== 'string') throw new ProviderError('rocket', 'invalid_response', 'Instagram account details are unavailable right now.')
  return { id: stableId(row.id ?? row.pk_id ?? row.pk, 'rocket'), username: instagramUsername(String(row.username ?? '')), biography: row.biography, isPrivate: row.is_private }
}

function nextPage(body: JsonObject, field: string, moreField: string): { cursor: string | null; complete: boolean } {
  const value = body[field]
  if (value !== undefined && value !== null && value !== '' && typeof value !== 'string') throw new ProviderError('rocket', 'invalid_response', 'The Instagram page could not be checked.')
  if (body[moreField] !== undefined && typeof body[moreField] !== 'boolean') throw new ProviderError('rocket', 'invalid_response', 'Instagram returned unclear pagination metadata.')
  const cursor = typeof value === 'string' && value ? value : null
  // Missing pagination metadata is not proof of completeness.
  const complete = !cursor && body[moreField] !== true && (body[moreField] === false || Object.hasOwn(body, field) && (value === null || value === ''))
  return { cursor, complete }
}

function userWireId(id: string): string | number {
  stableId(id, 'rocket')
  return Number.isSafeInteger(Number(id)) ? Number(id) : id
}
function pageLimit(value: number | undefined): number {
  const limit = value ?? 5
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20) throw new ProviderError('rocket', 'invalid_input', 'Invalid verification page limit.')
  return limit
}
function normalizedComment(value: string): string { return value.normalize('NFKC').replace(/\s+/g, ' ').trim() }

export function createRocketClient(options: ProviderOptions) {
  if (!options.apiKey?.trim()) throw new ProviderError('rocket', 'not_configured', 'Instagram verification is not available yet.', { retryable: false })
  async function request(path: string, payload: JsonObject): Promise<JsonObject> {
    const envelope = await providerRequest('rocket', options, `https://v1.rocketapi.io/${path}`, {
      method: 'POST', headers: { Authorization: `Token ${options.apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload),
    })
    const response = object(envelope.response)
    if (envelope.status !== 'done') throw new ProviderError('rocket', 'unavailable', 'Instagram has not returned a result yet.')
    if (response.status_code === 404) throw new ProviderError('rocket', 'not_found', 'That Instagram account or post could not be found.')
    if (response.status_code !== 200 || typeof response.content_type !== 'string' || !response.content_type.startsWith('application/json')) throw new ProviderError('rocket', 'unavailable', 'Instagram could not be checked right now.')
    const body = object(response.body)
    if (body.status !== 'ok' || Object.keys(body).length === 0) throw new ProviderError('rocket', 'invalid_response', 'Instagram returned an incomplete result.')
    return body
  }
  async function resolveProfile(username: string): Promise<InstagramProfile> {
    const expected = instagramUsername(username)
    const body = await request('instagram/user/get_web_profile_info', { username: expected })
    const result = profileFrom(object(body.data).user)
    if (result.username !== expected) throw new ProviderError('rocket', 'terms_mismatch', 'The Instagram account returned does not match this username.')
    return result
  }
  async function profileById(id: string): Promise<InstagramProfile> {
    const body = await request('instagram/user/get_info_by_id', { id: userWireId(id) })
    const result = profileFrom(body.user)
    if (result.id !== id) throw new ProviderError('rocket', 'terms_mismatch', 'The Instagram account ID does not match.')
    return result
  }
  async function resolveMedia(value: string): Promise<InstagramMedia> {
    const target = canonicalInstagramPost(value)
    const body = await request('instagram/media/get_info_by_shortcode', { shortcode: target.shortcode })
    const row = object(Array.isArray(body.items) ? body.items[0] : null)
    if (row.code !== target.shortcode || typeof row.comments_disabled !== 'boolean') throw new ProviderError('rocket', 'invalid_response', 'That post could not be checked. Use a public post owned by your account.')
    return { id: stableId(row.pk ?? row.id, 'rocket'), shortcode: target.shortcode, ownerId: stableId(object(row.user).pk_id ?? object(row.user).pk ?? object(row.user).id, 'rocket'), url: target.url, caption: String(object(row.caption).text ?? ''), commentsDisabled: row.comments_disabled }
  }
  async function checkFollowing(input: { workerId: string; targetId: string; targetUsername: string; maxPages?: number }): Promise<Observation> {
    const checkedAt = new Date().toISOString()
    let pages = 0
    const visitedCursors: string[] = []
    const result = (state: Observation['state'], reason: string, nextCursor: string | null = null, complete = false): Observation => ({ state, reason, pages, checkedAt, nextCursor, complete, visitedCursors: [...visitedCursors] })
    stableId(input.targetId, 'rocket')
    const limit = pageLimit(input.maxPages)
    const profile = await profileById(input.workerId)
    if (profile.isPrivate) return result('unknown', 'account_private')
    const targetUsername = instagramUsername(input.targetUsername)
    const search = await request('instagram/user/get_following', { id: userWireId(input.workerId), query: targetUsername })
    pages++
    const hasTarget = (body: JsonObject) => {
      if (!Array.isArray(body.users)) throw new ProviderError('rocket', 'invalid_response', 'Instagram returned an incomplete following list.')
      return body.users.some(user => stableId(object(user).pk_id ?? object(user).pk ?? object(user).id, 'rocket') === input.targetId)
    }
    if (hasTarget(search)) return result('verified', 'target_id_found')
    // Search is bounded/ranked and ignores pagination. A miss must be followed by
    // a complete unfiltered traversal before it can establish non-following.
    let cursor: string | null = null
    const seen = new Set<string>()
    for (let index = 0; index < limit; index++) {
      const body = await request('instagram/user/get_following', { id: userWireId(input.workerId), count: 50, ...(cursor ? { max_id: cursor } : {}) })
      pages++
      if (hasTarget(body)) return result('verified', 'target_id_found')
      const next = nextPage(body, 'next_max_id', 'big_list')
      if (next.complete) return result('not_found', 'complete_following_list', null, true)
      if (!next.cursor || seen.has(next.cursor)) return result('unknown', 'incomplete_following_list')
      seen.add(next.cursor); visitedCursors.push(next.cursor); cursor = next.cursor
    }
    return result('unknown', 'following_page_limit', cursor)
  }
  /** Resume a durable scan; caller must track all preceding pages and detect
   * repeated cursors before promoting complete=true to a negative decision. */
  async function followingPage(input: { workerId: string; cursor?: string }): Promise<{ userIds: string[]; nextCursor: string | null; complete: boolean }> {
    if (input.cursor) requiredText(input.cursor, 'rocket', 'page cursor', 2000)
    const body = await request('instagram/user/get_following', { id: userWireId(input.workerId), count: 50, ...(input.cursor ? { max_id: input.cursor } : {}) })
    if (!Array.isArray(body.users)) throw new ProviderError('rocket', 'invalid_response', 'Instagram returned an incomplete following list.')
    const userIds = body.users.map(user => stableId(object(user).pk_id ?? object(user).pk ?? object(user).id, 'rocket'))
    const next = nextPage(body, 'next_max_id', 'big_list')
    return { userIds, nextCursor: next.cursor, complete: next.complete }
  }
  async function commentsPage(mediaId: string, cursor?: string): Promise<{ comments: InstagramComment[]; nextCursor: string | null; complete: boolean }> {
    stableId(mediaId, 'rocket')
    if (cursor) requiredText(cursor, 'rocket', 'page cursor', 2000)
    const body = await request('instagram/media/get_comments', { id: mediaId, order: 1, can_support_threading: true, ...(cursor ? { min_id: cursor } : {}) })
    if (!Array.isArray(body.comments)) throw new ProviderError('rocket', 'invalid_response', 'Instagram returned an incomplete comment list.')
    const comments = body.comments.filter(value => {
      const row = object(value)
      return row.parent_comment_id == null && row.parent_id == null && row.is_hidden !== true && row.hidden !== true
    }).map(value => {
      const row = object(value), user = object(row.user)
      const timestamp = Number(row.created_at_utc ?? row.created_at)
      if (!Number.isSafeInteger(timestamp) || timestamp <= 0 || timestamp > Date.now() / 1000 + 60 || typeof row.text !== 'string') throw new ProviderError('rocket', 'invalid_response', 'A comment could not be checked safely.')
      if (row.media_id != null && stableId(row.media_id, 'rocket') !== mediaId) throw new ProviderError('rocket', 'terms_mismatch', 'The comment belongs to a different post.')
      return { id: stableId(row.pk ?? row.id, 'rocket'), authorId: stableId(user.pk_id ?? user.pk ?? user.id, 'rocket'), username: instagramUsername(String(user.username ?? '')), text: row.text, createdAt: new Date(timestamp * 1000).toISOString() }
    })
    const next = nextPage(body, 'next_min_id', 'has_more_comments')
    if (body.has_more_headload_comments !== undefined && typeof body.has_more_headload_comments !== 'boolean') throw new ProviderError('rocket', 'invalid_response', 'Instagram returned unclear comment pagination.')
    // Instagram can separately report more head-loaded comments. An absent
    // cursor alongside that flag is ambiguous, not a complete negative scan.
    return { comments, nextCursor: next.cursor, complete: next.complete && body.has_more_headload_comments !== true }
  }
  async function checkComments(input: { mediaId: string; claims: CommentClaim[]; maxPages?: number; cursor?: string }): Promise<{ results: CommentResult[]; nextCursor: string | null; complete: boolean; pages: number }> {
    const limit = pageLimit(input.maxPages), checkedAt = new Date().toISOString()
    if (!input.claims.length || input.claims.length > 100) throw new ProviderError('rocket', 'invalid_input', 'Invalid comment batch size.')
    const results = new Map<string, CommentResult>()
    for (const claim of input.claims) {
      stableId(claim.workerId, 'rocket')
      if (!Number.isFinite(Date.parse(claim.since)) || results.has(claim.workerId)) throw new ProviderError('rocket', 'invalid_input', 'Invalid comment claim.')
      if (claim.commentId) stableId(claim.commentId, 'rocket')
      results.set(claim.workerId, { workerId: claim.workerId, state: 'unknown', reason: 'comment_page_limit', pages: 0, checkedAt })
    }
    let nextCursor = input.cursor ?? null, complete = false, pages = 0
    const seen = new Set<string>()
    for (; pages < limit;) {
      const page = await commentsPage(input.mediaId, nextCursor ?? undefined)
      pages++
      for (const claim of input.claims) {
        const comment = page.comments.find(row => row.authorId === claim.workerId && Date.parse(row.createdAt) >= Date.parse(claim.since) && (!claim.commentId || row.id === claim.commentId) && (!claim.expectedText || normalizedComment(row.text) === normalizedComment(claim.expectedText)))
        if (comment) results.set(claim.workerId, { workerId: claim.workerId, state: 'verified', reason: 'matching_comment_found', pages, checkedAt, comment })
      }
      complete = page.complete; nextCursor = page.nextCursor
      if (complete || [...results.values()].every(value => value.state === 'verified') || !nextCursor || seen.has(nextCursor)) break
      seen.add(nextCursor)
    }
    for (const result of results.values()) if (result.state !== 'verified') {
      result.pages = pages
      result.state = complete && !input.cursor ? 'not_found' : 'unknown'
      result.reason = complete && !input.cursor ? 'complete_comment_list' : 'incomplete_comment_list'
    }
    return { results: [...results.values()], nextCursor, complete, pages }
  }
  return { resolveProfile, profileById, resolveMedia, checkFollowing, followingPage, commentsPage, checkComments }
}
