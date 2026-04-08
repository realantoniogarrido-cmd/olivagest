import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// Cliente admin con service role key (solo en server-side)
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada en .env.local')
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

function buildInviteHtml({ socioNombre, magicLink, appUrl }) {
  return `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;">

  <!-- Cabecera -->
  <div style="background:#0f172a;padding:32px;border-radius:12px 12px 0 0;border-left:5px solid #4ade80;">
    <div style="font-size:24px;font-weight:700;color:#ffffff;margin-bottom:2px;letter-spacing:-0.5px;">OlivaGest</div>
    <div style="font-size:12px;color:#94a3b8;margin-bottom:16px;">Gestión oleícola cooperativa</div>
    <div style="font-size:18px;font-weight:600;color:#ffffff;">Tu acceso al Portal del Socio</div>
  </div>

  <!-- Cuerpo -->
  <div style="padding:32px;border:1px solid #e2e8f0;border-top:none;">
    <p style="font-size:15px;color:#374151;margin:0 0 8px;">Hola, <strong>${socioNombre}</strong>.</p>
    <p style="font-size:14px;color:#6b7280;margin:0 0 24px;line-height:1.6;">
      Tu cooperativa te ha habilitado el acceso al Portal del Socio de OlivaGest, donde podrás consultar
      tus <strong>entregas</strong>, <strong>liquidaciones</strong> y el estado de tus <strong>parcelas</strong>.
    </p>

    <!-- Botón de acceso -->
    <div style="text-align:center;margin:28px 0;">
      <a href="${magicLink}"
         style="display:inline-block;background:#0f172a;color:#ffffff;font-size:15px;font-weight:600;
                padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:0.01em;
                border-left:4px solid #4ade80;">
        Acceder al portal →
      </a>
    </div>

    <!-- Info sesión -->
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:14px 18px;margin:20px 0;">
      <p style="font-size:12px;color:#166534;margin:0 0 6px;font-weight:700;">Una vez que accedas</p>
      <p style="font-size:12px;color:#16a34a;margin:0;line-height:1.5;">
        Tu sesión quedará guardada en tu dispositivo durante meses. La próxima vez entrarás directamente al portal sin necesitar un nuevo enlace.
      </p>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;margin:12px 0;">
      <p style="font-size:11px;color:#94a3b8;margin:0;">
        El enlace de este email es de un solo uso y caduca en 1 hora. Si no lo usas a tiempo, puedes solicitar uno nuevo en <a href="${appUrl}/portal" style="color:#64748b;">${appUrl}/portal</a>
      </p>
    </div>

    <p style="font-size:12px;color:#9ca3af;margin:16px 0 0;">
      Si no esperabas este email, puedes ignorarlo. Tu cuenta no cambiará hasta que hagas clic en el enlace.
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
    const { socioEmail, socioNombre, appUrl, adminEmail } = await request.json()

    if (!socioEmail) {
      return Response.json({ error: 'Falta el email del socio' }, { status: 400 })
    }

    // 1. Generar magic link sin enviar el email de Supabase
    // Usar siempre la URL pública (NEXT_PUBLIC_APP_URL) para que el link funcione
    // en cualquier dispositivo, no solo en la máquina del admin
    const supabaseAdmin = getAdminClient()
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || appUrl || 'http://localhost:3000'
    const redirectTo = `${baseUrl}/portal/callback`

    const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: socioEmail,
      options: { redirectTo },
    })

    if (linkError) {
      return Response.json({ error: linkError.message }, { status: 400 })
    }

    const magicLink = data?.properties?.action_link
    if (!magicLink) {
      return Response.json({ error: 'No se pudo generar el enlace de acceso' }, { status: 500 })
    }

    // 2. Enviar email con Resend (branding OlivaGest)
    const htmlBody = buildInviteHtml({ socioNombre, magicLink, appUrl: appUrl || 'http://localhost:3000' })

    let { data: emailData, error: emailError } = await resend.emails.send({
      from: 'OlivaGest <onboarding@resend.dev>',
      to: [socioEmail],
      subject: `Tu acceso al Portal del Socio — OlivaGest`,
      html: htmlBody,
    })

    // Fallback modo prueba Resend
    if (emailError && emailError.message?.includes('testing') && adminEmail && adminEmail !== socioEmail) {
      const htmlAdmin = buildInviteHtml({ socioNombre, magicLink, appUrl: appUrl || 'http://localhost:3000' })
      const retry = await resend.emails.send({
        from: 'OlivaGest <onboarding@resend.dev>',
        to: [adminEmail],
        subject: `[PRUEBA] Acceso portal para ${socioNombre} (${socioEmail})`,
        html: `<div style="background:#fef9c3;border:1px solid #fde68a;padding:12px 16px;border-radius:8px;font-family:Arial;font-size:12px;color:#92400e;margin-bottom:16px;">
          <strong>Modo prueba Resend</strong> — Este email iba dirigido a <strong>${socioEmail}</strong>.
          Verifica tu dominio en <a href="https://resend.com/domains" style="color:#92400e;">resend.com/domains</a> para enviar a todos los socios.
        </div>${htmlAdmin}`,
      })
      if (retry.error) return Response.json({ error: retry.error }, { status: 400 })
      return Response.json({ success: true, testMode: true })
    }

    if (emailError) return Response.json({ error: emailError }, { status: 400 })
    return Response.json({ success: true, data: emailData })

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
