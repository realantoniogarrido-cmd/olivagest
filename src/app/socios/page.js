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
  const [eliminando, setEliminando] = useState(null) // socio.id being deleted
  const [eliminarMsg, setEliminarMsg] = useState('') // error feedback

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

  function handleWhatsApp(socio) {
    if (!socio.telefono) return
    let tel = socio.telefono.replace(/[\s\-().]/g, '')
    if (!tel.startsWith('+')) tel = '34' + tel.replace(/^0/, '')
    else tel = tel.replace('+', '')
    const portalUrl = `${window.location.origin}/portal`
    const msg = encodeURIComponent(
      `Hola ${socio.nombre}, te enviamos tu acceso al portal de OlivaGest 🫒\n\nDesde aquí podrás consultar tus entregas, liquidaciones y parcelas:\n${portalUrl}`
    )
    window.open(`https://wa.me/${tel}?text=${msg}`, '_blank')
  }

  async function handleInvitar(socio) {
    if (!socio.email) {
      alert('Este socio no tiene email registrado. Añádelo primero en su ficha.')
      return
    }
    setInvitando(socio.id)
    try {
      const adminEmail = (await supabase.auth.getSession()).data.session?.user?.email || ''
      const res = await fetch('/api/invite-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socioEmail: socio.email,
          socioNombre: socio.nombre,
          appUrl: window.location.origin,
          adminEmail,
        }),
      })
      const result = await res.json()
      if (result.success && result.testMode) {
        setInvitadoMsg(`✅ Email redirigido a tu correo (modo prueba) — destino real: ${socio.email}`)
      } else if (result.success) {
        setInvitadoMsg(`✅ Acceso enviado a ${socio.email}`)
      } else {
        setInvitadoMsg(`❌ ${result.error?.message || result.error || 'Error al enviar invitación'}`)
      }
    } catch (err) {
      setInvitadoMsg(`❌ Error: ${err.message}`)
    }
    setTimeout(() => setInvitadoMsg(''), 5000)
    setInvitando(null)
  }

  async function handleEliminar(id, nombre) {
    if (!confirm(`¿Eliminar a "${nombre}" y todas sus parcelas y entregas? Esta acción no se puede deshacer.`)) return
    setEliminando(id)
    setEliminarMsg('')
    try {
      const userId = await getUserId()

      // 1. Borrar entregas del socio
      const { error: errEnt } = await supabase
        .from('entregas')
        .delete()
        .eq('socio_id', id)
        .eq('user_id', userId)
      if (errEnt) throw new Error(`Error al borrar entregas: ${errEnt.message}`)

      // 2. Borrar parcelas del socio
      const { error: errPar } = await supabase
        .from('parcelas')
        .delete()
        .eq('socio_id', id)
        .eq('user_id', userId)
      if (errPar) throw new Error(`Error al borrar parcelas: ${errPar.message}`)

      // 3. Borrar el socio
      const { error: errSoc } = await supabase
        .from('socios')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
      if (errSoc) throw new Error(`Error al borrar socio: ${errSoc.message}`)

      await fetchSocios()
    } catch (e) {
      setEliminarMsg(`❌ ${e.message}`)
      setTimeout(() => setEliminarMsg(''), 6000)
    } finally {
      setEliminando(null)
    }
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

      {eliminarMsg && (
        <div className="mb-4 p-3 rounded-lg text-sm font-medium bg-red-50 border border-red-200 text-red-800">
          {eliminarMsg}
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
              <th className="text-center px-5 py-3">Acceso portal</th>
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
                  <div className="flex gap-2 justify-center">
                    {/* Email invite */}
                    <button
                      onClick={() => handleInvitar(s)}
                      disabled={invitando === s.id || !s.email}
                      title={s.email ? `Enviar acceso por email a ${s.email}` : 'El socio no tiene email'}
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
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {s.email ? 'Email' : 'Sin email'}
                        </>
                      )}
                    </button>

                    {/* WhatsApp invite */}
                    <button
                      onClick={() => handleWhatsApp(s)}
                      disabled={!s.telefono}
                      title={s.telefono ? `Enviar acceso por WhatsApp a ${s.telefono}` : 'El socio no tiene teléfono'}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
                      style={{
                        backgroundColor: s.telefono ? 'rgba(37,211,102,0.12)' : '#f1f5f9',
                        color: s.telefono ? '#16a34a' : '#94a3b8',
                      }}
                    >
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.848L0 24l6.335-1.502A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.002-1.366l-.36-.214-3.733.885.936-3.617-.236-.374A9.818 9.818 0 1112 21.818z"/>
                      </svg>
                      {s.telefono ? 'WhatsApp' : 'Sin tlf.'}
                    </button>
                  </div>
                </td>
                <td className="px-5 py-3 text-center">
                  <div className="flex gap-2 justify-center">
                    <Link href={`/socios/${s.id}`} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-lg text-xs hover:bg-gray-200">
                      Ver ficha
                    </Link>
                    <button
                      onClick={() => handleEliminar(s.id, s.nombre)}
                      disabled={eliminando === s.id}
                      className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs hover:bg-red-200 disabled:opacity-50"
                    >
                      {eliminando === s.id ? 'Borrando...' : 'Eliminar'}
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