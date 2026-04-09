import { createClient } from '@supabase/supabase-js'

/**
 * Crea el cliente admin con service role (bypass RLS).
 * Solo usar en rutas API server-side (/api/...).
 */
export function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * Verifica el JWT del socio y devuelve { socio, adminClient } o null.
 * Uso: const result = await verifyPortalRequest(request)
 *      if (!result) return Response.json({ error: 'No autorizado' }, { status: 401 })
 */
export async function verifyPortalRequest(request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.replace('Bearer ', '')
  const adminClient = getAdminClient()

  // Verificar token con Supabase Admin
  const { data: { user }, error } = await adminClient.auth.getUser(token)
  if (error || !user) return null

  // Buscar socio por email (bypass RLS con service role)
  const { data: socio } = await adminClient
    .from('socios')
    .select('*')
    .eq('email', user.email)
    .single()

  if (!socio) return null
  return { socio, adminClient }
}
