import type { Metadata } from 'next'
import './globals.css'
import 'bootstrap-icons/font/bootstrap-icons.css'

export const metadata: Metadata = {
  title: 'Hufpflege Software',
  description: 'Hufpflege Software für Kunden, Pferde und Dokumentationen',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}