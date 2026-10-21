# Marketplace backend handoff — 21 October 2026

## Release status

The marketplace code is **deployed, with payments explicitly disabled**. The
three new versioned migrations and four Edge Functions listed below are live in
RealReach project `jabwuawiqsusjrccapab`. Independent read-only checks confirmed
`ACTIVE_HEALTHY` and the expected Supabase URL. Deployment is not acceptance of
real payment or Instagram-provider behavior.

Commit `f2e4209` was pushed to GitHub. Its Vercel Git deployment is `READY` at
`realreach.com.ng`, deployment `dpl_n8bDybQifscdKczVDfebJeRbcrFx`, as verified by
the coordinating release agent. Existing Auth, fixed account types, singleton
admin and saved drafts were preserved.

Before private acceptance testing, the database had four profiles, zero payments
and zero ledger journals. The coordinating agent has since created two private
QA accounts under the user's instruction to perform the tests; no emails or
money were used for those accounts. Thirty ordinary-user live API checks and
eleven real browser form checks subsequently passed. Final independent counts:
six users/profiles, one business, one unfunded draft and three labelled QA cases;
zero payments, journals, ledger entries/accounts and jobs. See the
[current live QA evidence](RealReach-Marketplace-Implementation-QA.md#live-browser-acceptance).
These tests do not establish provider acceptance, email delivery or admin AAL2.

## Deployed implementation

- Additive migration `20261021165450_marketplace_production_core.sql`: verified
  Instagram identity/challenges, campaigns/quotes, atomic task claims, evidence,
  leased verification jobs, balanced integer-kobo ledger, funding/withdrawal
  intents, bank beneficiaries, cases, notifications, audits and operational limits.
- `realreach-marketplace`: authenticated command/read endpoint. Uses verified
  Auth identity plus an active `auth.sessions` lookup; does not trust browser roles.
  All admin mutations additionally require the pinned singleton and verified AAL2.
- `marketplace-jobs`: durable baseline, completion, retention and payment checks.
  Unknown provider results cannot pay rewards or release a possibly sent payout.
- Additive `20261021182743_marketplace_operations_monitor.sql` and
  `marketplace-operations`: five-minute operational snapshots, daily consistent
  read-only ledger scans, immutable throttled alert outbox and bounded Resend
  retries. Admin reads/manual checks require the singleton and AAL2. Public GET
  exposes monitor freshness only; scheduled POST requires the private job token.
  See [sender configuration and limits](RealReach-Provider-Contracts.md#operations-email-resend).
- Additive `20261021191322_payment_launch_gates.sql`: independent
  `collections_enabled=false` and `payouts_enabled=false` settings, plus
  `payouts_paused=true`. Database triggers block new payment intents and first
  dispatch while disabled, including a direct service-role command. Edge
  creation paths and capability responses also honor the gates. Existing
  payment confirmations, status checks and reconciliation remain available.
  Installing keys or changing the normal admin pricing/pause settings cannot
  enable either launch gate; enablement requires a separately authorized
  operator action after payment validation.
- `pocketfi-webhook`: signed notification handling with authoritative provider
  confirmation, discrepancy retention and replay-safe settlement. Its deployed
  presence does not mean PocketFi credentials or live acceptance are complete.
- Shared marketplace modules: payments, lists, projections, request handler,
  job orchestration and limits. Provider adapters/webhook are separate modules.
- Browser money/state writes and privileged RPC execution are denied. SQL
  functions recheck ownership after the Edge handler authenticates the caller.
- Historical profiles, businesses and unfunded drafts are preserved. Existing
  draft IDs are copied into the new campaign table without inventing balances.

## Contract details for the frontend

- `workspace`, `campaign-quote` and `task-detail` return their objects directly.
- `campaign-save` accepts `{campaign: CampaignInput}`; engagement `action` is
  nested so it cannot replace the endpoint command name.
- Publishing requires the accepted `terms_version`, `expected_updated_at` and
  `expected_total_kobo`. All three are checked in the locked transaction.
- `task-detail` accepts either a campaign ID or the caller's assignment ID,
  including an assignment older than the initial workspace snapshot.
- `active_count` includes pending final checks. `pending_count` is a subset.
  Available places are `quantity - delivered_count - active_count`.
- `list` supports feed, assignments, campaigns, transactions, payments,
  notifications and cases. It returns 50 items with a stable keyset cursor.
  Payments expose no raw bank details and support collection/payout filtering.
- Withdrawal history is one available-wallet reservation row projected as a
  withdrawal with its actual payment status. It is not a second wallet debit.
- New `withdraw` requests require `expected_fee_kobo` and `terms_version`.
  A changed or missing quote rejects before reserving money. Replaying an
  existing intent keeps its original fee; changing its beneficiary is rejected.
- Signed adverse payment events are retained even before confirmation. Successful
  settlement applies any earlier discrepancy hold in the same owner-locked
  transaction; repeated events and stale conflicting confirmations cannot skip
  that hold. `rr_market_payment_discrepancy` adds optional `p_expected_state`,
  default null. Only `failed` is supported: ordinary unpaid failure is retained
  without opening a dispute, but becomes a protective hold if contradicted by
  successful settlement. No signed notification alone credits or refunds money.
  Delayed `pending`/`unknown` polls preserve a committed terminal state without
  creating a false dispute. Customer refresh returns the committed row; admin
  recheck distinguishes a nonfinal response from an actual terminal conflict.
- `admin-overview` includes `health`: queued/due/running/attention checks,
  oldest due time and server-only operational limits. Other admin commands are
  `admin-settings`, `admin-case` and `admin-retry`. There is no force-credit,
  force-payment-success or force-task-approval endpoint.

## Workload and cost limits

`rr_operational_limits` is service-only. Changing it requires an authorized
operator database action; it is not editable by customers or the pricing form.

| Setting | Current default |
| --- | ---: |
| Jobs leased per invocation | 8 |
| Following pages per continuation | 8 |
| Comment pages per shared continuation | 1 |
| Maximum pages per scan | 500 |
| Maximum scan age after first lease | 30 minutes |
| Admission threshold for queued/running checks | 100 |

The scheduler runs once a minute. Jobs share a comment page only when they are
in the current leased batch with the same post and cursor. A following check
also incurs profile/search requests; page counts are not a provider invoice.
Comment batching can be raised explicitly, up to eight pages, after approving
the cost and measuring the provider. Total invocation work is bounded near
100 seconds; remaining leases are returned to the queue, preserving progress.

The admission threshold includes backoff/continuing checks, but excludes future
retention checks that have not started. Existing accepted tasks can still be
submitted. It prevents new claims from adding indefinitely to a busy queue; it
is not a guarantee of 100 simultaneous completions or a daily throughput promise.
The worker's completion timer starts only after baseline eligibility succeeds,
not when the claim waits in the queue.

A stale, cyclic or over-budget scan enters `needs_review` with its allocation
held, rather than looping indefinitely or pretending that missing evidence is
success. Intermediate cursors persist between batches. Operator retry starts a
fresh scan. Unknowns cannot be approved merely by clicking retry.

At the default comment rate, a full negative scan across more than roughly
30 pages cannot finish within 30 minutes even without competing work. Shared
queue load reduces that capacity further. Large following lists also need
multiple batches, and provider pages are not guaranteed to contain 50 accounts.
The provider does not expose a reliable count in the current profile adapter,
so no fabricated preclaim size check is applied. These limits deliberately
protect cost and correctness; high-volume delivery needs measured capacity
tuning and potentially broader per-post scan sharing before it is advertised.

Installing keys alone does **not** enable payments, approve commercial pricing
or increase provider usage. Both payment launch gates remain false, prices are
zero/unapproved, and payouts are paused. The founder must approve rates, fees,
retention and operating limits separately. Payment gates must remain off until
the separately authorized live payment checks have passed.

## Completed migration/deployment route

Read-only comparison confirmed the contents of all three historical local
migrations match their deployed statements exactly after newline normalization.
Only their filename versions differed. The local files have now been renamed
to match the existing remote history, without changing their SQL contents:

| Former local filename | Deployed version / current local filename |
| --- | --- |
| `20260928185915_identity_and_instagram_pilot.sql` | `20260928190700_identity_and_instagram_pilot.sql` |
| `20260928192729_pilot_scheduler.sql` | `20260928192914_pilot_scheduler.sql` |
| `20260929083042_account_boundaries_and_campaign_drafts.sql` | `20260929083206_account_boundaries_and_campaign_drafts.sql` |

Following explicit push/deploy authorization, the coordinating agent applied:

1. `20261021165450_marketplace_production_core.sql`.
2. `20261021182743_marketplace_operations_monitor.sql`.
3. `20261021191322_payment_launch_gates.sql`.

It then deployed `realreach-marketplace`, `marketplace-jobs`, `pocketfi-webhook`
and `marketplace-operations`, and released the matching frontend through the
GitHub/Vercel deployment above. No migration-history repair was used: correct
remote history was preserved rather than relabelled or marked applied without
execution. The three historical local filename corrections are complete.

## Independent live release checks

Read-only checks after deployment established:

- Four pre-acceptance profiles preserved; zero payments and ledger journals at
  that checkpoint. Subsequent private QA account creation is separate, as noted
  above; do not interpret these counts as a final post-testing snapshot.
- Collection and payout launch gates false, payouts paused, pricing unapproved;
  the payment-gate trigger enabled. Public capabilities also returned
  `payments:false`, `payouts:false`, `instagram:false`, `pricing:false` and
  `payouts_paused:true`.
- No public tables lacking RLS, and no `rr_market_*` or `rr_ops_*` functions
  executable by `anon` or `authenticated`.
- Marketplace and operations-monitor cron runs succeeded. The 19:20 UTC
  monitoring snapshot contained zero payment/check/hold/support exceptions.
  Its actual dispatched HTTP response was `200` with email not configured,
  rather than merely a successful network enqueue. No alert had been sent:
  the queued alert had zero attempts.
- Public monitor GET returned `200 {"ok":true}`. This means the collector is
  fresh, not that every product flow is healthy. Unauthenticated operations
  POST, jobs POST and workspace POST returned `401`. An unsigned PocketFi
  webhook request returned `503 configuration_unavailable` while its secrets
  were absent; it did not process a payment.
- First reconciliation was still never-run at that checkpoint; its daily cron
  is scheduled for 03:17 GMT/UTC. The monitor honestly reported
  `reconciliation_stale`. Worker heartbeat was unset with no queued work, not
  claimed as a successfully tested provider run.
- Performance advisors reported no warnings. Security advisors reported the
  existing intentional authenticated onboarding SECURITY DEFINER function
  and disabled leaked-password protection. The onboarding definition was
  inspected: confirmed caller identity, fixed-role checks and singleton-admin
  restrictions remain present. Leaked-password protection remains a follow-up.
- The legacy `realreach-instagram-pilot` cron remains active; this is historical
  configuration, not evidence that the current Instagram integration is ready.

These checks did not create accounts, call a payment/Instagram provider, or
move money. They do not replace the ordinary-user acceptance work now in progress.

## Verification completed locally

- **94 PostgreSQL/PGlite checks**: migration preservation, grants/RLS, role and
  owner isolation, session checks, quotes, reserve/settlement accounting, replay,
  baseline timers, retention, comment uniqueness, provider identity matching,
  dispatch-once payouts, uncertain-response binding, immutable balanced ledger,
  repeat-account abuse, review recovery, cursor limits and admission pressure;
  immutable owner-isolated payment holds, blocked new spending/claims, preserved
  existing obligations, service-only payment view, and audited unpaid review
  closure with exact allocation release, lease invalidation and replay safety;
  before/after-confirmation discrepancies and explicit withdrawal-fee consent.
- **25 HTTP/session tests** against the actual handler with injected identity
  and database doubles: unauthenticated requests, cross-role writes, admin AAL2,
  malformed/oversized requests, amount validation, owner-scoped payment reads,
  server transaction filters, unknown payout projection, revoked sessions and
  configured-provider requests blocked by disabled payment launch gates.
- **11 payment launch-gate database checks**: both directions default off,
  no new intents or first dispatches while disabled, independent direction
  controls, temporary payout pause, existing-payment settlement preserved,
  customer denial and normal admin settings unable to enable the gates.
- Deno type checks pass for the four new Edge entrypoints. `git diff --check`
  passes. No new package.json dependency was required.
- **31 native PostgreSQL 17.11 checks across 29 synchronized multi-connection
  races**, using 2–12 independent backend PIDs behind a database start barrier:
  funding/payout replay, same-campaign publication, last-slot and duplicate
  claims, reward settlement, competing withdrawals/campaign spending, closure
  versus claims, cancellation versus baseline, payment hold versus publication
  and allocation, repeated discrepancy events, settlement under an existing
  hold, review closure versus retry/stale results, duplicate closures, verified
  settlement versus closure, event-before/event-after confirmation, stale
  conflicting confirmations, changed withdrawal fees and ledger invariants;
  reconciliation during funding, single digest/lease races, frozen request
  preparation and concurrent finish replay; default-off launch gates and a
  gate-disable transaction winning against simultaneous collection/payout first
  dispatches and a new collection intent.
  No deadlocks or lock/statement timeouts occurred. The temporary loopback-only
  cluster was stopped after the run; no production database was accessed.
- **37 PocketFi/webhook contracts and 17 payment-recovery tests** passed in the
  latest targeted run, including pending reversals, ordinary failure observation,
  wrapped adverse events, terminal contradictions, nonfinal observations and
  authoritative concurrent recheck/refresh reporting. These use injected
  provider responses, not live payment acceptance.
- **33 operations database checks** include actual SQL → runner → email adapter
  → SQL with injected transport, acceptance and uncertain retry after recipient
  configuration changes. **34 operations HTTP/runner tests** verify safe admin
  access, worker heartbeat isolation, job-token authorization, liveness,
  immutable retries and acceptance-save failure. No email or live database call.

Commands:

```powershell
deno run --no-config --node-modules-dir=none --allow-read --allow-env --allow-sys tests/marketplace-database.mjs
deno run --no-config --node-modules-dir=none --allow-read --allow-env --allow-sys tests/marketplace-operations-database.mjs
deno run --no-config --node-modules-dir=none --allow-read --allow-env --allow-sys tests/payment-launch-gates-database.mjs
deno test --no-config --node-modules-dir=none --allow-env tests/marketplace-operations-http.test.ts tests/operations-runner.test.ts
deno test --config supabase/functions/deno.json --allow-env tests/marketplace-http.test.ts
deno check --config supabase/functions/deno.json supabase/functions/realreach-marketplace/index.ts supabase/functions/marketplace-jobs/index.ts supabase/functions/pocketfi-webhook/index.ts supabase/functions/marketplace-operations/index.ts
./scripts/test-marketplace-concurrency.ps1
```

PGlite still uses one PostgreSQL session; the separate native suite now supplies
genuine multi-connection verification for the listed scenarios. The official
portable PostgreSQL runtime is isolated under ignored `work/`, with no service
installation. See `tests/marketplace-concurrency.README.md` for source, isolation,
commands and retained run evidence. HTTP doubles do not prove hosted JWT
signatures, Google login or ordinary-user deployed RLS behavior. Live
migration/advisory checks are now complete as described above. Actual-user SDK
integration is in progress; current Google signup/signin, onboarding, dashboard
access, singleton-admin MFA, email acceptance and paid provider acceptance must
not be labelled passed until their own evidence is recorded. An uncertain payout
without a provider reference needs support reconciliation; it must never be
resent automatically.

Recovery boundaries remain explicit: a successful recheck or case resolution
does not remove a financial hold. No balance override, manual payout approval,
worker clawback or hold-release operation was added. Review closure is only for
`needs_review` tasks and pays no reward; real verified settlement that already
won a race cannot be undone. Provider-support reconciliation and the eventual
evidence-based release policy for financial holds remain separate work.
