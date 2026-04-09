import { NextResponse } from 'next/server'
import { verifyPortalRequest } from '@/lib/portalApiHelper'

/**
 * GET /api/portal/liquidaciones
 * Devuelve todas las liquidaciones del socio autenticado.
 * Query params opcionales: ?campana=2024-25 (devuelve solo esa campaña)
 */
export async function GET(request) {
  const result = await verifyPortalRequest(request)
  if (!result) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { socio, adminClient } = result
  const { searchParams } = new URL(request.url)
  const campana = searchParams.get('campana')

  let query = adminClient
    .from('liquidaciones')
    .select('*')
    .eq('user_id', socio.user_id)
    .eq('socio_id', socio.id)
    .order('created_at', { ascending: false })

  if (campana) {
    query = query.eq('campana', campana)
    const { data, error } = await query.single()
    if (error && error.code !== 'PGRST116') return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || null })
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}
