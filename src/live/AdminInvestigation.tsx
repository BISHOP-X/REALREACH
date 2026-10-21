import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileClock,
  Headphones,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { friendlyError } from "./client";
import { marketplaceRequest } from "./marketplace";
import {
  type AdminAudit,
  type AdminCampaignDetail,
  type AdminCase,
  type AdminCheck,
  type AdminHistoryKind,
  type AdminPayment,
  type AdminPaymentDetail,
  type AdminPaymentRecovery,
  type AdminTaskDetail,
  formatDate,
  formatMoney,
} from "./marketplace.types";
import {
  AsyncState,
  EmptyPanel,
  Feedback,
  Modal,
  StatusPill,
  SubmitButton,
  Surface,
} from "./StudioUI";
import "./admin.css";

export type AdminResource = "cases" | "checks" | "payments" | "audit";
type Row = AdminCase | AdminCheck | AdminPayment | AdminAudit;
type Page = { items: Row[]; next_cursor: string | null };
export type AdminSave = (
  action: string,
  payload: Record<string, unknown>,
  message: string,
) => Promise<void>;
const readable = (value: string) =>
  value.replaceAll("_", " ").replaceAll("-", " ");
function caseDestination(item: AdminCase) {
  const related = item.related_record;
  if (!related) return null;
  const paths = { payment: "payments", task: "tasks", campaign: "campaigns" };
  return `/admin/${paths[related.resource]}/${encodeURIComponent(related.id)}`;
}
const resources = {
  cases: {
    title: "Customer cases",
    description: "Follow the issue to its source, then leave a clear response.",
    search: "Search case subjects",
    filters: ["all", "open", "in_review", "resolved"],
    empty: "No cases found.",
    icon: Headphones,
  },
  checks: {
    title: "Verification & payment checks",
    description:
      "Investigate delayed checks. Retrying checks the evidence again; it never approves work.",
    search: "Search a reason or record ID",
    filters: ["all", "attention", "queued", "running", "done"],
    empty: "No checks found.",
    icon: Activity,
  },
  payments: {
    title: "Payments & withdrawals",
    description:
      "Follow every collection and withdrawal from its original reference to its confirmed outcome.",
    search: "Search payment references",
    filters: [
      "all",
      "attention",
      "payout",
      "collection",
      "succeeded",
      "failed",
    ],
    empty: "No payments found.",
    icon: Wallet,
  },
  audit: {
    title: "Activity history",
    description:
      "The recorded trail of account decisions and administrative actions.",
    search: "Search activity names",
    filters: ["all"],
    empty: "No activity found.",
    icon: FileClock,
  },
} as const;

function useAdminList(
  resource: AdminResource,
  filter: string,
  query: string,
  revision: number,
) {
  const { user } = useAuth();
  const [search, setSearch] = useState(query.trim());
  const [page, setPage] = useState<Page & { scope: string | null }>({
    scope: null,
    items: [],
    next_cursor: null,
  });
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const generation = useRef(0),
    busy = useRef(false),
    controller = useRef<AbortController | null>(null);
  const scope = JSON.stringify([user?.id, resource, filter, search]);
  const requestedScope = JSON.stringify([
    user?.id,
    resource,
    filter,
    query.trim(),
  ]);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const load = useCallback(async (cursor?: string) => {
    if (!user || busy.current) return;
    const current = generation.current, request = new AbortController();
    controller.current = request;
    busy.current = true;
    setLoading(true);
    setError("");
    setPage((previous) =>
      previous.scope === scope
        ? previous
        : { scope, items: [], next_cursor: null }
    );
    try {
      const next = await marketplaceRequest<Page>(
        "admin-list",
        { resource, filter, query: search, ...(cursor ? { cursor } : {}) },
        request.signal,
        user.id,
      );
      if (current === generation.current) {
        setPage((previous) => ({
          scope,
          items: cursor && previous.scope === scope
            ? [
              ...new Map(
                [...previous.items, ...next.items].map(
                  (item) => [item.id, item],
                ),
              ).values(),
            ]
            : next.items,
          next_cursor: next.next_cursor,
        }));
      }
    } catch (cause) {
      if (current === generation.current && !request.signal.aborted) {
        setError(friendlyError(cause));
      }
    } finally {
      if (current === generation.current) {
        busy.current = false;
        controller.current = null;
        setLoading(false);
      }
    }
  }, [user?.id, resource, filter, search, scope]);
  useEffect(() => {
    generation.current++;
    busy.current = false;
    setPage({ scope, items: [], next_cursor: null });
    void load();
    return () => {
      generation.current++;
      controller.current?.abort();
    };
  }, [load, revision, scope]);
  const current = page.scope === requestedScope;
  return {
    items: current ? page.items : [],
    next_cursor: current ? page.next_cursor : null,
    loading: !current || loading,
    error: current ? error : "",
    retry: () => void load(page.next_cursor ?? undefined),
    loadMore: () => {
      if (current && page.next_cursor) void load(page.next_cursor);
    },
  };
}

