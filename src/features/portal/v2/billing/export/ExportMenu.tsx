import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Download, FileSpreadsheet } from 'lucide-react'
import BrandMark from './BrandMark'
import type { Target } from './accountingExport'

type Props = { disabled?: boolean; onCsv: () => void; onLedger: (t: Target) => void; up?: boolean; csvHint?: string; label?: string }

/** One Export button with a menu: plain CSV, Xero bills, MYOB purchases. */
export default function ExportMenu({ disabled, onCsv, onLedger, up, csvHint = 'Invoices on screen, for Excel', label = 'Export' }: Props) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open])

  const pick = (fn: () => void) => { setOpen(false); fn() }

  return (
    <div className="pv3-xmenu" ref={box}>
      <button type="button" className="pv3-btn pv3-btn--ghost" disabled={disabled} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Download size={15} /> {label} <ChevronDown size={14} className={`pv3-chev${open ? ' pv3-chev--open' : ''}`} />
      </button>
      {open && (
        <div className={`pv3-xmenu__list${up ? ' pv3-xmenu__list--up' : ''}`} role="menu">
          <button type="button" role="menuitem" className="pv3-xmenu__item" onClick={() => pick(onCsv)}>
            <span className="pv3-xmenu__ico"><FileSpreadsheet size={18} /></span>
            <span><b>CSV</b><i>{csvHint}</i></span>
          </button>
          <button type="button" role="menuitem" className="pv3-xmenu__item" onClick={() => pick(() => onLedger('xero'))}>
            <span className="pv3-xmenu__ico"><BrandMark brand="xero" /></span>
            <span><b>Xero</b><i>Bills import file</i></span>
          </button>
          <button type="button" role="menuitem" className="pv3-xmenu__item" onClick={() => pick(() => onLedger('myob'))}>
            <span className="pv3-xmenu__ico"><BrandMark brand="myob" /></span>
            <span><b>MYOB</b><i>Purchases import file</i></span>
          </button>
        </div>
      )}
    </div>
  )
}
