import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  Check,
  CheckCheck,
  ChevronDown,
  Compass,
  FlaskConical,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Plus,
  ShieldCheck,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import {
  label,
  money,
  type Campaign,
  type Front,
  type MoneyEvent,
} from "./model";
import { useDemo } from "./store";

export function Mark() {
  return (
    <svg className="j-mark" viewBox="0 0 58 36" fill="none" aria-hidden="true">
      <path
        d="M28 10C22 3 18 3 13 5C3 9 2 23 11 29C17 33 22 30 29 22L38 12"
        stroke="#f77959"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M29 25C35 32 41 32 47 28C56 22 53 8 46 5C39 1 34 5 28 12L20 22"
        stroke="#d5ed83"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function Logo({
  to = "/",
  light = false,
}: {
  to?: string;
  light?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`j-logo ${light ? "is-light" : ""}`}
      aria-label="RealReach home"
    >
      <Mark />
      <span>
        realreach<span className="j-logo-dot">.</span>
      </span>
    </Link>
  );
}
export function Button({
  children,
  onClick,
  kind = "primary",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      className={`j-btn j-btn--${kind} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function ButtonLink({
  to,
  children,
  secondary = false,
}: {
  to: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link
      className={`j-btn j-btn--${secondary ? "secondary" : "primary"}`}
      to={to}
    >
      {children}
    </Link>
  );
}
export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`j-pill j-pill--${tone}`}>{children}</span>;
}
export function Status({ value }: { value: string }) {
  const tone = ["live", "settled", "completed", "paid", "ready"].includes(value)
    ? "green"
    : ["rejected", "failed", "expired"].includes(value)
      ? "red"
      : ["pending", "checking", "processing", "review", "closing"].includes(
            value,
          )
        ? "amber"
        : "neutral";
  return (
    <Pill tone={tone}>
      {label[value as keyof typeof label] ??
        value[0].toUpperCase() + value.slice(1)}
    </Pill>
  );
}
export function PageHeading({
  eyebrow,
  title,
  copy,
  action,
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
  action?: ReactNode;
}) {
  return (
    <div className="j-page-heading">
      <div>
        {eyebrow && <span className="j-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {copy && <p>{copy}</p>}
      </div>
      {action}
    </div>
  );
}
export function SectionHeading({
  title,
  aside,
}: {
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="j-section-heading">
      <h2>{title}</h2>
      {aside}
    </div>
  );
}
export function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="j-empty">
      <span className="j-empty-icon">
        <Compass size={27} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Info({
  children,
  warning = false,
}: {
  children: ReactNode;
  warning?: boolean;
}) {
  return (
    <div className={`j-info ${warning ? "j-info--warning" : ""}`}>
      <ShieldCheck size={19} />
      <div>{children}</div>
    </div>
  );
}
export function Stat({
  label: text,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <div className="j-stat">
      <span>{text}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
export function BrandAvatar({
  campaign,
  large = false,
}: {
  campaign: Pick<Campaign, "brand" | "theme">;
  large?: boolean;
}) {
  return (
    <span
      className={`j-brand-avatar j-theme-${campaign.theme} ${large ? "is-large" : ""}`}
      aria-hidden="true"
    >
      {campaign.brand
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
export function PostArt({ campaign }: { campaign: Campaign }) {
  return (
    <div className={`j-post-art j-theme-${campaign.theme}`}>
      <span>{campaign.brand.toUpperCase()} / JOURNAL 01</span>
      <div>
        <span>The everyday</span>
        <strong>collection.</strong>
      </div>
      <span>
        A little more you. <ArrowUpRight size={24} />
      </span>
    </div>
  );
}
export const dateTime = (time: number) =>
  new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(time);
export function Timeline({
  events,
}: {
  events: { text: string; at: number }[];
}) {
  return (
    <ol className="j-timeline">
      {events.map((e, i) => (
        <li key={`${e.at}-${i}`}>
          <span>
            <Check size={12} />
          </span>
          <div>
            <strong>{e.text}</strong>
            <small>{dateTime(e.at)}</small>
          </div>
        </li>
      ))}
    </ol>
  );
}
export function MoneyList({ events }: { events: MoneyEvent[] }) {
  return (
    <div className="j-money-list">
      {events.length ? (
        events.map((e) => (
          <div className="j-money-row" key={e.id}>
            <span className={`j-money-icon ${e.amount > 0 ? "is-in" : ""}`}>
              {e.amount > 0 ? (
                <ArrowDownLeft size={19} />
              ) : (
                <ArrowUpRight size={19} />
              )}
            </span>
            <div>
              <strong>{e.title}</strong>
              <p>{e.detail}</p>
              <small>{dateTime(e.at)}</small>
            </div>
            <strong className={e.amount > 0 ? "j-positive" : ""}>
              {e.amount > 0 ? "+" : "−"}
              {money(Math.abs(e.amount))}
            </strong>
          </div>
        ))
      ) : (
        <Empty
          title="Your activity starts here"
          text="Completed actions and money movements will appear here."
        />
      )}
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`j-modal ${wide ? "j-modal--wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="j-modal-head">
        <h2 id="modal-title">{title}</h2>
        <button
          className="j-icon-btn"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function DemoLab({ children }: { children: ReactNode }) {
  return (
    <details className="j-demo-lab">
      <summary>
        <FlaskConical size={17} />
        <span>Demo controls</span>
        <ChevronDown size={16} />
      </summary>
      <div>
        <p>
          Simulate the provider response. No Instagram action or payment is
          verified in this preview.
        </p>
        {children}
      </div>
    </details>
  );
}

const navigation = {
  worker: [
    { to: "/earn", name: "Discover", icon: Compass },
    { to: "/earn/my-tasks", name: "My tasks", icon: ListChecks },
    { to: "/earn/wallet", name: "Wallet", icon: Wallet },
    { to: "/earn/profile", name: "Account", icon: UserRound },
  ],
  business: [
    { to: "/business", name: "Overview", icon: LayoutDashboard },
    { to: "/business/campaigns", name: "Campaigns", icon: BriefcaseBusiness },
    { to: "/business/billing", name: "Funds", icon: Wallet },
    { to: "/business/settings", name: "Account", icon: UserRound },
  ],
  admin: [
    { to: "/admin", name: "Overview", icon: LayoutDashboard },
    { to: "/admin/proofs", name: "Exceptions", icon: ListChecks },
    { to: "/admin/payouts", name: "Payouts", icon: Wallet },
    { to: "/admin/settings", name: "Account", icon: UserRound },
  ],
};
export function Shell({
  front,
  children,
}: {
  front: Front;
  children: ReactNode;
}) {
  const { state, send, message, storageError } = useDemo();
  const [switcher, setSwitcher] = useState(false);
  const [notices, setNotices] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);
  const unread = state.notices.filter((n) => !n.read).length;
  const title =
    front === "business"
      ? state.businessName
      : front === "admin"
        ? "Operations"
        : state.name;
  const links = navigation[front];
  const active = (to: string) => {
    if (front === "worker" && to === "/earn")
      return (
        location.pathname === to || location.pathname.startsWith("/earn/tasks")
      );
    if (front === "worker" && to === "/earn/my-tasks")
      return (
        location.pathname === to ||
        location.pathname.startsWith("/earn/assignments")
      );
    return to === `/${front}`
      ? location.pathname === to
      : location.pathname.startsWith(to);
  };
  return (
    <div className="journey">
      <a href="#workspace-main" className="j-skip">
        Skip to content
      </a>
      <aside className="j-sidebar">
        <Logo to={links[0].to} />
        <button
          className="j-workspace-switch"
          onClick={() => setSwitcher(true)}
        >
          <span className="j-user-avatar">{title.slice(0, 1)}</span>
          <span>
            <strong>{title}</strong>
            <small>
              {front === "worker"
                ? "Worker workspace"
                : front === "business"
                  ? "Business workspace"
                  : "Demo administration"}
            </small>
          </span>
          <ChevronDown size={16} />
        </button>
        <span className="j-nav-caption">YOUR WORKSPACE</span>
        <nav aria-label="Main navigation">
          {links.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active(item.to) ? "page" : undefined}
              className={`j-nav-link ${active(item.to) ? "is-active" : ""}`}
            >
              <item.icon size={20} />
              {item.name}
              {item.name === "My tasks" && state.assignments.length > 0 && (
                <span>{state.assignments.length}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="j-sidebar-bottom">
          <div className="j-sidebar-note">
            <span className="j-note-asterisk">✳</span>
            <strong>
              A little action.
              <br />A real connection.
            </strong>
            <p>Explore the complete journey with demo tasks and funds.</p>
            <Link to="/help">
              How it works <ArrowRight size={16} />
            </Link>
          </div>
          <button
            className="j-nav-link"
            onClick={() => {
              send({ type: "signout" });
              navigate("/login");
            }}
          >
            <LogOut size={19} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="j-workspace">
        <header className="j-topbar">
          <div className="j-mobile-brand">
            <Logo to={links[0].to} />
          </div>
          <div className="j-desktop-breadcrumb">
            Workspace <span>/</span>{" "}
            <strong>
              {front === "worker"
                ? "Earn with RealReach"
                : front === "business"
                  ? "Grow with RealReach"
                  : "Operations"}
            </strong>
          </div>
          <div className="j-top-actions">
            <button
              className="j-front-button"
              onClick={() => setSwitcher(true)}
            >
              {front === "worker"
                ? "Worker"
                : front === "business"
                  ? "Business"
                  : "Admin"}
              <ChevronDown size={14} />
            </button>
            <button
              className="j-icon-btn j-notification-button"
              aria-label="Notifications"
              onClick={() => {
                setNotices(true);
                send({ type: "read-notices" });
              }}
            >
              <Bell size={20} />
              {unread > 0 && <i />}
            </button>
            <Link
              className="j-user-avatar j-header-avatar"
              to={links[3].to}
              aria-label="Your account"
            >
              {state.name.slice(0, 1)}
            </Link>
          </div>
        </header>
        <div className="j-preview-strip">
          <FlaskConical size={15} />
          <span>
            Interactive preview{" "}
            <span className="j-preview-extra">
              · Instagram & payments are simulated
            </span>
          </span>
          <span className="j-preview-tag">NO REAL MONEY</span>
        </div>
        {storageError && (
          <div className="j-storage-warning" role="alert">
            Browser storage is unavailable. Your demo changes will not survive a
            refresh.
          </div>
        )}
        <main id="workspace-main" className="j-main" key={location.pathname}>
          {children}
        </main>
        <footer className="j-workspace-footer">
          <span>Real people. Thoughtful connections.</span>
          <Link to="/help">
            Help & demo guide <ArrowUpRight size={14} />
          </Link>
        </footer>
      </div>
      <nav className="j-bottom-nav" aria-label="Mobile navigation">
        {links.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={active(item.to) ? "is-active" : ""}
            aria-current={active(item.to) ? "page" : undefined}
          >
            <item.icon size={22} />
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>
      {message && (
        <div className="j-toast" role="status">
          <CheckCheck size={19} />
          {message}
        </div>
      )}
      {switcher && (
        <Modal title="Switch workspace" onClose={() => setSwitcher(false)}>
          <p className="j-muted">
            Follow the same campaign from both sides. All three views are
            available in this demo only.
          </p>
          {(["worker", "business", "admin"] as Front[]).map((f) => (
            <button
              key={f}
              className={`j-switch-option ${front === f ? "is-active" : ""}`}
              onClick={() => {
                send({ type: "session", front: f });
                setSwitcher(false);
                navigate(f === "worker" ? "/earn" : `/${f}`);
              }}
            >
              <span className={`j-switch-icon j-switch-icon--${f}`}>
                {f === "worker" ? (
                  <Compass />
                ) : f === "business" ? (
                  <BriefcaseBusiness />
                ) : (
                  <ShieldCheck />
                )}
              </span>
              <span>
                <strong>
                  {f === "worker"
                    ? "Worker"
                    : f === "business"
                      ? "Business"
                      : "Demo admin"}
                </strong>
                <small>
                  {f === "worker"
                    ? "Discover tasks and manage earnings"
                    : f === "business"
                      ? "Create campaigns and track delivery"
                      : "Inspect exceptions and payouts"}
                </small>
              </span>
              {front === f ? <Check size={20} /> : <ArrowRight size={20} />}
            </button>
          ))}
        </Modal>
      )}
      {notices && (
        <Modal title="Your updates" onClose={() => setNotices(false)}>
          <div className="j-notice-list">
            {state.notices.map((n) => (
              <div key={n.id}>
                <span className="j-notice-symbol">
                  <Bell size={16} />
                </span>
                <div>
                  <p>{n.text}</p>
                  <small>{dateTime(n.at)}</small>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
export function NewCampaignLink() {
  return (
    <ButtonLink to="/business/campaigns/new">
      <Plus size={18} />
      New campaign
    </ButtonLink>
  );
}
