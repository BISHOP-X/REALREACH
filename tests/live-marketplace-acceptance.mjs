// Real hosted SDK/API acceptance. Not a fixture suite or a provider/payment test.
// Requires owner-provisioned, confirmed QA accounts in the ignored credential file.
// REALREACH_LIVE_CONFIRM=no-money-acceptance node tests/live-marketplace-acceptance.mjs
// Never prints credentials, tokens, account IDs, response bodies or private records.
import { createClient } from '@supabase/supabase-js';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const expectedProject = 'https://jabwuawiqsusjrccapab.supabase.co';
const origin = 'https://www.realreach.com.ng';
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
class CheckFailure extends Error {}
function requireCheck(condition, code) { if (!condition) throw new CheckFailure(code); }
const report = {
  started_at: new Date().toISOString(), mode: 'ordinary-user-live-no-money',
  checks: [], created: { campaign_drafts: 0, support_cases: 0 },
  limitations: [
    'Owner-provisioned confirmed QA accounts: no public signup, email delivery or Google consent tested here.',
    'No Instagram/provider requests, bank verification, campaign publication, funding or withdrawals.',
    'Two accounts cover worker/business cross-owner isolation, not two distinct business owners.',
    'Real browser rendering and singleton-admin MFA are separate acceptance checks.',
  ],
};
const clients = [];
let out;
async function check(name, run) {
  try {
    await run(); report.checks.push({ name, status: 'passed' }); console.log(`PASS ${name}`);
  } catch (error) {
    const code = error instanceof CheckFailure ? error.message : 'request_or_runtime_failure';
    report.checks.push({ name, status: 'failed', code });
    throw new CheckFailure(code);
  }
}

