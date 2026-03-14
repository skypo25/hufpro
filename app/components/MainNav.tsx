import Link from 'next/link'

export default function MainNav() {
  return (
    <nav
      style={{
        display: 'flex',
        gap: 12,
        padding: 20,
        borderBottom: '1px solid #ddd',
        marginBottom: 20,
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/customers">Kunden</Link>
        <Link href="/horses">Pferde</Link>
      </div>

      <form method="get" action="/suche" style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          name="q"
          placeholder="Global suchen"
          style={{ padding: 8, minWidth: 220 }}
        />
        <button type="submit">Suchen</button>
      </form>
    </nav>
  )
}