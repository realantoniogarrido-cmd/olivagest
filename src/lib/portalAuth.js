/**
 * Devuelve el socio del usuario autenticado.
 * Llama a /api/portal/me (server-side con service role) para bypassear
 * las políticas RLS de Supabase, que bloquean la consulta cuando el
 * auth.uid() del socio ≠ user_id del cooperativista.
 */
export async function getPortalSocioFromSession(session) {
  if (!session?.access_token) return null

  try {
    const res = await fetch('/api/portal/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    })

    if (!res.ok) return null
    const { socio } = await res.json()
    return socio || null
  } catch {
    return null
  }
}

/**
 * @deprecated Usa getPortalSocioFromSession(session) desde onAuthStateChange.
 */
export async function getPortalSocio() {
  const { createClient } = await import('@supabase/supabase-js')
  // fallback: no usado en producción
  return null
}
