// Explicit production acceptance, not the isolated browser fixture suites.
// Run only after an authorized deployment is ready:
// REALREACH_LIVE_CONFIRM=read-only node tests/browser-live-readonly.mjs [--admin] [--release-qa] [--accounts-only] [--public-auth-only] [--business-contrast-only]
// No fixture responses, synthetic sessions, user creation, emails, or marketplace writes.
// Existing RealReach credentials stay in memory; results contain no tokens or passwords.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { homedir } from 'node:os';

assert.equal(process.env.REALREACH_LIVE_CONFIRM, 'read-only',
  'This makes real requests. Set REALREACH_LIVE_CONFIRM=read-only only after deployment approval.');
const root = fileURLToPath(new URL('../', import.meta.url));
const project = 'https://jabwuawiqsusjrccapab.supabase.co';
const base = new URL(process.env.REALREACH_LIVE_URL || 'https://realreach.com.ng');
assert.equal(base.protocol, 'https:');
assert.ok(['realreach.com.ng', 'www.realreach.com.ng', 'realreach-ng.vercel.app'].includes(base.hostname),
  'Only this project’s production domains are accepted.');
assert.equal(base.pathname, '/');
assert.equal(base.search + base.hash + base.username + base.password, '');
process.loadEnvFile(join(root, '.env.local'));
assert.equal(process.env.VITE_SUPABASE_URL, project);
const publicKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.ok(publicKey?.startsWith('sb_publishable_'));

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require(process.env.REALREACH_PLAYWRIGHT_PATH || 'playwright'); }
catch { playwright = require(join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const out = join(root, 'outputs', 'qa', 'live-readonly', new Date().toISOString().replaceAll(':', '-'));
await mkdir(out, { recursive: true });
const result = {
  mode: 'Real production browser + real authenticated APIs; no fixture responses or marketplace writes',
  origin: base.origin, checks: [], layouts: [], blocked: [], requests: [], pageErrors: [],
  preventedMutations: [], limitations: [
    'No signup, email delivery, Google account consent, Instagram verification, or payment acceptance is performed by this read-only harness.',
    'Admin password login does not bypass authenticator verification. AAL2 requires the owner’s real authenticator.',
  ],
};
const secrets = [];
const clean = (value) => {
  let text = String(value);
  for (const secret of secrets) if (secret) text = text.replaceAll(secret, '[redacted]');
  return text.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[token]')
    .replace(/(?:sb_secret_|sbp_|GOCSPX-)[A-Za-z0-9_-]+/g, '[secret]');
};
const pass = (name) => { result.checks.push(name); console.log('PASS ' + name); };
const blocked = (name) => { result.blocked.push(name); console.log('BLOCKED ' + name); };
const readActions = new Set(['workspace', 'list', 'task-detail', 'campaign-detail', 'banks',
  'admin-overview', 'admin-list', 'admin-detail', 'admin-history', 'admin-operations']);
const legacyReadActions = new Set(['access', 'capabilities', 'admin-status']);
const browser = await playwright.chromium.launch({ headless: true, channel: 'chrome' });
const contrastOnly = process.argv.includes('--business-contrast-only');
assert.ok(!contrastOnly || process.argv.includes('--release-qa'), 'Contrast check needs the private release business account');
let currentPage;

async function contextFor(label) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce', serviceWorkers: 'block' });
  // Continue real requests only. Aborting an unsafe write is a safety stop, never a simulated API result.
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    if (url.hostname.endsWith('.supabase.co') && url.origin !== project) {
      result.preventedMutations.push({ label, reason: 'Wrong Supabase project', method });
      return route.abort();
    }
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return route.continue();
    if (url.origin === project) {
      if (url.pathname === '/auth/v1/token' && ['password', 'refresh_token'].includes(url.searchParams.get('grant_type')))
        return route.continue();
      if (url.pathname === '/auth/v1/logout' && url.searchParams.get('scope') === 'local') return route.continue();
      let body;
      try { body = request.postDataJSON(); } catch { body = null; }
      const allowed = url.pathname === '/functions/v1/realreach-marketplace' ? readActions
        : url.pathname === '/functions/v1/realreach-api' ? legacyReadActions : null;
      if (method === 'POST' && allowed?.has(body?.action)) return route.continue();
      result.preventedMutations.push({ label, method, path: url.pathname, action: body?.action ?? null });
      return route.abort();
    }
    // Do not send analytics, provider requests or third-party write requests during acceptance.
    return route.abort();
  });
  const page = await context.newPage();
  currentPage = page;
  page.setDefaultTimeout(25_000);
  const state = { profile: null, isAdmin: false, capabilities: null };
  let profileReceived, adminReceived;
  const accountReads = Promise.all([
    new Promise(resolve => { profileReceived = resolve; }),
    new Promise(resolve => { adminReceived = resolve; }),
  ]);
  page.on('pageerror', error => result.pageErrors.push({ label, message: clean(error.message) }));
  page.on('response', async response => {
    try {
      const url = new URL(response.url());
      if (url.origin !== project) return;
      let action;
      try { action = response.request().postDataJSON()?.action; } catch { /* GET */ }
      result.requests.push({ label, path: url.pathname, method: response.request().method(), status: response.status(), ...(action ? { action } : {}) });
      if (url.pathname === '/rest/v1/profiles' && response.ok()) {
        const data = await response.json();
        state.profile = Array.isArray(data) ? data[0] : data;
        profileReceived();
      }
      if (url.pathname === '/rest/v1/sole_admin' && response.ok()) {
        const data = await response.json();
        state.isAdmin = !!(Array.isArray(data) ? data[0] : data)?.user_id;
        adminReceived();
      }
      if (action === 'workspace' && response.ok()) {
        const data = await response.json();
        state.capabilities = data?.capabilities ?? null;
      }
    } catch { /* A cancelled response does not expose partial session data. */ }
  });
  return { context, page, state, label, accountReads };
}

