# Production flow cleanup — 29 September 2026

## Decision and current scope

The founder rejected a separate customer-facing demo/pilot product. The public site now has one real account flow, concise copy, fixed worker/business account types, private business records and saved campaign drafts. The old simulator and its open sample admin are no longer routed or imported by the production JavaScript.

This supersedes earlier documents where they propose public demo links, universal role switching or private unpaid invitation codes as the normal customer journey. It does not establish that verification or payments work without their providers.

## Inspected

- RealReach MCP URL matched jabwuawiqsusjrccapab before data access.
- Existing RLS, function definitions, Auth account counts, sole-admin identity, security advisories and log source counts.
- Exactly one admin, pinned to the verified admin@realreach.com.ng Auth identity. No additional admin was created.
- The open admin complaint traced to the legacy /demo/admin simulator. The actual admin endpoint already checked the singleton plus AAL2.

## Changed and deployed on Supabase

- Migration account_boundaries_and_campaign_drafts adds account_type, a one-time authenticated onboarding function and private campaign_drafts.
- Existing completed profiles remain workers unless they own a business. Incomplete profiles must choose at onboarding. Existing logins and sessions are preserved.
- Browser clients cannot update account_type, change preferred_front or insert a business directly. The onboarding function derives its actor from auth.uid(), checks confirmed identity, serializes changes with a row lock and rejects ordinary role changes. It never accepts an admin role.
- Business creation and account selection happen in one transaction. Retried onboarding does not duplicate businesses.
- Drafts support real save/edit/read under owner RLS. There is no browser permission to publish, set rewards, change ownership or credit balances.
- realreach-api version 3 checks worker/business type before commands. The existing verification insert path also checks the worker type.
- Existing sole-admin and authenticator requirements are unchanged. identity-provision remains HTTP 410.

## Website changes

Published and promoted to https://www.realreach.com.ng as deployment
`dpl_EVu8ajy4asWNWFkzRcrX1ZgbvKF4` (READY). The live domain served the new
`index-DxZXtHTe.js` and `index-d2YP9IWC.css` assets. The live /demo/admin URL
was checked in the browser and shows Page not found.

- Public /demo routes now show page not found. No sample money or fake result counters.
- New/returning email and Google sessions go through /start into onboarding or their correct dashboard.
- Ordinary users cannot select a different front; direct links redirect to their own front. Only admin sees the switcher.
- Worker navigation: Discover, My tasks, Wallet, Account.
- Business navigation: Overview, Campaigns, Funds, Account; Instagram from overview/settings.
- New business campaign editor saves actual drafts; no pretend publish or checkout action.
- Phone sign-out button, shorter account/help/auth copy, reworked public landing and preserved brand identity.
- Task screens currently show empty states, not a live funded task feed. Historical unpaid provider records are not relabelled as paid tasks.

## Verification completed

- npm test: 39 passed (5 account/production-entry regressions, 5 Google nonce, 11 provider contract, 18 historical simulator tests). Simulator tests do not prove production money behavior.
- npm run build: passed. JS reduced from roughly 629 KB to 511 KB; chunk-size advisory remains.
- Deno check: realreach-api passed.
- 11 real SDK/API smoke checks: anonymous data/command/onboarding denial, genuine admin password login, singleton recognition, MFA denial, own-profile read, direct role mutation denial, Google still enabled, payments closed, provisioning closed.
- Rollback-only authenticated database-role tests: own-profile isolation, hidden admin identity, blocked direct role edits, blocked worker↔business conversion, blocked direct business creation/admin assignment, atomic/idempotent business onboarding, own draft save/edit, blocked ownership change, blocked cross-owner read/write and blocked worker draft insertion. No test records remained after rollback.
- Browser: actual admin login and sign-out, admin MFA gate, signed-out business route protection, removed /demo/admin, campaign editor input/summary interaction.
- Repeated password sign-in on the deployed realreach.com.ng domain reached /admin through the new /start routing. Google’s official button loaded and its live picker displayed realreach.com.ng. Account selection inside the Google popup remained blocked by browser automation; the popup was closed and email login remained usable. This pass does not claim a newly completed Google token exchange.
- 45 authenticated route/size checks at measured 360, 390, 430, 768 and 1440 CSS px; 24 public route/size checks at 360, 390 and 1440. No overflow or pilot/demo/baseline copy after fixing narrow-phone admin header controls.
- Browser walkthrough used the authorized admin’s worker/business views; it did not create a fake ordinary-user session. Ordinary-user boundaries were tested at the authenticated database role, not through new ordinary-user JWT/browser sessions. Those full onboarding/session tests remain required.
- Screenshots: outputs/qa/production-flow (ignored).

## Release limitations — do not hide these

1. Zernio account/key, webhook activation and real Instagram account checks are still absent. The frontend cannot make that integration real by changing its copy.
2. PocketFi onboarding/credentials, production ledger, funding, settlement, withdrawals and reconciliation still need implementation/verification.
3. Funded campaign publication, eligible worker feed, claims, payout-linked assignments and delivery receipts remain backend work. A saved draft is not a published campaign.
4. Public email signup needs production SMTP; Google remains enabled with the existing branded direct flow. A fresh Google signup was not independently repeated in this pass.
5. Admin authenticator enrollment remains owner work. Do not relax this check to make operations open.
6. Security advisory: leaked-password protection remains disabled. The signed-in SECURITY DEFINER warning is intentional for the narrowly checked onboarding function; reviewed SQL and restricted grants are its boundary. Five integration tables intentionally have no browser RLS policies/grants (deny by default).
7. The Google secret previously pasted into chat still needs secure rotation. Never copy it into source, logs or a browser bundle.

Advisories: [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [reviewing authenticated definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Next real-product sequence

Connect and prove Zernio → implement funded campaign/assignment/ledger transactions → connect PocketFi and reconcile funds → exercise the same real business/worker journey with the CEO’s small group. No separate public simulator and no manual-success shortcuts. Commercial platform-use constraints from the provider research remain unresolved separately; this cleanup does not claim platform approval.
