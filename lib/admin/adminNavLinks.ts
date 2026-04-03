/** Gemeinsame Admin-Navigation (Sidebar Desktop + Mobile-Admin-Chrome). */
export type AdminNavLinkDef = {
  href: string
  label: string
  /** Badge mit Nutzeranzahl (nur /admin/users) */
  userCountBadge?: boolean
}

export const ADMIN_APP_NAV_LINKS: AdminNavLinkDef[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/users', label: 'Nutzer', userCountBadge: true },
  { href: '/admin/system', label: 'System' },
]
