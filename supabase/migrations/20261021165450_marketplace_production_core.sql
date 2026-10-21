-- RealReach production marketplace. All state/money commands are service-only;
-- Edge authenticates the caller, then these transactions recheck ownership.
-- No illustrative prices or balances are seeded. Operator approval is required.
alter table public.businesses add column category text not null default '';
alter table public.businesses add column website text not null default '';

create table public.rr_settings (
  singleton boolean primary key default true check(singleton),
  approved boolean not null default false,
  follow_reward_kobo bigint not null default 0 check(follow_reward_kobo between 0 and 100000000),
  follow_fee_kobo bigint not null default 0 check(follow_fee_kobo between 0 and 100000000),
  comment_reward_kobo bigint not null default 0 check(comment_reward_kobo between 0 and 100000000),
  comment_fee_kobo bigint not null default 0 check(comment_fee_kobo between 0 and 100000000),
  retention_hours integer not null default 48 check(retention_hours between 1 and 168),
  claim_minutes integer not null default 30 check(claim_minutes between 5 and 1440),
  minimum_withdrawal_kobo bigint not null default 100000 check(minimum_withdrawal_kobo between 10000 and 100000000),
  withdrawal_fee_kobo bigint not null default 0 check(withdrawal_fee_kobo between 0 and 1000000),
  max_campaign_quantity integer not null default 10000 check(max_campaign_quantity between 1 and 100000),
  terms_version text not null default '2026-10-v1-unapproved',
  payouts_paused boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.rr_settings(singleton) values(true);

-- Operator-owned workload/cost limits. No browser grant or public update action.
-- Installing a provider key does not approve a larger verification budget.
create table public.rr_operational_limits (
 singleton boolean primary key default true check(singleton),
 jobs_per_run integer not null default 8 check(jobs_per_run between 1 and 8),
 follow_pages_per_batch integer not null default 8 check(follow_pages_per_batch between 1 and 8),
 comment_pages_per_batch integer not null default 1 check(comment_pages_per_batch between 1 and 8),
 max_scan_pages integer not null default 500 check(max_scan_pages between 10 and 500),
 max_scan_minutes integer not null default 30 check(max_scan_minutes between 5 and 30),
 claim_queue_limit integer not null default 100 check(claim_queue_limit between 1 and 10000)
);
insert into public.rr_operational_limits(singleton) values(true);

create table public.rr_instagram_accounts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(id),
  username text not null check(username ~ '^[A-Za-z0-9_.]{1,30}$'), instagram_id text unique,
  status text not null default 'pending' check(status in ('pending','verified','disconnected')),
  profile_url text, avatar_url text, verified_at timestamptz, challenge text, challenge_expires_at timestamptz,
  challenge_attempts integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.rr_instagram_registry(instagram_id text primary key,user_id uuid not null references public.profiles(id),created_at timestamptz not null default now());
create index rr_instagram_registry_user on public.rr_instagram_registry(user_id);
create table public.rr_campaigns (
  id uuid primary key default gen_random_uuid(), business_id uuid not null, owner_id uuid not null,
  title text not null check(length(trim(title)) between 3 and 100), action text not null check(action in ('follow','comment')),
  status text not null default 'draft' check(status in ('draft','live','paused','closing','completed','cancelled')),
  target_url text not null default '', target_username text not null default '', target_id text, media_id text,
  instructions text not null default '' check(length(instructions)<=1000), quantity integer not null check(quantity between 1 and 100000),
  remaining_count integer not null default 0 check(remaining_count>=0), active_count integer not null default 0 check(active_count>=0),
  delivered_count integer not null default 0 check(delivered_count>=0),
  unit_reward_kobo bigint not null default 0 check(unit_reward_kobo>=0), unit_fee_kobo bigint not null default 0 check(unit_fee_kobo>=0),
  retention_hours integer not null default 48, claim_minutes integer not null default 30, terms_version text,
  reserved_kobo bigint not null default 0 check(reserved_kobo>=0), spent_kobo bigint not null default 0 check(spent_kobo>=0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), ends_at timestamptz,
  foreign key(business_id,owner_id) references public.businesses(id,owner_id),
  check(remaining_count+active_count+delivered_count<=quantity)
);
create index rr_campaign_owner on public.rr_campaigns(owner_id,created_at desc);
create index rr_campaign_business on public.rr_campaigns(business_id);
create index rr_campaign_feed on public.rr_campaigns(created_at desc) where status='live' and remaining_count>0;
create table public.rr_quotes (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.rr_campaigns(id), owner_id uuid not null references public.profiles(id),
 campaign_updated_at timestamptz not null, terms_version text not null, total_kobo bigint not null check(total_kobo>=0), expires_at timestamptz not null default now()+interval '15 minutes'
);
create index rr_quotes_owner_campaign on public.rr_quotes(owner_id,campaign_id,expires_at);
create index rr_quotes_campaign on public.rr_quotes(campaign_id);

-- Migrate genuine pre-marketplace drafts without inventing targets or funding.
insert into public.rr_campaigns(id,business_id,owner_id,title,action,quantity,created_at,updated_at)
select id,business_id,owner_id,title,action,quantity,created_at,updated_at from public.campaign_drafts;
revoke insert(business_id,owner_id,title,action,quantity),update(title,quantity) on public.campaign_drafts from authenticated;

create table public.rr_assignments (
  id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.rr_campaigns(id),
  worker_id uuid not null references public.profiles(id), instagram_id text not null,
  target_key text not null,
  status text not null default 'reserved' check(status in ('reserved','checking','pending','settled','ineligible','expired','rejected','cancelled','needs_review')),
  phase text not null default 'baseline' check(phase in ('baseline','completion','retention','finished')),
  reason text, reward_kobo bigint not null check(reward_kobo>0), fee_kobo bigint not null check(fee_kobo>=0),
  created_at timestamptz not null default now(), expires_at timestamptz, submitted_at timestamptz,
  hold_until timestamptz, settled_at timestamptz, comment_text text, comment_id text, evidence_id uuid,
  unique(campaign_id,worker_id), unique(campaign_id,instagram_id)
);
create index rr_assignment_worker on public.rr_assignments(worker_id,created_at desc);
create index rr_assignment_expiry on public.rr_assignments(expires_at) where status='reserved';
create unique index rr_comment_single_reward on public.rr_assignments(comment_id) where comment_id is not null;
create unique index rr_worker_target_once on public.rr_assignments(worker_id,target_key) where status in ('reserved','checking','pending','settled','needs_review','ineligible');
create unique index rr_instagram_target_once on public.rr_assignments(instagram_id,target_key) where status in ('reserved','checking','pending','settled','needs_review','ineligible');

create table public.rr_evidence (
  id uuid primary key default gen_random_uuid(), assignment_id uuid not null references public.rr_assignments(id),
  phase text not null, result text not null check(result in ('verified','not_found','unknown')),
  actor_id text not null, target_id text not null, comment_id text, reason text,
  checked_at timestamptz not null default now(), provider text not null default 'rocket',
  unique(assignment_id,phase,checked_at)
);
create index rr_evidence_assignment on public.rr_evidence(assignment_id);
create table public.rr_jobs (
  id uuid primary key default gen_random_uuid(), assignment_id uuid references public.rr_assignments(id),
  payment_id uuid, phase text not null check(phase in ('baseline','completion','retention','collection','payout')),
  state text not null default 'queued' check(state in ('queued','running','done','attention')),
  attempts integer not null default 0, due_at timestamptz not null default now(), lease_id uuid, lease_until timestamptz, reason text,
  cursor text, scan_started_at timestamptz, scanned_pages integer not null default 0, seen_cursors text[] not null default '{}',
  created_at timestamptz not null default now(), check((assignment_id is null)<>(payment_id is null))
);
create index rr_jobs_due on public.rr_jobs(due_at) where state in ('queued','running');
create index rr_jobs_assignment on public.rr_jobs(assignment_id);
create index rr_jobs_payment on public.rr_jobs(payment_id);
create unique index rr_active_assignment_job on public.rr_jobs(assignment_id,phase) where state in ('queued','running');
create unique index rr_active_payment_job on public.rr_jobs(payment_id,phase) where state in ('queued','running');

create table public.rr_ledger_accounts (
  id uuid primary key default gen_random_uuid(), owner_id uuid references public.profiles(id),
  bucket text not null check(bucket in ('available','campaign','withdrawal','external','fees','provider_expense')),
  reference_id uuid not null, balance_kobo bigint not null default 0,
  unique(bucket,reference_id), check(bucket in ('external','provider_expense') or balance_kobo>=0)
);
create index rr_ledger_accounts_owner on public.rr_ledger_accounts(owner_id);
create table public.rr_journals (
  id uuid primary key default gen_random_uuid(), reference text not null unique,
  kind text not null check(kind in ('deposit','reward','withdrawal','reserve','release','refund','fee')),
  label text not null, created_at timestamptz not null default now()
);
create table public.rr_ledger_entries (
  id uuid primary key default gen_random_uuid(), journal_id uuid not null references public.rr_journals(id),
  account_id uuid not null references public.rr_ledger_accounts(id), amount_kobo bigint not null check(amount_kobo<>0)
  ,created_at timestamptz not null default now()
);
create index rr_entries_journal on public.rr_ledger_entries(journal_id);
create index rr_entries_account on public.rr_ledger_entries(account_id);
create table public.rr_beneficiaries (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id),
  bank_code text not null, bank_name text not null, account_number text not null check(account_number ~ '^\d{10}$'),
  account_name text not null, status text not null default 'verified' check(status='verified'),
  created_at timestamptz not null default now(), unique(owner_id,bank_code,account_number)
);
create table public.rr_payments (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id),
  direction text not null check(direction in ('collection','payout')), reference text not null unique,
  idempotency_key text not null check(length(idempotency_key) between 8 and 100),
  amount_kobo bigint not null check(amount_kobo between 10000 and 1000000000), fee_kobo bigint not null default 0 check(fee_kobo>=0),
  currency text not null default 'NGN' check(currency='NGN'), status text not null default 'created'
    check(status in ('created','pending','unknown','succeeded','failed')),
  beneficiary_id uuid references public.rr_beneficiaries(id), provider_id text unique, checkout_url text,
  provider_fee_kobo bigint check(provider_fee_kobo>=0),
  submitted_at timestamptz, checked_at timestamptz, created_at timestamptz not null default now(),
  unique(owner_id,direction,idempotency_key)
);
create index rr_payment_owner on public.rr_payments(owner_id,created_at desc);
create index rr_payment_beneficiary on public.rr_payments(beneficiary_id);
create table public.rr_payment_events (event_hash text primary key check(length(event_hash)=64), payment_id uuid not null references public.rr_payments(id), reason text not null, expected_state text check(expected_state in ('failed')), created_at timestamptz not null default now());
create index rr_payment_events_payment on public.rr_payment_events(payment_id);
-- A dispute is a quarantine, not an invented debit or an automatic clawback.
-- One succeeded payment can create one durable hold; no client/admin release
-- operation exists until an independently evidenced recovery policy is added.
create table public.rr_payment_risk_holds (
  id uuid primary key default gen_random_uuid(), payment_id uuid not null unique references public.rr_payments(id),
  owner_id uuid not null references public.profiles(id), event_hash text not null references public.rr_payment_events(event_hash),
  reason text not null check(length(trim(reason)) between 10 and 500), created_at timestamptz not null default now()
);
create index rr_payment_risk_owner on public.rr_payment_risk_holds(owner_id);
create index rr_payment_risk_event on public.rr_payment_risk_holds(event_hash);
create table public.rr_assignment_closures (
  assignment_id uuid primary key references public.rr_assignments(id), actor_id uuid not null references public.profiles(id),
  worker_id uuid not null references public.profiles(id), business_owner_id uuid not null references public.profiles(id),
  reason text not null check(length(trim(reason)) between 10 and 1000), amount_kobo bigint not null check(amount_kobo>0),
  release_destination text not null check(release_destination in ('campaign_budget','wallet')),
  created_at timestamptz not null default now()
);
create index rr_assignment_closures_worker on public.rr_assignment_closures(worker_id);
create index rr_assignment_closures_business on public.rr_assignment_closures(business_owner_id);
create index rr_assignment_closures_actor on public.rr_assignment_closures(actor_id);
create view public.rr_admin_payment_view with (security_invoker=true) as
 select p.id,p.owner_id,p.direction,p.reference,p.provider_id,p.amount_kobo,p.fee_kobo,p.currency,p.status,
   p.created_at,p.submitted_at,p.checked_at,(h.id is not null) as risk_held
 from public.rr_payments p left join public.rr_payment_risk_holds h on h.payment_id=p.id;
