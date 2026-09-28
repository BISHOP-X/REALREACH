import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  transition,
  budget,
  campaignHeld,
  campaignSpent,
  pendingEarnings,
  places,
  HOUR,
} from "../src/journey/model.ts";

const now = Date.UTC(2026, 8, 28, 10);
const fresh = () => initialState(now);
const run = (state, ...commands) => commands.reduce(transition, state);
const claim = (id = "kora-follow", assignmentId = "test-assignment") => ({
  type: "claim",
  id,
  assignmentId,
});
const detected = () =>
  run(
    fresh(),
    claim(),
    { type: "identify", id: "test-assignment", alreadyFollowing: false },
    { type: "check", id: "test-assignment" },
    { type: "result", id: "test-assignment", result: "success" },
  );

test("claim reserves capacity but does not deduct an already reserved budget again", () => {
  const start = fresh();
  const next = transition(start, claim());
  assert.equal(next.businessBalance, start.businessBalance);
  assert.equal(next.workerBalance, start.workerBalance);
  assert.equal(places(next, next.campaigns[0]), 59);
  assert.equal(start.assignments.length, 0, "transition must not mutate input");
});
test("duplicate claim is idempotent and parallel active work is rejected", () => {
  const s = transition(fresh(), claim());
  assert.deepEqual(transition(s, claim()), s);
  assert.throws(
    () => transition(s, claim("studio-follow", "another")),
    /current task/,
  );
});
test("unknown verification preserves the claim and never credits earnings", () => {
  const s = run(
    fresh(),
    claim(),
    { type: "identify", id: "test-assignment", alreadyFollowing: false },
    { type: "check", id: "test-assignment" },
    { type: "result", id: "test-assignment", result: "unavailable" },
    { type: "advance", hours: 2 },
  );
  assert.equal(s.assignments[0].status, "checking");
  assert.equal(pendingEarnings(s), 0);
  assert.equal(s.workerBalance, 180000);
});
test("pending rewards are not withdrawable; early settlement is prohibited", () => {
  const s = detected();
  assert.equal(pendingEarnings(s), 8000);
  assert.equal(s.workerBalance, 180000);
  assert.throws(
    () =>
      transition(s, {
        type: "final-check",
        id: "test-assignment",
        result: "success",
      }),
    /holding period/,
  );
});
test("final verification settles exactly once, and replayed results cannot award again", () => {
  const s = run(
    detected(),
    { type: "advance", hours: 48 },
    { type: "final-check", id: "test-assignment", result: "success" },
  );
  assert.equal(s.workerBalance, 188000);
  assert.equal(pendingEarnings(s), 0);
  assert.equal(campaignSpent(s, s.campaigns[0]), 11000);
  assert.equal(
    s.money.filter((e) => e.id === "reward-test-assignment").length,
    1,
  );
  assert.deepEqual(
    transition(s, {
      type: "final-check",
      id: "test-assignment",
      result: "success",
    }),
    s,
  );
});
test("already-following outcome releases capacity without financial penalty", () => {
  const s = run(fresh(), claim(), {
    type: "identify",
    id: "test-assignment",
    alreadyFollowing: true,
  });
  assert.equal(s.assignments[0].status, "rejected");
  assert.equal(places(s, s.campaigns[0]), 60);
  assert.equal(s.workerBalance, 180000);
});
test("expiry only affects unsubmitted claims, not checking or pending", () => {
  const s = run(fresh(), claim(), { type: "advance", hours: 0.26 });
  assert.equal(s.assignments[0].status, "expired");
  const p = transition(detected(), { type: "advance", hours: 48 });
  assert.equal(p.assignments[0].status, "pending");
});
test("closing returns unused capacity while preserving pending assignment funding", () => {
  const start = detected();
  const c = start.campaigns[0];
  const s = transition(start, {
    type: "campaign-state",
    id: c.id,
    status: "closing",
  });
  assert.equal(s.businessBalance - start.businessBalance, 59 * 11000);
  assert.equal(campaignHeld(s, s.campaigns[0]), 11000);
  assert.equal(s.campaigns[0].status, "closing");
  const end = run(
    s,
    { type: "advance", hours: 48 },
    { type: "final-check", id: "test-assignment", result: "success" },
  );
  assert.equal(end.campaigns[0].status, "cancelled");
  assert.equal(campaignHeld(end, end.campaigns[0]), 0);
  assert.equal(
    end.campaigns[0].released + campaignSpent(end, end.campaigns[0]),
    budget(c),
  );
});
test("closing an expired allocation returns funds exactly once", () => {
  const s = run(
    fresh(),
    claim(),
    { type: "campaign-state", id: "kora-follow", status: "closing" },
    { type: "advance", hours: 1 },
  );
  assert.equal(s.businessBalance, 5000000);
  assert.equal(s.campaigns[0].released, budget(s.campaigns[0]));
  assert.equal(
    transition(s, { type: "advance", hours: 1 }).businessBalance,
    5000000,
  );
});
test("pause and disconnect block new claims without erasing pending rewards", () => {
  assert.throws(
    () =>
      transition(
        transition(fresh(), {
          type: "campaign-state",
          id: "kora-follow",
          status: "paused",
        }),
        claim(),
      ),
    /not accepting/,
  );
  const s = run(
    detected(),
    { type: "connection", handle: "kora.demo", connected: false },
    { type: "advance", hours: 48 },
  );
  assert.throws(
    () =>
      transition(s, {
        type: "final-check",
        id: "test-assignment",
        result: "success",
      }),
    /disconnected/,
  );
  assert.equal(pendingEarnings(s), 8000);
});
test("deposits are idempotent and reject invalid amounts", () => {
  const command = {
    type: "deposit",
    amount: 100000,
    reference: "unique-payment",
  };
  const s = transition(fresh(), command);
  assert.deepEqual(transition(s, command), s);
  assert.throws(
    () => transition(s, { ...command, reference: "bad", amount: -1 }),
    /between/,
  );
});
test("publishing funds once and freezes campaign terms", () => {
  const draft = {
    ...fresh().campaigns[0],
    id: "draft",
    status: "draft",
    funded: false,
    goal: 2,
  };
  const s = run(
    fresh(),
    { type: "save-campaign", campaign: draft },
    { type: "publish", id: "draft" },
  );
  assert.equal(s.businessBalance, fresh().businessBalance - 22000);
  assert.deepEqual(transition(s, { type: "publish", id: "draft" }), s);
  assert.throws(
    () =>
      transition(s, {
        type: "save-campaign",
        campaign: { ...draft, reward: 0 },
      }),
    /cannot be edited/,
  );
});
test("insufficient funding prevents publication", () => {
  const draft = {
    ...fresh().campaigns[0],
    id: "huge",
    goal: 1000,
    status: "draft",
    funded: false,
  };
  const s = transition(fresh(), { type: "save-campaign", campaign: draft });
  assert.throws(() => transition(s, { type: "publish", id: "huge" }), /Top up/);
});
test("withdrawal is held once and a failed payout returns funds once", () => {
  const start = transition(fresh(), {
    type: "bank",
    bank: { name: "Demo Bank", number: "0000000000", holder: "Alex" },
  });
  const command = { type: "withdraw", amount: 100000, reference: "payout-1" };
  const s = transition(start, command);
  assert.equal(s.workerBalance, 80000);
  assert.deepEqual(transition(s, command), s);
  const end = transition(s, {
    type: "payout-result",
    id: "payout-1",
    success: false,
  });
  assert.equal(end.workerBalance, 180000);
  assert.deepEqual(
    transition(end, { type: "payout-result", id: "payout-1", success: false }),
    end,
  );
  assert.deepEqual(
    transition(end, { type: "payout-result", id: "payout-1", success: true }),
    end,
  );
});
test("missing final evidence opens an exception, never an automatic payment", () => {
  const s = run(
    detected(),
    { type: "advance", hours: 48 },
    { type: "final-check", id: "test-assignment", result: "missing" },
  );
  assert.equal(s.assignments[0].status, "review");
  assert.equal(s.workerBalance, 180000);
  const resolved = transition(s, {
    type: "resolve",
    id: "test-assignment",
    accept: true,
  });
  assert.equal(resolved.workerBalance, 188000);
  assert.deepEqual(
    transition(resolved, {
      type: "resolve",
      id: "test-assignment",
      accept: true,
    }),
    resolved,
  );
});
test("the same actor cannot repeat the same target in a new campaign", () => {
  let s = run(
    detected(),
    { type: "advance", hours: 48 },
    { type: "final-check", id: "test-assignment", result: "success" },
  );
  const draft = {
    ...s.campaigns[0],
    id: "duplicate-target",
    status: "draft",
    funded: false,
  };
  s = run(
    s,
    { type: "save-campaign", campaign: draft },
    { type: "publish", id: draft.id },
  );
  assert.throws(
    () => transition(s, claim(draft.id, "duplicate")),
    /already participated/,
  );
});
test("an unverified expired task cannot be paid through an appeal", () => {
  const s = run(
    fresh(),
    claim(),
    { type: "advance", hours: 1 },
    { type: "appeal", id: "test-assignment", reason: "Please check this task" },
    { type: "resolve", id: "test-assignment", accept: true },
  );
  assert.equal(s.workerBalance, 180000);
  assert.equal(s.assignments[0].status, "rejected");
});

test("an appeal cannot pay money already returned to the business", () => {
  const s = run(
    detected(),
    { type: "advance", hours: 48 },
    { type: "final-check", id: "test-assignment", result: "missing" },
    { type: "campaign-state", id: "kora-follow", status: "closing" },
    { type: "resolve", id: "test-assignment", accept: false },
    {
      type: "appeal",
      id: "test-assignment",
      reason: "Please reopen this case",
    },
  );
  assert.equal(s.businessBalance, 5000000);
  assert.throws(
    () =>
      transition(s, { type: "resolve", id: "test-assignment", accept: true }),
    /no longer funded/,
  );
  assert.equal(s.workerBalance, 180000);
});
