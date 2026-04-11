import sanitizeHtmlLib from 'sanitize-html'
import type { IOptions } from 'sanitize-html'

/**
 * Zentrale Allowlist-Sanitization für Nutzer-HTML (z. B. Freitext mit Rich-Text).
 * Verwendung nur über diese Funktion — keine parallele Eigenbau-Sanitization.
 */
const SANITIZE_USER_HTML_OPTIONS: IOptions = {
  allowedTags: [
    'p',
    'br',
    'b',
    'strong',
    'i',
    'em',
    'u',
    's',
    'strike',
    'ul',
    'ol',
    'li',
    'span',
    'div',
    'blockquote',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'a',
    'hr',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowProtocolRelative: false,
  transformTags: {
    a: (_tagName, attribs) => {
      const next: Record<string, string> = { ...attribs }
      if (next.target === '_blank') {
        const parts = (next.rel || '').split(/\s+/).filter(Boolean)
        if (!parts.includes('noopener')) parts.push('noopener')
        if (!parts.includes('noreferrer')) parts.push('noreferrer')
        next.rel = parts.join(' ')
      }
      return { tagName: 'a', attribs: next }
    },
  },
}

export function sanitizeUserHtml(dirty: string): string {
  if (typeof dirty !== 'string') return ''
  const s = dirty.trim()
  if (!s) return ''
  return sanitizeHtmlLib(s, SANITIZE_USER_HTML_OPTIONS)
}
