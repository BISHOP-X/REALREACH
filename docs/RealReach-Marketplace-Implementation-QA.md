# RealReach marketplace implementation and acceptance status

Updated 21 October 2026. The marketplace website and backend are now deployed at https://realreach.com.ng, with release code pushed as `f2e4209`. Existing Google/email Auth, fixed worker/business roles and the singleton admin are preserved. **Top-ups and payouts remain disabled**, independently of missing keys. Live-provider acceptance and financial exception recovery are not complete. This is the same customer product, not a separate public test mode.

The [earlier audit](RealReach-End-to-End-Audit-2026-10-21.md) records the pre-release baseline. The implementation and release checks below supersede that baseline; unresolved acceptance gaps remain explicit.

## Deployed release

- Applied `20261021165450`, `20261021182743` and `20261021191322` through the linked RealReach CLI. Three historical filenames were matched to verified, identical remote SQL; no old migration was replayed or remote history repaired.
- Deployed `realreach-marketplace`, `marketplace-jobs`, `pocketfi-webhook` and `marketplace-operations`; all ACTIVE. Existing endpoints and accounts were preserved.
- Staged, verified and promoted the production frontend. The subsequent GitHub-triggered deployment `dpl_n8bDybQifscdKczVDfebJeRbcrFx` is READY on both custom domains and matches `f2e4209`. This verifies GitHub-to-Vercel synchronization.
- Live database checks: `collections_enabled=false`, `payouts_enabled=false`, `payouts_paused=true`, pricing unapproved. The database trigger blocks new payment intents/first dispatch; the normal admin pricing form cannot enable either launch gate. Adding keys alone cannot open payments.
- All public tables have RLS; no `rr_market_*` or `rr_ops_*` RPC permits anonymous/authenticated direct execution. Four pre-existing profiles were preserved. No payments or financial journals existed at release.
- Marketplace/monitor schedules are running. The actual five-minute monitor invocation returned HTTP 200; its public freshness endpoint returns 200. Sender state is `mail_not_configured`, not delivered. The first scheduled daily ledger check has not yet run.
- Vercel reported no runtime errors in the inspected hour; this static frontend check does not cover Supabase runtime errors. The drains API returned 404, so external drain configuration was not verified.
- Thirty live SDK/API checks passed as distinct ordinary worker/business QA accounts: normal onboarding, immutable account types, actual draft/quote persistence, support, session restoration/revocation, cross-owner isolation and admin/private-RPC denial. Created two private confirmed identities, one unfunded draft and two support cases. This does not test public email confirmation. No customer permissions were relaxed.
- The real Google account chooser displayed `realreach.com.ng`, with the site's privacy/terms links. Browser automation could not select inside that popup (input timeout); no fresh ID-token exchange was completed. Closing the popup left Google/email/login controls enabled. This is branding/cancellation evidence, not a new successful Google sign-in claim.
- Independent final checks found six Auth users/profiles, one business, one draft and three support cases. Payments, financial journals, ledger entries/accounts, balances and jobs remained zero; launch gates remained closed. The extra case is the labelled browser-form acceptance record below.

## Live browser acceptance

All of these used the actual production website and Supabase responses, not fixture data:

| Scope | Verified result |
| --- | --- |
| Public pages | 28 route/viewport checks at 360, 390, 430 and 1440 pixels; anonymous protected-route/API denial. |
| Auth and mobile menu | Six final auth layouts for login and both signup choices at 390/1440, with the real colored Google button fully loaded. Full-height phone menu links, Escape and scroll restoration passed. |
| Worker and business | 13 interaction checks and 30 route/viewport checks at 390/1440. Real password sign-in, own data, reload persistence, sign-out, cross-role/admin denial and disabled money actions passed. |
| Sole admin | Real password login and singleton recognition; UI and API deny operations without AAL2. Four checks/two layouts passed. The account still needs authenticator enrollment; operational admin actions were not bypassed or accepted. |
| Real form writes | Eleven checks passed: save business name and verify after reload/API read; restore exact original details; edit existing unfunded draft and verify after reload/API read; restore its title; submit one labelled worker support request and verify after reload/API read. No funding, withdrawal, publication, bank or Instagram action. |
| Visual regression fixed | Live review caught inherited dark text on the dark `New campaign` link. Commit `e7442a2` lowers the generic link-reset specificity; the matching Git deployment is READY. Local business suite now passes 23 checks/30 layouts, including explicit link colors. Live computed text is white on the dark background. |

