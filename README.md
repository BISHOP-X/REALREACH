# RealReach

Instagram-first marketplace website built with React, TypeScript and Vite, hosted on Vercel.

## Current state

The production website uses real Supabase accounts. Worker/business account types are assigned once on the server. Only the pinned sole admin can switch fronts; admin operations additionally require an authenticator. There is no public simulator or open sample admin route.

Business onboarding creates an owned business record. Campaign drafts save to Supabase and are isolated by owner. Payments, funded campaign publication, the live task feed/assignment loop and payouts are not implemented end to end. Zernio and PocketFi activation are still required. Empty task screens are not a claim that a functioning paid marketplace has launched.

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
- /earn, /earn/my-tasks, /earn/wallet: worker screens.
- /business: business overview.
- /business/campaigns, /business/campaigns/new, /business/campaigns/:id: real saved drafts.
- /business/instagram: owned Instagram connection flow; unavailable without provider setup.
- /business/wallet: funds screen; no fabricated balances or deposits.
- /account: profile, security and support.
- /admin: sole admin only; operations require MFA.
- /demo and all its former child routes: removed, show page not found.

## Verification

- npm test: account boundaries, Google nonce handling, provider contracts and historical simulator state invariants.
- npm run build: TypeScript and production bundle.
- node tests/live-access-smoke.mjs: real anonymous/admin SDK/API checks, using the ignored locally stored admin credential; signs out only its own session.
- tests/account-boundaries.sql: explicitly authorized rollback-only database test under the authenticated role. Uses existing confirmed accounts to exercise onboarding, account-type locking and cross-owner draft isolation. Not a replacement for genuine ordinary-user JWT/browser tests.
- Current browser evidence: 69 responsive route/size checks via the browser tools, actual admin login/sign-out, anonymous route guards, screenshots in ignored outputs/qa/production-flow.

The earlier tests/browser-pass12.cjs, tests/live-security.mjs and tests/browser-journeys.cjs describe the retired prototype and old schema behavior. Do not run them against production: their QA users were removed and their role-switch/demo expectations no longer apply.

## Structure

- src/live: the active production UI and Supabase client.
- src/main.tsx: mounts only LiveApp.
- supabase/migrations: versioned live schema changes.
- supabase/functions: authenticated server commands, Instagram adapter, webhook and scheduled checks.
- src/journey and src/App.tsx: historical simulator reference, not routed or imported by production JS. Only the shared stylesheet is retained.
- docs: scope, research, staged build plan and evidence reports.

Do not call the complete business → worker → payout journey ready until live verification, funding, settlement, withdrawals and ordinary-user integration tests pass. Do not reintroduce a separate public test product: the CEO’s acceptance group should use the same real accounts and eventual live transaction flow as customers.
