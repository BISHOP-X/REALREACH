import { FormEvent, ReactNode, useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  BarChart3,
  Bell,
  Building2,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Eye,
  EyeOff,
  Gauge,
  Heart,
  HelpCircle,
  Home,
  Camera as Instagram,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  MessageCircle,
  MousePointer2,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  Users,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import {
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  AdminProduct,
  BusinessProduct,
  EarnerProduct,
  ProductProvider,
} from "./ProductApp";

type Role = "earner" | "business";

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      className={cx("brand", light && "brand--light")}
      to="/"
      aria-label="RealReach home"
    >
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
      </span>
      <span>realreach</span>
    </Link>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header className="site-header">
      <div className="container nav-wrap">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="/#how">How it works</a>
          <a href="/#businesses">For businesses</a>
          <a href="/#earners">For earners</a>
          <a href="/#trust">Why RealReach</a>
        </nav>
        <div className="nav-actions">
          <Link className="text-link nav-login" to="/login">
            Log in
          </Link>
          <Link className="button button--small button--ink" to="/signup">
            Join RealReach <ArrowRight size={16} />
          </Link>
          <button
            className="menu-button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label="Toggle menu"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      <div className={cx("mobile-menu", open && "is-open")}>
        <a href="/#how">How it works</a>
        <a href="/#businesses">For businesses</a>
        <a href="/#earners">For earners</a>
        <Link to="/login">Log in</Link>
        <Link className="button button--ink" to="/signup">
          Create an account
        </Link>
      </div>
    </header>
  );
}

