# RealReach: Instagram-only V1 product and architecture blueprint

Prepared: 27 September 2026. Status: proposed build specification, not an implemented backend or a passed provider test.

## 1. The product we are mapping

A mobile-first website where a business funds an Instagram campaign, eligible workers claim places and perform the requested action in Instagram, and RealReach checks account-level evidence before releasing earnings.

The business creates a campaign once. It does not send 1,000 individual jobs or approve 1,000 ordinary submissions. Workers find available campaigns in a shared task feed. The system creates an individual assignment only when someone claims a place.

This document narrows the earlier multi-platform research. The original handoff remains background; the [provider research](./RealReach-V1-Verification-Provider-Plan.md) remains an evidence appendix, not the current platform scope. No application code, production configuration or money has been changed by this planning work.

### Proposed V1 boundary

| Include | Leave out |
| --- | --- |
| Instagram professional accounts owned by participating businesses | TikTok, X and other networks |
| New-follow tasks as the first end-to-end technical test | Paid likes until reliable account-level coverage is demonstrated |
| Comment tasks on the connected business's own supported organic posts, after their separate verification test | Stories, paid-ad comments, arbitrary third-party posts, shares, saves and views |
| Business campaign creation, funding, progress and unused-budget release | Advanced demographic targeting, inferred interests and guaranteed sales |
| Worker task feed, assignments, earnings, withdrawals and appeals | Native apps, bidding, worker-business chat and referral rewards |
| One owner and one Instagram account per business initially | Agencies, business teams and multiple brands per workspace |
| One normal login with authorized worker/business/admin views | A public admin signup option or browser-selected admin privileges |

Instagram-only is the agreed direction. Follow-first sequencing, comment gating, time limits and payout defaults below are recommendations for approval, not decisions already made by the founders.

### A separate commercial release gate

Instagram's published guidelines prohibit offering money for followers, likes, comments or other engagement. API availability does not authorize this business model. Consequently this is a **technical/mock-money pilot blueprint**, not a recommendation to start selling these actions today. A paid launch needs a platform-compatible commercial model or applicable authorization; a data vendor's approval alone cannot override Instagram's rules. This document does not silently replace the requested product with another business. [Instagram guidelines](https://www.facebook.com/help/477434105621119?locale=en_GB).

## 2. The whole loop

```text
Business connects Instagram
          |
Creates campaign -> gets price -> funds budget -> campaign becomes available
                                                   |
Worker sees task -> claims a place -> proves account control to that business
                                                   |
                                  Performs action inside Instagram
                                                   |
                                  RealReach checks API evidence
                                      /                  \
                            unknown/problem          action detected
                            retry or exception            |
                                                  pending earnings
                                                         |
                                              scheduled retention check
                                                         |
                                               available earnings
                                                         |
                                            requests bank withdrawal
                                                         |
                                               PocketFi pays worker
```

Supabase stores every business record, assignment, verification result and money movement. The website displays those records. Instagram evidence and PocketFi callbacks reach our server, not the browser's wallet state.

## 3. Mobile UI and navigation

Keep the existing RealReach identity: warm off-white surfaces, dark plum text, coral primary actions and restrained lime success accents. Use one consistent infinity-style logo component across public, auth and product screens. Retain the current typography family; improve hierarchy rather than introducing another visual theme.

Worker mobile navigation: **Discover / My tasks / Wallet / Account**.

Business mobile navigation: **Overview / Campaigns / Funds / Account**. Put a prominent New campaign action on Overview and Campaigns. The account menu switches between authorized fronts; it also contains Help and Sign out. Desktop uses the same information architecture in a sidebar.

Screen rules:

- Design at 360-430px first; test narrow screens and enlarged text. No horizontal page scrolling.
- Single-column task cards with an obvious reward, action, business, conditions and one primary button.
- A sticky bottom action on task and campaign-step pages, with keyboard and safe-area clearance. Do not cover the bottom navigation.
- At least 44px tap targets, visible focus, labelled controls and status text in addition to color.
- Return from Instagram resumes the same assignment. Refreshing or closing the browser never destroys a claim or payment request.
- Empty, loading, offline, failed and reconnect states are designed screens, not generic error toasts.
- No fake audience counts, match percentages, testimonials presented as live results, or simulated money in the production environment.

### Worker: Discover

Illustrative data and prices only:

```text
realreach                         Notifications
Find your next task
[All] [Follow] [Comment]

----------------------------------------------
Kora Studio                         Instagram
Follow this business                   NGN 70
New followers only
One-time verification message required
Checked again before earnings are released
                         [View task]
----------------------------------------------

Nothing suitable? Check back later.

Discover       My tasks       Wallet       Account
```

Cards open a detail page; they do not immediately reserve money. The detail page explains exactly what qualifies, the holding period, and any first-time DM step before the worker presses **Accept task**.

### Worker: assignment

```text
< My tasks                    Claim expires 12:41
Follow Kora Studio                     NGN 70

1  Verify your Instagram account
   Send this one-time code to @korastudio:
   RR-<random code>                  [Copy]
                          [Open Instagram]
   Waiting for your message...

2  Follow @korastudio
   Available after the eligibility check

3  Return here for verification
   Earnings remain pending until the final check

                         [Check my task]
```

After detection, the timer is replaced by a receipt: **Action detected / Pending NGN 70 / Final check due [date, time]**. If the API is unavailable, show **Verification delayed; your submission is saved**, not “You failed.”

### Business: create campaign

```text
< Campaigns                        Step 2 of 4
What would you like people to do?

(o) Follow your Instagram account
( ) Comment on one of your posts

Connected: @korastudio                  Healthy
Target: instagram.com/korastudio

What counts
  A new eligible account completes the action
  RealReach verifies it against the agreed rules
  Unused campaign funds return to your balance

[Save draft]                          [Continue]
```

### Worker: wallet

```text
Wallet
Available                              NGN 4,200
[Withdraw]

Pending verification                   NGN 560
In withdrawal                          NGN 1,000

Recent activity
Kora Studio follow       Pending       +NGN 70
Bank withdrawal          Processing   -NGN 1,000

Bank account                    **** 1234
```

Pending earnings are not spendable. A processing withdrawal is not labelled paid until the payment provider confirms it.

## 4. Pages we actually need

Routes below extend the existing `/earn`, `/business` and `/admin` structure. They are proposed contracts, not routes already implemented.

| Page / route | Main content and working actions |
| --- | --- |
| `/`, `/how-it-works`, `/help`, `/terms`, `/privacy` | Honest product explanation, eligibility, payment rules and support. Launch claims depend on the release gate. |
| `/signup`, `/login`, `/forgot-password`, `/reset-password`, `/verify-email` | Real authentication; business/worker choice selects onboarding, not access privileges. |
| `/earn` and `/earn/tasks` | One Discover experience; filters, availability, resume-current-task banner. |
| `/earn/tasks/:campaignId` | Public-to-eligible-workers task brief, reward, conditions, Accept task. |
| `/earn/my-tasks` | Active, checking/pending, completed and unsuccessful assignments. |
| `/earn/assignments/:assignmentId` | DM challenge, instructions, evidence-check status, receipt and appeal. |
| `/earn/wallet` | Available/pending/in-withdrawal totals, bank setup, withdrawal and transaction detail. |
| `/earn/profile` | RealReach profile, verified business-specific Instagram links, security, notification settings, sign out. Do not claim a universal Instagram identity has been proved. |
| `/business` | Setup checklist, campaign progress, funds and provider connection health. |
| `/business/campaigns`, `/business/campaigns/new` | Campaign list and four-step builder. |
| `/business/campaigns/:id` | Delivery funnel, budget breakdown, evidence receipts, pause/resume/close and dispute. |
| `/business/billing` | Top up, payment status, available/reserved/spent funds and receipts. |
| `/business/settings` | Business details, Instagram connection/reconnection, security and sign out. |
| `/admin` and subpages | Exceptions, payments/reconciliation, businesses/users, connection health, configuration and audit history. |

Fold the current generic Audience and Analytics pages into real campaign reporting for V1. Keep redirects for existing bookmarks. Do not maintain empty pages just to fill a sidebar.

## 5. Business flow: create, fund, publish, track

### Onboarding

1. Sign up with Supabase Auth and verify email.
2. Create the business record: name, category, contact and required acceptance of terms.
3. Press **Connect Instagram**. Our server creates a provider profile mapped to this business and a short-lived connection attempt. The browser follows the hosted authorization URL.
4. After authorization, our server checks the returned account through the provider and binds it to the authenticated owner. A callback query parameter alone never proves ownership.
5. Show the actual account, permission health and supported task types. An unsupported account gets a clear explanation, not a partly functional campaign builder.

