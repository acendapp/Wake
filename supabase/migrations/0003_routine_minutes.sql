-- Wake — 0003: routine duration replaces the leave-by / sleep Rx
-- The evening Reflect ritual now captures how long the user wants tomorrow's
-- morning routine to run (minutes), instead of a clock "out the door by" time.
-- Apply after 0002 (Supabase dashboard SQL editor, or `supabase db push`).
--
-- The 0002 columns leave_by, sleep_target_hours, and sleep_bedtime are now
-- vestigial (no longer read or written). They're left in place rather than
-- dropped so existing rows keep their history; a later migration can prune them.

alter table public.days
  -- Tomorrow's preferred morning-routine length in minutes. Set the evening
  -- before; defaults to the user's standing preference. Lives on the day it targets.
  add column if not exists routine_minutes integer
    check (routine_minutes between 0 and 240);
