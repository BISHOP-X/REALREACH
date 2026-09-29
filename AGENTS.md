# RealReach project instructions

## Identify the project before accessing Supabase

- This repository is RealReach, an Instagram-first marketplace frontend built
  with React, TypeScript and Vite. The production UI uses real Auth, fixed
  account types and saved business drafts. The paid marketplace is incomplete.
  Read docs/RealReach-Production-Flow-QA.md for current state; older prototype
  descriptions are historical, not the active user journey.
- Expected Supabase project ref: `jabwuawiqsusjrccapab`.
- Expected API URL: `https://jabwuawiqsusjrccapab.supabase.co`.
- Read this file, the available Supabase skills, `.codex/config.toml`, and
  `supabase/config.toml` when it exists before doing Supabase work.
- Confirm the connected MCP project's API URL matches the expected URL before
  inspecting tables or accessing data. Never use Billy, Active Store, Money Hive,
  Prova or any other project's connection/configuration for RealReach.
- A configured MCP entry is not proof of authentication or project access.
  The user explicitly authorized upgrading the RealReach-only connection to
  read/write administration on 2026-09-28. Verify the runtime connection and
  available permissions after reauthorization/reload; configuration alone does
  not prove writes or deployments work. Never broaden access to other projects.

## Use the right interface

- Use MCP for investigation and authorized administration: inspect schema,
  tables, policies, logs, security advisories and Edge Functions; run read-only
  SQL; apply migrations or deploy functions only when supported and authorized.
- Use the Supabase API/SDK for application behavior and realistic integration
  tests: sign-in, permitted reads/writes, uploads and Edge Function calls.
  An administrative query succeeding does not prove an ordinary user has access.
- Use the Supabase CLI for local development, migrations, generated types and
  deployment. Check the installed version and command `--help` first.
- Use the Management API only as an administrative fallback, with current
  official documentation and securely supplied credentials.

## Inspect, protect and verify

- Inspect actual tables, columns, policies and function behavior before changes.
  Keep deployed schema changes in versioned migrations. Never bypass permissions
  merely to make a test pass.
- Do not print or commit credentials. Browser code may use the appropriate
  publishable key with access policies; service-role/secret keys, payment secrets
  and verification-provider secrets belong exclusively on the server.
- Never trust browser-supplied roles, task-verification results, balances or
  payment confirmations. Local demo transitions are not production security.
- Test permissions as unauthenticated users and as distinct ordinary users;
  check cross-user/business isolation and privileged/admin boundaries.
- Verify deployed state after an authorized change, then test the actual app
  flow. Report separately what was inspected, changed, deployed and tested.
- Preserve unrelated working-tree changes. Do not push, deploy, run destructive
  SQL or transfer real money without authorization for that operation.

## Product and frontend context

- Confirmed sole production admin: `admin@realreach.com.ng` (founder confirmed
  the spelling on 2026-09-28). This is an intended identity, not proof an Auth
  account has been provisioned. Use a protected singleton assignment to the
  verified Auth user UUID; never derive admin access from editable metadata or
  a frontend email comparison. No public admin signup or additional admins.
- Follow `docs/RealReach-V1-Delivery-Plan.md` for the staged implementation and
  external setup checklist. Keep implementation and tested/deployed status
  explicit; do not describe planned integrations as complete.

- Read `docs/RealReach-Instagram-V1-PRD.md`,
  `docs/RealReach-V1-Verification-Provider-Plan.md` and
  `docs/RealReach-Frontend-First-Pass-QA.md` for scope, verification constraints
  and the existing UI test handoff.
- Mobile is the priority; verify phone and desktop layouts after UI changes.
- Do not restore public demo routes, role simulators or sample admin screens.
  Customer-facing copy must be concise and plain. CEO acceptance uses the same
  real account and transaction flow as customers, not a separate mock product.
  Keep unavailable integrations closed with a short honest message; never
  fabricate verification, balances, payments or completed work.
- Worker/business account_type is chosen once through rr_complete_onboarding.
  preferred_front and editable Auth metadata grant no access. Only the pinned
  admin may switch fronts. No automatic conversion from worker to business.
- Existing checks: `npm test`, `npm run build`, and the browser journey harness
  described in the README. These do not replace backend authorization tests.
