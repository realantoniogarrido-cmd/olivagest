'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'
import { useRouter } from 'next/navigation'

function MetricCard({ label, value, unit, trend, highlight }) {
  return (
    <div className={`rounded-xl p-5 border ${highlight ? 'bg-[#1a2e1a] border-[#1a2e1a]' : 'bg-white border-gray-100'}`}>
      <div className={`text-xs font-medium uppercase tracking-wide mb-2 ${highlight ? 'text-white/50' : 'text-gray-400'}`}>
        {label}
      </div>
      <div className={`text-2xl font-extrabold tracking-tight ${highlight ? 'text-white' : 'text-gray-900'}`}>
        {value}
        {unit && <span className={`text-sm font-medium ml-1 ${highlight ? 'text-white/40' : 'text-gray-400'}`}>{unit}</span>}
      </div>
      {trend && <div className={`text-xs mt-1.5 ${highlight ? 'text-[#7ab648]' : 'text-gray-400'}`}>{trend}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [cooperativa, setCooperativa] = useState('')
  const [stats, setStats] = useState({ kgTotal: 0, sociosActivos: 0, totalEntregas: 0 })
  const [ultimasEntregas, setUltimasEntregas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargarDatos() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: entregas } = await supabase
        .from('entregas')
        .select('*, socios(nombre)')
        .order('created_at', { ascending: false })
        .limit(5)

      const { data: socios } = await supabase
        .from('socios')
        .select('id')
        .eq('activo', true)

      const { data: kgData } = await supabase
        .from('entregas')
        .select('kg_bruto')

      const totalKg = kgData?.reduce((sum, e) => sum + (e.kg_bruto || 0), 0) || 0

      setUltimasEntregas(entregas || [])
      setStats({
        kgTotal: (totalKg / 1000).toFixed(1),
        sociosActivos: socios?.length || 0,
        totalEntregas: kgData?.length || 0,
      })

      const { data: { user } } = await supabase.auth.getUser()
      setCooperativa(user?.user_metadata?.cooperativa || 'Mi Cooperativa')
      setLoading(false)
    }
    cargarDatos()
  }, [router])

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#f5f5f0]">
      <div className="text-[#7ab648] font-medium">Cargando...</div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-[#f5f5f0]">
      <Sidebar cooperativa={cooperativa} />
      <main className="ml-60 flex-1">

        <header className="bg-white border-b border-gray-100 px-7 h-14 flex items-center justify-between sticky top-0 z-40">
          <div>
            <h1 className="text-base font-bold text-gray-900">Panel general</h1>
            <p className="text-xs text-gray-400">Campaña 2025/2026</p>
          </div>
          <span className="bg-[#e8f5d8] border border-[#c5e09a] text-[#4a7a1e] text-xs font-semibold px-3 py-1 rounded-full">
            🟢 Campaña activa
          </span>
        </header>

        <div className="p-7">
          <div className="bg-[#f0f7e8] border border-[#c5e09a] rounded-xl p-4 mb-6 flex gap-3">
            <div className="w-8 h-8 bg-[#1a2e1a] rounded-lg flex items-center justify-center text-sm flex-shrink-0">🤖</div>
            <div>
              <div className="text-sm font-bold text-[#1a2e1a]">Asistente IA</div>
              <div className="text-sm text-[#3a5a1a] mt-0.5">Bienvenido a OlivaGest. Cuando tengas datos registrados, aquí aparecerán recomendaciones automáticas sobre precios y campaña.</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <MetricCard label="Kg entregados" value={stats.kgTotal} unit="t" trend="Campaña activa" highlight />
            <MetricCard label="Socios activos" value={stats.sociosActivos} trend="— Ver listado" />
            <MetricCard label="Entregas registradas" value={stats.totalEntregas} trend="— Ver todas" />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center">
              <h2 className="text-sm font-bold text-gray-900">Últimas entregas</h2>
              <a href="/entregas" className="text-xs text-[#7ab648] font-semibold">Ver todas →</a>
            </div>
            {ultimasEntregas.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400 text-sm">
                Aún no hay entregas. <a href="/entregas" className="text-[#7ab648] font-medium">Registrar primera entrega →</a>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-gray-400 border-b border-gray-50">
                    <th className="text-left px-6 py-3">Socio</th>
                    <th className="text-left px-6 py-3">Kg bruto</th>
                    <th className="text-left px-6 py-3">Rendimiento</th>
                    <th className="text-left px-6 py-3">Calidad</th>
                    <th className="text-left px-6 py-3">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimasEntregas.map((e, i) => (
                    <tr key={e.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-6 py-3 font-medium">{e.socios?.nombre || '—'}</td>
                      <td className="px-6 py-3 text-gray-600">{e.kg_bruto?.toLocaleString()} kg</td>
                      <td className="px-6 py-3 text-gray-600">{e.rendimiento}%</td>
                      <td className="px-6 py-3"><span className="bg-[#e8f5d8] text-[#2d6a0d] text-xs font-semibold px-2 py-0.5 rounded">{e.calidad || 'AOVE'}</span></td>
                      <td className="px-6 py-3 text-gray-400">{new Date(e.created_at).toLocaleDateString('es-ES')}</td>
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