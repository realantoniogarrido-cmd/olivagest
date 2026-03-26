'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'
import { useRouter } from 'next/navigation'

export default function SociosPage() {
  const router = useRouter()
  const [socios, setSocios] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({ nombre: '', dni: '', telefono: '', email: '' })

  useEffect(() => {
    async function cargar() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      await cargarSocios()
      setLoading(false)
    }
    cargar()
  }, [router])

  async function cargarSocios() {
    const { data } = await supabase
      .from('socios')
      .select('*')
      .eq('activo', true)
      .order('nombre')
    setSocios(data || [])
  }

  async function guardarSocio(e) {
    e.preventDefault()
    setGuardando(true)
    await supabase.from('socios').insert([{ ...form }])
    setForm({ nombre: '', dni: '', telefono: '', email: '' })
    setMostrarFormulario(false)
    await cargarSocios()
    setGuardando(false)
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
      <Sidebar cooperativa="Mi Cooperativa" />
      <main className="ml-60 flex-1">

        <header className="bg-white border-b border-gray-100 px-7 h-14 flex items-center justify-between sticky top-0 z-40">
          <div>
            <h1 className="text-base font-bold text-gray-900">Socios</h1>
            <p className="text-xs text-gray-400">{socios.length} socios activos</p>
          </div>
          <button
            onClick={() => setMostrarFormulario(true)}
            className="bg-[#1a2e1a] hover:bg-[#2a4a2a] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + Nuevo socio
          </button>
        </header>

        <div className="p-7">

          {/* Formulario nuevo socio */}
          {mostrarFormulario && (
            <div className="bg-white border border-gray-100 rounded-xl p-6 mb-6">
              <h2 className="text-sm font-bold text-gray-900 mb-4">Nuevo socio</h2>
              <form onSubmit={guardarSocio} className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo *</label>
                  <input
                    required
                    value={form.nombre}
                    onChange={e => setForm({...form, nombre: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7ab648]"
                    placeholder="Manuel García Ruiz"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">DNI</label>
                  <input
                    value={form.dni}
                    onChange={e => setForm({...form, dni: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7ab648]"
                    placeholder="12345678A"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                  <input
                    value={form.telefono}
                    onChange={e => setForm({...form, telefono: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7ab648]"
                    placeholder="953 111 111"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm({...form, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7ab648]"
                    placeholder="socio@email.com"
                  />
                </div>
                <div className="col-span-2 flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={guardando}
                    className="bg-[#1a2e1a] text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-60"
                  >
                    {guardando ? 'Guardando...' : 'Guardar socio'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMostrarFormulario(false)}
                    className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tabla de socios */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {socios.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="text-4xl mb-3">👨‍🌾</div>
                <div className="text-gray-500 text-sm mb-3">Aún no hay socios registrados</div>
                <button
                  onClick={() => setMostrarFormulario(true)}
                  className="text-[#7ab648] font-semibold text-sm"
                >
                  Añadir primer socio →
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="text-left px-6 py-3">Nombre</th>
                    <th className="text-left px-6 py-3">DNI</th>
                    <th className="text-left px-6 py-3">Teléfono</th>
                    <th className="text-left px-6 py-3">Email</th>
                    <th className="text-left px-6 py-3">Alta</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {socios.map((socio, i) => (
                    <tr key={socio.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-6 py-3 font-medium text-gray-900">{socio.nombre}</td>
                      <td className="px-6 py-3 text-gray-500">{socio.dni || '—'}</td>
                      <td className="px-6 py-3 text-gray-500">{socio.telefono || '—'}</td>
                      <td className="px-6 py-3 text-gray-500">{socio.email || '—'}</td>
                      <td className="px-6 py-3 text-gray-400 text-xs">
                        {new Date(socio.created_at).toLocaleDateString('es-ES')}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => darDeBaja(socio.id)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Dar de baja
                        </button>
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