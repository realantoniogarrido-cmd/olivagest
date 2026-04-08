'use client'
import { useState, useEffect } from 'react'
import { supabase, getUserId } from '@/lib/supabase'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

// ── Helpers ──────────────────────────────────────────────────────────────────

function campanyaDesdeFecha(fechaStr) {
  if (!fechaStr) return null
  const d = new Date(fechaStr)
  if (isNaN(d)) return null
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  return m >= 10 ? `${y}/${y + 1}` : `${y - 1}/${y}`
}

function parsearRangoCampanya(str) {
  if (!str) return null
  const m = str.match(/(\d{4})[\/\-](\d{2,4})/)
  if (!m) return null
  const y1 = parseInt(m[1])
  const raw = m[2]
  const y2 = raw.length === 2 ? Math.floor(y1 / 100) * 100 + parseInt(raw) : parseInt(raw)
  if (y2 <= y1 || y2 > y1 + 2) return null
  return { start: `${y1}-10-01`, end: `${y2}-09-30` }
}

function esFechaInconsistente(fecha, camp) {
  if (!fecha || !camp) return false
  const r = parsearRangoCampanya(camp)
  if (!r) return false
  return fecha < r.start || fecha > r.end
}

// Normaliza nombre de campaña para matching Y display uniforme
// "Campaña 25/26" → "2025/26"  |  "2023/24" → "2023/24"  |  "2024/2025" → "2024/25"
function normCampNombre(str) {
  let s = (str || '').replace(/campa[ñn]a\s*/i, '').trim()
  // "YYYY/YYYY" → "YYYY/YY"
  s = s.replace(/^(\d{4})\/(\d{4})$/, (_, y1, y2) => `${y1}/${y2.slice(2)}`)
  // "YY/YY" → "20YY/YY"
  s = s.replace(/^(\d{2})\/(\d{2})$/, (_, y1, y2) => `20${y1}/${y2}`)
  return s
}

