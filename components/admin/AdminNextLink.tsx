'use client'

import NextLink from 'next/link'
import type { ComponentProps } from 'react'

/** Turbopack/Next 16: `next/link` direkt in großen Server-Pages kann SSR „module factory is not available“ werfen — Wrapper hält Link im Client-Boundary. */
export default function AdminNextLink(props: ComponentProps<typeof NextLink>) {
  return <NextLink {...props} />
}