try {
  requireCheck(process.env.REALREACH_LIVE_CONFIRM === 'no-money-acceptance', 'explicit_live_opt_in_required');
  process.loadEnvFile(join(root, '.env.local'));
  requireCheck(process.env.VITE_SUPABASE_URL === expectedProject, 'wrong_application_project');
  const publicKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  requireCheck(typeof publicKey === 'string' && publicKey.startsWith('sb_publishable_'), 'publishable_key_required');
  const credentials = JSON.parse(await readFile(join(root, '.local-credentials', 'release-qa.json'), 'utf8'));
  requireCheck(credentials.project === expectedProject, 'wrong_qa_project');
  for (const role of ['worker', 'business']) {
    const account = credentials[role];
    requireCheck(account && uuid(account.id) && typeof account.email === 'string'
      && account.email.endsWith('@realreach.invalid') && typeof account.password === 'string'
      && account.password.length >= 12, 'invalid_operator_qa_account');
  }
  requireCheck(credentials.worker.id !== credentials.business.id, 'distinct_qa_accounts_required');
  // All HTTP is restricted to this project. No credentials or redirects may go elsewhere.
  const safeFetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    requireCheck(url.origin === expectedProject && !url.username && !url.password, 'unexpected_request_destination');
    const method = (options.method || 'GET').toUpperCase();
    const authRead = method === 'GET' && ['/auth/v1/user', '/auth/v1/settings', '/auth/v1/.well-known/jwks.json'].includes(url.pathname);
    const authWrite = method === 'POST' && (url.pathname === '/auth/v1/logout'
      || (url.pathname === '/auth/v1/token' && ['password', 'refresh_token'].includes(url.searchParams.get('grant_type'))));
    const dataRead = ['GET', 'HEAD'].includes(method) && url.pathname.startsWith('/rest/v1/');
    const allowedRpc = method === 'POST' && ['/rest/v1/rpc/rr_complete_onboarding', '/rest/v1/rpc/rr_market_totals'].includes(url.pathname);
    const marketplace = method === 'POST' && url.pathname === '/functions/v1/realreach-marketplace';
    requireCheck(authRead || authWrite || dataRead || allowedRpc || marketplace, 'unapproved_request_blocked');
    return fetch(input, { ...options, redirect: 'error', signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000) });
  };
  let serial = 0;
  const makeClient = () => {
    const client = createClient(expectedProject, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
        storageKey: `realreach-live-acceptance-${++serial}` },
      global: { fetch: safeFetch },
    });
    clients.push(client); return client;
  };
  const allowedActions = new Set(['capabilities', 'workspace', 'list', 'campaign-save', 'campaign-detail',
    'campaign-quote', 'business-save', 'task-detail', 'case-create', 'admin-overview', 'admin-list',
    'admin-operations', 'admin-history']);
  async function api(client, action, input = {}, explicitToken) {
    requireCheck(allowedActions.has(action), 'unapproved_marketplace_action');
    const token = explicitToken ?? (client ? (await client.auth.getSession()).data.session?.access_token : null);
    const response = await safeFetch(`${expectedProject}/functions/v1/realreach-marketplace`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: publicKey,
        Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ action, ...input }),
    });
    let body;
    try { body = await response.json(); } catch { throw new CheckFailure('non_json_api_response'); }
    return { status: response.status, body };
  }
  async function ok(client, action, input = {}) {
    const result = await api(client, action, input);
    requireCheck(result.status === 200, `api_${action}_expected_success`); return result.body;
  }
  async function denied(client, action, input = {}, status = 403) {
    const result = await api(client, action, input);
    requireCheck(result.status === status && typeof result.body?.error === 'string', `api_${action}_expected_denial`);
  }
  async function gates(client) {
    const result = await client.from('rr_settings').select('collections_enabled,payouts_enabled,payouts_paused').eq('singleton', true).single();
    requireCheck(!result.error && result.data?.collections_enabled === false
      && result.data.payouts_enabled === false && result.data.payouts_paused === true, 'payment_gates_not_closed');
    const capability = await ok(null, 'capabilities');
    requireCheck(capability.payments === false && capability.payouts === false && capability.payouts_paused === true, 'public_payment_capabilities_not_closed');
  }
  function zeroWallet(workspace) {
    requireCheck(workspace.wallet?.currency === 'NGN', 'unexpected_wallet_currency');
    for (const field of ['available_kobo', 'pending_kobo', 'reserved_kobo', 'withdrawing_kobo']) {
      requireCheck(workspace.wallet[field] === 0, 'qa_wallet_not_empty');
    }
    requireCheck(Array.isArray(workspace.payments) && workspace.payments.length === 0, 'qa_payments_not_empty');
  }
  async function login(role) {
    const client = makeClient(); const account = credentials[role];
    const result = await client.auth.signInWithPassword({ email: account.email, password: account.password });
    requireCheck(!result.error && result.data.user?.id === account.id && !!result.data.session, 'qa_signin_failed');
    const verified = await client.auth.getUser();
    requireCheck(!verified.error && verified.data.user?.id === account.id && !!verified.data.user.email_confirmed_at
      && verified.data.user.is_anonymous !== true, 'confirmed_qa_identity_required');
    const claims = await client.auth.getClaims();
    requireCheck(!claims.error && claims.data?.claims.iss === `${expectedProject}/auth/v1`
      && claims.data.claims.sub === account.id && claims.data.claims.aal === 'aal1', 'unexpected_qa_session');
    const admin = await client.from('sole_admin').select('user_id').eq('user_id', account.id);
    requireCheck(!admin.error && admin.data.length === 0, 'ordinary_account_required');
    return client;
  }
  out = join(root, 'outputs', 'qa', 'live-acceptance', new Date().toISOString().replaceAll(':', '-'));
  await mkdir(out, { recursive: true });
  await check('Anonymous marketplace access is denied', () => denied(null, 'workspace', {}, 401));
  let worker; let business;
  await check('Worker signs in with a verified ordinary session', async () => { worker = await login('worker'); });
  await check('Business signs in with a verified ordinary session', async () => { business = await login('business'); });
  await check('Live database and public capabilities keep money disabled', () => gates(worker));
  for (const [role, client] of [['worker', worker], ['business', business]]) {
    await check(`${role} onboarding uses the ordinary authenticated RPC`, async () => {
      let profile = await client.from('profiles').select('id,account_type').eq('id', credentials[role].id).single();
      requireCheck(!profile.error && profile.data, 'qa_profile_unavailable');
      if (profile.data.account_type === null) {
        const result = await client.rpc('rr_complete_onboarding', {
          p_type: role, p_name: `RealReach release QA ${role}`, p_city: 'Lagos',
          p_business_name: role === 'business' ? 'RealReach release QA business' : '',
        });
        requireCheck(!result.error && result.data === role, 'qa_onboarding_failed');
      }
      profile = await client.from('profiles').select('account_type').eq('id', credentials[role].id).single();
      requireCheck(!profile.error && profile.data?.account_type === role, 'qa_role_not_saved');
    });
    await check(`${role} cannot change its fixed account type`, async () => {
      const opposite = role === 'worker' ? 'business' : 'worker';
      const result = await client.rpc('rr_complete_onboarding', {
        p_type: opposite, p_name: `RealReach release QA ${role}`, p_city: 'Lagos', p_business_name: 'Forbidden QA role change',
      });
      requireCheck(result.error?.code === 'P0001', 'fixed_role_change_not_denied');
      const current = await client.from('profiles').select('account_type').eq('id', credentials[role].id).single();
      requireCheck(!current.error && current.data?.account_type === role, 'fixed_role_changed');
    });
    await check(`${role} workspace has no fabricated money or payments`, async () => { zeroWallet(await ok(client, 'workspace')); });
    await check(`${role} cannot open administration`, async () => {
      await denied(client, 'admin-overview'); await denied(client, 'admin-operations');
      await denied(client, 'admin-list', { resource: 'payments', filter: 'all' });
    });
    await check(`${role} cannot execute privileged financial reads directly`, async () => {
      const result = await client.rpc('rr_market_totals', { p_actor: credentials[role === 'worker' ? 'business' : 'worker'].id });
      requireCheck(result.error?.code === '42501', 'privileged_rpc_not_denied');
    });
    await check(`${role} cannot read another profile or bank records`, async () => {
      const other = credentials[role === 'worker' ? 'business' : 'worker'].id;
      const profiles = await client.from('profiles').select('id').eq('id', other);
      requireCheck(!profiles.error && profiles.data.length === 0, 'cross_owner_profile_visible');
      const bank = await client.from('rr_beneficiaries').select('id').limit(1);
      requireCheck(bank.error?.code === '42501', 'private_bank_table_not_denied');
    });
  }
  console.log('READY ordinary worker and business onboarding complete');
  await check('Worker cannot access business campaign commands', async () => {
    await denied(worker, 'list', { resource: 'campaigns' });
    await denied(worker, 'business-save', { name: 'Forbidden worker business' });
    await denied(worker, 'campaign-save', { campaign: { title: 'Forbidden worker draft', action: 'follow', quantity: 1, instructions: '' } });
  });
  await check('Business cannot access worker-only task lists', async () => {
    await denied(business, 'list', { resource: 'assignments' }); await denied(business, 'list', { resource: 'feed' });
  });
  await check('Worker receives real paginated task and activity lists', async () => {
    for (const resource of ['feed', 'assignments', 'transactions', 'notifications']) {
      const list = await ok(worker, 'list', { resource });
      requireCheck(Array.isArray(list.items) && list.items.length <= 50 && (list.next_cursor === null || typeof list.next_cursor === 'string'), 'invalid_paged_list');
      if (resource === 'feed') requireCheck(list.items.every(item => item.status === 'live'), 'non_live_task_in_feed');
      if (resource === 'assignments' || resource === 'transactions') requireCheck(list.items.length === 0, 'qa_activity_not_empty');
    }
  });
  await check('Business details persist only for the signed-in owner', async () => {
    await ok(business, 'business-save', { name: 'RealReach release QA business', category: 'Release quality assurance', website: '', owner_id: credentials.worker.id });
    const saved = await business.from('businesses').select('owner_id,name,category').eq('owner_id', credentials.business.id).single();
    requireCheck(!saved.error && saved.data?.owner_id === credentials.business.id && saved.data.name === 'RealReach release QA business'
      && saved.data.category === 'Release quality assurance', 'business_details_not_saved');
    const hidden = await worker.from('businesses').select('id').eq('owner_id', credentials.business.id);
    requireCheck(!hidden.error && hidden.data.length === 0, 'cross_owner_business_visible');
  });
  let draftId;
  const draftTitle = 'RealReach release QA — API acceptance';
  await check('Business creates or updates a real unfunded campaign draft', async () => {
    const existing = await ok(business, 'list', { resource: 'campaigns', query: draftTitle, filter: 'draft' });
    draftId = existing.items.find(item => item.title === draftTitle)?.id;
    const result = await ok(business, 'campaign-save', { campaign: {
      ...(draftId ? { id: draftId } : {}), title: draftTitle, action: 'follow', quantity: 3,
      target_url: '', instructions: 'Automated release QA draft. Do not publish.', owner_id: credentials.worker.id,
    } });
    requireCheck(uuid(result.id), 'draft_not_saved');
    if (!draftId) report.created.campaign_drafts++;
    draftId = result.id;
    const detail = await ok(business, 'campaign-detail', { id: draftId });
    requireCheck(detail.campaign?.id === draftId && detail.campaign.owner_id === credentials.business.id
      && detail.campaign.status === 'draft' && detail.campaign.quantity === 3 && detail.campaign.reserved_kobo === 0
      && detail.receipts_total === 0, 'draft_owner_or_state_incorrect');
  });
  await check('Draft update and quote persist without publishing or reserving funds', async () => {
    await ok(business, 'campaign-save', { campaign: { id: draftId, title: draftTitle, action: 'follow', quantity: 4,
      target_url: '', instructions: 'Automated release QA draft. Updated and saved. Do not publish.' } });
    const quote = await ok(business, 'campaign-quote', { id: draftId });
    requireCheck(quote.quantity === 4 && Number.isSafeInteger(quote.total_kobo) && typeof quote.terms_version === 'string', 'draft_quote_invalid');
    const read = await business.from('rr_campaigns').select('quantity,status,owner_id').eq('id', draftId).single();
    requireCheck(!read.error && read.data?.quantity === 4 && read.data.status === 'draft'
      && read.data.owner_id === credentials.business.id, 'draft_update_not_persistent');
    zeroWallet(await ok(business, 'workspace'));
  });
  await check('Another owner cannot read or modify the unpublished draft', async () => {
    const direct = await worker.from('rr_campaigns').select('id').eq('id', draftId);
    requireCheck(!direct.error && direct.data.length === 0, 'cross_owner_draft_visible');
    await denied(worker, 'task-detail', { id: draftId }, 404);
    await denied(worker, 'campaign-detail', { id: draftId });
    await denied(worker, 'campaign-save', { campaign: { id: draftId, title: 'Forbidden edit', action: 'follow', quantity: 1, instructions: '' } });
  });
  const caseIds = {};
  for (const [role, client] of [['worker', worker], ['business', business]]) {
    await check(`${role} support request is saved and listed`, async () => {
      const subject = `Release QA ${role} — support acceptance`;
      const existing = await ok(client, 'list', { resource: 'cases', query: subject });
      caseIds[role] = existing.items.find(item => item.subject === subject)?.id;
      if (!caseIds[role]) {
        const created = await ok(client, 'case-create', { subject,
          message: 'Automated release QA. No payment or Instagram task was requested. This case verifies support persistence.',
          reference: role === 'business' ? draftId : '' });
        requireCheck(uuid(created.id), 'support_request_not_saved'); caseIds[role] = created.id; report.created.support_cases++;
      }
      const listed = await ok(client, 'list', { resource: 'cases', query: subject });
      requireCheck(listed.items.some(item => item.id === caseIds[role] && item.subject === subject), 'support_request_not_listed');
    });
  }
  await check('Support records remain isolated between the two owners', async () => {
    for (const [role, client] of [['worker', worker], ['business', business]]) {
      const otherId = caseIds[role === 'worker' ? 'business' : 'worker'];
      const direct = await client.from('rr_cases').select('id').eq('id', otherId);
      requireCheck(!direct.error && direct.data.length === 0, 'cross_owner_support_visible');
      const list = await ok(client, 'list', { resource: 'cases' });
      requireCheck(!list.items.some(item => item.id === otherId), 'cross_owner_support_listed');
    }
  });
  await check('Restored business session reloads the saved draft', async () => {
    const session = (await business.auth.getSession()).data.session;
    requireCheck(!!session, 'business_session_missing');
    const restored = makeClient();
    const result = await restored.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
    requireCheck(!result.error && result.data.user?.id === credentials.business.id, 'session_restore_failed');
    const detail = await ok(restored, 'campaign-detail', { id: draftId });
    requireCheck(detail.campaign.quantity === 4 && detail.campaign.status === 'draft', 'draft_reload_failed');
  });
  await check('Local sign-out revokes marketplace access for the old JWT', async () => {
    const token = (await worker.auth.getSession()).data.session?.access_token;
    requireCheck(!!token, 'worker_session_missing');
    const result = await worker.auth.signOut({ scope: 'local' }); requireCheck(!result.error, 'local_signout_failed');
    const rejected = await api(null, 'workspace', {}, token);
    requireCheck(rejected.status === 401, 'revoked_session_still_authorized');
  });
  await check('Returning worker signs in again without changing role', async () => {
    worker = await login('worker'); zeroWallet(await ok(worker, 'workspace'));
    const role = await worker.from('profiles').select('account_type').eq('id', credentials.worker.id).single();
    requireCheck(!role.error && role.data?.account_type === 'worker', 'returning_role_incorrect');
  });
  await check('Acceptance leaves payment gates closed and both wallets empty', async () => {
    await gates(worker); zeroWallet(await ok(worker, 'workspace')); zeroWallet(await ok(business, 'workspace'));
    const payments = await ok(business, 'list', { resource: 'payments' });
    requireCheck(payments.items.length === 0, 'payment_record_created');
  });
  report.outcome = 'passed';
} catch (error) {
  report.outcome = 'failed'; report.failure = error instanceof CheckFailure ? error.message : 'request_or_runtime_failure';
  console.error(`FAIL ${report.failure}`); process.exitCode = 1;
} finally {
  // Local scope revokes only sessions opened by this script, not the browser QA session.
  for (const client of clients) {
    try { await client.auth.signOut({ scope: 'local' }); } catch { /* No raw error output. */ }
    client.auth.stopAutoRefresh();
  }
  report.finished_at = new Date().toISOString();
  if (out) await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ outcome: report.outcome, passed: report.checks.filter(check => check.status === 'passed').length,
    failed: report.checks.filter(check => check.status === 'failed').length, created: report.created }));
}
