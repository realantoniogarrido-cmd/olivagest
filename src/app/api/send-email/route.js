import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request) {
  try {
    const { socioNombre, socioEmail, kg, importe, campaña, fecha } = await request.json()

    const { data, error } = await resend.emails.send({
      from: 'OlivaGest <onboarding@resend.dev>',
      to: [socioEmail],
      subject: `Recibo de liquidación - ${campaña}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #78350f; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🫒 OlivaGest</h1>
            <p style="color: #fde68a; margin: 5px 0 0 0;">Recibo de Liquidación</p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb;">
            <p style="font-size: 16px; color: #374151;">Estimado/a <strong>${socioNombre}</strong>,</p>
            <p style="color: #6b7280;">Le enviamos el resumen de su liquidación de aceite de oliva.</p>
            
            <div style="background-color: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <h2 style="color: #78350f; font-size: 18px; margin-top: 0;">Detalles de la Liquidación</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 10px 0; color: #6b7280;">Campaña</td>
                  <td style="padding: 10px 0; font-weight: bold; text-align: right;">${campaña}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 10px 0; color: #6b7280;">Fecha</td>
                  <td style="padding: 10px 0; font-weight: bold; text-align: right;">${fecha}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 10px 0; color: #6b7280;">Kg entregados</td>
                  <td style="padding: 10px 0; font-weight: bold; text-align: right;">${parseFloat(kg).toLocaleString('es-ES')} kg</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-size: 18px;">Importe total</td>
                  <td style="padding: 10px 0; font-weight: bold; text-align: right; color: #16a34a; font-size: 22px;">
                    ${parseFloat(importe).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </td>
                </tr>
              </table>
            </div>

            <p style="color: #6b7280; font-size: 14px;">Si tiene alguna pregunta sobre esta liquidación, contacte con su cooperativa.</p>
          </div>
          
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 0 0 8px 8px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">Generado por OlivaGest · Sistema de gestión de cooperativas oleícolas</p>
          </div>
        </div>
      `,
    })

    if (error) return Response.json({ error }, { status: 400 })
    return Response.json({ success: true, data })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}