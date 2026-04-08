'use client'
import { useState, useEffect } from 'react'
import { supabase, getUserId } from '@/lib/supabase'

const HERRAMIENTAS = [
  {
    id: 'precio',
    titulo: 'Precio óptimo de venta',
    descripcion: 'Analiza tus datos históricos y el mercado para recomendar el mejor precio de venta.',
    icono: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'green',
    prompt: (datos) => `Eres un experto en el mercado del aceite de oliva en España (Andalucía, Jaén). Analiza estos datos de una cooperativa oleícola y recomienda el precio óptimo de venta. Datos: ${JSON.stringify(datos)}. Responde SOLO con este JSON: {"resumen":"texto 2-3 frases","tendencia":"alcista|bajista|estable","precio_recomendado":0.00,"momento_venta":"inmediato|esperar|negociar","recomendaciones":["r1","r2","r3"],"alertas":["a1"],"explicacion_precio":"texto 2-3 frases","contexto_mercado":"texto 2-3 frases"}`,
  },
  {
    id: 'produccion',
    titulo: 'Predicción de producción',
    descripcion: 'Estima la producción esperada de la campaña según tus datos históricos y factores externos.',
    icono: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    color: 'blue',
    prompt: (datos) => `Eres un experto agrónomo especializado en olivicultura en Jaén, España. Analiza los datos históricos de esta cooperativa y predice la producción esperada para la próxima campaña considerando factores como la vecería del olivo, clima típico de Jaén, y tendencias históricas. Datos: ${JSON.stringify(datos)}. Responde SOLO con este JSON: {"resumen":"texto 2-3 frases","produccion_estimada_kg":0,"variacion_respecto_anterior":"texto ej +15%","factores_positivos":["f1","f2","f3"],"factores_riesgo":["r1","r2"],"recomendaciones_agro":["rec1","rec2","rec3"],"mejor_epoca_recoleccion":"texto"}`,
  },
  {
    id: 'rentabilidad',
    titulo: 'Análisis de rentabilidad',
    descripcion: 'Evalúa la rentabilidad por socio, campaña y compara el rendimiento histórico.',
    icono: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    color: 'purple',
    prompt: (datos) => `Eres un consultor financiero especializado en cooperativas oleícolas andaluzas. Analiza la rentabilidad de esta cooperativa basándote en sus datos históricos. Datos: ${JSON.stringify(datos)}. Responde SOLO con este JSON: {"resumen":"texto 2-3 frases","rentabilidad_general":"alta|media|baja","ingreso_medio_por_kg":0.00,"socio_mas_productivo":"nombre o N/A","campaña_mas_rentable":"nombre o N/A","tendencia_ingresos":"creciente|estable|decreciente","oportunidades_mejora":["o1","o2","o3"],"riesgos_financieros":["r1","r2"],"recomendaciones":["rec1","rec2","rec3"]}`,
  },
  {
    id: 'estrategia',
    titulo: 'Estrategia cooperativa',
    descripcion: 'Recomendaciones estratégicas para mejorar la gestión y competitividad de la cooperativa.',
    icono: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    color: 'amber',
    prompt: (datos) => `Eres un consultor estratégico especializado en cooperativas oleícolas de Andalucía con 20 años de experiencia. Analiza estos datos y proporciona una estrategia integral para mejorar la cooperativa. Datos: ${JSON.stringify(datos)}. Responde SOLO con este JSON: {"resumen":"texto 2-3 frases","puntos_fuertes":["p1","p2","p3"],"areas_mejora":["a1","a2","a3"],"estrategias_corto_plazo":["e1","e2","e3"],"estrategias_largo_plazo":["e1","e2"],"digitalización":"texto sobre oportunidades digitales","certificaciones_recomendadas":["c1","c2"],"conclusion":"texto 2-3 frases motivadoras"}`,
  },
]

const colores = {
  green: { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-600', badge: 'bg-green-100 text-green-800', btn: 'bg-green-700 hover:bg-green-800' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', badge: 'bg-blue-100 text-blue-800', btn: 'bg-blue-700 hover:bg-blue-800' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600', badge: 'bg-purple-100 text-purple-800', btn: 'bg-purple-700 hover:bg-purple-800' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600', badge: 'bg-amber-100 text-amber-800', btn: 'bg-amber-700 hover:bg-amber-800' },
}

