# RealReach V1 readiness review

Reviewed and updated 21 October 2026. RealReach is not yet complete end to end, and provider keys are not the only remaining work. The marketplace release is now pushed and deployed to the website and database; top-ups and payouts are explicitly disabled. The reversal-ordering, support-routing, investigation-history and mobile task-entry fixes are included. Financial exception resolution, operational readiness and real-provider acceptance are still required before customer transactions.

The CEO's CAC delay affects PocketFi activation. It does not prevent the remaining engineering, Rocket setup, email setup or independent account testing. The owner subsequently authorized this deployment and no-money live acceptance. No money movement or payment activation was authorized.

## What is live

| Area | Deployed functionality | Remaining acceptance |
| --- | --- | --- |
| Accounts | Real Supabase Auth, Google enabled, fixed account types, sole admin and stale-session handling | Delivered signup/reset emails, fresh Google exchange and founder MFA |
| Business | Owned records, saved drafts, campaign builder, quote/funding/publication controls and receipts | Genuine provider target, approved prices and authorized funding/delivery |
| Worker | Discovery, ownership challenge, claims, submission, scheduled checks, results and wallet | Actual Rocket observations and funded work |
| Money | Ledger, payment intents, holds, webhook/reconciliation and investigation tools; both launch gates OFF | Merchant contracts, live collection/payout acceptance and unresolved financial recovery |
| Operations | Cases/checks/investigations, settings, health screen, ledger checks and alert outbox; monitor cron verified | Admin AAL2 acceptance, sender/alert delivery, daily check and external monitoring |

The release verified the expected RealReach project, `jabwuawiqsusjrccapab`, as healthy, applied three new migrations and deployed four new Edge Functions alongside the existing four. All public tables have RLS and financial/operations RPCs remain private. Release commit `f2e4209` is pushed; GitHub's Vercel deployment is READY at https://realreach.com.ng. Both payment gates are false and payouts are paused. Detailed release and live-test evidence is maintained in [implementation QA](RealReach-Marketplace-Implementation-QA.md).

This release supersedes the earlier audit's code and deployment baseline. Older Zernio/DM/prototype descriptions are historical. Rocket with a public-profile ownership challenge is the deployed implementation, pending provider acceptance.

## Account journey

Sign up or log in → confirm email where required → choose worker or business once → complete details → enter the correct workspace → restore the session on return → sign out or recover access.

| Pages | Actions and backend | Readiness |
| --- | --- | --- |
| `/`, `/help`, `/terms`, `/privacy` | Navigation, signup/login entry points, product and account guidance | Implemented. Published task, refund and review rules still need to match the final operating policy. |
| `/signup`, `/login` | Official Google button, direct Supabase ID-token exchange, email/password Auth | Google is enabled in production and nonce checking is retained. Fresh and returning real Google sessions still need release acceptance. |
| `/verify-email`, `/auth/callback` | Resend, confirmation callback, onboarding continuity and invalid-link recovery | Local interaction tests pass. Production has no custom SMTP and a two-email/hour limit. Public email signup is not ready. |
| `/forgot-password`, `/reset-password` | Recovery request and authenticated password change | Built. Delivered recovery emails and mobile email-app/browser handoff still need testing. |
| `/start`, `/onboarding` | Server-owned, one-time account choice; business creation where appropriate | Passed live with separate ordinary worker/business accounts, including rejection of later role changes. No ordinary worker/business switching. |
| `/account`, shared navigation | Profile, security, authenticator setup, notifications, support and sign-out | Implemented. Production has zero verified TOTP factors; founder enrollment remains necessary. |

Production's password minimum is six characters while the frontend requires twelve. Align the server rule. CAPTCHA is currently disabled; abuse protection should be an explicit release decision rather than an assumed completed feature.

Sources: [routes](../src/live/LiveApp.tsx), [Google](../src/live/GoogleSignIn.tsx), [onboarding](../src/live/Onboarding.tsx), [access guards](../src/live/Workspace.tsx), [session handling](../src/live/AuthContext.tsx). Supabase documents the default sender's production limitations in its [SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp).

## Worker journey

Verify Instagram ownership → discover suitable work → read reward and rules → accept a place → wait for eligibility → complete the action in Instagram → submit → see checking/pending/result → receive available earnings after the final check → withdraw to a verified bank account.