async function layout(run, route, width, name, { authenticated = false } = {}) {
  const { page, label } = run;
  await page.setViewportSize({ width, height: width >= 1000 ? 1000 : 844 });
  const response = await page.goto(base.origin + route, { waitUntil: 'domcontentloaded' });
  assert.ok(response?.ok(), label + ': route did not load');
  await page.getByRole('heading', { level: 1 }).first().waitFor();
  if (authenticated) {
    await page.locator('.r-workspace').waitFor();
    await page.waitForFunction(() => !document.querySelector('.studio-skeleton, .r-loading') &&
      ![...document.querySelectorAll('[role=status]')].some(node => node.textContent?.includes('Checking account security')));
  }
  if (route.startsWith('/login') || route.startsWith('/signup')) {
    await page.frameLocator('.r-google-official iframe').getByRole('button').waitFor();
    await page.getByText('Loading secure Google sign-in…', { exact: true }).waitFor({ state: 'hidden' });
  }
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.getByRole('heading', { name: 'Let’s get you back.', exact: true }).count(), 0, label + ': app error boundary');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false,
    label + ': horizontal overflow on ' + route + ' at ' + width);
  assert.equal(await page.getByText('We could not load your account. Please retry.', { exact: true }).count(), 0,
    label + ': live account fetch failed');
  const pathname = new URL(page.url()).pathname;
  assert.equal(pathname, new URL(route, base).pathname, label + ': unexpected route redirection');
  result.layouts.push({ label, route, width });
  await page.screenshot({ path: join(out, label + '-' + name + '-' + width + '.png'), fullPage: true });
}

async function realCommand(page, action) {
  return page.evaluate(async ({ project, key, action }) => {
    const stored = JSON.parse(localStorage.getItem('realreach-auth-v1') || 'null');
    const response = await fetch(project + '/functions/v1/realreach-marketplace', {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key,
        ...(stored?.access_token ? { Authorization: 'Bearer ' + stored.access_token } : {}) },
      body: JSON.stringify({ action }), signal: AbortSignal.timeout(20_000),
    });
    // Return only status, never bodies, account data or tokens.
    return response.status;
  }, { project, key: publicKey, action });
}

