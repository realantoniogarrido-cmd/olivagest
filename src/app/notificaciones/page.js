'use client'
import { useState, useEffect } from 'react'
import { supabase, getUserId } from '@/lib/supabase'

const TIPOS_AVISO = [
  { value: 'reunion',    label: 'Reunión' },
  { value: 'pago',       label: 'Pago / Liquidación' },
  { value: 'campaña',    label: 'Campaña' },
  { value: 'documento',  label: 'Documento' },
  { value: 'general',    label: 'Aviso general' },
]

export default function NotificacionesPage() {
  const [notificaciones, setNotificaciones] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filtro, setFiltro]     = useState('todas')
  const [socios, setSocios]     = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado]   = useState('')

  const [form, setForm] = useState({
    titulo:      '',
    mensaje:     '',
    tipo:        'general',
    destinatarios: 'todos',   // 'todos' | 'seleccion'
    seleccion:   [],          // array de socio.id
  })

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setLoading(true)
    const userId = await getUserId()
    const [
      { data: sociosData },
      { data: entregas },
      { data: liquidaciones },
      { data: campanyas },
      docRes,
    ] = await Promise.all([
      supabase.from('socios').select('*').eq('user_id', userId).order('nombre'),
      supabase.from('entregas').select('*, socios(nombre)').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('liquidaciones').select('*, socios(nombre)').eq('user_id', userId),
      supabase.from('campanyas').select('*').eq('user_id', userId),
      supabase.from('notificaciones').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
    ])

    setSocios(sociosData || [])

    const alertas = []
    const ahora = new Date()

    // Pendientes de liquidar
    const sociosConEntregas  = new Set((entregas || []).map(e => e.socio_id))
    const sociosLiquidados   = new Set((liquidaciones || []).map(l => l.socio_id))
    for (const socio of sociosData || []) {
      if (sociosConEntregas.has(socio.id) && !sociosLiquidados.has(socio.id)) {
        alertas.push({ id: `liq-${socio.id}`, tipo: 'urgente', titulo: 'Socio pendiente de liquidar', mensaje: `${socio.nombre} tiene entregas registradas pero aún no ha sido liquidado.`, fecha: ahora, accionLabel: 'Ir a Liquidaciones', accionHref: '/liquidaciones' })
      }
    }

    // Entregas recientes
    const hace3dias = new Date(ahora - 3 * 24 * 60 * 60 * 1000)
    const entregasRecientes = (entregas || []).filter(e => new Date(e.created_at) > hace3dias)
    if (entregasRecientes.length > 0) {
      alertas.push({ id: 'entregas-recientes', tipo: 'info', titulo: 'Entregas recientes', mensaje: `Se han registrado ${entregasRecientes.length} entrega${entregasRecientes.length > 1 ? 's' : ''} en los últimos 3 días.`, fecha: new Date(entregasRecientes[0].created_at), accionLabel: 'Ver entregas', accionHref: '/entregas' })
    }

    // Campaña próxima a cerrar
    for (const c of campanyas || []) {
      if (c.estado === 'activa' && c.fecha_fin) {
        const dias = Math.ceil((new Date(c.fecha_fin) - ahora) / (1000 * 60 * 60 * 24))
        if (dias >= 0 && dias <= 15) {
          alertas.push({ id: `camp-${c.id}`, tipo: 'urgente', titulo: 'Campaña próxima a cerrar', mensaje: `La campaña "${c.nombre}" cierra en ${dias} día${dias !== 1 ? 's' : ''}. Revisa si quedan socios por liquidar.`, fecha: ahora, accionLabel: 'Ver campaña', accionHref: '/admin' })
        }
      }
    }

    // Socios sin entregas
    const campanyaActiva = (campanyas || []).find(c => c.estado === 'activa')
    if (campanyaActiva && (sociosData || []).length > 0) {
      const enCampaña = new Set((entregas || []).filter(e => e.campana === campanyaActiva.nombre).map(e => e.socio_id))
      const sin = (sociosData || []).filter(s => !enCampaña.has(s.id))
      if (sin.length > 0) {
        alertas.push({ id: 'sin-entregas', tipo: 'advertencia', titulo: 'Socios sin entregas esta campaña', mensaje: `${sin.length} socio${sin.length > 1 ? 's no han' : ' no ha'} registrado entregas en "${campanyaActiva.nombre}".`, fecha: ahora, accionLabel: 'Ver socios', accionHref: '/socios' })
      }
    }

    // Sin campaña activa
    const hayActiva = (campanyas || []).some(c => c.estado === 'activa')
    if (!hayActiva && (campanyas || []).length > 0) {
      alertas.push({ id: 'sin-activa', tipo: 'advertencia', titulo: 'No hay campaña activa', mensaje: 'No tienes ninguna campaña marcada como activa. Actívala desde Administración.', fecha: ahora, accionLabel: 'Ir a Administración', accionHref: '/admin' })
    }

    if ((sociosData || []).length === 0) {
      alertas.push({ id: 'bienvenida', tipo: 'info', titulo: '¡Bienvenido a OlivaGest!', mensaje: 'Empieza registrando los socios de tu cooperativa.', fecha: ahora, accionLabel: 'Añadir socios', accionHref: '/socios' })
    }

    // Notificaciones reales (documentos de socios + avisos enviados)
    for (const n of docRes.data || []) {
      alertas.unshift({
        id:    `db-${n.id}`,
        tipo:  n.tipo || 'documento',
        titulo: n.titulo,
        mensaje: n.mensaje,
        fecha:  new Date(n.created_at),
        leida:  n.leida,
        accionLabel: n.metadata?.socio_id ? 'Ver ficha del socio' : null,
        accionHref:  n.metadata?.socio_id ? `/socios/${n.metadata.socio_id}` : null,
      })
    }

    setNotificaciones(alertas)
    setLoading(false)
  }

  async function handleEnviarAviso() {
    if (!form.titulo.trim() || !form.mensaje.trim()) return
    setEnviando(true)
    const userId = await getUserId()
    const adminClient = supabase // client-side, RLS permitirá al admin insertar en avisos

    // Determinar socios destinatarios
    let destinatariosIds = []
    if (form.destinatarios === 'todos') {
      destinatariosIds = socios.map(s => s.id)
    } else {
      destinatariosIds = form.seleccion
    }

    if (destinatariosIds.length === 0) {
      setEnviando(false)
      return
    }

    // Insertar un aviso por cada socio
    const rows = destinatariosIds.map(socio_id => ({
      user_id:  userId,
      socio_id,
      tipo:     form.tipo,
      titulo:   form.titulo.trim(),
      mensaje:  form.mensaje.trim(),
      leida:    false,
    }))

    await adminClient.from('avisos').insert(rows)

    const total = destinatariosIds.length
    setEnviado(`Aviso enviado a ${total} socio${total !== 1 ? 's' : ''}`)
    setTimeout(() => setEnviado(''), 4000)
    setModalOpen(false)
    setForm({ titulo: '', mensaje: '', tipo: 'general', destinatarios: 'todos', seleccion: [] })
    setEnviando(false)
  }

  function toggleSocio(id) {
    setForm(f => ({
      ...f,
      seleccion: f.seleccion.includes(id)
        ? f.seleccion.filter(x => x !== id)
        : [...f.seleccion, id],
    }))
  }

  const config = {
    urgente:    { bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-100 text-red-700',    label: 'Urgente',    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> },
    advertencia:{ bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', label: 'Aviso',  icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    info:       { bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700',   label: 'Info',     icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    documento:  { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', label: 'Documento', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
    reunion:    { bg: 'bg-green-50',  border: 'border-green-200',  badge: 'bg-green-100 text-green-700',  label: 'Reunión',  icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
    pago:       { bg: 'bg-emerald-50',border: 'border-emerald-200',badge: 'bg-emerald-100 text-emerald-700', label: 'Pago', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    general:    { bg: 'bg-slate-50',  border: 'border-slate-200',  badge: 'bg-slate-100 text-slate-700',  label: 'General',  icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.437L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg> },
    campaña:    { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', label: 'Campaña', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
    consulta:   { bg: 'bg-violet-50', border: 'border-violet-200', badge: 'bg-violet-100 text-violet-700', label: 'Consulta socio', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg> },
    entrega:    { bg: 'bg-violet-50', border: 'border-violet-200', badge: 'bg-violet-100 text-violet-700', label: 'Consulta socio', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg> },
  }

  const filtradas  = filtro === 'todas' ? notificaciones : notificaciones.filter(n => n.tipo === filtro)
  const contadores = {
    urgente:     notificaciones.filter(n => n.tipo === 'urgente').length,
    advertencia: notificaciones.filter(n => n.tipo === 'advertencia').length,
    info:        notificaciones.filter(n => n.tipo === 'info').length,
    documento:   notificaciones.filter(n => n.tipo === 'documento').length,
    consulta:    notificaciones.filter(n => ['consulta','entrega'].includes(n.tipo)).length,
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
          <p className="text-gray-500 mt-1">Alertas y comunicados a socios</p>
        </div>
        <div className="flex gap-2">
          <button onClick={cargarTodo}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Actualizar
          </button>
          <button onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: '#0f172a' }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nueva notificación
          </button>
        </div>
      </div>

      {/* Feedback envío */}
      {enviado && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium">
          {enviado}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Urgentes',    count: contadores.urgente,    color: 'text-red-600',    border: 'border-red-100' },
          { label: 'Avisos',      count: contadores.advertencia, color: 'text-yellow-600', border: 'border-yellow-100' },
          { label: 'Informativas',count: contadores.info,       color: 'text-blue-600',   border: 'border-blue-100' },
          { label: 'Documentos',  count: contadores.documento,  color: 'text-purple-600', border: 'border-purple-100' },
          { label: 'Consultas',   count: contadores.consulta,   color: 'text-violet-600', border: 'border-violet-100' },
        ].map(k => (
          <div key={k.label} className={`bg-white border ${k.border} rounded-xl p-4 text-center shadow-sm`}>
            <p className={`text-2xl font-bold ${k.color}`}>{k.count}</p>
            <p className="text-xs text-gray-500 mt-1 font-medium uppercase tracking-wide">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: 'todas',       label: `Todas (${notificaciones.length})` },
          { key: 'urgente',     label: 'Urgentes' },
          { key: 'advertencia', label: 'Avisos' },
          { key: 'info',        label: 'Info' },
          { key: 'documento',   label: 'Documentos' },
          { key: 'consulta',    label: 'Consultas' },
        ].map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
            style={{
              backgroundColor: filtro === f.key ? '#0f172a' : 'white',
              color: filtro === f.key ? 'white' : '#6b7280',
              borderColor: filtro === f.key ? '#0f172a' : '#e5e7eb',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin mx-auto mb-3" />
          Cargando…
        </div>
      ) : filtradas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-16 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p className="text-gray-700 font-medium">Todo en orden</p>
          <p className="text-gray-400 text-sm mt-1">No hay alertas en esta categoría</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map(n => {
            const c = config[n.tipo] || config.general
            return (
              <div key={n.id} className={`border rounded-xl p-4 ${c.bg} ${c.border} ${n.leida === false ? 'ring-1 ring-purple-200' : ''}`}>
                <div className="flex gap-3 items-start">
                  <div className="mt-0.5 flex-shrink-0">{c.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.badge}`}>{c.label}</span>
                      {n.leida === false && (
                        <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full font-semibold">Nuevo</span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">{n.titulo}</p>
                    <p className="text-gray-600 text-sm mt-0.5">{n.mensaje}</p>
                    {n.accionLabel && (
                      <a href={n.accionHref} className="inline-block mt-2 text-xs font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900">
                        {n.accionLabel} →
                      </a>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
                    {n.fecha instanceof Date && !isNaN(n.fecha)
                      ? n.fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) + ' ' + n.fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── MODAL NUEVA NOTIFICACIÓN ─────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Nueva notificación</h2>
                <p className="text-xs text-gray-400 mt-0.5">Se mostrará en el portal de los socios seleccionados</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {/* Tipo */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Tipo</label>
                <div className="flex flex-wrap gap-2">
                  {TIPOS_AVISO.map(t => (
                    <button key={t.value} onClick={() => setForm(f => ({ ...f, tipo: t.value }))}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                      style={{
                        backgroundColor: form.tipo === t.value ? '#0f172a' : '#f8fafc',
                        color: form.tipo === t.value ? 'white' : '#1e293b',
                        borderColor: form.tipo === t.value ? '#0f172a' : '#cbd5e1',
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Título */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Asunto</label>
                <input
                  value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ej: Convocatoria Asamblea General"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-500 placeholder-gray-400"
                />
              </div>

              {/* Mensaje */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Mensaje</label>
                <textarea
                  value={form.mensaje}
                  onChange={e => setForm(f => ({ ...f, mensaje: e.target.value }))}
                  placeholder="Escribe el contenido de la notificación…"
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-500 resize-none placeholder-gray-400"
                />
              </div>

              {/* Destinatarios */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Destinatarios</label>
                <div className="flex gap-2 mb-3">
                  <button onClick={() => setForm(f => ({ ...f, destinatarios: 'todos', seleccion: [] }))}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                    style={{ backgroundColor: form.destinatarios === 'todos' ? '#0f172a' : '#f8fafc', color: form.destinatarios === 'todos' ? 'white' : '#1e293b', borderColor: form.destinatarios === 'todos' ? '#0f172a' : '#cbd5e1' }}>
                    Todos los socios ({socios.length})
                  </button>
                  <button onClick={() => setForm(f => ({ ...f, destinatarios: 'seleccion' }))}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                    style={{ backgroundColor: form.destinatarios === 'seleccion' ? '#0f172a' : '#f8fafc', color: form.destinatarios === 'seleccion' ? 'white' : '#1e293b', borderColor: form.destinatarios === 'seleccion' ? '#0f172a' : '#cbd5e1' }}>
                    Elegir socios
                  </button>
                </div>

                {/* Listado de socios para seleccionar */}
                {form.destinatarios === 'seleccion' && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {socios.length === 0 ? (
                      <p className="p-4 text-sm text-gray-400 text-center">No hay socios registrados</p>
                    ) : (
                      socios.map(s => (
                        <label key={s.id}
                          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${form.seleccion.includes(s.id) ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
                          <input
                            type="checkbox"
                            checked={form.seleccion.includes(s.id)}
                            onChange={() => toggleSocio(s.id)}
                            className="rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{s.nombre}</p>
                            {s.email && <p className="text-xs text-gray-400 truncate">{s.email}</p>}
                          </div>
                          {form.seleccion.includes(s.id) && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#4a7a1e] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          )}
                        </label>
                      ))
                    )}
                  </div>
                )}

                {form.destinatarios === 'seleccion' && form.seleccion.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2 font-medium">
                    {form.seleccion.length} socio{form.seleccion.length !== 1 ? 's' : ''} seleccionado{form.seleccion.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700">
                Cancelar
              </button>
              <button
                onClick={handleEnviarAviso}
                disabled={enviando || !form.titulo.trim() || !form.mensaje.trim() || (form.destinatarios === 'seleccion' && form.seleccion.length === 0)}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
                style={{ backgroundColor: '#0f172a' }}>
                {enviando ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando…</>
                ) : (
                  <><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg> Enviar notificación</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
