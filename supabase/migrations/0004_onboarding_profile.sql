-- Wake — onboarding profile fields (migration 0004)
-- Extends public.profiles with the signals captured at first-run onboarding.
-- These shape the (future) AI-personalized morning routine. Demographics are
-- treated as weak, optional priors — every new column is nullable so a user can
-- skip a question. Apply by pasting into the Supabase dashboard SQL editor.

alter table public.profiles
  add column if not exists intent                  text,
  add column if not exists chronotype              text,
  add column if not exists fitness_level           text,
  add column if not exists routine_minutes         int,
  add column if not exists constraints             text[] not null default '{}',
  add column if not exists age_range               text,
  add column if not exists sex                     text,
  add column if not exists onboarding_completed_at timestamptz;

-- Light integrity on the enum-ish fields; all nullable (each is skippable). Drop
-- before add so re-running the migration is idempotent (Postgres has no
-- "add constraint if not exists").
alter table public.profiles
  drop constraint if exists profiles_intent_check,
  add  constraint profiles_intent_check
       check (intent is null or intent in ('calm', 'energize', 'focus'));

alter table public.profiles
  drop constraint if exists profiles_chronotype_check,
  add  constraint profiles_chronotype_check
       check (chronotype is null or chronotype in ('early', 'late', 'neither'));

alter table public.profiles
  drop constraint if exists profiles_fitness_level_check,
  add  constraint profiles_fitness_level_check
       check (fitness_level is null or fitness_level in ('low', 'moderate', 'high'));

alter table public.profiles
  drop constraint if exists profiles_age_range_check,
  add  constraint profiles_age_range_check
       check (age_range is null or age_range in
              ('under_25', '25_34', '35_44', '45_54', '55_plus'));

alter table public.profiles
  drop constraint if exists profiles_sex_check,
  add  constraint profiles_sex_check
       check (sex is null or sex in ('female', 'male', 'other'));

alter table public.profiles
  drop constraint if exists profiles_routine_minutes_check,
  add  constraint profiles_routine_minutes_check
       check (routine_minutes is null or routine_minutes between 1 and 240);