revoke all on public.rr_admin_payment_view from public,anon,authenticated;
grant select on public.rr_admin_payment_view to service_role;
alter table public.rr_jobs add foreign key(payment_id) references public.rr_payments(id);
create table public.rr_cases (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id),
  subject text not null check(length(trim(subject)) between 3 and 120), message text not null check(length(trim(message)) between 10 and 3000),
  reference text, status text not null default 'open' check(status in ('open','in_review','resolved')), resolution text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index rr_cases_owner on public.rr_cases(owner_id,created_at desc);
create table public.rr_notifications (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id),
  title text not null, body text not null, href text, read_at timestamptz, created_at timestamptz not null default now()
);
create index rr_notification_owner on public.rr_notifications(owner_id,created_at desc);
create table public.rr_audit (
  id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id),
  action text not null, reference text, details jsonb not null default '{}', created_at timestamptz not null default now()
);
create index rr_audit_actor on public.rr_audit(actor_id,created_at desc);
create table public.rr_rate_limits(actor_id uuid not null references public.profiles(id), action text not null, window_at timestamptz not null, hits integer not null default 1, primary key(actor_id,action,window_at));
alter table public.rr_rate_limits enable row level security;
revoke all on public.rr_rate_limits from public,anon,authenticated;
grant all on public.rr_rate_limits to service_role;

-- Browser reads remain owner-scoped; no direct client writes to state or money.
do $$ declare t text; begin
  foreach t in array array['rr_settings','rr_operational_limits','rr_instagram_accounts','rr_instagram_registry','rr_campaigns','rr_quotes','rr_assignments','rr_assignment_closures','rr_evidence','rr_jobs','rr_ledger_accounts','rr_journals','rr_ledger_entries','rr_beneficiaries','rr_payments','rr_payment_events','rr_payment_risk_holds','rr_cases','rr_notifications','rr_audit'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
grant select on public.rr_settings,public.rr_instagram_accounts,public.rr_campaigns,public.rr_assignments,public.rr_ledger_accounts,public.rr_cases,public.rr_notifications to authenticated;
grant select on public.rr_payment_risk_holds,public.rr_assignment_closures to authenticated;
create policy rr_settings_read on public.rr_settings for select to authenticated using(true);
create policy rr_ig_read on public.rr_instagram_accounts for select to authenticated using(user_id=(select auth.uid()));
create policy rr_campaign_read on public.rr_campaigns for select to authenticated using(owner_id=(select auth.uid()));
create policy rr_assignment_read on public.rr_assignments for select to authenticated using(worker_id=(select auth.uid()));
create policy rr_account_read on public.rr_ledger_accounts for select to authenticated using(owner_id=(select auth.uid()));
create policy rr_case_read on public.rr_cases for select to authenticated using(owner_id=(select auth.uid()));
create policy rr_notification_read on public.rr_notifications for select to authenticated using(owner_id=(select auth.uid()));
create policy rr_payment_risk_read on public.rr_payment_risk_holds for select to authenticated using(owner_id=(select auth.uid()));
create policy rr_assignment_closure_read on public.rr_assignment_closures for select to authenticated using(worker_id=(select auth.uid()) or business_owner_id=(select auth.uid()));

create function private.rr_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Financial history is append-only'; end $$;
create trigger rr_journal_immutable before update or delete on public.rr_journals for each row execute function private.rr_immutable();
create trigger rr_entry_immutable before update or delete on public.rr_ledger_entries for each row execute function private.rr_immutable();
create trigger rr_evidence_immutable before update or delete on public.rr_evidence for each row execute function private.rr_immutable();
create trigger rr_audit_immutable before update or delete on public.rr_audit for each row execute function private.rr_immutable();
create trigger rr_payment_risk_immutable before update or delete on public.rr_payment_risk_holds for each row execute function private.rr_immutable();
create trigger rr_assignment_closure_immutable before update or delete on public.rr_assignment_closures for each row execute function private.rr_immutable();
create function private.rr_balanced() returns trigger language plpgsql set search_path='' as $$
declare j uuid:=case when tg_table_name='rr_journals' then (to_jsonb(new)->>'id')::uuid else (to_jsonb(new)->>'journal_id')::uuid end;
begin
  if (select count(*)<2 or coalesce(sum(amount_kobo),1)<>0 from public.rr_ledger_entries where journal_id=j) then raise exception 'Unbalanced journal'; end if;
  return null;
end $$;
create constraint trigger rr_journal_balance after insert on public.rr_journals deferrable initially deferred for each row execute function private.rr_balanced();
create constraint trigger rr_entry_balance after insert on public.rr_ledger_entries deferrable initially deferred for each row execute function private.rr_balanced();

create function private.rr_account(p_owner uuid,p_bucket text,p_reference uuid) returns uuid language plpgsql set search_path='' as $$
declare a uuid; begin
  insert into public.rr_ledger_accounts(owner_id,bucket,reference_id) values(p_owner,p_bucket,p_reference) on conflict(bucket,reference_id) do nothing;
  select id into a from public.rr_ledger_accounts where bucket=p_bucket and reference_id=p_reference;
  return a;
end $$;
create function private.rr_post(p_reference text,p_kind text,p_label text,p_entries jsonb) returns uuid language plpgsql set search_path='' as $$
declare j uuid; e record; begin
  select id into j from public.rr_journals where reference=p_reference; if found then return j; end if;
  if (select coalesce(sum((x->>'amount')::bigint),1)<>0 from jsonb_array_elements(p_entries) x) then raise exception 'Unbalanced transfer'; end if;
  -- Deterministic lock ordering prevents cross-account deadlocks.
  perform 1 from public.rr_ledger_accounts where id in (select (x->>'account')::uuid from jsonb_array_elements(p_entries)x) order by id for update;
  insert into public.rr_journals(reference,kind,label) values(p_reference,p_kind,p_label) returning id into j;
  for e in select (x->>'account')::uuid account,sum((x->>'amount')::bigint)::bigint amount from jsonb_array_elements(p_entries)x group by 1 loop
    if e.amount<>0 then
      update public.rr_ledger_accounts set balance_kobo=balance_kobo+e.amount where id=e.account;
      if not found then raise exception 'Account unavailable'; end if;
      insert into public.rr_ledger_entries(journal_id,account_id,amount_kobo) values(j,e.account,e.amount);
    end if;
  end loop;
  return j;
end $$;
create function private.rr_move(p_reference text,p_kind text,p_label text,p_from uuid,p_to uuid,p_amount bigint) returns uuid language sql set search_path='' as $$
 select private.rr_post(p_reference,p_kind,p_label,jsonb_build_array(jsonb_build_object('account',p_from,'amount',-p_amount),jsonb_build_object('account',p_to,'amount',p_amount)));
$$;
-- Deliberately narrow privileged read: service_role cannot SELECT auth.users.
-- Only service-only commands may call this; browser EXECUTE is revoked below.
create function private.rr_actor(p_actor uuid,p_type text default null) returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from auth.users where id=p_actor and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'Sign in with a confirmed account'; end if;
  if not exists(select 1 from public.profiles where id=p_actor and account_type is not null and (p_type is null or account_type=p_type)) and not exists(select 1 from public.sole_admin where user_id=p_actor) then raise exception 'This account cannot perform that action'; end if;
end $$;
create function private.rr_notice(p_owner uuid,p_title text,p_body text,p_href text) returns void language sql set search_path='' as $$
 insert into public.rr_notifications(owner_id,title,body,href) values(p_owner,p_title,p_body,p_href);
$$;
create function private.rr_spend_lock(p_owner uuid) returns void language sql set search_path='' as $$
 select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('realreach-spend:'||p_owner::text,0));
