'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/**
 * /portal/reset-password
 * Página dedicada para restablecer contraseña.
 * El usuario llega aquí desde el email de recuperación.
 * NUNCA redirige al dashboard — siempre muestra el formulario.
 */
export default function ResetPasswordPage() {
  const router = useRouter()

  const [ready,    setReady]    = useState(false)   // token procesado y sesión lista
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [done,     setDone]     = useState(false)
  const [expired,  setExpired]  = useState(false)

  useEffect(() => {
    // Escuchar PASSWORD_RECOVERY — Supabase lo dispara cuando el código
    // de recuperación se intercambia. Este evento garantiza que tenemos
    // sesión temporal para poder llamar a updateUser().
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)   // sesión temporal lista, mostrar formulario
      }
      // No redirigir en SIGNED_IN ni en INITIAL_SESSION —
      // esta página es SOLO para cambiar contraseña.
    })

    // Intercambiar el código PKCE que viene en ?code=xxx
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) setExpired(true)
        // Si va bien → PASSWORD_RECOVERY dispara → setReady(true)
      })
    } else {
      // Sin código — puede ser hash flow (legacy) o enlace inválido
      // Comprobar si ya hay sesión válida de recuperación
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) setReady(true)
        else setExpired(true)
      })
    }

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (err) {
      setError(err.message || 'No se pudo actualizar la contraseña')
      return
    }

    setDone(true)
    // Esperar 2 segundos para que el usuario vea el mensaje, luego al dashboard
    setTimeout(() => router.replace('/portal/dashboard'), 2000)
  }

  // ── Enlace caducado / inválido ────────────────────────────────────
  if (expired) {
    return (
      <Screen>
        <div className="text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'rgba(239,68,68,0.15)' }}>
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <p className="text-white font-semibold mb-2">Enlace caducado o inválido</p>
          <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Los enlaces de recuperación expiran en 1 hora y solo funcionan una vez.
          </p>
          <button
            onClick={() => router.replace('/portal')}
            className="px-6 py-2.5 rounded-xl font-bold text-sm"
            style={{ backgroundColor: '#4ade80', color: '#0f172a' }}>
            Volver al portal
          </button>
        </div>
      </Screen>
    )
  }

  // ── Cargando (procesando código) ──────────────────────────────────
  if (!ready && !expired) {
    return (
      <Screen>
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 mx-auto mb-4" fill="none" viewBox="0 0 24 24" style={{ color: '#4ade80' }}>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Verificando enlace…</p>
        </div>
      </Screen>
    )
  }

  // ── Contraseña actualizada ────────────────────────────────────────
  if (done) {
    return (
      <Screen>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'rgba(74,222,128,0.15)' }}>
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-white font-semibold text-lg mb-1">¡Contraseña actualizada!</p>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Entrando a tu portal…</p>
        </div>
      </Screen>
    )
  }

  // ── Formulario nueva contraseña ───────────────────────────────────
  return (
    <Screen>
      <div className="mb-6 text-center">
        <img src="/logo.png" alt="OlivaGest" className="w-16 h-16 mx-auto mb-3"
          style={{ borderRadius: '18px', objectFit: 'contain' }} />
        <h1 className="text-white text-xl font-bold">Nueva contraseña</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Elige una contraseña segura para tu portal</p>
      </div>

      <div className="rounded-2xl p-6"
        style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <PwdField
            label="Nueva contraseña"
            value={password}
            onChange={setPassword}
            placeholder="Mín. 6 caracteres"
          />
          <PwdField
            label="Repite la contraseña"
            value={confirm}
            onChange={setConfirm}
            placeholder="••••••••"
          />

          {error && (
            <p className="text-red-400 text-xs">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password || !confirm}
            className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: '#4ade80', color: '#0f172a' }}>
            {loading ? 'Guardando…' : 'Guardar nueva contraseña'}
          </button>
        </form>
      </div>
    </Screen>
  )
}

function Screen({ children }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: '#0f172a' }}>
      <div className="w-full max-w-sm">
        {children}
      </div>
    </div>
  )
}

function PwdField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {label}
      </label>
      <input
        type="password"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="w-full rounded-xl px-4 py-3 text-sm outline-none"
        style={{
          backgroundColor: 'rgba(255,255,255,0.1)',
          border: '1.5px solid rgba(255,255,255,0.15)',
          color: '#ffffff',
          WebkitTextFillColor: '#ffffff',
        }}
        onFocus={e => { e.target.style.border = '1.5px solid #4ade80' }}
        onBlur={e => { e.target.style.border = '1.5px solid rgba(255,255,255,0.15)' }}
      />
    </div>
  )
}
