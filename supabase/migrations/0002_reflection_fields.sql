-- Wake — 0002: evening reflection + sleep/schedule fields
-- Adds the fields the Reflect ritual captures that weren't in 0001.
-- Apply after 0001 (Supabase dashboard SQL editor, or `supabase db push`).

alter table public.days
  -- Evening look-back: how the day landed vs. the morning's call.
  add column if not exists lookback text
    check (lookback in ('behind', 'matched', 'ahead')),

  -- Optional free-text note from the evening.
  add column if not exists note text,

  -- Which morning moves were actually done (richer than did_one_thing, which
  -- stays as the quick "did you do the One Thing" flag).
  add column if not exists completed_slugs text[] not null default '{}',

  -- Tomorrow's morning deadline, "HH:MM" 24h. Set the evening before; sizes the
  -- morning sequence and the morning budget. Lives on the day it targets.
  add column if not exists leave_by text,

  -- Prescribed sleep for the night leading into this day (set the evening
  -- before). Derived from demand + leave_by, stored for history fidelity.
  add column if not exists sleep_target_hours numeric(3, 2)
    check (sleep_target_hours between 0 and 24),
  add column if not exists sleep_bedtime text;
