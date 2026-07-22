/** Client setzt das via `useIsMobile` (Breite &lt; 960 → mobile Shell). */
export const ANIDOCS_SHELL_COOKIE = 'anidocs_shell'

export type AnidocsShell = 'mobile' | 'desktop'

export function parseAnidocsShellCookie(value: string | undefined | null): AnidocsShell | null {
  if (value === 'mobile' || value === 'desktop') return value
  return null
}
