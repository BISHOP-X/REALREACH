import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Camera,
  Camera as Instagram,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  Globe2,
  Megaphone,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { friendlyError } from "./client";
import { Workspace } from "./Workspace";
import { marketplaceRequest, useMarketplace } from "./marketplace";
import { useMarketplaceList } from "./useMarketplaceList";
import {
  actionLabel,
  type Campaign,
  type CampaignInput,
  type CampaignQuote,
  formatDate,
  formatMoney,
  type WorkspaceData,
} from "./marketplace.types";
import {
  AsyncState,
  EmptyPanel,
  Feedback,
  Modal,
  Money,
  PageIntro,
  StatusPill,
  SubmitButton,
  Surface,
} from "./StudioUI";
import "./business.css";

const campaignPath = (campaign: Campaign) =>
  `/business/campaigns/${campaign.id}${
    campaign.status === "draft" ? "/edit" : ""
  }`;
const count = (value: number) => new Intl.NumberFormat("en-NG").format(value);
const percent = (value: number, total: number) =>
  total > 0 ? Math.min(100, Math.max(0, Math.round(value / total * 100))) : 0;

function BusinessContent(
  { children }: { children: (data: WorkspaceData) => ReactNode },
) {
  const market = useMarketplace();
  return (
    <AsyncState
      loading={market.loading && !market.data}
      error={market.data ? "" : market.error}
      onRetry={market.refresh}
    >
      {market.data
        ? (
          <>
            {market.error && (
              <div className="b-inline-note is-warning">
                <CircleAlert size={18} />
                <p>
                  Your latest changes could not be refreshed.{" "}
                  <button
                    type="button"
                    className="b-inline-retry"
                    onClick={() => void market.refresh()}
                  >
                    Try again
                  </button>
                </p>
              </div>
            )}
            {children(market.data)}
          </>
        )
        : null}
    </AsyncState>
  );
}

function ActionIcon({ action }: { action: Campaign["action"] }) {
  const Icon = action === "follow" ? UsersRound : MessageCircle;
  return (
    <span
      className={`b-action-icon ${action === "comment" ? "is-comment" : ""}`}
    >
      <Icon size={21} strokeWidth={1.6} />
    </span>
  );
}

