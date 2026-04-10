'use client'
import { useState, useEffect } from 'react'
import { supabase, getUserId } from '@/lib/supabase'

export default function NotificacionesPage() {
  const [notificaciones, setNotificaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todas')

  useEffect(() => { generarNotificaciones() }, [])

  async function generarNotificaciones() {
    setLoading(true)
    const userId = await getUserId()
    const [{ data: socios }, { data: entregas }, { data: liquidaciones }, { data: campanyas }, { data: notisDocs }] = await Promise.all([
      supabase.from('socios').select('*').eq('user_id', userId),
      supabase.from('entregas').select('*, socios(nombre)').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('liquidaciones').select('*, socios(nombre)').eq('user_id', userId),
      supabase.from('campanyas').select('*').eq('user_id', userId),
      supabase.from('notificaciones').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20).catch(() => ({ data: [] })),
    ])

    const alertas = []
    const ahora = new Date()

    const sociosConEntregas = new Set((entregas || []).map(e => e.socio_id))
    const sociosLiquidados = new Set((liquidaciones || []).map(l => l.socio_id))
    for (const socio of socios || []) {
      if (sociosConEntregas.has(socio.id) && !sociosLiquidados.has(socio.id)) {
        alertas.push({ id: `liq-${socio.id}`, tipo: 'urgente', titulo: 'Socio pendiente de liquidar', mensaje: `${socio.nombre} tiene entregas registradas pero aún no ha sido liquidado.`, fecha: ahora, accionLabel: 'Ir a Liquidaciones', accionHref: '/liquidaciones' })
      }
    }

    const hace3dias = new Date(ahora - 3 * 24 * 60 * 60 * 1000)
    const entregasRecientes = (entregas || []).filter(e => new Date(e.created_at) > hace3dias)
    if (entregasRecientes.length > 0) {
      alertas.push({ id: 'entregas-recientes', tipo: 'info', titulo: 'Entregas recientes', mensaje: `Se han registrado ${entregasRecientes.length} entrega${entregasRecientes.length > 1 ? 's' : ''} en los últimos 3 días.`, fecha: new Date(entregasRecientes[0].created_at), accionLabel: 'Ver entregas', accionHref: '/entregas' })
    }

    for (const c of campanyas || []) {
      if (c.estado === 'activa' && c.fecha_fin) {
        const diasRestantes = Math.ceil((new Date(c.fecha_fin) - ahora) / (1000 * 60 * 60 * 24))
        if (diasRestantes >= 0 && diasRestantes <= 15) {
          alertas.push({ id: `camp-${c.id}`, tipo: 'urgente', titulo: 'Campaña próxima a cerrar', mensaje: `La campaña "${c.nombre}" cierra en ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}. Revisa si quedan socios por liquidar.`, fecha: ahora, accionLabel: 'Ver campaña', accionHref: '/admin' })
        }
      }
    }

    const campanyaActiva = (campanyas || []).find(c => c.estado === 'activa')
    if (campanyaActiva && socios?.length > 0) {
      const entregasCampaña = (entregas || []).filter(e => e.campana === campanyaActiva.nombre)
      const sociosConEntregaCampaña = new Set(entregasCampaña.map(e => e.socio_id))
      const sinEntregas = (socios || []).filter(s => !sociosConEntregaCampaña.has(s.id))
      if (sinEntregas.length > 0) {
        alertas.push({ id: 'sin-entregas', tipo: 'advertencia', titulo: 'Socios sin entregas esta campaña', mensaje: `${sinEntregas.length} socio${sinEntregas.length > 1 ? 's no han' : ' no ha'} registrado entregas en "${campanyaActiva.nombre}".`, fecha: ahora, accionLabel: 'Ver socios', accionHref: '/socios' })
      }
    }

    const hayActiva = (campanyas || []).some(c => c.estado === 'activa')
    if (!hayActiva && (campanyas || []).length > 0) {
      alertas.push({ id: 'sin-activa', tipo: 'advertencia', titulo: 'No hay campaña activa', mensaje: 'No tienes ninguna campaña marcada como activa. Actívala desde Administración.', fecha: ahora, accionLabel: 'Ir a Administración', accionHref: '/admin' })
    }

    if ((socios || []).length === 0) {
      alertas.push({ id: 'bienvenida', tipo: 'info', titulo: '¡Bienvenido a OlivaGest!', mensaje: 'Empieza registrando los socios de tu cooperativa.', fecha: ahora, accionLabel: 'Añadir socios', accionHref: '/socios' })
    }

    // Notificaciones reales de documentos subidos por socios
    for (const n of notisDocs || []) {
      alertas.unshift({
        id: `doc-${n.id}`,
        tipo: 'documento',
        titulo: n.titulo,
        mensaje: n.mensaje,
        fecha: new Date(n.created_at),
        leida: n.leida,
        accionLabel: 'Ver ficha del socio',
        accionHref: n.metadata?.socio_id ? `/socios/${n.metadata.socio_id}` : '/socios',
      })
    }

    setNotificaciones(alertas)
    setLoading(false)
  }

  const config = {
    urgente: {
      bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700',
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
    },
    advertencia: {
      bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-700',
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    info: {
      bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700',
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    documento: {
      bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700',
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    },
  }

  const filtradas = filtro === 'todas' ? notificaciones : notificaciones.filter(n => n.tipo === filtro)
  const contadores = {
    urgente:    notificaciones.filter(n => n.tipo === 'urgente').length,
    advertencia: notificaciones.filter(n => n.tipo === 'advertencia').length,
    info:       notificaciones.filter(n => n.tipo === 'info').length,
    documento:  notificaciones.filter(n => n.tipo === 'documento').length,
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
          <p className="text-gray-500 mt-1">Alertas automáticas de tu cooperativa</p>
        </div>
        <button onClick={generarNotificaciones} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0f172a' }}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-red-100 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-red-600">{contadores.urgente}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium uppercase tracking-wide">Urgentes</p>
        </div>
        <div className="bg-white border border-yellow-100 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-yellow-600">{contadores.advertencia}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium uppercase tracking-wide">Avisos</p>
        </div>
        <div className="bg-white border border-blue-100 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-blue-600">{contadores.info}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium uppercase tracking-wide">Informativas</p>
        </div>
        <div className="bg-white border border-purple-100 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-purple-600">{contadores.documento}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium uppercase tracking-wide">Documentos</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {[{ key: 'todas', label: `Todas (${notificaciones.length})` }, { key: 'urgente', label: 'Urgentes' }, { key: 'advertencia', label: 'Avisos' }, { key: 'info', label: 'Info' }, { key: 'documento', label: 'Documentos' }].map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)} className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
            style={{ backgroundColor: filtro === f.key ? '#0f172a' : 'white', color: filtro === f.key ? 'white' : '#6b7280', borderColor: filtro === f.key ? '#0f172a' : '#e5e7eb' }}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin mx-auto mb-3" />
          Analizando datos...
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
            const c = config[n.tipo]
            return (
              <div key={n.id} className={`border rounded-xl p-4 ${c.bg} ${c.border} ${n.leida === false ? 'ring-1 ring-purple-200' : ''}`}>
                <div className="flex gap-3 items-start">
                  <div className="mt-0.5 flex-shrink-0">{c.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.badge}`}>{n.tipo === 'documento' ? 'Documento' : n.tipo.charAt(0).toUpperCase() + n.tipo.slice(1)}</span>
                      {n.leida === false && <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full font-semibold">Nuevo</span>}
                    </div>
                    <p className="font-semibold text-gray-900 text-sm mt-1">{n.titulo}</p>
                    <p className="text-gray-600 text-sm mt-0.5">{n.mensaje}</p>
                    {n.accionLabel && (
                      <a href={n.accionHref} className="inline-block mt-2 text-xs font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900">
                        {n.accionLabel} →
                      </a>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{n.fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}