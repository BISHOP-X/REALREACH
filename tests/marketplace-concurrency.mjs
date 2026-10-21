// Native PostgreSQL concurrency checks. Creates a NEW loopback-only cluster;
// accepts no database URL and never connects to an existing application database.
// Run with the PowerShell helper; requires an official PostgreSQL17 portable bin.
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "npm:pg@8.16.3";
import { predecessorSchema } from "./marketplace-db-fixture.mjs";

const workspace = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const testRoot = path.join(workspace, "work", "realreach-postgres-test");
const bin = path.resolve(
  Deno.args[0] ?? path.join(testRoot, "runtime", "pgsql", "bin"),
);
const runId = crypto.randomUUID().replaceAll("-", "");
const runDir = path.join(testRoot, "runs", `run-${runId}`);
const dataDir = path.join(runDir, "data");
const logFile = path.join(runDir, "postgres.log");
const passwordFile = path.join(runDir, "bootstrap-password");
const markerFile = path.join(runDir, "realreach-test-marker.json");
const password = crypto.randomUUID() + crypto.randomUUID();
const user = "rr_test_operator";
const database = "rr_marketplace_concurrency";
const clusterName = `rr-concurrency-${runId}`;
const suffix = Deno.build.os === "windows" ? ".exe" : "";
const executable = (name) => path.join(bin, name + suffix);
const decoder = new TextDecoder();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let startAttempted = false;
let control;
let passed = 0;
let raceNumber = 0;
const connections = new Set();

function assertOwnedPath(target) {
  const relative = path.relative(testRoot, path.resolve(target));
  assert.ok(
    relative && !relative.startsWith("..") && !path.isAbsolute(relative),
    "Test path must stay below the dedicated test directory",
  );
  assert.ok(
    path.basename(runDir) === `run-${runId}` && /^[a-f0-9]{32}$/.test(runId),
  );
}
async function verifyMarker() {
  assertOwnedPath(dataDir);
  assertOwnedPath(markerFile);
  const marker = JSON.parse(await Deno.readTextFile(markerFile));
  assert.deepEqual(marker, { runId, dataDir, clusterName, database });
  assert.equal(await Deno.realPath(runDir), path.resolve(runDir));
}
async function process(name, args) {
  // Windows postgres inherits pipe handles from pg_ctl even with -l. Waiting
  // for captured output would therefore wait for the whole server lifetime.
  if (name === "pg_ctl" && args[0] === "start") {
    const result = await new Deno.Command(executable(name), {
      args,
      stdout: "null",
      stderr: "null",
      stdin: "null",
    }).spawn().status;
    if (!result.success) {
      throw new Error(`pg_ctl start exited${result.code}; inspect ${logFile}`);
    }
    return "";
  }
  const result = await new Deno.Command(executable(name), {
    args,
    stdout: "piped",
    stderr: "piped",
    stdin: "null",
  }).output();
  if (!result.success) {
    throw new Error(
      `${name} exited${result.code}: ${
        decoder.decode(result.stderr).slice(-1800)
      }`,
    );
  }
  return decoder.decode(result.stdout);
}
async function connect(name = "control", dbName = database) {
  const client = new Client({
    host: "127.0.0.1",
    port,
    user,
    password,
    database: dbName,
    ssl: false,
    application_name: `rr-concurrency-${name}`,
    statement_timeout: 20000,
    lock_timeout: 10000,
    connectionTimeoutMillis: 5000,
    idle_in_transaction_session_timeout: 30000,
  });
  await client.connect();
  connections.add(client);
  return client;
}
async function close(client) {
  connections.delete(client);
  await client.end();
}
const sql = async (text, values = []) =>
  (await control.query(text, values)).rows;
const rpc = async (client, name, args = {}) => {
  assert.match(name, /^rr_(market|ops)_[a-z_]+$/);
  const keys = Object.keys(args);
  assert.ok(keys.every((k) => /^p_[a-z_]+$/.test(k)));
  return (await client.query(
    `select public.${name}(${
      keys.map((key, i) => `${key}=>$${i + 1}`).join(",")
    }) result`,
    Object.values(args),
  )).rows[0]?.result;
};
const command = (client, actor, action, input = {}) =>
  rpc(client, "rr_market_command", {
    p_actor: actor,
    p_action: action,
    p_input: input,
  });
const actor = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ig = (n) => String(900000 + n);
const balance = async (owner, bucket = "available") =>
  Number(
    (await sql(
      "select coalesce(sum(balance_kobo),0) value from public.rr_ledger_accounts where owner_id=$1 and bucket=$2",
      [owner, bucket],
    ))[0].value,
  );
async function test(name, fn) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}
async function quote(owner, id) {
  const c = (await sql(
    "select *,updated_at::text precise_updated_at from public.rr_campaigns where id=$1",
    [id],
  ))[0];
  const s = (await sql("select * from public.rr_settings"))[0];
  const total = c.quantity *
    (Number(s.follow_reward_kobo) + Number(s.follow_fee_kobo));
  await sql(
    "insert into public.rr_quotes(campaign_id,owner_id,campaign_updated_at,terms_version,total_kobo) values($1,$2,$3,$4,$5)",
    [id, owner, c.precise_updated_at, s.terms_version, total],
  );
  const account = (await sql(
    "select instagram_id,username from public.rr_instagram_accounts where user_id=$1",
    [owner],
  ))[0];
  return {
    id,
    target_id: account.instagram_id,
    target_username: account.username,
    target_url: `https://www.instagram.com/${account.username}/`,
    terms_version: s.terms_version,
    expected_total_kobo: total,
    expected_updated_at: c.precise_updated_at,
  };
}
async function draft(owner, quantity = 1) {
  return (await command(control, owner, "campaign-save", {
    title: "Isolated concurrency fixture",
    action: "follow",
    target_url: "",
    instructions: "",
    quantity,
  })).id;
}
async function payment(owner, amount, key) {
  const p = await command(control, owner, "payment-create", {
    amount_kobo: amount,
    idempotency_key: key,
  });
  await sql("update public.rr_payments set provider_id=$2 where id=$1", [
    p.id,
    `FIXTURE-${p.id}`,
  ]);
  return p;
}
const credit = (client, p) =>
  rpc(client, "rr_market_finish_payment", {
    p_id: p.id,
    p_state: "succeeded",
    p_reference: p.reference,
    p_amount: Number(p.amount_kobo),
    p_currency: "NGN",
    p_provider_id: `FIXTURE-${p.id}`,
  });
