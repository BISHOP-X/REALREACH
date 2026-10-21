-- Operations only: no mutation of money, allocations, evidence or risk holds.
-- Customer roles cannot access these tables or call these functions.
create table public.rr_ops_state (
 singleton boolean primary key default true check(singleton),
 snapshot jsonb, last_collected_at timestamptz, last_alert_created_at timestamptz,
 last_seen_at timestamptz, last_success_at timestamptz, last_failure_at timestamptz,
 processed integer not null default 0 check(processed>=0), last_error text,
 last_dispatch_at timestamptz, dispatch_error text
);
insert into public.rr_ops_state(singleton) values(true);
create table public.rr_ops_reconciliations (
 id uuid primary key default gen_random_uuid(), source text not null check(source in ('manual','scheduled')),
 checked_at timestamptz not null default now(), status text not null check(status in ('clean','discrepancy','failed')),
 findings jsonb, error text check(error is null or error='reconciliation_failed'),
 check((status='failed')=(findings is null))
);
create index rr_ops_reconciliation_latest on public.rr_ops_reconciliations(checked_at desc,id desc);
create table public.rr_ops_alerts (
 id uuid primary key default gen_random_uuid(), fingerprint text not null,
 idempotency_key text not null unique, payload jsonb not null, request_body jsonb,
 status text not null default 'queued' check(status in ('queued','sending','retry','accepted','failed','needs_review','superseded')),
 attempts integer not null default 0 check(attempts between 0 and 8),
 attempt_token uuid, lease_until timestamptz, first_attempt_at timestamptz,
 last_attempt_at timestamptz, retry_until timestamptz, next_attempt_at timestamptz not null default now(),
 provider_id text, last_outcome text check(last_outcome in ('accepted','retry','uncertain','failed')),
 error_code text check(error_code in ('rate_limited','provider_unavailable','transport_uncertain','request_rejected','configuration_error','lease_expired','retry_window_closed','attempt_limit')),
 created_at timestamptz not null default now(),
 check((first_attempt_at is null)=(retry_until is null)),
 check(retry_until is null or retry_until=first_attempt_at+interval '23 hours')
);
create index rr_ops_alert_due on public.rr_ops_alerts(next_attempt_at) where status in ('queued','retry','sending');
create index rr_ops_alert_latest on public.rr_ops_alerts(created_at desc,id desc);
create index rr_ops_unresolved_payments on public.rr_payments(created_at) where status in ('created','pending','unknown');
create index rr_ops_open_cases on public.rr_cases(created_at) where status in ('open','in_review');
create index rr_ops_attention_jobs on public.rr_jobs(assignment_id) where state='attention';