$$;
create function private.rr_spend_guard(p_owner uuid) returns void language plpgsql set search_path='' as $$
begin
 if p_owner is null then raise exception 'Account unavailable'; end if;
 perform private.rr_spend_lock(p_owner);
 if exists(select 1 from public.rr_payment_risk_holds where owner_id=p_owner) then raise exception 'Payments on this account need review. New spending is paused; contact support'; end if;
end $$;

create function public.rr_market_command(p_actor uuid,p_action text,p_input jsonb default '{}') returns jsonb language plpgsql set search_path='' as $$
declare
  s public.rr_settings; c public.rr_campaigns; a public.rr_assignments; ig public.rr_instagram_accounts; b public.businesses;
  p public.rr_payments; v_id uuid; v_state text; available uuid; reserve uuid; amount bigint; fee bigint;
begin
  perform private.rr_actor(p_actor);
  select * into s from public.rr_settings where singleton;
  if p_action='business-save' then
    perform private.rr_actor(p_actor,'business');
    if length(trim(p_input->>'name')) not between 2 and 100 then raise exception 'Enter a business name'; end if;
    insert into public.businesses(owner_id,name,category,website) values(p_actor,trim(p_input->>'name'),left(coalesce(p_input->>'category',''),80),left(coalesce(p_input->>'website',''),300))
      on conflict(owner_id) do update set name=excluded.name,category=excluded.category,website=excluded.website returning id into v_id;
    return jsonb_build_object('id',v_id);
  elsif p_action='instagram-start' then
    if coalesce(p_input->>'username','') !~ '^[A-Za-z0-9_.]{1,30}$' then raise exception 'Enter an Instagram username'; end if;
    select * into ig from public.rr_instagram_accounts where user_id=p_actor for update;
    if found and ig.updated_at>now()-interval '1 minute' then raise exception 'Wait a minute before requesting another code'; end if;
    if exists(select 1 from public.rr_assignments where worker_id=p_actor and status in ('reserved','checking','pending','needs_review')) or exists(select 1 from public.rr_campaigns where owner_id=p_actor and status in ('live','paused','closing')) then raise exception 'Finish active work before changing Instagram accounts'; end if;
    insert into public.rr_instagram_accounts(user_id,username,challenge,challenge_expires_at,profile_url)
      values(p_actor,lower(p_input->>'username'),'RR-'||upper(encode(extensions.gen_random_bytes(12),'hex')),now()+interval '30 minutes','https://www.instagram.com/'||lower(p_input->>'username')||'/')
      on conflict(user_id) do update set username=excluded.username,status='pending',challenge=excluded.challenge,challenge_expires_at=excluded.challenge_expires_at,challenge_attempts=0,updated_at=now(),profile_url=excluded.profile_url returning id into v_id;
    return jsonb_build_object('id',v_id);
  elsif p_action='instagram-attempt' then
    update public.rr_instagram_accounts set challenge_attempts=challenge_attempts+1 where user_id=p_actor and id=(p_input->>'id')::uuid and status='pending' and challenge_expires_at>now() and challenge_attempts<12 returning * into ig;
    if not found then raise exception 'This code expired. Request a new code'; end if;
    return to_jsonb(ig);
  elsif p_action='instagram-confirm' then
    insert into public.rr_instagram_registry(instagram_id,user_id) values(p_input->>'instagram_id',p_actor) on conflict do nothing;
    if not exists(select 1 from public.rr_instagram_registry where instagram_id=p_input->>'instagram_id' and user_id=p_actor) then raise exception 'This Instagram account belongs to another RealReach account. Contact support'; end if;
    update public.rr_instagram_accounts set instagram_id=p_input->>'instagram_id',username=p_input->>'username',status='verified',verified_at=now(),challenge=null,challenge_expires_at=null,updated_at=now()
      where user_id=p_actor and id=(p_input->>'id')::uuid and challenge=p_input->>'challenge' and challenge_expires_at>now() returning id into v_id;
    if not found then raise exception 'This code expired. Request a new code'; end if;
    return jsonb_build_object('id',v_id);
  elsif p_action='instagram-disconnect' then
    if exists(select 1 from public.rr_assignments where worker_id=p_actor and status in ('reserved','checking','pending','needs_review')) or exists(select 1 from public.rr_campaigns where owner_id=p_actor and status in ('live','paused','closing')) then raise exception 'Finish active work before disconnecting Instagram'; end if;
    update public.rr_instagram_accounts set status='disconnected',challenge=null,updated_at=now() where user_id=p_actor;
    return '{"ok":true}';
  elsif p_action='campaign-save' then
    perform private.rr_actor(p_actor,'business');
    select * into b from public.businesses where owner_id=p_actor; if not found then raise exception 'Save your business details first'; end if;
    if (p_input->>'quantity')::integer not between 1 and s.max_campaign_quantity then raise exception 'Choose a supported quantity'; end if;
    if p_input->>'action' not in ('follow','comment') then raise exception 'Choose a task type'; end if;
    v_id:=coalesce(nullif(p_input->>'id','')::uuid,gen_random_uuid());
    select * into c from public.rr_campaigns where id=v_id for update;
    if found and (c.owner_id<>p_actor or c.status<>'draft') then raise exception 'Only your unpublished drafts can be edited'; end if;
    insert into public.rr_campaigns(id,business_id,owner_id,title,action,target_url,instructions,quantity,ends_at)
      values(v_id,b.id,p_actor,trim(p_input->>'title'),p_input->>'action',left(coalesce(p_input->>'target_url',''),500),coalesce(p_input->>'instructions',''),(p_input->>'quantity')::integer,nullif(p_input->>'ends_at','')::timestamptz)
      on conflict(id) do update set title=excluded.title,action=excluded.action,target_url=excluded.target_url,instructions=excluded.instructions,quantity=excluded.quantity,ends_at=excluded.ends_at,updated_at=now();
    return jsonb_build_object('id',v_id);
  elsif p_action='campaign-publish' then
    perform private.rr_actor(p_actor,'business');
    -- Same owner gate as discrepancy insertion, before campaign/ledger locks.
    perform private.rr_spend_guard(p_actor);
    select * into c from public.rr_campaigns where id=(p_input->>'id')::uuid and owner_id=p_actor for update;
    if not found then raise exception 'Campaign unavailable'; end if;
    if c.status='live' then return jsonb_build_object('id',c.id); end if;
    if c.status<>'draft' then raise exception 'This campaign is already published'; end if;
    if not s.approved or s.terms_version<>p_input->>'terms_version' then raise exception 'Pricing changed. Review the current quote'; end if;
    if c.ends_at is not null and c.ends_at<=now()+interval '1 hour' then raise exception 'Choose an end date at least one hour away'; end if;
    select * into ig from public.rr_instagram_accounts where user_id=p_actor and status='verified';
    if not found or ig.instagram_id<>p_input->>'target_id' then raise exception 'Verify the Instagram account you are promoting'; end if;
    amount:=case c.action when 'follow' then s.follow_reward_kobo else s.comment_reward_kobo end;
    fee:=case c.action when 'follow' then s.follow_fee_kobo else s.comment_fee_kobo end;
    if c.updated_at is distinct from (p_input->>'expected_updated_at')::timestamptz or (amount+fee)*c.quantity is distinct from (p_input->>'expected_total_kobo')::bigint
       or not exists(select 1 from public.rr_quotes where campaign_id=c.id and owner_id=p_actor and campaign_updated_at=c.updated_at and terms_version=s.terms_version and total_kobo=(amount+fee)*c.quantity and expires_at>now()) then
      raise exception 'Your campaign or quote changed. Review it again before publishing';
    end if;
    if amount<=0 then raise exception 'Campaign prices are not available yet'; end if;
    if c.action='comment' and nullif(p_input->>'media_id','') is null then raise exception 'Select a post owned by your Instagram account'; end if;
    available:=private.rr_account(p_actor,'available',p_actor); reserve:=private.rr_account(p_actor,'campaign',c.id);
    perform private.rr_move('publish:'||c.id,'reserve','Campaign budget reserved',available,reserve,(amount+fee)*c.quantity);
    update public.rr_instagram_accounts set username=coalesce(p_input->>'target_username',username) where id=ig.id;
    update public.rr_campaigns set status='live',target_id=ig.instagram_id,target_username=coalesce(p_input->>'target_username',ig.username),media_id=p_input->>'media_id',target_url=p_input->>'target_url',
      unit_reward_kobo=amount,unit_fee_kobo=fee,reserved_kobo=(amount+fee)*quantity,remaining_count=quantity,retention_hours=s.retention_hours,claim_minutes=s.claim_minutes,terms_version=s.terms_version,updated_at=now() where id=c.id;
    perform private.rr_notice(p_actor,'Your campaign is live',c.title||' is now available to eligible workers.','/business/campaigns/'||c.id);
    return jsonb_build_object('id',c.id);
  elsif p_action='campaign-state' then
    if p_input->>'state'='live' then perform private.rr_spend_guard(p_actor); end if;
    select * into c from public.rr_campaigns where id=(p_input->>'id')::uuid and owner_id=p_actor for update;
    if not found then raise exception 'Campaign unavailable'; end if;
    v_state:=p_input->>'state';
    if v_state=c.status then return jsonb_build_object('id',c.id); end if;
    if v_state='paused' and c.status='live' then update public.rr_campaigns set status='paused',updated_at=now() where id=c.id;
    elsif v_state='live' and c.status='paused' then
      if c.ends_at is not null and c.ends_at<=now() then raise exception 'This campaign has ended'; end if;
      update public.rr_campaigns set status='live',updated_at=now() where id=c.id;
    elsif v_state='cancelled' and c.status in ('draft','live','paused') then
      amount:=c.remaining_count*(c.unit_reward_kobo+c.unit_fee_kobo);
      if amount>0 then perform private.rr_move('close:'||c.id,'release','Unused campaign budget returned',private.rr_account(p_actor,'campaign',c.id),private.rr_account(p_actor,'available',p_actor),amount); end if;
      update public.rr_campaigns set status=case when active_count>0 then 'closing' else 'cancelled' end,reserved_kobo=reserved_kobo-amount,remaining_count=0,updated_at=now() where id=c.id;
    else raise exception 'This campaign cannot make that change'; end if;
    return jsonb_build_object('id',c.id);
  elsif p_action='task-claim' then
    perform private.rr_actor(p_actor,'worker');
    -- Serialize this worker's claims as well as each campaign's last available place.
    perform 1 from public.profiles where id=p_actor for update;
    select * into a from public.rr_assignments where campaign_id=(p_input->>'id')::uuid and worker_id=p_actor;
    if found then return jsonb_build_object('id',a.id); end if;
    -- A short global admission lock prevents simultaneous claimers exceeding
    -- the launch queue bound. Existing claims remain resumable at capacity.
    perform pg_advisory_xact_lock(182951,1);
    if (select count(*) from public.rr_jobs where assignment_id is not null and (state='running' or (state='queued' and (phase<>'retention' or scan_started_at is not null or due_at<=now())))) >= (select claim_queue_limit from public.rr_operational_limits where singleton) then raise exception 'Task checks are busy right now. Please try accepting this task again shortly'; end if;
    if (select count(*) from public.rr_assignments where worker_id=p_actor and status in ('reserved','checking'))>=3 then raise exception 'Finish an active task before accepting another'; end if;
    select * into ig from public.rr_instagram_accounts where user_id=p_actor and status='verified';
    if not found then raise exception 'Verify your Instagram account first'; end if;
    select * into c from public.rr_campaigns where id=(p_input->>'id')::uuid;
    if not found then raise exception 'This task is no longer available'; end if;
    perform private.rr_spend_guard(c.owner_id);
    select * into c from public.rr_campaigns where id=c.id for update;
    if not found or c.status<>'live' or c.remaining_count<=0 or c.owner_id=p_actor or c.target_id=ig.instagram_id or (c.ends_at is not null and c.ends_at<=now()) then raise exception 'This task is no longer available'; end if;
    if exists(select 1 from public.rr_assignments aa where (aa.instagram_id=ig.instagram_id or aa.worker_id=p_actor) and aa.target_key=c.action||':'||coalesce(c.media_id,c.target_id) and aa.status in ('reserved','checking','pending','settled','needs_review','ineligible')) then raise exception 'You already participated in a task for this account or post'; end if;
    insert into public.rr_assignments(campaign_id,worker_id,instagram_id,target_key,reward_kobo,fee_kobo) values(c.id,p_actor,ig.instagram_id,c.action||':'||coalesce(c.media_id,c.target_id),c.unit_reward_kobo,c.unit_fee_kobo) returning id into v_id;
    update public.rr_campaigns set remaining_count=remaining_count-1,active_count=active_count+1,updated_at=now() where id=c.id;
    insert into public.rr_jobs(assignment_id,phase) values(v_id,'baseline');
    return jsonb_build_object('id',v_id);
  elsif p_action='task-check' then
    select * into a from public.rr_assignments where id=(p_input->>'id')::uuid and worker_id=p_actor for update;
    if not found then raise exception 'Task unavailable'; end if;
    if a.status in ('checking','pending','settled') then return jsonb_build_object('id',a.id); end if;
    if a.status<>'reserved' or a.phase<>'completion' or a.expires_at<=now() then raise exception 'This task is not ready for submission'; end if;
    select * into c from public.rr_campaigns where id=a.campaign_id;
    if c.action='comment' and (p_input->>'comment_text' is null or length(trim(p_input->>'comment_text')) not between 5 and 1000) then raise exception 'Paste the exact comment you posted, between 5 and 1000 characters'; end if;
    update public.rr_assignments set status='checking',submitted_at=now(),comment_text=left(nullif(trim(p_input->>'comment_text'),''),1000) where id=a.id;
    insert into public.rr_jobs(assignment_id,phase) values(a.id,'completion') on conflict do nothing;
    return jsonb_build_object('id',a.id);
  elsif p_action='task-cancel' then
    select * into a from public.rr_assignments where id=(p_input->>'id')::uuid and worker_id=p_actor for update;
    if not found then raise exception 'Task unavailable'; end if;
    if a.status='cancelled' then return jsonb_build_object('id',a.id); end if;
    if a.status<>'reserved' then raise exception 'This task cannot be cancelled while checking'; end if;
    perform private.rr_release_assignment(a.id,'cancelled','You cancelled this task');
    return jsonb_build_object('id',a.id);
  elsif p_action='notification-read' then
    update public.rr_notifications set read_at=coalesce(read_at,now()) where owner_id=p_actor and id=(p_input->>'id')::uuid;
    return '{"ok":true}';
  elsif p_action='case-create' then
    if (select count(*) from public.rr_cases where owner_id=p_actor and created_at>now()-interval '1 day')>=5 then raise exception 'Your recent requests are with support. Please wait for a reply'; end if;
    insert into public.rr_cases(owner_id,subject,message,reference) values(p_actor,p_input->>'subject',p_input->>'message',left(nullif(p_input->>'reference',''),120)) returning id into v_id;
    return jsonb_build_object('id',v_id);
  elsif p_action in ('payment-create','withdraw') then
    perform private.rr_actor(p_actor,case when p_action='withdraw' then 'worker' else 'business' end);
    select * into p from public.rr_payments where owner_id=p_actor and direction=case when p_action='withdraw' then 'payout' else 'collection' end and idempotency_key=p_input->>'idempotency_key';
    if found then
      if p.amount_kobo<>(p_input->>'amount_kobo')::bigint then raise exception 'This request key was already used for another amount'; end if;
      if p_action='withdraw' and p.beneficiary_id is distinct from (p_input->>'beneficiary_id')::uuid then raise exception 'This request key was already used for another bank account'; end if;
      return to_jsonb(p);
    end if;
    if p_action='withdraw' then perform private.rr_spend_guard(p_actor); end if;
    perform 1 from public.profiles where id=p_actor for update;
    amount:=(p_input->>'amount_kobo')::bigint;
    if p_action='withdraw' then
      if (p_input->>'expected_fee_kobo')::bigint is distinct from s.withdrawal_fee_kobo or p_input->>'terms_version' is distinct from s.terms_version then raise exception 'Withdrawal terms changed. Review the current fee before continuing'; end if;
      if s.payouts_paused then raise exception 'Withdrawals are temporarily unavailable'; end if;
      if amount<s.minimum_withdrawal_kobo then raise exception 'This amount is below the withdrawal minimum'; end if;
      if not exists(select 1 from public.rr_beneficiaries where id=(p_input->>'beneficiary_id')::uuid and owner_id=p_actor) then raise exception 'Verify your bank account first'; end if;
    end if;
    v_id:=gen_random_uuid();
    insert into public.rr_payments(id,owner_id,direction,reference,idempotency_key,amount_kobo,fee_kobo,beneficiary_id)
      values(v_id,p_actor,case when p_action='withdraw' then 'payout' else 'collection' end,'RR-'||replace(v_id::text,'-',''),p_input->>'idempotency_key',amount,case when p_action='withdraw' then s.withdrawal_fee_kobo else 0 end,case when p_action='withdraw' then (p_input->>'beneficiary_id')::uuid end) returning * into p;
    if p_action='withdraw' then
      perform private.rr_move('withdraw-hold:'||p.id,'reserve','Withdrawal reserved',private.rr_account(p_actor,'available',p_actor),private.rr_account(p_actor,'withdrawal',p.id),amount+p.fee_kobo);
    end if;
    insert into public.rr_jobs(payment_id,phase,due_at) values(p.id,p.direction,now()+interval '1 minute');
    return to_jsonb(p);
  else raise exception 'Unknown marketplace command'; end if;
