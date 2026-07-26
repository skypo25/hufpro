/** Event: App-Shell (Mobile oder Desktop) ist gemountet — Boot-Splash kann ausblenden. */
export const ANIDOCS_SHELL_READY_EVENT = 'anidocs-shell-ready'

export function signalAnidocsShellReady() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(ANIDOCS_SHELL_READY_EVENT))
}
