// Isolated-only release gate proof. No provider/network/live database access.
import { PGlite } from "npm:@electric-sql/pglite@0.5.11";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { predecessorSchema } from "./marketplace-db-fixture.mjs";
const db = new PGlite();
let passed = 0;
const sql = async (q, p = []) => (await db.query(q, p)).rows;
const rpc = async (name, args = {}) =>
  (await sql(
    `select public.${name}(${
      Object.keys(args).map((k, i) => `${k}=>$${i + 1}`).join(",")
    }) result`,
    Object.values(args).map((x) =>
      x && typeof x === "object" ? JSON.stringify(x) : x
    ),
  ))[0].result;
const test = async (name, fn) => {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
};
const owner = "10000000-0000-4000-8000-000000000001";
const create = (key) =>
  rpc("rr_market_command", {
    p_actor: owner,
    p_action: "payment-create",
    p_input: { amount_kobo: 100000, idempotency_key: key },
  });
try {
  await db.exec(predecessorSchema);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261021165450_marketplace_production_core.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await sql(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'fixture@example.test',now())",
    [owner],
  );
  await sql(
    "insert into public.profiles(id,account_type) values($1,'business')",
    [owner],
  );
  const old = await create("existing_sent");
  await rpc("rr_market_dispatch", { p_id: old.id });
  await rpc("rr_market_bind_payment", {
    p_id: old.id,
    p_provider_id: "PFI|before_gate",
    p_status: "pending",
  });
  const unsubmitted = await create("existing_unsent");
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261021191322_payment_launch_gates.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await test("collections and payouts default OFF independently of existing pricing settings", async () => {
    const s = (await sql("select * from public.rr_settings"))[0];
    assert.equal(s.collections_enabled, false);
    assert.equal(s.payouts_enabled, false);
  });
  await test("new collection command is blocked without creating a payment or journal", async () => {
    await assert.rejects(
      () => create("blocked_collection"),
      /top-ups are currently unavailable/,
    );
    assert.equal(
      (await sql(
        "select count(*)::int n from public.rr_payments where idempotency_key='blocked_collection'",
      ))[0].n,
      0,
    );
    assert.equal(
      (await sql("select count(*)::int n from public.rr_journals"))[0].n,
      0,
    );
  });
  await test("direct service-role payout INSERT cannot bypass disabled launch gate", async () => {
    await db.exec("set role service_role");
    try {
      await assert.rejects(
        () =>
          sql(
            "insert into public.rr_payments(owner_id,direction,reference,idempotency_key,amount_kobo) values($1,'payout','blocked-payout','blocked-payout',10000)",
            [owner],
          ),
        /Withdrawals are currently unavailable/,
      );
    } finally {
      await db.exec("reset role");
    }
  });
  await test("an existing unsent collection cannot dispatch while disabled", async () => {
    await assert.rejects(
      () => rpc("rr_market_dispatch", { p_id: unsubmitted.id }),
      /top-ups are currently unavailable/,
    );
    assert.equal(
      (await sql("select submitted_at from public.rr_payments where id=$1", [
        unsubmitted.id,
      ]))[0].submitted_at,
      null,
    );
  });
  await test("already-dispatched idempotent retry does not send again", async () =>
    assert.equal(await rpc("rr_market_dispatch", { p_id: old.id }), false));
  await test("confirmed existing collection can still settle while new payments are disabled", async () => {
    await rpc("rr_market_finish_payment", {
      p_id: old.id,
      p_state: "succeeded",
      p_reference: old.reference,
      p_amount: 100000,
      p_currency: "NGN",
      p_provider_id: "PFI|before_gate",
    });
    assert.equal(
      (await sql("select status from public.rr_payments where id=$1", [
        old.id,
      ]))[0].status,
      "succeeded",
    );
    assert.equal(
      Number(
        (await sql(
          "select balance_kobo from public.rr_ledger_accounts where owner_id=$1 and bucket='available'",
          [owner],
        ))[0].balance_kobo,
      ),
      100000,
    );
  });
  await test("collection enablement does not enable payouts", async () => {
    await sql(
      "update public.rr_settings set collections_enabled=true,payouts_paused=false",
    );
    await create("collection_enabled");
    await assert.rejects(
      () =>
        sql(
          "insert into public.rr_payments(owner_id,direction,reference,idempotency_key,amount_kobo) values($1,'payout','still-blocked','still-blocked',10000)",
          [owner],
        ),
      /Withdrawals are currently unavailable/,
    );
  });
  let payout;
  await test("payout gate and temporary pause both control first dispatch", async () => {
    await sql("update public.rr_settings set payouts_enabled=true");
    payout = (await sql(
      "insert into public.rr_payments(owner_id,direction,reference,idempotency_key,amount_kobo) values($1,'payout','fixture-payout','fixture-payout',10000) returning id",
      [owner],
    ))[0];
    await sql("update public.rr_settings set payouts_paused=true");
    await assert.rejects(
      () => rpc("rr_market_dispatch", { p_id: payout.id }),
      /Withdrawals are currently unavailable/,
    );
    await sql("update public.rr_settings set payouts_paused=false");
    assert.equal(await rpc("rr_market_dispatch", { p_id: payout.id }), true);
  });
  await test("re-disabling both gates leaves status/reconciliation reads available", async () => {
    await sql(
      "update public.rr_settings set collections_enabled=false,payouts_enabled=false",
    );
    assert.equal(
      (await sql("select status from public.rr_payments where id=$1", [
        payout.id,
      ]))[0].status,
      "pending",
    );
    await assert.rejects(
      () => create("disabled_again"),
      /top-ups are currently unavailable/,
    );
  });
  await test("customers cannot enable launch gates or call their trigger function", async () => {
    await db.exec("set role authenticated");
    try {
      await assert.rejects(
        () => sql("update public.rr_settings set collections_enabled=true"),
        /permission denied/,
      );
      await assert.rejects(
        () => sql("select private.rr_payment_launch_guard()"),
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  });
  await test("existing admin pricing and pause settings cannot enable launch gates", async () => {
    await sql("insert into public.sole_admin(user_id) values($1)", [owner]);
    const s = (await sql("select * from public.rr_settings"))[0];
    await rpc("rr_market_admin", {
      p_actor: owner,
      p_action: "admin-settings",
      p_input: {
        ...s,
        collections_enabled: true,
        payouts_enabled: true,
        payouts_paused: false,
      },
    });
    const saved = (await sql(
      "select collections_enabled,payouts_enabled from public.rr_settings",
    ))[0];
    assert.deepEqual(saved, {
      collections_enabled: false,
      payouts_enabled: false,
    });
  });
  console.log(`${passed} payment launch gate database checks passed`);
} finally {
  await db.close();
}