end $$;

create function private.rr_release_assignment(p_id uuid,p_status text,p_reason text) returns void language plpgsql set search_path='' as $$
declare a public.rr_assignments; c public.rr_campaigns; amount bigint; begin
 select * into a from public.rr_assignments where id=p_id for update;
 if a.status not in ('reserved','checking','pending','needs_review') then return; end if;
 select * into c from public.rr_campaigns where id=a.campaign_id for update;
 amount:=a.reward_kobo+a.fee_kobo;
 if c.status in ('closing','cancelled') then
   perform private.rr_move('release-task:'||a.id,'release','Unused task allocation returned',private.rr_account(c.owner_id,'campaign',c.id),private.rr_account(c.owner_id,'available',c.owner_id),amount);
 end if;
 update public.rr_campaigns set active_count=active_count-1,remaining_count=remaining_count+case when status in ('live','paused') then 1 else 0 end,
   reserved_kobo=reserved_kobo-case when status in ('closing','cancelled') then amount else 0 end,
   status=case when status='closing' and active_count=1 then 'cancelled' else status end,updated_at=now() where id=c.id;
 update public.rr_assignments set status=p_status,phase='finished',reason=p_reason where id=a.id;
 -- Do not lock jobs after the assignment: workers lock job -> assignment.
 -- A remaining queued/running job sees this terminal assignment and retires
 -- itself without another provider request, avoiding a cancellation deadlock.
 perform private.rr_notice(a.worker_id,'Task updated',p_reason,'/earn/assignments/'||a.id);
