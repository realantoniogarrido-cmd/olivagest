import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    if (!email) return Response.json({ hasAccount: false })

    const adminClient = getAdminClient()
    const { data, error } = await adminClient.auth.admin.listUsers()
    if (error) return Response.json({ hasAccount: false })

    const hasAccount = data.users.some(u => u.email === email)
    return Response.json({ hasAccount })
  } catch {
    return Response.json({ hasAccount: false })
  }
}
