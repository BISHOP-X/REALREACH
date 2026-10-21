import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Camera as Instagram,
  Check,
  ChevronRight,
  Copy,
  CreditCard,
  ExternalLink,
  Landmark,
  LifeBuoy,
  LockKeyhole,
  Mail,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Workspace } from "./Workspace";
import { marketplaceRequest, useMarketplace } from "./marketplace";
import {
  formatDate,
  formatMoney,
  type Notification,
  parseNaira,
  type PaymentIntent,
  type SupportCase,
  type WalletTransaction,
  withdrawalBlockReason,
} from "./marketplace.types";
import { useMarketplaceList } from "./useMarketplaceList";
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
import { useAuth } from "./AuthContext";

export function InstagramSetup() {
  const business = useLocation().pathname.startsWith("/business");
  const { data, loading, error, refresh, act } = useMarketplace();
  const [username, setUsername] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failure, setFailure] = useState(""),
    [disconnect, setDisconnect] = useState(false),
    [copied, setCopied] = useState(false);
  const account = data?.instagram;
  async function command(action: string) {
    setBusy(true);
    setFailure("");
    setMessage("");
    try {
      await act(
        action,
        action === "instagram-start"
          ? { username: username.trim().replace(/^@/, "") }
          : { id: account?.id },
      );
      setMessage(
        action === "instagram-start"
          ? "Your verification code is ready."
          : action === "instagram-verify"
          ? "Your Instagram account is verified."
          : "Instagram disconnected.",
      );
      setDisconnect(false);
    } catch (e) {
      setFailure(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(account?.challenge ?? "");
      setCopied(true);
    } catch {
      setFailure(
        "Select the code and copy it, then paste it into your Instagram bio.",
      );
    }
  }
  return (
    <Workspace>
      <PageIntro
        eyebrow={business ? "YOUR BUSINESS IDENTITY" : "YOUR INSTAGRAM"}
        title="Make it officially yours."
        description="Link the Instagram account you’ll use on RealReach. No password sharing. Ever."
      />
      <AsyncState loading={loading && !data} error={error} onRetry={refresh}>
        {data && (
          <div className="studio-detail-layout">
            <div>
              <Feedback error={failure} message={message} />
              {account?.status === "verified"
                ? (
                  <Surface className="studio-instagram-verified">
                    <span className="studio-verified-mark">
                      <Instagram size={34} />
                      <Check size={17} />
                    </span>
                    <StatusPill status="verified" />
                    <h2>@{account.username}</h2>
                    <p>This account is linked to you.</p>
                    <div className="studio-summary-line">
                      <span>Verified</span>
                      <strong>{formatDate(account.verified_at)}</strong>
                    </div>
                    <a
                      className="studio-button secondary"
                      href={`https://www.instagram.com/${
                        encodeURIComponent(account.username)
                      }/`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Instagram <ArrowUpRight size={18} />
                    </a>
                    <Link
                      className="studio-button"
                      to={business ? "/business/campaigns/new" : "/earn"}
                    >
                      {business ? "Create a campaign" : "Explore tasks"}
                      <ArrowRight size={18} />
                    </Link>
                    <button
                      className="studio-text-button muted"
                      onClick={() => setDisconnect(true)}
                    >
                      Disconnect this account
                    </button>
                  </Surface>
                )
                : (
                  <>
                    <Surface
                      title="Your Instagram username"
                      description={business
                        ? "Use the account your business owns."
                        : "Use your own public Instagram account."}
                    >
                      <form
                        className="studio-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void command("instagram-start");
                        }}
                      >
                        <label className="studio-field">
                          Username<div className="studio-input-prefix">
                            <span>@</span>
                            <input
                              required
                              autoCapitalize="none"
                              autoCorrect="off"
                              pattern="[A-Za-z0-9._]{1,30}"
                              maxLength={30}
                              placeholder={account?.username || "yourusername"}
                              value={username}
                              onChange={(e) =>
                                setUsername(e.target.value.replace(/^@/, ""))}
                            />
                          </div>
                          <small>
                            Your profile must be public so we can check it.
                          </small>
                        </label>
                        <SubmitButton busy={busy}>
                          {account?.challenge
                            ? "Create a new code"
                            : "Get verification code"}
                        </SubmitButton>
                      </form>
                    </Surface>
                    {account?.challenge && (
                      <Surface
                        title="One small step. Just once."
                        description="Add this code to your Instagram bio, then return here. You can remove it after verification."
                      >
                        <div className="studio-code">
                          <code>{account.challenge}</code>
                          <button
                            aria-label="Copy verification code"
                            onClick={() => void copy()}
                          >
                            {copied ? <Check size={19} /> : <Copy size={19} />}
                          </button>
                        </div>
                        <div className="studio-summary-line">
                          <span>Account</span>
                          <strong>@{account.username}</strong>
                        </div>
                        <div className="studio-summary-line">
                          <span>Code expires</span>
                          <strong>
                            {formatDate(account.challenge_expires_at, true)}
                          </strong>
                        </div>
                        <a
                          className="studio-button secondary wide"
                          href="https://www.instagram.com/accounts/edit/"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Edit Instagram bio <ExternalLink size={17} />
                        </a>
                        <SubmitButton
                          busy={busy}
                          className="wide"
                          onClick={() => void command("instagram-verify")}
                        >
                          I’ve added the code
                        </SubmitButton>
                        {!data.capabilities.instagram && (
                          <p className="studio-small">
                            Instagram checks are not connected yet. Your setup
                            can be saved; we’ll confirm ownership once checks
                            are available.
                          </p>
                        )}
                      </Surface>
                    )}
                  </>
                )}
            </div>
            <aside>
              <Surface
                className="studio-tinted"
                title="Your account stays yours."
              >
                <ShieldCheck
                  className="studio-feature-icon"
                  size={38}
                  strokeWidth={1.3}
                />
                <p>
                  We read your public profile to confirm that you control it. We
                  never ask for your password, post for you or access your
                  private messages.
                </p>
                <ol className="studio-numbered compact">
                  <li>
                    <span>1</span>
                    <div>
                      <strong>Add your username</strong>
                      <p>One Instagram account per RealReach account.</p>
                    </div>
                  </li>
                  <li>
                    <span>2</span>
                    <div>
                      <strong>Place the code in your bio</strong>
                      <p>A short-lived code connects the account to you.</p>
                    </div>
                  </li>
                  <li>
                    <span>3</span>
                    <div>
                      <strong>Verify, then remove it</strong>
                      <p>You’re ready for your next step.</p>
                    </div>
                  </li>
                </ol>
              </Surface>
              <Link className="studio-support-link" to="/support">
                Need a hand?<span>
                  We’re here to help <ArrowUpRight size={16} />
                </span>
              </Link>
            </aside>
          </div>
        )}
      </AsyncState>
      <Modal
        open={disconnect}
        onClose={() => setDisconnect(false)}
        title="Disconnect Instagram?"
        description="New tasks and campaigns will need a verified account. Existing work and receipts will stay saved."
      >
        <div className="studio-dialog-actions">
          <button
            className="studio-button secondary"
            onClick={() => setDisconnect(false)}
          >
            Keep connected
          </button>
          <SubmitButton
            className="danger"
            busy={busy}
            onClick={() => void command("instagram-disconnect")}
          >
            Disconnect
          </SubmitButton>
        </div>
      </Modal>
    </Workspace>
  );
}

