-- Passes 1–2. No payments, balances, or payable rewards exist in this pilot.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 80),
  city text not null default '' check (length(city) <= 80),
  preferred_front text not null default 'worker' check (preferred_front in ('worker','business')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update(display_name, city, preferred_front) on public.profiles to authenticated;
create policy profile_read on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profile_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create function private.new_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id) values (new.id);
  return new;
end $$;
revoke all on function private.new_profile() from public, anon, authenticated;
create trigger realreach_new_profile after insert on auth.users for each row execute function private.new_profile();
insert into public.profiles(id) select id from auth.users on conflict do nothing;

-- A singleton with RESTRICT preserves the assignment across deletion attempts.
-- No automatic promotion by email, OAuth claims, signup metadata or UI role.
create table public.sole_admin (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  assigned_at timestamptz not null default now()
);
alter table public.sole_admin enable row level security;
revoke all on public.sole_admin from anon, authenticated;
grant select on public.sole_admin to authenticated;
create policy admin_self on public.sole_admin for select to authenticated using (user_id = (select auth.uid()));
create function private.validate_admin() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op <> 'INSERT' then raise exception 'Admin assignment is immutable'; end if;
  if not exists(select 1 from auth.users where id = new.user_id and lower(email) = 'admin@realreach.com.ng' and email_confirmed_at is not null) then
    raise exception 'Verified designated admin account required';
  end if;
  return new;
end $$;
revoke all on function private.validate_admin() from public, anon, authenticated;
create trigger validate_sole_admin before insert or update or delete on public.sole_admin for each row execute function private.validate_admin();

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete restrict,
  name text not null check (length(trim(name)) between 2 and 100),
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);
alter table public.businesses enable row level security;
revoke all on public.businesses from anon, authenticated;
grant select on public.businesses to authenticated;
grant insert(owner_id, name), update(name) on public.businesses to authenticated;
create policy business_read on public.businesses for select to authenticated using (owner_id = (select auth.uid()));
create policy business_insert on public.businesses for insert to authenticated with check (owner_id = (select auth.uid()) and (select auth.jwt()->>'email') is not null);
create policy business_update on public.businesses for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create table public.instagram_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique,
  owner_id uuid not null,
  provider_profile_id text unique,
  provider_account_id text unique,
  username text,
  status text not null default 'not_connected' check (status in ('not_connected','connected','disconnected')),
  updated_at timestamptz not null default now(),
  foreign key (business_id,owner_id) references public.businesses(id,owner_id) on delete restrict
);
create index instagram_connection_owner on public.instagram_connections(owner_id);
alter table public.instagram_connections enable row level security;
revoke all on public.instagram_connections from anon, authenticated;
grant select(id,business_id,owner_id,username,status,updated_at) on public.instagram_connections to authenticated;
create policy connection_read on public.instagram_connections for select to authenticated using (owner_id = (select auth.uid()));

create table public.instagram_connect_attempts (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.instagram_connections(id),
  owner_id uuid not null references auth.users(id),
  state_hash text not null unique,
  expires_at timestamptz not null default now() + interval '15 minutes',
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index connect_attempt_owner on public.instagram_connect_attempts(owner_id,created_at);
create index connect_attempt_connection on public.instagram_connect_attempts(connection_id);
alter table public.instagram_connect_attempts enable row level security;
revoke all on public.instagram_connect_attempts from anon, authenticated;

create table public.pilot_invites (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.instagram_connections(id),
  token_hash text not null unique,
  uses integer not null default 0 check (uses between 0 and 10),
  expires_at timestamptz not null default now() + interval '7 days'
);
create index pilot_invite_connection on public.pilot_invites(connection_id);
alter table public.pilot_invites enable row level security;
revoke all on public.pilot_invites from anon, authenticated;

create table public.instagram_pilots (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.instagram_connections(id),
  business_id uuid not null references public.businesses(id),
  worker_id uuid not null references auth.users(id),
  owner_id uuid not null references auth.users(id),
  business_name text not null,
  instagram_username text not null,
  challenge text not null unique,
  sender_id text,
  status text not null default 'awaiting_identity' check (status in ('awaiting_identity','checking_baseline','ready','checking_action','holding','verified','not_eligible','not_retained','needs_review','expired')),
  reason text,
  hold_until timestamptz,
  expires_at timestamptz not null default now() + interval '15 minutes',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id,worker_id)
);
create index pilots_connection on public.instagram_pilots(connection_id);
create index pilots_worker on public.instagram_pilots(worker_id);
create index pilots_owner on public.instagram_pilots(owner_id);
alter table public.instagram_pilots enable row level security;
revoke all on public.instagram_pilots from anon, authenticated;
grant select(id,connection_id,business_id,worker_id,owner_id,business_name,instagram_username,challenge,status,reason,hold_until,expires_at,created_at,updated_at) on public.instagram_pilots to authenticated;
create policy pilot_participant on public.instagram_pilots for select to authenticated using (worker_id = (select auth.uid()) or owner_id = (select auth.uid()));

