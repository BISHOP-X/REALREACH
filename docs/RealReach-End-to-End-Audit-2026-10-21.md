# RealReach production journey audit

21 October 2026. For the founders: what customers can do today, what still needs building, and what can proceed while PocketFi registration is delayed.

## Conclusion

RealReach is not complete end to end. The live product has genuine account access, fixed worker/business account types, a protected single admin and database-backed campaign drafts. It does not yet deliver the paid marketplace loop.

The CAC delay blocks PocketFi merchant activation; it does not explain the missing campaign, task, verification, wallet and operations features. Those are engineering work we can advance now. Adding provider keys alone would not make the current product ready.

The founder's latest direction is Instagram only, RocketAPI for verification and PocketFi for payments. The code still implements the earlier Zernio connection/checking model. Older multi-platform and simulated-flow documents are historical, not evidence that these features exist in production.

## Live product and unfinished local work

The journey inventory below describes the live application and its currently wired routes. New local files do not change that assessment: `LiveApp.tsx` still imports the older workspace and draft screens, and the live database still has only the three earlier migrations.

Local additions include worker task/detail/progress pages; a business overview, campaign builder and delivery pages; Instagram, wallet and support forms; Rocket/PocketFi adapters; and a proposed marketplace schema/API. They are not connected end to end, deployed or ready to release.

The latest local check found:

- `npm test`: 82 passing tests. This includes 41 new provider contract tests with injected HTTP responses, not live provider transactions. Eighteen older tests cover the local workflow model, not the deployed database.
- `npm run build`: fails with four TypeScript errors in the new files: two unavailable icon imports, a missing quote field and untyped environment access.
- Backend Deno check: six nullable-value errors reported in the new marketplace handler/payment helper.
- The new migration is unexecuted. The marketplace job runner, integrated payment webhook and database transaction regression tests are unfinished.
- The new screens still need route integration, shared styling, real API matching and phone/desktop interaction tests.

Do not deploy this partial work as a finished release. Provider keys will not repair these gaps. The latest live table/migration recheck and eleven SDK/API access checks passed without changing customer records or moving money.

## Current journeys

### Worker

Sign up or log in → finish worker onboarding → Discover → **journey stops**.

Discover and My tasks always render empty states; they do not query a task marketplace. There is no active worker Instagram-linking page, task detail, acceptance, work submission, verification receipt or withdrawal flow. `/earn/instagram` redirects to My tasks. Changing the database or supplying a provider key would not populate this hardcoded feed.

The complete V1 journey should be:

1. Create an account and choose Worker once.
2. Link an Instagram account and prove control. Explain public-account eligibility before the user starts.
3. Browse eligible funded tasks. Open the target, reward, rules and release time before accepting.
4. Accept one reserved place. Check existing-follow eligibility before telling someone to do work.
5. Open Instagram, perform the action and return to the same saved assignment.
6. Request a server check. Show checking, detected/pending, retry, unsuccessful or review states with a clear next action.
7. Run the final check automatically; record one reward and a receipt.
8. Show available earnings, verify the payout beneficiary, request withdrawal and track its actual outcome.

Refresh, leaving for Instagram, closing the browser and a temporary provider outage must preserve the assignment. A screenshot or a button press must never credit earnings.

### Business

Sign up or log in → business onboarding → Overview → create/edit a follow draft → **journey stops**.

The draft stores a title and quantity, not a priced, funded, published campaign. Instagram connection is an older Zernio operation, currently unavailable. Funds is an unavailable screen. There is no live delivery dashboard.

The complete V1 journey should be:

1. Create a Business account and save business details.
2. Prove control of the target Instagram account and resolve its stable ID.
3. Choose Follow or Comment, select the account/post, set quantity and enter any objective comment instructions.
4. See a server-calculated price, worker reward, fees and rules. Save and resume a complete draft.
5. Top up any shortfall; wait for confirmed funds. Publish once, reserving the campaign budget.
6. Track remaining places, active assignments, pending checks, delivered actions and spend.
7. Pause/resume or close the campaign. Closing preserves outstanding worker allocations and returns only unused funds.
8. Open delivery receipts or report a disputed result. A business cannot veto correctly verified work to avoid payment.

No new business record, draft or payment was created for this audit.