end $$;

create function public.rr_market_lease(p_limit integer default 20) returns setof public.rr_jobs language plpgsql set search_path='' as $$
declare a record; c record; begin
 delete from public.rr_quotes where expires_at<now()-interval '1 day';
 delete from public.rr_rate_limits where window_at<now()-interval '1 day';
 for a in select id from public.rr_assignments where status='reserved' and expires_at<now() order by id for update skip locked limit 100 loop
   perform private.rr_release_assignment(a.id,'expired','The time to complete this task ended');
 end loop;
 for c in select id,owner_id from public.rr_campaigns where status in ('live','paused') and ends_at<now() order by id for update skip locked limit 30 loop
   perform public.rr_market_command(c.owner_id,'campaign-state',jsonb_build_object('id',c.id,'state','cancelled'));
 end loop;
 return query with due as (
   select id from public.rr_jobs where (state='queued' and due_at<=now()) or (state='running' and lease_until<now()) order by due_at for update skip locked limit greatest(1,least(p_limit,30))
 ) update public.rr_jobs j set state='running',lease_id=gen_random_uuid(),lease_until=now()+interval '3 minutes',attempts=attempts+1,scan_started_at=case when assignment_id is not null then coalesce(scan_started_at,now()) else scan_started_at end from due where j.id=due.id returning j.*;
end $$;