export function AdminQueue(
  { resource, revision, onSave }: {
    resource: AdminResource;
    revision: number;
    onSave: AdminSave;
  },
) {
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("query") ?? ""),
    [filter, setFilter] = useState(() => {
      const requested = params.get("filter") ?? "all";
      return resources[resource].filters.some(value=>value===requested)
        ? requested
        : "all";
    });
  const [retry, setRetry] = useState(0),
    [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState("");
  const [selected, setSelected] = useState<AdminCase | null>(null),
    [status, setStatus] = useState<AdminCase["status"]>("in_review"),
    [response, setResponse] = useState("");
  const list = useAdminList(resource, filter, query, revision + retry),
    copy = resources[resource];
  function review(item: AdminCase) {
    setSelected(item);
    setStatus(item.status === "open" ? "in_review" : item.status);
    setResponse(item.resolution ?? "");
    setError("");
  }
  async function saveCase(event: FormEvent) {
    event.preventDefault();
    if (!selected || busy) return;
    setBusy(selected.id);
    setError("");
    try {
      await onSave("admin-case", {
        id: selected.id,
        status,
        resolution: response.trim(),
      }, "Response saved. This does not change any payment or task result.");
      setSelected(null);
      setRetry((value) => value + 1);
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(null);
    }
  }
  async function retryCheck(id: string) {
    if (busy) return;
    setBusy(id);
    setError("");
    try {
      await onSave(
        "admin-retry",
        { id },
        "Check returned to the queue. No payment was approved.",
      );
      setRetry((value) => value + 1);
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="admin-investigation">
      <div className="admin-queue-intro">
        <div>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <span className="admin-record-count">
          {list.items.length}{" "}
          loaded{list.next_cursor ? " · more available" : ""}
        </span>
      </div>
      <div className="admin-queue-tools">
        <label className="studio-search">
          <Search size={18} />
          <input
            type="search"
            aria-label={copy.search}
            placeholder={copy.search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {copy.filters.length > 1
          ? (
            <label className="admin-filter">
              Show<select
                aria-label={`Filter ${resource}`}
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                {copy.filters.map((value) => (
                  <option key={value} value={value}>
                    {value === "all" ? "All records" : readable(value)}
                  </option>
                ))}
              </select>
            </label>
          )
          : null}
      </div>
      {!selected && <Feedback error={error} />}
      <AsyncState
        loading={list.loading && !list.items.length}
        error={!list.items.length ? list.error : ""}
        onRetry={() => setRetry((value) => value + 1)}
      >
        {list.items.length
          ? (
            <div className="admin-queue">
              {list.items.map((row) => (
                <QueueRow
                  key={row.id}
                  resource={resource}
                  row={row}
                  busy={busy}
                  onReview={review}
                  onRetry={retryCheck}
                />
              ))}
            </div>
          )
          : (
            <EmptyPanel
              icon={copy.icon}
              title={copy.empty}
              description={query || filter !== "all"
                ? "Try another search or show all records."
                : "Records appear here as customers use RealReach."}
            />
          )}
        {list.items.length > 0
          ? (
            <div className="admin-more">
              <p>
                Showing {list.items.length} records. {list.next_cursor
                  ? "Load the next page to continue."
                  : "You’ve reached the end of this list."}
              </p>
              {list.next_cursor
                ? (
                  <button
                    className="studio-button secondary"
                    disabled={list.loading}
                    onClick={list.loadMore}
                  >
                    {list.loading ? "Loading…" : `Load more ${resource}`}
                    <ArrowRight size={16} />
                  </button>
                )
                : null}
            </div>
          )
          : null}
        {list.items.length > 0 && list.error
          ? (
            <>
              <Feedback error={list.error} />
              <button className="studio-text-button" onClick={list.retry}>
                Retry loading records <RefreshCw size={15} />
              </button>
            </>
          )
          : null}
      </AsyncState>
      <Modal
        open={!!selected}
        onClose={() => {
          if (!busy) setSelected(null);
        }}
        title={selected?.subject || "Review case"}
        description={selected?.reference
          ? `Reference: ${selected.reference}`
          : "Customer support request"}
      >
        {selected
          ? (
            <form className="studio-form" onSubmit={saveCase}>
              <p className="admin-brief">{selected.message}</p>
              {caseDestination(selected)
                ? (
                  <Link
                    className="studio-text-button"
                    to={caseDestination(selected)!}
                    onClick={() => setSelected(null)}
                  >
                    Open linked {selected.related_record?.resource}{" "}
                    <ArrowUpRight size={15} />
                  </Link>
                )
                : selected.reference
                ? (
                  <p className="admin-action-notice">
                    {selected.reference_resolution === "ambiguous"
                      ? "This reference matches more than one record. Ask the customer to clarify it."
                      : "No matching record is available for this customer. Confirm the reference before acting."}
                  </p>
                )
                : null}
              <label className="studio-field">
                Status<select
                  aria-label="Case status"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as AdminCase["status"])}
                >
                  <option value="open">Open</option>
                  <option value="in_review">In review</option>
                  <option value="resolved">Resolved</option>
                </select>
              </label>
              <label className="studio-field">
                Response to the customer<textarea
                  rows={5}
                  maxLength={2000}
                  minLength={status === "resolved" ? 5 : undefined}
                  required={status === "resolved"}
                  value={response}
                  onChange={(event) => setResponse(event.target.value)}
                  placeholder="Explain what you checked and what happens next."
                />
              </label>
              <p className="studio-small">
                A case response does not move money, remove a review hold or
                approve work.
              </p>
              <Feedback error={error} />
              <div className="studio-dialog-actions">
                <button
                  type="button"
                  className="studio-button secondary"
                  disabled={!!busy}
                  onClick={() => setSelected(null)}
                >
                  Cancel
                </button>
                <SubmitButton busy={!!busy}>Save response</SubmitButton>
              </div>
            </form>
          )
          : null}
      </Modal>
    </div>
  );
}

