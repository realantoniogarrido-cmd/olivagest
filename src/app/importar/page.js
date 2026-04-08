'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// ═══════════════════════════════════════════════════════════════════════════════
// CARGA DINÁMICA DE LIBRERÍAS
// ═══════════════════════════════════════════════════════════════════════════════

function loadSheetJS() {
  return new Promise((resolve) => {
    if (window.XLSX) return resolve(window.XLSX)
    const s = document.createElement('script')
    s.src = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js'
    s.onload = () => resolve(window.XLSX)
    document.head.appendChild(s)
  })
}

function loadPDFJS() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) return resolve(window.pdfjsLib)
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      resolve(window.pdfjsLib)
    }
    s.onerror = () => reject(new Error('No se pudo cargar PDF.js'))
    document.head.appendChild(s)
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILIDADES DE PARSEO
// ═══════════════════════════════════════════════════════════════════════════════

// Detecta campaña oleícola desde una fecha ISO "YYYY-MM-DD"
// Oct–Dic del año Y → "Y/Y+1"  |  Ene–Sep del año Y → "Y-1/Y"
function campanyaDesdeFecha(fechaStr) {
  if (!fechaStr) return null
  const d = new Date(fechaStr)
  if (isNaN(d)) return null
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  return m >= 10 ? `${y}/${y + 1}` : `${y - 1}/${y}`
}

// Normaliza texto: sin acentos, minúsculas, solo alfanumérico + espacio
function norm(str) {
  return String(str ?? '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Parsea número tolerando formato español (1.234,56) y símbolos (€, %, etc.)
function parseNum(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return isNaN(v) ? null : v
  let s = String(v).trim().replace(/[€$%\s]/g, '')
  if (!s) return null
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    if (s.includes(',') && s.includes('.') && s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(',', '.')
    }
  }
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

// Parsea fecha desde múltiples formatos + número serial de Excel
function parseDate(v) {
  if (!v) return null
  if (typeof v === 'number' && v > 25000 && v < 100000) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000))
    return d.toISOString().split('T')[0]
  }
  if (v instanceof Date) return v.toISOString().split('T')[0]
  const s = String(v).trim()
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy && parseInt(mdy[1]) <= 12) return `${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`
  return null
}

function normDNI(v) {
  return String(v ?? '').replace(/[\s.\-]/g, '').toUpperCase()
}
function normNombre(v) { return norm(String(v ?? '')) }

// Normaliza nombre ordenando palabras alfabéticamente (independiente del orden)
// "García López Manuel" y "Manuel García López" producen la misma clave
function normNombreBag(v) {
  return norm(String(v ?? '')).split(' ').filter(w => w.length > 1).sort().join(' ')
}

// Busca un socio en los mapas disponibles con múltiples estrategias
function buscarSocio(dniRaw, nomSocio, byDni, byNombre, byNombreBag) {
  if (dniRaw && byDni[dniRaw]) return byDni[dniRaw]
  if (nomSocio && byNombre[nomSocio]) return byNombre[nomSocio]
  // Fallback: orden de palabras del nombre no importa
  if (nomSocio) {
    const bag = normNombreBag(nomSocio)
    if (bag && byNombreBag[bag]) return byNombreBag[bag]
  }
  return null
}

function parseBool(v) {
  const n = norm(v)
  return ['si','s','yes','1','true','x','verdadero','ok','activo'].some(k => n === k || n.startsWith(k + ' '))
}
function normCalidad(v) {
  const n = norm(v)
  if (n.includes('extra')) return 'Extra'
  if (n.includes('segunda') || n.includes('2a') || n === '2') return 'Segunda'
  return 'Primera'
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUZZY MATCHING — 5 niveles: exacto → substring → palabras → Levenshtein → parcial
// ═══════════════════════════════════════════════════════════════════════════════

// Distancia de Levenshtein optimizada con vectores
function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const m = a.length, n = b.length
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  let curr = new Array(n + 1)
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i-1] === b[j-1] ? prev[j-1] : 1 + Math.min(prev[j], curr[j-1], prev[j-1])
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[n]
}

