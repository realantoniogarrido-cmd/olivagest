import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * POST /api/portal/register
 * Crea una cuenta para un socio verificando que su email esté en la tabla socios.
 * Usa service role para bypassear RLS y confirmar el email automáticamente.
 */
export async function POST(request) {
  const { email, password } = await request.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
  }

  const emailClean = email.trim().toLowerCase()

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // 1. Verificar que el email está registrado como socio
  const { data: socio } = await supabaseAdmin
    .from('socios')
    .select('id, nombre')
    .eq('email', emailClean)
    .single()

  if (!socio) {
    return NextResponse.json(
      { error: 'Este email no está registrado como socio. Contacta con tu cooperativa.' },
      { status: 403 }
    )
  }

  // 2. Crear usuario con email confirmado (no envía email de verificación)
  const { error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: emailClean,
    password,
    email_confirm: true,
  })

  if (createError) {
    // Si ya existe la cuenta → decirle que inicie sesión
    if (createError.message?.includes('already') || createError.message?.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Ya tienes una cuenta con este email. Inicia sesión.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, nombre: socio.nombre })
}
