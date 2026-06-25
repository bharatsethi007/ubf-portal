import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  ariaLabel?: string
  wide?: boolean
  children: ReactNode
  footer?: ReactNode
}

export default function SlideDrawer({ open, onClose, ariaLabel = 'Details', wide, children, footer }: Props) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="slide-drawer" role="presentation">
      <button type="button" className="slide-drawer__overlay" aria-label="Close drawer" onClick={onClose} />
      <aside
        className={`slide-drawer__panel${wide ? ' slide-drawer__panel--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <button type="button" className="slide-drawer__close" aria-label="Close" onClick={onClose}>
          <X size={20} />
        </button>
        <div className="slide-drawer__body">{children}</div>
        {footer && <div className="slide-drawer__footer">{footer}</div>}
      </aside>
    </div>
  )
}
