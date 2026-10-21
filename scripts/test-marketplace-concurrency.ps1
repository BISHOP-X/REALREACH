param([string]$PostgresBin = '')
$ErrorActionPreference = 'Stop'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $PostgresBin) { $PostgresBin = Join-Path $repoRoot 'work/realreach-postgres-test/runtime/pgsql/bin' }
$resolvedBin = [System.IO.Path]::GetFullPath($PostgresBin)
foreach ($name in @('postgres.exe','initdb.exe','pg_ctl.exe')) {
  if (-not (Test-Path -LiteralPath (Join-Path $resolvedBin $name) -PathType Leaf)) { throw "Missing $name. Supply an official PostgreSQL 17 portable bin directory with -PostgresBin. No service installation is needed." }
}
Push-Location $repoRoot
try {
  # The harness takes a binary path, never a database URL. It starts/stops only a
  # marked, newly-created cluster bound to 127.0.0.1 and checks server identity
  # before issuing schema SQL. No credentials from the application are read.
  & deno run --no-config --node-modules-dir=none --allow-read --allow-write --allow-run --allow-env --allow-sys --allow-net=127.0.0.1 tests/marketplace-concurrency.mjs $resolvedBin
  if ($LASTEXITCODE -ne 0) { throw "Native concurrency checks failed (exit $LASTEXITCODE). Inspect the dedicated test run's log; production was not accessed." }
} finally { Pop-Location }
