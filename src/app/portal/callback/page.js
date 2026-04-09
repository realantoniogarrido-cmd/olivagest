'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/**
 * /portal/callback
 * Gestiona dos flujos:
 *  1. Recuperación de contraseña: ?type=recovery → muestra formulario nueva contraseña
 *  2. (Legacy) magic link: redirige a dashboard si hay sesión
 */
export default function PortalCallback() {
  const router = useRouter()
  const [mode, setMode]           = useState('loading') // 'loading' | 'recovery' | 'redirecting'
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [done, setDone]           = useState(false)

  useEffect(() => {
    const isRecovery = window.location.search.includes('type=recovery')
      || window.location.hash.includes('type=recovery')

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Supabase nos avisa que el usuario quiere resetear contraseña
        setMode('recovery')
      } else if (event === 'SIGNED_IN' && session) {
        if (isRecovery) {
          setMode('recovery')
        } else {
          setMode('redirecting')
          router.replace('/portal/dashboard')
        }
      } else if (event === 'INITIAL_SESSION' && session && !isRecovery) {
        setMode('redirecting')
        router.replace('/portal/dashboard')
      }
    })

    // Flujo PKCE (?code=xxx)
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) router.replace('/portal')
      })
    }

    // Timeout de seguridad
    const timeout = setTimeout(() => {
      if (mode === 'loading') router.replace('/portal')
    }, 8000)

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [router])

  async function handleSetPassword(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Mínimo 6 caracteres'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => router.replace('/portal/dashboard'), 2000)
  }

  // ── Formulario nueva contraseña ───────────────────────────────────
  if (mode === 'recovery') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ backgroundColor: '#0f172a' }}>
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <img src="/logo.png" alt="OlivaGest" className="w-16 h-16 mx-auto mb-3"
              style={{ borderRadius: '18px', objectFit: 'contain' }} />
            <h1 className="text-white text-xl font-bold">Nueva contraseña</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Elige una contraseña segura</p>
          </div>

          {done ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'rgba(74,222,128,0.15)' }}>
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-semibold">¡Contraseña actualizada!</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Entrando a tu portal…</p>
            </div>
          ) : (
            <div className="rounded-2xl p-6"
              style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <form onSubmit={handleSetPassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Nueva contraseña
                  </label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Mín. 6 caracteres" required
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.15)',
                      color: '#fff', WebkitTextFillColor: '#fff' }}
                    onFocus={e => { e.target.style.border = '1.5px solid #4ade80' }}
                    onBlur={e => { e.target.style.border = '1.5px solid rgba(255,255,255,0.15)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Repite la contraseña
                  </label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••" required
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.15)',
                      color: '#fff', WebkitTextFillColor: '#fff' }}
                    onFocus={e => { e.target.style.border = '1.5px solid #4ade80' }}
                    onBlur={e => { e.target.style.border = '1.5px solid rgba(255,255,255,0.15)' }}
                  />
                </div>
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <button type="submit" disabled={loading || !password || !confirm}
                  className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50"
                  style={{ backgroundColor: '#4ade80', color: '#0f172a' }}>
                  {loading ? 'Guardando…' : 'Guardar contraseña'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Spinner cargando / redirigiendo ───────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ backgroundColor: '#0f172a' }}>
      <svg className="animate-spin h-10 w-10" fill="none" viewBox="0 0 24 24" style={{ color: '#4ade80' }}>
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
      <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {mode === 'redirecting' ? 'Entrando a tu portal…' : 'Verificando…'}
      </p>
    </div>
  )
}
