'use client'
import { useState, useEffect } from 'react'
import { supabase, getUserId } from '@/lib/supabase'

function loadSheetJS() {
  return new Promise((resolve) => {
    if (window.XLSX) return resolve(window.XLSX)
    const script = document.createElement('script')
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js'
    script.onload = () => resolve(window.XLSX)
    document.head.appendChild(script)
  })
}

const TIPOS = [
  { key: 'socios', label: 'Socios', icon: '👥', desc: 'Listado completo de socios con sus datos de contacto' },
  { key: 'entregas', label: 'Entregas', icon: '📦', desc: 'Historial de entregas con socio, parcela, kg y calidad' },
  { key: 'liquidaciones', label: 'Liquidaciones', icon: '💶', desc: 'Liquidaciones con importes por socio y campaña' },
  { key: 'parcelas', label: 'Parcelas', icon: '🌿', desc: 'Parcelas registradas con superficie, municipio y variedad' },
]

export default function ExportarPage() {
  const [tipo, setTipo] = useState('entregas')
  const [campanyas, setCampanyas] = useState([])
  const [filtroCampaña, setFiltroCampaña] = useState('')
  const [loading, setLoading] = useState(false)
  const [ultimaExportacion, setUltimaExportacion] = useState(null)

  useEffect(() => { cargarCampanyas() }, [])

  async function cargarCampanyas() {
    const userId = await getUserId()
    const { data } = await supabase.from('entregas').select('campaña').eq('user_id', userId)
    const camps = [...new Set((data || []).map(e => e.campaña).filter(Boolean))].sort().reverse()
    setCampanyas(camps)
  }

  async function exportar() {
    setLoading(true)
    const userId = await getUserId()
    const XLSX = await loadSheetJS()

    let datos = []
    let nombreArchivo = ''
    let hoja = ''

    if (tipo === 'socios') {
      const { data } = await supabase
        .from('socios')
        .select('nombre, dni, telefono, email, direccion')
        .eq('user_id', userId)
        .order('nombre')
      datos = (data || []).map(s => ({
        'Nombre': s.nombre,
        'DNI / NIF': s.dni || '',
        'Teléfono': s.telefono || '',
        'Email': s.email || '',
        'Dirección': s.direccion || '',
      }))
      nombreArchivo = 'socios_olivagest'
      hoja = 'Socios'
    }

    else if (tipo === 'entregas') {
      let query = supabase
        .from('entregas')
        .select('*, socios(nombre), parcelas(nombre)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (filtroCampaña) query = query.eq('campaña', filtroCampaña)
      const { data } = await query
      datos = (data || []).map(e => ({
        'Socio': e.socios?.nombre || '',
        'Parcela': e.parcelas?.nombre || '',
        'Campaña': e.campaña || '',
        'Fecha': new Date(e.created_at).toLocaleDateString('es-ES'),
        'Kg bruto': parseFloat(e.kg || 0),
        'Rendimiento (%)': e.rendimiento ? parseFloat(e.rendimiento) : '',
        'Calidad': e.calidad || '',
        'Notas': e.notas || '',
      }))
      nombreArchivo = filtroCampaña ? `entregas_${filtroCampaña}` : 'entregas_olivagest'
      hoja = 'Entregas'
    }

    else if (tipo === 'liquidaciones') {
      let query = supabase
        .from('liquidaciones')
        .select('*, socios(nombre)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (filtroCampaña) query = query.eq('campaña', filtroCampaña)
      const { data } = await query
      datos = (data || []).map(l => ({
        'Socio': l.socios?.nombre || '',
        'Campaña': l.campaña || '',
        'Kg totales': parseFloat(l.kg_totales || 0),
        'Precio €/kg': parseFloat(l.precio_kg || 0),
        'Importe total (€)': parseFloat(l.importe_total || 0),
        'Fecha': new Date(l.created_at).toLocaleDateString('es-ES'),
      }))
      nombreArchivo = filtroCampaña ? `liquidaciones_${filtroCampaña}` : 'liquidaciones_olivagest'
      hoja = 'Liquidaciones'
    }

    else if (tipo === 'parcelas') {
      const { data } = await supabase
        .from('parcelas')
        .select('*, socios(nombre)')
        .eq('user_id', userId)
        .order('nombre')
      datos = (data || []).map(p => ({
        'Socio': p.socios?.nombre || '',
        'Nombre parcela': p.nombre || '',
        'Municipio': p.municipio || '',
        'Variedad': p.variedad || '',
        'Superficie (ha)': p.superficie_ha ? parseFloat(p.superficie_ha) : '',
      }))
      nombreArchivo = 'parcelas_olivagest'
      hoja = 'Parcelas'
    }

    if (datos.length === 0) {
      alert('No hay datos para exportar con los filtros seleccionados.')
      setLoading(false)
      return
    }

    // Generar Excel con SheetJS
    const ws = XLSX.utils.json_to_sheet(datos)

    // Ajustar ancho de columnas automáticamente
    const cols = Object.keys(datos[0])
    ws['!cols'] = cols.map(key => ({
      wch: Math.max(key.length, ...datos.map(r => String(r[key] || '').length), 10)
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, hoja)

    const fecha = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `${nombreArchivo}_${fecha}.xlsx`)

    setUltimaExportacion({ tipo: hoja, registros: datos.length, fecha: new Date().toLocaleTimeString('es-ES') })
    setLoading(false)
  }

  const necesitaFiltro = tipo === 'entregas' || tipo === 'liquidaciones'

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Exportar datos</h1>
        <p className="text-gray-500 mt-1">Descarga tus datos en formato Excel para gestoría o archivo</p>
      </div>

      {/* Selector de tipo */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {TIPOS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTipo(t.key); setFiltroCampaña('') }}
            className="text-left p-4 rounded-xl border-2 transition-all"
            style={{
              borderColor: tipo === t.key ? '#0f172a' : '#e5e7eb',
              backgroundColor: tipo === t.key ? '#0f172a' : 'white',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{t.icon}</span>
              <span className="font-semibold text-sm" style={{ color: tipo === t.key ? 'white' : '#111827' }}>
                {t.label}
              </span>
            </div>
            <p className="text-xs" style={{ color: tipo === t.key ? 'rgba(255,255,255,0.6)' : '#9ca3af' }}>
              {t.desc}
            </p>
          </button>
        ))}
      </div>

      {/* Filtro campaña */}
      {necesitaFiltro && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filtrar por campaña <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <select
            value={filtroCampaña}
            onChange={e => setFiltroCampaña(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
          >
            <option value="">Todas las campañas</option>
            {campanyas.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {/* Botón exportar */}
      <button
        onClick={exportar}
        disabled={loading}
        className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
        style={{ backgroundColor: '#0f172a' }}
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
            </svg>
            Generando Excel...
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Descargar Excel
          </>
        )}
      </button>

      {/* Confirmación última exportación */}
      {ultimaExportacion && (
        <div className="mt-4 p-3 rounded-xl border flex items-center gap-3" style={{ backgroundColor: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.3)' }}>
          <span style={{ color: '#16a34a' }}>✓</span>
          <p className="text-sm text-gray-700">
            <strong>{ultimaExportacion.registros} registros</strong> de {ultimaExportacion.tipo} exportados correctamente a las {ultimaExportacion.fecha}
          </p>
        </div>
      )}

      {/* Info */}
      <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <p className="text-xs text-gray-500 leading-relaxed">
          El archivo se descarga directamente en tu ordenador en formato <strong>.xlsx</strong> compatible con Excel, LibreOffice y Google Sheets. El nombre incluye la fecha para facilitar el archivo.
        </p>
      </div>
    </div>
  )
}
