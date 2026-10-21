# RealReach

Instagram-first marketplace website built with React, TypeScript and Vite, hosted on Vercel.

## Current state

The production website uses real Supabase accounts. Worker/business account types are assigned once on the server. Only the pinned sole admin can switch fronts; admin operations additionally require an authenticator. There is no public simulator or open sample admin route.

Business onboarding creates an owned business record. Campaign drafts save to Supabase and are isolated by owner. The deployed baseline still lacks the paid marketplace. A new local implementation now connects the worker, business, wallet, support and admin screens to production-oriented marketplace commands, a financial ledger, verification jobs and RocketAPI/PocketFi adapters. It is not deployed or accepted with live providers yet. Operator recovery for uncertain payouts, payment reversals and permanently unresolved verification still needs work before accepting customer money.

Read [the implementation and acceptance status](docs/RealReach-Marketplace-Implementation-QA.md) before testing or deploying this checkout. RocketAPI replaces the earlier Zernio direction; old adapter code is historical and must not be confused with the new verification flow.

Read [the current release and QA notes](docs/RealReach-Production-Flow-QA.md). Older documents describe historical prototypes or future scope and must not be presented as current capabilities.

## Develop

```powershell
npm install
# Copy .env.example to .env.local and supply the public application configuration.
npm run dev
npm test
npm run build
```

Use the RealReach URL, publishable key and public Google client ID. Never place service-role, Google client-secret, Instagram or payment secrets in browser configuration.

Google uses its official Identity Services button and a nonce-protected Supabase ID-token exchange. Email confirmation/recovery uses /auth/callback. Custom SMTP is still needed for reliable public email signup.

## Routes

- /login, /signup, /verify-email, /forgot-password, /reset-password: real Auth.
- /start: resolves the signed-in account’s destination.
- /onboarding: one-time worker/business choice and details.
- /earn, /earn/my-tasks, /earn/instagram, /earn/wallet: discovery, saved work, account verification and earnings.
- /earn/tasks/:id, /earn/assignments/:id: task acceptance, eligibility checks, submission and the saved result.
- /business: business overview.
- /business/campaigns, /business/campaigns/new, /business/campaigns/:id/edit, /business/campaigns/:id: saved campaigns, four-step builder, funding approval, delivery and controls.
- /business/instagram: owned Instagram connection flow; unavailable without provider setup.
- /business/wallet: funds screen; no fabricated balances or deposits.
- /business/settings: business details.
- /account: profile and security.
- /support, /notifications: saved help requests and account updates.
- /admin: sole admin only; operations require MFA.
- /demo and all its former child routes: removed, show page not found.

## Verification

- npm test: account boundaries, Google nonce handling, provider contracts and historical simulator state invariants.
- npm run build: TypeScript and production bundle.
- node tests/browser-worker.mjs: localhost-only HTTP fixtures for the worker journey, wallet, support and responsive screens. Requires the local Vite server on port 5174 (or REALREACH_UI_TEST_URL).
- node tests/browser-admin.mjs: localhost-only admin/MFA/control fixtures and responsive checks.
- node tests/browser-admin-investigation.mjs: owner-resolved support references, payment/task/campaign detail, older history pagination and retry fixtures.
- node tests/browser-operations.mjs: admin health, stale/missing data, alert outcomes, read-only ledger check and in-flight signout at phone/desktop widths; localhost fixtures only.
- node tests/browser-business.mjs: campaign, pricing, publication and recovery UI fixtures.
- node tests/browser-auth.mjs: signup/resend/confirmation continuity and responsive auth fixtures, with no real emails.
- node tests/browser-wallet.mjs: exact payment amounts, retry/return/resume and unknown-outcome UI fixtures.
- node tests/browser-money-guards.mjs: fee consent, verified bank identity, changed-fee recovery, held spending and disabled-action explanations at phone/desktop widths, including a short viewport.
- node tests/browser-session-races.mjs: delayed account/list/mutation responses, account switches, signout and bounded profile loading; localhost-only fixtures.
- deno run --no-config --node-modules-dir=none --allow-read --allow-env --allow-sys tests/marketplace-database.mjs: isolated PostgreSQL/PGlite transaction, RLS and migration regression checks. It does not connect to Supabase or prove multi-connection concurrency.
- deno run --no-config --node-modules-dir=none --allow-read --allow-env --allow-sys tests/marketplace-operations-database.mjs: operations permissions, snapshots, immutable alert requests and actual SQL → runner → email adapter → SQL tests with injected transport; no real email.
- & ./scripts/test-marketplace-concurrency.ps1: genuine multi-connection transaction races on a new, isolated PostgreSQL 17 cluster. Requires an official portable PostgreSQL 17 binary directory (`-PostgresBin`); accepts no database URL, binds only to loopback and stops only its own marked cluster. No production credentials are used. Runtime/data/logs stay in ignored `work/realreach-postgres-test`.
- deno test --no-config --node-modules-dir=none --allow-env tests/marketplace-http.test.ts: offline HTTP/session/role and request-scoping checks; network permission is not granted.
- deno test --no-config --node-modules-dir=none --allow-env tests/marketplace-admin-http.test.ts tests/payment-recovery.test.ts: restricted investigation/history and payment-recovery contracts; no network permission.
- deno test --no-config --node-modules-dir=none --allow-env tests/marketplace-operations-http.test.ts tests/operations-runner.test.ts: restricted operations API, worker heartbeat, send/retry persistence, liveness and job-token checks; no network permission.
- node tests/live-access-smoke.mjs: real anonymous/admin SDK/API checks, using the ignored locally stored admin credential; signs out only its own session.
- tests/account-boundaries.sql: explicitly authorized rollback-only database test under the authenticated role. Uses existing confirmed accounts to exercise onboarding, account-type locking and cross-owner draft isolation. Not a replacement for genuine ordinary-user JWT/browser tests.
- Earlier production Auth evidence: 69 responsive route/size checks, admin login/sign-out and anonymous route guards in ignored outputs/qa/production-flow. This is not acceptance of the new, unreleased marketplace. Current local evidence and remaining release gates are in the implementation QA report above.

The earlier tests/browser-pass12.cjs, tests/live-security.mjs and tests/browser-journeys.cjs describe the retired prototype and old schema behavior. Do not run them against production: their QA users were removed and their role-switch/demo expectations no longer apply.

## Structure

- src/live: the active production UI and Supabase client.
- src/main.tsx: mounts only LiveApp.
- supabase/migrations: versioned live schema changes.
- supabase/functions/realreach-marketplace: new authenticated marketplace commands.
- supabase/functions/marketplace-jobs: authenticated verification and payment reconciliation runner.
- supabase/functions/pocketfi-webhook: signed provider notifications and independent payment confirmation.
- supabase/functions/marketplace-operations: private scheduled alert sender and minimal public monitor-liveness check; daily read-only ledger checks run separately in SQL. See [operations setup](docs/RealReach-Provider-Contracts.md#operations-email-resend).
- supabase/functions/_shared: RocketAPI/PocketFi adapters and shared backend code. Existing realreach-api and older Instagram endpoints remain separate until the migration/deployment plan is applied.
- src/journey and src/App.tsx: historical simulator reference, not routed or imported by production JS. Only the shared stylesheet is retained.
- docs: scope, research, staged build plan and evidence reports.

Do not call the complete business → worker → payout journey ready until live verification, funding, settlement, withdrawals and ordinary-user integration tests pass. Do not reintroduce a separate public test product: the CEO’s acceptance group should use the same real accounts and eventual live transaction flow as customers.