## Page and button inventory

“Connected” below means the implementation calls the backend. The test section distinguishes inspected code from actions actually exercised today.

| Page | Current actions and backend | Gap before V1 |
| --- | --- | --- |
| `/` | Business/worker signup links, login, help and section navigation. Mobile menu opens, closes, locks background scrolling and closes when resized to desktop. | Product claims need to match the released capabilities. The current landing page describes a task-and-reward service the signed-in product cannot yet deliver. |
| `/login` | Password login, official Google button, password visibility, recovery and signup links. | Fresh ordinary-user Google exchange, account recovery and session-expiry acceptance checks. |
| `/signup` | Worker/business choice, Google and email signup. Choice is an onboarding hint, not permission. | Public email confirmation is blocked by sender setup. Retest both account types with real new users. |
| `/verify-email` | Resend confirmation through Supabase. | Actual email delivery, resend limits, useful continuity from signup and expired-link recovery. |
| `/forgot-password`, `/reset-password` | Request reset and update password through Supabase. Missing-session reset shows an error. | Public inbox delivery and complete reset journey; align server and form password rules. |
| `/auth/callback` | Exchanges the email code; invalid/missing links show recovery text. | Check phone email-app/in-app-browser handoff. Current PKCE flow can require the browser that initiated signup/reset. |
| `/start`, `/onboarding` | Routes to assigned front. `rr_complete_onboarding` saves profile/business and fixes account type. | New worker and business browser acceptance, interrupted onboarding and retry checks. |
| `/account` | Save name/city, read-only email, authenticator setup/verification, reset-password/help links. | Verify ordinary-user profile writes; finish admin authenticator setup. Business name editing and account-change support are not implemented here. |
| All workspaces | Sidebar/bottom navigation, account link, sign out. Only the assigned admin gets a front switcher. | Recheck ordinary-account and cross-account permissions as each new feature lands. |
| `/earn` | Static empty task list and instructions. | Real feed, eligibility, task cards, detail page and Accept action. |
| `/earn/my-tasks` | Static empty list; Find a task link works. | Active/checking/pending/completed work, status timeline, resume/retry and issue reporting. |
| `/earn/wallet` | Unavailable message and Back to tasks link. | Earnings, transaction history, beneficiary setup, withdrawal, pending/failure states and receipts. |
| `/business` | Reads owned business/Instagram information. New campaign, Instagram, Campaigns and Funds links navigate. | Setup checklist, genuine campaign totals/progress and clear next action. |
| `/business/campaigns` | Reads owned `campaign_drafts`; new/edit and load-retry actions. | Published campaigns, lifecycle filtering, archive/delete-draft policy and reporting. |
| `/business/campaigns/new`, `/business/campaigns/:id` | Save/update title and quantity through Supabase; Follow only; link to Instagram. Save is disabled without a business. | Comment target/brief, full draft, price quote, review, funding and publication. Existing-ID route is a draft editor, not a campaign delivery screen. |
| `/business/instagram` | Zernio start/finish/reconnect/disconnect handlers; admin can create its own business details. | Replace with the chosen Rocket identity/ownership flow. Current professional-account OAuth instructions and business allowlist do not represent that new flow. |
| `/business/wallet`, `/business/billing` | Unavailable message and View campaigns link. | Top-up, confirmed funds, reserved/spent totals, receipts, return-of-unused-budget and payment tracking. |
| `/admin/*` | Single Operations page, MFA gate, refresh, provider status and recent check jobs. | Cases, delivery/payment investigation, safe retry/pause actions, audit history and alerts. Arbitrary admin subpaths currently show the same page. |
| `/help`, `/terms`, `/privacy` | FAQ, account/home links and support email. | Final rules for holding time, failed work, disputes, cancellations, refunds, withdrawal fees and data handling. A manual support inbox is sufficient for V1 if ownership and procedures are clear. |
| Aliases | `/earn/tasks` → Discover; `/earn/profile` → Account; `/business/settings` → Instagram. | Add actual task/assignment detail routes; do not mistake redirects for features. |
| Removed/unknown routes | `/demo` and unknown paths show Page not found. Signed-out protected routes go to login. | Keep removed public role simulators unavailable. |

## Live backend findings

