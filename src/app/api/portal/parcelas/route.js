import { NextResponse } from 'next/server'
import { verifyPortalRequest } from '@/lib/portalApiHelper'

/**
 * GET /api/portal/parcelas
 * Devuelve todas las parcelas del socio autenticado.
 * Usa service role para bypassear RLS.
 */
export async function GET(request) {
  const result = await verifyPortalRequest(request)
  if (!result) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { socio, adminClient } = result

  const { data, error } = await adminClient
    .from('parcelas')
    .select('*')
    .eq('user_id', socio.user_id)
    .eq('socio_id', socio.id)
    .order('nombre')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}