Zernio documents professional Business/Creator connections and an Instagram Login route. Ordinary workers are not enrolled as connected business accounts. Request only the access needed for account details, messages and comments; verify the provider's actual permission selection during the pilot. [Instagram integration](https://docs.zernio.com/platforms/instagram), [connection API](https://docs.zernio.com/connect/get-connect-url).

### Four-step campaign builder

1. **Account:** choose the connected account, confirm connection health.
2. **Action and target:** Follow uses that account; Comment uses one of its supported posts. Show a real post preview. V1 can initially limit selection to the provider's recent-post picker; unsupported older URLs must not pretend to resolve. Comment campaigns have an explicit prompt, not a requirement for praise or copied positive text.
3. **Quantity and timing:** choose quantity and end date. Server returns a versioned quote: unit reward, platform fee, total campaign reserve and any separately disclosed payment charges. Start with a configured rate card, not unrestricted business-set reward values.
4. **Review and fund:** show rules, proposed retention period, cancellation terms and total. Save draft, top up a shortfall, or **Publish campaign** when sufficient cleared balance exists.

Quote example, not a recommended selling price: 100 places at NGN 100 each = NGN 10,000 reserved. If reward is NGN 70 and fee NGN 30, those figures are fixed for that campaign. Provider/payment expenses and taxes are not included in this illustrative split.

Publishing runs automatic ownership, supported-target, funding, quote and eligibility checks. For the closed pilot, the founder can admit businesses individually. Routine task completions do not go through business approval.

### What the business sees after launch

- Requested quantity; unclaimed, currently assigned, awaiting final check and delivered counts.
- Budget still unallocated, held for assignments, settled spend and released unused funds.
- A delivery receipt per settled action: task reference, permitted Instagram identity display, target, evidence timestamps and outcome. Never expose worker bank details, email or private DM history.
- Pause stops new claims. Existing valid assignments keep their published terms.
- Close stops new claims and releases only unallocated funds immediately. Held funds are reconciled as existing assignments finish or expire.
- No business “Reject worker” button for ordinary verified work. A dispute opens a case; it cannot reverse a payment by itself.

Call the metric **verified actions delivered**, not unique people reached, organic growth or guaranteed sales. Existing followers and unrelated changes in follower count are not campaign delivery.

## 6. Worker flow: discover, claim, verify, earn

### Receiving tasks

Workers sign up, verify email, complete a short profile and open Discover. The server lists active, funded campaigns with available places and excludes ineligible or previously rewarded combinations. No employee manually assigns jobs and no notification service needs to message every worker.

V1 feed ordering is straightforward: available tasks, optionally sorted by newest or ending soon. Interest/category filters are preferences, not verified demographic targeting. Use an initial Nigeria/adult eligibility policy if approved, but do not represent self-declared age or location as independently verified.

In-app notifications cover assignment outcomes and withdrawals. Refresh the feed on return to the app; use scoped Realtime updates for the worker's own records where helpful. Correctness must not depend on a live browser subscription.

### Claiming a place

**Accept task** calls the server. In one short database transaction it:

1. Checks campaign state, remaining funded capacity, worker restrictions and previous participation.
2. Creates or returns the same assignment for a repeated request.
3. Reserves one place and its already-funded allocation.
4. Returns the assignment, server expiry and next required action.

Proposed default: one unfinished action at a time, with 15 minutes to establish eligibility and submit. Pending retention checks do not block taking another task. These are configurable pilot settings. A technical outage suspends ordinary expiry processing for affected submitted work.

### Identifying the Instagram account without inventing OAuth support

For the first task involving a particular business:

1. Generate an unpredictable, single-use challenge bound to the worker, assignment and recipient business. Store its hash and expiry; rate-limit creation and consumption.
2. Show **Copy code** and **Open Instagram**. The worker sends the code from the account they will use for the task. Do not assume links can prefill or automatically send DMs.
3. Receive an authenticated message webhook. Check the exact receiver, code, sender, event identity and expiry, then consume the challenge atomically.
4. Bind the business-scoped Instagram sender ID to this worker. A unique constraint prevents that same Instagram identity being claimed by another RealReach account for the same business.
5. Subsequent tasks for that business can reuse the binding while access remains valid. Rechallenge when necessary; no password or session cookie collection.

The DM is an account-control and API-access step, not paid engagement itself. The business must knowingly permit these verification messages. At high volumes, their effect on its inbox and platform message limits must be tested; this friction is part of the chosen integration, not hidden from onboarding.

