'use client'

import { supabase } from '@/lib/supabase-client'

export default function LogoutButton() {
  async function handleLogout() {
    await supabase.auth.signOut()
    // Voller Reload: Session-Cookies + Boot-Splash sauber zurücksetzen
    window.location.assign('/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      Abmelden
    </button>
  )
}