function useOwnedCampaign(id: string | undefined) {
  const market = useMarketplace();
  const known = market.data?.campaigns.find((campaign) => campaign.id === id);
  const [loaded, setLoaded] = useState<
    { id: string; campaign?: Campaign; error: string; loading: boolean } | null
  >(null);
  const [retry, setRetry] = useState(0);
  const workspaceReady = !!market.data;
  useEffect(() => {
    if (!id || known || !workspaceReady) return;
    const controller = new AbortController();
    let alive = true;
    setLoaded({ id, error: "", loading: true });
    void marketplaceRequest<{ campaign: Campaign }>(
      "campaign-detail",
      { id },
      controller.signal,
    ).then((result) => {
      if (alive) {
        setLoaded({ id, campaign: result.campaign, error: "", loading: false });
      }
    }).catch((failure) => {
      if (alive) {
        setLoaded({ id, error: friendlyError(failure), loading: false });
      }
    });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [id, known?.id, workspaceReady, retry]);
  const current = loaded?.id === id ? loaded : null;
  return {
    campaign: known || current?.campaign,
    loading: !!id && !known && (!current || current.loading),
    error: known ? "" : current?.error || "",
    refresh: () => {
      void market.refresh();
      setRetry((value) => value + 1);
    },
  };
}

function CampaignRow({ campaign }: { campaign: Campaign }) {
  const isDraft = campaign.status === "draft";
  return (
    <Link className="b-campaign-row" to={campaignPath(campaign)}>
      <ActionIcon action={campaign.action} />
      <div>
        <h3>{campaign.title}</h3>
        <p>
          {isDraft
            ? `${count(campaign.quantity)} ${
              campaign.action === "follow" ? "followers" : "comments"
            }`
            : `${count(campaign.delivered_count)} of ${
              count(campaign.quantity)
            } delivered`}
          {campaign.target_username ? ` · @${campaign.target_username}` : ""}
        </p>
        {!isDraft && (
          <div className="b-row-progress" aria-hidden="true">
            <span
              style={{
                width: `${
                  percent(campaign.delivered_count, campaign.quantity)
                }%`,
              }}
            />
          </div>
        )}
      </div>
      <div className="b-campaign-row-meta">
        <StatusPill status={campaign.status} />
        <small>
          {isDraft ? "Edited" : "Started"}{" "}
          {formatDate(isDraft ? campaign.updated_at : campaign.created_at)}
        </small>
      </div>
      <ChevronRight className="b-campaign-chevron" size={18} />
    </Link>
  );
}

function SetupChecklist({ data }: { data: WorkspaceData }) {
  const steps = [
    {
      label: "Your business",
      detail: data.business?.name || "Add the name people know you by.",
      done: !!data.business,
      to: "/business/settings",
    },
    {
      label: "Your Instagram",
      detail: data.instagram?.status === "verified"
        ? `@${data.instagram.username}`
        : "Confirm the account you want to grow.",
      done: data.instagram?.status === "verified",
      to: "/business/instagram",
    },
    {
      label: "Your first campaign",
      detail: data.campaigns.length
        ? "Your next move is taking shape."
        : "Choose a goal and set your budget.",
      done: data.campaigns.length > 0,
      to: data.campaigns.length
        ? "/business/campaigns"
        : "/business/campaigns/new",
    },
  ];
  return (
    <aside className="b-setup">
      <h2>A strong start.</h2>
      <p>
        {steps.every((step) => step.done)
          ? "Your essentials, all in one place."
          : "Three small steps. Your business, ready to reach."}
      </p>
      {steps.map((step, index) => (
        <Link
          className={`b-setup-item ${step.done ? "is-done" : ""}`}
          to={step.to}
          key={step.to}
        >
          <span>
            {step.done
              ? <Check size={14} />
              : String(index + 1).padStart(2, "0")}
          </span>
          <div>
            <strong>{step.label}</strong>
            <small>{step.detail}</small>
          </div>
          <ChevronRight size={15} />
        </Link>
      ))}
    </aside>
  );
}

export function BusinessOverview() {
  const { profile } = useAuth();
  const firstName = profile?.display_name.trim().split(" ")[0];
  return (
    <Workspace>
      <div className="b-home">
        <PageIntro
          eyebrow="YOUR BUSINESS"
          title={firstName
            ? `Good to see you, ${firstName}.`
            : "Your next chapter starts here."}
          description="A little attention can go a long way."
          actions={
            <Link className="studio-button secondary" to="/business/settings">
              <Settings2 size={17} /> Business settings
            </Link>
          }
        />
        <BusinessContent>
          {(data) => (
            <>
              <section className="b-hero">
                <div>
                  <span className="b-hero-kicker">
                    <Instagram size={15} /> MADE FOR INSTAGRAM
                  </span>
                  <h2>
                    Your business.<br />Its <em>next audience.</em>
                  </h2>
                  <p>
                    Put your Instagram in front of real people. You set the
                    goal. Track every checked result here.
                  </p>
                  <Link className="r-button" to="/business/campaigns/new">
                    Create a campaign <ArrowRight size={18} />
                  </Link>
                </div>
                <div className="b-hero-aside">
                  <span>
                    <Camera size={27} strokeWidth={1.5} />
                  </span>
                  <div>
                    <strong>
                      {data.instagram?.status === "verified"
                        ? `@${data.instagram.username}`
                        : "Make it yours."}
                    </strong>
                    <small>
                      {data.instagram?.status === "verified"
                        ? "Your Instagram is connected."
                        : "Connect the Instagram account you want to grow."}
                    </small>
                  </div>
                  <Link to="/business/instagram">
                    {data.instagram?.status === "verified"
                      ? "Manage account"
                      : "Connect Instagram"}
                    <ArrowUpRight size={15} />
                  </Link>
                </div>
              </section>
              <div className="b-metrics">
                <div className="b-metric">
                  <span>
                    <Megaphone size={14} /> Active campaigns
                  </span>
                  <strong>
                    {data.metrics ? count(data.metrics.active_campaigns) : "—"}
                  </strong>
                  <small>Live, paused and finishing</small>
                </div>
                <div className="b-metric">
                  <span>
                    <BadgeCheck size={14} /> Results delivered
                  </span>
                  <strong>
                    {data.metrics ? count(data.metrics.delivered_actions) : "—"}
                  </strong>
                  <small>Completed and checked</small>
                </div>
                <div className="b-metric">
                  <span>
                    <Wallet size={14} /> Available funds
                  </span>
                  <strong>
                    <Money value={data.wallet.available_kobo} />
                  </strong>
                  <small>Ready for your next campaign</small>
                </div>
              </div>
              <div className="b-main-aside">
                <div>
                  <div className="b-section-heading">
                    <div>
                      <h2>Your campaigns</h2>
                      <p>From your first idea to the final result.</p>
                    </div>
                    <Link to="/business/campaigns">
                      View all <ArrowRight size={15} />
                    </Link>
                  </div>
                  {data.campaigns.length
                    ? (
                      <div className="b-campaign-list">
                        {data.campaigns.slice(0, 4).map((campaign) => (
                          <CampaignRow key={campaign.id} campaign={campaign} />
                        ))}
                      </div>
                    )
                    : (
                      <EmptyPanel
                        icon={Megaphone}
                        title="Give your next idea some reach."
                        description="Start with a campaign. Choose follows or comments, decide how many, and review the price before publishing."
                      >
                        <Link
                          className="studio-button"
                          to="/business/campaigns/new"
                        >
                          Build your first campaign <ArrowRight size={17} />
                        </Link>
                      </EmptyPanel>
                    )}
                  <div className="b-access-note">
                    <ShieldCheck size={15} />{" "}
                    Your funds only cover results that pass the task’s checks.
                  </div>
                </div>
                <SetupChecklist data={data} />
              </div>
            </>
          )}
        </BusinessContent>
      </div>
    </Workspace>
  );
}

export function BusinessCampaigns() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const campaigns = useMarketplaceList<Campaign>("campaigns", filter, search);
  return (
    <Workspace>
      <div className="b-campaign-page">
        <PageIntro
          eyebrow="YOUR REACH, IN MOTION"
          title="Campaigns"
          description="Every goal. Every result. One clear view."
          actions={
            <Link className="studio-button" to="/business/campaigns/new">
              <Plus size={17} /> New campaign
            </Link>
          }
        />
        <div className="b-tools">
          <div className="b-tabs" role="group" aria-label="Filter campaigns">
            {[["all", "All"], ["active", "Active"], ["draft", "Drafts"], [
              "finished",
              "Finished",
            ]].map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="b-search">
            <Search size={17} />
            <span className="r-sr">Search campaigns</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a campaign"
              type="search"
            />
          </label>
        </div>
        <AsyncState
          loading={campaigns.loading && !campaigns.items.length}
          error={campaigns.items.length ? "" : campaigns.error}
          onRetry={campaigns.refresh}
        >
          {campaigns.items.length
            ? (
              <>
                <div className="b-campaign-list">
                  {campaigns.items.map((campaign) => (
                    <CampaignRow key={campaign.id} campaign={campaign} />
                  ))}
                </div>
                <Feedback error={campaigns.error} />
                {campaigns.nextCursor && (
                  <div className="b-load-control">
                    <SubmitButton
                      className="secondary"
                      busy={campaigns.loading}
                      onClick={campaigns.loadMore}
                    >
                      Load more campaigns
                    </SubmitButton>
                  </div>
                )}
              </>
            )
            : filter !== "all" || search.trim()
            ? (
              <EmptyPanel
                icon={Search}
                title="Nothing here just yet."
                description={search
                  ? "Try another campaign name or clear your filters."
                  : `Your ${
                    filter === "finished"
                      ? "finished campaigns"
                      : filter === "active"
                      ? "active campaigns"
                      : "drafts"
                  } will appear here.`}
              >
                <button
                  className="studio-button secondary"
                  onClick={() => {
                    setFilter("all");
                    setSearch("");
                  }}
                >
                  Show all campaigns <ArrowRight size={17} />
                </button>
              </EmptyPanel>
            )
            : (
              <EmptyPanel
                icon={Megaphone}
                title="Your first campaign starts with a goal."
                description="More followers or a conversation around your post. Choose your goal, build your brief and save your progress."
              >
                <Link className="studio-button" to="/business/campaigns/new">
                  Create a campaign <ArrowRight size={17} />
                </Link>
              </EmptyPanel>
            )}
        </AsyncState>
      </div>
    </Workspace>
  );
}

function campaignInput(campaign?: Campaign): CampaignInput {
  return {
    id: campaign?.id,
    title: campaign?.title || "",
    action: campaign?.action || "follow",
    target_url: campaign?.target_url || "",
    instructions: campaign?.instructions || "",
    quantity: campaign?.quantity || 100,
    ends_at: campaign?.ends_at || null,
  };
}

function restoreUnsavedDraft(
  key: string,
  fallback: CampaignInput,
): CampaignInput {
  try {
    const value = sessionStorage.getItem(key);
    if (!value || value.length > 8000) return fallback;
    const saved = JSON.parse(value) as Partial<CampaignInput>;
    if (
      typeof saved.title !== "string" || typeof saved.target_url !== "string" ||
      typeof saved.instructions !== "string" ||
      !["follow", "comment"].includes(saved.action || "") ||
      !Number.isFinite(saved.quantity)
    ) return fallback;
    return {
      ...fallback,
      title: saved.title.slice(0, 100),
      action: saved.action!,
      target_url: saved.target_url.slice(0, 500),
      instructions: saved.instructions.slice(0, 1000),
      quantity: saved.quantity!,
      ends_at: typeof saved.ends_at === "string" &&
          Number.isFinite(Date.parse(saved.ends_at))
        ? saved.ends_at
        : null,
    };
  } catch {
    return fallback;
  }
}

function localDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return `${date.getFullYear()}-${
    String(date.getMonth() + 1).padStart(2, "0")
  }-${String(date.getDate()).padStart(2, "0")}T${
    String(date.getHours()).padStart(2, "0")
  }:${String(date.getMinutes()).padStart(2, "0")}`;
}

