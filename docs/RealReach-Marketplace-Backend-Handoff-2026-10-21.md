# Marketplace backend handoff — 21 October 2026

## Release status

The new marketplace backend is implemented locally and is **not deployed**. No
live migration, transfer, credit, provider purchase or database write was made
for this work. Read-only access identified RealReach as
`jabwuawiqsusjrccapab`, `ACTIVE_HEALTHY`, at the expected Supabase URL.
The live database still has the three predecessor migrations and no `rr_`
marketplace tables. Existing Auth, fixed account types, singleton admin and
business drafts remain the live product until an authorized release.

## Implemented locally

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

Installing keys alone does **not** approve commercial pricing or increased
provider usage. Prices begin at zero/unapproved and payouts are paused. The
founder must approve rates, fees, retention and operating limits separately.

## Safe migration/deployment route

Read-only comparison confirmed the contents of all three historical local
migrations match their deployed statements exactly after newline normalization.
Only their filename versions differ:

| Current local filename | Actual deployed version / correct local filename |
| --- | --- |
| `20260928185915_identity_and_instagram_pilot.sql` | `20260928190700_identity_and_instagram_pilot.sql` |
| `20260928192729_pilot_scheduler.sql` | `20260928192914_pilot_scheduler.sql` |
| `20260929083042_account_boundaries_and_campaign_drafts.sql` | `20260929083206_account_boundaries_and_campaign_drafts.sql` |

After release authorization:

1. Rename only these local files to match the existing remote history; preserve
   contents and update repository references. Do not repair correct remote
   history, mark new SQL applied without executing it, or use `--include-all`.
2. Use the RealReach-only helper to link and inspect migration history. Run
   `db push --dry-run --linked`; require that it proposes **only**
   `20261021165450_marketplace_production_core.sql` followed by
   `20261021182743_marketplace_operations_monitor.sql`. Stop on any discrepancy.
3. Apply those versioned migrations, deploy the marketplace, jobs, PocketFi
   webhook and operations functions, then promote the matching frontend. Coordinate a release
   window: migration revokes old direct draft writes, so an old frontend cannot
   keep saving drafts between migration and promotion. Auth remains intact.
4. Verify migration history, tables, grants/RLS, function versions, scheduler and
   empty financial state. Test actual anonymous and distinct customer sessions,
   the singleton admin with/without MFA, and the frontend against deployed APIs.
5. Configure Rocket/PocketFi server secrets, signed webhook URL and approved
   pricing. Run explicitly authorized small live transactions and controlled
   Instagram tasks before opening paid acquisition.

The Management API migration endpoint is a fallback, not the preferred route:
it generates its own remote migration version and therefore requires local
history reconciliation afterward. It should not create a second timestamp drift.

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
- **22 HTTP/session tests** against the actual handler with injected identity
  and database doubles: unauthenticated requests, cross-role writes, admin AAL2,
  malformed/oversized requests, amount validation, owner-scoped payment reads,
  server transaction filters, unknown payout projection and revoked sessions.
- Deno type checks pass for the four new Edge entrypoints. `git diff --check`
  passes. No new package.json dependency was required.
- **29 native PostgreSQL 17.11 checks across 28 synchronized multi-connection
  races**, using 2–12 independent backend PIDs behind a database start barrier:
  funding/payout replay, same-campaign publication, last-slot and duplicate
  claims, reward settlement, competing withdrawals/campaign spending, closure
  versus claims, cancellation versus baseline, payment hold versus publication
  and allocation, repeated discrepancy events, settlement under an existing
  hold, review closure versus retry/stale results, duplicate closures, verified
  settlement versus closure, event-before/event-after confirmation, stale
  conflicting confirmations, changed withdrawal fees and ledger invariants;
  reconciliation during funding, single digest/lease races, frozen request
  preparation and concurrent finish replay.
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
signatures, Google login or deployed RLS. Live migration/advisory checks,
actual-user SDK integration and paid provider acceptance remain release gates. An uncertain payout
without a provider reference needs support reconciliation; it must never be
resent automatically.

Recovery boundaries remain explicit: a successful recheck or case resolution
does not remove a financial hold. No balance override, manual payout approval,
worker clawback or hold-release operation was added. Review closure is only for
`needs_review` tasks and pays no reward; real verified settlement that already
won a race cannot be undone. Provider-support reconciliation and the eventual
evidence-based release policy for financial holds remain separate work.
