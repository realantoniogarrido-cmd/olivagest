import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const db = getAdminClient()
  const { data: { user } } = await db.auth.getUser(token)
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { data } = await db.from('entregas').select('campana').eq('user_id', user.id)
  const campanyas = [...new Set((data || []).map(e => e.campana).filter(Boolean))].sort().reverse()
  return Response.json({ campanyas })
}
