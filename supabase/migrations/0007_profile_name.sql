-- Wake — profile name fields (migration 0007)
-- Captures the user's name at first-run onboarding so the app can greet them by
-- first name ("Good morning, Alex."). first_name is collected as required in the
-- UI; last_name is optional. Both nullable here so existing rows (and the signup
-- trigger's bare insert) stay valid. Apply by pasting into the Supabase
-- dashboard SQL editor.

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name  text;
