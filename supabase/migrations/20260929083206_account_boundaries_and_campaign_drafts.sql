-- Real account types are assigned once during authenticated onboarding.
-- preferred_front and editable Auth metadata are never authorization inputs.
alter table public.profiles add column account_type text check (account_type in ('worker','business'));
update public.profiles p set account_type = case
  when exists(select 1 from public.businesses b where b.owner_id=p.id) then 'business'
  else 'worker' end
where p.display_name <> '' or exists(select 1 from public.businesses b where b.owner_id=p.id);
revoke update(preferred_front) on public.profiles from authenticated;
revoke insert(owner_id,name) on public.businesses from authenticated;
drop policy business_insert on public.businesses;

create function public.rr_complete_onboarding(p_type text,p_name text,p_city text default '',p_business_name text default '')
returns text language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); current_type text; is_admin boolean;
begin
  if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and not is_anonymous) then
    raise exception 'Please sign in with a confirmed account';
  end if;
  if p_type is null or p_type not in ('worker','business') then raise exception 'Choose an account type'; end if;
  if p_name is null or length(trim(p_name)) not between 2 and 80 or p_city is null or length(trim(p_city))>80 then raise exception 'Enter valid profile details'; end if;
  select account_type into current_type from public.profiles where id=actor for update;
  if not found then raise exception 'Account profile unavailable'; end if;
  select exists(select 1 from public.sole_admin where user_id=actor) into is_admin;
  if current_type is not null and current_type<>p_type and not is_admin then
    raise exception 'Your account type is already set. Contact support to change it';
  end if;
  if p_type='business' then
    if p_business_name is null or length(trim(p_business_name)) not between 2 and 100 then raise exception 'Enter your business name'; end if;
    insert into public.businesses(owner_id,name) values(actor,trim(p_business_name)) on conflict(owner_id) do nothing;
  end if;
  update public.profiles set account_type=coalesce(current_type,p_type),display_name=trim(p_name),city=trim(p_city),preferred_front=p_type where id=actor;
  return p_type;
end $$;
revoke all on function public.rr_complete_onboarding(text,text,text,text) from public,anon;
grant execute on function public.rr_complete_onboarding(text,text,text,text) to authenticated;

-- Campaign drafts are genuine saved business records, never simulated funding.
-- There is deliberately no browser path to publish, set a reward or credit money.
create table public.campaign_drafts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  owner_id uuid not null,
  title text not null check(length(trim(title)) between 3 and 100),
  action text not null default 'follow' check(action='follow'),
  quantity integer not null check(quantity between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(business_id,owner_id) references public.businesses(id,owner_id) on delete restrict
);
create index campaign_drafts_owner_created on public.campaign_drafts(owner_id,created_at desc);
alter table public.campaign_drafts enable row level security;
revoke all on public.campaign_drafts from anon,authenticated;
grant select on public.campaign_drafts to authenticated;
grant insert(business_id,owner_id,title,action,quantity),update(title,quantity) on public.campaign_drafts to authenticated;
create policy draft_read on public.campaign_drafts for select to authenticated using(owner_id=(select auth.uid()));
create policy draft_create on public.campaign_drafts for insert to authenticated with check(
  owner_id=(select auth.uid()) and exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid()))
  and (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type='business') or exists(select 1 from public.sole_admin where user_id=(select auth.uid())))
);
create policy draft_update on public.campaign_drafts for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create function private.touch_campaign_draft() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end $$;
revoke all on function private.touch_campaign_draft() from public,anon,authenticated;
create trigger touch_campaign_draft before update on public.campaign_drafts for each row execute function private.touch_campaign_draft();

-- Defense in depth for the existing service-only verification commands.
create function private.worker_assignment_only() returns trigger language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.profiles where id=new.worker_id and account_type='worker')
     and not exists(select 1 from public.sole_admin where user_id=new.worker_id) then
    raise exception 'A worker account is required';
  end if;
  return new;
end $$;
revoke all on function private.worker_assignment_only() from public,anon,authenticated;
create trigger worker_assignment_only before insert on public.instagram_pilots for each row execute function private.worker_assignment_only();
