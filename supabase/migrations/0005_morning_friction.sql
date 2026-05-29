-- Wake — morning friction point (migration 0005)
-- Onboarding's third question changed from "how active are you" (fitness_level)
-- to "where do your mornings usually go wrong" — a different signal: which phase
-- of the morning the routine should brace for. fitness_level is left in place
-- (now unused by onboarding) in case we re-introduce it as an optional signal.
-- Apply by pasting into the Supabase dashboard SQL editor.

alter table public.profiles
  add column if not exists friction_point text;

alter table public.profiles
  drop constraint if exists profiles_friction_point_check,
  add  constraint profiles_friction_point_check
       check (friction_point is null or friction_point in
              ('before_up', 'getting_ready', 'out_world', 'all_morning'));
