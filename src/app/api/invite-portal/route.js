import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

function buildInviteHtml({ socioNombre, portalUrl }) {
  return `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;">

  <!-- Cabecera -->
  <div style="background:#0f172a;padding:32px;border-radius:12px 12px 0 0;border-left:5px solid #4ade80;">
    <div style="font-size:24px;font-weight:700;color:#ffffff;margin-bottom:2px;letter-spacing:-0.5px;">OlivaGest</div>
    <div style="font-size:12px;color:#94a3b8;margin-bottom:16px;">Gestión oleícola cooperativa</div>
    <div style="font-size:18px;font-weight:600;color:#ffffff;">Acceso al Portal del Socio</div>
  </div>

  <!-- Cuerpo -->
  <div style="padding:32px;border:1px solid #e2e8f0;border-top:none;">
    <p style="font-size:15px;color:#374151;margin:0 0 8px;">Hola, <strong>${socioNombre}</strong>.</p>
    <p style="font-size:14px;color:#6b7280;margin:0 0 24px;line-height:1.6;">
      Tu cooperativa te ha habilitado el acceso al <strong>Portal del Socio de OlivaGest</strong>, donde podrás consultar
      tus <strong>entregas de aceituna</strong>, <strong>liquidaciones</strong> y el estado de tus <strong>parcelas</strong>.
    </p>

    <!-- Pasos -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:18px 20px;margin-bottom:24px;">
      <p style="font-size:13px;font-weight:700;color:#0f172a;margin:0 0 12px;">Cómo activar tu acceso (1 minuto):</p>
      <div style="display:flex;align-items:flex-start;margin-bottom:10px;">
        <span style="background:#4ade80;color:#0f172a;font-weight:700;font-size:11px;border-radius:50%;width:20px;height:20px;
                     display:inline-flex;align-items:center;justify-content:center;margin-right:10px;flex-shrink:0;">1</span>
        <p style="font-size:13px;color:#374151;margin:0;">Pulsa el botón de abajo para ir al portal</p>
      </div>
      <div style="display:flex;align-items:flex-start;margin-bottom:10px;">
        <span style="background:#4ade80;color:#0f172a;font-weight:700;font-size:11px;border-radius:50%;width:20px;height:20px;
                     display:inline-flex;align-items:center;justify-content:center;margin-right:10px;flex-shrink:0;">2</span>
        <p style="font-size:13px;color:#374151;margin:0;">Haz clic en <strong>"Crear cuenta"</strong></p>
      </div>
      <div style="display:flex;align-items:flex-start;">
        <span style="background:#4ade80;color:#0f172a;font-weight:700;font-size:11px;border-radius:50%;width:20px;height:20px;
                     display:inline-flex;align-items:center;justify-content:center;margin-right:10px;flex-shrink:0;">3</span>
        <p style="font-size:13px;color:#374151;margin:0;">Escribe tu email y elige una contraseña — ¡ya está!</p>
      </div>
    </div>

    <!-- Botón de acceso -->
    <div style="text-align:center;margin:24px 0;">
      <a href="${portalUrl}"
         style="display:inline-block;background:#0f172a;color:#ffffff;font-size:15px;font-weight:600;
                padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:0.01em;
                border-left:4px solid #4ade80;">
        Ir al Portal del Socio →
      </a>
    </div>

    <!-- Info sesión -->
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:14px 18px;margin:20px 0;">
      <p style="font-size:12px;color:#166534;margin:0 0 4px;font-weight:700;">Tu sesión queda guardada</p>
      <p style="font-size:12px;color:#16a34a;margin:0;line-height:1.5;">
        Una vez crees tu cuenta, la próxima vez solo necesitas tu email y contraseña para entrar directamente.
        Sin más emails ni enlaces.
      </p>
    </div>

    <p style="font-size:12px;color:#9ca3af;margin:16px 0 0;">
      Si no esperabas este email, puedes ignorarlo.
    </p>
  </div>

  <!-- Footer -->
  <div style="background:#f1f5f9;padding:16px 32px;border-radius:0 0 12px 12px;text-align:center;border:1px solid #e2e8f0;border-top:none;">
    <p style="font-size:11px;color:#94a3b8;margin:0;"><strong>OlivaGest</strong> · Portal del Socio</p>
    <p style="font-size:11px;color:#94a3b8;margin:4px 0 0;">
      <a href="${portalUrl}" style="color:#4ade80;text-decoration:none;">${portalUrl}</a>
    </p>
  </div>

</div>`
}

export async function POST(request) {
  try {
    const { socioEmail, socioNombre, adminEmail } = await request.json()

    if (!socioEmail) {
      return Response.json({ error: 'Falta el email del socio' }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://olivagest.com'
    const portalUrl = `${baseUrl}/portal`
    const htmlBody = buildInviteHtml({ socioNombre: socioNombre || 'socio', portalUrl })

    // Enviar email con Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'OlivaGest <portal@olivagest.com>',
      to: [socioEmail],
      subject: `Tu acceso al Portal del Socio — OlivaGest`,
      html: htmlBody,
    })

    if (emailError) return Response.json({ error: emailError.message }, { status: 400 })
    return Response.json({ success: true, data: emailData })

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
