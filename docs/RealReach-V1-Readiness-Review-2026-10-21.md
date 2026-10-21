# RealReach V1 readiness review

Reviewed and updated 21 October 2026. RealReach is not yet complete end to end, and provider keys are not the only remaining work. The current checkout has substantially more functionality than the live website. The follow-up implementation fixed the identified reversal-ordering, support-routing, investigation-history and mobile task-entry gaps locally. Financial exception resolution, operational readiness, deployment and real-provider acceptance are still required before customer transactions.

The CEO's CAC delay affects PocketFi activation. It does not prevent the remaining engineering, Rocket setup, email setup or independent account testing. This review does not authorize deployment or money movement.

## What is live and what is local

| Area | Production now | Current checkout |
| --- | --- | --- |
| Accounts | Real Supabase Auth, Google enabled, fixed worker/business account types and the sole admin | Preserved, with stronger session-loading and stale-response handling |
| Business | Owned business records and saved drafts | Full campaign builder, price approval, funding UI, publication, controls and delivery receipts |
| Worker | Earlier empty task screens; no paid marketplace | Task discovery, account ownership, claims, submission, scheduled checks, results and wallet |
| Money | No new marketplace ledger or PocketFi functions installed | Ledger, funding, payout intents, reconciliation, holds and investigation tools |
| Operations | Earlier restricted admin page | Cases, checks, investigations, pricing/payout pause, health screen, read-only ledger checks and alert outbox |

The earlier read-only inspection confirmed the expected RealReach project, `jabwuawiqsusjrccapab`, was healthy. It had 12 public tables with RLS, three September migrations and the four older Edge Functions. The new marketplace/operations tables and four new functions have not been deployed. The website serves a different bundle from the current local build. The new work remains uncommitted; the checkout's HEAD is `960932e`.

The local implementation supersedes the earlier audit's unfinished-code findings, not its deployed-state findings. Older Zernio/DM/prototype descriptions are historical. Rocket with a public-profile ownership challenge is the current local implementation.

## Account journey

Sign up or log in → confirm email where required → choose worker or business once → complete details → enter the correct workspace → restore the session on return → sign out or recover access.

| Pages | Actions and backend | Readiness |
| --- | --- | --- |
| `/`, `/help`, `/terms`, `/privacy` | Navigation, signup/login entry points, product and account guidance | Implemented. Published task, refund and review rules still need to match the final operating policy. |
| `/signup`, `/login` | Official Google button, direct Supabase ID-token exchange, email/password Auth | Google is enabled in production and nonce checking is retained. Fresh and returning real Google sessions still need release acceptance. |
| `/verify-email`, `/auth/callback` | Resend, confirmation callback, onboarding continuity and invalid-link recovery | Local interaction tests pass. Production has no custom SMTP and a two-email/hour limit. Public email signup is not ready. |
| `/forgot-password`, `/reset-password` | Recovery request and authenticated password change | Built. Delivered recovery emails and mobile email-app/browser handoff still need testing. |
| `/start`, `/onboarding` | Server-owned, one-time account choice; business creation where appropriate | Existing real flow. No ordinary worker/business switching. Test with separate new accounts after release. |
| `/account`, shared navigation | Profile, security, authenticator setup, notifications, support and sign-out | Implemented. Production has zero verified TOTP factors; founder enrollment remains necessary. |

Production's password minimum is six characters while the frontend requires twelve. Align the server rule. CAPTCHA is currently disabled; abuse protection should be an explicit release decision rather than an assumed completed feature.

Sources: [routes](../src/live/LiveApp.tsx), [Google](../src/live/GoogleSignIn.tsx), [onboarding](../src/live/Onboarding.tsx), [access guards](../src/live/Workspace.tsx), [session handling](../src/live/AuthContext.tsx). Supabase documents the default sender's production limitations in its [SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp).

## Worker journey

Verify Instagram ownership → discover suitable work → read reward and rules → accept a place → wait for eligibility → complete the action in Instagram → submit → see checking/pending/result → receive available earnings after the final check → withdraw to a verified bank account.

| Pages | Actions and backend | Remaining acceptance |
| --- | --- | --- |
| `/earn/instagram` | Issue an expiring bio code, open Instagram, check ownership, bind stable account ID and disconnect subject to unfinished work | Actual Rocket profile reads, propagation delay, changed handles, duplicate ownership and private accounts |
| `/earn` | Search/filter/paginate eligible funded campaigns; resume work | Real shared campaign visibility, eligibility and provider-paused states |
| `/earn/tasks/:id` | View terms and accept; server reserves one funded place and schedules eligibility checking | Actual worker JWT, last-place race through the deployed API and correct decline states |
| `/earn/my-tasks`, `/earn/assignments/:id` | Resume, open Instagram, submit/check, retry, cancel where permitted, view result and contact support | Real follow/comment observations, deletion/unfollow, scheduled retention, outage recovery and phone return from Instagram |
| `/earn/wallet` | Separate available/pending/withdrawing funds, history, bank resolution and withdrawal | PocketFi activation, genuine bank response, one authorized payout and uncertain/failure recovery |

