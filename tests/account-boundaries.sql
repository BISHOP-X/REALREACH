-- Explicit, rollback-only database permission test against the deployed schema.
-- Runs statements AS authenticated, not as postgres. Does not mint Auth users.
-- Complements SDK/JWT tests; does not claim a browser or provider flow was tested.
begin;
create temporary table rr_test_actors(label text primary key,id uuid);
insert into rr_test_actors
select 'worker',p.id from public.profiles p join auth.users u on u.id=p.id
where p.account_type='worker' and u.email_confirmed_at is not null
and not exists(select 1 from public.sole_admin a where a.user_id=p.id) limit 1;
insert into rr_test_actors
select 'business',p.id from public.profiles p join auth.users u on u.id=p.id
where p.account_type is null and u.email_confirmed_at is not null
and not exists(select 1 from public.sole_admin a where a.user_id=p.id) limit 1;
do $$ begin if (select count(*) from rr_test_actors)<>2 then raise exception 'Need one existing worker and one unassigned confirmed non-admin for rollback tests'; end if; end $$;
grant select on rr_test_actors to authenticated;
set local role authenticated;
do $$
declare actor uuid; result text;
begin
  select id into actor from rr_test_actors where label='worker';
  perform set_config('request.jwt.claims',json_build_object('sub',actor,'role','authenticated','aal','aal1')::text,true);
  if (select count(*) from public.profiles)<>1 then raise exception 'Profile isolation failed'; end if;
  if exists(select 1 from public.sole_admin) then raise exception 'Admin identity leaked'; end if;
  begin
    update public.profiles set account_type='business' where id=actor;
    raise exception 'Direct role change was allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.rr_complete_onboarding('business','QA Worker','','QA Spoof');
    raise exception 'Role switch was allowed';
  exception when raise_exception then
    if sqlerrm not like 'Your account type is already set%' then raise; end if;
  end;
  begin
    insert into public.businesses(owner_id,name) values(actor,'QA Spoof');
    raise exception 'Worker created a business directly';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.sole_admin(user_id) values(actor);
    raise exception 'Worker promoted to admin';
  exception when insufficient_privilege then null; end;
end $$;
do $$
declare actor uuid; bid uuid; draft uuid;
begin
  select id into actor from rr_test_actors where label='business';
  perform set_config('request.jwt.claims',json_build_object('sub',actor,'role','authenticated','aal','aal1')::text,true);
  perform public.rr_complete_onboarding('business','QA Business Owner','Lagos','QA Rollback Business');
  perform public.rr_complete_onboarding('business','QA Business Owner','Lagos','QA Rollback Business');
  if (select count(*) from public.businesses)<>1 then raise exception 'Business onboarding not idempotent'; end if;
  select id into bid from public.businesses where owner_id=actor;
  insert into public.campaign_drafts(business_id,owner_id,title,quantity) values(bid,actor,'QA Rollback Campaign',100) returning id into draft;
  update public.campaign_drafts set quantity=250 where id=draft;
  if (select quantity from public.campaign_drafts where id=draft)<>250 then raise exception 'Own draft update failed'; end if;
  begin
    perform public.rr_complete_onboarding('worker','QA Business Owner','','');
    raise exception 'Business switched to worker';
  exception when raise_exception then
    if sqlerrm not like 'Your account type is already set%' then raise; end if;
  end;
  begin
    update public.campaign_drafts set owner_id=(select id from rr_test_actors where label='worker') where id=draft;
    raise exception 'Draft owner reassigned';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims',json_build_object('sub',(select id from rr_test_actors where label='worker'),'role','authenticated','aal','aal1')::text,true);
  if exists(select 1 from public.campaign_drafts) then raise exception 'Cross-owner draft leaked'; end if;
  update public.campaign_drafts set title='Hijacked' where id=draft;
  if found then raise exception 'Cross-owner draft update succeeded'; end if;
  begin
    insert into public.campaign_drafts(business_id,owner_id,title,quantity) values(bid,auth.uid(),'Forged campaign',1);
    raise exception 'Worker draft insert allowed';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
