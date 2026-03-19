'use client'

import { useRef, useEffect, useCallback, useState } from 'react'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minRows?: number
  className?: string
}

/**
 * Minimal rich-text editor with Bold support.
 * Stores content as HTML. Uses contentEditable + execCommand(bold).
 * Paragraph separator is set to <p> on mount.
 */
export default function MinimalRichEditor({
  value,
  onChange,
  placeholder = '',
  minRows = 5,
  className = '',
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [isEmpty, setIsEmpty] = useState(() => !value?.trim())

  // Set initial HTML on mount only (avoid cursor jump on each keystroke)
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    el.innerHTML = value || ''
    setIsEmpty(!value?.trim())
    // Tell browser to use <p> when user presses Enter
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p')
    } catch {
      // silently ignored
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync incoming value change when editor is NOT focused (e.g. VoiceRecorder)
  useEffect(() => {
    const el = editorRef.current
    if (!el || document.activeElement === el) return
    if (el.innerHTML !== value) {
      el.innerHTML = value || ''
      setIsEmpty(!value?.trim())
    }
  }, [value])

  const syncValue = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const html = el.innerHTML
    // Strip tags + whitespace to check for real content
    const plain = (el.innerText ?? '').replace(/\u00a0/g, '').trim()
    const isEmpty = !plain
    setIsEmpty(isEmpty)
    onChange(isEmpty ? '' : html)
  }, [onChange])

  const execBold = useCallback((e: React.MouseEvent) => {
    e.preventDefault() // keep focus inside editor
    document.execCommand('bold', false)
    editorRef.current?.focus()
    syncValue()
  }, [syncValue])

  const minHeightStyle = `${minRows * 1.5}rem`

  return (
    <div className={`overflow-hidden rounded-lg border border-[#E5E2DC] bg-white transition focus-within:border-[#52b788] ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b border-[#E5E2DC] bg-[#FAFAF8] px-2 py-1.5">
        <button
          type="button"
          onMouseDown={execBold}
          className="flex h-7 w-8 items-center justify-center rounded text-[13px] font-bold text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#1B1F23]"
          title="Fett (Strg+B)"
          aria-label="Fett"
        >
          B
        </button>
        <div className="mx-1 h-4 w-px bg-[#E5E2DC]" />
        <span className="ml-1 text-[11px] text-[#9CA3AF]">Strg+B für Fettschrift</span>
      </div>

      {/* Editable area with placeholder overlay */}
      <div className="relative" style={{ minHeight: minHeightStyle }}>
        {isEmpty && placeholder && (
          <div
            className="pointer-events-none absolute left-3 right-3 top-3 text-[14px] leading-6 text-[#9CA3AF]"
            aria-hidden
          >
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={syncValue}
          onBlur={syncValue}
          className="min-h-[inherit] px-3 py-3 text-[14px] leading-6 text-[#1B1F23] outline-none [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_b]:font-bold"
          style={{ minHeight: minHeightStyle }}
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder || 'Texteditor'}
        />
      </div>
    </div>
  )
}
