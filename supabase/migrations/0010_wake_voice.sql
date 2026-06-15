-- Wake — the chosen alarm voice on the user profile.
-- Apply via `supabase db push` (or paste into the dashboard SQL editor).
--
-- The voice alarm offers several voices (see VOICES in src/lib/alarmCore.ts); the
-- user picks one in Settings and the alarm plays that voice's rotating clips.
-- Stored as the voice id string. No CHECK constraint on the value so the catalog
-- can grow without a migration; the client validates against the known set.

alter table public.profiles
  add column if not exists wake_voice text not null default 'aurora';
