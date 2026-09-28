import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  Heart,
  Camera,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Wallet,
} from "lucide-react";
import {
  activeClaim,
  hasTargetAttempt,
  HOLD_HOURS,
  label,
  money,
  pendingEarnings,
  places,
  type Campaign,
  type Scenario,
} from "./model";
import { useDemo } from "./store";
import {
  BrandAvatar,
  Button,
  ButtonLink,
  dateTime,
  DemoLab,
  Empty,
  Info,
  Modal,
  PageHeading,
  Pill,
  PostArt,
  SectionHeading,
  Status,
  Timeline,
} from "./ui";

function TaskCard({ campaign: c }: { campaign: Campaign }) {
  const { state, send } = useDemo();
  const saved = state.saved.includes(c.id);
  return (
    <article className={`j-task-card j-task-card--${c.theme}`}>
      <div className="j-task-card-top">
        <BrandAvatar campaign={c} />
        <div>
          <strong>{c.brand}</strong>
          <span>{c.category}</span>
        </div>
        <button
          className={`j-icon-btn j-bookmark ${saved ? "is-saved" : ""}`}
          aria-label={`${saved ? "Unsave" : "Save"} ${c.brand} task`}
          aria-pressed={saved}
          onClick={() => send({ type: "save-task", id: c.id })}
        >
          <Bookmark size={20} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <Link to={`/earn/tasks/${c.id}`} className="j-task-card-body">
        <span className="j-task-kind">
          <Camera size={15} />
          INSTAGRAM <i /> {c.kind === "follow" ? "FOLLOW" : "COMMENT"}
        </span>
        <h2>
          {c.kind === "follow" ? (
            <>
              Meet {c.brand}.<br />
              Give them a follow.
            </>
          ) : (
            <>
              A fresh perspective.
              <br />
              Leave your thoughts.
            </>
          )}
        </h2>
        <p>
          {c.kind === "follow"
            ? "Discover a new business. For accounts that don't already follow this brand."
            : "Join the conversation with an original comment on the brand's featured post."}
        </p>
        <div className="j-task-meta">
          <span>
            <Clock3 size={14} />
            {c.kind === "follow" ? "2–3" : "3–5"} min
          </span>
          <span>{places(state, c)} places open</span>
        </div>
        <div className="j-task-card-footer">
          <span>
            <small>YOUR REWARD</small>
            <strong>{money(c.reward)}</strong>
          </span>
          <span className="j-round-arrow">
            <ArrowUpRight size={21} />
          </span>
        </div>
      </Link>
    </article>
  );
}