// Puntúa similitud entre header normalizado y alias normalizado (0–100)
// Mayor puntuación = mejor match
function matchScore(header, alias) {
  if (!header || !alias) return 0

  // Nivel 1: exacto
  if (header === alias) return 100

  // Nivel 2: uno contiene al otro (min 4 chars para evitar falsos)
  if (alias.length >= 4 && header.includes(alias)) return 90
  if (header.length >= 4 && alias.includes(header)) return 82

  // Nivel 3: solapamiento de palabras significativas
  const hw = header.split(' ').filter(w => w.length > 2)
  const aw = alias.split(' ').filter(w => w.length > 2)
  if (hw.length && aw.length) {
    const common = hw.filter(w => aw.includes(w)).length
    if (common > 0) {
      const ratio = common / Math.max(hw.length, aw.length)
      if (ratio >= 0.66) return Math.round(60 + ratio * 20)
      if (ratio >= 0.33) return Math.round(45 + ratio * 20)
    }
  }

  // Nivel 4: Levenshtein sobre el string completo
  const lenDiff = Math.abs(header.length - alias.length)
  if (header.length >= 5 && alias.length >= 5 && lenDiff <= 3) {
    const dist = levenshtein(header, alias)
    if (dist === 1) return 58
    if (dist === 2 && header.length >= 7) return 48
    if (dist === 3 && header.length >= 9) return 38
  }

  // Nivel 5: Levenshtein sobre palabras individuales (detecta "Nomrbe" → "Nombre")
  for (const hw_w of hw) {
    for (const aw_w of aw) {
      if (hw_w.length >= 4 && aw_w.length >= 4) {
        const dist = levenshtein(hw_w, aw_w)
        if (dist === 0) continue // ya cubierto por nivel 3
        if (dist === 1) return 42
        if (dist === 2 && hw_w.length >= 6) return 32
      }
    }
  }

  return 0
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFINICIÓN DE CAMPOS — aliases exhaustivos + typos comunes en castellano
// ═══════════════════════════════════════════════════════════════════════════════

const SOCIOS_FIELDS = [
  { key: 'nombre', label: 'Nombre completo', required: true, aliases: [
    'nombre','nombre completo','nombre y apellidos','apellidos y nombre','nombre apellidos',
    'titular','socio','agricultor','propietario','razon social','name','full name',
    'nombre socio','nombre del socio','nombre del agricultor','denominacion social',
    'apellidos nombre','nombre productor','cooperativista','afiliado','miembro',
    'asociado','nombre miembro','nombre cooperativista','nombre y apellido',
    'apellido nombre','apellido y nombre','nombre titular','productor',
    'datos personales nombre','nom i cognoms','nom cognoms','denominacion',
    // Typos frecuentes
    'nonbre','nonbre completo','nobre','nmbre','nombre copmleto','nomnbre',
    'nobmre','nonbre apellidos','apelldios nombre','apelllidos nombre',
  ]},
  { key: 'dni', label: 'DNI / NIF', required: false, aliases: [
    'dni','nif','nie','cif','dni nif','nif dni','documento','documento nacional',
    'identificacion','identificador','dni o nif','numero documento','num documento',
    'id fiscal','doc identidad','numero nif','numero dni','codigo fiscal',
    'dni nie nif','identificacion fiscal','num id','numero identificacion',
    'nif cif','documento identidad','num doc','codigo socio','id',
    'documento nacional identidad','num identificacion','identificador fiscal',
    // Inglés (programas de gestión bilingües)
    'tax id','tax identification','tax number','vat number','vat id','fiscal id',
    'id number','identity number','registration number','member id','member number',
    // Formatos alternativos
    'dni/nif','d.n.i','n.i.f','d.n.i.','n.i.f.','dni-nif','nif/dni',
    // Typos
    'dini','dmi','nfi','dni num','numden','num dni','num nif',
  ]},
  { key: 'telefono', label: 'Teléfono', required: false, aliases: [
    'telefono','tlf','telf','tel','phone','movil','celular','contacto telefonico',
    'numero telefono','telefono movil','telefono contacto','num tel','tel contacto',
    'telefono 1','telf 1','movil 1','telefono fijo','fijo','movil contacto',
    'tel movil','numero movil','numero contacto','contacto','telfono',
    'telephone','mobile','mobile number','phone number','cell','cellphone',
    'numero de telefono','num telefono','telefono de contacto','movil socio',
    'telefono personal','tel personal','tlf personal','tel 1','tel1',
    // Typos
    'telfono','telefonno','telelfono','teleono','telefno','movvil','mvil',
  ]},
  { key: 'email', label: 'Email', required: false, aliases: [
    'email','correo','mail','e mail','correo electronico','correo electrónico',
    'email address','direccion email','correo de contacto','e-mail','e_mail',
    'emailaddress','correoelectronico','email socio','correo socio',
    'direccion correo','correo contacto','correo de correo',
    'email contacto','email personal','correo personal',
    // Typos
    'emial','eamil','emaill','crreo','correro',
  ]},
  { key: 'municipio', label: 'Municipio / Dirección', required: false, aliases: [
    'municipio','localidad','pueblo','ciudad','poblacion','lugar','residencia',
    'direccion','domicilio','ubicacion','municipio residencia','domicilio fiscal',
    'location','town','village','localidad residencia','municipio domicilio',
    'provincia','comarca','termino','poblacion residencia','direccion postal',
    'cp','codigo postal','domicilio socio','lugar residencia','calle',
    'domicilio completo','direccion completa','via','poblacion municipio',
  ]},
  { key: 'num_socio', label: 'Nº de Socio', required: false, aliases: [
    'numero socio','num socio','nº socio','no socio','id socio','codigo socio',
    'numero de socio','n socio','nro socio','socio numero','socio num',
    'numero miembro','id miembro','expediente','num expediente','n expediente',
    'referencia socio','ref socio','carnet socio','numero carnet',
    'n.socio','num.socio','numerosocio','numsocio','socio id',
  ]},
  { key: 'fecha_alta', label: 'Fecha de Alta', required: false, aliases: [
    'fecha alta','fecha de alta','fecha ingreso','fecha incorporacion','alta',
    'fecha registro','fecha inscripcion','fecha entrada','fecha inicio',
    'date','fecha','alta socio','incorporacion','ingreso','fecha afiliacion',
    'fecha asociacion','fecha inicio actividad','fecha socio',
  ]},
  { key: 'iban', label: 'IBAN / Cuenta bancaria', required: false, aliases: [
    'iban','cuenta bancaria','cuenta','cuenta banco','numero cuenta','datos bancarios',
    'banco','cuenta corriente','num cuenta','numero de cuenta','iban cuenta',
    'entidad bancaria','n cuenta','cuenta iban','ccc','domiciliacion bancaria',
    'datos banco','cuenta pago','iban socio','bic','swift','codigo cuenta cliente',
  ]},
]

const PARCELAS_FIELDS = [
  { key: 'dni_socio', label: 'DNI / NIF del Socio', required: false, aliases: [
    'dni socio','nif socio','dni titular','nif titular','dni propietario',
    'documento socio','identificacion socio','nif del titular','dni del titular',
    'nif propietario','cif socio','dni agricultor','nif agricultor',
    'doc titular','id titular','identificacion titular','identificacion propietario',
  ]},
  { key: 'socio_nombre', label: 'Nombre del Socio', required: false, aliases: [
    'nombre socio','nombre titular','nombre propietario','nombre agricultor',
    'socio nombre','titular nombre','nombre del titular','nombre del socio',
    'nombre del propietario','nombre del agricultor','agricultor','propietario',
    'titular','socio','nombre productor','cooperativista','afiliado',
    'nombre y apellidos','nombre completo titular','propietario parcela',
  ]},
  { key: 'nombre', label: 'Nombre Parcela / Finca', required: true, aliases: [
    'nombre parcela','nombre finca','parcela','finca','denominacion','nombre',
    'identificacion parcela','ref parcela','paraje','nombre paraje',
    'nombre explotacion','explotacion','nombre de la parcela','nombre de la finca',
    'descripcion parcela','referencia catastral','ref catastral','poligono parcela',
    'recinto','nombre recinto','id parcela','parcela nombre','finca nombre',
    'denominacion finca','denominacion parcela','clave parcela','sigpac',
    'recinto sigpac','descripcion','nombre explotacion olivar',
    // Typos
    'pracela','prcela','fnca','prcela nombre','nobre parcela',
  ]},
  { key: 'superficie_ha', label: 'Superficie (ha)', required: false, aliases: [
    'superficie','superficie ha','superficie (ha)','hectareas','has','ha',
    'extension','area','superficie total','sup ha','superficie en ha',
    'superficie declarada','hectareas declaradas','sup total','superficie hectareas',
    'area ha','cabida','superficie catastral','sup declarada',
    'superficie olivar','hectareas olivar','superficie finca',
    'superficie (hectareas)','has declaradas','m2','metros cuadrados',
    // Typos
    'superifcie','superfice','superfici','hectaraes','ectareas','hectareas ha',
  ]},
  { key: 'municipio', label: 'Municipio / Término', required: false, aliases: [
    'municipio','localidad','pueblo','ciudad','termino municipal','termino',
    'zona','comarca','lugar','ubicacion','termino de la parcela',
    'municipio parcela','termino parcela','localidad parcela','ubicacion parcela',
    'term municipal','termino mun','municipio finca','localidad finca',
    'municipio explotacion','termino explotacion',
  ]},
  { key: 'variedad', label: 'Variedad de olivo', required: false, aliases: [
    'variedad','variedad olivo','tipo olivo','especie','cultivar',
    'tipo aceituna','variedad aceituna','variedad olivar','variedad del olivo',
    'tipo olivar','variedad olivera','tipo cultivo','variedad cultivo',
    'variedad principal','tipo de olivo','nombre variedad','variedad arbol',
    'variedad predominante','picual','hojiblanca','arbequina','manzanilla',
    // Typos
    'variadad','variedad olivio','varided','varidad','bariedad',
  ]},
  { key: 'num_arboles', label: 'Nº de árboles', required: false, aliases: [
    'arboles','num arboles','numero arboles','nº arboles','cantidad arboles',
    'n arboles','plantas','olivos','num olivos','numero olivos',
    'nº olivos','pies','num pies','numero pies','plantas declaradas',
  ]},
  { key: 'pendiente', label: 'Pendiente (Sí/No)', required: false, aliases: [
    'pendiente','en pendiente','terreno pendiente','inclinacion','ladera',
    'tiene pendiente','es pendiente','con pendiente','zona pendiente',
    'desnivel','pendiente terreno','parcela pendiente','olivar pendiente',
  ]},
  { key: 'riego', label: 'Riego (Sí/No)', required: false, aliases: [
    'riego','con riego','regadio','sistema riego','tiene riego','irrigacion',
    'es regadio','parcela riego','con regadio','tipo riego','modalidad riego',
    'regadio secano','secano regadio','tipo aprovechamiento',
  ]},
  { key: 'poligono', label: 'Polígono catastral', required: false, aliases: [
    'poligono','poligono catastral','num poligono','numero poligono',
    'pol','pol catastral','id poligono','poligono parcela','num pol',
    'poligono sigpac','pol sigpac',
  ]},
  { key: 'parcela_cat', label: 'Nº Parcela catastral', required: false, aliases: [
    'parcela catastral','num parcela','numero parcela','parcela num',
    'parcela no','id parcela catastral','num parcela cat','recinto catastral',
    'parcela sigpac','num recinto','numero recinto',
  ]},
  { key: 'observaciones', label: 'Observaciones', required: false, aliases: [
    'observaciones','obs','notas','comentarios','anotaciones','descripcion',
    'nota','observacion','detalle','incidencias','observacion parcela',
    'comentario','notas parcela','otras observaciones','remarks','notes',
  ]},
]

const ENTREGAS_FIELDS = [
  { key: 'dni_socio', label: 'DNI / NIF del Socio', required: false, aliases: [
    'dni socio','nif socio','dni titular','documento socio','identificacion socio',
    'nif del titular','dni del titular','dni del agricultor','dni','nif',
    'id agricultor','codigo agricultor','num agricultor','nif agricultor',
  ]},
  { key: 'socio_nombre', label: 'Nombre del Socio', required: false, aliases: [
    'nombre socio','nombre titular','nombre agricultor','nombre propietario',
    'socio nombre','titular nombre','nombre del socio','nombre del agricultor',
    'agricultor','nombre','propietario','titular','productor',
    'nombre y apellidos','nombre completo','cooperativista',
  ]},
  { key: 'campana', label: 'Campaña', required: false, aliases: [
    'campana','campana','temporada','año campana','año campaña','camp','season',
    'ejercicio','periodo','año cosecha','cosecha','temporada campana',
    'campaña olivarera','campaign','año','temporada recoleccion',
    'anio campana','campaña olivicola','campanya',
  ]},
  { key: 'fecha', label: 'Fecha entrega', required: false, aliases: [
    'fecha','fecha entrega','date','dia','dia entrega','fecha recepcion',
    'fecha entrada','fecha descarga','fecha pesada','fecha de entrega',
    'fecha recogida','dia recogida','fecha de recogida','fecha pesaje',
    'fecha recoleccion','fecha descarga almazara','dia recepcion',
    'fecha almazara','fecha entrada almazara',
  ]},
  { key: 'kg', label: 'Kg aceituna', required: true, aliases: [
    'kg','kg aceituna','kilos','kilogramos','peso','kg bruto','peso bruto',
    'kg neto','kgs','peso aceituna','cantidad kg','cantidad',
    'kg de aceituna','kilos aceituna','peso neto','kg oliva',
    'kilos entregados','kg entregados','peso kg','peso total',
    'kilos brutos','kg oliva entregada','cantidad kilos','peso entregado',
    'kg recibido','kilos recibidos','importe kg',
    // Typos
    'kkg','kgs aceituna','kiloss','pesos','kilogramo','kilo',
  ]},
  { key: 'calidad', label: 'Calidad', required: false, aliases: [
    'calidad','quality','tipo','clase','categoria','grado','clasificacion',
    'calidad aceituna','tipo aceituna','categoria calidad','grado calidad',
    'clasificacion aceituna','tipo de aceituna','clase aceituna',
    'calificacion','calidad fruto','denominacion calidad',
  ]},
  { key: 'parcela', label: 'Parcela / Finca', required: false, aliases: [
    'parcela','finca','nombre parcela','origen','procedencia',
    'explotacion','paraje','ref parcela','nombre de parcela',
    'parcela origen','finca origen','procedencia parcela','parcela entrega',
  ]},
  { key: 'rend_bruto', label: 'Rendimiento bruto (%)', required: false, aliases: [
    'rendimiento','rendimiento bruto','rend bruto','rend',
    'rend. bruto (%)','% rendimiento','porcentaje graso','grasa',
    'rendimiento graso','indice graso','contenido graso','contenido en grasa',
    'rendimiento en grasa','rendimiento aceite','grasa total',
    'contenido aceite','indice de grasa','porcentaje aceite',
    'riqueza grasa','grasas','rend grasa',
    // Typos
    'rendmiento','rendiminto','rendimeinto','rendimiento bruto %',
  ]},
  { key: 'humedad', label: 'Humedad (%)', required: false, aliases: [
    'humedad','humedad %','% humedad','contenido agua','agua','moisture',
    'humedad aceituna','tasa humedad','humedad relativa','h2o',
    'contenido humedad','h %','porcentaje humedad',
  ]},
  { key: 'impurezas', label: 'Impurezas (%)', required: false, aliases: [
    'impurezas','impurezas %','% impurezas','sucio','suciedad',
    'tierras','materia extraña','contenido impurezas','impureza',
    'descuento impurezas','deduccion impurezas',
  ]},
  { key: 'punto_ext', label: 'Punto extracción (%)', required: false, aliases: [
    'punto extraccion','punto extraccion (%)','punto ext','extraccion',
    'punto de extraccion','merma','descuento extraccion','indice extraccion',
    'coeficiente extraccion','rendimiento extraccion','p extraccion',
  ]},
]

// ═══════════════════════════════════════════════════════════════════════════════
// PALABRAS CLAVE QUE INDICAN FILAS RESUMEN (deben ignorarse silenciosamente)
// ═══════════════════════════════════════════════════════════════════════════════
const PALABRAS_RESUMEN = [
  'total','totales','total general','subtotal','sub total','suma','sumatorio',
  'media','promedio','average','sum','grand total','resumen','resultado',
  'acumulado','acumulado total','total campaña','total kg','total general kg',
]

function esFilaResumen(row) {
  const vals = Object.values(row).map(v => norm(String(v ?? '')))
  return vals.some(v => v && PALABRAS_RESUMEN.some(k => v === k || v.startsWith(k + ' ') || v.endsWith(' ' + k)))
}

// ═══════════════════════════════════════════════════════════════════════════════
// INSERT UNIVERSAL CON AUTO-DETECCIÓN DE SCHEMA
// Si Supabase devuelve error de columna inexistente, la elimina y reintenta.
// Funciona con CUALQUIER schema de cooperativa sin configuración previa.
// ═══════════════════════════════════════════════════════════════════════════════
async function insertarAdaptativo(supabase, tabla, registros, onConflict = null) {
  if (!registros.length) return { ok: 0, err: null }

  const colsEliminadas = new Set()
  let payload = registros.map(r => ({ ...r }))
  let usarUpsert = !!onConflict   // se desactiva si no hay constraint de unicidad

  for (let intento = 0; intento < 20; intento++) {
    const op = (usarUpsert && onConflict)
      ? supabase.from(tabla).upsert(payload, { onConflict, ignoreDuplicates: false })
      : supabase.from(tabla).insert(payload)

    const { error } = await op

    if (!error) return { ok: payload.length, err: null }

    const msg = error.message || ''

    // ① Constraint de unicidad no existe → cambiar a insert simple y reintentar
    if (msg.includes('no unique or exclusion constraint') || msg.includes('ON CONFLICT')) {
      usarUpsert = false
      continue
    }

    // ② Columna inexistente en el schema de la cooperativa →
    //    eliminarla del payload y reintentar automáticamente
    //    Formatos del mensaje de Supabase:
    //    "Could not find the 'X' column of 'T' in the schema cache"
    //    "column 'X' of relation 'T' does not exist"
    const matchCol =
      msg.match(/'([^']+)'\s+column/) ||    // formato A
      msg.match(/column\s+"?([^"'\s]+)"?\s+of\s+relation/)  // formato B
    if (matchCol) {
      const badCol = matchCol[1]
      if (!colsEliminadas.has(badCol)) {
        colsEliminadas.add(badCol)
        payload = payload.map(r => { const c = { ...r }; delete c[badCol]; return c })
        continue
      }
    }

    // ③ Error real no tratable automáticamente → devolver
    return { ok: 0, err: msg }
  }

  return { ok: 0, err: `No se pudo insertar en ${tabla}: demasiados reintentos` }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RELEVANCIA DE COLUMNA Y SECCIÓN
// ═══════════════════════════════════════════════════════════════════════════════

// Puntúa cuán relevante es un header para un conjunto de campos
function columnRelevanceScore(header, fields) {
  if (!header) return 0
  const hn = norm(header)
  let best = 0
  for (const field of fields) {
    for (const alias of field.aliases) {
      const s = matchScore(hn, norm(alias))
      if (s > best) best = s
    }
  }
  return best
}

// Puntúa cuán bien encaja un conjunto de headers con un tipo de importación
function sheetRelevanceScore(headers, fields) {
  if (!headers?.length) return 0
  let total = 0
  const required = fields.filter(f => f.required)
  let requiredFound = 0
  for (const field of fields) {
    let fieldBest = 0
    for (const h of headers) {
      const s = columnRelevanceScore(h, [field])
      if (s > fieldBest) fieldBest = s
    }
    if (fieldBest > 30) {
      total += fieldBest
      if (required.find(r => r.key === field.key)) requiredFound++
    }
  }
  if (required.length > 0 && requiredFound === required.length) total += 60
  return total
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-MAPEO FUZZY — 5 niveles de confianza
// ═══════════════════════════════════════════════════════════════════════════════

function autoDetectMapping(headers, fields) {
  const normHeaders = headers.map(h => ({ original: h, norm: norm(h) }))
  const mapping = {}
  const confidence = {}
  const usados = new Set()

  // Procesar campos con aliases más largos primero (evita colisiones)
  const sorted = [...fields].sort((a, b) =>
    Math.max(...b.aliases.map(x => x.length)) - Math.max(...a.aliases.map(x => x.length))
  )

  sorted.forEach(field => {
    const normAliases = field.aliases.map(a => norm(a))
    let bestHeader = null
    let bestScore = 0

    for (const hObj of normHeaders) {
      if (usados.has(hObj.original)) continue
      let headerBest = 0
      for (const alias of normAliases) {
        const s = matchScore(hObj.norm, alias)
        if (s > headerBest) headerBest = s
      }
      if (headerBest > bestScore) { bestScore = headerBest; bestHeader = hObj }
    }

    if (bestHeader && bestScore >= 32) {
      usados.add(bestHeader.original)
      mapping[field.key] = bestHeader.original
      confidence[field.key] = bestScore >= 90 ? 'auto' : bestScore >= 60 ? 'medium' : 'low'
    } else {
      mapping[field.key] = ''
      confidence[field.key] = 'empty'
    }
  })

  return { mapping, confidence }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARSER PDF — Extrae tablas con posicionamiento de texto (PDF.js)
// ═══════════════════════════════════════════════════════════════════════════════

function groupIntoRows(items, tolerance = 5) {
  if (!items.length) return []
  const sorted = [...items].sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x)
  const rows = []
  let current = [sorted[0]]
  let rowY = sorted[0].y

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i]
    if (Math.abs(item.y - rowY) <= tolerance) {
      current.push(item)
    } else {
      rows.push(current.sort((a, b) => a.x - b.x))
      current = [item]
      rowY = item.y
    }
  }
  if (current.length) rows.push(current.sort((a, b) => a.x - b.x))
  return rows
}

// Detecta secciones en las filas de PDF (separadas por filas-título de 1 celda)
function detectPDFSections(rows, filename) {
  const sections = []
  let cur = { headerRow: null, dataRows: [], titleHint: filename || '' }

  const SECTION_KEYWORDS = [
    'socio','parcela','entrega','cosecha','finca','agricultor','productor',
    'campana','campana','miembro','cooperativa','olivar','aceituna','lista',
    'relacion','datos socios','datos parcelas','relacion socios',
  ]

  for (const row of rows) {
    if (row.length === 0) continue

    // Fila de un solo elemento → posible título de sección
    if (row.length === 1) {
      const txt = norm(row[0].text)
      const isTitle = SECTION_KEYWORDS.some(k => txt.includes(k)) || txt.length < 30
      if (isTitle) {
        // Guardar sección actual si tiene datos
        if (cur.headerRow && cur.dataRows.length > 0) sections.push({ ...cur })
        cur = { headerRow: null, dataRows: [], titleHint: row[0].text }
      }
      continue
    }

    if (!cur.headerRow) {
      cur.headerRow = row
    } else {
      cur.dataRows.push(row)
    }
  }
  if (cur.headerRow && cur.dataRows.length > 0) sections.push(cur)
  return sections
}

// Convierte una sección PDF en { headers, rows }
function pdfSectionToTable(section) {
  const { headerRow, dataRows } = section
  const headers = headerRow.map(item => item.text)
  const colAnchors = headerRow.map(item => item.x)
  const pageWidth = Math.max(...headerRow.map(i => i.x)) + 200
  const colTolerance = pageWidth / headers.length * 0.9

  const tableRows = []
  for (const row of dataRows) {
    const cells = new Array(headers.length).fill('')
    let hasContent = false

    for (const item of row) {
      let minDist = Infinity; let colIdx = 0
      colAnchors.forEach((anchor, j) => {
        const dist = Math.abs(item.x - anchor)
        if (dist < minDist) { minDist = dist; colIdx = j }
      })
      if (minDist <= colTolerance) {
        cells[colIdx] = cells[colIdx] ? cells[colIdx] + ' ' + item.text : item.text
        hasContent = true
      }
    }

    if (hasContent) {
      const obj = {}
      headers.forEach((h, j) => { obj[h] = cells[j] || '' })
      tableRows.push(obj)
    }
  }
  return { headers, rows: tableRows }
}

async function parsePDFRobust(file) {
  const pdfjsLib = await loadPDFJS()
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const allItems = []
  let yOffset = 0

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const vp = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    content.items.forEach(item => {
      const t = item.str?.trim()
      if (t) {
        allItems.push({
          x: Math.round(item.transform[4] * 10) / 10,
          y: Math.round((yOffset + (vp.height - item.transform[5])) * 10) / 10,
          text: t, page: p,
        })
      }
    })
    yOffset += vp.height + 50
  }

  if (!allItems.length) return []

  const rows = groupIntoRows(allItems, 5)
  let sections = detectPDFSections(rows, file.name)

  // Fallback: una sola tabla con todas las filas multi-columna
  if (!sections.length) {
    const multiRows = rows.filter(r => r.length >= 2)
    if (multiRows.length < 2) return []
    sections = [{ headerRow: multiRows[0], dataRows: multiRows.slice(1), titleHint: file.name }]
  }

  return sections
    .map(sec => ({ ...pdfSectionToTable(sec), titleHint: sec.titleHint || '' }))
    .filter(sec => sec.rows.length > 0)
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARSER EXCEL — Multi-hoja con scoring automático por tipo de importación
// ═══════════════════════════════════════════════════════════════════════════════

async function parseExcelRobust(file, targetFields) {
  const XLSX = await loadSheetJS()
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true, cellNF: false })

  const sheets = wb.SheetNames.map(name => {
    const ws = wb.Sheets[name]
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true })
    if (raw.length < 2) return null

    // Buscar fila de cabecera (primera con ≥ 2 celdas de texto)
    let headerRow = 0
    for (let i = 0; i < Math.min(10, raw.length); i++) {
      const textCells = raw[i].filter(c => typeof c === 'string' && c.trim().length > 1)
      if (textCells.length >= 2) { headerRow = i; break }
    }

    const headers = raw[headerRow]
      .map(h => String(h ?? '').trim())
      .filter(h => h !== '')

    if (headers.length < 2) return null

    const dataRows = raw.slice(headerRow + 1)
      .filter(r => r.some(c => c !== '' && c !== null && c !== undefined))
      .map(r => {
        const obj = {}
        headers.forEach((h, i) => {
          const v = r[i]
          obj[h] = v instanceof Date ? v.toISOString().split('T')[0] : (v !== undefined ? v : '')
        })
        return obj
      })

    return { name, headers, rows: dataRows, titleHint: name }
  }).filter(Boolean)

  if (!sheets.length) return []

  // Ordenar hojas por relevancia para el tipo actual
  if (targetFields) {
    sheets.sort((a, b) =>
      sheetRelevanceScore(b.headers, targetFields) - sheetRelevanceScore(a.headers, targetFields)
    )
  }
  return sheets
}

