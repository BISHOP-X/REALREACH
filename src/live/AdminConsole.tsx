import { type FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Headphones,
  LockKeyhole,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { db, friendlyError } from "./client";
import { marketplaceRequest, useMarketplace } from "./marketplace";
import {
  type AdminOverview,
  formatDate,
  formatMoney,
  type Pricing,
} from "./marketplace.types";
import {
  AsyncState,
  EmptyPanel,
  Feedback,
  Modal,
  PageIntro,
  StatusPill,
  SubmitButton,
  Surface,
} from "./StudioUI";
import { SecurityPanel, Workspace } from "./Workspace";
import { AdminQueue, AdminRecord } from "./AdminInvestigation";
import { AdminOperations } from "./AdminOperations";

const sections = [
  { id: "overview", label: "Overview" },
  { id: "cases", label: "Cases" },
  { id: "checks", label: "Checks" },
  { id: "payments", label: "Payments" },
  { id: "settings", label: "Settings" },
  { id: "audit", label: "Activity" },
] as const;
type Section = typeof sections[number]["id"];
type AdminSettings = Pricing & { payouts_paused: boolean };

export function AdminConsole() {
  const auth = useAuth();
  const marketplace = useMarketplace();
  const location = useLocation(), navigate = useNavigate();
  const parts = location.pathname.split("/").filter(Boolean);
  const requested = parts[1] || "overview";
  const section: Section = sections.find((item) =>
    item.id ===
      (requested === "payouts"
        ? "payments"
        : requested === "tasks"
        ? "checks"
        : requested === "campaigns"
        ? "cases"
        : requested)
  )?.id ?? "overview";
  const record = parts[2] &&
      ["payments", "payouts", "tasks", "campaigns"].includes(requested)
    ? {
      resource: requested === "tasks"
        ? "task" as const
        : requested === "campaigns"
        ? "campaign" as const
        : "payment" as const,
      id: parts[2],
    }
    : null;
  const [data, setData] = useState<AdminOverview | null>(null);
  const [assurance, setAssurance] = useState<
    "checking" | "required" | "verified"
  >("checking");
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [message, setMessage] = useState(""),
    [mutationError, setMutationError] = useState("");
  const [revision, setRevision] = useState(0);
  const reload = () => setRevision((value) => value + 1);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");
    setData(null);
    const timer = setTimeout(() => controller.abort(), 30_000);
    void (async () => {
      if (!auth.user || !auth.isAdmin) return;
      const { data: level, error: securityError } = await db().auth.mfa
        .getAuthenticatorAssuranceLevel();
      if (securityError) throw securityError;
      if (!active) return;
      if (level.currentLevel !== "aal2") {
        setAssurance("required");
        return;
      }
      setAssurance("verified");
      const overview = await marketplaceRequest<AdminOverview>(
        "admin-overview",
        {},
        controller.signal,
        auth.user.id,
      );
      if (active) setData(overview);
    })().catch((cause) => {
      if (active) setError(friendlyError(cause));
    })
      .finally(() => {
        clearTimeout(timer);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [auth.user?.id, auth.isAdmin, revision]);

  async function save(
    action: string,
    payload: Record<string, unknown>,
    confirmation: string,
  ) {
    setMutationError("");
    setMessage("");
    try {
      await marketplaceRequest(action, payload, undefined, auth.user?.id);
      setMessage(confirmation);
      reload();
      void marketplace.refresh();
    } catch (cause) {
      const text = friendlyError(cause);
      setMutationError(text);
      throw new Error(text);
    }
  }

  if (!auth.isAdmin) {
    return (
      <Workspace>
        <EmptyPanel
          icon={LockKeyhole}
          title="This workspace is restricted."
          description="Sign in with the RealReach administrator account to continue."
        >
          <Link className="studio-button secondary" to="/account">
            Your account <ArrowRight size={17} />
          </Link>
        </EmptyPanel>
      </Workspace>
    );
  }

  return (
    <Workspace>
      <PageIntro
        eyebrow="REALREACH / OPERATIONS"
        title="Keep things moving."
        description="One place for service health, customer issues and payment checks."
        actions={
          <button
            className="studio-button secondary"
            onClick={reload}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? "studio-spin" : ""} />
            {" "}
            Refresh
          </button>
        }
      />
      <AsyncState loading={loading} error={error} onRetry={reload}>
        {assurance === "required"
          ? (
            <>
              <div className="studio-note">
                <ShieldCheck size={20} />
                <span>
                  Verify your authenticator to open operations and financial
                  settings.
                </span>
              </div>
              <SecurityPanel onVerified={reload} />
              <button className="studio-text-button" onClick={reload}>
                Check access again <ArrowRight size={15} />
              </button>
            </>
          )
          : data
          ? (
            <>
              <nav className="studio-tabs" aria-label="Operations sections">
                {sections.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={section === item.id ? "selected" : ""}
                    aria-current={section === item.id ? "page" : undefined}
                    onClick={() => {
                      setMessage("");
                      setMutationError("");
                      navigate(
                        item.id === "overview" ? "/admin" : `/admin/${item.id}`,
                      );
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
              <Feedback error={mutationError} message={message} />
              {record
                ? (
                  <AdminRecord
                    key={`${auth.user?.id}:${record.resource}:${record.id}`}
                    resource={record.resource}
                    id={record.id}
                    revision={revision}
                  />
                )
                : (
                  <>
                    {section === "overview"
                      ? (
                        <Overview
                          data={data}
                          revision={revision}
                          owner={auth.user?.id ?? ""}
                          onSection={(value) => navigate(`/admin/${value}`)}
                        />
                      )
                      : null}
                    {section === "cases" || section === "checks" ||
                        section === "payments" || section === "audit"
                      ? (
                        <AdminQueue
                          key={`${auth.user?.id}:${section}:${location.search}`}
                          resource={section}
                          revision={revision}
                          onSave={save}
                        />
                      )
                      : null}
                    {section === "settings"
                      ? (
                        <Settings
                          key={JSON.stringify([
                            data.pricing,
                            data.capabilities.payouts_paused,
                          ])}
                          initial={{
                            ...data.pricing,
                            payouts_paused: data.capabilities.payouts_paused,
                          }}
                          onSave={save}
                        />
                      )
                      : null}
                  </>
                )}
            </>
          )
          : null}
      </AsyncState>
    </Workspace>
  );
}

function Overview(
  { data, onSection, revision, owner }: {
    data: AdminOverview;
    revision: number;
    owner: string;
    onSection: (section: Section) => void;
  },
) {
  const metrics = [
    ["Workers", data.counts.workers],
    ["Businesses", data.counts.businesses],
    ["Live campaigns", data.counts.live_campaigns],
    ["Open cases", data.counts.open_cases],
    ["Queued checks", data.counts.pending_checks],
    ["Uncertain payouts", data.counts.pending_payouts],
  ] as const;
  return (
    <>
      <div className="studio-section-line">
        <h2>Today’s picture</h2>
        <span className="studio-small">Latest saved activity</span>
      </div>
      <div className="studio-admin-metrics">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value.toLocaleString()}</strong>
          </div>
        ))}
      </div>
      <AdminOperations key={owner} revision={revision} />
      <div className="studio-detail-layout">
        <Surface
          title="Needs your attention"
          description="Start with money uncertainty and customer issues."
        >
          <button
            className="studio-admin-row studio-text-button"
            type="button"
            onClick={() => onSection("payments")}
          >
            <Wallet size={20} />
            <div>
              <strong>Payment checks</strong>
              <small>
                {data.counts.pending_payouts
                  ? `${data.counts.pending_payouts} outstanding withdrawals`
                  : "No outstanding withdrawals"}
              </small>
            </div>
            <ArrowRight size={18} />
          </button>
          <button
            className="studio-admin-row studio-text-button"
            type="button"
            onClick={() => onSection("cases")}
          >
            <Headphones size={20} />
            <div>
              <strong>Customer cases</strong>
              <small>
                {data.counts.open_cases
                  ? `${data.counts.open_cases} cases awaiting a response`
                  : "No open cases"}
              </small>
            </div>
            <ArrowRight size={18} />
          </button>
          <button
            className="studio-admin-row studio-text-button"
            type="button"
            onClick={() => onSection("checks")}
          >
            <Activity size={20} />
            <div>
              <strong>Verification queue</strong>
              <small>
                {data.health
                  ? `${data.health.attention_checks} checks need attention`
                  : "Review delayed checks"}
              </small>
            </div>
            <ArrowRight size={18} />
          </button>
        </Surface>
        <Surface
          title="Service setup"
          description="Configuration status, not a claim that a live transaction has passed."
        >
          <ServiceRow
            label="Instagram verification"
            ready={data.capabilities.instagram}
          />
          <ServiceRow
            label="Payment collections"
            ready={data.capabilities.payments}
          />
          <ServiceRow
            label="Campaign pricing"
            ready={data.capabilities.pricing}
          />
          <div className="studio-admin-row">
            <div>
              <strong>Withdrawals</strong>
              <small>
                {data.capabilities.payouts_paused
                  ? "Paused by the administrator"
                  : data.capabilities.payouts
                  ? "New withdrawal requests enabled"
                  : "Payment setup required"}
              </small>
            </div>
            <StatusPill
              status={data.capabilities.payouts_paused
                ? "paused"
                : data.capabilities.payouts
                ? "enabled"
                : "setup_required"}
            />
          </div>
          <button
            className="studio-text-button"
            onClick={() => onSection("settings")}
          >
            Open settings <ArrowRight size={16} />
          </button>
        </Surface>
      </div>
      {data.health && (
        <Surface
          title="Verification workload"
          description="Current queue and server limits. Waiting for a future final check does not block new claims."
        >
          <div className="studio-admin-metrics">
            {[["Due now", data.health.due_checks], [
              "Running",
              data.health.running_checks,
            ], ["Needs review", data.health.attention_checks]].map((
              [label, value],
            ) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value.toLocaleString()}</strong>
              </div>
            ))}
          </div>
          <div className="studio-summary-line">
            <span>Oldest check due</span>
            <strong>
              {data.health.oldest_due_at
                ? formatDate(data.health.oldest_due_at, true)
                : "None waiting"}
            </strong>
          </div>
          <p className="studio-small">
            New claims wait when {data.health.limits.claim_queue_limit}{" "}
            checks are due or running. Each scan is limited to{" "}
            {data.health.limits.max_scan_pages} pages and{" "}
            {data.health.limits.max_scan_minutes}{" "}
            minutes; incomplete evidence goes to review.
          </p>
          <button
            className="studio-text-button"
            onClick={() => onSection("checks")}
          >
            Open verification queue <ArrowRight size={16} />
          </button>
        </Surface>
      )}
    </>
  );
}
function ServiceRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="studio-admin-row">
      <div>
        <strong>{label}</strong>
      </div>
      <StatusPill status={ready ? "configured" : "setup_required"} />
    </div>
  );
}