type Bank = { code: string; name: string };
export function WalletScreen() {
  const { user } = useAuth();
  // Bank details and payment forms must never survive an account switch.
  return <WalletContent key={user?.id ?? "signed-out"} />;
}
function WalletContent() {
  const business = useLocation().pathname.startsWith("/business"),
    { data, loading, error, refresh, act } = useMarketplace();
  const [params] = useSearchParams();
  const returnPayment = params.get("payment");
  const checkedReturn = useRef<string | null>(null);
  const [modal, setModal] = useState<"topup" | "withdraw" | "bank" | null>(
      null,
    ),
    [amount, setAmount] = useState(""),
    [phone, setPhone] = useState(""),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(""),
    [message, setMessage] = useState("");
  const [banks, setBanks] = useState<Bank[]>([]),
    [banksLoading, setBanksLoading] = useState(false),
    [banksError, setBanksError] = useState(""),
    [banksRevision, setBanksRevision] = useState(0),
    [bankCode, setBankCode] = useState(""),
    [accountNumber, setAccountNumber] = useState(""),
    [beneficiary, setBeneficiary] = useState(""),
    [payment, setPayment] = useState<PaymentIntent | null>(null),
    [filter, setFilter] = useState("all");
  const intent = useRef({ value: "", key: crypto.randomUUID() });
  const transactions = useMarketplaceList<WalletTransaction>(
    "transactions",
    filter,
  );
  const payments = useMarketplaceList<PaymentIntent>(
    "payments",
    business ? "collection" : "payout",
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (
      !business || !data || !returnPayment ||
      checkedReturn.current === returnPayment
    ) return;
    checkedReturn.current = returnPayment;
    // A return URL is only a reference. The server must confirm ownership and payment.
    if (/^[0-9a-f-]{36}$/i.test(returnPayment)) {
      void checkPayment(returnPayment);
    }
  }, [business, !!data, returnPayment]);
  function open(value: typeof modal) {
    setModal(value);
    setFailure("");
    setMessage("");
    setAmount("");
    setPayment(null);
    intent.current = { value: "", key: crypto.randomUUID() };
  }
  useEffect(() => {
    if (modal !== "bank") return;
    const controller = new AbortController();
    setBanksLoading(true);
    setBanksError("");
    setBanks([]);
    marketplaceRequest<{ banks: Bank[] }>("banks", {}, controller.signal).then(
      (v) => {
        if (!controller.signal.aborted) {
          setBanks(v.banks);
          if (!v.banks.length) {
            setBanksError("The bank list is unavailable. Please retry.");
          }
        }
      },
    ).catch((e) => {
      if (!controller.signal.aborted) setBanksError(friendlyError(e));
    }).finally(() => {
      if (!controller.signal.aborted) setBanksLoading(false);
    });
    return () => controller.abort();
  }, [modal, banksRevision]);
  const withdrawalReason = withdrawalBlockReason(data, amount, beneficiary);
  const selectedBank = data?.beneficiaries.find((bank) =>
    bank.id === beneficiary
  );
  const actionUnavailable = modal === "withdraw"
    ? withdrawalReason
    : modal === "topup"
    ? (!data?.capabilities.payments
      ? "Payment collection is unavailable right now. No money will be collected."
      : null)
    : !data?.capabilities.payouts
    ? "Bank verification is unavailable right now. Please try again later."
    : banksLoading
    ? "Loading your bank choices…"
    : banksError || null;
  function key(value: string) {
    if (intent.current.value !== value) {
      intent.current = { value, key: crypto.randomUUID() };
    }
    return intent.current.key;
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFailure("");
    setMessage("");
    try {
      if (actionUnavailable) throw new Error(actionUnavailable);
      if (modal === "bank") {
        if (!banks.some((bank) => bank.code === bankCode)) {
          throw new Error("Choose a bank from the list.");
        }
        await act("bank-verify", {
          bank_code: bankCode,
          account_number: accountNumber,
        });
        setModal(null);
        setAccountNumber("");
        setMessage("Your bank account is verified.");
        return;
      }
      const kobo = parseNaira(amount);
      if (!kobo) {
        throw new Error(
          "Enter an amount with no more than two decimal places.",
        );
      }
      if (modal === "topup") {
        const value = await act<PaymentIntent>("payment-create", {
          amount_kobo: kobo,
          phone: phone.trim(),
          idempotency_key: key(`deposit:${kobo}:${phone.trim()}`),
        });
        setPayment(value);
        payments.refresh();
      } else {
        await act("withdraw", {
          amount_kobo: kobo,
          beneficiary_id: beneficiary,
          expected_fee_kobo: data!.pricing.withdrawal_fee_kobo,
          terms_version: data!.pricing.terms_version,
          idempotency_key: key(`withdraw:${kobo}:${beneficiary}`),
        });
        setModal(null);
        setMessage("Your withdrawal was requested. Follow its status below.");
        transactions.refresh();
        payments.refresh();
      }
    } catch (e) {
      setFailure(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  async function checkPayment(id: string) {
    setBusy(true);
    setFailure("");
    try {
      const result = await act<{ id: string; status: string }>(
        "payment-refresh",
        { id },
      );
      setPayment((previous) =>
        previous?.id === id ? { ...previous, status: result.status } : previous
      );
      setMessage(
        result.status === "succeeded"
          ? (business
            ? "Payment confirmed. Your wallet has been updated."
            : "Your bank transfer is confirmed. The withdrawal is complete.")
          : result.status === "unknown"
          ? (business
            ? "The payment provider has not confirmed the result yet. Please do not pay again."
            : "Your transfer is awaiting confirmation. The amount is held safely; do not request it again. Contact support if you need help.")
          : ["failed", "cancelled", "expired"].includes(result.status)
          ? (business
            ? "This payment did not complete. Your wallet has not been credited."
            : "This withdrawal did not complete. Check your wallet activity or contact support.")
          : "Payment is still awaiting confirmation. You can leave this page and return later.",
      );
      transactions.refresh();
      payments.refresh();
    } catch (e) {
      setFailure(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  const items = transactions.items;
  return (
    <Workspace>
      <PageIntro
        eyebrow={business
          ? "CAMPAIGN FINANCES"
          : "YOUR HARD WORK, ACCOUNTED FOR"}
        title={business ? "Every naira, in view." : "Good work adds up."}
        description={business
          ? "Add funds, follow your spending and keep every receipt."
          : "Your earnings, from the first check to your bank account."}
      />
      <AsyncState loading={loading && !data} error={error} onRetry={refresh}>
        {data && (
          <>
            <Feedback
              error={!modal ? failure : ""}
              message={!modal ? message : ""}
            />
            <div className="studio-wallet-grid">
              <section className="studio-balance-card">
                <div className="studio-balance-top">
                  <span>
                    {data.account_hold
                      ? "WALLET BALANCE · SPENDING PAUSED"
                      : business
                      ? "AVAILABLE FUNDS"
                      : "AVAILABLE TO WITHDRAW"}
                  </span>
                  <Wallet size={23} />
                </div>
                <strong>{formatMoney(data.wallet.available_kobo)}</strong>
                <p>
                  {data.account_hold
                    ? "This balance cannot be spent while a payment is reviewed."
                    : business
                    ? "Ready for your next campaign."
                    : "Earnings that have passed their final check."}
                </p>
                <button
                  className="studio-button light"
                  onClick={() => {
                    open(business ? "topup" : "withdraw");
                    setBeneficiary(data.beneficiaries[0]?.id ?? "");
                  }}
                >
                  {business ? <Plus size={18} /> : <ArrowUpRight size={18} />}
                  {" "}
                  {business ? "Add funds" : "Withdraw earnings"}
                </button>
                <span className="studio-balance-currency">
                  NGN · NIGERIAN NAIRA
                </span>
              </section>
              <div className="studio-wallet-side">
                <Surface>
                  <div className="studio-mini-stat">
                    <ClockIcon />
                    <span>
                      {business
                        ? "Reserved for campaigns"
                        : "Awaiting final checks"}
                    </span>
                    <strong>
                      {formatMoney(
                        business
                          ? data.wallet.reserved_kobo
                          : data.wallet.pending_kobo,
                      )}
                    </strong>
                  </div>
                  <p className="studio-small">
                    {business
                      ? "Set aside for published campaigns and work in progress."
                      : "Moves to your available balance after the final check."}
                  </p>
                </Surface>
                <Surface>
                  <div className="studio-mini-stat">
                    <ReceiptText size={19} />
                    <span>{business ? "Total spent" : "Total earned"}</span>
                    <strong>
                      {formatMoney(
                        business
                          ? data.wallet.spent_kobo
                          : data.wallet.earned_kobo,
                      )}
                    </strong>
                  </div>
                  {!business && data.wallet.withdrawing_kobo > 0 && (
                    <p className="studio-small">
                      {formatMoney(data.wallet.withdrawing_kobo)}{" "}
                      held for withdrawals awaiting confirmation.
                    </p>
                  )}
                </Surface>
              </div>
            </div>
            {!(business
              ? data.capabilities.payments
              : data.capabilities.payouts) && (
              <div className="studio-service-note">
                <LockKeyhole size={20} />
                <div>
                  <strong>
                    {business
                      ? "Adding funds is unavailable."
                      : "Withdrawals are unavailable."}
                  </strong>
                  <p>
                    {business
                      ? "You can still check existing payments. Please do not use an earlier checkout link while funding is unavailable."
                      : "You can still check existing withdrawals. No new transfer will be submitted while payouts are unavailable."}
                  </p>
                </div>
                <button
                  className="studio-text-button"
                  onClick={() => open(business ? "topup" : "withdraw")}
                >
                  View steps <ArrowRight size={16} />
                </button>
              </div>
            )}
            {payments.error && (
              <AsyncState
                loading={false}
                error={payments.error}
                onRetry={payments.refresh}
              >
                {null}
              </AsyncState>
            )}
            {!!payments.items.length && (
              <Surface
                title={business ? "Your payments" : "Your withdrawals"}
                description="The latest status from your payment provider. Wallet activity is recorded separately below."
              >
                {payments.items.map((p) => (
                  <div className="studio-transaction" key={p.id}>
                    <span className="studio-icon-circle">
                      <CreditCard size={20} />
                    </span>
                    <div>
                      <strong>{formatMoney(p.amount_kobo)}</strong>
                      <small>{p.reference}</small>
                    </div>
                    <StatusPill status={p.status} />
                    {business && data.capabilities.payments && p.checkout_url &&
                      ["created", "pending", "processing"].includes(p.status) &&
                      (
                        <button
                          className="studio-text-button"
                          disabled={busy}
                          onClick={() => {
                            open("topup");
                            setPayment(p);
                          }}
                        >
                          Resume <ArrowUpRight size={15} />
                        </button>
                      )}
                    {!["succeeded", "failed", "cancelled", "expired"].includes(
                      p.status,
                    ) && (
                      <button
                        className="studio-text-button"
                        disabled={busy}
                        onClick={() => void checkPayment(p.id)}
                      >
                        Check <RefreshCw size={15} />
                      </button>
                    )}
                    {["unknown", "failed"].includes(p.status) && (
                      <Link
                        className="studio-text-button"
                        to={`/support?reference=${p.id}`}
                      >
                        Get help <ArrowUpRight size={15} />
                      </Link>
                    )}
                  </div>
                ))}
                {payments.nextCursor && (
                  <button
                    className="studio-button secondary wide"
                    disabled={payments.loading}
                    onClick={payments.loadMore}
                  >
                    Load more {business ? "payments" : "withdrawals"}{" "}
                    <ArrowRight size={17} />
                  </button>
                )}
              </Surface>
            )}
            <div className="studio-section-line">
              <div>
                <h2>Account activity</h2>
                <p>A record of every movement.</p>
              </div>
              <button
                className="studio-icon-button"
                aria-label="Refresh wallet"
                disabled={loading}
                onClick={() => {
                  void refresh();
                  transactions.refresh();
                  payments.refresh();
                }}
              >
                <RefreshCw size={18} />
              </button>
            </div>
            <div
              className="studio-tabs studio-spaced"
              role="group"
              aria-label="Filter transactions"
            >
              {(business
                ? [["all", "All activity"], ["deposit", "Added funds"], [
                  "reserve",
                  "Campaigns",
                ]]
                : [["all", "All activity"], ["reward", "Earnings"], [
                  "withdrawal",
                  "Withdrawals",
                ]]).map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={value === filter}
                    className={value === filter ? "selected" : ""}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
            </div>
            <Surface>
              <AsyncState
                loading={transactions.loading && !items.length}
                error={transactions.error}
                onRetry={transactions.refresh}
              >
                {items.length
                  ? items.map((t) => (
                    <div className="studio-transaction" key={t.id}>
                      <span
                        className={`studio-icon-circle ${
                          t.amount_kobo > 0 ? "positive" : ""
                        }`}
                      >
                        {t.amount_kobo > 0
                          ? <ArrowDownLeft size={21} />
                          : <ArrowUpRight size={21} />}
                      </span>
                      <div>
                        <strong>{t.label}</strong>
                        <small>
                          {formatDate(t.created_at, true)} ·{" "}
                          {t.reference.slice(0, 14)}
                        </small>
                      </div>
                      <div className="studio-transaction-value">
                        <strong>
                          {t.amount_kobo > 0 ? "+" : ""}
                          {formatMoney(t.amount_kobo)}
                        </strong>
                        <StatusPill status={t.status} />
                      </div>
                    </div>
                  ))
                  : (
                    <EmptyPanel
                      icon={ReceiptText}
                      title="A clear record, from day one."
                      description={business
                        ? "Your top-ups, campaign spending and returned funds will appear here."
                        : "Your task rewards and withdrawals will appear here."}
                    />
                  )}
              </AsyncState>
              {transactions.nextCursor && (
                <button
                  className="studio-button secondary wide"
                  disabled={transactions.loading}
                  onClick={transactions.loadMore}
                >
                  {transactions.loading ? "Loading…" : "Load more activity"}
                  <ArrowRight size={17} />
                </button>
              )}
            </Surface>
            {!business && (
              <Surface
                title="Your bank accounts"
                description="Withdraw to a verified account in your name."
              >
                {data.beneficiaries.map((b) => (
                  <div className="studio-bank-card" key={b.id}>
                    <Landmark size={24} />
                    <div>
                      <strong>{b.bank_name}</strong>
                      <span>{b.account_name} · •••• {b.account_last4}</span>
                    </div>
                    <StatusPill status={b.status} />
                  </div>
                ))}
                <button
                  className="studio-button secondary"
                  onClick={() => open("bank")}
                >
                  <Plus size={17} /> Add a bank account
                </button>
              </Surface>
            )}
            <Link to="/support" className="studio-support-inline">
              <LifeBuoy size={19} /> Need help with a payment?{" "}
              <ArrowUpRight size={16} />
            </Link>
            <Modal
              open={!!modal}
              onClose={() => {
                if (!busy) setModal(null);
              }}
              title={modal === "topup"
                ? "A little fuel for your next campaign."
                : modal === "bank"
                ? "Where should we send your earnings?"
                : "Your earnings. Your account."}
              description={modal === "topup"
                ? "Choose an amount. You’ll complete payment securely before your balance updates."
                : modal === "bank"
                ? "We’ll confirm your account details before saving them."
                : "Choose a bank account and review the amount."}
            >
              <Feedback error={failure} message={message} />
              {modal === "withdraw" && failure && (
                <button
                  type="button"
                  className="studio-text-button"
                  disabled={busy || loading}
                  onClick={async () => {
                    await refresh();
                    setFailure("");
                    setMessage(
                      "Review the fee and total below before requesting again.",
                    );
                  }}
                >
                  {loading ? "Refreshing wallet…" : "Refresh wallet"}{" "}
                  <RefreshCw size={16} />
                </button>
              )}
              {payment
                ? (
                  <div className="studio-form">
                    <div className="studio-summary-line">
                      <span>Amount</span>
                      <strong>{formatMoney(payment.amount_kobo)}</strong>
                    </div>
                    <p className="studio-small">
                      Your balance updates only after payment is confirmed.
                    </p>
                    {!data.capabilities.payments && (
                      <p className="studio-note">
                        Adding funds is unavailable. You can still check this payment’s status.
                      </p>
                    )}
                    {data.capabilities.payments && payment.checkout_url &&
                      ["created", "pending", "processing"].includes(
                        payment.status,
                      ) && (
                      <a
                        className="studio-button"
                        href={payment.checkout_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Continue to payment <ArrowUpRight size={18} />
                      </a>
                    )}
                    {payment.status !== "succeeded" && (
                      <button
                        className="studio-button secondary"
                        disabled={busy}
                        onClick={() => void checkPayment(payment.id)}
                      >
                        I’ve paid — check status <RefreshCw size={17} />
                      </button>
                    )}
                    <Link
                      to="/business/wallet"
                      className="studio-text-button"
                      onClick={() => setModal(null)}
                    >
                      Return to funds
                    </Link>
                  </div>
                )
                : (
                  <form
                    className="studio-form"
                    onSubmit={(e) => void submit(e)}
                  >
                    {modal === "topup" && (
                      <label className="studio-field">
                        Phone number
                        <input
                          required
                          type="tel"
                          autoComplete="tel"
                          inputMode="tel"
                          maxLength={16}
                          pattern={"(?:0[789][01][0-9]{8}|\\+?234[789][01][0-9]{8})"}
                          placeholder="0801 234 5678"
                          value={phone}
                          onChange={(e) =>
                            setPhone(e.target.value.replace(/\s/g, ""))}
                        />
                        <small>
                          Used to complete your payment with PocketFi.
                        </small>
                      </label>
                    )}
                    {modal === "bank"
                      ? (
                        <>
                          <label className="studio-field">
                            Bank<select
                              aria-label="Bank"
                              required
                              disabled={banksLoading || !!banksError}
                              value={bankCode}
                              onChange={(e) => setBankCode(e.target.value)}
                            >
                              <option value="">
                                {banksLoading
                                  ? "Loading banks…"
                                  : "Choose your bank"}
                              </option>
                              {banks.map((b) => (
                                <option value={b.code} key={b.code}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          {banksError && (
                            <div className="studio-note" role="alert">
                              <p>{banksError}</p>
                              <button
                                type="button"
                                className="studio-text-button"
                                onClick={() =>
                                  setBanksRevision((value) =>
                                    value + 1
                                  )}
                              >
                                Retry bank list <RefreshCw size={15} />
                              </button>
                            </div>
                          )}
                          <label className="studio-field">
                            Account number<input
                              required
                              inputMode="numeric"
                              autoComplete="off"
                              pattern="[0-9]{10}"
                              maxLength={10}
                              value={accountNumber}
                              onChange={(e) =>
                                setAccountNumber(
                                  e.target.value.replace(/\D/g, ""),
                                )}
                              placeholder="10-digit account number"
                            />
                          </label>
                        </>
                      )
                      : (
                        <>
                          {modal === "withdraw" && (
                            <label className="studio-field">
                              Send to<select
                                required
                                value={beneficiary}
                                onChange={(e) => setBeneficiary(e.target.value)}
                              >
                                <option value="">Choose an account</option>
                                {data.beneficiaries.map((b) => (
                                  <option value={b.id} key={b.id}>
                                    {b.account_name} · {b.bank_name} ·{" "}
                                    {b.account_last4}
                                  </option>
                                ))}
                              </select>
                              {!data.beneficiaries.length && (
                                <button
                                  type="button"
                                  className="studio-text-button"
                                  onClick={() => open("bank")}
                                >
                                  Add a bank account <ArrowRight size={15} />
                                </button>
                              )}
                            </label>
                          )}
                          {modal === "withdraw" && selectedBank && (
                            <div
                              className="studio-note"
                              aria-label="Withdrawal recipient"
                            >
                              <strong>{selectedBank.account_name}</strong>
                              <p>
                                {selectedBank.bank_name} · Account ending{" "}
                                {selectedBank.account_last4}
                              </p>
                              <small>
                                Confirm this is your bank account before
                                requesting a transfer.
                              </small>
                            </div>
                          )}
                          <label className="studio-field">
                            Amount<div className="studio-input-prefix">
                              <span>₦</span>
                              <input
                                aria-label="Amount"
                                required
                                inputMode="decimal"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                              />
                            </div>
                          </label>
                          {modal === "topup"
                            ? (
                              <div className="studio-amount-options">
                                {["2000", "5000", "10000"].map((v) => (
                                  <button
                                    type="button"
                                    className={amount === v ? "selected" : ""}
                                    key={v}
                                    onClick={() => setAmount(v)}
                                  >
                                    {formatMoney(Number(v) * 100)}
                                  </button>
                                ))}
                              </div>
                            )
                            : (
                              <>
                                <div className="studio-summary-line">
                                  <span>Available</span>
                                  <strong>
                                    {formatMoney(data.wallet.available_kobo)}
                                  </strong>
                                </div>
                                <div className="studio-summary-line">
                                  <span>Withdrawal fee</span>
                                  <strong>
                                    {data.pricing.approved
                                      ? formatMoney(
                                        data.pricing.withdrawal_fee_kobo,
                                      )
                                      : "Not set yet"}
                                  </strong>
                                </div>
                                {parseNaira(amount) && data.pricing.approved &&
                                  (
                                    <>
                                      <div className="studio-summary-line">
                                        <span>You receive</span>
                                        <strong>
                                          {formatMoney(parseNaira(amount)!)}
                                        </strong>
                                      </div>
                                      <div className="studio-summary-line">
                                        <span>Total from your wallet</span>
                                        <strong>
                                          {formatMoney(
                                            parseNaira(amount)! +
                                              data.pricing.withdrawal_fee_kobo,
                                          )}
                                        </strong>
                                      </div>
                                    </>
                                  )}
                                <p className="studio-small">
                                  {data.pricing.approved
                                    ? `Minimum withdrawal: ${
                                      formatMoney(
                                        data.pricing.minimum_withdrawal_kobo,
                                      )
                                    }.`
                                    : "Withdrawal limits are being prepared."}
                                  {" "}
                                  Withdrawals use whole naira. The final amount
                                  and eligibility are checked securely.
                                </p>
                              </>
                            )}
                        </>
                      )}
                    {!(modal === "topup"
                      ? data.capabilities.payments
                      : data.capabilities.payouts) && (
                      <div className="studio-note">
                        {modal === "topup"
                          ? "Payment collection"
                          : "Bank verification and payouts"}{" "}
                        is awaiting connection. Your money cannot move until the
                        service is ready.
                      </div>
                    )}
                    {actionUnavailable && (
                      <p
                        id="wallet-action-note"
                        className="studio-note"
                        role="status"
                      >
                        {actionUnavailable}
                      </p>
                    )}
                    <SubmitButton
                      busy={busy}
                      disabled={loading || !!actionUnavailable}
                      aria-describedby={actionUnavailable
                        ? "wallet-action-note"
                        : undefined}
                    >
                      {modal === "bank"
                        ? "Verify bank account"
                        : modal === "topup"
                        ? "Continue securely"
                        : "Request withdrawal"}
                    </SubmitButton>
                  </form>
                )}
            </Modal>
          </>
        )}
      </AsyncState>
    </Workspace>
  );
}
function ClockIcon() {
  return <RefreshCw size={19} />;
}

export function SupportScreen() {
  const cases = useMarketplaceList<SupportCase>("cases");
  const { data, loading, error, refresh, act } = useMarketplace(),
    [params] = useSearchParams();
  const [subject, setSubject] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(""),
    [sent, setSent] = useState("");
  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFailure("");
    try {
      const response = await act<{ id: string }>("case-create", {
        subject: subject.trim(),
        message: message.trim(),
        reference: params.get("reference") || null,
      });
      setSent(
        `Your request is saved. Reference ${
          response.id.slice(0, 8).toUpperCase()
        }.`,
      );
      setSubject("");
      setMessage("");
      cases.refresh();
    } catch (e) {
      setFailure(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Workspace>
      <PageIntro
        eyebrow="A REAL PERSON, WHEN YOU NEED ONE"
        title="Let’s work it out."
        description="Tell us what happened. Your request and its updates will stay here."
      />
      <div className="studio-detail-layout">
        <div>
          <Surface title="How can we help?">
            <Feedback error={failure} message={sent} />
            <form className="studio-form" onSubmit={(e) => void send(e)}>
              <label className="studio-field">
                What’s this about?<select
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                >
                  <option value="">Choose a topic</option>
                  {[
                    "Instagram account",
                    "Task verification",
                    "Campaign delivery",
                    "Payment or withdrawal",
                    "Account access",
                    "Something else",
                  ].map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              {params.get("reference") && (
                <p className="studio-small">
                  Linked reference:{" "}
                  {params.get("reference")?.slice(0, 8).toUpperCase()}
                </p>
              )}
              <label className="studio-field">
                A few details<textarea
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={5}
                  placeholder="What happened, and what were you expecting?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <small>
                  Never include passwords, bank PINs or sign-in codes.
                </small>
              </label>
              <SubmitButton busy={busy}>Send request</SubmitButton>
            </form>
          </Surface>
          <AsyncState
            loading={cases.loading && !cases.items.length}
            error={cases.error}
            onRetry={cases.refresh}
          >
            <Surface title="Your requests">
              {cases.items.length
                ? cases.items.map((c) => (
                  <details key={c.id} className="studio-case">
                    <summary>
                      <div>
                        <strong>{c.subject}</strong>
                        <span>
                          {formatDate(c.created_at)} ·{" "}
                          {c.id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                      <StatusPill status={c.status} />
                      <ChevronRight size={17} />
                    </summary>
                    <p>{c.message}</p>
                    {c.resolution && (
                      <div className="studio-note">
                        <strong>Our response</strong>
                        <p>{c.resolution}</p>
                      </div>
                    )}
                  </details>
                ))
                : (
                  <p className="studio-muted">
                    No requests yet. We’re here when you need us.
                  </p>
                )}
              {cases.nextCursor && (
                <button
                  className="studio-button secondary wide"
                  disabled={cases.loading}
                  onClick={cases.loadMore}
                >
                  Load more requests <ArrowRight size={17} />
                </button>
              )}
            </Surface>
          </AsyncState>
        </div>
        <aside>
          <Surface className="studio-tinted" title="A good place to start">
            <LifeBuoy size={34} strokeWidth={1.3} />
            <p>
              Our help guide explains task checks, campaign funds and account
              setup.
            </p>
            <Link className="studio-button secondary" to="/help">
              Read the guide <ArrowUpRight size={17} />
            </Link>
          </Surface>
          <a
            className="studio-support-link"
            href="mailto:userealreach@gmail.com"
          >
            Prefer email?<span>
              userealreach@gmail.com <Mail size={17} />
            </span>
          </a>
        </aside>
      </div>
    </Workspace>
  );
}

export function NotificationsScreen() {
  const notices = useMarketplaceList<Notification>("notifications");
  const { data, loading, error, refresh, act } = useMarketplace(),
    [failure, setFailure] = useState("");
  async function read(id: string) {
    try {
      await act("notification-read", { id });
      notices.refresh();
    } catch (e) {
      setFailure(friendlyError(e));
    }
  }
  return (
    <Workspace>
      <PageIntro
        eyebrow="IN THE LOOP"
        title="Your updates."
        description="Task progress, campaign activity and payment updates. All together."
      />
      <Feedback error={failure} />
      <AsyncState
        loading={notices.loading && !notices.items.length}
        error={notices.error}
        onRetry={notices.refresh}
      >
        <Surface>
          {notices.items.length
            ? notices.items.map((n) => (
              <article
                key={n.id}
                className={`studio-notification ${!n.read_at ? "unread" : ""}`}
              >
                <span className="studio-icon-circle">
                  <Bell size={21} />
                </span>
                <div>
                  <h2>{n.title}</h2>
                  <p>{n.body}</p>
                  <span className="studio-small">
                    {formatDate(n.created_at, true)}
                  </span>
                  <div className="studio-inline-actions">
                    {n.href && (
                      <Link
                        to={n.href}
                        onClick={() => void read(n.id)}
                        className="studio-text-button"
                      >
                        Open <ArrowRight size={15} />
                      </Link>
                    )}
                    {!n.read_at && (
                      <button
                        className="studio-text-button muted"
                        onClick={() => void read(n.id)}
                      >
                        Mark as read <Check size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))
            : (
              <EmptyPanel
                icon={Bell}
                title="You’re all caught up."
                description="We’ll keep your important updates here. No noise."
              />
            )}
          {notices.nextCursor && (
            <button
              className="studio-button secondary wide"
              disabled={notices.loading}
              onClick={notices.loadMore}
            >
              Load more updates <ArrowRight size={17} />
            </button>
          )}
        </Surface>
      </AsyncState>
    </Workspace>
  );
}
