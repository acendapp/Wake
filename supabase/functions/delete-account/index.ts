// Wake — `delete-account` Edge Function (Deno).
//
// Permanently deletes the signed-in user's account. App Store Review Guideline
// 5.1.1(v) requires any app with account creation to offer in-app deletion.
//
// How it works: the caller proves who they are with their own Supabase session
// (we read the user from their JWT), then we delete THAT user with the service-
// role admin API. Both `profiles` and `days` reference `auth.users(id) on delete
// cascade` (migration 0001), so deleting the auth user purges all of their data.
//
// A user can only ever delete THEMSELVES — the id comes from their verified token,
// never from the request body, so there is no way to delete another account.
//
// Deploy:  supabase functions deploy delete-account
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are all
//          injected by the platform by default — no manual secret needed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Server not configured for account deletion' }, 500)
  }

  // Identify the caller from THEIR token — never from the request body.
  const authHeader = req.headers.get('Authorization') ?? ''
  const asUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await asUser.auth.getUser()
  if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401)

  // Delete that user with the admin API; the on-delete-cascade purges profiles + days.
  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { error: delErr } = await admin.auth.admin.deleteUser(userData.user.id)
  if (delErr) return json({ error: 'Could not delete account', detail: delErr.message }, 502)

  return json({ ok: true })
})
