'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function PortalCallback() {
  const router = useRouter()

  useEffect(() => {
    // Supabase handles the token from the URL hash automatically.
    // We just wait for the session to settle and then redirect.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.replace('/portal/dashboard')
      } else if (event === 'SIGNED_OUT') {
        router.replace('/portal')
      }
    })

    // Also check immediately in case session is already set
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/portal/dashboard')
    })

    return () => subscription.unsubscribe()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0f172a' }}>
      <div className="text-center">
        <svg className="animate-spin h-10 w-10 mx-auto mb-4" fill="none" viewBox="0 0 24 24" style={{ color: '#4ade80' }}>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-white font-medium">Verificando acceso...</p>
      </div>
    </div>
  )
}
