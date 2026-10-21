import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Camera as Instagram,
  Check,
  ChevronRight,
  Clock3,
  Compass,
  ListChecks,
  MessageCircle,
  Search,
  ShieldCheck,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Workspace } from "./Workspace";
import { useAuth } from "./AuthContext";
import { marketplaceRequest, useMarketplace } from "./marketplace";
import {
  actionLabel,
  type Assignment,
  type Campaign,
  formatDate,
  formatMoney,
  type TaskDetailData,
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
import { friendlyError } from "./client";
import { useMarketplaceList } from "./useMarketplaceList";
import "./worker.css";

function TaskCard({ campaign }: { campaign: Campaign }) {
  const remaining = Math.max(
    0,
    campaign.quantity - campaign.delivered_count - campaign.active_count,
  );
  return (
    <Link className="studio-task-card" to={`/earn/tasks/${campaign.id}`}>
      <div className="studio-task-top">
        <span className={`studio-action-icon ${campaign.action}`}>
          {campaign.action === "follow"
            ? <UserPlus size={23} />
            : <MessageCircle size={23} />}
        </span>
        <span className="studio-tag">
          INSTAGRAM · {actionLabel(campaign.action).toUpperCase()}
        </span>
        <ArrowUpRight className="studio-card-arrow" size={20} />
      </div>
      <div className="studio-task-copy">
        <span className="studio-muted">{campaign.business_name}</span>
        <h2>{campaign.title}</h2>
        <p>@{campaign.target_username}</p>
      </div>
      <div className="studio-task-reward">
        <strong>{formatMoney(campaign.unit_reward_kobo)}</strong>
        <span>per completed task</span>
      </div>
      <footer>
        <span>
          <Clock3 size={14} />
          {campaign.retention_hours}h final check
        </span>
        <span>
          {remaining.toLocaleString()} places <ArrowRight size={16} />
        </span>
      </footer>
    </Link>
  );
}

export function WorkerDiscover() {
  const { profile } = useAuth();
  const { data, loading, error, refresh } = useMarketplace();
  const [filter, setFilter] = useState("all"), [query, setQuery] = useState("");
  const list = useMarketplaceList<Campaign>("feed", filter, query);
  const feed = list.items;
  const current = data?.assignments.find((a) => a.status === "reserved") ??
    data?.assignments.find((a) =>
      ["checking", "pending", "needs_review"].includes(a.status)
    );
  const connected = data?.instagram?.status === "verified";
  return (
    <Workspace>
      <div className="worker-discover">
        <PageIntro
          eyebrow={profile?.display_name
            ? `GOOD TO SEE YOU, ${
              profile.display_name.split(" ")[0].toUpperCase()
            }`
            : "YOUR WORKSPACE"}
          title="Find your next task."
          description="Instagram tasks. Clear rewards. Your choice."
          actions={data
            ? (
              <Link className="worker-wallet-link" to="/earn/wallet">
                <Wallet size={19} />
                <span>
                  <small>Available balance</small>
                  <strong>{formatMoney(data.wallet.available_kobo)}</strong>
                </span>
                <ArrowUpRight size={17} />
              </Link>
            )
            : undefined}
        />
        <AsyncState loading={loading && !data} error={error} onRetry={refresh}>
          {data && (
            <>
              {current && (
                <Link
                  to={`/earn/assignments/${current.id}`}
                  className="worker-resume"
                >
                  <span className="worker-resume-icon">
                    {current.status === "reserved"
                      ? <ListChecks size={21} />
                      : <Clock3 size={21} />}
                  </span>
                  <div>
                    <small>
                      {current.status === "reserved"
                        ? "READY TO CONTINUE"
                        : current.status === "needs_review"
                        ? "UNDER REVIEW"
                        : "CHECK IN PROGRESS"}
                    </small>
                    <strong>
                      {current.status === "reserved"
                        ? "Pick up where you left off"
                        : "Track your task"}
                    </strong>
                    <span>{current.campaign_title}</span>
                  </div>
                  <ArrowRight size={20} />
                </Link>
              )}
              {!connected && (
                <Link to="/earn/instagram" className="worker-setup">
                  <Instagram size={21} />
                  <span>
                    <strong>Link your Instagram to start</strong>
                    <small>
                      Use your own public account. No password sharing.
                    </small>
                  </span>
                  <ArrowRight size={18} />
                </Link>
              )}
              <div className="studio-section-line">
                <div>
                  <h2>Explore tasks</h2>
                  <p>
                    {connected
                      ? `For @${data.instagram?.username}`
                      : "See the brief and reward before you accept."}
                  </p>
                </div>
                <span className="studio-count" aria-label="Tasks loaded">
                  {list.items.length}
                  {list.nextCursor ? "+" : ""}
                </span>
              </div>
              <div className="studio-toolbar">
                <div
                  className="studio-tabs"
                  role="group"
                  aria-label="Filter tasks"
                >
                  {[["all", "All tasks"], ["follow", "Follow"], [
                    "comment",
                    "Comment",
                  ]].map(([value, label]) => (
                    <button
                      key={value}
                      aria-pressed={filter === value}
                      className={filter === value ? "selected" : ""}
                      onClick={() => setFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="studio-search">
                  <Search size={18} />
                  <span className="r-sr">Search tasks</span>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Find a business or task"
                  />
                </label>
              </div>
              <AsyncState
                loading={list.loading && !feed.length}
                error={list.error}
                onRetry={list.refresh}
              >
                {feed.length
                  ? (
                    <div className="studio-task-grid">
                      {feed.map((c) => <TaskCard key={c.id} campaign={c} />)}
                    </div>
                  )
                  : (
                    <EmptyPanel
                      icon={Compass}
                      title={query || filter !== "all"
                        ? "Nothing matches just yet."
                        : "Your next opportunity starts here."}
                      description={query || filter !== "all"
                        ? "Try another search or view all tasks."
                        : data.instagram?.status === "verified"
                        ? "You’re set up. Check back for new Instagram tasks from businesses."
                        : "Add your Instagram so you’re ready when a business publishes a task."}
                    >
                      {query || filter !== "all"
                        ? (
                          <button
                            className="studio-button secondary"
                            onClick={() => {
                              setQuery("");
                              setFilter("all");
                            }}
                          >
                            Show all tasks <ArrowRight size={17} />
                          </button>
                        )
                        : (
                          <Link
                            className="studio-button secondary"
                            to={data.instagram?.status === "verified"
                              ? "/help"
                              : "/earn/instagram"}
                          >
                            {data.instagram?.status === "verified"
                              ? "How tasks work"
                              : "Add Instagram"}
                            <ArrowRight size={17} />
                          </Link>
                        )}
                    </EmptyPanel>
                  )}
              </AsyncState>
              {list.nextCursor && (
                <button
                  className="studio-button secondary wide"
                  disabled={list.loading}
                  onClick={list.loadMore}
                >
                  {list.loading ? "Loading…" : "More opportunities"}
                  <ArrowRight size={17} />
                </button>
              )}
              <section className="studio-how-strip">
                <div>
                  <ShieldCheck size={22} />
                  <strong>Always know the deal.</strong>
                </div>
                <p>
                  Your reward, the rules and the final-check time are shown
                  before you accept.
                </p>
                <Link to="/help">
                  Good to know <ArrowUpRight size={16} />
                </Link>
              </section>
            </>
          )}
        </AsyncState>
      </div>
    </Workspace>
  );
}

const activeStates = ["reserved", "checking", "pending", "needs_review"];
function AssignmentRow({ assignment }: { assignment: Assignment }) {
  return (
    <Link className="studio-work-row" to={`/earn/assignments/${assignment.id}`}>
      <span className={`studio-action-icon ${assignment.action}`}>
        {assignment.action === "follow"
          ? <UserPlus size={22} />
          : <MessageCircle size={22} />}
      </span>
      <div className="studio-work-copy">
        <strong>{assignment.campaign_title}</strong>
        <span>
          {assignment.business_name} · {formatDate(assignment.created_at)}
        </span>
        <StatusPill status={assignment.status} />
      </div>
      <div className="studio-work-amount">
        <strong>{formatMoney(assignment.reward_kobo)}</strong>
        <ChevronRight size={18} />
      </div>
    </Link>
  );
}
export function WorkerTasks() {
  const { data, loading, error, refresh } = useMarketplace(),
    [filter, setFilter] = useState("active");
  const list = useMarketplaceList<Assignment>("assignments", filter);
  const rows = list.items;
  return (
    <Workspace>
      <PageIntro
        eyebrow="A LITTLE PROGRESS, EVERY DAY"
        title="Your work, in one place."
        description="Pick up a task. Follow its progress. See what you’ve earned."
        actions={
          <Link className="studio-button secondary" to="/earn">
            Find a task <ArrowUpRight size={18} />
          </Link>
        }
      />
      <AsyncState loading={loading && !data} error={error} onRetry={refresh}>
        {data && (
          <>
            <div className="studio-stat-strip">
              <div>
                <span>In progress</span>
                <strong>
                  {data.metrics?.active_assignments ??
                    data.assignments.filter((a) =>
                      activeStates.includes(a.status)
                    ).length}
                </strong>
              </div>
              <div>
                <span>Completed</span>
                <strong>
                  {data.metrics?.completed_assignments ??
                    data.assignments.filter((a) => a.status === "settled")
                      .length}
                </strong>
              </div>
              <div>
                <span>Earned</span>
                <strong>{formatMoney(data.wallet.earned_kobo)}</strong>
              </div>
            </div>
            <div
              className="studio-tabs studio-spaced"
              role="group"
              aria-label="Filter your tasks"
            >
              {[["active", "In progress"], ["completed", "Completed"], [
                "all",
                "All work",
              ]].map(([value, label]) => (
                <button
                  aria-pressed={filter === value}
                  className={filter === value ? "selected" : ""}
                  key={value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <Surface>
              <AsyncState
                loading={list.loading && !rows.length}
                error={list.error}
                onRetry={list.refresh}
              >
                {rows.length
                  ? rows.map((a) => <AssignmentRow key={a.id} assignment={a} />)
                  : (
                    <EmptyPanel
                      icon={ListChecks}
                      title={filter === "completed"
                        ? "Your wins will live here."
                        : "Room for your next task."}
                      description={filter === "completed"
                        ? "Completed tasks and their receipts stay here for you."
                        : "Once you accept a task, you can follow every step here."}
                    >
                      <Link className="studio-button" to="/earn">
                        Explore tasks <ArrowRight size={18} />
                      </Link>
                    </EmptyPanel>
                  )}
              </AsyncState>
              {list.nextCursor && (
                <button
                  className="studio-button secondary wide"
                  disabled={list.loading}
                  onClick={list.loadMore}
                >
                  {list.loading ? "Loading…" : "Load more work"}
                  <ArrowRight size={17} />
                </button>
              )}
            </Surface>
          </>
        )}
      </AsyncState>
    </Workspace>
  );
}

export function WorkerTaskDetail() {
  const { id } = useParams(),
    market = useMarketplace(),
    navigate = useNavigate();
  const [task, setTask] = useState<TaskDetailData | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [accepted, setAccepted] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    void marketplaceRequest<TaskDetailData>("task-detail", { id }).then((v) => {
      if (alive) setTask(v);
    }).catch((e) => {
      if (alive) setError(friendlyError(e));
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [id, revision]);
  const claimKey = useRef({ id, key: crypto.randomUUID() });
  async function claim() {
    setBusy(true);
    setError("");
    try {
      if (claimKey.current.id !== id) {
        claimKey.current = { id, key: crypto.randomUUID() };
      }
      const result = await market.act<{ id: string }>("task-claim", {
        id,
        idempotency_key: claimKey.current.key,
      });
      navigate(`/earn/assignments/${result.id}`);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  const c = task?.campaign;
  return (
    <Workspace>
      <Link className="studio-back" to="/earn">
        <ArrowLeft size={16} /> Discover
      </Link>
      <AsyncState
        loading={loading}
        error={!task ? error : ""}
        onRetry={() => setRevision((v) => v + 1)}
      >
        {c && (
          <>
            <PageIntro
              eyebrow={`INSTAGRAM ${actionLabel(c.action).toUpperCase()}`}
              title={c.title}
              description={`${c.business_name} · @${c.target_username}`}
            />
            <div className="studio-detail-layout">
              <div>
                <Surface className="studio-brief">
                  <div className="studio-brief-top">
                    <span className={`studio-action-icon ${c.action}`}>
                      {c.action === "follow"
                        ? <UserPlus size={30} />
                        : <MessageCircle size={30} />}
                    </span>
                    <div>
                      <span className="studio-eyebrow">YOUR REWARD</span>
                      <strong className="studio-big-money">
                        {formatMoney(c.unit_reward_kobo)}
                      </strong>
                    </div>
                    <span className="studio-tag">PER COMPLETED TASK</span>
                  </div>
                  <h2>
                    {c.action === "follow"
                      ? "Meet a business worth following."
                      : "Put a little thought into your comment."}
                  </h2>
                  <p>
                    {c.instructions || (c.action === "follow"
                      ? "Follow this business using your own verified Instagram account. This task is for new followers."
                      : "Leave your own relevant comment on the selected Instagram post.")}
                  </p>
                  <a
                    className="studio-button secondary"
                    href={c.target_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on Instagram <ArrowUpRight size={17} />
                  </a>
                </Surface>
                <Surface title="The simple version">
                  <ol className="studio-numbered">
                    <li>
                      <span>01</span>
                      <div>
                        <strong>Accept your place</strong>
                        <p>We’ll check eligibility and save your assignment.</p>
                      </div>
                    </li>
                    <li>
                      <span>02</span>
                      <div>
                        <strong>
                          {c.action === "follow"
                            ? "Follow on Instagram"
                            : "Write your comment"}
                        </strong>
                        <p>
                          Use the account you linked to RealReach. Then return
                          here.
                        </p>
                      </div>
                    </li>
                    <li>
                      <span>03</span>
                      <div>
                        <strong>Let us check your work</strong>
                        <p>
                          Your reward becomes available after the final check,
                          {" "}
                          {c.retention_hours}{" "}
                          hours after the action is detected.
                        </p>
                      </div>
                    </li>
                  </ol>
                </Surface>
              </div>
              <aside>
                <Surface
                  title="Before you accept"
                  className="studio-order-summary"
                >
                  <div className="studio-summary-line">
                    <span>Your Instagram</span>
                    <strong>
                      {market.data?.instagram?.status === "verified"
                        ? `@${market.data.instagram.username}`
                        : "Not linked"}
                    </strong>
                  </div>
                  <div className="studio-summary-line">
                    <span>Final check</span>
                    <strong>{c.retention_hours} hours</strong>
                  </div>
                  <div className="studio-summary-line">
                    <span>Time to submit</span>
                    <strong>
                      {market.data
                        ? `${market.data.pricing.claim_minutes} minutes`
                        : "Loading…"}
                    </strong>
                  </div>
                  <p className="studio-small">
                    {c.action === "follow"
                      ? "Keep the follow in place until the final check. Already following? You won’t be eligible for this task."
                      : "The comment must be yours, on the right post, and remain visible until the final check. Likes are not independently verified."}
                  </p>
                  <Feedback error={error} />
                  {task.assignment
                    ? (
                      <Link
                        className="studio-button wide"
                        to={`/earn/assignments/${task.assignment.id}`}
                      >
                        Open your assignment <ArrowRight size={18} />
                      </Link>
                    )
                    : (
                      <>
                        <label className="studio-check">
                          <input
                            type="checkbox"
                            checked={accepted}
                            onChange={(e) => setAccepted(e.target.checked)}
                          />
                          <span>
                            I understand the task and when my reward is
                            released.
                          </span>
                        </label>
                        {!task.eligible && (
                          <div className="studio-note">
                            {task.reason ||
                              "This task is not available for your account."}
                            {market.data?.instagram?.status !== "verified" && (
                              <Link to="/earn/instagram">
                                Link Instagram <ArrowRight size={15} />
                              </Link>
                            )}
                          </div>
                        )}
                        <SubmitButton
                          className="wide"
                          busy={busy}
                          disabled={!accepted || !task.eligible}
                          onClick={() => void claim()}
                        >
                          Accept task
                        </SubmitButton>
                      </>
                    )}
                </Surface>
              </aside>
            </div>
          </>
        )}
      </AsyncState>
    </Workspace>
  );
}

const statusCopy: Record<string, { title: string; description: string }> = {
  reserved: {
    title: "Your place is saved.",
    description:
      "Complete the action on Instagram, then return here to check it.",
  },
  checking: {
    title: "We’re checking your work.",
    description:
      "You can leave this page. Your progress is saved and we’ll update it here.",
  },
  pending: {
    title: "Nice work. Action detected.",
    description:
      "Your reward is pending the final check. Keep the action in place until then.",
  },
  settled: {
    title: "That’s a job well done.",
    description:
      "Your reward is available in your wallet. Your receipt stays here.",
  },
  ineligible: {
    title: "This one isn’t a match.",
    description: "You haven’t been charged. Explore another opportunity.",
  },
  expired: {
    title: "This place has expired.",
    description:
      "The time to submit ended. You can find a new task on Discover.",
  },
  cancelled: {
    title: "This task is closed.",
    description: "Your assignment has been released.",
  },
  rejected: {
    title: "We couldn’t confirm this task.",
    description:
      "Read the result below. If something looks wrong, you can ask us to review it.",
  },
  needs_review: {
    title: "Your task needs a closer look.",
    description:
      "Your submission is saved. Support will review the recorded checks.",
  },
};
export function WorkerAssignment() {
  const { id } = useParams(),
    { data, loading, error, refresh, act } = useMarketplace();
  const [detail, setDetail] = useState<TaskDetailData | null>(null),
    [detailLoading, setDetailLoading] = useState(true),
    [detailError, setDetailError] = useState("");
  const detailGeneration = useRef(0);
  const loadDetail = useCallback(async () => {
    const generation = detailGeneration.current;
    try {
      const result = await marketplaceRequest<TaskDetailData>("task-detail", {
        id,
      });
      if (generation === detailGeneration.current) {
        setDetail(result);
        setDetailError("");
      }
    } catch (e) {
      if (generation === detailGeneration.current) {
        setDetailError(friendlyError(e));
      }
    } finally {
      if (generation === detailGeneration.current) setDetailLoading(false);
    }
  }, [id]);
  useEffect(() => {
    detailGeneration.current++;
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    void loadDetail();
    return () => {
      detailGeneration.current++;
    };
  }, [loadDetail]);
  const a = detail?.assignment ??
      data?.assignments.find((item) => item.id === id),
    [comment, setComment] = useState(""),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState(""),
    [message, setMessage] = useState(""),
    [cancel, setCancel] = useState(false);
  useEffect(() => {
    if (!a || !["checking", "pending"].includes(a.status)) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void loadDetail();
    }, a.status === "pending" ? 60_000 : 15_000);
    return () => clearInterval(timer);
  }, [a?.status, loadDetail]);
  async function send(action: string) {
    setBusy(true);
    setActionError("");
    setMessage("");
    try {
      await act(action, { id, comment_text: comment.trim() });
      await loadDetail();
      setCancel(false);
      setMessage(
        action === "task-check"
          ? "Your check has been requested."
          : "Your place has been released.",
      );
    } catch (e) {
      setActionError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  const copy = a?.status === "checking" && !a.submitted_at
    ? {
      title: "Checking your eligibility.",
      description:
        "Wait for this check before doing the task. We’ll confirm that it’s available for your Instagram account.",
    }
    : statusCopy[a?.status ?? "reserved"];
  return (
    <Workspace>
      <Link className="studio-back" to="/earn/my-tasks">
        <ArrowLeft size={16} /> My tasks
      </Link>
      <AsyncState
        loading={(loading && !data) || (detailLoading && !a)}
        error={!a ? (error || detailError) : ""}
        onRetry={() => {
          void refresh();
          void loadDetail();
        }}
      >
        {data && (a
          ? (
            <>
              <PageIntro
                eyebrow="YOUR ASSIGNMENT"
                title={a.campaign_title}
                description={`${a.business_name} · Instagram ${
                  actionLabel(a.action).toLowerCase()
                }`}
              />
              <div className="studio-detail-layout">
                <div>
                  <section
                    className={`studio-assignment-banner is-${a.status}`}
                  >
                    <span className="studio-assignment-emblem">
                      {a.status === "settled"
                        ? <BadgeCheck size={36} />
                        : a.status === "pending"
                        ? <Check size={36} />
                        : <Clock3 size={32} />}
                    </span>
                    <StatusPill status={a.status} />
                    <h2>{copy.title}</h2>
                    <p>{copy.description}</p>
                    <strong>{formatMoney(a.reward_kobo)}</strong>
                    <span className="studio-small">
                      {a.status === "settled"
                        ? "added to your wallet"
                        : "task reward"}
                    </span>
                  </section>
                  <Feedback
                    error={actionError || detailError}
                    message={message}
                  />
                  <Surface title="Your next step">
                    {a.status === "reserved"
                      ? (
                        <>
                          <p>
                            {a.instructions ||
                              `Open @${a.target_username} and ${
                                a.action === "follow"
                                  ? "follow the account"
                                  : "leave your own comment on the post"
                              }.`}
                          </p>
                          <div className="studio-target">
                            <Instagram size={22} />
                            <div>
                              <strong>@{a.target_username}</strong>
                              <span>
                                Use @{data.instagram?.username ??
                                  "your linked account"}
                              </span>
                            </div>
                            <a
                              href={a.target_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="studio-button secondary"
                            >
                              Open <ArrowUpRight size={16} />
                            </a>
                          </div>
                          {a.action === "comment" && (
                            <label className="studio-field">
                              Your comment<textarea
                                rows={3}
                                maxLength={1000}
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Paste the comment you left so we can find it."
                              />
                              <small>
                                We’ll check the actual comment on Instagram.
                              </small>
                            </label>
                          )}
                          <SubmitButton
                            busy={busy}
                            className="wide"
                            disabled={a.action === "comment" && !comment.trim()}
                            onClick={() => void send("task-check")}
                          >
                            Check my work
                          </SubmitButton>
                          <button
                            className="studio-text-button muted"
                            onClick={() => setCancel(true)}
                          >
                            Release this task
                          </button>
                        </>
                      )
                      : a.status === "settled"
                      ? (
                        <Link className="studio-button" to="/earn/wallet">
                          Open your wallet <Wallet size={18} />
                        </Link>
                      )
                      : (
                        <>
                          <p>
                            {a.reason?.replaceAll("_", " ") || copy.description}
                          </p>
                          {a.hold_until && (
                            <div className="studio-note">
                              <Clock3 size={18} />Final check from{" "}
                              {formatDate(a.hold_until, true)}
                            </div>
                          )}
                          {a.next_check_at && (
                            <p className="studio-small">
                              Next check: {formatDate(a.next_check_at, true)}
                            </p>
                          )}
                          <button
                            className="studio-button secondary"
                            onClick={() => {
                              void refresh();
                              void loadDetail();
                            }}
                            disabled={loading}
                          >
                            Refresh status <ArrowRight size={17} />
                          </button>
                        </>
                      )}
                  </Surface>
                </div>
                <aside>
                  <Surface title="Task receipt">
                    <dl className="studio-receipt">
                      <div>
                        <dt>Reference</dt>
                        <dd className="studio-mono">
                          {a.id.slice(0, 8).toUpperCase()}
                        </dd>
                      </div>
                      <div>
                        <dt>Accepted</dt>
                        <dd>{formatDate(a.created_at, true)}</dd>
                      </div>
                      <div>
                        <dt>Submit before</dt>
                        <dd>{formatDate(a.expires_at, true)}</dd>
                      </div>
                      <div>
                        <dt>Submitted</dt>
                        <dd>{formatDate(a.submitted_at, true)}</dd>
                      </div>
                      <div>
                        <dt>Completed</dt>
                        <dd>{formatDate(a.settled_at, true)}</dd>
                      </div>
                      <div>
                        <dt>Reward</dt>
                        <dd>{formatMoney(a.reward_kobo)}</dd>
                      </div>
                    </dl>
                    <p className="studio-small">
                      <ShieldCheck size={15} />{" "}
                      Payments are based on recorded checks, not business
                      approval.
                    </p>
                  </Surface>
                  <Link
                    to={`/support?reference=${encodeURIComponent(a.id)}`}
                    className="studio-support-link"
                  >
                    Something not right?<span>
                      Get help with this task <ArrowUpRight size={16} />
                    </span>
                  </Link>
                </aside>
              </div>
              <Modal
                open={cancel}
                onClose={() => setCancel(false)}
                title="Release your place?"
                description="Someone else can take it. You won’t earn a reward for this assignment."
              >
                <div className="studio-dialog-actions">
                  <button
                    className="studio-button secondary"
                    onClick={() => setCancel(false)}
                  >
                    Keep working
                  </button>
                  <SubmitButton
                    className="danger"
                    busy={busy}
                    onClick={() => void send("task-cancel")}
                  >
                    Release task
                  </SubmitButton>
                </div>
              </Modal>
            </>
          )
          : (
            <EmptyPanel
              icon={ListChecks}
              title="We couldn’t find that task."
              description="It may belong to another account or no longer be available."
            >
              <Link className="studio-button" to="/earn/my-tasks">
                Back to my tasks <ArrowRight size={18} />
              </Link>
            </EmptyPanel>
          ))}
      </AsyncState>
    </Workspace>
  );
}
