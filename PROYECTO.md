# OlivaGest — Estado del Proyecto

> Última actualización: Abril 2026  
> Dominio producción: **https://olivagest.com** (Vercel)  
> Repositorio: GitHub → main branch → auto-deploy en Vercel

---

## Stack técnico
- **Frontend/Backend**: Next.js App Router (`/src/app`)
- **Base de datos**: Supabase (PostgreSQL + Auth)
- **Email**: Resend (`onboarding@resend.dev`)
- **PDF**: jsPDF + autotable (carga dinámica CDN)
- **IA**: Anthropic Claude API (`/api/analisis-ia`)
- **Hosting**: Vercel

---

## Variables de entorno (.env.local y Vercel)
```
NEXT_PUBLIC_SUPABASE_URL=https://xbqdxrijvnkcdhwbmaqp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...   ← necesaria para magic links admin
RESEND_API_KEY=re_...
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_APP_URL=https://olivagest.com  ← URLs de magic links siempre al dominio real
```
⚠️ Todas deben estar configuradas también en Vercel → Settings → Environment Variables.

---

## Módulos construidos

### App principal (admin/cooperativa)

| Módulo | Ruta | Estado |
|--------|------|--------|
| Dashboard | `/dashboard` | ✅ KPIs, campañas, alertas |
| Socios | `/socios` | ✅ CRUD, ficha, invitación portal |
| Entregas | `/entregas` | ✅ Registro, filtros, importar Excel |
| Liquidaciones | `/liquidaciones` | ✅ Auto-cálculo, email+PDF, estados |
| Campañas | `/campanyas` | ✅ Gestionar, inconsistencias, iconos SVG |
| Parcelas | `/parcelas` | ✅ CRUD, vinculación socios |
| Trazabilidad | `/trazabilidad` | ✅ Cadena parcela→entrega→liquidación + descarga PDF |
| Informes PDF | `/informes` | ✅ Generación de informes |
| Importar datos | `/importar` | ✅ Excel multi-hoja con validación |
| Exportar datos | `/exportar` | ✅ Descarga Excel |
| Notificaciones | `/notificaciones` | ✅ |
| Administración | `/admin` | ✅ |
| Análisis IA | `/analisis` | ✅ Claude API integrada |

### Portal del Socio (responsive desktop + móvil)

| Módulo | Ruta | Estado |
|--------|------|--------|
| Login magic link | `/portal` | ✅ Sin contraseña, sesión persistente meses |
| Callback auth | `/portal/callback` | ✅ PKCE + hash flow, listener síncrono |
| Dashboard socio | `/portal/dashboard` | ✅ Kg campaña, liquidación, histórico |
| Mis entregas | `/portal/entregas` | ✅ Lista por campaña, totales |
| Mis liquidaciones | `/portal/liquidaciones` | ✅ Detalle, estado, importes |
| Mis parcelas | `/portal/parcelas` | ✅ Superficie, variedad, riego |

### APIs

| Endpoint | Función |
|----------|---------|
| `POST /api/send-email` | Email liquidación con PDF adjunto (Resend) |
| `POST /api/invite-portal` | Magic link branded OlivaGest → socio |
| `POST /api/analisis-ia` | Análisis Claude |
| `GET /api/precio-aceite` | Precio mercado |

---

## Decisiones técnicas importantes

### Bug ñ en Supabase PostgREST
`select('campaña')` falla silenciosamente — devuelve null sin error. **Solución**: usar siempre `select('campana')` (sin tilde). Las tablas tienen columna `campana TEXT`.

### Auth concurrente (IndexedDB lock)
Llamar `supabase.auth.getUser()` en paralelo causa lock. **Solución**: cache de userId + `getSession()` en `src/lib/supabase.js`.

### Magic link PKCE (Supabase v2)
Supabase v2 usa PKCE por defecto. El callback llega como `?code=xxx`, no `#access_token`. **Solución**: `exchangeCodeForSession(code)` explícito en `/portal/callback`.

### Sesión en portal: INITIAL_SESSION vs getSession()
`getSession()` tiene condición de carrera en Next.js App Router — puede devolver null justo al montar la página antes de restaurar la sesión de localStorage. **Solución**: usar `onAuthStateChange` con evento `INITIAL_SESSION` en todas las páginas del portal. Este evento se dispara exactamente una vez cuando la sesión ya está completamente restaurada.