function QueueRow(
  { resource, row, busy, onReview, onRetry }: {
    resource: AdminResource;
    row: Row;
    busy: string | null;
    onReview: (item: AdminCase) => void;
    onRetry: (id: string) => Promise<void>;
  },
) {
  if (resource === "cases") {
    const item = row as AdminCase;
    return (
      <article className="admin-queue-row">
        <span className="admin-row-symbol">
          <Headphones size={19} />
        </span>
        <div className="admin-row-copy">
          <h3>{item.subject}</h3>
          <div className="admin-row-meta">
            <span>{item.owner?.display_name || "Customer case"}</span>
            <time dateTime={item.created_at}>
              {formatDate(item.created_at, true)}
            </time>
          </div>
          {item.reference
            ? (
              <p>
                <code>{item.reference}</code>
              </p>
            )
            : null}
        </div>
        <div className="admin-row-actions">
          <StatusPill status={item.status} />
          <button
            className="studio-button secondary"
            onClick={() => onReview(item)}
          >
            Review <ArrowRight size={15} />
          </button>
        </div>
      </article>
    );
  }
  if (resource === "checks") {
    const item = row as AdminCheck,
      href = item.payment_id
        ? `/admin/payments/${item.payment_id}`
        : item.assignment_id
        ? `/admin/tasks/${item.assignment_id}`
        : null;
    return (
      <article className="admin-queue-row">
        <span
          className={`admin-row-symbol ${
            item.state === "attention" ? "attention" : ""
          }`}
        >
          <Clock3 size={19} />
        </span>
        <div className="admin-row-copy">
          <h3>{readable(item.phase)}</h3>
          <p>{item.reason || `Next check ${formatDate(item.due_at, true)}`}</p>
          <div className="admin-row-meta">
            <span>{item.attempts} attempts</span>
            <span>{item.scanned_pages ?? 0} pages checked</span>
            <code>{item.id.slice(0, 8)}</code>
          </div>
        </div>
        <div className="admin-row-actions">
          <StatusPill status={item.state} />
          {href
            ? (
              <Link className="studio-button secondary" to={href}>
                Investigate <ArrowRight size={15} />
              </Link>
            )
            : item.state === "attention"
            ? (
              <button
                className="studio-button secondary"
                disabled={!!busy}
                onClick={() => void onRetry(item.id)}
              >
                {busy === item.id ? "Queuing…" : "Retry check"}
                <RefreshCw size={15} />
              </button>
            )
            : null}
        </div>
      </article>
    );
  }
  if (resource === "payments") {
    const item = row as AdminPayment;
    return (
      <article className="admin-queue-row">
        <span
          className={`admin-row-symbol ${item.risk_held ? "attention" : ""}`}
        >
          <Wallet size={19} />
        </span>
        <div className="admin-row-copy">
          <h3>
            {formatMoney(item.amount_kobo, true)}{" "}
            <span className="studio-small">
              · {item.direction === "payout" ? "Withdrawal" : "Wallet top-up"}
            </span>
          </h3>
          <div className="admin-row-meta">
            <span>{item.owner?.display_name || "Account payment"}</span>
            <time dateTime={item.created_at}>
              {formatDate(item.created_at, true)}
            </time>
          </div>
          <p>
            <code>{item.reference}</code>
          </p>
          {item.risk_held
            ? (
              <p>
                <ShieldAlert size={12} /> Account under review
              </p>
            )
            : null}
        </div>
        <div className="admin-row-actions">
          <StatusPill status={item.status} />
          <Link
            className="studio-button secondary"
            to={`/admin/payments/${item.id}`}
          >
            Investigate <ArrowRight size={15} />
          </Link>
        </div>
      </article>
    );
  }
  const item = row as AdminAudit;
  return (
    <article className="admin-queue-row">
      <span className="admin-row-symbol">
        <FileClock size={19} />
      </span>
      <div className="admin-row-copy">
        <h3>{readable(item.action)}</h3>
        <p>
          <code>{item.reference || "RealReach operations"}</code>
        </p>
        <div className="admin-row-meta">
          <time dateTime={item.created_at}>
            {formatDate(item.created_at, true)}
          </time>
          {item.actor_id
            ? <span>Actor {item.actor_id.slice(0, 8)}</span>
            : null}
        </div>
      </div>
    </article>
  );
}

