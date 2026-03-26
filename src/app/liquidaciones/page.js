'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'
import { useRouter } from 'next/navigation'

export default function LiquidacionesPage() {
  const router = useRouter()
  const [cooperativa, setCooperativa] = useState('')
  const [liquidaciones, setLiquidaciones] = useState([])
  const [campana, setCampana] = useState(null)
  const [loading, setLoading] = useState(true)
  const [precioKg, setPrecioKg] = useState('')
  const [calculando, setCalculando] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function cargarDatos() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: { user } } = await supabase.auth.getUser()
      setCooperativa(user?.user_metadata?.cooperativa || 'Mi Cooperativa')
      const { data: campanaData } = await supabase.from('campanas').select('*').eq('activa', true).single()
      setCampana(campanaData)
      if (campanaData) await cargarLiquidaciones(campanaData.id)
      setLoading(false)
    }
    cargarDatos()
  }, [router])

  async function cargarLiquidaciones(campanaId) {
    const { data } = await supabase.from('liquidaciones').select('*, socios(nombre, dni)').eq('campana_id', campanaId).order('importe_total', { ascending: false })
    setLiquidaciones(data || [])
  }

  async function calcularLiquidaciones() {
    if (!precioKg || parseFloat(precioKg) <= 0) { setErrorMsg('Introduce el precio por kg de aceite para calcular'); return }
    if (!campana) { setErrorMsg('No hay campaña activa'); return }
    setCalculando(true)
    setErrorMsg('')
    const precio = parseFloat(precioKg)
    const { data: entregas, error } = await supabase.from('entregas').select('socio_id, kg_bruto, rendimiento').eq('campana_id', campana.id)
    if (error || !entregas?.length) { setErrorMsg('No hay entregas registradas en esta campaña'); setCalculando(false); return }
    const porSocio = {}
    for (const e of entregas) {
      if (!porSocio[e.socio_id]) porSocio[e.socio_id] = { socio_id: e.socio_id, kg_aceituna: 0, kg_aceite: 0 }
      porSocio[e.socio_id].kg_aceituna += e.kg_bruto || 0
      if (e.rendimiento) porSocio[e.socio_id].kg_aceite += (e.kg_bruto * e.rendimiento) / 100
    }
    const ahora = new Date().toISOString().split('T')[0]
    let errores = 0
    for (const [socioId, datos] of Object.entries(porSocio)) {
      const importe = parseFloat((datos.kg_aceite * precio).toFixed(2))
      const { data: existente } = await supabase.from('liquidaciones').select('id').eq('campana_id', campana.id).eq('socio_id', socioId).single()
      if (existente) {
        const { error: e } = await supabase.from('liquidaciones').update({ kg_aceituna: datos.kg_aceituna, kg_aceite: parseFloat(datos.kg_aceite.toFixed(2)), precio_kg: precio, importe_total: importe, fecha_liquidacion: ahora }).eq('id', existente.id)
        if (e) errores++
      } else {
        const { error: e } = await supabase.from('liquidaciones').insert([{ campana_id: campana.id, socio_id: socioId, kg_aceituna: datos.kg_aceituna, kg_aceite: parseFloat(datos.kg_aceite.toFixed(2)), precio_kg: precio, importe_total: importe, fecha_liquidacion: ahora }])
        if (e) errores++
      }
    }
    if (errores > 0) { setErrorMsg(`Hubo ${errores} error(es) al guardar`) } else {
      setSuccessMsg(`Liquidacion calculada para ${Object.keys(porSocio).length} socios a ${precio} €/kg`)
      setTimeout(() => setSuccessMsg(''), 4000)
    }
    await cargarLiquidaciones(campana.id)
    setCalculando(false)
  }

  async function exportarPDF() {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF()
    const fecha = new Date().toLocaleDateString('es-ES')
    doc.setFillColor(26, 46, 26)
    doc.rect(0, 0, 210, 30, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('OlivaGest', 14, 13)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Gestion de cooperativas oleicolas', 14, 20)
    doc.text(`Generado el ${fecha}`, 210 - 14, 20, { align: 'right' })
    doc.setTextColor(26, 46, 26)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(`Liquidacion - ${campana?.nombre || 'Campana activa'}`, 14, 42)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    const totalKgAceituna = liquidaciones.reduce((s, l) => s + (l.kg_aceituna || 0), 0)
    const totalKgAceite = liquidaciones.reduce((s, l) => s + (l.kg_aceite || 0), 0)
    const totalImporte = liquidaciones.reduce((s, l) => s + (l.importe_total || 0), 0)
    doc.text(`Total aceituna: ${(totalKgAceituna / 1000).toFixed(1)} t  |  Total aceite: ${(totalKgAceite / 1000).toFixed(2)} t  |  Importe total: ${totalImporte.toLocaleString('es-ES', { minimumFractionDigits: 2 })} EUR`, 14, 50)
    autoTable(doc, {
      startY: 56,
      head: [['Socio', 'DNI', 'Kg aceituna', 'Kg aceite', 'Precio/kg', 'Importe total']],
      body: liquidaciones.map(l => [l.socios?.nombre || '—', l.socios?.dni || '—', `${l.kg_aceituna?.toLocaleString('es-ES')} kg`, `${l.kg_aceite?.toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg`, `${l.precio_kg?.toLocaleString('es-ES', { minimumFractionDigits: 2 })} EUR`, `${l.importe_total?.toLocaleString('es-ES', { minimumFractionDigits: 2 })} EUR`]),
      foot: [['TOTAL', '', `${(totalKgAceituna / 1000).toFixed(1)} t`, `${(totalKgAceite / 1000).toFixed(2)} t`, '', `${totalImporte.toLocaleString('es-ES', { minimumFractionDigits: 2 })} EUR`]],
      headStyles: { fillColor: [26, 46, 26], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      footStyles: { fillColor: [240, 247, 232], textColor: [26, 46, 26], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [249, 250, 248] },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } },
    })
    doc.save(`liquidacion_${campana?.nombre?.replace(/\//g, '-') || 'campana'}.pdf`)
  }

  const totalImporte = liquidaciones.reduce((sum, l) => sum + (l.importe_total || 0), 0)
  const totalKgAceite = liquidaciones.reduce((sum, l) => sum + (l.kg_aceite || 0), 0)
  const totalKgAceituna = liquidaciones.reduce((sum, l) => sum + (l.kg_aceituna || 0), 0)

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
            <h1 className="text-base font-bold text-gray-900">Liquidaciones</h1>
            <p className="text-xs text-gray-400">Campaña 2025/2026</p>
          </div>
          {liquidaciones.length > 0 && (
            <button onClick={exportarPDF}
              className="flex items-center gap-2 bg-white border border-gray-200 hover:border-[#7ab648] hover:text-[#4a7a1e] text-gray-600 text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Exportar PDF
            </button>
          )}
        </header>

        <div className="p-7">
          <div className="bg-[#1a2e1a] rounded-xl p-6 mb-6">
            <h2 className="text-white font-bold text-sm mb-1">Calcular liquidación de la campaña</h2>
            <p className="text-white/50 text-xs mb-5">Introduce el precio de venta del aceite y OlivaGest calculará automáticamente lo que corresponde a cada socio.</p>
            <div className="flex items-end gap-4">
              <div>
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wide mb-1.5">Precio por kg de aceite</label>
                <div className="flex items-center gap-2">
                  <input type="number" value={precioKg} onChange={e => setPrecioKg(e.target.value)} placeholder="Ej: 3.80" min="0" step="0.01"
                    className="w-36 px-3 py-2.5 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7ab648] bg-white border border-white/20" />
                  <span className="text-white/60 text-sm font-medium">EUR / kg aceite</span>
                </div>
              </div>
              <button onClick={calcularLiquidaciones} disabled={calculando}
                className="bg-[#7ab648] hover:bg-[#89c855] text-white text-sm font-bold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap">
                {calculando ? 'Calculando...' : 'Calcular y guardar'}
              </button>
            </div>
            {errorMsg && <div className="mt-4 bg-red-900/30 border border-red-500/30 text-red-300 text-sm px-4 py-2.5 rounded-lg">{errorMsg}</div>}
            {successMsg && <div className="mt-4 bg-[#7ab648]/20 border border-[#7ab648]/40 text-[#c5e09a] text-sm font-medium px-4 py-2.5 rounded-lg">{successMsg}</div>}
          </div>

          {liquidaciones.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl p-5 border border-gray-100">
                <div className="text-xs font-medium uppercase tracking-wide mb-2 text-gray-400">Total a pagar</div>
                <div className="text-2xl font-extrabold tracking-tight text-gray-900">{totalImporte.toLocaleString('es-ES', { minimumFractionDigits: 2 })}<span className="text-sm font-medium ml-1 text-gray-400">EUR</span></div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-gray-100">
                <div className="text-xs font-medium uppercase tracking-wide mb-2 text-gray-400">Kg aceituna total</div>
                <div className="text-2xl font-extrabold tracking-tight text-gray-900">{(totalKgAceituna / 1000).toFixed(1)}<span className="text-sm font-medium ml-1 text-gray-400">t</span></div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-gray-100">
                <div className="text-xs font-medium uppercase tracking-wide mb-2 text-gray-400">Kg aceite producido</div>
                <div className="text-2xl font-extrabold tracking-tight text-gray-900">{(totalKgAceite / 1000).toFixed(2)}<span className="text-sm font-medium ml-1 text-gray-400">t</span></div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900">Liquidación por socio</h2>
              {liquidaciones.length > 0 && <span className="text-xs text-gray-400">{liquidaciones.length} socios</span>}
            </div>
            {liquidaciones.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="text-gray-500 text-sm font-medium mb-1">Sin liquidaciones todavía</div>
                <div className="text-gray-400 text-xs">Registra entregas y luego usa el panel de arriba para calcular</div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-gray-400 border-b border-gray-50">
                    <th className="text-left px-6 py-3">Socio</th>
                    <th className="text-left px-6 py-3">DNI</th>
                    <th className="text-right px-6 py-3">Kg aceituna</th>
                    <th className="text-right px-6 py-3">Kg aceite</th>
                    <th className="text-right px-6 py-3">Precio/kg</th>
                    <th className="text-right px-6 py-3">Importe total</th>
                    <th className="text-left px-6 py-3">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {liquidaciones.map((l, i) => (
                    <tr key={l.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-6 py-3.5 font-semibold text-gray-900">{l.socios?.nombre || '—'}</td>
                      <td className="px-6 py-3.5 text-gray-400 text-xs font-mono">{l.socios?.dni || '—'}</td>
                      <td className="px-6 py-3.5 text-right text-gray-600 tabular-nums">{l.kg_aceituna?.toLocaleString('es-ES')} kg</td>
                      <td className="px-6 py-3.5 text-right text-gray-600 tabular-nums">{l.kg_aceite?.toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg</td>
                      <td className="px-6 py-3.5 text-right text-gray-500 tabular-nums">{l.precio_kg?.toLocaleString('es-ES', { minimumFractionDigits: 2 })} EUR</td>
                      <td className="px-6 py-3.5 text-right tabular-nums">
                        <span className="font-bold text-[#1a2e1a] text-base">{l.importe_total?.toLocaleString('es-ES', { minimumFractionDigits: 2 })} EUR</span>
                      </td>
                      <td className="px-6 py-3.5 text-gray-400 text-xs">{l.fecha_liquidacion ? new Date(l.fecha_liquidacion + 'T00:00:00').toLocaleDateString('es-ES') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-100 bg-gray-50">
                    <td className="px-6 py-3.5 font-bold text-gray-700 text-xs uppercase tracking-wide" colSpan={2}>TOTAL</td>
                    <td className="px-6 py-3.5 text-right font-bold text-gray-700 tabular-nums text-xs">{(totalKgAceituna / 1000).toFixed(1)} t</td>
                    <td className="px-6 py-3.5 text-right font-bold text-gray-700 tabular-nums text-xs">{(totalKgAceite / 1000).toFixed(2)} t</td>
                    <td></td>
                    <td className="px-6 py-3.5 text-right">
                      <span className="font-extrabold text-[#1a2e1a] text-lg tabular-nums">{totalImporte.toLocaleString('es-ES', { minimumFractionDigits: 2 })} EUR</span>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}