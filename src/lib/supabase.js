import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// Caché en memoria para evitar llamadas concurrentes que generan lock conflict
let _cachedUserId = null
supabase.auth.onAuthStateChange((event, session) => {
  _cachedUserId = session?.user?.id ?? null
})

export async function getUserId() {
  if (_cachedUserId) return _cachedUserId
  // getSession() lee de memoria/storage sin adquirir lock — seguro para llamadas paralelas
  const { data: { session } } = await supabase.auth.getSession()
  _cachedUserId = session?.user?.id ?? null
  return _cachedUserId
}