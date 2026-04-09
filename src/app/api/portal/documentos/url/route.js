import { verifyPortalRequest, getAdminClient } from '@/lib/portalApiHelper'

export async function GET(request) {
  try {
    const verified = await verifyPortalRequest(request)
    if (!verified) return Response.json({ error: 'No autorizado' }, { status: 401 })
    const { socio } = verified

    const { searchParams } = new URL(request.url)
    const nombre = searchParams.get('nombre')
    if (!nombre) return Response.json({ error: 'Falta nombre' }, { status: 400 })

    const adminClient = getAdminClient()
    const { data, error } = await adminClient.storage
      .from('socio-documentos')
      .createSignedUrl(`${socio.id}/${nombre}`, 120)

    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ url: data.signedUrl })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
