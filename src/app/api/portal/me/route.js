import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * GET /api/portal/me
 * Devuelve el registro de socio del usuario autenticado.
 * Usa service role para bypassear RLS (necesario porque el socio tiene
 * un auth.uid() diferente al user_id del cooperativista).
 */
export async function GET(request) {
  // Verificar el token del usuario
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')

  // Cliente admin con service role (bypass RLS)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Verificar token y obtener usuario real
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  // Buscar socio por email verificado
  const { data: socio } = await supabaseAdmin
    .from('socios')
    .select('*')
    .eq('email', user.email)
    .single()

  if (!socio) {
    return NextResponse.json({ socio: null }, { status: 404 })
  }

  return NextResponse.json({ socio })
}
