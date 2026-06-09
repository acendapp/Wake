-- Wake — per-user rate limiting for the generate-routine Edge Function.
-- Apply via `supabase db push` (or paste into the dashboard SQL editor).
--
-- The function appends a row here on every call and checks the rolling-24h count
-- first, so a single authenticated account can't loop the proxy and run up
-- Anthropic spend. Legitimate use is ~3 calls/evening (one per readiness state).

create table if not exists public.routine_call_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists routine_call_log_user_time_idx
  on public.routine_call_log (user_id, created_at desc);

-- Private to its owner, like every other table.
alter table public.routine_call_log enable row level security;

create policy "own routine call log"
  on public.routine_call_log for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
