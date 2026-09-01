import type { ReactNode } from 'react'

type AppPageProps = {
  children: ReactNode
  /** Nur für Ausnahmen (z. B. schmale Vergleichsansicht). Standard: volle App-Breite. */
  className?: string
}

/**
 * Standard-Seiteninhalt unter der Sidebar.
 * Breite und Außenabstand kommen aus `MainWithMargin` (max. 1280px, p-6/8/10).
 */
export default function AppPage({ children, className = '' }: AppPageProps) {
  return (
    <div className={['w-full space-y-7', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}
