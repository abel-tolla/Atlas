import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

const WIDTH = 340
const GAP = 8
const PHONE = '(max-width: 760px)'

interface PopoverProps {
  /** Where the thing that opened the popover sits on screen. */
  anchor: DOMRect
  labelledBy: string
  onClose: () => void
  children: ReactNode
}

/**
 * A small non-modal panel beside an event. It closes with Escape or a click
 * outside (#71). On a phone it becomes a sheet at the bottom of the screen.
 */
export function Popover({ anchor, labelledBy, onClose, children }: PopoverProps) {
  const panel = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const close = useRef(onClose)
  close.current = onClose

  useLayoutEffect(() => {
    const el = panel.current
    if (!el || window.matchMedia(PHONE).matches) return setPosition(null)
    const height = el.offsetHeight
    const fitsRight = anchor.right + GAP + WIDTH <= window.innerWidth - GAP
    const fitsLeft = anchor.left - GAP - WIDTH >= GAP
    const left = fitsRight
      ? anchor.right + GAP
      : fitsLeft
        ? anchor.left - GAP - WIDTH
        : Math.min(Math.max(anchor.left, GAP), window.innerWidth - WIDTH - GAP)
    const top = Math.min(
      Math.max(anchor.top, GAP),
      Math.max(window.innerHeight - height - GAP, GAP),
    )
    setPosition({ left, top })
  }, [anchor, children])

  useEffect(() => {
    panel.current?.focus()
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (panel.current?.contains(target)) return
      // Clicks inside an open dialog (like the form) belong to that dialog.
      if (target instanceof Element && target.closest('dialog[open]')) return
      close.current()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  return (
    <div
      ref={panel}
      className={`popover card${position ? '' : ' popover--sheet'}`}
      role="dialog"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      style={position ? { left: position.left, top: position.top, width: WIDTH } : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
    >
      {children}
    </div>
  )
}
