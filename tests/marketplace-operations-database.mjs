// Isolated PostgreSQL/WASM only: no hosted database, email or provider request.
// deno run --no-config --node-modules-dir=none --allow-read --allow-env --allow-sys tests/marketplace-operations-database.mjs
import { PGlite } from "npm:@electric-sql/pglite@0.5.11";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { predecessorSchema } from "./marketplace-db-fixture.mjs";
import { runMarketplaceOperations } from "../supabase/functions/_shared/marketplace-operations.ts";
import { createOperationsMailer } from "../supabase/functions/_shared/operations-email.ts";
const db = new PGlite();
const sql = async (q, p = []) => (await db.query(q, p)).rows;
const rpc = async (name, args = {}) =>
  (await sql(
    `select public.${name}(${
      Object.keys(args).map((k, i) => `${k}=>$${i + 1}`).join(",")
    }) result`,
    Object.values(args).map((v) =>
      v && typeof v === "object" ? JSON.stringify(v) : v
    ),
  ))[0].result;
const owner = "10000000-0000-4000-8000-000000000001";
const worker = "10000000-0000-4000-8000-000000000002";
const command = (action, input = {}) =>
  rpc("rr_market_command", {
    p_actor: owner,
    p_action: action,
    p_input: input,
  });
let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
};
async function rollback(fn) {
  await db.exec("begin");
  try {
    await fn();
  } finally {
    await db.exec("rollback");
  }
}
async function role(name, fn) {
  await db.exec(`set role ${name}`);
  try {
    await fn();
  } finally {
    await db.exec("reset role");
  }
}
async function newAlert() {
  await sql(
    "update public.rr_ops_state set last_alert_created_at=now()-interval '7 hours'",
  );
  await rpc("rr_ops_collect");
  return rpc("rr_ops_lease");
}
const body = {
  from: "Operations <ops@example.test>",
  to: ["founder@example.test"],
  subject: "Attention needed",
  text: "Isolated fixture only",
};
try {
  await db.exec(predecessorSchema);
  for (
    const file of [
      "20261021165450_marketplace_production_core.sql",
      "20261021182743_marketplace_operations_monitor.sql",
    ]
  ) {
    await db.exec(
      await readFile(
        new URL(`../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      ),
    );
  }
  await test("operations tables have RLS and no browser grants", async () => {
    assert.equal(
      (await sql(
        "select count(*)::int n from pg_class where relname like 'rr_ops_%' and relkind='r' and not relrowsecurity",
      ))[0].n,
      0,
    );
    for (const r of ["anon", "authenticated"]) {
      await role(r, async () => {
        await assert.rejects(
          () => sql("select * from public.rr_ops_alerts"),
          /permission denied/,
        );
        await assert.rejects(() => rpc("rr_ops_overview"), /permission denied/);
        await assert.rejects(
          () => rpc("rr_ops_reconcile"),
          /permission denied/,
        );
      });
    }
  });
  await test("all new RPCs deny public customer execution", async () =>
    assert.equal(
      (await sql(
        "select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname like 'rr_ops_%' and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'))",
      ))[0].n,
      0,
    ));
  await test("never-run monitor is explicit instead of fabricated healthy data", async () => {
    const r = await rpc("rr_ops_overview");
    assert.equal(r.snapshot, null);
    assert.equal(r.reconciliation, null);
    assert.equal(r.worker.last_seen_at, null);
    assert.equal(r.worker.processed, 0);
  });
  await test("service role can run clean reconciliation without changing money", async () =>
    role("service_role", async () => {
      const r = await rpc("rr_ops_reconcile");
      assert.equal(r.status, "clean");
      assert.deepEqual(r.findings, {
        account_mismatches: 0,
        campaign_mismatches: 0,
        unbalanced_journals: 0,
        withdrawal_mismatches: 0,
      });
    }));
  await test("idle fresh system does not flag worker as stale", async () => {
    const s = await rpc("rr_ops_collect");
    assert.deepEqual(s.incidents, []);
    assert.equal(
      (await sql("select count(*)::int n from public.rr_ops_alerts"))[0].n,
      0,
    );
  });
  await test("resolved incidents supersede a never-attempted digest even inside throttle window", async () =>
    rollback(async () => {
      await sql(
        "insert into public.rr_ops_alerts(fingerprint,idempotency_key,payload) values('resolved-fixture','resolved-fixture','{}')",
      );
      await sql("update public.rr_ops_state set last_alert_created_at=now()");
      await rpc("rr_ops_collect");
      assert.equal(
        (await sql(
          "select status from public.rr_ops_alerts where idempotency_key='resolved-fixture'",
        ))[0].status,
        "superseded",
      );
    }));
  for (const [id, type] of [[owner, "business"], [worker, "worker"]]) {
    await sql(
      "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
      [id, `${type}@example.test`],
    );
    await sql("insert into public.profiles(id,account_type) values($1,$2)", [
      id,
      type,
    ]);
  }
  await command("business-save", { name: "Operations Fixture" });
  const payment = await command("payment-create", {
    amount_kobo: 100000,
    idempotency_key: "ops_collection_fixture",
  });
  await sql(
    "update public.rr_payments set status='unknown',submitted_at=now()-interval '1 hour' where id=$1",
    [payment.id],
  );
  await sql(
    "insert into public.rr_cases(owner_id,subject,message,created_at) values($1,'Payment question','Please check this payment',now()-interval '25 hours')",
    [owner],
  );
  const campaign = await command("campaign-save", {
    title: "Operations fixture",
    action: "follow",
    quantity: 1,
  });
  const assignment = (await sql(
    "insert into public.rr_assignments(campaign_id,worker_id,instagram_id,target_key,status,reward_kobo,fee_kobo) values($1,$2,'777','follow:888','needs_review',10000,1000) returning id",
    [campaign.id, worker],
  ))[0];
  await sql(
    "insert into public.rr_jobs(assignment_id,phase,state,due_at) values($1,'baseline','attention',now()-interval '1 hour'),($1,'completion','queued',now()-interval '1 hour')",
    [assignment.id],
  );
  await test("monitor counts real unresolved work and oldest thresholds", async () => {
    const s = await rpc("rr_ops_collect");
    assert.deepEqual(s.counts, {
      pending_payments: 1,
      uncertain_payments: 1,
      stalled_payments: 1,
      missing_references: 1,
      pending_checks: 1,
      review_checks: 1,
      overdue_checks: 1,
      risk_holds: 0,
      support_open: 1,
      support_overdue: 1,
    });
    assert.ok(s.incidents.some((x) => x.code === "worker_stale"));
  });
  await test("heartbeat clears staleness but preserves plain failed status", async () => {
    await rpc("rr_ops_heartbeat", { p_ok: false, p_processed: 0 });
    assert.equal(
      (await rpc("rr_ops_overview")).worker.last_error,
      "Worker run did not complete",
    );
    await rpc("rr_ops_heartbeat", { p_ok: true, p_processed: 2 });
    assert.ok(
      !(await rpc("rr_ops_collect")).incidents.some((x) =>
        x.code === "worker_stale"
      ),
    );
    assert.equal((await rpc("rr_ops_overview")).worker.last_error, null);
  });
  await test("changing counts does not create digest storms inside six hours", async () => {
    await rpc("rr_ops_collect");
    await rpc("rr_ops_collect");
    assert.equal(
      (await sql(
        "select count(*)::int n from public.rr_ops_alerts where status='queued'",
      ))[0].n,
      1,
    );
  });
  let lease;
  await test("overdue unsent digests collapse to current snapshot before keys are installed", async () => {
    lease = await newAlert();
    assert.equal(
      (await sql(
        "select count(*)::int n from public.rr_ops_alerts where status='superseded'",
      ))[0].n,
      1,
    );
    assert.equal(lease.attempts, 1);
    assert.equal(
      new Date(lease.retry_until) - new Date(lease.first_attempt_at),
      23 * 3600000,
    );
  });
  await test("leased alert cannot be leased twice concurrently or early", async () =>
    assert.equal(await rpc("rr_ops_lease"), null));
  await test("first complete request is frozen, even if sender configuration changes", async () => {
    assert.deepEqual(
      await rpc("rr_ops_prepare", {
        p_id: lease.id,
        p_attempt_token: lease.attempt_token,
        p_request_body: body,
      }),
      body,
    );
    assert.deepEqual(
      await rpc("rr_ops_prepare", {
        p_id: lease.id,
        p_attempt_token: lease.attempt_token,
        p_request_body: { ...body, to: ["changed@example.test"] },
      }),
      body,
    );
    await assert.rejects(
      () =>
        sql("update public.rr_ops_alerts set request_body='{}' where id=$1", [
          lease.id,
        ]),
      /immutable/,
    );
  });
  await test("payload identity and retry deadline cannot be silently rewritten", async () => {
    await assert.rejects(
      () =>
        sql("update public.rr_ops_alerts set payload='{}' where id=$1", [
          lease.id,
        ]),
      /immutable/,
    );
    await assert.rejects(
      () =>
        sql(
          "update public.rr_ops_alerts set first_attempt_at=now()-interval '2 days',retry_until=now()-interval '25 hours' where id=$1",
          [lease.id],
        ),
      /immutable/,
    );
  });
  await test("unknown outcome stays visible and sanitizes raw provider error", async () => {
    await rpc("rr_ops_finish", {
      p_id: lease.id,
      p_attempt_token: lease.attempt_token,
      p_outcome: "uncertain",
      p_error_code: "SECRET RAW PROVIDER ERROR",
    });
    const r = (await rpc("rr_ops_overview")).alerts.find((x) =>
      x.id === lease.id
    );
    assert.equal(r.status, "retry");
    assert.equal(r.last_outcome, "uncertain");
    assert.equal(r.error_code, "transport_uncertain");
    assert.equal("request_body" in r, false);
  });
  await test("retry retains same idempotency key and frozen request", async () => {
    await sql(
      "update public.rr_ops_alerts set next_attempt_at=now()-interval '1 minute' where id=$1",
      [lease.id],
    );
    const next = await rpc("rr_ops_lease");
    assert.equal(next.id, lease.id);
    assert.equal(next.idempotency_key, lease.idempotency_key);
    assert.deepEqual(next.request_body, body);
    assert.notEqual(next.attempt_token, lease.attempt_token);
    await rpc("rr_ops_finish", {
      p_id: lease.id,
      p_attempt_token: lease.attempt_token,
      p_outcome: "accepted",
      p_provider_id: "stale-token",
    });
    assert.equal(
      (await sql("select status from public.rr_ops_alerts where id=$1", [
        lease.id,
      ]))[0].status,
      "sending",
    );
    lease = next;
  });
  await test("accepted means provider accepted, not delivery guaranteed", async () => {
    await rpc("rr_ops_finish", {
      p_id: lease.id,
      p_attempt_token: lease.attempt_token,
      p_outcome: "accepted",
      p_provider_id: "email-fixture-id",
    });
    const r = (await rpc("rr_ops_overview")).alerts.find((x) =>
      x.id === lease.id
    );
    assert.equal(r.status, "accepted");
    assert.equal(r.provider_id, "email-fixture-id");
    assert.equal("delivered" in r, false);
  });
  await test("lease expiry rotates token while preserving uncertain attempt evidence", async () => {
    lease = await newAlert();
    await rpc("rr_ops_prepare", {
      p_id: lease.id,
      p_attempt_token: lease.attempt_token,
      p_request_body: body,
    });
    await sql(
      "update public.rr_ops_alerts set lease_until=now()-interval '1 minute' where id=$1",
      [lease.id],
    );
    const next = await rpc("rr_ops_lease");
    assert.equal(next.id, lease.id);
    assert.notEqual(next.attempt_token, lease.attempt_token);
    assert.equal(
      (await sql("select error_code from public.rr_ops_alerts where id=$1", [
        lease.id,
      ]))[0].error_code,
      "lease_expired",
    );
    lease = next;
    await rpc("rr_ops_finish", {
      p_id: lease.id,
      p_attempt_token: lease.attempt_token,
      p_outcome: "failed",
      p_error_code: "request_rejected",
    });
  });
  await test("expired retry window becomes visible needs-review without returning work", async () => {
    await sql(
      "insert into public.rr_ops_alerts(fingerprint,idempotency_key,payload,status,attempts,first_attempt_at,retry_until) values('fixture','expired-key','{}','retry',1,now()-interval '24 hours',now()-interval '1 hour')",
    );
    assert.equal(await rpc("rr_ops_lease"), null);
    const r = (await sql(
      "select * from public.rr_ops_alerts where idempotency_key='expired-key'",
    ))[0];
    assert.equal(r.status, "needs_review");
    assert.equal(r.error_code, "retry_window_closed");
  });
  await test("eight attempts require review and never generate an automatic replacement key", async () => {
    await sql(
      "insert into public.rr_ops_alerts(fingerprint,idempotency_key,payload,status,attempts,first_attempt_at,retry_until) values('fixture','attempt-key','{}','retry',8,now(),now()+interval '23 hours')",
    );
    assert.equal(await rpc("rr_ops_lease"), null);
    assert.equal(
      (await sql(
        "select error_code from public.rr_ops_alerts where idempotency_key='attempt-key'",
      ))[0].error_code,
      "attempt_limit",
    );
  });
  await test("invalid outcomes and unprepared acceptance are rejected", async () => {
    lease = await newAlert();
    await assert.rejects(
      () =>
        rpc("rr_ops_finish", {
          p_id: lease.id,
          p_attempt_token: lease.attempt_token,
          p_outcome: "delivered",
        }),
      /Invalid/,
    );
    await assert.rejects(
      () =>
        rpc("rr_ops_finish", {
          p_id: lease.id,
          p_attempt_token: lease.attempt_token,
          p_outcome: "accepted",
          p_provider_id: "not-sent",
        }),
      /not prepared/,
    );
    await rpc("rr_ops_finish", {
      p_id: lease.id,
      p_attempt_token: lease.attempt_token,
      p_outcome: "failed",
    });
  });
  await test("reconciliation detects campaign allocation mismatch without repairing it", async () => {
    const r = await rpc("rr_ops_reconcile");
    assert.equal(r.status, "discrepancy");
    assert.equal(r.findings.campaign_mismatches, 1);
    assert.equal(
      (await sql("select reserved_kobo from public.rr_campaigns where id=$1", [
        campaign.id,
      ]))[0].reserved_kobo,
      0,
    );
  });
  await sql("update public.rr_assignments set status='cancelled' where id=$1", [
    assignment.id,
  ]);
  await sql(
    "update public.rr_payments set provider_id='ops-provider' where id=$1",
    [payment.id],
  );
  await rpc("rr_market_finish_payment", {
    p_id: payment.id,
    p_state: "succeeded",
    p_reference: payment.reference,
    p_amount: 100000,
    p_currency: "NGN",
    p_provider_id: "ops-provider",
  });
  await test("real balanced funding is reconciled cleanly", async () =>
    assert.equal((await rpc("rr_ops_reconcile")).status, "clean"));
  await test("cached balance drift is detected, never corrected", async () =>
    rollback(async () => {
      await sql(
        "update public.rr_ledger_accounts set balance_kobo=balance_kobo+100 where owner_id=$1 and bucket='available'",
        [owner],
      );
      const r = await rpc("rr_ops_reconcile");
      assert.equal(r.findings.account_mismatches, 1);
      assert.equal(
        (await sql(
          "select balance_kobo from public.rr_ledger_accounts where owner_id=$1 and bucket='available'",
          [owner],
        ))[0].balance_kobo,
        100100,
      );
    }));
  await test("empty journal is reported unbalanced without financial writes", async () =>
    rollback(async () => {
      await sql(
        "insert into public.rr_journals(reference,kind,label) values('empty-fixture','fee','Fixture')",
      );
      assert.equal(
        (await rpc("rr_ops_reconcile")).findings.unbalanced_journals,
        1,
      );
    }));
  await test("unreserved payout is detected and remains unaltered", async () =>
    rollback(async () => {
      await sql(
        "insert into public.rr_payments(owner_id,direction,reference,idempotency_key,amount_kobo) values($1,'payout','bad-withdrawal','bad-withdrawal',10000)",
        [worker],
      );
      assert.equal(
        (await rpc("rr_ops_reconcile")).findings.withdrawal_mismatches,
        1,
      );
      assert.equal(
        (await sql(
          "select status from public.rr_payments where reference='bad-withdrawal'",
        ))[0].status,
        "created",
      );
    }));
  await test("reconciliation failure is explicit and never reported clean", async () =>
    rollback(async () => {
      await db.exec(
        "alter table public.rr_ledger_entries rename to rr_fixture_unavailable",
      );
      const r = await rpc("rr_ops_reconcile");
      assert.equal(r.status, "failed");
      assert.equal(r.error, "reconciliation_failed");
      assert.equal(r.findings, null);
    }));
  await test("liveness reveals only collector freshness, not business incident details", async () => {
    assert.equal(await rpc("rr_ops_liveness"), true);
    await rollback(async () => {
      await sql(
        "update public.rr_ops_state set last_collected_at=now()-interval '16 minutes'",
      );
      assert.equal(await rpc("rr_ops_liveness"), false);
    });
  });
  await test("stale reconciliation is distinguishable from healthy zeroes", async () =>
    rollback(async () => {
      await sql(
        "update public.rr_ops_reconciliations set checked_at=now()-interval '27 hours'",
      );
      assert.ok(
        (await rpc("rr_ops_collect")).incidents.some((x) =>
          x.code === "reconciliation_stale"
        ),
      );
    }));
  await test("collector persists its snapshot when dispatch credentials are absent", async () => {
    await sql("select private.dispatch_marketplace_operations()");
    const s = (await sql("select * from public.rr_ops_state"))[0];
    assert.ok(s.snapshot.collected_at);
    assert.equal(s.dispatch_error, "configuration_error");
  });
  await test("unexpected enqueue failure does not roll back monitoring", async () =>
    rollback(async () => {
      await sql(
        "insert into vault.decrypted_secrets values('rr_instagram_job_token','test-only-not-a-secret')",
      );
      await db.exec(
        "create or replace function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language plpgsql as $$begin raise exception 'fixture queue unavailable'; end$$",
      );
      await sql("select private.dispatch_marketplace_operations()");
      assert.equal(
        (await sql("select dispatch_error from public.rr_ops_state"))[0]
          .dispatch_error,
        "provider_unavailable",
      );
    }));
  await test("signed discrepancy risk hold is monitored without clearing it", async () => {
    await rpc("rr_market_payment_discrepancy", {
      p_id: payment.id,
      p_event_hash: "c".repeat(64),
      p_reason: "Provider reported a signed financial discrepancy",
    });
    assert.equal((await rpc("rr_ops_collect")).counts.risk_holds, 1);
    assert.equal((await rpc("rr_ops_reconcile")).status, "clean");
    assert.equal(
      (await sql("select count(*)::int n from public.rr_payment_risk_holds"))[0]
        .n,
      1,
    );
  });
  const rpcBridge = {
    rpc(name, args) {
      assert.match(name, /^rr_ops_(lease|prepare|finish)$/);
      return {
        abortSignal: async () => {
          try {
            return { data: await rpc(name, args), error: null };
          } catch (error) {
            return { data: null, error: { message: error.message } };
          }
        },
      };
    },
  };
  const emailConfig = {
    configured: true,
    reason: "ready",
    apiKey: "fixture-only-not-a-real-key",
    from: "alerts@realreach.com.ng",
    to: "operator@example.test",
  };
  const emailId = "20000000-0000-4000-8000-000000000001";
  async function queueCurrent() {
    await sql(
      "update public.rr_ops_state set last_alert_created_at=now()-interval '7 hours'",
    );
    await rpc("rr_ops_collect");
    return (await sql(
      "select * from public.rr_ops_alerts where status='queued' order by created_at desc limit 1",
    ))[0];
  }
  await test("actual SQL lease flows through real runner and mailer contract into accepted state", async () => {
    const queued = await queueCurrent();
    let sent = 0;
    let capturedBody;
    const result = await runMarketplaceOperations(rpcBridge, {
      configuration: () => emailConfig,
      mailer: () =>
        createOperationsMailer({
          apiKey: emailConfig.apiKey,
          fetch: async (url, init) => {
            sent++;
            assert.equal(url, "https://api.resend.com/emails");
            assert.equal(
              init.headers["Idempotency-Key"],
              `rr-ops/${queued.id}`,
            );
            capturedBody = JSON.parse(init.body);
            const persisted = (await sql(
              "select request_body from public.rr_ops_alerts where id=$1",
              [queued.id],
            ))[0].request_body;
            assert.deepEqual(capturedBody, persisted);
            assert.ok(
              capturedBody.text.includes("Payments with spending holds"),
            );
            return Response.json({ id: emailId });
          },
        }),
    });
    assert.deepEqual(result, { state: "accepted", accepted: 1 });
    assert.equal(sent, 1);
    const saved = (await sql("select * from public.rr_ops_alerts where id=$1", [
      queued.id,
    ]))[0];
    assert.equal(saved.status, "accepted");
    assert.equal(saved.provider_id, emailId);
    assert.deepEqual(saved.request_body, capturedBody);
  });
  await test("actual SQL retry preserves frozen recipient and key through runner after configuration changes", async () => {
    const queued = await queueCurrent();
    const requests = [];
    const mailer = (config) =>
      createOperationsMailer({
        apiKey: config.apiKey,
        fetch: async (_url, init) => {
          requests.push({
            key: init.headers["Idempotency-Key"],
            body: JSON.parse(init.body),
          });
          return requests.length === 1
            ? new Response("temporary failure", { status: 503 })
            : Response.json({ id: emailId });
        },
      });
    const first = await runMarketplaceOperations(rpcBridge, {
      configuration: () => emailConfig,
      mailer,
    });
    assert.deepEqual(first, { state: "uncertain", accepted: 0 });
    assert.equal(
      (await sql("select status from public.rr_ops_alerts where id=$1", [
        queued.id,
      ]))[0].status,
      "retry",
    );
    await sql(
      "update public.rr_ops_alerts set next_attempt_at=now()-interval '1 minute' where id=$1",
      [queued.id],
    );
    const second = await runMarketplaceOperations(rpcBridge, {
      configuration: () => ({ ...emailConfig, to: "replacement@example.test" }),
      mailer,
    });
    assert.deepEqual(second, { state: "accepted", accepted: 1 });
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[0], requests[1]);
    assert.equal(requests[1].key, `rr-ops/${queued.id}`);
    assert.deepEqual(requests[1].body.to, [emailConfig.to]);
  });
  console.log(`${passed} isolated operations database checks passed`);
} finally {
  await db.close();
}
