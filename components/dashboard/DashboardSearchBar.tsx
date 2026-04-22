'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const INPUT_WIDTH = 260

export default function DashboardSearchBar() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (q) {
      router.push(`/suche?q=${encodeURIComponent(q)}`)
      setOpen(false)
      setQuery('')
    } else {
      router.push('/suche')
      setOpen(false)
    }
  }

  function handleClose() {
    setOpen(false)
    setQuery('')
  }

  return (
    <form ref={containerRef} onSubmit={handleSubmit} className="flex items-center">
      <div
        className="overflow-hidden transition-[width] duration-300 ease-out"
        style={{ width: open ? INPUT_WIDTH : 0 }}
      >
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kunden, Pferde …"
          className="h-[42px] w-[260px] rounded-l-lg border border-r-0 border-[#E5E2DC] bg-white pl-4 pr-3 text-[14px] text-[#1B1F23] outline-none placeholder:text-[#9CA3AF] focus:border-[#006d6d]"
          aria-label="Suche"
        />
      </div>
      {open ? (
        <div className="flex items-center rounded-r-lg border border-[#E5E2DC] border-l-0 bg-white shadow-sm">
          <button
            type="submit"
            className="flex h-[42px] w-[42px] items-center justify-center text-[#006d6d] hover:bg-[#edf5f5] hover:text-[#015555]"
            aria-label="Suchen"
          >
            <i className="bi bi-search text-[16px]" />
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-[42px] w-[42px] items-center justify-center text-[#6B7280] hover:bg-[#f4f5f4]"
            aria-label="Suche schließen"
          >
            <i className="bi bi-x-lg text-[14px]" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-[42px] items-center justify-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-[18px] py-[10px] text-[14px] font-medium text-[#1B1F23] shadow-sm transition hover:bg-[#faf9f7]"
        >
          <i className="bi bi-search text-[15px]" />
          Suche
        </button>
      )}
    </form>
  )
}
