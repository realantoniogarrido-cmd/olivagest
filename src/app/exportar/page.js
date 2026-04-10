'use client'
import { useState, useEffect } from 'react'
import { supabase, getUserId } from '@/lib/supabase'

// Carga xlsx-js-style (fork de SheetJS con soporte de estilos completo)
function loadXLSX() {
  return new Promise((resolve) => {
    if (window.XLSXStyle) return resolve(window.XLSXStyle)
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js'
    script.onload = () => resolve(window.XLSXStyle)
    document.head.appendChild(script)
  })
}

// ── Paleta OlivaGest ──────────────────────────────────────────────
const C = {
  NAVY:        '0F172A',
  NAVY_LIGHT:  '1E293B',
  GREEN:       '16A34A',
  GREEN_LIGHT: 'DCFCE7',
  GRAY_BG:     'F8FAFC',
  GRAY_LINE:   'E2E8F0',
  WHITE:       'FFFFFF',
  TEXT_DARK:   '1E293B',
  TEXT_MUTED:  '94A3B8',
}

function cellStyle(bg, color, bold = false, align = 'left', border = false) {
  const s = {
    fill: { fgColor: { rgb: bg } },
    font: { name: 'Arial', sz: 10, color: { rgb: color }, bold },
    alignment: { horizontal: align, vertical: 'center', wrapText: false },
  }
  if (border) {
    const b = { style: 'thin', color: { rgb: C.GRAY_LINE } }
    s.border = { top: b, bottom: b, left: b, right: b }
  }
  return s
}

function buildExcel(XLSX, { hoja, columnas, filas, titulo }) {
  const wb = XLSX.utils.book_new()
  const wsData = []

  // Fila 1: Banner
  const bannerRow = [{ v: titulo, s: cellStyle(C.NAVY, C.WHITE, true, 'left') }]
  for (let i = 1; i < columnas.length; i++)
    bannerRow.push({ v: '', s: cellStyle(C.NAVY, C.WHITE) })
  wsData.push(bannerRow)

  // Fila 2: Subtítulo
  const fecha = new Date().toLocaleDateString('es-ES')
  const subRow = [{ v: `Exportado el ${fecha}  ·  ${filas.length} registros`, s: cellStyle(C.NAVY_LIGHT, C.TEXT_MUTED, false, 'left') }]
  for (let i = 1; i < columnas.length; i++)
    subRow.push({ v: '', s: cellStyle(C.NAVY_LIGHT, C.TEXT_MUTED) })
  wsData.push(subRow)

  // Fila 3: Cabeceras
  wsData.push(columnas.map(col => ({
    v: col.label,
    s: cellStyle(C.GREEN, C.WHITE, true, 'center', true),
  })))

  // Filas de datos
  filas.forEach((fila, idx) => {
    const bg = idx % 2 === 0 ? C.WHITE : C.GRAY_BG
    wsData.push(columnas.map(col => {
      let val = fila[col.key] ?? ''
      let numFmt
      if (col.tipo === 'numero' || col.tipo === 'kg' || col.tipo === 'euro' || col.tipo === 'pct') {
        const n = parseFloat(val)
        if (!isNaN(n)) {
          val = n
          if (col.tipo === 'euro') numFmt = '#,##0.00 "€"'
          else if (col.tipo === 'kg')   numFmt = '#,##0.00 "kg"'
          else if (col.tipo === 'pct')  numFmt = '0.00"%"'
          else numFmt = '#,##0.00'
        }
      }
      if (val === '' || val === null || val === undefined) val = '—'
      const cell = { v: val, s: cellStyle(bg, C.TEXT_DARK, false, col.align || 'left') }
      if (numFmt && typeof val === 'number') { cell.t = 'n'; cell.z = numFmt }
      return cell
    }))
  })

  // Fila de totales
  const colsSuma = columnas.filter(c => c.suma)
  if (colsSuma.length > 0) {
    const totRow = columnas.map((col, i) => {
      if (i === 0) return { v: 'TOTAL', s: cellStyle(C.NAVY, C.WHITE, true, 'left') }
      if (col.suma) {
        const total = filas.reduce((s, f) => s + (parseFloat(f[col.key]) || 0), 0)
        let numFmt = col.tipo === 'euro' ? '#,##0.00 "€"' : '#,##0.00 "kg"'
        return { v: total, t: 'n', z: numFmt, s: cellStyle(C.NAVY, C.WHITE, true, 'right') }
      }
      return { v: '', s: cellStyle(C.NAVY, C.WHITE) }
    })
    wsData.push(totRow)
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Merge banner y subtítulo a lo ancho
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columnas.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: columnas.length - 1 } },
  ]

  // Alturas de fila
  ws['!rows'] = [
    { hpt: 28 },  // banner
    { hpt: 16 },  // subtítulo
    { hpt: 20 },  // cabecera
    ...filas.map(() => ({ hpt: 16 })),
    { hpt: 20 },  // totales
  ]

  // Anchos de columna
  ws['!cols'] = columnas.map(col => {
    const vals = filas.map(f => String(f[col.key] ?? '').length)
    const max = Math.max(col.label.length, ...vals, col.min_w || 10)
    return { wch: Math.min(max + 2, col.max_w || 40) }
  })

  XLSX.utils.book_append_sheet(wb, ws, hoja)
  return wb
}