async function signIn(credential, label) {
  assert.ok(typeof credential.email === 'string' && typeof credential.password === 'string');
  secrets.push(credential.password);
  const run = await contextFor(label);
  await run.page.goto(base.origin + '/login');
  await run.page.getByLabel('Email address', { exact: true }).fill(credential.email);
  await run.page.locator('input[name=password]').fill(credential.password);
  const signed = run.page.waitForResponse(response => response.url().startsWith(project + '/auth/v1/token?grant_type=password'));
  await run.page.getByRole('button', { name: 'Log in', exact: true }).click();
  const response = await signed;
  if (!response.ok()) {
    blocked(label + ': existing account login rejected (' + response.status() + '); no replacement account created');
    await run.context.close();
    return null;
  }
  await run.page.waitForURL(url => ['/earn', '/business', '/admin', '/onboarding'].includes(url.pathname));
  let readTimer;
  try {
    await Promise.race([run.accountReads, new Promise((_, reject) => {
      readTimer = setTimeout(() => reject(new Error(label + ': account permission read did not complete')), 15_000);
    })]);
  } finally { clearTimeout(readTimer); }
  await run.page.getByRole('heading', { level: 1 }).first().waitFor();
  assert.ok(run.state.profile, label + ': actual profile was not received');
  if (credential.id) assert.equal(run.state.profile.id, credential.id, label + ': account identity mismatch');
  pass(label + ': actual email/password browser login and profile read');
  return run;
}

async function signOut(run) {
  await run.page.goto(base.origin + '/account');
  await run.page.getByRole('button', { name: 'Sign out', exact: true }).last().click();
  await run.page.waitForURL('**/login');
  await run.page.goto(base.origin + '/admin');
  await run.page.waitForURL('**/login');
  pass(run.label + ': local-session sign-out restores protected-route gate');
  await run.context.close();
}

