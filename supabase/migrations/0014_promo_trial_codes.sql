-- Wake — promo code kinds + influencer reporting.
--
--  · kind 'lifetime' (default): free access while the code stays active, then
--    the 7-day grace — the original 0013 behavior, unchanged.
--  · kind 'trial': a creator-specific "unlock": redeeming grants trial_days
--    (default 7) of free access from the moment of redemption, framed in-app as
--    unlocked value. The countdown banner shows from day one; when it lapses,
--    the hard paywall. Deactivating a trial code stops NEW redemptions only —
--    people mid-trial keep their remaining days.
--
-- Founder ops:
--   lifetime:  insert into public.promo_codes (code, note) values ('…', 'friends');
--   trial:     insert into public.promo_codes (code, kind, note) values ('…', 'trial', 'influencer @handle');
--   report:    select * from public.promo_report;         -- one row per code
--              select * from public.promo_redemption_log; -- one row per redeeming user
--
-- The report objects are for the dashboard/psql only — clients can't select them.

alter table public.promo_codes
  add column if not exists kind text not null default 'lifetime'
    check (kind in ('lifetime', 'trial')),
  add column if not exists trial_days int not null default 7
    check (trial_days between 1 and 365);

-- Redeem, now kind-aware. One redemption row per user (newest code wins), with
-- one guard: re-entering a code you already redeemed never refreshes
-- redeemed_at — otherwise an expired trial could be restarted forever. A spent
-- trial code answers 'used' so the paywall can say so honestly.
create or replace function public.redeem_promo(p_code text)
returns text -- 'ok' | 'invalid' | 'used' | 'rate_limited'
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_kind text;
  v_trial_days int;
begin
  if auth.uid() is null then
    return 'invalid';
  end if;

  if (select count(*) from promo_redeem_attempts
      where user_id = auth.uid()
        and attempted_at > now() - interval '1 hour') >= 10 then
    return 'rate_limited';
  end if;
  insert into promo_redeem_attempts (user_id) values (auth.uid());

  select code, kind, trial_days into v_code, v_kind, v_trial_days
  from promo_codes
  where lower(code) = lower(trim(p_code)) and active;
  if v_code is null then
    return 'invalid';
  end if;

  -- Already on this exact code? Never move redeemed_at. A live standing is a
  -- harmless 'ok'; a spent trial is 'used'.
  if exists (select 1 from promo_redemptions
             where user_id = auth.uid() and code = v_code) then
    if v_kind = 'trial'
       and (select redeemed_at from promo_redemptions where user_id = auth.uid())
           + make_interval(days => v_trial_days) <= now() then
      return 'used';
    end if;
    return 'ok';
  end if;

  insert into promo_redemptions (user_id, code)
  values (auth.uid(), v_code)
  on conflict (user_id) do update
    set code = excluded.code, redeemed_at = now();
  return 'ok';
end;
$$;

-- Status, now kind-aware. A trial reads as 'grace' for its whole window — the
-- app already renders grace as "entitled + countdown banner + paywall
-- visitable", which is exactly a trial's UX. Note the trial clock ignores the
-- code's active flag: deactivation only stops new redemptions.
create or replace function public.promo_status()
returns table (state text, grace_ends_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select
    case
      when c.kind = 'trial' then
        case when r.redeemed_at + make_interval(days => c.trial_days) > now()
             then 'grace' else 'expired' end
      when c.active then 'active'
      when c.deactivated_at + interval '7 days' > now() then 'grace'
      else 'expired'
    end as state,
    case
      when c.kind = 'trial' then r.redeemed_at + make_interval(days => c.trial_days)
      when not c.active then c.deactivated_at + interval '7 days'
    end as grace_ends_at
  from promo_redemptions r
  join promo_codes c on c.code = r.code
  where r.user_id = auth.uid();
$$;

revoke execute on function public.redeem_promo(text) from public, anon;
revoke execute on function public.promo_status() from public, anon;
grant execute on function public.redeem_promo(text) to authenticated;
grant execute on function public.promo_status() to authenticated;

-- ── Influencer reporting (dashboard/psql only) ───────────────────────────────

-- One row per code: how it's doing.
create or replace view public.promo_report as
select
  c.code,
  c.kind,
  c.active,
  c.note,
  count(r.user_id)                as redemptions,
  min(r.redeemed_at)              as first_redemption,
  max(r.redeemed_at)              as latest_redemption,
  c.created_at,
  c.deactivated_at
from promo_codes c
left join promo_redemptions r on r.code = c.code
group by c.code
order by redemptions desc, c.created_at desc;

-- One row per redeeming user: who came through which code.
create or replace view public.promo_redemption_log as
select
  r.code,
  c.kind,
  c.note,
  u.email,
  r.user_id,
  r.redeemed_at
from promo_redemptions r
join promo_codes c on c.code = r.code
join auth.users u on u.id = r.user_id
order by r.code, r.redeemed_at;

-- Founder eyes only: no API access to either view.
revoke all on public.promo_report from public, anon, authenticated;
revoke all on public.promo_redemption_log from public, anon, authenticated;
