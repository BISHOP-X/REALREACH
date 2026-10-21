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
const out = new URL("../outputs/qa/admin-investigation/", import.meta.url);
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

const taskId = "00000000-0000-4000-8000-000000000911",
  paymentId = "00000000-0000-4000-8000-000000000905";
const owner = {
  id: "00000000-0000-4000-8000-000000000920",
  display_name: "Amaka Test",
  account_type: "worker",
};
const business = {
  id: "00000000-0000-4000-8000-000000000921",
  display_name: "Everyday Objects",
  account_type: "business",
};
overview.cases.push({
  ...overview.cases[0],
  id: "case-second",
  subject: "Question about a withdrawal",
}, {
  ...overview.cases[0],
  id: "case-archive",
  subject: "Archive campaign question",
});
overview.jobs[0] = {
  ...overview.jobs[0],
  assignment_id: taskId,
  payment_id: null,
  scanned_pages: 500,
  created_at: now(),
};
overview.jobs.push({
  ...overview.jobs[0],
  id: "job-archive",
  phase: "reconcile",
  state: "done",
  assignment_id: null,
  payment_id: paymentId,
});
overview.audit.push({
  ...overview.audit[0],
  id: "audit-second",
  action: "payment_review",
}, { ...overview.audit[0], id: "audit-archive", action: "archive_record" });
overview.payouts = Array.from({ length: 3 }, (_, i) => ({
  id: i === 0 ? paymentId : "payment-" + i,
  reference: "RR-PAYOUT-TEST-" + i,
  amount_kobo: 100000,
  status: "unknown",
  created_at: now(),
  direction: i === 2 ? "collection" : "payout",
  provider_id: null,
  owner_id: owner.id,
  fee_kobo: 5000,
  currency: "NGN",
  submitted_at: now(),
  checked_at: now(),
  owner,
  risk_held: i === 0,
}));
const payment = {
  payment: overview.payouts[0],
  owner,
  beneficiary: {
    bank_name: "Test Bank",
    account_name: "AMAKA TEST",
    account_last4: "4321",
  },
  jobs: [overview.jobs[2]],
  evidence: [],
  audit: overview.audit,
  cases: [overview.cases[1]],
  events: [{
    event_hash: "signed-fixture-hash",
    reason: "Provider amount did not match the original request.",
    created_at: now(),
  }],
  risk_hold: {
    id: "hold-fixture",
    payment_id: paymentId,
    reason: "A signed payment discrepancy needs investigation.",
    created_at: now(),
  },
  allowed_actions: { recheck: true, close_without_payment: false },
  recovery_note:
    "PocketFi support must establish the original request before this candidate can be attached.",
  history_limits: { jobs: 100, cases: 50, audit: 50, events: 50 },
  history_cursors: {
    jobs: "older",
    cases: "older",
    audit: "older",
    events: "older",
  },
};
const task = {
  assignment: {
    id: taskId,
    campaign_id: "campaign-fixture",
    campaign_title: "The everyday edit",
    business_name: "Everyday Objects",
    action: "comment",
    target_url: "https://www.instagram.com/p/LOCALFIXTURE/",
    target_username: "everydayobjects",
    instructions:
      "Tell us which everyday object you would choose, in your own words.",
    status: "needs_review",
    reason:
      "Provider evidence remained incomplete after the allowed scan budget.",
    reward_kobo: 15000,
    created_at: now(),
    expires_at: now(),
    submitted_at: now(),
    hold_until: now(),
    settled_at: null,
    next_check_at: null,
    comment_text: "I would choose the blue cup for my morning tea.",
    evidence_id: "evidence-fixture",
    worker_id: owner.id,
    fee_kobo: 3000,
  },
  campaign: {
    id: "campaign-fixture",
    business_id: business.id,
    business_name: "Everyday Objects",
    title: "The everyday edit",
    action: "comment",
    status: "live",
    target_url: "https://www.instagram.com/p/LOCALFIXTURE/",
    target_username: "everydayobjects",
    instructions:
      "Tell us which everyday object you would choose, in your own words.",
    retention_hours: 48,
    terms_version: "rr-fixture-1",
    quantity: 100,
    delivered_count: 10,
    active_count: 2,
    pending_count: 1,
    reserved_kobo: 1800000,
    spent_kobo: 180000,
    created_at: now(),
    updated_at: now(),
    ends_at: null,
  },
  worker: owner,
  worker_instagram: {
    username: "amaka_test",
    instagram_id: "111111111111111111",
  },
  owner: business,
  jobs: [overview.jobs[0]],
  evidence: [{
    id: "evidence-fixture",
    result: "unknown",
    phase: "retention",
    actor_id: "111111111111111111",
    target_id: "222222222222222222",
    comment_id: "333333333333333333",
    reason: "The final page of comments could not be checked.",
    checked_at: now(),
    provider: "Rocket",
  }],
  audit: overview.audit,
  cases: [overview.cases[0]],
  closure: null,
  allowed_actions: { retry: true, close_without_payment: true },
  history_limits: { jobs: 100, evidence: 100, cases: 50, audit: 50 },
  history_cursors: {
    jobs: "older",
    evidence: "older",
    cases: "older",
    audit: "older",
  },
};
Object.assign(overview.cases[0], {
  reference: taskId,
  related_record: { resource: "task", id: taskId },
  reference_resolution: "resolved",
});
Object.assign(overview.cases[1], {
  reference: paymentId,
  related_record: { resource: "payment", id: paymentId },
  reference_resolution: "resolved",
});
Object.assign(overview.cases[2], {
  reference: task.campaign.id,
  related_record: { resource: "campaign", id: task.campaign.id },
  reference_resolution: "resolved",
});
const campaignDetail = {
  campaign: task.campaign,
  owner: business,
  cases: [overview.cases[2]],
  audit: overview.audit,
  history_cursors: { cases: "older", audit: "older" },
  history_limits: { cases: 50, audit: 50 },
};
let failHistory = true;
let failClose = true;

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
            body.filter === "attention"
              ? (body.resource === "payments"
                ? item.risk_held || item.status === "unknown"
                : item.state === "attention")
              : ["payout", "collection"].includes(body.filter)
              ? item.direction === body.filter
              : (item.status || item.state) === body.filter
          );
        }
        const offset = Number(body.cursor || 0);
        return send({
          items: items.slice(offset, offset + 2),
          next_cursor: offset + 2 < items.length ? String(offset + 2) : null,
        });
      }
      if (body.action === "admin-detail") {
        return send(
          body.resource === "payment"
            ? payment
            : body.resource === "campaign"
            ? campaignDetail
            : task,
        );
      }
      if (body.action === "admin-history") {
        assert.equal(aal, "aal2");
        assert.equal(body.cursor, "older");
        if (body.history === "evidence" && failHistory) {
          failHistory = false;
          return send({
            error: "Older evidence could not be loaded. Try again.",
          }, 503);
        }
        const older = {
          jobs: {
            ...overview.jobs[0],
            id: "older-job",
            reason: "Older check reviewed",
          },
          evidence: {
            ...task.evidence[0],
            id: "older-evidence",
            reason: "Earlier account-scoped evidence",
          },
          cases: {
            ...overview.cases[0],
            id: "older-case",
            subject: "Earlier linked support request",
          },
          audit: {
            ...overview.audit[0],
            id: "older-audit",
            action: "earlier_admin_review",
          },
          events: {
            ...payment.events[0],
            event_hash: "older-event",
            reason: "Earlier signed discrepancy",
          },
        };
        return send({ items: [older[body.history]], next_cursor: null });
      }
      if (body.action === "admin-payment-recheck") {
        assert.equal(body.id, paymentId);
        assert.equal(Object.hasOwn(body, "status"), false);
        return send({
          id: paymentId,
          status: "unknown",
          outcome: body.provider_reference
            ? "provider_support_required"
            : "unknown",
          message: body.provider_reference
            ? "PocketFi support must confirm which original request owns this reference. No funds moved."
            : "The provider has not confirmed a matching outcome. Funds remain held.",
        });
      }
      if (body.action === "admin-assignment-close") {
        assert.equal(body.id, taskId);
        assert.equal(body.confirmation, "CLOSE WITHOUT PAYMENT");
        assert.ok(body.reason.trim().length >= 10);
        if (failClose) {
          failClose = false;
          return send(
            { error: "Decision was not saved. Review and retry." },
            503,
          );
        }
        task.assignment.status = "cancelled";
        task.allowed_actions.close_without_payment = false;
        task.closure = {
          id: taskId,
          reason: body.reason,
          created_at: now(),
          actor_id: uid,
          amount_kobo: 18000,
          release_destination: "campaign",
        };
        return send({ id: taskId });
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
        task.allowed_actions.retry = false;
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
  context = await contextFor("aal2");
  page = await context.newPage();
  page.on("pageerror", (error) => results.pageErrors.push(error.message));
  const routes = [
    "/admin/payments/" + paymentId,
    "/admin/tasks/" + taskId,
    "/admin/campaigns/" + task.campaign.id,
  ];
  for (const width of [360, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: width >= 1000 ? 1000 : 844 });
    for (const route of routes) {
      await page.goto(base + route);
      await page.locator(".admin-dossier").waitFor();
      assert.equal(
        await page.evaluate(() =>
          document.documentElement.scrollWidth > innerWidth + 1
        ),
        false,
        route + " overflows at " + width,
      );
      assert.equal(
        await page.getByRole("heading", {
          name: "Let’s get you back.",
          exact: true,
        }).count(),
        0,
      );
      assert.equal(
        await page.getByRole("button", {
          name: /force credit|mark paid|refund|resend transfer/i,
        }).count(),
        0,
      );
      results.layouts.push({ width, route });
      if ([390, 1440].includes(width)) {
        await page.screenshot({
          path: path(
            (route.includes("payments")
              ? "payment"
              : route.includes("campaigns")
              ? "campaign"
              : "task") +
              "-" + width +
              ".png",
          ),
          fullPage: true,
        });
      }
    }
    pass(width + "px: investigation screens fit with no unsafe money controls");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const resource of ["cases", "checks", "payments", "audit"]) {
    await page.goto(base + "/admin/" + resource);
    await page.locator(".admin-queue-row").first().waitFor();
    assert.equal(await page.locator(".admin-queue-row").count(), 2);
    await page.getByRole("button", {
      name: "Load more " + resource,
      exact: true,
    }).click();
    await page.getByText("You’ve reached the end of this list.", {
      exact: false,
    }).waitFor();
    assert.equal(await page.locator(".admin-queue-row").count(), 3);
  }
  pass(
    "All four admin queues page beyond the first response without a snapshot cap",
  );
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width > 1000 ? 1000 : 844 });
    for (const item of overview.cases) {
      await page.goto(
        base + "/admin/cases?query=" + encodeURIComponent(item.subject),
      );
      await page.locator(".admin-queue-row").getByRole("button", {
        name: "Review",
        exact: false,
      }).click();
      const target = item.related_record;
      const link = page.getByRole("dialog").getByRole("link", {
        name: "Open linked " + target.resource,
        exact: false,
      });
      const destination = "/admin/" +
        ({
          task: "tasks",
          payment: "payments",
          campaign: "campaigns",
        }[target.resource]) + "/" + target.id;
      assert.equal(await link.getAttribute("href"), destination);
      await link.click();
      await page.waitForURL(base + destination);
      await page.locator(".admin-dossier").waitFor();
      assert.equal(
        await page.getByRole("heading", {
          name: "Let’s get you back.",
          exact: true,
        }).count(),
        0,
      );
    }
  }
  pass(
    "Task, payment and campaign cases open their server-resolved admin record on mobile and desktop",
  );
  const resolved = overview.cases[0].related_record;
  overview.cases[0].related_record = null;
  overview.cases[0].reference_resolution = "unavailable";
  await page.goto(
    base + "/admin/cases?query=" +
      encodeURIComponent(overview.cases[0].subject),
  );
  await page.locator(".admin-queue-row").getByRole("button", {
    name: "Review",
    exact: false,
  }).click();
  await page.getByRole("dialog").getByText(
    "No matching record is available for this customer.",
    { exact: false },
  ).waitFor();
  assert.equal(
    await page.getByRole("dialog").getByRole("link", { name: /Open linked/ })
      .count(),
    0,
  );
  overview.cases[0].related_record = resolved;
  overview.cases[0].reference_resolution = "resolved";
  pass("Unresolved references never guess a payment destination");
  await page.setViewportSize({ width: 390, height: 844 });
  for (
    const [resource, recordId, kinds] of [
      ["payment", paymentId, ["events", "jobs", "cases", "audit"]],
      ["task", taskId, ["evidence", "jobs", "cases", "audit"]],
      ["campaign", task.campaign.id, ["cases", "audit"]],
    ]
  ) {
    const route = "/admin/" +
      ({
        payment: "payments",
        task: "tasks",
        campaign: "campaigns",
      }[resource]) + "/" + recordId;
    await page.goto(base + route);
    await page.locator(".admin-dossier").waitFor();
    for (const kind of kinds) {
      const label = {
        events: "provider discrepancies",
        jobs: "checks",
        cases: "linked cases",
        audit: "activity",
        evidence: "evidence",
      }[kind];
      const button = page.getByRole("button", {
        name: "Load older " + label,
        exact: true,
      });
      await button.click();
      if (kind === "evidence") {
        await page.getByRole("alert").filter({
          hasText: "Older evidence could not be loaded",
        }).waitFor();
        await page.getByText(
          "The final page of comments could not be checked.",
          { exact: true },
        ).waitFor();
        await button.click();
        pass(
          "A failed evidence page preserves the current evidence and supports retry",
        );
      }
      await button.waitFor({ state: "hidden" });
      await page.getByText(
        {
          events: "Earlier signed discrepancy",
          jobs: "Older check reviewed",
          cases: "Earlier linked support request",
          audit: "earlier admin review",
          evidence: "Earlier account-scoped evidence",
        }[kind],
        { exact: true },
      ).waitFor();
    }
  }
  pass(
    "Every supported detail history loads older records without replacing current evidence or adding money actions",
  );
  await page.goto(base + "/admin/cases");
  await page.locator(".admin-queue-row").first().waitFor();
  await page.getByRole("searchbox", { name: "Search case subjects" }).fill(
    "Archive",
  );
  assert.equal(
    await page.getByRole("heading", {
      name: "Please check my task",
      exact: true,
    }).count(),
    0,
  );
  await page.getByRole("heading", { name: "Archive campaign question" })
    .waitFor();
  assert.equal(await page.locator(".admin-queue-row").count(), 1);
  pass(
    "Search hides old results immediately and retrieves records beyond the first page",
  );
  await page.goto(base + "/admin/payments");
  await page.getByLabel("Filter payments").selectOption("collection");
  await page.getByText("RR-PAYOUT-TEST-2", { exact: true }).waitFor();
  assert.equal(await page.locator(".admin-queue-row").count(), 1);
  pass("Payment filtering is server-backed and keeps direction distinct");
  await page.goto(base + "/admin/payments/" + paymentId);
  await page.locator(".admin-dossier").waitFor();
  await page.getByText("Test Bank · •••• 4321").waitFor();
  await page.getByText("Account under review · money actions restricted")
    .waitFor();
  await page.getByText("Provider amount did not match the original request.")
    .waitFor();
  await page.getByText("This record shows recent history first.", {
    exact: false,
  })
    .waitFor();
  assert.doesNotMatch(
    await page.locator("body").innerText(),
    /service_role|api_key|0123454321/,
  );
  pass(
    "Payment detail shows masked bank data, persisted discrepancy, review hold and explicit history bounds",
  );
  await page.getByRole("button", { name: "Recheck provider", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Check provider status" }).click();
  await dialog.getByText(
    "The provider has not confirmed a matching outcome. Funds remain held.",
  ).waitFor();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByText("Account under review · money actions restricted")
    .waitFor();
  pass(
    "Unknown provider result remains unknown and does not lift the account hold",
  );
  await page.getByRole("button", {
    name: "Check a recovered reference",
    exact: false,
  }).click();
  await dialog.getByLabel("Recovered provider reference").fill(
    "PFI-RECOVERED-FIXTURE",
  );
  await dialog.getByRole("button", { name: "Check reference", exact: true })
    .click();
  await dialog.getByText(
    "PocketFi support must confirm which original request owns this reference. No funds moved.",
  ).waitFor();
  await dialog.getByText("provider support required", { exact: true })
    .waitFor();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  assert.equal(payment.payment.status, "unknown");
  pass(
    "Recovered reference displays provider-support outcome, never paid or refunded",
  );
  await page.goto(base + "/admin/tasks/" + taskId);
  await page.getByRole("heading", { name: "Verification evidence" }).waitFor();
  await page.getByText("111111111111111111", { exact: true }).first().waitFor();
  await page.getByRole("link", { name: "@amaka_test", exact: false }).waitFor();
  await page.getByText("Actor ID matches the account bound to this task.", {
    exact: true,
  }).waitFor();
  await page.getByText("rr-fixture-1", { exact: true }).waitFor();
  pass(
    "Task investigation shows frozen terms and stable-identity verification evidence",
  );
  await page.getByRole("button", { name: "Retry attention check", exact: true })
    .click();
  await page.getByText("Check returned to the queue. No payment was approved.")
    .waitFor();
  assert.equal(
    await page.getByRole("button", {
      name: "Retry attention check",
      exact: true,
    }).isDisabled(),
    true,
  );
  pass(
    "Attention retry queues only a check and disables once no attention item remains",
  );
  await page.getByRole("button", {
    name: "Close without payment",
    exact: false,
  }).click();
  await dialog.waitFor();
  assert.equal(
    await dialog.getByRole("button", { name: "Confirm non-paying closure" })
      .isDisabled(),
    true,
  );
  await dialog.getByLabel("Reason for closing").fill(
    "We reviewed the account and the final check did not establish valid work.",
  );
  await dialog.getByRole("checkbox").check();
  await dialog.getByLabel("Type CLOSE WITHOUT PAYMENT").fill(
    "close without payment",
  );
  assert.equal(
    await dialog.getByRole("button", { name: "Confirm non-paying closure" })
      .isDisabled(),
    true,
  );
  assert.equal(
    results.commands.filter((command) =>
      command.action === "admin-assignment-close"
    ).length,
    0,
  );
  pass(
    "Non-paying closure requires a reason, evidence review and the exact confirmation phrase",
  );
  await dialog.getByLabel("Type CLOSE WITHOUT PAYMENT").fill(
    "CLOSE WITHOUT PAYMENT",
  );
  await dialog.getByRole("button", { name: "Confirm non-paying closure" })
    .click();
  await dialog.getByRole("alert").filter({ hasText: "Decision was not saved" })
    .waitFor();
  assert.match(
    await dialog.getByLabel("Reason for closing").inputValue(),
    /final check/,
  );
  pass("A failed closure preserves the review and reason for retry");
  await dialog.getByRole("button", { name: "Confirm non-paying closure" })
    .click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByText("Closed without payment.", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", {
      name: "Close without payment",
      exact: false,
    }).isDisabled(),
    true,
  );
  assert.equal(task.assignment.status, "cancelled");
  pass(
    "Confirmed closure displays the server-recorded reason and prevents a second close",
  );
  assert.deepEqual(results.pageErrors, []);
  pass("No uncaught errors throughout the investigation flow");
} catch (error) {
  results.failure = { name: error.name, message: error.message };
  console.error(error);
  process.exitCode = 1;
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
