'use client'

import { useRouter } from 'next/navigation'

const OPTIONS: { value: string; label: string }[] = [
  { value: 'last_login_desc', label: 'Sortieren: Letzter Login' },
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'created_desc', label: 'Registrierung (neueste)' },
  { value: 'created_asc', label: 'Registrierung (älteste)' },
  { value: 'docs_desc', label: 'Meiste Dokus' },
  { value: 'horses_desc', label: 'Meiste Tiere' },
  { value: 'storage_desc', label: 'Höchster Speicher' },
]

export default function AdminUsersSortSelect(props: { value: string; q: string; billing: string }) {
  const router = useRouter()

  return (
    <select
      className="cursor-pointer rounded-[7px] border-[1.5px] border-[#E5E2DC] bg-white py-[7px] pl-3 pr-8 text-[11px] font-semibold text-[#6B7280] outline-none transition hover:border-[#9CA3AF] focus:border-[#52b788]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239CA3AF' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
        appearance: 'none',
      }}
      value={props.value}
      onChange={(e) => {
        const p = new URLSearchParams()
        if (props.q.trim()) p.set('q', props.q.trim())
        if (props.billing !== 'all') p.set('billing', props.billing)
        if (e.target.value !== 'last_login_desc') p.set('sort', e.target.value)
        const qs = p.toString()
        router.push(`/admin/users${qs ? `?${qs}` : ''}`)
      }}
      aria-label="Sortierung"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