function InstagramTaskPreview(
  { input, data }: { input: CampaignInput; data: WorkspaceData },
) {
  const reward = input.action === "follow"
    ? data.pricing.follow_reward_kobo
    : data.pricing.comment_reward_kobo;
  return (
    <aside className="b-builder-aside">
      <p className="b-preview-label">A WORKER’S VIEW</p>
      <div className="b-preview">
        <div className="b-preview-top">
          <span>
            <Instagram size={21} />
          </span>
          <div>
            <strong>{data.business?.name || "Your business"}</strong>
            <small>
              INSTAGRAM · {input.action === "follow" ? "FOLLOW" : "COMMENT"}
            </small>
          </div>
        </div>
        <div className="b-preview-body">
          <h3>{input.title.trim() || "Your campaign, in their hands."}</h3>
          <p>
            {input.instructions.trim() || (input.action === "follow"
              ? "Discover a business. Follow its Instagram account and return to check your work."
              : "Read the post. Leave a genuine comment that follows the brief, then return to check your work.")}
          </p>
          <div className="b-preview-facts">
            <span>
              {data.pricing.approved
                ? (
                  <strong>
                    <Money value={reward} />
                  </strong>
                )
                : <strong>Reward</strong>}
              <br />
              {data.pricing.approved
                ? "per checked result"
                : "Shown when rates are ready"}
            </span>
            <span>
              <strong>{count(input.quantity || 0)}</strong>
              <br />available places
            </span>
          </div>
        </div>
        <div className="b-preview-footer">
          <ShieldCheck size={14} />
          <span>Work is checked before the reward is released.</span>
        </div>
      </div>
      <p>
        This updates as you write. Workers see the final brief and reward before
        accepting.
      </p>
    </aside>
  );
}

