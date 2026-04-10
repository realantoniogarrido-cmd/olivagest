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
  general:  { label: 'Aviso general', color: '#64748b', bg: '#f8fafc' },
}

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
    case 'pago':
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

  const [avisos,  setAvisos]  = useState([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)

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
        {noLeidos > 0 && (
          <button
            onClick={marcarTodosLeidos}
            disabled={marking}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Marcar todo leído
          </button>
        )}
      </div>

      {/* Empty state */}
      {avisos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-600">Sin notificaciones</p>
          <p className="text-xs mt-1 text-gray-400">La cooperativa te enviará avisos aquí</p>
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
                className="bg-white flex gap-4 px-4 py-4 rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                style={{
                  borderColor: aviso.leida ? '#e5e7eb' : cfg.color + '55',
                  borderLeftWidth: aviso.leida ? '1px' : '3px',
                }}
              >
                {/* Icono */}
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                    {tipoIcon(aviso.tipo)}
                  </div>
                </div>

                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 leading-snug">
                      {aviso.titulo}
                    </p>
                    {!aviso.leida && (
                      <span className="flex-shrink-0 w-2 h-2 rounded-full mt-1.5"
                        style={{ backgroundColor: cfg.color }} />
                    )}
                  </div>
                  {aviso.mensaje && (
                    <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">
                      {aviso.mensaje}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                      style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      {fechaStr} · {horaStr}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