| Pages | Actions and backend | Remaining acceptance |
| --- | --- | --- |
| `/earn/instagram` | Issue an expiring bio code, open Instagram, check ownership, bind stable account ID and disconnect subject to unfinished work | Actual Rocket profile reads, propagation delay, changed handles, duplicate ownership and private accounts |
| `/earn` | Search/filter/paginate eligible funded campaigns; resume work | Real shared campaign visibility, eligibility and provider-paused states |
| `/earn/tasks/:id` | View terms and accept; server reserves one funded place and schedules eligibility checking | Funded task claims, last-place race through the deployed API and correct decline states; ordinary worker authentication and private-draft denial passed live |
| `/earn/my-tasks`, `/earn/assignments/:id` | Resume, open Instagram, submit/check, retry, cancel where permitted, view result and contact support | Real follow/comment observations, deletion/unfollow, scheduled retention, outage recovery and phone return from Instagram |
| `/earn/wallet` | Separate available/pending/withdrawing funds, history, bank resolution and withdrawal | PocketFi activation, genuine bank response, one authorized payout and uncertain/failure recovery |

The same Instagram account or paid action cannot simply be reused for another reward. Screenshots do not release payment. Public-account control is not proof that a person owns only one account. Likes are not independently verified; any like-and-comment offer must clearly state that comments are the checked deliverable.

The normal path is automated. Large following lists and deep comment threads have bounded scans and can require review. Current tests do not establish unlimited unattended throughput. Comment results are shared within a job batch, not globally across all work on a post.

Sources: [worker screens](../src/live/WorkerPages.tsx), [account and wallet screens](../src/live/AccountFlows.tsx), [Rocket adapter](../supabase/functions/_shared/rocket.ts), [scheduled checks](../supabase/functions/_shared/marketplace-jobs.ts).

## Business journey

Create the business account → save business details → prove Instagram ownership → create a campaign → review an exact price → add funds → publish → track delivery → pause/resume or close → review receipts or raise a case.

| Pages | Actions and backend | Remaining acceptance |
| --- | --- | --- |
| `/business`, `/business/settings` | Setup checklist, real totals, details and campaign entry points | Ordinary business details, owner isolation and zero-wallet reads passed live; funded totals remain untested |
| `/business/instagram` | Public-profile ownership challenge, stable target identity and disconnect protection | Real Rocket account and owned-media checks; no per-business worker DM step |
| `/business/campaigns` | Search, filters, pagination and edit/resume saved drafts | Live draft creation, update, quote, session-restored readback and cross-owner denial passed; funded campaign acceptance remains |
| `/business/campaigns/new`, `/business/campaigns/:id/edit` | Four-step builder, autosave/recovery, validation, server quote, explicit acceptance and publication | Approved prices, provider-validated target and genuinely confirmed funds |
| `/business/wallet` and `/business/billing` | Top-up amount/phone, checkout, return, resume, status, balance and history | PocketFi collection, authenticated callback and reconciliation |
| `/business/campaigns/:id` | Delivery counts, receipts, pause/resume, close and support | Real cross-account completion, failed checks and remaining-budget accounting |

Closing a campaign returns unused funds to the business's RealReach wallet, not automatically to its bank. Accepted work retains its allocated budget. A business cannot reject an ordinary verified completion to avoid paying.

Sources: [business screens](../src/live/BusinessPages.tsx), [wallet](../src/live/AccountFlows.tsx), [commands](../supabase/functions/_shared/marketplace-handler.ts), [transaction rules](../supabase/migrations/20261021165450_marketplace_production_core.sql).

## Support and sole admin journey

The admin signs in normally, completes the authenticator check, reviews cases/checks/payments, uses restricted recovery actions and leaves an audit trail. Other accounts must be denied at both the UI and server.

| Pages | Deployed implementation | Remaining gap |
| --- | --- | --- |
| `/support`, `/notifications` | Saved cases, task/payment references, responses and read state | Live support creation, persistence and cross-user isolation passed; admin responses and notification delivery still need acceptance |
| `/admin` | Counts, workload/provider readiness, operations health, explicit read-only ledger check and saved alert outcomes | Founder MFA, sender setup, actual alert receipt and external uptime monitor; monitor cron is verified |
| Cases/checks/payments/audit tabs | Search, filters, pagination and server-resolved owner-checked case links | Ordinary-account admin denial passed live; authenticated founder investigation acceptance remains |
| Payment investigation | Masked recipient, status, discrepancy history and provider recheck | Safe resolution of lost-reference/failed payouts and financial holds |
| Task investigation | Terms, linked Instagram identity, evidence, older-history pagination, retries and audited closure without payment | Deployed identity and evidence acceptance |
| Campaign investigation | Read-only campaign details and owner-checked related cases | Deployed business/support acceptance |
| Settings | Explicit price/fee confirmation and withdrawal pause | Founder approval of commercial values and operating limits |