function CampaignBuilderForm(
  { data, existing }: { data: WorkspaceData; existing?: Campaign },
) {
  const market = useMarketplace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const bufferKey = `realreach-business-draft-v1:${user!.id}:${
    existing?.id || "new"
  }`;
  const initial = useRef({
    ...campaignInput(existing),
    ...(!existing && data.instagram
      ? { target_url: `https://www.instagram.com/${data.instagram.username}/` }
      : {}),
  });
  const [input, setInput] = useState<CampaignInput>(() =>
    restoreUnsavedDraft(bufferKey, initial.current)
  );
  const [step, setStep] = useState(() =>
    Math.max(0, Math.min(3, Number(params.get("step")) || 0))
  );
  const [busy, setBusy] = useState<"save" | "quote" | "publish" | "">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(() =>
    JSON.stringify(input) !== JSON.stringify(initial.current)
      ? "Your unsaved changes were restored."
      : ""
  );
  const [quote, setQuote] = useState<CampaignQuote | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [savedSignature, setSavedSignature] = useState(
    JSON.stringify(initial.current),
  );
  const [, setClock] = useState(0);
  const saving = useRef(false);
  const createId = useRef(crypto.randomUUID());
  const heading = useRef<HTMLHeadingElement>(null);
  const signature = JSON.stringify(input);
  const maximum = data.pricing.max_campaign_quantity || 10000;
  const connected = data.instagram?.status === "verified";
  const quoteExpired = !!quote && Date.parse(quote.expires_at) <= Date.now();
  const changes = signature !== savedSignature;

  useEffect(() => {
    try {
      if (changes) sessionStorage.setItem(bufferKey, signature);
      else sessionStorage.removeItem(bufferKey);
    } catch { /* The form remains usable when browser storage is disabled. */ }
  }, [bufferKey, signature, changes]);

  useEffect(() => {
    if (!changes) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changes]);

  useEffect(() => {
    if (!quote) return;
    const timer = window.setInterval(
      () => setClock((value) => value + 1),
      30000,
    );
    return () => window.clearInterval(timer);
  }, [quote]);

  function update<K extends keyof CampaignInput>(
    key: K,
    value: CampaignInput[K],
  ) {
    setInput((previous) => ({ ...previous, [key]: value }));
    setQuote(null);
    setAgreed(false);
    setNotice("");
    setError("");
  }

  function selectGoal(action: CampaignInput["action"]) {
    update("action", action);
    update(
      "target_url",
      action === "follow" && data.instagram
        ? `https://www.instagram.com/${data.instagram.username}/`
        : "",
    );
  }

  function validate(until: number) {
    if (input.title.trim().length < 3) {
      return "Give your campaign a name with at least 3 characters.";
    }
    if (until >= 1) {
      try {
        const url = new URL(input.target_url);
        if (
          !["instagram.com", "www.instagram.com"].includes(url.hostname) ||
          url.protocol !== "https:"
        ) {
          return "Use an Instagram link beginning with https://www.instagram.com/.";
        }
        if (
          input.action === "comment" &&
          !/^\/(p|reel|tv)\/[^/]+/.test(url.pathname)
        ) {
          return "Add the link to the Instagram post or reel you want comments on.";
        }
        if (
          input.action === "follow" &&
          !/^\/[a-zA-Z0-9_.]+\/?$/.test(url.pathname)
        ) return "Add the Instagram profile link you want people to follow.";
        if (
          input.action === "follow" && connected &&
          url.pathname.split("/")[1].toLowerCase() !==
            data.instagram!.username.toLowerCase()
        ) {
          return `Use your connected Instagram profile: @${
            data.instagram!.username
          }.`;
        }
      } catch {
        return "Add the full Instagram link for your campaign.";
      }
      if (input.action === "comment" && input.instructions.trim().length < 10) {
        return "Add a short comment brief so people know what to respond to.";
      }
    }
    if (until >= 2) {
      if (
        !Number.isInteger(input.quantity) || input.quantity < 1 ||
        input.quantity > maximum
      ) return `Choose a whole number from 1 to ${count(maximum)}.`;
      if (input.ends_at && Date.parse(input.ends_at) <= Date.now() + 3600000) {
        return "Choose an end date at least one hour from now, or leave the campaign open.";
      }
    }
    return "";
  }

  async function persist(quiet = false): Promise<string | null> {
    if (saving.current) return null;
    const validation = validate(0);
    if (validation) {
      if (!quiet) setError(validation);
      return null;
    }
    saving.current = true;
    if (!quiet) setError("");
    const submitted = {
      ...input,
      id: input.id || createId.current,
      title: input.title.trim(),
      instructions: input.instructions.trim(),
    };
    try {
      const result = await market.act<{ id: string }>("campaign-save", {
        campaign: submitted,
      });
      const updated = { ...submitted, id: result.id };
      try {
        sessionStorage.removeItem(bufferKey);
      } catch { /* A saved server draft does not depend on browser storage. */ }
      setInput((previous) =>
        JSON.stringify(previous) === signature
          ? updated
          : { ...previous, id: result.id }
      );
      setSavedSignature(JSON.stringify(updated));
      setQuote(null);
      setAgreed(false);
      setNotice(quiet ? "All changes saved" : "Draft saved.");
      if (!input.id) {
        navigate(`/business/campaigns/${result.id}/edit?step=${step}`, {
          replace: true,
        });
      }
      return result.id;
    } catch (failure) {
      setError(friendlyError(failure));
      return null;
    } finally {
      saving.current = false;
    }
  }

  useEffect(() => {
    if (
      !input.id || !changes || busy || error || saving.current ||
      input.title.trim().length < 3 || !Number.isInteger(input.quantity) ||
      input.quantity < 1 || input.quantity > maximum
    ) return;
    if (
      input.ends_at &&
      (!Number.isFinite(Date.parse(input.ends_at)) ||
        Date.parse(input.ends_at) <= Date.now())
    ) return;
    if (input.action === "comment" && input.target_url) {
      try {
        const url = new URL(input.target_url);
        if (
          !["instagram.com", "www.instagram.com"].includes(url.hostname) ||
          !/^\/(p|reel|tv)\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname) ||
          url.protocol !== "https:"
        ) return;
      } catch {
        return;
      }
    }
    const timer = window.setTimeout(() => {
      setBusy("save");
      void persist(true).finally(() => setBusy(""));
    }, 1600);
    return () => window.clearTimeout(timer);
    // Autosave only follows the draft content and mutation state, not render-created callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, savedSignature, busy, error]);

  async function saveDraft() {
    setBusy("save");
    await persist();
    setBusy("");
  }
  function moveStep(next: number) {
    if (next > step) {
      const validation = validate(step);
      if (validation) {
        setError(validation);
        return;
      }
    }
    setError("");
    setStep(next);
    setParams({ step: String(next) }, { replace: true });
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }
  async function getQuote() {
    const validation = validate(2);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy("quote");
    setError("");
    setNotice("");
    try {
      const id = await persist();
      if (!id) return;
      const result = await market.act<CampaignQuote>("campaign-quote", { id });
      setQuote(result);
      setAgreed(false);
    } catch (failure) {
      setError(friendlyError(failure));
    } finally {
      setBusy("");
    }
  }
  async function publish() {
    if (!input.id || !quote || !agreed || quoteExpired) return;
    setBusy("publish");
    setError("");
    try {
      await market.act("campaign-publish", {
        id: input.id,
        terms_version: quote.terms_version,
        expected_updated_at: quote.campaign_updated_at,
        expected_total_kobo: quote.total_kobo,
      });
      setConfirmPublish(false);
      navigate(`/business/campaigns/${input.id}`, { replace: true });
    } catch (failure) {
      setConfirmPublish(false);
      setQuote(null);
      setAgreed(false);
      setError(friendlyError(failure));
      void market.refresh();
    } finally {
      setBusy("");
    }
  }
  const readyToPublish = !!(quote?.approved && !quoteExpired && !changes &&
    quote.shortfall_kobo === 0 && connected && data.capabilities.instagram &&
    data.capabilities.payments && agreed && !data.account_hold);
  const totalRate = data.pricing.approved
    ? (input.action === "follow"
      ? data.pricing.follow_reward_kobo + data.pricing.follow_fee_kobo
      : data.pricing.comment_reward_kobo + data.pricing.comment_fee_kobo)
    : null;
  const publishReason = data.account_hold
    ? "Spending is paused while we review a payment. Contact support before publishing."
    : !quote
    ? "Get your price to review the full budget."
    : !quote.approved
    ? "Rates are being prepared. Save your draft and check back before publishing."
    : quoteExpired
    ? "Refresh your price before publishing."
    : changes
    ? "Save your latest changes and refresh the price."
    : !connected
    ? "Connect your Instagram before publishing."
    : !data.capabilities.instagram
    ? "Instagram checks must be available before this campaign can publish."
    : !data.capabilities.payments
    ? "Payments must be available before this campaign can publish."
    : quote.shortfall_kobo > 0
    ? `Add ${
      formatMoney(quote.shortfall_kobo)
    } to your funds, then refresh your price.`
    : !agreed
    ? "Confirm the brief and campaign rules above to publish."
    : "Your budget is only reserved when you publish.";

  return (
    <>
      <PageIntro
        eyebrow="MAKE YOUR NEXT MOVE"
        title={existing ? "Shape your campaign." : "Start something good."}
        description="A clear goal. A thoughtful brief. Real people on the other side."
        actions={
          <button
            type="button"
            className="studio-button secondary"
            onClick={() => void saveDraft()}
            disabled={!!busy}
          >
            <FileText size={17} />
            {busy === "save" ? "Saving…" : "Save draft"}
          </button>
        }
      />
      <div className="b-save-state" role="status">
        {input.id
          ? (
            <>
              <Check size={13} />
              {busy === "save"
                ? "Saving your changes…"
                : changes
                ? "Unsaved changes"
                : "All changes saved"}
            </>
          )
          : (
            <>
              <Clock3 size={13} /> Save a draft to keep your progress.
            </>
          )}
      </div>
      <div className="b-builder-layout">
        <div className="b-builder-main">
          <ol className="b-stepper" aria-label="Campaign steps">
            {["Your goal", "The brief", "Quantity", "Review"].map((
              label,
              index,
            ) => (
              <li key={label}>
                <button
                  type="button"
                  className={index < step ? "is-visited" : ""}
                  aria-current={index === step ? "step" : undefined}
                  onClick={() => moveStep(index)}
                  disabled={!!busy}
                >
                  <span>{index < step ? <Check size={12} /> : index + 1}</span>
                  {label}
                </button>
              </li>
            ))}
          </ol>
          <div className="b-form-feedback">
            <Feedback
              error={error}
              message={notice && notice !== "All changes saved" ? notice : ""}
            />
          </div>
          {!data.business && (
            <div className="b-inline-note is-warning">
              <CircleAlert size={18} />
              <p>
                <Link to="/business/settings">Add your business details</Link>
                {" "}
                before saving your campaign.
              </p>
            </div>
          )}
          <section className="b-form-panel">
            <h2 ref={heading} tabIndex={-1}>
              {[
                "What would you like to grow?",
                "Point people in the right direction.",
                "Find your right-sized reach.",
                "One last look. Then, let’s go.",
              ][step]}
            </h2>
            <p>
              {[
                "Choose the action that fits your next business goal.",
                "People do their best work with a clear, simple brief.",
                "Set the number of results you want. You’ll review the full price next.",
                "Your campaign, your budget, and exactly what gets checked.",
              ][step]}
            </p>
            {step === 0 && (
              <>
                <div
                  className="b-action-choices"
                  role="radiogroup"
                  aria-label="Campaign goal"
                >
                  {(["follow", "comment"] as const).map((action) => (
                    <button
                      key={action}
                      role="radio"
                      type="button"
                      tabIndex={input.action === action ? 0 : -1}
                      aria-checked={input.action === action}
                      className="b-action-choice"
                      onClick={() => selectGoal(action)}
                      onKeyDown={(event) => {
                        if (
                          !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]
                            .includes(event.key)
                        ) return;
                        event.preventDefault();
                        const next = action === "follow" ? "comment" : "follow";
                        selectGoal(next);
                        const parent = event.currentTarget.parentElement;
                        requestAnimationFrame(() =>
                          parent?.querySelector<HTMLButtonElement>(
                            `[aria-checked="true"]`,
                          )?.focus()
                        );
                      }}
                    >
                      <span className="b-choice-check">
                        {input.action === action && <Check size={11} />}
                      </span>
                      {action === "follow"
                        ? <UsersRound size={27} />
                        : <MessageCircle size={27} />}
                      <strong>
                        {action === "follow"
                          ? "Grow your following"
                          : "Start a conversation"}
                      </strong>
                      <small>
                        {action === "follow"
                          ? "Bring new people to your Instagram account."
                          : "Get genuine comments on your post or reel."}
                      </small>
                    </button>
                  ))}
                </div>
                <label className="b-field">
                  Campaign name<input
                    maxLength={100}
                    minLength={3}
                    value={input.title}
                    onChange={(event) => update("title", event.target.value)}
                    placeholder="e.g. Meet our new collection"
                    autoComplete="off"
                  />
                  <small>
                    Choose a name that makes sense to you and the people taking
                    the task.
                  </small>
                </label>
              </>
            )}
            {step === 1 && (
              <>
                <label className="b-field">
                  {input.action === "follow"
                    ? "Instagram profile link"
                    : "Instagram post or reel link"}
                  <input
                    type="url"
                    inputMode="url"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={500}
                    placeholder={input.action === "follow"
                      ? "https://www.instagram.com/yourbusiness/"
                      : "https://www.instagram.com/p/…"}
                    value={input.target_url}
                    onChange={(event) =>
                      update("target_url", event.target.value)}
                  />
                  <small>
                    {input.action === "follow"
                      ? "Use the profile connected to your business."
                      : "Choose a public post or reel from your connected business account."}
                  </small>
                </label>
                <label className="b-field">
                  {input.action === "comment" ? "Your comment brief" : (
                    <>
                      A note for people discovering you{" "}
                      <span className="b-field-optional">Optional</span>
                    </>
                  )}
                  <textarea
                    maxLength={1000}
                    value={input.instructions}
                    onChange={(event) =>
                      update("instructions", event.target.value)}
                    placeholder={input.action === "comment"
                      ? "e.g. Look through our new collection. Tell us which piece you would choose and why, in your own words."
                      : "e.g. We make thoughtful everyday pieces in Lagos. Follow along for new releases."}
                  />
                  <small>
                    {input.action === "comment"
                      ? "Ask for a relevant, original response. No identical scripts, forced praise or personal information."
                      : "A little context helps people understand your business."}
                    {" "}
                    {input.instructions.length}/1,000
                  </small>
                </label>
                {input.action === "comment" && (
                  <div className="b-inline-note">
                    <ShieldCheck size={18} />
                    <p>
                      We check the comment and its author. You can ask people to
                      like the post too, but likes are not a verified or
                      guaranteed part of this campaign.
                    </p>
                  </div>
                )}
                <div
                  className={`b-inline-note ${connected ? "is-positive" : ""}`}
                >
                  <Instagram size={18} />
                  <p>
                    {connected
                      ? (
                        <>
                          Connected as{" "}
                          <strong>@{data.instagram?.username}</strong>.
                        </>
                      )
                      : (
                        <>
                          You can prepare your brief now.{" "}
                          <Link to="/business/instagram">
                            Connect your Instagram
                          </Link>{" "}
                          before publishing.
                        </>
                      )}
                  </p>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <label className="b-field">
                  {input.action === "follow"
                    ? "How many new followers?"
                    : "How many comments?"}
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={maximum}
                    step={1}
                    value={input.quantity || ""}
                    onChange={(event) =>
                      update("quantity", Number(event.target.value))}
                  />
                  <small>Choose between 1 and {count(maximum)} results.</small>
                </label>
                <div
                  className="b-quantity-chips"
                  role="group"
                  aria-label="Suggested quantities"
                >
                  {[50, 100, 250, 500].filter((value) => value <= maximum).map(
                    (value) => (
                      <button
                        type="button"
                        aria-pressed={input.quantity === value}
                        key={value}
                        onClick={() => update("quantity", value)}
                      >
                        {count(value)}
                      </button>
                    ),
                  )}
                </div>
                <label className="b-field">
                  End date<span className="b-field-optional">Optional</span>
                  <input
                    type="datetime-local"
                    value={localDate(input.ends_at)}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!value) update("ends_at", null);
                      else if (Number.isFinite(Date.parse(value))) {
                        update("ends_at", new Date(value).toISOString());
                      }
                    }}
                  />
                  <small>
                    Choose a time at least one hour away, or leave this blank to
                    run until your goal is reached. Accepted work is still
                    checked after the campaign ends.
                  </small>
                </label>
                <div className="b-inline-note">
                  <Wallet size={18} />
                  <p>
                    {totalRate !== null
                      ? (
                        <>
                          At the current rate, {count(input.quantity || 0)}{" "}
                          results are approximately{" "}
                          <strong>
                            {formatMoney(totalRate * (input.quantity || 0))}
                          </strong>. The next step confirms your price.
                        </>
                      )
                      : "Rates are being prepared. Your draft is safe, and you can review the price here once rates are available."}
                  </p>
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <dl className="b-detail-list">
                  <div>
                    <dt>Campaign</dt>
                    <dd>{input.title || "Not added"}</dd>
                  </div>
                  <div>
                    <dt>Goal</dt>
                    <dd>
                      {count(input.quantity)}{" "}
                      {input.action === "follow" ? "new followers" : "comments"}
                    </dd>
                  </div>
                  <div>
                    <dt>Instagram</dt>
                    <dd>
                      {!validate(1)
                        ? (
                          <a
                            href={input.target_url}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            Open target <ArrowUpRight size={12} />
                          </a>
                        )
                        : "Add a valid target"}
                    </dd>
                  </div>
                  <div>
                    <dt>Ends</dt>
                    <dd>
                      {input.ends_at
                        ? formatDate(input.ends_at, true)
                        : "When the goal is reached"}
                    </dd>
                  </div>
                  {quote?.approved && (
                    <>
                      <div>
                        <dt>Worker rewards</dt>
                        <dd>
                          <Money value={quote.reward_kobo} />
                        </dd>
                      </div>
                      <div>
                        <dt>RealReach fee</dt>
                        <dd>
                          <Money value={quote.fee_kobo} />
                        </dd>
                      </div>
                      <div className="b-total">
                        <dt>Total budget</dt>
                        <dd>
                          <Money value={quote.total_kobo} />
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
                {input.instructions && (
                  <div className="b-review-brief">
                    <strong>Your brief</strong>
                    {input.instructions}
                  </div>
                )}
                {!quote
                  ? (
                    <div className="b-inline-note">
                      <FileText size={18} />
                      <p>
                        Get your price to see the full budget and what’s needed
                        to publish. Nothing is charged yet.
                      </p>
                    </div>
                  )
                  : (
                    <>
                      <ul className="b-publish-checklist">
                        <li className={connected ? "is-done" : ""}>
                          {connected
                            ? <Check size={16} />
                            : <CircleAlert size={16} />}
                          <span>
                            {connected
                              ? `Instagram verified: @${data.instagram?.username}`
                              : (
                                <Link to="/business/instagram">
                                  Connect your Instagram
                                </Link>
                              )}
                          </span>
                        </li>
                        <li
                          className={quote.approved && !quoteExpired
                            ? "is-done"
                            : ""}
                        >
                          {quote.approved && !quoteExpired
                            ? <Check size={16} />
                            : <CircleAlert size={16} />}
                          <span>
                            {quoteExpired
                              ? "Your price has expired. Refresh it before publishing."
                              : quote.approved
                              ? `Price confirmed · valid until ${
                                new Date(quote.expires_at).toLocaleTimeString(
                                  "en-NG",
                                  { hour: "numeric", minute: "2-digit" },
                                )
                              }`
                              : "Rates are being prepared. No price has been confirmed."}
                          </span>
                        </li>
                        {quote.approved && (
                          <li
                            className={quote.shortfall_kobo === 0
                              ? "is-done"
                              : ""}
                          >
                            {quote.shortfall_kobo === 0
                              ? <Check size={16} />
                              : <Wallet size={16} />}
                            <span>
                              {quote.shortfall_kobo > 0
                                ? (
                                  <>
                                    <Link to="/business/wallet">
                                      Add {formatMoney(quote.shortfall_kobo)}
                                      {" "}
                                      to your funds
                                    </Link>{" "}
                                    to cover this campaign.
                                  </>
                                )
                                : "Your available funds cover this campaign."}
                            </span>
                          </li>
                        )}
                      </ul>
                      {(!data.capabilities.instagram ||
                        !data.capabilities.payments) && (
                        <div className="b-inline-note">
                          <Clock3 size={18} />
                          <p>
                            {!data.capabilities.instagram
                              ? "Instagram checks are unavailable."
                              : "Payments are unavailable."}{" "}
                            You can save this campaign and publish once the
                            service is available.
                          </p>
                        </div>
                      )}
                      {quote.approved && (
                        <label className="studio-checkbox">
                          <input
                            type="checkbox"
                            checked={agreed}
                            onChange={(event) =>
                              setAgreed(event.target.checked)}
                          />
                          <span>
                            I’ve reviewed the brief and{" "}
                            <Link to="/terms" target="_blank">
                              campaign rules
                            </Link>. Work is checked again after{" "}
                            {quote.retention_hours}{" "}
                            hours before rewards are released.
                          </span>
                        </label>
                      )}
                    </>
                  )}
              </>
            )}
          </section>
          <div className="b-builder-footer">
            <div>
              {step > 0
                ? (
                  <button
                    className="r-text-button"
                    type="button"
                    disabled={!!busy}
                    onClick={() => moveStep(step - 1)}
                  >
                    <ArrowLeft size={16} /> Back
                  </button>
                )
                : (
                  <Link className="r-text-button" to="/business/campaigns">
                    Cancel
                  </Link>
                )}
            </div>
            <div>
              {step < 3
                ? (
                  <button
                    type="button"
                    className="studio-button"
                    disabled={!!busy}
                    onClick={() => moveStep(step + 1)}
                  >
                    Continue <ArrowRight size={17} />
                  </button>
                )
                : !quote || quoteExpired || changes
                ? (
                  <SubmitButton
                    busy={busy === "quote" || busy === "save"}
                    disabled={!!busy || !data.business}
                    onClick={() => void getQuote()}
                  >
                    {quote ? "Refresh price" : "Get my price"}
                  </SubmitButton>
                )
                : (
                  <>
                    <button
                      className="r-text-button"
                      type="button"
                      disabled={!!busy}
                      onClick={() => void getQuote()}
                    >
                      Refresh price
                    </button>
                    <SubmitButton
                      busy={busy === "publish"}
                      disabled={!readyToPublish || !!busy}
                      onClick={() => setConfirmPublish(true)}
                    >
                      Publish
                    </SubmitButton>
                  </>
                )}
            </div>
          </div>
          <p className="b-draft-hint" id="publish-reason">
            {step === 3
              ? publishReason
              : "Your budget is only reserved when you publish."}
          </p>
        </div>
        <InstagramTaskPreview input={input} data={data} />
      </div>
      <Modal
        open={confirmPublish}
        onClose={() => {
          if (!busy) setConfirmPublish(false);
        }}
        title="Ready to put this out there?"
        description="Publishing reserves this campaign’s budget from your available funds."
      >
        <dl className="b-detail-list">
          <div>
            <dt>Campaign</dt>
            <dd>{input.title}</dd>
          </div>
          <div>
            <dt>Budget</dt>
            <dd>
              <Money value={quote?.total_kobo || 0} />
            </dd>
          </div>
        </dl>
        <div className="b-inline-note">
          <ShieldCheck size={17} />
          <p>
            Rewards are released only after the checks pass. You can pause new
            work or close the campaign later.
          </p>
        </div>
        <SubmitButton
          busy={busy === "publish"}
          disabled={!readyToPublish}
          onClick={() => void publish()}
        >
          Publish campaign
        </SubmitButton>
      </Modal>
    </>
  );
}

