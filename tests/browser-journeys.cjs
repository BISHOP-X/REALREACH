// Run with an installed Playwright package, or REALREACH_PLAYWRIGHT_PATH pointing
// to the host's bundled package. REALREACH_BROWSER_CDP may reuse a QA browser.
const { chromium } = require(
  process.env.REALREACH_PLAYWRIGHT_PATH || "playwright",
);
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

(async () => {
  const browser = process.env.REALREACH_BROWSER_CDP
    ? await chromium.connectOverCDP(process.env.REALREACH_BROWSER_CDP)
    : await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const base = process.env.REALREACH_TEST_URL || "http://localhost:5173";
  const out = path.resolve("outputs/qa");
  fs.mkdirSync(out, { recursive: true });
  const passed = [];
  const record = (name) => {
    passed.push(name);
    console.log(`PASS ${name}`);
  };
  const snap = async (name) => {
    await page.screenshot({
      path: path.join(out, `${name}.png`),
      fullPage: true,
    });
  };
  const button = (name) => page.getByRole("button", { name, exact: true });
  const state = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("realreach-instagram-preview-v1")),
    );
  try {
    await page.goto(`${base}/login`);
    await button("I'm a business").click();
    await button("Explore the business demo without a form").click();
    await page.waitForURL("**/business");
    await snap("mobile-business-overview");
    record("Business demo entry and mobile overview");
    await page.getByRole("link", { name: "New campaign", exact: true }).click();
    await page
      .getByLabel("Campaign name", { exact: false })
      .fill("September launch · QA");
    await button("Continue").click();
    await button("Continue").click();
    await page.getByRole("spinbutton", { name: "Number of actions" }).fill("2");
    await snap("mobile-campaign-budget");
    await button("Continue").click();
    await page.getByRole("checkbox").check();
    await button("Publish demo campaign").click();
    await page.waitForURL(/\/business\/campaigns\/campaign-[^/]+\?created=1$/);
    const campaignId = new URL(page.url()).pathname.split("/").pop();
    const created = await state();
    assert.equal(
      created.campaigns.find((c) => c.id === campaignId).status,
      "live",
    );
    assert.equal(created.businessBalance, 4318000);
    await snap("mobile-campaign-live");
    record("Four-step builder publishes a funded campaign");
    await page
      .getByRole("link", { name: "Preview the worker journey", exact: false })
      .click();
    await button("Accept task").click();
    await page.waitForURL("**/earn/assignments/*");
    const assignmentUrl = page.url();
    await button("Simulate verification message").click();
    await button("Open task preview").click();
    await button("Follow in demo").click();
    await button("Return to my task").click();
    await button("Check my task").click();
    await page
      .getByText("A short hold. Then it's yours.", { exact: true })
      .waitFor();
    assert.equal((await state()).workerBalance, 180000);
    await snap("mobile-assignment-pending");
    await page.reload();
    await page
      .getByText("A short hold. Then it's yours.", { exact: true })
      .waitFor();
    record("Worker claim, identity, action, pending reward and refresh resume");
    await page.locator(".j-demo-lab summary").click();
    await button("Advance demo 48 hours").click();
    await button("Pass final check").click();
    await page.getByRole("heading", { name: "Your task receipt" }).waitFor();
    assert.equal((await state()).workerBalance, 188000);
    await snap("mobile-task-completed");
    record("Retention check releases exactly one reward");
    await page.goto(`${base}/business/campaigns/${campaignId}`);
    assert.equal((await state()).assignments[0].status, "settled");
    await button("Pause campaign").click();
    await button("Resume campaign").click();
    await button("Close campaign").click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close campaign", exact: true })
      .click();
    const closed = await state();
    assert.equal(closed.businessBalance, 4329000);
    assert.equal(
      closed.campaigns.find((c) => c.id === campaignId).status,
      "cancelled",
    );
    record(
      "Business sees delivery, pause/resume works, closing refunds only unused place",
    );
    await page.goto(`${base}/earn/wallet`);
    await button("Add bank").click();
    await button("Save demo bank").click();
    await button("Withdraw").click();
    await page
      .getByRole("spinbutton", { name: "Withdrawal amount" })
      .fill("1000");
    await button("Request demo withdrawal").click();
    assert.equal((await state()).workerBalance, 88000);
    await page.locator(".j-demo-lab summary").click();
    await button("Simulate payout failure").click();
    assert.equal((await state()).workerBalance, 188000);
    await button("Withdraw").click();
    await button("Request demo withdrawal").click();
    await page.locator(".j-demo-lab summary").click();
    await button("Simulate payout success").click();
    assert.equal((await state()).workerBalance, 88000);
    assert.equal(
      (await state()).withdrawals.filter((w) => w.status === "paid").length,
      1,
    );
    await snap("mobile-wallet");
    record("Bank setup, failed withdrawal refund and successful withdrawal");
    await page.goto(`${base}/business/billing`);
    await button("Add demo funds").click();
    await page.getByRole("spinbutton", { name: "Top-up amount" }).fill("5000");
    const beforeDeposit = (await state()).businessBalance;
    await button("Test failed payment").click();
    assert.equal((await state()).businessBalance, beforeDeposit);
    await button("Simulate successful top-up").click();
    assert.equal((await state()).businessBalance, beforeDeposit + 500000);
    record(
      "Failed top-up does not credit; successful demo confirmation credits once",
    );
    await page.goto(`${base}/earn/tasks/terra-comment`);
    await button("Accept task").click();
    await button("Simulate verification message").click();
    await button("Open task preview").click();
    await page
      .getByLabel("Your demo comment", { exact: true })
      .fill("I like the considered details and the everyday colour palette.");
    await button("Add demo comment").click();
    await page.locator(".j-demo-lab summary").click();
    await page
      .getByLabel("Next verification response")
      .selectOption("unavailable");
    await button("Check my task").click();
    await page
      .getByText(
        "Instagram verification is temporarily unavailable. Your place is protected; retry when ready.",
        { exact: true },
      )
      .waitFor();
    await page.reload();
    await page.locator(".j-demo-lab summary").click();
    await page.getByLabel("Next verification response").selectOption("success");
    await button("Check my task").click();
    await page
      .getByText("A short hold. Then it's yours.", { exact: true })
      .waitFor();
    await button("Advance demo 48 hours").click();
    await button("Simulate missing action").click();
    await page.getByRole("link", { name: "View demo review" }).click();
    await page.locator(".j-assignment-row").first().click();
    await button("Resolve & release demo reward").click();
    assert.equal((await state()).workerBalance, 103000);
    record(
      "Comment preview, provider outage/retry, missing evidence and admin resolution",
    );
    await page.goto(`${base}/earn/profile`);
    await page.getByLabel("Your name", { exact: true }).fill("Alex QA");
    await button("Save profile").click();
    await page.reload();
    assert.equal(
      await page.getByLabel("Your name", { exact: true }).inputValue(),
      "Alex QA",
    );
    await button("Sign out of preview").click();
    await page.waitForURL("**/login");
    assert.equal((await state()).session, false);
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await page.getByLabel("Email address").fill("demo@example.com");
    await button("Preview recovery email").click();
    await page
      .getByRole("link", { name: "Preview reset screen", exact: false })
      .click();
    await page
      .getByLabel("New password", { exact: true })
      .fill("sample-only-123");
    await button("Preview password reset").click();
    await page
      .getByRole("heading", { name: "Password reset previewed." })
      .waitFor();
    record("Profile persistence, sign-out and recovery screens");

    await page.goto(`${base}/signup`);
    await page.getByLabel("Your name", { exact: true }).fill("Alex QA");
    await page.getByLabel("Email address").fill("alex-qa@example.com");
    await page.getByLabel("Password", { exact: true }).fill("sample-only-123");
    await page.getByRole("checkbox").check();
    await button("Create demo account").click();
    await button("Simulate verified email").click();
    await page.waitForURL("**/earn");
    await button("Save Studio Orange task").click();
    await button("Saved (1)").click();
    assert.equal(await page.locator(".j-task-card").count(), 1);
    await page
      .getByRole("textbox", { name: "Search tasks" })
      .fill("no-such-brand");
    await page
      .getByRole("heading", { name: "Keep something for later" })
      .waitFor();
    await button("Show all tasks").click();
    record(
      "Signup/email preview, saved tasks, filtering and empty-search recovery",
    );

    await page.goto(`${base}/business/campaigns/new`);
    await page
      .getByLabel("Campaign name", { exact: false })
      .fill("Saved comment draft");
    await button("Continue").click();
    await page
      .getByRole("button", { name: "Thoughtful comments", exact: false })
      .click();
    await button("Save draft").click();
    await page.reload();
    await page
      .getByRole("link", { name: "Continue draft", exact: false })
      .click();
    assert.equal(
      await page.getByLabel("Campaign name", { exact: false }).inputValue(),
      "Saved comment draft",
    );
    await button("Continue").click();
    assert.equal(
      await page
        .getByRole("button", { name: "Thoughtful comments", exact: false })
        .getAttribute("aria-pressed"),
      "true",
    );
    record(
      "Draft campaign and selected comment action survive refresh and resume",
    );

    await page.goto(`${base}/business/settings`);
    await button("Disconnect demo").click();
    await button("Disconnect").click();
    assert.equal((await state()).connected, false);
    await button("Reconnect").click();
    await page.getByRole("dialog").getByRole("checkbox").check();
    await button("Connect demo account").click();
    assert.equal((await state()).connected, true);
    await page.goto(`${base}/business/billing`);
    await button("Add demo funds").click();
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.ok(
      (await page.evaluate(() => document.activeElement.textContent)).includes(
        "Add demo funds",
      ),
    );
    record(
      "Disconnect/reconnect and keyboard dialog dismissal/focus restoration",
    );

    const secondTab = await context.newPage();
    await secondTab.goto(`${base}/business/billing`);
    const preSyncBalance = (await state()).businessBalance;
    await button("Add demo funds").click();
    await page.getByRole("spinbutton", { name: "Top-up amount" }).fill("1000");
    await button("Simulate successful top-up").click();
    await secondTab.waitForFunction(
      (expected) => {
        const text = document.querySelector(
          ".j-finance-hero > div > strong",
        )?.textContent;
        return Number(text?.replace(/[^0-9]/g, "")) === expected;
      },
      (preSyncBalance + 100000) / 100,
    );
    await secondTab.close();
    record(
      "Shared demo state updates another open browser tab without refresh",
    );

    const routes = [
      "/earn",
      "/earn/my-tasks",
      "/earn/wallet",
      "/earn/profile",
      "/earn/tasks/studio-follow",
      new URL(assignmentUrl).pathname,
      "/business",
      "/business/campaigns",
      "/business/campaigns/new",
      `/business/campaigns/${campaignId}`,
      "/business/billing",
      "/business/settings",
      "/admin",
      "/admin/proofs",
      "/admin/payouts",
      "/help",
      "/login",
      "/signup",
      "/forgot-password",
      "/verify-email",
    ];
    const layouts = [];
    for (const viewport of [
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 768, height: 1024 },
      { width: 1440, height: 1000 },
    ]) {
      await page.setViewportSize(viewport);
      for (const route of routes) {
        await page.goto(base + route);
        await page.locator("h1").first().waitFor();
        const result = await page.evaluate(() => ({
          width: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          content: document.body.innerText.length,
          overlay: !!document.querySelector("vite-error-overlay"),
        }));
        assert.ok(
          result.scrollWidth <= result.width + 1,
          `${route} overflows ${viewport.width}px: ${result.scrollWidth}`,
        );
        assert.ok(
          result.content > 150 && !result.overlay,
          `Missing content on ${route}`,
        );
        layouts.push({ route, ...viewport, result: "pass" });
      }
    }
    record(
      `${layouts.length} route/viewport checks without horizontal overflow or runtime overlays`,
    );
    await page.goto(base + "/earn");
    await snap("desktop-discover");
    await page.goto(base + "/business");
    await snap("desktop-business-overview");
    await page.goto(base + "/business/campaigns/new");
    await snap("desktop-campaign-builder");
    await page.goto(base + "/login");
    await snap("desktop-login");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/login");
    await snap("mobile-login");
    await page.goto(base + "/earn");
    await snap("mobile-discover");
    assert.deepEqual(errors, [], "Browser errors must be empty");
    record("No browser console errors or uncaught runtime errors");
    fs.writeFileSync(
      path.join(out, "browser-results.json"),
      JSON.stringify({ passed, layouts, errors }, null, 2),
    );
    console.log(`Browser journey verified. Screenshots and results: ${out}`);
  } catch (error) {
    await snap("failure");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
