'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/dashboard',     icon: '📊', label: 'Panel general' },
  { href: '/entregas',      icon: '🫒', label: 'Entregas' },
  { href: '/socios',        icon: '👨‍🌾', label: 'Socios' },
  { href: '/liquidaciones', icon: '💶', label: 'Liquidaciones' },
]

export default function Sidebar({ cooperativa }) {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-60 bg-[#1a2e1a] text-white flex flex-col fixed h-screen z-50">

      <div className="px-5 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#7ab648] rounded-lg flex items-center justify-center text-lg">🫒</div>
          <div>
            <div className="font-bold text-base">OlivaGest</div>
            <div className="text-[10px] text-white/40 mt-0.5">Gestión de cooperativas</div>
          </div>
        </div>
      </div>

      <div className="px-5 py-3 border-b border-white/10 bg-white/5">
        <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Cooperativa</div>
        <div className="text-sm font-semibold truncate">{cooperativa || 'Mi Cooperativa'}</div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(item => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all ${
                active
                  ? 'bg-[#7ab648] text-white font-semibold'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-5 py-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          Cerrar sesión →
        </button>
      </div>

    </aside>
  )
}