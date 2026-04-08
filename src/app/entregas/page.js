'use client'
import { useState, useEffect } from 'react'
import { supabase, getUserId } from '@/lib/supabase'

export default function EntregasPage() {
  const [entregas, setEntregas] = useState([])
  const [socios, setSocios] = useState([])
  const [parcelas, setParcelas] = useState([])
  const [campanyaActiva, setCampanyaActiva] = useState('')
  const [form, setForm] = useState({ socio_id: '', parcela_id: '', kg_bruto: '', rendimiento: '', calidad: 'Primera', campana: '', notas: '' })
  const [loading, setLoading] = useState(false)
  const [editando, setEditando] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)

  useEffect(() => { fetchTodo(); fetchCampanyaActiva() }, [])

  async function fetchTodo() {
    const userId = await getUserId()
    const [{ data: e }, { data: s }, { data: p }] = await Promise.all([
      supabase.from('entregas').select('*, socios(nombre), parcelas(nombre)').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('socios').select('*').eq('user_id', userId).order('nombre'),
      supabase.from('parcelas').select('*').eq('user_id', userId).order('nombre'),
    ])
    setEntregas(e || [])
    setSocios(s || [])
    setParcelas(p || [])
  }

  async function fetchCampanyaActiva() {
    const userId = await getUserId()
    const { data } = await supabase.from('campanyas').select('nombre').eq('user_id', userId).eq('estado', 'activa').limit(1).single()
    if (data?.nombre) {
      setCampanyaActiva(data.nombre)
      setForm(f => ({ ...f, 'campana': data.nombre }))
    }
  }

  // Parcelas filtradas según socio seleccionado en el form
  const parcelasFiltradas = form.socio_id
    ? parcelas.filter(p => p.socio_id === form.socio_id)
    : parcelas

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const userId = await getUserId()
    const datos = {
      socio_id: form.socio_id,
      parcela_id: form.parcela_id || null,
      kg_bruto: form.kg_bruto,
      rendimiento: form.rendimiento || null,
      calidad: form.calidad,
      campana: form.campana || null,
      notas: form.notas || null,
    }
    if (editando) {
      await supabase.from('entregas').update(datos).eq('id', editando)
      setEditando(null)
    } else {
      await supabase.from('entregas').insert([{ ...datos, user_id: userId }])
    }
    setForm({ socio_id: '', parcela_id: '', kg_bruto: '', rendimiento: '', calidad: 'Primera', campana: campanyaActiva || '', notas: '' })
    setMostrarForm(false)
    fetchTodo()
    setLoading(false)
  }

  function handleEditar(entrega) {
    setForm({
      socio_id: entrega.socio_id,
      parcela_id: entrega.parcela_id || '',
      kg_bruto: entrega.kg_bruto,
      rendimiento: entrega.rendimiento || '',
      calidad: entrega.calidad || 'Primera',
      campana: entrega.campana || '',
      notas: entrega.notas || '',
    })
    setEditando(entrega.id)
    setMostrarForm(true)
  }

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar esta entrega?')) return
    await supabase.from('entregas').delete().eq('id', id)
    fetchTodo()
  }

  const totalKg = entregas.reduce((s, e) => s + parseFloat(e.kg_bruto || 0), 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Entregas</h1>
          <p className="text-gray-500 mt-1">{entregas.length} entregas · {totalKg.toLocaleString('es-ES')} kg totales</p>
        </div>
        <button
          onClick={() => { setMostrarForm(!mostrarForm); setEditando(null); setForm({ socio_id: '', parcela_id: '', kg_bruto: '', rendimiento: '', calidad: 'Primera', campana: campanyaActiva || '', notas: '' }) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: '#0f172a' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {mostrarForm ? 'Cancelar' : 'Nueva entrega'}
        </button>
      </div>

      {mostrarForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <h2 className="md:col-span-2 font-semibold text-gray-800">{editando ? 'Editar entrega' : 'Nueva entrega'}</h2>

          {/* Socio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Socio <span className="text-red-500">*</span></label>
            <select
              value={form.socio_id}
              onChange={e => setForm({ ...form, socio_id: e.target.value, parcela_id: '' })}
              className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 text-sm"
              required
            >
              <option value="">Seleccionar socio...</option>
              {socios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>

          {/* Parcela */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Parcela de origen
              <span className="ml-1 text-xs text-gray-400">(trazabilidad)</span>
            </label>
            <select
              value={form.parcela_id}
              onChange={e => setForm({ ...form, parcela_id: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 text-sm"
            >
              <option value="">Sin parcela específica</option>
              {parcelasFiltradas.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}{p.municipio ? ` — ${p.municipio}` : ''}</option>
              ))}
            </select>
          </div>

          {/* Campaña */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Campaña
              {campanyaActiva && form.campana === campanyaActiva && (
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-normal">
                  ✓ Activa
                </span>
              )}
            </label>
            <input
              type="text" placeholder="Ej: 2024/2025"
              value={form.campana}
              onChange={e => setForm({ ...form, campana: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 text-sm"
            />
            {campanyaActiva && form.campana !== campanyaActiva && (
              <button type="button"
                onClick={() => setForm(f => ({ ...f, campana: campanyaActiva }))}
                className="text-xs text-blue-600 mt-1 hover:underline">
                ← Volver a campaña activa: {campanyaActiva}
              </button>
            )}
          </div>

          {/* Kg */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kg bruto <span className="text-red-500">*</span></label>
            <input
              type="number" step="0.1" placeholder="0"
              value={form.kg_bruto}
              onChange={e => setForm({ ...form, kg_bruto: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 text-sm"
              required
            />
          </div>

          {/* Rendimiento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rendimiento (%)</label>
            <input
              type="number" step="0.1" placeholder="Ej: 20"
              value={form.rendimiento}
              onChange={e => setForm({ ...form, rendimiento: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 text-sm"
            />
          </div>

          {/* Calidad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Calidad</label>
            <select
              value={form.calidad}
              onChange={e => setForm({ ...form, calidad: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 text-sm"
            >
              <option value="Extra">Extra</option>
              <option value="Primera">Primera</option>
              <option value="Segunda">Segunda</option>
            </select>
          </div>

          {/* Notas */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <input
              type="text" placeholder="Observaciones..."
              value={form.notas}
              onChange={e => setForm({ ...form, notas: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 text-sm"
            />
          </div>

          <div className="md:col-span-2">
            <button type="submit" disabled={loading} className="w-full py-2 px-4 rounded-lg text-white font-medium text-sm" style={{ backgroundColor: '#0f172a' }}>
              {loading ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar entrega'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-5 py-3">Socio</th>
              <th className="text-left px-5 py-3">Parcela</th>
              <th className="text-left px-5 py-3">Campaña</th>
              <th className="text-left px-5 py-3">Fecha</th>
              <th className="text-right px-5 py-3">Kg bruto</th>
              <th className="text-right px-5 py-3">Rendim.</th>
              <th className="text-left px-5 py-3">Calidad</th>
              <th className="text-center px-5 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {entregas.map(e => (
              <tr key={e.id} className="border-t border-gray-50 hover:bg-gray-50">
                <td className="px-5 py-3 font-medium text-gray-900">{e.socios?.nombre}</td>
                <td className="px-5 py-3 text-gray-500 text-xs">{e.parcelas?.nombre || <span className="text-gray-300">—</span>}</td>
                <td className="px-5 py-3 text-gray-600">{e.campana || '—'}</td>
                <td className="px-5 py-3 text-gray-500">{new Date(e.created_at).toLocaleDateString('es-ES')}</td>
                <td className="px-5 py-3 text-right font-medium text-gray-900">{parseFloat(e.kg_bruto || 0).toLocaleString('es-ES')} kg</td>
                <td className="px-5 py-3 text-right text-gray-600">{e.rendimiento ? `${e.rendimiento}%` : '—'}</td>
                <td className="px-5 py-3">
                  {e.calidad ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.calidad === 'Extra' ? 'bg-green-100 text-green-800' : e.calidad === 'Primera' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}>
                      {e.calidad}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-5 py-3 text-center flex gap-2 justify-center">
                  <button onClick={() => handleEditar(e)} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-xs hover:bg-blue-200">Editar</button>
                  <button onClick={() => handleEliminar(e.id)} className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs hover:bg-red-200">Eliminar</button>
                </td>
              </tr>
            ))}
            {entregas.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-400">No hay entregas registradas</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
