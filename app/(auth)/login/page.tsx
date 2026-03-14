'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        setMessage(error.message)
        setLoading(false)
        return
      }

      setMessage('Registrierung erfolgreich. Prüfe deine E-Mails.')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    setLoading(false)
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">
            {mode === 'login' ? 'Anmelden' : 'Registrieren'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Zugang für Hufbearbeiter
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="E-Mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3"
            required
          />

          <input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3"
            required
          />

          {message && (
            <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading
              ? 'Bitte warten...'
              : mode === 'login'
              ? 'Anmelden'
              : 'Registrieren'}
          </button>
        </form>

        <div className="mt-4 text-sm text-slate-600">
          {mode === 'login' ? 'Noch kein Konto?' : 'Schon ein Konto?'}{' '}
          <button
            type="button"
            onClick={() =>
              setMode(mode === 'login' ? 'register' : 'login')
            }
            className="font-medium text-sky-700 hover:underline"
          >
            {mode === 'login' ? 'Registrieren' : 'Anmelden'}
          </button>
        </div>
      </div>
    </main>
  )
}