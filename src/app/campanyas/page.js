'use client'
import { useState, useEffect } from 'react'
import { supabase, getUserId } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function CampanyasPage() {
  const [datos, setDatos] = useState([])
  const [liquidaciones, setLiquidaciones] = useState([])
  const [campanyaSeleccionada, setCampanyaSeleccionada] = useState(null)

  useEffect(() => {
    fetchDatos()
  }, [])

  async function fetchDatos() {
    const userId = await getUserId()
    const { data: liqs } = await supabase
      .from('liquidaciones')
      .select('*, socios(nombre)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    setLiquidaciones(liqs || [])

    // Agrupar por campaña
    const porCampaña = {}
    for (const liq of liqs || []) {
      const c = liq.campaña || 'Sin campaña'
      if (!porCampaña[c]) {
        porCampaña[c] = { campaña: c, kg_totales: 0, importe_total: 0, num_socios: 0, precio_medio: 0, precios: [] }
      }
      porCampaña[c].kg_totales += parseFloat(liq.kg_totales || 0)
      porCampaña[c].importe_total += parseFloat(liq.importe_total || 0)
      porCampaña[c].num_socios += 1
      porCampaña[c].precios.push(parseFloat(liq.precio_kg || 0))
    }

    const resumen = Object.values(porCampaña).map(c => ({
      ...c,
      precio_medio: c.precios.length ? (c.precios.reduce((a, b) => a + b, 0) / c.precios.length).toFixed(3) : 0,
    })).sort((a, b) => b.campaña.localeCompare(a.campaña))

    setDatos(resumen)
    if (resumen.length > 0) setCampanyaSeleccionada(resumen[0].campaña)
  }

  const liqsCampaña = liquidaciones.filter(l => l.campaña === campanyaSeleccionada)
  const totalKg = datos.reduce((s, d) => s + d.kg_totales, 0)
  const totalImporte = datos.reduce((s, d) => s + d.importe_total, 0)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Histórico de Campañas</h1>
      <p className="text-gray-500 mb-6">Comparativa de rendimiento por temporada</p>

      {/* Totales globales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <p className="text-sm text-amber-700 font-medium">Total campañas</p>
          <p className="text-3xl font-bold text-amber-900 mt-1">{datos.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <p className="text-sm text-green-700 font-medium">Kg totales históricos</p>
          <p className="text-3xl font-bold text-green-900 mt-1">{totalKg.toLocaleString('es-ES')} kg</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <p className="text-sm text-blue-700 font-medium">Importe total histórico</p>
          <p className="text-3xl font-bold text-blue-900 mt-1">
            {totalImporte.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
      </div>

      {/* Gráfica comparativa */}
      {datos.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Comparativa por campaña</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={datos}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="campaña" />
              <YAxis yAxisId="left" orientation="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip formatter={(value, name) => {
                if (name === 'Importe (€)') return [value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }), name]
                if (name === 'Kg totales') return [value.toLocaleString('es-ES') + ' kg', name]
                return [value, name]
              }} />
              <Legend />
              <Bar yAxisId="left" dataKey="kg_totales" name="Kg totales" fill="#92400e" radius={[4,4,0,0]} />
              <Bar yAxisId="right" dataKey="importe_total" name="Importe (€)" fill="#16a34a" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla resumen por campaña */}
      <div className="bg-white rounded-xl shadow overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left p-4">Campaña</th>
              <th className="text-right p-4">Nº socios</th>
              <th className="text-right p-4">Kg totales</th>
              <th className="text-right p-4">Precio medio</th>
              <th className="text-right p-4">Importe total</th>
              <th className="text-center p-4">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {datos.map(d => (
              <tr key={d.campaña} className={`border-t border-gray-100 hover:bg-gray-50 cursor-pointer ${campanyaSeleccionada === d.campaña ? 'bg-amber-50' : ''}`}>
                <td className="p-4 font-bold text-gray-900">{d.campaña}</td>
                <td className="p-4 text-right text-gray-700">{d.num_socios}</td>
                <td className="p-4 text-right text-gray-700">{d.kg_totales.toLocaleString('es-ES')} kg</td>
                <td className="p-4 text-right text-gray-700">{d.precio_medio} €/kg</td>
                <td className="p-4 text-right font-bold text-green-700">
                  {d.importe_total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </td>
                <td className="p-4 text-center">
                  <button
                    onClick={() => setCampanyaSeleccionada(d.campaña)}
                    className="text-xs bg-amber-700 text-white px-3 py-1 rounded-lg hover:bg-amber-800"
                  >
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
            {datos.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">No hay campañas registradas</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detalle campaña seleccionada */}
      {campanyaSeleccionada && liqsCampaña.length > 0 && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="p-4 bg-amber-700">
            <h2 className="text-white font-bold text-lg">Detalle campaña: {campanyaSeleccionada}</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left p-4">Socio</th>
                <th className="text-right p-4">Kg entregados</th>
                <th className="text-right p-4">Precio €/kg</th>
                <th className="text-right p-4">Importe</th>
              </tr>
            </thead>
            <tbody>
              {liqsCampaña.map(liq => (
                <tr key={liq.id} className="border-t border-gray-100">
                  <td className="p-4 font-medium text-gray-900">{liq.socios?.nombre}</td>
                  <td className="p-4 text-right text-gray-700">{parseFloat(liq.kg_totales).toLocaleString('es-ES')} kg</td>
                  <td className="p-4 text-right text-gray-700">{parseFloat(liq.precio_kg).toFixed(3)} €</td>
                  <td className="p-4 text-right font-bold text-green-700">
                    {parseFloat(liq.importe_total).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}