create table public.instagram_bindings (
  business_id uuid not null references public.businesses(id),
  sender_id text not null,
  worker_id uuid not null references auth.users(id),
  primary key (business_id,sender_id),
  unique (business_id,worker_id)
);
create index bindings_worker on public.instagram_bindings(worker_id);
alter table public.instagram_bindings enable row level security;
revoke all on public.instagram_bindings from anon, authenticated;

create table public.instagram_evidence (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null references public.instagram_pilots(id),
  phase text not null check (phase in ('baseline','action','retention')),
  result text not null check (result in ('positive','negative','unknown')),
  reason text,
  observed_at timestamptz not null default now()
);
create index evidence_pilot on public.instagram_evidence(pilot_id,observed_at);
alter table public.instagram_evidence enable row level security;
revoke all on public.instagram_evidence from anon, authenticated;
grant select on public.instagram_evidence to authenticated;
create policy evidence_participant on public.instagram_evidence for select to authenticated using (exists (select 1 from public.instagram_pilots p where p.id=pilot_id and (p.worker_id=(select auth.uid()) or p.owner_id=(select auth.uid()))));

create table public.instagram_events (
  id text primary key,
  event_type text not null,
  account_id text,
  received_at timestamptz not null default now()
);
alter table public.instagram_events enable row level security;
revoke all on public.instagram_events from anon, authenticated;

create table public.instagram_jobs (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null references public.instagram_pilots(id),
  phase text not null check (phase in ('baseline','action','retention')),
  state text not null default 'queued' check (state in ('queued','running','done','failed')),
  attempts integer not null default 0,
  due_at timestamptz not null default now(),
  lease_id uuid,
  lease_until timestamptz,
  unique(pilot_id,phase)
);
create index jobs_due on public.instagram_jobs(due_at) where state in ('queued','running');
alter table public.instagram_jobs enable row level security;
revoke all on public.instagram_jobs from anon, authenticated;

-- All command functions below are SECURITY INVOKER and service-role-only.
-- JWT/ownership checks run in the Edge API; caller UUIDs never come from request JSON.
create function public.rr_claim_pilot(p_actor uuid, p_hash text, p_challenge text) returns uuid language plpgsql set search_path = '' as $$
declare v public.pilot_invites; c public.instagram_connections; b public.businesses; found_id uuid;
begin
  select * into v from public.pilot_invites where token_hash=p_hash for update;
  if not found or v.expires_at < now() then raise exception 'Invitation expired or unavailable'; end if;
  select * into c from public.instagram_connections where id=v.connection_id;
  if c.status <> 'connected' then raise exception 'Business must reconnect Instagram'; end if;
  if c.owner_id=p_actor then raise exception 'Use a separate worker account for this pilot'; end if;
  select id into found_id from public.instagram_pilots where business_id=c.business_id and worker_id=p_actor;
  if found then return found_id; end if;
  if v.uses >= 10 then raise exception 'This pilot is full'; end if;
  select * into b from public.businesses where id=c.business_id;
  insert into public.instagram_pilots(connection_id,business_id,worker_id,owner_id,business_name,instagram_username,challenge)
    values(c.id,b.id,p_actor,c.owner_id,b.name,c.username,p_challenge) returning id into found_id;
  update public.pilot_invites set uses=uses+1 where id=v.id;
  return found_id;
end $$;

create function public.rr_ingest_instagram(p_event text,p_type text,p_account text,p_challenge text,p_sender text,p_occurred timestamptz) returns void language plpgsql set search_path = '' as $$
declare p public.instagram_pilots; c public.instagram_connections;
begin
  insert into public.instagram_events(id,event_type,account_id) values(p_event,p_type,p_account) on conflict do nothing;
  if not found then return; end if;
  if p_type='account.disconnected' then
    update public.instagram_connections set status='disconnected',updated_at=now() where provider_account_id=p_account;
    return;
  end if;
  if p_type <> 'message.received' or p_challenge is null or p_sender is null then return; end if;
  select * into c from public.instagram_connections where provider_account_id=p_account and status='connected';
  if not found then return; end if;
  select * into p from public.instagram_pilots where challenge=p_challenge and connection_id=c.id and status='awaiting_identity' for update;
  if not found then return; end if;
  if now()>p.expires_at or p_occurred<p.created_at or p_occurred>now()+interval '5 minutes' then
    update public.instagram_pilots set status='expired',reason='identity_window_expired',updated_at=now() where id=p.id;
    return;
  end if;
  begin
    insert into public.instagram_bindings(business_id,sender_id,worker_id) values(p.business_id,p_sender,p.worker_id);
  exception when unique_violation then
    if not exists(select 1 from public.instagram_bindings where business_id=p.business_id and sender_id=p_sender and worker_id=p.worker_id) then
      update public.instagram_pilots set status='needs_review',reason='identity_already_bound',updated_at=now() where id=p.id;
      return;
    end if;
  end;
  update public.instagram_pilots set sender_id=p_sender,status='checking_baseline',updated_at=now() where id=p.id;
  insert into public.instagram_jobs(pilot_id,phase) values(p.id,'baseline') on conflict do nothing;
