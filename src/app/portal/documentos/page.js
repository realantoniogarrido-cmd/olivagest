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

export default function DocumentosPortalPage() {
  const router = useRouter()
  const tokenRef = useRef(null)

  const [documentos, setDocumentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

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
      if (res.ok) {
        const { documentos } = await res.json()
        setDocumentos(documentos || [])
      }
    } catch {}
  }

  async function handleSubir(e) {
    const file = e.target.files?.[0]
    if (!file || !tokenRef.current) return
    setSubiendo(true); setError('')

    const formData = new FormData()
    formData.append('file', file)
    const res = await portalFetch('/api/portal/documentos', tokenRef.current, {
      method: 'POST', body: formData,
    })
    if (res.ok) {
      await cargarDocumentos(tokenRef.current)
    } else {
      const { error } = await res.json()
      setError(error || 'Error al subir el archivo')
    }
    setSubiendo(false); e.target.value = ''
  }

  async function handleEliminar(nombre) {
    if (!confirm(`¿Eliminar "${nombre.replace(/^socio__\d+_/, '')}"?`)) return
    const res = await portalFetch('/api/portal/documentos', tokenRef.current, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre }),
    })
    if (res.ok) await cargarDocumentos(tokenRef.current)
  }

  async function handleVer(nombre) {
    // Obtener URL firmada via supabase client (el agricultor tiene acceso al bucket si las políticas lo permiten)
    // O podemos hacer una ruta API de descarga
    const res = await portalFetch(`/api/portal/documentos/url?nombre=${encodeURIComponent(nombre)}`, tokenRef.current)
    if (res.ok) {
      const { url } = await res.json()
      if (url) window.open(url, '_blank')
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="animate-spin w-8 h-8 rounded-full border-2 border-[#4ade80] border-t-transparent" />
    </div>
  )

  const docsCooperativa = documentos.filter(d => d.origen === 'cooperativa')
  const docsSocio       = documentos.filter(d => d.origen === 'agricultor')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Mis documentos</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Documentos compartidos con tu cooperativa
        </p>
      </div>

      {/* Subir */}
      <div className="rounded-2xl p-5 mb-6"
        style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-semibold">Subir documento</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              PDF, Word, imágenes, Excel — visible también para la cooperativa
            </p>
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={subiendo}
            className="flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: '#4ade80', color: '#0f172a' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {subiendo ? 'Subiendo…' : 'Subir'}
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={handleSubir}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx" />
        </div>
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </div>

      {/* Documentos de la cooperativa */}
      {docsCooperativa.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-widest mb-3"
            style={{ color: 'rgba(255,255,255,0.3)' }}>
            📋 De la cooperativa
          </p>
          <div className="space-y-2">
            {docsCooperativa.map(doc => (
              <DocItem key={doc.nombre} doc={doc} onVer={handleVer} puedeEliminar={false} />
            ))}
          </div>
        </div>
      )}

      {/* Documentos del agricultor */}
      {docsSocio.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-widest mb-3"
            style={{ color: 'rgba(255,255,255,0.3)' }}>
            🌾 Subidos por mí
          </p>
          <div className="space-y-2">
            {docsSocio.map(doc => (
              <DocItem key={doc.nombre} doc={doc} onVer={handleVer} onEliminar={handleEliminar} puedeEliminar />
            ))}
          </div>
        </div>
      )}

      {documentos.length === 0 && (
        <div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.25)' }}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm font-medium">No hay documentos todavía</p>
          <p className="text-xs mt-1">La cooperativa puede compartir documentos contigo aquí</p>
        </div>
      )}
    </div>
  )
}

function DocItem({ doc, onVer, onEliminar, puedeEliminar }) {
  const ext = doc.nombreLimpio.split('.').pop().toLowerCase()
  const icon = ext === 'pdf' ? '📄' : ['jpg','jpeg','png'].includes(ext) ? '🖼️' : ['xls','xlsx'].includes(ext) ? '📊' : '📎'
  const kb = doc.size ? `${(doc.size / 1024).toFixed(0)} KB` : ''

  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl"
      style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <div>
          <p className="text-sm font-medium text-white">{doc.nombreLimpio}</p>
          {kb && <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{kb}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => onVer(doc.nombre)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          style={{ backgroundColor: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
          Ver
        </button>
        {puedeEliminar && (
          <button onClick={() => onEliminar(doc.nombre)}
            className="text-xs" style={{ color: 'rgba(248,113,113,0.6)' }}>
            Eliminar
          </button>
        )}
      </div>
    </div>
  )
}
