import { NextResponse } from 'next/server'
import { verifyPortalRequest } from '@/lib/portalApiHelper'

/**
 * GET /api/portal/entregas
 * Devuelve todas las entregas del socio autenticado.
 * Usa service role para bypassear RLS.
 * Query params opcionales: ?campana=2024-25
 */
export async function GET(request) {
  const result = await verifyPortalRequest(request)
  if (!result) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { socio, adminClient } = result
  const { searchParams } = new URL(request.url)
  const campana = searchParams.get('campana')

  let query = adminClient
    .from('entregas')
    .select('*, parcelas(nombre)')
    .eq('user_id', socio.user_id)
    .eq('socio_id', socio.id)
    .order('fecha', { ascending: false })

  if (campana) query = query.eq('campana', campana)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data || [] })
}