create function public.rr_market_finish_check(p_job uuid,p_lease uuid,p_result text,p_reason text,p_comment_id text default null) returns void language plpgsql set search_path='' as $$
declare j public.rr_jobs; a public.rr_assignments; c public.rr_campaigns; evidence uuid; reserve uuid; entries jsonb; begin
 select * into j from public.rr_jobs where id=p_job and state='running' and lease_id=p_lease and lease_until>now() for update;
 if not found then return; end if;
 select * into a from public.rr_assignments where id=j.assignment_id for update;
 select * into c from public.rr_campaigns where id=a.campaign_id for update;
 if a.phase<>j.phase or a.status not in ('reserved','checking','pending','needs_review') then update public.rr_jobs set state='done' where id=j.id; return; end if;
 insert into public.rr_evidence(assignment_id,phase,result,actor_id,target_id,comment_id,reason) values(a.id,j.phase,p_result,a.instagram_id,coalesce(c.media_id,c.target_id),p_comment_id,left(p_reason,300)) returning id into evidence;
 if p_result='unknown' then
   update public.rr_jobs set state=case when attempts>=8 then 'attention' else 'queued' end,due_at=now()+make_interval(secs=>least(3600,30*power(2,least(attempts,7))::integer)),lease_id=null,lease_until=null,reason=left(p_reason,300) where id=j.id;
   if j.attempts>=8 then
     update public.rr_assignments set status='needs_review',reason='Instagram has not returned a clear result. Your task is with support.' where id=a.id;
     perform private.rr_notice(a.worker_id,'We are checking your task','Your place and reward allocation are protected while we investigate.','/earn/assignments/'||a.id);
   end if;
   return;
 end if;
 update public.rr_jobs set state='done',lease_id=null,lease_until=null,reason=left(p_reason,300) where id=j.id;
 if j.phase='baseline' then
   if p_result='verified' then perform private.rr_release_assignment(a.id,'ineligible','This action was already present before you accepted the task');
   else update public.rr_assignments set status='reserved',phase='completion',expires_at=now()+make_interval(mins=>c.claim_minutes),reason=null where id=a.id; end if;
 elsif j.phase='completion' then
   if p_result='verified' then
     if c.action='comment' and p_comment_id is null then raise exception 'Comment evidence requires a stable comment ID'; end if;
     update public.rr_assignments set status='pending',phase='retention',hold_until=now()+make_interval(hours=>c.retention_hours),comment_id=p_comment_id,evidence_id=evidence,reason=null where id=a.id;
     insert into public.rr_jobs(assignment_id,phase,due_at) values(a.id,'retention',now()+make_interval(hours=>c.retention_hours)) on conflict do nothing;
     perform private.rr_notice(a.worker_id,'Your work has been found','Keep it in place until the final check.','/earn/assignments/'||a.id);
   elsif a.expires_at>now() then update public.rr_assignments set status='reserved',reason='We could not find the action yet. Check Instagram and try again.' where id=a.id;
   else perform private.rr_release_assignment(a.id,'rejected','The action was not found before this task expired'); end if;
 elsif j.phase='retention' then
   if p_result='verified' then
     if a.hold_until>now() then raise exception 'Final check is not due'; end if;
     if c.action='comment' and (a.comment_id is null or p_comment_id is distinct from a.comment_id) then raise exception 'Final check must match the original comment'; end if;
     reserve:=private.rr_account(c.owner_id,'campaign',c.id);
     entries:=jsonb_build_array(jsonb_build_object('account',reserve,'amount',-(a.reward_kobo+a.fee_kobo)),jsonb_build_object('account',private.rr_account(a.worker_id,'available',a.worker_id),'amount',a.reward_kobo));
     if a.fee_kobo>0 then entries:=entries||jsonb_build_array(jsonb_build_object('account',private.rr_account(null,'fees','00000000-0000-0000-0000-000000000001'),'amount',a.fee_kobo)); end if;
     perform private.rr_post('settle:'||a.id,'reward','Instagram task completed',entries);
     update public.rr_assignments set status='settled',phase='finished',settled_at=now(),evidence_id=evidence,reason=null where id=a.id;
     update public.rr_campaigns set active_count=active_count-1,delivered_count=delivered_count+1,reserved_kobo=reserved_kobo-a.reward_kobo-a.fee_kobo,spent_kobo=spent_kobo+a.reward_kobo+a.fee_kobo,
       status=case when active_count=1 and remaining_count=0 then case when status='closing' then 'cancelled' else 'completed' end else status end,updated_at=now() where id=c.id;
     perform private.rr_notice(a.worker_id,'Your reward is available',c.title||' passed its final check.','/earn/wallet');
   else perform private.rr_release_assignment(a.id,'rejected','The action was no longer present at the final check'); end if;
 end if;
end $$;

-- Only verified provider results reach this operation. References, amounts and
-- currency are checked again here; duplicate callbacks cannot mint another credit.
-- Caller holds the owner spend gate and payment row lock. A discrepancy may
-- precede confirmation; apply its quarantine in the same commit as settlement.
create function private.rr_apply_payment_hold(p_id uuid) returns void language plpgsql set search_path='' as $$
declare p public.rr_payments; e public.rr_payment_events; begin
 select * into p from public.rr_payments where id=p_id;
 if p.status<>'succeeded' then return; end if;
 select * into e from public.rr_payment_events where payment_id=p.id order by created_at,event_hash limit 1;
 if not found then return; end if;
 insert into public.rr_payment_risk_holds(payment_id,owner_id,event_hash,reason) values(p.id,p.owner_id,e.event_hash,e.reason) on conflict(payment_id) do nothing;
 if found then
   perform private.rr_notice(p.owner_id,'A payment needs review','New spending is paused while we check a payment. Existing task records and payments are kept. Contact support for help.',case when p.direction='collection' then '/business/wallet' else '/earn/wallet' end);
   insert into public.rr_audit(action,reference,details) values('payment-risk-hold',p.id::text,jsonb_build_object('event_hash',e.event_hash,'owner_id',p.owner_id));
   if not exists(select 1 from public.rr_cases where reference=p.id::text and status<>'resolved') then
     insert into public.rr_cases(owner_id,subject,message,reference) values(p.owner_id,'Payment needs reconciliation',e.reason,p.id::text);
   end if;
 end if;
end $$;
create function public.rr_market_finish_payment(p_id uuid,p_state text,p_reference text,p_amount bigint,p_currency text,p_provider_id text default null) returns void language plpgsql set search_path='' as $$
declare p public.rr_payments; owner uuid; source uuid; target uuid; entries jsonb; begin
 select owner_id into owner from public.rr_payments where id=p_id;
 if not found then raise exception 'Payment unavailable'; end if;
 perform private.rr_spend_lock(owner);
 select * into p from public.rr_payments where id=p_id for update;
 if not found then raise exception 'Payment unavailable'; end if;
 if p.reference<>p_reference or p.amount_kobo<>p_amount or p.currency<>p_currency then raise exception 'Payment details did not match'; end if;
 if p_provider_id is null or p.provider_id is null or p.provider_id<>p_provider_id then raise exception 'Provider payment reference did not match'; end if;
 if p_state not in ('pending','unknown','succeeded','failed') then raise exception 'Invalid payment state'; end if;
 if p.status in ('succeeded','failed') then
   -- A delayed pending/unknown poll is normal request reordering, not evidence
   -- of reversal. Only a conflicting definitive terminal result is a dispute.
   if p_state in ('succeeded','failed') and p.status<>p_state then
     perform public.rr_market_payment_discrepancy(p.id,encode(sha256(convert_to('confirmation-v1:'||p.id||':'||p.provider_id||':'||p.status||':'||p_state,'UTF8')),'hex'),'Provider confirmation conflicts with recorded '||p.status||' payment: '||p_state);
   end if;
   perform private.rr_apply_payment_hold(p.id);
   return;
 end if;
 if p_state='succeeded' then
   if p.direction='collection' then
     perform private.rr_move('deposit:'||p.id,'deposit','Business funds added',private.rr_account(null,'external','00000000-0000-0000-0000-000000000002'),private.rr_account(p.owner_id,'available',p.owner_id),p.amount_kobo);
   else
     source:=private.rr_account(p.owner_id,'withdrawal',p.id);
     entries:=jsonb_build_array(jsonb_build_object('account',source,'amount',-(p.amount_kobo+p.fee_kobo)),jsonb_build_object('account',private.rr_account(null,'external','00000000-0000-0000-0000-000000000002'),'amount',p.amount_kobo));
     if p.fee_kobo>0 then entries:=entries||jsonb_build_array(jsonb_build_object('account',private.rr_account(null,'fees','00000000-0000-0000-0000-000000000001'),'amount',p.fee_kobo)); end if;
     perform private.rr_post('payout:'||p.id,'withdrawal','Bank withdrawal completed',entries);
     if coalesce(p.provider_fee_kobo,0)>0 then
       perform private.rr_move('provider-fee:'||p.id,'fee','Payment provider expense',private.rr_account(null,'provider_expense','00000000-0000-0000-0000-000000000003'),private.rr_account(null,'external','00000000-0000-0000-0000-000000000002'),p.provider_fee_kobo);
     end if;
   end if;
   perform private.rr_notice(p.owner_id,case when p.direction='collection' then 'Funds added' else 'Withdrawal completed' end,'Open your wallet for the payment receipt.',case when p.direction='collection' then '/business/wallet' else '/earn/wallet' end);
 elsif p_state='failed' and p.direction='payout' then
   perform private.rr_move('payout-return:'||p.id,'refund','Failed withdrawal returned',private.rr_account(p.owner_id,'withdrawal',p.id),private.rr_account(p.owner_id,'available',p.owner_id),p.amount_kobo+p.fee_kobo);
 end if;
 update public.rr_payments set status=p_state,provider_id=coalesce(p_provider_id,provider_id),checked_at=now() where id=p.id;
 perform private.rr_apply_payment_hold(p.id);
 update public.rr_jobs set state=case when p_state in ('succeeded','failed') then 'done' when attempts>=12 then 'attention' else 'queued' end,
   due_at=now()+interval '5 minutes',lease_id=null,lease_until=null,reason=case when p_state='unknown' then 'Provider outcome not yet confirmed' end where payment_id=p.id and state in ('queued','running');
end $$;

