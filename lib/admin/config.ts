/**
 * Internes Admin-Panel: Zugriff nur für in ADMIN_USER_IDS gelistete User-UUIDs.
 * Kommagetrennt in .env.local, keine Leerzeichen um die UUIDs.
 */
export function getAdminUserIds(): string[] {
  const raw = process.env.ADMIN_USER_IDS ?? ''
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function isAdminUserId(userId: string | undefined | null): boolean {
  if (!userId) return false
  return getAdminUserIds().includes(userId)
}
