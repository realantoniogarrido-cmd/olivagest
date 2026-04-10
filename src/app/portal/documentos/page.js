'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function portalFetch(url, token, options = {}) {
  return fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  })
}

function IconDoc({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}
function IconImg({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}
function IconSheet({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M6 3h12a1 1 0 011 1v16a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" />
    </svg>
  )
}
function IconAttach({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  )
}

function getFileIcon(nombreLimpio) {
  const ext = nombreLimpio.split('.').pop().toLowerCase()
  if (ext === 'pdf') return <IconDoc className="w-5 h-5" />
  if (['jpg','jpeg','png','gif','webp'].includes(ext)) return <IconImg className="w-5 h-5" />
  if (['xls','xlsx','csv'].includes(ext)) return <IconSheet className="w-5 h-5" />
  return <IconAttach className="w-5 h-5" />
}

export default function DocumentosPortalPage() {
  const router = useRouter()
  const tokenRef = useRef(null)
  const fileRef  = useRef(null)

  const [documentos, setDocumentos] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [subiendo,  setSubiendo]  = useState(false)
  const [error,     setError]     = useState('')
  const [exito,     setExito]     = useState('')

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (!session) { router.replace('/portal'); return }
        tokenRef.current = session.access_token
        await cargarDocumentos(session.access_token)
        setLoading(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

  async function cargarDocumentos(token) {
    try {
      const res = await portalFetch('/api/portal/documentos', token)
      if (res.ok) { const { documentos } = await res.json(); setDocumentos(documentos || []) }
    } catch {}
  }

  async function handleSubir(e) {
    const file = e.target.files?.[0]
    if (!file || !tokenRef.current) return
    setSubiendo(true); setError(''); setExito('')
    const formData = new FormData()
    formData.append('file', file)
    const res = await portalFetch('/api/portal/documentos', tokenRef.current, { method: 'POST', body: formData })
    if (res.ok) {
      await cargarDocumentos(tokenRef.current)
      setExito('Documento subido correctamente')
      setTimeout(() => setExito(''), 3000)
    } else {
      const data = await res.json()
      setError(data.error || 'Error al subir el archivo')
    }
    setSubiendo(false); e.target.value = ''
  }

  async function handleEliminar(nombre) {
    const limpio = nombre.replace(/^(coop|socio)__\d+_/, '')
    if (!confirm(`¿Eliminar "${limpio}"?`)) return
    await portalFetch('/api/portal/documentos', tokenRef.current, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre }),
    })
    await cargarDocumentos(tokenRef.current)
  }

  async function handleVer(nombre) {
    const res = await portalFetch(`/api/portal/documentos/url?nombre=${encodeURIComponent(nombre)}`, tokenRef.current)
    if (res.ok) { const { url } = await res.json(); if (url) window.open(url, '_blank') }
  }

  const docsCooperativa = documentos.filter(d => d.origen === 'cooperativa')
  const docsSocio       = documentos.filter(d => d.origen === 'agricultor')

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="animate-spin w-7 h-7 rounded-full border-2 border-[#4ade80] border-t-transparent" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-white">Documentos</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {documentos.length} documento{documentos.length !== 1 ? 's' : ''} compartidos con tu cooperativa
          </p>
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={subiendo}
          className="flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl transition-opacity disabled:opacity-50"
          style={{ backgroundColor: '#4ade80', color: '#0f172a' }}>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {subiendo ? 'Subiendo…' : 'Subir'}
        </button>
        <input ref={fileRef} type="file" className="hidden" onChange={handleSubir}
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx" />
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-xs font-medium"
          style={{ backgroundColor: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}
      {exito && (
        <div className="mb-4 px-4 py-3 rounded-xl text-xs font-medium"
          style={{ backgroundColor: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }}>
          {exito}
        </div>
      )}

      {documentos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
            <IconDoc className="w-7 h-7" style={{ color: 'rgba(255,255,255,0.2)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>Sin documentos todavía</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
            La cooperativa puede compartir documentos contigo aquí
          </p>
        </div>
      ) : (
        <div className="space-y-5">

          {/* De la cooperativa */}
          {docsCooperativa.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  De la cooperativa
                </p>
              </div>
              <div className="space-y-2">
                {docsCooperativa.map(doc => (
                  <DocRow key={doc.nombre} doc={doc} onVer={handleVer} puedeEliminar={false} accentColor="#4ade80" />
                ))}
              </div>
            </section>
          )}

          {/* Subidos por mí */}
          {docsSocio.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Subidos por mí
                </p>
              </div>
              <div className="space-y-2">
                {docsSocio.map(doc => (
                  <DocRow key={doc.nombre} doc={doc} onVer={handleVer} onEliminar={handleEliminar} puedeEliminar accentColor="#f59e0b" />
                ))}
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  )
}

function DocRow({ doc, onVer, onEliminar, puedeEliminar, accentColor }) {
  const kb = doc.size ? `${(doc.size / 1024).toFixed(0)} KB` : ''
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors"
      style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {/* Icono tipo */}
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${accentColor}18`, color: accentColor }}>
        {getFileIcon(doc.nombreLimpio)}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{doc.nombreLimpio}</p>
        {kb && <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>{kb}</p>}
      </div>
      {/* Acciones */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={() => onVer(doc.nombre)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}>
          Ver
        </button>
        {puedeEliminar && (
          <button onClick={() => onEliminar(doc.nombre)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'rgba(248,113,113,0.4)' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.08)'; e.currentTarget.style.color = '#f87171' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(248,113,113,0.4)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
