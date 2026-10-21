// Isolated UI contract scenarios. No real authentication, providers or money.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
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
  "Fixtures cannot target a published site.",
);
const out = new URL("../outputs/qa/operations/", import.meta.url);
await mkdir(out, { recursive: true });
const artifact = (name) => fileURLToPath(new URL(name, out));
const uid = "00000000-0000-4000-8000-000000000951";
const now = () => new Date().toISOString();
const ago = (hours) => new Date(Date.now() - hours * 3600000).toISOString();
const user = {
  id: uid,
  email: "operations@ui-test.invalid",
  aud: "authenticated",
  role: "authenticated",
  created_at: now(),
  email_confirmed_at: now(),
  user_metadata: {},
  app_metadata: { provider: "email", providers: ["email"] },
  factors: [{ id: "fixture-factor", factor_type: "totp", status: "verified" }],
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
    available_kobo: 123400,
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
    open_cases: 3,
    pending_checks: 4,
    pending_payouts: 2,
  },
  cases: [],
  jobs: [],
  payouts: [],
  audit: [],
  pricing,
  capabilities,
};
const blank = () => ({
  checked_at: now(),
  snapshot_status: "never_run",
  snapshot: null,
  worker: {
    status: "never_run",
    last_seen_at: null,
    last_success_at: null,
    last_failure_at: null,
    processed: 0,
    last_error: null,
  },
  reconciliation: null,
  reconciliation_status: "never_run",
  alerts: [],
  alerting: {
    configured: false,
    configuration_reason: "missing_key",
    last_created_at: null,
    reminder_hours: 6,
  },
  thresholds: {
    snapshot_stale_minutes: 15,
    worker_stale_minutes: 10,
    reconciliation_stale_hours: 26,
  },
});
const reconciliation = (status = "discrepancy") => ({
  id: "reconcile-fixture",
  status,
  checked_at: now(),
  findings: status === "failed" ? null : {
    unbalanced_journals: 0,
    account_mismatches: status === "discrepancy" ? 1 : 0,
    campaign_mismatches: 0,
    withdrawal_mismatches: 0,
  },
  error: status === "failed" ? "reconciliation_failed" : null,
});
const alert = (status = "retry", last_outcome = "uncertain") => ({
  id: "alert-fixture",
  status,
  last_outcome,
  created_at: ago(1),
  last_attempt_at: ago(.1),
  retry_until: new Date(Date.now() + 3600000).toISOString(),
  attempts: 2,
  provider_id: null,
  error_code: last_outcome === "uncertain" ? "provider_timeout" : null,
});
const populated = () => ({
  ...blank(),
  snapshot_status: "stale",
  snapshot: {
    collected_at: ago(2),
    counts: {
      pending_payments: 3,
      uncertain_payments: 2,
      stalled_payments: 1,
      missing_references: 1,
      pending_checks: 5,
      review_checks: 4,
      overdue_checks: 2,
      risk_holds: 1,
      support_open: 3,
      support_overdue: 1,
    },
    incidents: [{ code: "payment_uncertain", severity: "critical", count: 2 }, {
      code: "verification_review",
      severity: "warning",
      count: 4,
    }, { code: "support_waiting", severity: "warning", count: 1 }],
  },
  worker: {
    status: "unknown",
    last_seen_at: ago(1),
    last_success_at: ago(1),
    last_failure_at: null,
    processed: 8,
    last_error: null,
  },
  reconciliation: reconciliation(),
  reconciliation_status: "discrepancy",
  alerts: [alert()],
  alerting: {
    configured: true,
    configuration_reason: "ready",
    last_created_at: ago(1),
    reminder_hours: 6,
  },
});
let operations = blank(),
  failRead = false,
  failReconcile = false,
  busyReconcile = false,
  failedResult = false,
  gate = null;
