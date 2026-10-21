-- Explicit launch gates: provider credentials and commercial pricing approval
-- must never silently enable collecting or sending money.
alter table public.rr_settings add column collections_enabled boolean not null default false;
alter table public.rr_settings add column payouts_enabled boolean not null default false;
comment on column public.rr_settings.collections_enabled is 'Operator-controlled launch gate. Enable only after separately authorized live payment validation.';
comment on column public.rr_settings.payouts_enabled is 'Operator-controlled launch gate, independent of the temporary payouts_paused control.';

create function private.rr_payment_launch_guard() returns trigger language plpgsql set search_path='' as $$
declare allowed boolean;
begin
 -- Hold a shared settings-row lock through commit so disabling the gate and
 -- first dispatch/new intent admission have a well-defined database order.
 if tg_op='INSERT' or (old.submitted_at is null and new.submitted_at is not null) then
  select case new.direction when 'collection' then collections_enabled
    when 'payout' then payouts_enabled and not payouts_paused else false end
   into allowed from public.rr_settings where singleton for share;
  if allowed is distinct from true then
   raise exception '%',case when new.direction='collection' then 'Wallet top-ups are currently unavailable.' else 'Withdrawals are currently unavailable.' end;
  end if;
 end if;
 return new;
end $$;
revoke all on function private.rr_payment_launch_guard() from public,anon,authenticated;
grant execute on function private.rr_payment_launch_guard() to service_role;
create trigger rr_payment_launch_guard before insert or update of submitted_at on public.rr_payments
 for each row execute function private.rr_payment_launch_guard();
-- Existing rr_market_admin settings updates intentionally cannot change either
-- launch gate. Rechecks/webhooks may settle an existing dispatched intent even
-- while both gates are off; a shutdown must not discard existing obligations.
