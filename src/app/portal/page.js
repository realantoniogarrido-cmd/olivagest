'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function PortalLoginPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/portal/callback`,
      },
    })

    if (error) {
      setError('No se pudo enviar el acceso. Comprueba tu email.')
    } else {
      setEnviado(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: '#0f172a' }}>

      {/* Logo */}
      <div className="mb-8 flex flex-col items-center">
        <img src="/logo.png" alt="OlivaGest" className="w-20 h-20 rounded-2xl mb-4 shadow-lg" />
        <h1 className="text-white text-2xl font-bold">OlivaGest</h1>
        <p style={{ color: '#4ade80' }} className="text-sm mt-1">Portal del Socio</p>
      </div>

      {!enviado ? (
        <div className="w-full max-w-sm">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-white font-semibold text-lg mb-1">Accede a tu portal</h2>
            <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Introduce tu email y te enviamos un enlace de acceso directo. Sin contraseña.
            </p>

            <form onSubmit={handleSubmit}>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Tu correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="nombre@email.com"
                required
                className="w-full rounded-xl px-4 py-3 text-sm mb-4 outline-none focus:ring-2"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'white',
                  caretColor: '#4ade80',
                }}
              />

              {error && (
                <p className="text-red-400 text-xs mb-3">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-50"
                style={{ backgroundColor: '#4ade80', color: '#0f172a' }}
              >
                {loading ? 'Enviando...' : 'Enviar enlace de acceso'}
              </button>
            </form>
          </div>

          <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Solo socios registrados en su cooperativa.<br />
            Contacta con la cooperativa si tienes problemas.
          </p>
        </div>
      ) : (
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: 'rgba(74,222,128,0.15)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Revisa tu correo</h2>
          <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Hemos enviado un enlace de acceso a
          </p>
          <p className="font-semibold mb-6" style={{ color: '#4ade80' }}>{email}</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Haz clic en el enlace del email para entrar.<br />
            El enlace caduca en 1 hora.
          </p>
          <button
            onClick={() => setEnviado(false)}
            className="mt-6 text-xs underline"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            Usar otro email
          </button>
        </div>
      )}
    </div>
  )
}