type Save = (
  action: string,
  payload: Record<string, unknown>,
  message: string,
) => Promise<void>;
const moneyFields = [
  ["follow_reward_kobo", "Worker reward · follow", 0, 1_000_000],
  ["follow_fee_kobo", "RealReach fee · follow", 0, 1_000_000],
  ["comment_reward_kobo", "Worker reward · comment", 0, 1_000_000],
  ["comment_fee_kobo", "RealReach fee · comment", 0, 1_000_000],
  ["minimum_withdrawal_kobo", "Minimum withdrawal", 100, 1_000_000],
  ["withdrawal_fee_kobo", "Customer withdrawal fee", 0, 10_000],
] as const;
const integerFields = [
  ["retention_hours", "Final check after · hours", 1, 168],
  ["claim_minutes", "Time to submit · minutes", 5, 1440],
  ["max_campaign_quantity", "Maximum campaign quantity", 1, 100_000],
] as const;
type SettingsFields =
  | typeof moneyFields[number][0]
  | typeof integerFields[number][0];
type DraftSettings = Record<SettingsFields, string> & {
  terms_version: string;
  approved: boolean;
  payouts_paused: boolean;
};

function Settings(
  { initial, onSave }: { initial: AdminSettings; onSave: Save },
) {
  const [draft, setDraft] = useState<DraftSettings>(() => ({
    ...Object.fromEntries(
      moneyFields.map(([key]) => [key, (initial[key] / 100).toFixed(2)]),
    ),
    ...Object.fromEntries(
      integerFields.map(([key]) => [key, String(initial[key])]),
    ),
    terms_version: initial.terms_version,
    approved: initial.approved,
    payouts_paused: initial.payouts_paused,
  } as DraftSettings));
  const [proposed, setProposed] = useState<AdminSettings | null>(null),
    [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const update = (key: SettingsFields, value: string) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  function review(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const settings = {
        ...initial,
        approved: draft.approved,
        payouts_paused: draft.payouts_paused,
        terms_version: draft.terms_version.trim(),
      };
      for (const [key, , min, max] of moneyFields) {
        const value = draft[key];
        if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
          throw new Error(
            "Use a naira amount with no more than two decimal places.",
          );
        }
        const [whole, cents = ""] = value.split(".");
        const kobo = Number(whole) * 100 + Number(cents.padEnd(2, "0"));
        if (
          !Number.isSafeInteger(kobo) || kobo < min * 100 || kobo > max * 100
        ) throw new Error("One of the amounts is outside its allowed range.");
        settings[key] = kobo;
      }
      for (const [key, , min, max] of integerFields) {
        const value = Number(draft[key]);
        if (!Number.isInteger(value) || value < min || value > max) {
          throw new Error("Check the time limits and maximum quantity.");
        }
        settings[key] = value;
      }
      if (!settings.terms_version || settings.terms_version.length > 80) {
        throw new Error("Add a short terms version, such as a release date.");
      }
      if (
        settings.approved &&
        (!settings.follow_reward_kobo || !settings.comment_reward_kobo)
      ) {
        throw new Error(
          "Set a worker reward for both actions before approving campaign pricing.",
        );
      }
      setAcknowledged(false);
      setProposed(settings);
    } catch (cause) {
      setError(friendlyError(cause));
    }
  }
  async function confirm() {
    if (!proposed || !acknowledged || busy) return;
    setBusy(true);
    setError("");
    try {
      await onSave(
        "admin-settings",
        { settings: proposed },
        "Settings saved. Existing campaign terms are unchanged.",
      );
      setProposed(null);
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Surface
        title="Prices & operating limits"
        description="Amounts below are in naira. Saved settings apply to new quotes and requests."
      >
        <form className="studio-admin-settings" onSubmit={review}>
          {moneyFields.map(([key, label, min, max]) => (
            <label className="studio-field" key={key}>
              {label} (₦)<input
                type="number"
                inputMode="decimal"
                min={min}
                max={max}
                step="0.01"
                required
                value={draft[key]}
                onChange={(event) =>
                  update(key, event.target.value)}
              />
            </label>
          ))}
          {integerFields.map(([key, label, min, max]) => (
            <label className="studio-field" key={key}>
              {label}
              <input
                type="number"
                inputMode="numeric"
                min={min}
                max={max}
                step="1"
                required
                value={draft[key]}
                onChange={(event) =>
                  update(key, event.target.value)}
              />
            </label>
          ))}
          <label className="studio-field">
            Current terms version<input
              readOnly
              value={initial.terms_version}
            />
            <span className="studio-small">
              A new version is created automatically when you save.
            </span>
          </label>
          <label className="studio-check">
            <input
              type="checkbox"
              checked={draft.approved}
              onChange={(event) =>
                setDraft((previous) => ({
                  ...previous,
                  approved: event.target.checked,
                }))}
            />
            <span>Approve these rates for new campaigns.</span>
          </label>
          <label className="studio-check">
            <input
              type="checkbox"
              checked={draft.payouts_paused}
              onChange={(event) =>
                setDraft((previous) => ({
                  ...previous,
                  payouts_paused: event.target.checked,
                }))}
            />
            <span>Pause new withdrawal requests.</span>
          </label>
          <div className="studio-note">
            <Settings2 size={19} />
            <span>
              Include provider costs in your rate decision. Changing these
              settings does not fund a wallet, confirm a payment or change a
              published campaign.
            </span>
          </div>
          <SubmitButton>Review changes</SubmitButton>
        </form>
        {!proposed ? <Feedback error={error} /> : null}
      </Surface>
      <Modal
        open={!!proposed}
        onClose={() => {
          if (!busy) setProposed(null);
        }}
        title="Confirm operating settings"
        description="These changes take effect for new customer requests after saving."
      >
        {proposed
          ? (
            <>
              <div className="studio-admin-row">
                <div>
                  <strong>Follow price</strong>
                  <small>
                    Worker {formatMoney(proposed.follow_reward_kobo, true)}{" "}
                    + RealReach {formatMoney(proposed.follow_fee_kobo, true)}
                  </small>
                </div>
                <strong>
                  {formatMoney(
                    proposed.follow_reward_kobo + proposed.follow_fee_kobo,
                    true,
                  )}
                </strong>
              </div>
              <div className="studio-admin-row">
                <div>
                  <strong>Comment price</strong>
                  <small>
                    Worker {formatMoney(proposed.comment_reward_kobo, true)}
                    {" "}
                    + RealReach {formatMoney(proposed.comment_fee_kobo, true)}
                  </small>
                </div>
                <strong>
                  {formatMoney(
                    proposed.comment_reward_kobo + proposed.comment_fee_kobo,
                    true,
                  )}
                </strong>
              </div>
              <div className="studio-admin-row">
                <div>
                  <strong>Campaign pricing</strong>
                  <small>
                    {proposed.retention_hours}-hour final check ·{" "}
                    {proposed.claim_minutes} minutes to submit
                  </small>
                </div>
                <StatusPill
                  status={proposed.approved ? "approved" : "not_approved"}
                />
              </div>
              <div className="studio-admin-row">
                <div>
                  <strong>New withdrawals</strong>
                  <small>
                    Minimum {formatMoney(proposed.minimum_withdrawal_kobo)}{" "}
                    · fee {formatMoney(proposed.withdrawal_fee_kobo, true)}
                  </small>
                </div>
                <StatusPill
                  status={proposed.payouts_paused ? "paused" : "enabled"}
                />
              </div>
              <label className="studio-check">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                <span>
                  I reviewed the prices, costs and limits, and authorize these
                  changes.
                </span>
              </label>
              <Feedback error={error} />
              <div className="studio-dialog-actions">
                <button
                  className="studio-button secondary"
                  disabled={busy}
                  onClick={() => setProposed(null)}
                >
                  Back
                </button>
                <SubmitButton
                  type="button"
                  busy={busy}
                  disabled={!acknowledged}
                  onClick={() => void confirm()}
                >
                  Save settings
                </SubmitButton>
              </div>
            </>
          )
          : null}
      </Modal>
    </>
  );
}
