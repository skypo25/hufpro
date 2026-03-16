'use client'

import { useEffect } from 'react'

export default function RegisterSw() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => {})
      .catch(() => {})
  }, [])
  return null
}
