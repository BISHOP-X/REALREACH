# Native PostgreSQL marketplace concurrency tests

These tests start a fresh, isolated PostgreSQL 17 cluster and use independent
connections to exercise real lock contention. They do not accept a database URL,
load application credentials, call a provider, or install a Windows service.

## Run on this workstation

```powershell
./scripts/test-marketplace-concurrency.ps1
```

To use another local PostgreSQL 17 binary directory:

```powershell
./scripts/test-marketplace-concurrency.ps1 -PostgresBin 'C:/path/to/pgsql/bin'
```

The helper requires Deno and the portable server binaries. The native driver is
pinned to `pg@8.16.3`; it uses Deno's package cache and does not modify package.json.
The existing 94-check PGlite suite shares the same predecessor-schema fixture.

## Runtime source

The [PostgreSQL Windows download page](https://www.postgresql.org/download/windows/)
links the [EDB portable binaries page](https://www.enterprisedb.com/download-postgresql-binaries).
The Windows x64 PostgreSQL 17.11 link resolved to:

`https://get.enterprisedb.com/postgresql/postgresql-17.11-5-windows-x64-binaries.zip`

The downloaded archive has SHA-256
`80379B2C04D51C30225532E0AE04509899141E9957ED096FE749D7FD9DF8F82F`.
This records the downloaded artifact; it is not a claim of comparison with an
independently published vendor checksum. Only `pgsql/bin`, `pgsql/lib` and
`pgsql/share` were extracted. The runtime and archive are under ignored
`work/realreach-postgres-test/`, excluded from Git and Vercel.

## Isolation and evidence

Each run creates a unique directory with a marker and random local password.
The bootstrap password file is removed after initialization. PostgreSQL binds
only to `127.0.0.1` on a temporary available port, with SCRAM authentication.
The harness checks the exact server data directory and unique cluster name
before creating its test database. Startup, shutdown and marker paths are
restricted to the dedicated directory; no existing application DB is reused.

Every race opens distinct PostgreSQL backend PIDs and begins a transaction on
each. The harness observes all participants waiting on a shared launch barrier
before releasing them together. Successful transactions remain open briefly to
exercise competing locks. Deadlocks, lock timeouts and statement timeouts fail
the test instead of being silently retried.

The suite tests concurrent funding replay, publishing, last-slot admission,
repeat claims, task settlement, withdrawal overspending, dispatch-once payout,
payout confirmation replay, competing campaign reserves, campaign closure and
task cancellation. Recovery races cover financial holds arriving before new
publication/allocation, duplicate discrepancy events, previously funded work
settling under a hold, review closure versus retry/stale results, repeated
closures, verified settlement winning before an attempted unpaid closure,
discrepancies arriving before/after confirmation, stale conflicting confirmations
and changed withdrawal fees versus previously accepted consent.
Operations races cover consistent read-only reconciliation during funding,
concurrent collectors creating one digest, senders obtaining one lease,
immutable request preparation and repeated finish calls.
It finally checks balanced journals, nonnegative wallets and ledger/cache
agreement. Network and cron functions are inert local fixtures.

The cluster is stopped in `finally`. Its data, log and result summary are retained
under `work/realreach-postgres-test/runs/run-<unique-id>/` for inspection. The
harness never recursively deletes files. Before manually removing a run, check
its marker's data directory and run ID, confirm `pg_ctl status -D <exact-data-dir>`
reports stopped, and resolve the path below this project's dedicated runs folder.

## Verified result

On 21 October 2026, PostgreSQL 17.11 passed 29 assertions across 28 synchronized
multi-connection races, with up to 12 simultaneous independent backends. Two
earlier fresh-cluster runs passed the original 12-check/11-race suite; the
expanded recovery and payment-ordering suites also passed. The latest result is retained in
`work/realreach-postgres-test/runs/run-1626266a5d9b42a8918b416edb961d55/result.json`.

This closes the native multi-connection SQL test gap for the exercised cases.
It does not replace hosted Supabase SDK/RLS tests, provider acceptance, financial
recovery operations or production monitoring, and is not a load-capacity claim.
