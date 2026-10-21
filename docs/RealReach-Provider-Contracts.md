# RealReach provider contracts

Reviewed 21 October 2026. Instagram-only V1. RocketAPI supplies account/action evidence; PocketFi handles collections and bank payouts. The adapters call real provider endpoints and fail clearly when credentials are missing. Their fixture tests do not claim that provider-account acceptance or a live-money journey has passed.

## Server configuration

| Setting | Purpose |
| --- | --- |
| `ROCKET_API_KEY` | Private RocketAPI token. |
| `POCKETFI_API_TOKEN` | PocketFi API bearer token; the backend also accepts `POCKETFI_SECRET_KEY` as a compatibility fallback. |
| `POCKETFI_BUSINESS_ID` | RealReach's PocketFi merchant/business ID. Never another application's merchant. |
| `POCKETFI_WEBHOOK_SECRET` | PocketFi HMAC signing secret. If the merchant uses one secret for both purposes, `POCKETFI_SECRET_KEY` is also accepted as the fallback. Do not assume the API token and webhook secret are interchangeable. |
| `RESEND_API_KEY` | Private sending key for operational alerts; independent of Supabase Auth SMTP configuration. |
| `REALREACH_ALERT_FROM` | One verified sender mailbox on realreach.com.ng or its subdomain, without a display name. |
| `REALREACH_ALERT_TO` | One operator mailbox to receive alerts. Not exposed in the admin API. |

Store these using Supabase Edge Function secrets. None belongs in a `VITE_*` variable, browser code, Git, screenshots or chat. The browser only receives narrow capability flags and authenticated records. Missing secrets never generate a connection, balance, verification or payment success.

Configure the PocketFi webhook URL as `https://jabwuawiqsusjrccapab.supabase.co/functions/v1/pocketfi-webhook`. The route authenticates the raw body using PocketFi's signature, so its Supabase function configuration uses `verify_jwt = false`; that does **not** make its payment operations unauthenticated. The exact URL must be deployed and the secret set before registering it with PocketFi.

PocketFi merchant activation depends on the CEO's registration. RocketAPI signup and transactional-email setup are independent workstreams. SMTP domain verification and sender setup are separate from these payment/social-data adapters.

## RocketAPI

Every request is a server-side JSON `POST` to `https://v1.rocketapi.io`, with `Authorization: Token <private-key>`. The adapter checks both Rocket's `status: done` envelope and the embedded Instagram HTTP status/content type/body status. It preserves large numeric Instagram IDs as decimal strings before parsing them; JavaScript floating-point rounding cannot change an evidence identity. [Authentication and usage](https://docs.rocketapi.io/), [official response-envelope handling](https://github.com/rocketapi-io/rocketapi-python/blob/main/rocketapi/instagramapi.py).

| Operation | Endpoint and request | RealReach use |
| --- | --- | --- |
| Resolve handle | `/instagram/user/get_web_profile_info`, `{username}` | Stable Instagram ID, current username, biography and public/private state. |
| Refresh identity | `/instagram/user/get_info_by_id`, `{id}` | Check the previously bound stable account even after a handle changes. |
| Resolve post | `/instagram/media/get_info_by_shortcode`, `{shortcode}` | Stable media ID, owner ID and whether comments are enabled. |
| Follow search | `/instagram/user/get_following`, `{id,query}` | Cheap positive match against the target's stable ID. A search miss alone does not establish absence. |
| Follow pages | Same endpoint, `{id,count:50,max_id?}` | Complete unfiltered traversal when a negative baseline or retention result is needed. |
| Comments | `/instagram/media/get_comments`, `{id,order:1,can_support_threading:true,min_id?}` | Recent-first top-level comment pages, matched to multiple assignments for the same post. |