**Identity boundary:** do not equate a provider account ID, an Instagram-scoped sender ID and a public scraper ID. Do not assume the sender ID is universal across different businesses. Store a canonical business-account identity plus provider connection history, so reconnecting cannot erase prior rewards. The pilot must establish reconnection and DM/comment ID behavior. If continuity cannot be established, suspend affected claims instead of creating fresh identities automatically.

This lean V1 proves control of a particular Instagram account in the relevant business context. It does not prove one unique human across all Instagram accounts. Separate phone/beneficiary verification and risk limits are needed for cash-out; no honest API design can label account control as proof that one person owns no other accounts.

### Follow task

Our proposed algorithm:

1. After account identification, obtain a baseline reading before instructing the worker to follow.
2. Already following: show **This task is for new followers**, release the place, and do not penalize the worker. Unknown: request the missing permission or retry; do not guess.
3. Eligible worker follows in Instagram, returns and presses **Check my task**.
4. Queue a fresh check. A positive result creates pending earnings and a scheduled final check. A negative result before the submission deadline permits another attempt.
5. At the proposed 48-hour holding point, check again. Positive evidence permits one settlement. A definite absent relationship fails the retention condition and permits an appeal, but is not by itself proof the worker committed fraud. Technical unknowns remain unresolved, not automatically paid or rejected.

