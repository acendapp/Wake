// Every morning delivers the focal point plus an optional sequence. The engine packs
// to this fixed budget (roughly the focal point + ~5 optional moves); the user
// self-paces by doing or skipping, so there's no per-user "routine length" any more —
// the only standing morning choice is the voice alarm (wake_enabled), and the
// per-morning "just wake me" (woke_at) escape hatch.
//
// The DB column `routine_minutes` (days + profiles) is kept for continuity, but it's
// now always written as this constant; nothing reads it as a user-picked tier.
export const SEQUENCE_MINUTES = 15
