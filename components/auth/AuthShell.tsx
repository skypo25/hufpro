import type { ReactNode } from 'react'
import Image from 'next/image'

type AuthShellProps = {
  children: ReactNode
  step?: number
  totalSteps?: number
}

export default function AuthShell({ children, step, totalSteps }: AuthShellProps) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: '#f8f8f8',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px 48px',
      fontFamily: 'var(--font-dm-sans, "DM Sans", sans-serif)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 460,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <Image src="/logo-vertical.svg" alt="anidocs" width={110} height={110} style={{ display: 'block' }} />
          <p style={{
            fontSize: 14,
            color: '#6b7280',
            margin: 0,
            letterSpacing: '0.01em',
            fontFamily: 'var(--font-dm-sans, "DM Sans", sans-serif)',
          }}>
            Dokumentation für Tiertherapeuten
          </p>
        </div>

        {/* Step indicator */}
        {step !== undefined && totalSteps !== undefined && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 32,
                  height: 4,
                  borderRadius: 2,
                  background: i < step - 1 ? '#52b788' : i === step - 1 ? '#111' : '#d8d4cc',
                  transition: 'background 0.25s',
                }}
              />
            ))}
          </div>
        )}

        {/* Card */}
        <div style={{
          width: '100%',
          background: '#fff',
          borderRadius: 20,
          padding: '28px 24px 24px',
          boxShadow: '0 1px 3px rgba(0,0,0,.07), 0 8px 24px rgba(0,0,0,.06)',
        }}>
          {children}
        </div>

      </div>
    </div>
  )
}
