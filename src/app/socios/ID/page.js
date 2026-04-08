'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'
import { useRouter, useParams } from 'next/navigation'

export default function FichaSocioPage() {
  const router = useRouter()
  const { id } = useParams()
  const [cooperativa, setCooperativa] = useState('')
  const [socio, setSocio] = useState(null)
  const [entregas, setEntregas] = useState([])
  const [liquidacion, setLiquidacion] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargarDatos() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: { user } } = await supabase.auth.getUser()
      setCooperativa(user?.user_metadata?.cooperativa || 'Mi Cooperativa')

      // Datos del socio
      const { data: socioData } = await supabase
        .from('socios').select('*').eq('id', id).single()
      setSocio(socioData)

      // Entregas del socio
      const { data: entregasData } = await supabase
        .from('entregas')
        .select('*, campanas(nombre)')
        .eq('socio_id', id)
        .order('fecha', { ascending: false })
      setEntregas(entregasData || [])

      // Liquidación del socio (campaña activa)
      const { data: campana } = await supabase
        .from('campanas').select('id').eq('activa', true).single()
      if (campana) {
        const { data: liq } = await supabase
          .from('liquidaciones')
          .select('*')
          .eq('socio_id', id)
          .eq('campana_id', campana.id)
          .single()
        setLiquidacion(liq)
      }

      setLoading(false)
    }
    cargarDatos()
  }, [id, router])

  const totalKg = entregas.reduce((sum, e) => sum + (e.kg_bruto || 0), 0)
  const totalAceite = entregas.reduce((sum, e) => e.rendimiento ? sum + (e.kg_bruto * e.rendimiento) / 100 : sum, 0)

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#f5f5f0]">
      <div className="text-[#7ab648] font-medium">Cargando...</div>
    </div>
  )

  if (!socio) return (
    <div className="flex h-screen items-center justify-center bg-[#f5f5f0]">
      <div className="text-gray-500">Socio no encontrado</div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-[#f5f5f0]">
      <Sidebar cooperativa={cooperativa} />
      <main className="ml-60 flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-100 px-7 h-14 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/socios')}
              className="text-gray-400 hover:text-gray-700 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
            </button>
            <div>
              <h1 className="text-base font-bold text-gray-900">{socio.nombre}</h1>
              <p className="text-xs text-gray-400">Ficha del socio</p>
            </div>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${socio.activo ? 'bg-[#e8f5d8] text-[#2d6a0d]' : 'bg-gray-100 text-gray-400'}`}>
            {socio.activo ? 'Activo' : 'Baja'}
          </span>
        </header>

        <div className="p-7">
          {/* Datos personales */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Datos personales</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Nombre</span>
                  <span className="text-sm font-semibold text-gray-900">{socio.nombre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">DNI</span>
                  <span className="text-sm font-mono text-gray-700">{socio.dni || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Teléfono</span>
                  <span className="text-sm text-gray-700">{socio.telefono || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Email</span>
                  <span className="text-sm text-gray-700">{socio.email || '—'}</span>
                </div>
              </div>
            </div>

            {/* Liquidación campaña activa */}
            <div className={`rounded-xl border p-6 ${liquidacion ? 'bg-[#1a2e1a] border-[#1a2e1a]' : 'bg-white border-gray-100'}`}>
              <h2 className={`text-xs font-bold uppercase tracking-wide mb-4 ${liquidacion ? 'text-white/50' : 'text-gray-400'}`}>
                Liquidación campaña activa
              </h2>
              {liquidacion ? (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-white/60">Kg aceituna</span>
                    <span className="text-sm font-semibold text-white">{liquidacion.kg_aceituna?.toLocaleString('es-ES')} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-white/60">Kg aceite</span>
                    <span className="text-sm font-semibold text-white">{liquidacion.kg_aceite?.toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-white/60">Precio/kg</span>
                    <span className="text-sm text-white/80">{liquidacion.precio_kg?.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
                  </div>
                  <div className="border-t border-white/10 pt-3 flex justify-between items-center">
                    <span className="text-sm font-bold text-white">Total a cobrar</span>
                    <span className="text-2xl font-extrabold text-white">
                      {liquidacion.importe_total?.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-gray-400 text-sm">Aún sin liquidación calculada para esta campaña.</div>
              )}
            </div>
          </div>

          {/* Resumen numérico */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="text-xs font-medium uppercase tracking-wide mb-2 text-gray-400">Total kg entregados</div>
              <div className="text-2xl font-extrabold text-gray-900">{(totalKg / 1000).toFixed(2)}<span className="text-sm font-medium ml-1 text-gray-400">t</span></div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="text-xs font-medium uppercase tracking-wide mb-2 text-gray-400">Aceite estimado</div>
              <div className="text-2xl font-extrabold text-gray-900">{(totalAceite / 1000).toFixed(2)}<span className="text-sm font-medium ml-1 text-gray-400">t</span></div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="text-xs font-medium uppercase tracking-wide mb-2 text-gray-400">Nº entregas</div>
              <div className="text-2xl font-extrabold text-gray-900">{entregas.length}</div>
            </div>
          </div>

          {/* Historial entregas */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="text-sm font-bold text-gray-900">Historial de entregas</h2>
            </div>
            {entregas.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400 text-sm">No hay entregas registradas para este socio.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-gray-400 border-b border-gray-50">
                    <th className="text-left px-6 py-3">Fecha</th>
                    <th className="text-left px-6 py-3">Campaña</th>
                    <th className="text-right px-6 py-3">Kg bruto</th>
                    <th className="text-right px-6 py-3">Rendim.</th>
                    <th className="text-right px-6 py-3">Kg aceite</th>
                    <th className="text-left px-6 py-3">Calidad</th>
                    <th className="text-left px-6 py-3">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {entregas.map((e, i) => (
                    <tr key={e.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-6 py-3 text-gray-700">{new Date(e.fecha + 'T00:00:00').toLocaleDateString('es-ES')}</td>
                      <td className="px-6 py-3 text-gray-500 text-xs">{e.campanas?.nombre || '—'}</td>
                      <td className="px-6 py-3 text-right font-medium tabular-nums">{e.kg_bruto?.toLocaleString('es-ES')} kg</td>
                      <td className="px-6 py-3 text-right text-gray-500 tabular-nums">{e.rendimiento != null ? `${e.rendimiento}%` : '—'}</td>
                      <td className="px-6 py-3 text-right text-[#4a7a1e] font-semibold tabular-nums">
                        {e.rendimiento ? ((e.kg_bruto * e.rendimiento) / 100).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' kg' : '—'}
                      </td>
                      <td className="px-6 py-3">
                        <span className="bg-[#e8f5d8] text-[#2d6a0d] text-xs font-semibold px-2 py-0.5 rounded">{e.calidad || 'AOVE'}</span>
                      </td>
                      <td className="px-6 py-3 text-gray-400 text-xs">{e.notas || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}