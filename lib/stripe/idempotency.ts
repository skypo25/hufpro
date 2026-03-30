import 'server-only'
import { createHash } from 'crypto'

export function buildIdempotencyKey(parts: Array<string | number | null | undefined>): string {
  const raw = parts
    .filter((p) => p !== null && p !== undefined)
    .map((p) => String(p))
    .join('|')
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 32)
  return `anidocs_${hash}`
}

