/** Event: App-Shell (Mobile oder Desktop) ist gemountet — Boot-Splash kann ausblenden. */
export const ANIDOCS_SHELL_READY_EVENT = 'anidocs-shell-ready'

/** Routen ohne AppLayoutClient — Boot-Splash darf nicht auf die Shell warten. */
export function isNonAppShellPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/register' ||
    pathname.startsWith('/register/') ||
    pathname === '/forgot-password' ||
    pathname.startsWith('/forgot-password/') ||
    pathname === '/reset-password' ||
    pathname.startsWith('/reset-password/') ||
    pathname.startsWith('/auth/') ||
    pathname === '/agb' ||
    pathname === '/datenschutz'
  )
}

export function signalAnidocsShellReady() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(ANIDOCS_SHELL_READY_EVENT))
}

export function hideAnidocsBootSplash() {
  if (typeof document === 'undefined') return
  const el = document.getElementById('anidocs-boot-splash')
  if (!el) return
  el.classList.add('anidocs-boot-splash--hide')
  window.setTimeout(() => {
    el.remove()
  }, 380)
}
