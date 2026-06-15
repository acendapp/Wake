-- Wake — wake-up alarm preferences on the user profile.
-- Apply via `supabase db push` (or paste into the dashboard SQL editor).
--
-- The voice alarm (Apple AlarmKit, built in the dev-build spike) needs two things
-- we didn't store before: WHETHER the user wants to be woken, and at WHAT TIME.
-- These live on `profiles` next to the other standing signals. `timezone` already
-- exists (0001); the alarm reads it so a wake_time is interpreted in the user's
-- own zone. wake_time is local wall-clock "HH:MM" (24h), nullable until set.

alter table public.profiles
  add column if not exists wake_enabled boolean not null default false,
  add column if not exists wake_time text;

-- Guard the format so a bad client write can't store an unparseable time.
alter table public.profiles
  drop constraint if exists profiles_wake_time_format;
alter table public.profiles
  add constraint profiles_wake_time_format
  check (wake_time is null or wake_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
