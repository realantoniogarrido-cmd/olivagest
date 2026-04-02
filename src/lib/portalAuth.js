import { supabase } from './supabase'

/**
 * Returns { socio, userId } for the currently logged-in portal user.
 * Looks up the socios table by the auth user's email.
 */
export async function getPortalSocio() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const email = session.user.email
  const { data: socio } = await supabase
    .from('socios')
    .select('*')
    .eq('email', email)
    .single()

  if (!socio) return null
  return socio  // socio.id = socio's row ID, socio.user_id = cooperative manager's user_id
}
