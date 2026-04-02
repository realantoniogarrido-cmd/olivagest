'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getPortalSocio } from '@/lib/portalAuth'

const CALIDAD_CFG = {
  Extra:    { bg: '#f0fdf4', color: '#16a34a' },
  Primera:  { bg: '#eff6ff', color: '#2563eb' },
  Segunda:  { bg: '#fffbeb', color: '#d97706' },
}

export default function PortalEntregas() {
  const router = useRouter()
  const [socio, setSocio]           = useState(null)
  const [entregas, setEntregas]     = useState([])
  const [campanyas, setCampanyas]   = useState([])
  const [campFiltro, setCampFiltro] = useState('')
  const [loading, setLoading]       = useState(true)

  useEffect(() => { init() }, [])

  async function init() {
    const s = await getPortalSocio()
    if (!s) { router.replace('/portal'); return }
    setSocio(s)

    const { data } = await supabase
      .from('entregas')
      .select('*, parcelas(nombre)')
      .eq('user_id', s.user_id)
      .eq('socio_id', s.id)
      .order('fecha', { ascending: false })

    const ents = data || []
    setEntregas(ents)

    const camps = [...new Set(ents.map(e => e.campaña).filter(Boolean))].sort().reverse()
    setCampanyas(camps)
    if (camps.length > 0) setCampFiltro(camps[0])
    setLoading(false)
  }

  const filtradas = campFiltro ? entregas.filter(e => e.campaña === campFiltro) : entregas
  const totalKg   = filtradas.reduce((s, e) => s + (parseFloat(e.kg) || 0), 0)

  return (
    <div className="px-4 py-5">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Mis entregas</h1>
      <p className="text-sm text-gray-400 mb-4">{entregas.length} entregas en total</p>

      {/* Selector campaña */}
      {campanyas.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 mb-4">
          <button
            onClick={() => setCampFiltro('')}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              backgroundColor: campFiltro === '' ? '#0f172a' : '#e2e8f0',
              color: campFiltro === '' ? '#4ade80' : '#64748b',
            }}
          >
            Todas
          </button>
          {campanyas.map(c => (
            <button
              key={c}
              onClick={() => setCampFiltro(c)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                backgroundColor: campFiltro === c ? '#0f172a' : '#e2e8f0',
                color: campFiltro === c ? '#4ade80' : '#64748b',
              }}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <svg className="animate-spin h-7 w-7 text-green-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : filtradas.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-12">No hay entregas para esta campaña.</p>
      ) : (
        <>
          {/* Resumen campaña */}
          <div className="rounded-xl px-4 py-3 mb-4 flex items-center justify-between"
            style={{ backgroundColor: '#0f172a' }}>
            <p className="text-xs text-gray-400">{filtradas.length} entregas · {campFiltro || 'todas'}</p>
            <p className="font-bold text-white">
              {totalKg >= 1000
                ? `${(totalKg / 1000).toFixed(2)} t`
                : `${totalKg.toLocaleString('es-ES', { maximumFractionDigits: 0 })} kg`}
            </p>
          </div>

          {/* Lista */}
          <div className="space-y-2">
            {filtradas.map(e => {
              const fecha = e.fecha || e.created_at
              const cal   = CALIDAD_CFG[e.calidad]
              return (
                <div key={e.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-gray-900">
                          {parseFloat(e.kg).toLocaleString('es-ES', { maximumFractionDigits: 0 })} kg
                        </p>
                        {e.calidad && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: cal?.bg || '#f1f5f9', color: cal?.color || '#64748b' }}>
                            {e.calidad}
                          </span>
                        )}
                      </div>
                      {e.parcelas?.nombre && (
                        <p className="text-xs text-gray-500">📍 {e.parcelas.nombre}</p>
                      )}
                      {e.rendimiento && (
                        <p className="text-xs text-gray-400 mt-0.5">Rendimiento: {e.rendimiento}%</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="text-xs text-gray-400">
                        {fecha
                          ? new Date(fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                          : '—'}
                      </p>
                      {e.campaña && (
                        <p className="text-xs text-gray-300 mt-0.5">{e.campaña}</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
