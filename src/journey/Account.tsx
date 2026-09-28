import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Compass,
  Eye,
  EyeOff,
  FlaskConical,
  Landmark,
  LockKeyhole,
  LogOut,
  Mail,
  Plus,
  RotateCcw,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { money, pendingEarnings, type Front } from "./model";
import { useDemo } from "./store";
import { ConnectInstagram } from "./Business";
import {
  Button,
  ButtonLink,
  dateTime,
  DemoLab,
  Empty,
  Info,
  Logo,
  Modal,
  MoneyList,
  PageHeading,
  Pill,
  SectionHeading,
  Status,
} from "./ui";

export function WorkerWallet() {
  const { state, send, toast } = useDemo();
  const [bankOpen, setBankOpen] = useState(false);
  const [withdraw, setWithdraw] = useState(false);
  const [bank, setBank] = useState(
    state.bank ?? {
      name: "Demo Bank",
      number: "0000000000",
      holder: state.name,
    },
  );
  const [amount, setAmount] = useState("1000");
  const [reference, setReference] = useState("");
  const [filter, setFilter] = useState("All activity");
  const processing = state.withdrawals
    .filter((w) => w.status === "processing")
    .reduce((n, w) => n + w.amount, 0);
  const startWithdrawal = () => {
    if (!state.bank) {
      setBankOpen(true);
      return;
    }
    setReference(`withdrawal-${crypto.randomUUID().slice(0, 8)}`);
    setAmount(String(Math.min(1000, state.workerBalance / 100)));
    setWithdraw(true);
  };
  return (
    <>
      <PageHeading
        eyebrow="SMALL ACTIONS. SOMETHING TO SHOW FOR THEM."
        title="Your earnings, made clear."
        copy="A home for every reward, from the first check to your bank."
      />
      <div className="j-finance-hero j-finance-hero--worker">
        <div>
          <span className="j-eyebrow">AVAILABLE TO WITHDRAW</span>
          <strong>{money(state.workerBalance)}</strong>
          <p>Your cleared demo balance.</p>
          <Button onClick={startWithdrawal}>
            <ArrowUpRight size={18} />
            Withdraw
          </Button>
        </div>
        <div className="j-finance-side">
          <div>
            <span>Pending final verification</span>
            <strong>{money(pendingEarnings(state))}</strong>
          </div>
          <div>
            <span>Withdrawal processing</span>
            <strong>{money(processing)}</strong>
          </div>
        </div>
      </div>
      <div className="j-wallet-explain">
        <ShieldCheck size={21} />
        <p>
          <strong>Pending isn't the same as available.</strong> Task rewards
          stay pending until the holding period and final check are complete.
        </p>
      </div>
      <div className="j-bank-card">
        <span className="j-bank-icon">
          <Landmark size={23} />
        </span>
        <div>
          <strong>
            {state.bank ? state.bank.name : "Where should your earnings go?"}
          </strong>
          <span>
            {state.bank
              ? `${state.bank.holder} · •••• ${state.bank.number.slice(-4)}`
              : "Add a sample bank account to test withdrawals."}
          </span>
        </div>
        <Button
          kind="secondary"
          onClick={() => {
            setBank(state.bank ?? bank);
            setBankOpen(true);
          }}
        >
          {state.bank ? "Edit" : "Add bank"}
          <Plus size={16} />
        </Button>
      </div>
      <section className="j-panel">
        <SectionHeading title="Your money, in motion" />
        <div
          className="j-tabs"
          role="group"
          aria-label="Wallet activity filter"
        >
          {["All activity", "Withdrawals"].map((f) => (
            <button
              key={f}
              className={filter === f ? "is-active" : ""}
              aria-pressed={f === filter}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        {filter === "All activity" ? (
          <MoneyList events={state.money.filter((m) => m.side === "worker")} />
        ) : state.withdrawals.length ? (
          <div className="j-withdrawal-list">
            {state.withdrawals.map((w) => (
              <div key={w.id}>
                <span className="j-money-icon">
                  <ArrowUpRight size={19} />
                </span>
                <div>
                  <strong>{money(w.amount)}</strong>
                  <p>{w.bank}</p>
                  <small>{dateTime(w.at)}</small>
                </div>
                <Status value={w.status} />
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="No withdrawals yet"
            text="Your first transfer will appear here, with its status and receipt."
          />
        )}
      </section>
      {state.withdrawals.some((w) => w.status === "processing") && (
        <DemoLab>
          {state.withdrawals
            .filter((w) => w.status === "processing")
            .map((w) => (
              <div className="j-payout-test" key={w.id}>
                <strong>
                  {money(w.amount)} · {w.id.slice(-8)}
                </strong>
                <div className="j-button-row">
                  <Button
                    kind="secondary"
                    onClick={() =>
                      send({ type: "payout-result", id: w.id, success: true })
                    }
                  >
                    Simulate payout success
                  </Button>
                  <Button
                    kind="ghost"
                    onClick={() =>
                      send({ type: "payout-result", id: w.id, success: false })
                    }
                  >
                    Simulate payout failure
                  </Button>
                </div>
              </div>
            ))}
        </DemoLab>
      )}
      {bankOpen && (
        <Modal
          title="Your demo bank account"
          onClose={() => setBankOpen(false)}
        >
          <Info>
            Use sample details only. No account-name lookup or real bank
            verification is performed.
          </Info>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (send({ type: "bank", bank })) {
                setBankOpen(false);
                toast("Demo bank account saved.");
              }
            }}
          >
            <label className="j-field">
              <span>Bank</span>
              <select
                value={bank.name}
                onChange={(e) => setBank({ ...bank, name: e.target.value })}
              >
                <option>Demo Bank</option>
                <option>Sample Microfinance</option>
                <option>Test Savings Bank</option>
              </select>
            </label>
            <label className="j-field">
              <span>Sample account number</span>
              <input
                required
                inputMode="numeric"
                pattern="[0-9]{10}"
                maxLength={10}
                value={bank.number}
                onChange={(e) =>
                  setBank({
                    ...bank,
                    number: e.target.value.replace(/\D/g, ""),
                  })
                }
              />
              <small>10 digits. Please don't enter real bank details.</small>
            </label>
            <label className="j-field">
              <span>Sample account holder</span>
              <input
                required
                minLength={2}
                value={bank.holder}
                onChange={(e) => setBank({ ...bank, holder: e.target.value })}
              />
            </label>
            <Button type="submit">
              Save demo bank <Check size={17} />
            </Button>
          </form>
        </Modal>
      )}
      {withdraw && (
        <Modal
          title="Withdraw demo earnings"
          onClose={() => setWithdraw(false)}
        >
          <p className="j-muted">
            To {state.bank?.name} · •••• {state.bank?.number.slice(-4)}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (
                send({
                  type: "withdraw",
                  amount: Math.round(Number(amount) * 100),
                  reference,
                })
              ) {
                setWithdraw(false);
                toast(
                  "Demo withdrawal requested. Funds are held while it processes.",
                );
                setFilter("Withdrawals");
              }
            }}
          >
            <label className="j-field">
              <span>Amount in naira</span>
              <div className="j-input-prefix">
                <span>₦</span>
                <input
                  aria-label="Withdrawal amount"
                  type="number"
                  min="1000"
                  max={state.workerBalance / 100}
                  step="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <small>
                {money(state.workerBalance)} available · ₦1,000 demo minimum
              </small>
            </label>
            <div className="j-quote-mini">
              <span>Demo transfer fee</span>
              <strong>₦0</strong>
              <span>Sample amount received</span>
              <strong>{money((Number(amount) || 0) * 100)}</strong>
            </div>
            <Info>
              Live fees and timing will be confirmed with PocketFi. This request
              will not move real money.
            </Info>
            <Button type="submit" disabled={state.workerBalance < 100000}>
              Request demo withdrawal <ArrowUpRight size={18} />
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}

export function AccountPage({ front }: { front: Front }) {
  const { state, send, toast } = useDemo();
  const navigate = useNavigate();
  const [name, setName] = useState(state.name);
  const [email, setEmail] = useState(state.email);
  const [businessName, setBusinessName] = useState(state.businessName);
  const [connect, setConnect] = useState(false);
  const [disconnect, setDisconnect] = useState(false);
  const [reset, setReset] = useState(false);
  return (
    <>
      <PageHeading
        eyebrow="YOUR SPACE, YOUR SETTINGS"
        title={
          front === "business"
            ? "The details behind your business."
            : "Make yourself at home."
        }
        copy="Manage your profile, connections and preview preferences."
      />
      <div className="j-account-layout">
        <section className="j-panel">
          <div className="j-profile-header">
            <span className="j-profile-avatar">{state.name[0]}</span>
            <div>
              <h2>{state.name}</h2>
              <p>{state.email}</p>
              <Pill>Demo profile</Pill>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (
                send({
                  type: "profile",
                  name: name.trim(),
                  email: email.trim(),
                  businessName: businessName.trim(),
                })
              )
                toast("Profile saved in this browser.");
            }}
          >
            <label className="j-field">
              <span>Your name</span>
              <input
                required
                minLength={2}
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="j-field">
              <span>Email address</span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <small>
                Demo only. Changing this does not verify or send email.
              </small>
            </label>
            {front === "business" && (
              <label className="j-field">
                <span>Business name</span>
                <input
                  required
                  minLength={2}
                  maxLength={60}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </label>
            )}
            <Button type="submit">
              Save profile <Check size={17} />
            </Button>
          </form>
        </section>
        <div>
          <section className="j-panel">
            <SectionHeading
              title={
                front === "business"
                  ? "Instagram connection"
                  : "Instagram verification"
              }
            />
            {front === "business" ? (
              <>
                <div className="j-connected-account">
                  <Camera size={26} />
                  <div>
                    <strong>@{state.handle}</strong>
                    <Status value={state.connected ? "ready" : "paused"} />
                  </div>
                </div>
                <p>
                  Verification uses this business's account context. The live
                  version will connect through authorized Instagram login.
                </p>
                <div className="j-button-row">
                  <Button kind="secondary" onClick={() => setConnect(true)}>
                    {state.connected ? "Review connection" : "Reconnect"}
                  </Button>
                  {state.connected && (
                    <Button kind="ghost" onClick={() => setDisconnect(true)}>
                      Disconnect demo
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <Info>
                  Your Instagram account is identified through a verification
                  message to each business you work with. You never give
                  RealReach your Instagram password.
                </Info>
                {state.bindings.length ? (
                  state.bindings.map((h) => (
                    <div key={h} className="j-binding">
                      <Camera size={18} />
                      <strong>@{h}</strong>
                      <Pill tone="green">Demo verified</Pill>
                    </div>
                  ))
                ) : (
                  <p className="j-muted">
                    Your verified business connections will appear after your
                    first task.
                  </p>
                )}
              </>
            )}
          </section>
          <section className="j-panel">
            <SectionHeading title="Stay in the loop" />
            {(["email", "updates"] as const).map((key) => (
              <label key={key} className="j-toggle">
                <div>
                  <strong>
                    {key === "email" ? "Account emails" : "Task updates"}
                  </strong>
                  <span>
                    {key === "email"
                      ? "Payment and account notifications"
                      : "News about available opportunities"}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={state.preferences[key]}
                  onChange={() => send({ type: "preference", key })}
                />
                <i aria-hidden="true" />
              </label>
            ))}
            <small className="j-muted">
              Preferences are saved locally. No notifications are sent.
            </small>
          </section>
        </div>
      </div>
      <div className="j-account-actions">
        <Button
          kind="secondary"
          onClick={() => {
            send({ type: "signout" });
            navigate("/login");
          }}
        >
          <LogOut size={18} />
          Sign out of preview
        </Button>
        <Link to="/forgot-password" className="j-text-link">
          <LockKeyhole size={17} />
          Password recovery preview
        </Link>
        <Button kind="ghost" onClick={() => setReset(true)}>
          <RotateCcw size={16} />
          Reset demo workspace
        </Button>
      </div>
      {connect && <ConnectInstagram onClose={() => setConnect(false)} />}
      {disconnect && (
        <Modal
          title="Disconnect demo Instagram?"
          onClose={() => setDisconnect(false)}
        >
          <p>
            New claims on your campaigns and final checks will wait for
            reconnection. Existing funds and assignments remain intact.
          </p>
          <div className="j-button-row">
            <Button kind="secondary" onClick={() => setDisconnect(false)}>
              Keep connected
            </Button>
            <Button
              kind="danger"
              onClick={() => {
                send({
                  type: "connection",
                  handle: state.handle,
                  connected: false,
                });
                setDisconnect(false);
              }}
            >
              Disconnect
            </Button>
          </div>
        </Modal>
      )}
      {reset && (
        <Modal title="Start the demo again?" onClose={() => setReset(false)}>
          <p>
            This removes this preview's campaigns, task progress, profile
            changes and simulated transactions from this browser, and restores
            the sample workspace. Your earlier prototype data is not touched.
          </p>
          <div className="j-button-row">
            <Button kind="secondary" onClick={() => setReset(false)}>
              Keep my progress
            </Button>
            <Button
              kind="danger"
              onClick={() => {
                send({ type: "reset" });
                setReset(false);
                navigate(front === "worker" ? "/earn" : `/${front}`);
              }}
            >
              Reset this preview
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function AuthScreen({
  mode,
}: {
  mode: "login" | "signup" | "forgot" | "verify" | "reset";
}) {
  const { state, send } = useDemo();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [front, setFront] = useState<"worker" | "business">(
    params.get("role") === "business" ? "business" : "worker",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [sent, setSent] = useState(false);
  const title =
    mode === "signup"
      ? "Your next chapter\nstarts here."
      : mode === "forgot"
        ? "Let's get you\nback in."
        : mode === "verify"
          ? "One small check.\nThen you're in."
          : mode === "reset"
            ? "A fresh start\nfor your password."
            : "Good to have\nyou back.";
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === "forgot" || mode === "reset") {
      setSent(true);
      return;
    }
    send({
      type: "session",
      front,
      name: name || state.name,
      email: email || state.email,
    });
    if (mode === "signup")
      navigate(
        `/verify-email?role=${front === "business" ? "business" : "worker"}`,
      );
    else navigate(front === "business" ? "/business" : "/earn");
  };
  return (
    <div className="journey j-auth">
      <div className="j-auth-story">
        <Logo light />
        <div>
          <Pill tone="lime">REAL PEOPLE. REAL POSSIBILITY.</Pill>
          <h2>
            A little attention.
            <br />A world of
            <br />
            <em>possibility.</em>
          </h2>
          <p>
            Connecting people with the businesses
            <br />
            worth getting to know.
          </p>
        </div>
        <img
          src="/realreach-hero.webp"
          alt="A woman looking at her phone in a bright creative workspace"
        />
        <span className="j-auth-caption">
          Made for people. Built for connection.
        </span>
      </div>
      <div className="j-auth-form-side">
        <div className="j-auth-mobile-logo">
          <Logo />
        </div>
        <Link className="j-auth-home" to="/">
          <ArrowLeft size={16} />
          Back to RealReach
        </Link>
        <div className="j-auth-content">
          <span className="j-eyebrow">
            {mode === "signup"
              ? "JOIN REALREACH"
              : mode === "forgot" || mode === "reset"
                ? "ACCOUNT RECOVERY"
                : "WELCOME TO YOUR WORKSPACE"}
          </span>
          <h1>
            {title.split("\n").map((t, i) => (
              <span key={t}>
                {i > 0 && <br />}
                {t}
              </span>
            ))}
          </h1>
          <p className="j-muted">
            {mode === "signup"
              ? "Find your next small win, or bring your business to new people."
              : mode === "verify"
                ? "This is where we'll confirm your email in the live product."
                : mode === "forgot"
                  ? "We'll guide you through the recovery experience."
                  : "Pick up where you left off. Something good is waiting."}
          </p>
          {mode === "verify" ? (
            <>
              <div className="j-email-illustration">
                <Mail size={34} />
                <CheckCircle2 size={20} />
              </div>
              <Info>
                No email was sent. This button simulates a verified email for
                the frontend journey.
              </Info>
              <Button
                onClick={() => {
                  send({ type: "session", front });
                  navigate(front === "business" ? "/business" : "/earn");
                }}
              >
                Simulate verified email <ArrowRight size={18} />
              </Button>
              <Button kind="ghost" onClick={() => setSent(true)}>
                {sent ? "Demo email resend shown" : "Preview resend email"}
              </Button>
            </>
          ) : sent ? (
            <div className="j-auth-success">
              <CheckCircle2 size={38} />
              <h2>
                {mode === "forgot"
                  ? "Recovery screen previewed."
                  : "Password reset previewed."}
              </h2>
              <p>
                No email was sent and no real password was changed.
                Authentication will be connected in the backend pass.
              </p>
              <ButtonLink to={mode === "forgot" ? "/reset-password" : "/login"}>
                {mode === "forgot" ? "Preview reset screen" : "Back to sign in"}
                <ArrowRight size={17} />
              </ButtonLink>
            </div>
          ) : (
            <form onSubmit={submit}>
              {(mode === "login" || mode === "signup") && (
                <div
                  className="j-auth-role"
                  role="group"
                  aria-label="Choose workspace"
                >
                  <button
                    type="button"
                    className={front === "worker" ? "is-selected" : ""}
                    aria-pressed={front === "worker"}
                    onClick={() => setFront("worker")}
                  >
                    <Compass size={19} />
                    <span>I want to earn</span>
                  </button>
                  <button
                    type="button"
                    className={front === "business" ? "is-selected" : ""}
                    aria-pressed={front === "business"}
                    onClick={() => setFront("business")}
                  >
                    <BriefcaseBusiness size={19} />
                    <span>I'm a business</span>
                  </button>
                </div>
              )}
              {mode === "signup" && (
                <label className="j-field">
                  <span>Your name</span>
                  <input
                    required
                    minLength={2}
                    autoComplete="name"
                    placeholder="What should we call you?"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
              )}
              {mode !== "reset" && (
                <label className="j-field">
                  <span>Email address</span>
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              )}
              {mode !== "forgot" && (
                <label className="j-field">
                  <span>{mode === "reset" ? "New password" : "Password"}</span>
                  <div className="j-password-input">
                    <input
                      required
                      minLength={8}
                      type={show ? "text" : "password"}
                      autoComplete="off"
                      placeholder="Use a sample password, 8+ characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      aria-label={show ? "Hide password" : "Show password"}
                      onClick={() => setShow(!show)}
                    >
                      {show ? <EyeOff size={19} /> : <Eye size={19} />}
                    </button>
                  </div>
                </label>
              )}
              {mode === "login" && (
                <div className="j-auth-forgot">
                  <Link to="/forgot-password">Forgot password?</Link>
                </div>
              )}
              {mode === "signup" && (
                <label className="j-checkbox">
                  <input required type="checkbox" />
                  <span>
                    I agree to the <Link to="/terms">preview terms</Link> and
                    understand this is not a live earning service.
                  </span>
                </label>
              )}
              <Button type="submit">
                {mode === "signup"
                  ? "Create demo account"
                  : mode === "forgot"
                    ? "Preview recovery email"
                    : mode === "reset"
                      ? "Preview password reset"
                      : "Sign in to preview"}
                <ArrowRight size={18} />
              </Button>
            </form>
          )}
          <div className="j-auth-demo-note">
            <FlaskConical size={17} />
            <p>
              Interactive demo. Use sample details only. Passwords are never
              saved or checked against a real account.
            </p>
          </div>
          {mode === "login" || mode === "signup" ? (
            <>
              <p className="j-auth-switch">
                {mode === "login"
                  ? "New around here?"
                  : "Already have a workspace?"}{" "}
                <Link to={mode === "login" ? "/signup" : "/login"}>
                  {mode === "login" ? "Create an account" : "Sign in"}
                </Link>
              </p>
              <button
                className="j-demo-entry"
                onClick={() => {
                  send({ type: "session", front });
                  navigate(front === "business" ? "/business" : "/earn");
                }}
              >
                Explore the {front} demo without a form{" "}
                <ArrowUpRight size={16} />
              </button>
            </>
          ) : (
            <Link to="/login" className="j-text-link">
              Back to sign in
            </Link>
          )}
        </div>
        <small className="j-auth-footer">
          RealReach · Thoughtful connections, everyday.
        </small>
      </div>
    </div>
  );
}

export function HelpPage({ legal = false }: { legal?: boolean }) {
  return (
    <>
      <PageHeading
        eyebrow={legal ? "CLEAR EXPECTATIONS" : "A LITTLE GUIDANCE"}
        title={
          legal
            ? "About this product preview."
            : "A clear path, from either side."
        }
        copy="Everything you need to explore the connected demo."
      />
      <div className="j-help-grid">
        {[
          [
            "For workers",
            "Find a task in Discover, accept a place, simulate the verification DM, then request a task check. Use Demo controls to advance the holding period and see your reward become available.",
          ],
          [
            "For businesses",
            "Create an Instagram campaign, review its budget and publish with demo funds. Switch to Worker to complete that same campaign, then return to see its delivery receipt.",
          ],
          [
            "When something goes wrong",
            "Use Demo controls to test unavailable verification, a missing action or a failed payout. Unknown results don't automatically become paid rewards or worker failures.",
          ],
          [
            "Your data in this preview",
            "Progress is stored only in this browser. Use sample details; don't enter real passwords or bank details. Reset demo workspace in Account to remove this preview's local data.",
          ],
          [
            "What isn't connected yet",
            "Supabase authentication and authorization, Instagram verification, PocketFi payments and email delivery are not connected. All admin views are openly available for testing only.",
          ],
          [
            "Before a paid launch",
            "Instagram's rules prohibit paying for followers, likes and comments. The technical preview does not establish commercial permission. That separate release gate must be resolved before selling this model.",
          ],
        ].map(([title, text]) => (
          <section className="j-panel" key={title}>
            <span className="j-help-icon">
              <CircleHelp size={22} />
            </span>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
      </div>
      <div className="j-button-row">
        <ButtonLink to="/earn">
          Explore as a worker <Compass size={18} />
        </ButtonLink>
        <ButtonLink to="/business" secondary>
          Explore as a business <BriefcaseBusiness size={18} />
        </ButtonLink>
      </div>
    </>
  );
}
