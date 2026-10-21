# RealReach marketplace implementation and acceptance status

Updated 21 October 2026. The main marketplace journeys are implemented locally; exception recovery is not complete, and the production website and database have not received this release. Existing Google/email Auth, fixed worker/business roles and the singleton admin are preserved. This is the same customer product, not a separate public test mode.

The [earlier audit](RealReach-End-to-End-Audit-2026-10-21.md) records the live baseline and the unfinished local files at that time. The following implementation work supersedes its local-build findings, not its production findings.

## Customer journeys

| Journey | Screens and commands now connected locally | Required live acceptance |
| --- | --- | --- |
| Account | Signup/signin, email confirmation, Google ID-token exchange, one-time onboarding, profile, logout and authenticator | Delivered confirmation/reset emails, fresh and returning Google accounts, distinct worker/business sessions |
| Worker | Verify public Instagram ownership; search tasks; read terms; claim; wait for eligibility; perform action; submit; see checking, pending, final result and receipt | Rocket profile propagation, baseline, follow/comment evidence, retention, outages and permissions using real accounts |
| Business | Business settings; Instagram ownership; campaign search; four-step builder; durable draft; exact quote; funding; publication; pause/resume/close; delivery receipts | Live database commands and quote locking, genuine provider-owned target, authorized funding and delivery |
| Wallet | Actual ledger balances; paginated activity; funding checkout/return/resume; bank resolution; withdrawal amount and fee; pending/unknown outcomes | PocketFi merchant activation, collection confirmation, signed webhook, controlled payout and reconciliation |
| Support | Persisted cases linked to a task/payment reference; response history; notification read state | Cross-user isolation and response updates under real JWTs |
| Admin | Authenticator gate; overview; cases; verification retries; payment review; explicit pricing/pausing confirmation; audit trail | Singleton identity plus AAL2 and actual server denial for other accounts |

Every customer page remains behind the correct account type. The CEO's acceptance group must use real worker and business accounts. No public admin route, fabricated funds or simulated payment success is restored.

## Backend implemented locally

The new versioned migration adds campaign/assignment records, account ownership challenges, quotes, immutable double-entry financial records, payment intents, bank recipients, jobs, cases, notifications and audit records. Existing profiles and draft records are preserved. Commercial prices start unapproved and payouts start paused.

Server commands authenticate the session and account type. Customer metadata never grants a role. Money and task results are server-controlled; browser return URLs cannot confirm payment. Exact quote values and versions are checked before reserving funds. Duplicate funding, claims, rewards and withdrawal dispatches are guarded in the database.

Worker earnings remain unavailable until the final verification check. A failed or incomplete provider response cannot invent a positive result. Uncertain payouts retain their hold and are not sent again automatically. Administrators can review and retry supported checks, not arbitrarily edit a balance.

The latest local recovery pass adds owner-visible financial quarantine, audited closure without payment for `needs_review` tasks, and exact unused-allocation release. Signed discrepancies are retained before or after confirmation; settlement and quarantine share an owner lock, so a prior discrepancy cannot be lost when funds are credited later. Stale conflicting confirmations also record a dispute. An ordinary unpaid failure does not itself freeze an account. New withdrawals require the user's accepted fee and terms version; existing intent retries retain their original fee. These changes are **local only, not deployed**.

See [provider contracts and setup](RealReach-Provider-Contracts.md) for exact endpoints, secrets and acceptance cases. Rocket scans have finite page/time budgets. Very large following lists or comment threads can require review; current tests do not demonstrate high-volume provider throughput or uninterrupted retention between observations.

## Verification completed

