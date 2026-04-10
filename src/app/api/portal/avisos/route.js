import { verifyPortalRequest, getAdminClient } from '@/lib/portalApiHelper'

// GET — listar avisos del socio autenticado
export async function GET(request) {
  try {
    const verified = await verifyPortalRequest(request)
    if (!verified) return Response.json({ error: 'No autorizado' }, { status: 401 })
    const { socio } = verified

    const adminClient = getAdminClient()
    const { data, error } = await adminClient
      .from('avisos')
      .select('*')
      .eq('socio_id', socio.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return Response.json({ avisos: [] })
    return Response.json({ avisos: data || [] })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// PATCH — marcar aviso(s) como leído
export async function PATCH(request) {
  try {
    const verified = await verifyPortalRequest(request)
    if (!verified) return Response.json({ error: 'No autorizado' }, { status: 401 })
    const { socio } = verified

    const { id, todos } = await request.json()
    const adminClient = getAdminClient()

    if (todos) {
      // Marcar todos como leídos
      await adminClient
        .from('avisos')
        .update({ leida: true })
        .eq('socio_id', socio.id)
        .eq('leida', false)
    } else if (id) {
      // Marcar uno concreto
      await adminClient
        .from('avisos')
        .update({ leida: true })
        .eq('id', id)
        .eq('socio_id', socio.id)
    }

    return Response.json({ success: true })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