Identity was checked before database access: RealReach project `jabwuawiqsusjrccapab`, API `https://jabwuawiqsusjrccapab.supabase.co`, status `ACTIVE_HEALTHY`. Its dedicated MCP tools were not exposed in this session; the project-scoped operator helper, CLI and authenticated Management API provided the audit access. No other project connection was used.

### What exists

- Twelve public tables, all with row-level security enabled: `profiles`, `sole_admin`, `businesses`, `campaign_drafts`, and eight older Instagram connection/invitation/check/evidence/job tables.
- Four profiles: one worker account type and three not yet assigned. No business records, drafts, Instagram connections, older check assignments or verification jobs at the time of inspection.
- Exactly one admin assignment, linked to confirmed `admin@realreach.com.ng`. No verified authenticator factor for that admin yet.
- Three applied migrations: identity/Instagram checks, scheduler, and account boundaries/drafts.
- Four deployed functions: `realreach-api` v3, `instagram-webhook` v2, `instagram-jobs` v2 and the retired `identity-provision` v2 endpoint. The retired endpoint returns HTTP 410.
- Live capabilities return `instagramConfigured: false`, `livePayments: false`, `commentsEnabled: false`.
- The older Instagram scheduler is active every minute. Its previous 24 hours show 1,440 successful database dispatch runs. With no queued jobs, this does not demonstrate a successful provider check.

### What is missing

There are no production campaign/assignment, quote, wallet ledger, payment intent, beneficiary, withdrawal, delivery receipt, dispute or notification tables. There are no production publish, claim, settlement, collection or payout operations behind the UI.

The existing Instagram job, retry and evidence concepts can be adapted, but their current records describe the old invitation-based verification flow, not funded marketplace tasks. The unused local workflow model has useful regression scenarios; it is not a replacement for transactional Postgres operations.

### Access and authentication

- Anonymous reads of profiles, businesses, drafts and the admin assignment are rejected. Anonymous onboarding and admin commands are rejected.
- Browser grants restrict profile updates to name/city; account type and admin assignment cannot be overwritten. Draft ownership/business/action cannot be changed through the update grant. Owner-scoped row policies are present.
- The onboarding function checks a confirmed account, locks the profile and prevents ordinary users changing account type. Supabase flags its intentional `SECURITY DEFINER` exposure to authenticated callers for review; this is not, by itself, evidence of an authorization bypass.
- The other inspected privileged check/scheduler functions are not executable by anonymous or ordinary authenticated roles. Five service-only tables produce informational “RLS without policy” notices; adding customer access just to clear those notices would be wrong.
- Google and email auth are enabled, signup is enabled, email confirmation is required and Google nonce checking remains on. Redirects include the RealReach domain and explicit local development callbacks.
- **Custom SMTP is absent; email sending limit is two per hour.** Supabase's default sender restricts delivery to project-team addresses, so public email signup/recovery is not launch-ready. Configure a sender such as Resend and test delivered links. [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).
- **Live minimum password length is six; the frontend and local configuration require twelve.** Bring the server rule into agreement. Frontend validation is not enforcement for API clients.
- Leaked-password protection is disabled and reported by Supabase's security advisor. Check available plan support before enabling; no paid change was made.
- Credentials previously shared in chat still need secure replacement. Local encryption prevents casual disk exposure; it does not revoke a disclosed credential.

This is a readiness audit, not a certification that all possible security vulnerabilities are absent. New financial logic still requires its own permission, concurrency and replay tests.

## Rocket integration and the UI changes it needs

RocketAPI remains the selected direction. The deployed adapter still calls Zernio, requires its key and has an older business allowlist. A new local `supabase/functions/_shared/rocket.ts` adapter now covers profile challenges, stable account IDs, following searches and paginated comments, with nineteen passing contract tests. It is not yet connected to a deployed marketplace job runner. A Rocket key cannot be inserted into the old Zernio adapter as a substitute.

The production implementation needs:

1. Account resolution and control proof for business and worker, tied to stable Instagram IDs. A username lookup alone does not establish ownership. Use the previously discussed short-lived public-profile challenge design, subject to the provider's current profile-read contract; no Instagram passwords and no per-business worker DM requirement carried over from Zernio.
2. A server-only Rocket adapter for account/profile reads, following checks and paginated post comments. Preserve positive, negative and unknown results; incomplete/private/rate-limited responses cannot silently become failures or approvals.
3. Baseline, completion and final checks, saved with actor, target, observation time and task rules. Do not pay an existing follower for a new-follow task or reuse the same comment for several rewards.
4. Shared comment retrieval per post, bounded pagination, scheduled retries and request limits. Do not fetch an entire post separately for every claimant or call the provider for every feed refresh.
5. A customer receipt based on the checked action. For a “like and comment” offer, checking the comment does **not** verify the like. The offer and receipt must state which result is checked; the backend must not mark an unobserved like verified.

We can finish the database contracts, screens, job integration and automated tests before the key arrives. Live Instagram observations and their costs remain the key-dependent acceptance step. This does not require purchasing several competing providers.

## Payment work that can proceed now

Build the server-owned money records and PocketFi integration against its documented contract. Use integer kobo and an append-only balanced ledger: confirmed funding → business funds → campaign reserve → assignment allocation → worker reward and platform fee. A payment return page never credits the balance.

Collections need reference/amount/currency checks, authenticated callbacks, duplicate-event handling and server status verification. Withdrawals need a verified beneficiary, a held amount, one stable payout reference, explicit success/failure/unknown outcomes and reconciliation. An unknown payout must not release the hold or cause a second transfer under a new reference.

Build the real customer screens against those operations. Automated isolated tests can exercise contract responses without putting invented money or successful payments into production. Keep money movement closed until credentials and merchant activation allow actual provider testing.

The CEO's registration blocks live collection/payout acceptance, not this engineering work. Beneficiary validation, supported refunds, settlement timing, fees and any required payout identity checks must be matched to PocketFi's actual contract rather than assumed.

The local PocketFi adapter has twenty-two passing contract tests for checkout, payment confirmation, bank/account checks, payout handling and raw-body signature verification. It still needs integration with the ledger, persisted jobs and a deployed webhook. Checkout requires a phone number. The public payout contract does not document a client idempotency key; uncertain submission outcomes must stay held for reconciliation, never trigger an automatic second transfer. These are implementation and acceptance requirements, not reasons to postpone all work until CAC is resolved.

## Design and operational gaps

The current visual system is consistent and the checked phone/desktop screens fit their viewports. The next design work should finish the actual activities: task cards and detail, linked-account setup, a clear mobile campaign builder, assignment progress, receipts, money states and issue resolution.

The current campaign Save action is below the detail sections on a phone; the complete builder needs an obvious next action and visible disabled-state reasons without covering the bottom navigation. The current empty Discover page must eventually distinguish no eligible work from loading/error/provider-paused states. A polished empty state is not a completed task flow.

The earlier baseline build produced a roughly 513 kB JavaScript chunk before gzip and warned about bundle size; the latest working tree now fails compilation as detailed above. Route splitting and removal of unnecessary legacy styling/imports should be part of mobile refinement; physical-phone, keyboard, enlarged-text and slow-network acceptance remain outstanding.

For a two-person operation, keep a small exception inbox and automatic retries, not an admin approval step for every worker. Minimum operations include provider-credit/outage alerts, old unresolved jobs, unknown payouts, ledger mismatches, an emergency payout pause and an audit trail. No such complete operations workflow exists today. Backup/restore and incident procedures also need an acceptance check.

## Recommended build order

| Pass | Deliverable | What can proceed now | External finishing requirement |
| --- | --- | --- | --- |
| 1. Accounts and recovery | Worker/business signup, fixed onboarding, login, logout, recovery and admin MFA; concise errors. | Align live auth settings, polish handoff/retry states, update stale roadmap, add real permission tests. | Email sender/domain setup; owner authenticator enrollment; fresh Google/email acceptance with consenting accounts. |
| 2. Instagram and campaign setup | Rocket-based account ownership, supported targets, follow/comment draft builder and server quotes. | Schema, server adapter, ownership challenges, UI, duplicate controls and contract tests. | Rocket key/credits and controlled Instagram accounts for live reads. |
| 3. Complete task and money loop | Funded publication, worker feed/claim/submit, scheduled checks, receipts, earnings, campaign pause/close and wallet history. | Database transactions, ledger, APIs, all corresponding screens, permissions, replay/concurrency tests. | Rocket live checks and PocketFi confirmed funds for a complete paid acceptance run. |
| 4. Payments and founder operations | PocketFi collections, beneficiaries, withdrawals, reconciliation, cases, alerts and release checks. | Adapter/server commands, UI/error states and isolated payment-contract tests can begin before merchant activation. | PocketFi registration/credentials and explicitly authorized small live transactions. |