| Check | Result and scope |
| --- | --- |
| TypeScript and production build | Pass. Worker, business, wallet and admin routes are split into separate bundles; stable React/Supabase libraries have cacheable chunks. |
| Unit and contract suite | 116 passed at this checkpoint, including Rocket/PocketFi/webhook contracts, operations email, amount/date formatting and withdrawal readiness. Older simulator tests are not production evidence. |
| PostgreSQL regression suite | 94 passed on isolated PGlite: migration preservation, grants/RLS, session ownership, exact-once financial transitions, quote and fee consent, holds, repeats, ledger balance, bounded verification queues, unpaid review closure and payment-event ordering. A single PGlite instance is not a multi-connection concurrency load test. |
| Native PostgreSQL concurrency suite | 29 checks passed across 28 synchronized races on PostgreSQL 17.11, with 2–12 independent connections per race. Includes financial replay/overspending/holds/fee consent plus concurrent ledger checks, digest creation, leases, immutable preparation and finish replay. No deadlock or lock timeout occurred. The isolated local cluster was stopped; production was not accessed. This is not sustained provider throughput testing. |
| Operations PostgreSQL suite | 33 checks passed: service-only privileges, coherent ledger scan, alert throttling/leases/cutoffs, immutable requests and actual SQL → runner → mailer → SQL acceptance/retry with injected transport. |
| Operations HTTP/runner suite | 34 passed: singleton/AAL2 boundaries, safe projections, worker heartbeat, liveness/job-token gates, save-before-send, same-body retries, acceptance-write failure and redacted errors. Together with existing HTTP/admin/recovery tests, 96 passed without network permission. |
| HTTP and session boundary suite | 22 passed against the real handler with injected identity/database responses, without network permission. Includes withdrawal fee/terms consent alongside role denial, revoked sessions, ownership, amounts and sanitized errors. |
| Admin investigation HTTP suite | 23 passed without network permission: singleton/AAL2 denial, owner-checked reference resolution, safe masked detail, record-scoped history cursors, pagination and injection rejection. |
| Targeted payment recovery/contracts | 37 PocketFi/webhook contracts and 17 payment-recovery tests passed after the ordering fix. Includes wrapped/pending reversal, ordinary failed checkout, terminal contradictions, harmless delayed nonfinal responses and authoritative concurrent refresh/recheck results. No provider request or money movement. |
| Worker browser suite | 22 interaction checks and 35 route/viewport combinations passed. Includes compact Discover/resume priority, claim eligibility, failed submission/retry, reload, final result, bank/withdrawal, support, notifications and missing-provider behavior. |
| Business browser suite | 22 interaction checks and 30 route/viewport combinations passed. Includes draft recovery, step continuity, quote approval, publication and campaign controls. |
| Admin browser suite | 15 interaction/gating checks and 30 route/viewport combinations passed. Includes MFA gate, server denial, case/retry handling and explicit settings confirmation. |
| Auth browser suite | 13 interaction checks and 18 route/viewport combinations passed, including same-tab email confirmation continuity. No real emails are sent. |
| Business wallet browser suite | 21 interaction checks and 5 responsive widths passed: phone validation, exact amounts, stable retry keys, saved checkout, status recovery and server confirmation before funds appear. Confirmed funds under a spending hold are not described as available. |
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
| Previously credited deposit is reported reversed | Local code now creates a protective spending hold, including discrepancies arriving before confirmation. Existing obligations and evidence remain intact. | Establish evidence-based provider reconciliation and an audited hold-resolution process. No clawback, balance override or hold-release command exists. |
| Instagram evidence stays inaccessible or repeatedly exceeds scan limits | Local admin can retry or close only `needs_review` tasks without payment, with required reason, preserved evidence, invalidated leases and exact unused-budget release. | Exercise the deployed singleton/AAL2 flow and agree operational handling of genuine work whose evidence cannot be obtained. |

Linked payment/task investigation and paginated administrative reads are now local code; their deployed acceptance remains outstanding. Resolving a support case records a response; it does not refund a payment, clear a financial hold or decide a task. Unpaid task closure is a separate audited command. Closing a campaign returns unused funds to the business's RealReach wallet, not its bank.

### Release and external setup

1. Approve and apply the two new migrations and deploy the four functions, then verify deployed schema, permissions and scheduler. Follow the [backend release handoff](RealReach-Marketplace-Backend-Handoff-2026-10-21.md) to reconcile local historical filenames to the actual applied migration versions before any `db push`; never replay old migrations blindly.
2. Deploy the matching frontend and run actual browser → server → database checks as separate ordinary worker/business accounts, including cross-user and admin denial. Validate deployed request concurrency as well as the isolated database races above.
3. Configure a transactional sender for confirmation/recovery emails. The live default sender is not ready for public signup. Align the live password minimum with the app's 12-character rule.
4. Complete the founder's authenticator setup and approve prices, fees, retention and volume limits. These are commercial decisions, not API-key settings.
5. Add RealReach's own RocketAPI and PocketFi secrets securely; register the deployed PocketFi webhook. Confirm payout-status behavior with the merchant account before enabling withdrawals.
6. Run controlled real-provider checks and separately authorized small collection/payout tests. Check delivery timing, fees, webhook replay and unknown outcomes before inviting paying customers.
7. Configure the operations sender and external monitor, verify the actual scheduled ledger check and alert receipt, and establish a tested backup/restore routine. The local monitoring code does not prove deployed scheduling or email delivery.

Pattern checks of all 150 Git candidate files and the production browser bundle found no matches for the scanned Supabase PAT, Supabase secret-key or Google client-secret formats. The local credential directory and environment file are Git-ignored and excluded from Vercel uploads. This is a targeted check, not proof that every possible secret format has been detected.

The CEO's CAC/PocketFi delay does not block RocketAPI registration, sender setup, code work or isolated acceptance testing. It does block meaningful live collection/payout acceptance. Keys alone should not automatically enable unrestricted money movement.