// ────────────────────────────────────────────────────────────────────────────
export default function CampanyasPage() {
  const [tab, setTab] = useState('activa')   // 'activa' | 'historico' | 'gestionar'

  // Datos de la tabla campanyas (config)
  const [campConfig, setCampConfig]       = useState([])
  const [campActiva, setCampActiva]       = useState(null)

  // Datos de entregas agrupados por campaña
  const [resumenCamps, setResumenCamps]   = useState([])
  const [entregasActiva, setEntregasActiva] = useState([])
  const [liquidActiva, setLiquidActiva]   = useState([])

  // Detalle histórico
  const [campSelec, setCampSelec]         = useState(null)
  const [entregasSelec, setEntregasSelec] = useState([])

  // Gestionar
  const [sinCampaña, setSinCampaña]       = useState([])
  const [inconsistentes, setInconsistentes] = useState([])
  const [loadingGest, setLoadingGest]     = useState(false)
  const [msgGest, setMsgGest]             = useState('')
  const [rangoForm, setRangoForm]         = useState({ campanya: '', desde: '', hasta: '' })
  const [rangoPreview, setRangoPreview]   = useState(null)
  const [asignando, setAsignando]         = useState(false)
  const [autoDetPreview, setAutoDetPreview] = useState(null)
  const [autoDetLoading, setAutoDetLoading] = useState(false)
  const [incorForm, setIncorForm]         = useState({})
  const [corrigiendo, setCorrigiendo]     = useState(null)

  const [loading, setLoading]             = useState(false)

  useEffect(() => { fetchTodo() }, [])
  useEffect(() => { if (tab === 'gestionar') fetchGestionar() }, [tab]) // eslint-disable-line
  useEffect(() => { if (campSelec) fetchEntregasSelec(campSelec) }, [campSelec]) // eslint-disable-line

  // ── Carga principal ───────────────────────────────────────────────────────
  async function fetchTodo() {
    setLoading(true)
    const userId = await getUserId()

    // 1. Config de campañas
    const { data: cfgs } = await supabase
      .from('campanyas').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    setCampConfig(cfgs || [])
    const activa = (cfgs || []).find(c => c.estado === 'activa') || null
    setCampActiva(activa)

    // 2. Todas las entregas — usar * para evitar problemas con columnas con ñ
    const { data: ents } = await supabase
      .from('entregas')
      .select('*')
      .eq('user_id', userId)

    // 3. Liquidaciones
    const { data: liqs } = await supabase
      .from('liquidaciones')
      .select('*')
      .eq('user_id', userId)

    // ── Agrupar entregas por campaña ────────────────────────────────────────
    const porCamp = {}
    for (const e of ents || []) {
      const c = e.campana ? normCampNombre(e.campana) : 'Sin campaña'
      if (!porCamp[c]) porCamp[c] = {
        campana: c, kg: 0, num_entregas: 0, socios: new Set(),
        inconsistencias: 0, rendimientos: [], calidades: {}
      }
      const kg = parseFloat(e.kg_neto || e.kg_bruto || 0)
      porCamp[c].kg += kg
      porCamp[c].num_entregas++
      if (e.socio_id) porCamp[c].socios.add(e.socio_id)
      if (esFechaInconsistente(e.fecha, e.campana)) porCamp[c].inconsistencias++
      if (e.rendimiento) porCamp[c].rendimientos.push(parseFloat(e.rendimiento))
      if (e.calidad) porCamp[c].calidades[e.calidad] = (porCamp[c].calidades[e.calidad] || 0) + 1
    }

    // Añadir datos de liquidaciones
    const liqsByCamp = {}
    for (const l of liqs || []) {
      const c = l.campana ? normCampNombre(l.campana) : ''
      if (!liqsByCamp[c]) liqsByCamp[c] = { importe: 0, kg_liq: 0, precio_medio: [], socios_liq: new Set() }
      liqsByCamp[c].importe += parseFloat(l.importe_total || 0)
      liqsByCamp[c].kg_liq  += parseFloat(l.kg_totales || 0)
      if (l.precio_kg) liqsByCamp[c].precio_medio.push(parseFloat(l.precio_kg))
      if (l.socio_id) liqsByCamp[c].socios_liq.add(l.socio_id)
    }

    // Construir resumen desde entregas
    const resumenDesdeEnts = Object.values(porCamp).map(c => {
      const liq = liqsByCamp[c.campana] || {}
      const rendMedio = c.rendimientos.length
        ? (c.rendimientos.reduce((a, b) => a + b, 0) / c.rendimientos.length).toFixed(1)
        : null
      const pMedio = liq.precio_medio?.length
        ? (liq.precio_medio.reduce((a, b) => a + b, 0) / liq.precio_medio.length).toFixed(3)
        : null
      return {
        campana:        c.campana,
        kg:             c.kg,
        num_entregas:   c.num_entregas,
        num_socios:     c.socios.size,
        inconsistencias: c.inconsistencias,
        rend_medio:     rendMedio,
        importe_liq:    liq.importe || 0,
        socios_liq:     liq.socios_liq?.size || 0,
        precio_medio:   pMedio,
        liquidada:      (liq.socios_liq?.size || 0) > 0,
        desde_config:   false,
      }
    })

    // Añadir campañas del config que aún no tienen entregas (para que aparezcan en histórico)
    const nombresEnResumen = new Set(resumenDesdeEnts.map(r => normCampNombre(r.campana)))
    for (const cfg of cfgs || []) {
      if (!nombresEnResumen.has(normCampNombre(cfg.nombre))) {
        const normNombre = normCampNombre(cfg.nombre)
        const liq = liqsByCamp[normNombre] || {}
        resumenDesdeEnts.push({
          campana:       normNombre,
          kg:            0,
          num_entregas:  0,
          num_socios:    0,
          inconsistencias: 0,
          rend_medio:    null,
          importe_liq:   liq.importe || 0,
          socios_liq:    liq.socios_liq?.size || 0,
          precio_medio:  null,
          liquidada:     false,
          desde_config:  true,
          estado_config: cfg.estado,
        })
      }
    }

    const resumen = resumenDesdeEnts.sort((a, b) => b.campana.localeCompare(a.campana))
    setResumenCamps(resumen)

    // Entregas y liquidaciones de la campaña activa
    if (activa) {
      const nomActiva = normCampNombre(activa.nombre)
      const entAct = (ents || []).filter(e => normCampNombre(e.campana) === nomActiva)
      setEntregasActiva(entAct)
      const liqAct = (liqs || []).filter(l => normCampNombre(l.campana) === nomActiva)
      setLiquidActiva(liqAct)
    }

    if (!campSelec && resumen.length > 0) setCampSelec(resumen[0].campana)
    setLoading(false)
  }

  async function fetchEntregasSelec(camp) {
    const userId = await getUserId()
    const { data } = await supabase
      .from('entregas').select('*, socios(nombre)')
      .eq('user_id', userId).eq('campana', camp)
      .order('fecha', { ascending: false })
    setEntregasSelec(data || [])
  }

  // ── Gestionar ─────────────────────────────────────────────────────────────
  async function fetchGestionar() {
    setLoadingGest(true)
    const userId = await getUserId()
    const { data } = await supabase
      .from('entregas').select('*, socios(nombre)')
      .eq('user_id', userId).order('fecha', { ascending: false })
    setSinCampaña((data || []).filter(e => !e.campana))
    setInconsistentes((data || []).filter(e => e.campana && esFechaInconsistente(e.fecha, e.campana)))
    setLoadingGest(false)
  }

  function calcRangoPreview() {
    if (!rangoForm.campanya) return
    setRangoPreview(sinCampaña.filter(e => {
      if (!e.fecha) return !rangoForm.desde && !rangoForm.hasta
      if (rangoForm.desde && e.fecha < rangoForm.desde) return false
      if (rangoForm.hasta && e.fecha > rangoForm.hasta) return false
      return true
    }))
  }

  async function asignarPorRango() {
    if (!rangoPreview?.length || !rangoForm.campanya) return
    setAsignando(true)
    const { error } = await supabase.from('entregas')
      .update({ 'campana': rangoForm.campanya }).in('id', rangoPreview.map(e => e.id))
    if (error) { setMsgGest(`❌ ${error.message}`) }
    else {
      setMsgGest(`✅ ${rangoPreview.length} entregas asignadas a "${rangoForm.campanya}"`)
      setRangoPreview(null); setRangoForm({ campanya: '', desde: '', hasta: '' })
      await fetchGestionar(); await fetchTodo()
    }
    setTimeout(() => setMsgGest(''), 5000); setAsignando(false)
  }

  async function calcAutoDeteccion() {
    setAutoDetLoading(true)
    const porCamp = {}
    for (const e of sinCampaña) {
      const c = campanyaDesdeFecha(e.fecha); if (!c) continue
      if (!porCamp[c]) porCamp[c] = []; porCamp[c].push(e.id)
    }
    setAutoDetPreview(porCamp); setAutoDetLoading(false)
  }

  async function aplicarAutoDeteccion() {
    if (!autoDetPreview) return; setAutoDetLoading(true); let total = 0
    for (const [c, ids] of Object.entries(autoDetPreview)) {
      const { error } = await supabase.from('entregas').update({ 'campana': c }).in('id', ids)
      if (!error) total += ids.length
    }
    setMsgGest(`✅ ${total} entregas asignadas automáticamente`)
    setAutoDetPreview(null); await fetchGestionar(); await fetchTodo()
    setTimeout(() => setMsgGest(''), 5000); setAutoDetLoading(false)
  }

  async function corregirInconsistencia(campVieja) {
    const nueva = incorForm[campVieja]; if (!nueva) return
    setCorrigiendo(campVieja)
    const ids = inconsistentes.filter(e => e.campana === campVieja).map(e => e.id)
    const { error } = await supabase.from('entregas').update({ 'campana': nueva }).in('id', ids)
    if (error) { setMsgGest(`❌ ${error.message}`) }
    else {
      setMsgGest(`✅ ${ids.length} entregas reasignadas de "${campVieja}" → "${nueva}"`)
      setIncorForm(f => { const n={...f}; delete n[campVieja]; return n })
      await fetchGestionar(); await fetchTodo()
    }
    setTimeout(() => setMsgGest(''), 5000); setCorrigiendo(null)
  }

  // ── Cálculos ──────────────────────────────────────────────────────────────
  const totalKgActiva    = entregasActiva.reduce((s, e) => s + parseFloat(e.kg_neto || e.kg_bruto || 0), 0)
  const sociosActiva     = new Set(entregasActiva.map(e => e.socio_id)).size
  const pendientesLiq    = sociosActiva - liquidActiva.length
  const ultimaEntrega    = entregasActiva.sort((a, b) => (b.fecha || '') > (a.fecha || '') ? 1 : -1)[0]
  // Histórico: todas excepto "Sin campaña". La activa aparece pero marcada diferente.
  const campsHistorico = resumenCamps.filter(c => c.campana !== 'Sin campaña')
  const totalProblemas   = sinCampaña.length + inconsistentes.length

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Cabecera */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campañas</h1>
          <p className="text-gray-500 mt-1">Gestión de temporadas oleícolas</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'activa',    label: 'Campaña activa',
              icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
            { key: 'historico', label: 'Histórico',
              icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
            { key: 'gestionar', label: `Gestionar${totalProblemas > 0 ? ` (${totalProblemas})` : ''}`,
              icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg> },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all"
              style={{
                borderColor:     tab === t.key ? '#0f172a' : '#e5e7eb',
                backgroundColor: tab === t.key ? '#0f172a' : 'white',
                color:           tab === t.key ? 'white'   : '#374151',
              }}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ════════════════════ CAMPAÑA ACTIVA ════════════════════════════════ */}
      {tab === 'activa' && (
        <div className="space-y-5">
          {!campActiva ? (
            // Sin campaña activa configurada
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center">
              <div className="flex justify-center mb-3"><svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">No hay campaña activa configurada</h2>
              <p className="text-gray-600 text-sm mb-5">
                Crea una campaña en Administración y márcala como "activa" para ver aquí sus estadísticas en tiempo real.
              </p>
              <a href="/admin"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium"
                style={{ backgroundColor: '#0f172a' }}>
                Ir a Administración →
              </a>
            </div>
          ) : (
            <>
              {/* Banner campaña activa */}
              <div className="rounded-2xl overflow-hidden shadow-md"
                style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #334155 100%)' }}>
                <div className="p-6">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-green-400 text-green-900 font-bold px-2 py-0.5 rounded-full animate-pulse">
                          EN CURSO
                        </span>
                      </div>
                      <h2 className="text-3xl font-bold text-white">{normCampNombre(campActiva.nombre)}</h2>
                      {(campActiva.fecha_inicio || campActiva.fecha_fin) && (
                        <p className="text-slate-300 text-sm mt-1">
                          {campActiva.fecha_inicio && new Date(campActiva.fecha_inicio).toLocaleDateString('es-ES')}
                          {campActiva.fecha_inicio && campActiva.fecha_fin && ' → '}
                          {campActiva.fecha_fin && new Date(campActiva.fecha_fin).toLocaleDateString('es-ES')}
                        </p>
                      )}
                      {campActiva.precio_kg && (
                        <p className="text-slate-400 text-sm mt-0.5">Precio base: {parseFloat(campActiva.precio_kg).toFixed(3)} €/kg</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <a href="/entregas"
                        className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-medium backdrop-blur-sm transition">
                        Ver entregas →
                      </a>
                      <a href="/liquidaciones"
                        className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-medium backdrop-blur-sm transition">
                        Liquidar →
                      </a>
                    </div>
                  </div>

                  {/* KPIs */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                    {[
                      { label: 'Kg acumulados',        value: totalKgActiva.toLocaleString('es-ES', {maximumFractionDigits:0}) + ' kg', color: 'text-white' },
                      { label: 'Socios entregados',    value: sociosActiva,  color: 'text-white' },
                      { label: 'Pendientes liquidar',  value: pendientesLiq > 0 ? pendientesLiq : '—', color: pendientesLiq > 0 ? 'text-yellow-300' : 'text-green-300' },
                      { label: 'Última entrega',       value: ultimaEntrega?.fecha ? new Date(ultimaEntrega.fecha).toLocaleDateString('es-ES') : '—', color: 'text-white' },
                    ].map(k => (
                      <div key={k.label} className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                        <p className="text-slate-400 text-xs mb-1">{k.label}</p>
                        <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notas de la campaña */}
              {campActiva.notas && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700">
                  <span className="font-medium">Notas: </span>{campActiva.notas}
                </div>
              )}

              {/* Alertas de la campaña activa */}
              {totalProblemas > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-red-800">⚠️ {totalProblemas} entrega{totalProblemas>1?'s':''} requieren atención</p>
                    <p className="text-xs text-red-600 mt-0.5">
                      {sinCampaña.length > 0 && `${sinCampaña.length} sin campaña. `}
                      {inconsistentes.length > 0 && `${inconsistentes.length} con fecha incorrecta.`}
                    </p>
                  </div>
                  <button onClick={() => setTab('gestionar')}
                    className="px-4 py-2 rounded-xl bg-red-700 text-white text-sm font-medium hover:bg-red-800">
                    Revisar →
                  </button>
                </div>
              )}

              {/* Desglose por calidad */}
              {entregasActiva.length > 0 && (() => {
                const porCal = {}
                for (const e of entregasActiva) if (e.calidad) porCal[e.calidad] = (porCal[e.calidad]||0) + 1
                const total = Object.values(porCal).reduce((a,b)=>a+b,0)
                const colores = { Extra:'#16a34a', Primera:'#2563eb', Segunda:'#f59e0b', Defectuoso:'#dc2626' }
                return total > 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <h3 className="font-semibold text-gray-900 mb-3">Desglose por calidad</h3>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(porCal).map(([cal, n]) => (
                        <div key={cal} className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colores[cal]||'#94a3b8' }} />
                          <span className="text-sm font-medium text-gray-800">{cal}</span>
                          <span className="text-sm text-gray-500">{n} ({Math.round(n/total*100)}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null
              })()}
            </>
          )}
        </div>
      )}

      {/* ════════════════════ HISTÓRICO ══════════════════════════════════════ */}
      {tab === 'historico' && (
        <div className="space-y-6">

          {campsHistorico.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
              <div className="flex justify-center mb-3"><svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></div>
              <p>Aún no hay campañas. Importa entregas de años anteriores y aparecerán aquí automáticamente.</p>
            </div>
          ) : (
            <>
              {/* Gráfica general de kg */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-900 mb-1">Kg totales por campaña</h2>
                <p className="text-xs text-gray-400 mb-4">Vista general de producción histórica</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={[...campsHistorico].filter(c=>c.kg>0).reverse()} barCategoryGap="35%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="campana" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 ? (v/1000).toFixed(0)+'k' : v} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}
                      formatter={v => [v.toLocaleString('es-ES') + ' kg', 'Kg totales']} />
                    <Bar dataKey="kg" name="Kg totales" fill="#0f172a" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Tabla resumen — clic para ver detalle */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Resumen por campaña</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Haz clic en una campaña para ver el detalle completo</p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left p-4">Campaña</th>
                      <th className="text-right p-4">Entregas</th>
                      <th className="text-right p-4">Socios</th>
                      <th className="text-right p-4">Kg totales</th>
                      <th className="text-right p-4">Rend. medio</th>
                      <th className="text-center p-4">Liquidación</th>
                      <th className="text-center p-4 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {campsHistorico.map(c => (
                      <>
                        <tr key={c.campana}
                          className={`border-t border-gray-100 hover:bg-slate-50 cursor-pointer transition-colors ${campSelec===c.campana?'bg-slate-50 border-l-2 border-l-slate-800':''}`}
                          onClick={() => setCampSelec(campSelec===c.campana ? null : c.campana)}>
                          <td className="p-4 font-bold text-gray-900 flex items-center gap-2">
                            <span className={`transition-transform text-gray-400 text-xs ${campSelec===c.campana?'rotate-90':''}`}>▶</span>
                            {normCampNombre(c.campana)}
                            {c.inconsistencias > 0 && (
                              <span className="text-xs text-orange-500" title={`${c.inconsistencias} entregas con fechas que no corresponden a esta campaña`}>
                                ⚠️
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right text-gray-600">{c.num_entregas || '—'}</td>
                          <td className="p-4 text-right text-gray-600">{c.num_socios || '—'}</td>
                          <td className="p-4 text-right font-medium text-gray-800">
                            {c.kg > 0 ? c.kg.toLocaleString('es-ES', {maximumFractionDigits:0}) + ' kg' : '—'}
                          </td>
                          <td className="p-4 text-right text-gray-600">{c.rend_medio ? c.rend_medio + '%' : '—'}</td>
                          <td className="p-4 text-center">
                            {c.liquidada
                              ? <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">✓ {c.socios_liq} socios</span>
                              : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Pendiente</span>}
                          </td>
                          <td className="p-4 text-center text-gray-400 text-xs">
                            {campSelec===c.campana ? '▲' : '▼'}
                          </td>
                        </tr>

                        {/* Panel de detalle expandible inline */}
                        {campSelec === c.campana && (
                          <tr key={c.campana + '_det'}>
                            <td colSpan={7} className="bg-slate-50 border-b border-slate-200 px-6 py-5">
                              {entregasSelec.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-4">No hay entregas registradas para esta campaña.</p>
                              ) : (() => {
                                // Agrupar por socio
                                const porSocio = {}
                                for (const e of entregasSelec) {
                                  const nom = e.socios?.nombre || '—'
                                  if (!porSocio[nom]) porSocio[nom] = { kg: 0, entregas: 0, calidades: {} }
                                  porSocio[nom].kg += parseFloat(e.kg_neto || e.kg_bruto || 0)
                                  porSocio[nom].entregas++
                                  if (e.calidad) porSocio[nom].calidades[e.calidad] = (porSocio[nom].calidades[e.calidad]||0)+1
                                }
                                const socios = Object.entries(porSocio).sort((a,b) => b[1].kg - a[1].kg)
                                const totalKgDet = socios.reduce((s,[,v])=>s+v.kg, 0)
                                // Desglose calidad global
                                const calGlobal = {}
                                for (const e of entregasSelec) if (e.calidad) calGlobal[e.calidad] = (calGlobal[e.calidad]||0)+1
                                const colCal = { Extra:'#16a34a', Primera:'#2563eb', Segunda:'#f59e0b', Defectuoso:'#dc2626' }

                                return (
                                  <div className="space-y-4">
                                    {/* Mini KPIs */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      {[
                                        { l:'Kg totales', v: totalKgDet.toLocaleString('es-ES',{maximumFractionDigits:0})+' kg' },
                                        { l:'Socios participantes', v: socios.length },
                                        { l:'Total entregas', v: entregasSelec.length },
                                        { l:'Mayor productor', v: socios[0]?.[0]?.split(' ')[0] || '—' },
                                      ].map(k => (
                                        <div key={k.l} className="bg-white rounded-lg p-3 border border-slate-200">
                                          <p className="text-xs text-gray-400">{k.l}</p>
                                          <p className="font-bold text-gray-900 mt-0.5">{k.v}</p>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Desglose calidad */}
                                    {Object.keys(calGlobal).length > 0 && (
                                      <div className="flex flex-wrap gap-2">
                                        <span className="text-xs text-gray-500 self-center">Calidad:</span>
                                        {Object.entries(calGlobal).map(([cal,n]) => (
                                          <span key={cal} className="inline-flex items-center gap-1.5 text-xs bg-white border border-slate-200 rounded-full px-3 py-1">
                                            <span className="w-2 h-2 rounded-full" style={{backgroundColor:colCal[cal]||'#94a3b8'}}/>
                                            {cal}: {n}
                                          </span>
                                        ))}
                                      </div>
                                    )}

                                    {/* Tabla por socio */}
                                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                      <table className="w-full text-xs">
                                        <thead className="bg-slate-100 text-slate-600 uppercase tracking-wide">
                                          <tr>
                                            <th className="text-left px-4 py-2">Socio</th>
                                            <th className="text-right px-4 py-2">Entregas</th>
                                            <th className="text-right px-4 py-2">Kg totales</th>
                                            <th className="text-right px-4 py-2">% del total</th>
                                            <th className="text-center px-4 py-2">Calidades</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {socios.map(([nom, dat]) => (
                                            <tr key={nom} className="border-t border-slate-100 hover:bg-slate-50">
                                              <td className="px-4 py-2 font-medium text-gray-800">{nom}</td>
                                              <td className="px-4 py-2 text-right text-gray-500">{dat.entregas}</td>
                                              <td className="px-4 py-2 text-right font-medium text-gray-800">
                                                {dat.kg.toLocaleString('es-ES',{maximumFractionDigits:0})} kg
                                              </td>
                                              <td className="px-4 py-2 text-right text-gray-500">
                                                {totalKgDet > 0 ? ((dat.kg/totalKgDet)*100).toFixed(1)+'%' : '—'}
                                              </td>
                                              <td className="px-4 py-2 text-center">
                                                <div className="flex gap-1 justify-center flex-wrap">
                                                  {Object.entries(dat.calidades).map(([cal,n]) => (
                                                    <span key={cal} className="text-xs px-1.5 py-0.5 rounded" style={{backgroundColor:colCal[cal]+'22', color:colCal[cal]||'#64748b'}}>
                                                      {cal.slice(0,3)} {n}
                                                    </span>
                                                  ))}
                                                </div>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>

                                    {/* Aviso inconsistencias si las hay */}
                                    {c.inconsistencias > 0 && (
                                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center justify-between">
                                        <p className="text-xs text-orange-700">
                                          ⚠️ {c.inconsistencias} entrega{c.inconsistencias>1?'s':''} tienen fechas que no corresponden al periodo de esta campaña.
                                          Esto puede ser datos de prueba o errores de importación.
                                        </p>
                                        <button onClick={() => setTab('gestionar')}
                                          className="ml-4 text-xs text-orange-700 underline hover:no-underline flex-shrink-0">
                                          Corregir →
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════════════════ GESTIONAR ══════════════════════════════════════ */}
      {tab === 'gestionar' && (
        <div className="space-y-5">
          {msgGest && (
            <div className={`p-4 rounded-xl text-sm font-medium border ${msgGest.startsWith('✅')?'bg-green-50 border-green-200 text-green-800':'bg-red-50 border-red-200 text-red-800'}`}>
              {msgGest}
            </div>
          )}

          {/* Inconsistencias */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-start">
              <div>
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  ⚠️ Fechas que no cuadran con su campaña
                  {inconsistentes.length > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{inconsistentes.length}</span>}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Ej: una entrega con fecha 2026 asignada a campaña 2023/24.</p>
              </div>
              <button onClick={fetchGestionar} disabled={loadingGest} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">↺</button>
            </div>
            {inconsistentes.length === 0
              ? <div className="p-6 text-center text-gray-400 text-sm">✅ Sin inconsistencias detectadas</div>
              : Object.entries(inconsistentes.reduce((acc,e)=>{ (acc[e.campana]||(acc[e.campana]=[])).push(e); return acc },{})).map(([cv,ents]) => {
                  const sug = campanyaDesdeFecha(ents[0]?.fecha)
                  return (
                    <div key={cv} className="border-t border-gray-100 p-4">
                      <div className="flex flex-wrap gap-4 items-start">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">
                            Campaña <strong className="text-red-700">"{cv}"</strong> — {ents.length} entrega{ents.length>1?'s':''} con fechas fuera de rango
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {ents.slice(0,5).map(e => (
                              <span key={e.id} className="text-xs bg-red-50 text-red-600 border border-red-100 rounded px-2 py-0.5">
                                {e.socios?.nombre?.split(' ')[0]} · {e.fecha}
                              </span>
                            ))}
                            {ents.length>5 && <span className="text-xs text-gray-400">+{ents.length-5} más</span>}
                          </div>
                        </div>
                        <div className="flex gap-2 items-end flex-shrink-0">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Reasignar a</label>
                            <input type="text" placeholder={sug||'2025/2026'}
                              value={incorForm[cv]||''}
                              onChange={e => setIncorForm(f=>({...f,[cv]:e.target.value}))}
                              className="border border-gray-300 rounded-lg p-2 text-sm w-32" />
                            {sug && !incorForm[cv] && (
                              <button onClick={() => setIncorForm(f=>({...f,[cv]:sug}))}
                                className="block text-xs text-blue-600 mt-0.5 hover:underline">
                                Usar: {sug}
                              </button>
                            )}
                          </div>
                          <button onClick={() => corregirInconsistencia(cv)}
                            disabled={!incorForm[cv] || corrigiendo===cv}
                            className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-40 mb-0.5"
                            style={{ backgroundColor:'#16a34a' }}>
                            {corrigiendo===cv?'…':'Corregir'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
            }
          </div>

          {/* Sin campaña */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
              Sin campaña asignada
              {sinCampaña.length > 0 && <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">{sinCampaña.length}</span>}
            </h2>
            <p className="text-xs text-gray-500 mb-4">Estas entregas no aparecen en la auto-liquidación.</p>
            {sinCampaña.length === 0
              ? <div className="text-center py-3 text-gray-400 text-sm">✅ Todas tienen campaña asignada</div>
              : <>
                  {/* Auto-detección */}
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <p className="text-sm font-medium text-blue-800 mb-2">🔍 Auto-detectar desde fechas</p>
                    {!autoDetPreview
                      ? <button onClick={calcAutoDeteccion} disabled={autoDetLoading||!sinCampaña.some(e=>e.fecha)}
                          className="px-4 py-2 rounded-lg text-white text-sm disabled:opacity-40" style={{ backgroundColor:'#1d4ed8' }}>
                          {autoDetLoading?'Calculando…':'Calcular'}
                        </button>
                      : <div>
                          <div className="space-y-1 mb-3">
                            {Object.entries(autoDetPreview).sort().map(([c,ids]) => (
                              <div key={c} className="flex justify-between text-sm bg-white rounded px-3 py-1.5 border border-blue-100">
                                <span>Campaña <strong>{c}</strong></span>
                                <span className="text-blue-500">{ids.length} entregas</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={aplicarAutoDeteccion} disabled={autoDetLoading}
                              className="px-4 py-1.5 rounded-lg text-white text-sm" style={{ backgroundColor:'#16a34a' }}>
                              Aplicar
                            </button>
                            <button onClick={() => setAutoDetPreview(null)}
                              className="px-4 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600">
                              Cancelar
                            </button>
                          </div>
                        </div>
                    }
                  </div>
                  {/* Asignación manual */}
                  <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                    <p className="text-sm font-medium text-gray-800 mb-3">📅 Asignar por rango de fechas</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                      {[{k:'campanya',l:'Campaña *',p:'Ej: 2023/2024',t:'text'},{k:'desde',l:'Desde',p:'',t:'date'},{k:'hasta',l:'Hasta',p:'',t:'date'}].map(f => (
                        <div key={f.k}>
                          <label className="block text-xs text-gray-500 mb-1">{f.l}</label>
                          <input type={f.t} placeholder={f.p} value={rangoForm[f.k]}
                            onChange={e => { setRangoForm(rf=>({...rf,[f.k]:e.target.value})); setRangoPreview(null) }}
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm" />
                        </div>
                      ))}
                    </div>
                    {!rangoPreview
                      ? <button onClick={calcRangoPreview} disabled={!rangoForm.campanya}
                          className="px-4 py-2 rounded-lg text-white text-sm disabled:opacity-40" style={{ backgroundColor:'#0f172a' }}>
                          Ver afectadas
                        </button>
                      : <div>
                          <p className="text-sm bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-3 text-blue-800">
                            <strong>{rangoPreview.length}</strong> entregas → <strong>"{rangoForm.campanya}"</strong>
                          </p>
                          <div className="flex gap-2">
                            {rangoPreview.length > 0 && (
                              <button onClick={asignarPorRango} disabled={asignando}
                                className="px-4 py-2 rounded-lg text-white text-sm" style={{ backgroundColor:'#16a34a' }}>
                                {asignando?'Asignando…':`Confirmar (${rangoPreview.length})`}
                              </button>
                            )}
                            <button onClick={() => setRangoPreview(null)}
                              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600">
                              Cancelar
                            </button>
                          </div>
                        </div>
                    }
                  </div>
                </>
            }
          </div>
        </div>
      )}
    </div>
  )
}
