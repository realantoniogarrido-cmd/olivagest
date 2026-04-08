'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function PortalCallback() {
  const router = useRouter()

  useEffect(() => {
    let done = false

    function goTo(path) {
      if (done) return
      done = true
      router.replace(path)
    }

    // ── Escuchar PRIMERO (síncrono) ────────────────────────────
    // Supabase procesa el #access_token del hash al inicializar
    // y dispara SIGNED_IN. Si lo configuramos antes que cualquier
    // operación async, no nos perdemos el evento.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        goTo('/portal/dashboard')
      }
    })

    // ── Comprobar sesión ya existente ──────────────────────────
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) goTo('/portal/dashboard')
    })

    // ── Flujo PKCE: ?code=xxx ──────────────────────────────────
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        // Si hay error, onAuthStateChange no disparará → redirigir a login
        if (error) goTo('/portal')
        // Si va bien, onAuthStateChange dispara SIGNED_IN → goTo('/portal/dashboard')
      })
    }

    // ── Timeout de seguridad (8s) ──────────────────────────────
    const timeout = setTimeout(() => goTo('/portal'), 8000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ backgroundColor: '#0f172a' }}>
      <svg className="animate-spin h-10 w-10" fill="none" viewBox="0 0 24 24"
        style={{ color: '#4ade80' }}>
        <circle className="opacity-25" cx="12" cy="12" r="10"
          stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
      <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Verificando acceso…
      </p>
    </div>
  )
}