export function BusinessCampaignBuilder() {
  const { id } = useParams();
  const record = useOwnedCampaign(id);
  return (
    <Workspace>
      <div className="b-builder">
        <Link className="b-back" to="/business/campaigns">
          <ArrowLeft size={16} /> Campaigns
        </Link>
        <BusinessContent>
          {(data) => (
            <AsyncState
              loading={record.loading}
              error={record.error}
              onRetry={record.refresh}
            >
              {(() => {
                const existing = record.campaign;
                if (id && !existing) {
                  return (
                    <EmptyPanel
                      icon={Megaphone}
                      title="Campaign not found."
                      description="It may have been removed or belong to another account."
                    >
                      <Link className="studio-button" to="/business/campaigns">
                        Back to campaigns <ArrowRight size={16} />
                      </Link>
                    </EmptyPanel>
                  );
                }
                if (existing && existing.status !== "draft") {
                  return (
                    <EmptyPanel
                      icon={BadgeCheck}
                      title="This campaign has already been published."
                      description="Its brief and price are fixed so everyone works to the same terms."
                    >
                      <Link
                        className="studio-button"
                        to={`/business/campaigns/${existing.id}`}
                      >
                        View campaign <ArrowRight size={16} />
                      </Link>
                    </EmptyPanel>
                  );
                }
                return <CampaignBuilderForm data={data} existing={existing} />;
              })()}
            </AsyncState>
          )}
        </BusinessContent>
      </div>
    </Workspace>
  );
}

