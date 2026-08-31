-- Wake — intention capture on goal-setting focal points.
-- Apply via `supabase db push` (or paste into the dashboard SQL editor).
--
-- When the day's focal point is itself the naming of a goal (set an intention,
-- choose today's top three, set a stretch goal — capturesIntention in the goal
-- library), the routine screen offers a text box to write it down. The evening
-- reflection plays the text back and asks whether they followed through — the
-- morning-to-evening loop, closed.

alter table public.days
  add column if not exists intention text,
  add column if not exists intention_kept boolean;