Sources: [profile lookup](https://docs.rocketapi.io/api/instagram/user/get_web_profile_info/), [ID lookup](https://docs.rocketapi.io/api/instagram/user/get_info_by_id/), [post lookup](https://docs.rocketapi.io/api/instagram/media/get_info_by_shortcode/), [following](https://docs.rocketapi.io/api/instagram/user/get_following/), [comments](https://docs.rocketapi.io/api/instagram/media/get_comments/).

### Account control

RealReach generates an unpredictable, expiring `RR-…` challenge tied to the signed-in account and requested Instagram handle. The customer temporarily places it in their public Instagram biography. The server retrieves the biography, requires an exact whitespace-delimited token, verifies the stable ID and atomically consumes the challenge. The database must enforce one binding per Instagram identity and prevent reassignment from bypassing paid-action history.

The adapter's `verifyProfileChallenge` checks the observed profile/token. Challenge generation, expiry, consumption, ownership and uniqueness are database/controller responsibilities. This is evidence of control of an Instagram account, not proof of one unique human. RealReach does not collect an Instagram password or session cookie.

### Evidence and continuation

`checkFollowing` returns `verified`, `not_found` or `unknown`, plus reason, page count, observation time and any continuation cursor. Its `visitedCursors` records all next cursors encountered in the initial batch, including the final continuation cursor, so repeated cursors cannot disappear between batches. Search ignores `count` and `max_id` according to Rocket's docs, so only an exact stable-ID hit is used from that shortcut. A short page does not prove the list ended. Negative results need explicit end metadata from the full unfiltered list. `followingPage({workerId,cursor})` lets the job runner persist and resume long scans; it must track preceding pages and repeated cursors.

`commentsPage` returns normalized top-level comments and a continuation cursor. `checkComments` matches a batch by stable author ID, post, creation time after acceptance, optional submitted text and optional original comment ID. Replies and explicitly hidden comments do not qualify. The final check uses the original comment ID, preventing deletion and replacement from masquerading as retention. A partial scan, unavailable page or resumed tail scan alone is not proof of absence. Contradictory end-cursor/more-results flags, additional head-loaded comments without a usable cursor, and malformed pagination metadata cannot establish absence.

The controller/job runner owns saved cursors, scan age, scheduled checks, backoff, evidence retention and settlement. The adapter does not automatically retry or award money. Several calls separated by hours must not be silently treated as one instantaneous complete snapshot. Unavailable or private resources remain unresolved and require the appropriate retry/review path.

Rocket has no documented point-in-time guarantee that an action remained continuously present between observations. The service promises the published completion and final checks, not permanent followers. Provider freshness and realistic page limits must be measured during account acceptance. No undocumented cache-bypass parameter is invented.

### Launch scanning limits

Server-only `rr_operational_limits` starts with eight leased jobs per invocation, up to eight following pages per resumed batch, one comment page per batch, at most 500 scan pages, and a 30-minute maximum scan age. Individual Rocket calls time out after six seconds; the runner stops starting additional batches near its 100-second invocation budget. Page or age limits send the task to review, not a false failure or payment. Founder-approved configuration may raise comment pages per batch up to eight; the default stays one until provider usage and cost have been checked.

Rocket documents at most 50 following records per page, not a guaranteed page size. Eight-page batches can therefore advance long following lists without requiring one huge request, but queue delay and provider errors affect completion time. Comment pages have no documented adjustable page size. A comment buried more than roughly 30 one-page/minute batches deep can reach the age limit even without queue delay. The current shared-comment read covers claims leased together for the same post and cursor; it is not a global cache for every claim on a high-volume post. Large campaigns require measured provider throughput, approved limits and potentially a durable shared per-post scan before promising unattended verification of tens of thousands of actions.

### Likes

There is no paid-like verifier in this adapter. Rocket documents a maximum of 1,000 returned likes without pagination. A requested like-and-comment activity can only settle on the specified **comment** evidence; the UI must not label the like itself independently verified or sell an unqualified verified-like guarantee. [Documented likes limitation](https://docs.rocketapi.io/api/instagram/media/get_likes/).

## PocketFi

Use `https://api.pocketfi.ng/api/v1` with `Authorization: Bearer <API-token>`. The explicit adapter test mode uses `/api/test`; the production backend defaults to live. Public documentation's sidebar includes inconsistent shortened base-URL text; the endpoint examples, authentication table and existing reference implementation use `/api/v1`. Amounts are sent in **naira** even though all RealReach stored amounts are integer **kobo**. [Authentication](https://developer.pocketfi.ng/docs/authentication), [checkout](https://developer.pocketfi.ng/docs/api/initialize-payment).

| Operation | Contract | Result/validation |
| --- | --- | --- |
| Checkout | `POST /checkout/request`: first/last name, real phone/email, `business_id`, `redirect_link`, naira `amount` | Store `payment_id` and validated PocketFi `payment_link`; no credit on initialization or redirect. |
| Confirm collection | `POST /checkout/confirm`: `{payment_id}` | Match the saved provider ID, exact amount and currency when returned. A returned merchant ID must match. Only explicit successful status can settle. |
| List banks | `GET /payout/bank-list` | Validate bank codes/names; preserve leading zeroes; reject conflicting codes. |
| Resolve account | `POST /payout/verify-bank`: `{account_number,bank_code}` | Require a live catalogue bank, exact returned bank code and nonempty account name. The documented response does not echo the account number, so an echoed number is checked when present. |
| Submit payout | `POST /payout/send`: `{account_name,account_number,bank_code,amount}` | Whole-naira payout; validate returned transaction reference, amount, account, merchant and fee. A submission labelled completed remains pending independent confirmation. |
| Confirm payout | `POST /transaction/confirm`: `{payment_id}` | Match reference, amount and account before accepting `completed`. See the limitation below. |

Sources: [checkout](https://developer.pocketfi.ng/docs/api/initialize-payment), [collection confirmation](https://developer.pocketfi.ng/docs/api/verify-payment), [banks](https://developer.pocketfi.ng/docs/api/bank-list), [account resolution](https://developer.pocketfi.ng/docs/api/verify-bank), [payout](https://developer.pocketfi.ng/docs/api/bank-transfer).

### Payout idempotency and uncertainty

The public payout contract does not document a client reference, idempotency header or lookup using our own reference. RealReach therefore persists the withdrawal and claims dispatch atomically **before exactly one POST**. The adapter deliberately sends no invented idempotency header. Timeout, malformed response or a lost response means uncertain outcome; never automatically send again or release the held funds. If the response contains a usable provider ID, retain it even when another field is invalid.

The confirmation endpoint `/transaction/confirm` is used in the owner's existing MONEY provider/reconciliation code but is not currently listed in PocketFi's public navigation. The integration supports it; its payout coverage, `WD…` versus `PFI|…` reference behavior and terminal-state semantics still need confirmation with RealReach's merchant account. The MONEY implementation records a historical false `failed` result. Consequently a payout failure/reversal response maps to `unknown`, not an automatic refund or another payout.

Do not copy another application's private pricing terms. Store observed provider fees independently from RealReach's customer withdrawal fee, and account for provider fees as expenses during reconciliation. Backend publication/rate approval and financial reserves remain separate configuration from possession of an API key.

### Webhook authentication and routing

PocketFi documents HMAC-SHA512 over the exact raw request bytes using the merchant secret. Its documentation calls the header `HTTP_POCKETFI_SIGNATURE`, including a PHP server-variable example; the reference implementation also receives `pocketfi_signature`/`x-pocketfi-signature`. The verifier accepts these narrowly named equivalents, rejects conflicting values, uses cryptographic signature verification and bounds body size at 256 KB. It does not accept a generic `signature` header. [Webhook documentation](https://developer.pocketfi.ng/docs/webhooks).

The handler validates any included merchant ID and locates a saved payment by its provider-generated reference. A payload's email, owner ID, internal payment ID or claimed success cannot route or credit funds. It calls `refreshPayment`, which queries PocketFi again and settles through the database's idempotent financial command. Duplicate completed notifications are acknowledged. A race before the provider ID is saved returns a retryable response rather than discarding the event.

Signed amount/currency disagreements and reversals affecting completed payments create a deduplicated discrepancy through `rr_market_payment_discrepancy`. They never silently alter a balance. Failed processing returns 503 so PocketFi can retry; scheduled payment reconciliation provides the independent recovery path. No full webhook bodies, customer bank details or secrets are logged.

### Operator recheck and lost-reference recovery

`recheckPayment(db, payment, { candidateProviderId? })` is a server-only routine for the singleton admin's AAL2-protected controller. It reloads the saved payment, confirms its **existing bound** PocketFi reference independently, validates the saved amount/recipient and routes a nonterminal result through the same atomic settlement operation. It never calls checkout creation or payout submission. Its narrow result contains `id`, saved `status`, `outcome`, a safe message and optional `provider_state`; it returns no raw provider payload or bank details.

Outcomes distinguish `confirmed`, `not_paid` (unpaid collection), `pending`, `unknown`, `provider_support_required` and `risk_review`. A repeated successful check does not credit twice. A new result contradicting a settled payment or returned payment terms records a deduplicated discrepancy, not a refund or clawback. Existing `rr_payment_risk_holds` remain active even when a later response says completed. Recheck is not a risk-hold clearance authority.

**A lost reference cannot currently be attached automatically.** The public payout request has no client-generated correlation field or idempotency key; checkout confirmation documents only `status`, `amount`, `account` and `payment_id`. The payout submission sample has timestamps, but those are not a documented independently retrievable request identity. An older transaction for the same merchant, recipient and amount is not proof of this dispatch. Consequently an operator-entered unbound reference returns `provider_support_required` without a paid lookup, binding or balance change. It cannot replace a reference already saved for another request. PocketFi must supply a reliable original-request correlation mechanism before this branch can be automated. [Checkout request](https://developer.pocketfi.ng/docs/api/initialize-payment), [confirmation contract](https://developer.pocketfi.ng/docs/api/verify-payment), [payout contract](https://developer.pocketfi.ng/docs/api/bank-transfer).

The public webhook page does not establish a complete reversal/chargeback event contract or definitive payout-failure semantics. The adverse-event guard is defensive handling, not a claim that PocketFi guarantees those events. A valid signed adverse notification on a settled payment can quarantine new exposure without accepting it as authority to debit/refund. Provider support and the founder must determine what evidence resolves the discrepancy, who bears a confirmed reversal after legitimate work was paid, and when a hold may be released. None of those decisions is inferred from a successful later recheck. [Webhook contract](https://developer.pocketfi.ng/docs/webhooks).

## Operations email (Resend)

The new operations migration collects counts every five minutes, independently of email delivery. It flags unresolved/stalled payments, missing references, overdue/review checks, financial holds, old support cases, missing worker progress and stale/failed/discrepant ledger checks. A separate daily ledger scan runs at **03:17 UTC / 04:17 Lagos** using one consistent SQL snapshot. It compares journal totals, account balances, campaign allocations and withdrawal holds; it records findings without changing money. The sole admin can request the same read-only check after MFA.

Alerts contain only fixed issue labels, counts, a timestamp and the RealReach admin link. They contain no customer details, balances, bank data or support text. A global six-hour creation limit prevents a burst for every affected task. Never-attempted stale alerts are superseded; attempted requests remain immutable. Missing sender configuration does not consume delivery attempts.

`marketplace-operations` sends through `POST https://api.resend.com/emails`. SQL leases one saved digest, then freezes its complete recipient/body before the request. Retries reuse **exactly** that request and `rr-ops/<alert-uuid>` key, including after an uncertain response or an acceptance-save failure. Resend retains idempotency keys for 24 hours; local retries stop by 23 hours and after at most eight attempts. Unknown exhausted outcomes remain visible as needing review, not “delivered.” A returned provider ID means **accepted**, not confirmed inbox delivery. [Resend send endpoint](https://resend.com/docs/api-reference/emails/send-email), [idempotency and retry behavior](https://resend.com/docs/dashboard/emails/idempotency-keys).

The scheduled POST uses the existing Vault job token and validates its hash; public callers cannot trigger email. A public GET at `https://jabwuawiqsusjrccapab.supabase.co/functions/v1/marketplace-operations` returns only `{ok:true}` or `{ok:false}` with 200/503. This tests whether the database monitor collected a snapshot within 15 minutes. It is **not** an all-clear for payments, providers or email delivery. Configure an external uptime service against it after deployment; the database cannot alert about its own total outage. Never give that service the private job token.

Before enabling alerts: verify the sender domain, install the three server settings, confirm Cron/Vault/function configuration, then authorize and inspect a real test email. No Resend account, email, external monitor or deployment was created by this local pass. Auth confirmation/reset email still requires its separate Supabase SMTP setup.

## Verification completed in this work

Run:

```powershell
node --experimental-strip-types --test tests/rocket-provider.test.mjs tests/pocketfi-provider.test.mjs
deno test --no-config --node-modules-dir=none --allow-env tests/payment-recovery.test.ts
deno test --no-config --node-modules-dir=none --allow-env tests/operations-runner.test.ts tests/marketplace-operations-http.test.ts
deno check supabase/functions/_shared/rocket.ts supabase/functions/_shared/pocketfi.ts supabase/functions/pocketfi-webhook/index.ts
```

The 55 provider/webhook tests pass with injected documented response fixtures. They verify request contracts, exact IDs and money, validation failures, wrong merchant/owner/amount, forged signatures, replay, persistence races, private accounts, missing pagination, retries and payout uncertainty. They make no live provider requests and move no money. Handler replay fixtures test HTTP routing; actual concurrent ledger/SQL idempotency needs the separate backend integration suite.

Seventeen additional local recovery tests cover bound collection/payout confirmation, replay, wrong amount/merchant/currency/recipient/reference, missing setup, unavailable provider, unknown failures, retained risk holds, concurrent status changes and rejection of an uncorrelated older payment reference. These use injected HTTP fixtures and database doubles, not a live merchant account or hosted database.

## Account acceptance still required

After credentials arrive, use RealReach's own merchant and consenting Instagram accounts to check:

1. Profile challenge propagation, handle changes, private accounts and ownership collisions.
2. Existing-follow baseline, new follow, unfollow before the final check, long-list pagination, rate limits and provider freshness.
3. Comments on the wrong post/from the wrong author, pre-existing comments, edits, replies, deletion, and paginated multi-worker batches.
4. Small authorized collection: checkout → actual provider confirmation → one ledger credit → replay without a second credit.
5. Beneficiary resolution and one separately authorized small payout; validate the status endpoint and actual fee. Exercise uncertainty/reconciliation in sandbox before any live timeout experiment.
6. Real signed webhook header/payload, matching checkout/payout references, merchant identity, delayed notification and reversed-payment handling.

The code is key-gated and production-oriented, but a fixture pass must never be reported as a live provider pass. Public customer flows stay truthful when an integration is unavailable.
