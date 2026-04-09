'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

const TABS = ['Resumen', 'Entregas', 'Liquidaciones', 'Parcelas', 'Documentos']

export default function FichaSocioPage() {
  const router = useRouter()
  const { id } = useParams()

  const [socio, setSocio]             = useState(null)
  const [entregas, setEntregas]       = useState([])
  const [liquidaciones, setLiquidaciones] = useState([])
  const [parcelas, setParcelas]       = useState([])
  const [documentos, setDocumentos]   = useState([])
  const [portalStatus, setPortalStatus] = useState(null)
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState('Resumen')

  const [editando, setEditando] = useState(false)
  const [formSocio, setFormSocio] = useState({})
  const [guardando, setGuardando] = useState(false)

  const fileRef = useRef(null)
  const [subiendo, setSubiendo] = useState(false)
  const [docError, setDocError] = useState('')

  useEffect(() => {
    async function cargarDatos() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: socioData } = await supabase
        .from('socios').select('*').eq('id', id).single()
      if (!socioData) { setLoading(false); return }
      setSocio(socioData)
      setFormSocio({
        nombre:    socioData.nombre    || '',
        dni:       socioData.dni       || '',
        telefono:  socioData.telefono  || '',
        email:     socioData.email     || '',
        direccion: socioData.direccion || '',
        activo:    socioData.activo    ?? true,
      })

      const [entregasRes, liqRes, parcelasRes] = await Promise.all([
        supabase.from('entregas').select('*, campanas(nombre)').eq('socio_id', id).order('fecha', { ascending: false }),
        supabase.from('liquidaciones').select('*, campanas(nombre)').eq('socio_id', id).order('created_at', { ascending: false }),
        supabase.from('parcelas').select('*').eq('socio_id', id).order('nombre'),
      ])
      setEntregas(entregasRes.data || [])
      setLiquidaciones(liqRes.data || [])
      setParcelas(parcelasRes.data || [])

      if (socioData.email) {
        try {
          const res = await fetch(`/api/portal/check-account?email=${encodeURIComponent(socioData.email)}`)
          if (res.ok) { const { hasAccount } = await res.json(); setPortalStatus(hasAccount ? 'active' : 'none') }
        } catch {}
      }
      await cargarDocumentos(id)
      setLoading(false)
    }
    cargarDatos()
  }, [id, router])

  async function cargarDocumentos(socioId) {
    const { data, error } = await supabase.storage
      .from('socio-documentos')
      .list(`${socioId}/`, { sortBy: { column: 'created_at', order: 'desc' } })
    if (!error && data) setDocumentos(data.filter(f => f.name !== '.emptyFolderPlaceholder'))
  }

  async function handleGuardar() {
    setGuardando(true)
    const { data, error } = await supabase.from('socios').update(formSocio).eq('id', id).select().single()
    if (!error && data) { setSocio(data); setEditando(false) }
    setGuardando(false)
  }

  async function handleSubirDoc(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendo(true); setDocError('')
    // Prefijo "coop__" para distinguir documentos subidos por la cooperativa
    const nombre = `coop__${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('socio-documentos').upload(`${id}/${nombre}`, file)
    if (error) setDocError('Error al subir. Crea el bucket "socio-documentos" en Supabase → Storage (privado).')
    else await cargarDocumentos(id)
    setSubiendo(false); e.target.value = ''
  }

  async function handleEliminarDoc(nombre) {
    if (!confirm(`¿Eliminar "${limpiarNombre(nombre)}"?`)) return
    await supabase.storage.from('socio-documentos').remove([`${id}/${nombre}`])
    await cargarDocumentos(id)
  }

  async function getDocUrl(nombre) {
    const { data } = await supabase.storage.from('socio-documentos').createSignedUrl(`${id}/${nombre}`, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  function limpiarNombre(nombre) {
    return nombre.replace(/^(coop|socio)__\d+_/, '')
  }

  function origen(nombre) {
    if (nombre.startsWith('socio__')) return 'agricultor'
    if (nombre.startsWith('coop__'))  return 'cooperativa'
    return 'cooperativa'
  }

  const totalKg      = entregas.reduce((s, e) => s + (e.kg_bruto || 0), 0)
  const totalAceite  = entregas.reduce((s, e) => e.rendimiento ? s + (e.kg_bruto * e.rendimiento) / 100 : s, 0)
  const totalCobrado = liquidaciones.reduce((s, l) => s + (l.importe_total || 0), 0)

  if (loading) return (
    <div className="flex h-full items-center justify-center py-32">
      <div className="animate-spin w-8 h-8 rounded-full border-2 border-[#7ab648] border-t-transparent" />
    </div>
  )

  if (!socio) return (
    <div className="flex h-full items-center justify-center py-32 text-gray-400">Socio no encontrado</div>
  )

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-7 h-14 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/socios')} className="text-gray-400 hover:text-gray-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <div>
            <h1 className="text-base font-bold text-gray-900">{socio.nombre}</h1>
            <p className="text-xs text-gray-400">Ficha del socio</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {portalStatus === 'active' && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 font-semibold">Portal activo</span>
          )}
          {portalStatus === 'none' && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-400 font-semibold">Sin acceso portal</span>
          )}
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${socio.activo ? 'bg-[#e8f5d8] text-[#2d6a0d]' : 'bg-gray-100 text-gray-400'}`}>
            {socio.activo ? 'Activo' : 'Baja'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-7">
        <div className="flex">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-[#7ab648] text-[#4a7a1e]' : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}>
              {t}
              {t === 'Documentos' && documentos.length > 0 && (
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{documentos.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-7 overflow-y-auto bg-[#f5f5f0]">

        {/* ── RESUMEN ─────────────────────────────────────────── */}
        {tab === 'Resumen' && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <KPI label="Total entregado"  value={`${(totalKg/1000).toFixed(2)} t`} />
              <KPI label="Aceite estimado"  value={`${(totalAceite/1000).toFixed(2)} t`} />
              <KPI label="Nº entregas"      value={entregas.length} />
              <KPI label="Total cobrado"    value={`${totalCobrado.toLocaleString('es-ES', {minimumFractionDigits:2})} €`} verde />
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Datos personales</h2>
                {!editando ? (
                  <button onClick={() => setEditando(true)} className="text-xs text-[#4a7a1e] hover:underline font-semibold">Editar</button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setEditando(false)} className="text-xs text-gray-400 hover:text-gray-700">Cancelar</button>
                    <button onClick={handleGuardar} disabled={guardando}
                      className="text-xs bg-[#7ab648] text-white px-3 py-1 rounded-lg font-semibold disabled:opacity-50">
                      {guardando ? 'Guardando…' : 'Guardar'}
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-10 gap-y-4">
                {[
                  { label: 'Nombre', key: 'nombre' },
                  { label: 'DNI / NIF', key: 'dni' },
                  { label: 'Teléfono', key: 'telefono' },
                  { label: 'Email', key: 'email' },
                  { label: 'Dirección', key: 'direccion' },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <p className="text-xs text-gray-400 mb-1">{label}</p>
                    {editando ? (
                      <input value={formSocio[key] || ''} onChange={e => setFormSocio(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-[#7ab648]" />
                    ) : (
                      <p className="text-sm font-medium text-gray-800">{socio[key] || '—'}</p>
                    )}
                  </div>
                ))}
                <div>
                  <p className="text-xs text-gray-400 mb-1">Estado</p>
                  {editando ? (
                    <select value={formSocio.activo ? 'true' : 'false'}
                      onChange={e => setFormSocio(f => ({ ...f, activo: e.target.value === 'true' }))}
                      className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-[#7ab648]">
                      <option value="true">Activo</option>
                      <option value="false">Baja</option>
                    </select>
                  ) : (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full inline-block ${socio.activo ? 'bg-[#e8f5d8] text-[#2d6a0d]' : 'bg-gray-100 text-gray-400'}`}>
                      {socio.activo ? 'Activo' : 'Baja'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {entregas.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center">
                  <h2 className="text-sm font-bold text-gray-900">Últimas entregas</h2>
                  <button onClick={() => setTab('Entregas')} className="text-xs text-[#4a7a1e] hover:underline">Ver todas →</button>
                </div>
                <EntregasTable entregas={entregas.slice(0, 5)} />
              </div>
            )}
          </div>
        )}

        {/* ── ENTREGAS ─────────────────────────────────────────── */}
        {tab === 'Entregas' && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="text-sm font-bold text-gray-900">Historial completo de entregas ({entregas.length})</h2>
            </div>
            {entregas.length === 0 ? <Empty texto="No hay entregas registradas." /> : <EntregasTable entregas={entregas} />}
          </div>
        )}

        {/* ── LIQUIDACIONES ────────────────────────────────────── */}
        {tab === 'Liquidaciones' && (
          <div className="space-y-4">
            {liquidaciones.length === 0
              ? <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">No hay liquidaciones registradas.</div>
              : liquidaciones.map(liq => (
                <div key={liq.id} className="bg-white rounded-xl border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900">{liq.campanas?.nombre || 'Campaña'}</h3>
                    <span className="text-2xl font-extrabold text-[#4a7a1e]">
                      {liq.importe_total?.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div><p className="text-xs text-gray-400 mb-1">Kg aceituna</p><p className="text-sm font-semibold">{liq.kg_aceituna?.toLocaleString('es-ES')} kg</p></div>
                    <div><p className="text-xs text-gray-400 mb-1">Kg aceite</p><p className="text-sm font-semibold">{liq.kg_aceite?.toLocaleString('es-ES', { maximumFractionDigits:1 })} kg</p></div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Rendimiento</p>
                      <p className="text-sm font-semibold">{liq.kg_aceituna && liq.kg_aceite ? `${((liq.kg_aceite/liq.kg_aceituna)*100).toFixed(1)}%` : '—'}</p>
                    </div>
                    <div><p className="text-xs text-gray-400 mb-1">Precio/kg</p><p className="text-sm font-semibold">{liq.precio_kg?.toLocaleString('es-ES', { minimumFractionDigits:2 })} €</p></div>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* ── PARCELAS ─────────────────────────────────────────── */}
        {tab === 'Parcelas' && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="text-sm font-bold text-gray-900">Parcelas ({parcelas.length})</h2>
            </div>
            {parcelas.length === 0 ? <Empty texto="No hay parcelas registradas." /> : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-gray-400 border-b border-gray-50">
                    <th className="text-left px-6 py-3">Nombre / Ref.</th>
                    <th className="text-left px-6 py-3">Municipio</th>
                    <th className="text-right px-6 py-3">Superficie</th>
                    <th className="text-right px-6 py-3">Nº olivos</th>
                    <th className="text-left px-6 py-3">Variedad</th>
                    <th className="text-left px-6 py-3">Riego</th>
                  </tr>
                </thead>
                <tbody>
                  {parcelas.map((p, i) => (
                    <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-6 py-3 font-medium text-gray-800">{p.nombre || `Pol. ${p.poligono} – Parc. ${p.parcela}`}</td>
                      <td className="px-6 py-3 text-gray-500">{p.municipio || '—'}</td>
                      <td className="px-6 py-3 text-right tabular-nums text-gray-700">{p.superficie ? `${Number(p.superficie).toFixed(2)} ha` : '—'}</td>
                      <td className="px-6 py-3 text-right tabular-nums text-gray-700">{p.num_olivos || '—'}</td>
                      <td className="px-6 py-3 text-gray-500 text-xs">{p.variedad || '—'}</td>
                      <td className="px-6 py-3">
                        {p.regadio
                          ? <span className="bg-blue-50 text-blue-600 text-xs font-semibold px-2 py-0.5 rounded">Regadío</span>
                          : <span className="bg-amber-50 text-amber-600 text-xs font-semibold px-2 py-0.5 rounded">Secano</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── DOCUMENTOS ───────────────────────────────────────── */}
        {tab === 'Documentos' && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Repositorio de documentos</h2>
                <p className="text-xs text-gray-400 mt-0.5">Compartido entre la cooperativa y el agricultor</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#4a7a1e] inline-block" />
                    Cooperativa
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                    Agricultor
                  </span>
                </div>
                <button onClick={() => fileRef.current?.click()} disabled={subiendo}
                  className="flex items-center gap-2 bg-[#0f172a] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-[#1e293b] transition-colors disabled:opacity-50">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {subiendo ? 'Subiendo…' : 'Subir documento'}
                </button>
                <input ref={fileRef} type="file" className="hidden" onChange={handleSubirDoc}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx" />
              </div>
            </div>

            {docError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
                {docError}
              </div>
            )}

            {documentos.length === 0 ? (
              <div className="text-center py-14 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm font-medium">No hay documentos aún</p>
                <p className="text-xs mt-1">Los documentos subidos aquí también serán visibles por el agricultor en su portal</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documentos.map(doc => {
                  const esSocio = origen(doc.name) === 'agricultor'
                  const nombreLimpio = limpiarNombre(doc.name)
                  const ext = nombreLimpio.split('.').pop().toLowerCase()
                  const icon = ext === 'pdf' ? '📄' : ['jpg','jpeg','png'].includes(ext) ? '🖼️' : ['xls','xlsx'].includes(ext) ? '📊' : '📎'
                  const kb = doc.metadata?.size ? `${(doc.metadata.size / 1024).toFixed(0)} KB` : ''
                  return (
                    <div key={doc.name}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                        esSocio ? 'border-amber-100 bg-amber-50/40' : 'border-gray-100 bg-white hover:border-gray-200'
                      }`}>
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{icon}</span>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{nombreLimpio}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {kb && <span className="text-xs text-gray-400">{kb}</span>}
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                              esSocio
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-[#e8f5d8] text-[#2d6a0d]'
                            }`}>
                              {esSocio ? '🌾 Agricultor' : '🏢 Cooperativa'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => getDocUrl(doc.name)} className="text-xs text-[#4a7a1e] hover:underline font-medium">Ver</button>
                        <button onClick={() => handleEliminarDoc(doc.name)} className="text-xs text-red-400 hover:underline">Eliminar</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

function KPI({ label, value, verde }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100">
      <div className="text-xs font-medium uppercase tracking-wide mb-2 text-gray-400">{label}</div>
      <div className={`text-2xl font-extrabold ${verde ? 'text-[#4a7a1e]' : 'text-gray-900'}`}>{value}</div>
    </div>
  )
}

function EntregasTable({ entregas }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs uppercase tracking-wide text-gray-400 border-b border-gray-50">
          <th className="text-left px-6 py-3">Fecha</th>
          <th className="text-left px-6 py-3">Campaña</th>
          <th className="text-right px-6 py-3">Kg bruto</th>
          <th className="text-right px-6 py-3">Rendim.</th>
          <th className="text-right px-6 py-3">Kg aceite</th>
          <th className="text-left px-6 py-3">Calidad</th>
          <th className="text-left px-6 py-3">Notas</th>
        </tr>
      </thead>
      <tbody>
        {entregas.map((e, i) => (
          <tr key={e.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
            <td className="px-6 py-3 text-gray-700">{new Date(e.fecha + 'T00:00:00').toLocaleDateString('es-ES')}</td>
            <td className="px-6 py-3 text-gray-500 text-xs">{e.campanas?.nombre || '—'}</td>
            <td className="px-6 py-3 text-right font-medium tabular-nums">{e.kg_bruto?.toLocaleString('es-ES')} kg</td>
            <td className="px-6 py-3 text-right text-gray-500 tabular-nums">{e.rendimiento != null ? `${e.rendimiento}%` : '—'}</td>
            <td className="px-6 py-3 text-right text-[#4a7a1e] font-semibold tabular-nums">
              {e.rendimiento ? ((e.kg_bruto * e.rendimiento) / 100).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' kg' : '—'}
            </td>
            <td className="px-6 py-3">
              <span className="bg-[#e8f5d8] text-[#2d6a0d] text-xs font-semibold px-2 py-0.5 rounded">{e.calidad || 'AOVE'}</span>
            </td>
            <td className="px-6 py-3 text-gray-400 text-xs">{e.notas || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Empty({ texto }) {
  return <div className="px-6 py-12 text-center text-gray-400 text-sm">{texto}</div>
}
