# RealReach V1: verification, providers and engineering plan

Research checked: 27 September 2026. Prices are published USD prices unless marked EUR; taxes, exchange rates and payment-processing fees are excluded.

This supplements the original product handoff. It is a verification-first engineering recommendation, not an implemented backend or a claim that providers have passed our tests. No provider accounts were created, authenticated verification calls made, or payments initiated during this research.

## 1. Decision in plain language

RealReach assigns a specific social action to a specific account, obtains account-level evidence from an API, and releases the reward according to the campaign's published rules. A rising follower/like counter is not worker-level evidence.

There are documented APIs for much of this. We should build and test their integrations, not plan to manually approve every ordinary completion.

The recommended technical pilot shortlist is:

- **X: TwitterAPI.io**, with SocialData as a separately tested alternative.
- **TikTok: TikAPI**, because it documents both public data and connected-user liked-post access. Compare public following/comments against ScrapeCreators.
- **Instagram follows/comments: Zernio**, for connected professional businesses, using its documented DM-dependent follow check. Compare public-data coverage with HikerAPI/RocketAPI where needed.
- **Instagram likes: HikerAPI/RocketAPI evaluation only.** Their documented liker-list interfaces do not establish unrestricted, complete verification of large campaigns.

This is a technical shortlist, not approval from the social networks to operate a paid-engagement marketplace. That commercial distinction is addressed in section 9.

## 2. The actual task-to-endpoint map

| Task | Endpoint / evidence | Account access and V1 treatment |
| --- | --- | --- |
| X follow | TwitterAPI.io `GET /twitter/user/check_follow_relationship`, with `source_user_name` and `target_user_name`; inspect `data.following`. | Public accounts. Resolve and bind immutable account IDs; re-resolve current handles before a handle-based call. Include in the technical pilot. |
| X comment/reply | TwitterAPI.io `GET /twitter/tweets?tweet_ids=...`; verify the submitted reply's author, direct parent and creation time. | Worker submits their reply URL. This avoids searching every reply to a popular post. Re-fetch for retention checks. |
| X like | Official X `GET /2/users/{id}/liked_tweets`, with user-authorized access and appropriate read scopes. | Separate official developer app/OAuth integration. Do not present TwitterAPI.io or SocialData as public like verifiers. Keep disabled until access and behaviour are tested. |
| TikTok follow | TikAPI `GET /public/following?secUid=...`; or connected-user `/user/following`. Match the business's identity in returned accounts. | Public-readable following list or authorized account. Follow pagination; privacy-limited/incomplete output is not a definitive negative. |
| TikTok like | TikAPI `GET /user/likes` with API key and the worker's AccountKey; match the campaign video ID. | Requires TikAPI's connected-user authorization with `explore` scope. Its authorization service is unofficial, not TikTok Login Kit. |
| TikTok comment | TikAPI `GET /public/comment/list?media_id=...`; match author ID, video, comment ID/text and timestamp. | Public visible comments; paginate and batch matching for workers on the same video. A comment count is insufficient. |
| Instagram follow | Zernio `GET /v1/accounts/{accountId}/follow-status/{userId}?refresh=true`; inspect `isFollower`. | Business connects a professional Instagram account. Worker must first message that business; use the sender's Instagram-scoped ID. A comment alone does not grant the required messaging consent. |
| Instagram comment | Zernio comment webhooks/listing on connected business media; match author, media, comment ID and time. | Bind the comment's identity in the correct provider/account context. RocketAPI/HikerAPI public comment APIs are alternatives to test. |
| Instagram like | HikerAPI `/v2/media/likers?id=...` returns individual users; RocketAPI `/instagram/media/get_likes_by_shortcode` returns at most 1,000 likers, without pagination. | Positive ID matches can supply evidence. Missing IDs in a capped or incomplete list cannot prove non-completion. Keep out of unrestricted V1 sales until coverage is demonstrated. |

