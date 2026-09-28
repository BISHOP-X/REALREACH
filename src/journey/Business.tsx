import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Download,
  ExternalLink,
  FlaskConical,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Target,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import {
  budget,
  campaignAssignments,
  campaignHeld,
  campaignSpent,
  HOUR,
  money,
  places,
  unit,
  type Campaign,
} from "./model";
import { useDemo } from "./store";
import {
  BrandAvatar,
  Button,
  ButtonLink,
  dateTime,
  Empty,
  Info,
  Modal,
  MoneyList,
  NewCampaignLink,
  PageHeading,
  Pill,
  PostArt,
  SectionHeading,
  Stat,
  Status,
} from "./ui";

export function ConnectInstagram({ onClose }: { onClose: () => void }) {
  const { state, send, toast } = useDemo();
  const [handle, setHandle] = useState(state.handle);
  const [agreed, setAgreed] = useState(false);
  return (
    <Modal title="Connect your Instagram" onClose={onClose}>
      <div className="j-connect-symbol">
        <Camera size={32} />
        <span>
          <Check size={12} />
        </span>
      </div>
      <h3 className="j-modal-feature-title">
        Your account. Connected to your campaigns.
      </h3>
      <p className="j-muted">
        The live product will use an authorized professional-account connection.
        This preview simulates the result without asking for your Instagram
        password.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (
            send({
              type: "connection",
              handle: handle.replace(/^@/, ""),
              connected: true,
            })
          ) {
            toast("Demo Instagram connection is ready.");
            onClose();
          }
        }}
      >
        <label className="j-field">
          <span>Demo Instagram username</span>
          <div className="j-input-prefix">
            <span>@</span>
            <input
              required
              pattern="[A-Za-z0-9._]{1,30}"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              autoComplete="off"
            />
          </div>
        </label>
        <div className="j-permission-list">
          <span>
            <CheckCircle2 />
            Read account and supported posts
          </span>
          <span>
            <CheckCircle2 />
            Receive verification messages
          </span>
          <span>
            <CheckCircle2 />
            Check supported actions
          </span>
        </div>
        <label className="j-checkbox">
          <input
            type="checkbox"
            required
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>
            I understand this is a simulated connection. No real Instagram
            permissions are granted.
          </span>
        </label>
        <Button type="submit" disabled={!agreed}>
          Connect demo account <ArrowRight size={18} />
        </Button>
      </form>
    </Modal>
  );
}
export function TopUp({
  onClose,
  suggested = 10000,
}: {
  onClose: () => void;
  suggested?: number;
}) {
  const { send, toast } = useDemo();
  const [amount, setAmount] = useState(
    String(Math.min(100000, Math.max(1000, Math.ceil(suggested)))),
  );
  const [failed, setFailed] = useState(false);
  const [id] = useState(() => `deposit-${crypto.randomUUID()}`);
  return (
    <Modal title="Add demo funds" onClose={onClose}>
      <p className="j-muted">
        Test funding a campaign. No card details, bank transfer or real charge
        is required.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (
            send({
              type: "deposit",
              amount: Math.round(Number(amount) * 100),
              reference: id,
            })
          ) {
            toast(`${money(Number(amount) * 100)} added to your demo balance.`);
            onClose();
          }
        }}
      >
        <label className="j-field">
          <span>Amount in naira</span>
          <div className="j-input-prefix">
            <span>₦</span>
            <input
              aria-label="Top-up amount"
              type="number"
              min="1000"
              max="100000"
              step="1"
              required
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setFailed(false);
              }}
            />
          </div>
        </label>
        <div className="j-amount-presets">
          {[5000, 10000, 25000].map((n) => (
            <button type="button" key={n} onClick={() => setAmount(String(n))}>
              {money(n * 100)}
            </button>
          ))}
        </div>
        <div className="j-quote-mini">
          <span>Demo amount</span>
          <strong>{money((Number(amount) || 0) * 100)}</strong>
          <span>Real payment charged</span>
          <strong>₦0</strong>
        </div>
        {failed && (
          <div className="j-field-error" role="alert">
            Demo payment failed. Nothing was added. You can retry safely.
          </div>
        )}
        <Button type="submit">
          Simulate successful top-up <ArrowRight size={17} />
        </Button>
        <Button kind="ghost" onClick={() => setFailed(true)}>
          Test failed payment
        </Button>
        <Info>
          PocketFi is not connected yet. A live balance will only update after a
          verified payment confirmation.
        </Info>
      </form>
    </Modal>
  );
}