create function public.rr_market_admin(p_actor uuid,p_action text,p_input jsonb) returns jsonb language plpgsql set search_path='' as $$
declare v_id uuid; a public.rr_assignments; c public.rr_campaigns; closure public.rr_assignment_closures; explanation text; begin
 if not exists(select 1 from public.sole_admin where user_id=p_actor) then raise exception 'Administration is restricted'; end if;
 -- Edge additionally verifies a real AAL2 JWT. This function is service-only.
 if p_action='admin-settings' then
   update public.rr_settings set approved=(p_input->>'approved')::boolean,
     follow_reward_kobo=(p_input->>'follow_reward_kobo')::bigint,follow_fee_kobo=(p_input->>'follow_fee_kobo')::bigint,
     comment_reward_kobo=(p_input->>'comment_reward_kobo')::bigint,comment_fee_kobo=(p_input->>'comment_fee_kobo')::bigint,
     retention_hours=(p_input->>'retention_hours')::integer,claim_minutes=(p_input->>'claim_minutes')::integer,
     minimum_withdrawal_kobo=(p_input->>'minimum_withdrawal_kobo')::bigint,withdrawal_fee_kobo=(p_input->>'withdrawal_fee_kobo')::bigint,
     max_campaign_quantity=(p_input->>'max_campaign_quantity')::integer,payouts_paused=(p_input->>'payouts_paused')::boolean,
     terms_version='rr-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS'),updated_at=now() where singleton;
   if exists(select 1 from public.rr_settings where approved and (follow_reward_kobo<=0 or comment_reward_kobo<=0)) then raise exception 'Set both rewards before approving prices'; end if;
 elsif p_action='admin-case' then
   if p_input->>'status' not in ('open','in_review','resolved') then raise exception 'Choose a case status'; end if;
   if p_input->>'status'='resolved' and length(trim(coalesce(p_input->>'resolution','')))<5 then raise exception 'Explain the resolution'; end if;
   update public.rr_cases set status=p_input->>'status',resolution=left(p_input->>'resolution',3000),updated_at=now() where id=(p_input->>'id')::uuid returning owner_id into v_id;
   if not found then raise exception 'Case unavailable'; end if;
   perform private.rr_notice(v_id,'Support request updated',coalesce(nullif(p_input->>'resolution',''),'We are reviewing your request.'),'/support');
 elsif p_action='admin-retry' then
   update public.rr_jobs set state='queued',attempts=0,due_at=now(),lease_id=null,lease_until=null,cursor=null,scan_started_at=null,scanned_pages=0,seen_cursors='{}' where id=(p_input->>'id')::uuid and state='attention' returning assignment_id into v_id;
   if not found then raise exception 'Only checks requiring attention can be retried'; end if;
   if v_id is not null then update public.rr_assignments set status=case phase when 'baseline' then 'reserved' when 'completion' then 'checking' when 'retention' then 'pending' else status end where id=v_id and status='needs_review'; end if;
 elsif p_action='admin-assignment-close' then
   explanation:=trim(coalesce(p_input->>'reason',''));
   if length(explanation) not between 10 and 1000 then raise exception 'Explain why this task is closing, using 10 to 1000 characters'; end if;
   v_id:=(p_input->>'id')::uuid;
   -- Every worker takes job -> assignment -> campaign locks. Lock all existing
   -- jobs first so retry/late provider replies cannot revive a closed task.
   perform 1 from public.rr_jobs where assignment_id=v_id order by id for update;
   select * into a from public.rr_assignments where id=v_id for update;
   if not found then raise exception 'Task unavailable'; end if;
   select * into closure from public.rr_assignment_closures where assignment_id=a.id;
   if found then return jsonb_build_object('id',a.id,'status',a.status,'closure',to_jsonb(closure)); end if;
   if a.status<>'needs_review' then raise exception 'Only unresolved tasks requiring review can be closed without payment'; end if;
   select * into c from public.rr_campaigns where id=a.campaign_id for update;
   insert into public.rr_assignment_closures(assignment_id,actor_id,worker_id,business_owner_id,reason,amount_kobo,release_destination)
     values(a.id,p_actor,a.worker_id,c.owner_id,explanation,a.reward_kobo+a.fee_kobo,case when c.status in ('closing','cancelled') then 'wallet' else 'campaign_budget' end) returning * into closure;
   perform private.rr_release_assignment(a.id,'cancelled','Support closed this task without payment: '||explanation);
   update public.rr_jobs set state='done',lease_id=null,lease_until=null,reason='Closed without payment by support' where assignment_id=a.id and state in ('queued','running','attention');
   perform private.rr_notice(c.owner_id,'Unresolved task closed',case when closure.release_destination='wallet' then 'The unused task budget was returned to your wallet. ' else 'The unused task place is available in your campaign again. ' end||explanation,'/business/campaigns/'||c.id);
   insert into public.rr_audit(actor_id,action,reference,details) values(p_actor,p_action,a.id::text,to_jsonb(closure));
   return jsonb_build_object('id',a.id,'status','cancelled','closure',to_jsonb(closure));
 else raise exception 'Unknown administrative command'; end if;
 insert into public.rr_audit(actor_id,action,reference,details) values(p_actor,p_action,p_input->>'id',case when p_action='admin-settings' then p_input else '{}'::jsonb end);
 return '{"ok":true}';
end $$;

create function public.rr_market_rate(p_actor uuid,p_action text,p_limit integer) returns boolean language plpgsql set search_path='' as $$
declare n integer; begin
 insert into public.rr_rate_limits(actor_id,action,window_at) values(p_actor,p_action,date_trunc('minute',now()))
 on conflict(actor_id,action,window_at) do update set hits=public.rr_rate_limits.hits+1 returning hits into n;
 return n<=greatest(1,least(p_limit,120));
end $$;
create function public.rr_market_dispatch(p_id uuid) returns boolean language plpgsql set search_path='' as $$
begin
 -- PocketFi does not document payout idempotency. Once marked dispatched, even
 -- a timeout must reconcile the same result; it must NEVER send another payout.
 update public.rr_payments set submitted_at=now(),status='pending' where id=p_id and submitted_at is null and status='created';
 return found;
end $$;
create function public.rr_market_bind_payment(p_id uuid,p_provider_id text,p_status text,p_checkout_url text default null,p_fee bigint default null) returns void language plpgsql set search_path='' as $$
declare p public.rr_payments; begin
 select * into p from public.rr_payments where id=p_id for update;
 if not found or p.submitted_at is null or nullif(p_provider_id,'') is null then raise exception 'Payment dispatch is unavailable'; end if;
 if p.provider_id is not null and p.provider_id<>p_provider_id then raise exception 'Payment already has another provider reference'; end if;
 if p_status not in ('pending','unknown') then raise exception 'A submission is not a payment confirmation'; end if;
 -- A customer refresh or callback can race the in-flight provider request.
 -- Binding the result must survive unknown/pending transitions and never erase
 -- a terminal reconciliation result or change an already-bound provider ID.
 update public.rr_payments set provider_id=p_provider_id,provider_fee_kobo=coalesce(p_fee,provider_fee_kobo),checkout_url=coalesce(p_checkout_url,checkout_url),
   status=case when status in ('succeeded','failed') then status else p_status end where id=p.id;
 if p.status not in ('succeeded','failed') then update public.rr_jobs set state='queued',due_at=now()+interval '30 seconds',reason=null,lease_id=null,lease_until=null where payment_id=p.id and state='attention'; end if;
end $$;

create function public.rr_market_scan_review(p_job uuid,p_lease uuid,p_reason text) returns void language plpgsql set search_path='' as $$
begin
 update public.rr_jobs set attempts=greatest(attempts,8) where id=p_job and state='running' and lease_id=p_lease and lease_until>now();
 if found then perform public.rr_market_finish_check(p_job,p_lease,'unknown',p_reason); end if;
end $$;
create function public.rr_market_defer(p_job uuid,p_lease uuid) returns void language sql set search_path='' as $$
 update public.rr_jobs set state='queued',due_at=now()+interval '10 seconds',lease_id=null,lease_until=null,attempts=greatest(attempts-1,0)
 where id=p_job and state='running' and lease_id=p_lease and lease_until>now();
$$;

create function public.rr_market_continue(p_job uuid,p_lease uuid,p_cursor text,p_pages integer,p_seen text[] default null) returns void language plpgsql set search_path='' as $$
declare j public.rr_jobs; visited text[]:=coalesce(p_seen,array[p_cursor]); begin
 select * into j from public.rr_jobs where id=p_job and state='running' and lease_id=p_lease and lease_until>now() for update;
 if not found then return; end if;
 if p_cursor is null or length(p_cursor)>2000 or p_cursor=any(j.seen_cursors) or p_pages not between 1 and 20
    or cardinality(visited) not between 1 and 20 or visited[cardinality(visited)] is distinct from p_cursor
    or exists(select 1 from unnest(visited) v where v is null or length(v)>2000 or v=any(j.seen_cursors))
    or cardinality(visited)<>(select count(distinct v) from unnest(visited) v)
    or j.scanned_pages+p_pages >= (select max_scan_pages from public.rr_operational_limits where singleton)
    or j.scan_started_at < now()-make_interval(mins=>(select max_scan_minutes from public.rr_operational_limits where singleton)) then
   perform public.rr_market_scan_review(j.id,j.lease_id,'Instagram pagination reached its safety limit. A fresh review is required');
   return;
 end if;
 update public.rr_jobs set cursor=p_cursor,scan_started_at=coalesce(scan_started_at,now()),scanned_pages=scanned_pages+p_pages,seen_cursors=seen_cursors||visited,state='queued',due_at=now()+interval '10 seconds',lease_id=null,lease_until=null,attempts=greatest(0,attempts-1),reason='Continuing the Instagram account check' where id=j.id;
