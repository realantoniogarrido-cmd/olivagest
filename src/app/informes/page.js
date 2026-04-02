'use client'
import { useState, useEffect } from 'react'
import { supabase, getUserId } from '@/lib/supabase'

export default function InformesPage() {
  const [socios, setSocios] = useState([])
  const [campanyas, setCampanyas] = useState([])
  const [campaniaSeleccionada, setCampaniaSeleccionada] = useState('')
  const [datosCompletos, setDatosCompletos] = useState({})
  const [loading, setLoading] = useState(false)
  const [generando, setGenerando] = useState(null) // socio_id o 'todos'
  const [jspdfLoaded, setJspdfLoaded] = useState(false)

  // Cargar jsPDF + autotable desde CDN
  useEffect(() => {
    const loadLibs = async () => {
      if (window.jspdf) { setJspdfLoaded(true); return }
      await new Promise((resolve, reject) => {
        const s = document.createElement('script')
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
        s.onload = resolve; s.onerror = reject
        document.head.appendChild(s)
      })
      await new Promise((resolve, reject) => {
        const s = document.createElement('script')
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js'
        s.onload = resolve; s.onerror = reject
        document.head.appendChild(s)
      })
      setJspdfLoaded(true)
    }
    loadLibs().catch(console.error)
  }, [])

  useEffect(() => { fetchInicial() }, [])

  useEffect(() => {
    if (campaniaSeleccionada) cargarDatosCampania(campaniaSeleccionada)
  }, [campaniaSeleccionada])

  async function fetchInicial() {
    const userId = await getUserId()
    const { data: sData } = await supabase
      .from('socios').select('*').eq('user_id', userId).order('nombre')
    setSocios(sData || [])
    // Obtener campañas únicas
    const { data: eData } = await supabase
      .from('entregas').select('campaña').eq('user_id', userId)
    const camps = [...new Set((eData || []).map(e => e.campaña).filter(Boolean))].sort().reverse()
    setCampanyas(camps)
    if (camps.length > 0) setCampaniaSeleccionada(camps[0])
  }

  async function cargarDatosCampania(campania) {
    setLoading(true)
    const userId = await getUserId()

    // Entregas con parcela
    const { data: entregas } = await supabase
      .from('entregas')
      .select('*, parcelas(nombre, variedad)')
      .eq('user_id', userId)
      .eq('campaña', campania)
      .order('fecha', { ascending: true })

    // Liquidaciones
    const { data: liquidaciones } = await supabase
      .from('liquidaciones')
      .select('*')
      .eq('user_id', userId)
      .eq('campaña', campania)

    // Parcelas
    const { data: parcelas } = await supabase
      .from('parcelas')
      .select('*')
      .eq('user_id', userId)

    // Agrupar por socio
    const datos = {}
    for (const socio of socios) {
      datos[socio.id] = {
        socio,
        entregas: (entregas || []).filter(e => e.socio_id === socio.id),
        liquidacion: (liquidaciones || []).find(l => l.socio_id === socio.id) || null,
        parcelas: (parcelas || []).filter(p => p.socio_id === socio.id),
      }
    }
    setDatosCompletos(datos)
    setLoading(false)
  }

  function generarPDF(socioId) {
    if (!jspdfLoaded) return alert('Cargando librería PDF...')
    const { jsPDF } = window.jspdf
    const data = datosCompletos[socioId]
    if (!data) return

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = 210, margin = 18
    let y = 0

    // ── CABECERA ──────────────────────────────────────────────
    // Fondo navy cabecera
    doc.setFillColor(15, 23, 42)
    doc.rect(0, 0, W, 42, 'F')

    // Franja verde lateral
    doc.setFillColor(74, 222, 128)
    doc.rect(0, 0, 5, 42, 'F')

    // Título
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.setTextColor(255, 255, 255)
    doc.text('OlivaGest', margin, 16)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(74, 222, 128)
    doc.text('Gestión oleícola cooperativa', margin, 22)

    // Tipo de documento
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(255, 255, 255)
    doc.text('INFORME DE SOCIO', margin, 33)

    // Campaña (derecha)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(74, 222, 128)
    doc.text(`Campaña ${campaniaSeleccionada}`, W - margin, 33, { align: 'right' })

    y = 52

    // ── DATOS DEL SOCIO ────────────────────────────────────────
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(margin, y, W - margin * 2, 36, 3, 3, 'F')
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(margin, y, W - margin * 2, 36, 3, 3, 'S')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text('DATOS DEL SOCIO', margin + 5, y + 7)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(15, 23, 42)
    doc.text(data.socio.nombre || '—', margin + 5, y + 15)

    // Columna izquierda
    const col1x = margin + 5
    const col2x = W / 2 + 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(71, 85, 105)

    const fila1y = y + 22
    const fila2y = y + 28

    if (data.socio.dni) {
      doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
      doc.text('DNI/NIF:', col1x, fila1y)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(15, 23, 42)
      doc.text(data.socio.dni, col1x + 15, fila1y)
    }
    if (data.socio.telefono) {
      doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
      doc.text('Tel:', col1x, fila2y)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(15, 23, 42)
      doc.text(data.socio.telefono, col1x + 10, fila2y)
    }
    if (data.socio.email) {
      doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
      doc.text('Email:', col2x, fila1y)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(15, 23, 42)
      doc.text(data.socio.email, col2x + 12, fila1y)
    }
    if (data.socio.direccion) {
      doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
      doc.text('Dir.:', col2x, fila2y)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(15, 23, 42)
      const dir = doc.splitTextToSize(data.socio.direccion, 60)
      doc.text(dir[0], col2x + 10, fila2y)
    }

    y += 44

    // ── RESUMEN NUMÉRICO ───────────────────────────────────────
    const totalKg = data.entregas.reduce((s, e) => s + (parseFloat(e.kg_neto) || parseFloat(e.kg_bruto) || 0), 0)
    const liq = data.liquidacion
    const numEntregas = data.entregas.length
    const numParcelas = data.parcelas.length

    const cards = [
      { label: 'Entregas', value: String(numEntregas), unit: 'registros' },
      { label: 'Total kg netos', value: totalKg.toLocaleString('es-ES', { maximumFractionDigits: 0 }), unit: 'kg' },
      { label: 'Precio/kg', value: liq ? `${parseFloat(liq.precio_kg).toFixed(3)} €` : '—', unit: '' },
      { label: 'Importe total', value: liq ? `${parseFloat(liq.importe_total).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : 'Pendiente', unit: '' },
    ]

    const cardW = (W - margin * 2 - 9) / 4
    cards.forEach((card, i) => {
      const cx = margin + i * (cardW + 3)
      const isLast = i === 3
      doc.setFillColor(isLast && liq ? 15 : 255, isLast && liq ? 23 : 255, isLast && liq ? 42 : 255)
      doc.roundedRect(cx, y, cardW, 20, 2, 2, 'F')
      doc.setDrawColor(isLast && liq ? 74 : 226, isLast && liq ? 222 : 232, isLast && liq ? 128 : 240)
      doc.roundedRect(cx, y, cardW, 20, 2, 2, 'S')

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(isLast && liq ? 74 : 100, isLast && liq ? 222 : 116, isLast && liq ? 128 : 139)
      doc.text(card.label.toUpperCase(), cx + cardW / 2, y + 6, { align: 'center' })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(isLast && liq ? 10 : 11)
      doc.setTextColor(isLast && liq ? 255 : 15, isLast && liq ? 255 : 23, isLast && liq ? 255 : 42)
      doc.text(card.value, cx + cardW / 2, y + 14, { align: 'center' })
    })

    y += 28

    // ── PARCELAS ───────────────────────────────────────────────
    if (data.parcelas.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(15, 23, 42)
      doc.text('PARCELAS', margin, y)
      doc.setDrawColor(74, 222, 128)
      doc.setLineWidth(0.5)
      doc.line(margin, y + 1.5, margin + 22, y + 1.5)
      y += 5

      doc.autoTable({
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Nombre', 'Municipio', 'Variedad', 'Superficie (ha)', 'Rendimiento']],
        body: data.parcelas.map(p => [
          p.nombre || '—',
          p.municipio || '—',
          p.variedad || '—',
          p.superficie ? parseFloat(p.superficie).toFixed(2) : '—',
          p.rendimiento ? `${p.rendimiento}%` : '—',
        ]),
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { fontStyle: 'bold' } },
      })
      y = doc.lastAutoTable.finalY + 8
    }

    // ── ENTREGAS ───────────────────────────────────────────────
    if (data.entregas.length > 0) {
      // Nueva página si no hay espacio
      if (y > 220) { doc.addPage(); y = 20 }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(15, 23, 42)
      doc.text('ENTREGAS DE ACEITUNA', margin, y)
      doc.setDrawColor(74, 222, 128)
      doc.setLineWidth(0.5)
      doc.line(margin, y + 1.5, margin + 46, y + 1.5)
      y += 5

      doc.autoTable({
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Fecha', 'Parcela', 'Kg brutos', 'Kg netos', 'Humedad', 'Impurezas']],
        body: data.entregas.map(e => [
          e.fecha ? new Date(e.fecha).toLocaleDateString('es-ES') : '—',
          e.parcelas?.nombre || '—',
          e.kg_bruto ? parseFloat(e.kg_bruto).toLocaleString('es-ES') : '—',
          e.kg_neto ? parseFloat(e.kg_neto).toLocaleString('es-ES') : '—',
          e.humedad ? `${e.humedad}%` : '—',
          e.impurezas ? `${e.impurezas}%` : '—',
        ]),
        foot: [[
          { content: 'TOTAL', colSpan: 2, styles: { fontStyle: 'bold', textColor: [15, 23, 42] } },
          {
            content: data.entregas.reduce((s, e) => s + (parseFloat(e.kg_bruto) || 0), 0)
              .toLocaleString('es-ES', { maximumFractionDigits: 0 }),
            styles: { fontStyle: 'bold', textColor: [15, 23, 42] }
          },
          {
            content: totalKg.toLocaleString('es-ES', { maximumFractionDigits: 0 }),
            styles: { fontStyle: 'bold', textColor: [15, 23, 42] }
          },
          '', '',
        ]],
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
        footStyles: { fillColor: [240, 253, 244], textColor: [15, 23, 42] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      })
      y = doc.lastAutoTable.finalY + 8
    }

    // ── LIQUIDACIÓN ────────────────────────────────────────────
    if (y > 230) { doc.addPage(); y = 20 }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(15, 23, 42)
    doc.text('LIQUIDACIÓN', margin, y)
    doc.setDrawColor(74, 222, 128)
    doc.setLineWidth(0.5)
    doc.line(margin, y + 1.5, margin + 26, y + 1.5)
    y += 7

    if (liq) {
      const tieneRendimiento = liq.rendimiento_bruto && parseFloat(liq.rendimiento_bruto) > 0
      const estadoLiq = liq.estado || 'borrador'
      const estadoLabels = { borrador: 'BORRADOR', pendiente_pago: 'PEND. DE PAGO', pagada: 'PAGADA' }
      const estadoColors = {
        borrador:       [100, 116, 139],
        pendiente_pago: [245, 158, 11],
        pagada:         [34, 197, 94],
      }

      // Badge de estado (arriba derecha)
      const ec = estadoColors[estadoLiq] || estadoColors.borrador
      doc.setFillColor(...ec)
      doc.roundedRect(W - margin - 36, y - 5, 36, 8, 2, 2, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.setTextColor(255, 255, 255)
      doc.text(estadoLabels[estadoLiq] || 'BORRADOR', W - margin - 18, y - 0.5, { align: 'center' })
      if (liq.fecha_pago) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.5)
        doc.setTextColor(148, 163, 184)
        doc.text(`Pagado: ${new Date(liq.fecha_pago).toLocaleDateString('es-ES')}`, W - margin - 18, y + 5, { align: 'center' })
      }

      // Caja principal liquidación
      const boxH = tieneRendimiento ? 46 : 32
      doc.setFillColor(15, 23, 42)
      doc.roundedRect(margin, y, W - margin * 2, boxH, 3, 3, 'F')

      // Si tiene rendimiento: fila superior con desglose, inferior con importe
      if (tieneRendimiento) {
        const rn = parseFloat(liq.rendimiento_neto) || 0
        const kgAceite = parseFloat(liq.kg_aceite_final) || 0
        const desglose = [
          { label: 'Kg aceituna', value: parseFloat(liq.kg_totales).toLocaleString('es-ES') + ' kg' },
          { label: 'Rend. bruto', value: parseFloat(liq.rendimiento_bruto).toFixed(1) + '%' },
          { label: 'Punto extrac.', value: (parseFloat(liq.punto_extraccion) || 0).toFixed(1) + '%' },
          { label: 'Rend. neto', value: rn.toFixed(1) + '%' },
          { label: 'Kg aceite final', value: kgAceite.toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' kg' },
        ]
        const dW = (W - margin * 2) / desglose.length
        desglose.forEach((d, i) => {
          const lx = margin + i * dW + dW / 2
          doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(74, 222, 128)
          doc.text(d.label.toUpperCase(), lx, y + 9, { align: 'center' })
          doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255)
          doc.text(d.value, lx, y + 17, { align: 'center' })
        })
        // Separador
        doc.setDrawColor(74, 222, 128); doc.setLineWidth(0.3)
        doc.line(margin + 6, y + 21, W - margin - 6, y + 21)
        // Precio y total
        const bottom = [
          { label: 'Precio por kg aceite', value: parseFloat(liq.precio_kg).toFixed(3) + ' €/kg' },
          { label: 'Importe total a percibir', value: parseFloat(liq.importe_total).toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' },
        ]
        const bW = (W - margin * 2) / 2
        bottom.forEach((b, i) => {
          const lx = margin + i * bW + bW / 2
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(74, 222, 128)
          doc.text(b.label.toUpperCase(), lx, y + 29, { align: 'center' })
          doc.setFont('helvetica', 'bold'); doc.setFontSize(i === 1 ? 14 : 11); doc.setTextColor(255, 255, 255)
          doc.text(b.value, lx, y + 40, { align: 'center' })
        })
      } else {
        const colW = (W - margin * 2) / 3
        const liqItems = [
          { label: 'Kg totales liquidados', value: parseFloat(liq.kg_totales).toLocaleString('es-ES') + ' kg' },
          { label: 'Precio por kg', value: parseFloat(liq.precio_kg).toFixed(3) + ' €/kg' },
          { label: 'Importe total', value: parseFloat(liq.importe_total).toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' },
        ]
        liqItems.forEach((item, i) => {
          const lx = margin + i * colW + colW / 2
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(74, 222, 128)
          doc.text(item.label.toUpperCase(), lx, y + 10, { align: 'center' })
          doc.setFont('helvetica', 'bold'); doc.setFontSize(i === 2 ? 14 : 12); doc.setTextColor(255, 255, 255)
          doc.text(item.value, lx, y + 22, { align: 'center' })
        })
      }
      y += boxH + 8
    } else {
      doc.setFillColor(254, 243, 199)
      doc.roundedRect(margin, y, W - margin * 2, 14, 2, 2, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(146, 64, 14)
      doc.text('⚠  Liquidación pendiente para esta campaña', margin + 8, y + 9)
      y += 22
    }

    // ── PIE DE PÁGINA ──────────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages()
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p)
      const pageH = doc.internal.pageSize.getHeight()
      doc.setFillColor(248, 250, 252)
      doc.rect(0, pageH - 14, W, 14, 'F')
      doc.setDrawColor(226, 232, 240)
      doc.line(0, pageH - 14, W, pageH - 14)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(148, 163, 184)
      doc.text(
        `Generado el ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })} · OlivaGest · Confidencial`,
        margin, pageH - 5.5
      )
      doc.text(`Pág. ${p} / ${totalPages}`, W - margin, pageH - 5.5, { align: 'right' })
    }

    // Descargar
    const nombreArchivo = `Informe_${(data.socio.nombre || 'socio').replace(/\s+/g, '_')}_${campaniaSeleccionada}.pdf`
    doc.save(nombreArchivo)
  }

  async function generarTodos() {
    if (!jspdfLoaded) return alert('Cargando librería PDF...')
    setGenerando('todos')
    for (const socio of socios) {
      if (datosCompletos[socio.id]?.entregas?.length > 0) {
        generarPDF(socio.id)
        await new Promise(r => setTimeout(r, 300))
      }
    }
    setGenerando(null)
  }

  const sociosConActividad = socios.filter(s =>
    datosCompletos[s.id]?.entregas?.length > 0
  )
  const sociosSinActividad = socios.filter(s =>
    campaniaSeleccionada && datosCompletos[s.id] && datosCompletos[s.id].entregas?.length === 0
  )

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* Cabecera */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Informes por socio</h1>
        <p className="text-gray-500 mt-1 text-sm">Genera el informe PDF individual de cada socio con sus entregas y liquidación.</p>
      </div>

      {/* Selector campaña + botón todos */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Campaña</label>
          <select
            value={campaniaSeleccionada}
            onChange={e => setCampaniaSeleccionada(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
          >
            <option value="">— Selecciona campaña —</option>
            {campanyas.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {loading && (
            <span className="text-sm text-gray-400 flex items-center gap-1.5">
              <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Cargando...
            </span>
          )}
        </div>

        {sociosConActividad.length > 0 && (
          <button
            onClick={generarTodos}
            disabled={generando === 'todos'}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
            style={{ backgroundColor: '#0f172a' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {generando === 'todos' ? 'Generando...' : `Generar todos (${sociosConActividad.length})`}
          </button>
        )}
      </div>

      {/* Lista de socios con actividad */}
      {!loading && campaniaSeleccionada && (
        <div className="space-y-3">
          {sociosConActividad.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="font-medium">No hay entregas en esta campaña</p>
            </div>
          )}

          {sociosConActividad.map(socio => {
            const d = datosCompletos[socio.id]
            const totalKg = d.entregas.reduce((s, e) => s + (parseFloat(e.kg_neto) || parseFloat(e.kg_bruto) || 0), 0)
            const liq = d.liquidacion
            const isGenerando = generando === socio.id

            return (
              <div
                key={socio.id}
                className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-5 py-4 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Info socio */}
                <div className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: '#0f172a' }}
                  >
                    {(socio.nombre || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{socio.nombre}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{socio.dni || socio.email || 'Sin datos de contacto'}</p>
                  </div>
                </div>

                {/* Métricas */}
                <div className="hidden sm:flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Entregas</p>
                    <p className="text-sm font-semibold text-gray-900">{d.entregas.length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Kg netos</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {totalKg.toLocaleString('es-ES', { maximumFractionDigits: 0 })} kg
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Importe</p>
                    {liq ? (
                      <p className="text-sm font-semibold text-green-600">
                        {parseFloat(liq.importe_total).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                      </p>
                    ) : (
                      <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        Sin liquidar
                      </span>
                    )}
                  </div>
                </div>

                {/* Botón PDF */}
                <button
                  onClick={() => { setGenerando(socio.id); generarPDF(socio.id); setTimeout(() => setGenerando(null), 1000) }}
                  disabled={isGenerando}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{ backgroundColor: isGenerando ? '#f1f5f9' : '#4ade80', color: isGenerando ? '#94a3b8' : '#0f172a' }}
                >
                  {isGenerando ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  )}
                  PDF
                </button>
              </div>
            )
          })}

          {/* Socios sin actividad en esta campaña */}
          {sociosSinActividad.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                Sin actividad en esta campaña ({sociosSinActividad.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {sociosSinActividad.map(s => (
                  <span key={s.id} className="text-xs bg-gray-50 text-gray-400 border border-gray-100 rounded-full px-3 py-1">
                    {s.nombre}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Estado inicial */}
      {!campaniaSeleccionada && (
        <div className="text-center py-16 text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="font-medium">Selecciona una campaña para ver los socios</p>
        </div>
      )}
    </div>
  )
}
