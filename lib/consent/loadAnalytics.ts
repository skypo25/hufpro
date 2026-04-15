/**
 * Platzhalter für zukünftige Analyse-Tools — nur nach Opt-in aufrufen.
 * Niemals automatisch beim Seitenaufbau laden.
 */
export function loadAnalytics(): void {
  if (typeof window === 'undefined') return
  // Hier später z. B. Matomo / Plausible initialisieren, sofern technisch freigegeben.
}