async function parseCSVRobust(text) {
  const clean = text.replace(/^\uFEFF/, '').trim()
  const lines = clean.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const counts = { ';': 0, ',': 0, '|': 0, '\t': 0 }
  lines[0].split('').forEach(c => { if (counts[c] !== undefined) counts[c]++ })
  const sep = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
  const parseRow = line => line.split(sep).map(v => v.replace(/^["']|["']$/g, '').trim())
  const headers = parseRow(lines[0]).filter(h => h)
  const rows = lines.slice(1)
    .filter(l => l.replace(/[;,|\t\s]/g, ''))
    .map(line => {
      const vals = parseRow(line)
      const obj = {}
      headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
      return obj
    })
  return [{ name: 'CSV', headers, rows, titleHint: '' }]
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default function ImportarPage() {
  const [tipo, setTipo] = useState('socios')
  const [step, setStep] = useState(1)
  const [sections, setSections] = useState([])          // todas las secciones detectadas
  const [activeSectionIdx, setActiveSectionIdx] = useState(0)
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [mapping, setMapping] = useState({})
  const [confidence, setConfidence] = useState({})
  const [preview, setPreview] = useState([])
  const [loading, setLoading] = useState(false)
  const [parseLoading, setParseLoading] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [errores, setErrores] = useState([])
  const [dragging, setDragging] = useState(false)
  const [parseError, setParseError] = useState(null)
  const [showIrrelevant, setShowIrrelevant] = useState(false)
  const [campanaForzada, setCampanaForzada] = useState('')  // campaña manual si no viene en el archivo
  const fileInputRef = useRef()

  const fields = tipo === 'socios' ? SOCIOS_FIELDS : tipo === 'entregas' ? ENTREGAS_FIELDS : PARCELAS_FIELDS

  function resetear() {
    setStep(1); setSections([]); setActiveSectionIdx(0)
    setHeaders([]); setRows([]); setMapping({}); setConfidence({})
    setPreview([]); setResultado(null); setErrores([])
    setParseError(null); setShowIrrelevant(false); setCampanaForzada('')
  }
  useEffect(() => { resetear() }, [tipo])

  function applySection(sectionList, idx, currentFields) {
    const sec = sectionList[idx]
    if (!sec) return
    const { mapping: m, confidence: c } = autoDetectMapping(sec.headers, currentFields || fields)
    setHeaders(sec.headers)
    setRows(sec.rows)
    setMapping(m)
    setConfidence(c)
    setActiveSectionIdx(idx)
  }

  async function handleFile(file) {
    if (!file) return
    setParseError(null)
    setParseLoading(true)
    let sectionList = []
    const ext = file.name.split('.').pop().toLowerCase()

    try {
      if (['xlsx', 'xls', 'ods'].includes(ext)) {
        sectionList = await parseExcelRobust(file, fields)
      } else if (ext === 'csv') {
        sectionList = await parseCSVRobust(await file.text())
      } else if (ext === 'pdf') {
        sectionList = await parsePDFRobust(file)
      } else {
        setParseError('Formato no soportado. Usa .xlsx, .xls, .ods, .csv o .pdf')
        setParseLoading(false)
        return
      }
    } catch (e) {
      setParseError(`Error al leer el archivo: ${e.message}`)
      setParseLoading(false)
      return
    }

    setParseLoading(false)

    if (!sectionList.length) {
      setParseError('No se encontraron datos en el archivo. Asegúrate de que tenga cabeceras y filas de datos.')
      return
    }

    // Puntuar y ordenar secciones por relevancia para el tipo actual
    const scored = sectionList.map((sec, i) => ({
      ...sec,
      score: sheetRelevanceScore(sec.headers, fields),
      origIdx: i,
    })).sort((a, b) => b.score - a.score)

    setSections(scored)
    applySection(scored, 0, fields)
    setStep(2)
  }

  function handleDrop(e) {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]; if (f) handleFile(f)
  }

  function generarPreview() {
    const prev = rows.slice(0, 5).map(row => {
      const obj = {}
      fields.forEach(f => { obj[f.key] = mapping[f.key] ? String(row[mapping[f.key]] ?? '') : '' })
      return obj
    })
    setPreview(prev); setStep(3)
  }

  // Columnas del archivo que no están mapeadas a ningún campo
  const unmappedHeaders = headers.filter(h => !Object.values(mapping).includes(h))

  // Porcentaje de confianza global del mapeo
  const confValues = Object.values(confidence)
  const confScore = confValues.length
    ? Math.round((confValues.filter(c => c === 'auto').length / confValues.length) * 100)
    : 0

  // ─── IMPORTAR ──────────────────────────────────────────────────────────────
  async function importar() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('No hay sesión activa'); setLoading(false); return }
    const uid = user.id
    const errList = []; let ok = 0
    let extraResultado = {}  // datos extra de dedup para socios

    const val = (row, key) => mapping[key] ? String(row[mapping[key]] ?? '').trim() : ''
    const raw = (row, key) => mapping[key] ? row[mapping[key]] : ''

    // ── SOCIOS ────────────────────────────────────────────────────────────────
    if (tipo === 'socios') {
      const registros = rows.map((row) => {
        if (esFilaResumen(row)) return null
        const nombre = val(row, 'nombre')
        if (!nombre) return null
        const dni = normDNI(val(row, 'dni')) || null
        // Payload máximo — insertarAdaptativo elimina automáticamente columnas inexistentes
        return {
          user_id:    uid,
          nombre:     nombre.trim(),
          dni,
          telefono:   val(row, 'telefono') || null,
          email:      val(row, 'email').toLowerCase() || null,
          direccion:  val(row, 'municipio') || null,
          municipio:  val(row, 'municipio') || null,
          num_socio:  val(row, 'num_socio') || null,
          fecha_alta: parseDate(raw(row, 'fecha_alta')) || null,
          iban:       val(row, 'iban') || null,
        }
      }).filter(Boolean)

      if (!registros.length) {
        errList.push('No se encontraron filas válidas — comprueba el mapeo de columnas')
      } else {
        // ── Deduplicación: cargar socios existentes y comparar ────────────────
        const { data: existentes } = await supabase.from('socios').select('*').eq('user_id', uid)
        const byDniEx    = Object.fromEntries((existentes||[]).filter(s=>s.dni).map(s=>[normDNI(s.dni), s]))
        const byNombreEx = Object.fromEntries((existentes||[]).map(s=>[normNombreBag(s.nombre), s]))

        const CAMPOS_COMPARAR = [
          { key: 'telefono', label: 'Teléfono' },
          { key: 'email',    label: 'Email' },
          { key: 'municipio',label: 'Municipio' },
          { key: 'iban',     label: 'IBAN' },
        ]

        const nuevos = []
        let saltados = 0
        const avisosDedup = []

        for (const reg of registros) {
          const dniKey = reg.dni ? normDNI(reg.dni) : null
          const bagKey = normNombreBag(reg.nombre)
          const existente = (dniKey && byDniEx[dniKey]) || byNombreEx[bagKey]

          if (existente) {
            // Detectar diferencias en campos clave
            const diffs = CAMPOS_COMPARAR.filter(c => {
              const vNew = reg[c.key] ? norm(String(reg[c.key])) : null
              const vEx  = existente[c.key] ? norm(String(existente[c.key])) : null
              return vNew && vEx && vNew !== vEx
            })
            if (diffs.length > 0) {
              avisosDedup.push(
                `"${reg.nombre}": ${diffs.map(c => `${c.label} — archivo: "${reg[c.key]}" / guardado: "${existente[c.key]}"`).join(' | ')}`
              )
            }
            saltados++
          } else {
            nuevos.push(reg)
          }
        }

        // Solo insertar los genuinamente nuevos
        for (let i = 0; i < nuevos.length; i += 50) {
          const lote = nuevos.slice(i, i + 50)
          const { ok: n, err } = await insertarAdaptativo(supabase, 'socios', lote)
          if (err) errList.push(`Lote ${Math.floor(i/50)+1}: ${err}`)
          else ok += n
        }

        // Guardar info de dedup para mostrarlo en el resultado
        extraResultado = { saltados, avisos: avisosDedup }
      }

    // ── PARCELAS ──────────────────────────────────────────────────────────────
    } else if (tipo === 'parcelas') {
      const { data: sociosDB } = await supabase.from('socios').select('id,nombre,dni').eq('user_id', uid)
      const byDni       = Object.fromEntries((sociosDB||[]).filter(s=>s.dni).map(s=>[normDNI(s.dni), s.id]))
      const byNombre    = Object.fromEntries((sociosDB||[]).map(s=>[normNombre(s.nombre), s.id]))
      const byNombreBag = Object.fromEntries((sociosDB||[]).map(s=>[normNombreBag(s.nombre), s.id]))
      const varOk    = ['Picual','Hojiblanca','Arbequina','Manzanilla','Gordal','Cornicabra','Lechin','Empeltre','Otra']

      const registros = rows.map((row, i) => {
        if (esFilaResumen(row)) return null
        const nombre = val(row, 'nombre')
        if (!nombre) return null
        const dniRaw   = normDNI(val(row, 'dni_socio'))
        const nomSocio = normNombre(val(row, 'socio_nombre'))
        if (!dniRaw && !nomSocio) return null
        const socio_id = buscarSocio(dniRaw, nomSocio, byDni, byNombre, byNombreBag)
        if (!socio_id) {
          errList.push(`Fila ${i+2}: socio "${dniRaw||nomSocio}" no encontrado`)
          return null
        }
        const varRaw  = val(row, 'variedad')
        const variedad = varOk.find(v => norm(v) === norm(varRaw)) || varRaw || null
        // Payload máximo — insertarAdaptativo filtra columnas inexistentes automáticamente
        return {
          user_id: uid, socio_id, nombre,
          superficie_ha: parseNum(raw(row, 'superficie_ha')) || null,
          municipio:     val(row, 'municipio') || null,
          variedad:      variedad || null,
          num_arboles:   parseNum(raw(row, 'num_arboles')) || null,
          pendiente:     mapping['pendiente'] ? parseBool(val(row, 'pendiente')) : undefined,
          riego:         mapping['riego']     ? parseBool(val(row, 'riego'))     : undefined,
          observaciones: val(row, 'observaciones') || null,
          poligono:      val(row, 'poligono') || null,
          parcela_cat:   val(row, 'parcela_cat') || null,
        }
      }).filter(Boolean)

      for (let i = 0; i < registros.length; i += 50) {
        const lote = registros.slice(i, i + 50)
        const { ok: n, err } = await insertarAdaptativo(supabase, 'parcelas', lote)
        if (err) errList.push(`Lote ${Math.floor(i/50)+1}: ${err}`)
        else ok += n
      }

    // ── ENTREGAS ───────────────────────────────────────────────────────────────
    } else {
      const { data: sociosDB }   = await supabase.from('socios').select('id,nombre,dni').eq('user_id', uid)
      const { data: parcelasDB } = await supabase.from('parcelas').select('id,nombre,socio_id').eq('user_id', uid)
      const byDni       = Object.fromEntries((sociosDB||[]).filter(s=>s.dni).map(s=>[normDNI(s.dni), s.id]))
      const byNombre    = Object.fromEntries((sociosDB||[]).map(s=>[normNombre(s.nombre), s.id]))
      const byNombreBag = Object.fromEntries((sociosDB||[]).map(s=>[normNombreBag(s.nombre), s.id]))

      const registros = rows.map((row, i) => {
        if (esFilaResumen(row)) return null  // saltar filas TOTAL, SUBTOTAL, etc.
        const dniRaw   = normDNI(val(row, 'dni_socio'))
        const nomSocio = normNombre(val(row, 'socio_nombre'))
        if (!dniRaw && !nomSocio) return null
        const socio_id = buscarSocio(dniRaw, nomSocio, byDni, byNombre, byNombreBag)
        if (!socio_id) {
          errList.push(`Fila ${i+2}: socio "${dniRaw||nomSocio}" no encontrado`)
          return null
        }
        const kgRaw = parseNum(raw(row, 'kg'))
        if (!kgRaw || kgRaw <= 0) { errList.push(`Fila ${i+2}: kg inválido ("${val(row,'kg')}")`); return null }

        // Campaña: 1) columna explícita del archivo
        //          2) auto-detectada desde la fecha de la fila
        //          3) campaña forzada por el usuario (si no hay fecha)
        //          4) null
        const fechaFila  = parseDate(raw(row, 'fecha'))
        const campAutodet = fechaFila ? campanyaDesdeFecha(fechaFila) : null
        const campNom    = val(row, 'campana') || campAutodet || campanaForzada || null
        const parcelaNom = val(row, 'parcela')
        const parcela    = (parcelasDB||[]).find(p =>
          p.socio_id === socio_id && norm(p.nombre) === norm(parcelaNom))

        // Payload máximo — insertarAdaptativo filtra columnas inexistentes automáticamente
        return {
          user_id:     uid,
          socio_id,
          parcela_id:  parcela?.id || null,
          kg_bruto:    kgRaw,
          kg_neto:     parseNum(raw(row, 'kg')) || null,
          calidad:     normCalidad(val(row, 'calidad')),
          rendimiento: parseNum(raw(row, 'rend_bruto')),
          'campana':   campNom,
          campana:     campNom,
          notas:       val(row, 'observaciones') || null,
          observaciones: val(row, 'observaciones') || null,
          fecha:       parseDate(raw(row, 'fecha')) || null,
          humedad:     parseNum(raw(row, 'humedad')),
          impurezas:   parseNum(raw(row, 'impurezas')),
          punto_ext:   parseNum(raw(row, 'punto_ext')),
        }
      }).filter(Boolean)

      for (let i = 0; i < registros.length; i += 50) {
        const lote = registros.slice(i, i + 50)
        const { ok: n, err } = await insertarAdaptativo(supabase, 'entregas', lote)
        if (err) errList.push(`Lote ${Math.floor(i/50)+1}: ${err}`)
        else ok += n
      }
    }

    setResultado({ ok, total: rows.filter(r => Object.values(r).some(v => String(v).trim())).length, ...extraResultado })
    setErrores(errList)
    setLoading(false)
    setStep(4)
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────

  const BADGES = {
    auto:   { bg: '#f0fdf4', color: '#15803d', border: '#86efac', label: '✓ Auto' },
    medium: { bg: '#eff6ff', color: '#1d4ed8', border: '#93c5fd', label: '~ Similar' },
    low:    { bg: '#fffbeb', color: '#92400e', border: '#fcd34d', label: '! Revisar' },
    empty:  { bg: '#f1f5f9', color: '#94a3b8', border: '#e2e8f0', label: '— Sin mapear' },
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Importar datos</h1>
        <p className="text-gray-500 mt-1">Carga socios, parcelas o entregas desde Excel, CSV o PDF — cualquier formato</p>
      </div>

      {/* Selector tipo */}
      <div className="flex gap-3 mb-6">
        {[{key:'socios',label:'Socios',icon:'👥'},{key:'parcelas',label:'Parcelas',icon:'🌿'},{key:'entregas',label:'Entregas',icon:'📦'}].map(t => (
          <button key={t.key} onClick={() => setTipo(t.key)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border-2 transition-all"
            style={{ borderColor: tipo===t.key?'#0f172a':'#e5e7eb', backgroundColor: tipo===t.key?'#0f172a':'white', color: tipo===t.key?'white':'#374151' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Pasos */}
      <div className="flex items-center gap-2 mb-8 text-xs font-medium">
        {['Subir archivo','Mapear columnas','Vista previa','Resultado'].map((s,i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: step>i+1?'#4ade80':step===i+1?'#0f172a':'#e5e7eb', color: step>i+1?'#0f172a':step===i+1?'white':'#9ca3af' }}>
              {step > i+1 ? '✓' : i+1}
            </div>
            <span style={{ color: step===i+1?'#0f172a':'#9ca3af' }}>{s}</span>
            {i < 3 && <div className="w-8 h-px bg-gray-200"/>}
          </div>
        ))}
      </div>

      {/* PASO 1: Subir */}
      {step === 1 && (
        <div>
          <div
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${dragging?'border-green-400 bg-green-50':'border-gray-200 hover:border-gray-300 bg-white'}`}
            onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)}
            onDrop={handleDrop} onClick={()=>!parseLoading && fileInputRef.current?.click()}>
            {parseLoading ? (
              <div>
                <div className="text-4xl mb-4 animate-pulse">⏳</div>
                <p className="text-gray-600 font-semibold">Analizando archivo…</p>
                <p className="text-gray-400 text-sm mt-1">Detectando columnas y secciones</p>
              </div>
            ) : (
              <div>
                <div className="text-5xl mb-4">📂</div>
                <p className="text-gray-700 font-semibold text-lg">Arrastra tu archivo aquí</p>
                <p className="text-gray-400 text-sm mt-1">o haz clic para seleccionarlo</p>
                <div className="flex gap-2 justify-center mt-4 flex-wrap">
                  {[{ext:'.xlsx',icon:'📊',label:'Excel'},{ext:'.xls',icon:'📊',label:'Excel antiguo'},{ext:'.ods',icon:'📊',label:'ODS'},{ext:'.csv',icon:'📋',label:'CSV'},{ext:'.pdf',icon:'📄',label:'PDF'}].map(f => (
                    <span key={f.ext} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">
                      {f.icon} {f.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.ods,.csv,.pdf" className="hidden"
              onChange={e=>handleFile(e.target.files[0])}/>
          </div>

          {parseError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              ⚠️ {parseError}
            </div>
          )}

          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm font-semibold text-amber-800 mb-1">💡 Funciona con cualquier formato de cooperativa</p>
            <p className="text-xs text-amber-700">
              El sistema detecta automáticamente columnas aunque tengan nombres distintos, faltas de ortografía o estén en otro idioma.
              Si el archivo tiene varias hojas o secciones (socios + parcelas juntos), se muestran como opciones separadas.
            </p>
          </div>

          {/* Plantillas */}
          <div className="mt-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-1">📥 Plantillas de ejemplo</p>
            <p className="text-xs text-gray-400 mb-3">Importa en este orden: primero Socios, luego Parcelas, por último Entregas.</p>
            <div className="flex gap-3 flex-wrap">
              {[{label:'👤 Socios',file:'/plantilla_socios.xlsx'},{label:'🌿 Parcelas',file:'/plantilla_parcelas.xlsx'},{label:'📦 Entregas',file:'/plantilla_entregas.xlsx'}].map(({label,file})=>(
                <a key={file} href={file} download className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                  {label} <span className="text-gray-400 text-xs">.xlsx</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PASO 2: Mapear columnas */}
      {step === 2 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">

          {/* Selector de sección/hoja si hay más de una */}
          {sections.length > 1 && (
            <div className="mb-5">
              <p className="text-sm font-semibold text-gray-700 mb-2">
                📑 Se detectaron <strong>{sections.length}</strong> secciones en el archivo — elige la que corresponde a <em>{tipo}</em>:
              </p>
              <div className="flex flex-wrap gap-2">
                {sections.map((sec, idx) => {
                  const isActive = idx === activeSectionIdx
                  const pct = Math.min(100, Math.round(sec.score / 3))
                  return (
                    <button key={idx} onClick={() => applySection(sections, idx)}
                      className="flex flex-col items-start px-4 py-2.5 rounded-xl border-2 text-left transition-all text-xs"
                      style={{ borderColor: isActive?'#0f172a':'#e5e7eb', backgroundColor: isActive?'#0f172a':'white', color: isActive?'white':'#374151' }}>
                      <span className="font-semibold text-sm">{sec.titleHint || sec.name || `Sección ${idx+1}`}</span>
                      <span className="opacity-70 mt-0.5">{sec.headers.length} cols · {sec.rows.length} filas</span>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <div className="w-16 h-1 rounded-full" style={{ backgroundColor: isActive?'rgba(255,255,255,0.3)':'#e5e7eb' }}>
                          <div className="h-1 rounded-full" style={{ width: `${pct}%`, backgroundColor: isActive?'#4ade80':'#0f172a' }}/>
                        </div>
                        <span className="opacity-60">{pct}% relevante</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <h2 className="font-semibold text-gray-800 mb-1">Mapear columnas</h2>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">
              <strong>{rows.length} filas</strong> · <strong>{headers.length} columnas</strong> detectadas.
            </p>
            {/* Barra de confianza global */}
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-2 rounded-full transition-all"
                  style={{ width: `${confScore}%`, backgroundColor: confScore>=70?'#4ade80':confScore>=40?'#fbbf24':'#f87171' }}/>
              </div>
              <span className="text-xs text-gray-500">{confScore}% auto</span>
            </div>
          </div>

          {/* Leyenda de badges */}
          <div className="flex gap-2 mb-5 flex-wrap text-xs">
            {Object.entries(BADGES).map(([k,b]) => (
              <span key={k} style={{background:b.bg,color:b.color,border:`1px solid ${b.border}`,padding:'2px 8px',borderRadius:99}}>
                {b.label}
              </span>
            ))}
          </div>

          {/* Campos mapeados */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map(field => {
              const conf = confidence[field.key] || 'empty'
              const b = BADGES[conf]
              const sampleVal = mapping[field.key] && rows[0] ? String(rows[0][mapping[field.key]] ?? '') : ''
              return (
                <div key={field.key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700">
                      {field.label}{field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <span style={{background:b.bg,color:b.color,border:`1px solid ${b.border}`,fontSize:10,padding:'1px 6px',borderRadius:99}}>{b.label}</span>
                  </div>
                  <select value={mapping[field.key]||''} onChange={e=>setMapping({...mapping,[field.key]:e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    style={{borderColor: conf==='low'?'#fcd34d':conf==='empty'&&field.required?'#fca5a5':'#e5e7eb'}}>
                    <option value="">— No importar —</option>
                    {headers.map(h => {
                      const rel = columnRelevanceScore(h, [field])
                      return (
                        <option key={h} value={h}>
                          {rel >= 60 ? '★ ' : rel >= 30 ? '· ' : ''}{h}
                        </option>
                      )
                    })}
                  </select>
                  {sampleVal && <p className="text-xs text-gray-400 mt-1 truncate">Ej: {sampleVal}</p>}
                </div>
              )
            })}
          </div>

          {/* Columnas no mapeadas (info) */}
          {unmappedHeaders.length > 0 && (
            <div className="mt-5">
              <button onClick={() => setShowIrrelevant(!showIrrelevant)}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                {showIrrelevant ? '▾' : '▸'} {unmappedHeaders.length} columna{unmappedHeaders.length !== 1 ? 's' : ''} del archivo no se importará{unmappedHeaders.length !== 1 ? 'n' : ''} (no relevante{unmappedHeaders.length !== 1 ? 's' : ''} para {tipo})
              </button>
              {showIrrelevant && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {unmappedHeaders.map(h => (
                    <span key={h} className="px-2 py-0.5 bg-gray-50 border border-gray-200 rounded text-xs text-gray-400 line-through">{h}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bloque campaña para entregas */}
          {tipo === 'entregas' && !mapping['campana'] && (() => {
            const tieneFecha = !!mapping['fecha']
            if (tieneFecha) {
              // Hay fechas → auto-detección automática, solo informamos
              return (
                <div className="mt-5 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <p className="text-sm font-semibold text-green-800 mb-1">
                    ✅ Campaña se detectará automáticamente desde las fechas
                  </p>
                  <p className="text-xs text-green-700">
                    Cada entrega recibirá su campaña según su fecha: oct–dic de un año → campaña de ese año,
                    ene–sep → campaña del año anterior. Por ejemplo, una entrega del 15/11/2024 → <strong>2024/2025</strong>.
                  </p>
                </div>
              )
            } else {
              // Sin fecha ni campaña → preguntar obligatoriamente
              return (
                <div className="mt-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm font-semibold text-amber-800 mb-1">
                    ⚠️ Sin fecha ni campaña detectada — ¿a qué campaña pertenecen estas entregas?
                  </p>
                  <p className="text-xs text-amber-700 mb-3">
                    El archivo no tiene columna de fecha ni de campaña. Para que las entregas aparezcan
                    en la auto-liquidación necesitas indicar la campaña manualmente.
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      placeholder="Ej: 2024/2025"
                      value={campanaForzada}
                      onChange={e => setCampanaForzada(e.target.value)}
                      className="border border-amber-300 rounded-lg p-2 text-sm text-gray-900 bg-white w-44"
                    />
                    {campanaForzada
                      ? <span className="text-xs text-green-700 font-medium">✓ Se asignará "{campanaForzada}" a todas las entregas</span>
                      : <span className="text-xs text-red-600 font-medium">Obligatorio para poder liquidar</span>
                    }
                  </div>
                </div>
              )
            }
          })()}

          <div className="flex gap-3 mt-6">
            <button onClick={resetear} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">← Volver</button>
            <button onClick={generarPreview} className="px-6 py-2 rounded-lg text-white text-sm font-medium" style={{backgroundColor:'#0f172a'}}>
              Ver vista previa →
            </button>
          </div>
        </div>
      )}

      {/* PASO 3: Vista previa */}
      {step === 3 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-1">Vista previa</h2>
          <p className="text-sm text-gray-500 mb-5">Primeras 5 filas de <strong>{rows.length}</strong> total. Confirma que los datos son correctos.</p>
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>{fields.filter(f=>mapping[f.key]).map(f=><th key={f.key} className="text-left px-4 py-3">{f.label}</th>)}</tr>
              </thead>
              <tbody>
                {preview.map((row,i)=>(
                  <tr key={i} className="border-t border-gray-50">
                    {fields.filter(f=>mapping[f.key]).map(f=>(
                      <td key={f.key} className="px-4 py-2.5 text-gray-700 max-w-[180px] truncate">{String(row[f.key]||'—')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(tipo==='entregas'||tipo==='parcelas') && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700">
              💡 Los socios se identifican por DNI (preferido) o por nombre. Asegúrate de haber importado los socios primero.
            </div>
          )}
          <div className="flex gap-3 mt-6">
            <button onClick={()=>setStep(2)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">← Volver</button>
            <button onClick={importar} disabled={loading} className="px-6 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50" style={{backgroundColor:'#0f172a'}}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Importando…
                </span>
              ) : `Importar ${rows.length} registros`}
            </button>
          </div>
        </div>
      )}

      {/* PASO 4: Resultado */}
      {step === 4 && resultado && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="text-5xl mb-4">{resultado.ok === resultado.total && !resultado.saltados ? '✅' : resultado.ok > 0 || resultado.saltados > 0 ? '⚠️' : '❌'}</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{resultado.ok} nuevos importados</h2>
          <p className="text-gray-500 text-sm mb-4">
            {resultado.saltados > 0
              ? `${resultado.saltados} socio${resultado.saltados>1?'s':''} ya existía${resultado.saltados>1?'n':''} y ${resultado.saltados>1?'fueron omitidos':'fue omitido'}.`
              : resultado.ok === resultado.total ? 'Importación completada sin errores.' : `${resultado.total - resultado.ok} filas fueron omitidas.`}
          </p>

          {/* Avisos de conflicto de datos */}
          {resultado.avisos?.length > 0 && (
            <div className="text-left mb-5 max-h-52 overflow-y-auto bg-amber-50 rounded-xl p-4 border border-amber-200">
              <p className="text-sm font-semibold text-amber-800 mb-2">⚠️ {resultado.avisos.length} socio{resultado.avisos.length>1?'s':''} con datos distintos (no se han actualizado):</p>
              {resultado.avisos.map((a,i)=><p key={i} className="text-xs text-amber-700 py-0.5">{a}</p>)}
              <p className="text-xs text-amber-500 mt-2">Edita cada socio manualmente si quieres actualizar sus datos.</p>
            </div>
          )}

          {errores.length > 0 && (
            <div className="text-left mb-6 max-h-52 overflow-y-auto bg-red-50 rounded-xl p-4 border border-red-100">
              <p className="text-sm font-semibold text-red-700 mb-2">Filas omitidas ({errores.length}):</p>
              {errores.slice(0, 50).map((e,i)=><p key={i} className="text-xs text-red-600 py-0.5">{e}</p>)}
              {errores.length > 50 && <p className="text-xs text-red-400 mt-1">… y {errores.length-50} más</p>}
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <button onClick={resetear} className="px-5 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">Importar otro archivo</button>
            <a href={`/${tipo==='entregas'?'entregas':tipo==='parcelas'?'parcelas':'socios'}`}
              className="px-5 py-2 rounded-lg text-white text-sm font-medium" style={{backgroundColor:'#0f172a'}}>
              Ver {tipo} →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
