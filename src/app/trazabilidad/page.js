'use client'
import { useState, useEffect } from 'react'
import { supabase, getUserId } from '@/lib/supabase'

// ── Carga dinámica jsPDF ───────────────────────────────────────
async function loadJsPDF() {
  if (window.jspdf) return window.jspdf.jsPDF
  await new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    s.onload = res; s.onerror = rej; document.head.appendChild(s)
  })
  await new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js'
    s.onload = res; s.onerror = rej; document.head.appendChild(s)
  })
  return window.jspdf.jsPDF
}

function generarPDFTrazabilidad(datos, campanaFiltro) {
  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 18

  const esMultiple = datos.length > 1
  const titulo = esMultiple
    ? `Trazabilidad campaña ${campanaFiltro || 'Todas'}`
    : `Trazabilidad · ${datos[0]?.nombre || ''}`

  // ── Cabecera ─────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, W, 42, 'F')
  doc.setFillColor(74, 222, 128); doc.rect(0, 0, 5, 42, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(255, 255, 255)
  doc.text('OlivaGest', M, 16)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(74, 222, 128)
  doc.text('Gestión oleícola cooperativa', M, 22)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255)
  doc.text('INFORME DE TRAZABILIDAD', M, 33)
  if (campanaFiltro) {
    doc.setFontSize(11); doc.setTextColor(74, 222, 128)
    doc.text(`Campaña ${campanaFiltro}`, W - M, 33, { align: 'right' })
  }
  doc.setFontSize(8); doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal')
  doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, W - M, 39, { align: 'right' })

  let y = 52

  // ── Por cada socio ───────────────────────────────────────────
  datos.forEach((socio, idx) => {
    if (idx > 0) {
      doc.addPage()
      y = 20
    }

    // Cabecera socio
    doc.setFillColor(15, 23, 42); doc.roundedRect(M, y, W - M * 2, 14, 2, 2, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255, 255, 255)
    doc.text(socio.nombre, M + 5, y + 9)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(74, 222, 128)
    doc.text(`${socio.totalKg.toLocaleString('es-ES')} kg · ${socio.entregas.length} entrega${socio.entregas.length !== 1 ? 's' : ''}`, W - M - 3, y + 9, { align: 'right' })
    y += 20

    // ── Parcelas ─────────────────────────────────────────────
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100, 116, 139)
    doc.text('PARCELAS REGISTRADAS', M, y); y += 5

    if (socio.parcelas.length > 0) {
      doc.autoTable({
        startY: y,
        margin: { left: M, right: M },
        head: [['Nombre', 'Municipio', 'Variedad', 'Superficie', 'Kg entregados']],
        body: socio.parcelas.map(p => {
          const kgP = socio.entregas.filter(e => e.parcela_id === p.id).reduce((s, e) => s + parseFloat(e.kg_neto || e.kg_bruto || 0), 0)
          return [p.nombre || '—', p.municipio || '—', p.variedad || '—', p.superficie_ha ? `${p.superficie_ha} ha` : '—', kgP > 0 ? `${kgP.toLocaleString('es-ES')} kg` : '—']
        }),
        headStyles: { fillColor: [248, 250, 252], textColor: [100, 116, 139], fontSize: 7.5, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        tableLineColor: [226, 232, 240], tableLineWidth: 0.1,
      })
      y = doc.lastAutoTable.finalY + 8
    } else {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(148, 163, 184)
      doc.text('Sin parcelas registradas', M, y); y += 8
    }

    // ── Entregas ─────────────────────────────────────────────
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100, 116, 139)
    doc.text('ENTREGAS', M, y); y += 5

    if (socio.entregas.length > 0) {
      doc.autoTable({
        startY: y,
        margin: { left: M, right: M },
        head: [['Fecha', 'Parcela', 'Campaña', 'Kg', 'Rendim.', 'Calidad']],
        body: socio.entregas.map(e => [
          e.fecha ? new Date(e.fecha).toLocaleDateString('es-ES') : '—',
          e.parcelas?.nombre || '—',
          e.campana || '—',
          `${parseFloat(e.kg_neto || e.kg_bruto || 0).toLocaleString('es-ES')} kg`,
          e.rendimiento ? `${e.rendimiento}%` : '—',
          e.calidad || '—',
        ]),
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.5, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
        foot: [['TOTAL', '', '', `${socio.totalKg.toLocaleString('es-ES')} kg`, '', '']],
        showFoot: 'lastPage',
      })
      y = doc.lastAutoTable.finalY + 8
    } else {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(148, 163, 184)
      doc.text('Sin entregas en este período', M, y); y += 8
    }

    // ── Liquidaciones ────────────────────────────────────────
    if (socio.liquidaciones.length > 0) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100, 116, 139)
      doc.text('LIQUIDACIONES', M, y); y += 5

      socio.liquidaciones.forEach(liq => {
        const imp = parseFloat(liq.importe_total || 0)
        const pKg = parseFloat(liq.precio_kg || 0)
        doc.setFillColor(240, 253, 244); doc.roundedRect(M, y, W - M * 2, 14, 2, 2, 'F')
        doc.setDrawColor(134, 239, 172); doc.roundedRect(M, y, W - M * 2, 14, 2, 2, 'S')
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(22, 101, 52)
        doc.text(`Campaña ${liq.campana}`, M + 4, y + 6)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139)
        doc.text(`${parseFloat(liq.kg_totales || 0).toLocaleString('es-ES')} kg · ${pKg.toFixed(3)} €/kg`, M + 4, y + 11)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(22, 101, 52)
        doc.text(imp.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }), W - M - 3, y + 10, { align: 'right' })
        y += 18
      })
    }
  })

  // ── Pie de página ─────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFillColor(15, 23, 42); doc.rect(0, 285, W, 12, 'F')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(148, 163, 184)
    doc.text(`OlivaGest · Informe de Trazabilidad · ${new Date().toLocaleDateString('es-ES')}`, W / 2, 292, { align: 'center' })
    doc.text(`${i} / ${pageCount}`, W - M, 292, { align: 'right' })
  }

  const campStr = (campanaFiltro || 'todas').replace(/\//g, '-')
  doc.save(`Trazabilidad_${campStr}.pdf`)
}

