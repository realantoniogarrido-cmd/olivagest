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

// ── Genera PDF de liquidación para un socio ───────────────────
function generarPDFLiquidacion(socio, liq, entregas, campana) {
  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 18
  let y = 0

  // Cabecera navy
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, W, 42, 'F')
  doc.setFillColor(74, 222, 128); doc.rect(0, 0, 5, 42, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(255, 255, 255)
  doc.text('OlivaGest', M, 16)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(74, 222, 128)
  doc.text('Gestión oleícola cooperativa', M, 22)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255)
  doc.text('LIQUIDACIÓN DE CAMPAÑA', M, 33)
  doc.setFontSize(11); doc.setTextColor(74, 222, 128)
  doc.text(`Campaña ${campana}`, W - M, 33, { align: 'right' })
  y = 52

  // Datos socio
  doc.setFillColor(248, 250, 252); doc.roundedRect(M, y, W - M * 2, 36, 3, 3, 'F')
  doc.setDrawColor(226, 232, 240); doc.roundedRect(M, y, W - M * 2, 36, 3, 3, 'S')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100, 116, 139)
  doc.text('DATOS DEL SOCIO', M + 5, y + 7)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(15, 23, 42)
  doc.text(socio.nombre || '—', M + 5, y + 16)
  const c2 = W / 2 + 5
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
  if (socio.dni) { doc.setTextColor(100,116,139); doc.text('DNI/NIF:', M+5, y+24); doc.setTextColor(15,23,42); doc.text(socio.dni, M+18, y+24) }
  if (socio.telefono) { doc.setTextColor(100,116,139); doc.text('Tel:', M+5, y+30); doc.setTextColor(15,23,42); doc.text(socio.telefono, M+13, y+30) }
  if (socio.municipio) { doc.setTextColor(100,116,139); doc.text('Municipio:', c2, y+24); doc.setTextColor(15,23,42); doc.text(socio.municipio, c2+20, y+24) }
  if (socio.iban) { doc.setTextColor(100,116,139); doc.text('IBAN:', c2, y+30); doc.setTextColor(15,23,42); doc.text(socio.iban, c2+11, y+30) }
  y += 44

  // Resumen liquidación
  const rb = parseFloat(liq.rendimiento_bruto)||0, pe = parseFloat(liq.punto_extraccion)||0
  const rn = Math.max(0, rb - pe)
  const kgAceite = parseFloat(liq.kg_aceite_final) || (parseFloat(liq.kg_totales)*rn/100)
  const kgT = parseFloat(liq.kg_totales)||0
  const imp = parseFloat(liq.importe_total)||0
  const pKg = parseFloat(liq.precio_kg)||0

  const kpis = [
    { l: 'Kg aceituna', v: `${kgT.toLocaleString('es-ES')} kg` },
    { l: 'Rendimiento neto', v: rn > 0 ? `${rn.toFixed(1)}%` : '—' },
    { l: 'Kg aceite', v: kgAceite > 0 ? `${kgAceite.toLocaleString('es-ES',{maximumFractionDigits:1})} kg` : '—' },
    { l: 'Precio/kg aceite', v: pKg > 0 ? `${pKg.toFixed(3)} €/kg` : '—' },
  ]
  const boxW = (W - M*2 - 9) / 4
  kpis.forEach((k, i) => {
    const bx = M + i*(boxW+3)
    doc.setFillColor(15,23,42); doc.roundedRect(bx, y, boxW, 22, 2, 2, 'F')
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(148,163,184)
    doc.text(k.l, bx+4, y+8)
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(255,255,255)
    doc.text(k.v, bx+4, y+17)
  })
  y += 30

  // Importe total destacado
  doc.setFillColor(240,253,244); doc.roundedRect(M, y, W-M*2, 16, 3, 3, 'F')
  doc.setDrawColor(134,239,172); doc.roundedRect(M, y, W-M*2, 16, 3, 3, 'S')
  doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(22,101,52)
  doc.text('IMPORTE TOTAL A PERCIBIR', M+5, y+7)
  doc.setFontSize(14); doc.setTextColor(22,101,52)
  doc.text(`${imp.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}`, W-M, y+10, {align:'right'})
  y += 24

  // Tabla entregas
  if (entregas?.length > 0) {
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(15,23,42)
    doc.text('DETALLE DE ENTREGAS', M, y); y += 4
    doc.autoTable({
      startY: y,
      margin: { left: M, right: M },
      head: [['Fecha','Parcela','Calidad','Kg bruto','Rendim.']],
      body: entregas.map(e => [
        e.fecha ? new Date(e.fecha).toLocaleDateString('es-ES') : '—',
        e.parcelas?.nombre || '—',
        e.calidad || '—',
        `${parseFloat(e.kg_bruto||0).toLocaleString('es-ES')} kg`,
        e.rendimiento ? `${e.rendimiento}%` : '—',
      ]),
      headStyles: { fillColor: [15,23,42], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [30,41,59] },
      alternateRowStyles: { fillColor: [248,250,252] },
      columnStyles: { 0:{cellWidth:28}, 1:{cellWidth:50}, 2:{cellWidth:22}, 3:{cellWidth:30}, 4:{cellWidth:22} },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // Pie
  doc.setFillColor(15,23,42); doc.rect(0, 285, W, 12, 'F')
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(148,163,184)
  doc.text(`Generado por OlivaGest · ${new Date().toLocaleDateString('es-ES')}`, W/2, 292, {align:'center'})

  return doc.output('datauristring').split(',')[1] // base64
}

// ── Helpers de estado ──────────────────────────────────────────
const ESTADOS = {
  borrador:       { label: 'Borrador',      bg: '#f1f5f9', color: '#64748b', dot: '#94a3b8' },
  pendiente_pago: { label: 'Pend. de pago', bg: '#fffbeb', color: '#92400e', dot: '#f59e0b' },
  pagada:         { label: 'Pagada',        bg: '#f0fdf4', color: '#166534', dot: '#22c55e' },
}
const ORDEN_ESTADOS = ['borrador', 'pendiente_pago', 'pagada']

function EstadoBadge({ estado, onClick }) {
  const e = ESTADOS[estado] || ESTADOS.borrador
  return (
    <button
      onClick={onClick}
      title="Cambiar estado"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-opacity hover:opacity-75"
      style={{ backgroundColor: e.bg, color: e.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: e.dot }} />
      {e.label}
    </button>
  )
}

// ── Cálculos rendimiento ───────────────────────────────────────
function calcRendimiento({ kg_totales, rendimiento_bruto, punto_extraccion, precio_kg }) {
  const kg   = parseFloat(kg_totales) || 0
  const rb   = parseFloat(rendimiento_bruto) || 0
  const pe   = parseFloat(punto_extraccion) || 0
  const rn   = Math.max(0, rb - pe)
  const kgAceite = (kg * rn) / 100
  const precio = parseFloat(precio_kg) || 0
  // Si hay rendimiento configurado, importe = kg_aceite * precio; si no, kg * precio
  const importe = rb > 0 ? kgAceite * precio : kg * precio
  return { rendimiento_neto: rn.toFixed(2), kg_aceite_final: kgAceite.toFixed(2), importe_total: importe.toFixed(2) }
}

export default function LiquidacionesPage() {
  const [socios, setSocios] = useState([])
  const [liquidaciones, setLiquidaciones] = useState([])
  const [loading, setLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(null)
  const [mensaje, setMensaje] = useState('')

  // Formulario manual
  const emptyForm = { socio_id: '', campana: '', kg_totales: '', rendimiento_bruto: '', punto_extraccion: '', precio_kg: '', importe_total: '' }
  const [form, setForm] = useState(emptyForm)

  // Auto-liquidación
  const [modoAuto, setModoAuto] = useState(false)
  const [campanyas, setCampanyas] = useState([])
  const [autoForm, setAutoForm] = useState({ campana: '', precio_kg: '', rendimiento_bruto: '', punto_extraccion: '' })
  const [autoPreview, setAutoPreview] = useState(null)
  const [autoLoading, setAutoLoading] = useState(false)
  const [generando, setGenerando] = useState(false)

  // Filtro tabla
  const [filtroCampaña, setFiltroCampaña] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  useEffect(() => { fetchSocios(); fetchLiquidaciones(); fetchCampanyas() }, [])

  // Recalcular importe en formulario manual cuando cambian los campos
  useEffect(() => {
    const calc = calcRendimiento(form)
    setForm(f => ({
      ...f,
      importe_total: calc.importe_total,
      rendimiento_neto: calc.rendimiento_neto,
      kg_aceite_final: calc.kg_aceite_final,
    }))
  }, [form.kg_totales, form.rendimiento_bruto, form.punto_extraccion, form.precio_kg]) // eslint-disable-line

  async function fetchSocios() {
    const userId = await getUserId()
    const { data } = await supabase.from('socios').select('*').eq('user_id', userId)
    setSocios(data || [])
  }

  async function fetchLiquidaciones() {
    const userId = await getUserId()
    const { data } = await supabase
      .from('liquidaciones')
      .select('*, socios(nombre, email)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setLiquidaciones(data || [])
  }

  async function fetchCampanyas() {
    const userId = await getUserId()
    // select('*') para evitar bug silencioso de ñ en lista explícita de columnas
    const { data } = await supabase.from('entregas').select('*').eq('user_id', userId)
    const camps = [...new Set((data || []).map(e => e.campana).filter(Boolean))].sort().reverse()
    setCampanyas(camps)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const userId = await getUserId()
    const calc = calcRendimiento(form)
    await supabase.from('liquidaciones').insert([{
      user_id: userId,
      socio_id: form.socio_id,
      campana: form.campana,
      kg_totales: form.kg_totales,
      rendimiento_bruto: form.rendimiento_bruto || null,
      punto_extraccion: form.punto_extraccion || null,
      rendimiento_neto: form.rendimiento_bruto ? calc.rendimiento_neto : null,
      kg_aceite_final: form.rendimiento_bruto ? calc.kg_aceite_final : null,
      precio_kg: form.precio_kg,
      importe_total: calc.importe_total,
      estado: 'borrador',
    }])
    setForm(emptyForm)
    fetchLiquidaciones()
    setLoading(false)
  }

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar esta liquidación?')) return
    await supabase.from('liquidaciones').delete().eq('id', id)
    fetchLiquidaciones()
  }

  async function handleCambiarEstado(liq) {
    const idx = ORDEN_ESTADOS.indexOf(liq.estado || 'borrador')
    const siguiente = ORDEN_ESTADOS[(idx + 1) % ORDEN_ESTADOS.length]
    const updates = { estado: siguiente }
    if (siguiente === 'pagada') updates.fecha_pago = new Date().toISOString()
    else updates.fecha_pago = null
    await supabase.from('liquidaciones').update(updates).eq('id', liq.id)
    fetchLiquidaciones()
  }

  async function handleEnviarEmail(liq) {
    const socio = socios.find(s => s.id === liq.socio_id)
    if (!socio?.email) { alert('Este socio no tiene email registrado.'); return }
    setEmailLoading(liq.id)
    try {
      // 1. Cargar jsPDF
      await loadJsPDF()

      // 2. Obtener entregas del socio para esta campaña
      const userId = await getUserId()
      const { data: entregasSocio } = await supabase
        .from('entregas')
        .select('*, parcelas(nombre)')
        .eq('user_id', userId)
        .eq('socio_id', liq.socio_id)
        .eq('campana', liq.campana)
        .order('fecha', { ascending: true })

      // 3. Generar PDF
      const pdfBase64 = generarPDFLiquidacion(socio, liq, entregasSocio || [], liq.campana)
      const pdfFilename = `Liquidacion_${liq.campana}_${(socio.nombre || '').replace(/[^a-z0-9]/gi, '_')}.pdf`

      // 4. Enviar email con PDF adjunto
      const adminEmail = (await supabase.auth.getSession()).data.session?.user?.email || ''
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socioNombre: liq.socios?.nombre || socio.nombre,
          socioEmail: socio.email,
          adminEmail,
          kg: liq.kg_totales,
          importe: liq.importe_total,
          campana: liq.campana,
          fecha: new Date(liq.created_at).toLocaleDateString('es-ES'),
          rendimientoBruto: liq.rendimiento_bruto,
          puntoExtraccion: liq.punto_extraccion,
          kgAceite: liq.kg_aceite_final,
          precioKg: liq.precio_kg,
          pdfBase64,
          pdfFilename,
        }),
      })
      const result = await res.json()
      if (result.success && result.testMode) {
        setMensaje(`✅ Email redirigido a tu email (modo prueba) — destino real: ${socio.email}`)
      } else if (result.success) {
        setMensaje(`✅ Email enviado a ${socio.email}`)
      } else {
        setMensaje(`❌ ${result.error?.message || result.error || 'Error al enviar el email'}`)
      }
    } catch (err) { setMensaje(`❌ Error: ${err.message || 'Error de conexión'}`) }
    setTimeout(() => setMensaje(''), 5000)
    setEmailLoading(null)
  }

  // ---- AUTO-LIQUIDACIÓN ----
  async function calcularAuto() {
    if (!autoForm.campana || !autoForm.precio_kg) return
    setAutoLoading(true); setAutoPreview(null)
    const userId = await getUserId()
    const precioPorKg = parseFloat(autoForm.precio_kg)
    const rb = parseFloat(autoForm.rendimiento_bruto) || 0
    const pe = parseFloat(autoForm.punto_extraccion) || 0

    const { data: entregas } = await supabase
      .from('entregas')
      .select('*, socios(nombre)')
      .eq('user_id', userId)
      .eq('campana', autoForm.campana)

    const { data: yaLiquidadas } = await supabase
      .from('liquidaciones').select('socio_id')
      .eq('user_id', userId).eq('campana', autoForm.campana)

    const sociosYaLiquidados = new Set((yaLiquidadas || []).map(l => l.socio_id))

    const porSocio = {}
    for (const e of entregas || []) {
      if (!porSocio[e.socio_id]) {
        porSocio[e.socio_id] = { socio_id: e.socio_id, nombre: e.socios?.nombre || '—', kg: 0 }
      }
      porSocio[e.socio_id].kg += parseFloat(e.kg_neto || e.kg_bruto || 0)
    }

    const preview = Object.values(porSocio).map(s => {
      const rn = Math.max(0, rb - pe)
      const kgAceite = rb > 0 ? (s.kg * rn) / 100 : null
      const importe = rb > 0 ? kgAceite * precioPorKg : s.kg * precioPorKg
      return {
        ...s,
        kgAceite,
        rendimiento_neto: rb > 0 ? rn.toFixed(2) : null,
        importe: importe.toFixed(2),
        yaLiquidado: sociosYaLiquidados.has(s.socio_id),
      }
    }).sort((a, b) => a.nombre.localeCompare(b.nombre))

    setAutoPreview(preview)
    setAutoLoading(false)
  }

  async function generarLiquidaciones() {
    if (!autoPreview) return
    setGenerando(true)
    const userId = await getUserId()
    const precioPorKg = parseFloat(autoForm.precio_kg)
    const rb = parseFloat(autoForm.rendimiento_bruto) || 0
    const pe = parseFloat(autoForm.punto_extraccion) || 0
    const rn = Math.max(0, rb - pe)

    const nuevas = autoPreview
      .filter(s => !s.yaLiquidado && s.kg > 0)
      .map(s => ({
        user_id: userId,
        socio_id: s.socio_id,
        'campana': autoForm.campana,
        kg_totales: parseFloat(s.kg.toFixed(2)),
        rendimiento_bruto: rb || null,
        punto_extraccion: pe || null,
        rendimiento_neto: rb > 0 ? parseFloat(rn.toFixed(2)) : null,
        precio_kg: precioPorKg,
        importe_total: parseFloat(s.importe),
        estado: 'borrador',
      }))

    if (nuevas.length === 0) {
      setMensaje('⚠️ Todos los socios ya tienen liquidación en esta campaña')
      setTimeout(() => setMensaje(''), 4000)
      setGenerando(false); return
    }

    const { error } = await supabase.from('liquidaciones').insert(nuevas)
    if (error) {
      setMensaje(`❌ ${error.message}`)
    } else {
      setMensaje(`✅ ${nuevas.length} liquidaciones generadas`)
      setAutoPreview(null)
      setAutoForm({ campana: '', precio_kg: '', rendimiento_bruto: '', punto_extraccion: '' })
      setModoAuto(false)
      fetchLiquidaciones()
    }
    setTimeout(() => setMensaje(''), 5000)
    setGenerando(false)
  }

  // ── Datos derivados ───────────────────────────────────────────
  const liqFiltradas = liquidaciones.filter(l => {
    if (filtroCampaña && l.campana !== filtroCampaña) return false
    if (filtroEstado && (l.estado || 'borrador') !== filtroEstado) return false
    return true
  })

  const totalImporte = liqFiltradas.reduce((s, l) => s + parseFloat(l.importe_total || 0), 0)
  const contadores = { borrador: 0, pendiente_pago: 0, pagada: 0 }
  liquidaciones.forEach(l => { const e = l.estado || 'borrador'; if (contadores[e] !== undefined) contadores[e]++ })

  const nuevasPrevio = autoPreview?.filter(s => !s.yaLiquidado && s.kg > 0) || []
  const totalAutoImporte = nuevasPrevio.reduce((s, p) => s + parseFloat(p.importe), 0)
  const usaRendimiento = parseFloat(autoForm.rendimiento_bruto) > 0

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Liquidaciones</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {liquidaciones.length} liquidaciones · {totalImporte.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
        <button
          onClick={() => { setModoAuto(!modoAuto); setAutoPreview(null) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all"
          style={{ borderColor: '#0f172a', backgroundColor: modoAuto ? '#0f172a' : 'white', color: modoAuto ? 'white' : '#0f172a' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Liquidación automática
        </button>
      </div>

      {/* ── PILLS DE ESTADO ── */}
      <div className="flex gap-3 mb-5 flex-wrap">
        {ORDEN_ESTADOS.map(e => (
          <button
            key={e}
            onClick={() => setFiltroEstado(filtroEstado === e ? '' : e)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
            style={{
              backgroundColor: filtroEstado === e ? ESTADOS[e].bg : 'white',
              borderColor: filtroEstado === e ? ESTADOS[e].dot : '#e2e8f0',
              color: ESTADOS[e].color,
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ESTADOS[e].dot }} />
            {ESTADOS[e].label}
            <span className="ml-0.5 font-bold">{contadores[e]}</span>
          </button>
        ))}
        {liquidaciones.length > 0 && (
          <select
            value={filtroCampaña}
            onChange={e => setFiltroCampaña(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 bg-white ml-auto"
          >
            <option value="">Todas las campañas</option>
            {campanyas.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {mensaje && (
        <div className={`mb-4 p-3 rounded-lg font-medium text-sm ${mensaje.startsWith('✅') ? 'bg-green-50 border border-green-200 text-green-800' : mensaje.startsWith('⚠️') ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {mensaje}
        </div>
      )}

      {/* ── LIQUIDACIÓN AUTOMÁTICA ── */}
      {modoAuto && (
        <div className="bg-white rounded-2xl shadow-sm border-2 mb-6 overflow-hidden" style={{ borderColor: '#0f172a' }}>
          <div className="px-6 py-4 flex items-center gap-3" style={{ backgroundColor: '#0f172a' }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#4ade80' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h2 className="text-white font-semibold">Liquidación automática por campaña</h2>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Campaña *</label>
                <select
                  value={autoForm.campana}
                  onChange={e => { setAutoForm({ ...autoForm, campana: e.target.value }); setAutoPreview(null) }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
                >
                  <option value="">Seleccionar...</option>
                  {campanyas.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Precio aceite (€/kg) *</label>
                <input
                  type="number" step="0.001" placeholder="p.ej. 3.200"
                  value={autoForm.precio_kg}
                  onChange={e => { setAutoForm({ ...autoForm, precio_kg: e.target.value }); setAutoPreview(null) }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide flex items-center gap-1">
                  Rendimiento bruto (%)
                  <span className="text-gray-400 font-normal normal-case">opcional</span>
                </label>
                <input
                  type="number" step="0.1" placeholder="p.ej. 20.5"
                  value={autoForm.rendimiento_bruto}
                  onChange={e => { setAutoForm({ ...autoForm, rendimiento_bruto: e.target.value }); setAutoPreview(null) }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide flex items-center gap-1">
                  Punto extracción (%)
                  <span className="text-gray-400 font-normal normal-case">coste almazara</span>
                </label>
                <input
                  type="number" step="0.1" placeholder="p.ej. 2.0"
                  value={autoForm.punto_extraccion}
                  onChange={e => { setAutoForm({ ...autoForm, punto_extraccion: e.target.value }); setAutoPreview(null) }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
                />
              </div>
            </div>

            {/* Info rendimiento */}
            {usaRendimiento && autoForm.precio_kg && (
              <div className="flex items-center gap-4 mb-4 p-3 rounded-xl text-sm" style={{ backgroundColor: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)' }}>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Rendimiento neto</p>
                  <p className="font-bold text-gray-900">{Math.max(0, (parseFloat(autoForm.rendimiento_bruto) || 0) - (parseFloat(autoForm.punto_extraccion) || 0)).toFixed(1)}%</p>
                </div>
                <div className="h-8 w-px bg-gray-200" />
                <div className="text-xs text-gray-600">
                  Cada <strong>100 kg</strong> de aceituna producen{' '}
                  <strong>{Math.max(0, (parseFloat(autoForm.rendimiento_bruto) || 0) - (parseFloat(autoForm.punto_extraccion) || 0)).toFixed(1)} kg de aceite</strong>,
                  {' '}liquidados a <strong>{parseFloat(autoForm.precio_kg).toFixed(3)} €/kg</strong>.
                </div>
              </div>
            )}

            <button
              onClick={calcularAuto}
              disabled={autoLoading || !autoForm.campana || !autoForm.precio_kg}
              className="px-6 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-40 mb-4"
              style={{ backgroundColor: '#0f172a' }}
            >
              {autoLoading ? 'Calculando...' : 'Calcular preview'}
            </button>

            {/* Preview */}
            {autoPreview && (
              <>
                <div className="rounded-xl border border-gray-100 overflow-hidden mb-4">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-4 py-3">Socio</th>
                        <th className="text-right px-4 py-3">Kg aceituna</th>
                        {usaRendimiento && <th className="text-right px-4 py-3">Kg aceite</th>}
                        <th className="text-right px-4 py-3">€/kg</th>
                        <th className="text-right px-4 py-3">Importe</th>
                        <th className="text-center px-4 py-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {autoPreview.map(s => (
                        <tr key={s.socio_id} className={`border-t border-gray-50 ${s.yaLiquidado ? 'opacity-40' : ''}`}>
                          <td className="px-4 py-3 font-medium text-gray-900">{s.nombre}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{s.kg.toLocaleString('es-ES', { maximumFractionDigits: 0 })} kg</td>
                          {usaRendimiento && (
                            <td className="px-4 py-3 text-right font-medium" style={{ color: '#16a34a' }}>
                              {s.kgAceite ? parseFloat(s.kgAceite).toLocaleString('es-ES', { maximumFractionDigits: 1 }) : '—'} kg
                            </td>
                          )}
                          <td className="px-4 py-3 text-right text-gray-500">{parseFloat(autoForm.precio_kg).toFixed(3)} €</td>
                          <td className="px-4 py-3 text-right font-semibold" style={{ color: s.yaLiquidado ? '#9ca3af' : '#16a34a' }}>
                            {parseFloat(s.importe).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {s.yaLiquidado
                              ? <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Ya liquidado</span>
                              : <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: ESTADOS.borrador.bg, color: ESTADOS.borrador.color }}>Borrador</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {nuevasPrevio.length > 0 && (
                      <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                        <tr>
                          <td colSpan={usaRendimiento ? 4 : 3} className="px-4 py-3 text-sm font-semibold text-gray-700">
                            Total a generar ({nuevasPrevio.length} socios)
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-base" style={{ color: '#16a34a' }}>
                            {totalAutoImporte.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {autoPreview.length === 0 ? (
                  <p className="text-sm text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-3">
                    ⚠️ No hay entregas en la campaña <strong>{autoForm.campana}</strong>.
                  </p>
                ) : nuevasPrevio.length === 0 ? (
                  <p className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-3">
                    Todos los socios de esta campaña ya tienen liquidación generada.
                  </p>
                ) : (
                  <button
                    onClick={generarLiquidaciones}
                    disabled={generando}
                    className="w-full py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
                    style={{ backgroundColor: '#16a34a' }}
                  >
                    {generando ? 'Generando...' : `✓ Generar ${nuevasPrevio.length} liquidaciones en borrador`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── FORMULARIO MANUAL ── */}
      <details className="mb-6">
        <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700 select-none mb-3">
          + Añadir liquidación manualmente
        </summary>
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Socio</label>
              <select value={form.socio_id} onChange={e => setForm({ ...form, socio_id: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 text-sm" required>
                <option value="">Seleccionar socio...</option>
                {socios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campaña</label>
              <input type="text" placeholder="Ej: 2024/2025" value={form.campana} onChange={e => setForm({ ...form, campana: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kg totales aceituna</label>
              <input type="number" placeholder="0" value={form.kg_totales} onChange={e => setForm({ ...form, kg_totales: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio aceite (€/kg)</label>
              <input type="number" step="0.001" placeholder="0.000" value={form.precio_kg} onChange={e => setForm({ ...form, precio_kg: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 text-sm" required />
            </div>
          </div>

          {/* Rendimiento (colapsable) */}
          <details className="mb-4">
            <summary className="cursor-pointer text-xs font-medium text-gray-400 hover:text-gray-600 select-none">
              + Desglose de rendimiento graso (opcional)
            </summary>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 p-4 bg-gray-50 rounded-xl">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Rendimiento bruto (%)</label>
                <input type="number" step="0.1" placeholder="p.ej. 20.5" value={form.rendimiento_bruto || ''} onChange={e => setForm({ ...form, rendimiento_bruto: e.target.value })} className="w-full border border-gray-200 rounded-lg p-2 text-gray-900 text-sm bg-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Punto extracción (%)</label>
                <input type="number" step="0.1" placeholder="p.ej. 2.0" value={form.punto_extraccion || ''} onChange={e => setForm({ ...form, punto_extraccion: e.target.value })} className="w-full border border-gray-200 rounded-lg p-2 text-gray-900 text-sm bg-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Rendimiento neto (%)</label>
                <input readOnly value={form.rendimiento_neto || ''} className="w-full border border-gray-200 rounded-lg p-2 text-gray-500 text-sm bg-gray-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Kg aceite final</label>
                <input readOnly value={form.kg_aceite_final ? `${parseFloat(form.kg_aceite_final).toLocaleString('es-ES')} kg` : ''} className="w-full border border-gray-200 rounded-lg p-2 text-sm font-medium bg-gray-100" style={{ color: '#16a34a' }} />
              </div>
            </div>
          </details>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Importe total (€)</label>
              <input readOnly value={form.importe_total} className="w-full border border-gray-200 rounded-lg p-2 text-gray-900 bg-gray-50 text-sm font-semibold" />
            </div>
            <div className="flex-1 flex items-end">
              <button type="submit" disabled={loading} className="w-full py-2 px-4 rounded-lg text-white font-medium text-sm mt-5" style={{ backgroundColor: '#0f172a' }}>
                {loading ? 'Guardando...' : 'Registrar en borrador'}
              </button>
            </div>
          </div>
        </form>
      </details>

      {/* ── TABLA LIQUIDACIONES ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-5 py-3">Socio</th>
              <th className="text-left px-5 py-3">Campaña</th>
              <th className="text-right px-5 py-3">Kg aceituna</th>
              <th className="text-right px-5 py-3">Kg aceite</th>
              <th className="text-right px-5 py-3">€/kg</th>
              <th className="text-right px-5 py-3">Importe</th>
              <th className="text-center px-5 py-3">Estado</th>
              <th className="text-center px-5 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {liqFiltradas.map(liq => (
              <tr key={liq.id} className="border-t border-gray-50 hover:bg-gray-50">
                <td className="px-5 py-3 font-medium text-gray-900">{liq.socios?.nombre}</td>
                <td className="px-5 py-3 text-gray-600">{liq.campana}</td>
                <td className="px-5 py-3 text-right text-gray-700">
                  {parseFloat(liq.kg_totales).toLocaleString('es-ES', { maximumFractionDigits: 0 })} kg
                </td>
                <td className="px-5 py-3 text-right">
                  {liq.kg_aceite_final
                    ? <span className="font-medium" style={{ color: '#16a34a' }}>{parseFloat(liq.kg_aceite_final).toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg</span>
                    : <span className="text-gray-300">—</span>
                  }
                  {liq.rendimiento_neto && (
                    <span className="ml-1 text-xs text-gray-400">({liq.rendimiento_neto}%)</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right text-gray-500">{parseFloat(liq.precio_kg).toFixed(3)} €</td>
                <td className="px-5 py-3 text-right font-bold" style={{ color: '#16a34a' }}>
                  {parseFloat(liq.importe_total).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </td>
                <td className="px-5 py-3 text-center">
                  <EstadoBadge
                    estado={liq.estado || 'borrador'}
                    onClick={() => handleCambiarEstado(liq)}
                  />
                  {liq.fecha_pago && (
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(liq.fecha_pago).toLocaleDateString('es-ES')}</p>
                  )}
                </td>
                <td className="px-5 py-3 text-center">
                  <div className="flex gap-1.5 justify-center items-center">
                    <button
                      onClick={() => handleEnviarEmail(liq)}
                      disabled={emailLoading === liq.id}
                      title="Enviar liquidación por email"
                      className="p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-40">
                      {emailLoading === liq.id
                        ? <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                        : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      }
                    </button>
                    <button
                      onClick={() => handleEliminar(liq.id)}
                      title="Eliminar liquidación"
                      className="p-1.5 rounded-lg bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {liqFiltradas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-gray-400">
                  {liquidaciones.length === 0 ? 'No hay liquidaciones registradas' : 'No hay resultados con los filtros aplicados'}
                </td>
              </tr>
            )}
          </tbody>
          {liqFiltradas.length > 0 && (
            <tfoot className="border-t-2 border-gray-100 bg-gray-50">
              <tr>
                <td colSpan={5} className="px-5 py-3 text-sm font-semibold text-gray-600">
                  Total {filtroCampaña || filtroEstado ? 'filtrado' : ''} ({liqFiltradas.length})
                </td>
                <td className="px-5 py-3 text-right font-bold text-base" style={{ color: '#16a34a' }}>
                  {totalImporte.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
