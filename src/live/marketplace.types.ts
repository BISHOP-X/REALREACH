export type EngagementAction = "follow" | "comment";
export type CampaignStatus =
  | "draft"
  | "live"
  | "paused"
  | "closing"
  | "completed"
  | "cancelled";
export type AssignmentStatus =
  | "reserved"
  | "checking"
  | "pending"
  | "settled"
  | "ineligible"
  | "expired"
  | "rejected"
  | "cancelled"
  | "needs_review";
export type InstagramAccount = {
  id: string;
  username: string;
  instagram_id: string | null;
  status: "pending" | "verified" | "disconnected";
  profile_url: string | null;
  avatar_url: string | null;
  verified_at: string | null;
  challenge: string | null;
  challenge_expires_at: string | null;
};
export type Campaign = {
  id: string;
  business_id: string;
  owner_id?: string;
  business_name: string;
  title: string;
  action: EngagementAction;
  status: CampaignStatus;
  target_url: string;
  target_username: string;
  target_id: string | null;
  instructions: string;
  quantity: number;
  unit_reward_kobo: number;
  unit_fee_kobo: number;
  reserved_kobo: number;
  spent_kobo: number;
  delivered_count: number;
  active_count: number;
  pending_count: number;
  created_at: string;
  updated_at: string;
  ends_at: string | null;
  retention_hours: number;
};
export type Assignment = {
  id: string;
  campaign_id: string;
  campaign_title: string;
  business_name: string;
  action: EngagementAction;
  target_url: string;
  target_username: string;
  instructions: string;
  status: AssignmentStatus;
  reason: string | null;
  reward_kobo: number;
  created_at: string;
  expires_at: string | null;
  submitted_at: string | null;
  hold_until: string | null;
  settled_at: string | null;
  next_check_at: string | null;
  comment_text: string | null;
  evidence_id: string | null;
};
export type WalletSummary = {
  currency: "NGN";
  available_kobo: number;
  pending_kobo: number;
  reserved_kobo: number;
  withdrawing_kobo: number;
  earned_kobo: number;
  spent_kobo: number;
};
export type WalletTransaction = {
  id: string;
  kind:
    | "deposit"
    | "reward"
    | "withdrawal"
    | "reserve"
    | "release"
    | "refund"
    | "fee";
  label: string;
  amount_kobo: number;
  status: string;
  created_at: string;
  reference: string;
};
export type Beneficiary = {
  id: string;
  bank_code: string;
  bank_name: string;
  account_name: string;
  account_last4: string;
  status: "verified" | "pending";
};
export type PaymentIntent = {
  id: string;
  direction?: 'collection' | 'payout';
  reference: string;
  amount_kobo: number;
  status: string;
  checkout_url: string | null;
  created_at: string;
};
export type SupportCase = {
  id: string;
  subject: string;
  message: string;
  status: "open" | "in_review" | "resolved";
  resolution: string | null;
  reference: string | null;
  created_at: string;
};
export type Notification = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
};
export type Pricing = {
  approved: boolean;
  follow_reward_kobo: number;
  follow_fee_kobo: number;
  comment_reward_kobo: number;
  comment_fee_kobo: number;
  retention_hours: number;
  claim_minutes: number;
  minimum_withdrawal_kobo: number;
  withdrawal_fee_kobo: number;
  max_campaign_quantity: number;
  terms_version: string;
};
export type Capabilities = {
  instagram: boolean;
  payments: boolean;
  payouts: boolean;
  pricing: boolean;
  payouts_paused: boolean;
};
export type WorkspaceData = {
  account_hold?: boolean;
  metrics?: {active_assignments:number;completed_assignments:number;active_campaigns:number;delivered_actions:number;total_campaigns:number};
  business:
    | { id: string; name: string; category?: string; website?: string }
    | null;
  instagram: InstagramAccount | null;
  campaigns: Campaign[];
  feed: Campaign[];
  assignments: Assignment[];
  wallet: WalletSummary;
  transactions: WalletTransaction[];
  beneficiaries: Beneficiary[];
  payments: PaymentIntent[];
  cases: SupportCase[];
  notifications: Notification[];
  pricing: Pricing;
  capabilities: Capabilities;
};
export type CampaignInput = {
  id?: string;
  title: string;
  action: EngagementAction;
  target_url: string;
  instructions: string;
  quantity: number;
  ends_at: string | null;
};
export type CampaignQuote = {
  campaign_updated_at: string;
  reward_kobo: number;
  fee_kobo: number;
  total_kobo: number;
  shortfall_kobo: number;
  approved: boolean;
  expires_at: string;
  quantity: number;
  retention_hours: number;
  terms_version: string;
};
export type TaskDetailData = {
  campaign: Campaign;
  assignment: Assignment | null;
  eligible: boolean;
  reason: string | null;
};
export type AdminOverview = {
  health?: {
    queued_checks: number; due_checks: number; running_checks: number; attention_checks: number;
    oldest_due_at: string | null;
    limits: {jobs_per_run:number; follow_pages_per_batch:number; comment_pages_per_batch:number; max_scan_pages:number; max_scan_minutes:number; claim_queue_limit:number};
  };
  counts: {
    workers: number;
    businesses: number;
    live_campaigns: number;
    open_cases: number;
    pending_checks: number;
    pending_payouts: number;
  };
  cases: SupportCase[];
  jobs: Array<
    {
      id: string;
      phase: string;
      state: string;
      attempts: number;
      due_at: string;
      reason?: string | null;
    }
  >;
  payouts: Array<
    {
      id: string;
      reference: string;
      amount_kobo: number;
      status: string;
      created_at: string;
    }
  >;
  audit: Array<
    { id: string; action: string; created_at: string; reference: string | null }
  >;
  capabilities: Capabilities;
  pricing: Pricing;
};
export type AdminOwner = {id:string;display_name:string;account_type:'worker'|'business'|null};
export type AdminCheck = {
  id:string;phase:string;state:string;attempts:number;due_at:string;reason?:string|null;
  assignment_id:string|null;payment_id:string|null;
  scanned_pages:number;created_at:string;
};
export type AdminPayment = Omit<PaymentIntent,'checkout_url'> & {
  direction:'collection'|'payout';provider_id:string|null;owner_id:string;fee_kobo:number;
  currency:string;submitted_at:string|null;checked_at:string|null;owner?:AdminOwner|null;risk_held?:boolean;
};
export type AdminCase = SupportCase & {owner?:AdminOwner|null;owner_id?:string;
  related_record?:{resource:'payment'|'task'|'campaign';id:string}|null;
  reference_resolution?:'resolved'|'missing'|'unavailable'|'ambiguous';
};
export type AdminAudit = {id:string;action:string;created_at:string;reference:string|null;actor_id?:string|null;reason?:string|null};
export type AdminEvidence = {id:string;result:string;phase:string;actor_id:string|null;target_id:string|null;comment_id:string|null;reason:string|null;checked_at:string;provider:string};
export type AdminPaymentEvent = {event_hash:string;reason:string;created_at:string};
export type AdminRiskHold = {id:string;payment_id:string;reason:string;created_at:string};
export type AdminHistoryKind = 'jobs'|'evidence'|'cases'|'audit'|'events';
export type AdminHistoryCursors = Partial<Record<AdminHistoryKind,string|null>>;
export type AdminPaymentDetail = {
  payment:AdminPayment;owner:AdminOwner|null;
  beneficiary:{bank_name:string;account_name:string;account_last4:string}|null;
  jobs:AdminCheck[];evidence:AdminEvidence[];audit:AdminAudit[];cases:AdminCase[];
  events:AdminPaymentEvent[];risk_hold:AdminRiskHold|null;
  allowed_actions:{recheck:boolean;close_without_payment:false};recovery_note:string|null;
  history_cursors?:AdminHistoryCursors;
  history_limits?:{jobs:number;evidence?:number;audit:number;cases:number;events:number};
};
export type AdminTaskDetail = {
  assignment:Assignment & {worker_id?:string;fee_kobo?:number;terms_version?:string};
  campaign:Campaign&{terms_version?:string};worker:AdminOwner|null;owner:AdminOwner|null;
  worker_instagram?:{username:string|null;instagram_id:string}|null;
  jobs:AdminCheck[];evidence:AdminEvidence[];audit:AdminAudit[];cases:AdminCase[];
  closure:{id:string;reason:string;created_at:string;actor_id:string;amount_kobo?:number;release_destination?:string}|null;
  allowed_actions:{retry:boolean;close_without_payment:boolean};
  history_cursors?:AdminHistoryCursors;
  history_limits?:{jobs:number;evidence:number;audit:number;cases:number;events?:number};
};
export type AdminCampaignDetail = {
  campaign:Campaign&{terms_version?:string};owner:AdminOwner|null;
  cases:AdminCase[];audit:AdminAudit[];history_cursors?:AdminHistoryCursors;
  history_limits?:{jobs?:number;evidence?:number;audit:number;cases:number;events?:number};
};
export type AdminPaymentRecovery = {id:string;status:string;outcome:'confirmed'|'not_paid'|'pending'|'unknown'|'provider_support_required'|'risk_review';message:string};
export type AdminReconciliation = {
  id:string;status:'clean'|'discrepancy'|'failed';checked_at:string;
  findings:{unbalanced_journals:number;account_mismatches:number;campaign_mismatches:number;withdrawal_mismatches:number}|null;error:string|null;
};
export type AdminOperationsData = {
  checked_at:string;
  thresholds:{snapshot_stale_minutes:number;worker_stale_minutes:number;reconciliation_stale_hours:number};
  snapshot_status:'never_run'|'fresh'|'stale';
  snapshot:{collected_at:string;counts:{pending_payments:number;uncertain_payments:number;stalled_payments:number;missing_references:number;pending_checks:number;review_checks:number;overdue_checks:number;risk_holds:number;support_open:number;support_overdue:number};incidents:Array<{code:string;severity:'critical'|'warning';count:number}>}|null;
  worker:{status:'never_run'|'healthy'|'failed'|'stale'|'unknown';last_seen_at:string|null;last_success_at:string|null;last_failure_at:string|null;processed:number;last_error:string|null};
  reconciliation:AdminReconciliation|null;
  reconciliation_status:'never_run'|'clean'|'discrepancy'|'failed'|'stale';
  alerts:Array<{id:string;status:'queued'|'sending'|'retry'|'accepted'|'failed'|'needs_review'|'superseded';last_outcome:'accepted'|'retry'|'uncertain'|'failed'|null;created_at:string;last_attempt_at:string|null;retry_until:string|null;attempts:number;provider_id:string|null;error_code:string|null}>;
  alerting:{configured:boolean;configuration_reason:'ready'|'missing_key'|'missing_sender'|'invalid_sender'|'missing_recipient'|'invalid_recipient';last_created_at:string|null;reminder_hours:number};
};
export const actionLabel = (action: EngagementAction) =>
  action === "follow" ? "Follow" : "Comment";