type DeliveryReceipt = {
  id: string;
  action: "follow" | "comment";
  username: string;
  checked_at: string;
  reward_kobo: number;
  status: string;
  comment_text?: string | null;
  reference?: string;
};
type CampaignDeliveryData = {
  campaign: Campaign;
  receipts: DeliveryReceipt[];
  receipts_total: number;
  receipts_limit: number;
  receipts_offset: number;
};

function DeliveryReceipts(
  { id, refreshKey }: { id: string; refreshKey: number },
) {
  const [data, setData] = useState<CampaignDeliveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [more, setMore] = useState(false);
  const [moreError, setMoreError] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    generation.current += 1;
    setLoading(true);
    setError("");
    setMoreError("");
    setMore(false);
    void marketplaceRequest<CampaignDeliveryData>(
      "campaign-detail",
      { id },
      controller.signal,
    ).then((result) => {
      if (alive) setData(result);
    }).catch((failure) => {
      if (alive) setError(friendlyError(failure));
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
      generation.current += 1;
      controller.abort();
    };
  }, [id, retry, refreshKey]);
  async function loadMore() {
    if (!data || more) return;
    const current = generation.current;
    setMore(true);
    setMoreError("");
    try {
      const next = await marketplaceRequest<CampaignDeliveryData>(
        "campaign-detail",
        { id, offset: data.receipts_offset + data.receipts_limit },
      );
      if (generation.current !== current) return;
      setData((previous) => ({
        ...next,
        receipts: [
          ...new Map(
            [...(previous?.receipts || []), ...next.receipts].map(
              (receipt) => [receipt.id, receipt],
            ),
          ).values(),
        ],
      }));
    } catch (failure) {
      if (generation.current === current) setMoreError(friendlyError(failure));
    } finally {
      if (generation.current === current) setMore(false);
    }
  }
  return (
    <AsyncState
      loading={loading}
      error={error}
      onRetry={() => setRetry((value) => value + 1)}
    >
      {data && (data.receipts.length
        ? (
          <div>
            <p className="b-muted-label">
              Showing {count(data.receipts.length)} of{" "}
              {count(data.receipts_total)} delivered results
            </p>
            {data.receipts.map((receipt) => (
              <details className="b-delivery-row" key={receipt.id}>
                <summary>
                  <span>
                    <Check size={16} />
                  </span>
                  <div>
                    <strong>@{receipt.username}</strong>
                    <small>
                      {actionLabel(receipt.action)} checked ·{" "}
                      {formatDate(receipt.checked_at, true)}
                    </small>
                  </div>
                  <span>
                    <StatusPill status={receipt.status} />
                    <ChevronRight size={15} />
                  </span>
                </summary>
                <div className="b-delivery-evidence">
                  <p>
                    {receipt.action === "comment"
                      ? "The comment and its Instagram author passed the campaign checks."
                      : "The Instagram follow passed the campaign checks."}{" "}
                    {receipt.comment_text && (
                      <>Comment: “{receipt.comment_text}”</>
                    )}
                  </p>
                  <p>Receipt {receipt.reference || receipt.id}</p>
                  <Link
                    to={`/support?reference=${encodeURIComponent(receipt.id)}`}
                  >
                    Question about this result? <ArrowRight size={13} />
                  </Link>
                </div>
              </details>
            ))}
            <Feedback error={moreError} />
            {data.receipts_offset + data.receipts_limit < data.receipts_total &&
              (
                <div className="b-load-control">
                  <SubmitButton
                    className="secondary"
                    busy={more}
                    onClick={() => void loadMore()}
                  >
                    Load more receipts
                  </SubmitButton>
                </div>
              )}
          </div>
        )
        : (
          <EmptyPanel
            icon={BadgeCheck}
            title="Every checked result, right here."
            description="Delivery receipts appear as people finish your campaign and their work passes the final check."
          />
        ))}
    </AsyncState>
  );
}