The same Instagram account or paid action cannot simply be reused for another reward. Screenshots do not release payment. Public-account control is not proof that a person owns only one account. Likes are not independently verified; any like-and-comment offer must clearly state that comments are the checked deliverable.

The normal path is automated. Large following lists and deep comment threads have bounded scans and can require review. Current tests do not establish unlimited unattended throughput. Comment results are shared within a job batch, not globally across all work on a post.

Sources: [worker screens](../src/live/WorkerPages.tsx), [account and wallet screens](../src/live/AccountFlows.tsx), [Rocket adapter](../supabase/functions/_shared/rocket.ts), [scheduled checks](../supabase/functions/_shared/marketplace-jobs.ts).

## Business journey

Create the business account → save business details → prove Instagram ownership → create a campaign → review an exact price → add funds → publish → track delivery → pause/resume or close → review receipts or raise a case.

| Pages | Actions and backend | Remaining acceptance |
| --- | --- | --- |
| `/business`, `/business/settings` | Setup checklist, real totals, details and campaign entry points | Ordinary business ownership and real data after deployment |
| `/business/instagram` | Public-profile ownership challenge, stable target identity and disconnect protection | Real Rocket account and owned-media checks; no per-business worker DM step |
| `/business/campaigns` | Search, filters, pagination and edit/resume saved drafts | Existing draft migration and ownership under the deployed API |
| `/business/campaigns/new`, `/business/campaigns/:id/edit` | Four-step builder, autosave/recovery, validation, server quote, explicit acceptance and publication | Approved prices, provider-validated target and genuinely confirmed funds |
| `/business/wallet` and `/business/billing` | Top-up amount/phone, checkout, return, resume, status, balance and history | PocketFi collection, authenticated callback and reconciliation |
| `/business/campaigns/:id` | Delivery counts, receipts, pause/resume, close and support | Real cross-account completion, failed checks and remaining-budget accounting |

Closing a campaign returns unused funds to the business's RealReach wallet, not automatically to its bank. Accepted work retains its allocated budget. A business cannot reject an ordinary verified completion to avoid paying.

Sources: [business screens](../src/live/BusinessPages.tsx), [wallet](../src/live/AccountFlows.tsx), [commands](../supabase/functions/_shared/marketplace-handler.ts), [transaction rules](../supabase/migrations/20261021165450_marketplace_production_core.sql).

## Support and sole admin journey

The admin signs in normally, completes the authenticator check, reviews cases/checks/payments, uses restricted recovery actions and leaves an audit trail. Other accounts must be denied at both the UI and server.

| Pages | Implemented locally | Remaining gap |
| --- | --- | --- |
| `/support`, `/notifications` | Saved cases, task/payment references, responses and read state | Genuine cross-user isolation and response delivery |
| `/admin` | Counts, workload/provider readiness, operations health, explicit read-only ledger check and saved alert outcomes | Deployed data, founder MFA, sender setup, actual alert receipt and external uptime monitor |
| Cases/checks/payments/audit tabs | Search, filters, pagination and server-resolved owner-checked case links | Deployed permission and real-case acceptance |
| Payment investigation | Masked recipient, status, discrepancy history and provider recheck | Safe resolution of lost-reference/failed payouts and financial holds |
| Task investigation | Terms, linked Instagram identity, evidence, older-history pagination, retries and audited closure without payment | Deployed identity and evidence acceptance |
| Campaign investigation | Read-only campaign details and owner-checked related cases | Deployed business/support acceptance |
| Settings | Explicit price/fee confirmation and withdrawal pause | Founder approval of commercial values and operating limits |

A case response is not a refund. Rechecking a payment is not permission to resend it. Closing an unresolved task does not mark it verified or pay a reward.

Sources: [admin console](../src/live/AdminConsole.tsx), [investigations](../src/live/AdminInvestigation.tsx), [admin reads](../supabase/functions/_shared/marketplace-admin.ts).

## Specific defects and unfinished work

