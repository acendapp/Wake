// Pull a human-readable message off whatever was thrown. Supabase/PostgREST
// errors are plain objects with a `message` field (not Error instances), so an
// `instanceof Error` check alone misses them and we'd lose the real cause.
export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const m = (e as { message?: unknown }).message
    if (typeof m === 'string' && m.length > 0) return m
  }
  return fallback
}
