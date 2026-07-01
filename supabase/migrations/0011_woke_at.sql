-- Wake — the "just wake me" path.
-- Apply via `supabase db push` (or paste into the dashboard SQL editor).
--
-- Some mornings a user just wants the gentle voice alarm and to get on with the
-- day, without the check-in → focal point → routine ritual. On the wake screen,
-- "Not today" records woke_at instead of routing to the check-in. Waking WELL is
-- the habit, so this still counts toward the streak (see src/lib/stats.ts) — the
-- activity set counts woke_at alongside morning/evening completion.

alter table public.days
  add column if not exists woke_at timestamptz;
