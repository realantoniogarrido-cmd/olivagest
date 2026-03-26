import './globals.css'

export const metadata = {
  title: 'OlivaGest — Gestión de cooperativas',
  description: 'Plataforma de gestión para cooperativas oleícolas',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}