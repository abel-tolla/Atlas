import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

interface DialogProps {
  title: string
  overline?: string
  onClose: () => void
  children: ReactNode
}

/**
 * A modal built on <dialog>, which traps focus, closes with Escape and puts
 * focus back where it was.
 */
export function Dialog({ title, overline, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => dialog?.close()
  }, [])

  return (
    <dialog
      ref={ref}
      className="dialog card"
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="dialog-head">
        <div>
          {overline && <p className="overline dialog-overline">{overline}</p>}
          <h2 id="dialog-title">{title}</h2>
        </div>
        <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
          <X size={16} strokeWidth={1.75} absoluteStrokeWidth aria-hidden />
        </button>
      </div>
      {children}
    </dialog>
  )
}
