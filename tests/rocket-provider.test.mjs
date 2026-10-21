import test from 'node:test'
import assert from 'node:assert/strict'
import { createRocketClient, canonicalInstagramPost, verifyProfileChallenge } from '../supabase/functions/_shared/rocket.ts'
import { parseProviderJson, ProviderError } from '../supabase/functions/_shared/provider-contract.ts'

const profile = { pk: '123', username: 'worker', biography: '', is_private: false }
const envelope = body => ({ status: 'done', response: { status_code: 200, content_type: 'application/json', body: { status: 'ok', ...body } } })
function transport(responses) {
  const calls = []
  const fetch = async (url, init) => {
    calls.push({ url, ...init, data: init.body ? JSON.parse(init.body) : undefined })
    const next = responses.shift()
    assert.notEqual(next, undefined, `Unexpected provider call ${url}`)
    if (next instanceof Error) throw next
    return next instanceof Response ? next : Response.json(envelope(next))
  }
  return { calls, client: createRocketClient({ apiKey: 'fixture-only', fetch }) }
}

test('Rocket fails closed without server credentials', () => {
  assert.throws(() => createRocketClient({ apiKey: '' }), error => error instanceof ProviderError && error.code === 'not_configured')
})
test('provider JSON preserves large numeric Instagram IDs without altering quoted content', () => {
  const parsed = parseProviderJson('{"id":2967835229909923253,"text":"2967835229909923253 and \\"quoted\\"","amount":1.25}'.replace(' and \\"quoted\\"', ''))
  assert.equal(parsed.id, '2967835229909923253')
  assert.equal(parsed.text, '2967835229909923253')
  assert.equal(parsed.amount, 1.25)
})
test('Instagram post targets reject host tricks, credentials, paths and non-HTTPS', () => {
  assert.deepEqual(canonicalInstagramPost('https://instagram.com/reel/ABC_def123/?igsh=abc'), { shortcode: 'ABC_def123', url: 'https://www.instagram.com/reel/ABC_def123/' })
  for (const url of ['http://instagram.com/p/ABCDEF/', 'https://instagram.com.evil.test/p/ABCDEF/', 'https://evil@instagram.com/p/ABCDEF/', 'https://instagram.com/share/ABCDEF', 'https://instagram.com:444/p/ABCDEF/', 'https://127.0.0.1/p/ABCDEF/']) assert.throws(() => canonicalInstagramPost(url))
})
test('profile is resolved by returned stable ID and exact username', async () => {
  const { client, calls } = transport([{ data: { user: { ...profile, id: '123' } } }])
  assert.deepEqual(await client.resolveProfile('@WORKER'), { id: '123', username: 'worker', biography: '', isPrivate: false })
  assert.equal(calls[0].url, 'https://v1.rocketapi.io/instagram/user/get_web_profile_info')
  assert.deepEqual(calls[0].data, { username: 'worker' })
  assert.equal(calls[0].headers.Authorization, 'Token fixture-only')
  assert.equal(calls[0].redirect, 'error')
})
test('profile cannot silently treat missing privacy information as public', async () => {
  const { client } = transport([{ data: { user: { id: '123', username: 'worker', biography: '' } } }])
  await assert.rejects(client.resolveProfile('worker'), { code: 'invalid_response' })
})
test('profile challenge requires exact single-use token, stable ID and public account', () => {
  const token = 'RR-0123456789ABCDEF'
  const verified = { id: '123', username: 'worker', biography: `Creator\n${token}`, isPrivate: false }
  assert.equal(verifyProfileChallenge(verified, '123', token), true)
  assert.equal(verifyProfileChallenge({ ...verified, biography: token + 'FAKE' }, '123', token), false)
  assert.equal(verifyProfileChallenge(verified, '987', token), false)
  assert.equal(verifyProfileChallenge({ ...verified, isPrivate: true }, '123', token), false)
})
test('profile mismatch is never linked', async () => {
  const { client } = transport([{ data: { user: { ...profile, id: '123', username: 'another' } } }])
  await assert.rejects(client.resolveProfile('worker'), { code: 'terms_mismatch' })
})
test('media resolves exact target, stable owner and exact large media ID', async () => {
  const { client } = transport([new Response('{"status":"done","response":{"status_code":200,"content_type":"application/json","body":{"status":"ok","items":[{"pk":2967835229909923253,"code":"ABCDEF123","user":{"pk":123},"comments_disabled":false,"caption":{"text":"Our product"}}]}}}')])
  assert.equal((await client.resolveMedia('https://instagram.com/p/ABCDEF123/')).id, '2967835229909923253')
})
test('follow search matches stable ID rather than similar username', async () => {
  const { client } = transport([{ user: profile }, { users: [{ pk: '999', username: 'brand' }] }])
  const result = await client.checkFollowing({ workerId: '123', targetId: '999', targetUsername: 'brand' })
  assert.equal(result.state, 'verified')
  assert.equal(result.pages, 1)
})
test('follow search miss triggers full pagination and never trusts short page length', async () => {
  const { client, calls } = transport([{ user: profile }, { users: [] }, { users: [{ pk: '333' }], next_max_id: 'cursor-two' }, { users: [{ pk: '999' }], next_max_id: null }])
  const result = await client.checkFollowing({ workerId: '123', targetId: '999', targetUsername: 'brand' })
  assert.equal(result.state, 'verified')
  assert.deepEqual(calls[3].data, { id: 123, count: 50, max_id: 'cursor-two' })
  assert.equal(calls[1].data.query, 'brand')
})
test('complete unfiltered following absence is not_found', async () => {
  const { client } = transport([{ user: profile }, { users: [] }, { users: [], next_max_id: null }])
  assert.equal((await client.checkFollowing({ workerId: '123', targetId: '999', targetUsername: 'brand' })).state, 'not_found')
})
test('missing metadata, repeating cursor and page budget are unknown, never absence', async () => {
  for (const pages of [[{ users: [] }], [{ users: [], next_max_id: 'same' }, { users: [], next_max_id: 'same' }], [{ users: [], next_max_id: 'more' }]]) {
    const { client } = transport([{ user: profile }, { users: [] }, ...pages])
    const result = await client.checkFollowing({ workerId: '123', targetId: '999', targetUsername: 'brand', maxPages: pages.length })
    assert.equal(result.state, 'unknown')
  }
})
test('a private worker profile never produces an eligibility or follow decision', async () => {
  const { client, calls } = transport([{ user: { ...profile, is_private: true } }])
  assert.equal((await client.checkFollowing({ workerId: '123', targetId: '999', targetUsername: 'brand' })).state, 'unknown')
  assert.equal(calls.length, 1)
})
test('initial follow batch returns every visited cursor for durable cycle detection', async () => {
  const { client } = transport([{ user: profile }, { users: [] }, { users: [], next_max_id: 'first' }, { users: [], next_max_id: 'second' }])
  const result = await client.checkFollowing({ workerId: '123', targetId: '999', targetUsername: 'brand', maxPages: 2 })
  assert.equal(result.state, 'unknown')
  assert.equal(result.nextCursor, 'second')
  assert.deepEqual(result.visitedCursors, ['first', 'second'])
})
test('contradictory end cursor and more-results flags never prove absence', async () => {
  const following = transport([{ user: profile }, { users: [] }, { users: [], next_max_id: null, big_list: true }])
  assert.equal((await following.client.checkFollowing({ workerId: '123', targetId: '999', targetUsername: 'brand' })).state, 'unknown')
  for (const flags of [{ has_more_comments: true }, { has_more_comments: false, has_more_headload_comments: true }]) {
    const comments = transport([{ comments: [], next_min_id: null, ...flags }])
    assert.equal((await comments.client.commentsPage('900')).complete, false)
  }
  const malformed = transport([{ comments: [], next_min_id: null, has_more_comments: 'false' }])
  await assert.rejects(malformed.client.commentsPage('900'), { code: 'invalid_response' })
})
const comment = (id, authorId, overrides = {}) => ({ pk: id, user: { pk: authorId, username: `user${authorId}` }, text: 'Looks interesting', created_at: 1_700_000_100, ...overrides })
test('one paginated comment scan matches multiple workers, authors and acceptance times', async () => {
  const { client, calls } = transport([
    { comments: [comment('1001', '11'), comment('1002', '22', { created_at: 1_699_999_999 })], next_min_id: 'second' },
    { comments: [comment('1003', '22')], next_min_id: null, has_more_comments: false },
  ])
  const result = await client.checkComments({ mediaId: '900', claims: [{ workerId: '11', since: '2023-11-14T22:13:20Z' }, { workerId: '22', since: '2023-11-14T22:13:20Z' }] })
  assert.deepEqual(result.results.map(row => [row.workerId, row.comment?.id, row.state]), [['11', '1001', 'verified'], ['22', '1003', 'verified']])
  assert.equal(calls[0].data.order, 1)
  assert.equal(calls[0].data.can_support_threading, true)
  assert.equal(calls[1].data.min_id, 'second')
})
test('retention requires the same original comment, not a replacement by the same author', async () => {
  const { client } = transport([{ comments: [comment('1002', '11')], next_min_id: null }])
  const result = await client.checkComments({ mediaId: '900', claims: [{ workerId: '11', since: '2023-11-14T22:13:20Z', commentId: '1001' }] })
  assert.equal(result.results[0].state, 'not_found')
})
test('expected comment text and post must match', async () => {
  const { client } = transport([{ comments: [comment('1001', '11')], next_min_id: null }])
  assert.equal((await client.checkComments({ mediaId: '900', claims: [{ workerId: '11', since: '2023-11-14T22:13:20Z', expectedText: 'Different' }] })).results[0].state, 'not_found')
  const second = transport([{ comments: [comment('1001', '11', { media_id: '999' })], next_min_id: null }])
  await assert.rejects(second.client.commentsPage('900'), { code: 'terms_mismatch' })
})
test('partial comment scan and resumed scan absence stay unknown', async () => {
  const { client } = transport([{ comments: [], next_min_id: 'next' }])
  const result = await client.checkComments({ mediaId: '900', maxPages: 1, claims: [{ workerId: '11', since: '2023-11-14T22:13:20Z' }] })
  assert.equal(result.results[0].state, 'unknown')
  assert.equal(result.nextCursor, 'next')
  const resumed = transport([{ comments: [], next_min_id: null }])
  assert.equal((await resumed.client.checkComments({ mediaId: '900', cursor: 'next', claims: [{ workerId: '11', since: '2023-11-14T22:13:20Z' }] })).results[0].state, 'unknown')
})
test('rate limits, unreadable responses and Instagram failures never become not_found evidence', async () => {
  for (const response of [new Response('{}', { status: 429 }), new Response('<html>outage</html>'), Response.json({ status: 'error' }), Response.json({ status: 'done', response: { status_code: 500 } })]) {
    const { client } = transport([response])
    await assert.rejects(client.resolveProfile('worker'), error => error instanceof ProviderError && error.code !== 'not_found')
  }
})
test('network failure does not echo credential or upstream error', async () => {
  const { client } = transport([new Error('secret fixture-only')])
  await assert.rejects(client.resolveProfile('worker'), error => error.code === 'unavailable' && !error.message.includes('fixture-only'))
})
test('durable following-page continuation preserves cursor and completeness metadata', async () => {
  const { client, calls } = transport([{ users: [{ pk: '999' }], next_max_id: null }])
  assert.deepEqual(await client.followingPage({ workerId: '123', cursor: 'previous-page' }), { userIds: ['999'], nextCursor: null, complete: true })
  assert.deepEqual(calls[0].data, { id: 123, count: 50, max_id: 'previous-page' })
})
test('top-level paid comments exclude replies and hidden comments', async () => {
  const { client } = transport([{ comments: [comment('1001', '11', { parent_comment_id: '555' }), comment('1002', '11', { is_hidden: true })], next_min_id: null }])
  assert.equal((await client.commentsPage('900')).comments.length, 0)
})