1. **Payment-reversal ordering: fixed locally.** The initial audit reproduced a reversal being missed while a payment was pending. Signed adverse events are now retained before or after confirmation; later credit and the protective hold share the same database lock. Independent review also caught and fixed stale pending responses falsely freezing settled payments, and adverse aliases being missed in wrapped notifications. Definite terminal conflicts still raise review. See [webhook](../supabase/functions/pocketfi-webhook/handler.ts) and [settlement/hold rules](../supabase/migrations/20261021165450_marketplace_production_core.sql). This was an unreleased-code defect, not evidence of a live loss. Actual PocketFi event contracts still need merchant acceptance.
2. **Finish financial recovery.** Known references can be rechecked, but lost payout references and ambiguous failure/reversal outcomes can leave funds held indefinitely. PocketFi must establish the definitive correlation/failure evidence. Define and implement an audited resolution process; never solve this with a guessed reference, repeat transfer or free-form balance edit. Active financial holds currently have no release path. See [recovery](../supabase/functions/_shared/marketplace-payments.ts#L46).
3. **Support investigation routing: fixed locally.** The server resolves each reference to a payment, task or campaign owned by the case's participant. Unrelated, ambiguous or unavailable references do not become guessed links. Campaigns have a read-only admin detail page. See [investigation screens](../src/live/AdminInvestigation.tsx) and [reference resolution](../supabase/functions/_shared/marketplace-admin.ts).
4. **Investigation context: fixed locally.** Task detail shows the linked stable Instagram identity alongside observed evidence. Scoped cursor pagination reaches older evidence, discrepancies, jobs, cases and audit records. Failed history requests can be retried without losing already loaded records.
5. **Operational monitoring implemented locally.** Five-minute issue snapshots, daily consistent ledger checks and a throttled Resend outbox now back the admin health screen. Retries freeze the complete message and key; an uncertain result is never labelled delivered. Cross-layer tests caught and fixed a database/sender key-format mismatch. Still required: deployment, sender verification, real alert receipt, external uptime checks and a tested backup/restore routine. The public health URL reports monitor freshness, not that every provider/payment is healthy. See [operations contract](RealReach-Provider-Contracts.md#operations-email-resend).
6. **Mobile task entry: refined locally.** Discover now prioritizes resumable work and the task feed, with a compact balance link instead of a large promotional banner. Wallet forms show the recipient, fee and total, explain unavailable actions, and recover from changed fees or a failed bank list. Physical phone keyboards, slow connections and Safari remain release checks; Chromium viewport tests do not cover those behaviors.
7. **Withdrawal fee consent: fixed locally.** New requests carry the displayed fee and terms version. The server rejects changed terms before reserving funds. Refresh keeps the amount and recipient and never automatically resubmits. Retries of an existing intent retain their original fee. Held businesses cannot resume campaigns from the UI or server.

## Verification evidence

Current reruns passed:

- TypeScript and production build; `git diff --check`.
- 116 unit/contract tests. This includes historical simulator tests, which are not evidence for production money behavior.
- 94 isolated PostgreSQL/PGlite checks covering authorization, ledger transitions, quotes, fee consent, capacity, holds and recovery.
- 33 additional operations database checks, including SQL → runner → mailer → SQL with injected transport.
- 96 offline HTTP/recovery/operations tests using the real handlers with controlled dependencies, including 23 admin boundary/history tests.
- Eight browser suites against the rebuilt local production bundle: worker 22 checks, business 22, wallet 21, auth 13, account-switch races 7, admin 15, investigations 21 and money guards 15. Responsive coverage includes 360, 390, 430, 768 and 1440 pixels, plus a short 390 × 500 wallet viewport. Representative phone and desktop screenshots were inspected.
- Following the operations changes, the new operations suite passed 14 checks at four widths and the affected investigation suite passed its 21 checks/15 layouts again on the rebuilt preview. Larger mobile text, filtered queue links, the real bottom navigation and visible ledger-check button were visually checked. These are isolated browser fixtures, not a live email or payment test.

The backend verification pass also completed 29 native PostgreSQL checks across 28 synchronized multi-connection races, with no deadlocks or timeouts; its isolated server was stopped. These include adverse events before/after confirmation, stale responses, changed withdrawal fees, reconciliation during funding and concurrent alert leases/preparation/finish. These tests do not measure live provider throughput.

Browser suites intercept backend/provider responses and do not create customers or move money. They establish that the interface handles those responses, not that the deployed service produced them. No fresh real Google exchange, delivered confirmation/reset email, Rocket observation or PocketFi payment was completed in this review. The reproduced ordering defects now have passing regression coverage. No live schema, function or frontend change was made in this follow-up.

## Finish in focused passes

1. **Remaining engineering closure:** evidence-backed financial-resolution design and implementation, plus a tested restore routine. Monitoring/alerts and read-only reconciliation are now local code; actual scheduling and receipt need deployment acceptance. The ordering/navigation/history/mobile fixes above are locally complete. Definitive payout/reversal handling still requires the merchant contract.
2. **Release and account acceptance:** reconcile historical migration filenames, install the new schema/functions and matching frontend with approval, configure the sender, align Auth rules and enroll admin MFA. Exercise separate ordinary worker/business accounts and denied cross-account/admin requests. Keep money unavailable until its acceptance is complete.
3. **Instagram acceptance as soon as Rocket is ready:** ownership, baseline, completion, removal/deletion, retention, retries, large-list limits and actual request cost. This can proceed before PocketFi approval without inventing live balances or rewards.
4. **Money acceptance when PocketFi is approved:** merchant configuration, webhook registration, payout-status/recovery contract and separately authorized low-value collection/payout tests. Reconcile every result before enabling the paid workflow.

The CEO's setup list remains Rocket, PocketFi and a transactional email sender such as Resend, plus founder authenticator enrollment. Prices, fees, retention, refund/review rules and initial volume limits need explicit approval. Do not treat receipt of the keys as automatic permission to enable unrestricted spending.

The next useful deliverable is the closure of these specific gaps and a connected release, not another set of mock customer pages. The CEO's acceptance group should use the same real account and transaction flow as customers.