async function lease(assignment, phase) {
  await sql(
    "update public.rr_jobs set due_at=now()-interval '1 second' where assignment_id=$1 and phase=$2 and state='queued'",
    [assignment, phase],
  );
  await rpc(control, "rr_market_lease", { p_limit: 30 });
  return (await sql(
    "select * from public.rr_jobs where assignment_id=$1 and phase=$2 and state='running'",
    [assignment, phase],
  ))[0];
}
const finish = (client, job, result) =>
  rpc(client, "rr_market_finish_check", {
    p_job: job.id,
    p_lease: job.lease_id,
    p_result: result,
    p_reason: "Native PostgreSQL test fixture",
  });

// Every participant is an independent PostgreSQL backend, in its own transaction.
// All must be observed blocked on the shared launch barrier before release.
async function race(functions) {
  const gate = ++raceNumber;
  const clients = await Promise.all(
    functions.map((_, i) => connect(`race${gate}-${i}`)),
  );
  const pids = await Promise.all(
    clients.map(async (c) =>
      (await c.query("select pg_backend_pid() pid")).rows[0].pid
    ),
  );
  assert.equal(
    new Set(pids).size,
    functions.length,
    "Race must use distinct database backends",
  );
  await control.query("select pg_advisory_lock(923815,$1)", [gate]);
  const pending = clients.map(async (client, index) => {
    try {
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock_shared(923815,$1)", [
        gate,
      ]);
      await client.query("set local role service_role");
      const value = await functions[index](client);
      // Keep the successful transaction open briefly to exercise contenders.
      await client.query("select pg_sleep(0.025)");
      await client.query("commit");
      return { ok: true, value };
    } catch (error) {
      await client.query("rollback");
      return { ok: false, code: error.code, message: error.message };
    } finally {
      await close(client);
    }
  });
  try {
    const until = Date.now() + 7000;
    let waiting = 0;
    do {
      waiting = Number(
        (await sql(
          "select count(*) n from pg_locks where pid=any($1::int[]) and locktype=$2 and not granted",
          [pids, "advisory"],
        ))[0].n,
      );
      if (waiting === clients.length) break;
      await delay(20);
    } while (Date.now() < until);
    assert.equal(
      waiting,
      clients.length,
      "Every racer must reach the database barrier",
    );
  } finally {
    await control.query("select pg_advisory_unlock(923815,$1)", [gate]);
  }
  const results = await Promise.all(pending);
  assert.equal(
    results.filter((r) => !r.ok && ["40P01", "55P03", "57014"].includes(r.code))
      .length,
    0,
    `Unexpected deadlock/timeout: ${JSON.stringify(results)}`,
  );
  console.log(
    `  race${gate}: ${clients.length} independent backends, ${
      results.filter((r) => r.ok).length
    } successful transactions`,
  );
  return results;
}
const repeat = (count, fn) => Array.from({ length: count }, () => fn);

