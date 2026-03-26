'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'
import { useRouter } from 'next/navigation'

export default function SociosPage() {
  const router = useRouter()
  const [cooperativa, setCooperativa] = useState('')
  const [socios, setSocios] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [form, setForm] = useState({ nombre: '', dni: '', telefono: '', email: '' })

  useEffect(() => {
    async function cargarDatos() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: { user } } = await supabase.auth.getUser()
      setCooperativa(user?.user_metadata?.cooperativa || 'Mi Cooperativa')
      await cargarSocios()
      setLoading(false)
    }
    cargarDatos()
  }, [router])

  async function cargarSocios() {
    const { data } = await supabase.from('socios').select('*').order('nombre')
    setSocios(data || [])
  }

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    if (!form.nombre) { setFormError('El nombre es obligatorio'); setSaving(false); return }
    const { error } = await supabase.from('socios').insert([{ nombre: form.nombre, dni: form.dni || null, telefono: form.telefono || null, email: form.email || null, activo: true }])
    if (error) { setFormError('Error al guardar: ' + error.message); setSaving(false); return }
    setForm({ nombre: '', dni: '', telefono: '', email: '' })
    setShowForm(false)
    setSaving(false)
    setSuccessMsg('Socio añadido correctamente')
    setTimeout(() => setSuccessMsg(''), 3000)
    await cargarSocios()
  }

  async function darDeBaja(id) {
    if (!confirm('¿Dar de baja a este socio?')) return
    await supabase.from('socios').update({ activo: false }).eq('id', id)
    await cargarSocios()
  }

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
            <h1 className="text-base font-bold text-gray-900">Socios</h1>
            <p className="text-xs text-gray-400">{socios.filter(s => s.activo).length} socios activos</p>
          </div>
          <button onClick={() => { setShowForm(!showForm); setFormError('') }}
            className="bg-[#1a2e1a] hover:bg-[#2a4a2a] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            {showForm ? 'Cancelar' : '+ Nuevo socio'}
          </button>
        </header>

        <div className="p-7">
          {successMsg && (
            <div className="bg-[#f0f7e8] border border-[#c5e09a] text-[#2d6a0d] text-sm font-medium px-4 py-3 rounded-xl mb-5">
              {successMsg}
            </div>
          )}

          {showForm && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
              <h2 className="text-sm font-bold text-gray-900 mb-5">Nuevo socio</h2>
              <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Nombre completo <span className="text-red-400">*</span></label>
                  <input type="text" name="nombre" value={form.nombre} onChange={handleChange} placeholder="Ej: Juan García López" required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7ab648]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">DNI</label>
                  <input type="text" name="dni" value={form.dni} onChange={handleChange} placeholder="Ej: 12345678A"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7ab648]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Teléfono</label>
                  <input type="text" name="telefono" value={form.telefono} onChange={handleChange} placeholder="Ej: 612345678"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7ab648]" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Email</label>
                  <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="Ej: socio@email.com"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7ab648]" />
                </div>
                {formError && <div className="col-span-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">{formError}</div>}
                <div className="col-span-2 flex gap-3 pt-1">
                  <button type="submit" disabled={saving}
                    className="bg-[#1a2e1a] hover:bg-[#2a4a2a] text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-60">
                    {saving ? 'Guardando...' : 'Guardar socio'}
                  </button>
                  <button type="button" onClick={() => { setShowForm(false); setFormError('') }}
                    className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5">Cancelar</button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="text-sm font-bold text-gray-900">Listado de socios</h2>
            </div>
            {socios.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400 text-sm">No hay socios registrados todavía.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-gray-400 border-b border-gray-50">
                    <th className="text-left px-6 py-3">Nombre</th>
                    <th className="text-left px-6 py-3">DNI</th>
                    <th className="text-left px-6 py-3">Teléfono</th>
                    <th className="text-left px-6 py-3">Email</th>
                    <th className="text-left px-6 py-3">Estado</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {socios.map((socio, i) => (
                    <tr key={socio.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-6 py-3 font-medium text-gray-900">
                        <a href={`/socios/${socio.id}`} className="hover:text-[#4a7a1e] hover:underline transition-colors cursor-pointer">
                          {socio.nombre}
                        </a>
                      </td>
                      <td className="px-6 py-3 text-gray-500 font-mono text-xs">{socio.dni || '—'}</td>
                      <td className="px-6 py-3 text-gray-500">{socio.telefono || '—'}</td>
                      <td className="px-6 py-3 text-gray-500">{socio.email || '—'}</td>
                      <td className="px-6 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${socio.activo ? 'bg-[#e8f5d8] text-[#2d6a0d]' : 'bg-gray-100 text-gray-400'}`}>
                          {socio.activo ? 'Activo' : 'Baja'}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        {socio.activo && (
                          <button onClick={() => darDeBaja(socio.id)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors">
                            Dar de baja
                          </button>
                        )}
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