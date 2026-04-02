'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase, getUserId } from '@/lib/supabase'

// Carga SheetJS desde CDN para parsear Excel
function loadSheetJS() {
  return new Promise((resolve) => {
    if (window.XLSX) return resolve(window.XLSX)
    const script = document.createElement('script')
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js'
    script.onload = () => resolve(window.XLSX)
    document.head.appendChild(script)
  })
}

// Mapeo automático de nombres de columnas comunes
const SOCIOS_FIELDS = [
  { key: 'nombre', label: 'Nombre', required: true, aliases: ['nombre', 'name', 'socio', 'apellidos', 'nombre completo', 'nombreCompleto'] },
  { key: 'dni', label: 'DNI / NIF', required: false, aliases: ['dni', 'nif', 'documento', 'identificacion', 'id'] },
  { key: 'telefono', label: 'Teléfono', required: false, aliases: ['telefono', 'teléfono', 'tel', 'phone', 'movil', 'móvil', 'celular'] },
  { key: 'email', label: 'Email', required: false, aliases: ['email', 'correo', 'mail', 'e-mail', 'correo electronico'] },
  { key: 'direccion', label: 'Dirección', required: false, aliases: ['direccion', 'dirección', 'address', 'domicilio'] },
]

const PARCELAS_FIELDS = [
  { key: 'socio_nombre', label: 'Nombre del Socio', required: true, aliases: ['socio', 'titular', 'propietario', 'nombre socio', 'socio nombre'] },
  { key: 'nombre', label: 'Nombre de la finca', required: true, aliases: ['nombre', 'finca', 'parcela', 'name', 'denominacion', 'denominación'] },
  { key: 'superficie_ha', label: 'Superficie (ha)', required: false, aliases: ['superficie', 'ha', 'hectareas', 'hectáreas', 'superficie ha', 'superficie_ha'] },
  { key: 'municipio', label: 'Municipio', required: false, aliases: ['municipio', 'localidad', 'pueblo', 'ciudad', 'location'] },
  { key: 'variedad', label: 'Variedad', required: false, aliases: ['variedad', 'variety', 'tipo aceituna', 'olivo', 'especie'] },
]

const ENTREGAS_FIELDS = [
  { key: 'socio_nombre', label: 'Nombre del Socio', required: true, aliases: ['socio', 'nombre', 'name', 'socio nombre', 'nombre socio', 'titular'] },
  { key: 'kg', label: 'Kg bruto', required: true, aliases: ['kg', 'kilos', 'kilogramos', 'peso', 'kg bruto', 'cantidad'] },
  { key: 'rendimiento', label: 'Rendimiento (%)', required: false, aliases: ['rendimiento', 'rend', 'rendim', 'rendimiento %', '%'] },
  { key: 'calidad', label: 'Calidad', required: false, aliases: ['calidad', 'quality', 'tipo', 'clase'] },
  { key: 'campaña', label: 'Campaña', required: false, aliases: ['campaña', 'campanya', 'campaign', 'temporada', 'año'] },
  { key: 'notas', label: 'Notas', required: false, aliases: ['notas', 'notes', 'observaciones', 'obs', 'comentarios'] },
]

function autoDetectMapping(headers, fields) {
  const mapping = {}
  fields.forEach(field => {
    const found = headers.find(h =>
      field.aliases.some(alias => h.toLowerCase().trim() === alias.toLowerCase())
    )
    mapping[field.key] = found || ''
  })
  return mapping
}