try {
  if (!process.argv.includes('--accounts-only') && !contrastOnly) {
  const anonymous = await contextFor('anonymous');
  const authOnly = process.argv.includes('--public-auth-only');
  for (const width of authOnly ? [390, 1440] : [360, 390, 430, 1440]) {
    for (const [route, name] of authOnly ? [['/login', 'login'], ['/signup?role=worker', 'signup-worker'], ['/signup?role=business', 'signup-business']]
      : [['/', 'home'], ['/login', 'login'], ['/signup?role=worker', 'signup-worker'],
      ['/signup?role=business', 'signup-business'], ['/help', 'help'], ['/terms', 'terms'], ['/privacy', 'privacy']]) {
      await layout(anonymous, route, width, name);
    }
  }
  pass(authOnly ? 'Live login and both signup fronts finish loading official Google buttons at390/1440px'
    : 'Anonymous production pages fit 360, 390, 430 and 1440px');
  for (const route of ['/earn', '/business', '/admin']) {
    await anonymous.page.goto(base.origin + route);
    await anonymous.page.waitForURL('**/login');
  }
  pass('Anonymous worker, business and admin pages require login');
  assert.equal(await realCommand(anonymous.page, 'admin-overview'), 401);
  pass('Real marketplace API rejects anonymous admin access');
  await anonymous.page.goto(base.origin + '/signup?role=business');
  const choice = anonymous.page.getByRole('button', { name: 'I’m a business Reach real people' });
  assert.equal(await choice.getAttribute('aria-pressed'), 'true');
  await anonymous.page.getByRole('button', { name: 'I want to earn Discover opportunities' }).click();
  assert.equal(await choice.getAttribute('aria-pressed'), 'false');
  assert.equal(await anonymous.page.getByRole('button', { name: 'Create my account', exact: true }).isEnabled(), true);
  await anonymous.page.locator('.r-google-official iframe').waitFor();
  pass('Live signup account selection works and official Google button loads (no consent/signup submitted)');
  await anonymous.page.setViewportSize({ width: 390, height: 844 });
  await anonymous.page.goto(base.origin + '/');
  const openMenu = anonymous.page.getByRole('button', { name: 'Open menu', exact: true });
  await openMenu.click();
  const menu = anonymous.page.getByRole('dialog', { name: 'Main menu', exact: true });
  await menu.waitFor();
  const menuRect = await menu.boundingBox();
  assert.ok(menuRect && menuRect.x >= 0 && menuRect.x + menuRect.width <= 391);
  await anonymous.page.screenshot({ path: join(out, 'anonymous-menu-390.png') });
  await menu.getByRole('link', { name: 'How it works', exact: true }).click();
  await menu.waitFor({ state: 'hidden' });
  assert.equal(new URL(anonymous.page.url()).hash, '#how');
  assert.notEqual(await anonymous.page.evaluate(() => document.body.style.overflow), 'hidden');
  await openMenu.click();
  await menu.waitFor();
  await anonymous.page.keyboard.press('Escape');
  await menu.waitFor({ state: 'hidden' });
  assert.equal(await openMenu.getAttribute('aria-expanded'), 'false');
  await openMenu.click();
  await menu.getByRole('link', { name: 'Help & support', exact: true }).click();
  await anonymous.page.waitForURL('**/help');
  await anonymous.page.getByRole('heading', { name: 'How can we help?', exact: true }).waitFor();
  pass('Live mobile menu opens cleanly, navigates sections/help, closes on Escape and restores scrolling');
  await anonymous.context.close();
  }

  if (process.argv.includes('--admin')) {
    const credential = JSON.parse(await readFile(join(root, '.local-credentials', 'admin.json'), 'utf8'));
    assert.equal(credential.project, project);
    assert.equal(credential.email, 'admin@realreach.com.ng');
    const admin = await signIn(credential, 'admin');
    if (admin) {
      assert.equal(admin.state.isAdmin, true, 'Real server singleton assignment missing');
      for (const width of [390, 1440]) await layout(admin, '/admin', width, 'mfa-gate', { authenticated: true });
      await admin.page.getByText('Verify your authenticator to open operations and financial settings.', { exact: true }).waitFor();
      assert.equal(await admin.page.getByRole('region', { name: 'Operational health' }).count(), 0);
      assert.equal(await realCommand(admin.page, 'admin-overview'), 403);
      pass('Real sole-admin password session cannot bypass AAL2 in UI or API');
      blocked('Admin operational read acceptance needs the owner’s real authenticator; no MFA factor was enrolled or bypassed');
      await signOut(admin);
    }
  }

  if (process.argv.includes('--release-qa')) {
    const material = JSON.parse(await readFile(join(root, '.local-credentials', 'release-qa.json'), 'utf8'));
    assert.equal(material.project, project, 'Release accounts must belong to this RealReach project');
    for (const name of contrastOnly ? ['business'] : ['worker', 'business']) {
      const credential = material[name];
      assert.ok(credential?.id, 'Existing QA account identity is required; provisioning is not permitted');
      const run = await signIn(credential, 'qa-' + name);
      if (!run) continue;
      assert.equal(run.state.isAdmin, false, 'Ordinary QA account unexpectedly has admin access');
      const role = run.state.profile.account_type;
      if (!['worker', 'business'].includes(role)) {
        blocked(run.label + ': account needs real one-time onboarding; this read-only test does not assign roles');
        await run.context.close();
        continue;
      }
      assert.equal(role, name, 'Release account must already have its actual intended server role');
      if (contrastOnly) {
        for (const width of [390, 1440]) {
          await layout(run, '/business/campaigns', width, 'campaigns-contrast', { authenticated: true });
          const link = run.page.getByRole('link', { name: 'New campaign', exact: true });
          const style = await link.evaluate(node => ({ color: getComputedStyle(node).color,
            background: getComputedStyle(node).backgroundColor, text: node.textContent.trim() }));
          assert.equal(style.color, 'rgb(255, 255, 255)', 'Dark campaign button must retain white text');
          assert.equal(style.background, 'rgb(48, 32, 52)');
          await link.scrollIntoViewIfNeeded();
          await run.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          await run.page.screenshot({ path: join(out, 'business-campaigns-contrast-viewport-' + width + '.png') });
          result.layouts.at(-1).buttonStyle = style;
        }
        pass('Live New campaign button is readable white-on-plum at390/1440px');
        await signOut(run);
        continue;
      }
      const routes = role === 'worker'
        ? ['/earn', '/earn/my-tasks', '/earn/instagram', '/earn/wallet', '/account', '/support', '/notifications']
        : ['/business', '/business/campaigns', '/business/instagram', '/business/wallet', '/business/settings', '/account', '/support', '/notifications'];
      for (const width of [390, 1440]) for (const route of routes)
        await layout(run, route, width, route.replaceAll('/', '-'), { authenticated: true });
      pass(run.label + ': real ' + role + ' page/read journey on mobile and desktop');
      await run.page.goto(base.origin + (role === 'worker' ? '/earn/wallet' : '/business/wallet'));
      await run.page.getByRole('button', { name: role === 'worker' ? 'Withdraw earnings' : 'Add funds', exact: true }).waitFor();
      assert.equal(run.state.capabilities?.payments, false, 'Release acceptance requires collections to remain closed');
      assert.equal(run.state.capabilities?.payouts, false, 'Release acceptance requires payouts to remain closed');
      assert.equal(await run.page.locator('a[href*="checkout"]').count(), 0);
      await run.page.getByRole('button', { name: role === 'worker' ? 'Withdraw earnings' : 'Add funds', exact: true }).click();
      const dialog = run.page.getByRole('dialog');
      await dialog.waitFor();
      const moneyAction = dialog.getByRole('button', { name: role === 'worker' ? 'Request withdrawal' : 'Continue securely', exact: true });
      assert.equal(await moneyAction.isDisabled(), true, 'Closed provider gate must disable the money action');
      await run.page.keyboard.press('Escape');
      pass(run.label + ': closed live payment gates prevent financial actions and expose no saved checkout link');
      await run.page.reload();
      await run.page.locator('.r-workspace').waitFor();
      pass(run.label + ': real session persists across reload');
      for (const route of ['/admin', role === 'worker' ? '/business' : '/earn']) {
        await run.page.goto(base.origin + route);
        await run.page.waitForURL('**' + (role === 'worker' ? '/earn' : '/business'));
      }
      assert.equal(await realCommand(run.page, 'admin-overview'), 403);
      pass(run.label + ': cannot switch account type or enter admin through direct navigation/API');
      await signOut(run);
    }
  }
  assert.deepEqual(result.preventedMutations, [], 'The site attempted an unexpected write; inspect safety-blocked metadata');
  assert.equal(result.requests.some(request => request.status >= 500), false, 'Real Supabase read failed with a server error');
  assert.deepEqual(result.pageErrors, [], 'Uncaught production browser error');
  pass('No unexpected writes or uncaught browser errors');
} catch (error) {
  result.failure = clean(error.message);
  if (currentPage && !currentPage.isClosed()) {
    // Never capture a password field or a real authenticator QR on failure.
    await currentPage.screenshot({ path: join(out, 'failure.png'), fullPage: true,
      mask: [currentPage.locator('input[type=password]'), currentPage.locator('img[alt*="authenticator" i]')] }).catch(() => {});
  }
  console.error('FAIL ' + result.failure);
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(join(out, 'results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ checks: result.checks.length, layouts: result.layouts.length,
    blocked: result.blocked.length, failure: result.failure ?? null }));
}
