'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function DashboardPage() {
  const router = useRouter()
  const [cooperativa, setCooperativa] = useState('')
  const [stats, setStats] = useState({ socios: 0, entregas: 0, kg_total: 0, aceite_total: 0 })
  const [ultimasEntregas, setUltimasEntregas] = useState([])
  const [precioAceite, setPrecioAceite] = useState(null)
  const [editandoPrecio, setEditandoPrecio] = useState(false)
  const [nuevoPrecio, setNuevoPrecio] = useState('')
  const [guardandoPrecio, setGuardandoPrecio] = useState(false)
  const [graficaSocios, setGraficaSocios] = useState([])
  const [graficaDias, setGraficaDias] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargarDatos() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: { user } } = await supabase.auth.getUser()
      setCooperativa(user?.user_metadata?.cooperativa || 'Mi Cooperativa')

      const { data: campana } = await supabase.from('campanas').select('id').eq('activa', true).single()

      const { count: totalSocios } = await supabase.from('socios').select('*', { count: 'exact', head: true }).eq('activo', true)

      const { data: entregas } = await supabase.from('entregas').select('kg_bruto, rendimiento, fecha, socio_id, socios(nombre)').eq('campana_id', campana?.id)
      const totalKg = entregas?.reduce((s, e) => s + (e.kg_bruto || 0), 0) || 0
      const totalAceite = entregas?.reduce((s, e) => e.rendimiento ? s + (e.kg_bruto * e.rendimiento) / 100 : s, 0) || 0

      setStats({ socios: totalSocios || 0, entregas: entregas?.length || 0, kg_total: totalKg, aceite_total: totalAceite })

      // Gráfica kg por socio
      const porSocio = {}
      entregas?.forEach(e => {
        const nombre = e.socios?.nombre || 'Desconocido'
        porSocio[nombre] = (porSocio[nombre] || 0) + (e.kg_bruto || 0)
      })
      setGraficaSocios(Object.entries(porSocio).map(([nombre, kg]) => ({ nombre: nombre.split(' ')[0], kg })).sort((a, b) => b.kg - a.kg))

      // Gráfica entregas por día
      const porDia = {}
      entregas?.forEach(e => {
        const dia = new Date(e.fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
        porDia[dia] = (porDia[dia] || 0) + (e.kg_bruto || 0)
      })
      setGraficaDias(Object.entries(porDia).map(([dia, kg]) => ({ dia, kg })))

      // Últimas entregas
      const { data: ultimas } = await supabase.from('entregas').select('*, socios(nombre)').order('created_at', { ascending: false }).limit(5)
      setUltimasEntregas(ultimas || [])

      // Precio aceite
      const { data: config } = await supabase.from('configuracion').select('valor').eq('clave', 'precio_aceite').single()
      if (config?.valor) setPrecioAceite(parseFloat(config.valor))

      setLoading(false)
    }
    cargarDatos()
  }, [router])

  async function guardarPrecio() {
    if (!nuevoPrecio || parseFloat(nuevoPrecio) <= 0) return
    setGuardandoPrecio(true)
    await supabase.from('configuracion').update({ valor: nuevoPrecio, updated_at: new Date().toISOString() }).eq('clave', 'precio_aceite')
    setPrecioAceite(parseFloat(nuevoPrecio))
    setNuevoPrecio('')
    setEditandoPrecio(false)
    setGuardandoPrecio(false)
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#f5f5f0]">
      <div className="text-[#7ab648] font-medium">Cargando...</div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-[#f5f5f0]">
      <Sidebar cooperativa={cooperativa} />
      <main className="ml-60 flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-100 px-7 h-14 flex items-center sticky top-0 z-40">
          <div>
            <h1 className="text-base font-bold text-gray-900">Panel general</h1>
            <p className="text-xs text-gray-400">Campaña 2025/2026</p>
          </div>
        </header>

        <div className="p-7">

          {/* Métricas */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-[#1a2e1a] rounded-xl p-5">
              <div className="text-xs font-medium uppercase tracking-wide mb-2 text-white/50">Socios activos</div>
              <div className="text-3xl font-extrabold text-white">{stats.socios}</div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="text-xs font-medium uppercase tracking-wide mb-2 text-gray-400">Entregas campaña</div>
              <div className="text-3xl font-extrabold text-gray-900">{stats.entregas}</div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="text-xs font-medium uppercase tracking-wide mb-2 text-gray-400">Kg aceituna total</div>
              <div className="text-3xl font-extrabold text-gray-900">
                {(stats.kg_total / 1000).toFixed(1)}<span className="text-sm font-medium ml-1 text-gray-400">t</span>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="text-xs font-medium uppercase tracking-wide mb-2 text-gray-400">Aceite estimado</div>
              <div className="text-3xl font-extrabold text-gray-900">
                {(stats.aceite_total / 1000).toFixed(2)}<span className="text-sm font-medium ml-1 text-gray-400">t</span>
              </div>
            </div>
          </div>

          {/* Precio aceite */}
          <div className="bg-white rounded-xl border border-gray-100 px-6 py-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-[#e8f5d8] rounded-xl flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2d6a0d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <div>
                  <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Precio aceite campaña</div>
                  {precioAceite ? (
                    <div className="text-2xl font-extrabold text-[#1a2e1a]">
                      {precioAceite.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                      <span className="text-sm font-medium ml-1 text-gray-400">EUR/kg aceite</span>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 mt-0.5">Sin precio definido — introdúcelo para calcular liquidaciones</div>
                  )}
                </div>
              </div>
              {!editandoPrecio ? (
                <button onClick={() => { setEditandoPrecio(true); setNuevoPrecio(precioAceite || '') }}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#1a2e1a] border border-gray-200 hover:border-gray-300 px-4 py-2 rounded-lg transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  {precioAceite ? 'Actualizar precio' : 'Introducir precio'}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input type="number" value={nuevoPrecio} onChange={e => setNuevoPrecio(e.target.value)}
                    placeholder="Ej: 3.80" min="0" step="0.01" autoFocus
                    className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7ab648]" />
                  <span className="text-sm text-gray-500 font-medium">EUR/kg</span>
                  <button onClick={guardarPrecio} disabled={guardandoPrecio}
                    className="bg-[#1a2e1a] hover:bg-[#2a4a2a] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-60">
                    {guardandoPrecio ? '...' : 'Guardar'}
                  </button>
                  <button onClick={() => setEditandoPrecio(false)} className="text-sm text-gray-400 hover:text-gray-600 px-2 py-2">Cancelar</button>
                </div>
              )}
            </div>
          </div>

          {/* Gráficas */}
          {graficaSocios.length > 0 && (
            <div className="grid grid-cols-2 gap-6 mb-6">

              {/* Kg por socio */}
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="text-sm font-bold text-gray-900 mb-5">Kg aceituna por socio</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={graficaSocios} barSize={32}>
                    <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(1)}t`} />
                    <Tooltip
                      formatter={(value) => [`${value.toLocaleString('es-ES')} kg`, 'Kg aceituna']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    />
                    <Bar dataKey="kg" radius={[6, 6, 0, 0]}>
                      {graficaSocios.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? '#1a2e1a' : '#7ab648'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Entregas por día */}
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="text-sm font-bold text-gray-900 mb-5">Kg entregados por día</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={graficaDias} barSize={32}>
                    <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(1)}t`} />
                    <Tooltip
                      formatter={(value) => [`${value.toLocaleString('es-ES')} kg`, 'Kg aceituna']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    />
                    <Bar dataKey="kg" radius={[6, 6, 0, 0]} fill="#7ab648" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

            </div>
          )}

          {/* Últimas entregas */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900">Últimas entregas</h2>
              <a href="/entregas" className="text-xs text-[#4a7a1e] font-semibold hover:underline">Ver todas</a>
            </div>
            {ultimasEntregas.length === 0 ? (
              <div className="px-6 py-10 text-center text-gray-400 text-sm">No hay entregas registradas todavía.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-gray-400 border-b border-gray-50">
                    <th className="text-left px-6 py-3">Socio</th>
                    <th className="text-left px-6 py-3">Fecha</th>
                    <th className="text-right px-6 py-3">Kg bruto</th>
                    <th className="text-right px-6 py-3">Rendim.</th>
                    <th className="text-left px-6 py-3">Calidad</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimasEntregas.map((e, i) => (
                    <tr key={e.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-6 py-3 font-medium text-gray-900">{e.socios?.nombre || '—'}</td>
                      <td className="px-6 py-3 text-gray-500">{new Date(e.fecha + 'T00:00:00').toLocaleDateString('es-ES')}</td>
                      <td className="px-6 py-3 text-right tabular-nums font-medium text-gray-900">{e.kg_bruto?.toLocaleString('es-ES')} kg</td>
                      <td className="px-6 py-3 text-right tabular-nums text-gray-500">{e.rendimiento != null ? `${e.rendimiento}%` : '—'}</td>
                      <td className="px-6 py-3">
                        <span className="bg-[#e8f5d8] text-[#2d6a0d] text-xs font-semibold px-2 py-0.5 rounded">{e.calidad || 'AOVE'}</span>
                      </td>
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