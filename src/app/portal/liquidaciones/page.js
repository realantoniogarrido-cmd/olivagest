'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const ESTADO_CFG = {
  borrador:       { label: 'En preparación',    color: '#64748b', bg: '#f1f5f9' },
  pendiente_pago: { label: 'Pendiente de pago', color: '#d97706', bg: '#fffbeb' },
  pagada:         { label: 'Pagada',            color: '#16a34a', bg: '#f0fdf4' },
}

async function portalFetch(path, token, params = {}) {
  const url = new URL(path, window.location.origin)
  Object.entries(params).forEach(([k, v]) => v && url.searchParams.set(k, v))
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  return res.json()
}

export default function PortalLiquidaciones() {
  const router   = useRouter()
  const tokenRef = useRef(null)

  const [liquidaciones, setLiquidaciones] = useState([])
  const [loading,       setLoading]       = useState(true)

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

  async function init(token) {
    const meData = await portalFetch('/api/portal/me', token)
    if (!meData?.socio) { await supabase.auth.signOut(); router.replace('/portal'); return }

    const liqData = await portalFetch('/api/portal/liquidaciones', token)
    setLiquidaciones(liqData?.data || [])
    setLoading(false)
  }

  const totalPagado    = liquidaciones.filter(l => l.estado === 'pagada').reduce((s, l) => s + (parseFloat(l.importe_total) || 0), 0)
  const totalPendiente = liquidaciones.filter(l => l.estado !== 'pagada').reduce((s, l) => s + (parseFloat(l.importe_total) || 0), 0)

  return (
    <div className="px-4 py-5">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Mis liquidaciones</h1>
      <p className="text-sm text-gray-400 mb-4">{liquidaciones.length} liquidaciones registradas</p>

      {loading ? (
        <div className="flex justify-center py-16">
          <svg className="animate-spin h-7 w-7 text-green-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : liquidaciones.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-12">Todavía no tienes liquidaciones.<br />La cooperativa las generará al cerrar campaña.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-xl p-4" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <p className="text-xs font-medium text-green-600 mb-1">Total cobrado</p>
              <p className="text-xl font-bold text-green-700">
                {totalPagado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="rounded-xl p-4" style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
              <p className="text-xs font-medium text-amber-600 mb-1">Pendiente</p>
              <p className="text-xl font-bold text-amber-700">
                {totalPendiente.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {liquidaciones.map(liq => {
              const cfg = ESTADO_CFG[liq.estado || 'borrador']
              const tieneRendimiento = liq.kg_aceite_final && parseFloat(liq.kg_aceite_final) > 0
              return (
                <div key={liq.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: '#0f172a' }}>
                    <p className="text-white font-semibold text-sm">Campaña {liq.campana}</p>
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ backgroundColor: `${cfg.color}22`, color: cfg.color }}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="text-3xl font-bold mb-3" style={{ color: liq.estado === 'pagada' ? '#16a34a' : '#0f172a' }}>
                      {parseFloat(liq.importe_total).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })}
                    </p>
                    <div className="space-y-1.5 text-sm border-t border-gray-100 pt-3">
                      {tieneRendimiento ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Kg aceituna</span>
                            <span className="text-gray-700 font-medium">{parseFloat(liq.kg_totales).toLocaleString('es-ES',{maximumFractionDigits:0})} kg</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Rendimiento neto</span>
                            <span className="text-gray-700 font-medium">{liq.rendimiento_neto}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Kg aceite final</span>
                            <span className="font-semibold" style={{ color: '#16a34a' }}>{parseFloat(liq.kg_aceite_final).toLocaleString('es-ES',{maximumFractionDigits:1})} kg</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-100 pt-1.5">
                            <span className="text-gray-400">Precio aceite</span>
                            <span className="text-gray-700 font-medium">{parseFloat(liq.precio_kg).toFixed(3)} €/kg</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Kg aceituna</span>
                            <span className="text-gray-700 font-medium">{parseFloat(liq.kg_totales).toLocaleString('es-ES',{maximumFractionDigits:0})} kg</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Precio</span>
                            <span className="text-gray-700 font-medium">{parseFloat(liq.precio_kg).toFixed(3)} €/kg</span>
                          </div>
                        </>
                      )}
                      {liq.fecha_pago && (
                        <div className="flex justify-between pt-1">
                          <span className="text-gray-400">Pagado el</span>
                          <span className="font-semibold" style={{ color: '#16a34a' }}>
                            {new Date(liq.fecha_pago).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </span>
                        </div>
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