The documented provider call is `GET /v1/accounts/{accountId}/follow-status/{userId}?refresh=true`. It uses a scoped identity obtained from platform events and requires the person to have messaged that business; commenting alone is insufficient. The result can be true, false or null with an unavailable reason. [Follow-status reference](https://docs.zernio.com/accounts/get-instagram-follow-status), [Meta profile access](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/user-profile/).

The service observes the relationship at defined checkpoints. It cannot promise continuous following between observations or permanent retention after payment. Here, "new" means not following at the baseline and not previously rewarded by RealReach for that target; this does not prove the person never followed it historically. A business can also remove a follower: absence alone does not identify who caused it. Publish that boundary and investigate suspected business abuse rather than automatically blaming workers.

### Comment task

1. Establish the worker's business-specific account binding, then show the selected post and prompt.
2. Worker writes their own comment in Instagram. RealReach never posts it on their behalf.
3. A comment webhook supplies a candidate. Match account, media, author identity, comment ID and creation time against an active assignment. Enforce the campaign's objective text rules and reject reused evidence.
4. Show **Comment detected**, then perform the retention check before settlement. The button requests a check; a typed comment or screenshot is not payment evidence.

Zernio documents `comment.received` and `GET /v1/inbox/comments/{postId}?accountId=...`. The optional `commentId` parameter returns the requested Instagram comment as well as its replies, avoiding a full-post scan when an ID is known. Reads can be cached for up to ten minutes. Use webhook ingestion plus scheduled reads with recorded freshness; do not present cached data as a real-time guarantee. [Comment API](https://docs.zernio.com/comments/get-inbox-post-comments), [inbox events](https://docs.zernio.com/webhooks/inbox).

The pilot must prove author-ID matching and that a post-hold read is sufficiently fresh. Allow a documented settlement grace period for cache expiry. Missing/hidden comments can reflect business moderation, deletion or access changes; ambiguous disappearance goes to an exception case, not an automatic worker-fraud verdict. If reliable comment retention cannot be established, keep comment sales disabled rather than silently replacing the verifier with screenshot review.

## 7. API-to-UI-to-database contract

These are proposed **RealReach server operations**, not existing endpoints or promises that PocketFi uses these names. Implement them as a small set of Supabase Edge Function handlers with shared validation and provider adapters.

| UI action/event | Server operation | Main database effect | External dependency |
| --- | --- | --- | --- |
| Sign up / sign in / reset / sign out | Supabase Auth flows | Auth identity and safe profile | Auth email delivery |
| Connect / reconnect Instagram | `instagram/connect-start`, callback verification | Connection attempt, business account mapping, health | Zernio hosted authorization |
| Load owned posts | `instagram/posts` | Sanitized cached post selection | Provider-owned media listing |
| Save draft / request quote | `campaigns/save`, `campaigns/quote` | Draft and immutable quote/rules version | None |
| Top up | `payments/create` | Server-priced payment intent | PocketFi collection, contract to confirm |
| Payment callback | `webhooks/pocketfi` | Deduplicated event; confirmed ledger credit | Provider signature/status verification |
| Publish / pause / close | `campaigns/publish`, `pause`, `close` | Atomic funding/capacity/state transition | None during transaction |
| Open Discover | `tasks/feed` | Read sanitized eligible campaigns | None; no provider call per card |
| Accept task | `assignments/claim` | Unique assignment and allocation reservation | None during transaction |
| Get verification code | `assignments/challenge` | Expiring challenge tied to receiver | None |
| Instagram DM/comment callback | `webhooks/instagram` | Durable event, binding/evidence candidate, queued work | Signed Zernio webhook |
| Check my task | `assignments/check` | Idempotent verification job; return status | Provider queried asynchronously |
| Due final check | Scheduled worker | Evidence, then one atomic settlement if eligible | Fresh provider evidence |
| Open wallet | `wallet/summary`, `wallet/activity` | Owner-scoped ledger projections | None |
| Add bank / withdraw | `beneficiaries/verify`, `withdrawals/request` | Verified beneficiary, payout hold and outbox | PocketFi capabilities to validate |
| Appeal / report issue | `cases/create` | Case tied to an assignment/payment | None |
| Admin resolution | `admin/cases/resolve` | Audited outcome; authorized financial command if needed | Recheck provider where relevant |

Each user operation validates a real session and resource ownership server-side. Monetary and state-changing commands accept idempotency keys. Return the existing result for retries of the same intent; reject reuse with changed parameters. Async requests return a job/status reference, not invented success.

## 8. Supabase architecture: small system, strict boundaries

```text
React + TypeScript website on Vercel
     |                        |
     | Auth / safe RLS reads  | authenticated commands
     v                        v
Supabase Auth            Edge Functions
                              |         |
                              |         +--> Instagram adapter --> Zernio
                              |         +--> Payment adapter ----> PocketFi
                              v
                  Postgres: product records + private ledger
                              ^
                              |
               Queues + Cron + short background workers
                              ^
                              |
                    authenticated provider webhooks
```

No additional microservices, Redis, separate search engine or machine-learning fraud service is required for this pilot. Supabase provides the durable records, scheduled work and queue primitives. Provider adapters isolate their payloads from the frontend and database domain model. [Queues](https://supabase.com/docs/guides/queues), [Cron](https://supabase.com/docs/guides/cron).

Use Postgres transactions for financial and capacity decisions. External HTTP calls happen outside locked transactions. Persist the verification result, then revalidate the assignment version and settlement conditions when committing the money movement. Queue redelivery and function retries must remain safe even if the same job runs twice.

Use one scheduled dispatcher for due checks, expired claims and reconciliation batches, with small bounded jobs and backoff. An outage should slow processing and alert the operator; it must not create thousands of independent manual-review tasks. Realtime improves status display but is not the settlement engine.

### Core data model

Logical groups below are intentionally compact; exact columns and migrations follow this blueprint.

| Domain | Records and essential fields |
| --- | --- |
| Identity/access | `profiles` keyed to `auth.users`; protected `user_roles`; `businesses` with owner. Normal profile fields cannot grant admin. |
| Instagram | `instagram_accounts` for canonical business accounts and current provider connection; connection history; `worker_instagram_bindings` with worker, receiving account context, scoped sender ID and observed handle; `verification_challenges`. Provider/social identifiers are strings, not JS numbers. |
| Marketplace | `campaigns` with owner, action, canonical target, goal, expiry, quote/rules version and status; `assignments` with worker, binding, reward/fee snapshot, deadlines, status, reason and version. |
| Evidence | `verification_checks` with assignment, phase, positive/negative/unknown result, source identity, observed time, freshness and restricted evidence reference; `engagement_receipts` for deduplicated paid outcomes. |
| Money | `payment_intents`, `ledger_accounts`, `ledger_journals`, `ledger_entries`, `payout_beneficiaries`, `withdrawals`. NGN amounts are integer kobo, never floating-point currency. |
| Operations | Deduplicated `provider_events`, transactional outbox/queue jobs, `notifications`, `cases` and append-only `audit_events`. Retention depends on purpose; do not store private message bodies indefinitely. |

Important constraints:

- Unique canonical receiving-account context + Instagram sender ID binding; no automatic reassignment to another worker.
- Unique worker + campaign assignment, with explicit retry/resume rather than accidental duplicates.
- Unique paid follow per canonical target + scoped Instagram actor, and per RealReach worker + target. Retain receipts across campaigns. Unfollow/refollow does not reset eligibility.
- Unique paid comment participation per actor + media, and per RealReach worker + media for this V1. A comment ID cannot settle two assignments.
- Unique provider event, deposit reference, payout reference and settlement journal source. A transport retry cannot create a second financial effect.
- Atomic campaign capacity/allocation checks, plus nonnegative balance constraints where applicable. Index ownership, state/due-time filters, foreign keys and uniqueness keys.

Do not expose the raw ledger, payment credentials or provider evidence as unrestricted public-schema tables. Serve narrowly scoped summaries to the UI. Campaign owners see delivery summaries, not all worker records.

### Access and secrets

- Supabase publishable keys may be in the frontend; provider keys, webhook secrets and Supabase secret/service-role credentials may not. Never put those secrets in `VITE_*` variables.
- Explicit grants and RLS are both required for exposed database objects. New Supabase projects do not automatically grant table access. Check views as well as tables. [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [new table access defaults](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
- A worker reads their own assignments, safe profile and wallet summary. A business owner reads their business records. Safe task-feed output is deliberately restricted.
- Clients cannot write balances, roles, verification results, campaign delivery counters or paid statuses.
- Derive admin authorization from protected server-managed roles, not editable user metadata or a UI role picker. Require MFA for the sole admin's sensitive actions and record an audit trail. Role switching changes presentation, not privilege.
- Keep privileged database functions outside exposed schemas where possible, pin `search_path`, revoke default execution and check the actor/resource for every callable command. Backend service credentials bypass RLS, so server ownership checks are still essential.
- Public provider webhook routes use provider authentication; they are not protected by pretending PocketFi or Zernio has a Supabase user JWT. Validate signatures before privileged work. [Function authentication](https://supabase.com/docs/guides/functions/auth), [secrets](https://supabase.com/docs/guides/functions/secrets).
- Zernio documents a raw-body HMAC-SHA256 signature and stable event IDs. Configure a webhook secret, compare signatures safely, deduplicate the signed event identity and acknowledge only after durable receipt. Do not reject legitimate delayed retries simply because their original event timestamp is old. [Webhook contract](https://docs.zernio.com/webhooks).
- Use private storage and short-lived signed access for appeal attachments if needed. Screenshots remain supporting material, never an automatic payment oracle.

## 9. Money flow and payment safety

PocketFi is the requested provider, but its actual API, signature scheme, fees, transfer lifecycle, settlement availability, account-name checks, refund support and idempotency guarantees must be checked against its implementation/docs before writing an adapter. This document does not invent those capabilities. Provider acceptance of the marketplace use case is also required.

### Funding and settlement

```text
Verified deposit -> business available balance
Publish          -> campaign unallocated reserve
Claim            -> assignment allocation held
First check      -> pending earnings shown, money still held
Final check      -> worker available reward + earned platform fee
Unused capacity  -> business available balance
```

Use an append-only balanced journal. Pending earnings can be a projection of verified-but-unsettled assignments; do not also credit the withdrawable ledger and accidentally count the same money twice. Cache balances only as transactionally maintained projections of the ledger.

In the illustrative 100-place campaign, if 80 settle and 20 remain unused with no assignments outstanding: NGN 5,600 goes to workers, NGN 2,400 becomes platform fees and NGN 2,000 returns to business availability. Total remains NGN 10,000 before separately disclosed processing costs/taxes. Reserving a claim reallocates already reserved money; it does not charge the business twice.

For collection, create the amount/reference on our server. Credit once only after authoritative provider confirmation matches merchant, reference, currency and amount. A success screen or return URL never credits a balance. Chargebacks and delayed settlement still create exposure: set pilot caps and keep a cash reserve rather than claiming software makes loss impossible.

### Withdrawals

1. Worker chooses a verified eligible beneficiary and sees amount, fee, net receipt and expected timing.
2. In one transaction, validate limits, place funds on a withdrawal hold and record a durable payout intent.
3. A worker sends that intent to PocketFi outside the transaction using a stable reference/idempotency mechanism supported by the provider.
4. Confirm success through authenticated provider evidence. Definitive failure releases the hold once. Timeout/unknown stays in reconciliation; it does not automatically release funds or trigger a second payout with a new reference.
5. Reconcile provider transactions, actual available payout liquidity and our ledger regularly. Alert on any discrepancy.

A verified deposit is not automatically evidence of immediately withdrawable cash at the provider. Payout scheduling must respect settlement and liquidity. Keep an independently controlled payout pause switch.

Unused campaign budget returns to the business's internal balance by default. A refund to its original payment method is a separate provider-supported operation, with disclosed fees/timing; do not promise instant bank refunds without that contract.

## 10. States that drive both UI and processing

| Object | Normal path | Important alternatives |
| --- | --- | --- |
| Campaign | `draft -> awaiting_funding -> live -> closing -> completed` | `paused` stops claims; cancellation enters closing until outstanding allocations resolve, then `cancelled`. Reconnection/verification problems show a reason and block new claims. |
| Assignment | `reserved -> ready -> checking -> pending -> settled` | Reserved can await identity/baseline. `ineligible`, `expired`, `cancelled`, `rejected`, `needs_review`; retryable technical failures retain state with reason and `next_check_at`. |
| Deposit | `created -> pending -> succeeded` | `failed`, `expired`; refunds are separately tracked operations. |
| Withdrawal | `requested -> processing -> succeeded` | `failed`, `reconciliation`; only known failure releases the hold. |

Separate machine status from explanatory reasons. Do not add a status for every error string. All deadlines are server UTC timestamps displayed in the user's timezone. Campaign deadlines stop new participation; they do not cancel an already-earned pending reward.

Use event creation times and idempotent ordering rules for late webhooks. Submission before the deadline must not be invalidated solely by provider delivery delay. A documented technical grace period is necessary; after bounded retries, a small case is opened with the evidence attached, not an endless spinner.

## 11. Exceptions and the one-person admin

The admin signs in through normal Auth. Only the preassigned server-side role enables the Admin switch. There is no public admin registration and no frontend-only secret admin route.

The admin homepage prioritizes:

1. Money mismatches or payouts with unknown outcomes.
2. Provider disconnects/outages affecting campaigns.
3. Ambiguous evidence, appeals and suspected duplicate-account abuse.
4. Pending business admission during the controlled pilot.

Each case includes the timeline, relevant verification results and narrowly scoped actions: retry, request reconnection, uphold/reverse a rejection, close a campaign, or authorize a documented adjustment. There is no free-form “set wallet balance” field.

Group common-cause failures into one incident with affected assignments attached. One deleted business post or disconnected account should not require the founder to open and resolve hundreds of independent tickets. Any bulk resolution still records each assignment's financial effect exactly once.

Keep routine valid assignments fully automatic. Worker signup, account control and device/IP signals cannot prove unique humans; before real cash-out, choose an actual supported phone/beneficiary/KYC flow and cost it. Shared devices or networks are risk signals, not automatic proof of cheating. Locking one beneficiary to one worker can reduce casual duplication but needs a clear exception/recovery policy.

The two-person operation still needs an owner for money incidents and appeals. Proposed split: CEO handles business admission and customer disputes; CTO handles provider and reconciliation failures. Verify that this ownership is accepted before launch. No fixed manual-review percentage is assumed.

## 12. Scale and costs: design the workload, then measure it

For follows, budget roughly three relationship observations per ordinary completed assignment: baseline, completion and final retention check, plus identity work and retries. Ten thousand completions therefore imply roughly 30,000 relationship reads, not one “10,000 followers” request. Whether that fits the required deadline depends on both provider-team and Instagram-account limits, which must be measured.

Schedule final checks across their due times, enforce per-provider and per-business rate budgets, reuse durable identity bindings and pause new claims when verification cannot keep up. Never call the provider for every feed card or on every screen refresh.

For comments, ingest once and match locally, then target known comment IDs for retention reads. Do not repeatedly download the entire comment history for each worker. Account for the documented cache window in both customer expectations and settlement.

Zernio's published account billing applies to connected business social accounts, not every worker who sends a verification DM. Reconfirm the plan, included inbox features, limits and business-use acceptance before purchase. [Published account pricing](https://zernio.com/blog/pay-per-account-pricing).

The selling-price formula is: worker reward + allocated verification/provider cost + payment/withdrawal cost + hosting/support/fraud allowance + margin. Measure cost per **settled action**, including unsuccessful attempts and retries. Do not set a market price from the nominal cost of one API call.

Additional services for a lean production build: transactional email/SMTP for Auth and essential notices, error monitoring, and whichever phone/beneficiary verification service PocketFi does not provide. Avoid SMS campaign broadcasts, paid analytics add-ons and a second social-data provider until measurements justify them. Operational backups and restore testing also need a budget.

## 13. How we get from the current frontend to this V1

The existing React/TypeScript/Vite app is useful UI scaffolding. `ProductProvider` currently stores demo state in localStorage; task buttons and withdrawal actions mutate that local state, authentication navigates by selected role, and campaign/task arrays are not a shared backend model. Those are demo behaviors, not security boundaries.

### Phase A: validate the core before building around assumptions

Use one connected test business and a small set of consenting test accounts, with mock money. Prove the hosted connection, signed DM webhook, account binding, negative/positive follow observations, retention-period access and disconnect behavior. Separately prove comment author mapping, direct comment retrieval, deletion/hiding and cache freshness. Record actual payloads with sensitive content removed.

Deliverable: executable provider contract tests and an evidence report. Documentation research alone is not a passed test. If follow checking fails, stop that vertical slice; if comments fail, leave that action unavailable. No silent screenshot-based substitute.

### Phase B: one working product loop

Create the Supabase project, schema/migrations, Auth, permissions, protected single-admin role and server command layer. Replace localStorage authority with real records. Build the four business steps, Discover, assignment execution, My tasks and wallet states with mock payment adapters.

Deliverable: business publishes one funded test campaign; another account claims it; provider evidence changes its state; scheduled checking settles a balanced mock-money journal exactly once.

### Phase C: payment and operational integration

Inspect and test the actual PocketFi contract. Add deposit confirmation, beneficiary verification, payout holds, idempotent execution and reconciliation. Add admin cases, notifications, connection health and audit trails. Test disaster recovery and provider outages. Do not expose paid campaign sales merely because checkout works.

### Phase D: controlled acceptance and release decision

Run the CEO's proposed small full-flow test with a business and around ten workers. Include deliberately unsuccessful and repeated actions, not just the happy path. Then run concurrency and quota tests independently; ten people are not proof of 10,000-worker throughput.

Commercial release requires the policy/use-case gate in section 1, supported payment arrangements and the technical acceptance gates below. Freeze scope and increase campaign limits gradually only after measured results.

## 14. Acceptance tests and success metrics

Mandatory tests:

- Two workers claim the last place: exactly one succeeds; the other is not charged or promised work.
- Double taps, page refreshes, duplicate jobs and replayed signed webhooks never duplicate a deposit, reward or payout.
- Forged webhooks, changed payment amounts and a browser-written `isAdmin` value have no authority.
- Worker A cannot read Worker B's wallet or assignment; Business A cannot read Business B's campaigns; the provider key is absent from frontend assets.
- Existing follower is ineligible. A real new follower passes. An unknown API result cannot become a guessed pass/fail.
- Reused identity/evidence across campaigns does not earn again. Reconnection and username changes do not reset payment history.
- Follow then immediate unfollow, comment deletion/hiding, expired claims, late events and revoked permissions produce the documented outcomes.
- Business pause/close/disconnect cannot erase already held worker claims or release their funds twice.
- A payout timeout after provider acceptance produces one eventual payment, not a retry under a fresh identity.
- Ledger reconciliation balances; pending rewards cannot be withdrawn; refunds and failed withdrawals cannot mint money.
- On a phone, leaving for Instagram, returning, refreshing and reopening the browser preserves the assignment and next action.

Measure during the pilot:

- Signup-to-first-task and claim-to-completion conversion, especially abandonment at the DM step.
- Automatic resolution rate, unknown-result age, verification latency and manual minutes per 100 assignments.
- False acceptance/rejection against controlled ground truth, plus ambiguous cases kept separate.
- Actual cost and margin per settled action; payout fees, latency and failure/reconciliation rates.
- Campaign fill time, delivery at final check, disputes and business willingness to run another campaign.
- Duplicate financial effects and unexplained ledger differences: required target is zero.

Do not invent a 99.9% verification claim or an acceptable support percentage before measuring the pilot. The outcome we need is an automated ordinary path, visible bounded exceptions, and economics that work at the observed call volume.

## 15. Decisions to lock before implementation

Recommended defaults for the founders to approve together:

1. Instagram only; follow-first integration, comments only after their verification test, likes unavailable.
2. Business professional accounts only; account-control DM before a worker's first task for each business.
3. Proposed 15-minute claim window and 48-hour retention hold, with explicit technical-delay handling. Retention is checked at points, not continuously guaranteed.
4. One business owner/account initially, a simple server-owned rate card and conservative pilot exposure limits.
5. Bank/identity checks, minimum withdrawal, fees and processing schedule only after PocketFi's actual contract is verified.
6. The published rules explain non-delivery, ambiguous deletion/removal, cancellation, appeals and data use before either side commits.

Next concrete implementation step: **prove one Instagram assignment end-to-end with mock money, then wire those exact states into the existing mobile screens.** Do not build a large task marketplace around an untested identity or settlement assumption.
