'use client'
import { useState, useEffect } from 'react'
import { supabase, getUserId } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Cell,
} from 'recharts'

// ── Colores estados liquidación ────────────────────────────────
const ESTADO_CFG = {
  borrador:       { label: 'Borrador',      color: '#94a3b8', bg: '#f1f5f9' },
  pendiente_pago: { label: 'Pend. de pago', color: '#f59e0b', bg: '#fffbeb' },
  pagada:         { label: 'Pagada',        color: '#22c55e', bg: '#f0fdf4' },
}

function fmt(n, decimals = 0) {
  return (parseFloat(n) || 0).toLocaleString('es-ES', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  })
}
function fmtEur(n) {
  return (parseFloat(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

export default function DashboardPage() {
  const [socios, setSocios]             = useState([])
  const [parcelas, setParcelas]         = useState([])
  const [entregas, setEntregas]         = useState([])
  const [liquidaciones, setLiquidaciones] = useState([])
  const [campanyas, setCampanyas]       = useState([])
  const [campSeleccionada, setCampSeleccionada] = useState('')
  const [loading, setLoading]           = useState(true)

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setLoading(true)
    const userId = await getUserId()
    const [{ data: s }, { data: p }, { data: e }, { data: l }] = await Promise.all([
      supabase.from('socios').select('id, nombre').eq('user_id', userId),
      supabase.from('parcelas').select('id, socio_id').eq('user_id', userId),
      supabase.from('entregas')
        .select('id, socio_id, kg, rendimiento, calidad, campana, fecha, created_at')
        .eq('user_id', userId)
        .order('fecha', { ascending: false }),
      supabase.from('liquidaciones')
        .select('id, socio_id, campana, kg_totales, kg_aceite_final, rendimiento_neto, precio_kg, importe_total, estado, fecha_pago')
        .eq('user_id', userId),
    ])

    setSocios(s || [])
    setParcelas(p || [])
    setEntregas(e || [])
    setLiquidaciones(l || [])

    // Campanyas únicas ordenadas desc
    const camps = [...new Set((e || []).map(x => x.campana).filter(Boolean))].sort().reverse()
    setCampanyas(camps)
    if (camps.length > 0) setCampSeleccionada(camps[0])
    setLoading(false)
  }

  // ── Datos filtrados por campaña ────────────────────────────
  const entCamp  = campSeleccionada ? entregas.filter(e => e.campana === campSeleccionada) : entregas
  const liqCamp  = campSeleccionada ? liquidaciones.filter(l => l.campana === campSeleccionada) : liquidaciones

  const totalKg      = entCamp.reduce((s, e) => s + (parseFloat(e.kg) || 0), 0)
  const totalImporte = liqCamp.reduce((s, l) => s + (parseFloat(l.importe_total) || 0), 0)
  const pagado       = liqCamp.filter(l => l.estado === 'pagada').reduce((s, l) => s + (parseFloat(l.importe_total) || 0), 0)

  // Kg aceite: si hay liquidaciones con rendimiento, usa esos; si no, estima al 20%
  const kgAceiteReal = liqCamp.reduce((s, l) => s + (parseFloat(l.kg_aceite_final) || 0), 0)
  const kgAceite = kgAceiteReal > 0 ? kgAceiteReal : totalKg * 0.2

  // Socios sin liquidar en la campaña
  const sociosConEntrega = [...new Set(entCamp.map(e => e.socio_id))]
  const sociosConLiq     = new Set(liqCamp.map(l => l.socio_id))
  const sociosSinLiq     = sociosConEntrega.filter(id => !sociosConLiq.has(id))
  const nombresSinLiq    = sociosSinLiq.map(id => socios.find(s => s.id === id)?.nombre).filter(Boolean)

  // Contadores estado liquidaciones
  const liqPorEstado = { borrador: 0, pendiente_pago: 0, pagada: 0 }
  liqCamp.forEach(l => { const e = l.estado || 'borrador'; if (liqPorEstado[e] !== undefined) liqPorEstado[e]++ })

  // ── Gráfica: Top socios por kg ─────────────────────────────
  const topSocios = socios
    .map(s => ({
      nombre: s.nombre?.split(' ')[0] || '?',
      kg: entCamp.filter(e => e.socio_id === s.id).reduce((sum, e) => sum + (parseFloat(e.kg) || 0), 0),
    }))
    .filter(s => s.kg > 0)
    .sort((a, b) => b.kg - a.kg)
    .slice(0, 8)

  // ── Gráfica: Kg por día (últimas 4 semanas) ────────────────
  const hace28 = new Date(); hace28.setDate(hace28.getDate() - 28)
  const kgPorDia = Object.entries(
    entCamp.reduce((acc, e) => {
      const raw = e.fecha || e.created_at
      if (!raw) return acc
      const d = new Date(raw)
      if (d < hace28) return acc
      const dia = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'numeric' })
      acc[dia] = (acc[dia] || 0) + (parseFloat(e.kg) || 0)
      return acc
    }, {})
  )
    .sort((a, b) => {
      const parse = str => { const [d, m] = str[0].split('/'); return new Date(2025, m - 1, d) }
      return parse(a) - parse(b)
    })
    .map(([dia, kg]) => ({ dia, kg }))

  // ── Rendimiento medio ──────────────────────────────────────
  const rends = entCamp.filter(e => e.rendimiento).map(e => parseFloat(e.rendimiento))
  const rendMedio = rends.length > 0 ? rends.reduce((a, b) => a + b, 0) / rends.length : null

  // ── Distribución calidad ───────────────────────────────────
  const calidades = { Extra: 0, Primera: 0, Segunda: 0 }
  entCamp.forEach(e => { if (calidades[e.calidad] !== undefined) calidades[e.calidad]++ })

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* ── CABECERA ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel general</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {loading ? 'Cargando...' : `${socios.length} socios · ${parcelas.length} parcelas`}
          </p>
        </div>
        {/* Selector campaña */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 font-medium">Campaña</label>
          <select
            value={campSeleccionada}
            onChange={e => setCampSeleccionada(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white shadow-sm"
          >
            <option value="">Todas</option>
            {campanyas.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* ── KPIs PRINCIPALES ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {/* Socios */}
        <div className="rounded-xl p-5 text-white" style={{ backgroundColor: '#0f172a' }}>
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#4ade80' }}>Socios</p>
          <p className="text-4xl font-bold">{socios.length}</p>
          <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>{parcelas.length} parcelas registradas</p>
        </div>
        {/* Entregas */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Entregas</p>
          <p className="text-4xl font-bold text-gray-900">{entCamp.length}</p>
          <p className="text-xs text-gray-400 mt-2">
            {rends.length > 0 ? `Rend. medio: ${rendMedio.toFixed(1)}%` : 'en esta campaña'}
          </p>
        </div>
        {/* Kg aceituna */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Kg aceituna</p>
          <p className="text-4xl font-bold text-gray-900">
            {totalKg >= 1000 ? fmt(totalKg / 1000, 1) : fmt(totalKg)}
            <span className="text-lg font-normal text-gray-400 ml-1">{totalKg >= 1000 ? 't' : 'kg'}</span>
          </p>
          <p className="text-xs text-gray-400 mt-2">
            {kgAceiteReal > 0 ? `${fmt(kgAceite, 0)} kg aceite real` : `≈ ${fmt(kgAceite, 0)} kg aceite est.`}
          </p>
        </div>
        {/* Importe */}
        <div className="rounded-xl p-5" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#16a34a' }}>Liquidado</p>
          <p className="text-2xl font-bold" style={{ color: '#15803d' }}>
            {totalImporte >= 1000
              ? `${fmt(totalImporte / 1000, 1)}k €`
              : `${fmt(totalImporte, 0)} €`}
          </p>
          <p className="text-xs mt-2" style={{ color: '#16a34a' }}>
            {pagado > 0 ? `${fmtEur(pagado)} pagado` : 'Sin pagos confirmados'}
          </p>
        </div>
      </div>

      {/* ── ESTADOS LIQUIDACIONES ── */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {Object.entries(ESTADO_CFG).map(([key, cfg]) => (
          <div key={key} className="rounded-xl p-4 flex items-center justify-between" style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.color}22` }}>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: cfg.color }}>{cfg.label}</p>
              <p className="text-3xl font-bold mt-0.5" style={{ color: key === 'borrador' ? '#334155' : cfg.color }}>
                {liqPorEstado[key]}
              </p>
              <p className="text-xs mt-0.5" style={{ color: `${cfg.color}99` }}>liquidaciones</p>
            </div>
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
          </div>
        ))}
      </div>

      {/* ── ALERTA: SOCIOS SIN LIQUIDAR ── */}
      {nombresSinLiq.length > 0 && (
        <div className="mb-4 rounded-xl p-4 flex items-start gap-3" style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="#d97706" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {nombresSinLiq.length} {nombresSinLiq.length === 1 ? 'socio sin liquidar' : 'socios sin liquidar'} en {campSeleccionada || 'esta campaña'}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">{nombresSinLiq.join(', ')}</p>
          </div>
          <a href="/liquidaciones" className="ml-auto text-xs font-medium text-amber-700 underline flex-shrink-0">Liquidar →</a>
        </div>
      )}

      {/* ── GRÁFICAS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Top socios por kg */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Kg por socio {campSeleccionada && <span className="text-gray-400 font-normal">· {campSeleccionada}</span>}</h2>
          {topSocios.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topSocios} layout="vertical" margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}t` : v} />
                <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11 }} width={65} />
                <Tooltip formatter={v => [`${v.toLocaleString('es-ES')} kg`, 'Kg']} />
                <Bar dataKey="kg" radius={[0, 4, 4, 0]}>
                  {topSocios.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#4ade80' : i === 1 ? '#86efac' : '#bbf7d0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Sin entregas en esta campaña</div>
          )}
        </div>

        {/* Kg por día */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Entregas últimas 4 semanas</h2>
          {kgPorDia.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={kgPorDia}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="dia" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}t` : v} />
                <Tooltip formatter={v => [`${v.toLocaleString('es-ES')} kg`, 'Kg']} />
                <Line type="monotone" dataKey="kg" stroke="#4ade80" strokeWidth={2} dot={{ r: 3, fill: '#4ade80' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Sin datos en las últimas 4 semanas</div>
          )}
        </div>
      </div>

      {/* ── FILA INFERIOR: stats calidad + resumen liquidaciones ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">

        {/* Calidad */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Distribución calidad</h2>
          {entCamp.length > 0 ? (
            <div className="space-y-3">
              {Object.entries(calidades).map(([cal, count]) => {
                const pct = entCamp.length > 0 ? Math.round((count / entCamp.length) * 100) : 0
                const colors = { Extra: '#4ade80', Primera: '#60a5fa', Segunda: '#fbbf24' }
                return (
                  <div key={cal}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">{cal}</span>
                      <span className="text-gray-400">{count} entregas ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: colors[cal] }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="h-24 flex items-center justify-center text-gray-400 text-sm">Sin datos</div>
          )}
        </div>

        {/* Resumen liquidaciones */}
        <div className="md:col-span-2 bg-white border border-gray-100 shadow-sm rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-800">Resumen liquidaciones</h2>
            <a href="/liquidaciones" className="text-xs text-gray-400 hover:text-gray-600">Ver todas →</a>
          </div>
          {liqCamp.length > 0 ? (
            <div className="space-y-2">
              {liqCamp
                .sort((a, b) => (parseFloat(b.importe_total) || 0) - (parseFloat(a.importe_total) || 0))
                .slice(0, 5)
                .map(liq => {
                  const socio = socios.find(s => s.id === liq.socio_id)
                  const est = ESTADO_CFG[liq.estado || 'borrador']
                  return (
                    <div key={liq.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#0f172a' }}>
                          {(socio?.nombre || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{socio?.nombre || '—'}</p>
                          {liq.kg_aceite_final
                            ? <p className="text-xs text-gray-400">{fmt(liq.kg_aceite_final, 0)} kg aceite · {liq.rendimiento_neto}% rend.</p>
                            : <p className="text-xs text-gray-400">{fmt(liq.kg_totales, 0)} kg aceituna</p>
                          }
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: est.bg, color: est.color }}>
                          {est.label}
                        </span>
                        <span className="text-sm font-bold" style={{ color: '#15803d' }}>
                          {fmtEur(liq.importe_total)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              {liqCamp.length > 5 && (
                <p className="text-xs text-gray-400 pt-1 text-center">y {liqCamp.length - 5} más...</p>
              )}
            </div>
          ) : (
            <div className="h-24 flex items-center justify-center text-gray-400 text-sm">
              Sin liquidaciones en esta campaña
            </div>
          )}
        </div>
      </div>

      {/* ── ÚLTIMAS ENTREGAS ── */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-xl overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between border-b border-gray-50">
          <h2 className="text-sm font-semibold text-gray-800">Últimas entregas</h2>
          <a href="/entregas" className="text-xs text-gray-400 hover:text-gray-600">Ver todas →</a>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-5 py-3">Socio</th>
              <th className="text-left px-5 py-3">Campaña</th>
              <th className="text-left px-5 py-3">Fecha</th>
              <th className="text-right px-5 py-3">Kg</th>
              <th className="text-right px-5 py-3">Rendim.</th>
              <th className="text-left px-5 py-3">Calidad</th>
            </tr>
          </thead>
          <tbody>
            {entCamp.slice(0, 7).map(e => {
              const socio = socios.find(s => s.id === e.socio_id)
              const fecha = e.fecha || e.created_at
              const CALIDAD_COLORS = { Extra: 'bg-green-100 text-green-800', Primera: 'bg-blue-100 text-blue-800', Segunda: 'bg-amber-100 text-amber-800' }
              return (
                <tr key={e.id} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{socio?.nombre || '—'}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{e.campana || '—'}</td>
                  <td className="px-5 py-3 text-gray-500">{fecha ? new Date(fecha).toLocaleDateString('es-ES') : '—'}</td>
                  <td className="px-5 py-3 text-right text-gray-700">{fmt(e.kg)} kg</td>
                  <td className="px-5 py-3 text-right text-gray-500">{e.rendimiento ? `${e.rendimiento}%` : '—'}</td>
                  <td className="px-5 py-3">
                    {e.calidad
                      ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CALIDAD_COLORS[e.calidad] || 'bg-gray-100 text-gray-600'}`}>{e.calidad}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              )
            })}
            {entCamp.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No hay entregas en esta campaña</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
