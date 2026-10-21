// Local UI contract test. Every external request is intercepted or blocked.
// Fixture identities/settings never reach Supabase or a payment provider.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require(process.env.REALREACH_PLAYWRIGHT_PATH || "playwright");
} catch {
  playwright = require(
    join(
      homedir(),
      ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    ),
  );
}
const base = process.env.REALREACH_UI_TEST_URL || "http://localhost:5174";
assert.equal(
  new URL(base).hostname,
  "localhost",
  "Fixture tests must never target a published site.",
);
const out = new URL("../outputs/qa/admin-flow/", import.meta.url);
await mkdir(out, { recursive: true });
const path = (name) => fileURLToPath(new URL(name, out));
const uid = "00000000-0000-4000-8000-000000000901",
  caseId = "00000000-0000-4000-8000-000000000902",
  jobId = "00000000-0000-4000-8000-000000000903";
const now = () => new Date().toISOString();
const user = {
  id: uid,
  email: "admin@ui-test.invalid",
  aud: "authenticated",
  role: "authenticated",
  created_at: now(),
  email_confirmed_at: now(),
  user_metadata: {},
  app_metadata: { provider: "email", providers: ["email"] },
  factors: [{ id: "factor-test", factor_type: "totp", status: "verified" }],
};
const part = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
const session = (aal) => ({
  access_token: `${part({ alg: "HS256", typ: "JWT" })}.${
    part({
      sub: uid,
      aud: "authenticated",
      role: "authenticated",
      aal,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  }.isolated-fixture`,
  refresh_token: "isolated-fixture",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  token_type: "bearer",
  user,
});
const pricing = {
  approved: true,
  follow_reward_kobo: 10000,
  follow_fee_kobo: 2000,
  comment_reward_kobo: 15000,
  comment_fee_kobo: 3000,
  retention_hours: 48,
  claim_minutes: 30,
  minimum_withdrawal_kobo: 100000,
  withdrawal_fee_kobo: 5000,
  max_campaign_quantity: 10000,
  terms_version: "rr-fixture-1",
};
const capabilities = {
  instagram: true,
  payments: true,
  payouts: true,
  pricing: true,
  payouts_paused: false,
};
const workspace = {
  business: null,
  instagram: null,
  campaigns: [],
  feed: [],
  assignments: [],
  wallet: {
    currency: "NGN",
    available_kobo: 0,
    pending_kobo: 0,
    reserved_kobo: 0,
    withdrawing_kobo: 0,
    earned_kobo: 0,
    spent_kobo: 0,
  },
  transactions: [],
  beneficiaries: [],
  payments: [],
  cases: [],
  notifications: [],
  pricing,
  capabilities,
};
const overview = {
  counts: {
    workers: 100,
    businesses: 12,
    live_campaigns: 7,
    open_cases: 1,
    pending_checks: 2,
    pending_payouts: 1,
  },
  cases: [{
    id: caseId,
    subject: "Please check my task",
    message: "My comment is still present, but the final check was delayed.",
    status: "open",
    resolution: null,
    reference: "RR-TASK-TEST-ONLY",
    created_at: now(),
  }],
  jobs: [{
    id: jobId,
    phase: "retention",
    state: "attention",
    attempts: 8,
    due_at: now(),
    reason: "Instagram result was unavailable",
  }, {
    id: "00000000-0000-4000-8000-000000000904",
    phase: "completion",
    state: "queued",
    attempts: 1,
    due_at: now(),
    reason: null,
  }],
  payouts: [{
    id: "00000000-0000-4000-8000-000000000905",
    reference: "RR-PAYOUT-TEST-ONLY",
    amount_kobo: 100000,
    status: "unknown",
    created_at: now(),
  }],
  audit: [{
    id: "00000000-0000-4000-8000-000000000906",
    action: "admin_settings",
    created_at: now(),
    reference: null,
  }],
  pricing,
  capabilities,
};
overview.health = {
  queued_checks: 2,
  due_checks: 1,
  running_checks: 0,
  attention_checks: 1,
  oldest_due_at: now(),
  limits: {
    jobs_per_run: 8,
    follow_pages_per_batch: 8,
    comment_pages_per_batch: 1,
    max_scan_pages: 500,
    max_scan_minutes: 30,
    claim_queue_limit: 100,
  },
};
const results = {
  mode: "isolated localhost UI fixtures, not live backend acceptance",
  checks: [],
  layouts: [],
  pageErrors: [],
  commands: [],
  externalBlocked: [],
};
const pass = (message) => {
  results.checks.push(message);
  console.log("PASS " + message);
};
const browser = await playwright.chromium.launch({
  channel: "chrome",
  headless: true,
});
let failCase = false, failSettings = false, allowOverview = true;
async function contextFor(aal) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  await context.addInitScript(
    (value) => localStorage.setItem("realreach-auth-v1", JSON.stringify(value)),
    session(aal),
  );
  await context.route("**/*", async (route) => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin === base) return route.continue();
    if (url.hostname !== "jabwuawiqsusjrccapab.supabase.co") {
      results.externalBlocked.push(url.hostname);
      return route.abort();
    }
    const send = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": base,
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "*",
        },
        body: JSON.stringify(body),
      });
    if (req.method() === "OPTIONS") return send({});
    if (url.pathname === "/auth/v1/user") return send(user);
    if (url.pathname === "/auth/v1/token") return send(session(aal));
    if (url.pathname === "/rest/v1/profiles") {
      return send({
        id: uid,
        display_name: "Operations Test",
        city: "Lagos",
        preferred_front: "worker",
        account_type: "worker",
      });
    }
    if (url.pathname === "/rest/v1/sole_admin") return send({ user_id: uid });
    if (url.pathname === "/functions/v1/realreach-marketplace") {
      const body = req.postDataJSON();
      results.commands.push({ aal, ...body });
      if (body.action === "workspace") return send(workspace);
      if (body.action === "admin-overview") {
        assert.equal(
          aal,
          "aal2",
          "Low-assurance UI must not request administrator records",
        );
        if (!allowOverview) {
          return send({
            error: "Verify your authenticator before opening administration.",
          }, 403);
        }
        return send(overview);
      }
      if (body.action === "admin-list") {
        assert.equal(aal, "aal2");
        let items = body.resource === "cases"
          ? overview.cases
          : body.resource === "checks"
          ? overview.jobs
          : body.resource === "payments"
          ? overview.payouts
          : overview.audit;
        if (body.query) {
          items = items.filter((item) =>
            String(item.subject || item.reason || item.reference || item.action)
              .toLowerCase().includes(body.query.toLowerCase())
          );
        }
        if (body.filter && body.filter !== "all") {
          items = items.filter((item) =>
            (item.status || item.state) === body.filter
          );
        }
        return send({ items, next_cursor: null });
      }
      if (body.action === "admin-case") {
        assert.equal(body.id, caseId);
        if (failCase) {
          failCase = false;
          return send(
            { error: "Could not save the response. Please retry." },
            503,
          );
        }
        assert.ok(body.resolution.length >= 5);
        const item = overview.cases.find((c) => c.id === body.id);
        Object.assign(item, {
          status: body.status,
          resolution: body.resolution,
        });
        if (body.status === "resolved") overview.cases = [];
        return send({ ok: true });
      }
      if (body.action === "admin-retry") {
        assert.equal(body.id, jobId);
        overview.jobs[0].state = "queued";
        return send({ ok: true });
      }
      if (body.action === "admin-settings") {
        if (failSettings) {
          failSettings = false;
          return send({ error: "Settings were not saved. Please retry." }, 503);
        }
        assert.equal(body.settings.follow_reward_kobo, 12525);
        assert.equal(body.settings.payouts_paused, true);
        Object.assign(overview.pricing, body.settings, {
          terms_version: "rr-fixture-2",
        });
        overview.capabilities.payouts_paused = true;
        return send({ ok: true });
      }
      return send({ error: "Unexpected fixture command " + body.action }, 400);
    }
    return send({ error: "Unexpected intercepted endpoint" }, 400);
  });
  return context;
}
let context, page;
try {
  context = await contextFor("aal1");
  page = await context.newPage();
  page.on("pageerror", (error) => results.pageErrors.push(error.message));
  await page.goto(base + "/admin");
  await page.getByRole("heading", { name: "Two-step sign-in" }).waitFor();
  assert.equal(
    results.commands.filter((c) =>
      c.aal === "aal1" && c.action === "admin-overview"
    ).length,
    0,
  );
  assert.equal(
    await page.getByRole("navigation", { name: "Operations sections" }).count(),
    0,
  );
  pass("MFA gate appears before any privileged overview request");
  await context.close();
  context = await contextFor("aal2");
  page = await context.newPage();
  page.on("pageerror", (error) => results.pageErrors.push(error.message));
  const routes = [
    "/admin",
    "/admin/cases",
    "/admin/checks",
    "/admin/payments",
    "/admin/settings",
    "/admin/audit",
  ];
  for (const width of [360, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: width >= 1000 ? 1000 : 844 });
    for (const route of routes) {
      await page.goto(base + route);
      await page.getByRole("navigation", { name: "Operations sections" })
        .waitFor();
      assert.equal(
        await page.evaluate(() =>
          document.documentElement.scrollWidth > innerWidth + 1
        ),
        false,
        `${route} overflows at ${width}`,
      );
      assert.equal(
        await page.locator('.studio-tabs button.selected[aria-current="page"]')
          .count(),
        1,
      );
      assert.equal(
        await page.getByRole("heading", {
          name: "Let’s get you back.",
          exact: true,
        }).count(),
        0,
      );
      results.layouts.push({ width, route, overflow: false });
      if (
        width === 390 ||
        (width === 1440 && ["/admin", "/admin/settings"].includes(route))
      ) {
        await page.screenshot({
          path: path(`${route.replaceAll("/", "-").slice(1)}-${width}.png`),
          fullPage: true,
        });
      }
    }
    pass(`${width}px: all six admin routes fit and identify the active tab`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/admin/cases");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.getByRole("combobox", { name: "Case status", exact: true })
    .selectOption("resolved");
  await dialog.getByLabel("Response to the customer").fill(
    "We checked the task receipt and explained the next step.",
  );
  failCase = true;
  await dialog.getByRole("button", { name: "Save response" }).click();
  await dialog.getByRole("alert").waitFor();
  assert.match(
    await dialog.getByLabel("Response to the customer").inputValue(),
    /task receipt/,
  );
  pass("failed case update preserves the administrator response for retry");
  await dialog.getByRole("button", { name: "Save response" }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("heading", { name: "No cases found." }).waitFor();
  pass("case resolution posts only case ID, status and customer response");
  await page.getByRole("button", { name: "Checks", exact: true }).click();
  await page.getByRole("button", { name: "Retry check" }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Retry check" }).count(),
    1,
  );
  await page.getByRole("button", { name: "Retry check" }).click();
  await page.getByRole("button", { name: "Retry check" }).waitFor({
    state: "hidden",
  });
  await page.getByRole("heading", { name: "Verification & payment checks" })
    .waitFor();
  pass("only attention jobs can be retried; queued jobs have no retry control");
  await page.getByRole("button", { name: "Payments", exact: true }).click();
  assert.equal(
    await page.getByRole("button", { name: /approve|pay now|resend|refund/i })
      .count(),
    0,
  );
  await page.getByText("RR-PAYOUT-TEST-ONLY").waitFor();
  pass(
    "payment list retains the original reference without unsafe money controls",
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  assert.equal(
    await page.getByLabel("Current terms version").getAttribute("readonly"),
    "",
  );
  await page.getByLabel("Worker reward · follow (₦)", { exact: true }).fill(
    "125.25",
  );
  await page.getByLabel("Pause new withdrawal requests.").check();
  await page.getByRole("button", { name: "Review changes" }).click();
  await dialog.waitFor();
  assert.equal(
    await dialog.getByRole("button", { name: "Save settings" }).isDisabled(),
    true,
  );
  assert.equal(
    results.commands.filter((c) => c.action === "admin-settings").length,
    0,
  );
  pass("settings require a separate review and explicit confirmation");
  await dialog.getByRole("checkbox").check();
  failSettings = true;
  await dialog.getByRole("button", { name: "Save settings" }).click();
  await dialog.getByRole("alert").waitFor();
  assert.equal(await dialog.isVisible(), true);
  pass("failed settings save keeps confirmation and entered values");
  await dialog.getByRole("button", { name: "Save settings" }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByLabel("Current terms version").waitFor();
  assert.equal(
    await page.getByLabel("Current terms version").inputValue(),
    "rr-fixture-2",
  );
  assert.equal(
    await page.getByLabel("Worker reward · follow (₦)", { exact: true })
      .inputValue(),
    "125.25",
  );
  pass(
    "confirmed settings convert naira exactly to kobo and show the server terms version",
  );
  allowOverview = false;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Verify your authenticator" })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Review changes" }).count(),
    0,
  );
  pass("server denial hides privileged controls and offers reload");
  assert.deepEqual(results.pageErrors, []);
  pass("no uncaught browser errors");
} catch (error) {
  results.failure = { name: error.name, message: error.message };
  process.exitCode = 1;
  console.error(error.message);
  if (page) {
    await page.screenshot({ path: path("failure.png"), fullPage: true }).catch(
      () => {},
    );
  }
} finally {
  await writeFile(
    new URL("results.json", out),
    JSON.stringify(results, null, 2),
  );
  await context?.close();
  await browser.close();
  console.log(
    JSON.stringify({
      checks: results.checks.length,
      layouts: results.layouts.length,
      failure: results.failure || null,
    }),
  );
}
