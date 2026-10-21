import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Clock3,
  FileCheck2,
  Mail,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { marketplaceRequest } from "./marketplace";
import { friendlyError } from "./client";
import {
  type AdminOperationsData,
  type AdminReconciliation,
  formatDate,
} from "./marketplace.types";
import { Feedback, Modal, SubmitButton } from "./StudioUI";
import "./operations.css";

const stateCopy: Record<string, string> = {
  never_run: "Never run",
  fresh: "Recent",
  stale: "Overdue",
  healthy: "Last run succeeded",
  failed: "Failed",
  clean: "No differences found",
  discrepancy: "Differences found",
  queued: "Queued",
  sending: "Sending",
  retry: "Retry scheduled",
  accepted: "Provider accepted",
  needs_review: "Review required",
  unconfigured: "Not configured",
  superseded: "Replaced",
  unknown: "Needs refresh",
};
const readable = (value: string) => value.replaceAll("_", " ");
const configurationCopy: Record<
  AdminOperationsData["alerting"]["configuration_reason"],
  string
> = {
  ready: "Email transport is configured.",
  missing_key: "The email provider key is missing.",
  missing_sender: "The sender address is missing.",
  invalid_sender: "The sender address needs correcting.",
  missing_recipient: "The alert recipient is missing.",
  invalid_recipient: "The alert recipient needs correcting.",
};
const incidentCopy: Record<string, { label: string; href: string }> = {
  payment_uncertain: {
    label: "Payments with an uncertain outcome",
    href: "/admin/payments?filter=attention",
  },
  payment_stalled: {
    label: "Payments waiting too long",
    href: "/admin/payments?filter=attention",
  },
  payment_missing_reference: {
    label: "Payments missing a provider reference",
    href: "/admin/payments?filter=attention",
  },
  verification_review: {
    label: "Task checks needing review",
    href: "/admin/checks?filter=attention",
  },
  verification_overdue: {
    label: "Task checks past their due time",
    href: "/admin/checks?filter=queued",
  },
  risk_hold: {
    label: "Accounts held for payment review",
    href: "/admin/payments?filter=attention",
  },
  support_waiting: {
    label: "Support cases waiting for a response",
    href: "/admin/cases",
  },
  worker_stale: { label: "Job worker overdue", href: "/admin/checks" },
  reconciliation_discrepancy: {
    label: "Ledger differences to investigate",
    href: "#ops-ledger-findings",
  },
  reconciliation_failed: {
    label: "Ledger check failed",
    href: "#ops-ledger-findings",
  },
  reconciliation_stale: {
    label: "Ledger check overdue",
    href: "#ops-ledger-findings",
  },
};
function Badge({ status }: { status: string }) {
  return (
    <span className={`ops-status ops-status-${status}`}>
      {stateCopy[status] ?? readable(status)}
    </span>
  );
}
function Time(
  { value, empty = "No recorded run" }: {
    value: string | null | undefined;
    empty?: string;
  },
) {
  return value
    ? <time dateTime={value}>{formatDate(value, true)}</time>
    : <span>{empty}</span>;
}
function Run(
  { icon, title, status, time, children }: {
    icon: ReactNode;
    title: string;
    status: string;
    time: string | null | undefined;
    children: ReactNode;
  },
) {
  return (
    <section className="ops-run">
      <div className="ops-run-heading">
        {icon}
        <h3>{title}</h3>
      </div>
      <Badge status={status} />
      <p className="ops-run-time">
        <Clock3 size={13} />
        <Time value={time} />
      </p>
      <p className="ops-run-note">{children}</p>
    </section>
  );
}
function alertCopy(alert: AdminOperationsData["alerts"][number]) {
  if (alert.status === "accepted") {
    return "The email provider accepted this request. Delivery is not confirmed.";
  }
  if (alert.status === "superseded") {
    return "A newer alert replaced this record. This is not evidence of delivery.";
  }
  if (alert.last_outcome === "uncertain") {
    return alert.status === "needs_review"
      ? "The send outcome is unknown. Review the provider record before another attempt."
      : "The send outcome is unknown. A safe retry is scheduled within the recorded window.";
  }
  if (alert.status === "queued") {
    return "The alert is waiting for a sending attempt.";
  }
  if (alert.status === "sending") {
    return "A sending attempt is in progress. No delivery confirmation yet.";
  }
  if (alert.status === "retry") {
    return "The last attempt did not complete. Another attempt is scheduled.";
  }
  return "The alert needs an operator review. Do not assume it reached the inbox.";
}
const findingLabels: Record<
  keyof NonNullable<AdminReconciliation["findings"]>,
  string
