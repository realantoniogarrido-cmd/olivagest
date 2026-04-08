import { supabase } from './supabase'

/**
 * Returns socio row for a given authenticated session.
 * Pass the session from onAuthStateChange INITIAL_SESSION to avoid race conditions.
 */
export async function getPortalSocioFromSession(session) {
  if (!session) return null
  const email = session.user.email
  const { data: socio } = await supabase
    .from('socios')
    .select('*')
    .eq('email', email)
    .single()
  if (!socio) return null
  return socio
}

/**
 * @deprecated Use getPortalSocioFromSession(session) instead.
 * This version can have race conditions on initial page load.
 */
export async function getPortalSocio() {
  const { data: { session } } = await supabase.auth.getSession()
  return getPortalSocioFromSession(session)
}
