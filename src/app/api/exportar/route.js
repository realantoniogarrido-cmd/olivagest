import { spawn } from 'child_process'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getUserId(request) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return null
  const adminClient = getAdminClient()
  const { data: { user } } = await adminClient.auth.getUser(token)
  return user?.id || null
}

function runPython(payload) {
  // En Windows el ejecutable es 'python', en Linux/Mac es 'python3'
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'generar_excel.py')
    const proc = spawn(pythonCmd, [scriptPath])
    const chunks = []
    const errChunks = []
    proc.stdout.on('data', d => chunks.push(d))
    proc.stderr.on('data', d => { errChunks.push(d); console.error('python stderr:', d.toString()) })
    proc.on('close', code => {
      if (code !== 0) {
        const errMsg = Buffer.concat(errChunks).toString().slice(0, 300)
        reject(new Error(`Python error (${code}): ${errMsg}`))
      } else {
        resolve(Buffer.concat(chunks))
      }
    })
    proc.on('error', err => reject(new Error(`No se pudo iniciar Python: ${err.message}. Asegúrate de tener Python instalado.`)))
    proc.stdin.write(JSON.stringify(payload))
    proc.stdin.end()
  })
}

export async function POST(request) {
  try {
    const userId = await getUserId(request)
    if (!userId) return Response.json({ error: 'No autorizado' }, { status: 401 })

    const { tipo, filtroCampaña } = await request.json()
    const db = getAdminClient()

    let hoja, columnas, filas, nombreArchivo

    // ── SOCIOS ──────────────────────────────────────────────────────
    if (tipo === 'socios') {
      const { data } = await db.from('socios').select('*').eq('user_id', userId).order('nombre')
      hoja = 'Socios'
      nombreArchivo = 'socios_olivagest'
      columnas = [
        { key: 'nombre',           label: 'Nombre completo',    min_w: 22 },
        { key: 'dni',              label: 'DNI / NIF',           min_w: 12 },
        { key: 'telefono',         label: 'Teléfono',            min_w: 13 },
        { key: 'email',            label: 'Email',               min_w: 22 },
        { key: 'municipio',        label: 'Municipio',           min_w: 15 },
        { key: 'direccion',        label: 'Dirección',           min_w: 25 },
        { key: 'numero_socio',     label: 'Nº socio',            min_w: 10 },
        { key: 'cuenta_bancaria',  label: 'Cuenta bancaria',     min_w: 24 },
        { key: 'portal_activo',    label: 'Portal activo',       min_w: 12 },
      ]
      filas = (data || []).map(s => ({
        nombre:          s.nombre || '',
        dni:             s.dni || '',
        telefono:        s.telefono || '',
        email:           s.email || '',
        municipio:       s.municipio || '',
        direccion:       s.direccion || '',
        numero_socio:    s.numero_socio || '',
        cuenta_bancaria: s.cuenta_bancaria || '',
        portal_activo:   s.portal_activo ? 'Sí' : 'No',
      }))
    }

    // ── ENTREGAS ────────────────────────────────────────────────────
    else if (tipo === 'entregas') {
      let q = db.from('entregas')
        .select('*, socios(nombre), parcelas(nombre, municipio)')
        .eq('user_id', userId)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
      if (filtroCampaña) q = q.eq('campana', filtroCampaña)
      const { data } = await q
      hoja = 'Entregas'
      nombreArchivo = filtroCampaña ? `entregas_${filtroCampaña}` : 'entregas_olivagest'
      columnas = [
        { key: 'socio',              label: 'Socio',               min_w: 22 },
        { key: 'campana',            label: 'Campaña',             min_w: 10 },
        { key: 'fecha',              label: 'Fecha',               min_w: 12, align: 'center' },
        { key: 'parcela',            label: 'Parcela',             min_w: 18 },
        { key: 'municipio',          label: 'Municipio',           min_w: 14 },
        { key: 'kg_bruto',           label: 'Kg bruto',            min_w: 10, tipo: 'kg', align: 'right', suma: true },
        { key: 'kg_neto',            label: 'Kg neto',             min_w: 10, tipo: 'kg', align: 'right', suma: true },
        { key: 'rendimiento_bruto',  label: 'Rend. bruto (%)',     min_w: 14, tipo: 'pct', align: 'right' },
        { key: 'rendimiento_neto',   label: 'Rend. neto (%)',      min_w: 13, tipo: 'pct', align: 'right' },
        { key: 'calidad',            label: 'Calidad',             min_w: 10, align: 'center' },
        { key: 'punto_extraccion',   label: 'Punto extracción',    min_w: 16 },
        { key: 'notas',              label: 'Notas',               min_w: 18 },
      ]
      filas = (data || []).map(e => ({
        socio:             e.socios?.nombre || '',
        campana:           e.campana || '',
        fecha:             e.fecha ? new Date(e.fecha).toLocaleDateString('es-ES') : (e.created_at ? new Date(e.created_at).toLocaleDateString('es-ES') : ''),
        parcela:           e.parcelas?.nombre || '',
        municipio:         e.parcelas?.municipio || '',
        kg_bruto:          e.kg_bruto ?? e.kg ?? '',
        kg_neto:           e.kg_neto ?? '',
        rendimiento_bruto: e.rendimiento_bruto ?? e.rendimiento ?? '',
        rendimiento_neto:  e.rendimiento_neto ?? '',
        calidad:           e.calidad || '',
        punto_extraccion:  e.punto_extraccion || '',
        notas:             e.notas || '',
      }))
    }

    // ── LIQUIDACIONES ────────────────────────────────────────────────
    else if (tipo === 'liquidaciones') {
      let q = db.from('liquidaciones')
        .select('*, socios(nombre)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (filtroCampaña) q = q.eq('campana', filtroCampaña)
      const { data } = await q
      hoja = 'Liquidaciones'
      nombreArchivo = filtroCampaña ? `liquidaciones_${filtroCampaña}` : 'liquidaciones_olivagest'
      columnas = [
        { key: 'socio',              label: 'Socio',               min_w: 22 },
        { key: 'campana',            label: 'Campaña',             min_w: 10 },
        { key: 'estado',             label: 'Estado',              min_w: 14, align: 'center' },
        { key: 'kg_totales',         label: 'Kg aceituna',         min_w: 12, tipo: 'kg',   align: 'right', suma: true },
        { key: 'kg_aceite_final',    label: 'Kg aceite final',     min_w: 14, tipo: 'kg',   align: 'right', suma: true },
        { key: 'rendimiento_bruto',  label: 'Rend. bruto (%)',     min_w: 14, tipo: 'pct',  align: 'right' },
        { key: 'rendimiento_neto',   label: 'Rend. neto (%)',      min_w: 13, tipo: 'pct',  align: 'right' },
        { key: 'punto_extraccion',   label: 'Punto extracción',    min_w: 16 },
        { key: 'precio_kg',          label: 'Precio €/kg',         min_w: 11, tipo: 'euro', align: 'right' },
        { key: 'importe_total',      label: 'Importe total (€)',   min_w: 16, tipo: 'euro', align: 'right', suma: true },
        { key: 'fecha_pago',         label: 'Fecha pago',          min_w: 12, align: 'center' },
      ]
      const estadoLabel = { borrador: 'En preparación', pendiente_pago: 'Pdte. pago', pagada: 'Pagada' }
      filas = (data || []).map(l => ({
        socio:             l.socios?.nombre || '',
        campana:           l.campana || '',
        estado:            estadoLabel[l.estado] || l.estado || '',
        kg_totales:        l.kg_totales ?? '',
        kg_aceite_final:   l.kg_aceite_final ?? '',
        rendimiento_bruto: l.rendimiento_bruto ?? '',
        rendimiento_neto:  l.rendimiento_neto ?? '',
        punto_extraccion:  l.punto_extraccion || '',
        precio_kg:         l.precio_kg ?? '',
        importe_total:     l.importe_total ?? '',
        fecha_pago:        l.fecha_pago ? new Date(l.fecha_pago).toLocaleDateString('es-ES') : '',
      }))
    }

    // ── PARCELAS ────────────────────────────────────────────────────
    else if (tipo === 'parcelas') {
      const { data } = await db.from('parcelas')
        .select('*, socios(nombre)')
        .eq('user_id', userId)
        .order('nombre')
      hoja = 'Parcelas'
      nombreArchivo = 'parcelas_olivagest'
      columnas = [
        { key: 'socio',               label: 'Socio',                min_w: 22 },
        { key: 'nombre',              label: 'Nombre parcela',       min_w: 18 },
        { key: 'municipio',           label: 'Municipio',            min_w: 15 },
        { key: 'variedad',            label: 'Variedad',             min_w: 14 },
        { key: 'superficie',          label: 'Superficie (ha)',      min_w: 14, tipo: 'numero', formato: '0.00', align: 'right' },
        { key: 'referencia_catastral',label: 'Ref. catastral',       min_w: 20 },
        { key: 'poligono',            label: 'Polígono',             min_w: 10 },
        { key: 'parcela_num',         label: 'Nº parcela',           min_w: 10 },
        { key: 'notas',               label: 'Notas',                min_w: 18 },
      ]
      filas = (data || []).map(p => ({
        socio:               p.socios?.nombre || '',
        nombre:              p.nombre || '',
        municipio:           p.municipio || '',
        variedad:            p.variedad || '',
        superficie:          p.superficie ?? p.superficie_ha ?? '',
        referencia_catastral:p.referencia_catastral || '',
        poligono:            p.poligono || '',
        parcela_num:         p.parcela_num || p.numero_parcela || '',
        notas:               p.notas || '',
      }))
    }

    else {
      return Response.json({ error: 'Tipo desconocido' }, { status: 400 })
    }

    if (!filas.length) {
      return Response.json({ error: 'Sin datos para exportar' }, { status: 404 })
    }

    const excelBuffer = await runPython({ tipo, hoja, columnas, filas })
    const fecha = new Date().toISOString().slice(0, 10)

    return new Response(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nombreArchivo}_${fecha}.xlsx"`,
      },
    })
  } catch (e) {
    console.error('exportar error:', e)
    return Response.json({ error: e.message }, { status: 500 })
  }
}