> = {
  unbalanced_journals: "Unbalanced journal entries",
  account_mismatches: "Account balance differences",
  campaign_mismatches: "Campaign reserve differences",
  withdrawal_mismatches: "Withdrawal reserve differences",
};

export function AdminOperations({ revision }: { revision: number }) {
  const { user, isAdmin } = useAuth();
  const [reload, setReload] = useState(0),
    [view, setView] = useState<
      {
        owner: string | null;
        data: AdminOperationsData | null;
        loading: boolean;
        error: string;
      }
    >({ owner: null, data: null, loading: true, error: "" });
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(""),
    [notice, setNotice] = useState("");
  const mutation = useRef<AbortController | null>(null);
  const data = view.owner === user?.id ? view.data : null;
  useEffect(() => {
    if (!user || !isAdmin) return;
    const request = new AbortController();
    setView((previous) => ({
      owner: user.id,
      data: previous.owner === user.id ? previous.data : null,
      loading: true,
      error: "",
    }));
    void marketplaceRequest<AdminOperationsData>(
      "admin-operations",
      {},
      request.signal,
      user.id,
    ).then((value) => {
      if (!request.signal.aborted) {
        setView({ owner: user.id, data: value, loading: false, error: "" });
      }
    }).catch((cause) => {
      if (!request.signal.aborted) {
        setView((previous) => ({
          owner: user.id,
          data: previous.owner === user.id ? previous.data : null,
          loading: false,
          error: friendlyError(cause),
        }));
      }
    });
    return () => request.abort();
  }, [user?.id, isAdmin, revision, reload]);
  useEffect(() => () => mutation.current?.abort(), [user?.id]);
  async function reconcile() {
    if (mutation.current || !user || !isAdmin) return;
    const request = new AbortController();
    mutation.current = request;
    setBusy(true);
    setFailure("");
    setNotice("");
    try {
      const result = await marketplaceRequest<
        { reconciliation: AdminReconciliation }
      >(
        "admin-reconcile-run",
        { confirmation: "CHECK LEDGER" },
        request.signal,
        user.id,
      );
      if (request.signal.aborted) return;
      setView((previous) =>
        previous.owner === user.id && previous.data
          ? {
            ...previous,
            data: {
              ...previous.data,
              reconciliation: result.reconciliation,
              reconciliation_status: result.reconciliation.status,
            },
          }
          : previous
      );
      if (result.reconciliation.status === "failed") {
        setFailure(
          "The ledger check did not complete. Retry when the issue is resolved.",
        );
        return;
      }
      setConfirm(false);
      setNotice(
        result.reconciliation.status === "clean"
          ? "Ledger check finished. No differences were found; no funds changed."
          : "Ledger check finished. Differences need investigation; no funds changed.",
      );
      setReload((value) => value + 1);
    } catch (cause) {
      if (!request.signal.aborted) setFailure(friendlyError(cause));
    } finally {
      if (!request.signal.aborted) {
        mutation.current = null;
        setBusy(false);
      }
    }
  }
  if (!isAdmin) return null;
  const latest = data?.alerts[0];
  const incidents = data?.snapshot?.incidents ?? [];
  return (
    <section className="ops-panel" aria-label="Operational health">
      <header className="ops-heading">
        <div>
          <span className="studio-eyebrow">OPERATIONS WATCH</span>
          <h2>Know what needs you.</h2>
          <p>Recorded checks, exceptions and alert attempts.</p>
        </div>
        <button
          className="ops-refresh"
          disabled={view.loading}
          onClick={() => setReload((value) => value + 1)}
          aria-label="Refresh operational health"
        >
          <RefreshCw size={18} className={view.loading ? "studio-spin" : ""} />
        </button>
      </header>
      <div className="ops-body">
        {view.error
          ? (
            <div className="ops-error" role="alert">
              <ShieldAlert size={20} />
              <div>
                <strong>Operational status could not be refreshed.</strong>
                <p>{view.error}</p>
                {data
                  ? (
                    <small>
                      The last loaded results remain below. They may be out of
                      date.
                    </small>
                  )
                  : null}
                <button
                  className="studio-text-button"
                  onClick={() => setReload((value) => value + 1)}
                >
                  Retry operational status<ArrowRight size={14} />
                </button>
              </div>
            </div>
          )
          : null}
        {view.loading && !data
          ? (
            <div className="ops-loading" role="status">
              <span />
              <span />
              <p>Loading operational status…</p>
            </div>
          )
          : null}
        {data
          ? (
            <>
              <div className="ops-summary">
                <span
                  className={`ops-dot ${
                    incidents.length ? "is-attention" : ""
                  }`}
                />
                <div>
                  <strong>
                    {!data.snapshot
                      ? "No monitoring scan recorded"
                      : data.snapshot_status === "stale"
                      ? "Monitoring needs a fresh scan"
                      : incidents.length
                      ? `${incidents.length} ${
                        incidents.length === 1 ? "area needs" : "areas need"
                      } attention`
                      : "No exceptions in the latest scan"}
                  </strong>
                  <small>
                    Scan <Time value={data.snapshot?.collected_at} />
                    {data.snapshot_status === "stale"
                      ? " · results may be out of date"
                      : ""}
                  </small>
                </div>
              </div>
              <div className="ops-run-grid">
                <Run
                  icon={<Activity size={18} />}
                  title="Monitor scan"
                  status={data.snapshot_status}
                  time={data.snapshot?.collected_at}
                >
                  {data.snapshot_status === "never_run"
                    ? "No monitoring scan has been saved yet."
                    : data.snapshot_status === "stale"
                    ? `No scan in the last ${data.thresholds.snapshot_stale_minutes} minutes. Check the scheduled monitor.`
                    : "Latest saved scan. Refresh to check current status."}
                </Run>
                <Run
                  icon={<Clock3 size={18} />}
                  title="Task worker"
                  status={data.worker.status}
                  time={data.worker.last_seen_at}
                >
                  {data.worker.status === "never_run"
                    ? "No job-run heartbeat has been recorded."
                    : data.worker.last_error
                    ? `Last recorded error: ${data.worker.last_error}`
                    : data.worker.status === "unknown"
                    ? `A fresh monitoring scan is needed. Last recorded run: ${data.worker.processed.toLocaleString()} jobs.`
                    : `${data.worker.processed.toLocaleString()} jobs processed in the last recorded run.`}
                </Run>
                <Run
                  icon={<FileCheck2 size={18} />}
                  title="Ledger check"
                  status={data.reconciliation_status}
                  time={data.reconciliation?.checked_at}
                >
                  {data.reconciliation?.error
                    ? "The last ledger check did not complete."
                    : "Checks ledger balances and reserved funds. Does not move or repair money."}
                </Run>
                <Run
                  icon={<Mail size={18} />}
                  title="Email alerts"
                  status={!data.alerting.configured
                    ? "unconfigured"
                    : latest?.status ?? "never_run"}
                  time={latest?.last_attempt_at ?? latest?.created_at}
                >
                  {!data.alerting.configured
                    ? `${
                      configurationCopy[data.alerting.configuration_reason]
                    } Do not rely on email alerts.`
                    : latest
                    ? alertCopy(latest)
                    : "Email transport is configured. No alert attempt has been recorded."}
                </Run>
              </div>
              {incidents.length
                ? (
                  <div className="ops-incidents">
                    <h3>Latest scan findings</h3>
                    {incidents.map((item) => {
                      const copy = incidentCopy[item.code];
                      return (
                        <a
                          className="ops-incident"
                          key={item.code}
                          href={copy?.href ?? "/admin/audit"}
                        >
                          <ShieldAlert size={16} />
                          <span>{copy?.label ?? readable(item.code)}</span>
                          <strong>{item.count.toLocaleString()}</strong>
                          <ArrowRight size={14} />
                        </a>
                      );
                    })}
                  </div>
                )
                : null}
              <nav
                className="ops-shortcuts"
                aria-label="Investigate operational issues"
              >
                <Link to="/admin/checks?filter=attention">
                  {data.snapshot
                    ? `${data.snapshot.counts.review_checks} review checks`
                    : "Review checks"}
                  <ArrowRight size={14} />
                </Link>
                <Link to="/admin/payments?filter=attention">
                  {data.snapshot
                    ? `${data.snapshot.counts.uncertain_payments} uncertain payments`
                    : "Review payments"}
                  <ArrowRight size={14} />
                </Link>
                <Link to="/admin/cases?filter=open">
                  {data.snapshot
                    ? `${data.snapshot.counts.support_open} open cases`
                    : "Open cases"}
                  <ArrowRight size={14} />
                </Link>
              </nav>
              {data.reconciliation
                ? (
                  <details
                    id="ops-ledger-findings"
                    className="ops-details"
                    open={data.reconciliation.status === "discrepancy"}
                  >
                    <summary>
                      Latest ledger findings<Badge
                        status={data.reconciliation_status}
                      />
                    </summary>
                    {data.reconciliation.findings
                      ? (
                        <dl>
                          {(Object.entries(findingLabels) as [
                            keyof NonNullable<AdminReconciliation["findings"]>,
                            string,
                          ][]).map(([field, label]) => (
                            <div key={field}>
                              <dt>{label}</dt>
                              <dd>
                                {data.reconciliation!.findings![field]
                                  .toLocaleString()}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )
                      : <p>No comparison results were recorded.</p>}
                    <p>
                      Recorded{" "}
                      <Time value={data.reconciliation.checked_at} />. These
                      findings do not authorise a refund, payout or balance
                      adjustment.
                    </p>
                  </details>
                )
                : null}
              {latest
                ? (
                  <details className="ops-details">
                    <summary>
                      Latest alert<Badge status={latest.status} />
                    </summary>
                    <p>{alertCopy(latest)}</p>
                    <dl>
                      <div>
                        <dt>Attempts</dt>
                        <dd>{latest.attempts}</dd>
                      </div>
                      <div>
                        <dt>Created</dt>
                        <dd>
                          <Time value={latest.created_at} />
                        </dd>
                      </div>
                      <div>
                        <dt>Last attempt</dt>
                        <dd>
                          <Time
                            value={latest.last_attempt_at}
                            empty="Not attempted"
                          />
                        </dd>
                      </div>
                      <div>
                        <dt>Retry window ends</dt>
                        <dd>
                          <Time
                            value={latest.retry_until}
                            empty="Not scheduled"
                          />
                        </dd>
                      </div>
                      {latest.error_code
                        ? (
                          <div>
                            <dt>Recorded issue</dt>
                            <dd>{readable(latest.error_code)}</dd>
                          </div>
                        )
                        : null}
                    </dl>
                  </details>
                )
                : null}
              <Feedback message={notice} />
              <footer className="ops-footer">
                <span>
                  Viewed <Time value={data.checked_at} />
                </span>
                <button
                  className="studio-button secondary"
                  onClick={() => {
                    setConfirm(true);
                    setFailure("");
                  }}
                >
                  Check ledger<FileCheck2 size={16} />
                </button>
              </footer>
            </>
          )
          : null}
      </div>
      <Modal
        open={confirm}
        onClose={() => {
          if (!busy) setConfirm(false);
        }}
        title="Run a ledger check?"
        description="This compares saved balances, journal entries and reserved funds."
      >
        <p className="ops-confirm-note">
          Findings are recorded for investigation. This does not change
          balances, send payments, issue refunds or release account holds.
        </p>
        <Feedback error={failure} />
        <div className="studio-dialog-actions">
          <button
            className="studio-button secondary"
            disabled={busy}
            onClick={() => setConfirm(false)}
          >
            Cancel
          </button>
          <SubmitButton busy={busy} onClick={() => void reconcile()}>
            Run read-only check
          </SubmitButton>
        </div>
      </Modal>
    </section>
  );
}