Representative mobile/desktop screenshots were inspected. These are Chromium
viewport tests, not physical-phone keyboard or Safari acceptance. Saved evidence:

- `outputs/qa/live-readonly/2026-10-21T19-24-26.716Z`: public route checks.
- `outputs/qa/live-readonly/2026-10-21T19-30-21.614Z`: final Google/menu captures.
- `outputs/qa/live-readonly/2026-10-21T19-30-50.428Z`: ordinary-account reads.
- `outputs/qa/live-readonly/2026-10-21T19-27-29.766Z`: real admin MFA gate.
- `outputs/qa/live-acceptance/2026-10-21T19-28-10.928Z`: 30 SDK/API checks.
- `outputs/qa/live-no-money/2026-10-21T19-37-35.186Z`: 11 browser form checks.
- `outputs/qa/live-readonly/2026-10-21T19-40-13.113Z`: four final checks/two campaign layouts confirming the deployed button contrast fix at 390/1440.

One earlier browser-write attempt received HTTP 401 on `sole_admin` immediately
after successful password/profile responses and correctly stopped at the
account-load error screen before any writes. A new run passed without retry;
the cause was not established. The failed evidence is retained at
`outputs/qa/live-no-money/2026-10-21T19-35-43.391Z`. Do not call it a fixed
backend defect or omit it from reliability follow-up.

Two strongly credentialed private QA accounts and their labelled nonfinancial
records are retained for repeatable checks, not exposed as customer demo accounts.
Credentials remain owner-only, Git-ignored and excluded from Vercel. The final
155-file targeted secret scan found zero matches and no tracked private files.

## Customer journeys

| Journey | Deployed screens and commands | Required live acceptance |
| --- | --- | --- |
| Account | Signup/signin, email confirmation, Google ID-token exchange, one-time onboarding, profile, logout and authenticator | Delivered confirmation/reset emails, fresh and returning Google accounts, distinct worker/business sessions |
| Worker | Verify public Instagram ownership; search tasks; read terms; claim; wait for eligibility; perform action; submit; see checking, pending, final result and receipt | Rocket profile propagation, baseline, follow/comment evidence, retention, outages and permissions using real accounts |
| Business | Business settings; Instagram ownership; campaign search; four-step builder; durable draft; exact quote; funding; publication; pause/resume/close; delivery receipts | Live database commands and quote locking, genuine provider-owned target, authorized funding and delivery |
| Wallet | Actual ledger balances; paginated activity; funding checkout/return/resume; bank resolution; withdrawal amount and fee; pending/unknown outcomes | PocketFi merchant activation, collection confirmation, signed webhook, controlled payout and reconciliation |
| Support | Persisted cases linked to a task/payment reference; response history; notification read state | Cross-user isolation and response updates under real JWTs |
| Admin | Authenticator gate; overview; cases; verification retries; payment review; explicit pricing/pausing confirmation; audit trail | Singleton identity plus AAL2 and actual server denial for other accounts |

Every customer page remains behind the correct account type. The CEO's acceptance group must use real worker and business accounts. No public admin route, fabricated funds or simulated payment success is restored.

## Deployed backend

The new versioned migration adds campaign/assignment records, account ownership challenges, quotes, immutable double-entry financial records, payment intents, bank recipients, jobs, cases, notifications and audit records. Existing profiles and draft records are preserved. Commercial prices start unapproved and payouts start paused.

Server commands authenticate the session and account type. Customer metadata never grants a role. Money and task results are server-controlled; browser return URLs cannot confirm payment. Exact quote values and versions are checked before reserving funds. Duplicate funding, claims, rewards and withdrawal dispatches are guarded in the database.

Worker earnings remain unavailable until the final verification check. A failed or incomplete provider response cannot invent a positive result. Uncertain payouts retain their hold and are not sent again automatically. Administrators can review and retry supported checks, not arbitrarily edit a balance.

The recovery pass adds owner-visible financial quarantine, audited closure without payment for `needs_review` tasks, and exact unused-allocation release. Signed discrepancies are retained before or after confirmation; settlement and quarantine share an owner lock, so a prior discrepancy cannot be lost when funds are credited later. Stale conflicting confirmations also record a dispute. An ordinary unpaid failure does not itself freeze an account. New withdrawals require the user's accepted fee and terms version; existing intent retries retain their original fee. These changes are deployed but have not been accepted with real payment providers.