do $$ declare t text; begin
 foreach t in array array['rr_ops_state','rr_ops_reconciliations','rr_ops_alerts'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;

create function private.rr_ops_immutable_alert() returns trigger language plpgsql set search_path='' as $$
begin
 if new.id<>old.id or new.idempotency_key<>old.idempotency_key or new.payload<>old.payload
    or new.fingerprint<>old.fingerprint or new.created_at<>old.created_at
    or (old.request_body is not null and new.request_body is distinct from old.request_body)
    or (old.first_attempt_at is not null and (new.first_attempt_at is distinct from old.first_attempt_at or new.retry_until is distinct from old.retry_until)) then
  raise exception 'Alert identity, payload and retry window are immutable';
 end if;
 return new;
end $$;
create trigger rr_ops_alert_immutable before update on public.rr_ops_alerts for each row execute function private.rr_ops_immutable_alert();

create function public.rr_ops_heartbeat(p_ok boolean,p_processed integer default 0) returns void language plpgsql set search_path='' as $$
begin
 if p_ok is null or p_processed is null or p_processed not between 0 and 100000 then raise exception 'Invalid heartbeat'; end if;
 update public.rr_ops_state set last_seen_at=now(),processed=p_processed,
  last_success_at=case when p_ok then now() else last_success_at end,
  last_failure_at=case when not p_ok then now() else last_failure_at end,
  last_error=case when p_ok then null else 'Worker run did not complete' end where singleton;
end $$;

create function public.rr_ops_reconcile(p_source text default 'manual') returns jsonb language plpgsql set search_path='' as $$
declare f jsonb; r public.rr_ops_reconciliations; bad boolean;
begin
 if p_source not in ('manual','scheduled') or p_source is null then raise exception 'Invalid reconciliation source'; end if;
 -- Only serialize other reconciliations, never acquire any financial-row locks.
 -- Contention is explicit; never present an old report as a fresh manual scan.
 if not pg_try_advisory_xact_lock(728301,1) then
  return '{"busy":true}'::jsonb;
 end if;
 begin
  -- ALL financial comparisons below share this ONE statement's MVCC snapshot.
  -- Separate SELECTs under READ COMMITTED would report normal transitions as drift.
  with account_totals as materialized (
   select account_id,sum(amount_kobo) amount from public.rr_ledger_entries group by account_id
  ), journal_totals as materialized (
   select journal_id,sum(amount_kobo) amount,count(*) n from public.rr_ledger_entries group by journal_id
  ), assignment_totals as materialized (
   select campaign_id,
    coalesce(sum(reward_kobo+fee_kobo) filter(where status in ('reserved','checking','pending','needs_review')),0) held,
    count(*) filter(where status in ('reserved','checking','pending','needs_review')) active,
    count(*) filter(where status='settled') delivered,
    coalesce(sum(reward_kobo+fee_kobo) filter(where status='settled'),0) spent
   from public.rr_assignments group by campaign_id
  ), campaigns as (
   select c.*,coalesce(a.held,0)+c.remaining_count*(c.unit_reward_kobo+c.unit_fee_kobo) expected,
    coalesce(a.active,0) actual_active,coalesce(a.delivered,0) actual_delivered,coalesce(a.spent,0) actual_spent,
    coalesce(l.balance_kobo,0) ledger_balance
   from public.rr_campaigns c left join assignment_totals a on a.campaign_id=c.id
   left join public.rr_ledger_accounts l on l.bucket='campaign' and l.reference_id=c.id
  ), withdrawals as (
   select p.id,case when p.status in ('created','pending','unknown') then p.amount_kobo+p.fee_kobo else 0 end expected,
    coalesce(l.balance_kobo,0) actual
   from public.rr_payments p left join public.rr_ledger_accounts l on l.bucket='withdrawal' and l.reference_id=p.id
   where p.direction='payout'
  )
  select jsonb_build_object(
   'unbalanced_journals',(select count(*) from public.rr_journals j left join journal_totals t on t.journal_id=j.id where coalesce(t.amount,0)<>0 or coalesce(t.n,0)<2),
   'account_mismatches',(select count(*) from public.rr_ledger_accounts a left join account_totals t on t.account_id=a.id where a.balance_kobo<>coalesce(t.amount,0)),
   'campaign_mismatches',(select count(*) from campaigns where reserved_kobo<>expected or ledger_balance<>expected or active_count<>actual_active or delivered_count<>actual_delivered or spent_kobo<>actual_spent)
      +(select count(*) from public.rr_ledger_accounts l where l.bucket='campaign' and not exists(select 1 from public.rr_campaigns c where c.id=l.reference_id)),
   'withdrawal_mismatches',(select count(*) from withdrawals where expected<>actual)
      +(select count(*) from public.rr_ledger_accounts l where l.bucket='withdrawal' and not exists(select 1 from public.rr_payments p where p.id=l.reference_id and p.direction='payout'))
  ) into f;
  select exists(select 1 from jsonb_each_text(f) where value::bigint>0) into bad;
  insert into public.rr_ops_reconciliations(source,status,findings) values(p_source,case when bad then 'discrepancy' else 'clean' end,f) returning * into r;
 exception when query_canceled or others then
  insert into public.rr_ops_reconciliations(source,status,findings,error) values(p_source,'failed',null,'reconciliation_failed') returning * into r;
 end;
 return to_jsonb(r)-'source';
end $$;

create function public.rr_ops_collect() returns jsonb language plpgsql set search_path='' as $$
declare s public.rr_ops_state; r public.rr_ops_reconciliations; c jsonb; incidents jsonb; snap jsonb; fingerprint text; alert_id uuid;
begin
 select * into s from public.rr_ops_state where singleton for update;
 select * into r from public.rr_ops_reconciliations order by checked_at desc,id desc limit 1;
 -- Partial-index-backed operational counts. This does NOT scan ledger entries.
 select jsonb_build_object(
  'pending_payments',(select count(*) from public.rr_payments where status in ('created','pending','unknown')),
  'uncertain_payments',(select count(*) from public.rr_payments where status='unknown'),
  'stalled_payments',(select count(*) from public.rr_payments where status in ('created','pending','unknown') and coalesce(submitted_at,created_at)<now()-interval '30 minutes'),
  'missing_references',(select count(*) from public.rr_payments where status='unknown' and submitted_at is not null and provider_id is null),
  'pending_checks',(select count(*) from public.rr_jobs where assignment_id is not null and state in ('queued','running')),
  'review_checks',(select count(distinct assignment_id) from public.rr_jobs where assignment_id is not null and state='attention'),
  'overdue_checks',(select count(*) from public.rr_jobs where assignment_id is not null and state in ('queued','running') and due_at<now()-interval '15 minutes' and (state='queued' or lease_until<now())),
  'risk_holds',(select count(*) from public.rr_payment_risk_holds),
  'support_open',(select count(*) from public.rr_cases where status in ('open','in_review')),
  'support_overdue',(select count(*) from public.rr_cases where status in ('open','in_review') and created_at<now()-interval '24 hours')
 ) into c;
 select coalesce(jsonb_agg(jsonb_build_object('code',code,'severity',severity,'count',n) order by code),'[]') into incidents from (
  values
   ('payment_uncertain','warning',(c->>'uncertain_payments')::bigint),
   ('payment_stalled','warning',(c->>'stalled_payments')::bigint),
   ('payment_missing_reference','critical',(c->>'missing_references')::bigint),
   ('verification_review','warning',(c->>'review_checks')::bigint),
   ('verification_overdue','warning',(c->>'overdue_checks')::bigint),
   ('risk_hold','critical',(c->>'risk_holds')::bigint),
   ('support_waiting','warning',(c->>'support_overdue')::bigint),
   ('worker_stale','critical',case when (s.last_success_at is null or s.last_success_at<now()-interval '10 minutes') and exists(select 1 from public.rr_jobs where (state='queued' and due_at<=now()) or (state='running' and lease_until<now())) then 1::bigint else 0 end),
   ('reconciliation_discrepancy','critical',case when r.status='discrepancy' then 1::bigint else 0 end),
   ('reconciliation_failed','critical',case when r.status='failed' then 1::bigint else 0 end),
   ('reconciliation_stale','warning',case when r.id is null or r.checked_at<now()-interval '26 hours' then 1::bigint else 0 end)
 ) v(code,severity,n) where n>0;
 snap:=jsonb_build_object('collected_at',now(),'counts',c,'incidents',incidents);
 update public.rr_ops_state set snapshot=snap,last_collected_at=now() where singleton;
 -- A global six-hour throttle also limits changing counts/categories. Never
 -- rewrite an attempted email or resend it with a newly generated key.
 if jsonb_array_length(incidents)=0 then
  update public.rr_ops_alerts set status='superseded' where attempts=0 and status='queued';
 elsif s.last_alert_created_at is null or s.last_alert_created_at<=now()-interval '6 hours' then
  update public.rr_ops_alerts set status='superseded' where attempts=0 and status='queued';
  select md5(string_agg(x->>'code',',' order by x->>'code')) into fingerprint from jsonb_array_elements(incidents) x;
  alert_id:=gen_random_uuid();
  insert into public.rr_ops_alerts(id,fingerprint,idempotency_key,payload) values(alert_id,fingerprint,'rr-ops/'||alert_id,snap);
  update public.rr_ops_state set last_alert_created_at=now() where singleton;
 end if;
 return snap;
end $$;

create function public.rr_ops_lease() returns jsonb language plpgsql set search_path='' as $$
declare a public.rr_ops_alerts;
begin
 -- Finalize exhausted rows even if this invocation cannot lease any work.
 update public.rr_ops_alerts set status='needs_review',attempt_token=null,lease_until=null,
  last_outcome=coalesce(last_outcome,'uncertain'),
  error_code=case when retry_until<=now() then 'retry_window_closed' else 'attempt_limit' end
 where status in ('queued','retry','sending') and (lease_until is null or lease_until<now())
  and (retry_until<=now() or attempts>=8);
 select * into a from public.rr_ops_alerts where
  ((status in ('queued','retry') and next_attempt_at<=now()) or (status='sending' and lease_until<now()))
  and attempts<8 and (retry_until is null or retry_until>now())
 order by created_at,id for update skip locked limit 1;
 if a.id is null then return null; end if;
 update public.rr_ops_alerts set status='sending',attempts=attempts+1,attempt_token=gen_random_uuid(),
  lease_until=now()+interval '3 minutes',first_attempt_at=coalesce(first_attempt_at,now()),
  retry_until=coalesce(retry_until,now()+interval '23 hours'),last_attempt_at=now(),
  error_code=case when a.status='sending' then 'lease_expired' else error_code end,
  last_outcome=case when a.status='sending' then 'uncertain' else last_outcome end
 where id=a.id returning * into a;
 return jsonb_build_object('id',a.id,'attempt_token',a.attempt_token,'idempotency_key',a.idempotency_key,
  'payload',a.payload,'request_body',a.request_body,'first_attempt_at',a.first_attempt_at,'retry_until',a.retry_until,'attempts',a.attempts);
end $$;

create function public.rr_ops_prepare(p_id uuid,p_attempt_token uuid,p_request_body jsonb) returns jsonb language plpgsql set search_path='' as $$
declare a public.rr_ops_alerts;
begin
 select * into a from public.rr_ops_alerts where id=p_id for update;
 if a.id is null or a.status<>'sending' or a.attempt_token is distinct from p_attempt_token or a.lease_until<=now() or a.retry_until<=now() then raise exception 'Alert lease is no longer valid'; end if;
 if a.request_body is not null then return a.request_body; end if;
 if p_request_body is null or jsonb_typeof(p_request_body)<>'object' or octet_length(p_request_body::text)>64000
  or not (p_request_body ?& array['from','to','subject']) or not (p_request_body ? 'text' or p_request_body ? 'html') then raise exception 'Invalid alert request'; end if;
 update public.rr_ops_alerts set request_body=p_request_body where id=a.id;
 return p_request_body;
end $$;

create function public.rr_ops_finish(p_id uuid,p_attempt_token uuid,p_outcome text,p_provider_id text default null,p_error_code text default null) returns void language plpgsql set search_path='' as $$
declare a public.rr_ops_alerts; code text;
begin
 if p_outcome is null or p_outcome not in ('accepted','retry','uncertain','failed') then raise exception 'Invalid alert outcome'; end if;
 if p_outcome='accepted' and (p_provider_id is null or length(p_provider_id) not between 1 and 200) then raise exception 'Accepted alert requires provider reference'; end if;
 code:=case when p_error_code in ('rate_limited','provider_unavailable','transport_uncertain','request_rejected','configuration_error','lease_expired','retry_window_closed','attempt_limit') then p_error_code
   when p_outcome='uncertain' then 'transport_uncertain' when p_outcome='failed' then 'request_rejected' when p_outcome='retry' then 'provider_unavailable' else null end;
 select * into a from public.rr_ops_alerts where id=p_id for update;
 if a.id is null or a.status<>'sending' or a.attempt_token is distinct from p_attempt_token or a.lease_until<=now() then return; end if;
 if p_outcome='accepted' and a.request_body is null then raise exception 'Alert request was not prepared'; end if;
 update public.rr_ops_alerts set status=case when p_outcome='accepted' then 'accepted' when p_outcome='failed' then 'failed'
   when a.retry_until<=now() or a.attempts>=8 then 'needs_review' else 'retry' end,
  last_outcome=p_outcome,provider_id=case when p_outcome='accepted' then p_provider_id else provider_id end,
  error_code=case when p_outcome='accepted' then null when a.retry_until<=now() then 'retry_window_closed' when a.attempts>=8 and p_outcome<>'failed' then 'attempt_limit' else code end,
  lease_until=null,attempt_token=null,next_attempt_at=now()+make_interval(mins=>least(60,5*(2^(a.attempts-1))::integer))
 where id=a.id;
end $$;

create function public.rr_ops_overview() returns jsonb language sql set search_path='' as $$
 select jsonb_build_object('snapshot',s.snapshot,
  'worker',jsonb_build_object('last_seen_at',s.last_seen_at,'last_success_at',s.last_success_at,'last_failure_at',s.last_failure_at,'processed',s.processed,'last_error',s.last_error),
  'reconciliation',(select to_jsonb(r)-'source' from public.rr_ops_reconciliations r order by checked_at desc,id desc limit 1),
  'alerts',coalesce((select jsonb_agg(to_jsonb(a) order by created_at desc,id desc) from
   (select id,status,last_outcome,created_at,last_attempt_at,retry_until,attempts,provider_id,error_code from public.rr_ops_alerts order by created_at desc,id desc limit 20) a),'[]'),
  'alerting',jsonb_build_object('last_created_at',s.last_alert_created_at,'reminder_hours',6)
 ) from public.rr_ops_state s where singleton;
$$;

-- External uptime checks receive only freshness, never incident counts or PII.
create function public.rr_ops_liveness() returns boolean language sql set search_path='' as $$
 select coalesce(last_collected_at>now()-interval '15 minutes',false) from public.rr_ops_state where singleton;
$$;

do $$ declare r record; begin
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
  (n.nspname='public' and p.proname like 'rr_ops_%') or (n.nspname='private' and p.proname like 'rr_ops_%') loop
  execute format('revoke all on function %s from public,anon,authenticated',r.signature);
  execute format('grant execute on function %s to service_role',r.signature);
 end loop;
end $$;

create function private.dispatch_marketplace_operations() returns void language plpgsql set search_path='' as $$
declare token text;
begin
 perform public.rr_ops_collect();
 -- Nested subtransaction: an enqueue/config error must not undo the snapshot.
 begin
  select decrypted_secret into token from vault.decrypted_secrets where name='rr_instagram_job_token';
  if token is null or length(token)<16 then
   update public.rr_ops_state set dispatch_error='configuration_error' where singleton;
   return;
  end if;
  perform net.http_post(url:='https://jabwuawiqsusjrccapab.supabase.co/functions/v1/marketplace-operations',
   headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),body:='{}'::jsonb,timeout_milliseconds:=60000);
  update public.rr_ops_state set last_dispatch_at=now(),dispatch_error=null where singleton;
 exception when others then
  update public.rr_ops_state set dispatch_error='provider_unavailable' where singleton;
 end;
end $$;
revoke all on function private.dispatch_marketplace_operations() from public,anon,authenticated,service_role;
select cron.schedule('realreach-operations-monitor','*/5 * * * *','select private.dispatch_marketplace_operations()');
-- Full ledger scan is independent of the lightweight collector and email sender.
select cron.schedule('realreach-operations-reconcile','17 3 * * *','select public.rr_ops_reconcile(''scheduled'')');
