'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function PortalLoginPage() {
  const router = useRouter()
  const [tab, setTab]         = useState('login') // 'login' | 'register' | 'reset'
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [resetEnviado, setResetEnviado] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (session) router.replace('/portal/dashboard')
        else setLoading(false)
      }
      if (event === 'SIGNED_IN' && session) router.replace('/portal/dashboard')
    })
    return () => subscription.unsubscribe()
  }, [router])

  // ── Login ─────────────────────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (err) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
    }
    // Si va bien, onAuthStateChange → SIGNED_IN → router.replace('/portal/dashboard')
  }

  // ── Registro primera vez ──────────────────────────────────────────
  async function handleRegister(e) {
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

    // Crear cuenta server-side (verifica socios + email_confirm: true)
    const res = await fetch('/api/portal/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Error al crear la cuenta')
      setLoading(false)
      return
    }

    // Login automático tras registro
    const { error: loginErr } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (loginErr) {
      setError('Cuenta creada. Ahora inicia sesión con tu email y contraseña.')
      setTab('login')
      setLoading(false)
    }
    // Si va bien → SIGNED_IN event → redirect dashboard
  }

  // ── Recuperar contraseña ──────────────────────────────────────────
  async function handleReset(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${appUrl}/portal/callback?type=recovery` }
    )
    setLoading(false)
    if (err) { setError(err.message); return }
    setResetEnviado(true)
  }

  // ── Loading ───────────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────
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
        <p className="text-sm mt-1" style={{ color: '#4ade80' }}>Portal del Socio</p>
      </div>

      <div className="w-full max-w-sm">
        {/* Tabs */}
        {tab !== 'reset' && (
          <div className="flex rounded-xl p-1 mb-5"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
            {[
              { id: 'login',    label: 'Iniciar sesión' },
              { id: 'register', label: 'Crear cuenta' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setError('') }}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: tab === t.id ? '#ffffff' : 'transparent',
                  color: tab === t.id ? '#0f172a' : 'rgba(255,255,255,0.5)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="rounded-2xl p-6"
          style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>

          {/* ── LOGIN ── */}
          {tab === 'login' && (
            <>
              <h2 className="text-white font-semibold text-lg mb-1">Bienvenido de nuevo</h2>
              <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Accede con tu email y contraseña
              </p>
              <form onSubmit={handleLogin} className="space-y-3">
                <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="nombre@email.com" />
                <Field label="Contraseña" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <button type="submit" disabled={loading || !email || !password}
                  className="w-full py-3 rounded-xl font-bold text-sm mt-1 disabled:opacity-50 transition-opacity"
                  style={{ backgroundColor: '#4ade80', color: '#0f172a' }}>
                  Entrar
                </button>
              </form>
              <button onClick={() => { setTab('reset'); setError('') }}
                className="mt-4 text-xs w-full text-center"
                style={{ color: 'rgba(255,255,255,0.3)' }}>
                ¿Olvidaste tu contraseña?
              </button>
            </>
          )}

          {/* ── REGISTRO ── */}
          {tab === 'register' && (
            <>
              <h2 className="text-white font-semibold text-lg mb-1">Crea tu acceso</h2>
              <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Solo socios registrados en la cooperativa
              </p>
              <form onSubmit={handleRegister} className="space-y-3">
                <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="nombre@email.com" />
                <Field label="Elige una contraseña" type="password" value={password} onChange={setPassword} placeholder="Mín. 6 caracteres" />
                <Field label="Repite la contraseña" type="password" value={confirm} onChange={setConfirm} placeholder="••••••••" />
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <button type="submit" disabled={loading || !email || !password || !confirm}
                  className="w-full py-3 rounded-xl font-bold text-sm mt-1 disabled:opacity-50 transition-opacity"
                  style={{ backgroundColor: '#4ade80', color: '#0f172a' }}>
                  Crear cuenta y entrar
                </button>
              </form>
              <p className="mt-4 text-xs text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Tu email debe estar registrado en la cooperativa
              </p>
            </>
          )}

          {/* ── RESET ── */}
          {tab === 'reset' && !resetEnviado && (
            <>
              <h2 className="text-white font-semibold text-lg mb-1">Recuperar contraseña</h2>
              <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Te enviamos un enlace para crear una nueva contraseña
              </p>
              <form onSubmit={handleReset} className="space-y-3">
                <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="nombre@email.com" />
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <button type="submit" disabled={loading || !email}
                  className="w-full py-3 rounded-xl font-bold text-sm mt-1 disabled:opacity-50"
                  style={{ backgroundColor: '#4ade80', color: '#0f172a' }}>
                  Enviar enlace
                </button>
              </form>
              <button onClick={() => { setTab('login'); setError('') }}
                className="mt-4 text-xs w-full text-center"
                style={{ color: 'rgba(255,255,255,0.3)' }}>
                ← Volver
              </button>
            </>
          )}

          {/* ── RESET ENVIADO ── */}
          {tab === 'reset' && resetEnviado && (
            <div className="text-center py-2">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'rgba(74,222,128,0.15)' }}>
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-white font-semibold mb-1">Revisa tu correo</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Hemos enviado un enlace a <span style={{ color: '#4ade80' }}>{email}</span>
              </p>
              <button onClick={() => { setTab('login'); setResetEnviado(false) }}
                className="mt-5 text-xs underline"
                style={{ color: 'rgba(255,255,255,0.3)' }}>
                Volver al inicio de sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Componente campo reutilizable
function Field({ label, type, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
        style={{
          backgroundColor: 'rgba(255,255,255,0.1)',
          border: '1.5px solid rgba(255,255,255,0.15)',
          color: '#ffffff',
          caretColor: '#4ade80',
          WebkitTextFillColor: '#ffffff',
        }}
        onFocus={e => { e.target.style.border = '1.5px solid #4ade80' }}
        onBlur={e => { e.target.style.border = '1.5px solid rgba(255,255,255,0.15)' }}
      />
    </div>
  )
}
