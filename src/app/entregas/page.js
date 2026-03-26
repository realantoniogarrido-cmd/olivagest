'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'
import { useRouter } from 'next/navigation'

export default function EntregasPage() {
  const router = useRouter()
  const [cooperativa, setCooperativa] = useState('')
  const [entregas, setEntregas] = useState([])
  const [socios, setSocios] = useState([])
  const [campanaId, setCampanaId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [editando, setEditando] = useState(null)

  const formVacio = { socio_id: '', fecha: new Date().toISOString().split('T')[0], kg_bruto: '', rendimiento: '', calidad: 'AOVE', notas: '' }
  const [form, setForm] = useState(formVacio)

  useEffect(() => {
    async function cargarDatos() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: { user } } = await supabase.auth.getUser()
      setCooperativa(user?.user_metadata?.cooperativa || 'Mi Cooperativa')
      const { data: campana } = await supabase.from('campanas').select('id').eq('activa', true).single()
      if (campana) setCampanaId(campana.id)
      const { data: sociosData } = await supabase.from('socios').select('id, nombre').eq('activo', true).order('nombre')
      setSocios(sociosData || [])
      await cargarEntregas(campana?.id)
      setLoading(false)
    }
    cargarDatos()
  }, [router])

  async function cargarEntregas(cId) {
    const query = supabase.from('entregas').select('*, socios(nombre)').order('fecha', { ascending: false }).limit(100)
    if (cId) query.eq('campana_id', cId)
    const { data } = await query
    setEntregas(data || [])
  }

  function handleChange(e) { setForm(prev => ({ ...prev, [e.target.name]: e.target.value })) }

  function abrirEditar(entrega) {
    setEditando(entrega.id)
    setForm({ socio_id: entrega.socio_id, fecha: entrega.fecha, kg_bruto: entrega.kg_bruto, rendimiento: entrega.rendimiento ?? '', calidad: entrega.calidad || 'AOVE', notas: entrega.notas || '' })
    setShowForm(true)
    setFormError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelar() { setShowForm(false); setEditando(null); setForm(formVacio); setFormError('') }

  async function eliminar(id) {
    if (!confirm('¿Seguro que quieres eliminar esta entrega?')) return
    const { error } = await supabase.from('entregas').delete().eq('id', id)
    if (error) { alert('Error al eliminar: ' + error.message); return }
    setSuccessMsg('Entrega eliminada')
    setTimeout(() => setSuccessMsg(''), 3000)
    await cargarEntregas(campanaId)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    if (!form.socio_id) { setFormError('Selecciona un socio'); setSaving(false); return }
    if (!form.kg_bruto || parseFloat(form.kg_bruto) <= 0) { setFormError('Los kg brutos deben ser mayores que 0'); setSaving(false); return }
    const payload = { socio_id: form.socio_id, campana_id: campanaId, fecha: form.fecha, kg_bruto: parseFloat(form.kg_bruto), rendimiento: form.rendimiento ? parseFloat(form.rendimiento) : null, calidad: form.calidad, notas: form.notas || null }
    let error
    if (editando) {
      ;({ error } = await supabase.from('entregas').update(payload).eq('id', editando))
    } else {
      ;({ error } = await supabase.from('entregas').insert([payload]))
    }
    if (error) { setFormError('Error al guardar: ' + error.message); setSaving(false); return }
    cancelar()
    setSaving(false)
    setSuccessMsg(editando ? 'Entrega actualizada' : 'Entrega registrada correctamente')
    setTimeout(() => setSuccessMsg(''), 3000)
    await cargarEntregas(campanaId)
  }

  function kgAceite(e) {
    if (!e.rendimiento) return '—'
    return ((e.kg_bruto * e.rendimiento) / 100).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' kg'
  }

  const totalKg = entregas.reduce((sum, e) => sum + (e.kg_bruto || 0), 0)
  const totalAceite = entregas.reduce((sum, e) => e.rendimiento ? sum + (e.kg_bruto * e.rendimiento) / 100 : sum, 0)

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#f5f5f0]">
      <div className="text-[#7ab648] font-medium">Cargando...</div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-[#f5f5f0]">
      <Sidebar cooperativa={cooperativa} />
      <main className="ml-60 flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-100 px-7 h-14 flex items-center justify-between sticky top-0 z-40">
          <div>
            <h1 className="text-base font-bold text-gray-900">Entregas de aceituna</h1>
            <p className="text-xs text-gray-400">Campaña 2025/2026</p>
          </div>
          <button onClick={() => { cancelar(); setShowForm(!showForm) }}
            className="bg-[#1a2e1a] hover:bg-[#2a4a2a] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            {showForm ? 'Cancelar' : '+ Nueva entrega'}
          </button>
        </header>

        <div className="p-7">
          {successMsg && (
            <div className="bg-[#f0f7e8] border border-[#c5e09a] text-[#2d6a0d] text-sm font-medium px-4 py-3 rounded-xl mb-5">{successMsg}</div>
          )}

          {showForm && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
              <h2 className="text-sm font-bold text-gray-900 mb-5">{editando ? 'Editar entrega' : 'Registrar nueva entrega'}</h2>
              <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Socio <span className="text-red-400">*</span></label>
                  <select name="socio_id" value={form.socio_id} onChange={handleChange} required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7ab648] bg-white">
                    <option value="">— Seleccionar socio —</option>
                    {socios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Fecha</label>
                  <input type="date" name="fecha" value={form.fecha} onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7ab648]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Kg bruto <span className="text-red-400">*</span></label>
                  <input type="number" name="kg_bruto" value={form.kg_bruto} onChange={handleChange} placeholder="Ej: 1500" min="0" step="0.01" required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7ab648]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Rendimiento (%)</label>
                  <input type="number" name="rendimiento" value={form.rendimiento} onChange={handleChange} placeholder="Ej: 19.5" min="0" max="100" step="0.1"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7ab648]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Calidad</label>
                  <select name="calidad" value={form.calidad} onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7ab648] bg-white">
                    <option value="AOVE">AOVE — Virgen Extra</option>
                    <option value="AOV">AOV — Virgen</option>
                    <option value="AO">AO — Aceite de oliva</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notas</label>
                  <input type="text" name="notas" value={form.notas} onChange={handleChange} placeholder="Observaciones opcionales..."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7ab648]" />
                </div>
                {formError && <div className="col-span-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">{formError}</div>}
                <div className="col-span-2 flex gap-3 pt-1">
                  <button type="submit" disabled={saving}
                    className="bg-[#1a2e1a] hover:bg-[#2a4a2a] text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-60">
                    {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar entrega'}
                  </button>
                  <button type="button" onClick={cancelar} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5">Cancelar</button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-[#1a2e1a] rounded-xl p-5">
              <div className="text-xs font-medium uppercase tracking-wide mb-2 text-white/50">Total kg aceituna</div>
              <div className="text-2xl font-extrabold tracking-tight text-white">{(totalKg / 1000).toFixed(1)}<span className="text-sm font-medium ml-1 text-white/40">t</span></div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="text-xs font-medium uppercase tracking-wide mb-2 text-gray-400">Aceite estimado</div>
              <div className="text-2xl font-extrabold tracking-tight text-gray-900">{(totalAceite / 1000).toFixed(2)}<span className="text-sm font-medium ml-1 text-gray-400">t</span></div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="text-xs font-medium uppercase tracking-wide mb-2 text-gray-400">Entregas registradas</div>
              <div className="text-2xl font-extrabold tracking-tight text-gray-900">{entregas.length}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="text-sm font-bold text-gray-900">Historial de entregas</h2>
            </div>
            {entregas.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400 text-sm">No hay entregas registradas.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-gray-400 border-b border-gray-50">
                    <th className="text-left px-6 py-3">Socio</th>
                    <th className="text-left px-6 py-3">Fecha</th>
                    <th className="text-right px-6 py-3">Kg bruto</th>
                    <th className="text-right px-6 py-3">Rendim.</th>
                    <th className="text-right px-6 py-3">Kg aceite</th>
                    <th className="text-left px-6 py-3">Calidad</th>
                    <th className="text-left px-6 py-3">Notas</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {entregas.map((e, i) => (
                    <tr key={e.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-6 py-3 font-medium text-gray-900">{e.socios?.nombre || '—'}</td>
                      <td className="px-6 py-3 text-gray-500">{new Date(e.fecha + 'T00:00:00').toLocaleDateString('es-ES')}</td>
                      <td className="px-6 py-3 text-right text-gray-700 font-medium tabular-nums">{e.kg_bruto?.toLocaleString('es-ES')} kg</td>
                      <td className="px-6 py-3 text-right text-gray-500 tabular-nums">{e.rendimiento != null ? `${e.rendimiento}%` : '—'}</td>
                      <td className="px-6 py-3 text-right text-[#4a7a1e] font-semibold tabular-nums">{kgAceite(e)}</td>
                      <td className="px-6 py-3"><span className="bg-[#e8f5d8] text-[#2d6a0d] text-xs font-semibold px-2 py-0.5 rounded">{e.calidad || 'AOVE'}</span></td>
                      <td className="px-6 py-3 text-gray-400 text-xs">{e.notas || '—'}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1.5 justify-end">
                          <button onClick={() => abrirEditar(e)} title="Editar"
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-blue-100 hover:text-blue-700 text-gray-500 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button onClick={() => eliminar(e.id)} title="Eliminar"
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-red-100 hover:text-red-600 text-gray-500 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}