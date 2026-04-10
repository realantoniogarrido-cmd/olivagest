'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const ESTADO_CFG = {
  borrador:       { label: 'En preparación',   color: '#64748b', bg: '#f1f5f9' },
  pendiente_pago: { label: 'Pendiente de pago', color: '#d97706', bg: '#fffbeb' },
  pagada:         { label: 'Pagada ✓',          color: '#16a34a', bg: '#f0fdf4' },
}

// Helper: llamada autenticada a la API del portal
async function portalFetch(path, token, params = {}) {
  const url = new URL(path, window.location.origin)
  Object.entries(params).forEach(([k, v]) => v && url.searchParams.set(k, v))
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  return res.json()
}

export default function PortalDashboard() {
  const router   = useRouter()
  const tokenRef = useRef(null)

  const [socio,      setSocio]      = useState(null)
  const [campanyas,  setCampanyas]  = useState([])
  const [campActual, setCampActual] = useState('')
  const [entregas,   setEntregas]   = useState([])
  const [liquidacion,setLiquidacion]= useState(null)
  const [historico,  setHistorico]  = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (!session) { router.replace('/portal'); return }
        tokenRef.current = session.access_token
        init(session.access_token)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (socio && campActual && tokenRef.current) cargarCampana(campActual, tokenRef.current)
  }, [socio, campActual])

  async function init(token) {
    // Obtener socio via API (bypass RLS)
    const meData = await portalFetch('/api/portal/me', token)
    if (!meData?.socio) {
      await supabase.auth.signOut()
      router.replace('/portal')
      return
    }
    setSocio(meData.socio)

    // Obtener resumen de entregas para histórico (bypass RLS)
    const entsData = await portalFetch('/api/portal/entregas', token)
    const ents = entsData?.data || []

    const camps = [...new Set(ents.map(e => e.campana).filter(Boolean))].sort().reverse()
    setCampanyas(camps)

    const hist = camps.map(c => ({
      campana: c,
      kg: ents.filter(e => e.campana === c)
             .reduce((sum, e) => sum + (parseFloat(e.kg_neto || e.kg_bruto) || 0), 0),
    }))
    setHistorico(hist)

    if (camps.length > 0) setCampActual(camps[0])
    else setLoading(false)
  }

  async function cargarCampana(camp, token) {
    setLoading(true)
    const [entsData, liqData] = await Promise.all([
      portalFetch('/api/portal/entregas',      token, { campana: camp }),
      portalFetch('/api/portal/liquidaciones', token, { campana: camp }),
    ])
    setEntregas(entsData?.data || [])
    setLiquidacion(liqData?.data || null)
    setLoading(false)
  }

  const totalKg  = entregas.reduce((s, e) => s + (parseFloat(e.kg_neto || e.kg_bruto) || 0), 0)
  const kgAceite = liquidacion?.kg_aceite_final
    ? parseFloat(liquidacion.kg_aceite_final)
    : totalKg * ((parseFloat(liquidacion?.rendimiento_neto) || 20) / 100)
  const estCfg = ESTADO_CFG[liquidacion?.estado || 'borrador']

  if (!socio && !loading) return null

  return (
    <div className="px-4 py-5 space-y-4">

      {/* Selector campaña */}
      {campanyas.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {campanyas.map(c => (
            <button key={c} onClick={() => setCampActual(c)}
              className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all"
              style={{
                backgroundColor: campActual === c ? '#0f172a' : '#e2e8f0',
                color: campActual === c ? '#4ade80' : '#64748b',
              }}>
              {c}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : campanyas.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm">Todavía no tienes entregas registradas.<br />Contacta con la cooperativa.</p>
        </div>
      ) : (
        <>
          {/* Kg campaña actual */}
          <div className="rounded-2xl p-5 text-white" style={{ backgroundColor: '#0f172a' }}>
            <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#4ade80' }}>
              Campaña {campActual}
            </p>
            <p className="text-5xl font-bold">
              {totalKg >= 1000
                ? `${(totalKg / 1000).toLocaleString('es-ES', { maximumFractionDigits: 2 })} t`
                : `${totalKg.toLocaleString('es-ES', { maximumFractionDigits: 0 })} kg`}
            </p>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
              aceituna entregada · {entregas.length} {entregas.length === 1 ? 'entrega' : 'entregas'}
            </p>
            {kgAceite > 0 && (
              <div className="mt-3 pt-3 flex items-center gap-2"
                style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <p className="text-sm" style={{ color: '#4ade80' }}>
                  ≈ {kgAceite.toLocaleString('es-ES', { maximumFractionDigits: 0 })} kg de aceite
                  {liquidacion?.rendimiento_neto && ` (${liquidacion.rendimiento_neto}% rendimiento)`}
                </p>
              </div>
            )}
          </div>

          {/* Liquidación */}
          <div className="rounded-2xl p-5"
            style={{ backgroundColor: estCfg.bg, border: `1px solid ${estCfg.color}33` }}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: estCfg.color }}>
                Liquidación
              </p>
              <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ backgroundColor: `${estCfg.color}18`, color: estCfg.color }}>
                {estCfg.label}
              </span>
            </div>
            {liquidacion ? (
              <>
                <p className="text-3xl font-bold mt-1" style={{ color: '#0f172a' }}>
                  {parseFloat(liquidacion.importe_total).toLocaleString('es-ES', {
                    style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
                  })}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Precio aceite</p>
                    <p className="font-semibold text-gray-800">{parseFloat(liquidacion.precio_kg).toFixed(3)} €/kg</p>
                  </div>
                  {liquidacion.kg_aceite_final && (
                    <div>
                      <p className="text-xs text-gray-400">Kg aceite</p>
                      <p className="font-semibold text-gray-800">
                        {parseFloat(liquidacion.kg_aceite_final).toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg
                      </p>
                    </div>
                  )}
                  {liquidacion.fecha_pago && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-400">Fecha de pago</p>
                      <p className="font-semibold" style={{ color: '#16a34a' }}>
                        {new Date(liquidacion.fecha_pago).toLocaleDateString('es-ES', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="mt-2">
                <p className="text-gray-500 text-sm">Liquidación pendiente de calcular.</p>
                <p className="text-xs text-gray-400 mt-1">La cooperativa aún no ha generado tu liquidación para esta campaña.</p>
              </div>
            )}
          </div>

          {/* Histórico */}
          {historico.length > 1 && (
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">Histórico de producción</h2>
              <div className="space-y-2">
                {historico.map(h => {
                  const max = Math.max(...historico.map(x => x.kg))
                  const pct = max > 0 ? (h.kg / max) * 100 : 0
                  return (
                    <div key={h.campana}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={`font-medium ${h.campana === campActual ? 'text-green-600' : 'text-gray-600'}`}>
                          {h.campana} {h.campana === campActual && '← actual'}
                        </span>
                        <span className="text-gray-400">
                          {h.kg >= 1000 ? `${(h.kg/1000).toFixed(2)} t` : `${h.kg.toLocaleString('es-ES',{maximumFractionDigits:0})} kg`}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: h.campana === campActual ? '#4ade80' : '#cbd5e1' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