export function Discover() {
  const { state } = useDemo();
  const [filter, setFilter] = useState("All tasks");
  const [search, setSearch] = useState("");
  const active = activeClaim(state);
  const available = state.campaigns.filter(
    (c) =>
      c.status === "live" &&
      c.funded &&
      c.endsAt > state.clock &&
      places(state, c) > 0 &&
      (!c.owned || state.connected) &&
      !hasTargetAttempt(state, c),
  );
  const filtered = available.filter(
    (c) =>
      (filter === "All tasks" ||
        (filter === "Saved" && state.saved.includes(c.id)) ||
        (filter === "Follows" && c.kind === "follow") ||
        (filter === "Comments" && c.kind === "comment")) &&
      `${c.brand} ${c.category} ${c.name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="YOUR NEXT SMALL WIN"
        title={`Make your attention count, ${state.name.split(" ")[0]}.`}
        copy="Find a brand. Take a little action. Earn something back."
      />
      <div className="j-worker-intro">
        <div>
          <Pill tone="lime">
            <Sparkles size={13} />
            Made for your spare moments
          </Pill>
          <h2>
            Good brands.
            <br />
            <span>Real connections.</span>
          </h2>
          <p>
            Clear tasks, transparent rewards.
            <br />
            You're in control of what comes next.
          </p>
        </div>
        <Link to="/earn/wallet" className="j-intro-wallet">
          <span>
            <Wallet size={19} />
            Your available balance
          </span>
          <strong>{money(state.workerBalance)}</strong>
          <small>{money(pendingEarnings(state))} pending verification</small>
          <span className="j-intro-wallet-link">
            View wallet <ArrowUpRight size={18} />
          </span>
        </Link>
        <span className="j-orbit" aria-hidden="true" />
      </div>
      {active && (
        <Link to={`/earn/assignments/${active.id}`} className="j-resume">
          <span className="j-resume-icon">
            <Clock3 size={19} />
          </span>
          <div>
            <strong>You have a task in progress</strong>
            <span>Pick up exactly where you left off.</span>
          </div>
          <ChevronRight size={20} />
        </Link>
      )}
      <div className="j-discover-tools">
        <SectionHeading
          title="Find your next task"
          aside={<span className="j-count">{filtered.length} available</span>}
        />
        <label className="j-search">
          <Search size={19} />
          <input
            aria-label="Search tasks"
            placeholder="Search brands or interests"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="j-tabs" role="group" aria-label="Task filters">
        {["All tasks", "Follows", "Comments", "Saved"].map((f) => (
          <button
            key={f}
            className={filter === f ? "is-active" : ""}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {f}
            {f === "Saved" && state.saved.length > 0
              ? ` (${state.saved.length})`
              : ""}
          </button>
        ))}
      </div>
      {filtered.length ? (
        <div className="j-task-grid">
          {filtered.map((c) => (
            <TaskCard key={c.id} campaign={c} />
          ))}
        </div>
      ) : (
        <Empty
          title={
            filter === "Saved"
              ? "Keep something for later"
              : "No tasks here just yet"
          }
          text={
            filter === "Saved"
              ? "Tap the bookmark on any available task to find it here."
              : "Try another search or filter. Tasks you've claimed are in My tasks."
          }
          action={
            <Button
              onClick={() => {
                setSearch("");
                setFilter("All tasks");
              }}
              kind="secondary"
            >
              Show all tasks
            </Button>
          }
        />
      )}
      <div className="j-bottom-assurance">
        <ShieldCheck size={20} />
        <div>
          <strong>Know the terms before you start.</strong>
          <span>
            Every task tells you what to do, what you earn, and when it becomes
            available.
          </span>
        </div>
        <Link to="/help">
          Learn more <ArrowRight size={16} />
        </Link>
      </div>
    </>
  );
}

export function TaskDetail() {
  const { campaignId } = useParams();
  const { state, send } = useDemo();
  const navigate = useNavigate();
  const c = state.campaigns.find((x) => x.id === campaignId);
  if (!c)
    return (
      <Empty
        title="This task isn't available"
        text="It may have closed. Find another opportunity in Discover."
        action={<ButtonLink to="/earn">Back to Discover</ButtonLink>}
      />
    );
  const existing = state.assignments.find((a) => a.campaignId === c.id);
  const available =
    c.status === "live" &&
    c.endsAt > state.clock &&
    places(state, c) > 0 &&
    (!c.owned || state.connected);
  const claim = () => {
    const id = `task-${crypto.randomUUID().slice(0, 8)}`;
    if (send({ type: "claim", id: c.id, assignmentId: id }))
      navigate(`/earn/assignments/${id}`);
  };
  return (
    <>
      <Link to="/earn" className="j-back">
        <ArrowLeft size={17} />
        All opportunities
      </Link>
      <div className="j-detail-layout j-task-detail-layout">
        <div>
          <div className={`j-task-hero j-theme-${c.theme}`}>
            <span className="j-task-kind">
              <Camera size={16} />
              INSTAGRAM / {c.kind.toUpperCase()}
            </span>
            <BrandAvatar campaign={c} large />
            <h1>
              {c.kind === "follow"
                ? `Get to know ${c.brand}.`
                : "Your perspective belongs here."}
            </h1>
            <p>
              @{c.handle} · {c.category}
            </p>
          </div>
          <section className="j-panel">
            <SectionHeading title="A small action. A clear reward." />
            <p>
              {c.kind === "follow"
                ? `Discover ${c.brand} and follow their Instagram account. This opportunity is for accounts that aren't already following them.`
                : c.prompt}
            </p>
            <div className="j-detail-metrics">
              <div>
                <Clock3 size={20} />
                <strong>{c.kind === "follow" ? "2–3" : "3–5"} minutes</strong>
                <span>To complete</span>
              </div>
              <div>
                <UserPlus size={20} />
                <strong>{places(state, c)} places</strong>
                <span>Currently open</span>
              </div>
              <div>
                <ShieldCheck size={20} />
                <strong>48-hour hold</strong>
                <span>Before final check</span>
              </div>
            </div>
          </section>
          <section className="j-panel">
            <SectionHeading title="Here's how it works" />
            <ol className="j-instructions">
              {[
                "Accept the task to reserve your place and reward.",
                `Verify your account with a one-time message to ${c.brand}.`,
                c.kind === "follow"
                  ? "Wait for the eligibility check, then follow the business."
                  : "Write an original comment on the selected post.",
                "Return to RealReach. We'll check the action and show your earnings status.",
              ].map((step, i) => (
                <li key={step}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
          </section>
          <Info>
            One reward per eligible account and target. Keep the action in place
            until the final check. Checking at two points does not guarantee
            permanent retention.
          </Info>
        </div>
        <aside className="j-task-aside">
          <div className="j-reward-card">
            <span className="j-eyebrow">YOUR REWARD</span>
            <strong>{money(c.reward)}</strong>
            <p>
              Reserved when you accept.
              <br />
              Available after the final check.
            </p>
            <div className="j-reward-divider" />
            <span className="j-check-line">
              <CheckCircle2 size={17} />
              No fee to accept this task
            </span>
            <span className="j-check-line">
              <CheckCircle2 size={17} />
              15 minutes to submit
            </span>
            {existing ? (
              <ButtonLink to={`/earn/assignments/${existing.id}`}>
                View my assignment <ArrowRight size={18} />
              </ButtonLink>
            ) : (
              <Button
                onClick={claim}
                disabled={!available || !!activeClaim(state)}
              >
                Accept task <ArrowRight size={18} />
              </Button>
            )}
            {activeClaim(state) && !existing && (
              <small>Finish your active task first.</small>
            )}
            {!available && (
              <small>This campaign is not accepting new claims.</small>
            )}
            <small>Preview task · no real earnings</small>
          </div>
          <div className="j-side-note">
            <ShieldCheck />
            <p>
              Your reward isn't dependent on a business pressing an approval
              button.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

export function MyTasks() {
  const { state } = useDemo();
  const [filter, setFilter] = useState("All");
  const rows = state.assignments.filter(
    (a) =>
      filter === "All" ||
      (filter === "In progress" &&
        ["reserved", "ready", "checking"].includes(a.status)) ||
      (filter === "Pending" && ["pending", "review"].includes(a.status)) ||
      (filter === "Completed" && a.status === "settled"),
  );
  return (
    <>
      <PageHeading
        eyebrow="YOUR WORK, IN ONE PLACE"
        title="Every little action adds up."
        copy="Pick up a task, follow a check, or revisit a completed reward."
      />
      <div className="j-tabs" role="group" aria-label="Assignment filters">
        {["All", "In progress", "Pending", "Completed"].map((f) => (
          <button
            key={f}
            className={f === filter ? "is-active" : ""}
            aria-pressed={f === filter}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      {rows.length ? (
        <div className="j-assignment-list">
          {rows.map((a) => {
            const c = state.campaigns.find((x) => x.id === a.campaignId)!;
            return (
              <Link
                key={a.id}
                className="j-assignment-row"
                to={`/earn/assignments/${a.id}`}
              >
                <BrandAvatar campaign={c} />
                <div className="j-assignment-description">
                  <strong>
                    {c.kind === "follow" ? "Follow" : "Comment for"} {c.brand}
                  </strong>
                  <span>
                    {a.status === "pending"
                      ? `Final check from ${dateTime(a.releaseAt!)}`
                      : a.reason}
                  </span>
                  <Status value={a.status} />
                </div>
                <div className="j-assignment-value">
                  <strong>{money(c.reward)}</strong>
                  <ChevronRight size={19} />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty
          title={
            filter === "All"
              ? "Your first small win is waiting"
              : "Nothing in this category"
          }
          text="Once you accept a task, its instructions, progress and receipt will live here."
          action={
            <ButtonLink to="/earn">
              Discover tasks <ArrowRight size={18} />
            </ButtonLink>
          }
        />
      )}
    </>
  );
}

export function AssignmentPage() {
  const { assignmentId } = useParams();
  const { state, send, toast } = useDemo();
  const [scenario, setScenario] = useState<Scenario>("success");
  const [preview, setPreview] = useState(false);
  const [comment, setComment] = useState("");
  const [followed, setFollowed] = useState(false);
  const [appeal, setAppeal] = useState(false);
  const [reason, setReason] = useState("");
  const a = state.assignments.find((x) => x.id === assignmentId);
  const c = state.campaigns.find((x) => x.id === a?.campaignId);
  useEffect(() => {
    if (a?.status !== "checking" || !a.reason.startsWith("Checking the action"))
      return;
    const id = a.id;
    const timer = setTimeout(
      () =>
        send({
          type: "result",
          id,
          result:
            scenario === "unavailable"
              ? "unavailable"
              : scenario === "not-done"
                ? "not-done"
                : "success",
        }),
      850,
    );
    return () => clearTimeout(timer);
  }, [a?.id, a?.status, a?.reason, scenario, send]);
  if (!a || !c)
    return (
      <Empty
        title="Assignment not found"
        text="Return to your task list to continue."
        action={<ButtonLink to="/earn/my-tasks">My tasks</ButtonLink>}
      />
    );
  const firstDone = a.status !== "reserved";
  const detected = !!a.verifiedAt;
  const ended = ["rejected", "expired", "settled", "review"].includes(a.status);
  const code = `RR-${a.id.slice(-8).toUpperCase()}`;
  const checking =
    a.status === "checking" && a.reason.startsWith("Checking the action");
  const mins = Math.max(0, Math.ceil((a.expiresAt - state.clock) / 60000));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast("Verification code copied.");
    } catch {
      toast("Copy the code shown on screen. Clipboard access is unavailable.");
    }
  };
  return (
    <>
      <Link to="/earn/my-tasks" className="j-back">
        <ArrowLeft size={17} />
        My tasks
      </Link>
      <PageHeading
        eyebrow={`ASSIGNMENT / ${a.id.slice(-8).toUpperCase()}`}
        title={`${c.kind === "follow" ? "Follow" : "Comment for"} ${c.brand}`}
        action={<Status value={a.status} />}
      />
      <div className="j-detail-layout">
        <div>
          <div
            className={`j-assignment-banner ${a.status === "settled" ? "is-complete" : ""}`}
          >
            <span className="j-assignment-banner-icon">
              {a.status === "settled" ? (
                <CheckCircle2 size={30} />
              ) : detected ? (
                <Clock3 size={30} />
              ) : (
                <ShieldCheck size={30} />
              )}
            </span>
            <div>
              <strong>
                {a.status === "settled"
                  ? "A little action. A well-earned reward."
                  : detected
                    ? "Your action has been detected."
                    : "Your place is reserved."}
              </strong>
              <p>{a.reason}</p>
              {["reserved", "ready"].includes(a.status) && (
                <small>{mins} minutes left to submit · reward reserved</small>
              )}
              {a.status === "pending" && (
                <small>Final check from {dateTime(a.releaseAt!)}</small>
              )}
            </div>
            <strong className="j-banner-reward">{money(c.reward)}</strong>
          </div>
          {!ended && (
            <div className="j-work-steps">
              <section
                className={`j-work-step ${firstDone ? "is-done" : "is-current"}`}
              >
                <span className="j-step-index">
                  {firstDone ? <Check size={17} /> : "01"}
                </span>
                <div>
                  <h2>Verify your Instagram account</h2>
                  <p>
                    Send a one-time code to @{c.handle} from the account you'll
                    use. This connects the action to you.
                  </p>
                  {!firstDone ? (
                    <>
                      <div className="j-code">
                        <code>{code}</code>
                        <button
                          onClick={copy}
                          aria-label="Copy verification code"
                        >
                          <Copy size={18} />
                        </button>
                      </div>
                      <Info>
                        This is a preview. Use the demo control below instead of
                        messaging the sample account.
                      </Info>
                      <Button
                        kind="secondary"
                        onClick={() =>
                          send({
                            type: "identify",
                            id: a.id,
                            alreadyFollowing: scenario === "already-following",
                          })
                        }
                      >
                        Simulate verification message <ArrowRight size={17} />
                      </Button>
                    </>
                  ) : (
                    <span className="j-inline-success">
                      <CheckCircle2 size={17} />
                      Demo account identified for this business
                    </span>
                  )}
                </div>
              </section>
              <section
                className={`j-work-step ${detected ? "is-done" : firstDone ? "is-current" : "is-locked"}`}
              >
                <span className="j-step-index">
                  {detected ? <Check size={17} /> : "02"}
                </span>
                <div>
                  <h2>
                    {c.kind === "follow"
                      ? `Follow @${c.handle}`
                      : "Leave your own comment"}
                  </h2>
                  <p>
                    {c.kind === "follow"
                      ? "In the live product, you'll open Instagram and follow the business yourself. RealReach never acts on your behalf."
                      : c.prompt}
                  </p>
                  {firstDone && !detected && (
                    <Button kind="secondary" onClick={() => setPreview(true)}>
                      <Camera size={18} />
                      Open task preview <ArrowUpRight size={17} />
                    </Button>
                  )}
                  {detected && (
                    <span className="j-inline-success">
                      <CheckCircle2 size={17} />
                      Action detected at {dateTime(a.verifiedAt!)}
                    </span>
                  )}
                </div>
              </section>
              <section
                className={`j-work-step ${a.status === "pending" ? "is-current" : ""}`}
              >
                <span className="j-step-index">03</span>
                <div>
                  <h2>
                    {detected
                      ? "A short hold. Then it's yours."
                      : "Return for your check"}
                  </h2>
                  <p>
                    {detected
                      ? `Your ${money(c.reward)} is pending. It becomes available after a successful final check, ${HOLD_HOURS} hours after detection.`
                      : "We'll check the right account and action. An unavailable response doesn't count as a pass or a failure."}
                  </p>
                  {["ready", "checking"].includes(a.status) && (
                    <Button
                      disabled={checking}
                      onClick={() => send({ type: "check", id: a.id })}
                    >
                      {checking ? (
                        <>
                          <span className="j-spinner" />
                          Checking demo response…
                        </>
                      ) : (
                        <>
                          Check my task <ShieldCheck size={18} />
                        </>
                      )}
                    </Button>
                  )}
                  {a.status === "pending" && (
                    <ButtonLink to="/earn">
                      Find another task <ArrowRight size={18} />
                    </ButtonLink>
                  )}
                </div>
              </section>
            </div>
          )}
          {ended && (
            <section className="j-panel">
              <h2>
                {a.status === "settled"
                  ? "Your task receipt"
                  : a.status === "review"
                    ? "We're keeping the evidence together."
                    : "What happens next?"}
              </h2>
              <p>
                {a.status === "settled"
                  ? `${money(c.reward)} has moved into your available demo balance. The business sees this same completed action.`
                  : a.status === "review"
                    ? "The task timeline is available to the demo admin. Your existing available balance is unaffected."
                    : a.reason}
              </p>
              {a.status === "settled" ? (
                <ButtonLink to="/earn/wallet">
                  Go to wallet <Wallet size={18} />
                </ButtonLink>
              ) : a.status === "review" ? (
                <ButtonLink to="/admin/proofs" secondary>
                  View demo review
                </ButtonLink>
              ) : (
                <div className="j-button-row">
                  <ButtonLink to="/earn">Find another task</ButtonLink>
                  <Button kind="secondary" onClick={() => setAppeal(true)}>
                    Ask for a review
                  </Button>
                </div>
              )}
            </section>
          )}
          <section className="j-panel">
            <SectionHeading title="Your task timeline" />
            <Timeline events={a.events} />
          </section>
          <DemoLab>
            <label className="j-field">
              <span>Next verification response</span>
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value as Scenario)}
              >
                <option value="success">Success · action detected</option>
                <option value="already-following">
                  Already following · baseline check
                </option>
                <option value="unavailable">
                  Provider unavailable · preserve claim
                </option>
                <option value="not-done">Action not found · allow retry</option>
              </select>
            </label>
            {a.status === "pending" && (
              <>
                <div className="j-button-row">
                  <Button
                    kind="secondary"
                    onClick={() => {
                      send({ type: "advance", hours: 48 });
                      toast(
                        "Demo clock advanced by 48 hours. Run the final check below.",
                      );
                    }}
                  >
                    Advance demo 48 hours
                  </Button>
                  <Button
                    onClick={() =>
                      send({ type: "final-check", id: a.id, result: "success" })
                    }
                    disabled={state.clock < (a.releaseAt ?? Infinity)}
                  >
                    Pass final check
                  </Button>
                </div>
                <div className="j-button-row">
                  <Button
                    kind="ghost"
                    disabled={state.clock < (a.releaseAt ?? Infinity)}
                    onClick={() =>
                      send({ type: "final-check", id: a.id, result: "missing" })
                    }
                  >
                    Simulate missing action
                  </Button>
                  <Button
                    kind="ghost"
                    disabled={state.clock < (a.releaseAt ?? Infinity)}
                    onClick={() =>
                      send({
                        type: "final-check",
                        id: a.id,
                        result: "unavailable",
                      })
                    }
                  >
                    Simulate delayed check
                  </Button>
                </div>
              </>
            )}
            {["reserved", "ready"].includes(a.status) && (
              <Button
                kind="ghost"
                onClick={() => send({ type: "advance", hours: 0.26 })}
              >
                Expire this claim
              </Button>
            )}
          </DemoLab>
        </div>
        <aside className="j-task-aside">
          <div className="j-reward-card">
            <span className="j-eyebrow">RESERVED FOR THIS TASK</span>
            <strong>{money(c.reward)}</strong>
            <div className="j-brand-line">
              <BrandAvatar campaign={c} />
              <div>
                <b>{c.brand}</b>
                <small>@{c.handle}</small>
              </div>
            </div>
            <div className="j-reward-divider" />
            <span className="j-check-line">
              <ShieldCheck size={17} />
              Account-level evidence
            </span>
            <span className="j-check-line">
              <Clock3 size={17} />
              48-hour holding period
            </span>
            <p>
              Demo money only. Screenshots and button clicks are not evidence in
              the live product.
            </p>
          </div>
        </aside>
      </div>
      {preview && (
        <Modal title="Instagram task preview" onClose={() => setPreview(false)}>
          <div className="j-instagram-preview">
            <div className="j-brand-line">
              <BrandAvatar campaign={c} />
              <strong>{c.handle}</strong>
              <Pill>Sample account</Pill>
            </div>
            {c.kind === "comment" ? (
              <>
                <PostArt campaign={c} />
                <div className="j-ig-actions">
                  <Heart size={22} />
                  <MessageCircle size={22} />
                  <Bookmark size={22} />
                </div>
                <p>
                  <strong>{c.brand}</strong> {c.prompt}
                </p>
                <label className="j-field">
                  <span>Your demo comment</span>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share what catches your eye…"
                    minLength={20}
                  />
                </label>
                <Button
                  disabled={comment.trim().length < 20}
                  onClick={() => {
                    setPreview(false);
                    toast(
                      "Demo comment added. Return to the task and request your check.",
                    );
                  }}
                >
                  Add demo comment
                </Button>
              </>
            ) : (
              <>
                <h3>{c.brand}</h3>
                <p>
                  Considered details. Everyday favourites.
                  <br />A sample profile for testing the journey.
                </p>
                <Button
                  onClick={() => {
                    setFollowed(!followed);
                    toast(
                      followed
                        ? "Sample profile unfollowed."
                        : "Sample profile followed. Request your check in RealReach.",
                    );
                  }}
                >
                  {followed ? (
                    <>
                      <Check size={18} />
                      Following in demo
                    </>
                  ) : (
                    <>
                      <UserPlus size={18} />
                      Follow in demo
                    </>
                  )}
                </Button>
                <Button kind="ghost" onClick={() => setPreview(false)}>
                  Return to my task <ArrowRight size={17} />
                </Button>
              </>
            )}
            <small>No action is sent to Instagram.</small>
          </div>
        </Modal>
      )}
      {appeal && (
        <Modal title="Ask for a review" onClose={() => setAppeal(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (send({ type: "appeal", id: a.id, reason })) setAppeal(false);
            }}
          >
            <p>
              Tell us what happened. Your task timeline will be attached
              automatically.
            </p>
            <label className="j-field">
              <span>What should we know?</span>
              <textarea
                required
                minLength={10}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain the issue in your own words…"
              />
            </label>
            <Button type="submit">Submit review request</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
