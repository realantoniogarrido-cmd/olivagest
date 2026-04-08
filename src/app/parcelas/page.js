'use client'
import { useState, useEffect } from 'react'
import { supabase, getUserId } from '@/lib/supabase'

export default function ParcelasPage() {
  const [parcelas, setParcelas] = useState([])
  const [socios, setSocios] = useState([])
  const [entregas, setEntregas] = useState([])
  const [form, setForm] = useState({ socio_id: '', nombre: '', superficie_ha: '', municipio: '', variedad: '' })
  const [loading, setLoading] = useState(false)
  const [filtroSocio, setFiltroSocio] = useState('')
  const [editando, setEditando] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)

  useEffect(() => {
    fetchTodo()
  }, [])

  async function fetchTodo() {
    const userId = await getUserId()
    const [{ data: p }, { data: s }, { data: e }] = await Promise.all([
      supabase.from('parcelas').select('*, socios(nombre)').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('socios').select('*').eq('user_id', userId),
      supabase.from('entregas').select('*, parcelas(nombre)').eq('user_id', userId),
    ])
    setParcelas(p || [])
    setSocios(s || [])
    setEntregas(e || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const userId = await getUserId()

    if (editando) {
      await supabase.from('parcelas').update({ ...form }).eq('id', editando)
      setEditando(null)
    } else {
      await supabase.from('parcelas').insert([{ ...form, user_id: userId }])
    }

    setForm({ socio_id: '', nombre: '', superficie_ha: '', municipio: '', variedad: '' })
    setMostrarForm(false)
    fetchTodo()
    setLoading(false)
  }

  function handleEditar(p) {
    setForm({ socio_id: p.socio_id, nombre: p.nombre, superficie_ha: p.superficie_ha, municipio: p.municipio || '', variedad: p.variedad || '' })
    setEditando(p.id)
    setMostrarForm(true)
  }

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar esta parcela?')) return
    await supabase.from('parcelas').delete().eq('id', id)
    fetchTodo()
  }

  function kgPorParcela(parcelaId) {
    return entregas.filter(e => e.parcela_id === parcelaId).reduce((s, e) => s + parseFloat(e.kg || 0), 0)
  }

  const parcelasFiltradas = filtroSocio
    ? parcelas.filter(p => p.socio_id === filtroSocio)
    : parcelas

  const variedades = ['Picual', 'Hojiblanca', 'Arbequina', 'Manzanilla', 'Gordal', 'Otra']

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Control de Parcelas</h1>
          <p className="text-gray-500 mt-1">Gestión de fincas por socio</p>
        </div>
        <button
          onClick={() => { setMostrarForm(!mostrarForm); setEditando(null); setForm({ socio_id: '', nombre: '', superficie_ha: '', municipio: '', variedad: '' }) }}
          className="bg-amber-700 text-white px-4 py-2 rounded-lg hover:bg-amber-800 font-medium"
        >
          {mostrarForm ? 'Cancelar' : '+ Nueva parcela'}
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-700">Total parcelas</p>
          <p className="text-3xl font-bold text-amber-900">{parcelas.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-green-700">Superficie total</p>
          <p className="text-3xl font-bold text-green-900">
            {parcelas.reduce((s, p) => s + parseFloat(p.superficie_ha || 0), 0).toLocaleString('es-ES')} ha
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-700">Socios con parcelas</p>
          <p className="text-3xl font-bold text-blue-900">
            {new Set(parcelas.map(p => p.socio_id)).size}
          </p>
        </div>
      </div>

      {/* Formulario */}
      {mostrarForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <h2 className="md:col-span-2 font-semibold text-gray-800 text-lg">
            {editando ? 'Editar parcela' : 'Nueva parcela'}
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Socio</label>
            <select
              value={form.socio_id}
              onChange={e => setForm({ ...form, socio_id: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-2 text-gray-900"
              required
            >
              <option value="">Seleccionar socio...</option>
              {socios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la parcela / finca</label>
            <input
              type="text" placeholder="Ej: Finca El Olivar"
              value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-2 text-gray-900"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Superficie (hectáreas)</label>
            <input
              type="number" step="0.01" placeholder="0.00"
              value={form.superficie_ha}
              onChange={e => setForm({ ...form, superficie_ha: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-2 text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Municipio</label>
            <input
              type="text" placeholder="Ej: Jaén"
              value={form.municipio}
              onChange={e => setForm({ ...form, municipio: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-2 text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Variedad de aceituna</label>
            <select
              value={form.variedad}
              onChange={e => setForm({ ...form, variedad: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-2 text-gray-900"
            >
              <option value="">Seleccionar variedad...</option>
              {variedades.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit" disabled={loading}
              className="w-full bg-amber-700 text-white py-2 px-4 rounded-lg hover:bg-amber-800 font-medium"
            >
              {loading ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar parcela'}
            </button>
          </div>
        </form>
      )}

      {/* Filtro por socio */}
      <div className="mb-4 flex gap-3 items-center">
        <label className="text-sm font-medium text-gray-700">Filtrar por socio:</label>
        <select
          value={filtroSocio}
          onChange={e => setFiltroSocio(e.target.value)}
          className="border border-gray-300 rounded-lg p-2 text-gray-900 text-sm"
        >
          <option value="">Todos los socios</option>
          {socios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left p-4">Parcela</th>
              <th className="text-left p-4">Socio</th>
              <th className="text-left p-4">Municipio</th>
              <th className="text-left p-4">Variedad</th>
              <th className="text-right p-4">Superficie</th>
              <th className="text-right p-4">Kg entregados</th>
              <th className="text-center p-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {parcelasFiltradas.map(p => (
              <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="p-4 font-medium text-gray-900">{p.nombre}</td>
                <td className="p-4 text-gray-700">{p.socios?.nombre}</td>
                <td className="p-4 text-gray-600">{p.municipio || '—'}</td>
                <td className="p-4">
                  {p.variedad ? (
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">{p.variedad}</span>
                  ) : '—'}
                </td>
                <td className="p-4 text-right text-gray-700">{p.superficie_ha ? `${p.superficie_ha} ha` : '—'}</td>
                <td className="p-4 text-right font-medium text-amber-700">
                  {kgPorParcela(p.id).toLocaleString('es-ES')} kg
                </td>
                <td className="p-4 text-center flex gap-2 justify-center">
                  <button
                    onClick={() => handleEditar(p)}
                    className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-xs hover:bg-blue-200"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleEliminar(p.id)}
                    className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs hover:bg-red-200"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {parcelasFiltradas.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-gray-400">No hay parcelas registradas</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}