A case response is not a refund. Rechecking a payment is not permission to resend it. Closing an unresolved task does not mark it verified or pay a reward.

Sources: [admin console](../src/live/AdminConsole.tsx), [investigations](../src/live/AdminInvestigation.tsx), [admin reads](../supabase/functions/_shared/marketplace-admin.ts).

## Specific defects and unfinished work

1. **Payment-reversal ordering: fixed and deployed.** The initial audit reproduced a reversal being missed while a payment was pending. Signed adverse events are now retained before or after confirmation; later credit and the protective hold share the same database lock. Independent review also caught and fixed stale pending responses falsely freezing settled payments, and adverse aliases being missed in wrapped notifications. Definite terminal conflicts still raise review. See [webhook](../supabase/functions/pocketfi-webhook/handler.ts) and [settlement/hold rules](../supabase/migrations/20261021165450_marketplace_production_core.sql). This was an unreleased-code defect, not evidence of a live loss. Actual PocketFi event contracts still need merchant acceptance.
2. **Finish financial recovery.** Known references can be rechecked, but lost payout references and ambiguous failure/reversal outcomes can leave funds held indefinitely. PocketFi must establish the definitive correlation/failure evidence. Define and implement an audited resolution process; never solve this with a guessed reference, repeat transfer or free-form balance edit. Active financial holds currently have no release path. See [recovery](../supabase/functions/_shared/marketplace-payments.ts#L46).
3. **Support investigation routing: fixed and deployed.** The server resolves each reference to a payment, task or campaign owned by the case's participant. Unrelated, ambiguous or unavailable references do not become guessed links. Campaigns have a read-only admin detail page. See [investigation screens](../src/live/AdminInvestigation.tsx) and [reference resolution](../supabase/functions/_shared/marketplace-admin.ts).
4. **Investigation context: fixed and deployed.** Task detail shows the linked stable Instagram identity alongside observed evidence. Scoped cursor pagination reaches older evidence, discrepancies, jobs, cases and audit records. Failed history requests can be retried without losing already loaded records.
5. **Operational monitoring deployed; monitor cron verified.** Five-minute issue snapshots, daily consistent ledger checks and a throttled Resend outbox now back the admin health screen. Retries freeze the complete message and key; an uncertain result is never labelled delivered. Cross-layer tests caught and fixed a database/sender key-format mismatch. Still required: sender verification, real alert receipt, acceptance of the daily scheduled check, external uptime checks and a tested backup/restore routine. The public health URL reports monitor freshness, not that every provider/payment is healthy. See [operations contract](RealReach-Provider-Contracts.md#operations-email-resend).
6. **Mobile task entry: refined and deployed.** Discover now prioritizes resumable work and the task feed, with a compact balance link instead of a large promotional banner. Wallet forms show the recipient, fee and total, explain unavailable actions, and recover from changed fees or a failed bank list. Physical phone keyboards, slow connections and Safari remain acceptance checks; Chromium viewport tests do not cover those behaviors.
7. **Withdrawal fee consent: fixed and deployed, with money disabled.** New requests carry the displayed fee and terms version. The server rejects changed terms before reserving funds. Refresh keeps the amount and recipient and never automatically resubmits. Retries of an existing intent retain their original fee. Held businesses cannot resume campaigns from the UI or server.

## Verification evidence

Current reruns passed:

- TypeScript and production build; `git diff --check`.
- 116 unit/contract tests. This includes historical simulator tests, which are not evidence for production money behavior.
- 94 isolated PostgreSQL/PGlite checks covering authorization, ledger transitions, quotes, fee consent, capacity, holds and recovery.
- 33 additional operations database checks, including SQL → runner → mailer → SQL with injected transport.
- 11 additional database launch-gate checks: closed-by-default payment creation/dispatch, guarded transitions and continued reconciliation of existing obligations.
- 99 offline HTTP/recovery/operations tests using the real handlers with controlled dependencies, including 23 admin boundary/history tests.
- Eight browser suites against the rebuilt local production bundle: worker 22 checks, business 23, wallet 22, auth 13, account-switch races 7, admin 15, investigations 21 and money guards 15. Responsive coverage includes 360, 390, 430, 768 and 1440 pixels, plus a short 390 × 500 wallet viewport. Representative phone and desktop screenshots were inspected.
- Following the operations changes, the new operations suite passed 14 checks at four widths and the affected investigation suite passed its 21 checks/15 layouts again on the rebuilt preview. Larger mobile text, filtered queue links, the real bottom navigation and visible ledger-check button were visually checked. These are isolated browser fixtures, not a live email or payment test.

The backend verification pass also completed 31 native PostgreSQL checks across 29 synchronized multi-connection races, with no deadlocks or timeouts; its isolated server was stopped. These include adverse events before/after confirmation, stale responses, changed withdrawal fees, reconciliation during funding, concurrent alert leases/preparation/finish and launch-gate behavior. These tests do not measure live provider throughput.

**Ordinary-account live acceptance: 30/30 checks passed** through the public Supabase SDK and deployed marketplace API, using separate confirmed QA worker/business accounts. This exercised password sign-in, ordinary onboarding, rejection of later role changes, workspace reads, direct-RPC/private-table denial, admin denial, cross-owner profile/business/draft/support isolation, business details, draft creation/update/quote, saved support cases, restored-session draft readback, local sign-out invalidating the old JWT and returning sign-in. The run created exactly one labelled unfunded QA draft and two labelled support cases. No funding, withdrawal, publication, bank, Instagram/provider or email action was requested. See [the test](../tests/live-marketplace-acceptance.mjs) and [sanitized report](../outputs/qa/live-acceptance/2026-10-21T19-28-10.928Z/report.json).

An independent post-test read-only query reconfirmed the expected healthy RealReach project and these counts: 6 Auth users, 6 profiles, 1 business, 1 campaign and 2 support cases; **0 payments, 0 journals, 0 ledger entries, 0 ledger accounts and zero ledger balance**. Collections and payouts remain disabled and payouts remain paused. Only counts and gate values were inspected, not account or support contents.

These live tests used owner-provisioned, already-confirmed QA accounts; they do not prove public email signup, email delivery or Google consent. The two accounts cover worker/business cross-owner restrictions, not isolation between two different business owners. Founder MFA, funded task completion and provider acceptance remain separate checks.

The subsequent live browser pass also completed 11 real form-write checks and
mobile/desktop account/read/access checks. Business details and the existing
draft were restored after persistence verification; one additional labelled QA
support request remains (three cases total). Final financial state and jobs are
still zero, with both payment gates closed. Visual review found and fixed a dark
button-label contrast issue in deployed commit `e7442a2`. One initial account-read
401 did not recur on the final passing run; its cause remains undetermined.
See [live browser evidence and limits](RealReach-Marketplace-Implementation-QA.md#live-browser-acceptance).

The isolated browser suites listed above intercept backend/provider responses. Their results are not live acceptance. The subsequent release added separate real API/browser checks, recorded in [implementation QA](RealReach-Marketplace-Implementation-QA.md), with no money movement. No fresh real Google exchange, delivered confirmation/reset email, Rocket observation or PocketFi payment has been completed in this release. The reproduced ordering defects have passing regression coverage and their fixes are now deployed.

## Finish in focused passes

1. **Remaining engineering closure:** evidence-backed financial-resolution design and implementation, plus a tested restore routine. Monitoring/alerts and read-only reconciliation are deployed, and the monitor cron is verified; sender delivery and the daily scheduled check still need acceptance. The ordering/navigation/history/mobile fixes above are deployed. Definitive payout/reversal handling still requires the merchant contract.
2. **Remaining account acceptance:** deployment, migration-history reconciliation and the 30 ordinary worker/business API checks are complete. Configure the sender, align Auth rules, enroll admin MFA and test delivered confirmation/recovery emails and a fresh Google exchange. Add a second business owner for same-role isolation coverage. Keep money unavailable until its acceptance is complete.
3. **Instagram acceptance as soon as Rocket is ready:** ownership, baseline, completion, removal/deletion, retention, retries, large-list limits and actual request cost. This can proceed before PocketFi approval without inventing live balances or rewards.
4. **Money acceptance when PocketFi is approved:** merchant configuration, webhook registration, payout-status/recovery contract and separately authorized low-value collection/payout tests. Reconcile every result before enabling the paid workflow.

The CEO's setup list remains Rocket, PocketFi and a transactional email sender such as Resend, plus founder authenticator enrollment. Prices, fees, retention, refund/review rules and initial volume limits need explicit approval. Do not treat receipt of the keys as automatic permission to enable unrestricted spending.

The connected release is deployed. The next useful deliverable is closure of these specific gaps and controlled provider acceptance, not another set of mock customer pages. The CEO's acceptance group should use the same real account and transaction flow as customers; payments remain off until separately approved and tested.
