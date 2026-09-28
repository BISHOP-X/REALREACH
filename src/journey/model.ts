// Local, deterministic product simulator. This is NOT an authorization or payment backend.
export type Front = "worker" | "business" | "admin";
export type ActionKind = "follow" | "comment";
export type CampaignStatus =
  "draft" | "live" | "paused" | "closing" | "completed" | "cancelled";
export type AssignmentStatus =
  | "reserved"
  | "ready"
  | "checking"
  | "pending"
  | "settled"
  | "rejected"
  | "review"
  | "expired";
export type Scenario =
  "success" | "already-following" | "unavailable" | "not-done";
export interface Campaign {
  id: string;
  name: string;
  brand: string;
  handle: string;
  category: string;
  kind: ActionKind;
  goal: number;
  reward: number;
  fee: number;
  status: CampaignStatus;
  owned: boolean;
  theme: "plum" | "orange" | "green" | "blue";
  post: string;
  prompt: string;
  createdAt: number;
  endsAt: number;
  funded: boolean;
  released: number;
}
export interface Assignment {
  id: string;
  campaignId: string;
  status: AssignmentStatus;
  createdAt: number;
  expiresAt: number;
  releaseAt?: number;
  verifiedAt?: number;
  reason: string;
  events: { text: string; at: number }[];
}
export interface MoneyEvent {
  id: string;
  title: string;
  detail: string;
  amount: number;
  at: number;
  side: "business" | "worker";
}
export interface Withdrawal {
  id: string;
  amount: number;
  status: "processing" | "paid" | "failed";
  at: number;
  bank: string;
}
export interface DemoState {
  version: 1;
  clock: number;
  session: boolean;
  front: Front;
  name: string;
  email: string;
  businessName: string;
  handle: string;
  connected: boolean;
  businessBalance: number;
  workerBalance: number;
  campaigns: Campaign[];
  assignments: Assignment[];
  money: MoneyEvent[];
  withdrawals: Withdrawal[];
  saved: string[];
  bindings: string[];
  bank: { name: string; number: string; holder: string } | null;
  notices: { id: string; text: string; at: number; read: boolean }[];
  preferences: { email: boolean; updates: boolean };
}
export type Command =
  | { type: "session"; front: Front; name?: string; email?: string }
  | { type: "signout" }
  | { type: "profile"; name: string; email: string; businessName: string }
  | { type: "connection"; handle: string; connected: boolean }
  | { type: "save-campaign"; campaign: Campaign }
  | { type: "publish"; id: string }
  | {
      type: "campaign-state";
      id: string;
      status: "live" | "paused" | "closing";
    }
  | { type: "deposit"; amount: number; reference: string }
  | { type: "claim"; id: string; assignmentId: string }
  | { type: "identify"; id: string; alreadyFollowing: boolean }
  | { type: "check"; id: string }
  | {
      type: "result";
      id: string;
      result: "success" | "unavailable" | "not-done";
    }
  | {
      type: "final-check";
      id: string;
      result: "success" | "missing" | "unavailable";
    }
  | { type: "advance"; hours: number }
  | { type: "tick"; now: number }
  | { type: "appeal"; id: string; reason: string }
  | { type: "resolve"; id: string; accept: boolean }
  | { type: "save-task"; id: string }
  | { type: "bank"; bank: NonNullable<DemoState["bank"]> }
  | { type: "withdraw"; amount: number; reference: string }
  | { type: "payout-result"; id: string; success: boolean }
  | { type: "read-notices" }
  | { type: "preference"; key: "email" | "updates" }
  | { type: "reset" };

