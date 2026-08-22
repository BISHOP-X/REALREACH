import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  BarChart3,
  Bell,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  CreditCard,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Gauge,
  Headphones,
  HelpCircle,
  History,
  Home,
  Landmark,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  Megaphone,
  Menu,
  MessageCircle,
  MoreHorizontal,
  MousePointer2,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  UserRound,
  Users,
  WalletCards,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import {
  FormEvent,
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./product.css";

type ProductRole = "earner" | "business" | "admin";
type TaskStatus = "available" | "in_progress" | "submitted" | "approved";
type CampaignStatus = "live" | "draft" | "review" | "completed";

type MockTask = {
  id: string;
  type: string;
  title: string;
  brand: string;
  category: string;
  channel: string;
  minutes: number;
  reward: number;
  spots: number;
  match: number;
  color: "peach" | "lilac" | "lime" | "sand";
  description: string;
  requirements: string[];
};

type MockCampaign = {
  id: string;
  name: string;
  type: string;
  audience: string;
  goal: number;
  verified: number;
  budget: number;
  status: CampaignStatus;
};

type ProductModel = {
  taskStatuses: Record<string, TaskStatus>;
  wallet: number;
  pending: number;
  withdrawals: Array<{
    id: string;
    amount: number;
    date: string;
    status: "Processing" | "Paid";
  }>;
  campaigns: MockCampaign[];
};

type ProductContextValue = ProductModel & {
  setTaskStatus: (id: string, status: TaskStatus) => void;
  requestWithdrawal: (amount: number) => void;
  addCampaign: (campaign: MockCampaign) => void;
  toast: string | null;
  notify: (message: string) => void;
};

const tasks: MockTask[] = [
  {
    id: "kora-discovery",
    type: "Social discovery",
    title: "Explore Kora Living’s new collection",
    brand: "Kora Living",
    category: "Lifestyle",
    channel: "Social profile",
    minutes: 3,
    reward: 250,
    spots: 38,
    match: 94,
    color: "peach",
    description:
      "Visit Kora Living’s social page, explore the new home collection and answer one short attention check.",
    requirements: [
      "Open the linked Kora Living profile",
      "Explore the highlighted collection for at least 60 seconds",
      "Return to answer the verification question",
    ],
  },
  {
    id: "naya-survey",
    type: "Quick survey",
    title: "Tell Naya what your skincare routine needs",
    brand: "Naya Skin",
    category: "Beauty",
    channel: "Survey",
    minutes: 6,
    reward: 450,
    spots: 62,
    match: 89,
    color: "lilac",
    description:
      "Share your skincare habits to help a Nigerian beauty brand plan its next product drop.",
    requirements: [
      "Answer eight multiple-choice questions",
      "Provide one short written response",
      "Submit one response only",
    ],
  },
  {
    id: "chopnow-menu",
    type: "Website visit",
    title: "Discover a new Lagos food experience",
    brand: "ChopNow",
    category: "Food",
    channel: "Website",
    minutes: 4,
    reward: 300,
    spots: 21,
    match: 86,
    color: "lime",
    description:
      "Explore a new Lagos food menu and tell the business which meal caught your attention.",
    requirements: [
      "Open the menu page",
      "View at least three meal options",
      "Select the meal you would be most likely to order",
    ],
  },
  {
    id: "fitbase-pulse",
    type: "Audience pulse",
    title: "Help Fitbase shape a home workout offer",
    brand: "Fitbase",
    category: "Fitness",
    channel: "Survey",
    minutes: 7,
    reward: 550,
    spots: 44,
    match: 81,
    color: "sand",
    description:
      "A short research task about home workouts, equipment and buying preferences.",
    requirements: [
      "Complete the eligibility questions",
      "Answer honestly based on your current habits",
      "Do not submit duplicate responses",
    ],
  },
  {
    id: "tixafrica-click",
    type: "Offer discovery",
    title: "Explore weekend events happening near you",
    brand: "TixAfrica",
    category: "Entertainment",
    channel: "Website",
    minutes: 4,
    reward: 350,
    spots: 75,
    match: 78,
    color: "peach",
    description:
      "Browse curated weekend events and save the one you find most relevant.",
    requirements: [
      "Allow location-level matching",
      "Explore the event collection",
      "Choose one event and explain your choice",
    ],
  },
];

const initialCampaigns: MockCampaign[] = [
  {
    id: "summer-discovery",
    name: "Kora Summer Discovery",
    type: "Social discovery",
    audience: "Lagos · Lifestyle",
    goal: 1000,
    verified: 842,
    budget: 120000,
    status: "live",
  },
  {
    id: "styling-pulse",
    name: "Home styling pulse",
    type: "Audience survey",
    audience: "Nigeria · Home & living",
    goal: 500,
    verified: 306,
    budget: 90000,
    status: "live",
  },
  {
    id: "august-offer",
    name: "August offer test",
    type: "Offer discovery",
    audience: "Abuja · 21–35",
    goal: 750,
    verified: 0,
    budget: 105000,
    status: "review",
  },
  {
    id: "creator-drop",
    name: "Creator collection launch",
    type: "Social discovery",
    audience: "Nigeria · Fashion",
    goal: 1200,
    verified: 1200,
    budget: 162000,
    status: "completed",
  },
];

const defaultModel: ProductModel = {
  taskStatuses: {
    "kora-discovery": "available",
    "naya-survey": "available",
    "chopnow-menu": "available",
    "fitbase-pulse": "available",
    "tixafrica-click": "available",
  },
  wallet: 4850,
  pending: 1200,
  withdrawals: [
    { id: "WD-2048", amount: 5000, date: "14 Aug 2026", status: "Paid" },
  ],
  campaigns: initialCampaigns,
};

const ProductContext = createContext<ProductContextValue | null>(null);

export function ProductProvider({ children }: { children: ReactNode }) {
  const [model, setModel] = useState<ProductModel>(() => {
    try {
      const saved = localStorage.getItem("realreach-demo-state");
      return saved ? { ...defaultModel, ...JSON.parse(saved) } : defaultModel;
    } catch {
      return defaultModel;
    }
  });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(
    () => localStorage.setItem("realreach-demo-state", JSON.stringify(model)),
    [model],
  );
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const value: ProductContextValue = {
    ...model,
    toast,
    notify: setToast,
    setTaskStatus: (id, status) =>
      setModel((current) => ({
        ...current,
        taskStatuses: { ...current.taskStatuses, [id]: status },
        pending:
          status === "submitted"
            ? current.pending +
              (tasks.find((task) => task.id === id)?.reward ?? 0)
            : current.pending,
      })),
    requestWithdrawal: (amount) =>
      setModel((current) => ({
        ...current,
        wallet: Math.max(0, current.wallet - amount),
        withdrawals: [
          {
            id: `WD-${Math.floor(1000 + Math.random() * 8999)}`,
            amount,
            date: "22 Aug 2026",
            status: "Processing",
          },
          ...current.withdrawals,
        ],
      })),
    addCampaign: (campaign) =>
      setModel((current) => ({
        ...current,
        campaigns: [campaign, ...current.campaigns],
      })),
  };
  return (
    <ProductContext.Provider value={value}>
      {children}
      {toast && (
        <div className="rr-toast">
          <CheckCircle2 />
          {toast}
        </div>
      )}
    </ProductContext.Provider>
  );
}

function useProduct() {
  const value = useContext(ProductContext);
  if (!value) throw new Error("ProductProvider is missing");
  return value;
}

function ProductBrand({ light = false }: { light?: boolean }) {
  return (
    <Link className={`rr-brand ${light ? "rr-brand--light" : ""}`} to="/">
      <span className="rr-brand-mark" aria-hidden="true">
        <i />
        <i />
      </span>
      <span>realreach</span>
    </Link>
  );
}

type NavItem = { label: string; path: string; icon: ReactNode; badge?: string };

const navByRole: Record<ProductRole, NavItem[]> = {
  earner: [
    { label: "Home", path: "/earn", icon: <Home /> },
    {
      label: "Explore tasks",
      path: "/earn/tasks",
      icon: <Search />,
      badge: "5",
    },
    { label: "Wallet", path: "/earn/wallet", icon: <WalletCards /> },
    { label: "Activity", path: "/earn/history", icon: <History /> },
    { label: "Profile", path: "/earn/profile", icon: <UserRound /> },
  ],
  business: [
    { label: "Overview", path: "/business", icon: <LayoutDashboard /> },
    {
      label: "Campaigns",
      path: "/business/campaigns",
      icon: <Megaphone />,
      badge: "3",
    },
    { label: "Analytics", path: "/business/analytics", icon: <BarChart3 /> },
    { label: "Audience", path: "/business/audience", icon: <Users /> },
    { label: "Billing", path: "/business/billing", icon: <CreditCard /> },
  ],
  admin: [
    { label: "Command centre", path: "/admin", icon: <Gauge /> },
    {
      label: "Campaign reviews",
      path: "/admin/campaigns",
      icon: <ClipboardCheck />,
      badge: "7",
    },
    {
      label: "Proof queue",
      path: "/admin/proofs",
      icon: <FileCheck2 />,
      badge: "24",
    },
    { label: "Payouts", path: "/admin/payouts", icon: <Banknote /> },
    { label: "People", path: "/admin/users", icon: <Users /> },
  ],
};

function routeIsActive(current: string, target: string) {
  if (["/earn", "/business", "/admin"].includes(target))
    return current === target;
  return current.startsWith(target);
}

function ProductShell({
  role,
  children,
  pageTitle,
  pageEyebrow,
  primaryAction,
}: {
  role: ProductRole;
  children: ReactNode;
  pageTitle: string;
  pageEyebrow?: string;
  primaryAction?: ReactNode;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const nav = navByRole[role];
  const profilePath =
    role === "earner"
      ? "/earn/profile"
      : role === "business"
        ? "/business/settings"
        : "/admin/settings";
  const roleMeta =
    role === "earner"
      ? { initials: "AO", name: "Ada Okafor", type: "Earner account" }
      : role === "business"
        ? { initials: "KL", name: "Kora Living", type: "Business workspace" }
        : { initials: "RR", name: "RealReach Ops", type: "Internal workspace" };

  return (
    <main className={`rr-app rr-app--${role}`}>
      <aside className={`rr-sidebar ${mobileMenu ? "is-open" : ""}`}>
        <div className="rr-sidebar-head">
          <ProductBrand light />
          <button
            onClick={() => setMobileMenu(false)}
            aria-label="Close navigation"
          >
            <X />
          </button>
        </div>
        <button className="rr-workspace" onClick={() => navigate(profilePath)}>
          <span>{roleMeta.initials}</span>
          <div>
            <strong>{roleMeta.name}</strong>
            <small>{roleMeta.type}</small>
          </div>
          <ChevronRight />
        </button>
        <nav>
          {nav.map((item) => (
            <Link
              className={
                routeIsActive(location.pathname, item.path) ? "active" : ""
              }
              to={item.path}
              key={item.path}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge && <b>{item.badge}</b>}
            </Link>
          ))}
        </nav>
        <div className="rr-sidebar-spacer" />
        <div className="rr-sidebar-secondary">
          <Link
            to={
              role === "earner"
                ? "/earn/help"
                : role === "business"
                  ? "/business/help"
                  : "/admin/settings"
            }
          >
            <HelpCircle />
            Help & support
          </Link>
          <Link
            to={
              role === "earner"
                ? "/earn/settings"
                : role === "business"
                  ? "/business/settings"
                  : "/admin/settings"
            }
          >
            <Settings />
            Settings
          </Link>
          <button onClick={() => navigate("/login")}>
            <LogOut />
            Sign out
          </button>
        </div>
        <div className="rr-sidebar-security">
          <ShieldCheck />
          <span>
            <strong>Protected demo</strong>
            <small>Frontend preview environment</small>
          </span>
        </div>
      </aside>
      <div className="rr-app-main">
        <header className="rr-topbar">
          <button
            className="rr-menu-trigger"
            onClick={() => setMobileMenu(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </button>
          <div className="rr-mobile-logo">
            <ProductBrand />
          </div>
          <div className="rr-page-identity">
            <small>{pageEyebrow}</small>
            <strong>{pageTitle}</strong>
          </div>
          <div className="rr-top-actions">
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search RealReach"
            >
              <Search />
            </button>
            <button
              className="rr-notice-button"
              onClick={() => setNoticesOpen(!noticesOpen)}
              aria-label="Notifications"
            >
              <Bell />
              <i />
            </button>
            <button className="rr-avatar" onClick={() => navigate(profilePath)}>
              {roleMeta.initials}
            </button>
          </div>
          {noticesOpen && (
            <div className="rr-notice-panel">
              <div>
                <strong>Notifications</strong>
                <button onClick={() => setNoticesOpen(false)}>
                  <X />
                </button>
              </div>
              <Notice
                icon={<BadgeCheck />}
                title={
                  role === "business"
                    ? "306 actions verified"
                    : "Your latest task was approved"
                }
                text="A few moments ago"
              />
              <Notice
                icon={<Sparkles />}
                title={
                  role === "admin"
                    ? "7 campaigns need review"
                    : "New opportunity matched"
                }
                text="Today"
              />
              <Link
                to={
                  role === "earner"
                    ? "/earn/history"
                    : role === "business"
                      ? "/business/campaigns"
                      : "/admin/proofs"
                }
              >
                View all activity <ArrowRight />
              </Link>
            </div>
          )}
        </header>
        <div className="rr-mobile-page-head">
          <div>
            <small>{pageEyebrow}</small>
            <h1>{pageTitle}</h1>
          </div>
          {primaryAction}
        </div>
        <div className="rr-page">{children}</div>
      </div>
      <nav className="rr-bottom-nav">
        {nav.slice(0, 5).map((item, index) => (
          <Link
            className={`${routeIsActive(location.pathname, item.path) ? "active" : ""} ${index === 2 ? "rr-bottom-main" : ""}`}
            to={item.path}
            key={item.path}
          >
            {index === 2 ? <span>{item.icon}</span> : item.icon}
            <small>{item.label.split(" ")[0]}</small>
          </Link>
        ))}
      </nav>
      {mobileMenu && (
        <button
          className="rr-sidebar-scrim"
          onClick={() => setMobileMenu(false)}
          aria-label="Close menu"
        />
      )}
      {searchOpen && (
        <SearchPalette role={role} close={() => setSearchOpen(false)} />
      )}
    </main>
  );
}

function Notice({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rr-notice">
      {icon}
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
    </div>
  );
}

function SearchPalette({
  role,
  close,
}: {
  role: ProductRole;
  close: () => void;
}) {
  const [query, setQuery] = useState("");
  const items = navByRole[role].filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div
      className="rr-modal-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="rr-search-modal">
        <div className="rr-search-input">
          <Search />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages and actions…"
          />
          <button onClick={close}>
            <X />
          </button>
        </div>
        <small>QUICK NAVIGATION</small>
        {items.map((item) => (
          <Link to={item.path} onClick={close} key={item.path}>
            {item.icon}
            <span>{item.label}</span>
            <ArrowRight />
          </Link>
        ))}
      </div>
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  copy,
  action,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rr-page-heading">
      <div>
        <small>{eyebrow}</small>
        <h1>{title}</h1>
        {copy && <p>{copy}</p>}
      </div>
      {action}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  meta,
  tone = "paper",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  meta: string;
  tone?: "paper" | "lime" | "coral" | "ink";
}) {
  return (
    <article className={`rr-stat rr-stat--${tone}`}>
      <div>
        <span>{icon}</span>
        <small>{label}</small>
      </div>
      <strong>{value}</strong>
      <p>{meta}</p>
    </article>
  );
}

function EmptyState({
  icon,
  title,
  copy,
  action,
}: {
  icon: ReactNode;
  title: string;
  copy: string;
  action: ReactNode;
}) {
  return (
    <div className="rr-empty">
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
      {action}
    </div>
  );
}

function formatNaira(value: number) {
  return `₦${value.toLocaleString("en-NG")}`;
}

export function EarnerProduct() {
  const path = useLocation().pathname;
  let title = "Home";
  let eyebrow = "Earner workspace";
  let content: ReactNode = <EarnerHome />;
  if (path === "/earn/tasks") {
    title = "Explore tasks";
    content = <TaskMarketplace />;
  } else if (path.startsWith("/earn/tasks/")) {
    title = "Task details";
    content = <TaskDetails taskId={path.split("/").pop() ?? ""} />;
  } else if (path === "/earn/wallet") {
    title = "Wallet";
    content = <WalletPage />;
  } else if (path === "/earn/history") {
    title = "Activity";
    content = <EarnerHistory />;
  } else if (path === "/earn/profile") {
    title = "Profile";
    content = <EarnerProfile />;
  } else if (path === "/earn/settings") {
    title = "Settings";
    content = <EarnerSettings />;
  } else if (path === "/earn/help") {
    title = "Help & support";
    content = <HelpPage role="earner" />;
  }
  return (
    <ProductShell role="earner" pageTitle={title} pageEyebrow={eyebrow}>
      {content}
    </ProductShell>
  );
}

function EarnerHome() {
  const { wallet, pending, taskStatuses } = useProduct();
  const navigate = useNavigate();
  const recommended = tasks
    .filter((task) => taskStatuses[task.id] === "available")
    .slice(0, 3);
  return (
    <>
      <PageHeading
        eyebrow="Saturday, 22 August"
        title="Good morning, Ada 👋"
        copy="Your attention is in demand. Here’s what is ready for you today."
        action={
          <button
            className="rr-button rr-button--ink"
            onClick={() => navigate("/earn/tasks")}
          >
            Find tasks <ArrowRight />
          </button>
        }
      />
      <section className="rr-earner-hero">
        <div className="rr-wallet-summary">
          <span>
            <WalletCards />
          </span>
          <div>
            <small>AVAILABLE BALANCE</small>
            <strong>
              {formatNaira(wallet)}
              <i>.00</i>
            </strong>
            <p>{formatNaira(pending)} pending verification</p>
          </div>
        </div>
        <button
          className="rr-button rr-button--cream"
          onClick={() => navigate("/earn/wallet")}
        >
          Open wallet <ArrowRight />
        </button>
        <div className="rr-card-orbit" />
      </section>
      <section className="rr-mini-stats">
        <StatCard
          icon={<Clock3 />}
          label="Pending"
          value={formatNaira(pending)}
          meta="Across 3 submissions"
        />
        <StatCard
          icon={<BadgeCheck />}
          label="Trust score"
          value="86 / 100"
          meta="Strong · up 4 points"
        />
        <StatCard
          icon={<Zap />}
          label="Current streak"
          value="6 days"
          meta="Personal best: 11"
        />
      </section>
      <section className="rr-section-block">
        <div className="rr-section-head">
          <div>
            <small>RECOMMENDED</small>
            <h2>Matched for you</h2>
          </div>
          <button onClick={() => navigate("/earn/tasks")}>
            See all opportunities <ArrowRight />
          </button>
        </div>
        <div className="rr-task-grid">
          {recommended.map((task) => (
            <TaskCard task={task} key={task.id} />
          ))}
        </div>
      </section>
      <section className="rr-growth-card">
        <div>
          <span>
            <TrendingUp />
          </span>
          <div>
            <small>NEXT TRUST LEVEL</small>
            <h3>Six more approved tasks unlock Trusted status</h3>
            <p>
              Trusted earners receive earlier access and higher-value
              opportunities.
            </p>
          </div>
        </div>
        <div className="rr-level-progress">
          <span>
            <small>24 approved</small>
            <strong>30</strong>
          </span>
          <i>
            <b style={{ width: "80%" }} />
          </i>
        </div>
      </section>
    </>
  );
}

function TaskCard({ task }: { task: MockTask }) {
  const navigate = useNavigate();
  const { taskStatuses } = useProduct();
  const status = taskStatuses[task.id];
  return (
    <article
      className="rr-task-card"
      onClick={() => navigate(`/earn/tasks/${task.id}`)}
    >
      <div className="rr-task-card-top">
        <span className={`rr-task-symbol rr-tone--${task.color}`}>
          {task.channel === "Survey" ? <MessageCircle /> : <MousePointer2 />}
        </span>
        <span className="rr-match">
          <Sparkles />
          {task.match}% match
        </span>
      </div>
      <small>{task.type.toUpperCase()}</small>
      <h3>{task.title}</h3>
      <p>
        {task.brand} · {task.category} · {task.minutes} min
      </p>
      <div className="rr-task-card-foot">
        <span>
          <i />
          {task.spots} spots left
        </span>
        <strong>{formatNaira(task.reward)}</strong>
        <button aria-label={`Open ${task.title}`}>
          <ChevronRight />
        </button>
      </div>
      {status !== "available" && (
        <b className={`rr-status rr-status--${status}`}>
          {status.replace("_", " ")}
        </b>
      )}
    </article>
  );
}

function TaskMarketplace() {
  const { notify } = useProduct();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const filters = ["All", "Social", "Survey", "Website", "High match"];
  const shown = tasks.filter(
    (task) =>
      (filter === "All" ||
        (filter === "High match"
          ? task.match >= 88
          : task.type.toLowerCase().includes(filter.toLowerCase()) ||
            task.channel.toLowerCase().includes(filter.toLowerCase()))) &&
      `${task.title} ${task.brand} ${task.category}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="Opportunity marketplace"
        title="Find work worth your attention."
        copy="Every reward, time estimate and requirement is visible before you begin."
      />
      <div className="rr-discovery-bar">
        <label>
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tasks, brands or categories"
          />
        </label>
        <button
          onClick={() =>
            notify("Use the category chips below to refine your opportunities.")
          }
        >
          <SlidersHorizontal />
          Filters
        </button>
      </div>
      <div className="rr-filter-row">
        {filters.map((item) => (
          <button
            className={filter === item ? "active" : ""}
            onClick={() => setFilter(item)}
            key={item}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="rr-market-layout">
        <div className="rr-task-list">
          {shown.map((task) => (
            <TaskListItem task={task} key={task.id} />
          ))}
          {shown.length === 0 && (
            <EmptyState
              icon={<Search />}
              title="No exact matches"
              copy="Try a broader category or search term."
              action={
                <button
                  className="rr-button rr-button--ink"
                  onClick={() => {
                    setQuery("");
                    setFilter("All");
                  }}
                >
                  Clear filters
                </button>
              }
            />
          )}
        </div>
        <aside className="rr-market-aside">
          <span>
            <ShieldCheck />
          </span>
          <h3>Protected opportunities</h3>
          <p>
            Campaigns are reviewed before they reach your feed. You will always
            see the reward and proof requirements upfront.
          </p>
          <Link to="/earn/help">
            How verification works <ArrowRight />
          </Link>
        </aside>
      </div>
    </>
  );
}

function TaskListItem({ task }: { task: MockTask }) {
  const navigate = useNavigate();
  const { taskStatuses } = useProduct();
  const status = taskStatuses[task.id];
  return (
    <button
      className="rr-task-row"
      onClick={() => navigate(`/earn/tasks/${task.id}`)}
    >
      <span className={`rr-task-symbol rr-tone--${task.color}`}>
        {task.channel === "Survey" ? <MessageCircle /> : <MousePointer2 />}
      </span>
      <span className="rr-task-row-copy">
        <small>
          {task.type} · {task.match}% match
        </small>
        <strong>{task.title}</strong>
        <p>
          {task.brand} · {task.category} · About {task.minutes} minutes
        </p>
      </span>
      <span className="rr-task-row-meta">
        <strong>{formatNaira(task.reward)}</strong>
        <small>
          {status === "available"
            ? `${task.spots} spots`
            : status.replace("_", " ")}
        </small>
      </span>
      <ChevronRight />
    </button>
  );
}

function TaskDetails({ taskId }: { taskId: string }) {
  const task = tasks.find((item) => item.id === taskId);
  const navigate = useNavigate();
  const { taskStatuses, setTaskStatus, notify } = useProduct();
  if (!task)
    return (
      <EmptyState
        icon={<XCircle />}
        title="Task unavailable"
        copy="This opportunity may have closed or moved."
        action={
          <button
            className="rr-button rr-button--ink"
            onClick={() => navigate("/earn/tasks")}
          >
            Back to tasks
          </button>
        }
      />
    );
  const status = taskStatuses[task.id];
  const advance = () => {
    if (status === "available") {
      setTaskStatus(task.id, "in_progress");
      notify("Task started. Your spot is reserved for 20 minutes.");
    } else if (status === "in_progress") {
      setTaskStatus(task.id, "submitted");
      notify(`${formatNaira(task.reward)} moved to pending verification.`);
    } else notify("This submission is already in the verification queue.");
  };
  return (
    <>
      <button className="rr-back" onClick={() => navigate("/earn/tasks")}>
        <ArrowLeft />
        Back to opportunities
      </button>
      <div className="rr-detail-layout">
        <section className="rr-detail-main">
          <div className="rr-task-detail-head">
            <span
              className={`rr-task-symbol rr-task-symbol--large rr-tone--${task.color}`}
            >
              <MousePointer2 />
            </span>
            <div>
              <small>
                {task.type.toUpperCase()} · {task.match}% MATCH
              </small>
              <h1>{task.title}</h1>
              <p>
                {task.brand} · {task.category}
              </p>
            </div>
          </div>
          <div className="rr-detail-facts">
            <span>
              <Clock3 />
              <small>Estimated time</small>
              <strong>{task.minutes} minutes</strong>
            </span>
            <span>
              <CircleDollarSign />
              <small>Reward</small>
              <strong>{formatNaira(task.reward)}</strong>
            </span>
            <span>
              <Users />
              <small>Availability</small>
              <strong>{task.spots} spots</strong>
            </span>
          </div>
          <div className="rr-detail-section">
            <h2>What you’ll do</h2>
            <p>{task.description}</p>
          </div>
          <div className="rr-detail-section">
            <h2>Task requirements</h2>
            <ol>
              {task.requirements.map((requirement, index) => (
                <li key={requirement}>
                  <span>{index + 1}</span>
                  {requirement}
                </li>
              ))}
            </ol>
          </div>
          <div className="rr-attention-note">
            <ShieldCheck />
            <div>
              <strong>Attention matters more than speed</strong>
              <p>
                Low-quality or duplicated evidence may be rejected. Follow each
                step and submit only your own response.
              </p>
            </div>
          </div>
        </section>
        <aside className="rr-action-card">
          <small>YOUR REWARD</small>
          <strong>{formatNaira(task.reward)}</strong>
          <p>
            Moves to pending after submission. Most reviews finish within 24
            hours.
          </p>
          <div className="rr-proof-chip">
            <BadgeCheck />
            Screenshot or answer check required
          </div>
          <button
            className="rr-button rr-button--coral rr-button--full"
            onClick={advance}
          >
            {status === "available"
              ? "Start task"
              : status === "in_progress"
                ? "Submit for verification"
                : "View submission"}
            <ArrowRight />
          </button>
          <button
            className="rr-save-button"
            onClick={() => notify("Opportunity saved to your task list.")}
          >
            Save for later
          </button>
          <small className="rr-action-deadline">
            <Clock3 />
            Complete within 20 minutes of starting
          </small>
        </aside>
      </div>
    </>
  );
}

function WalletPage() {
  const { wallet, pending, withdrawals, requestWithdrawal, notify } =
    useProduct();
  const [modal, setModal] = useState(false);
  const [amount, setAmount] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (value < 1000 || value > wallet) return;
    requestWithdrawal(value);
    notify("Withdrawal request submitted for review.");
    setModal(false);
    setAmount("");
  };
  const transactions = [
    {
      label: "Naya skincare survey",
      amount: 450,
      date: "Today",
      type: "credit",
    },
    {
      label: "Kora Living discovery",
      amount: 250,
      date: "Yesterday",
      type: "credit",
    },
    {
      label: "Withdrawal to GTBank · 0192",
      amount: -5000,
      date: "14 Aug",
      type: "debit",
    },
    {
      label: "ChopNow menu discovery",
      amount: 300,
      date: "12 Aug",
      type: "credit",
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="Your money"
        title="Wallet"
        copy="A transparent view of pending, available and withdrawn earnings."
        action={
          <button
            className="rr-button rr-button--coral"
            onClick={() => setModal(true)}
          >
            Withdraw funds <ArrowUpRight />
          </button>
        }
      />
      <section className="rr-balance-grid">
        <article className="rr-main-balance">
          <div>
            <small>AVAILABLE TO WITHDRAW</small>
            <strong>
              {formatNaira(wallet)}
              <i>.00</i>
            </strong>
            <p>Minimum withdrawal: ₦1,000</p>
          </div>
          <span>
            <WalletCards />
          </span>
        </article>
        <StatCard
          icon={<Clock3 />}
          label="Pending verification"
          value={formatNaira(pending)}
          meta="Usually available within 24 hours"
          tone="lime"
        />
        <StatCard
          icon={<TrendingUp />}
          label="All-time earnings"
          value="₦18,650"
          meta="Across 24 approved tasks"
          tone="paper"
        />
      </section>
      <section className="rr-two-column">
        <article className="rr-panel">
          <div className="rr-panel-head">
            <div>
              <small>RECENT ACTIVITY</small>
              <h2>Transactions</h2>
            </div>
            <button
              onClick={() =>
                notify("Transaction statement prepared for download.")
              }
            >
              <Download />
              Export
            </button>
          </div>
          <div className="rr-transaction-list">
            {transactions.map((transaction) => (
              <div key={transaction.label}>
                <span className={transaction.type}>
                  <ArrowDownLeft />
                </span>
                <div>
                  <strong>{transaction.label}</strong>
                  <small>{transaction.date}</small>
                </div>
                <b className={transaction.amount > 0 ? "credit" : ""}>
                  {transaction.amount > 0 ? "+" : "−"}
                  {formatNaira(Math.abs(transaction.amount))}
                </b>
              </div>
            ))}
          </div>
        </article>
        <aside className="rr-panel rr-bank-card">
          <div className="rr-panel-head">
            <div>
              <small>PAYOUT ACCOUNT</small>
              <h2>Bank details</h2>
            </div>
            <button
              onClick={() =>
                notify(
                  "Bank detail editing will connect during the backend phase.",
                )
              }
            >
              <MoreHorizontal />
            </button>
          </div>
          <span>
            <Landmark />
          </span>
          <h3>Guaranty Trust Bank</h3>
          <p>Ada Okafor · •••• 0192</p>
          <div>
            <ShieldCheck />
            Account verified
          </div>
          <small>
            Withdrawals are reviewed before release to protect your earnings.
          </small>
        </aside>
      </section>
      <section className="rr-panel rr-withdraw-history">
        <div className="rr-panel-head">
          <div>
            <small>PAYOUT HISTORY</small>
            <h2>Withdrawal requests</h2>
          </div>
        </div>
        {withdrawals.map((item) => (
          <div className="rr-withdraw-row" key={item.id}>
            <span>
              <Banknote />
            </span>
            <div>
              <strong>{item.id}</strong>
              <small>{item.date}</small>
            </div>
            <b>{formatNaira(item.amount)}</b>
            <em className={item.status.toLowerCase()}>{item.status}</em>
          </div>
        ))}
      </section>
      {modal && (
        <div className="rr-modal-layer">
          <form className="rr-form-modal" onSubmit={submit}>
            <div className="rr-form-modal-head">
              <div>
                <small>NEW WITHDRAWAL</small>
                <h2>Move money to your bank</h2>
              </div>
              <button type="button" onClick={() => setModal(false)}>
                <X />
              </button>
            </div>
            <label>
              Amount to withdraw
              <div className="rr-money-input">
                <span>₦</span>
                <input
                  autoFocus
                  inputMode="numeric"
                  value={amount}
                  onChange={(event) =>
                    setAmount(event.target.value.replace(/\D/g, ""))
                  }
                  placeholder="0"
                />
              </div>
            </label>
            <div className="rr-amount-chips">
              <button type="button" onClick={() => setAmount("1000")}>
                ₦1,000
              </button>
              <button
                type="button"
                onClick={() => setAmount(String(Math.min(3000, wallet)))}
              >
                ₦3,000
              </button>
              <button type="button" onClick={() => setAmount(String(wallet))}>
                All funds
              </button>
            </div>
            <div className="rr-modal-bank">
              <Landmark />
              <span>
                <strong>GTBank · •••• 0192</strong>
                <small>Funds usually arrive within one business day.</small>
              </span>
              <BadgeCheck />
            </div>
            <button
              className="rr-button rr-button--ink rr-button--full"
              disabled={Number(amount) < 1000 || Number(amount) > wallet}
            >
              Request {amount ? formatNaira(Number(amount)) : "withdrawal"}
              <ArrowRight />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function EarnerHistory() {
  const { taskStatuses, notify } = useProduct();
  return (
    <>
      <PageHeading
        eyebrow="Participation record"
        title="Your activity"
        copy="Every opportunity from reservation through verification."
      />
      <div className="rr-history-summary">
        <StatCard
          icon={<CheckCircle2 />}
          label="Approved"
          value="24"
          meta="96% approval rate"
        />
        <StatCard
          icon={<Clock3 />}
          label="Under review"
          value={String(
            Object.values(taskStatuses).filter(
              (status) => status === "submitted",
            ).length + 2,
          )}
          meta="Typical review: 8 hours"
        />
        <StatCard
          icon={<XCircle />}
          label="Rejected"
          value="1"
          meta="Last 30 days"
        />
      </div>
      <section className="rr-panel">
        <div className="rr-panel-head">
          <div>
            <small>ALL SUBMISSIONS</small>
            <h2>Task history</h2>
          </div>
          <button
            onClick={() =>
              notify("History filters opened for status and date selection.")
            }
          >
            <Filter />
            Filter
          </button>
        </div>
        <div className="rr-activity-table">
          <div className="rr-table-head">
            <span>Opportunity</span>
            <span>Date</span>
            <span>Reward</span>
            <span>Status</span>
          </div>
          {tasks.slice(0, 4).map((task, index) => (
            <div className="rr-table-row" key={task.id}>
              <span>
                <i className={`rr-tone--${task.color}`}>
                  <MousePointer2 />
                </i>
                <span>
                  <strong>{task.title}</strong>
                  <small>{task.brand}</small>
                </span>
              </span>
              <span>{index === 0 ? "Today" : `${20 - index} Aug`}</span>
              <strong>{formatNaira(task.reward)}</strong>
              <em className={index === 0 ? "review" : "approved"}>
                {index === 0 ? "Under review" : "Approved"}
              </em>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function EarnerProfile() {
  const { notify } = useProduct();
  const [interests, setInterests] = useState([
    "Technology",
    "Food",
    "Home & living",
    "Beauty",
  ]);
  return (
    <>
      <PageHeading
        eyebrow="Your identity"
        title="Profile & trust"
        copy="A complete, credible profile unlocks better-matched opportunities."
        action={
          <button
            className="rr-button rr-button--ink"
            onClick={() =>
              notify("Profile changes saved locally for this demo.")
            }
          >
            Save changes <Check />
          </button>
        }
      />
      <section className="rr-profile-grid">
        <article className="rr-profile-card">
          <div className="rr-profile-avatar">
            AO
            <span>
              <BadgeCheck />
            </span>
          </div>
          <h2>Ada Okafor</h2>
          <p>Lagos, Nigeria · Joined June 2026</p>
          <div className="rr-profile-level">
            <span>
              <small>TRUST LEVEL</small>
              <strong>Reliable</strong>
            </span>
            <b>86</b>
          </div>
          <div className="rr-completion">
            <span>
              <small>Profile completeness</small>
              <strong>88%</strong>
            </span>
            <i>
              <b style={{ width: "88%" }} />
            </i>
          </div>
        </article>
        <div className="rr-profile-forms">
          <article className="rr-panel">
            <div className="rr-panel-head">
              <div>
                <small>PERSONAL DETAILS</small>
                <h2>About you</h2>
              </div>
            </div>
            <div className="rr-form-grid">
              <ProfileField label="Full name" value="Ada Okafor" />
              <ProfileField label="Phone" value="+234 801 234 5678" />
              <ProfileField label="City" value="Lagos" />
              <ProfileField label="Date of birth" value="14 May 1999" />
            </div>
          </article>
          <article className="rr-panel">
            <div className="rr-panel-head">
              <div>
                <small>INTEREST SIGNALS</small>
                <h2>Topics you care about</h2>
              </div>
            </div>
            <div className="rr-interest-tags">
              {[
                "Technology",
                "Food",
                "Home & living",
                "Beauty",
                "Fitness",
                "Events",
              ].map((interest) => (
                <button
                  className={interests.includes(interest) ? "active" : ""}
                  onClick={() =>
                    setInterests((current) =>
                      current.includes(interest)
                        ? current.filter((item) => item !== interest)
                        : [...current, interest],
                    )
                  }
                  key={interest}
                >
                  {interests.includes(interest) && <Check />}
                  {interest}
                </button>
              ))}
            </div>
            <p className="rr-helper-text">
              Interests start as preferences. RealReach gradually learns from
              your consented activity and campaign choices.
            </p>
          </article>
          <article className="rr-panel">
            <div className="rr-panel-head">
              <div>
                <small>CONNECTED ACCOUNTS</small>
                <h2>Social identity</h2>
              </div>
              <button
                onClick={() =>
                  notify(
                    "Social connection flow is prepared for the backend phase.",
                  )
                }
              >
                <Plus />
                Connect
              </button>
            </div>
            <div className="rr-social-account">
              <span>IG</span>
              <div>
                <strong>@adaokafor</strong>
                <small>Instagram · Connected</small>
              </div>
              <BadgeCheck />
              <button
                aria-label="Manage connected Instagram account"
                onClick={() => notify("Connected account options opened.")}
              >
                <MoreHorizontal />
              </button>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <label className="rr-profile-field">
      <span>{label}</span>
      <input defaultValue={value} />
    </label>
  );
}

function EarnerSettings() {
  return <SettingsPage role="earner" />;
}

function SettingsPage({ role }: { role: ProductRole }) {
  const { notify } = useProduct();
  const [section, setSection] = useState("Account");
  const chooseSection = (next: string) => {
    setSection(next);
    notify(`${next} settings selected.`);
  };
  return (
    <>
      <PageHeading
        eyebrow="Preferences"
        title="Settings"
        copy="Control security, notifications and how RealReach communicates with you."
      />
      <section className="rr-settings-layout">
        <nav>
          <button
            className={section === "Account" ? "active" : ""}
            onClick={() => chooseSection("Account")}
          >
            <UserRound />
            Account
          </button>
          <button
            className={section === "Notifications" ? "active" : ""}
            onClick={() => chooseSection("Notifications")}
          >
            <Bell />
            Notifications
          </button>
          <button
            className={section === "Security" ? "active" : ""}
            onClick={() => chooseSection("Security")}
          >
            <LockKeyhole />
            Security
          </button>
          <button
            className={section === "Privacy" ? "active" : ""}
            onClick={() => chooseSection("Privacy")}
          >
            <ShieldCheck />
            Privacy
          </button>
        </nav>
        <div>
          <article className="rr-panel rr-settings-panel">
            <div className="rr-panel-head">
              <div>
                <small>NOTIFICATION PREFERENCES</small>
                <h2>Keep the useful signals</h2>
              </div>
            </div>
            <ToggleRow
              title={
                role === "business"
                  ? "Campaign milestones"
                  : "New matched tasks"
              }
              copy="Receive an alert when something important becomes available."
              active
            />
            <ToggleRow
              title="Verification updates"
              copy="Know when submissions move from pending to approved."
              active
            />
            <ToggleRow
              title="Product news"
              copy="Occasional updates about new RealReach features."
            />
          </article>
          <article className="rr-panel rr-settings-panel">
            <div className="rr-panel-head">
              <div>
                <small>SECURITY</small>
                <h2>Account protection</h2>
              </div>
            </div>
            <div className="rr-security-row">
              <span>
                <LockKeyhole />
              </span>
              <div>
                <strong>Password</strong>
                <small>Last changed 22 days ago</small>
              </div>
              <button
                onClick={() =>
                  notify("Password reset flow will use Supabase Auth.")
                }
              >
                Change
              </button>
            </div>
            <div className="rr-security-row">
              <span>
                <ShieldCheck />
              </span>
              <div>
                <strong>Two-step verification</strong>
                <small>Recommended for payouts and campaign funding</small>
              </div>
              <button
                onClick={() =>
                  notify("Two-step verification queued for the backend phase.")
                }
              >
                Set up
              </button>
            </div>
          </article>
          <button
            className="rr-danger-button"
            onClick={() =>
              notify(
                "Account deletion requires identity verification and is not enabled in this demo.",
              )
            }
          >
            Request account deletion
          </button>
        </div>
      </section>
    </>
  );
}

function ToggleRow({
  title,
  copy,
  active = false,
}: {
  title: string;
  copy: string;
  active?: boolean;
}) {
  const [checked, setChecked] = useState(active);
  return (
    <button className="rr-toggle-row" onClick={() => setChecked(!checked)}>
      <span>
        <strong>{title}</strong>
        <small>{copy}</small>
      </span>
      <i className={checked ? "active" : ""}>
        <b />
      </i>
    </button>
  );
}

function HelpPage({ role }: { role: ProductRole }) {
  const { notify } = useProduct();
  const [open, setOpen] = useState(0);
  const faqs =
    role === "earner"
      ? [
          "How does task verification work?",
          "When can I withdraw my earnings?",
          "Why did an opportunity disappear?",
          "How is my trust score calculated?",
        ]
      : [
          "How are campaign actions verified?",
          "When is unused budget refunded?",
          "Can I pause a live campaign?",
          "How does audience matching work?",
        ];
  return (
    <>
      <PageHeading
        eyebrow="RealReach support"
        title="How can we help?"
        copy="Clear answers, fast escalation and no mystery ticket queues."
      />
      <div className="rr-help-hero">
        <div>
          <Headphones />
          <span>
            <small>AVERAGE RESPONSE</small>
            <strong>Under 3 hours</strong>
          </span>
        </div>
        <button
          className="rr-button rr-button--cream"
          onClick={() => notify("Support conversation started in demo mode.")}
        >
          Start a conversation <MessageCircle />
        </button>
      </div>
      <div className="rr-help-grid">
        <section className="rr-panel">
          <div className="rr-panel-head">
            <div>
              <small>COMMON QUESTIONS</small>
              <h2>Frequently asked</h2>
            </div>
          </div>
          <div className="rr-faqs">
            {faqs.map((faq, index) => (
              <button
                className={open === index ? "open" : ""}
                onClick={() => setOpen(index === open ? -1 : index)}
                key={faq}
              >
                <span>
                  <strong>{faq}</strong>
                  {open === index && (
                    <p>
                      {index === 0
                        ? "RealReach combines task-specific evidence, account history and human review where necessary. Each task shows its verification method before you begin."
                        : "This workflow is clearly explained inside the relevant section of your account, with support available when something looks wrong."}
                    </p>
                  )}
                </span>
                <ChevronDown />
              </button>
            ))}
          </div>
        </section>
        <aside className="rr-help-links">
          <Link to={role === "earner" ? "/earn/tasks" : "/business/campaigns"}>
            <FileText />
            <span>
              <strong>Guides & walkthroughs</strong>
              <small>Learn the full RealReach workflow.</small>
            </span>
            <ArrowRight />
          </Link>
          <button
            onClick={() =>
              notify("Status: all RealReach demo systems operational.")
            }
          >
            <Gauge />
            <span>
              <strong>Platform status</strong>
              <small>All systems operational.</small>
            </span>
            <ArrowRight />
          </button>
          <a href="mailto:support@realreach.ng">
            <Mail />
            <span>
              <strong>Email support</strong>
              <small>support@realreach.ng</small>
            </span>
            <ArrowRight />
          </a>
        </aside>
      </div>
    </>
  );
}

export function BusinessProduct() {
  const path = useLocation().pathname;
  let title = "Overview";
  let content: ReactNode = <BusinessOverview />;
  if (path === "/business/campaigns") {
    title = "Campaigns";
    content = <CampaignsPage />;
  } else if (path === "/business/campaigns/new") {
    title = "Create campaign";
    content = <CampaignBuilder />;
  } else if (path.startsWith("/business/campaigns/")) {
    title = "Campaign details";
    content = <CampaignDetails campaignId={path.split("/").pop() ?? ""} />;
  } else if (path === "/business/analytics") {
    title = "Analytics";
    content = <AnalyticsPage />;
  } else if (path === "/business/audience") {
    title = "Audience";
    content = <AudiencePage />;
  } else if (path === "/business/billing") {
    title = "Billing";
    content = <BillingPage />;
  } else if (path === "/business/settings") {
    title = "Settings";
    content = <BusinessSettings />;
  } else if (path === "/business/help") {
    title = "Help & support";
    content = <HelpPage role="business" />;
  }
  return (
    <ProductShell
      role="business"
      pageTitle={title}
      pageEyebrow="Business workspace"
    >
      {content}
    </ProductShell>
  );
}

function BusinessOverview() {
  const navigate = useNavigate();
  const { campaigns } = useProduct();
  const live = campaigns.filter((campaign) => campaign.status === "live");
  return (
    <>
      <PageHeading
        eyebrow="Business overview"
        title="Good morning, Amaka."
        copy="Here’s how Kora Living is reaching people this week."
        action={
          <button
            className="rr-button rr-button--coral"
            onClick={() => navigate("/business/campaigns/new")}
          >
            <Plus />
            Create campaign
          </button>
        }
      />
      <section className="rr-business-stats">
        <StatCard
          icon={<Eye />}
          label="Verified reach"
          value="2,486"
          meta="↑ 18.4% vs last week"
        />
        <StatCard
          icon={<BadgeCheck />}
          label="Completion rate"
          value="91.8%"
          meta="↑ 4.2% vs last week"
        />
        <StatCard
          icon={<MousePointer2 />}
          label="Offer clicks"
          value="384"
          meta="↑ 12.6% vs last week"
        />
        <StatCard
          icon={<Banknote />}
          label="Campaign spend"
          value="₦186k"
          meta={`${live.length} active campaigns`}
        />
      </section>
      <section className="rr-dashboard-grid">
        <PerformancePanel />
        <AudienceFitPanel />
      </section>
      <section className="rr-panel rr-live-campaigns">
        <div className="rr-panel-head">
          <div>
            <small>LIVE WORK</small>
            <h2>Active campaigns</h2>
          </div>
          <button onClick={() => navigate("/business/campaigns")}>
            Manage all <ArrowRight />
          </button>
        </div>
        <div className="rr-campaign-list">
          {live.map((campaign) => (
            <CampaignListRow campaign={campaign} key={campaign.id} />
          ))}
        </div>
      </section>
    </>
  );
}

function PerformancePanel() {
  return (
    <article className="rr-panel rr-performance">
      <div className="rr-panel-head">
        <div>
          <small>CAMPAIGN PERFORMANCE</small>
          <h2>Verified participation</h2>
        </div>
        <select aria-label="Analytics range">
          <option>Last 7 days</option>
          <option>Last 30 days</option>
        </select>
      </div>
      <div className="rr-chart-total">
        <strong>2,486</strong>
        <span>
          <TrendingUp />
          18.4%
        </span>
        <small>vs previous period</small>
      </div>
      <div className="rr-bar-chart">
        <div className="rr-y-axis">
          <span>600</span>
          <span>400</span>
          <span>200</span>
          <span>0</span>
        </div>
        {[38, 55, 44, 67, 61, 82, 72].map((height, index) => (
          <div className="rr-bar" key={index}>
            <i style={{ height: `${height}%` }} />
            <span>{["M", "T", "W", "T", "F", "S", "S"][index]}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function AudienceFitPanel() {
  const { notify } = useProduct();
  return (
    <article className="rr-panel rr-audience-fit">
      <div className="rr-panel-head">
        <div>
          <small>AUDIENCE QUALITY</small>
          <h2>Who you reached</h2>
        </div>
        <button
          aria-label="Audience report options"
          onClick={() => notify("Audience quality report options opened.")}
        >
          <MoreHorizontal />
        </button>
      </div>
      <div className="rr-donut-row">
        <div className="rr-donut">
          <span>
            <strong>74%</strong>
            <small>strong fit</small>
          </span>
        </div>
        <div className="rr-donut-key">
          <span>
            <i className="lime" />
            <b>Interest matched</b>
            <small>1,840</small>
          </span>
          <span>
            <i className="coral" />
            <b>General reach</b>
            <small>492</small>
          </span>
          <span>
            <i className="lilac" />
            <b>High intent</b>
            <small>154</small>
          </span>
        </div>
      </div>
      <div className="rr-insight">
        <Sparkles />
        <span>
          <strong>Your audience fit improved.</strong>
          <small>Lifestyle matching is performing 1.4× better.</small>
        </span>
      </div>
    </article>
  );
}

function CampaignListRow({ campaign }: { campaign: MockCampaign }) {
  const navigate = useNavigate();
  const progress = Math.min(
    100,
    Math.round((campaign.verified / campaign.goal) * 100),
  );
  return (
    <button
      className="rr-campaign-row"
      onClick={() => navigate(`/business/campaigns/${campaign.id}`)}
    >
      <span className="rr-campaign-icon">
        <Megaphone />
      </span>
      <span className="rr-campaign-name">
        <strong>{campaign.name}</strong>
        <small>
          {campaign.type} · {campaign.audience}
        </small>
      </span>
      <span className="rr-campaign-progress">
        <i>
          <b style={{ width: `${progress}%` }} />
        </i>
        <small>{progress}%</small>
      </span>
      <span className={`rr-campaign-status ${campaign.status}`}>
        <i />
        {campaign.status}
      </span>
      <span className="rr-campaign-result">
        <strong>{campaign.verified.toLocaleString()}</strong>
        <small>of {campaign.goal.toLocaleString()}</small>
      </span>
      <ChevronRight />
    </button>
  );
}

function CampaignsPage() {
  const navigate = useNavigate();
  const { campaigns } = useProduct();
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const shown = campaigns.filter(
    (campaign) =>
      (status === "all" || campaign.status === status) &&
      campaign.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="Campaign management"
        title="Every campaign, one clear view."
        copy="Create, review, pause and understand the work your business has in market."
        action={
          <button
            className="rr-button rr-button--coral"
            onClick={() => navigate("/business/campaigns/new")}
          >
            <Plus />
            New campaign
          </button>
        }
      />
      <section className="rr-campaign-toolbar">
        <label>
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search campaigns"
          />
        </label>
        <div>
          {["all", "live", "review", "draft", "completed"].map((item) => (
            <button
              className={status === item ? "active" : ""}
              onClick={() => setStatus(item)}
              key={item}
            >
              {item}
            </button>
          ))}
        </div>
      </section>
      <section className="rr-panel rr-campaign-page-list">
        {shown.map((campaign) => (
          <CampaignListRow campaign={campaign} key={campaign.id} />
        ))}
        {shown.length === 0 && (
          <EmptyState
            icon={<Megaphone />}
            title="No campaigns here"
            copy="Change the filter or create a new campaign."
            action={
              <button
                className="rr-button rr-button--ink"
                onClick={() => navigate("/business/campaigns/new")}
              >
                Create campaign
              </button>
            }
          />
        )}
      </section>
    </>
  );
}

function CampaignBuilder() {
  const navigate = useNavigate();
  const { addCampaign, notify } = useProduct();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    type: "Social discovery",
    audience: "Lagos · Lifestyle",
    goal: 500,
    reward: 250,
  });
  const budget = form.goal * (form.reward + 70);
  const next = (event?: FormEvent) => {
    event?.preventDefault();
    if (step < 3) setStep(step + 1);
    else {
      const id =
        form.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || `campaign-${Date.now()}`;
      addCampaign({
        id,
        name: form.name || "Untitled campaign",
        type: form.type,
        audience: form.audience,
        goal: form.goal,
        verified: 0,
        budget,
        status: "review",
      });
      notify("Campaign submitted for RealReach review.");
      navigate("/business/campaigns");
    }
  };
  return (
    <>
      <button
        className="rr-back"
        onClick={() =>
          step > 1 ? setStep(step - 1) : navigate("/business/campaigns")
        }
      >
        <ArrowLeft />
        {step > 1 ? "Previous step" : "Back to campaigns"}
      </button>
      <div className="rr-builder-layout">
        <section className="rr-builder-main">
          <div className="rr-builder-head">
            <span>STEP {step} OF 3</span>
            <div>
              {[1, 2, 3].map((item) => (
                <i className={step >= item ? "active" : ""} key={item} />
              ))}
            </div>
            <h1>
              {step === 1
                ? "What should people do?"
                : step === 2
                  ? "Who should this reach?"
                  : "Review the campaign economics."}
            </h1>
            <p>
              {step === 1
                ? "Start with one focused, verifiable action."
                : step === 2
                  ? "Choose useful matching signals without overpromising intent."
                  : "See exactly how business spend, user rewards and platform costs fit together."}
            </p>
          </div>
          <form onSubmit={next}>
            {step === 1 && (
              <div className="rr-builder-fields">
                <label>
                  <span>Campaign name</span>
                  <input
                    required
                    value={form.name}
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                    placeholder="e.g. September collection discovery"
                  />
                </label>
                <div>
                  <span>Campaign type</span>
                  <div className="rr-option-grid">
                    {[
                      {
                        name: "Social discovery",
                        icon: <Eye />,
                        copy: "Pay for genuine attention, not forced positivity.",
                      },
                      {
                        name: "Audience survey",
                        icon: <MessageCircle />,
                        copy: "Learn directly from a matched human panel.",
                      },
                      {
                        name: "Offer discovery",
                        icon: <MousePointer2 />,
                        copy: "Drive people to an offer and measure next steps.",
                      },
                    ].map((option) => (
                      <button
                        type="button"
                        className={form.type === option.name ? "active" : ""}
                        onClick={() => setForm({ ...form, type: option.name })}
                        key={option.name}
                      >
                        {option.icon}
                        <span>
                          <strong>{option.name}</strong>
                          <small>{option.copy}</small>
                        </span>
                        {form.type === option.name && <CheckCircle2 />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="rr-builder-fields">
                <label>
                  <span>Audience preset</span>
                  <select
                    value={form.audience}
                    onChange={(event) =>
                      setForm({ ...form, audience: event.target.value })
                    }
                  >
                    <option>Lagos · Lifestyle</option>
                    <option>Nigeria · Home & living</option>
                    <option>Abuja · 21–35</option>
                    <option>Nigeria · General reach</option>
                  </select>
                </label>
                <div className="rr-audience-preview">
                  <div>
                    <Target />
                    <span>
                      <small>ESTIMATED ELIGIBLE AUDIENCE</small>
                      <strong>8,420 people</strong>
                    </span>
                  </div>
                  <p>
                    Based on location, category affinity, trust score and
                    current campaign saturation.
                  </p>
                  <div>
                    <span>Lagos</span>
                    <span>Lifestyle</span>
                    <span>Trust 60+</span>
                    <span>Low saturation</span>
                  </div>
                </div>
                <label>
                  <span>Campaign size</span>
                  <div className="rr-range-value">
                    <strong>{form.goal.toLocaleString()} people</strong>
                    <small>Drag to adjust</small>
                  </div>
                  <input
                    className="rr-range"
                    type="range"
                    min="100"
                    max="2500"
                    step="100"
                    value={form.goal}
                    onChange={(event) =>
                      setForm({ ...form, goal: Number(event.target.value) })
                    }
                  />
                </label>
              </div>
            )}
            {step === 3 && (
              <div className="rr-review-card">
                <div className="rr-review-title">
                  <span>
                    <Megaphone />
                  </span>
                  <div>
                    <small>{form.type.toUpperCase()}</small>
                    <h2>{form.name || "Untitled campaign"}</h2>
                    <p>{form.audience}</p>
                  </div>
                </div>
                <div className="rr-review-numbers">
                  <span>
                    <small>Campaign size</small>
                    <strong>{form.goal.toLocaleString()}</strong>
                  </span>
                  <span>
                    <small>Earner reward</small>
                    <strong>{formatNaira(form.reward)}</strong>
                  </span>
                  <span>
                    <small>Estimated total</small>
                    <strong>{formatNaira(budget)}</strong>
                  </span>
                </div>
                <div className="rr-cost-breakdown">
                  <span>
                    <small>User rewards</small>
                    <strong>{formatNaira(form.goal * form.reward)}</strong>
                  </span>
                  <i>
                    <b style={{ width: "78%" }} />
                  </i>
                  <span>
                    <small>Verification, operations & RealReach</small>
                    <strong>{formatNaira(form.goal * 70)}</strong>
                  </span>
                </div>
                <div className="rr-attention-note">
                  <ShieldCheck />
                  <div>
                    <strong>Campaign review comes before funding</strong>
                    <p>
                      RealReach will confirm policy fit, verification
                      requirements and final pricing before the campaign can go
                      live.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="rr-builder-actions">
              <button
                type="button"
                onClick={() => navigate("/business/campaigns")}
              >
                Save draft
              </button>
              <button className="rr-button rr-button--coral" type="submit">
                {step === 3 ? "Submit for review" : "Continue"}
                <ArrowRight />
              </button>
            </div>
          </form>
        </section>
        <aside className="rr-builder-aside">
          <span>
            <Sparkles />
          </span>
          <small>CAMPAIGN COACH</small>
          <h3>
            {step === 1
              ? "The strongest task asks for one clear behavior."
              : step === 2
                ? "Relevance improves quality, but shrinks available reach."
                : "Transparent economics build repeatable campaigns."}
          </h3>
          <p>
            {step === 1
              ? "Avoid mixing discovery, comments and surveys in the same task. Focused work is easier to complete and verify."
              : step === 2
                ? "Start with location and category fit. Demonstrated-interest audiences become available as the marketplace learns."
                : "This estimate separates the reward pool from RealReach’s verification and operating spread."}
          </p>
        </aside>
      </div>
    </>
  );
}

function CampaignDetails({ campaignId }: { campaignId: string }) {
  const { campaigns, notify } = useProduct();
  const navigate = useNavigate();
  const campaign = campaigns.find((item) => item.id === campaignId);
  if (!campaign)
    return (
      <EmptyState
        icon={<Megaphone />}
        title="Campaign not found"
        copy="It may have been archived or moved."
        action={
          <button
            className="rr-button rr-button--ink"
            onClick={() => navigate("/business/campaigns")}
          >
            Back to campaigns
          </button>
        }
      />
    );
  const progress = Math.min(
    100,
    Math.round((campaign.verified / campaign.goal) * 100),
  );
  return (
    <>
      <button
        className="rr-back"
        onClick={() => navigate("/business/campaigns")}
      >
        <ArrowLeft />
        Back to campaigns
      </button>
      <PageHeading
        eyebrow={`${campaign.status} campaign`}
        title={campaign.name}
        copy={`${campaign.type} · ${campaign.audience}`}
        action={
          <div className="rr-heading-actions">
            <button
              className="rr-button rr-button--ghost"
              onClick={() => notify("Campaign export prepared.")}
            >
              <Download />
              Export
            </button>
            <button
              className="rr-button rr-button--ink"
              onClick={() =>
                notify(
                  campaign.status === "live"
                    ? "Campaign paused in demo mode."
                    : "Campaign duplicated as a draft.",
                )
              }
            >
              {campaign.status === "live" ? "Pause campaign" : "Duplicate"}
            </button>
          </div>
        }
      />
      <section className="rr-business-stats">
        <StatCard
          icon={<Users />}
          label="Verified"
          value={campaign.verified.toLocaleString()}
          meta={`of ${campaign.goal.toLocaleString()} people`}
        />
        <StatCard
          icon={<Gauge />}
          label="Progress"
          value={`${progress}%`}
          meta={campaign.status === "live" ? "On track" : campaign.status}
        />
        <StatCard
          icon={<MousePointer2 />}
          label="Offer clicks"
          value="140"
          meta="16.6% of verified reach"
        />
        <StatCard
          icon={<Banknote />}
          label="Spend used"
          value={formatNaira(Math.round((campaign.budget * progress) / 100))}
          meta={`of ${formatNaira(campaign.budget)}`}
        />
      </section>
      <section className="rr-dashboard-grid">
        <PerformancePanel />
        <article className="rr-panel rr-campaign-health">
          <div className="rr-panel-head">
            <div>
              <small>CAMPAIGN HEALTH</small>
              <h2>Quality signals</h2>
            </div>
          </div>
          <QualityRow label="Proof approval" value="93%" tone="lime" />
          <QualityRow label="Attention checks" value="88%" tone="coral" />
          <QualityRow label="7-day retention" value="81%" tone="lilac" />
          <QualityRow label="Dispute rate" value="1.2%" tone="ink" />
        </article>
      </section>
      <section className="rr-panel">
        <div className="rr-panel-head">
          <div>
            <small>RECENT EVENTS</small>
            <h2>Campaign activity</h2>
          </div>
        </div>
        <div className="rr-timeline">
          <TimelineItem
            title="50 new actions verified"
            copy="Campaign reached 842 verified people."
            time="12 min ago"
          />
          <TimelineItem
            title="Audience quality recalculated"
            copy="Strong-fit share increased from 69% to 74%."
            time="Today, 09:42"
          />
          <TimelineItem
            title="Campaign passed midpoint"
            copy="No fraud or saturation alerts detected."
            time="Yesterday"
          />
        </div>
      </section>
    </>
  );
}

function QualityRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rr-quality-row">
      <span>{label}</span>
      <i>
        <b className={tone} style={{ width: value }} />
      </i>
      <strong>{value}</strong>
    </div>
  );
}
function TimelineItem({
  title,
  copy,
  time,
}: {
  title: string;
  copy: string;
  time: string;
}) {
  return (
    <div>
      <i />
      <span>
        <strong>{title}</strong>
        <small>{copy}</small>
      </span>
      <time>{time}</time>
    </div>
  );
}

function AnalyticsPage() {
  const { notify } = useProduct();
  return (
    <>
      <PageHeading
        eyebrow="Performance intelligence"
        title="See what attention became."
        copy="Move from quantity delivered toward quality and measurable next actions."
        action={
          <button
            className="rr-button rr-button--ink"
            onClick={() => notify("Analytics report prepared for download.")}
          >
            <Download />
            Export report
          </button>
        }
      />
      <section className="rr-business-stats">
        <StatCard
          icon={<Eye />}
          label="People reached"
          value="8,240"
          meta="Across all campaigns"
        />
        <StatCard
          icon={<BadgeCheck />}
          label="Verified actions"
          value="7,462"
          meta="90.6% completion"
        />
        <StatCard
          icon={<MousePointer2 />}
          label="Click-through"
          value="14.8%"
          meta="1,105 tracked clicks"
        />
        <StatCard
          icon={<MessageCircle />}
          label="Enquiries"
          value="96"
          meta="8.7% of clickers"
        />
      </section>
      <section className="rr-analytics-hero">
        <PerformancePanel />
        <article className="rr-panel rr-funnel">
          <div className="rr-panel-head">
            <div>
              <small>OUTCOME FUNNEL</small>
              <h2>From reach to intent</h2>
            </div>
          </div>
          <div>
            <span style={{ width: "100%" }}>
              <strong>7,462</strong>
              <small>Verified attention</small>
            </span>
            <span style={{ width: "76%" }}>
              <strong>3,280</strong>
              <small>Relevant interest</small>
            </span>
            <span style={{ width: "48%" }}>
              <strong>1,105</strong>
              <small>Offer clicks</small>
            </span>
            <span style={{ width: "24%" }}>
              <strong>96</strong>
              <small>Enquiries</small>
            </span>
          </div>
        </article>
      </section>
      <section className="rr-panel rr-category-table">
        <div className="rr-panel-head">
          <div>
            <small>CATEGORY LEARNING</small>
            <h2>What is performing</h2>
          </div>
          <button
            onClick={() =>
              notify("Analytics range changed to the last 90 days.")
            }
          >
            <Filter />
            Last 90 days
          </button>
        </div>
        <div className="rr-table-head">
          <span>Category</span>
          <span>Verified reach</span>
          <span>Strong fit</span>
          <span>Click rate</span>
          <span>Trend</span>
        </div>
        {[
          ["Home & living", "3,240", "78%", "16.8%", "+4.2%"],
          ["Lifestyle", "2,110", "74%", "14.2%", "+2.1%"],
          ["Fashion", "1,420", "68%", "11.9%", "−0.8%"],
          ["General reach", "692", "42%", "6.4%", "+0.3%"],
        ].map((row) => (
          <div className="rr-table-row" key={row[0]}>
            {row.map((cell, index) =>
              index === 0 ? (
                <strong key={cell}>{cell}</strong>
              ) : (
                <span className={index === 4 ? "rr-trend-cell" : ""} key={cell}>
                  {cell}
                </span>
              ),
            )}
          </div>
        ))}
      </section>
    </>
  );
}

function AudiencePage() {
  const { notify } = useProduct();
  return (
    <>
      <PageHeading
        eyebrow="Audience intelligence"
        title="Understand who your business reaches."
        copy="Useful audience signals, reliability and saturation—without pretending paid attention is organic intent."
      />
      <section className="rr-audience-summary">
        <article className="rr-panel rr-audience-map">
          <div className="rr-panel-head">
            <div>
              <small>GEOGRAPHY</small>
              <h2>Audience concentration</h2>
            </div>
            <button
              onClick={() => notify("Geography selector opened for Nigeria.")}
            >
              All Nigeria <ChevronDown />
            </button>
          </div>
          <div className="rr-map-shape">
            <span className="dot dot--lagos">
              <i />
              Lagos <b>48%</b>
            </span>
            <span className="dot dot--abuja">
              <i />
              Abuja <b>18%</b>
            </span>
            <span className="dot dot--ibadan">
              <i />
              Ibadan <b>11%</b>
            </span>
            <div className="rr-map-abstract" />
          </div>
        </article>
        <article className="rr-panel rr-segment-panel">
          <div className="rr-panel-head">
            <div>
              <small>TOP SEGMENTS</small>
              <h2>Strongest audience fits</h2>
            </div>
          </div>
          <SegmentRow
            name="Lagos home makers"
            meta="Home & living · Reliable"
            people="2,840"
            score={92}
          />
          <SegmentRow
            name="Design-led renters"
            meta="Lifestyle · 22–34"
            people="1,620"
            score={86}
          />
          <SegmentRow
            name="Value-conscious shoppers"
            meta="General · Nigeria"
            people="3,410"
            score={74}
          />
        </article>
      </section>
      <section className="rr-dashboard-grid">
        <article className="rr-panel rr-saturation">
          <div className="rr-panel-head">
            <div>
              <small>AUDIENCE HEALTH</small>
              <h2>Commercial saturation</h2>
            </div>
          </div>
          <div className="rr-saturation-gauge">
            <div>
              <strong>Low</strong>
              <small>Current audience pressure</small>
            </div>
          </div>
          <p>
            Most people in your matching pool have seen fewer than three similar
            campaigns this month.
          </p>
          <span>
            <ShieldCheck />
            Healthy capacity for another lifestyle campaign
          </span>
        </article>
        <AudienceFitPanel />
      </section>
    </>
  );
}

function SegmentRow({
  name,
  meta,
  people,
  score,
}: {
  name: string;
  meta: string;
  people: string;
  score: number;
}) {
  const { notify } = useProduct();
  return (
    <button
      className="rr-segment-row"
      onClick={() => notify(`${name} audience segment opened.`)}
    >
      <span>
        <Users />
      </span>
      <div>
        <strong>{name}</strong>
        <small>{meta}</small>
      </div>
      <b>
        {people}
        <small>people</small>
      </b>
      <em>{score}% fit</em>
      <ChevronRight />
    </button>
  );
}

function BillingPage() {
  const { notify } = useProduct();
  return (
    <>
      <PageHeading
        eyebrow="Money & funding"
        title="Billing"
        copy="Track campaign funding, spend and refunds from a real ledger—not an editable balance."
        action={
          <button
            className="rr-button rr-button--coral"
            onClick={() =>
              notify(
                "Payment flow is ready to connect to the selected provider.",
              )
            }
          >
            <Plus />
            Add funds
          </button>
        }
      />
      <section className="rr-balance-grid">
        <article className="rr-main-balance rr-main-balance--business">
          <div>
            <small>CAMPAIGN BALANCE</small>
            <strong>₦420,000</strong>
            <p>Available for approved campaigns</p>
          </div>
          <span>
            <CreditCard />
          </span>
        </article>
        <StatCard
          icon={<Clock3 />}
          label="Reserved"
          value="₦186,000"
          meta="Across 3 active campaigns"
          tone="lime"
        />
        <StatCard
          icon={<ArrowDownLeft />}
          label="Refundable"
          value="₦24,500"
          meta="From completed campaigns"
        />
      </section>
      <section className="rr-two-column">
        <article className="rr-panel">
          <div className="rr-panel-head">
            <div>
              <small>LEDGER</small>
              <h2>Billing activity</h2>
            </div>
            <button onClick={() => notify("Billing statement exported.")}>
              <Download />
              Export
            </button>
          </div>
          <div className="rr-transaction-list">
            <BillingTransaction
              label="Campaign funding"
              meta="Kora Summer Discovery"
              amount="−₦120,000"
            />
            <BillingTransaction
              label="Balance top-up"
              meta="Paystack card · •••• 4421"
              amount="+₦500,000"
              credit
            />
            <BillingTransaction
              label="Unused campaign funds"
              meta="June audience pulse"
              amount="+₦24,500"
              credit
            />
            <BillingTransaction
              label="Campaign funding"
              meta="Home styling pulse"
              amount="−₦90,000"
            />
          </div>
        </article>
        <aside className="rr-panel rr-bank-card">
          <div className="rr-panel-head">
            <div>
              <small>PAYMENT METHOD</small>
              <h2>Primary card</h2>
            </div>
            <button
              aria-label="Payment card options"
              onClick={() => notify("Primary card options opened.")}
            >
              <MoreHorizontal />
            </button>
          </div>
          <span>
            <CreditCard />
          </span>
          <h3>Visa ending 4421</h3>
          <p>Expires 08 / 29</p>
          <div>
            <ShieldCheck />
            Securely stored by payment provider
          </div>
          <button
            className="rr-button rr-button--ghost rr-button--full"
            onClick={() => notify("Payment method editor opened in demo mode.")}
          >
            Manage payment methods
          </button>
        </aside>
      </section>
    </>
  );
}
function BillingTransaction({
  label,
  meta,
  amount,
  credit = false,
}: {
  label: string;
  meta: string;
  amount: string;
  credit?: boolean;
}) {
  return (
    <div>
      <span className={credit ? "credit" : "debit"}>
        {credit ? <ArrowDownLeft /> : <ArrowUpRight />}
      </span>
      <div>
        <strong>{label}</strong>
        <small>{meta}</small>
      </div>
      <b className={credit ? "credit" : ""}>{amount}</b>
    </div>
  );
}

function BusinessSettings() {
  const { notify } = useProduct();
  return (
    <>
      <PageHeading
        eyebrow="Workspace"
        title="Business settings"
        copy="Manage business identity, team access and security."
        action={
          <button
            className="rr-button rr-button--ink"
            onClick={() => notify("Business settings saved locally.")}
          >
            Save changes <Check />
          </button>
        }
      />
      <section className="rr-profile-grid">
        <article className="rr-profile-card rr-business-profile">
          <div className="rr-profile-avatar">
            KL
            <span>
              <BadgeCheck />
            </span>
          </div>
          <h2>Kora Living</h2>
          <p>Home & living · Lagos, Nigeria</p>
          <div className="rr-business-verified">
            <ShieldCheck />
            <span>
              <strong>Verified business</strong>
              <small>Identity and payout checks complete</small>
            </span>
          </div>
        </article>
        <div className="rr-profile-forms">
          <article className="rr-panel">
            <div className="rr-panel-head">
              <div>
                <small>BUSINESS IDENTITY</small>
                <h2>Public details</h2>
              </div>
            </div>
            <div className="rr-form-grid">
              <ProfileField label="Business name" value="Kora Living" />
              <ProfileField label="Category" value="Home & living" />
              <ProfileField
                label="Business email"
                value="hello@koraliving.ng"
              />
              <ProfileField label="Location" value="Lagos, Nigeria" />
            </div>
          </article>
          <article className="rr-panel">
            <div className="rr-panel-head">
              <div>
                <small>TEAM ACCESS</small>
                <h2>Workspace members</h2>
              </div>
              <button onClick={() => notify("Team invitation prepared.")}>
                <Plus />
                Invite
              </button>
            </div>
            <div className="rr-team-member">
              <span>AO</span>
              <div>
                <strong>Amaka Okafor</strong>
                <small>amaka@koraliving.ng</small>
              </div>
              <b>Owner</b>
              <MoreHorizontal />
            </div>
            <div className="rr-team-member">
              <span>TO</span>
              <div>
                <strong>Tolu Oladipo</strong>
                <small>tolu@koraliving.ng</small>
              </div>
              <b>Analyst</b>
              <MoreHorizontal />
            </div>
          </article>
          <SettingsPage role="business" />
        </div>
      </section>
    </>
  );
}

export function AdminProduct() {
  const path = useLocation().pathname;
  let title = "Command centre";
  let content: ReactNode = <AdminOverview />;
  if (path === "/admin/campaigns") {
    title = "Campaign reviews";
    content = <AdminCampaigns />;
  } else if (path === "/admin/proofs") {
    title = "Proof queue";
    content = <AdminProofs />;
  } else if (path === "/admin/payouts") {
    title = "Payouts";
    content = <AdminPayouts />;
  } else if (path === "/admin/users") {
    title = "People";
    content = <AdminUsers />;
  } else if (path === "/admin/settings") {
    title = "Admin settings";
    content = <SettingsPage role="admin" />;
  }
  return (
    <ProductShell
      role="admin"
      pageTitle={title}
      pageEyebrow="Internal operations"
    >
      {content}
    </ProductShell>
  );
}

function AdminOverview() {
  const navigate = useNavigate();
  return (
    <>
      <PageHeading
        eyebrow="Saturday operations"
        title="Marketplace command centre"
        copy="Review the work that protects campaign quality, user trust and platform economics."
      />
      <section className="rr-business-stats">
        <StatCard
          icon={<ClipboardCheck />}
          label="Campaign reviews"
          value="7"
          meta="2 waiting over 4 hours"
          tone="coral"
        />
        <StatCard
          icon={<FileCheck2 />}
          label="Proof queue"
          value="24"
          meta="Median age: 38 minutes"
          tone="lime"
        />
        <StatCard
          icon={<Banknote />}
          label="Payout requests"
          value="₦284k"
          meta="18 requests pending"
        />
        <StatCard
          icon={<ShieldAlert />}
          label="Risk alerts"
          value="5"
          meta="2 high-priority accounts"
        />
      </section>
      <section className="rr-admin-grid">
        <article className="rr-panel">
          <div className="rr-panel-head">
            <div>
              <small>PRIORITY QUEUE</small>
              <h2>Needs attention</h2>
            </div>
            <button onClick={() => navigate("/admin/proofs")}>
              Open full queue <ArrowRight />
            </button>
          </div>
          <AdminQueueRow
            icon={<FileCheck2 />}
            title="Proof batch #882"
            copy="Kora Summer Discovery · 12 submissions"
            age="18 min"
            priority="normal"
          />
          <AdminQueueRow
            icon={<ShieldAlert />}
            title="Repeated evidence pattern"
            copy="Three accounts share a proof fingerprint"
            age="32 min"
            priority="high"
          />
          <AdminQueueRow
            icon={<Banknote />}
            title="High-value payout review"
            copy="WD-4429 · ₦42,500"
            age="54 min"
            priority="normal"
          />
        </article>
        <article className="rr-panel rr-market-health">
          <div className="rr-panel-head">
            <div>
              <small>MARKETPLACE HEALTH</small>
              <h2>Today at a glance</h2>
            </div>
          </div>
          <QualityRow label="Campaign fill rate" value="91%" tone="lime" />
          <QualityRow label="Proof approval" value="94%" tone="coral" />
          <QualityRow label="Payout success" value="98%" tone="lilac" />
          <QualityRow label="Fraud containment" value="87%" tone="ink" />
        </article>
      </section>
      <section className="rr-panel rr-ops-feed">
        <div className="rr-panel-head">
          <div>
            <small>OPERATIONS FEED</small>
            <h2>Recent platform events</h2>
          </div>
        </div>
        <div className="rr-timeline">
          <TimelineItem
            title="Campaign approved"
            copy="Naya Skin audience survey · ₦180,000 budget"
            time="10:42"
          />
          <TimelineItem
            title="Payout batch released"
            copy="₦1.24m across 418 earners"
            time="09:15"
          />
          <TimelineItem
            title="User trust score reduced"
            copy="Repeated task reversals detected"
            time="08:58"
          />
        </div>
      </section>
    </>
  );
}

function AdminQueueRow({
  icon,
  title,
  copy,
  age,
  priority,
}: {
  icon: ReactNode;
  title: string;
  copy: string;
  age: string;
  priority: "normal" | "high";
}) {
  const navigate = useNavigate();
  const destination = title.includes("payout")
    ? "/admin/payouts"
    : "/admin/proofs";
  return (
    <button
      className="rr-admin-queue-row"
      onClick={() => navigate(destination)}
    >
      <span>{icon}</span>
      <div>
        <strong>{title}</strong>
        <small>{copy}</small>
      </div>
      {priority === "high" && <em>High risk</em>}
      <time>{age}</time>
      <ChevronRight />
    </button>
  );
}

function AdminCampaigns() {
  const { notify } = useProduct();
  const reviews = [
    {
      name: "September creator push",
      business: "Tula Studios",
      budget: "₦240,000",
      type: "Social discovery",
      risk: "Low",
    },
    {
      name: "Beta app review campaign",
      business: "SwiftCart",
      budget: "₦420,000",
      type: "Product test",
      risk: "Medium",
    },
    {
      name: "Weekend repost campaign",
      business: "Evently",
      budget: "₦95,000",
      type: "Social action",
      risk: "Review",
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="Marketplace moderation"
        title="Campaign reviews"
        copy="Confirm policy fit, proof design and economics before business funds become tasks."
      />
      <section className="rr-panel rr-review-list">
        {reviews.map((review) => (
          <article key={review.name}>
            <span className="rr-campaign-icon">
              <Megaphone />
            </span>
            <div>
              <small>{review.type.toUpperCase()}</small>
              <h3>{review.name}</h3>
              <p>
                {review.business} · {review.budget}
              </p>
            </div>
            <em className={review.risk.toLowerCase()}>{review.risk} risk</em>
            <div>
              <button
                onClick={() =>
                  notify(`${review.name} returned with requested changes.`)
                }
              >
                Request changes
              </button>
              <button
                className="approve"
                onClick={() => notify(`${review.name} approved for funding.`)}
              >
                <Check />
                Approve
              </button>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

function AdminProofs() {
  const { notify } = useProduct();
  const [selected, setSelected] = useState(0);
  const proofItems = [
    "Ada Okafor · Kora discovery",
    "Timi Yusuf · Kora discovery",
    "Kemi James · Naya survey",
    "Bola Sanni · ChopNow menu",
  ];
  return (
    <>
      <PageHeading
        eyebrow="Verification operations"
        title="Proof review queue"
        copy="Resolve uncertain submissions consistently, with every moderation decision recorded."
      />
      <section className="rr-proof-workspace">
        <aside className="rr-proof-list">
          <div>
            <Search />
            <input placeholder="Search submissions" />
          </div>
          {proofItems.map((item, index) => (
            <button
              className={selected === index ? "active" : ""}
              onClick={() => setSelected(index)}
              key={item}
            >
              <span>
                {item
                  .split(" · ")[0]
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
              </span>
              <div>
                <strong>{item.split(" · ")[0]}</strong>
                <small>{item.split(" · ")[1]} · 18 min ago</small>
              </div>
              <ChevronRight />
            </button>
          ))}
        </aside>
        <article className="rr-proof-review">
          <div className="rr-proof-review-head">
            <div>
              <small>SUBMISSION PR-882{selected}</small>
              <h2>{proofItems[selected]}</h2>
            </div>
            <span>
              <Clock3 />
              SLA: 42 min
            </span>
          </div>
          <div className="rr-proof-image">
            <div>
              <FileCheck2 />
              <strong>Submitted evidence preview</strong>
              <small>
                Mock evidence surface — the production version will render
                uploaded proof securely.
              </small>
            </div>
          </div>
          <div className="rr-proof-checks">
            <span>
              <CheckCircle2 />
              <div>
                <strong>Account identity matched</strong>
                <small>
                  Submitted username belongs to the assigned earner.
                </small>
              </div>
            </span>
            <span>
              <CheckCircle2 />
              <div>
                <strong>Evidence appears unique</strong>
                <small>
                  No exact fingerprint match across recent submissions.
                </small>
              </div>
            </span>
            <span>
              <ShieldAlert />
              <div>
                <strong>Manual attention check</strong>
                <small>Confirm the highlighted collection is visible.</small>
              </div>
            </span>
          </div>
          <textarea placeholder="Internal moderation note…" />
          <div className="rr-proof-actions">
            <button
              onClick={() => notify("Submission rejected and reason saved.")}
            >
              <X />
              Reject
            </button>
            <button
              onClick={() => notify("Submission returned for clearer proof.")}
            >
              <ArrowLeft />
              Request new proof
            </button>
            <button
              className="approve"
              onClick={() => notify("Proof approved and reward released.")}
            >
              <Check />
              Approve reward
            </button>
          </div>
        </article>
      </section>
    </>
  );
}

function AdminPayouts() {
  const { notify } = useProduct();
  return (
    <>
      <PageHeading
        eyebrow="Finance operations"
        title="Payout control"
        copy="Review risk, approve batches and maintain a complete money trail."
        action={
          <button
            className="rr-button rr-button--ink"
            onClick={() => notify("Payout reconciliation exported.")}
          >
            <Download />
            Reconciliation
          </button>
        }
      />
      <section className="rr-business-stats">
        <StatCard
          icon={<Clock3 />}
          label="Pending review"
          value="₦284,500"
          meta="18 requests"
          tone="coral"
        />
        <StatCard
          icon={<ShieldAlert />}
          label="Risk holds"
          value="₦62,000"
          meta="4 requests"
        />
        <StatCard
          icon={<CheckCircle2 />}
          label="Ready to release"
          value="₦222,500"
          meta="14 requests"
          tone="lime"
        />
        <StatCard
          icon={<Banknote />}
          label="Paid today"
          value="₦1.24m"
          meta="418 earners"
        />
      </section>
      <section className="rr-panel rr-payout-table">
        <div className="rr-table-head">
          <span>Request</span>
          <span>Earner</span>
          <span>Account</span>
          <span>Risk</span>
          <span>Amount</span>
          <span>Action</span>
        </div>
        {[
          ["WD-4429", "Ada Okafor", "GTBank · 0192", "Low", "₦4,850"],
          ["WD-4428", "Timi Yusuf", "Access · 2881", "Review", "₦42,500"],
          ["WD-4427", "Kemi James", "Kuda · 9014", "Low", "₦8,200"],
        ].map((row) => (
          <div className="rr-table-row" key={row[0]}>
            {row.map((cell, index) => (
              <span
                key={cell}
                className={index === 3 ? `rr-risk-${cell.toLowerCase()}` : ""}
              >
                {cell}
              </span>
            ))}
            <button onClick={() => notify(`${row[0]} approved for payment.`)}>
              Approve
            </button>
          </div>
        ))}
      </section>
    </>
  );
}

function AdminUsers() {
  const { notify } = useProduct();
  return (
    <>
      <PageHeading
        eyebrow="Marketplace people"
        title="Users & businesses"
        copy="A trust-centred view of every participant in the marketplace."
      />
      <div className="rr-discovery-bar">
        <label>
          <Search />
          <input placeholder="Search by name, email or account ID" />
        </label>
        <button>
          <Filter />
          All account types
        </button>
      </div>
      <section className="rr-panel rr-user-table">
        <div className="rr-table-head">
          <span>Account</span>
          <span>Type</span>
          <span>Trust</span>
          <span>Activity</span>
          <span>Status</span>
          <span />
        </div>
        {[
          ["Ada Okafor", "Earner", "86", "24 tasks", "Active"],
          ["Kora Living", "Business", "92", "4 campaigns", "Verified"],
          ["Timi Yusuf", "Earner", "48", "31 tasks", "Review"],
          ["Naya Skin", "Business", "88", "2 campaigns", "Verified"],
        ].map((row) => (
          <div className="rr-table-row" key={row[0]}>
            <span className="rr-user-cell">
              <i>
                {row[0]
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
              </i>
              <strong>{row[0]}</strong>
            </span>
            {row.slice(1).map((cell, index) => (
              <span
                className={
                  index === 3 ? `rr-user-status ${cell.toLowerCase()}` : ""
                }
                key={cell}
              >
                {cell}
              </span>
            ))}
            <button
              onClick={() => notify(`${row[0]} account opened in review mode.`)}
            >
              <MoreHorizontal />
            </button>
          </div>
        ))}
      </section>
    </>
  );
}