These are delivery groups, not a reason to hold all payment implementation until the end. Build the ledger alongside publication/assignments and the PocketFi adapter while registration runs. Finish one shared business-to-worker transaction chain, then add breadth. No separate customer-facing test product is needed.

Before charging customers, fix the commercial defaults in one place: unit reward/fee, claim expiry, final-check delay, withdrawal minimum/fee, cancellation/dispute rules and supported public-account conditions. The old 15-minute/48-hour values were proposals, not confirmed pricing or rules. Provider and platform terms remain a separate business risk already noted in the existing research; a working integration is not evidence of permission.

## Checks performed on 21 October

| Check | Result and boundary |
| --- | --- |
| `npm test` | Latest run: 82 passed, including 41 local Rocket/PocketFi contract tests. Eighteen cover the older local workflow model; these do not prove production money or multi-user database behavior. |
| `npm run build` | Earlier baseline passed with a bundle-size warning. Latest working tree fails with four TypeScript errors in new, unintegrated files. |
| New marketplace backend | Deno check reports six type errors; migration, job processing and financial transaction tests are not complete. Nothing from this local build has been deployed. |
| `node tests/live-access-smoke.mjs` | 11 live SDK/API checks passed using anonymous access and the existing admin. Includes blocked admin operations without MFA and denied account-type overwrite. No financial operation. |
| Password browser journey | Existing admin login, correct landing, reload persistence, authorized front switch, sign out and denied access after sign out passed. |
| Authenticated layouts | 40 checks: ten screens at 360, 390, 430 and 1440 pixels. No horizontal overflow or uncaught application exceptions. Existing admin inspected both fronts; this is not ordinary-business authorization proof. |
| Public pages | Login/signup, recovery, help/legal, invalid callback/reset, removed route and signed-out guards inspected in the production browser. Additional landing/login/signup checks at 360, 430 and 1440 pixels fit without horizontal overflow. |
| Mobile menu | Modal opening, scroll lock, Escape dismissal, login navigation and desktop-resize dismissal passed. |
| Google controls | Official button rendered enabled on signup and login. Signup opened a real Google window showing `realreach.com.ng`; closing it left email/signup enabled. No new Google credential exchange completed in this audit. Report-only Google frame-policy diagnostics appeared in the public walkthrough; they do not establish a blocked sign-in. |
| Live backend | Project identity, tables/RLS, relevant grants, function permissions, migrations, deployed-function versions, public capabilities, auth settings, security advisories and scheduler history inspected. |
| Visual inspection | Reviewed mobile Discover, mobile campaign editor and desktop campaign editor screenshots. Layout fit does not certify all interaction states or accessibility. |

The authenticated browser captured one HTTP 403 console response during the expected admin MFA restriction; no uncaught application errors. A complete ordinary new-worker/new-business pair, fresh email delivery/recovery, real Google exchange, successful draft write in a new business account and provider/payment settlement are still separate acceptance checks. This audit did not create test customers, bypass permissions, change provider settings or manufacture activity.

Local read-only browser harness, screenshots and results are under `outputs/qa/audit-2026-10-21/` (Git-ignored). Source checkpoints: [routes](../src/live/LiveApp.tsx), [workspaces](../src/live/Workspace.tsx), [drafts](../src/live/Campaigns.tsx), [authentication](../src/live/AuthPages.tsx), [onboarding](../src/live/Onboarding.tsx), [server commands](../supabase/functions/realreach-api/index.ts), [provider adapter](../supabase/functions/_shared/instagram.ts), and [account/draft migration](../supabase/migrations/20260929083042_account_boundaries_and_campaign_drafts.sql).

The audit updated this report and used diagnostic artifacts under the ignored QA directory. No live database schema/configuration changes, deployment, Git commit/push or money movement were performed. Incomplete local implementation files are preserved and listed separately above; they must not be counted as completed production features.
