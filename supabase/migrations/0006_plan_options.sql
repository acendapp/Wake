-- Wake — 0006: cache the evening-pregenerated, Claude-personalized routines
-- The Claude layer pre-generates tomorrow's routine the evening before, one plan
-- per readiness state (deficit / aligned / surplus), because the only thing we
-- don't yet know at reflect time is the morning readiness. The morning check-in
-- then just PICKS the plan matching the realized state — no model call on the
-- hot path. Shape: { "deficit": Plan, "aligned": Plan, "surplus": Plan }.
-- Apply after 0005 (Supabase dashboard SQL editor, or `supabase db push`).
--
-- Falls back gracefully: if this is null (no pre-gen, or Claude was unavailable),
-- the morning check-in computes a deterministic plan client-side as before.

alter table public.days
  add column if not exists plan_options jsonb;