function LandingPage() {
  return (
    <main>
      <Header />
      <section className="hero">
        <div className="hero-glow hero-glow--one" />
        <div className="hero-glow hero-glow--two" />
        <div className="container hero-grid">
          <div className="hero-copy reveal">
            <div className="eyebrow">
              <span className="eyebrow-dot" /> Built for real attention
            </div>
            <h1>
              Your next customer is already <em>scrolling.</em>
            </h1>
            <p>
              RealReach connects Nigerian businesses with genuine people—while
              rewarding those people for verified attention and participation.
            </p>
            <div className="hero-actions">
              <Link
                className="button button--coral button--large"
                to="/signup?role=business"
              >
                Grow my business <ArrowRight size={18} />
              </Link>
              <Link
                className="button button--ghost button--large"
                to="/signup?role=earner"
              >
                Earn with RealReach
              </Link>
            </div>
            <div className="hero-proof">
              <div className="avatars" aria-hidden="true">
                <span>AO</span>
                <span>KM</span>
                <span>TI</span>
                <span>+</span>
              </div>
              <p>
                <strong>Human, verified participation.</strong>
                <br />
                Not bots. Not empty numbers.
              </p>
            </div>
          </div>

          <div className="hero-visual reveal reveal--delay">
            <div className="photo-frame">
              <img
                src="/realreach-hero.webp"
                alt="A Nigerian entrepreneur using her phone in a modern creative studio"
              />
              <div className="photo-shade" />
              <div className="floating-card floating-card--top">
                <span className="mini-icon mini-icon--lime">
                  <BadgeCheck size={17} />
                </span>
                <div>
                  <strong>842 verified</strong>
                  <small>campaign actions</small>
                </div>
                <span className="trend">+18%</span>
              </div>
              <div className="floating-card floating-card--bottom">
                <div className="earn-ring">
                  <span>₦</span>
                </div>
                <div>
                  <small>Available balance</small>
                  <strong>₦4,850</strong>
                </div>
                <ChevronRight size={18} />
              </div>
            </div>
            <div className="orbit-label orbit-label--one">
              <Heart size={15} fill="currentColor" /> Real people
            </div>
            <div className="orbit-label orbit-label--two">
              <Target size={15} /> Better fit
            </div>
          </div>
        </div>
        <div className="container signal-strip">
          <span>REAL PEOPLE</span>
          <i />
          <span>VERIFIED ACTIONS</span>
          <i />
          <span>SMARTER MATCHING</span>
          <i />
          <span>TRANSPARENT RESULTS</span>
        </div>
      </section>

      <section className="section statement" id="trust">
        <div className="container statement-grid">
          <div>
            <span className="section-kicker">The RealReach difference</span>
            <h2>
              Attention shouldn’t be fake.
              <br />
              It shouldn’t be wasted.
            </h2>
          </div>
          <div className="statement-copy">
            <p>
              Follower counts can look impressive and still mean nothing.
              RealReach is building a marketplace where businesses buy
              measurable human attention—not faceless activity.
            </p>
            <a className="arrow-link" href="#how">
              See how it works <ArrowRight size={17} />
            </a>
          </div>
        </div>
        <div className="container value-grid">
          <ValueCard
            number="01"
            icon={<Users />}
            title="Genuinely human"
            text="Every action comes from a real participant with a real account and a platform history."
          />
          <ValueCard
            number="02"
            icon={<ShieldCheck />}
            title="Verified participation"
            text="Clear task rules, evidence checks and reputation signals protect campaign quality."
          />
          <ValueCard
            number="03"
            icon={<Target />}
            title="More relevant over time"
            text="Matching improves as RealReach learns what people reliably engage with and care about."
          />
        </div>
      </section>

      <section className="section path-section" id="businesses">
        <div className="container">
          <div className="section-heading centered">
            <span className="section-kicker">
              One marketplace. Two ways in.
            </span>
            <h2>Reach people—or get rewarded for being one.</h2>
          </div>
          <div className="path-grid">
            <article className="path-card path-card--business">
              <div className="path-card-head">
                <span className="role-icon">
                  <Building2 />
                </span>
                <span>For businesses</span>
              </div>
              <h3>Turn campaign spend into real human discovery.</h3>
              <p>
                Create a campaign, choose who you want to reach and track
                verified participation from one clear dashboard.
              </p>
              <ul>
                <li>
                  <Check size={17} /> Campaigns built around real actions
                </li>
                <li>
                  <Check size={17} /> Audience quality you can understand
                </li>
                <li>
                  <Check size={17} /> Results beyond “delivered”
                </li>
              </ul>
              <Link className="button button--light" to="/signup?role=business">
                Start a campaign <ArrowRight size={17} />
              </Link>
              <div className="mini-dashboard" aria-hidden="true">
                <div className="mini-dash-top">
                  <span>Campaign health</span>
                  <b>Live</b>
                </div>
                <div className="mini-metric">
                  <div>
                    <small>Verified reach</small>
                    <strong>842</strong>
                  </div>
                  <div className="spark-bars">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
                <div className="progress-line">
                  <span style={{ width: "84%" }} />
                </div>
                <div className="mini-dash-foot">
                  <span>Goal: 1,000 people</span>
                  <strong>84%</strong>
                </div>
              </div>
            </article>

            <article className="path-card path-card--earner" id="earners">
              <div className="path-card-head">
                <span className="role-icon">
                  <UserRound />
                </span>
                <span>For earners</span>
              </div>
              <h3>Your attention has value. Make it count.</h3>
              <p>
                Discover approved opportunities, complete straightforward tasks
                and earn directly from your phone.
              </p>
              <ul>
                <li>
                  <Check size={17} /> Tasks that fit your profile
                </li>
                <li>
                  <Check size={17} /> Clear rewards before you begin
                </li>
                <li>
                  <Check size={17} /> Build trust and unlock more
                </li>
              </ul>
              <Link className="button button--ink" to="/signup?role=earner">
                Start earning <ArrowRight size={17} />
              </Link>
              <div className="task-preview" aria-hidden="true">
                <div className="task-logo">
                  <Instagram size={20} />
                </div>
                <div className="task-preview-copy">
                  <small>Social discovery · 3 min</small>
                  <strong>Explore Kora Living’s new collection</strong>
                  <span>
                    <i /> Lagos · Lifestyle
                  </span>
                </div>
                <b>₦250</b>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="section how-section" id="how">
        <div className="container how-grid">
          <div className="how-intro">
            <span className="section-kicker section-kicker--light">
              Simple by design
            </span>
            <h2>From campaign to real attention in four clear steps.</h2>
            <p>
              RealReach handles the assignment, evidence and reward flow—so both
              sides always know what happens next.
            </p>
            <Link className="button button--coral" to="/signup">
              Join the marketplace <ArrowRight size={17} />
            </Link>
          </div>
          <div className="steps-list">
            <Step
              number="01"
              title="A business creates a campaign"
              text="Choose an action, audience and budget with clear expectations."
              icon={<Plus />}
            />
            <Step
              number="02"
              title="RealReach matches eligible people"
              text="Opportunities go to genuine users who fit the campaign rules."
              icon={<Target />}
            />
            <Step
              number="03"
              title="People participate and submit"
              text="The action happens, evidence returns and verification begins."
              icon={<MousePointer2 />}
            />
            <Step
              number="04"
              title="Results and rewards are released"
              text="Businesses see progress. Approved earners get paid."
              icon={<CircleDollarSign />}
            />
          </div>
        </div>
      </section>

      <section className="section quality-section">
        <div className="container">
          <div className="section-heading quality-heading">
            <div>
              <span className="section-kicker">Built to get smarter</span>
              <h2>Not every audience is equal.</h2>
            </div>
            <p>
              RealReach begins with verified human participation and
              progressively improves audience quality through reliable,
              consented signals.
            </p>
          </div>
          <div className="quality-ladder">
            <Quality
              index="01"
              label="General reach"
              text="Real Nigerians. Genuine participation."
              tone="paper"
            />
            <Quality
              index="02"
              label="Targeted reach"
              text="People matched by useful profile signals."
              tone="sand"
            />
            <Quality
              index="03"
              label="Demonstrated interest"
              text="People with stronger evidence of relevance."
              tone="lime"
            />
            <Quality
              index="04"
              label="Qualified intent"
              text="People who actively request the next step."
              tone="coral"
            />
          </div>
        </div>
      </section>

      <section className="section product-section">
        <div className="container product-grid">
          <div className="phone-stage">
            <div
              className="phone-shell"
              aria-label="RealReach earner dashboard preview"
            >
              <div className="phone-status">
                <span>9:41</span>
                <span>● ● ▰</span>
              </div>
              <div className="phone-top">
                <div>
                  <small>Good morning, Ada</small>
                  <strong>Find your next task</strong>
                </div>
                <span>
                  <Bell size={18} />
                </span>
              </div>
              <div className="balance-card">
                <span>
                  <small>Available balance</small>
                  <strong>₦4,850.00</strong>
                </span>
                <button>Withdraw</button>
              </div>
              <div className="task-title">
                <strong>Matched for you</strong>
                <span>See all</span>
              </div>
              <PhoneTask
                icon={<Instagram />}
                title="Discover Kora Living"
                meta="Lifestyle · 3 min"
                amount="₦250"
                color="peach"
              />
              <PhoneTask
                icon={<MessageCircle />}
                title="Share your skincare habits"
                meta="Beauty · 6 min"
                amount="₦450"
                color="lilac"
              />
              <PhoneTask
                icon={<MousePointer2 />}
                title="Explore a new food menu"
                meta="Food · 4 min"
                amount="₦300"
                color="lime"
              />
              <div className="phone-nav">
                <span className="active">
                  <Home />
                  Home
                </span>
                <span>
                  <Search />
                  Explore
                </span>
                <span>
                  <WalletCards />
                  Wallet
                </span>
                <span>
                  <UserRound />
                  Profile
                </span>
              </div>
            </div>
          </div>
          <div className="product-copy">
            <span className="section-kicker">
              Made for the phone in your hand
            </span>
            <h2>
              Fast enough for a spare five minutes. Clear enough to trust.
            </h2>
            <p>
              No cluttered job board. No mystery payouts. Earners see why a task
              matches, what it requires, how long it should take and exactly
              what it pays.
            </p>
            <div className="feature-list">
              <Feature
                icon={<Zap />}
                title="Quick, focused actions"
                text="Every task is broken into a short, readable flow."
              />
              <Feature
                icon={<Gauge />}
                title="A reputation that grows"
                text="Reliable participation unlocks better opportunities."
              />
              <Feature
                icon={<WalletCards />}
                title="Money made transparent"
                text="Pending, available and paid balances stay distinct."
              />
            </div>
            <Link className="arrow-link" to="/earn">
              Explore the earner demo <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      <section className="closing-cta">
        <div className="container cta-inner">
          <div>
            <span className="section-kicker section-kicker--light">
              The marketplace for real attention
            </span>
            <h2>There’s more value on both sides of the screen.</h2>
          </div>
          <div className="cta-actions">
            <Link
              className="button button--coral button--large"
              to="/signup?role=business"
            >
              Grow a business
            </Link>
            <Link
              className="button button--outline-light button--large"
              to="/signup?role=earner"
            >
              Start earning
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}

function ValueCard({
  number,
  icon,
  title,
  text,
}: {
  number: string;
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <article className="value-card">
      <div className="value-top">
        <span>{icon}</span>
        <small>{number}</small>
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function Step({
  number,
  title,
  text,
  icon,
}: {
  number: string;
  title: string;
  text: string;
  icon: ReactNode;
}) {
  return (
    <article className="step">
      <div className="step-number">{number}</div>
      <div className="step-icon">{icon}</div>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </article>
  );
}

function Quality({
  index,
  label,
  text,
  tone,
}: {
  index: string;
  label: string;
  text: string;
  tone: string;
}) {
  return (
    <article className={`quality quality--${tone}`}>
      <span>{index}</span>
      <div>
        <h3>{label}</h3>
        <p>{text}</p>
      </div>
      <ArrowRight size={20} />
    </article>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="feature">
      <span>{icon}</span>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}

function PhoneTask({
  icon,
  title,
  meta,
  amount,
  color,
}: {
  icon: ReactNode;
  title: string;
  meta: string;
  amount: string;
  color: string;
}) {
  return (
    <div className="phone-task">
      <span className={`phone-task-icon phone-task-icon--${color}`}>
        {icon}
      </span>
      <div>
        <strong>{title}</strong>
        <small>{meta}</small>
      </div>
      <b>{amount}</b>
    </div>
  );
}

function Footer() {
  return (
    <footer>
      <div className="container footer-grid">
        <div className="footer-brand">
          <Brand light />
          <p>
            Real people. Meaningful attention.
            <br />
            Better reach for Nigerian businesses.
          </p>
        </div>
        <div>
          <h4>Platform</h4>
          <a href="/#how">How it works</a>
          <a href="/#businesses">For businesses</a>
          <a href="/#earners">For earners</a>
        </div>
        <div>
          <h4>Company</h4>
          <a href="#">About</a>
          <a href="#">Trust & safety</a>
          <a href="#">Contact</a>
        </div>
        <div>
          <h4>Get started</h4>
          <Link to="/login">Log in</Link>
          <Link to="/signup?role=earner">Create earner account</Link>
          <Link to="/signup?role=business">Create business account</Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© 2026 RealReach. Built for Nigeria.</span>
        <div>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
        </div>
      </div>
    </footer>
  );
}

function AuthPage({ initialMode }: { initialMode: "login" | "signup" }) {
  const [params] = useSearchParams();
  const [role, setRole] = useState<Role>(
    params.get("role") === "business" ? "business" : "earner",
  );
  const [mode, setMode] = useState(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (mode === "signup" && step === 1) {
      setStep(2);
      return;
    }
    navigate(role === "business" ? "/business" : "/earn");
  };

  const switchMode = (next: "login" | "signup") => {
    setMode(next);
    setStep(1);
  };

  return (
    <main className="auth-page">
      <div className="auth-brand">
        <Brand />
      </div>
      <section className="auth-story">
        <div className="auth-story-inner">
          <span className="section-kicker section-kicker--light">
            Welcome to RealReach
          </span>
          <h1>
            {role === "business"
              ? "Reach people who can actually pay attention."
              : "Turn spare moments into real earning power."}
          </h1>
          <p>
            {role === "business"
              ? "Build campaigns around verified human participation and see every result clearly."
              : "Find straightforward opportunities, know the reward upfront and build a reputation that opens more doors."}
          </p>
          <div className="auth-quote">
            <div className="quote-mark">“</div>
            <p>
              One marketplace, designed to create value on both sides of the
              screen.
            </p>
          </div>
        </div>
        <div className="auth-orb auth-orb--one" />
        <div className="auth-orb auth-orb--two" />
      </section>
      <section className="auth-form-side">
        <div className="auth-card">
          <div className="auth-mobile-brand">
            <Brand />
          </div>
          <div className="auth-heading">
            <span>
              {mode === "login"
                ? "Welcome back"
                : step === 1
                  ? "Create your account"
                  : "A little more about you"}
            </span>
            <h2>
              {mode === "login"
                ? "Log in to RealReach"
                : role === "business"
                  ? "Start reaching real people"
                  : "Start earning with RealReach"}
            </h2>
            <p>
              {mode === "login"
                ? "Choose your account type and continue."
                : `Step ${step} of 2 · Takes about two minutes.`}
            </p>
          </div>
          <div className="role-switch" role="group" aria-label="Account type">
            <button
              className={role === "earner" ? "active" : ""}
              onClick={() => {
                setRole("earner");
                setStep(1);
              }}
            >
              <UserRound size={18} />
              <span>
                <strong>Earner</strong>
                <small>I want to earn</small>
              </span>
            </button>
            <button
              className={role === "business" ? "active" : ""}
              onClick={() => {
                setRole("business");
                setStep(1);
              }}
            >
              <Building2 size={18} />
              <span>
                <strong>Business</strong>
                <small>I want to grow</small>
              </span>
            </button>
          </div>
          <form onSubmit={submit} autoComplete="off">
            {mode === "signup" && step === 1 && (
              <>
                <Field
                  label={role === "business" ? "Your full name" : "Full name"}
                  placeholder="e.g. Ada Okafor"
                  autoComplete="name"
                />
                {role === "business" && (
                  <Field
                    label="Business name"
                    placeholder="e.g. Kora Living"
                    autoComplete="organization"
                  />
                )}
                <Field
                  label="Email address"
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                />
                <Field
                  label="Phone number"
                  placeholder="080 1234 5678"
                  type="tel"
                  prefix="+234"
                  autoComplete="tel-national"
                />
              </>
            )}
            {mode === "signup" && step === 2 && (
              <>
                <Field
                  label={
                    role === "business"
                      ? "What does your business do?"
                      : "Where are you based?"
                  }
                  placeholder={
                    role === "business" ? "Choose a category" : "City, state"
                  }
                />
                <Field
                  label={
                    role === "business"
                      ? "Business website or social page"
                      : "Instagram username"
                  }
                  placeholder={role === "business" ? "https://" : "@username"}
                  autoComplete={role === "business" ? "url" : "username"}
                />
                <PasswordField
                  show={showPassword}
                  setShow={setShowPassword}
                  label="Create a password"
                />
                <label className="check-row">
                  <input type="checkbox" required />
                  <span>
                    <i>
                      <Check size={12} />
                    </i>
                    I agree to the Terms and Privacy Policy.
                  </span>
                </label>
              </>
            )}
            {mode === "login" && (
              <>
                <Field
                  label="Email address"
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                />
                <PasswordField
                  show={showPassword}
                  setShow={setShowPassword}
                  label="Password"
                />
                <div className="form-meta">
                  <label className="check-row compact">
                    <input type="checkbox" />
                    <span>
                      <i>
                        <Check size={12} />
                      </i>
                      Remember me
                    </span>
                  </label>
                  <a href="#">Forgot password?</a>
                </div>
              </>
            )}
            <button
              className="button button--ink button--full auth-submit"
              type="submit"
            >
              {mode === "login"
                ? "Log in"
                : step === 1
                  ? "Continue"
                  : "Create account"}
              <ArrowRight size={17} />
            </button>
            {mode === "signup" && step === 2 && (
              <button
                className="back-button"
                type="button"
                onClick={() => setStep(1)}
              >
                Back to previous step
              </button>
            )}
          </form>
          <p className="demo-note">
            <Sparkles size={14} /> Frontend preview: submitting opens the
            interactive demo.
          </p>
          <p className="auth-toggle">
            {mode === "login"
              ? "New to RealReach?"
              : "Already have an account?"}{" "}
            <button
              onClick={() => switchMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? "Create account" : "Log in"}
            </button>
          </p>
          <div className="auth-security">
            <LockKeyhole size={14} /> Your information is encrypted and
            protected.
          </div>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  placeholder,
  type = "text",
  prefix,
  autoComplete,
}: {
  label: string;
  placeholder: string;
  type?: string;
  prefix?: string;
  autoComplete?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className={cx("input-wrap", prefix && "has-prefix")}>
        {prefix && <b>{prefix}</b>}
        <input
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
        />
      </div>
    </label>
  );
}

function PasswordField({
  show,
  setShow,
  label,
}: {
  show: boolean;
  setShow: (show: boolean) => void;
  label: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-wrap">
        <input
          type={show ? "text" : "password"}
          placeholder="At least 8 characters"
          autoComplete={
            label.startsWith("Create") ? "new-password" : "current-password"
          }
          required
          minLength={8}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </label>
  );
}

const earnerTasks = [
  {
    icon: <Instagram />,
    color: "peach",
    type: "SOCIAL DISCOVERY",
    title: "Explore Kora Living’s new collection",
    meta: "Lifestyle · Instagram · 3 min",
    amount: "₦250",
    spots: "38 spots left",
  },
  {
    icon: <MessageCircle />,
    color: "lilac",
    type: "QUICK SURVEY",
    title: "Tell Naya what your skincare routine needs",
    meta: "Beauty · Survey · 6 min",
    amount: "₦450",
    spots: "62 spots left",
  },
  {
    icon: <MousePointer2 />,
    color: "lime",
    type: "WEBSITE VISIT",
    title: "Discover a new Lagos food experience",
    meta: "Food · Website · 4 min",
    amount: "₦300",
    spots: "21 spots left",
  },
];

function EarnerDashboard() {
  return (
    <main className="app-page earner-app">
      <AppSidebar role="earner" />
      <div className="app-main">
        <AppTopbar title="Home" />
        <div className="earner-content">
          <section className="welcome-row">
            <div>
              <span>Saturday, 22 August</span>
              <h1>Good morning, Ada 👋</h1>
              <p>Three opportunities match your profile today.</p>
            </div>
            <div className="trust-pill">
              <BadgeCheck size={18} />
              <span>
                <small>Trust score</small>
                <strong>86 · Strong</strong>
              </span>
            </div>
          </section>
          <section className="wallet-banner">
            <div className="wallet-balance">
              <span className="wallet-icon">
                <WalletCards />
              </span>
              <div>
                <small>Available balance</small>
                <strong>
                  ₦4,850<span>.00</span>
                </strong>
                <p>₦1,200 pending verification</p>
              </div>
            </div>
            <button className="button button--cream">
              Withdraw funds <ArrowRight size={16} />
            </button>
            <div className="wallet-pattern" />
          </section>
          <div className="mobile-quick-stats">
            <div>
              <Clock3 />
              <span>
                <small>Pending</small>
                <strong>₦1,200</strong>
              </span>
            </div>
            <div>
              <BadgeCheck />
              <span>
                <small>Approved</small>
                <strong>24 tasks</strong>
              </span>
            </div>
          </div>
          <section className="task-section">
            <div className="dash-section-head">
              <div>
                <h2>Matched for you</h2>
                <p>Chosen using your profile and activity.</p>
              </div>
              <button>
                View all <ArrowRight size={15} />
              </button>
            </div>
            <div className="dashboard-task-list">
              {earnerTasks.map((task) => (
                <DashboardTask key={task.title} {...task} />
              ))}
            </div>
          </section>
          <section className="progress-card">
            <div className="progress-copy">
              <span className="mini-icon mini-icon--lime">
                <TrendingUp />
              </span>
              <div>
                <small>YOUR NEXT MILESTONE</small>
                <h3>Complete 6 more approved tasks</h3>
                <p>
                  You’re close to <strong>Trusted</strong> status and
                  higher-value opportunities.
                </p>
              </div>
            </div>
            <div className="milestone">
              <div>
                <span>24 completed</span>
                <strong>30</strong>
              </div>
              <div className="progress-line">
                <span style={{ width: "80%" }} />
              </div>
            </div>
          </section>
        </div>
      </div>
      <MobileBottomNav role="earner" />
    </main>
  );
}

function DashboardTask(props: {
  icon: ReactNode;
  color: string;
  type: string;
  title: string;
  meta: string;
  amount: string;
  spots: string;
}) {
  return (
    <article className="dashboard-task">
      <span className={`dash-task-icon phone-task-icon--${props.color}`}>
        {props.icon}
      </span>
      <div className="dash-task-copy">
        <small>{props.type}</small>
        <h3>{props.title}</h3>
        <p>{props.meta}</p>
        <span>
          <i /> {props.spots}
        </span>
      </div>
      <div className="dash-task-action">
        <strong>{props.amount}</strong>
        <button aria-label={`Open ${props.title}`}>
          <ChevronRight />
        </button>
      </div>
    </article>
  );
}

function BusinessDashboard() {
  return (
    <main className="app-page business-app">
      <AppSidebar role="business" />
      <div className="app-main">
        <AppTopbar title="Overview" />
        <div className="business-content">
          <section className="business-welcome">
            <div>
              <span>BUSINESS OVERVIEW</span>
              <h1>Good morning, Amaka.</h1>
              <p>Here’s how Kora Living is reaching people this week.</p>
            </div>
            <button className="button button--coral">
              <Plus size={17} /> Create campaign
            </button>
          </section>
          <section className="metric-grid">
            <Metric
              icon={<Eye />}
              label="Verified reach"
              value="2,486"
              delta="+18.4%"
            />
            <Metric
              icon={<BadgeCheck />}
              label="Completion rate"
              value="91.8%"
              delta="+4.2%"
            />
            <Metric
              icon={<MousePointer2 />}
              label="Offer clicks"
              value="384"
              delta="+12.6%"
            />
            <Metric
              icon={<Banknote />}
              label="Campaign spend"
              value="₦186k"
              delta="3 active"
              neutral
            />
          </section>
          <section className="business-panels">
            <article className="campaign-chart panel">
              <div className="panel-head">
                <div>
                  <small>CAMPAIGN PERFORMANCE</small>
                  <h2>Verified participation</h2>
                </div>
                <select aria-label="Time period">
                  <option>Last 7 days</option>
                  <option>Last 30 days</option>
                </select>
              </div>
              <div className="chart-summary">
                <strong>2,486</strong>
                <span>
                  <TrendingUp size={14} /> 18.4%
                </span>
                <small>vs previous period</small>
              </div>
              <div
                className="bar-chart"
                aria-label="Participation increased during the week"
              >
                <div className="y-labels">
                  <span>600</span>
                  <span>400</span>
                  <span>200</span>
                  <span>0</span>
                </div>
                {[38, 55, 44, 67, 61, 82, 72].map((height, index) => (
                  <div className="bar-column" key={index}>
                    <i style={{ height: `${height}%` }} />
                    <span>{["M", "T", "W", "T", "F", "S", "S"][index]}</span>
                  </div>
                ))}
              </div>
            </article>
            <article className="audience-panel panel">
              <div className="panel-head">
                <div>
                  <small>AUDIENCE QUALITY</small>
                  <h2>Who you reached</h2>
                </div>
                <button aria-label="More options">•••</button>
              </div>
              <div className="donut-wrap">
                <div className="donut">
                  <span>
                    <strong>74%</strong>
                    <small>strong fit</small>
                  </span>
                </div>
                <div className="donut-legend">
                  <span>
                    <i className="legend-lime" />
                    <b>Interest matched</b>
                    <small>1,840</small>
                  </span>
                  <span>
                    <i className="legend-coral" />
                    <b>General reach</b>
                    <small>492</small>
                  </span>
                  <span>
                    <i className="legend-purple" />
                    <b>High intent</b>
                    <small>154</small>
                  </span>
                </div>
              </div>
              <div className="audience-note">
                <Sparkles size={16} />
                <span>
                  <strong>Your audience fit improved.</strong> Lifestyle
                  interest matching is performing 1.4× better.
                </span>
              </div>
            </article>
          </section>
          <section className="active-campaigns panel">
            <div className="panel-head">
              <div>
                <small>LIVE WORK</small>
                <h2>Active campaigns</h2>
              </div>
              <button>
                View all <ArrowRight size={15} />
              </button>
            </div>
            <div className="campaign-table">
              <div className="campaign-row campaign-row--head">
                <span>Campaign</span>
                <span>Progress</span>
                <span>Verified</span>
                <span>Status</span>
                <span>Spend</span>
              </div>
              <CampaignRow
                name="Kora Summer Discovery"
                detail="Instagram · Lagos"
                progress={84}
                verified="842 / 1,000"
                spend="₦84,200"
              />
              <CampaignRow
                name="Home styling pulse"
                detail="Survey · Nigeria"
                progress={61}
                verified="306 / 500"
                spend="₦61,200"
              />
            </div>
          </section>
        </div>
      </div>
      <MobileBottomNav role="business" />
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
  delta,
  neutral = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  delta: string;
  neutral?: boolean;
}) {
  return (
    <article className="metric-card">
      <div>
        <span>{icon}</span>
        <small>{label}</small>
      </div>
      <strong>{value}</strong>
      <p className={neutral ? "neutral" : ""}>
        {!neutral && <TrendingUp size={13} />}
        {delta} <span>{neutral ? "campaigns" : "vs last week"}</span>
      </p>
    </article>
  );
}

function CampaignRow({
  name,
  detail,
  progress,
  verified,
  spend,
}: {
  name: string;
  detail: string;
  progress: number;
  verified: string;
  spend: string;
}) {
  return (
    <div className="campaign-row">
      <span className="campaign-name">
        <i>
          <Instagram />
        </i>
        <span>
          <strong>{name}</strong>
          <small>{detail}</small>
        </span>
      </span>
      <span className="campaign-progress">
        <i>
          <b style={{ width: `${progress}%` }} />
        </i>
        <small>{progress}%</small>
      </span>
      <span>{verified}</span>
      <span>
        <b className="live-status">
          <i />
          Live
        </b>
      </span>
      <strong>{spend}</strong>
    </div>
  );
}

function AppSidebar({ role }: { role: Role }) {
  return (
    <aside className="app-sidebar">
      <Brand light />
      <div className="workspace-chip">
        <span>{role === "business" ? "KL" : "AO"}</span>
        <div>
          <strong>{role === "business" ? "Kora Living" : "Ada Okafor"}</strong>
          <small>
            {role === "business" ? "Business account" : "Earner account"}
          </small>
        </div>
        <ChevronRight />
      </div>
      <nav>
        <a className="active" href="#">
          <LayoutDashboard />
          Overview
        </a>
        <a href="#">
          {role === "business" ? <Target /> : <Search />}
          {role === "business" ? "Campaigns" : "Explore tasks"}
        </a>
        <a href="#">
          {role === "business" ? <BarChart3 /> : <WalletCards />}
          {role === "business" ? "Analytics" : "Wallet"}
        </a>
        <a href="#">
          <Clock3 />
          History
        </a>
        {role === "business" && (
          <a href="#">
            <Users />
            Audience
          </a>
        )}
      </nav>
      <div className="sidebar-bottom">
        <a href="#">
          <HelpCircle />
          Help centre
        </a>
        <Link to="/">
          <ArrowRight className="flip" />
          Back to website
        </Link>
      </div>
    </aside>
  );
}

function AppTopbar({ title }: { title: string }) {
  return (
    <header className="app-topbar">
      <div className="app-mobile-brand">
        <Brand />
      </div>
      <h2>{title}</h2>
      <div>
        <button aria-label="Search">
          <Search />
        </button>
        <button className="notification" aria-label="Notifications">
          <Bell />
          <i />
        </button>
        <span className="app-avatar">AO</span>
      </div>
    </header>
  );
}

function MobileBottomNav({ role }: { role: Role }) {
  return (
    <nav className="mobile-bottom-nav">
      <a className="active" href="#">
        <Home />
        Home
      </a>
      <a href="#">
        {role === "business" ? <Target /> : <Search />}
        {role === "business" ? "Campaigns" : "Explore"}
      </a>
      <a className="mobile-main-action" href="#">
        <span>{role === "business" ? <Plus /> : <Zap />}</span>
        {role === "business" ? "Create" : "Tasks"}
      </a>
      <a href="#">
        {role === "business" ? <BarChart3 /> : <WalletCards />}
        {role === "business" ? "Insights" : "Wallet"}
      </a>
      <a href="#">
        <UserRound />
        Account
      </a>
    </nav>
  );
}

function NotFound() {
  return (
    <main className="not-found">
      <Brand />
      <div>
        <span>404</span>
        <h1>This page hasn’t reached anyone yet.</h1>
        <p>Let’s get you back to the marketplace.</p>
        <Link className="button button--ink" to="/">
          Return home
        </Link>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <ProductProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage initialMode="login" />} />
        <Route path="/signup" element={<AuthPage initialMode="signup" />} />
        <Route path="/earn/*" element={<EarnerProduct />} />
        <Route path="/business/*" element={<BusinessProduct />} />
        <Route path="/admin/*" element={<AdminProduct />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ProductProvider>
  );
}
