import 'server-only'

export function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v || !v.trim()) {
    throw new Error(`ENV fehlt: ${name}`)
  }
  return v.trim()
}

export function getOptionalEnv(name: string): string | null {
  const v = process.env[name]
  const t = v?.trim()
  return t ? t : null
}