function CampaignRow({ campaign: c }: { campaign: Campaign }) {
  const { state } = useDemo();
  const done = campaignAssignments(state, c.id).filter(
    (a) => a.status === "settled",
  ).length;
  return (
    <Link to={`/business/campaigns/${c.id}`} className="j-campaign-row">
      <BrandAvatar campaign={c} />
      <div className="j-campaign-name">
        <strong>{c.name}</strong>
        <span>
          <Camera size={13} />
          {c.kind === "follow" ? "Followers" : "Comments"} · @{c.handle}
        </span>
      </div>
      <div className="j-campaign-progress">
        <span>
          <strong>{done}</strong> / {c.goal} delivered
        </span>
        <div className="j-progress-track">
          <i style={{ width: `${(done / c.goal) * 100}%` }} />
        </div>
      </div>
      <Status value={c.status} />
      <ChevronRight className="j-row-arrow" size={18} />
    </Link>
  );
}
export function BusinessOverview() {
  const { state } = useDemo();
  const [connect, setConnect] = useState(false);
  const own = state.campaigns.filter((c) => c.owned);
  const done = state.assignments.filter(
    (a) => a.status === "settled" && own.some((c) => c.id === a.campaignId),
  );
  const held = own.reduce((sum, c) => sum + campaignHeld(state, c), 0);
  const spend = own.reduce((sum, c) => sum + campaignSpent(state, c), 0);
  return (
    <>
      <PageHeading
        eyebrow="YOUR BUSINESS, A LITTLE FURTHER"
        title="Good things start with a connection."
        copy={`Here's what's happening with ${state.businessName}.`}
        action={<NewCampaignLink />}
      />
      <div className="j-business-hero">
        <div>
          <Pill tone="lime">
            <Camera size={14} />
            INSTAGRAM WORKSPACE
          </Pill>
          <h2>
            Find your people.
            <br />
            <span>Make an impression.</span>
          </h2>
          <p>
            A clear brief. A funded reward. Every completed action accounted
            for.
          </p>
          <Link to="/business/campaigns/new">
            Start something good <ArrowUpRight size={19} />
          </Link>
        </div>
        <div className="j-business-account-card">
          <span className="j-account-overline">CONNECTED ACCOUNT</span>
          <span className="j-business-avatar">{state.businessName[0]}</span>
          <strong>@{state.handle}</strong>
          <span>
            {state.connected
              ? "Demo professional account"
              : "Connection needs attention"}
          </span>
          <button onClick={() => setConnect(true)}>
            {state.connected ? (
              <>
                <CheckCircle2 size={16} />
                Connection ready
              </>
            ) : (
              <>
                Reconnect account <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
      <div className="j-stats-grid">
        <Stat
          label="Actions delivered"
          value={done.length}
          detail="Passed the final check"
        />
        <Stat
          label="Available funds"
          value={money(state.businessBalance)}
          detail="Ready for your next campaign"
        />
        <Stat
          label="Reserved budget"
          value={money(held)}
          detail="Committed to funded campaigns"
        />
        <Stat
          label="Settled spend"
          value={money(spend)}
          detail="Rewards + platform fees"
        />
      </div>
      {!state.connected && (
        <Info warning>
          Your Instagram connection is paused. Reconnect to publish or resume
          verification. Existing claims are preserved.
        </Info>
      )}
      <div className="j-overview-columns">
        <section className="j-panel j-panel--flush">
          <div className="j-panel-padding">
            <SectionHeading
              title="Your campaigns"
              aside={
                <Link className="j-text-link" to="/business/campaigns">
                  View all <ArrowRight size={15} />
                </Link>
              }
            />
          </div>
          {own.length ? (
            own.slice(0, 4).map((c) => <CampaignRow key={c.id} campaign={c} />)
          ) : (
            <Empty
              title="Your first campaign starts here"
              text="Give people one clear action and a transparent reward."
              action={<NewCampaignLink />}
            />
          )}
        </section>
        <section className="j-launch-note">
          <span className="j-eyebrow">A BETTER BRIEF</span>
          <span className="j-note-asterisk">✳</span>
          <h2>
            One campaign.
            <br />
            One clear action.
          </h2>
          <p>
            Start with a focused goal. Let people discover your business at
            their own pace.
          </p>
          <Link to="/help">
            How delivery works <ArrowUpRight size={18} />
          </Link>
        </section>
      </div>
      <Info>
        Metrics come from this shared demo's assignments—not estimated reach,
        follower growth or guaranteed sales.
      </Info>
      {connect && <ConnectInstagram onClose={() => setConnect(false)} />}
    </>
  );
}

export function Campaigns() {
  const { state } = useDemo();
  const [filter, setFilter] = useState("All campaigns");
  const [query, setQuery] = useState("");
  const own = state.campaigns.filter(
    (c) =>
      c.owned &&
      (filter === "All campaigns" || c.status === filter.toLowerCase()) &&
      c.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="FROM BRIEF TO CONNECTION"
        title="Your campaigns."
        copy="Keep an eye on every brief, budget and completed action."
        action={<NewCampaignLink />}
      />
      <div className="j-list-toolbar">
        <div className="j-tabs" role="group" aria-label="Campaign filters">
          {["All campaigns", "Live", "Paused", "Draft"].map((f) => (
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
        <label className="j-search">
          <Search size={18} />
          <input
            aria-label="Search campaigns"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search campaigns"
          />
        </label>
      </div>
      <div className="j-panel j-panel--flush">
        {own.length ? (
          own.map((c) => <CampaignRow key={c.id} campaign={c} />)
        ) : (
          <Empty
            title="No campaigns in this view"
            text="Try another filter, or create a new campaign."
            action={
              <Button
                kind="secondary"
                onClick={() => {
                  setFilter("All campaigns");
                  setQuery("");
                }}
              >
                Clear filters
              </Button>
            }
          />
        )}
      </div>
    </>
  );
}

export function CampaignBuilder() {
  const { campaignId } = useParams();
  const { state, send, toast } = useDemo();
  const navigate = useNavigate();
  const original = state.campaigns.find(
    (c) => c.id === campaignId && c.owned && c.status === "draft",
  );
  const [id] = useState(
    () => original?.id ?? `campaign-${crypto.randomUUID().slice(0, 8)}`,
  );
  const [step, setStep] = useState(1);
  const [connect, setConnect] = useState(false);
  const [topup, setTopup] = useState(false);
  const [name, setName] = useState(original?.name ?? "");
  const [kind, setKind] = useState<Campaign["kind"]>(
    original?.kind ?? "follow",
  );
  const [goal, setGoal] = useState(String(original?.goal ?? 100));
  const [days, setDays] = useState("7");
  const [prompt, setPrompt] = useState(
    original?.prompt ??
      "Tell us which detail catches your eye and why. Use your own words, with at least 20 characters.",
  );
  const [post, setPost] = useState(original?.post ?? "The everyday collection");
  const [agree, setAgree] = useState(false);
  const reward = kind === "follow" ? 8000 : 15000;
  const fee = 3000;
  const quantity = Number(goal) || 0;
  const campaign: Campaign = {
    id,
    name:
      name.trim() ||
      `${state.businessName} · ${kind === "follow" ? "new connections" : "join the conversation"}`,
    brand: state.businessName,
    handle: state.handle,
    category: "Style & culture",
    kind,
    goal: quantity,
    reward,
    fee,
    status: "draft",
    owned: true,
    theme: "plum",
    post,
    prompt,
    createdAt: original?.createdAt ?? state.clock,
    endsAt: state.clock + Number(days) * 24 * HOUR,
    funded: false,
    released: 0,
  };
  const total = budget(campaign);
  const validGoal =
    Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= 1000;
  const save = (leave = true) => {
    if (!validGoal) {
      toast("Choose between 1 and 1,000 places.");
      return false;
    }
    if (send({ type: "save-campaign", campaign })) {
      if (leave) {
        toast("Draft saved. Pick it up from Campaigns.");
        navigate(`/business/campaigns/${id}`);
      }
      return true;
    }
    return false;
  };
  const publish = () => {
    if (!agree) return;
    if (state.businessBalance < total) {
      setTopup(true);
      return;
    }
    if (save(false) && send({ type: "publish", id })) {
      toast("Campaign published. Switch to Worker to find it in Discover.");
      navigate(`/business/campaigns/${id}?created=1`);
    }
  };
  const stepNames = ["Account", "Your brief", "Budget", "Review"];
  return (
    <>
      <Link to="/business/campaigns" className="j-back">
        <ArrowLeft size={17} />
        Campaigns
      </Link>
      <PageHeading
        eyebrow="LET'S MAKE A CONNECTION"
        title="Create your campaign."
        copy="A thoughtful brief is the start of a better interaction."
      />
      <ol className="j-builder-progress">
        {stepNames.map((n, i) => (
          <li
            className={
              step > i + 1 ? "is-done" : step === i + 1 ? "is-current" : ""
            }
            key={n}
          >
            <span>{step > i + 1 ? <Check size={15} /> : `0${i + 1}`}</span>
            <strong>{n}</strong>
          </li>
        ))}
      </ol>
      <div className="j-builder-layout">
        <section className="j-builder-panel">
          <span className="j-eyebrow">STEP {step} OF 4</span>
          <h2>
            {
              [
                "Start with your Instagram.",
                "Give people one clear action.",
                "Set a budget that works for you.",
                "A final look before you go live.",
              ][step - 1]
            }
          </h2>
          <p className="j-muted">
            {
              [
                "Connect the account your campaign will support.",
                "Choose what to do, then tell people what matters.",
                "Your full campaign budget is reserved before anyone starts.",
                "These terms will stay fixed for everyone who accepts your task.",
              ][step - 1]
            }
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              step < 4 ? setStep(step + 1) : publish();
            }}
          >
            {step === 1 && (
              <>
                <div className="j-connection-tile">
                  <span className="j-connect-icon">
                    <Camera size={29} />
                  </span>
                  <div>
                    <strong>@{state.handle}</strong>
                    <span>
                      {state.connected
                        ? "Demo professional account"
                        : "Not connected"}
                    </span>
                  </div>
                  <Pill tone={state.connected ? "green" : "amber"}>
                    {state.connected ? "Ready" : "Connect"}
                  </Pill>
                </div>
                <Button kind="secondary" onClick={() => setConnect(true)}>
                  {state.connected ? "Review connection" : "Connect Instagram"}
                  <ArrowUpRight size={17} />
                </Button>
                <Info>
                  Only your connected account and its supported posts can be
                  used. Verification messages are part of the worker journey.
                </Info>
                <label className="j-field">
                  <span>
                    Campaign name <small>For your records</small>
                  </span>
                  <input
                    required
                    minLength={3}
                    maxLength={80}
                    placeholder="e.g. September studio introductions"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
              </>
            )}
            {step === 2 && (
              <>
                <div className="j-goal-options">
                  {(["follow", "comment"] as const).map((k) => (
                    <button
                      className={kind === k ? "is-selected" : ""}
                      type="button"
                      key={k}
                      aria-pressed={kind === k}
                      onClick={() => setKind(k)}
                    >
                      <span>
                        {k === "follow" ? <UserPlus /> : <MessageCircle />}
                      </span>
                      <div>
                        <strong>
                          {k === "follow"
                            ? "New followers"
                            : "Thoughtful comments"}
                        </strong>
                        <p>
                          {k === "follow"
                            ? "Introduce your business to new accounts."
                            : "Invite a fresh perspective on your post."}
                        </p>
                      </div>
                      <i>{kind === k && <Check size={13} />}</i>
                    </button>
                  ))}
                </div>
                {kind === "follow" ? (
                  <div className="j-target-preview">
                    <Camera size={20} />
                    <div>
                      <small>CAMPAIGN TARGET</small>
                      <strong>@{state.handle}</strong>
                    </div>
                    <CheckCircle2 size={19} />
                  </div>
                ) : (
                  <>
                    <label className="j-field">
                      <span>Select a demo post</span>
                      <select
                        value={post}
                        onChange={(e) => setPost(e.target.value)}
                      >
                        <option>The everyday collection</option>
                        <option>Behind the studio</option>
                        <option>A closer look at the details</option>
                      </select>
                    </label>
                    <div className="j-mini-post">
                      <PostArt campaign={campaign} />
                      <div>
                        <strong>{post}</strong>
                        <span>Sample owned post · Instagram</span>
                      </div>
                    </div>
                    <label className="j-field">
                      <span>Your comment prompt</span>
                      <textarea
                        required
                        minLength={20}
                        maxLength={500}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                      />
                      <small>
                        Ask for original opinions. Don't require praise or
                        identical copied comments.
                      </small>
                    </label>
                  </>
                )}
                <Info>
                  Likes, views, shares and other platforms are outside this
                  first pass. Comment verification is simulated until the
                  provider test passes.
                </Info>
              </>
            )}
            {step === 3 && (
              <>
                <label className="j-field">
                  <span>How many completed actions?</span>
                  <input
                    aria-label="Number of actions"
                    type="number"
                    required
                    min="1"
                    max="1000"
                    step="1"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                  />
                  <small>Between 1 and 1,000 places in this preview.</small>
                </label>
                <div className="j-amount-presets">
                  {[50, 100, 250, 500].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={quantity === n ? "is-selected" : ""}
                      onClick={() => setGoal(String(n))}
                    >
                      {n} actions
                    </button>
                  ))}
                </div>
                <label className="j-field">
                  <span>Accept new tasks for</span>
                  <select
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                  >
                    <option value="3">3 days</option>
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                  </select>
                </label>
                <div className="j-rate-card">
                  <div>
                    <span>Worker reward per action</span>
                    <strong>{money(reward)}</strong>
                  </div>
                  <div>
                    <span>Platform fee per action</span>
                    <strong>{money(fee)}</strong>
                  </div>
                  <div>
                    <span>Total per completed action</span>
                    <strong>{money(reward + fee)}</strong>
                  </div>
                </div>
                <Info>
                  These are illustrative demo rates, not final commercial
                  prices. Payment processing costs are not included.
                </Info>
              </>
            )}
            {step === 4 && (
              <>
                <div className="j-review-brief">
                  <BrandAvatar campaign={campaign} />
                  <div>
                    <h3>{campaign.name}</h3>
                    <span>@{state.handle}</span>
                  </div>
                </div>
                <dl className="j-review-details">
                  <div>
                    <dt>Requested action</dt>
                    <dd>
                      {kind === "follow" ? "New follow" : "Original comment"}
                    </dd>
                  </div>
                  <div>
                    <dt>Completed actions</dt>
                    <dd>{quantity}</dd>
                  </div>
                  <div>
                    <dt>Accepting tasks for</dt>
                    <dd>{days} days</dd>
                  </div>
                  <div>
                    <dt>Final verification</dt>
                    <dd>After a 48-hour hold</dd>
                  </div>
                  <div>
                    <dt>Campaign budget</dt>
                    <dd>{money(total)}</dd>
                  </div>
                </dl>
                <Info>
                  Unused allocations return to your demo balance when the
                  campaign closes. Active claims keep their original terms.
                </Info>
                <label className="j-checkbox">
                  <input
                    required
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                  />
                  <span>
                    I understand this campaign uses simulated funds and
                    verification. No real Instagram activity is being purchased.
                  </span>
                </label>
              </>
            )}
            <div className="j-builder-actions">
              <Button
                kind="ghost"
                onClick={() =>
                  step > 1 ? setStep(step - 1) : navigate("/business/campaigns")
                }
              >
                <ArrowLeft size={17} />
                {step > 1 ? "Back" : "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={
                  (step === 1 && !state.connected) ||
                  (step === 3 && !validGoal) ||
                  (step === 4 && !agree)
                }
              >
                {step === 4
                  ? state.businessBalance < total
                    ? "Add demo funds"
                    : "Publish demo campaign"
                  : "Continue"}
                <ArrowRight size={18} />
              </Button>
            </div>
          </form>
        </section>
        <aside className="j-builder-summary">
          <div className="j-summary-head">
            <span className="j-eyebrow">YOUR CAMPAIGN, AT A GLANCE</span>
            <Camera size={20} />
          </div>
          <h3>{campaign.name}</h3>
          <span className="j-muted">
            {kind === "follow" ? "Instagram follows" : "Instagram comments"}
          </span>
          <div className="j-summary-quantity">
            <strong>{quantity || "—"}</strong>
            <span>requested actions</span>
          </div>
          <div className="j-rate-card">
            <div>
              <span>Worker rewards</span>
              <strong>{money(quantity * reward)}</strong>
            </div>
            <div>
              <span>Platform fees</span>
              <strong>{money(quantity * fee)}</strong>
            </div>
          </div>
          <div className="j-summary-total">
            <span>Total reserved</span>
            <strong>{money(total)}</strong>
          </div>
          <div className="j-summary-balance">
            <Wallet size={18} />
            <span>{money(state.businessBalance)} available</span>
          </div>
          <Button kind="secondary" onClick={() => save()}>
            Save draft
          </Button>
          <p>
            <ShieldCheck size={15} />
            Funds are reserved, not immediately paid to workers.
          </p>
        </aside>
      </div>
      {connect && <ConnectInstagram onClose={() => setConnect(false)} />}{" "}
      {topup && (
        <TopUp
          suggested={(total - state.businessBalance) / 100}
          onClose={() => setTopup(false)}
        />
      )}
    </>
  );
}

export function CampaignDetail() {
  const { campaignId } = useParams();
  const { state, send, toast } = useDemo();
  const [close, setClose] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const c = state.campaigns.find((x) => x.id === campaignId && x.owned);
  if (!c)
    return (
      <Empty
        title="Campaign not found"
        text="Open your campaign list to choose a campaign."
        action={
          <ButtonLink to="/business/campaigns">Your campaigns</ButtonLink>
        }
      />
    );
  const assignments = campaignAssignments(state, c.id);
  const done = assignments.filter((a) => a.status === "settled").length;
  const pending = assignments.filter((a) =>
    ["pending", "review"].includes(a.status),
  ).length;
  const active = assignments.filter((a) =>
    ["reserved", "ready", "checking"].includes(a.status),
  ).length;
  const exportCsv = () => {
    const rows = [
      ["Assignment", "Status", "Reward NGN", "Verified at"],
      ...assignments.map((a) => [
        a.id,
        a.status,
        String(c.reward / 100),
        a.verifiedAt ? new Date(a.verifiedAt).toISOString() : "",
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        [
          rows
            .map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
            .join("\r\n"),
        ],
        { type: "text/csv;charset=utf-8;" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `realreach-${c.id}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Campaign receipt exported.");
  };
  return (
    <>
      <Link className="j-back" to="/business/campaigns">
        <ArrowLeft size={17} />
        Your campaigns
      </Link>
      <PageHeading
        eyebrow="CAMPAIGN WORKSPACE"
        title={c.name}
        action={<Status value={c.status} />}
      />
      <div className="j-campaign-detail-meta">
        <span>
          <Camera size={16} />@{c.handle}
        </span>
        <span>{c.kind === "follow" ? "New follows" : "Original comments"}</span>
        <span>Ends {dateTime(c.endsAt)}</span>
      </div>
      <div className="j-button-row j-campaign-actions">
        {c.status === "draft" ? (
          <ButtonLink to={`/business/campaigns/${c.id}/edit`}>
            Continue draft <ArrowRight size={17} />
          </ButtonLink>
        ) : (
          ["live", "paused"].includes(c.status) && (
            <>
              <Button
                kind="secondary"
                onClick={() =>
                  send({
                    type: "campaign-state",
                    id: c.id,
                    status: c.status === "live" ? "paused" : "live",
                  })
                }
              >
                {c.status === "live" ? (
                  <>
                    <Pause size={16} />
                    Pause campaign
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    Resume campaign
                  </>
                )}
              </Button>
              <Button kind="ghost" onClick={() => setClose(true)}>
                Close campaign
              </Button>
            </>
          )
        )}
        <Button kind="ghost" onClick={exportCsv}>
          <Download size={16} />
          Export receipts
        </Button>
      </div>
      <div className="j-stats-grid">
        <Stat
          label="Completed actions"
          value={
            <>
              {done}
              <small> / {c.goal}</small>
            </>
          }
          detail="Passed final verification"
        />
        <Stat
          label="Awaiting final check"
          value={pending}
          detail="Rewards remain pending"
        />
        <Stat
          label="In progress"
          value={active}
          detail="Places currently reserved"
        />
        <Stat
          label="Open places"
          value={c.status === "live" ? places(state, c) : "—"}
          detail={
            c.status === "live"
              ? "Available in the task feed"
              : "Not accepting new claims"
          }
        />
      </div>
      <div className="j-overview-columns">
        <section className="j-panel">
          <SectionHeading
            title="Delivery, with the details."
            aside={
              <Pill tone="green">
                <ShieldCheck size={13} />
                Evidence-led
              </Pill>
            }
          />
          <div className="j-delivery-progress">
            <strong>
              {Math.round((done / c.goal) * 100)}
              <small>%</small>
            </strong>
            <span>of your campaign delivered</span>
            <div className="j-progress-track">
              <i style={{ width: `${(done / c.goal) * 100}%` }} />
            </div>
          </div>
          {assignments.length ? (
            <div className="j-receipt-list">
              {assignments.map((a) => (
                <button key={a.id} onClick={() => setReceipt(a.id)}>
                  <span className="j-receipt-icon">
                    <ShieldCheck size={18} />
                  </span>
                  <div>
                    <strong>
                      Participant · {a.id.slice(-6).toUpperCase()}
                    </strong>
                    <small>{dateTime(a.createdAt)}</small>
                  </div>
                  <Status value={a.status} />
                  <ChevronRight size={17} />
                </button>
              ))}
            </div>
          ) : (
            <div className="j-inline-empty">
              <span>
                <Target size={27} />
              </span>
              <h3>
                {c.status === "draft"
                  ? "Your campaign is still a draft."
                  : "Ready for your first connection."}
              </h3>
              <p>
                {c.status === "draft"
                  ? "Finish the brief and fund it to open places."
                  : "Switch to the Worker workspace, accept this campaign and watch its progress appear here."}
              </p>
              {c.status === "live" && (
                <ButtonLink to={`/earn/tasks/${c.id}`} secondary>
                  Preview the worker journey <ArrowUpRight size={17} />
                </ButtonLink>
              )}
            </div>
          )}
        </section>
        <section className="j-budget-panel">
          <span className="j-eyebrow">EVERY NAIRA ACCOUNTED FOR</span>
          <h2>Campaign budget</h2>
          <strong className="j-budget-total">{money(budget(c))}</strong>
          <dl className="j-review-details">
            <div>
              <dt>Reserved, not spent</dt>
              <dd>{money(campaignHeld(state, c))}</dd>
            </div>
            <div>
              <dt>Settled spend</dt>
              <dd>{money(campaignSpent(state, c))}</dd>
            </div>
            <div>
              <dt>Returned unused</dt>
              <dd>{money(c.released)}</dd>
            </div>
            <div>
              <dt>Cost per action</dt>
              <dd>{money(unit(c))}</dd>
            </div>
          </dl>
          <p>
            Workers receive {money(c.reward)} per approved action. The platform
            fee is {money(c.fee)}.
          </p>
          <Info>
            There is no manual approve/reject button for ordinary verified work.
          </Info>
        </section>
      </div>
      {close && (
        <Modal title="Close this campaign?" onClose={() => setClose(false)}>
          <p>
            New claims will stop. Unallocated funds return to your demo balance;
            active and pending assignments keep their reserved funding.
          </p>
          <div className="j-button-row">
            <Button kind="secondary" onClick={() => setClose(false)}>
              Keep campaign
            </Button>
            <Button
              kind="danger"
              onClick={() => {
                send({ type: "campaign-state", id: c.id, status: "closing" });
                setClose(false);
                toast(
                  "Campaign closed to new claims. Unused funds reconciled.",
                );
              }}
            >
              Close campaign
            </Button>
          </div>
        </Modal>
      )}
      {receipt && (
        <Modal title="Delivery receipt" onClose={() => setReceipt(null)}>
          {(() => {
            const a = assignments.find((x) => x.id === receipt)!;
            return (
              <>
                <Status value={a.status} />
                <dl className="j-review-details">
                  <div>
                    <dt>Assignment</dt>
                    <dd>{a.id}</dd>
                  </div>
                  <div>
                    <dt>Action</dt>
                    <dd>{c.kind}</dd>
                  </div>
                  <div>
                    <dt>Worker reward</dt>
                    <dd>{money(c.reward)}</dd>
                  </div>
                  <div>
                    <dt>Detected</dt>
                    <dd>
                      {a.verifiedAt
                        ? dateTime(a.verifiedAt)
                        : "Not yet verified"}
                    </dd>
                  </div>
                </dl>
                <p>{a.reason}</p>
                <Info>
                  This demo receipt contains no private messages or bank
                  details. All verification is simulated.
                </Info>
              </>
            );
          })()}
        </Modal>
      )}
    </>
  );
}

export function BusinessFunds() {
  const { state } = useDemo();
  const [topup, setTopup] = useState(false);
  const own = state.campaigns.filter((c) => c.owned);
  return (
    <>
      <PageHeading
        eyebrow="THE FOUNDATION OF EVERY CAMPAIGN"
        title="Your campaign funds."
        copy="Know what's available, what's committed, and where it went."
      />
      <div className="j-finance-hero">
        <div>
          <span className="j-eyebrow">AVAILABLE TO PUT TO WORK</span>
          <strong>{money(state.businessBalance)}</strong>
          <p>Demo funds ready for your next campaign.</p>
          <Button onClick={() => setTopup(true)}>
            <Plus size={18} />
            Add demo funds
          </Button>
        </div>
        <div className="j-finance-side">
          <div>
            <span>Reserved for campaigns</span>
            <strong>
              {money(own.reduce((n, c) => n + campaignHeld(state, c), 0))}
            </strong>
          </div>
          <div>
            <span>Settled campaign spend</span>
            <strong>
              {money(own.reduce((n, c) => n + campaignSpent(state, c), 0))}
            </strong>
          </div>
        </div>
      </div>
      <Info>
        Reserved funds are not charged again when a worker claims a place.
        Closing a campaign releases only unused allocations.
      </Info>
      <section className="j-panel">
        <SectionHeading
          title="The full picture"
          aside={<Pill>Demo transaction history</Pill>}
        />
        <MoneyList events={state.money.filter((m) => m.side === "business")} />
      </section>
      {topup && <TopUp onClose={() => setTopup(false)} />}
    </>
  );
}