function CampaignDetailContent(
  { campaign, data, refreshCampaign }: {
    campaign: Campaign;
    data: WorkspaceData;
    refreshCampaign: () => void;
  },
) {
  const market = useMarketplace();
  const [confirm, setConfirm] = useState<"live" | "paused" | "cancelled" | "">(
    "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState("delivery");
  async function changeState() {
    if (!confirm) return;
    if (confirm === "live" && data.account_hold) {
      setError(
        "New work is paused while we review a payment. Existing tasks can still finish.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await market.act("campaign-state", { id: campaign.id, state: confirm });
      setMessage(
        confirm === "paused"
          ? "Campaign paused. Accepted work will still be checked."
          : confirm === "cancelled"
          ? "Campaign closed to new work. Unused funds are returned after outstanding work is accounted for."
          : "Campaign is live.",
      );
      setConfirm("");
      setRefreshKey((value) => value + 1);
      refreshCampaign();
    } catch (failure) {
      setError(friendlyError(failure));
    } finally {
      setBusy(false);
    }
  }
  const final = ["completed", "cancelled"].includes(campaign.status);
  return (
    <>
      <PageIntro
        eyebrow="CAMPAIGN DETAILS"
        title={campaign.title}
        description={`${
          data.business?.name || campaign.business_name
        } · Created ${formatDate(campaign.created_at)}`}
        actions={
          <button
            className="studio-button secondary"
            onClick={() => {
              refreshCampaign();
              setRefreshKey((value) => value + 1);
            }}
          >
            Refresh <Clock3 size={16} />
          </button>
        }
      />
      <Feedback error={error} message={message} />
      <section className="b-detail-banner">
        <div className="b-detail-top">
          <div>
            <ActionIcon action={campaign.action} />
            <div>
              <strong>
                {campaign.action === "follow"
                  ? "Growing your following"
                  : "Starting a conversation"}
              </strong>
              <small>
                <a
                  className="b-detail-target"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={campaign.target_url}
                >
                  @{campaign.target_username || "Instagram"}{" "}
                  <ArrowUpRight size={11} />
                </a>
              </small>
            </div>
          </div>
          <StatusPill status={campaign.status} />
        </div>
        <div className="b-detail-progress-label">
          <strong>
            {count(campaign.delivered_count)}
            <small>/ {count(campaign.quantity)}</small>
          </strong>
          <span>
            {percent(campaign.delivered_count, campaign.quantity)}% delivered
          </span>
        </div>
        <div
          className="b-progress-track"
          role="progressbar"
          aria-label="Campaign delivery"
          aria-valuemin={0}
          aria-valuemax={campaign.quantity}
          aria-valuenow={campaign.delivered_count}
        >
          <span
            style={{
              width: `${percent(campaign.delivered_count, campaign.quantity)}%`,
            }}
          />
        </div>
      </section>
      <div className="b-detail-actions">
        {campaign.status === "draft"
          ? (
            <Link
              className="studio-button"
              to={`/business/campaigns/${campaign.id}/edit`}
            >
              Continue draft <ArrowRight size={16} />
            </Link>
          )
          : !final && campaign.status !== "closing"
          ? (
            <>
              <button
                className="studio-button secondary"
                disabled={busy ||
                  (campaign.status === "paused" && data.account_hold)}
                aria-describedby={campaign.status === "paused" &&
                    data.account_hold
                  ? "campaign-hold-note"
                  : undefined}
                onClick={() =>
                  setConfirm(campaign.status === "paused" ? "live" : "paused")}
              >
                {campaign.status === "paused"
                  ? <Play size={16} />
                  : <Pause size={16} />} {campaign.status === "paused"
                  ? "Resume campaign"
                  : "Pause campaign"}
              </button>
              <button
                className="r-text-button"
                disabled={busy}
                onClick={() => setConfirm("cancelled")}
              >
                <X size={16} /> Close campaign
              </button>
            </>
          )
          : null}
        <Link
          className="r-text-button"
          to={`/support?reference=${encodeURIComponent(campaign.id)}`}
        >
          Get help <ArrowUpRight size={15} />
        </Link>
      </div>
      {campaign.status === "paused" && data.account_hold && (
        <p id="campaign-hold-note" className="studio-note">
          This campaign cannot resume while a payment is under review. Existing
          tasks and receipts remain available.
        </p>
      )}
      {confirm && (
        <section
          className="b-confirm"
          role="region"
          aria-label="Confirm campaign change"
        >
          <h2>
            {confirm === "paused"
              ? "Pause new work?"
              : confirm === "live"
              ? "Ready to resume?"
              : "Close this campaign?"}
          </h2>
          <p>
            {confirm === "paused"
              ? "New people won’t be able to accept this campaign. Anyone already working on it can still finish and get paid when their work passes."
              : confirm === "live"
              ? "People can accept the remaining places again. Your original brief, price and checks stay the same."
              : "No new work will be accepted. Outstanding tasks will be checked as agreed, and only the unused part of your budget will return to your available funds. This cannot be undone."}
          </p>
          <div>
            <SubmitButton
              busy={busy}
              disabled={confirm === "live" && data.account_hold}
              onClick={() => void changeState()}
            >
              {confirm === "paused"
                ? "Yes, pause"
                : confirm === "live"
                ? "Resume campaign"
                : "Close campaign"}
            </SubmitButton>
            <button
              className="studio-button secondary"
              disabled={busy}
              onClick={() => setConfirm("")}
            >
              Keep as it is
            </button>
          </div>
        </section>
      )}
      <div className="b-metrics">
        <div className="b-metric">
          <span>
            <Clock3 size={14} /> In progress
          </span>
          <strong>
            {count(Math.max(0, campaign.active_count - campaign.pending_count))}
          </strong>
          <small>Accepted and being worked on</small>
        </div>
        <div className="b-metric">
          <span>
            <ShieldCheck size={14} /> Final checks
          </span>
          <strong>{count(campaign.pending_count)}</strong>
          <small>Waiting for their release check</small>
        </div>
        <div className="b-metric">
          <span>
            <Wallet size={14} /> Spent
          </span>
          <strong>
            <Money value={campaign.spent_kobo} />
          </strong>
          <small>On completed results</small>
        </div>
      </div>
      <div className="b-tabs" role="group" aria-label="Campaign view">
        <button
          aria-pressed={tab === "delivery"}
          onClick={() => setTab("delivery")}
        >
          Delivery receipts<span>{campaign.delivered_count}</span>
        </button>
        <button aria-pressed={tab === "brief"} onClick={() => setTab("brief")}>
          Campaign brief
        </button>
        <button
          aria-pressed={tab === "budget"}
          onClick={() => setTab("budget")}
        >
          Budget
        </button>
      </div>
      {tab === "delivery"
        ? (
          <Surface>
            <DeliveryReceipts id={campaign.id} refreshKey={refreshKey} />
          </Surface>
        )
        : tab === "brief"
        ? (
          <Surface
            title="The brief people accepted"
            description="Published terms stay fixed so everyone works to the same agreement."
          >
            <dl className="b-detail-list">
              <div>
                <dt>Action</dt>
                <dd>{actionLabel(campaign.action)}</dd>
              </div>
              <div>
                <dt>Goal</dt>
                <dd>{count(campaign.quantity)} results</dd>
              </div>
              <div>
                <dt>Instagram target</dt>
                <dd>
                  <a
                    href={campaign.target_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open in Instagram <ArrowUpRight size={12} />
                  </a>
                </dd>
              </div>
              <div>
                <dt>Final check</dt>
                <dd>
                  {campaign.retention_hours}{" "}
                  hours after the first successful check
                </dd>
              </div>
              <div>
                <dt>Ends</dt>
                <dd>
                  {campaign.ends_at
                    ? formatDate(campaign.ends_at, true)
                    : "When the goal is reached"}
                </dd>
              </div>
            </dl>
            <span className="b-note-label">Instructions</span>
            <p className="b-brief-display">
              {campaign.instructions ||
                `Follow @${campaign.target_username} and return to check your work.`}
            </p>
            {campaign.action === "comment" && (
              <div className="b-inline-note">
                <ShieldCheck size={17} />
                <p>
                  Receipts verify comments. Likes are not a checked or
                  guaranteed result.
                </p>
              </div>
            )}
          </Surface>
        )
        : (
          <Surface
            title="Where your budget goes"
            description="An itemised view of the campaign’s money."
          >
            <dl className="b-detail-list">
              <div>
                <dt>Reward per result</dt>
                <dd>
                  <Money value={campaign.unit_reward_kobo} />
                </dd>
              </div>
              <div>
                <dt>Fee per result</dt>
                <dd>
                  <Money value={campaign.unit_fee_kobo} />
                </dd>
              </div>
              <div>
                <dt>Original campaign budget</dt>
                <dd>
                  <Money
                    value={(campaign.unit_reward_kobo +
                      campaign.unit_fee_kobo) * campaign.quantity}
                  />
                </dd>
              </div>
              <div>
                <dt>Spent on delivered results</dt>
                <dd>
                  <Money value={campaign.spent_kobo} />
                </dd>
              </div>
              <div>
                <dt>Still reserved</dt>
                <dd>
                  <Money value={campaign.reserved_kobo} />
                </dd>
              </div>
            </dl>
            <div className="b-inline-note">
              <Wallet size={18} />
              <p>
                Closing a campaign returns only unused funds. Accepted work
                keeps its allocation until its checks finish.
              </p>
            </div>
            <Link className="r-text-button" to="/business/wallet">
              See your funds and transactions <ArrowRight size={16} />
            </Link>
          </Surface>
        )}
    </>
  );
}

export function BusinessCampaignDetail() {
  const { id } = useParams();
  const record = useOwnedCampaign(id);
  return (
    <Workspace>
      <div className="b-detail">
        <Link className="b-back" to="/business/campaigns">
          <ArrowLeft size={16} /> Campaigns
        </Link>
        <BusinessContent>
          {(data) => (
            <AsyncState
              loading={record.loading}
              error={record.error}
              onRetry={record.refresh}
            >
              {record.campaign
                ? (
                  <CampaignDetailContent
                    campaign={record.campaign}
                    data={data}
                    refreshCampaign={record.refresh}
                  />
                )
                : (
                  <EmptyPanel
                    icon={Megaphone}
                    title="Campaign not found."
                    description="Check the link or return to your campaigns."
                  >
                    <Link className="studio-button" to="/business/campaigns">
                      View campaigns <ArrowRight size={16} />
                    </Link>
                  </EmptyPanel>
                )}
            </AsyncState>
          )}
        </BusinessContent>
      </div>
    </Workspace>
  );
}

function BusinessSettingsForm({ data }: { data: WorkspaceData }) {
  const { act } = useMarketplace();
  const [name, setName] = useState(data.business?.name || "");
  const [category, setCategory] = useState(data.business?.category || "");
  const [website, setWebsite] = useState(data.business?.website || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await act("business-save", {
        name: name.trim(),
        category,
        website: website.trim(),
      });
      setMessage("Business details saved.");
    } catch (failure) {
      setError(friendlyError(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="b-settings-grid">
      <Surface
        title="The name behind the business"
        description="These details appear on your campaigns."
      >
        <form onSubmit={(event) => void save(event)}>
          <Feedback error={error} message={message} />
          <label className="b-field">
            Business name<input
              required
              minLength={2}
              maxLength={100}
              autoComplete="organization"
              placeholder="Your business name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="b-field">
            Category<span className="b-field-optional">Optional</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">Choose a category</option>
              {[
                "Fashion & accessories",
                "Beauty & wellbeing",
                "Food & drinks",
                "Home & living",
                "Technology",
                "Professional services",
                "Arts & entertainment",
                "Education",
                "Other",
              ].map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="b-field">
            Website<span className="b-field-optional">Optional</span>
            <input
              type="url"
              inputMode="url"
              maxLength={300}
              autoCapitalize="none"
              autoComplete="url"
              placeholder="https://yourbusiness.com"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
            <small>Your store, website or booking page.</small>
          </label>
          <SubmitButton type="submit" busy={busy}>
            Save business details
          </SubmitButton>
        </form>
      </Surface>
      <aside>
        <div className="b-settings-links">
          <Link className="b-settings-link" to="/business/instagram">
            <Instagram size={21} />
            <span>
              <strong>Instagram account</strong>
              <small>
                {data.instagram?.status === "verified"
                  ? `@${data.instagram.username}`
                  : "Connect and manage your business account."}
              </small>
            </span>
            <ChevronRight size={16} />
          </Link>
          <Link className="b-settings-link" to="/business/wallet">
            <Wallet size={21} />
            <span>
              <strong>Funds & payments</strong>
              <small>Available funds, spending and receipts.</small>
            </span>
            <ChevronRight size={16} />
          </Link>
          <Link className="b-settings-link" to="/account">
            <ShieldCheck size={21} />
            <span>
              <strong>Personal account & security</strong>
              <small>Your name, password and two-step sign-in.</small>
            </span>
            <ChevronRight size={16} />
          </Link>
        </div>
        <div className="b-settings-note">
          <Globe2 size={24} />
          <h2>A familiar face.</h2>
          <p>
            Use the same business name your customers see on Instagram. A
            consistent identity makes your campaigns easier to recognise.
          </p>
        </div>
      </aside>
    </div>
  );
}

export function BusinessSettings() {
  return (
    <Workspace>
      <div className="b-settings">
        <PageIntro
          eyebrow="YOUR BUSINESS"
          title="Make yourself known."
          description="Keep your business details and connected accounts in good shape."
        />
        <BusinessContent>
          {(data) => <BusinessSettingsForm data={data} />}
        </BusinessContent>
      </div>
    </Workspace>
  );
}