// ── Configuración de exportaciones ───────────────────────────────
const TIPOS = [
  {
    key: 'socios', label: 'Socios',
    desc: 'Nombre, DNI, teléfono, email, municipio, cuenta bancaria…',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
  {
    key: 'entregas', label: 'Entregas', filtro: true,
    desc: 'Socio, parcela, campaña, kg bruto, kg neto, rendimiento, calidad…',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
  },
  {
    key: 'liquidaciones', label: 'Liquidaciones', filtro: true,
    desc: 'Socio, campaña, kg aceite, rendimiento, precio, importe, estado…',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    key: 'parcelas', label: 'Parcelas',
    desc: 'Socio, nombre, municipio, variedad, superficie, referencia catastral…',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>,
  },
]

export default function ExportarPage() {
  const [tipo,          setTipo]          = useState('entregas')
  const [campanyas,     setCampanyas]     = useState([])
  const [filtroCampaña, setFiltroCampaña] = useState('')
  const [loading,       setLoading]       = useState(false)
  const [ultimaExport,  setUltimaExport]  = useState(null)
  const [error,         setError]         = useState('')

  useEffect(() => { cargarCampanyas() }, [])

  async function cargarCampanyas() {
    const userId = await getUserId()
    if (!userId) return
    const { data } = await supabase.from('entregas').select('campana').eq('user_id', userId)
    const camps = [...new Set((data || []).map(e => e.campana).filter(Boolean))].sort().reverse()
    setCampanyas(camps)
  }

  async function exportar() {
    setLoading(true); setError('')
    try {
      const userId = await getUserId()
      const XLSX   = await loadXLSX()
      let columnas, filas, hoja, nombreArchivo

      if (tipo === 'socios') {
        const { data } = await supabase.from('socios').select('*').eq('user_id', userId).order('nombre')
        hoja = 'Socios'; nombreArchivo = 'socios_olivagest'
        columnas = [
          { key: 'nombre',          label: 'Nombre completo',  min_w: 22 },
          { key: 'dni',             label: 'DNI / NIF',        min_w: 12 },
          { key: 'telefono',        label: 'Teléfono',         min_w: 13 },
          { key: 'email',           label: 'Email',            min_w: 22 },
          { key: 'municipio',       label: 'Municipio',        min_w: 15 },
          { key: 'direccion',       label: 'Dirección',        min_w: 25 },
          { key: 'numero_socio',    label: 'Nº socio',         min_w: 10 },
          { key: 'cuenta_bancaria', label: 'Cuenta bancaria',  min_w: 24 },
          { key: 'portal_activo',   label: 'Portal activo',    min_w: 12, align: 'center' },
        ]
        filas = (data || []).map(s => ({
          nombre: s.nombre || '', dni: s.dni || '', telefono: s.telefono || '',
          email: s.email || '', municipio: s.municipio || '', direccion: s.direccion || '',
          numero_socio: s.numero_socio || '', cuenta_bancaria: s.cuenta_bancaria || '',
          portal_activo: s.portal_activo ? 'Sí' : 'No',
        }))
      }

      else if (tipo === 'entregas') {
        let q = supabase.from('entregas').select('*, socios(nombre), parcelas(nombre, municipio)')
          .eq('user_id', userId).order('created_at', { ascending: false })
        if (filtroCampaña) q = q.eq('campana', filtroCampaña)
        const { data } = await q
        hoja = 'Entregas'; nombreArchivo = filtroCampaña ? `entregas_${filtroCampaña}` : 'entregas_olivagest'
        columnas = [
          { key: 'socio',             label: 'Socio',              min_w: 22 },
          { key: 'campana',           label: 'Campaña',            min_w: 10 },
          { key: 'fecha',             label: 'Fecha',              min_w: 12, align: 'center' },
          { key: 'parcela',           label: 'Parcela',            min_w: 18 },
          { key: 'municipio',         label: 'Municipio',          min_w: 15 },
          { key: 'kg_bruto',          label: 'Kg bruto',           min_w: 10, tipo: 'kg',  align: 'right', suma: true },
          { key: 'kg_neto',           label: 'Kg neto',            min_w: 10, tipo: 'kg',  align: 'right', suma: true },
          { key: 'rendimiento_bruto', label: 'Rend. bruto (%)',    min_w: 14, tipo: 'pct', align: 'right' },
          { key: 'rendimiento_neto',  label: 'Rend. neto (%)',     min_w: 13, tipo: 'pct', align: 'right' },
          { key: 'calidad',           label: 'Calidad',            min_w: 10, align: 'center' },
          { key: 'punto_extraccion',  label: 'Punto extracción',   min_w: 16 },
          { key: 'notas',             label: 'Notas',              min_w: 18 },
        ]
        filas = (data || []).map(e => ({
          socio: e.socios?.nombre || '', campana: e.campana || '',
          fecha: e.fecha ? new Date(e.fecha).toLocaleDateString('es-ES') : new Date(e.created_at).toLocaleDateString('es-ES'),
          parcela: e.parcelas?.nombre || '', municipio: e.parcelas?.municipio || '',
          kg_bruto: e.kg_bruto ?? e.kg ?? '', kg_neto: e.kg_neto ?? '',
          rendimiento_bruto: e.rendimiento_bruto ?? e.rendimiento ?? '', rendimiento_neto: e.rendimiento_neto ?? '',
          calidad: e.calidad || '', punto_extraccion: e.punto_extraccion || '', notas: e.notas || '',
        }))
      }

      else if (tipo === 'liquidaciones') {
        let q = supabase.from('liquidaciones').select('*, socios(nombre)')
          .eq('user_id', userId).order('created_at', { ascending: false })
        if (filtroCampaña) q = q.eq('campana', filtroCampaña)
        const { data } = await q
        hoja = 'Liquidaciones'; nombreArchivo = filtroCampaña ? `liquidaciones_${filtroCampaña}` : 'liquidaciones_olivagest'
        const estadoLabel = { borrador: 'En preparación', pendiente_pago: 'Pdte. pago', pagada: 'Pagada ✓' }
        columnas = [
          { key: 'socio',             label: 'Socio',              min_w: 22 },
          { key: 'campana',           label: 'Campaña',            min_w: 10 },
          { key: 'estado',            label: 'Estado',             min_w: 14, align: 'center' },
          { key: 'kg_totales',        label: 'Kg aceituna',        min_w: 12, tipo: 'kg',   align: 'right', suma: true },
          { key: 'kg_aceite_final',   label: 'Kg aceite final',    min_w: 14, tipo: 'kg',   align: 'right', suma: true },
          { key: 'rendimiento_bruto', label: 'Rend. bruto (%)',    min_w: 14, tipo: 'pct',  align: 'right' },
          { key: 'rendimiento_neto',  label: 'Rend. neto (%)',     min_w: 13, tipo: 'pct',  align: 'right' },
          { key: 'punto_extraccion',  label: 'Punto extracción',   min_w: 16 },
          { key: 'precio_kg',         label: 'Precio €/kg',        min_w: 11, tipo: 'euro', align: 'right' },
          { key: 'importe_total',     label: 'Importe total (€)',  min_w: 16, tipo: 'euro', align: 'right', suma: true },
          { key: 'fecha_pago',        label: 'Fecha pago',         min_w: 12, align: 'center' },
        ]
        filas = (data || []).map(l => ({
          socio: l.socios?.nombre || '', campana: l.campana || '',
          estado: estadoLabel[l.estado] || l.estado || '',
          kg_totales: l.kg_totales ?? '', kg_aceite_final: l.kg_aceite_final ?? '',
          rendimiento_bruto: l.rendimiento_bruto ?? '', rendimiento_neto: l.rendimiento_neto ?? '',
          punto_extraccion: l.punto_extraccion || '', precio_kg: l.precio_kg ?? '',
          importe_total: l.importe_total ?? '',
          fecha_pago: l.fecha_pago ? new Date(l.fecha_pago).toLocaleDateString('es-ES') : '',
        }))
      }

      else if (tipo === 'parcelas') {
        const { data } = await supabase.from('parcelas').select('*, socios(nombre)')
          .eq('user_id', userId).order('nombre')
        hoja = 'Parcelas'; nombreArchivo = 'parcelas_olivagest'
        columnas = [
          { key: 'socio',                label: 'Socio',               min_w: 22 },
          { key: 'nombre',               label: 'Nombre parcela',      min_w: 18 },
          { key: 'municipio',            label: 'Municipio',           min_w: 15 },
          { key: 'variedad',             label: 'Variedad',            min_w: 14 },
          { key: 'superficie',           label: 'Superficie (ha)',     min_w: 14, tipo: 'numero', align: 'right' },
          { key: 'referencia_catastral', label: 'Ref. catastral',      min_w: 20 },
          { key: 'poligono',             label: 'Polígono',            min_w: 10 },
          { key: 'parcela_num',          label: 'Nº parcela',          min_w: 10 },
          { key: 'notas',                label: 'Notas',               min_w: 18 },
        ]
        filas = (data || []).map(p => ({
          socio: p.socios?.nombre || '', nombre: p.nombre || '', municipio: p.municipio || '',
          variedad: p.variedad || '', superficie: p.superficie ?? p.superficie_ha ?? '',
          referencia_catastral: p.referencia_catastral || '', poligono: p.poligono || '',
          parcela_num: p.parcela_num || p.numero_parcela || '', notas: p.notas || '',
        }))
      }

      if (!filas?.length) {
        setError('No hay datos para exportar con los filtros seleccionados.')
        setLoading(false); return
      }

      const titulo = `OlivaGest · ${hoja}`
      const wb = buildExcel(XLSX, { hoja, columnas, filas, titulo })
      const fecha = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `${nombreArchivo}_${fecha}.xlsx`)
      setUltimaExport({ tipo: hoja, registros: filas.length, fecha: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) })
    } catch (e) {
      console.error(e)
      setError('Error al generar el Excel: ' + e.message)
    }
    setLoading(false)
  }

  const tipoActual = TIPOS.find(t => t.key === tipo)

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Exportar datos</h1>
        <p className="text-gray-500 mt-1 text-sm">Descarga tus datos en Excel con todos los campos y formato profesional</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {TIPOS.map(t => {
          const active = tipo === t.key
          return (
            <button key={t.key} onClick={() => { setTipo(t.key); setFiltroCampaña('') }}
              className="text-left p-4 rounded-xl border-2 transition-all"
              style={{ borderColor: active ? '#0f172a' : '#e5e7eb', backgroundColor: active ? '#0f172a' : 'white' }}>
              <div className="flex items-center gap-2.5 mb-1.5">
                <span style={{ color: active ? '#4ade80' : '#6b7280' }}>{t.icon}</span>
                <span className="font-semibold text-sm" style={{ color: active ? 'white' : '#111827' }}>{t.label}</span>
              </div>
              <p className="text-xs leading-snug" style={{ color: active ? 'rgba(255,255,255,0.5)' : '#9ca3af' }}>{t.desc}</p>
            </button>
          )
        })}
      </div>

      {tipoActual?.filtro && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Filtrar por campaña <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <select value={filtroCampaña} onChange={e => setFiltroCampaña(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-gray-50">
            <option value="">Todas las campañas</option>
            {campanyas.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      <button onClick={exportar} disabled={loading}
        className="w-full py-3.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
        style={{ backgroundColor: '#0f172a' }}>
        {loading ? (
          <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Generando Excel…</>
        ) : (
          <><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Descargar Excel · {tipoActual?.label}</>
        )}
      </button>

      {ultimaExport && !loading && (
        <div className="mt-4 p-3.5 rounded-xl flex items-center gap-3"
          style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <p className="text-sm text-green-800">
            <strong>{ultimaExport.registros} registros</strong> de {ultimaExport.tipo} exportados a las {ultimaExport.fecha}
          </p>
        </div>
      )}

      <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <p className="text-xs text-gray-500 leading-relaxed">
          El Excel incluye <strong>todos los campos</strong>, cabeceras en verde, filas alternadas y fila de totales.
          Formato <strong>.xlsx</strong> compatible con Excel, LibreOffice y Google Sheets. No requiere Python ni instalaciones adicionales.
        </p>
      </div>
    </div>
  )
}
