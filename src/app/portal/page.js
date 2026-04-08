'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function PortalLoginPage() {
  const router = useRouter()
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(true)
  const [enviado, setEnviado] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    // INITIAL_SESSION se dispara una vez al arrancar con la sesión guardada (o null)
    // SIGNED_IN se dispara cuando llega un token nuevo (magic link, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (session) {
          router.replace('/portal/dashboard')
        } else {
          setLoading(false) // no hay sesión → mostrar formulario
        }
      }
      if (event === 'SIGNED_IN' && session) {
        router.replace('/portal/dashboard')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const trimmedEmail = email.trim().toLowerCase()

    try {
      // El socio pide acceso por su cuenta → signInWithOtp directo
      // (el email branded solo lo envía el admin desde la ficha del socio)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: `${appUrl}/portal/callback`,
          shouldCreateUser: false, // solo socios ya registrados
        },
      })
      if (otpError) {
        // Si el socio no existe en auth, mensaje claro
        if (otpError.message?.includes('not found') || otpError.status === 422) {
          throw new Error('Este email no está registrado. Contacta con tu cooperativa.')
        }
        throw new Error(otpError.message)
      }
      setEnviado(true)
    } catch (err) {
      setError(err.message || 'No se pudo enviar el enlace. Comprueba tu email.')
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0f172a' }}>
        <svg className="animate-spin h-8 w-8" fill="none" viewBox="0 0 24 24" style={{ color: '#4ade80' }}>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: '#0f172a' }}>

      {/* Logo */}
      <div className="mb-8 flex flex-col items-center">
        <img
          src="/logo.png"
          alt="OlivaGest"
          className="w-20 h-20 mb-4"
          style={{ borderRadius: '22px', objectFit: 'contain' }}
        />
        <h1 className="text-white text-2xl font-bold">OlivaGest</h1>
        <p style={{ color: '#4ade80' }} className="text-sm mt-1">Portal del Socio</p>
      </div>

      {!enviado ? (
        <div className="w-full max-w-sm">
          <div className="rounded-2xl p-6"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <h2 className="text-white font-semibold text-lg mb-1">Accede a tu portal</h2>
            <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Escribe tu email y te enviamos un enlace de acceso directo.
              <br /><span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>Sin contraseña · Sesión guardada</span>
            </p>

            <form onSubmit={handleSubmit}>
              <label className="block text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Tu correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="nombre@email.com"
                required
                disabled={loading}
                className="w-full rounded-xl px-4 py-3 text-sm mb-4 outline-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  border: '1.5px solid rgba(255,255,255,0.2)',
                  color: '#ffffff',
                  caretColor: '#4ade80',
                  WebkitTextFillColor: '#ffffff',
                }}
                onFocus={e => { e.target.style.border = '1.5px solid #4ade80'; e.target.style.outline = 'none' }}
                onBlur={e => { e.target.style.border = '1.5px solid rgba(255,255,255,0.2)' }}
              />

              {error && (
                <p className="text-red-400 text-xs mb-3">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3 rounded-xl font-bold text-sm transition-opacity disabled:opacity-50"
                style={{ backgroundColor: '#4ade80', color: '#0f172a' }}
              >
                {loading ? 'Enviando...' : 'Enviar enlace de acceso'}
              </button>
            </form>
          </div>

          <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Solo socios registrados en su cooperativa.
          </p>
        </div>
      ) : (
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.25)' }}>
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Revisa tu correo</h2>
          <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Hemos enviado un enlace a</p>
          <p className="font-bold mb-5" style={{ color: '#4ade80' }}>{email}</p>

          <div className="rounded-xl px-5 py-4 mb-4 text-left"
            style={{ backgroundColor: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
            <p className="text-xs font-bold mb-1" style={{ color: '#4ade80' }}>Una vez que accedas</p>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Tu sesión quedará guardada en este dispositivo durante meses. La próxima vez entrarás directamente, sin necesitar un nuevo enlace.
            </p>
          </div>

          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
            El enlace caduca en 1 hora · Solo funciona una vez
          </p>
          <button
            onClick={() => { setEnviado(false); setEmail('') }}
            className="mt-5 text-xs underline"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            Usar otro email
          </button>
        </div>
      )}
    </div>
  )
}