export default function ImportarPage() {
  const [tipo, setTipo] = useState('socios') // 'socios' | 'entregas'
  const [step, setStep] = useState(1) // 1: upload, 2: mapear, 3: preview, 4: result
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [mapping, setMapping] = useState({})
  const [preview, setPreview] = useState([])
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [errores, setErrores] = useState([])
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef()

  const fields = tipo === 'socios' ? SOCIOS_FIELDS : tipo === 'entregas' ? ENTREGAS_FIELDS : PARCELAS_FIELDS

  function resetear() {
    setStep(1)
    setHeaders([])
    setRows([])
    setMapping({})
    setPreview([])
    setResultado(null)
    setErrores([])
  }

  useEffect(() => { resetear() }, [tipo])

  async function parseFile(file) {
    const ext = file.name.split('.').pop().toLowerCase()
    if (ext === 'csv') {
      return parseCSV(await file.text())
    } else if (['xlsx', 'xls', 'ods'].includes(ext)) {
      return parseExcel(file)
    } else {
      alert('Formato no soportado. Usa .xlsx, .xls, .ods o .csv')
      return null
    }
  }

  function parseCSV(text) {
    const lines = text.trim().split('\n').filter(l => l.trim())
    if (lines.length < 2) return null
    // Detectar separador: , o ;
    const sep = lines[0].includes(';') ? ';' : ','
    const headers = lines[0].split(sep).map(h => h.replace(/"/g, '').trim())
    const rows = lines.slice(1).map(line => {
      const vals = line.split(sep).map(v => v.replace(/"/g, '').trim())
      const row = {}
      headers.forEach((h, i) => { row[h] = vals[i] || '' })
      return row
    })
    return { headers, rows }
  }

  async function parseExcel(file) {
    const XLSX = await loadSheetJS()
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    if (data.length < 2) return null
    const headers = data[0].map(h => String(h).trim())
    const rows = data.slice(1)
      .filter(row => row.some(cell => cell !== ''))
      .map(row => {
        const obj = {}
        headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? String(row[i]).trim() : '' })
        return obj
      })
    return { headers, rows }
  }

  async function handleFile(file) {
    if (!file) return
    const result = await parseFile(file)
    if (!result) return
    const { headers, rows } = result
    setHeaders(headers)
    setRows(rows)
    const autoMap = autoDetectMapping(headers, fields)
    setMapping(autoMap)
    setStep(2)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function generarPreview() {
    const prev = rows.slice(0, 5).map(row => {
      const obj = {}
      fields.forEach(f => {
        obj[f.key] = mapping[f.key] ? row[mapping[f.key]] || '' : ''
      })
      return obj
    })
    setPreview(prev)
    setStep(3)
  }

  async function importar() {
    setLoading(true)
    const userId = await getUserId()
    const errList = []
    let ok = 0

    if (tipo === 'socios') {
      const registros = rows.map((row, i) => {
        const nombre = mapping['nombre'] ? row[mapping['nombre']]?.trim() : ''
        if (!nombre) { errList.push(`Fila ${i + 2}: nombre vacío, omitida`); return null }
        return {
          user_id: userId,
          nombre,
          dni: mapping['dni'] ? row[mapping['dni']]?.trim() || null : null,
          telefono: mapping['telefono'] ? row[mapping['telefono']]?.trim() || null : null,
          email: mapping['email'] ? row[mapping['email']]?.trim() || null : null,
          direccion: mapping['direccion'] ? row[mapping['direccion']]?.trim() || null : null,
        }
      }).filter(Boolean)

      // Insertar en lotes de 50
      for (let i = 0; i < registros.length; i += 50) {
        const lote = registros.slice(i, i + 50)
        const { error } = await supabase.from('socios').insert(lote)
        if (error) errList.push(`Error lote ${Math.floor(i / 50) + 1}: ${error.message}`)
        else ok += lote.length
      }

    } else if (tipo === 'entregas') {
      // Obtener socios para resolver nombre → id
      const { data: socios } = await supabase.from('socios').select('id, nombre').eq('user_id', userId)
      const socioMap = {}
      socios?.forEach(s => { socioMap[s.nombre.toLowerCase().trim()] = s.id })

      const registros = rows.map((row, i) => {
        const socioNombre = mapping['socio_nombre'] ? row[mapping['socio_nombre']]?.trim() : ''
        const kg = mapping['kg'] ? parseFloat(row[mapping['kg']]) : null
        if (!socioNombre) { errList.push(`Fila ${i + 2}: nombre de socio vacío, omitida`); return null }
        if (!kg || isNaN(kg)) { errList.push(`Fila ${i + 2}: kg inválido, omitida`); return null }
        const socio_id = socioMap[socioNombre.toLowerCase()]
        if (!socio_id) { errList.push(`Fila ${i + 2}: socio "${socioNombre}" no encontrado`); return null }
        const calidad = mapping['calidad'] ? row[mapping['calidad']]?.trim() || 'Primera' : 'Primera'
        return {
          user_id: userId,
          socio_id,
          kg,
          rendimiento: mapping['rendimiento'] ? parseFloat(row[mapping['rendimiento']]) || null : null,
          calidad: ['Extra', 'Primera', 'Segunda'].includes(calidad) ? calidad : 'Primera',
          campaña: mapping['campaña'] ? row[mapping['campaña']]?.trim() || null : null,
          notas: mapping['notas'] ? row[mapping['notas']]?.trim() || null : null,
        }
      }).filter(Boolean)

      for (let i = 0; i < registros.length; i += 50) {
        const lote = registros.slice(i, i + 50)
        const { error } = await supabase.from('entregas').insert(lote)
        if (error) errList.push(`Error lote ${Math.floor(i / 50) + 1}: ${error.message}`)
        else ok += lote.length
      }

    } else {
      // Parcelas — también resuelve socio por nombre
      const { data: socios } = await supabase.from('socios').select('id, nombre').eq('user_id', userId)
      const socioMap = {}
      socios?.forEach(s => { socioMap[s.nombre.toLowerCase().trim()] = s.id })

      const variedadesValidas = ['Picual', 'Hojiblanca', 'Arbequina', 'Manzanilla', 'Gordal', 'Otra']

      const registros = rows.map((row, i) => {
        const socioNombre = mapping['socio_nombre'] ? row[mapping['socio_nombre']]?.trim() : ''
        const nombre = mapping['nombre'] ? row[mapping['nombre']]?.trim() : ''
        if (!socioNombre) { errList.push(`Fila ${i + 2}: nombre de socio vacío, omitida`); return null }
        if (!nombre) { errList.push(`Fila ${i + 2}: nombre de parcela vacío, omitida`); return null }
        const socio_id = socioMap[socioNombre.toLowerCase()]
        if (!socio_id) { errList.push(`Fila ${i + 2}: socio "${socioNombre}" no encontrado`); return null }
        const variedadRaw = mapping['variedad'] ? row[mapping['variedad']]?.trim() : ''
        const variedad = variedadesValidas.find(v => v.toLowerCase() === variedadRaw?.toLowerCase()) || (variedadRaw ? 'Otra' : null)
        return {
          user_id: userId,
          socio_id,
          nombre,
          superficie_ha: mapping['superficie_ha'] ? parseFloat(row[mapping['superficie_ha']]) || null : null,
          municipio: mapping['municipio'] ? row[mapping['municipio']]?.trim() || null : null,
          variedad: variedad || null,
        }
      }).filter(Boolean)

      for (let i = 0; i < registros.length; i += 50) {
        const lote = registros.slice(i, i + 50)
        const { error } = await supabase.from('parcelas').insert(lote)
        if (error) errList.push(`Error lote ${Math.floor(i / 50) + 1}: ${error.message}`)
        else ok += lote.length
      }
    }

    setResultado({ ok, total: rows.length })
    setErrores(errList)
    setLoading(false)
    setStep(4)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Importar datos</h1>
        <p className="text-gray-500 mt-1">Carga socios o entregas desde Excel o CSV</p>
      </div>

      {/* Selector tipo */}
      <div className="flex gap-3 mb-6">
        {[
          { key: 'socios', label: 'Socios', icon: '👥' },
          { key: 'entregas', label: 'Entregas', icon: '📦' },
          { key: 'parcelas', label: 'Parcelas', icon: '🌿' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTipo(t.key)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border-2 transition-all"
            style={{
              borderColor: tipo === t.key ? '#0f172a' : '#e5e7eb',
              backgroundColor: tipo === t.key ? '#0f172a' : 'white',
              color: tipo === t.key ? 'white' : '#374151',
            }}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Pasos */}
      <div className="flex items-center gap-2 mb-8 text-xs font-medium">
        {['Subir archivo', 'Mapear columnas', 'Vista previa', 'Resultado'].map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              style={{
                backgroundColor: step > i + 1 ? '#4ade80' : step === i + 1 ? '#0f172a' : '#e5e7eb',
                color: step > i + 1 ? '#0f172a' : step === i + 1 ? 'white' : '#9ca3af',
              }}
            >
              {step > i + 1 ? '✓' : i + 1}
            </div>
            <span style={{ color: step === i + 1 ? '#0f172a' : '#9ca3af' }}>{s}</span>
            {i < 3 && <div className="w-8 h-px bg-gray-200" />}
          </div>
        ))}
      </div>

      {/* PASO 1: Subir archivo */}
      {step === 1 && (
        <div
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${dragging ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="text-5xl mb-4">📂</div>
          <p className="text-gray-700 font-semibold text-lg">Arrastra tu archivo aquí</p>
          <p className="text-gray-400 text-sm mt-1">o haz clic para seleccionarlo</p>
          <p className="text-gray-300 text-xs mt-3">Soporta .xlsx · .xls · .ods · .csv</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.ods,.csv"
            className="hidden"
            onChange={e => handleFile(e.target.files[0])}
          />
        </div>
      )}

      {/* PASO 2: Mapear columnas */}
      {step === 2 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-1">Mapear columnas</h2>
          <p className="text-sm text-gray-500 mb-5">
            Se han detectado <strong>{rows.length} filas</strong> con <strong>{headers.length} columnas</strong>. Indica qué columna corresponde a cada campo.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map(field => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <select
                  value={mapping[field.key] || ''}
                  onChange={e => setMapping({ ...mapping, [field.key]: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': '#4ade80' }}
                >
                  <option value="">— No importar —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={resetear} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              ← Volver
            </button>
            <button
              onClick={generarPreview}
              className="px-6 py-2 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: '#0f172a' }}
            >
              Ver vista previa →
            </button>
          </div>
        </div>
      )}

      {/* PASO 3: Vista previa */}
      {step === 3 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-1">Vista previa</h2>
          <p className="text-sm text-gray-500 mb-5">
            Mostrando las primeras 5 filas de <strong>{rows.length}</strong> total. Revisa que los datos se ven correctamente.
          </p>
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  {fields.filter(f => mapping[f.key]).map(f => (
                    <th key={f.key} className="text-left px-4 py-3">{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-t border-gray-50">
                    {fields.filter(f => mapping[f.key]).map(f => (
                      <td key={f.key} className="px-4 py-2.5 text-gray-700">{row[f.key] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(tipo === 'entregas' || tipo === 'parcelas') && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-700">
              ⚠️ Los nombres de socios deben coincidir exactamente con los registrados en OlivaGest. Las filas que no coincidan serán omitidas.
            </div>
          )}
          <div className="flex gap-3 mt-6">
            <button onClick={() => setStep(2)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              ← Volver
            </button>
            <button
              onClick={importar}
              disabled={loading}
              className="px-6 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: '#0f172a' }}
            >
              {loading ? 'Importando...' : `Importar ${rows.length} registros`}
            </button>
          </div>
        </div>
      )}

      {/* PASO 4: Resultado */}
      {step === 4 && resultado && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="text-5xl mb-4">{resultado.ok > 0 ? '✅' : '❌'}</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {resultado.ok} de {resultado.total} registros importados
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            {resultado.ok === resultado.total
              ? 'Importación completada sin errores.'
              : `${resultado.total - resultado.ok} filas fueron omitidas.`}
          </p>
          {errores.length > 0 && (
            <div className="text-left mb-6 max-h-48 overflow-y-auto bg-red-50 rounded-xl p-4 border border-red-100">
              <p className="text-sm font-semibold text-red-700 mb-2">Filas omitidas:</p>
              {errores.map((e, i) => (
                <p key={i} className="text-xs text-red-600">{e}</p>
              ))}
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={resetear}
              className="px-5 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
            >
              Importar otro archivo
            </button>
            <a
              href={`/${tipo}`}
              className="px-5 py-2 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: '#0f172a' }}
            >
              Ver {tipo === 'socios' ? 'socios' : tipo === 'entregas' ? 'entregas' : 'parcelas'} →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