const socket = Deno.listen({ hostname: "127.0.0.1", port: 0 });
const port = socket.addr.port;
socket.close();
try {
  assertOwnedPath(runDir);
  await Deno.mkdir(path.dirname(runDir), { recursive: true });
  await Deno.mkdir(runDir);
  await Deno.writeTextFile(
    markerFile,
    JSON.stringify({ runId, dataDir, clusterName, database }),
    { createNew: true },
  );
  await verifyMarker();
  await Deno.writeTextFile(passwordFile, password + "\n", {
    createNew: true,
    mode: 0o600,
  });
  assert.match(
    await process("postgres", ["--version"]),
    /PostgreSQL\) 17\./,
    "Use PostgreSQL17 for this migration",
  );
  await process("initdb", [
    "--pgdata",
    dataDir,
    "--username",
    user,
    "--pwfile",
    passwordFile,
    "--auth-host=scram-sha-256",
    "--auth-local=scram-sha-256",
    "--encoding=UTF8",
    "--locale=C",
  ]);
  await verifyMarker();
  await Deno.remove(passwordFile);
  startAttempted = true;
  await process("pg_ctl", [
    "start",
    "-D",
    dataDir,
    "-l",
    logFile,
    "-w",
    "-t",
    "30",
    "-o",
    `-h 127.0.0.1 -p ${port} -c max_connections=40 -c shared_buffers=32MB -c fsync=on -c synchronous_commit=on -c log_lock_waits=on -c deadlock_timeout=100ms -c cluster_name=${clusterName}`,
  ]);
  const bootstrap = await connect("bootstrap", "postgres");
  const identity = (await bootstrap.query(
    "select current_setting('data_directory') data_directory,current_setting('cluster_name') cluster_name,host(inet_server_addr()) address,current_setting('server_version') version",
  )).rows[0];
  assert.equal(path.resolve(identity.data_directory), dataDir);
  assert.equal(identity.cluster_name, clusterName);
  assert.equal(identity.address, "127.0.0.1");
  console.log(
    `Isolated native PostgreSQL ${identity.version}; data=${dataDir}; port=${port}`,
  );
  await bootstrap.query(`create database ${database}`);
  await close(bootstrap);
  control = await connect();
  await control.query(predecessorSchema);
  await control.query(
    await Deno.readTextFile(
      path.join(
        workspace,
        "supabase",
        "migrations",
        "20261021165450_marketplace_production_core.sql",
      ),
    ),
  );
  for (
    const n of [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      ...Array.from({ length: 16 }, (_, i) => 100 + i),
    ]
  ) {
    const kind = n < 100 ? "business" : "worker";
    await sql(
      "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
      [actor(n), `fixture${n}@example.test`],
    );
    await sql(
      "insert into public.profiles(id,account_type,display_name) values($1,$2,$3)",
      [actor(n), kind, `Fixture${n}`],
    );
    await sql(
      "insert into public.rr_instagram_accounts(user_id,instagram_id,username,status,verified_at) values($1,$2,$3,'verified',now())",
      [actor(n), ig(n), `fixture${n}`],
    );
    if (kind === "business") {
      await command(control, actor(n), "business-save", {
        name: `Fixture business${n}`,
      });
    }
  }
  await sql("insert into public.sole_admin(user_id) values($1)", [actor(5)]);
  await rpc(control, "rr_market_admin", {
    p_actor: actor(5),
    p_action: "admin-settings",
    p_input: {
      approved: true,
      follow_reward_kobo: 10000,
      follow_fee_kobo: 2000,
      comment_reward_kobo: 15000,
      comment_fee_kobo: 3000,
      retention_hours: 1,
      claim_minutes: 30,
      minimum_withdrawal_kobo: 10000,
      withdrawal_fee_kobo: 0,
      max_campaign_quantity: 10000,
      payouts_paused: false,
    },
  });

  const funding = await payment(actor(1), 1000000, "native_funding_1");
  await test("eight simultaneous funding confirmations create exactly one credit", async () => {
    assert.ok(
      (await race(repeat(8, (c) => credit(c, funding)))).every((r) => r.ok),
    );
    assert.equal(await balance(actor(1)), 1000000);
    assert.equal(
      Number(
        (await sql(
          "select count(*) n from public.rr_journals where reference=$1",
          [`deposit:${funding.id}`],
        ))[0].n,
      ),
      1,
    );
  });
  const sharedCampaign = await draft(actor(1));
  const sharedQuote = await quote(actor(1), sharedCampaign);
  await test("eight simultaneous publish requests reserve a campaign budget once", async () => {
    assert.ok(
      (await race(
        repeat(8, (c) => command(c, actor(1), "campaign-publish", sharedQuote)),
      )).every((r) => r.ok),
    );
    assert.equal(await balance(actor(1)), 988000);
    assert.equal(await balance(actor(1), "campaign"), 12000);
  });
  let winner;
  await test("twelve different workers racing one remaining slot produce one assignment", async () => {
    const results = await race(
      Array.from(
        { length: 12 },
        (_, i) => (c) =>
          command(c, actor(100 + i), "task-claim", { id: sharedCampaign }),
      ),
    );
    assert.equal(results.filter((r) => r.ok).length, 1);
    winner =
      (await sql("select * from public.rr_assignments where campaign_id=$1", [
        sharedCampaign,
      ]))[0];
    const campaign = (await sql(
      "select remaining_count,active_count from public.rr_campaigns where id=$1",
      [sharedCampaign],
    ))[0];
    assert.deepEqual(campaign, { remaining_count: 0, active_count: 1 });
  });
  await test("simultaneous repeated claims return the original assignment without another allocation", async () => {
    const results = await race(
      repeat(
        8,
        (c) =>
          command(c, winner.worker_id, "task-claim", { id: sharedCampaign }),
      ),
    );
    assert.ok(results.every((r) => r.ok && r.value.id === winner.id));
    assert.equal(
      Number(
        (await sql(
          "select count(*) n from public.rr_assignments where campaign_id=$1",
          [sharedCampaign],
        ))[0].n,
      ),
      1,
    );
  });
  let job = await lease(winner.id, "baseline");
  await finish(control, job, "not_found");
  await command(control, winner.worker_id, "task-check", { id: winner.id });
  job = await lease(winner.id, "completion");
  await finish(control, job, "verified");
  await sql(
    "update public.rr_assignments set hold_until=now()-interval '1 second' where id=$1",
    [winner.id],
  );
  job = await lease(winner.id, "retention");
  await test("eight simultaneous final-check callbacks pay a reward exactly once", async () => {
    assert.ok(
      (await race(repeat(8, (c) => finish(c, job, "verified")))).every((r) =>
        r.ok
      ),
    );
    assert.equal(await balance(winner.worker_id), 10000);
    assert.equal(
      Number(
        (await sql(
          "select count(*) n from public.rr_journals where reference=$1",
          [`settle:${winner.id}`],
        ))[0].n,
      ),
      1,
    );
    assert.equal(await balance(actor(1), "campaign"), 0);
  });
  const bank = (await sql(
    "insert into public.rr_beneficiaries(owner_id,bank_code,bank_name,account_number,account_name) values($1,'001','Fixture Bank','1234567890','Fixture Worker') returning id",
    [winner.worker_id],
  ))[0].id;
  let withdrawal;
  const withdrawalTerms = {
    expected_fee_kobo: 0,
    terms_version:
      (await sql("select terms_version from public.rr_settings"))[0]
        .terms_version,
  };
  await test("competing withdrawals cannot overspend one earned wallet balance", async () => {
    const results = await race(
      Array.from(
        { length: 8 },
        (_, i) => (c) =>
          command(c, winner.worker_id, "withdraw", {
            ...withdrawalTerms,
            amount_kobo: 10000,
            beneficiary_id: bank,
            idempotency_key: `native_withdraw_${i}`,
          }),
      ),
    );
    assert.equal(results.filter((r) => r.ok).length, 1);
    withdrawal = results.find((r) => r.ok).value;
    assert.equal(await balance(winner.worker_id), 0);
    assert.equal(await balance(winner.worker_id, "withdrawal"), 10000);
    assert.equal(
      Number(
        (await sql(
          "select count(*) n from public.rr_payments where owner_id=$1 and direction='payout'",
          [winner.worker_id],
        ))[0].n,
      ),
      1,
    );
  });
  await test("eight simultaneous payout dispatchers only dispatch once", async () => {
    const results = await race(
      repeat(8, (c) => rpc(c, "rr_market_dispatch", { p_id: withdrawal.id })),
    );
    assert.equal(results.filter((r) => r.ok && r.value === true).length, 1);
  });
  await sql("update public.rr_payments set provider_id=$2 where id=$1", [
    withdrawal.id,
    `FIXTURE-${withdrawal.id}`,
  ]);
  await test("eight simultaneous payout confirmations settle the held amount once", async () => {
    assert.ok(
      (await race(repeat(8, (c) => credit(c, withdrawal)))).every((r) => r.ok),
    );
    assert.equal(await balance(winner.worker_id, "withdrawal"), 0);
    assert.equal(
      Number(
        (await sql(
          "select count(*) n from public.rr_journals where reference=$1",
          [`payout:${withdrawal.id}`],
        ))[0].n,
      ),
      1,
    );
  });
  await credit(control, await payment(actor(2), 12000, "native_funding_2"));
  const competing = await Promise.all([draft(actor(2)), draft(actor(2))]);
  const quotes = await Promise.all(competing.map((id) => quote(actor(2), id)));
  await test("two different campaigns cannot reserve the same available money", async () => {
    const results = await race(
      quotes.map((q) => (c) => command(c, actor(2), "campaign-publish", q)),
    );
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal(await balance(actor(2)), 0);
    assert.equal(await balance(actor(2), "campaign"), 12000);
    assert.equal(
      Number(
        (await sql(
          "select count(*) n from public.rr_campaigns where owner_id=$1 and status='live'",
          [actor(2)],
        ))[0].n,
      ),
      1,
    );
  });
  await credit(control, await payment(actor(3), 12000, "native_funding_3"));
  const closing = await draft(actor(3));
  await command(
    control,
    actor(3),
    "campaign-publish",
    await quote(actor(3), closing),
  );
  await test("closing a campaign during new claims neither loses nor duplicates reserved money", async () => {
    await race([
      (c) =>
        command(c, actor(3), "campaign-state", {
          id: closing,
          state: "cancelled",
        }),
      ...Array.from(
        { length: 6 },
        (_, i) => (c) =>
          command(c, actor(100 + i), "task-claim", { id: closing }),
      ),
    ]);
    const c =
      (await sql("select * from public.rr_campaigns where id=$1", [closing]))[
        0
      ];
    assert.ok(["closing", "cancelled"].includes(c.status));
    assert.ok(c.active_count <= 1);
    assert.equal(c.remaining_count, 0);
    assert.equal(
      await balance(actor(3)) + await balance(actor(3), "campaign"),
      12000,
    );
  });
  await credit(control, await payment(actor(4), 12000, "native_funding_4"));
  const cancelling = await draft(actor(4));
  await command(
    control,
    actor(4),
    "campaign-publish",
    await quote(actor(4), cancelling),
  );
  const cancellation =
    (await command(control, actor(115), "task-claim", { id: cancelling })).id;
  job = await lease(cancellation, "baseline");
  await test("cancellation racing a baseline result has no deadlock or double release", async () => {
    const results = await race([
      (c) => command(c, actor(115), "task-cancel", { id: cancellation }),
      (c) => finish(c, job, "not_found"),
    ]);
    assert.ok(results.every((r) => r.ok));
    assert.equal(
      (await sql("select status from public.rr_assignments where id=$1", [
        cancellation,
      ]))[0].status,
      "cancelled",
    );
    const c = (await sql(
      "select remaining_count,active_count from public.rr_campaigns where id=$1",
      [cancelling],
    ))[0];
    assert.deepEqual(c, { remaining_count: 1, active_count: 0 });
    assert.equal(await balance(actor(4), "campaign"), 12000);
  });
  const discrepancy = (client, p, hash) =>
    rpc(client, "rr_market_payment_discrepancy", {
      p_id: p.id,
      p_event_hash: hash.repeat(64),
      p_reason:
        "Verified provider reversal conflicts with the recorded collection.",
    });
  const admin = (client, action, input) =>
    rpc(client, "rr_market_admin", {
      p_actor: actor(5),
      p_action: action,
      p_input: input,
    });
  const closureInput = (id) => ({
    id,
    reason:
      "Instagram could not supply a reliable result; close without payment.",
  });
  // The promise coordinates only transaction ordering; both operations still
  // execute on distinct PostgreSQL backends and contend on actual DB locks.
  const announceAfter = () => {
    let announce;
    const ready = new Promise((resolve) => {
      announce = resolve;
    });
    return { ready, announce };
  };
  const holdFunding = await payment(actor(6), 36000, "native_hold_publish");
  await credit(control, holdFunding);
  const heldPublish = await draft(actor(6));
  const heldQuote = await quote(actor(6), heldPublish);
  await test("a concurrent financial hold commits before publish can reserve money", async () => {
    const signal = announceAfter();
    const results = await race([
      async (c) => {
        try {
          await discrepancy(c, holdFunding, "d");
        } finally {
          signal.announce();
        }
        await c.query("select pg_sleep(0.1)");
      },
      async (c) => {
        await signal.ready;
        return command(c, actor(6), "campaign-publish", heldQuote);
      },
    ]);
    assert.equal(results[0].ok, true);
    assert.equal(results[1].ok, false);
    assert.match(results[1].message, /New spending is paused/);
    assert.equal(await balance(actor(6)), 36000);
    assert.equal(await balance(actor(6), "campaign"), 0);
  });
  await test("eight concurrent discrepancy replays preserve one hold and never debit the wallet", async () => {
    assert.ok(
      (await race(repeat(8, (c) => discrepancy(c, holdFunding, "d")))).every(
        (r) => r.ok,
      ),
    );
    assert.equal(
      Number(
        (await sql(
          "select count(*) n from public.rr_payment_risk_holds where payment_id=$1",
          [holdFunding.id],
        ))[0].n,
      ),
      1,
    );
    assert.equal(
      Number(
        (await sql(
          "select count(*) n from public.rr_audit where action='payment-risk-hold' and reference=$1",
          [holdFunding.id],
        ))[0].n,
      ),
      1,
    );
    assert.equal(await balance(actor(6)), 36000);
  });
  const allocationFunding = await payment(
    actor(7),
    24000,
    "native_hold_allocation",
  );
  await credit(control, allocationFunding);
  const allocationCampaign = await draft(actor(7), 2);
  await command(
    control,
    actor(7),
    "campaign-publish",
    await quote(actor(7), allocationCampaign),
  );
  const protectedTask = (await command(control, actor(113), "task-claim", {
    id: allocationCampaign,
  })).id;
  await test("a hold blocks a racing new allocation but preserves an existing funded obligation", async () => {
    const signal = announceAfter();
    const results = await race([
      async (c) => {
        try {
          await discrepancy(c, allocationFunding, "e");
        } finally {
          signal.announce();
        }
        await c.query("select pg_sleep(0.1)");
      },
      async (c) => {
        await signal.ready;
        return command(c, actor(114), "task-claim", { id: allocationCampaign });
      },
    ]);
    assert.equal(results[0].ok, true);
    assert.equal(results[1].ok, false);
    assert.match(results[1].message, /New spending is paused/);
    assert.deepEqual(
      (await sql(
        "select remaining_count,active_count from public.rr_campaigns where id=$1",
        [allocationCampaign],
      ))[0],
      { remaining_count: 1, active_count: 1 },
    );
    let check = await lease(protectedTask, "baseline");
    await finish(control, check, "not_found");
    await command(control, actor(113), "task-check", { id: protectedTask });
    check = await lease(protectedTask, "completion");
    await finish(control, check, "verified");
    await sql(
      "update public.rr_assignments set hold_until=now()-interval '1 second' where id=$1",
      [protectedTask],
    );
    check = await lease(protectedTask, "retention");
    const settlement = await race([
      (c) => finish(c, check, "verified"),
      (c) => discrepancy(c, allocationFunding, "e"),
    ]);
    assert.ok(settlement.every((r) => r.ok));
    assert.equal(await balance(actor(113)), 10000);
    assert.equal(await balance(actor(7), "campaign"), 12000);
    assert.equal(
      (await sql("select status from public.rr_assignments where id=$1", [
        protectedTask,
      ]))[0].status,
      "settled",
    );
  });
  const reviewTask =
    (await command(control, actor(112), "task-claim", { id: cancelling })).id;
  const reviewJob = await lease(reviewTask, "baseline");
  await sql("update public.rr_jobs set attempts=8 where id=$1", [reviewJob.id]);
  await finish(control, reviewJob, "unknown");
  await test("review closure racing retry invalidates the lease and cannot revive the task", async () => {
    const signal = announceAfter();
    const results = await race([
      async (c) => {
        try {
          await admin(c, "admin-assignment-close", closureInput(reviewTask));
        } finally {
          signal.announce();
        }
        await c.query("select pg_sleep(0.1)");
      },
      async (c) => {
        await signal.ready;
        return admin(c, "admin-retry", { id: reviewJob.id });
      },
      async (c) => {
        await signal.ready;
        return finish(c, reviewJob, "verified");
      },
    ]);
    assert.equal(results[0].ok, true);
    assert.equal(results[1].ok, false);
    assert.match(results[1].message, /Only checks/);
    assert.equal(results[2].ok, true);
    assert.equal(
      (await sql("select status from public.rr_assignments where id=$1", [
        reviewTask,
      ]))[0].status,
      "cancelled",
    );
    assert.equal(
      Number(
        (await sql(
          "select count(*) n from public.rr_jobs where assignment_id=$1 and (state<>'done' or lease_id is not null)",
          [reviewTask],
        ))[0].n,
      ),
      0,
    );
    assert.equal(await balance(actor(112)), 0);
  });
  await test("eight simultaneous review-close replays return exactly one place without payment", async () => {
    assert.ok(
      (await race(
        repeat(
          8,
          (c) => admin(c, "admin-assignment-close", closureInput(reviewTask)),
        ),
      )).every(
        (r) => r.ok,
      ),
    );
    assert.equal(
      Number(
        (await sql(
          "select count(*) n from public.rr_assignment_closures where assignment_id=$1",
          [reviewTask],
        ))[0].n,
      ),
      1,
    );
    assert.equal(
      Number(
        (await sql(
          "select count(*) n from public.rr_audit where action='admin-assignment-close' and reference=$1",
          [reviewTask],
        ))[0].n,
      ),
      1,
    );
    assert.deepEqual(
      (await sql(
        "select remaining_count,active_count from public.rr_campaigns where id=$1",
        [cancelling],
      ))[0],
      { remaining_count: 1, active_count: 0 },
    );
    assert.equal(await balance(actor(4), "campaign"), 12000);
  });
  // Exercise the opposite ordering using a real review -> admin retry -> lease
  // transition. No invented provider evidence/status is required for the race.
  await credit(
    control,
    await payment(actor(8), 12000, "native_review_settlement"),
  );
  const recoveryCampaign = await draft(actor(8));
  await command(
    control,
    actor(8),
    "campaign-publish",
    await quote(actor(8), recoveryCampaign),
  );
  const recoveryTask =
    (await command(control, actor(114), "task-claim", { id: recoveryCampaign }))
      .id;
  let recoveryJob = await lease(recoveryTask, "baseline");
  await finish(control, recoveryJob, "not_found");
  await command(control, actor(114), "task-check", { id: recoveryTask });
  recoveryJob = await lease(recoveryTask, "completion");
  await finish(control, recoveryJob, "verified");
  await sql(
    "update public.rr_assignments set hold_until=now()-interval '1 second' where id=$1",
    [recoveryTask],
  );
  recoveryJob = await lease(recoveryTask, "retention");
  await sql("update public.rr_jobs set attempts=8 where id=$1", [
    recoveryJob.id,
  ]);
  await finish(control, recoveryJob, "unknown");
  await test("retry and verified settlement winning the race prevents an unpaid admin closure", async () => {
    const signal = announceAfter();
    const results = await race([
      async (c) => {
        try {
          await admin(c, "admin-retry", { id: recoveryJob.id });
          await rpc(c, "rr_market_lease", { p_limit: 30 });
          const fresh =
            (await c.query("select * from public.rr_jobs where id=$1", [
              recoveryJob.id,
            ])).rows[0];
          assert.equal(fresh.state, "running");
          await finish(c, fresh, "verified");
        } finally {
          signal.announce();
        }
        await c.query("select pg_sleep(0.1)");
      },
      async (c) => {
        await signal.ready;
        return admin(c, "admin-assignment-close", closureInput(recoveryTask));
      },
    ]);
    assert.equal(results[0].ok, true);
    assert.equal(results[1].ok, false);
    assert.match(results[1].message, /Only unresolved/);
    assert.equal(await balance(actor(114)), 10000);
    assert.equal(await balance(actor(8), "campaign"), 0);
    assert.equal(
      (await sql("select status from public.rr_assignments where id=$1", [
        recoveryTask,
      ]))[0].status,
      "settled",
    );
    assert.equal(
      Number(
        (await sql(
          "select count(*) n from public.rr_assignment_closures where assignment_id=$1",
          [recoveryTask],
        ))[0].n,
      ),
      0,
    );
  });
  for (const [ownerNumber, eventFirst] of [[9, true], [10, false]]) {
    const owner = actor(ownerNumber);
    const p = await payment(owner, 12000, `ordering_funding_${ownerNumber}`);
    const campaign = await draft(owner);
    const q = await quote(owner, campaign);
    await test(`${eventFirst ? "discrepancy before" : "discrepancy after"} concurrent confirmation blocks subsequent publication atomically`, async () => {
      const first = announceAfter(), second = announceAfter();
      const record = (c) => discrepancy(c, p, eventFirst ? "a" : "b");
      const results = await race([
        async (c) => {
          try {
            await (eventFirst ? record(c) : credit(c, p));
          } finally {
            first.announce();
          }
          await c.query("select pg_sleep(0.1)");
        },
        async (c) => {
          await first.ready;
          try {
            await (eventFirst ? credit(c, p) : record(c));
          } finally {
            second.announce();
          }
          await c.query("select pg_sleep(0.1)");
        },
        async (c) => {
          await second.ready;
          return command(c, owner, "campaign-publish", q);
        },
      ]);
      assert.equal(results[0].ok, true);
      assert.equal(results[1].ok, true);
      assert.equal(results[2].ok, false);
      assert.match(results[2].message, /New spending is paused/);
      assert.equal(await balance(owner), 12000);
      assert.equal(await balance(owner, "campaign"), 0);
      assert.equal(
        Number(
          (await sql(
            "select count(*) n from public.rr_payment_risk_holds where payment_id=$1",
            [p.id],
          ))[0].n,
        ),
        1,
      );
      await credit(control, p);
      await record(control);
      assert.equal(
        Number(
          (await sql(
            "select count(*) n from public.rr_audit where action='payment-risk-hold' and reference=$1",
            [p.id],
          ))[0].n,
        ),
        1,
      );
    });
  }
  const stalePayment = await payment(actor(11), 12000, "native_stale_recheck");
  await test("a stale conflicting confirmation racing success records risk without a refund or second credit", async () => {
    const signal = announceAfter();
    const results = await race([
      async (c) => {
        try {
          await credit(c, stalePayment);
        } finally {
          signal.announce();
        }
        await c.query("select pg_sleep(0.1)");
      },
      async (c) => {
        await signal.ready;
        return rpc(c, "rr_market_finish_payment", {
          p_id: stalePayment.id,
          p_state: "failed",
          p_reference: stalePayment.reference,
          p_amount: 12000,
          p_currency: "NGN",
          p_provider_id: `FIXTURE-${stalePayment.id}`,
        });
      },
    ]);
    assert.ok(results.every((r) => r.ok));
    assert.equal(await balance(actor(11)), 12000);
    assert.equal(
      (await sql("select status from public.rr_payments where id=$1", [
        stalePayment.id,
      ]))[0].status,
      "succeeded",
    );
    assert.equal(
      Number(
        (await sql(
          "select count(*) n from public.rr_payment_risk_holds where payment_id=$1",
          [stalePayment.id],
        ))[0].n,
      ),
      1,
    );
  });
  const feeBank = (await sql(
    "insert into public.rr_beneficiaries(owner_id,bank_code,bank_name,account_number,account_name) values($1,'001','Fixture Bank','1234567890','Fixture Worker') returning id",
    [actor(114)],
  ))[0].id;
  await test("withdrawal fee change before submission rejects stale consent while prior intent replay stays exact", async () => {
    const signal = announceAfter();
    const before = await balance(actor(114));
    const results = await race([
      async (c) => {
        try {
          await c.query(
            "update public.rr_settings set withdrawal_fee_kobo=500,terms_version='native-repriced'",
          );
        } finally {
          signal.announce();
        }
        await c.query("select pg_sleep(0.1)");
      },
      async (c) => {
        await signal.ready;
        await c.query("select 1 from public.rr_settings for share");
        return command(c, actor(114), "withdraw", {
          amount_kobo: 10000,
          beneficiary_id: feeBank,
          idempotency_key: "native_stale_fee",
          ...withdrawalTerms,
        });
      },
    ]);
    assert.equal(results[0].ok, true);
    assert.equal(results[1].ok, false);
    assert.match(results[1].message, /terms changed/);
    assert.equal(await balance(actor(114)), before);
    assert.equal(await balance(actor(114), "withdrawal"), 0);
    const replay = await command(control, winner.worker_id, "withdraw", {
      amount_kobo: 10000,
      beneficiary_id: bank,
      idempotency_key: withdrawal.idempotency_key,
      ...withdrawalTerms,
    });
    assert.equal(replay.id, withdrawal.id);
    assert.equal(Number(replay.fee_kobo), 0);
  });
  const delayedPayment = await payment(
    actor(12),
    12000,
    "native_stale_pending",
  );
  await test("delayed pending and unknown polls after concurrent success preserve completion without a false hold", async () => {
    const signal = announceAfter();
    const results = await race([
      async (c) => {
        try {
          await credit(c, delayedPayment);
        } finally {
          signal.announce();
        }
        await c.query("select pg_sleep(0.1)");
      },
      ...["pending", "unknown"].map((state) => async (c) => {
        await signal.ready;
        return rpc(c, "rr_market_finish_payment", {
          p_id: delayedPayment.id,
          p_state: state,
          p_reference: delayedPayment.reference,
          p_amount: 12000,
          p_currency: "NGN",
          p_provider_id: `FIXTURE-${delayedPayment.id}`,
        });
      }),
    ]);
    assert.ok(results.every((r) => r.ok));
    assert.equal(await balance(actor(12)), 12000);
    assert.equal(
      (await sql("select status from public.rr_payments where id=$1", [
        delayedPayment.id,
      ]))[0].status,
      "succeeded",
    );
    assert.equal(
      Number(
        (await sql(
          "select count(*) n from public.rr_payment_risk_holds where payment_id=$1",
          [delayedPayment.id],
        ))[0].n,
      ),
      0,
    );
    assert.equal(
      Number(
        (await sql(
          "select count(*) n from public.rr_payment_events where payment_id=$1",
          [delayedPayment.id],
        ))[0].n,
      ),
      0,
    );
  });
  await test("all concurrent journals balance and every non-external wallet remains nonnegative", async () => {
    assert.equal(
      (await sql(
        "select journal_id from public.rr_ledger_entries group by journal_id having sum(amount_kobo)<>0",
      )).length,
      0,
    );
    assert.equal(
      (await sql(
        "select id from public.rr_ledger_accounts where bucket not in ('external','provider_expense') and balance_kobo<0",
      )).length,
      0,
    );
    assert.equal(
      (await sql(
        "select a.id from public.rr_ledger_accounts a left join public.rr_ledger_entries e on e.account_id=a.id group by a.id having a.balance_kobo<>coalesce(sum(e.amount_kobo),0)",
      )).length,
      0,
    );
  });
  // Separate monitoring migration, still only inside this owned local cluster.
  await control.query(
    await Deno.readTextFile(
      path.join(
        workspace,
        "supabase",
        "migrations",
        "20261021182743_marketplace_operations_monitor.sql",
      ),
    ),
  );
  await test("monitor reconciliation observes consistent committed financial state", async () => {
    const report = await rpc(control, "rr_ops_reconcile");
    assert.equal(report.status, "clean", JSON.stringify(report));
  });
  await test("concurrent financial commits and reconciliation never report transient ledger drift", async () => {
    const payments = await Promise.all(
      Array.from(
        { length: 4 },
        (_, i) => payment(actor(2), 20000, `ops_concurrent_${i}`),
      ),
    );
    const result = await race([
      ...payments.map((p) => async (c) => {
        await credit(c, p);
        await c.query("select pg_sleep(0.1)");
        return { payment: true };
      }),
      ...repeat(4, async (c) => {
        const r = await rpc(c, "rr_ops_reconcile");
        assert.ok(r?.status === "clean" || r?.busy === true, JSON.stringify(r));
        return r;
      }),
    ]);
    assert.ok(result.every((r) => r.ok), JSON.stringify(result));
    assert.equal((await rpc(control, "rr_ops_reconcile")).status, "clean");
  });
  await test("eight concurrent collectors create one frozen digest", async () => {
    const results = await race(repeat(8, (c) => rpc(c, "rr_ops_collect")));
    assert.ok(results.every((r) => r.ok), JSON.stringify(results));
    assert.equal(
      Number(
        (await sql(
          "select count(*) n from public.rr_ops_alerts where status='queued'",
        ))[0].n,
      ),
      1,
    );
  });
  let opsLease;
  await test("eight independent senders lease only one alert", async () => {
    const results = await race(repeat(8, (c) => rpc(c, "rr_ops_lease")));
    assert.ok(results.every((r) => r.ok), JSON.stringify(results));
    const leased = results.filter((r) => r.value !== null);
    assert.equal(leased.length, 1);
    opsLease = leased[0].value;
    assert.equal(opsLease.idempotency_key, `rr-ops/${opsLease.id}`);
  });
  await test("competing request preparation freezes one complete email body", async () => {
    const results = await race(
      Array.from({ length: 4 }, (_, i) => (c) =>
        rpc(c, "rr_ops_prepare", {
          p_id: opsLease.id,
          p_attempt_token: opsLease.attempt_token,
          p_request_body: {
            from: "ops@example.test",
            to: ["founder@example.test"],
            subject: `candidate${i}`,
            text: "Local fixture, never sent",
          },
        })),
    );
    assert.ok(results.every((r) => r.ok), JSON.stringify(results));
    assert.ok(
      results.every((r) => r.value.subject === results[0].value.subject),
    );
  });
  await test("accepted alert outcome cannot be overwritten by a racing stale retry", async () => {
    const results = await race(
      repeat(6, (c) =>
        rpc(c, "rr_ops_finish", {
          p_id: opsLease.id,
          p_attempt_token: opsLease.attempt_token,
          p_outcome: "accepted",
          p_provider_id: "fixture-email-id",
        })),
    );
    assert.ok(results.every((r) => r.ok), JSON.stringify(results));
    await rpc(control, "rr_ops_finish", {
      p_id: opsLease.id,
      p_attempt_token: opsLease.attempt_token,
      p_outcome: "uncertain",
    });
    assert.equal(
      (await sql("select status from public.rr_ops_alerts where id=$1", [
        opsLease.id,
      ]))[0].status,
      "accepted",
    );
  });
  await control.query(
    await Deno.readTextFile(
      path.join(
        workspace,
        "supabase",
        "migrations",
        "20261021191322_payment_launch_gates.sql",
      ),
    ),
  );
  await test("release migration defaults both payment launch gates off", async () => {
    const s = (await sql(
      "select collections_enabled,payouts_enabled from public.rr_settings",
    ))[0];
    assert.deepEqual(s, { collections_enabled: false, payouts_enabled: false });
    await assert.rejects(
      () => payment(actor(2), 10000, "release_blocked"),
      /top-ups are currently unavailable/,
    );
  });
  await test("disabling launch gates wins against concurrent first dispatches and new intent", async () => {
    await sql(
      "update public.rr_settings set collections_enabled=true,payouts_enabled=true,payouts_paused=false",
    );
    const collection = await payment(
      actor(2),
      10000,
      "release_created_before_disable",
    );
    const payout = (await sql(
      "insert into public.rr_payments(owner_id,direction,reference,idempotency_key,amount_kobo) values($1,'payout','release-race-payout','release-race-payout',10000) returning id",
      [actor(100)],
    ))[0];
    const signal = announceAfter();
    const results = await race([
      async (c) => {
        await c.query(
          "update public.rr_settings set collections_enabled=false,payouts_enabled=false",
        );
        signal.announce();
        return { disabled: true };
      },
      async (c) => {
        await signal.ready;
        return rpc(c, "rr_market_dispatch", { p_id: collection.id });
      },
      async (c) => {
        await signal.ready;
        return rpc(c, "rr_market_dispatch", { p_id: payout.id });
      },
      async (c) => {
        await signal.ready;
        return command(c, actor(2), "payment-create", {
          amount_kobo: 10000,
          idempotency_key: "release-race-collection",
        });
      },
    ]);
    assert.equal(
      results.filter((r) => r.ok).length,
      1,
      JSON.stringify(results),
    );
    assert.ok(
      results.slice(1).every((r) => /currently unavailable/.test(r.message)),
      JSON.stringify(results),
    );
    assert.equal(
      (await sql("select submitted_at from public.rr_payments where id=$1", [
        collection.id,
      ]))[0].submitted_at,
      null,
    );
    assert.equal(
      (await sql("select submitted_at from public.rr_payments where id=$1", [
        payout.id,
      ]))[0].submitted_at,
      null,
    );
  });
  const summary = {
    passed,
    races: raceNumber,
    postgres: identity.version,
    runId,
    dataDir,
    port,
    completed_at: new Date().toISOString(),
  };
  await Deno.writeTextFile(
    path.join(runDir, "result.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log(
    `${passed} native PostgreSQL checks passed across ${raceNumber} synchronized multi-connection races`,
  );
} finally {
  await Promise.allSettled([...connections].map(close));
  if (startAttempted) {
    await verifyMarker();
    const status = await new Deno.Command(executable("pg_ctl"), {
      args: ["status", "-D", dataDir],
      stdout: "null",
      stderr: "null",
      stdin: "null",
    }).spawn().status;
    if (status.success) {
      await process("pg_ctl", [
        "stop",
        "-D",
        dataDir,
        "-m",
        "fast",
        "-w",
        "-t",
        "30",
      ]);
    } else if (status.code !== 3) {
      throw new Error(
        `Could not verify test-cluster shutdown status (${status.code}) at ${dataDir}`,
      );
    }
    console.log(
      "Stopped only the isolated test cluster. Data/logs retained under ignored work/realreach-postgres-test/runs.",
    );
  }
  try {
    await verifyMarker();
    await Deno.remove(passwordFile);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
}