Sources: [X relationship check](https://docs.twitterapi.io/api-reference/endpoint/check_follow_relationship), [X post lookup](https://docs.twitterapi.io/api-reference/endpoint/get_tweet_by_ids), [official X liked posts](https://docs.x.com/x-api/users/get-liked-posts), [X scopes](https://docs.x.com/fundamentals/authentication/guides/v2-authentication-mapping), [TikAPI reference](https://www.tikapi.io/documentation/), [Zernio follow-status reference](https://docs.zernio.com/accounts/get-instagram-follow-status), [Zernio Instagram capabilities](https://docs.zernio.com/platforms/instagram), [Hiker media endpoints](https://hiker-doc.readthedocs.io/en/latest/api-reference/v2/media/), [RocketAPI likes limit](https://docs.rocketapi.io/api/instagram/media/get_likes/).

### Instagram's DM-based follow flow

This is a concrete alternative to scanning a business's entire follower list:

1. The business connects its professional account through Zernio's OAuth flow.
2. RealReach gives the worker a short-lived, single-use task code to DM to that business **before following**.
3. The incoming message identifies the sender. We bind that sender to the verified RealReach social identity and take the initial follow-status reading.
4. An existing follower is ineligible for a *new follower* reward. A non-follower is instructed to follow.
5. RealReach requests a fresh status after completion and again before releasing the reward.

Zernio documents `refresh=true` to bypass its brief cache. Unknown consent/access states remain pending. Its endpoint uses Instagram-scoped IDs; these must not be blindly equated with public scraper IDs. The pilot must validate identity mapping and rechecks after the intended holding period.

This adds a DM step and requires business onboarding. It is a proposed product flow using a documented capability, not proof of commercial permission. [Follow-status details](https://docs.zernio.com/accounts/get-instagram-follow-status), [business connection](https://docs.zernio.com/connect/get-connect-url).

### Additional platforms

- **YouTube:** official `subscriptions.list(mine=true, forChannelId=...)`, `videos.getRating(id=...)`, and comment lookups supply relevant evidence. Google Cloud project setup and user OAuth are required where accessing the user's activity. These reads use quota units; default general quota is 10,000 units/day. Technical availability does not override YouTube's fake-engagement policy, which treats engagement solely for financial gain as illegitimate. Defer from the initial integration set. [Subscriptions](https://developers.google.com/youtube/v3/docs/subscriptions/list), [ratings](https://developers.google.com/youtube/v3/docs/videos/getRating), [comments](https://developers.google.com/youtube/v3/docs/comments/list), [quota](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits), [fake-engagement policy](https://support.google.com/youtube/answer/3399767?hl=en).
- **Facebook:** do not advertise a complete follow/like/comment verification package in this V1. Connected Page comments are a narrower integration opportunity; a general person-to-Page follow/like verification route has not been established by this research.

## 3. Provider comparison: price, access and fit

Published prices are inputs to testing, not locked supplier quotes.

| Provider | Published billing / setup | Why use it, or why not first |
| --- | --- | --- |
| TwitterAPI.io | Relationship endpoint: 100 credits/check, labelled trial-operation pricing. At 100,000 credits/$1, that is **$0.001/check**. Standard returned posts: $0.15/1,000. Signup, API key and credit balance; no worker credentials for public reads. | Lowest documented direct X follow-check price in this shortlist. First X pilot. |
| SocialData | **$0.004/follow check**, **$0.008/reply or repost verification**, $0.0002/single post lookup. Pay as you go. Default 120 requests/minute, higher limits available by request. | Direct ID-based verification endpoints fit the task closely. More expensive follows; good comparison/fallback candidate. |
| TikAPI | **$29/month: 300 requests/day; $79: 2,000/day; $189: 10,000/day.** Starter advertises a five-day trial. | Covers connected-user likes as well as public following/comments. Account-session behaviour is a required test. Daily quotas count requests/pages, not completed paid tasks. |
| ScrapeCreators | **$47/25,000 credits** or **$497/500,000**; 100 initial free credits. TikTok following is one credit/request. | Useful public TikTok following/comments alternative without worker session management. Not a replacement for TikAPI's connected-user likes. Its current Instagram catalogue does not establish follower/liker coverage. |
| HikerAPI | **$0.001/request unit** on Standard; published minimum top-up $20; 100 initial free requests. Some calls consume multiple internal units. | Broad Instagram public-data coverage. Search-following costs two units by default. Liker completeness and review-integrity concerns prevent an unconditional recommendation. |
| RocketAPI | **EUR49/month for 50,000 requests**; 100 free test calls. Bills 200 and 404 responses. | Useful second Instagram comparison candidate; explicit limits are documented. Not an unlimited likes solution. |
| Zernio | **First two connected accounts free; accounts 3-10 $6/account/month, 11-100 $3, 101-2,000 $1.** Ten connected accounts total $48/month. | Most useful newly identified Instagram route: connected-business follows/comments. Billing is for connected business social accounts, not every worker who messages them. Platform and API rate limits still apply. |
| EnsembleData | **$100/month for 1,500 units/day; $200 for 5,000/day**; free trial offers 50/day. Endpoint unit weights differ. | Additional public TikTok following/comment comparison candidate. Higher fixed starting cost; not needed alongside every other provider for a two-person pilot. |

Pricing sources: [TwitterAPI.io rates](https://twitterapi.io/pricing), [relationship operation price](https://docs.twitterapi.io/api-reference/endpoint/check_follow_relationship), [SocialData prices](https://docs.socialdata.tools/getting-started/pricing/), [SocialData limits](https://docs.socialdata.tools/getting-started/rate-limits/), [TikAPI plans](https://tikapi.io/), [ScrapeCreators plans](https://scrapecreators.com/), [TikTok following cost](https://docs.scrapecreators.com/v1/tiktok/user/following/), [Hiker pricing/top-up](https://hikerapi.com/help/hikerapi-vs-scrape-creators), [Hiker internal units](https://hiker-doc.readthedocs.io/en/latest/guides/request-costs/), [RocketAPI plans](https://rocketapi.io/), [Zernio billing tiers](https://zernio.com/blog/pay-per-account-pricing), [EnsembleData plans](https://ensembledata.com/pricing).

### What public feedback actually supports

- **TwitterAPI.io:** Trustpilot currently shows 4.6/5 from 32 reviews. Positive reports discuss integration, data and support; negative reports include extraction reliability, support and missed repost-after-undo behaviour. These are customer reports, not measured follow-verification accuracy. [Reviews](https://www.trustpilot.com/review/twitterapi.io).
- **TikAPI:** 4.4/5 from 61 reviews, including reviews dating to 2021. Its own support forum contains reports of missing data, errors, pagination problems and account-session expiry. These establish issues to test, not an observed current outage or a known failure percentage. [Reviews](https://www.trustpilot.com/review/tikapi.io), [support forum](https://helpdesk.tikapi.io/portal/en/community/tikapi).
- **Zernio:** 4.8/5 from 185 Trustpilot reviews, on a merged/rebranded profile. Feedback predominantly concerns integration and support. Some verified AppSumo purchasers dispute legacy-deal pricing and add-ons. That is a commercial-history concern, not evidence that its follow check fails. [Reviews](https://www.trustpilot.com/review/zernio.com), [purchaser complaint](https://appsumo.com/products/late/questions/develop-and-get-rid-of-appsumo-users-by-1507290/1510061/).
- **ScrapeCreators:** G2 shows approximately 350 reviews at 4.6/5; visible reviews include seller-invited submissions. Useful adoption evidence, not a task-verification benchmark. Its own Instagram comments documentation warns of approximately 90% request success. [G2](https://www.g2.com/sellers/scrape-creators), [endpoint warning](https://docs.scrapecreators.com/v2/instagram/post/comments/).
- **HikerAPI:** Trustpilot withholds its rating and says fake reviews were removed. Do not use its positive review volume to establish trust. [Moderation notice](https://www.trustpilot.com/review/hikerapi.com).
- **EnsembleData:** 4.4/5 from 11 reviews, a small and mostly older sample. [Reviews](https://www.trustpilot.com/review/ensembledata.com).
- **SocialData and RocketAPI:** this search did not establish a comparable, substantial independent review sample. Their documented endpoints justify testing; they are not proven higher-quality suppliers merely because their documentation fits our needs.

Do not buy every plan. Start with trials/small credit balances and compare the same actions against competing providers before choosing the paid production set.

## 4. Access: signup, authorization and approval are different

For public-data providers, we generally register, obtain a server-side API key, and add credits/select a plan. This is not an application for official access from Instagram, TikTok or X. No customer social password is needed for those public reads. [Hiker setup](https://hikerapi.com/), [SocialData setup](https://socialdata.tools/), [ScrapeCreators setup](https://docs.scrapecreators.com/).

For TikAPI connected-user endpoints, the worker authorizes through TikAPI and we receive an AccountKey. Use minimum read scopes and encrypted server-side token storage. Its session-expired response requires reauthorization; an expired session must not be recorded as a failed task. [TikAPI documentation](https://www.tikapi.io/documentation/).

For Zernio, the business connects through the provider's hosted platform-OAuth integration. A normal worker can prove control through a task DM; the worker does not need a professional creator account for that DM flow. Direct Meta integration would be a separate app/permissions/review project, not something to assume automatically approved. [Instagram connection and scopes](https://docs.zernio.com/platforms/instagram).

Official X/Google integrations require their developer setup and user consent where applicable. TikTok Research API is not a commercial workaround: its FAQ explicitly excludes commercial users. [TikTok eligibility](https://developers.tiktok.com/docs/en/research-api-faq).

## 5. Proposed engineering flow

The timings below are proposed product settings, not provider guarantees.

1. **Prove account control once.** Use authorized identity where available; otherwise issue an expiring random bio code and fetch the profile to verify it. Store the platform's stable ID, not just the handle. Map scoped provider identities explicitly. Enforce one linked social identity per RealReach owner; require re-verification for changes.
2. **Validate and fund the business campaign.** Resolve its target URL to a platform ID, lock the action/rules/price, verify payment server-side, and reserve its budget. A browser redirect saying "success" does not fund a campaign.
3. **Check eligibility before assignment.** Exclude prior paid completions of that actor/action/target across campaigns. For a new-follow or new-like task, establish that the action is not already present. An inaccessible/incomplete baseline makes the task ineligible until resolved; it is not permission to guess.
4. **Reserve one place and reward.** An atomic reservation prevents a 1,000-task budget from accepting 1,100 simultaneously payable claims. The reservation has an expiry and cannot be reassigned while a valid completion is settling.
5. **Worker performs the action in the social app.** Returning to RealReach and pressing "Check task" only requests verification. It never sets the verified state itself.
6. **Verify on the server.** Check actor, target and action. For comments, also inspect creation time, the direct parent, and objective campaign rules. Reuse a fresh post-level comment result across relevant claims; do not download the same entire list once per worker.
7. **Record initial confirmation as pending earnings.** A proposed 48-hour holding window lets us check again before money becomes withdrawable. Show the rule before acceptance. For follows/likes, use a fresh final state; for comments, verify continued existence and content.
8. **Settle exactly once.** Only a successful final decision credits the user's available wallet and marks a billable delivered task. Database uniqueness and a transactional ledger make retries safe.
9. **Process withdrawal separately.** Reserve available funds, initiate the PocketFi payout, then reconcile by provider reference/status. Never resend an ambiguous payout with a new reference merely because a request timed out.

Suggested task states: `reserved -> submitted -> checking -> verified_pending -> payable`; exceptional branches: `retry_wait`, `needs_reconnect`, `needs_review`, `rejected`, `expired`. Withdrawal states are separate from task states.

### What happens when an API does not answer cleanly?

- Fresh positive evidence: continue automatically.
- Reliable current negative: do not pay; allow correction within the assignment window where appropriate.
- Timeout, rate limit, privacy restriction, incomplete list or expired token: pending, with bounded retry/reconnect/fallback handling.
- Conflicting evidence: preserve it and route the claim to review.
- Provider-wide outage: pause affected new assignments, retain reserved funds and retry in the background. Do not create thousands of manual-review jobs for the same outage.

A suggested retry schedule is 15 seconds, 1 minute and 5 minutes with jitter and rate-limit awareness. Tune it from actual observations; it is not a promise of immediate verification.

### Freshness is part of correctness

SocialData's reply verifier caches discovered comment IDs and can keep returning them after deletion. Use a fresh post lookup before payout, not a second call to the cached detector. Its docs explicitly prescribe that distinction. [Behaviour and deletion check](https://docs.socialdata.tools/social-actions/verify-user-commented/).

ScrapeCreators allows cache controls and a team-level opt-out. Payout checks must request live data or use a clearly bounded freshness rule; a free cached response is not automatically suitable evidence. [Cache controls](https://docs.scrapecreators.com/caching/).

A recheck proves the state when checked. It does not prove uninterrupted following every second between observations. Sell a defined verification/retention condition, not permanent followers or continuous surveillance.

### Screenshots, people and business disputes

Screenshots are optional appeal attachments, never the normal automatic payout trigger. Reusing someone else's screenshot cannot satisfy an API check tied to the claimant's verified account.

An engagement API proves an account's action, not that it belongs to a unique human. Account-control proof, verified contact details, duplicate/social-history checks and payout identity checks are separate controls. Before real withdrawals, confirm PocketFi's actual identity/beneficiary capabilities; do not assume it supplies full KYC or person deduplication.

Businesses see itemized verified results and observation times, not just a change in total followers. They cannot veto a valid completion to avoid payment. Store enough restricted evidence to investigate disputes. If a business deletes its post, revokes access or blocks a worker during settlement, treat that as a campaign/dispute event, not automatic worker fraud.

## 6. Small-team backend architecture

Keep the existing React/TypeScript/Vite frontend on Vercel. Do not rewrite it merely to add verification.

- **Supabase Auth:** one identity with server-managed roles. The admin signs in normally and can switch interfaces; every privileged request checks the role independently of the visible interface. Require MFA for admin money actions.
- **Postgres:** campaign reservations, task decisions, restricted verification evidence, wallet ledger and payment references.
- **Server functions:** provider calls, account-binding challenges, payment validation and authorized task transitions. Provider and payment secrets never enter `VITE_*`, browser storage or client bundles. Supabase's publishable client key is not a privileged secret; authorization still requires correct RLS.
- **Supabase Queues plus Cron and short-lived workers:** durable checks, delayed final checks, retries and reconciliation. Closing the browser must not stop a task. Queue redelivery is expected; settlement remains idempotent.
- **PocketFi adapter:** collections and withdrawals, using only verified provider events/status. Its exact signing/status/refund/idempotency contract must be confirmed before implementation.
- **Admin exception inbox and alerts:** unresolved checks, suspicious duplicate identities, provider outages, low credit balances and ambiguous payments. The admin does not approve every routine success.

The Supabase security skill informed the server-only credentials and authorization boundaries in this plan. No database or service configuration was changed. [Queues](https://supabase.com/docs/guides/queues), [Cron](https://supabase.com/docs/guides/cron), [server secrets](https://supabase.com/docs/guides/functions/secrets).

Implement one internal verification interface per platform/action. Normalize provider output into positive, negative or unknown evidence with observation time, actor/target IDs, source and cost. This allows a tested provider replacement without changing wallet logic. Store IDs as strings to avoid JavaScript integer precision loss.

We do not need Kubernetes, a fleet of custom scrapers, an AI screenshot judge or a full-time verification department to build this pilot.

## 7. What verification actually costs

Use this calculation, not a generic "API calls are cheap" assumption:

`verification cost = baseline requests + completion requests + final checks + pagination + retries + identity lookups`

Each term is multiplied by that endpoint's applicable price or quota weight. Business pricing must also cover worker rewards, collections/payout fees, infrastructure, refunds/fraud allowance and margin.

For an illustrative **10,000 new X follows**, with exactly three direct checks per worker and no retries:

- TwitterAPI.io: `10,000 x 3 x $0.001 = $30`.
- SocialData: `10,000 x 3 x $0.004 = $120`.

These exclude account lookups and other operating costs, and use currently published rates. They are not estimates of a failure rate. [TwitterAPI.io operation](https://docs.twitterapi.io/api-reference/endpoint/check_follow_relationship), [credit conversion](https://twitterapi.io/pricing), [SocialData rates](https://docs.socialdata.tools/getting-started/pricing/).

For TikAPI, the $189 plan's 10,000 daily requests are **not 10,000 verified tasks/day**. At three single-page calls per task, the arithmetic upper bound is about 3,333 tasks/day before identity calls, extra pages or retries. Public-list sharing can reduce work; long following lists can increase it. Measure the actual cost per verified task. [Plan quotas](https://tikapi.io/).

For list-based providers, benchmark accounts with large existing followings and posts with many existing comments/likes. A ten-person campaign on an empty account will not reveal all pagination and cost limits.

## 8. Implementation and test order

### First deliverable: a provider comparison harness

Before production wallets, implement read-only adapters with server-side keys. For the same controlled action, record the platform truth, provider result, data freshness, time to confirmation, cost and retry outcome. This directly settles provider choice.

Start with X direct follows, Instagram connected-business follow checks, TikTok follows/comments/connected likes, and the Instagram liker-list evaluation. Test unavailable/private and large-list cases, not just happy paths.

### Second deliverable: the CEO's ten-person end-to-end pilot

CEO account creates a mock-funded business campaign; ten invited workers prove account control, accept tasks, perform actions and see pending/available mock balances.

The group deliberately exercises:

- Completed and never-completed tasks.
- Already-following/already-liked accounts.
- Follow/like then undo before final check.
- Follow then undo then repeat; comment then delete/edit.
- Duplicate submissions, reused social identities and changed handles.
- Wrong author, wrong target and nested replies where direct replies are required.
- Expired authorization, rate limits, stale provider cache and service outage.
- Business post deletion/disconnection and disagreement with a valid result.
- Duplicate verification jobs and repeated payment events, with no duplicate reward.

The comparison measures incorrect approvals, incorrect rejections, pending/retry share, human minutes, user onboarding friction, latency and total verification cost. Do not invent an acceptable exception percentage before observing it. A wrong-author approval or duplicate payout is a correctness defect to fix, not acceptable routine review workload.

### Third deliverable: controlled live-money release

After verification, security and payment reconciliation pass, enable a capped real-money flow for approved task types. Expand traffic gradually to measure capacity. If a provider cannot support a task, keep that task unavailable rather than selling it and transferring ordinary workload to the CEO.

Proposed V1 excludes AI targeting, referrals with cash bonuses, subscriptions, native apps, private-account scraping, automated social actions on users' behalf, unlimited-size guarantees and unproven task types. Public campaign size caps should follow the measured eligible worker pool and verification capacity, not the maximum integer a form accepts.

## 9. Commercial constraint that API tests cannot settle

The requested paid-follow/like/comment model has a platform-permission problem in addition to engineering work. X explicitly prohibits compensating others to inflate engagement metrics. TikTok also prohibits services selling artificially increased engagement. YouTube's fake-engagement policy treats engagement whose sole purpose is financial gain as illegitimate. These restrictions are not limited to bot delivery. [X policy](https://help.x.com/en/rules-and-policies/authenticity), [TikTok explanation](https://newsroom.tiktok.com/how-tiktok-counters-deceptive-behaviour?lang=en-150), [YouTube policy](https://support.google.com/youtube/answer/3399767?hl=en).

Provider signup, customer reviews and a passing test do not grant an exception to a social network's rules. A third-party provider accepting the use case also cannot override the platform. Describe the actual compensated-action model when checking permitted use; do not present it as generic analytics to obtain approval.

This does not invalidate the endpoint mapping or make automatic verification imaginary. It means the technical pilot and approval to publicly market paid engagement are separate decisions. If durable platform-compliant operation is required, the paid deliverable itself may need to change, for example to disclosed creator content or research participation; that would be a founder scope decision, not a silent engineering pivot.

## 10. Recommendation to the founders

Proceed with a narrow, verification-first technical pilot. Evaluate the named endpoints against known actions and pick providers using the measured results. Build the marketplace around automatic verification, reserved funds and exactly-once settlement, with humans handling exceptions.

Do not advertise every platform/action combination merely because a vendor says "social data API." Instagram likes at large scale and public X likes remain specific coverage gaps in the proposed third-party set. Resolve commercial permission separately before a paid public launch. The next engineering work is a small testable verification backend, not more frontend polish or a speculative manual moderation operation.
