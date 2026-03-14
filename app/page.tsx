import { supabase } from '@/lib/supabase'

export default function Home() {
  console.log('Supabase Client:', supabase)

  return (
    <main style={{ padding: '40px', fontFamily: 'Arial' }}>
      <h1>🐎 Hufpflege Software</h1>
      <p>Phase 1 läuft.</p>
      <p>Next.js und Supabase sind verbunden.</p>
    </main>
  )
}