end $$;

create function public.rr_request_check(p_actor uuid,p_pilot uuid) returns void language plpgsql set search_path = '' as $$
declare p public.instagram_pilots;
begin
  select * into p from public.instagram_pilots where id=p_pilot and worker_id=p_actor for update;
  if not found then raise exception 'Pilot unavailable'; end if;
  if p.status='checking_action' then return; end if;
  if p.status<>'ready' then raise exception 'Wait for the account check before continuing'; end if;
  if p.updated_at>now()-interval '15 seconds' then raise exception 'Please wait a moment before checking again'; end if;
  update public.instagram_pilots set status='checking_action',reason=null,updated_at=now() where id=p.id;
  insert into public.instagram_jobs(pilot_id,phase) values(p.id,'action') on conflict(pilot_id,phase) do update set state='queued',attempts=0,due_at=now(),lease_id=null,lease_until=null;
end $$;

create function public.rr_lease_jobs() returns setof public.instagram_jobs language sql set search_path = '' as $$
  update public.instagram_jobs set state='running', attempts=attempts+1,lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes'
  where id in(select id from public.instagram_jobs where (state='queued' and due_at<=now()) or (state='running' and lease_until<now()) order by due_at for update skip locked limit 5)
  returning *;
$$;

create function public.rr_finish_check(p_job uuid,p_lease uuid,p_result text,p_reason text) returns void language plpgsql set search_path = '' as $$
declare j public.instagram_jobs; p public.instagram_pilots; next_status text;
begin
  if p_result not in ('positive','negative','unknown') then raise exception 'Invalid observation'; end if;
  select * into j from public.instagram_jobs where id=p_job and lease_id=p_lease and state='running' and lease_until>now() for update;
  if not found then return; end if;
  select * into p from public.instagram_pilots where id=j.pilot_id for update;
  insert into public.instagram_evidence(pilot_id,phase,result,reason) values(p.id,j.phase,p_result,left(p_reason,160));
  if p_result='unknown' then
    update public.instagram_jobs set state=case when attempts>=5 then 'failed' else 'queued' end,due_at=now()+make_interval(secs=>least(3600,60*power(2,attempts)::integer)),lease_id=null,lease_until=null where id=j.id;
    update public.instagram_pilots set status=case when j.attempts>=5 then 'needs_review' else status end,reason=left(p_reason,160),updated_at=now() where id=p.id;
    return;
  end if;
  next_status := case j.phase when 'baseline' then case when p_result='positive' then 'not_eligible' else 'ready' end
    when 'action' then case when p_result='positive' then 'holding' else 'ready' end
    when 'retention' then case when p_result='positive' then 'verified' else 'not_retained' end end;
  update public.instagram_jobs set state='done',lease_id=null,lease_until=null where id=j.id;
  update public.instagram_pilots set status=next_status,reason=p_reason,updated_at=now(),hold_until=case when next_status='holding' then now()+interval '48 hours' else hold_until end where id=p.id;
  if next_status='holding' then insert into public.instagram_jobs(pilot_id,phase,due_at) values(p.id,'retention',now()+interval '48 hours') on conflict do nothing; end if;
end $$;

-- Explicit grants do not rely on project default privileges.
grant all on public.profiles,public.sole_admin,public.businesses,public.instagram_connections,public.instagram_connect_attempts,public.pilot_invites,public.instagram_pilots,public.instagram_bindings,public.instagram_evidence,public.instagram_events,public.instagram_jobs to service_role;
revoke all on function public.rr_claim_pilot(uuid,text,text),public.rr_ingest_instagram(text,text,text,text,text,timestamptz),public.rr_request_check(uuid,uuid),public.rr_lease_jobs(),public.rr_finish_check(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.rr_claim_pilot(uuid,text,text),public.rr_ingest_instagram(text,text,text,text,text,timestamptz),public.rr_request_check(uuid,uuid),public.rr_lease_jobs(),public.rr_finish_check(uuid,uuid,text,text) to service_role;