export const HOUR = 3_600_000;
export const HOLD_HOURS = 48;
export const MIN_WITHDRAWAL = 100_000;
export const money = (kobo: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(kobo / 100);
export const unit = (campaign: Campaign) => campaign.reward + campaign.fee;
export const budget = (campaign: Campaign) => unit(campaign) * campaign.goal;
export const terminal = (a: Assignment) =>
  ["rejected", "expired"].includes(a.status);
export const occupying = (a: Assignment) => !terminal(a);
export const campaignAssignments = (s: DemoState, id: string) =>
  s.assignments.filter((a) => a.campaignId === id);
export const places = (s: DemoState, c: Campaign) =>
  Math.max(0, c.goal - campaignAssignments(s, c.id).filter(occupying).length);
export const activeClaim = (s: DemoState) =>
  s.assignments.find((a) =>
    ["reserved", "ready", "checking"].includes(a.status),
  );
export const hasTargetAttempt = (s: DemoState, campaign: Campaign) =>
  s.assignments.some((a) => {
    const previous = s.campaigns.find((c) => c.id === a.campaignId);
    return (
      previous &&
      previous.kind === campaign.kind &&
      previous.handle === campaign.handle &&
      (campaign.kind === "follow" || previous.post === campaign.post)
    );
  });
export const pendingEarnings = (s: DemoState) =>
  s.assignments
    .filter((a) => ["pending", "review"].includes(a.status) && a.verifiedAt)
    .reduce(
      (sum, a) =>
        sum + (s.campaigns.find((c) => c.id === a.campaignId)?.reward ?? 0),
      0,
    );
export const campaignSpent = (s: DemoState, c: Campaign) =>
  campaignAssignments(s, c.id).filter((a) => a.status === "settled").length *
  unit(c);
export const campaignHeld = (s: DemoState, c: Campaign) =>
  c.funded ? Math.max(0, budget(c) - c.released - campaignSpent(s, c)) : 0;
export const label: Record<AssignmentStatus | CampaignStatus, string> = {
  draft: "Draft",
  live: "Live",
  paused: "Paused",
  closing: "Closing",
  completed: "Completed",
  cancelled: "Closed",
  reserved: "Verify account",
  ready: "Ready to work",
  checking: "Checking",
  pending: "Pending release",
  settled: "Completed",
  rejected: "Not approved",
  review: "Under review",
  expired: "Expired",
};
export function initialState(now = Date.now()): DemoState {
  const make = (
    id: string,
    brand: string,
    handle: string,
    kind: ActionKind,
    theme: Campaign["theme"],
    owned = false,
  ): Campaign => ({
    id,
    brand,
    handle,
    kind,
    theme,
    owned,
    name:
      kind === "follow"
        ? `${brand} · meet your next favourite`
        : `${brand} · join the conversation`,
    category:
      theme === "green"
        ? "Food & drink"
        : theme === "blue"
          ? "Everyday essentials"
          : "Style & culture",
    goal: 60,
    reward: kind === "follow" ? 8000 : 15000,
    fee: 3000,
    status: "live",
    post: "The everyday collection",
    prompt:
      "Which detail in this collection catches your eye, and why? Share your own thoughts in at least 20 characters. No copied comments.",
    createdAt: now - HOUR * 3,
    endsAt: now + HOUR * 24 * 7,
    funded: true,
    released: 0,
  });
  const campaigns = [
    make("kora-follow", "Kora Studio", "kora.demo", "follow", "plum", true),
    make("terra-comment", "Terra Market", "terra.demo", "comment", "green"),
    make(
      "studio-follow",
      "Studio Orange",
      "studioorange.demo",
      "follow",
      "orange",
    ),
    make(
      "daily-comment",
      "Daily Objects",
      "dailyobjects.demo",
      "comment",
      "blue",
    ),
  ];
  return {
    version: 1,
    clock: now,
    session: false,
    front: "worker",
    name: "Alex",
    email: "alex@example.com",
    businessName: "Kora Studio",
    handle: "kora.demo",
    connected: true,
    businessBalance: 5_000_000 - budget(campaigns[0]),
    workerBalance: 180_000,
    campaigns,
    assignments: [],
    withdrawals: [],
    saved: [],
    bindings: [],
    bank: null,
    money: [
      {
        id: "opening-business",
        title: "Demo opening balance",
        detail: "Sample funds only",
        amount: 5_000_000,
        at: now,
        side: "business",
      },
      {
        id: "seed-reserve",
        title: "Campaign funded",
        detail: campaigns[0].name,
        amount: -budget(campaigns[0]),
        at: now,
        side: "business",
      },
      {
        id: "opening-worker",
        title: "Demo opening balance",
        detail: "Sample funds only",
        amount: 180_000,
        at: now,
        side: "worker",
      },
    ],
    notices: [
      {
        id: "welcome",
        text: "Your workspace is ready. All tasks and money in this preview are simulated.",
        at: now,
        read: false,
      },
    ],
    preferences: { email: true, updates: false },
  };
}

function note(s: DemoState, id: string, text: string) {
  s.notices.unshift({ id, text, at: s.clock, read: false });
}
function record(
  s: DemoState,
  id: string,
  side: MoneyEvent["side"],
  title: string,
  detail: string,
  amount: number,
) {
  if (!s.money.some((e) => e.id === id))
    s.money.unshift({ id, side, title, detail, amount, at: s.clock });
}
function event(s: DemoState, a: Assignment, text: string) {
  a.events.push({ text, at: s.clock });
}
function closeRemainder(s: DemoState, c: Campaign) {
  if (c.status !== "closing") return;
  const rows = campaignAssignments(s, c.id);
  const committed = rows.filter(occupying).length * unit(c);
  const releasable = Math.max(0, budget(c) - c.released - committed);
  if (releasable && c.owned) {
    s.businessBalance += releasable;
    record(
      s,
      `release-${c.id}-${c.released}`,
      "business",
      "Unused funds returned",
      c.name,
      releasable,
    );
  }
  c.released += releasable;
  if (!rows.some((a) => occupying(a) && a.status !== "settled"))
    c.status = "cancelled";
}
function settle(s: DemoState, a: Assignment, c: Campaign) {
  if (a.status === "settled" || s.money.some((e) => e.id === `reward-${a.id}`))
    return;
  if (!c.funded || c.status === "cancelled" || campaignHeld(s, c) < unit(c)) {
    throw new Error(
      "This allocation is no longer funded. A returned budget cannot be paid out again.",
    );
  }
  a.status = "settled";
  a.reason = "Final check passed. Your reward is available.";
  s.workerBalance += c.reward;
  record(
    s,
    `reward-${a.id}`,
    "worker",
    `${c.brand} · ${c.kind}`,
    "Final verification passed",
    c.reward,
  );
  event(s, a, "Final check passed · reward released");
  note(
    s,
    `settled-${a.id}`,
    `${money(c.reward)} from ${c.brand} is now available.`,
  );
  if (
    campaignAssignments(s, c.id).filter((x) => x.status === "settled").length >=
    c.goal
  )
    c.status = "completed";
  closeRemainder(s, c);
}

export function transition(previous: DemoState, command: Command): DemoState {
  if (command.type === "reset") return initialState();
  const s = structuredClone(previous);
  const c =
    "id" in command ? s.campaigns.find((x) => x.id === command.id) : undefined;
  const a =
    "id" in command
      ? s.assignments.find((x) => x.id === command.id)
      : undefined;
  const target = a ? s.campaigns.find((x) => x.id === a.campaignId) : undefined;
  switch (command.type) {
    case "session":
      s.session = true;
      s.front = command.front;
      if (command.name) s.name = command.name;
      if (command.email) s.email = command.email;
      break;
    case "signout":
      s.session = false;
      break;
    case "profile":
      s.name = command.name;
      s.email = command.email;
      s.businessName = command.businessName;
      break;
    case "connection":
      s.connected = command.connected;
      s.handle = command.handle;
      break;
    case "save-campaign": {
      const old = s.campaigns.find((x) => x.id === command.campaign.id);
      if (old && old.status !== "draft")
        throw new Error("Published campaign terms cannot be edited.");
      if (old) Object.assign(old, command.campaign);
      else s.campaigns.unshift(command.campaign);
      break;
    }
    case "deposit":
      if (s.money.some((e) => e.id === command.reference)) return previous;
      if (
        !Number.isSafeInteger(command.amount) ||
        command.amount < 100_000 ||
        command.amount > 10_000_000
      )
        throw new Error("Choose an amount between ₦1,000 and ₦100,000.");
      s.businessBalance += command.amount;
      record(
        s,
        command.reference,
        "business",
        "Demo top-up confirmed",
        "Simulated payment · no charge",
        command.amount,
      );
      break;
    case "publish":
      if (!c || !c.owned || c.status !== "draft") return previous;
      if (!s.connected)
        throw new Error("Connect the business Instagram account first.");
      if (!Number.isSafeInteger(c.goal) || c.goal < 1 || c.goal > 1000)
        throw new Error("Choose between 1 and 1,000 places.");
      if (s.businessBalance < budget(c))
        throw new Error("Top up your demo balance before publishing.");
      s.businessBalance -= budget(c);
      c.funded = true;
      c.status = "live";
      record(
        s,
        `fund-${c.id}`,
        "business",
        "Campaign funded",
        c.name,
        -budget(c),
      );
      note(s, `published-${c.id}`, `${c.name} is live in the task feed.`);
      break;
    case "campaign-state":
      if (!c || !c.owned || !["live", "paused"].includes(c.status))
        return previous;
      if (command.status === "live" && !s.connected)
        throw new Error("Reconnect Instagram before resuming.");
      c.status = command.status;
      closeRemainder(s, c);
      break;
    case "claim": {
      if (s.assignments.some((x) => x.id === command.assignmentId))
        return previous;
      if (
        !c ||
        c.status !== "live" ||
        !c.funded ||
        c.endsAt <= s.clock ||
        !places(s, c) ||
        (c.owned && !s.connected)
      )
        throw new Error("This campaign is not accepting new tasks.");
      if (activeClaim(s))
        throw new Error("Finish your current task before accepting another.");
      if (s.assignments.some((x) => x.campaignId === c.id))
        throw new Error(
          "You already have an assignment for this campaign. Open My tasks.",
        );
      if (hasTargetAttempt(s, c))
        throw new Error(
          "This account has already participated for this Instagram target. Choose a different task.",
        );
      s.assignments.unshift({
        id: command.assignmentId,
        campaignId: c.id,
        status: "reserved",
        createdAt: s.clock,
        expiresAt: s.clock + 15 * 60_000,
        reason: "Verify your account before starting.",
        events: [{ text: "Place and reward reserved", at: s.clock }],
      });
      break;
    }
    case "identify":
      if (!a || !target || a.status !== "reserved") return previous;
      if (command.alreadyFollowing && target.kind === "follow") {
        a.status = "rejected";
        a.reason =
          "Already following at the first check. This task is for new followers; there is no penalty.";
        event(s, a, "Already following · place released");
        closeRemainder(s, target);
      } else {
        a.status = "ready";
        a.reason = "Account identified. You can complete the task.";
        if (!s.bindings.includes(target.handle)) s.bindings.push(target.handle);
        event(s, a, "Demo verification message received · identity matched");
      }
      break;
    case "check":
      if (!a || !["ready", "checking"].includes(a.status)) return previous;
      a.status = "checking";
      a.reason = "Checking the action against your Instagram account.";
      event(s, a, "Verification requested");
      break;
    case "result":
      if (!a || !target || a.status !== "checking") return previous;
      if (command.result === "success") {
        a.status = "pending";
        a.verifiedAt = s.clock;
        a.releaseAt = s.clock + HOLD_HOURS * HOUR;
        a.reason =
          "Action detected. Your reward is held until the final check.";
        event(s, a, "Action detected · 48-hour hold started");
      } else if (command.result === "unavailable") {
        a.reason =
          "Instagram verification is temporarily unavailable. Your place is protected; retry when ready.";
        event(s, a, "Provider unavailable · no pass or fail recorded");
      } else {
        a.status = "ready";
        a.expiresAt = Math.max(a.expiresAt, s.clock + 5 * 60_000);
        a.reason =
          "We have not detected the action. Complete it and check again.";
        event(s, a, "Action not found · retry available");
      }
      break;
    case "final-check":
      if (!a || !target || a.status !== "pending") return previous;
      if ((a.releaseAt ?? Infinity) > s.clock)
        throw new Error(
          "The holding period has not finished. Advance the demo clock to test the final check.",
        );
      if (target.owned && !s.connected)
        throw new Error(
          "The business account is disconnected. Reconnect before checking.",
        );
      if (command.result === "success") settle(s, a, target);
      else if (command.result === "unavailable") {
        a.reason =
          "Final verification is delayed. Your pending earnings are protected.";
        event(s, a, "Final check unavailable · reward remains pending");
      } else {
        a.status = "review";
        a.reason =
          "The action is no longer visible. A review is needed to establish what happened.";
        event(s, a, "Action unavailable at final check · exception opened");
      }
      break;
    case "advance":
      s.clock += command.hours * HOUR;
      break;
    case "tick":
      s.clock = Math.max(s.clock, command.now);
      break;
    case "appeal":
      if (!a || !["rejected", "expired"].includes(a.status)) return previous;
      a.status = "review";
      a.reason = command.reason;
      event(s, a, `Appeal submitted: ${command.reason}`);
      break;
    case "resolve":
      if (!a || !target || a.status !== "review") return previous;
      // Only previously verified, still-funded claims may be paid by this simulator.
      if (command.accept && a.verifiedAt) settle(s, a, target);
      else {
        a.status = "rejected";
        a.reason =
          "Review closed without payment. No reward has been deducted from your available balance.";
        event(s, a, "Review resolved · no payment");
        closeRemainder(s, target);
      }
      break;
    case "save-task":
      s.saved = s.saved.includes(command.id)
        ? s.saved.filter((id) => id !== command.id)
        : [...s.saved, command.id];
      break;
    case "bank":
      if (!/^\d{10}$/.test(command.bank.number))
        throw new Error("Enter a 10-digit demo account number.");
      s.bank = command.bank;
      break;
    case "withdraw":
      if (s.withdrawals.some((w) => w.id === command.reference))
        return previous;
      if (!s.bank) throw new Error("Add a demo bank account first.");
      if (
        !Number.isSafeInteger(command.amount) ||
        command.amount < MIN_WITHDRAWAL ||
        command.amount > s.workerBalance
      )
        throw new Error(
          "Choose at least ₦1,000 and no more than your available balance.",
        );
      s.workerBalance -= command.amount;
      s.withdrawals.unshift({
        id: command.reference,
        amount: command.amount,
        status: "processing",
        at: s.clock,
        bank: `${s.bank.name} · ${s.bank.number.slice(-4)}`,
      });
      record(
        s,
        command.reference,
        "worker",
        "Withdrawal requested",
        "Held while the demo transfer processes",
        -command.amount,
      );
      break;
    case "payout-result": {
      const w = s.withdrawals.find((x) => x.id === command.id);
      if (!w || w.status !== "processing") return previous;
      w.status = command.success ? "paid" : "failed";
      if (!command.success) {
        s.workerBalance += w.amount;
        record(
          s,
          `return-${w.id}`,
          "worker",
          "Withdrawal returned",
          "Demo transfer failed · hold released",
          w.amount,
        );
      }
      note(
        s,
        `payout-${w.id}`,
        command.success
          ? `${money(w.amount)} demo withdrawal completed.`
          : "Your demo withdrawal failed. Funds are available again.",
      );
      break;
    }
    case "read-notices":
      s.notices.forEach((n) => (n.read = true));
      break;
    case "preference":
      s.preferences[command.key] = !s.preferences[command.key];
      break;
  }
  if (["tick", "advance"].includes(command.type)) {
    s.assignments.forEach((row) => {
      if (
        ["reserved", "ready"].includes(row.status) &&
        row.expiresAt <= s.clock
      ) {
        row.status = "expired";
        row.reason =
          "The claim window ended before submission. No money was deducted.";
        event(s, row, "Claim expired · allocation released");
      }
    });
    s.campaigns.forEach((row) => {
      if (["live", "paused"].includes(row.status) && row.endsAt <= s.clock)
        row.status = "closing";
      closeRemainder(s, row);
    });
  }
  return s;
}