function Fact(
  { label, children, wide = false }: {
    label: string;
    children: ReactNode;
    wide?: boolean;
  },
) {
  return (
    <div className={`admin-fact ${wide ? "wide" : ""}`}>
      <dt>{label}</dt>
      <dd>{children || "—"}</dd>
    </div>
  );
}
function AuditTrail({ records }: { records: AdminAudit[] }) {
  return records.length
    ? (
      <ol className="admin-timeline">
        {records.map((item) => (
          <li key={item.id}>
            <span className="admin-timeline-dot" />
            <div>
              <strong>{readable(item.action)}</strong>
              <time dateTime={item.created_at}>
                {formatDate(item.created_at, true)}
              </time>
              {item.reference ? <p>{item.reference}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    )
    : (
      <p className="admin-record-empty">
        No administrative activity recorded for this item.
      </p>
    );
}
function RelatedCases({ cases }: { cases: AdminCase[] }) {
  return cases.length
    ? (
      <div className="admin-record-links">
        {cases.map((item) => (
          <Link
            key={item.id}
            className="admin-record-link"
            to={`/admin/cases?query=${encodeURIComponent(item.subject)}`}
          >
            <span>
              <strong>{item.subject}</strong>
              <small>
                {readable(item.status)} · {formatDate(item.created_at, true)}
              </small>
            </span>
            <ArrowRight size={16} />
          </Link>
        ))}
      </div>
    )
    : <p className="admin-record-empty">No linked support cases.</p>;
}
function CheckHistory({ jobs }: { jobs: AdminCheck[] }) {
  return jobs.length
    ? (
      <ol className="admin-timeline">
        {jobs.map((job) => (
          <li key={job.id}>
            <span className="admin-timeline-dot" />
            <div>
              <strong>{readable(job.phase)} · {readable(job.state)}</strong>
              <time dateTime={job.due_at}>
                Due {formatDate(job.due_at, true)} · {job.attempts} attempts
              </time>
              <p>{job.reason || "No exception recorded."}</p>
            </div>
          </li>
        ))}
      </ol>
    )
    : (
      <p className="admin-record-empty">
        No scheduled checks for this record.
      </p>
    );
}

function AdminHistory<T extends { id: string } | { event_hash: string }>(
  { resource, id, history, initialItems, nextCursor, children }: {
    resource: "payment" | "task" | "campaign";
    id: string;
    history: AdminHistoryKind;
    initialItems: T[];
    nextCursor?: string | null;
    children: (items: T[]) => ReactNode;
  },
) {
  const { user } = useAuth();
  const [items, setItems] = useState(initialItems),
    [cursor, setCursor] = useState(nextCursor ?? null);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function more() {
    if (active.current || !cursor) return;
    const request = new AbortController();
    active.current = request;
    setLoading(true);
    setError("");
    try {
      const page = await marketplaceRequest<
        { items: T[]; next_cursor: string | null }
      >(
        "admin-history",
        { resource, id, history, cursor },
        request.signal,
        user?.id,
      );
      if (request.signal.aborted) return;
      setItems((previous) => {
        const key = (item: T) => "id" in item ? item.id : item.event_hash;
        const seen = new Set(previous.map(key));
        return [
          ...previous,
          ...page.items.filter((item) => !seen.has(key(item))),
        ];
      });
      setCursor(page.next_cursor);
    } catch (cause) {
      if (!request.signal.aborted) setError(friendlyError(cause));
    } finally {
      if (!request.signal.aborted) {
        active.current = null;
        setLoading(false);
      }
    }
  }
  const label = {
    jobs: "checks",
    evidence: "evidence",
    cases: "linked cases",
    audit: "activity",
    events: "provider discrepancies",
  }[history];
  return (
    <>
      {children(items)}
      {error ? <Feedback error={error} /> : null}
      {cursor
        ? (
          <button
            className="studio-button secondary admin-history-more"
            disabled={loading}
            onClick={() => void more()}
          >
            {loading ? "Loading…" : `Load older ${label}`}
            <ArrowLeft size={15} />
          </button>
        )
        : null}
    </>
  );
}

export function AdminRecord(
  { resource, id, revision }: {
    resource: "payment" | "task" | "campaign";
    id: string;
    revision: number;
  },
) {
  const { user } = useAuth();
  const [record, setData] = useState<
      AdminPaymentDetail | AdminTaskDetail | AdminCampaignDetail | null
    >(
      null,
    ),
    [recordKey, setRecordKey] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [reload, setReload] = useState(0),
    [modal, setModal] = useState<"recheck" | "recover" | "close" | null>(null),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState("");
  const [reference, setReference] = useState(""),
    [reason, setReason] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [notice, setNotice] = useState("");
  const [recovery, setRecovery] = useState<AdminPaymentRecovery | null>(null);
  const controller = useRef<AbortController | null>(null),
    generation = useRef(0);
  const key = `${user?.id}:${resource}:${id}:${revision}:${reload}`;
  const data = recordKey === key ? record : null;
  useEffect(() => {
    const request = new AbortController();
    let alive = true;
    setLoading(true);
    setError("");
    setData(null);
    void marketplaceRequest<
      AdminPaymentDetail | AdminTaskDetail | AdminCampaignDetail
    >(
      "admin-detail",
      { resource, id },
      request.signal,
      user?.id,
    ).then((value) => {
      if (alive) {
        setData(value);
        setRecordKey(key);
      }
    }).catch((cause) => {
      if (alive && !request.signal.aborted) setError(friendlyError(cause));
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
      request.abort();
    };
  }, [resource, id, user?.id, revision, reload, key]);
  useEffect(() => {
    generation.current++;
    return () => {
      generation.current++;
      controller.current?.abort();
    };
  }, [resource, id, user?.id]);
  function open(value: "recheck" | "recover" | "close") {
    setModal(value);
    setActionError("");
    setRecovery(null);
    setReference("");
    setReason("");
    setConfirmation("");
    setReviewed(false);
    setNotice("");
  }
  async function act(action: string, payload: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setActionError("");
    const current = generation.current, request = new AbortController();
    controller.current = request;
    try {
      const result = await marketplaceRequest<
        AdminPaymentRecovery | { id: string }
      >(action, payload, request.signal, user?.id);
      if (current !== generation.current) return;
      if (action === "admin-payment-recheck") {
        setRecovery(result as AdminPaymentRecovery);
      } else {
        setModal(null);
        setNotice(
          action === "admin-assignment-close"
            ? "Task closed without payment. The recorded decision is shown below."
            : "Check returned to the queue. No payment was approved.",
        );
      }
      setReload((value) => value + 1);
    } catch (cause) {
      if (current === generation.current) setActionError(friendlyError(cause));
    } finally {
      if (current === generation.current) {
        setBusy(false);
        controller.current = null;
      }
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (modal === "close") {
      if (
        !reviewed || confirmation !== "CLOSE WITHOUT PAYMENT" ||
        reason.trim().length < 10
      ) return;
      void act("admin-assignment-close", {
        id,
        reason: reason.trim(),
        confirmation,
      });
    } else {void act("admin-payment-recheck", {
        id,
        ...(modal === "recover"
          ? { provider_reference: reference.trim() }
          : {}),
      });}
  }
  const payment = resource === "payment"
      ? data as AdminPaymentDetail | null
      : null,
    task = resource === "task" ? data as AdminTaskDetail | null : null,
    campaign = resource === "campaign"
      ? data as AdminCampaignDetail | null
      : null;
  return (
    <div className="admin-investigation">
      <Link
        className="studio-text-button admin-detail-back"
        to={resource === "payment"
          ? "/admin/payments"
          : resource === "campaign"
          ? "/admin/cases"
          : "/admin/checks"}
      >
        <ArrowLeft size={15} /> Back to {resource === "payment"
          ? "payments"
          : resource === "campaign"
          ? "cases"
          : "checks"}
      </Link>
      <Feedback message={notice} />
      {!modal && <Feedback error={actionError} />}
      <AsyncState
        loading={loading}
        error={error}
        onRetry={() => setReload((value) => value + 1)}
      >
        {payment
          ? (
            <>
              <section className="admin-dossier">
                <header className="admin-dossier-heading">
                  <div>
                    <span className="studio-eyebrow">
                      {payment.payment.direction === "payout"
                        ? "WITHDRAWAL INVESTIGATION"
                        : "COLLECTION INVESTIGATION"}
                    </span>
                    <h2>{formatMoney(payment.payment.amount_kobo, true)}</h2>
                    <p>
                      {payment.owner?.display_name || "Account payment"} ·{" "}
                      {payment.payment.reference}
                    </p>
                  </div>
                  <div className="admin-dossier-badges">
                    <StatusPill status={payment.payment.status} />
                    {payment.risk_hold ? <StatusPill status="held" /> : null}
                  </div>
                </header>
                <dl className="admin-dossier-grid">
                  <Fact label="RealReach reference" wide>
                    <code>{payment.payment.reference}</code>
                  </Fact>
                  <Fact label="Provider reference" wide>
                    <code>{payment.payment.provider_id || "Not recorded"}</code>
                  </Fact>
                  <Fact label="Customer fee">
                    {formatMoney(payment.payment.fee_kobo, true)}
                  </Fact>
                  <Fact label="Created">
                    {formatDate(payment.payment.created_at, true)}
                  </Fact>
                  <Fact label="Submitted">
                    {formatDate(payment.payment.submitted_at, true)}
                  </Fact>
                  <Fact label="Last checked">
                    {formatDate(payment.payment.checked_at, true)}
                  </Fact>
                  {payment.beneficiary
                    ? (
                      <>
                        <Fact label="Recipient">
                          {payment.beneficiary.account_name}
                        </Fact>
                        <Fact label="Bank account">
                          {payment.beneficiary.bank_name} · ••••{" "}
                          {payment.beneficiary.account_last4}
                        </Fact>
                      </>
                    )
                    : null}
                  <Fact label="Account ID" wide>
                    <code>{payment.owner?.id || payment.payment.owner_id}</code>
                  </Fact>
                </dl>
              </section>
              {payment.risk_hold
                ? (
                  <div className="admin-hold">
                    <ShieldAlert size={21} />
                    <div>
                      <strong>
                        Account under review · money actions restricted
                      </strong>
                      <p>{payment.risk_hold.reason}</p>
                      <small>
                        Recorded{" "}
                        {formatDate(payment.risk_hold.created_at, true)}. A
                        support response or provider recheck does not
                        automatically lift this hold.
                      </small>
                    </div>
                  </div>
                )
                : null}
              <div className="admin-case-layout">
                <div>
                  <Surface
                    title="Payment timeline"
                    description="Saved timestamps and signed discrepancies; no assumed outcomes."
                  >
                    <ol className="admin-timeline">
                      <li>
                        <span className="admin-timeline-dot" />
                        <div>
                          <strong>Request created</strong>
                          <time>
                            {formatDate(payment.payment.created_at, true)}
                          </time>
                        </div>
                      </li>
                      {payment.payment.submitted_at
                        ? (
                          <li>
                            <span className="admin-timeline-dot" />
                            <div>
                              <strong>Submitted to the provider</strong>
                              <time>
                                {formatDate(payment.payment.submitted_at, true)}
                              </time>
                            </div>
                          </li>
                        )
                        : null}
                      {payment.payment.checked_at
                        ? (
                          <li>
                            <span className="admin-timeline-dot" />
                            <div>
                              <strong>
                                Latest saved check ·{" "}
                                {readable(payment.payment.status)}
                              </strong>
                              <time>
                                {formatDate(payment.payment.checked_at, true)}
                              </time>
                            </div>
                          </li>
                        )
                        : null}
                    </ol>
                  </Surface>
                  <Surface title="Provider discrepancies">
                    <AdminHistory
                      key={key + "events"}
                      resource="payment"
                      id={id}
                      history="events"
                      initialItems={payment.events}
                      nextCursor={payment.history_cursors?.events}
                    >
                      {(items) =>
                        items.length
                          ? (
                            <ol className="admin-timeline">
                              {items.map((event) => (
                                <li key={event.event_hash}>
                                  <span className="admin-timeline-dot" />
                                  <div>
                                    <strong>
                                      Provider discrepancy recorded
                                    </strong>
                                    <time>
                                      {formatDate(event.created_at, true)}
                                    </time>
                                    <p>{event.reason}</p>
                                  </div>
                                </li>
                              ))}
                            </ol>
                          )
                          : (
                            <p className="admin-record-empty">
                              No provider discrepancies recorded.
                            </p>
                          )}
                    </AdminHistory>
                  </Surface>
                  <Surface title="Recent checks">
                    <AdminHistory
                      key={key + "jobs"}
                      resource="payment"
                      id={id}
                      history="jobs"
                      initialItems={payment.jobs}
                      nextCursor={payment.history_cursors?.jobs}
                    >
                      {(items) => <CheckHistory jobs={items} />}
                    </AdminHistory>
                  </Surface>
                  <Surface title="Recent linked cases">
                    <AdminHistory
                      key={key + "cases"}
                      resource="payment"
                      id={id}
                      history="cases"
                      initialItems={payment.cases}
                      nextCursor={payment.history_cursors?.cases}
                    >
                      {(items) => <RelatedCases cases={items} />}
                    </AdminHistory>
                  </Surface>
                  <Surface title="Recent administrative activity">
                    <AdminHistory
                      key={key + "audit"}
                      resource="payment"
                      id={id}
                      history="audit"
                      initialItems={payment.audit}
                      nextCursor={payment.history_cursors?.audit}
                    >
                      {(items) => <AuditTrail records={items} />}
                    </AdminHistory>
                  </Surface>
                </div>
                <aside>
                  <Surface
                    title="Review the outcome"
                    description="Confirm the original request. Never send a second transfer to resolve uncertainty."
                  >
                    <div className="admin-action-list">
                      <div className="admin-action-item">
                        <h3>Ask the provider again</h3>
                        <p>
                          Retrieve the latest status for the original payment.
                          Only a matching, confirmed provider result can change
                          the ledger.
                        </p>
                        <button
                          className="studio-button"
                          disabled={!payment.allowed_actions.recheck || busy}
                          onClick={() => open("recheck")}
                        >
                          <RefreshCw size={16} /> Recheck provider
                        </button>
                        {!payment.allowed_actions.recheck
                          ? (
                            <p className="admin-action-notice">
                              This payment cannot be rechecked from its current
                              state.
                            </p>
                          )
                          : null}
                      </div>
                      {!payment.payment.provider_id
                        ? (
                          <div className="admin-action-item">
                            <h3>Missing provider reference?</h3>
                            <p>
                              Find the original request with PocketFi support. A
                              reference or matching amount alone does not prove
                              this payment belongs to this account.
                            </p>
                            <button
                              className="studio-button secondary"
                              disabled={!payment.allowed_actions.recheck ||
                                busy}
                              onClick={() => open("recover")}
                            >
                              Check a recovered reference{" "}
                              <ArrowRight size={15} />
                            </button>
                          </div>
                        )
                        : null}
                    </div>
                    {payment.recovery_note
                      ? (
                        <p className="admin-action-notice">
                          {payment.recovery_note}
                        </p>
                      )
                      : null}
                    <p className="admin-action-notice">
                      <LockKeyhole size={13} />{" "}
                      No manual paid, refund or resend controls.
                    </p>
                  </Surface>
                </aside>
              </div>
            </>
          )
          : task
          ? (
            <>
              <section className="admin-dossier">
                <header className="admin-dossier-heading">
                  <div>
                    <span className="studio-eyebrow">
                      TASK INVESTIGATION /{" "}
                      {task.assignment.action.toUpperCase()}
                    </span>
                    <h2>{task.campaign.title}</h2>
                    <p>
                      {task.worker?.display_name || "Worker"} ·{" "}
                      {task.owner?.display_name || task.campaign.business_name}
                    </p>
                  </div>
                  <div className="admin-dossier-badges">
                    <StatusPill status={task.assignment.status} />
                    <span className="studio-small">
                      Reward {formatMoney(task.assignment.reward_kobo, true)}
                    </span>
                  </div>
                </header>
                <dl className="admin-dossier-grid">
                  <Fact label="Task ID" wide>
                    <code>{task.assignment.id}</code>
                  </Fact>
                  <Fact label="Accepted">
                    {formatDate(task.assignment.created_at, true)}
                  </Fact>
                  <Fact label="Submitted">
                    {formatDate(task.assignment.submitted_at, true)}
                  </Fact>
                  <Fact label="Final check after">
                    {formatDate(task.assignment.hold_until, true)}
                  </Fact>
                  <Fact label="Worker ID" wide>
                    <code>{task.worker?.id || task.assignment.worker_id}</code>
                  </Fact>
                  <Fact label="Worker Instagram">
                    {task.worker_instagram?.username
                      ? (
                        <a
                          className="studio-text-button"
                          href={`https://www.instagram.com/${
                            encodeURIComponent(task.worker_instagram.username)
                          }/`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          @{task.worker_instagram.username}
                          <ArrowUpRight size={14} />
                        </a>
                      )
                      : "Current username unavailable"}
                  </Fact>
                  <Fact label="Linked Instagram ID" wide>
                    <code>
                      {task.worker_instagram?.instagram_id ||
                        "No stable account binding recorded"}
                    </code>
                  </Fact>
                  <Fact label="Business owner ID" wide>
                    <code>{task.owner?.id}</code>
                  </Fact>
                  <Fact label="Campaign ID" wide>
                    <code>{task.campaign.id}</code>
                  </Fact>
                </dl>
              </section>
              {task.assignment.status === "needs_review"
                ? (
                  <div className="admin-hold">
                    <ShieldAlert size={21} />
                    <div>
                      <strong>
                        This task needs a decision, not an automatic payout.
                      </strong>
                      <p>
                        {task.assignment.reason ||
                          "The available checks did not establish a final result."}
                      </p>
                    </div>
                  </div>
                )
                : null}
              {task.closure
                ? (
                  <div className="studio-note">
                    <CheckCircle2 size={20} />
                    <span>
                      <strong>Closed without payment.</strong>{" "}
                      {task.closure.reason}
                      <br />
                      <small>
                        {formatDate(task.closure.created_at, true)}{" "}
                        · Recorded decision {task.closure.id.slice(0, 8)}
                      </small>
                    </span>
                  </div>
                )
                : null}
              <div className="admin-case-layout">
                <div>
                  <Surface
                    title="The agreed task"
                    description="Review the original brief and recorded terms before making a decision."
                  >
                    <p className="admin-brief">
                      {task.assignment.instructions ||
                        task.campaign.instructions ||
                        "Complete the selected action using the connected Instagram account."}
                    </p>
                    <dl className="admin-dossier-grid">
                      <Fact label="Target account">
                        @{task.assignment.target_username ||
                          task.campaign.target_username}
                      </Fact>
                      <Fact label="Reward">
                        {formatMoney(task.assignment.reward_kobo, true)}
                      </Fact>
                      <Fact label="Hold period">
                        {task.campaign.retention_hours} hours
                      </Fact>
                      <Fact label="Terms version">
                        {task.campaign.terms_version ||
                          task.assignment.terms_version ||
                          "Recorded with the campaign"}
                      </Fact>
                      <Fact label="Submission deadline">
                        {formatDate(task.assignment.expires_at, true)}
                      </Fact>
                    </dl>
                    <a
                      className="studio-text-button"
                      href={safeInstagram(
                        task.assignment.target_url || task.campaign.target_url,
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Instagram target <ArrowUpRight size={15} />
                    </a>
                    {task.assignment.comment_text
                      ? (
                        <p className="admin-brief">
                          Worker’s submitted comment: “{task.assignment
                            .comment_text}”
                        </p>
                      )
                      : null}
                  </Surface>
                  <Surface
                    title="Verification evidence"
                    description="Saved, account-scoped check results. Screenshots alone do not release payment."
                  >
                    <AdminHistory
                      key={key + "evidence"}
                      resource="task"
                      id={id}
                      history="evidence"
                      initialItems={task.evidence}
                      nextCursor={task.history_cursors?.evidence}
                    >
                      {(items) =>
                        items.length
                          ? (
                            <div className="admin-evidence">
                              {items.map((item) => (
                                <article
                                  className="admin-evidence-item"
                                  key={item.id}
                                >
                                  <div className="admin-evidence-top">
                                    <strong>
                                      {readable(item.phase)} · {item.provider}
                                    </strong>
                                    <StatusPill status={item.result} />
                                  </div>
                                  <p>
                                    {item.reason ||
                                      "No additional reason recorded."}
                                  </p>
                                  {task.worker_instagram
                                    ? (
                                      <p className="admin-identity-match">
                                        {item.actor_id
                                          ? item.actor_id ===
                                              task.worker_instagram.instagram_id
                                            ? "Actor ID matches the account bound to this task."
                                            : "Actor ID differs from the account bound to this task."
                                          : "No actor ID was recorded for this check."}
                                      </p>
                                    )
                                    : null}
                                  <dl>
                                    <Fact label="Checked">
                                      {formatDate(item.checked_at, true)}
                                    </Fact>
                                    <Fact label="Instagram actor ID">
                                      <code>{item.actor_id}</code>
                                    </Fact>
                                    <Fact label="Target ID">
                                      <code>{item.target_id}</code>
                                    </Fact>
                                    {item.comment_id
                                      ? (
                                        <Fact label="Comment ID">
                                          <code>{item.comment_id}</code>
                                        </Fact>
                                      )
                                      : null}
                                  </dl>
                                </article>
                              ))}
                            </div>
                          )
                          : (
                            <p className="admin-record-empty">
                              No verification evidence is recorded for this
                              task.
                            </p>
                          )}
                    </AdminHistory>
                  </Surface>
                  <Surface title="Check history">
                    <AdminHistory
                      key={key + "jobs"}
                      resource="task"
                      id={id}
                      history="jobs"
                      initialItems={task.jobs}
                      nextCursor={task.history_cursors?.jobs}
                    >
                      {(items) => <CheckHistory jobs={items} />}
                    </AdminHistory>
                  </Surface>
                  <Surface title="Recent linked cases">
                    <AdminHistory
                      key={key + "cases"}
                      resource="task"
                      id={id}
                      history="cases"
                      initialItems={task.cases}
                      nextCursor={task.history_cursors?.cases}
                    >
                      {(items) => <RelatedCases cases={items} />}
                    </AdminHistory>
                  </Surface>
                  <Surface title="Recent administrative activity">
                    <AdminHistory
                      key={key + "audit"}
                      resource="task"
                      id={id}
                      history="audit"
                      initialItems={task.audit}
                      nextCursor={task.history_cursors?.audit}
                    >
                      {(items) => <AuditTrail records={items} />}
                    </AdminHistory>
                  </Surface>
                </div>
                <aside>
                  <Surface
                    title="Choose the next step"
                    description="No control here can approve unverified work or force a reward."
                  >
                    <div className="admin-action-list">
                      <div className="admin-action-item">
                        <h3>Request another check</h3>
                        <p>
                          Retry an attention item using the same task and frozen
                          terms.
                        </p>
                        <button
                          className="studio-button secondary"
                          disabled={!task.allowed_actions.retry || busy ||
                            !task.jobs.some((job) => job.state === "attention")}
                          onClick={() => {
                            const job = task.jobs.find((item) =>
                              item.state === "attention"
                            );
                            if (job) void act("admin-retry", { id: job.id });
                          }}
                        >
                          <RefreshCw size={16} /> Retry attention check
                        </button>
                      </div>
                      <div className="admin-action-item">
                        <h3>Close without a reward</h3>
                        <p>
                          Use only after reviewing the evidence. This closes the
                          task without paying the worker and records why.
                        </p>
                        <button
                          className="studio-button danger"
                          disabled={!task.allowed_actions
                            .close_without_payment || busy}
                          onClick={() => open("close")}
                        >
                          Close without payment <ArrowRight size={15} />
                        </button>
                        {!task.allowed_actions.close_without_payment
                          ? (
                            <p className="admin-action-notice">
                              Only eligible tasks awaiting review can be closed
                              here.
                            </p>
                          )
                          : null}
                      </div>
                    </div>
                  </Surface>
                </aside>
              </div>
            </>
          )
          : campaign
          ? (
            <>
              <section className="admin-dossier">
                <header className="admin-dossier-heading">
                  <div>
                    <span className="studio-eyebrow">
                      CAMPAIGN INVESTIGATION
                    </span>
                    <h2>{campaign.campaign.title}</h2>
                    <p>
                      {campaign.campaign.business_name}{" "}
                      · @{campaign.campaign.target_username}
                    </p>
                  </div>
                  <StatusPill status={campaign.campaign.status} />
                </header>
                <dl className="admin-dossier-grid">
                  <Fact label="Business owner">
                    {campaign.owner?.display_name || "Unavailable"}
                  </Fact>
                  <Fact label="Account ID" wide>
                    <code>{campaign.owner?.id || "Unavailable"}</code>
                  </Fact>
                  <Fact label="Campaign ID" wide>
                    <code>{campaign.campaign.id}</code>
                  </Fact>
                  <Fact label="Engagement">
                    {readable(campaign.campaign.action)}
                  </Fact>
                  <Fact label="Requested">
                    {campaign.campaign.quantity.toLocaleString()}
                  </Fact>
                  <Fact label="Delivered">
                    {campaign.campaign.delivered_count.toLocaleString()}
                  </Fact>
                  <Fact label="Reserved">
                    {formatMoney(campaign.campaign.reserved_kobo, true)}
                  </Fact>
                  <Fact label="Spent">
                    {formatMoney(campaign.campaign.spent_kobo, true)}
                  </Fact>
                  <Fact label="Created">
                    {formatDate(campaign.campaign.created_at, true)}
                  </Fact>
                  <Fact label="Terms version">
                    {campaign.campaign.terms_version ||
                      "Recorded with the campaign"}
                  </Fact>
                </dl>
              </section>
              <Surface
                title="Campaign brief"
                description="Read-only review. The business remains in control of its campaign."
              >
                <p className="admin-brief">
                  {campaign.campaign.instructions ||
                    "No additional instructions."}
                </p>
                <a
                  className="studio-text-button"
                  href={safeInstagram(campaign.campaign.target_url)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Instagram target<ArrowUpRight size={15} />
                </a>
              </Surface>
              <Surface title="Recent linked cases">
                <AdminHistory
                  key={key + "cases"}
                  resource="campaign"
                  id={id}
                  history="cases"
                  initialItems={campaign.cases}
                  nextCursor={campaign.history_cursors?.cases}
                >
                  {(items) => <RelatedCases cases={items} />}
                </AdminHistory>
              </Surface>
              <Surface title="Recent administrative activity">
                <AdminHistory
                  key={key + "audit"}
                  resource="campaign"
                  id={id}
                  history="audit"
                  initialItems={campaign.audit}
                  nextCursor={campaign.history_cursors?.audit}
                >
                  {(items) => <AuditTrail records={items} />}
                </AdminHistory>
              </Surface>
            </>
          )
          : null}
      </AsyncState>
      {data?.history_limits
        ? (
          <p className="studio-small admin-history-limit">
            This record shows recent history first. Use “Load older” in each
            section when more records are available. Each page contains up to
            {" "}
            {data.history_limits.audit} records. {resource !== "campaign"
              ? (
                <>
                  <Link to={`/admin/checks?query=${encodeURIComponent(id)}`}>
                    Search the full check queue
                  </Link>{" "}
                  or
                </>
              )
              : null}
            <Link to="/admin/audit">browse activity</Link>.
          </p>
        )
        : null}
      <Modal
        open={!!modal}
        onClose={() => {
          if (!busy) setModal(null);
        }}
        title={modal === "close"
          ? "Close this task without payment?"
          : modal === "recover"
          ? "Check a recovered reference"
          : "Recheck the original payment"}
        description={modal === "close"
          ? "This is a recorded decision, not a payout."
          : "PocketFi must confirm the original request and its matching details."}
      >
        <form className="studio-form" onSubmit={submit}>
          <div className="admin-confirm-summary">
            <strong>
              {resource === "payment"
                ? payment?.payment.reference
                : task?.campaign.title}
            </strong>
            <code>{id}</code>
          </div>
          {modal === "close"
            ? (
              <>
                <p className="admin-close-warning">
                  The worker will not receive a reward for this task. The server
                  releases only this task’s allocation under the campaign’s
                  rules. Other tasks, deposits and withdrawals are unchanged.
                </p>
                <label className="studio-field">
                  Reason for closing<textarea
                    required
                    minLength={10}
                    maxLength={2000}
                    rows={4}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Record the evidence you reviewed and why this task cannot be paid."
                  />
                </label>
                <label className="studio-check">
                  <input
                    type="checkbox"
                    checked={reviewed}
                    onChange={(event) => setReviewed(event.target.checked)}
                  />
                  <span>
                    I reviewed the task, evidence and payment implications.
                  </span>
                </label>
                <label className="studio-field">
                  Type CLOSE WITHOUT PAYMENT<input
                    required
                    autoComplete="off"
                    spellCheck={false}
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                </label>
              </>
            )
            : modal === "recover"
            ? (
              <>
                <p className="admin-close-warning">
                  A recovered reference is only a candidate. Matching an amount
                  is not enough to attach it or approve payment. PocketFi
                  support may need to establish ownership of the original
                  request.
                </p>
                <label className="studio-field">
                  Recovered provider reference<input
                    required
                    minLength={3}
                    maxLength={180}
                    autoComplete="off"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder="Reference supplied by PocketFi"
                  />
                </label>
              </>
            )
            : (
              <p className="studio-small">
                This asks for the latest outcome. It does not resend the
                transfer, manually mark it paid or lift a review hold.
              </p>
            )}
          {recovery
            ? (
              <div
                className={recovery.outcome === "confirmed"
                  ? "studio-note"
                  : "admin-hold"}
                role="status"
              >
                <ShieldCheck size={19} />
                <div>
                  <strong>{readable(recovery.outcome)}</strong>
                  <p>{recovery.message}</p>
                  <p>Saved payment status: {readable(recovery.status)}</p>
                </div>
              </div>
            )
            : null}
          <Feedback error={actionError} />
          <div className="studio-dialog-actions">
            <button
              type="button"
              className="studio-button secondary"
              disabled={busy}
              onClick={() => setModal(null)}
            >
              {recovery ? "Done" : "Cancel"}
            </button>
            {!recovery
              ? (
                <SubmitButton
                  busy={busy}
                  disabled={modal === "close"
                    ? (!reviewed || confirmation !== "CLOSE WITHOUT PAYMENT" ||
                      reason.trim().length < 10)
                    : false}
                >
                  {modal === "close"
                    ? "Confirm non-paying closure"
                    : modal === "recover"
                    ? "Check reference"
                    : "Check provider status"}
                </SubmitButton>
              )
              : null}
          </div>
        </form>
      </Modal>
    </div>
  );
}

function safeInstagram(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
        ["instagram.com", "www.instagram.com"].includes(url.hostname) &&
        !url.username && !url.password
      ? url.href
      : "https://www.instagram.com/";
  } catch {
    return "https://www.instagram.com/";
  }
}
