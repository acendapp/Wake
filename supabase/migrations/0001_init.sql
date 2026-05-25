-- Wake — initial schema
-- Apply by pasting into the Supabase dashboard SQL editor, or via
-- `supabase db push` once you've linked the CLI to your project.

-- ── profiles ────────────────────────────────────────────────────────────────
-- One row per user, auto-created on signup (see trigger below).
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  timezone    text,
  mode        text,
  goals       text[] not null default '{}',
  created_at  timestamptz not null default now()
);

-- ── days ──────────────────────────────────────────────────────────────────--
-- The core loop record: one row per user per local date. Morning fields are
-- written at check-in; evening fields stay null until the reflection.
create table if not exists public.days (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  local_date            date not null,

  -- morning check-in + plan
  readiness             int  check (readiness between 1 and 10),
  day_difficulty        int  check (day_difficulty between 1 and 10),
  state                 text check (state in ('deficit', 'aligned', 'surplus')),
  gap                   int,
  one_thing_slug        text,
  plan                  jsonb,
  morning_completed_at  timestamptz,

  -- evening reflection
  energy                int  check (energy between 1 and 10),
  focus                 int  check (focus between 1 and 10),
  mood                  int  check (mood between 1 and 10),
  did_one_thing         boolean,
  evening_completed_at  timestamptz,

  created_at            timestamptz not null default now(),
  unique (user_id, local_date)
);

create index if not exists days_user_date_idx
  on public.days (user_id, local_date desc);

-- ── row-level security ──────────────────────────────────────────────────────
-- Every row is private to its owner. No cross-user reads, ever.
alter table public.profiles enable row level security;
alter table public.days     enable row level security;

create policy "profiles are self-owned"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "days are self-owned"
  on public.days for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── auto-create a profile on signup ─────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
