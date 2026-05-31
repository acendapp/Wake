// Wake — `generate-routine` Edge Function (Deno).
//
// Model C: a thin, AUTHENTICATED proxy to Claude. It holds the Anthropic key
// (server-side only) and forwards a prompt the client built with the vetted
// library. It does NOT build prompts or validate output — the client does both
// with the unit-tested src/engine/personalize.ts, and validates the response
// against the candidates before trusting it. Keeping the function tiny avoids
// duplicating the engine into the Deno runtime.
//
// Why a proxy at all: so the Anthropic key never ships in the app bundle. Auth is
// required (a valid Supabase session) so a leaked URL can't burn Anthropic credits.
//
// Deploy:   supabase functions deploy generate-routine
// Secrets:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//           (optional) supabase secrets set ANTHROPIC_MODEL=claude-opus-4-8
// The SUPABASE_URL / SUPABASE_ANON_KEY secrets are injected by the platform.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
// Default to Haiku: this is a once-a-day, constrained select-and-rewrite task.
const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!ANTHROPIC_API_KEY) return json({ error: 'Server missing ANTHROPIC_API_KEY' }, 500)

  // Require a signed-in user — never an anonymous, unauthenticated call.
  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401)

  let payload: { system?: unknown; user?: unknown; model?: unknown }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const { system, user, model } = payload
  if (typeof system !== 'string' || typeof user !== 'string') {
    return json({ error: 'Expected { system: string, user: string }' }, 400)
  }
  // Bound payload size — these prompts are small; anything large is abuse.
  if (system.length + user.length > 60_000) return json({ error: 'Prompt too large' }, 413)

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: typeof model === 'string' && model ? model : ANTHROPIC_MODEL,
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    })

    if (!res.ok) {
      const detail = await res.text()
      return json({ error: 'Anthropic request failed', status: res.status, detail }, 502)
    }

    const data = await res.json()
    const text = data?.content?.[0]?.text
    if (typeof text !== 'string') return json({ error: 'Unexpected model response' }, 502)
    return json({ text })
  } catch (e) {
    return json({ error: 'Proxy error', detail: String(e) }, 502)
  }
})
