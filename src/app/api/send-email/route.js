import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

function buildHtml({ socioNombre, kg, importe, campana, fecha, rendimientoBruto, puntoExtraccion, kgAceite, precioKg, nota }) {
  const rb = parseFloat(rendimientoBruto) || 0
  const pe = parseFloat(puntoExtraccion) || 0
  const rn = Math.max(0, rb - pe)
  const kgAceiteVal = parseFloat(kgAceite) || 0
  const pKg = parseFloat(precioKg) || 0

  const kpiRow = (items) => items.map(({ label, value, highlight }) => `
    <td style="padding:0 6px;">
      <div style="background:${highlight ? '#f0fdf4' : '#f8fafc'};border:1px solid ${highlight ? '#86efac' : '#e2e8f0'};border-radius:8px;padding:12px 16px;text-align:center;min-width:110px;">
        <div style="font-size:11px;color:#64748b;margin-bottom:4px;">${label}</div>
        <div style="font-size:16px;font-weight:700;color:${highlight ? '#16a34a' : '#0f172a'};">${value}</div>
      </div>
    </td>`).join('')

  const kpis = [
    { label: 'Kg aceituna', value: `${parseFloat(kg).toLocaleString('es-ES')} kg` },
    ...(rn > 0 ? [{ label: 'Rendimiento neto', value: `${rn.toFixed(1)}%` }] : []),
    ...(kgAceiteVal > 0 ? [{ label: 'Kg aceite', value: `${kgAceiteVal.toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg` }] : []),
    ...(pKg > 0 ? [{ label: 'Precio / kg aceite', value: `${pKg.toFixed(3)} €/kg` }] : []),
  ]

  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
  <!-- Cabecera -->
  <div style="background:#0f172a;padding:28px 32px;border-radius:10px 10px 0 0;border-left:5px solid #4ade80;">
    <div style="font-size:22px;font-weight:700;color:#ffffff;margin-bottom:2px;">OlivaGest</div>
    <div style="font-size:12px;color:#94a3b8;">Gestión oleícola cooperativa</div>
    <div style="margin-top:14px;font-size:16px;font-weight:600;color:#ffffff;">Liquidación de Campaña ${campana}</div>
  </div>

  <!-- Saludo -->
  <div style="padding:24px 32px 0;">
    <p style="font-size:15px;color:#374151;margin:0 0 6px;">Estimado/a <strong>${socioNombre}</strong>,</p>
    <p style="font-size:14px;color:#6b7280;margin:0 0 20px;">
      Le enviamos el resumen de su liquidación de aceite de oliva correspondiente a la campaña <strong>${campana}</strong>.
      Encontrará el informe completo adjunto a este email en formato PDF.
    </p>
  </div>

  <!-- KPIs -->
  <div style="padding:0 32px 20px;">
    <table style="border-collapse:separate;border-spacing:0;width:100%;" cellpadding="0" cellspacing="6">
      <tr>${kpiRow(kpis)}</tr>
    </table>
  </div>

  <!-- Importe total -->
  <div style="margin:0 32px 24px;background:#f0fdf4;border:2px solid #86efac;border-radius:10px;padding:16px 24px;display:flex;justify-content:space-between;align-items:center;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="font-size:13px;font-weight:700;color:#166534;letter-spacing:0.05em;">IMPORTE TOTAL A PERCIBIR</td>
        <td style="text-align:right;font-size:24px;font-weight:700;color:#16a34a;">
          ${parseFloat(importe).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
        </td>
      </tr>
    </table>
  </div>

  <!-- Detalle -->
  <div style="margin:0 32px 24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 0;color:#64748b;">Campaña</td>
        <td style="padding:8px 0;font-weight:600;text-align:right;color:#0f172a;">${campana}</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 0;color:#64748b;">Fecha de liquidación</td>
        <td style="padding:8px 0;font-weight:600;text-align:right;color:#0f172a;">${fecha}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#64748b;">Kg de aceituna entregados</td>
        <td style="padding:8px 0;font-weight:600;text-align:right;color:#0f172a;">${parseFloat(kg).toLocaleString('es-ES')} kg</td>
      </tr>
    </table>
  </div>

  ${nota ? `<div style="margin:0 32px 24px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;font-size:12px;color:#92400e;">${nota}</div>` : ''}

  <!-- Nota PDF -->
  <div style="margin:0 32px 24px;padding:12px 16px;background:#eff6ff;border-radius:8px;font-size:12px;color:#1e40af;">
    <strong>📎 Informe adjunto:</strong> Encontrará el informe completo con el detalle de sus entregas adjunto a este email.
  </div>

  <!-- Footer -->
  <div style="background:#f1f5f9;padding:16px 32px;border-radius:0 0 10px 10px;text-align:center;">
    <p style="font-size:11px;color:#94a3b8;margin:0;">Generado por <strong>OlivaGest</strong> · Sistema de gestión de cooperativas oleícolas</p>
    <p style="font-size:11px;color:#94a3b8;margin:4px 0 0;">Si tiene alguna pregunta, contacte con su cooperativa.</p>
  </div>
</div>`
}

export async function POST(request) {
  try {
    const {
      socioNombre, socioEmail, kg, importe, campana, fecha,
      rendimientoBruto, puntoExtraccion, kgAceite, precioKg,
      adminEmail, pdfBase64, pdfFilename,
    } = await request.json()

    const htmlBody = buildHtml({ socioNombre, kg, importe, campana, fecha, rendimientoBruto, puntoExtraccion, kgAceite, precioKg })

    const attachments = pdfBase64
      ? [{ filename: pdfFilename || 'liquidacion.pdf', content: pdfBase64 }]
      : []

    // Intento principal: enviar al socio
    let { data, error } = await resend.emails.send({
      from: 'OlivaGest <onboarding@resend.dev>',
      to: [socioEmail],
      subject: `Liquidación campaña ${campana} — ${socioNombre}`,
      html: htmlBody,
      attachments,
    })

    // Si falla por restricción de modo prueba, reenviar al admin con nota
    if (error && error.message?.includes('testing') && adminEmail && adminEmail !== socioEmail) {
      const nota = `<strong>Modo prueba Resend:</strong> Este email iba dirigido a <strong>${socioEmail}</strong>.
        Para enviar a todos los socios, verifica tu dominio en <a href="https://resend.com/domains" style="color:#92400e;">resend.com/domains</a>.`
      const htmlAdmin = buildHtml({ socioNombre, kg, importe, campana, fecha, rendimientoBruto, puntoExtraccion, kgAceite, precioKg, nota })
      const retry = await resend.emails.send({
        from: 'OlivaGest <onboarding@resend.dev>',
        to: [adminEmail],
        subject: `[PRUEBA] Liquidación campaña ${campana} — ${socioNombre}`,
        html: htmlAdmin,
        attachments,
      })
      if (retry.error) return Response.json({ error: retry.error }, { status: 400 })
      return Response.json({ success: true, testMode: true })
    }

    if (error) return Response.json({ error }, { status: 400 })
    return Response.json({ success: true, data })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
