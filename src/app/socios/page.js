'use client'
import { useState, useEffect } from 'react'
import { supabase, getUserId } from '@/lib/supabase'
import Link from 'next/link'

export default function SociosPage() {
  const [socios, setSocios] = useState([])
  const [form, setForm] = useState({ nombre: '', dni: '', telefono: '', email: '', direccion: '' })
  const [loading, setLoading] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [invitando, setInvitando] = useState(null)   // socio.id
  const [invitadoMsg, setInvitadoMsg] = useState('')  // feedback msg

  useEffect(() => { fetchSocios() }, [])

  async function fetchSocios() {
    const userId = await getUserId()
    const { data } = await supabase.from('socios').select('*').eq('user_id', userId).order('nombre')
    setSocios(data || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const userId = await getUserId()
    await supabase.from('socios').insert([{ ...form, user_id: userId }])
    setForm({ nombre: '', dni: '', telefono: '', email: '', direccion: '' })
    setMostrarForm(false)
    fetchSocios()
    setLoading(false)
  }

  async function handleInvitar(socio) {
    if (!socio.email) {
      alert('Este socio no tiene email registrado. Añádelo primero en su ficha.')
      return
    }
    setInvitando(socio.id)
    const { error } = await supabase.auth.signInWithOtp({
      email: socio.email,
      options: {
        emailRedirectTo: `${window.location.origin}/portal/callback`,
        shouldCreateUser: true,
      },
    })
    if (error) {
      setInvitadoMsg(`❌ Error al enviar invitación a ${socio.email}`)
    } else {
      setInvitadoMsg(`✅ Acceso enviado a ${socio.email}`)
    }
    setTimeout(() => setInvitadoMsg(''), 5000)
    setInvitando(null)
  }

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar este socio?')) return
    await supabase.from('socios').delete().eq('id', id)
    fetchSocios()
  }

  const sociosFiltrados = socios.filter(s =>
    s.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    s.dni?.toLowerCase().includes(busqueda.toLowerCase()) ||
    s.email?.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Socios</h1>
          <p className="text-gray-500 mt-1">{socios.length} socios registrados</p>
        </div>
        <button
          onClick={() => setMostrarForm(!mostrarForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: '#0f172a' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {mostrarForm ? 'Cancelar' : 'Nuevo socio'}
        </button>
      </div>

      {mostrarForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <h2 className="md:col-span-2 font-semibold text-gray-800">Nuevo socio</h2>
          {[
            { key: 'nombre', label: 'Nombre completo', placeholder: 'Ej: Juan García López', required: true },
            { key: 'dni', label: 'DNI', placeholder: 'Ej: 12345678A' },
            { key: 'telefono', label: 'Teléfono', placeholder: 'Ej: 600000000' },
            { key: 'email', label: 'Email', placeholder: 'Ej: juan@ejemplo.com', type: 'email' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              <input
                type={f.type || 'text'}
                placeholder={f.placeholder}
                value={form[f.key]}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 text-sm"
                required={f.required}
              />
            </div>
          ))}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <input
              type="text" placeholder="Ej: Calle Mayor 1, Jaén"
              value={form.direccion}
              onChange={e => setForm({ ...form, direccion: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <button type="submit" disabled={loading} className="w-full py-2 px-4 rounded-lg text-white font-medium text-sm" style={{ backgroundColor: '#0f172a' }}>
              {loading ? 'Guardando...' : 'Registrar socio'}
            </button>
          </div>
        </form>
      )}

      {invitadoMsg && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${invitadoMsg.startsWith('✅') ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {invitadoMsg}
        </div>
      )}

      <div className="mb-4">
        <input
          type="text" placeholder="Buscar por nombre, DNI o email..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-full border border-gray-200 rounded-lg p-2.5 text-gray-900 text-sm bg-white shadow-sm"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-5 py-3">Nombre</th>
              <th className="text-left px-5 py-3">DNI</th>
              <th className="text-left px-5 py-3">Teléfono</th>
              <th className="text-left px-5 py-3">Email</th>
              <th className="text-center px-5 py-3">Portal</th>
              <th className="text-center px-5 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sociosFiltrados.map(s => (
              <tr key={s.id} className="border-t border-gray-50 hover:bg-gray-50">
                <td className="px-5 py-3 font-medium text-gray-900">{s.nombre}</td>
                <td className="px-5 py-3 text-gray-600">{s.dni || '—'}</td>
                <td className="px-5 py-3 text-gray-600">{s.telefono || '—'}</td>
                <td className="px-5 py-3 text-gray-600">{s.email || '—'}</td>
                <td className="px-5 py-3 text-center">
                  <button
                    onClick={() => handleInvitar(s)}
                    disabled={invitando === s.id || !s.email}
                    title={s.email ? `Enviar acceso al portal a ${s.email}` : 'El socio no tiene email'}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
                    style={{
                      backgroundColor: s.email ? 'rgba(74,222,128,0.12)' : '#f1f5f9',
                      color: s.email ? '#16a34a' : '#94a3b8',
                    }}
                  >
                    {invitando === s.id ? (
                      <>
                        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Enviando...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        {s.email ? 'Dar acceso' : 'Sin email'}
                      </>
                    )}
                  </button>
                </td>
                <td className="px-5 py-3 text-center">
                  <div className="flex gap-2 justify-center">
                    <Link href={`/socios/${s.id}`} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-lg text-xs hover:bg-gray-200">
                      Ver ficha
                    </Link>
                    <button onClick={() => handleEliminar(s.id)} className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs hover:bg-red-200">
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sociosFiltrados.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">No hay socios registrados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}