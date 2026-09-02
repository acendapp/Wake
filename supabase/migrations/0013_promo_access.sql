-- Wake — promo codes: creators and friends ride free while their code stays active.
-- Apply via `supabase db push` (or paste into the dashboard SQL editor).
--
-- Founder ops (SQL editor):
--   create:      insert into public.promo_codes (code, note)
--                values ('WAKE-CREW-7F3K9Q', 'creator batch #1');
--   deactivate:  update public.promo_codes
--                set active = false, deactivated_at = now() where code = '…';
--                → everyone on it keeps access for 7 more days (the app shows a
--                  countdown banner), then hits the hard paywall.
--   reactivate:  update public.promo_codes
--                set active = true, deactivated_at = null where code = '…';
--                → grace/expired users on that code are restored instantly
--                  (status is computed live, nothing else to run).
--
-- Codes are NEVER readable by clients: both tables carry RLS with no client
-- policies (beyond a user reading their own redemption), and everything goes
-- through security-definer RPCs. Pick long codes — redemption is also limited
-- to 10 attempts/hour/user so codes can't be brute-forced from the app.

create table if not exists public.promo_codes (
  code            text primary key,
  active          boolean not null default true,
  note            text,
  created_at      timestamptz not null default now(),
  deactivated_at  timestamptz
);

alter table public.promo_codes enable row level security;
-- No policies: dashboard/service-role only.

create table if not exists public.promo_redemptions (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  code         text not null references public.promo_codes (code),
  redeemed_at  timestamptz not null default now()
);

alter table public.promo_redemptions enable row level security;

create policy "read own redemption"
  on public.promo_redemptions for select
  using (auth.uid() = user_id);

-- Attempt log for redemption rate limiting (mirrors routine_call_log).
create table if not exists public.promo_redeem_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  attempted_at  timestamptz not null default now()
);

create index if not exists promo_redeem_attempts_user_time_idx
  on public.promo_redeem_attempts (user_id, attempted_at desc);

alter table public.promo_redeem_attempts enable row level security;
-- No policies: written only by the security-definer RPC below.

-- How long a deactivated code keeps carrying its users.
-- Referenced by promo_status(); change it there if this ever moves.
--   grace = deactivated_at + interval '7 days'

-- Redeem a code for the signed-in user. Case-insensitive, whitespace-trimmed.
-- A user who already redeemed simply moves to the new code (one redemption per
-- user — the newest code wins).
create or replace function public.redeem_promo(p_code text)
returns text -- 'ok' | 'invalid' | 'rate_limited'
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
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

  select code into v_code
  from promo_codes
  where lower(code) = lower(trim(p_code)) and active;
  if v_code is null then
    return 'invalid';
  end if;

  insert into promo_redemptions (user_id, code)
  values (auth.uid(), v_code)
  on conflict (user_id) do update
    set code = excluded.code, redeemed_at = now();
  return 'ok';
end;
$$;

-- The signed-in user's promo standing:
--   'active'  — code live, full access
--   'grace'   — code deactivated < 7 days ago; grace_ends_at says when it lapses
--   'expired' — code deactivated ≥ 7 days ago
-- No row → the user never redeemed a code.
create or replace function public.promo_status()
returns table (state text, grace_ends_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select
    case
      when c.active then 'active'
      when c.deactivated_at + interval '7 days' > now() then 'grace'
      else 'expired'
    end as state,
    case when not c.active then c.deactivated_at + interval '7 days' end as grace_ends_at
  from promo_redemptions r
  join promo_codes c on c.code = r.code
  where r.user_id = auth.uid();
$$;

-- Signed-in users only — never the anon key.
revoke execute on function public.redeem_promo(text) from public, anon;
revoke execute on function public.promo_status() from public, anon;
grant execute on function public.redeem_promo(text) to authenticated;
grant execute on function public.promo_status() to authenticated;
