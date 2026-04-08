'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getPortalSocioFromSession } from '@/lib/portalAuth'

export default function PortalParcelas() {
  const router = useRouter()
  const [parcelas, setParcelas]   = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (!session) { router.replace('/portal'); return }
        init(session)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function init(session) {
    const s = await getPortalSocioFromSession(session)
    if (!s) { await supabase.auth.signOut(); router.replace('/portal'); return }

    const { data } = await supabase
      .from('parcelas')
      .select('*')
      .eq('user_id', s.user_id)
      .eq('socio_id', s.id)
      .order('nombre')

    setParcelas(data || [])
    setLoading(false)
  }

  const supTotal = parcelas.reduce((s, p) => s + (parseFloat(p.superficie) || 0), 0)

  return (
    <div className="px-4 py-5">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Mis parcelas</h1>
      <p className="text-sm text-gray-400 mb-4">
        {parcelas.length} {parcelas.length === 1 ? 'parcela' : 'parcelas'}
        {supTotal > 0 && ` · ${supTotal.toLocaleString('es-ES', { maximumFractionDigits: 2 })} ha totales`}
      </p>

      {loading ? (
        <div className="flex justify-center py-16">
          <svg className="animate-spin h-7 w-7 text-green-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : parcelas.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-12">No tienes parcelas registradas.<br />Contacta con la cooperativa.</p>
      ) : (
        <div className="space-y-3">
          {parcelas.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-gray-900">{p.nombre || 'Sin nombre'}</p>
                  {p.municipio && (
                    <p className="text-xs text-gray-400 mt-0.5">📍 {p.municipio}</p>
                  )}
                </div>
                {p.superficie && (
                  <div className="text-right">
                    <p className="text-lg font-bold" style={{ color: '#0f172a' }}>
                      {parseFloat(p.superficie).toLocaleString('es-ES', { maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-400">ha</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm pt-3 border-t border-gray-50">
                {p.variedad && (
                  <div>
                    <p className="text-xs text-gray-400">Variedad</p>
                    <p className="font-medium text-gray-700">{p.variedad}</p>
                  </div>
                )}
                {p.rendimiento && (
                  <div>
                    <p className="text-xs text-gray-400">Rendimiento</p>
                    <p className="font-medium text-gray-700">{p.rendimiento}%</p>
                  </div>
                )}
                {p.pendiente && (
                  <div>
                    <p className="text-xs text-gray-400">Pendiente</p>
                    <p className="font-medium text-gray-700">{p.pendiente}</p>
                  </div>
                )}
                {p.sistema_riego && (
                  <div>
                    <p className="text-xs text-gray-400">Riego</p>
                    <p className="font-medium text-gray-700">{p.sistema_riego}</p>
                  </div>
                )}
              </div>

              {p.observaciones && (
                <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-50">
                  {p.observaciones}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
