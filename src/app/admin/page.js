'use client'
import { useState, useEffect } from 'react'
import { supabase, getUserId } from '@/lib/supabase'

export default function AdminPage() {
  const [campanyas, setCampanyas] = useState([])
  const [socios, setSocios] = useState([])
  const [entregas, setEntregas] = useState([])
  const [liquidaciones, setLiquidaciones] = useState([])
  const [form, setForm] = useState({ nombre: '', fecha_inicio: '', fecha_fin: '', precio_kg: '', estado: 'activa', notas: '' })
  const [loading, setLoading] = useState(false)
  const [editando, setEditando] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [tab, setTab] = useState('campanyas')

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    const userId = await getUserId()
    const [{ data: c }, { data: s }, { data: e }, { data: l }] = await Promise.all([
      supabase.from('campanyas').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('socios').select('*').eq('user_id', userId),
      supabase.from('entregas').select('*').eq('user_id', userId),
      supabase.from('liquidaciones').select('*').eq('user_id', userId),
    ])
    setCampanyas(c || [])
    setSocios(s || [])
    setEntregas(e || [])
    setLiquidaciones(l || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const userId = await getUserId()
    if (editando) {
      await supabase.from('campanyas').update({ ...form }).eq('id', editando)
      setEditando(null)
    } else {
      await supabase.from('campanyas').insert([{ ...form, user_id: userId }])
    }
    setForm({ nombre: '', fecha_inicio: '', fecha_fin: '', precio_kg: '', estado: 'activa', notas: '' })
    setMostrarForm(false)
    fetchTodo()
    setLoading(false)
  }

  function handleEditar(c) {
    setForm({ nombre: c.nombre, fecha_inicio: c.fecha_inicio || '', fecha_fin: c.fecha_fin || '', precio_kg: c.precio_kg || '', estado: c.estado, notas: c.notas || '' })
    setEditando(c.id)
    setMostrarForm(true)
  }

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar esta campaña?')) return
    await supabase.from('campanyas').delete().eq('id', id)
    fetchTodo()
  }

  async function cambiarEstado(id, estado) {
    await supabase.from('campanyas').update({ estado }).eq('id', id)
    fetchTodo()
  }

  const estadoBadge = (estado) => {
    const estilos = {
      activa: 'bg-green-100 text-green-800',
      cerrada: 'bg-gray-100 text-gray-700',
      pendiente: 'bg-yellow-100 text-yellow-800',
    }
    return <span className={`text-xs px-2 py-1 rounded-full font-medium ${estilos[estado] || estilos.pendiente}`}>{estado}</span>
  }

  // Estadísticas globales
  const totalKg = entregas.reduce((s, e) => s + parseFloat(e.kg || 0), 0)
  const totalImporte = liquidaciones.reduce((s, l) => s + parseFloat(l.importe_total || 0), 0)
  const campanyaActiva = campanyas.find(c => c.estado === 'activa')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel de Administración</h1>
          <p className="text-gray-500 mt-1">Gestión de campañas y configuración general</p>
        </div>
        <button
          onClick={() => { setMostrarForm(!mostrarForm); setEditando(null); setForm({ nombre: '', fecha_inicio: '', fecha_fin: '', precio_kg: '', estado: 'activa', notas: '' }) }}
          className="bg-amber-700 text-white px-4 py-2 rounded-lg hover:bg-amber-800 font-medium"
        >
          {mostrarForm ? 'Cancelar' : '+ Nueva campaña'}
        </button>
      </div>

      {/* KPIs globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow p-4 border-l-4 border-amber-600">
          <p className="text-xs text-gray-500">Total socios</p>
          <p className="text-2xl font-bold text-gray-900">{socios.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4 border-l-4 border-green-600">
          <p className="text-xs text-gray-500">Kg gestionados</p>
          <p className="text-2xl font-bold text-gray-900">{totalKg.toLocaleString('es-ES')}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4 border-l-4 border-blue-600">
          <p className="text-xs text-gray-500">Importe liquidado</p>
          <p className="text-2xl font-bold text-gray-900">
            {totalImporte.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow p-4 border-l-4 border-purple-600">
          <p className="text-xs text-gray-500">Campaña activa</p>
          <p className="text-lg font-bold text-gray-900 truncate">{campanyaActiva?.nombre || 'Ninguna'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {['campanyas', 'configuracion'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-amber-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 shadow'}`}
          >
            {t === 'campanyas' ? 'Campañas' : 'Configuración'}
          </button>
        ))}
      </div>

      {/* Formulario */}
      {mostrarForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <h2 className="md:col-span-2 font-semibold text-gray-800 text-lg">
            {editando ? 'Editar campaña' : 'Nueva campaña'}
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la campaña</label>
            <input
              type="text" placeholder="Ej: Campaña 2024/2025"
              value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-2 text-gray-900"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              value={form.estado}
              onChange={e => setForm({ ...form, estado: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-2 text-gray-900"
            >
              <option value="activa">Activa</option>
              <option value="pendiente">Pendiente</option>
              <option value="cerrada">Cerrada</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
            <input
              type="date"
              value={form.fecha_inicio}
              onChange={e => setForm({ ...form, fecha_inicio: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-2 text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
            <input
              type="date"
              value={form.fecha_fin}
              onChange={e => setForm({ ...form, fecha_fin: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-2 text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio €/kg de referencia</label>
            <input
              type="number" step="0.001" placeholder="0.000"
              value={form.precio_kg}
              onChange={e => setForm({ ...form, precio_kg: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-2 text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <input
              type="text" placeholder="Observaciones..."
              value={form.notas}
              onChange={e => setForm({ ...form, notas: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-2 text-gray-900"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit" disabled={loading}
              className="w-full bg-amber-700 text-white py-2 px-4 rounded-lg hover:bg-amber-800 font-medium"
            >
              {loading ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear campaña'}
            </button>
          </div>
        </form>
      )}

      {/* Tab Campañas */}
      {tab === 'campanyas' && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left p-4">Campaña</th>
                <th className="text-left p-4">Estado</th>
                <th className="text-left p-4">Inicio</th>
                <th className="text-left p-4">Fin</th>
                <th className="text-right p-4">Precio ref.</th>
                <th className="text-left p-4">Notas</th>
                <th className="text-center p-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {campanyas.map(c => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="p-4 font-bold text-gray-900">{c.nombre}</td>
                  <td className="p-4">{estadoBadge(c.estado)}</td>
                  <td className="p-4 text-gray-600">{c.fecha_inicio ? new Date(c.fecha_inicio).toLocaleDateString('es-ES') : '—'}</td>
                  <td className="p-4 text-gray-600">{c.fecha_fin ? new Date(c.fecha_fin).toLocaleDateString('es-ES') : '—'}</td>
                  <td className="p-4 text-right text-gray-700">{c.precio_kg ? `${parseFloat(c.precio_kg).toFixed(3)} €/kg` : '—'}</td>
                  <td className="p-4 text-gray-500 text-xs">{c.notas || '—'}</td>
                  <td className="p-4">
                    <div className="flex gap-1 justify-center flex-wrap">
                      {c.estado !== 'activa' && (
                        <button onClick={() => cambiarEstado(c.id, 'activa')} className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs hover:bg-green-200">Activar</button>
                      )}
                      {c.estado !== 'cerrada' && (
                        <button onClick={() => cambiarEstado(c.id, 'cerrada')} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs hover:bg-gray-200">Cerrar</button>
                      )}
                      <button onClick={() => handleEditar(c)} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs hover:bg-blue-200">Editar</button>
                      <button onClick={() => handleEliminar(c.id)} className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs hover:bg-red-200">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {campanyas.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">No hay campañas creadas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab Configuración */}
      {tab === 'configuracion' && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-gray-800 text-lg mb-4">Resumen de la cooperativa</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-2">Datos generales</h3>
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Total socios registrados</span>
                  <span className="font-bold">{socios.length}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Total entregas</span>
                  <span className="font-bold">{entregas.length}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Total liquidaciones</span>
                  <span className="font-bold">{liquidaciones.length}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Total campañas</span>
                  <span className="font-bold">{campanyas.length}</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-2">Campaña activa</h3>
              {campanyaActiva ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="font-bold text-green-900 text-lg">{campanyaActiva.nombre}</p>
                  {campanyaActiva.precio_kg && <p className="text-green-700 mt-1">Precio: {parseFloat(campanyaActiva.precio_kg).toFixed(3)} €/kg</p>}
                  {campanyaActiva.fecha_inicio && <p className="text-green-600 text-sm mt-1">Desde: {new Date(campanyaActiva.fecha_inicio).toLocaleDateString('es-ES')}</p>}
                  {campanyaActiva.notas && <p className="text-green-600 text-sm mt-2 italic">{campanyaActiva.notas}</p>}
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-gray-500">
                  No hay ninguna campaña activa
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}