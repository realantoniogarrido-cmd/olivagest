'use client'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import ChatWidget from '@/components/ChatWidget'

const AUTH_ROUTES = ['/login', '/registro']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthPage = AUTH_ROUTES.includes(pathname)
  // Portal has its own layout — exclude completely from main app shell
  const isPortal = pathname.startsWith('/portal')

  if (isAuthPage || isPortal) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 bg-gray-50 overflow-y-auto">
        {children}
      </main>
      <ChatWidget />
    </div>
  )
}