export default function AnalisisPage() {
  const [datosResumen, setDatosResumen] = useState(null)
  const [resultados, setResultados] = useState({})
  const [loadings, setLoadings] = useState({})
  const [errores, setErrores] = useState({})
  const [herramientaActiva, setHerramientaActiva] = useState(null)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const userId = await getUserId()
    const [{ data: entregas }, { data: liquidaciones }, { data: campanyas }, { data: socios }, { data: parcelas }] = await Promise.all([
      supabase.from('entregas').select('*').eq('user_id', userId),
      supabase.from('liquidaciones').select('*, socios(nombre)').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('campanyas').select('*').eq('user_id', userId),
      supabase.from('socios').select('*').eq('user_id', userId),
      supabase.from('parcelas').select('*').eq('user_id', userId),
    ])

    const liqsArr = liquidaciones || []
    setDatosResumen({
      total_socios: (socios || []).length,
      total_parcelas: (parcelas || []).length,
      total_kg: (entregas || []).reduce((s, e) => s + parseFloat(e.kg || 0), 0),
      total_liquidaciones: liqsArr.length,
      importe_total: liqsArr.reduce((s, l) => s + parseFloat(l.importe_total || 0), 0),
      precio_medio: liqsArr.length ? (liqsArr.reduce((s, l) => s + parseFloat(l.precio_kg || 0), 0) / liqsArr.length).toFixed(3) : null,
      precios_historicos: liqsArr.map(l => ({ campana: l.campana, precio_kg: parseFloat(l.precio_kg), kg: parseFloat(l.kg_totales), importe: parseFloat(l.importe_total) })),
      campanyas: (campanyas || []).map(c => ({ nombre: c.nombre, estado: c.estado, precio_kg: c.precio_kg })),
      region: 'Jaén, Andalucía, España',
      año_actual: new Date().getFullYear(),
    })
  }

  async function ejecutarAnalisis(herramienta) {
    setHerramientaActiva(herramienta.id)
    setLoadings(l => ({ ...l, [herramienta.id]: true }))
    setErrores(e => ({ ...e, [herramienta.id]: null }))

    try {
      const res = await fetch('/api/analisis-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datos: datosResumen, tipo: herramienta.id, prompt: herramienta.prompt(datosResumen) }),
      })
      const result = await res.json()
      if (result.error) throw new Error(result.error)
      setResultados(r => ({ ...r, [herramienta.id]: result.analisis }))
    } catch (e) {
      setErrores(err => ({ ...err, [herramienta.id]: 'Error al conectar con la IA. Verifica tu API key y que tienes créditos en console.anthropic.com' }))
    }
    setLoadings(l => ({ ...l, [herramienta.id]: false }))
  }

  function renderResultado(id, resultado) {
    if (!resultado) return null
    const items = Object.entries(resultado).map(([key, value]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      if (Array.isArray(value)) {
        return (
          <div key={key} className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</p>
            <ul className="space-y-1">
              {value.map((v, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-gray-400 mt-0.5">•</span>{v}
                </li>
              ))}
            </ul>
          </div>
        )
      }
      if (typeof value === 'number') {
        return (
          <div key={key} className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        )
      }
      return (
        <div key={key} className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-sm text-gray-700 leading-relaxed">{value}</p>
        </div>
      )
    })
    return <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">{items}</div>
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Espacio IA</h1>
        <p className="text-gray-500 mt-1">Herramientas de inteligencia artificial para optimizar tu cooperativa</p>
      </div>

      {/* KPIs */}
      {datosResumen && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {[
            { label: 'Socios', value: datosResumen.total_socios },
            { label: 'Parcelas', value: datosResumen.total_parcelas },
            { label: 'Kg totales', value: datosResumen.total_kg.toLocaleString('es-ES') },
            { label: 'Liquidaciones', value: datosResumen.total_liquidaciones },
            { label: '€/kg medio', value: datosResumen.precio_medio ?? '—' },
          ].map(k => (
            <div key={k.label} className="bg-white border border-gray-100 shadow-sm rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-gray-900">{k.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Herramientas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {HERRAMIENTAS.map(h => {
          const c = colores[h.color]
          const resultado = resultados[h.id]
          const loading = loadings[h.id]
          const error = errores[h.id]
          const activa = herramientaActiva === h.id

          return (
            <div key={h.id} className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-all ${activa && resultado ? 'md:col-span-2' : ''}`}>
              {/* Header */}
              <div className={`p-5 border-b ${c.bg} ${c.border}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${c.icon}`}>{h.icono}</div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{h.titulo}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{h.descripcion}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => ejecutarAnalisis(h)}
                    disabled={loading || !datosResumen}
                    className={`flex-shrink-0 ml-4 flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 ${c.btn}`}
                  >
                    {loading ? (
                      <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Analizando...</>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {resultado ? 'Re-analizar' : 'Analizar'}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Resultado */}
              {error && (
                <div className="p-4 bg-red-50 border-t border-red-100">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              {resultado && !loading && (
                <div className="p-5">
                  {renderResultado(h.id, resultado)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-gray-400">Powered by Claude AI · Los análisis son orientativos y deben complementarse con criterio profesional</p>
    </div>
  )
}