See [provider contracts and setup](RealReach-Provider-Contracts.md) for exact endpoints, secrets and acceptance cases. Rocket scans have finite page/time budgets. Very large following lists or comment threads can require review; current tests do not demonstrate high-volume provider throughput or uninterrupted retention between observations.

## Verification completed

| Check | Result and scope |
| --- | --- |
| TypeScript and production build | Pass. Worker, business, wallet and admin routes are split into separate bundles; stable React/Supabase libraries have cacheable chunks. |
| Unit and contract suite | 116 passed at this checkpoint, including Rocket/PocketFi/webhook contracts, operations email, amount/date formatting and withdrawal readiness. Older simulator tests are not production evidence. |
| PostgreSQL regression suite | 94 passed on isolated PGlite: migration preservation, grants/RLS, session ownership, exact-once financial transitions, quote and fee consent, holds, repeats, ledger balance, bounded verification queues, unpaid review closure and payment-event ordering. A single PGlite instance is not a multi-connection concurrency load test. |
| Native PostgreSQL concurrency suite | 31 checks passed across 29 synchronized races on PostgreSQL 17.11, with 2–12 independent connections per race. Includes financial replay/overspending/holds/fee consent, operations races and disabling payments versus intent/first dispatch. No deadlock or lock timeout occurred. The isolated local cluster was stopped; production was not accessed. This is not sustained provider throughput testing. |
| Payment launch gates | 11 isolated PostgreSQL checks pass; live settings/trigger/grants independently verified after deployment. |
| Operations PostgreSQL suite | 33 checks passed: service-only privileges, coherent ledger scan, alert throttling/leases/cutoffs, immutable requests and actual SQL → runner → mailer → SQL acceptance/retry with injected transport. |
| Operations HTTP/runner suite | 34 passed: singleton/AAL2 boundaries, safe projections, worker heartbeat, liveness/job-token gates, save-before-send, same-body retries, acceptance-write failure and redacted errors. Together with existing HTTP/admin/recovery tests, 99 passed without network permission. |
| HTTP and session boundary suite | 25 passed against the real handler with injected identity/database responses, without network permission. Includes launch gates and withdrawal fee/terms consent alongside role denial, revoked sessions, ownership, amounts and sanitized errors. |
| Admin investigation HTTP suite | 23 passed without network permission: singleton/AAL2 denial, owner-checked reference resolution, safe masked detail, record-scoped history cursors, pagination and injection rejection. |
| Targeted payment recovery/contracts | 37 PocketFi/webhook contracts and 17 payment-recovery tests passed after the ordering fix. Includes wrapped/pending reversal, ordinary failed checkout, terminal contradictions, harmless delayed nonfinal responses and authoritative concurrent refresh/recheck results. No provider request or money movement. |
| Worker browser suite | 22 interaction checks and 35 route/viewport combinations passed. Includes compact Discover/resume priority, claim eligibility, failed submission/retry, reload, final result, bank/withdrawal, support, notifications and missing-provider behavior. |
| Business browser suite | 23 interaction checks and 30 route/viewport combinations passed. Includes draft recovery, step continuity, quote approval, publication and campaign controls. |
| Admin browser suite | 15 interaction/gating checks and 30 route/viewport combinations passed. Includes MFA gate, server denial, case/retry handling and explicit settings confirmation. |
| Auth browser suite | 13 interaction checks and 18 route/viewport combinations passed, including same-tab email confirmation continuity. No real emails are sent. |
| Business wallet browser suite | 22 interaction checks and 5 responsive widths passed: phone validation, exact amounts, stable retry keys, saved checkout, status recovery and server confirmation before funds appear. Confirmed funds under a spending hold are not described as available. A closed launch gate hides saved checkout links. |
| Withdrawal and spending guard browser suite | 15 checks and 5 layouts passed: named/masked recipient, fee-inclusive balance, current fee/version consent, changed-fee refresh without automatic resubmission, bank-list retry, provider/pause/hold explanations and held campaign resume protection. Includes a 390 × 500 short viewport; this is not a physical keyboard/Safari test. |
| Admin investigation browser suite | 21 checks and 15 layouts passed: owner-resolved case links, payment/task/campaign details, stable Instagram identity, older evidence/event/job/case/audit pages and retry after history-loading failure. |
| Operations browser suite | 14 checks and 4 widths passed: MFA gate, loading/missing/stale/error states, idle heartbeat wording, correct filtered queue links, accepted versus unknown alert outcomes, ledger confirmation/failure/busy/retry and in-flight signout. Phone footer button visibility and hit testing were checked above the real bottom navigation. |
| Account-switch browser suite | 7 passed on development and rebuilt production preview: stale workspace/list/mutation/admin responses cannot cross account boundaries, signout cancels background reads, and stalled profile loading offers Retry after a bounded timeout. |
| Provider and function type checks | All four new marketplace/job/webhook/operations entrypoints and adapters pass Deno checking. |

