import { verifyPortalRequest, getAdminClient } from '@/lib/portalApiHelper'

// GET — listar documentos del socio autenticado
export async function GET(request) {
  try {
    const verified = await verifyPortalRequest(request)
    if (!verified) return Response.json({ error: 'No autorizado' }, { status: 401 })
    const { socio } = verified

    const adminClient = getAdminClient()
    const { data, error } = await adminClient.storage
      .from('socio-documentos')
      .list(`${socio.id}/`, { sortBy: { column: 'created_at', order: 'desc' } })

    if (error) return Response.json({ documentos: [] })

    const documentos = (data || [])
      .filter(f => f.name !== '.emptyFolderPlaceholder')
      .map(f => {
        const esSocio = f.name.startsWith('socio__')
        const nombreLimpio = f.name.replace(/^(coop|socio)__\d+_/, '')
        return {
          nombre: f.name,
          nombreLimpio,
          origen: esSocio ? 'agricultor' : 'cooperativa',
          size: f.metadata?.size || 0,
        }
      })

    return Response.json({ documentos })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// POST — subir un documento (agricultor)
export async function POST(request) {
  try {
    const verified = await verifyPortalRequest(request)
    if (!verified) return Response.json({ error: 'No autorizado' }, { status: 401 })
    const { socio } = verified

    const formData = await request.formData()
    const file = formData.get('file')
    if (!file) return Response.json({ error: 'No se recibió archivo' }, { status: 400 })

    const adminClient = getAdminClient()
    // Prefijo "socio__" para identificar que lo subió el agricultor
    const nombre = `socio__${Date.now()}_${file.name}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error } = await adminClient.storage
      .from('socio-documentos')
      .upload(`${socio.id}/${nombre}`, buffer, { contentType: file.type })

    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ success: true })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// DELETE — eliminar un documento propio (solo los del agricultor)
export async function DELETE(request) {
  try {
    const verified = await verifyPortalRequest(request)
    if (!verified) return Response.json({ error: 'No autorizado' }, { status: 401 })
    const { socio } = verified

    const { nombre } = await request.json()
    // Solo puede borrar documentos que subió el mismo agricultor
    if (!nombre.startsWith('socio__')) {
      return Response.json({ error: 'Solo puedes eliminar documentos que hayas subido tú' }, { status: 403 })
    }

    const adminClient = getAdminClient()
    const { error } = await adminClient.storage
      .from('socio-documentos')
      .remove([`${socio.id}/${nombre}`])

    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ success: true })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