const result = {
  mode:
    "isolated localhost HTTP fixtures, not live monitoring/email/ledger acceptance",
  checks: [],
  layouts: [],
  pageErrors: [],
  commands: [],
  aborted: [],
};
const pass = (message) => {
  result.checks.push(message);
  console.log("PASS " + message);
};
function hold(action) {
  let seen, release;
  const observed = new Promise((resolve) => seen = resolve),
    released = new Promise((resolve) => release = resolve);
  gate = { action, seen, released };
  return { observed, release };
}
const browser = await playwright.chromium.launch({
  channel: "chrome",
  headless: true,
});
async function makeContext(aal) {
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
      }).catch(() => {});
    if (req.method() === "OPTIONS") return send({});
    if (url.pathname === "/auth/v1/user") return send(user);
    if (url.pathname === "/auth/v1/token") return send(session(aal));
    if (url.pathname === "/auth/v1/logout") return send({});
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
      result.commands.push({ aal, ...body });
      if (gate?.action === body.action) {
        const current = gate;
        gate = null;
        current.seen();
        await current.released;
      }
      if (body.action === "workspace") return send(workspace);
      if (body.action.startsWith("admin-")) {
        assert.equal(aal, "aal2", "Never request operations at low assurance.");
      }
      if (body.action === "admin-overview") return send(overview);
      if (body.action === "admin-list") {
        return send({ items: [], next_cursor: null });
      }
      if (body.action === "admin-operations") {
        if (failRead) {
          failRead = false;
          return send({
            error: "Operational records are temporarily unavailable.",
          }, 503);
        }
        return send(operations);
      }
      if (body.action === "admin-reconcile-run") {
        assert.deepEqual(body, {
          confirmation: "CHECK LEDGER",
          action: "admin-reconcile-run",
        });
        if (failReconcile) {
          failReconcile = false;
          return send({
            error: "The check could not be started. Please retry.",
          }, 503);
        }
        if (busyReconcile) {
          busyReconcile = false;
          return send({
            error:
              "A ledger check is already running. Wait a moment and refresh.",
          }, 409);
        }
        operations.reconciliation = reconciliation(
          failedResult ? "failed" : "discrepancy",
        );
        operations.reconciliation_status = operations.reconciliation.status;
        failedResult = false;
        return send({ reconciliation: operations.reconciliation });
      }
      return send({ error: "Unexpected test command " + body.action }, 400);
    }
    return send({ error: "Unexpected intercepted endpoint" }, 400);
  });
  return context;
}
let context, page;
try {
  context = await makeContext("aal1");
  page = await context.newPage();
  await page.goto(base + "/admin");
  await page.getByText("Verify your authenticator to open operations", {
    exact: false,
  }).waitFor();
  assert.equal(
    result.commands.filter((command) => command.action === "admin-operations")
      .length,
    0,
  );
  assert.equal(await page.locator(".ops-panel").count(), 0);
  pass("MFA gate prevents loading operational data");
  await context.close();
  context = await makeContext("aal2");
  page = await context.newPage();
  page.on("pageerror", (error) => result.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    try {
      const action = request.postDataJSON()?.action;
      if (action) result.aborted.push(action);
    } catch {}
  });
  const loading = hold("admin-operations");
  await page.goto(base + "/admin");
  await loading.observed;
  await page.getByText("Loading operational status…", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByText("No exceptions in the latest scan", { exact: true })
      .count(),
    0,
  );
  loading.release();
  const panel = page.getByRole("region", { name: "Operational health" });
  await panel.getByText("No monitoring scan recorded", { exact: true })
    .waitFor();
  assert.equal(await panel.getByText("Never run", { exact: true }).count(), 3);
  await panel.getByText("Not configured", { exact: true }).waitFor();
  await panel.getByText("The email provider key is missing.", { exact: false })
    .waitFor();
  pass(
    "Loading, never-run and missing email setup are explicit—not healthy zeroes",
  );
  failRead = true;
  await panel.getByRole("button", { name: "Refresh operational health" })
    .click();
  await panel.getByRole("alert").waitFor();
  await panel.getByText("The last loaded results remain below.", {
    exact: false,
  }).waitFor();
  operations = populated();
  await panel.getByRole("button", { name: "Retry operational status" }).click();
  await panel.getByText("Monitoring needs a fresh scan", { exact: true })
    .waitFor();
  await panel.getByText("Needs refresh", { exact: true }).waitFor();
  pass(
    "Status fetch failure keeps labelled older data and Retry retrieves fresh results",
  );
  operations = { ...populated(), snapshot_status: "fresh" };
  operations.snapshot.collected_at = ago(.01);
  operations.worker.status = "healthy";
  await panel.getByRole("button", { name: "Refresh operational health" }).click();
  await panel.getByText("Last run succeeded", { exact: true }).waitFor();
  assert.equal(await panel.getByText("Recent run", { exact: true }).count(), 0);
  pass("An idle successful worker is not falsely described as a recent run");
  operations = populated();
  for (const width of [360, 390, 430, 1440]) {
    await page.setViewportSize({ width, height: width >= 1000 ? 1000 : 844 });
    await page.goto(base + "/admin");
    await panel.getByText("Monitoring needs a fresh scan", { exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(() =>
        document.documentElement.scrollWidth > innerWidth + 1
      ),
      false,
      "Operations overflows " + width,
    );
    assert.equal(
      await page.getByRole("heading", {
        name: "Let’s get you back.",
        exact: true,
      }).count(),
      0,
    );
    result.layouts.push({ width, route: "/admin" });
    await panel.evaluate(node => node.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: artifact("operations-" + width + ".png"), fullPage: true });
    await page.screenshot({ path: artifact("operations-viewport-" + width + ".png") });
    const ledgerButton = panel.getByRole("button", { name: "Check ledger", exact: true });
    await ledgerButton.evaluate(node => node.scrollIntoView({ block: "center", behavior: "instant" }));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const footerVisibility = await ledgerButton.evaluate(node => {
      const rect = node.getBoundingClientRect();
      const nav = document.querySelector(".r-bottomnav")?.getBoundingClientRect();
      const navVisible = nav && nav.height > 0;
      return {
        top: rect.top, bottom: rect.bottom, viewport: innerHeight,
        navTop: navVisible ? nav.top : innerHeight,
        hit: node.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)),
      };
    });
    assert.ok(footerVisibility.top >= 0 && footerVisibility.bottom <= footerVisibility.navTop && footerVisibility.hit,
      "Ledger footer must be visible and clickable above navigation: " + JSON.stringify(footerVisibility));
    await page.screenshot({ path: artifact("operations-footer-" + width + ".png") });
  }
  pass(
    "Operational overview fits 360, 390, 430 and 1440px with no error boundary",
  );
  assert.equal(
    await panel.getByRole("link", { name: "4 review checks", exact: false })
      .getAttribute("href"),
    "/admin/checks?filter=attention",
  );
  assert.equal(
    await panel.getByRole("link", {
      name: "2 uncertain payments",
      exact: false,
    }).getAttribute("href"),
    "/admin/payments?filter=attention",
  );
  assert.equal(
    await panel.getByRole("link", { name: "3 open cases", exact: false })
      .getAttribute("href"),
    "/admin/cases?filter=open",
  );
  await panel.getByRole("link", { name: "4 review checks", exact: false })
    .click();
  await page.waitForURL(base + "/admin/checks?filter=attention");
  assert.equal(
    await page.getByLabel("Filter checks").inputValue(),
    "attention",
  );
  await page.getByRole("heading", { name: "No checks found.", exact: true })
    .waitFor();
  pass("Recorded counts link to the correct protected investigation queues");
  await page.goto(base + "/admin");
  await panel.getByText("Monitoring needs a fresh scan", { exact: true })
    .waitFor();
  for (
    const [status, outcome, copy] of [
      ["accepted", "accepted", "Delivery is not confirmed."],
      [
        "retry",
        "uncertain",
        "The send outcome is unknown. A safe retry is scheduled",
      ],
      [
        "needs_review",
        "uncertain",
        "The send outcome is unknown. Review the provider record",
      ],
      ["superseded", null, "A newer alert replaced this record."],
      ["queued", null, "The alert is waiting for a sending attempt."],
      ["sending", null, "A sending attempt is in progress."],
      ["failed", "failed", "Do not assume it reached the inbox."],
    ]
  ) {
    operations.alerts = [alert(status, outcome)];
    await panel.getByRole("button", { name: "Refresh operational health" })
      .click();
    await panel.locator(".ops-run").filter({
      has: page.getByRole("heading", { name: "Email alerts", exact: true }),
    }).getByText(copy, { exact: false }).waitFor();
  }
  pass(
    "Accepted, unknown, retry, review, replaced and pending alert outcomes never claim delivery",
  );
  const before = structuredClone(workspace.wallet),
    requestCount = () =>
      result.commands.filter((command) =>
        command.action === "admin-reconcile-run"
      ).length;
  await panel.getByRole("button", { name: "Check ledger", exact: true })
    .click();
  let dialog = page.getByRole("dialog", { name: "Run a ledger check?" });
  await dialog.waitFor();
  assert.equal(requestCount(), 0);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(requestCount(), 0);
  pass("Opening or cancelling the ledger confirmation makes no check request");
  await panel.getByRole("button", { name: "Check ledger", exact: true })
    .click();
  failReconcile = true;
  await dialog.getByRole("button", { name: "Run read-only check" }).click();
  await dialog.getByRole("alert").filter({ hasText: "could not be started" })
    .waitFor();
  assert.equal(await dialog.isVisible(), true);
  pass("A failed check request remains retryable without claiming completion");
  busyReconcile = true;
  await dialog.getByRole("button", { name: "Run read-only check" }).click();
  await dialog.getByRole("alert").filter({ hasText: "already running" })
    .waitFor();
  pass(
    "An existing ledger run is reported honestly, not as a newly completed check",
  );
  failedResult = true;
  await dialog.getByRole("button", { name: "Run read-only check" }).click();
  await dialog.getByRole("alert").filter({ hasText: "did not complete" })
    .waitFor();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await panel.locator(".ops-run").filter({
    has: page.getByRole("heading", { name: "Ledger check", exact: true }),
  }).getByText("Failed", { exact: true }).waitFor();
  assert.equal(
    await panel.getByText("No comparison results were recorded.", {
      exact: true,
    }).count(),
    1,
  );
  assert.equal(
    await panel.getByText("Account balance differences", { exact: true })
      .count(),
    0,
  );
  pass(
    "A failed recorded reconciliation replaces the previous clean/discrepancy status",
  );
  await panel.getByRole("button", { name: "Check ledger", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Run read-only check" }).click();
  await dialog.waitFor({ state: "hidden" });
  await panel.getByText(
    "Ledger check finished. Differences need investigation; no funds changed.",
    { exact: true },
  ).waitFor();
  assert.deepEqual(workspace.wallet, before);
  assert.equal(
    await panel.getByRole("button", {
      name: /force credit|mark paid|refund|resend transfer|release hold/i,
    }).count(),
    0,
  );
  pass(
    "Confirmed ledger check displays recorded findings without altering money or exposing repair controls",
  );
  const pending = hold("admin-operations");
  await panel.getByRole("button", { name: "Refresh operational health" })
    .click();
  await pending.observed;
  await page.getByRole("button", { name: "Sign out", exact: true }).first()
    .click();
  await page.waitForURL("**/login");
  pending.release();
  await page.waitForTimeout(150);
  assert.equal(await page.locator(".ops-panel").count(), 0);
  assert.ok(result.aborted.includes("admin-operations"));
  pass(
    "Sign-out cancels an in-flight operational refresh and never restores privileged results",
  );
  assert.deepEqual(result.pageErrors, []);
  pass("No uncaught browser errors");
} catch (error) {
  result.failure = { name: error.name, message: error.message };
  console.error(error);
  process.exitCode = 1;
  await page?.screenshot({ path: artifact("failure.png"), fullPage: true })
    .catch(() => {});
} finally {
  await writeFile(
    new URL("results.json", out),
    JSON.stringify(result, null, 2),
  );
  await context?.close();
  await browser.close();
  console.log(
    JSON.stringify({
      checks: result.checks.length,
      layouts: result.layouts.length,
      failure: result.failure ?? null,
    }),
  );
}