end $$;
create function public.rr_market_payment_discrepancy(p_id uuid,p_event_hash text,p_reason text,p_expected_state text default null) returns void language plpgsql set search_path='' as $$
declare p public.rr_payments; owner uuid; begin
 select owner_id into owner from public.rr_payments where id=p_id;
 if not found then raise exception 'Payment unavailable'; end if;
 -- Gate before payment row locks; a committed quarantine wins against any
 -- new owner spending, while existing reservations retain their obligations.
 perform private.rr_spend_lock(owner);
 select * into p from public.rr_payments where id=p_id for update;
 if not found then raise exception 'Payment unavailable'; end if;
 if p_expected_state is not null and p_expected_state<>'failed' then raise exception 'Invalid expected provider state'; end if;
 insert into public.rr_payment_events(event_hash,payment_id,reason,expected_state) values(p_event_hash,p.id,left(p_reason,500),p_expected_state) on conflict do nothing;
 if found then
   insert into public.rr_audit(action,reference,details) values(case when p_expected_state='failed' and p.status<>'succeeded' then 'payment-provider-observation' else 'payment-discrepancy' end,p.id::text,jsonb_build_object('event_hash',p_event_hash,'reason',left(p_reason,500)));
   -- A normal failed checkout is not itself a financial dispute. Retain the
   -- observation so a later contradictory success cannot become spendable.
   if (p_expected_state is null or p.status='succeeded') and not exists(select 1 from public.rr_cases where reference=p.id::text and status<>'resolved') then
     insert into public.rr_cases(owner_id,subject,message,reference) values(p.owner_id,'Payment needs reconciliation',left(p_reason,500),p.id::text);
   end if;
 end if;
 -- Event replay must still inspect current state, not return before quarantine.
 perform private.rr_apply_payment_hold(p.id);
end $$;

create function public.rr_market_comment_ready(p_job uuid,p_lease uuid) returns void language plpgsql set search_path='' as $$
declare j public.rr_jobs; a public.rr_assignments; c public.rr_campaigns; begin
 select * into j from public.rr_jobs where id=p_job and phase='baseline' and state='running' and lease_id=p_lease and lease_until>now() for update;
 if not found then return; end if;
 select * into a from public.rr_assignments where id=j.assignment_id for update;
 select * into c from public.rr_campaigns where id=a.campaign_id;
 if c.action<>'comment' or a.status not in ('reserved','needs_review') or a.phase<>'baseline' then return; end if;
 -- Comments are checked by stable author ID and creation time after acceptance.
 -- Existing older comments are not a new deliverable, so no fabricated negative
 -- provider observation or full historical-post baseline scan is recorded.
 update public.rr_assignments set status='reserved',phase='completion',expires_at=now()+make_interval(mins=>c.claim_minutes),reason=null where id=a.id;
 update public.rr_jobs set state='done',reason='Public account checked; only a new comment qualifies',lease_id=null,lease_until=null where id=j.id;
end $$;
create function public.rr_market_totals(p_actor uuid) returns jsonb language sql set search_path='' as $$
 select jsonb_build_object(
   'earned_kobo',coalesce((select sum(reward_kobo) from public.rr_assignments where worker_id=p_actor and status='settled'),0),
   'pending_kobo',coalesce((select sum(reward_kobo) from public.rr_assignments where worker_id=p_actor and status in ('pending','needs_review') and hold_until is not null),0),
   'spent_kobo',coalesce((select sum(spent_kobo) from public.rr_campaigns where owner_id=p_actor),0),
   'metrics',jsonb_build_object(
      'active_assignments',(select count(*) from public.rr_assignments where worker_id=p_actor and status in ('reserved','checking','pending','needs_review')),
      'completed_assignments',(select count(*) from public.rr_assignments where worker_id=p_actor and status='settled'),
      'active_campaigns',(select count(*) from public.rr_campaigns where owner_id=p_actor and status in ('live','paused','closing')),
      'delivered_actions',coalesce((select sum(delivered_count) from public.rr_campaigns where owner_id=p_actor),0),
      'total_campaigns',(select count(*) from public.rr_campaigns where owner_id=p_actor)
   ),
   'pending_by_campaign',coalesce((select jsonb_object_agg(campaign_id,n) from (select a.campaign_id,count(*) n from public.rr_assignments a join public.rr_campaigns c on c.id=a.campaign_id where c.owner_id=p_actor and a.status='pending' group by a.campaign_id) counts),'{}'::jsonb)
 );
$$;
create function public.rr_market_feed(p_actor uuid,p_before timestamptz default null,p_before_id uuid default null,p_filter text default null,p_query text default null,p_limit integer default 51) returns setof public.rr_campaigns language sql set search_path='' as $$
 select c.* from public.rr_campaigns c join public.businesses b on b.id=c.business_id
 where c.status='live' and c.remaining_count>0 and c.owner_id<>p_actor and (c.ends_at is null or c.ends_at>now())
   and not exists(select 1 from public.rr_payment_risk_holds h where h.owner_id=c.owner_id)
   and not exists(select 1 from public.rr_assignments a where a.campaign_id=c.id and a.worker_id=p_actor)
   and not exists(select 1 from public.rr_assignments a where a.worker_id=p_actor and a.target_key=c.action||':'||coalesce(c.media_id,c.target_id) and a.status in ('reserved','checking','pending','settled','needs_review','ineligible'))
   and not exists(select 1 from public.rr_instagram_accounts ig where ig.user_id=p_actor and ig.instagram_id=c.target_id)
   and (p_before is null or (c.created_at,c.id)<(p_before,p_before_id))
   and (p_filter is null or p_filter='all' or c.action=p_filter)
   and (p_query is null or c.title ilike '%'||p_query||'%' or b.name ilike '%'||p_query||'%' or c.target_username ilike '%'||p_query||'%')
 order by c.created_at desc,c.id desc limit greatest(1,least(p_limit,101));
$$;
create function private.rr_session_authorized(p_actor uuid,p_session uuid) returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from auth.sessions where id=p_session and user_id=p_actor and (not_after is null or not_after>now()));
$$;
create function public.rr_market_session(p_actor uuid,p_session uuid) returns boolean language sql set search_path='' as $$select private.rr_session_authorized(p_actor,p_session);$$;
create function public.rr_market_health() returns jsonb language sql set search_path='' as $$
 select jsonb_build_object(
  'queued_checks',count(*) filter(where assignment_id is not null and state='queued'),
  'due_checks',count(*) filter(where assignment_id is not null and state='queued' and due_at<=now()),
  'running_checks',count(*) filter(where assignment_id is not null and state='running'),
  'attention_checks',count(*) filter(where assignment_id is not null and state='attention'),
  'oldest_due_at',min(due_at) filter(where state='queued' and due_at<=now()),
  'limits',(select to_jsonb(l)-'singleton' from public.rr_operational_limits l where singleton)
 ) from public.rr_jobs;
$$;

-- No PUBLIC default EXECUTE leak, including helper functions in private schema.
do $$ declare r record; begin
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname like 'rr_market_%') or (n.nspname='private' and p.proname like 'rr_%') loop
   execute format('revoke all on function %s from public,anon,authenticated',r.signature);
   execute format('grant execute on function %s to service_role',r.signature);
 end loop;
end $$;

create function private.dispatch_marketplace_jobs() returns void language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.rr_jobs where (state='queued' and due_at<=now()) or (state='running' and lease_until<now()))
    or exists(select 1 from public.rr_assignments where status='reserved' and expires_at<now())
    or exists(select 1 from public.rr_campaigns where status in ('live','paused') and ends_at<now()) then
   perform net.http_post(url:='https://jabwuawiqsusjrccapab.supabase.co/functions/v1/marketplace-jobs',
     headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='rr_instagram_job_token')),body:='{}'::jsonb,timeout_milliseconds:=60000);
 end if;
end $$;
revoke all on function private.dispatch_marketplace_jobs() from public,anon,authenticated,service_role;
select cron.schedule('realreach-marketplace','* * * * *','select private.dispatch_marketplace_jobs()');
