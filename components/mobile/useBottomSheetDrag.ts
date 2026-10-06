'use client'

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

const CLOSE_PX = 72
const CLOSE_VELOCITY = 0.55

export function useBottomSheetDrag(onClose: () => void) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const offsetRef = useRef(0)
  const startY = useRef(0)
  const lastY = useRef(0)
  const lastT = useRef(0)
  const velocity = useRef(0)
  const didDrag = useRef(false)

  const setOffsetBoth = (y: number) => {
    offsetRef.current = y
    setOffset(y)
  }

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return
    didDrag.current = false
    startY.current = e.clientY
    lastY.current = e.clientY
    lastT.current = typeof performance !== 'undefined' ? performance.now() : Date.now()
    velocity.current = 0
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    const dy = Math.max(0, e.clientY - startY.current)
    if (dy > 8) didDrag.current = true
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const dt = Math.max(1, now - lastT.current)
    velocity.current = (e.clientY - lastY.current) / dt
    lastY.current = e.clientY
    lastT.current = now
    setOffsetBoth(dy)
  }, [])

  const endDrag = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      setDragging(false)
      const shouldClose = offsetRef.current > CLOSE_PX || velocity.current > CLOSE_VELOCITY
      if (shouldClose) {
        onClose()
        window.requestAnimationFrame(() => setOffsetBoth(0))
        return
      }
      window.requestAnimationFrame(() => setOffsetBoth(0))
    },
    [onClose]
  )

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      e.stopPropagation()
      if (didDrag.current) return
      onClose()
    },
    [onClose]
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClose()
      }
    },
    [onClose]
  )

  return {
    offset,
    dragging,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onClick,
      onKeyDown,
      role: 'button' as const,
      tabIndex: 0,
      'aria-label': 'Schließen',
    },
  }
}