export function parseNaira(value: string): number | null {
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}
export function formatMoney(kobo: number, decimals = kobo % 100 !== 0) {
  if (!Number.isSafeInteger(kobo)) return '—';
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(kobo / 100);
}
export function formatDate(value: string | null, time = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    ...(time ? { hour: "numeric", minute: "2-digit" } as const : {}),
  }).format(date);
}

// UI guidance only: the server separately checks current terms and funds.
export function withdrawalBlockReason(data: WorkspaceData | null, amount: string, beneficiaryId: string): string | null {
  if (!data) return 'Reload your wallet before requesting a withdrawal.';
  if (data.account_hold) return 'Withdrawals are paused while we review a payment. Contact support for an update.';
  if (!data.capabilities.payouts) return 'Bank transfers are unavailable right now. Your earnings stay in your wallet.';
  if (data.capabilities.payouts_paused) return 'Withdrawals are temporarily paused. Your earnings stay in your wallet.';
  if (!data.pricing.approved || !data.pricing.terms_version) return 'Withdrawal fees and limits are not available yet.';
  if (!data.beneficiaries.some(bank => bank.id === beneficiaryId && bank.status === 'verified')) return 'Choose a verified bank account before withdrawing.';
  const kobo = parseNaira(amount);
  if (!kobo || kobo % 100 !== 0) return 'Enter a whole-naira amount for your withdrawal.';
  if (kobo < data.pricing.minimum_withdrawal_kobo) return `The minimum withdrawal is ${formatMoney(data.pricing.minimum_withdrawal_kobo)}.`;
  const total = kobo + data.pricing.withdrawal_fee_kobo;
  if (!Number.isSafeInteger(total) || kobo > 1_000_000_000) return 'Enter a withdrawal of no more than ₦10,000,000.';
  if (total > data.wallet.available_kobo) return `You need ${formatMoney(total)} available to cover this withdrawal and its fee.`;
  return null;
}
