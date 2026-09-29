import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, FileText, Plane, Plus, Receipt, Search, Ship } from 'lucide-react'
import { supabase } from '../../../supabase'
import { usePorts } from '../../../hooks/usePorts'
import { detailPath, placeName, shipmentNo, titleCase } from './homeModel'

type Row = {
  job_unique: number
  module: string | null
  job_no: string | null
  house_bill: string | null
  shipment_no: string | null
  customer_ref: string | null
  goods_desc: string | null
  consignee_name: string | null
  destination: string | null
  mode: string | null
  status: string | null
}

type Result = {
  key: string
  kind: 'Shipment' | 'Action'
  title: string
  sub: string
  to: string
  icon: 'sea' | 'air' | 'pay' | 'book' | 'doc'
}

let cache: Row[] | null = null

const ACTIONS: Result[] = [
  { key: 'a-bill', kind: 'Action', title: 'Pay or view invoices', sub: 'Billing and statements', to: '/portal/billing', icon: 'pay' },
  { key: 'a-book', kind: 'Action', title: 'Book a new shipment', sub: 'Air or sea across the Pacific', to: '/portal/bookings', icon: 'book' },
  { key: 'a-quote', kind: 'Action', title: 'Request a quote', sub: 'Get a price for a new lane', to: '/portal/quotes', icon: 'doc' },
]

type Props = { open: boolean; onClose: () => void }

export default function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate()
  const { ports } = usePorts()
  const [rows, setRows] = useState<Row[]>(cache ?? [])
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQ('')
    setCursor(0)
    setTimeout(() => inputRef.current?.focus(), 10)
    if (cache) return
    void supabase
      .from('portal_shipments')
      .select('job_unique, module, job_no, house_bill, shipment_no, customer_ref, goods_desc, consignee_name, destination, mode, status')
      .order('doc_date', { ascending: false })
      .limit(1500)
      .then(({ data }) => {
        cache = (data ?? []) as Row[]
        setRows(cache)
      })
  }, [open])

  const results = useMemo<Result[]>(() => {
    const needle = q.trim().toLowerCase()
    const ships = rows
      .filter((r) => {
        if (!needle) return true
        const hay = [shipmentNo(r), r.job_no, r.house_bill, r.shipment_no, r.customer_ref, r.goods_desc, r.consignee_name, r.destination, placeName(r.destination, ports)]
          .filter(Boolean).join(' ').toLowerCase()
        return hay.includes(needle)
      })
      .slice(0, needle ? 8 : 5)
      .map<Result>((r) => ({
        key: `s${r.job_unique}`,
        kind: 'Shipment',
        title: `${shipmentNo(r)}${r.goods_desc ? ` · ${titleCase(r.goods_desc).slice(0, 48)}` : ''}`,
        sub: [titleCase(r.consignee_name), placeName(r.destination, ports), r.customer_ref ? `PO ${r.customer_ref}` : '', r.status].filter(Boolean).join(' · '),
        to: detailPath(r),
        icon: (r.mode ?? '').toLowerCase() === 'sea' ? 'sea' : 'air',
      }))
    const acts = ACTIONS.filter((a) => !needle || `${a.title} ${a.sub}`.toLowerCase().includes(needle))
    return [...ships, ...acts]
  }, [rows, q, ports])

  useEffect(() => { setCursor(0) }, [q])

  if (!open) return null

  function go(r: Result | undefined) {
    if (!r) return
    onClose()
    navigate(r.to)
  }

  function onKey(e: ReactKeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(results.length - 1, c + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); go(results[cursor]) }
  }

  const Icon = ({ k }: { k: Result['icon'] }) => {
    if (k === 'sea') return <Ship size={16} />
    if (k === 'air') return <Plane size={16} />
    if (k === 'pay') return <Receipt size={16} />
    if (k === 'book') return <Plus size={16} />
    return <FileText size={16} />
  }

  return (
    <div className="pv2-palette" onKeyDown={onKey}>
      <button type="button" className="pv2-palette__backdrop" aria-label="Close search" onClick={onClose} />
      <div className="pv2-palette__panel" role="dialog" aria-modal="true" aria-label="Search">
        <label className="pv2-palette__search">
          <Search size={20} aria-hidden />
          <input ref={inputRef} type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Shipment number, PO, product or resort" aria-label="Search" />
          <kbd className="pv2-kbd">Esc</kbd>
        </label>
        <div className="pv2-palette__list" role="listbox">
          {results.map((r, i) => (
            <button key={r.key} type="button" role="option" aria-selected={i === cursor}
              className={`pv2-palette__item${i === cursor ? ' pv2-palette__item--on' : ''}`}
              onMouseEnter={() => setCursor(i)} onClick={() => go(r)}>
              <span className={`pv2-palette__icon pv2-palette__icon--${r.icon}`}><Icon k={r.icon} /></span>
              <span className="pv2-palette__text">
                <span className="pv2-palette__title">{r.title}</span>
                {r.sub && <span className="pv2-palette__sub">{r.sub}</span>}
              </span>
              {i === cursor ? <CornerDownLeft size={14} className="pv2-palette__enter" /> : <span className="pv2-palette__kind">{r.kind}</span>}
            </button>
          ))}
          {results.length === 0 && (
            <div className="pv2-palette__empty">Nothing matches. Try a shipment number, PO, product or resort.</div>
          )}
        </div>
        <div className="pv2-palette__foot">
          <span><kbd className="pv2-kbd">↑</kbd><kbd className="pv2-kbd">↓</kbd> move</span>
          <span><kbd className="pv2-kbd">Enter</kbd> open</span>
        </div>
      </div>
    </div>
  )
}
