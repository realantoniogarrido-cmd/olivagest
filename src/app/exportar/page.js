'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const TIPOS = [
  {
    key: 'socios',
    label: 'Socios',
    desc: 'Nombre, DNI, teléfono, email, municipio, cuenta bancaria…',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    key: 'entregas',
    label: 'Entregas',
    desc: 'Socio, parcela, campaña, kg bruto, kg neto, rendimiento, calidad…',
    filtro: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    key: 'liquidaciones',
    label: 'Liquidaciones',
    desc: 'Socio, campaña, kg aceite, rendimiento, precio, importe, estado…',
    filtro: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: 'parcelas',
    label: 'Parcelas',
    desc: 'Socio, nombre, municipio, variedad, superficie, referencia catastral…',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
]

export default function ExportarPage() {
  const [tipo,           setTipo]           = useState('entregas')
  const [campanyas,      setCampanyas]      = useState([])
  const [filtroCampaña,  setFiltroCampaña]  = useState('')
  const [loading,        setLoading]        = useState(false)
  const [ultimaExport,   setUltimaExport]   = useState(null)
  const [error,          setError]          = useState('')

  useEffect(() => { cargarCampanyas() }, [])

  async function cargarCampanyas() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch('/api/exportar/campanyas', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (res.ok) {
      const { campanyas } = await res.json()
      setCampanyas(campanyas || [])
    }
  }

  async function exportar() {
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Sesión expirada'); setLoading(false); return }

      const res = await fetch('/api/exportar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tipo, filtroCampaña }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Error al generar el archivo')
        setLoading(false)
        return
      }

      // Descargar el archivo
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      const fecha = new Date().toISOString().slice(0, 10)
      const nombre = filtroCampaña ? `${tipo}_${filtroCampaña}` : `${tipo}_olivagest`
      a.href     = url
      a.download = `${nombre}_${fecha}.xlsx`
      a.click()
      URL.revokeObjectURL(url)

      // Extraer conteo de registros de la cabecera si la hay
      setUltimaExport({
        tipo: TIPOS.find(t => t.key === tipo)?.label || tipo,
        fecha: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      })
    } catch (e) {
      setError('Error inesperado: ' + e.message)
    }
    setLoading(false)
  }

  const tipoActual = TIPOS.find(t => t.key === tipo)

  return (
    <div className="p-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Exportar datos</h1>
        <p className="text-gray-500 mt-1 text-sm">Descarga tus datos en formato Excel con todos los campos</p>
      </div>

      {/* Selector de tipo */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {TIPOS.map(t => {
          const active = tipo === t.key
          return (
            <button
              key={t.key}
              onClick={() => { setTipo(t.key); setFiltroCampaña('') }}
              className="text-left p-4 rounded-xl border-2 transition-all"
              style={{
                borderColor:     active ? '#0f172a' : '#e5e7eb',
                backgroundColor: active ? '#0f172a' : 'white',
              }}
            >
              <div className="flex items-center gap-2.5 mb-1.5">
                <span style={{ color: active ? '#4ade80' : '#6b7280' }}>{t.icon}</span>
                <span className="font-semibold text-sm" style={{ color: active ? 'white' : '#111827' }}>
                  {t.label}
                </span>
              </div>
              <p className="text-xs leading-snug" style={{ color: active ? 'rgba(255,255,255,0.5)' : '#9ca3af' }}>
                {t.desc}
              </p>
            </button>
          )
        })}
      </div>

      {/* Filtro campaña */}
      {tipoActual?.filtro && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Filtrar por campaña
            <span className="text-gray-400 font-normal ml-1">(opcional)</span>
          </label>
          <select
            value={filtroCampaña}
            onChange={e => setFiltroCampaña(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-gray-400"
          >
            <option value="">Todas las campañas</option>
            {campanyas.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Botón exportar */}
      <button
        onClick={exportar}
        disabled={loading}
        className="w-full py-3.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
        style={{ backgroundColor: '#0f172a' }}
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Generando Excel…
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Descargar Excel · {tipoActual?.label}
          </>
        )}
      </button>

      {/* Confirmación */}
      {ultimaExport && !loading && (
        <div className="mt-4 p-3.5 rounded-xl flex items-center gap-3"
          style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-green-800">
            <strong>{ultimaExport.tipo}</strong> exportado correctamente a las {ultimaExport.fecha}
          </p>
        </div>
      )}

      {/* Info */}
      <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <p className="text-xs text-gray-500 leading-relaxed">
          El Excel incluye <strong>todos los campos</strong> disponibles, cabeceras con color, filas alternadas y totales automáticos.
          Formato <strong>.xlsx</strong> compatible con Excel, LibreOffice y Google Sheets.
        </p>
      </div>
    </div>
  )
}
