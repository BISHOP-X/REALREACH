# RealReach V1: delivery passes

Updated: 28 September 2026. This is the staged delivery plan. For current deployed state and evidence, read [the pass 1/2 QA report](./RealReach-Pass-1-2-QA.md). Real Auth/RLS and the provider scaffold are now deployed; external activation gates remain. The starting-point section below records the state before implementation.

## Decisions now confirmed

- Instagram-only, mobile-first React/TypeScript website, hosted on Vercel.
- Supabase project: `jabwuawiqsusjrccapab`. No other project's backend or credentials may be reused.
- The sole admin identity will be `admin@realreach.com.ng`, confirmed by the founder. The earlier `realreac` spelling was a typo.
- Admin signs in normally and can switch between worker, business and admin interfaces. There is no public admin signup or facility to create additional admins.
- Include email/password and Google sign-in. Google sign-in to RealReach is separate from connecting an Instagram account.
- PocketFi is the intended payment provider; its application and credentials are pending. Build its adapter and test cases before enabling real payments.
- Deliver in small, tested passes. Keep every unfinished provider or money feature visibly in demo/test mode.

The [Instagram V1 PRD](./RealReach-Instagram-V1-PRD.md) remains the detailed product contract. Follow-first, comments behind their own verification gate, and no likes are the proposed technical sequencing. Proposed claim windows, retention periods, pricing and payout limits are not silently promoted to approved commercial terms by this plan.

## Historical starting point (before passes 1/2)

The frontend has connected local demo journeys, not production authentication or a shared marketplace. The application does not yet call Supabase for these journeys.

The RealReach MCP returned the expected project URL. Its public table list and Edge Function list were empty at this inspection. Database inspection works and migration/deployment tools are available; this planning pass did not execute a live migration or deploy a function, so successful deployment is not yet demonstrated.

The existing CLI identity returned HTTP 403 for this project in the access check. MCP authorization is separate from CLI authorization. Do not borrow a different project's credentials to work around that. The currently exposed MCP tools do not administer Auth users or Google/SMTP settings; use an authorized Supabase dashboard session or a separately authorized RealReach CLI/Management API path for those operations.

No admin account or password has been created as part of this planning pass. Google sign-in and SMTP delivery have not been activated or end-to-end tested.

## Lean architecture

```text
React website on Vercel
  |-- Supabase Auth: login, Google, sessions, recovery, MFA
  |-- Supabase Data API + RLS: permitted profile and marketplace reads/writes
  `-- Supabase Edge Functions: privileged commands and provider integrations
        |-- Postgres: ownership, campaigns, assignments, evidence, ledger, audit
        |-- durable jobs + scheduled retries/checks
        |-- Instagram verification adapter
        `-- PocketFi adapter

Provider callbacks -> authenticated webhook ingestion -> durable event -> processing
Supabase Auth -> Resend SMTP -> confirmation and recovery emails
```

One backend is enough initially. Do not introduce separate microservices, a second authentication provider or multiple verification vendors without a measured need. Public credentials may be in the browser; provider keys and privileged Supabase credentials never are. The browser cannot declare a payment successful, award earnings or grant roles.

## Pass 1 — real accounts and secure access

**Outcome:** real worker and business accounts, with one securely provisioned admin.

Build:

- Email/password signup, email confirmation, login, sign-out, recovery and password reset.
- Google OAuth start/callback, cancellation and error handling, session restoration and explicit onboarding after first sign-in.
- Profiles and business ownership with versioned migrations, RLS and explicit API grants. Selecting a worker/business interface does not grant privileged access.
- Protected routes and server-enforced authorization; navigation alone is not a security boundary.
- A private singleton admin assignment pinned to the verified Auth user UUID. Email matching or editable user metadata must never grant admin. Re-registering a deleted email must not inherit the previous admin authority.
- Create the admin using the supported Auth administration interface. Generate a unique cryptographically random password at provisioning, hand it over securely outside source control/tool logs, and enroll MFA before privileged administration. Keep recovery ownership with the founder.
- Brand confirmation/recovery emails and configure Resend SMTP. Preserve the existing visual design while giving loading, invalid-link, expired-session and access-denied states proper mobile treatment.
- Separate demo state from authenticated records; no real profile information in the shared local demo. Do not present demo balances as real wallets after login.

**Completion tests:** delivered confirmation and recovery emails; actual email and Google login; refresh and sign-out; unauthorized admin API/route access denied; two unrelated users cannot access or modify each other's records; forged role metadata has no effect; admin can switch authorized interfaces. Test on phone and desktop. Mark any unavailable provider test as blocked, not passed.

**Setup needed:** Google OAuth client configuration; Resend account and verified sender; a working admin mailbox or receiving alias; authorized Auth administration/settings access. These dependencies do not prevent writing the app flow and migrations, but they prevent calling the entire pass complete.

## Pass 2 — prove the Instagram verification loop

**Outcome:** one actual test business and worker complete a verified assignment with mock money.

- Test the provider proposed in the research (Zernio) against the exact required contract before treating it as a production dependency.
- Connect the business's professional Instagram account through hosted authorization; retain provider credentials only on the server.
- Issue a single-use, expiring DM challenge; verify webhook authenticity and bind the observed sender to the assignment using the provider's scoped identity.
- Establish the initial follow state before the requested action. Check after completion and again at the agreed retention point; record evidence and freshness.
- Treat unknown results as pending with bounded retries, not guessed successes or failures. Surface disconnection and expired permissions clearly.
- Prove identity mapping, existing follower rejection, repeated evidence, immediate unfollow and delayed/replayed events. A follow check proves an account relationship at an observed time, not continuous following or one unique human per account.
- Test comments separately before exposing comment campaigns. Do not substitute screenshots if the required API evidence fails.

