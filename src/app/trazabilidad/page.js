'use client'
import { useState, useEffect } from 'react'
import { supabase, getUserId } from '@/lib/supabase'

export default function TrazabilidadPage() {
  const [socios, setSocios] = useState([])
  const [campanyas, setCampanyas] = useState([])
  const [filtroSocio, setFiltroSocio] = useState('')
  const [filtroCampaña, setFiltroCampaña] = useState('')
  const [datos, setDatos] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { cargarFiltros() }, [])

  async function cargarFiltros() {
    const userId = await getUserId()
    const [{ data: s }, { data: e }] = await Promise.all([
      supabase.from('socios').select('id, nombre').eq('user_id', userId).order('nombre'),
      supabase.from('entregas').select('campaña').eq('user_id', userId),
    ])
    setSocios(s || [])
    const camps = [...new Set((e || []).map(x => x.campaña).filter(Boolean))].sort().reverse()
    setCampanyas(camps)
  }

  async function buscar() {
    if (!filtroSocio && !filtroCampaña) return
    setLoading(true)
    const userId = await getUserId()

    const [{ data: entregasData }, { data: parcelasData }, { data: liquidacionesData }] = await Promise.all([
      supabase
        .from('entregas')
        .select('*, socios(nombre), parcelas(nombre, municipio, variedad, superficie_ha)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .modify(q => {
          if (filtroSocio) q = q.eq('socio_id', filtroSocio)
          if (filtroCampaña) q = q.eq('campaña', filtroCampaña)
          return q
        }),
      filtroSocio
        ? supabase.from('parcelas').select('*, socios(nombre)').eq('user_id', userId).eq('socio_id', filtroSocio)
        : supabase.from('parcelas').select('*, socios(nombre)').eq('user_id', userId),
      supabase
        .from('liquidaciones')
        .select('*, socios(nombre)')
        .eq('user_id', userId)
        .modify(q => {
          if (filtroSocio) q = q.eq('socio_id', filtroSocio)
          if (filtroCampaña) q = q.eq('campaña', filtroCampaña)
          return q
        }),
    ])

    // Agrupar entregas por socio
    const sociosMap = {}
    ;(entregasData || []).forEach(entrega => {
      const sid = entrega.socio_id
      if (!sociosMap[sid]) {
        sociosMap[sid] = {
          id: sid,
          nombre: entrega.socios?.nombre || '—',
          entregas: [],
          totalKg: 0,
        }
      }
      sociosMap[sid].entregas.push(entrega)
      sociosMap[sid].totalKg += parseFloat(entrega.kg || 0)
    })

    // Añadir parcelas a cada socio
    const parcelasMap = {}
    ;(parcelasData || []).forEach(p => {
      if (!parcelasMap[p.socio_id]) parcelasMap[p.socio_id] = []
      parcelasMap[p.socio_id].push(p)
    })

    // Añadir liquidaciones a cada socio
    const liquidMap = {}
    ;(liquidacionesData || []).forEach(l => {
      if (!liquidMap[l.socio_id]) liquidMap[l.socio_id] = []
      liquidMap[l.socio_id].push(l)
    })

    // Construir resultado
    const resultado = Object.values(sociosMap).map(s => ({
      ...s,
      parcelas: parcelasMap[s.id] || [],
      liquidaciones: liquidMap[s.id] || [],
    }))

    // Si filtramos por socio pero no tiene entregas, igual mostramos sus datos
    if (filtroSocio && resultado.length === 0) {
      const socio = socios.find(s => s.id === filtroSocio)
      if (socio) {
        resultado.push({
          id: filtroSocio,
          nombre: socio.nombre,
          entregas: [],
          totalKg: 0,
          parcelas: parcelasMap[filtroSocio] || [],
          liquidaciones: liquidMap[filtroSocio] || [],
        })
      }
    }

    setDatos(resultado)
    setLoading(false)
  }

  const totalKgGeneral = datos?.reduce((s, d) => s + d.totalKg, 0) || 0
  const totalLiquidado = datos?.reduce((s, d) => s + d.liquidaciones.reduce((a, l) => a + parseFloat(l.importe_total || 0), 0), 0) || 0

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Trazabilidad</h1>
        <p className="text-gray-500 mt-1">Cadena completa: parcela → entrega → liquidación</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Socio</label>
            <select
              value={filtroSocio}
              onChange={e => setFiltroSocio(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
            >
              <option value="">Todos los socios</option>
              {socios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campaña</label>
            <select
              value={filtroCampaña}
              onChange={e => setFiltroCampaña(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
            >
              <option value="">Todas las campañas</option>
              {campanyas.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={buscar}
              disabled={loading || (!filtroSocio && !filtroCampaña)}
              className="w-full py-2 px-4 rounded-lg text-white text-sm font-medium disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: '#0f172a' }}
            >
              {loading ? 'Buscando...' : 'Ver trazabilidad'}
            </button>
          </div>
        </div>
      </div>

      {/* Resultados */}
      {datos && (
        <>
          {/* Resumen general */}
          {datos.length > 1 && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Socios</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{datos.length}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Kg totales</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{totalKgGeneral.toLocaleString('es-ES')} kg</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total liquidado</p>
                <p className="text-2xl font-bold mt-1" style={{ color: '#4ade80' }}>
                  {totalLiquidado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </p>
              </div>
            </div>
          )}

          {datos.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">🔍</p>
              <p>No se encontraron datos con los filtros seleccionados</p>
            </div>
          )}

          {/* Tarjeta por socio */}
          {datos.map(socio => (
            <div key={socio.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
              {/* Cabecera socio */}
              <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: '#0f172a' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>
                    {socio.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{socio.nombre}</p>
                    {filtroCampaña && <p className="text-xs" style={{ color: '#4ade80' }}>Campaña {filtroCampaña}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold">{socio.totalKg.toLocaleString('es-ES')} kg</p>
                  <p className="text-xs text-gray-400">{socio.entregas.length} entrega{socio.entregas.length !== 1 ? 's' : ''}</p>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Parcelas */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span>🌿</span> Parcelas registradas
                  </h3>
                  {socio.parcelas.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {socio.parcelas.map(p => {
                        const kgParcela = socio.entregas
                          .filter(e => e.parcela_id === p.id)
                          .reduce((s, e) => s + parseFloat(e.kg || 0), 0)
                        return (
                          <div key={p.id} className="border border-gray-100 rounded-xl p-3 flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-800 text-sm">{p.nombre}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {[p.municipio, p.variedad, p.superficie_ha ? `${p.superficie_ha} ha` : null].filter(Boolean).join(' · ')}
                              </p>
                            </div>
                            {kgParcela > 0 && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                                {kgParcela.toLocaleString('es-ES')} kg
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">Sin parcelas registradas</p>
                  )}
                </div>

                {/* Entregas */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span>📦</span> Entregas
                  </h3>
                  {socio.entregas.length > 0 ? (
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-400 text-xs">
                          <tr>
                            <th className="text-left px-4 py-2">Fecha</th>
                            <th className="text-left px-4 py-2">Parcela</th>
                            <th className="text-right px-4 py-2">Kg</th>
                            <th className="text-right px-4 py-2">Rendim.</th>
                            <th className="text-left px-4 py-2">Calidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {socio.entregas.map(e => (
                            <tr key={e.id} className="border-t border-gray-50">
                              <td className="px-4 py-2 text-gray-500">{new Date(e.created_at).toLocaleDateString('es-ES')}</td>
                              <td className="px-4 py-2 text-gray-600 text-xs">{e.parcelas?.nombre || <span className="text-gray-300">—</span>}</td>
                              <td className="px-4 py-2 text-right font-medium text-gray-900">{parseFloat(e.kg).toLocaleString('es-ES')} kg</td>
                              <td className="px-4 py-2 text-right text-gray-500">{e.rendimiento ? `${e.rendimiento}%` : '—'}</td>
                              <td className="px-4 py-2">
                                {e.calidad && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${e.calidad === 'Extra' ? 'bg-green-100 text-green-700' : e.calidad === 'Primera' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {e.calidad}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t border-gray-100">
                          <tr>
                            <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-gray-500">TOTAL</td>
                            <td className="px-4 py-2 text-right font-bold text-gray-900">{socio.totalKg.toLocaleString('es-ES')} kg</td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">Sin entregas en este período</p>
                  )}
                </div>

                {/* Liquidaciones */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span>💶</span> Liquidaciones
                  </h3>
                  {socio.liquidaciones.length > 0 ? (
                    <div className="space-y-2">
                      {socio.liquidaciones.map(liq => (
                        <div key={liq.id} className="border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-800">Campaña {liq.campaña}</p>
                            <p className="text-xs text-gray-400">{parseFloat(liq.kg_totales).toLocaleString('es-ES')} kg · {parseFloat(liq.precio_kg).toFixed(3)} €/kg</p>
                          </div>
                          <p className="font-bold text-lg" style={{ color: '#16a34a' }}>
                            {parseFloat(liq.importe_total).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">Sin liquidaciones en este período</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {!datos && (
        <div className="text-center py-20 text-gray-300">
          <p className="text-5xl mb-4">🫒</p>
          <p className="text-gray-400">Selecciona un socio o campaña para ver la trazabilidad</p>
        </div>
      )}
    </div>
  )
}
