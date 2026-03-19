'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'

const MENU_ITEMS = [
  { href: '/settings', title: 'Mein Betrieb', sub: 'Betriebsdaten, Rechnungen, Preise', icon: 'bi-building-fill', color: 'green' },
  { href: '/settings', title: 'Benachrichtigungen', sub: 'Erinnerungen, Push, E-Mail', icon: 'bi-bell-fill', color: 'blue' },
  { href: '/settings', title: 'Vorlagen & Textbausteine', sub: 'Rechnungstexte, Dokumentation', icon: 'bi-file-text-fill', color: 'purple' },
  { href: '/settings', title: 'Konto & Sicherheit', sub: 'Passwort, E-Mail, Konto verwalten', icon: 'bi-shield-lock-fill', color: 'orange' },
  { href: '/support', title: 'Hilfe & Support', sub: 'FAQ, Kontakt, Feedback', icon: 'bi-question-circle-fill', color: 'gray' },
] as const

type Props = {
  open: boolean
  onClose: () => void
}

export default function MobileMoreSheet({ open, onClose }: Props) {
  const router = useRouter()
  const [user, setUser] = useState<{ email?: string; name?: string; initials: string } | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) return
      const metaFirst = (u.user_metadata?.first_name as string) || ''
      const metaLast = (u.user_metadata?.last_name as string) || ''
      // Versuche Name aus user_settings (Einstellungen)
      const { data: settingsRow } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', u.id)
        .maybeSingle()
      const s = settingsRow?.settings as { firstName?: string; lastName?: string } | undefined
      const firstName = s?.firstName || metaFirst
      const lastName = s?.lastName || metaLast
      const name = [firstName, lastName].filter(Boolean).join(' ') || u.email?.split('@')[0] || 'User'
      const initials = [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase().slice(0, 2) || (u.email?.[0]?.toUpperCase() ?? '?')
      setUser({ email: u.email ?? undefined, name, initials })
    }
    load()
  }, [])

  async function handleLogout() {
    onClose()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function handleNav(href: string) {
    onClose()
    router.push(href)
  }

  const tabH = 64
  const safeBottom = 'env(safe-area-inset-bottom, 0px)'

  return (
    <>
      {/* Overlay */}
      <div
        role="presentation"
        aria-hidden={!open}
        className="fixed inset-0 z-[90] bg-black/40 transition-opacity duration-250 ease-out"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-1/2 z-[100] w-full max-w-[430px] rounded-t-2xl bg-white shadow-[0_-4px_40px_rgba(0,0,0,0.15)]"
        style={{
          transform: open ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100%)',
          paddingBottom: `calc(${tabH}px + ${safeBottom})`,
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center py-2.5 pb-1.5">
          <span className="block h-1 w-9 rounded-full bg-[#D1D5DB]" aria-hidden />
        </div>

        {/* User */}
        <button
          type="button"
          onClick={() => handleNav('/settings')}
          className="flex w-full items-center gap-3 px-5 py-2.5 pb-4 text-left"
          style={{ borderBottom: '1px solid #F0EEEA' }}
        >
          <div
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#52b788] text-sm font-bold text-white"
          >
            {user?.initials ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold text-[#1A1A1A]">{user?.name ?? 'Laden…'}</div>
            <div className="text-[11px] font-semibold text-[#52b788]">Pro · Testphase aktiv</div>
          </div>
          <i className="bi bi-chevron-right shrink-0 text-[18px] text-[#9CA3AF]" aria-hidden />
        </button>

        {/* Menu */}
        <div className="px-3 py-2">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={() => handleNav(item.href)}
              className="flex w-full items-center gap-3.5 rounded-[10px] px-2.5 py-3.5 active:bg-black/[0.03]"
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[16px] ${
                  item.color === 'green' ? 'bg-[rgba(82,183,136,0.08)] text-[#52b788]' :
                  item.color === 'blue' ? 'bg-[rgba(59,130,246,0.08)] text-[#3B82F6]' :
                  item.color === 'purple' ? 'bg-[rgba(139,92,246,0.08)] text-[#8B5CF6]' :
                  item.color === 'orange' ? 'bg-[rgba(249,115,22,0.08)] text-[#F97316]' :
                  'bg-[rgba(107,114,128,0.08)] text-[#6B7280]'
                }`}
              >
                <i className={`bi ${item.icon}`} aria-hidden />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="text-[14px] font-semibold text-[#1A1A1A]">{item.title}</div>
                <div className="text-[11px] text-[#9CA3AF]">{item.sub}</div>
              </div>
              <i className="bi bi-chevron-right shrink-0 text-[16px] text-[#E5E2DC]" aria-hidden />
            </button>
          ))}
        </div>

        <div className="mx-5 h-px bg-[#F0EEEA]" />

        {/* Logout */}
        <div className="px-3 py-2">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3.5 rounded-[10px] px-2.5 py-3.5 active:bg-black/[0.03]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(220,38,38,0.06)] text-[16px] text-[#DC2626]">
              <i className="bi bi-box-arrow-left" aria-hidden />
            </div>
            <div className="flex-1 text-left text-[14px] font-semibold text-[#DC2626]">Abmelden</div>
          </button>
        </div>

        <div className="pb-2 pt-1 text-center text-[10px] text-[#E5E2DC]">
          AniDocs v1.0.0 · Made in Germany
        </div>
      </div>
    </>
  )
}