### Bucle login ↔ dashboard (portal)
Si un usuario tiene sesión Supabase pero su email no está en tabla `socios`, el dashboard le mandaba a `/portal`, y `/portal` le mandaba de vuelta al dashboard → parpadeo infinito. **Solución**: antes de redirigir al login, hacer `signOut()` para invalidar la sesión. Sin sesión, el login muestra el formulario en lugar de redirigir.

### Magic link URL en producción
Generar link desde localhost incluía `localhost:3000` en la URL. **Solución**: `NEXT_PUBLIC_APP_URL` usado server-side en `/api/invite-portal`.

### Resend modo prueba
Solo permite enviar al email registrado. **Solución**: fallback automático al email del admin con banner de aviso amarillo.

### Sidebar fija (layout app)
`min-h-screen` en el sidebar hacía que creciera con el contenido y el botón "Salir" quedaba oculto al hacer scroll. **Solución**: `h-screen overflow-hidden` en el contenedor, `overflow-y-auto` solo en el nav.

### Portal responsivo (desktop + móvil)
Diseño original solo móvil (`max-w-lg`). **Solución**: `max-w-5xl mx-auto` + nav horizontal en desktop (`hidden md:flex` en barra superior) + nav bottom en móvil (`md:hidden`).

---

## Schema Supabase (tablas principales)

```sql
socios        (id, user_id, nombre, dni, telefono, email, municipio, iban, ...)
parcelas      (id, user_id, socio_id, nombre, municipio, variedad, superficie_ha, ...)
entregas      (id, user_id, socio_id, parcela_id, campana, fecha, kg_bruto, kg_neto,
               humedad, impurezas, rendimiento, calidad, ...)
liquidaciones (id, user_id, socio_id, campana, kg_totales, rendimiento_bruto,
               punto_extraccion, rendimiento_neto, kg_aceite_final, precio_kg,
               importe_total, estado, fecha_pago, ...)
campanyas     (id, user_id, nombre, fecha_inicio, fecha_fin, activa, ...)
```

---

## Emails que envía la app

### 1. Acceso portal socio (`/api/invite-portal`)
- **Diseño**: Cabecera navy OlivaGest, botón "Acceder al portal →", info sesión persistente
- **Flujo**: Admin pulsa "Email" en lista socios → genera magic link vía Supabase Admin API → envía con Resend
- **Fallback**: Si Resend en modo prueba, redirige al email del admin con banner amarillo de aviso

### 2. Liquidación (`/api/send-email`)
- **Diseño**: KPIs (kg, rendimiento, precio), importe total verde, tabla detalle
- **Adjunto**: PDF completo generado con jsPDF (cabecera, datos socio, entregas, liquidación)
- **PDF filename**: `Liquidacion_CAMPANA_NombreSocio.pdf`

---

## Logo
- Archivo: `public/logo.png`
- Estilo Apple minimalista: fondo blanco, aceituna dos tonos (verde lima + verde bosque), curva en S blanca, hoja flotante
- Generado con Python PIL

---

## Archivos clave

```
src/
  app/
    portal/
      page.js          ← Login magic link (onAuthStateChange INITIAL_SESSION)
      callback/page.js ← Procesa token, redirige a dashboard
      layout.js        ← Nav responsive (top desktop / bottom móvil)
      dashboard/page.js
      entregas/page.js
      liquidaciones/page.js
      parcelas/page.js
    liquidaciones/page.js  ← Email+PDF
    trazabilidad/page.js   ← Filtros, PDF descarga
    api/
      send-email/route.js  ← Resend + adjunto PDF
      invite-portal/route.js ← Magic link branded
  lib/
    supabase.js     ← Cliente + cache userId
    portalAuth.js   ← getPortalSocioFromSession(session)
  components/layout/
    Sidebar.js      ← h-screen, logout siempre visible
    AppShell.tsx    ← h-screen overflow-hidden
```

---

## Pendiente / Ideas futuras
- [ ] Verificar dominio olivagest.com en Resend (ahora solo envía al admin en modo prueba)
- [ ] PWA completa para portal móvil (ya tiene manifest básico)
- [ ] Notificaciones push para socios cuando se genera liquidación
- [ ] Histórico de precios aceite por campaña
- [ ] Integración SIGPAC para parcelas
- [ ] Multi-cooperativa (actualmente 1 usuario = 1 cooperativa)
- [ ] Descarga PDF liquidación desde portal del socio
