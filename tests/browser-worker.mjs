// Isolated browser contract tests. Never runs against a published site or real provider.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require("playwright");
} catch {
  playwright = require(
    "C:/Users/dell/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  );
}
const base = process.env.REALREACH_UI_TEST_URL || "http://localhost:5174";
assert.equal(
  new URL(base).hostname,
  "localhost",
  "UI fixtures are restricted to localhost.",
);
const out = new URL("../outputs/qa/worker-flow/", import.meta.url);
await mkdir(out, { recursive: true });
const now = () => new Date().toISOString();
const uid = "00000000-0000-4000-8000-000000000101",
  cid = "00000000-0000-4000-8000-000000000102",
  aid = "00000000-0000-4000-8000-000000000103";
const user = {
  id: uid,
  email: "worker@ui-test.invalid",
  aud: "authenticated",
  role: "authenticated",
  created_at: now(),
  email_confirmed_at: now(),
  user_metadata: {},
  app_metadata: { provider: "email", providers: ["email"] },
};
const part = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
const session = {
  access_token: `${part({ alg: "HS256", typ: "JWT" })}.${
    part({
      sub: uid,
      aud: "authenticated",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  }.isolated-fixture`,
  refresh_token: "isolated-fixture",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  token_type: "bearer",
  user,
};
const campaign = {
  id: cid,
  business_id: "00000000-0000-4000-8000-000000000104",
  business_name: "Everyday Objects",
  title: "A new take on everyday things",
  action: "comment",
  status: "live",
  target_url: "https://www.instagram.com/p/TESTONLY/",
  target_username: "everydayobjects",
  target_id: "1234567",
  instructions:
    "Tell us which piece you would choose and why. Use your own words.",
  quantity: 100,
  unit_reward_kobo: 15000,
  unit_fee_kobo: 3000,
  reserved_kobo: 1800000,
  spent_kobo: 0,
  delivered_count: 0,
  active_count: 1,
  pending_count: 0,
  created_at: now(),
  updated_at: now(),
  ends_at: null,
  retention_hours: 48,
};
const assignment = () => ({
  id: aid,
  campaign_id: cid,
  campaign_title: campaign.title,
  business_name: campaign.business_name,
  action: "comment",
  target_url: campaign.target_url,
  target_username: campaign.target_username,
  instructions: campaign.instructions,
  status: "reserved",
  reason: null,
  reward_kobo: 15000,
  created_at: now(),
  expires_at: new Date(Date.now() + 900000).toISOString(),
  submitted_at: null,
  hold_until: null,
  settled_at: null,
  next_check_at: null,
  comment_text: null,
  evidence_id: null,
});
const workspace = {
  business: null,
  instagram: {
    id: "00000000-0000-4000-8000-000000000105",
    username: "ada_ui",
    instagram_id: "123456",
    status: "verified",
    profile_url: "https://www.instagram.com/ada_ui/",
    avatar_url: null,
    verified_at: now(),
    challenge: null,
    challenge_expires_at: null,
  },
  campaigns: [],
  feed: [campaign],
  assignments: [assignment()],
  wallet: {
    currency: "NGN",
    available_kobo: 150000,
    pending_kobo: 15000,
    reserved_kobo: 0,
    withdrawing_kobo: 0,
    earned_kobo: 165000,
    spent_kobo: 0,
  },
  transactions: [{
    id: "tx-one",
    kind: "reward",
    label: "Task reward",
    amount_kobo: 15000,
    status: "settled",
    created_at: now(),
    reference: aid,
  }],
  beneficiaries: [],
  payments: [],
  cases: [],
  notifications: [{
    id: "00000000-0000-4000-8000-000000000106",
    title: "Your account is ready",
    body: "You can now explore tasks.",
    href: "/earn",
    read_at: null,
    created_at: now(),
  }],
  pricing: {
    approved: true,
    follow_reward_kobo: 10000,
    follow_fee_kobo: 2000,
    comment_reward_kobo: 15000,
    comment_fee_kobo: 3000,
    retention_hours: 48,
    claim_minutes: 15,
    minimum_withdrawal_kobo: 100000,
    withdrawal_fee_kobo: 10000,
    max_campaign_quantity: 10000,
    terms_version: "isolated-fixture",
  },
  capabilities: {
    instagram: true,
    payments: false,
    payouts: true,
    pricing: true,
    payouts_paused: false,
  },
};
const result = {
  mode: "isolated browser HTTP fixtures, not live backend acceptance",
  checks: [],
  layouts: [],
  pageErrors: [],
  commands: [],
};
const pass = (message) => {
  result.checks.push(message);
  console.log("PASS " + message);
};
let failNextCheck = false;
const browser = await playwright.chromium.launch({
  channel: "chrome",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
await context.addInitScript(
  (value) => localStorage.setItem("realreach-auth-v1", JSON.stringify(value)),
  session,
);
await context.route("**/*", async (route) => {
  const req = route.request(), url = new URL(req.url());
  if (url.origin === base) return route.continue();
  if (url.hostname !== "jabwuawiqsusjrccapab.supabase.co") return route.abort();
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
  if (url.pathname === "/auth/v1/token") return send(session);
  if (url.pathname === "/auth/v1/logout") return send({});
  if (url.pathname === "/rest/v1/profiles") {
    return send({
      id: uid,
      display_name: "Ada Test",
      city: "Lagos",
      preferred_front: "worker",
      account_type: "worker",
    });
  }
  if (url.pathname === "/rest/v1/sole_admin") return send([]);
  if (url.pathname === "/auth/v1/factors") {
    return send({ all: [], totp: [], phone: [] });
  }
  if (url.pathname === "/functions/v1/realreach-marketplace") {
    const input = req.postDataJSON();
    result.commands.push(input.action);
    if (input.action === "workspace") return send(workspace);
    if (input.action === "list") {
      let items = structuredClone(workspace[input.resource] || []);
      if (input.resource === "feed") {
        items = items.filter((c) =>
          (!input.filter || input.filter === "all" ||
            c.action === input.filter) &&
          (!input.query ||
            `${c.title} ${c.business_name}`.toLowerCase().includes(
              input.query.toLowerCase(),
            ))
        );
      }
      if (input.resource === "assignments") {
        items = items.filter((a) =>
          input.filter === "all" ||
          (input.filter === "completed"
            ? a.status === "settled"
            : ["reserved", "checking", "pending", "needs_review"].includes(
              a.status,
            ))
        );
      }
      if (input.resource === "transactions" && input.filter !== "all") {
        items = items.filter((t) => t.kind === input.filter);
      }
      return send({ items, next_cursor: null });
    }
    if (input.action === "task-detail") {
      return send({
        campaign,
        assignment: workspace.assignments.find((a) =>
          input.id === a.id || input.id === a.campaign_id
        ) || null,
        eligible: workspace.instagram.status === "verified",
        reason: null,
      });
    }
    if (input.action === "task-claim") {
      assert.ok(input.idempotency_key);
      assert.equal(input.id, cid);
      workspace.assignments = [{ ...assignment(), status: "checking" }];
      return send({ id: aid });
    }
    if (input.action === "task-check") {
      if (failNextCheck) {
        failNextCheck = false;
        return send(
          { error: "Connection interrupted. Please try again." },
          503,
        );
      }
      assert.ok(input.comment_text.length > 5);
      Object.assign(workspace.assignments[0], {
        status: "checking",
        submitted_at: now(),
        comment_text: input.comment_text,
      });
      return send({ id: aid });
    }
    if (input.action === "task-cancel") {
      workspace.assignments[0].status = "cancelled";
      return send({ id: aid });
    }
    if (input.action === "instagram-start") {
      Object.assign(workspace.instagram, {
        status: "pending",
        username: input.username,
        challenge: "RR-UI-ONLY-123",
        challenge_expires_at: new Date(Date.now() + 900000).toISOString(),
      });
      return send({ id: workspace.instagram.id });
    }
    if (input.action === "instagram-verify") {
      if (!workspace.capabilities.instagram) {
        return send({
          error: "Instagram checks are unavailable. Please try again later.",
        }, 503);
      }
      Object.assign(workspace.instagram, {
        status: "verified",
        challenge: null,
        verified_at: now(),
      });
      return send({ id: workspace.instagram.id });
    }
    if (input.action === "instagram-disconnect") {
      workspace.instagram.status = "disconnected";
      return send({ id: workspace.instagram.id });
    }
    if (input.action === "banks") {
      return send({ banks: [{ code: "001", name: "Test Bank" }] });
    }
    if (input.action === "bank-verify") {
      assert.equal(input.account_number, "0123456789");
      workspace.beneficiaries.push({
        id: "bank-one",
        bank_code: "001",
        bank_name: "Test Bank",
        account_name: "ADA TEST",
        account_last4: "6789",
        status: "verified",
      });
      return send({ id: "bank-one" });
    }
    if (input.action === "withdraw") {
      assert.equal(input.amount_kobo, 100000);
      assert.equal(input.beneficiary_id, "bank-one");
      assert.ok(input.idempotency_key);
      workspace.wallet.available_kobo -= 110000;
      workspace.wallet.withdrawing_kobo += 100000;
      return send({ id: "payout-fixture", status: "pending" });
    }
    if (input.action === "case-create") {
      const item = {
        ...input,
        id: "00000000-0000-4000-8000-000000000107",
        status: "open",
        resolution: null,
        created_at: now(),
      };
      workspace.cases.unshift(item);
      return send({ id: item.id });
    }
    if (input.action === "notification-read") {
      workspace.notifications.find((n) => n.id === input.id).read_at = now();
      return send({ id: input.id });
    }
    return send({ error: "Unexpected test action " + input.action }, 400);
  }
  return send({ error: "Unexpected intercepted request" }, 400);
});
const page = await context.newPage();
page.on("pageerror", (e) => result.pageErrors.push(e.message));
try {
  const routes = [
    "/earn",
    "/earn/my-tasks",
    `/earn/assignments/${aid}`,
    "/earn/wallet",
    "/earn/instagram",
    "/support",
    "/notifications",
  ];
  for (const width of [360, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: width >= 1000 ? 1000 : 844 });
    for (const route of routes) {
      await page.goto(base + route);
      await page.getByRole("heading", { level: 1 }).first().waitFor();
      await page.locator(".studio-skeleton").waitFor({ state: "hidden" });
      assert.equal(
        await page.getByRole("heading", { name: "Let’s get you back." })
          .count(),
        0,
        `${route} hit the error boundary`,
      );
      assert.equal(
        await page.evaluate(() =>
          document.documentElement.scrollWidth > innerWidth + 1
        ),
        false,
        `${route} overflows at ${width}`,
      );
      result.layouts.push({ width, route, overflow: false });
      if (route === "/earn") {
        await page.locator(".studio-task-card").first().waitFor();
        const position = await page.evaluate(() => ({
          resume:
            document.querySelector(".worker-resume").getBoundingClientRect()
              .bottom,
          task:
            document.querySelector(".studio-task-card").getBoundingClientRect()
              .top,
          viewport: innerHeight,
        }));
        assert.ok(
          position.resume < position.task,
          "Resumable work must appear before new tasks.",
        );
        assert.ok(
          position.task < position.viewport - 72,
          "At least the first task must be visible without scrolling.",
        );
        assert.equal(
          await page.locator(".studio-worker-hero").count(),
          0,
          "Do not displace work with a promotional hero.",
        );
        assert.equal(await page.locator('.worker-resume strong').evaluate(element=>getComputedStyle(element).color),'rgb(255, 254, 251)','Resume title must remain readable on its dark background.');
      }
      if (
        [390, 1440].includes(width) &&
        ["/earn", "/earn/wallet", `/earn/assignments/${aid}`].includes(route)
      ) {
        await page.screenshot({
          path: new URL(
            `${route.replaceAll("/", "-").slice(1)}-${width}.png`,
            out,
          ).pathname.replace(/^\/([A-Z]:)/, "$1"),
          fullPage: true,
        });
      }
    }
    pass(`${width}px: seven worker/account routes fit`);
  }
  assert.equal(await page.getByLabel("Switch workspace").count(), 0);
  pass("ordinary worker has no admin/workspace switch");
  pass(
    "At every tested width, resumable work precedes the feed and the first task is visible without scrolling",
  );
  workspace.assignments = [{
    ...assignment(),
    id: "checking-first",
    status: "checking",
  }, assignment()];
  await page.goto(base + "/earn");
  await page.locator(".worker-resume").waitFor();
  assert.equal(
    await page.locator(".worker-resume").getAttribute("href"),
    "/earn/assignments/" + aid,
  );
  pass("Discover prioritizes work ready to finish over checks already running");
  workspace.assignments = [{ ...assignment(), status: "pending" }];
  await page.reload();
  await page.locator(".worker-resume").getByText("Track your task", {
    exact: true,
  }).waitFor();
  pass("Pending work remains accessible with an accurate tracking action");
  workspace.assignments = [assignment()];
  await page.goto(base + "/business");
  await page.waitForURL(base + "/earn");
  await page.goto(base + "/admin");
  await page.waitForURL(base + "/earn");
  pass("worker front guards redirect business and admin routes");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/earn");
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await page.getByRole("heading", { name: "Nothing matches just yet." })
    .waitFor();
  await page.getByRole("button", { name: "Show all tasks" }).click();
  await page.locator(".studio-task-card").waitFor();
  pass("server task filters recover to all tasks");
  workspace.assignments = [];
  await page.locator(".studio-task-card").click();
  await page.getByRole("button", { name: "Accept task", exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Accept task", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Accept task", exact: true }).click();
  await page.waitForURL(base + `/earn/assignments/${aid}`);
  await page.getByRole("heading", { name: "Checking your eligibility." })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Check my work" }).count(),
    0,
  );
  pass("acceptance requires consent and waits for eligibility before work");
  workspace.assignments[0].status = "reserved";
  await page.getByRole("button", { name: "Refresh status" }).click();
  await page.getByRole("button", { name: "Check my work" }).waitFor();
  await page.getByLabel("Your comment", { exact: false }).fill(
    "I would choose the woven basket for my living room.",
  );
  failNextCheck = true;
  await page.getByRole("button", { name: "Check my work" }).click();
  await page.getByRole("alert").filter({ hasText: "Connection interrupted" })
    .waitFor();
  assert.match(
    await page.getByLabel("Your comment", { exact: false }).inputValue(),
    /woven basket/,
  );
  pass("failed check retains the comment and offers retry");
  await page.getByRole("button", { name: "Check my work" }).click();
  await page.getByRole("heading", { name: "We’re checking your work." })
    .waitFor();
  await page.reload();
  await page.getByRole("heading", { name: "We’re checking your work." })
    .waitFor();
  pass("submitted work survives reload");
  Object.assign(workspace.assignments[0], {
    status: "pending",
    hold_until: new Date(Date.now() + 48 * 3600000).toISOString(),
  });
  await page.getByRole("button", { name: "Refresh status" }).click();
  await page.getByRole("heading", { name: "Nice work. Action detected." })
    .waitFor();
  pass("detected action shows pending final check, not paid");
  Object.assign(workspace.assignments[0], {
    status: "settled",
    settled_at: now(),
  });
  await page.getByRole("button", { name: "Refresh status" }).click();
  await page.getByRole("heading", { name: "That’s a job well done." })
    .waitFor();
  await page.getByRole("link", { name: "Open your wallet" }).click();
  pass("settled receipt links to wallet");
  await page.getByRole("button", { name: "Add a bank account" }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByLabel("Bank", { exact: true }).selectOption("001");
  await page.getByLabel("Account number", { exact: false }).fill("0123456789");
  await page.getByRole("button", { name: "Verify bank account" }).click();
  await page.getByText("Your bank account is verified.").waitFor();
  pass("bank resolution saves a masked verified beneficiary");
  await page.getByRole("button", { name: "Withdraw earnings" }).click();
  await page.getByLabel("Amount", { exact: true }).fill("1000");
  await page.getByRole("button", { name: "Request withdrawal" }).click();
  await page.getByText(
    "Your withdrawal was requested. Follow its status below.",
  ).waitFor();
  pass("withdrawal uses amount, verified beneficiary and stable request key");
  await page.goto(base + "/support?reference=" + aid);
  await page.getByLabel("What’s this about?").selectOption("Task verification");
  await page.getByLabel("A few details", { exact: false }).fill(
    "Please check the timing recorded on my task receipt.",
  );
  await page.getByRole("button", { name: "Send request" }).click();
  await page.getByText(/Your request is saved/).waitFor();
  assert.equal(workspace.cases[0].reference, aid);
  await page.reload();
  await page.locator(".studio-case").waitFor();
  pass("support request keeps assignment reference and survives reload");
  await page.goto(base + "/notifications");
  await page.getByRole("button", { name: "Mark as read" }).click();
  await page.getByRole("button", { name: "Mark as read" }).waitFor({
    state: "hidden",
  });
  pass("notification read status persists");
  workspace.instagram.status = "disconnected";
  workspace.capabilities.instagram = false;
  await page.goto(base + "/earn/instagram");
  await page.getByLabel("Username", { exact: false }).fill("ada_ui");
  await page.getByRole("button", { name: "Get verification code" }).click();
  await page.getByText("RR-UI-ONLY-123", { exact: true }).waitFor();
  await page.getByRole("button", { name: "I’ve added the code" }).click();
  await page.getByRole("alert").filter({
    hasText: "Instagram checks are unavailable",
  }).waitFor();
  assert.equal(workspace.instagram.status, "pending");
  pass("missing provider cannot fake Instagram verification");
  assert.deepEqual(result.pageErrors, []);
  pass("no uncaught browser errors");
} catch (error) {
  result.failure = { name: error.name, message: error.message };
  console.error(error.message);
  process.exitCode = 1;
  await page.screenshot({
    path: new URL("failure.png", out).pathname.replace(/^\/([A-Z]:)/, "$1"),
    fullPage: true,
  }).catch(() => {});
} finally {
  await writeFile(
    new URL("results.json", out),
    JSON.stringify(result, null, 2),
  );
  await context.close();
  await browser.close();
  console.log(
    JSON.stringify({
      checks: result.checks.length,
      layouts: result.layouts.length,
      failure: result.failure || null,
    }),
  );
}
