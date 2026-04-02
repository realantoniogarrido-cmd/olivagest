'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const NAV = [
  {
    href: '/portal/dashboard',
    label: 'Inicio',
    icon: (active) => (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/portal/entregas',
    label: 'Entregas',
    icon: (active) => (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    href: '/portal/liquidaciones',
    label: 'Liquidaciones',
    icon: (active) => (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/portal/parcelas',
    label: 'Parcelas',
    icon: (active) => (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
]

export default function PortalLayout({ children }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [socioNombre, setSocioNombre] = useState('')

  // Protect all /portal/* routes (except login + callback)
  useEffect(() => {
    const publicPaths = ['/portal', '/portal/callback']
    if (publicPaths.includes(pathname)) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/portal')
      } else {
        // Get socio name for greeting
        const email = session.user.email
        supabase.from('socios').select('nombre').eq('email', email).single()
          .then(({ data }) => { if (data?.nombre) setSocioNombre(data.nombre.split(' ')[0]) })
      }
    })
  }, [pathname, router])

  // Don't render the app shell on the login/callback pages
  const isAuthPage = ['/portal', '/portal/callback'].includes(pathname)
  if (isAuthPage) return <>{children}</>

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/portal')
  }

  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto" style={{ backgroundColor: '#f8fafc' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
        style={{ backgroundColor: '#0f172a' }}>
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="OlivaGest" className="w-8 h-8 rounded-lg" />
          <div>
            <p className="text-white font-bold text-sm leading-tight">OlivaGest</p>
            {socioNombre && (
              <p className="text-xs leading-tight" style={{ color: '#4ade80' }}>
                Hola, {socioNombre}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          Salir
        </button>
      </div>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-24">
        {children}
      </main>

      {/* Bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto z-20"
        style={{ backgroundColor: '#0f172a', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Safe area for iOS */}
        <div className="flex items-center justify-around px-2 pt-2 pb-safe"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
          {NAV.map(item => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all"
                style={{ color: active ? '#4ade80' : 'rgba(255,255,255,0.35)' }}
              >
                {item.icon(active)}
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