**Completion test:** controlled negative and positive observations match known test actions, including delayed rechecks and failures. Produce a short evidence/cost report. If the provider cannot support the contract reliably, stop that action type before expanding the marketplace around it.

**Setup needed:** provider access, one consenting professional test business, and a few consenting worker accounts. Paid-use permission remains a separate release gate from technical API success.

## Pass 3 — persistent business-to-worker marketplace

**Outcome:** independent accounts see and act on the same server-owned campaign, not local browser simulations.

- Business onboarding, campaign draft, server-generated quote, test-budget reservation, publish, pause, close and delivery receipts.
- Worker feed, eligibility, atomic place claims, task instructions, verification progress, resumable assignments and appeals.
- Durable verification work and scheduled final checks; money transitions use a balanced integer-kobo ledger with idempotent settlement.
- Pending versus available earnings, transaction history and unused-budget release. Test funds remain isolated from real payment accounting and cannot become redeemable through a feature toggle.
- Minimal admin exception inbox and audit trail alongside the features that generate exceptions.

**Completion tests:** two workers race for the last place; refresh/double-tap/retry does not create another claim or reward; cross-business isolation holds; a paused campaign preserves existing commitments; the worker can leave for Instagram and return without losing progress; every test-money movement reconciles.

## Pass 4 — PocketFi funding and payouts

**Outcome:** verified deposits fund campaigns and eligible earnings can be paid once, with recoverable failure handling.

- Read the mature implementation under `C:/Users/dell/Desktop/MY STORES/ACTIVE STORE` and relevant PocketFi references under `C:/Users/dell/Desktop/MONEY`, read-only. Inspect their instructions first. Reuse verified patterns, not credentials or assumptions about RealReach's merchant account.
- Confirm current PocketFi documentation, webhook authentication, reference lookup, beneficiary validation, retry semantics, fees and available testing facilities.
- Build a server-only adapter and deterministic contract fixtures while the merchant application is pending. Do not invent a sandbox or treat fixtures as a passed provider integration.
- Match each deposit to its expected merchant/reference, amount and currency before crediting. Deduplicate events and reconcile with authoritative provider records.
- Reserve withdrawal funds atomically; a timeout remains unresolved until checked. Reuse the same payment identity when supported; do not issue a fresh payout simply because the first request timed out.
- Add funding/payout receipts, explicit pending states, reconciliation and admin escalation. Failed payments must not mint money or release the same hold twice.

**Completion tests:** signed and forged callbacks, duplicate/out-of-order events, amount mismatch, accepted-but-timed-out payout, insufficient funds, provider outage and ledger reconciliation. Real credentials, merchant approval and separately authorized low-value money tests are needed before activation.

## Pass 5 — release polish and controlled pilot

**Outcome:** a small pilot with an automated normal path and visible exceptions that the two-person team can manage.

- Finish the sole-admin exception, connection-health, payout and audit screens; require MFA on privileged actions and reasoned/audited resolutions.
- Add essential notifications, abuse throttling/CAPTCHA, alerting, redacted error reporting and backup/restore checks.
- Finalize privacy/retention, task rules, holds, fees, cancellations and dispute wording to match actual system behavior.
- Test mobile navigation, keyboard/form behavior, loading/empty/error states, accessibility, slow connections and desktop layouts.
- Run the CEO's business plus approximately ten-worker controlled test. Separately test concurrency, provider limits and measured cost; a ten-person pilot does not establish mass-market capacity.
- Review actual automatic resolution, unresolved-case age, support effort, margin, payout latency and reconciliation. Use those results to set conservative initial limits.

**Release gate:** technical acceptance, payment approval and the commercial/platform-permission constraint recorded in the PRD must all be addressed. Live money stays disabled until the explicit release decision. No claim of zero fraud, guaranteed permanent follows or guaranteed loss-free operation.

## Immediate setup checklist for the founder

1. Make `admin@realreach.com.ng` able to receive email. Domain ownership alone does not create an inbox; receiving mail is separate from sending through Resend.
2. Configure a Google Cloud web OAuth client. Its Supabase callback is `https://jabwuawiqsusjrccapab.supabase.co/auth/v1/callback`. Store its secret in Supabase provider settings, never a Vite environment variable.
3. Connect Resend and verify a sending domain/subdomain. Proposed sender: `RealReach <noreply@auth.realreach.com.ng>`. Publish only the exact records supplied for that account; preserve unrelated website and mailbox DNS.
4. Provide an authenticated RealReach Supabase dashboard/CLI administration path for Auth setup and admin provisioning. Do not paste privileged keys into chat or the repository.

Configure application redirect URLs only after checking the deployed canonical hostname and HTTPS. The last Vercel setup used apex-to-`www` redirection; do not assume DNS is ready. Keep development redirects separate and production allowlists narrow.

## Reporting rule for every pass

Every handoff states: files changed, database migrations applied, functions deployed, actual flows tested, tests not run and remaining setup. A build passing is not proof that Google login, an email, an Instagram check or a payout worked. The original planning handoff changed documentation only; implementation status is maintained in the linked QA report.

## Current setup references

- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp): the default sender is restricted and unsuitable for public production signup. Use custom SMTP before opening registration.
- [Resend with Supabase SMTP](https://resend.com/docs/send-with-supabase-smtp): configure a verified sender and the SMTP credential in Supabase, not frontend code.
- [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google): OAuth client setup, provider configuration and redirect handling.
