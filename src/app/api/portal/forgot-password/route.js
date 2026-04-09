import { Resend } from 'resend'
import { getAdminClient } from '@/lib/portalApiHelper'

const resend = new Resend(process.env.RESEND_API_KEY)

function buildResetHtml({ resetLink, appUrl }) {
  return `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;">

  <!-- Cabecera -->
  <div style="background:#0f172a;padding:32px;border-radius:12px 12px 0 0;border-left:5px solid #4ade80;">
    <div style="font-size:24px;font-weight:700;color:#ffffff;margin-bottom:2px;letter-spacing:-0.5px;">OlivaGest</div>
    <div style="font-size:12px;color:#94a3b8;margin-bottom:16px;">Gestión oleícola cooperativa</div>
    <div style="font-size:18px;font-weight:600;color:#ffffff;">Restablecer contraseña</div>
  </div>

  <!-- Cuerpo -->
  <div style="padding:32px;border:1px solid #e2e8f0;border-top:none;">
    <p style="font-size:15px;color:#374151;margin:0 0 8px;">Hemos recibido una solicitud para restablecer tu contraseña del Portal del Socio.</p>
    <p style="font-size:14px;color:#6b7280;margin:0 0 24px;line-height:1.6;">
      Pulsa el botón de abajo para crear una nueva contraseña. El enlace es válido durante <strong>1 hora</strong>.
    </p>

    <!-- Botón -->
    <div style="text-align:center;margin:28px 0;">
      <a href="${resetLink}"
         style="display:inline-block;background:#0f172a;color:#ffffff;font-size:15px;font-weight:600;
                padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:0.01em;
                border-left:4px solid #4ade80;">
        Crear nueva contraseña →
      </a>
    </div>

    <!-- Aviso seguridad -->
    <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;margin:20px 0;">
      <p style="font-size:12px;color:#92400e;margin:0 0 4px;font-weight:700;">¿No has solicitado este cambio?</p>
      <p style="font-size:12px;color:#a16207;margin:0;line-height:1.5;">
        Ignora este email. Tu contraseña actual no cambiará hasta que uses este enlace.
      </p>
    </div>

    <p style="font-size:11px;color:#9ca3af;margin:16px 0 0;">
      Si el botón no funciona, copia y pega este enlace en tu navegador:<br/>
      <span style="color:#4ade80;word-break:break-all;">${resetLink}</span>
    </p>
  </div>

  <!-- Footer -->
  <div style="background:#f1f5f9;padding:16px 32px;border-radius:0 0 12px 12px;text-align:center;border:1px solid #e2e8f0;border-top:none;">
    <p style="font-size:11px;color:#94a3b8;margin:0;"><strong>OlivaGest</strong> · Portal del Socio</p>
    <p style="font-size:11px;color:#94a3b8;margin:4px 0 0;">
      <a href="${appUrl}/portal" style="color:#4ade80;text-decoration:none;">${appUrl}/portal</a>
    </p>
  </div>
</div>`
}

export async function POST(request) {
  try {
    const { email, adminEmail } = await request.json()
    if (!email) return Response.json({ error: 'Email requerido' }, { status: 400 })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://olivagest.com'
    const adminClient = getAdminClient()

    // Verificar que el email existe en socios
    const { data: socio } = await adminClient
      .from('socios')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .single()

    // Si no existe en socios, devolvemos éxito igualmente (no revelar qué emails existen)
    if (!socio) {
      return Response.json({ success: true })
    }

    // Generar link de recuperación via admin (no envía el email de Supabase)
    const { data, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: email.trim().toLowerCase(),
      options: { redirectTo: `${baseUrl}/portal/reset-password` },
    })

    if (linkError) return Response.json({ error: linkError.message }, { status: 400 })

    const resetLink = data?.properties?.action_link
    if (!resetLink) return Response.json({ error: 'No se pudo generar el enlace' }, { status: 500 })

    // Enviar email branded con Resend
    const html = buildResetHtml({ resetLink, appUrl: baseUrl })

    const { error: emailError } = await resend.emails.send({
      from: 'OlivaGest <portal@olivagest.com>',
      to: [email],
      subject: 'Restablecer contraseña — OlivaGest',
      html,
    })

    if (emailError) return Response.json({ error: emailError.message }, { status: 400 })
    return Response.json({ success: true })

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
