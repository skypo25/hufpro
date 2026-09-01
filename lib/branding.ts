/**
 * Zentrale Markenfarben für Kontexte ohne CSS-Variablen (PDF, E-Mail-HTML, Canvas, …).
 * In React/Tailwind bevorzugt `text-primary`, `bg-primary`, `var(--accent)` nutzen.
 */
export const BRAND_COLORS = {
  accent: '#006d6d',
  accentDark: '#015555',
  accentLight: '#edf5f5',
  foreground: '#1b1f23',
} as const

export type BrandColorKey = keyof typeof BRAND_COLORS