export default function TrazabilidadPage() {
  const [socios, setSocios] = useState([])
  const [campanyas, setCampanyas] = useState([])
  const [filtroSocio, setFiltroSocio] = useState('')
  const [filtroCampaña, setFiltroCampaña] = useState('')
  const [datos, setDatos] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => { cargarFiltros() }, [])

  async function cargarFiltros() {
    const userId = await getUserId()
    const [{ data: s }, { data: e }] = await Promise.all([
      supabase.from('socios').select('id, nombre').eq('user_id', userId).order('nombre'),
      supabase.from('entregas').select('campana').eq('user_id', userId),
    ])
    setSocios(s || [])
    const camps = [...new Set((e || []).map(x => x.campana).filter(Boolean))].sort().reverse()
    setCampanyas(camps)
  }

  async function buscar() {
    if (!filtroSocio && !filtroCampaña) return
    setLoading(true)
    const userId = await getUserId()

    let entregasQ = supabase
      .from('entregas')
      .select('*, socios(nombre), parcelas(nombre, municipio, variedad, superficie_ha)')
      .eq('user_id', userId)
      .order('fecha', { ascending: false })
    if (filtroSocio) entregasQ = entregasQ.eq('socio_id', filtroSocio)
    if (filtroCampaña) entregasQ = entregasQ.eq('campana', filtroCampaña)

    let parcelasQ = supabase.from('parcelas').select('*, socios(nombre)').eq('user_id', userId)
    if (filtroSocio) parcelasQ = parcelasQ.eq('socio_id', filtroSocio)

    let liquidQ = supabase.from('liquidaciones').select('*, socios(nombre)').eq('user_id', userId)
    if (filtroSocio) liquidQ = liquidQ.eq('socio_id', filtroSocio)
    if (filtroCampaña) liquidQ = liquidQ.eq('campana', filtroCampaña)

    const [{ data: entregasData }, { data: parcelasData }, { data: liquidacionesData }] = await Promise.all([
      entregasQ, parcelasQ, liquidQ,
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
      sociosMap[sid].totalKg += parseFloat(entrega.kg_neto || entrega.kg_bruto || 0)
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

  async function descargarPDF() {
    if (!datos || datos.length === 0) return
    setPdfLoading(true)
    try {
      await loadJsPDF()
      generarPDFTrazabilidad(datos, filtroCampaña)
    } catch (e) { alert('Error al generar PDF: ' + e.message) }
    setPdfLoading(false)
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
          <div className="flex items-end gap-2">
            <button
              onClick={buscar}
              disabled={loading || (!filtroSocio && !filtroCampaña)}
              className="flex-1 py-2 px-4 rounded-lg text-white text-sm font-medium disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: '#0f172a' }}
            >
              {loading ? 'Buscando...' : 'Ver trazabilidad'}
            </button>
            {datos && datos.length > 0 && (
              <button
                onClick={descargarPDF}
                disabled={pdfLoading}
                title="Descargar PDF"
                className="py-2 px-3 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-40 flex items-center gap-1.5 text-sm font-medium"
              >
                {pdfLoading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                )}
                PDF
              </button>
            )}
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
              <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803a7.5 7.5 0 0 0 10.607 0Z" />
              </svg>
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
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
                    Parcelas registradas
                  </h3>
                  {socio.parcelas.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {socio.parcelas.map(p => {
                        const kgParcela = socio.entregas
                          .filter(e => e.parcela_id === p.id)
                          .reduce((s, e) => s + parseFloat(e.kg_neto || e.kg_bruto || 0), 0)
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
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>
                    Entregas
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
                              <td className="px-4 py-2 text-gray-500">{e.fecha ? new Date(e.fecha).toLocaleDateString('es-ES') : '—'}</td>
                              <td className="px-4 py-2 text-gray-600 text-xs">{e.parcelas?.nombre || <span className="text-gray-300">—</span>}</td>
                              <td className="px-4 py-2 text-right font-medium text-gray-900">{parseFloat(e.kg_neto || e.kg_bruto || 0).toLocaleString('es-ES')} kg</td>
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
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" /></svg>
                    Liquidaciones
                  </h3>
                  {socio.liquidaciones.length > 0 ? (
                    <div className="space-y-2">
                      {socio.liquidaciones.map(liq => (
                        <div key={liq.id} className="border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-800">Campaña {liq.campana}</p>
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
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-200" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
          </svg>
          <p className="text-gray-400">Selecciona un socio o campaña para ver la trazabilidad</p>
        </div>
      )}
    </div>
  )
}
