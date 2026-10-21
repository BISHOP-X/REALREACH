create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
revoke usage on schema net from public, anon, authenticated;

-- The random scheduler credential never leaves Vault in query output/source.
do $$ begin
  if not exists(select 1 from vault.secrets where name='rr_instagram_job_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'rr_instagram_job_token','RealReach Instagram pilot scheduler only');
  end if;
end $$;

create function private.job_authorized(p_hash text) returns boolean language sql security definer set search_path='' as $$
  select (select auth.jwt()->>'role')='service_role' and exists(
    select 1 from vault.decrypted_secrets where name='rr_instagram_job_token'
    and encode(extensions.digest(decrypted_secret,'sha256'),'hex')=p_hash
  );
$$;
revoke all on function private.job_authorized(text) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.job_authorized(text) to service_role;
create function public.rr_job_authorized(p_hash text) returns boolean language sql set search_path='' as $$ select private.job_authorized(p_hash); $$;
revoke all on function public.rr_job_authorized(text) from public,anon,authenticated;
grant execute on function public.rr_job_authorized(text) to service_role;

create function private.dispatch_instagram_jobs() returns void language plpgsql set search_path='' as $$
begin
  update public.instagram_pilots set status='expired',reason='identity_window_expired',updated_at=now() where status='awaiting_identity' and expires_at<now();
  if exists(select 1 from public.instagram_jobs where (state='queued' and due_at<=now()) or (state='running' and lease_until<now())) then
    perform net.http_post(
      url:='https://jabwuawiqsusjrccapab.supabase.co/functions/v1/instagram-jobs',
      headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='rr_instagram_job_token')),
      body:='{}'::jsonb,timeout_milliseconds:=60000
    );
  end if;
end $$;
revoke all on function private.dispatch_instagram_jobs() from public,anon,authenticated,service_role;
select cron.schedule('realreach-instagram-pilot','* * * * *','select private.dispatch_instagram_jobs()');
