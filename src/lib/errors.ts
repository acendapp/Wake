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

// A pragmatic email-shape check for gating sign-in / sign-up before a network
// round-trip — "something@something.tld", no spaces. Not RFC-exhaustive (no
// validator that gates real users should be); the server is the real authority.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim())
}
