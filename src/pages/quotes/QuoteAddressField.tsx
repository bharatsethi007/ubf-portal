import { useEffect, useRef, useState } from 'react'
import { Building2, Loader2, MapPin, Search } from 'lucide-react'
import { details, loadPlaces, predict, type Prediction } from '../../features/portal/v2/contacts/googlePlaces'
import { useCustomerSearch, type CustomerPickerValue } from '../../hooks/useBookings'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { composeAddress } from './PartyPicker'

type Props = {
  label: string
  value: string
  onChange: (v: string) => void
  /** Party name typed on the quote, used to prefill the CF search. */
  partyName?: string | null
  /** The quote's customer, offered first in the CF list. */
  customer?: CustomerPickerValue | null
}

const listCls = 'absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-md'

/** Address box: Google search as you type, plus an on-demand "From CF" lookup. Never fills itself. */
export default function QuoteAddressField({ label, value, onChange, partyName, customer }: Props) {
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<Prediction[]>([])
  const [cursor, setCursor] = useState(0)
  const [busy, setBusy] = useState(false)
  const [cfOpen, setCfOpen] = useState(false)
  const [cfTerm, setCfTerm] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const seq = useRef(0)
  const debounced = useDebouncedValue(cfTerm, 250)
  const { data: hits, loading } = useCustomerSearch(cfOpen ? debounced : '')

  useEffect(() => { void loadPlaces().then(setReady) }, [])
  useEffect(() => {
    if (!open && !cfOpen) return
    const off = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setCfOpen(false) } }
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [open, cfOpen])

  function type(v: string) {
    onChange(v)
    if (!ready) return
    const n = ++seq.current
    window.setTimeout(() => {
      if (n !== seq.current) return
      void predict(v).then((r) => { if (n === seq.current) { setList(r); setCursor(0); setOpen(r.length > 0) } })
    }, 220)
  }

  async function pickPlace(p: Prediction) {
    setOpen(false); setBusy(true)
    const d = await details(p.place_id)
    setBusy(false)
    onChange(d?.address || p.description)
  }

  function openCf() {
    setOpen(false)
    setCfTerm((partyName ?? '').trim())
    setCfOpen((o) => !o)
  }

  const cfRows: CustomerPickerValue[] = [
    ...(customer && !hits.some((h) => h.account_id === customer.account_id) ? [customer] : []),
    ...hits,
  ].filter((c) => composeAddress(c))

  return (
    <div ref={box} className="nqd-field relative">
      <div className="flex items-center justify-between">
        <span className="nqd-field__label">{label}</span>
        <button type="button" onClick={openCf} title="Pick an address from CyberFreight"
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-800">
          <Building2 size={12} /> From CF
        </button>
      </div>
      <div className="relative">
        {busy
          ? <Loader2 size={14} className="absolute left-2.5 top-3 animate-spin text-slate-400" />
          : <MapPin size={14} className="absolute left-2.5 top-3 text-slate-400" />}
        <textarea
          className="nqd-input nqd-textarea" rows={2} style={{ paddingLeft: 28 }} autoComplete="off"
          value={value} placeholder={ready ? 'Search address' : 'Address'}
          onChange={(e) => type(e.target.value)}
          onFocus={() => { if (list.length && value) setOpen(true) }}
          onKeyDown={(e) => {
            if (!open) return
            if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(list.length - 1, c + 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)) }
            else if (e.key === 'Enter' && list[cursor]) { e.preventDefault(); void pickPlace(list[cursor]) }
            else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) }
          }}
        />
      </div>

      {open && (
        <ul className={listCls}>
          {list.map((p, i) => (
            <li key={p.place_id}>
              <button type="button"
                className={`flex w-full items-start gap-2 px-3 py-1.5 text-left text-sm ${i === cursor ? 'bg-slate-100' : ''}`}
                onMouseEnter={() => setCursor(i)} onMouseDown={(e) => { e.preventDefault(); void pickPlace(p) }}>
                <MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" />
                <span>{p.main}{p.secondary && <span className="text-slate-500"> {p.secondary}</span>}</span>
              </button>
            </li>
          ))}
          <li className="px-3 pt-1 text-right text-[11px] text-slate-400">powered by Google</li>
        </ul>
      )}

      {cfOpen && (
        <div className={listCls} style={{ top: 22 }}>
          <div className="relative px-2 pb-1">
            <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="nqd-input" style={{ paddingLeft: 26, height: 32 }} autoFocus placeholder="Search CF accounts"
              value={cfTerm} onChange={(e) => setCfTerm(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setCfOpen(false) } }} />
          </div>
          {loading && <div className="px-3 py-2 text-xs text-slate-400">Searching…</div>}
          {!loading && !cfRows.length && (
            <div className="px-3 py-2 text-xs text-slate-400">{cfTerm.trim().length < 2 ? 'Type a company name' : 'No CF address found'}</div>
          )}
          {cfRows.map((c) => (
            <button key={c.account_id} type="button"
              className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-100"
              onMouseDown={(e) => { e.preventDefault(); onChange(composeAddress(c)); setCfOpen(false) }}>
              <Building2 size={13} className="mt-0.5 shrink-0 text-slate-400" />
              <span className="min-w-0">
                <span className="block truncate text-slate-900">
                  {c.name} <span className="text-[11px] text-slate-400">{c.account_id}{customer?.account_id === c.account_id ? ' · quote customer' : ''}</span>
                </span>
                <span className="block truncate text-xs text-slate-500">{composeAddress(c)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
