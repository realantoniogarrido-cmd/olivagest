'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function portalFetch(url, token, options = {}) {
  return fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  })
}

const TIPO_CFG = {
  reunion:  { label: 'Reunión',       color: '#4f46e5', bg: '#eef2ff' },
  pago:     { label: 'Pago',          color: '#16a34a', bg: '#f0fdf4' },
  campana:  { label: 'Campaña',       color: '#ea580c', bg: '#fff7ed' },
  documento:{ label: 'Documento',     color: '#0369a1', bg: '#f0f9ff' },
  consulta: { label: 'Consulta',      color: '#7c3aed', bg: '#f5f3ff' },
  general:  { label: 'Aviso general', color: '#64748b', bg: '#f8fafc' },
}

const TIPOS_CONSULTA = [
  { value: 'consulta',  label: 'Consulta general' },
  { value: 'entrega',   label: 'Sobre una entrega' },
  { value: 'pago',      label: 'Sobre un pago' },
  { value: 'documento', label: 'Sobre un documento' },
  { value: 'campana',   label: 'Sobre la campaña' },
]

function getTipoCfg(tipo) {
  return TIPO_CFG[tipo] || TIPO_CFG.general
}

function tipoIcon(tipo) {
  switch (tipo) {
    case 'reunion':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    case 'pago': case 'entrega':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'campana':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
        </svg>
      )
    case 'documento':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    case 'consulta':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      )
    default:
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
  }
}

export default function AvisosPortalPage() {
  const router   = useRouter()
  const tokenRef = useRef(null)

  const [avisos,      setAvisos]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [marking,     setMarking]     = useState(false)
  const [modalOpen,   setModalOpen]   = useState(false)
  const [enviando,    setEnviando]    = useState(false)
  const [exito,       setExito]       = useState('')
  const [form, setForm] = useState({
    tipo:    'consulta',
    mensaje: '',
  })

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (!session) { router.replace('/portal'); return }
        tokenRef.current = session.access_token
        await cargarAvisos(session.access_token)
        setLoading(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

  async function cargarAvisos(token) {
    try {
      const res = await portalFetch('/api/portal/avisos', token)
      if (res.ok) { const { avisos } = await res.json(); setAvisos(avisos || []) }
    } catch {}
  }

  async function marcarTodosLeidos() {
    if (!tokenRef.current || marking) return
    setMarking(true)
    await portalFetch('/api/portal/avisos', tokenRef.current, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ todos: true }),
    })
    setAvisos(prev => prev.map(a => ({ ...a, leida: true })))
    setMarking(false)
  }

  async function marcarLeido(id) {
    if (!tokenRef.current) return
    await portalFetch('/api/portal/avisos', tokenRef.current, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setAvisos(prev => prev.map(a => a.id === id ? { ...a, leida: true } : a))
  }

  async function handleEnviarConsulta() {
    if (!form.mensaje.trim() || !tokenRef.current) return
    setEnviando(true)
    try {
      const res = await portalFetch('/api/portal/consultas', tokenRef.current, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: form.tipo, mensaje: form.mensaje }),
      })
      if (res.ok) {
        setExito('Mensaje enviado a la cooperativa')
        setTimeout(() => setExito(''), 4000)
        setModalOpen(false)
        setForm({ tipo: 'consulta', mensaje: '' })
      }
    } catch {}
    setEnviando(false)
  }

  const noLeidos = avisos.filter(a => !a.leida).length

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="animate-spin w-7 h-7 rounded-full border-2 border-gray-300 border-t-gray-600" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Notificaciones</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {noLeidos > 0
              ? `${noLeidos} sin leer`
              : avisos.length === 0 ? 'Sin notificaciones' : 'Todo al día'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {noLeidos > 0 && (
            <button
              onClick={marcarTodosLeidos}
              disabled={marking}
              className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Todo leído
            </button>
          )}
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl text-white transition-opacity"
            style={{ backgroundColor: '#0f172a' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Enviar consulta
          </button>
        </div>
      </div>

      {/* Feedback */}
      {exito && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium bg-green-50 border border-green-200 text-green-700">
          {exito}
        </div>
      )}

      {/* Empty state */}
      {avisos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-600">Sin notificaciones</p>
          <p className="text-xs mt-1 text-gray-400">La cooperativa te enviará avisos aquí</p>
          <button onClick={() => setModalOpen(true)}
            className="mt-5 text-sm font-semibold px-5 py-2.5 rounded-xl text-white"
            style={{ backgroundColor: '#0f172a' }}>
            Enviar consulta a la cooperativa
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {avisos.map(aviso => {
            const cfg = getTipoCfg(aviso.tipo)
            const fecha = new Date(aviso.created_at)
            const fechaStr = fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
            const horaStr  = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

            return (
              <div
                key={aviso.id}
                onClick={() => { if (!aviso.leida) marcarLeido(aviso.id) }}
                className="bg-white flex gap-4 px-4 py-4 rounded-xl shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                style={{
                  border: aviso.leida ? '1px solid #e5e7eb' : `1px solid ${cfg.color}55`,
                  borderLeftWidth: aviso.leida ? '1px' : '3px',
                }}
              >
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                    {tipoIcon(aviso.tipo)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 leading-snug">{aviso.titulo}</p>
                    {!aviso.leida && (
                      <span className="flex-shrink-0 w-2 h-2 rounded-full mt-1.5"
                        style={{ backgroundColor: cfg.color }} />
                    )}
                  </div>
                  {aviso.mensaje && (
                    <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{aviso.mensaje}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                      style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                    <span className="text-xs text-gray-400">{fechaStr} · {horaStr}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── MODAL ENVIAR CONSULTA ─────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

            {/* Header modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Enviar consulta</h2>
                <p className="text-xs text-gray-400 mt-0.5">La cooperativa recibirá tu mensaje</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body modal */}
            <div className="px-6 py-5 space-y-4">

              {/* Tipo */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Tema</label>
                <div className="flex flex-wrap gap-2">
                  {TIPOS_CONSULTA.map(t => (
                    <button key={t.value} onClick={() => setForm(f => ({ ...f, tipo: t.value }))}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                      style={{
                        backgroundColor: form.tipo === t.value ? '#0f172a' : '#f8fafc',
                        color:           form.tipo === t.value ? 'white'   : '#1e293b',
                        borderColor:     form.tipo === t.value ? '#0f172a' : '#cbd5e1',
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mensaje */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Mensaje</label>
                <textarea
                  value={form.mensaje}
                  onChange={e => setForm(f => ({ ...f, mensaje: e.target.value }))}
                  placeholder="Escribe tu consulta aquí…"
                  rows={4}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-500 resize-none placeholder-gray-400"
                />
              </div>
            </div>

            {/* Footer modal */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleEnviarConsulta}
                disabled={enviando || !form.mensaje.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
                style={{ backgroundColor: '#0f172a' }}>
                {enviando ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando…</>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Enviar mensaje
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
