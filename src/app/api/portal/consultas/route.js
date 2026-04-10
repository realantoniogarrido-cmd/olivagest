import { verifyPortalRequest, getAdminClient } from '@/lib/portalApiHelper'

// POST — el socio envía una consulta/mensaje a la cooperativa
// Se inserta en la tabla `notificaciones` del admin (mismo lugar donde ve los documentos subidos)
export async function POST(request) {
  try {
    const verified = await verifyPortalRequest(request)
    if (!verified) return Response.json({ error: 'No autorizado' }, { status: 401 })
    const { socio } = verified

    const { tipo, titulo, mensaje } = await request.json()
    if (!mensaje?.trim()) return Response.json({ error: 'El mensaje no puede estar vacío' }, { status: 400 })

    const adminClient = getAdminClient()

    // El user_id del admin está en socio.user_id (el admin que creó este socio)
    if (!socio.user_id) return Response.json({ error: 'No se pudo identificar la cooperativa' }, { status: 400 })

    const { error } = await adminClient.from('notificaciones').insert({
      user_id: socio.user_id,
      tipo:    tipo || 'consulta',
      titulo:  titulo || `Consulta de ${socio.nombre}`,
      mensaje: mensaje.trim(),
      leida:   false,
      metadata: {
        socio_id:     socio.id,
        socio_nombre: socio.nombre,
        socio_email:  socio.email,
        origen:       'portal_socio',
      },
    })

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