Browser fixtures intercept all Supabase/provider requests, use non-deliverable test identities and never write live records. The eight existing suites passed at the preceding checkpoint. The new operations suite and affected admin-investigation suite were then rerun successfully against the rebuilt bundle after the operations/queue-filter changes. They test real UI request/response handling, not live backend acceptance. Coverage across suites includes 360, 390, 430, 768 and 1440 pixels; phone and desktop screenshots were reviewed. Artifacts are under ignored `outputs/qa`.

## Still required before customer transactions

### Recovery that needs more implementation

The admin console can answer support cases, retry verification jobs and pause withdrawals. It cannot yet resolve every financial or verification exception. These are development gaps, not missing API keys.

| Exception | Current behavior | Required recovery |
| --- | --- | --- |
| Payout sent but its provider reference was lost | Funds remain held; the system does not send it again. | Investigate with PocketFi, then reconcile the verified transaction through a restricted, audited operator command. No guessed references or manual balance edits. |
| Payout reported failed or reversed | Ambiguous provider responses remain unknown. | Establish the merchant's definitive failure contract before implementing evidence-backed release of a withdrawal hold. |
| Previously credited deposit is reported reversed | Deployed code creates a protective spending hold, including discrepancies arriving before confirmation. Existing obligations and evidence remain intact. | Establish evidence-based provider reconciliation and an audited hold-resolution process. No clawback, balance override or hold-release command exists. |
| Instagram evidence stays inaccessible or repeatedly exceeds scan limits | Deployed admin commands can retry or close only `needs_review` tasks without payment, with required reason, preserved evidence, invalidated leases and exact unused-budget release. | Exercise the deployed singleton/AAL2 flow and agree operational handling of genuine work whose evidence cannot be obtained. |

Linked payment/task investigation and paginated administrative reads are deployed; genuine admin AAL2 and provider-backed acceptance remain outstanding. Resolving a support case records a response; it does not refund a payment, clear a financial hold or decide a task. Unpaid task closure is a separate audited command. Closing a campaign returns unused funds to the business's RealReach wallet, not its bank.

### Release and external setup

1. Deployment is complete: three new migrations, four functions, the matching frontend and live schema/permission/scheduler checks. See the [backend release handoff](RealReach-Marketplace-Backend-Handoff-2026-10-21.md).
2. Ordinary worker/business API and browser form acceptance passed; retain the live evidence and follow up the single intermittent account-read failure. Validate deployed request concurrency for funded work when its provider/payment acceptance is authorized; isolated database races do not establish that throughput.
3. Configure a transactional sender for confirmation/recovery emails. The live default sender is not ready for public signup. Align the live password minimum with the app's 12-character rule.
4. Complete the founder's authenticator setup and approve prices, fees, retention and volume limits. These are commercial decisions, not API-key settings.
5. Add RealReach's own RocketAPI and PocketFi secrets securely; register the deployed PocketFi webhook. Confirm payout-status behavior with the merchant account before enabling withdrawals.
6. Run controlled real-provider checks and separately authorized small collection/payout tests. Check delivery timing, fees, webhook replay and unknown outcomes before inviting paying customers.
7. Configure the operations sender and external monitor, verify the actual daily scheduled ledger check and alert receipt, and establish a tested backup/restore routine. Five-minute monitoring has run live; email delivery remains untested.

Pre-release pattern checks of 153 Git candidate files and the production browser bundle found no matches for the scanned Supabase PAT, Supabase secret-key or Google client-secret formats. The local credential directory and environment file are Git-ignored and excluded from Vercel uploads. This is a targeted check, not proof that every possible secret format has been detected.

The CEO's CAC/PocketFi delay does not block RocketAPI registration, sender setup, code work or isolated acceptance testing. It does block meaningful live collection/payout acceptance. Keys alone should not automatically enable unrestricted money movement.
