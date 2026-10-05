import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import { details, loadPlaces, predict, type PlaceValue, type Prediction } from '../../features/portal/v2/contacts/googlePlaces'

type Props = { label: string; value: string; onText: (v: string) => void; onPick: (p: PlaceValue) => void }

/** Google address search with an in-dialog dropdown (Google's own pac list is blocked by modal dialogs). NZ only. */
export default function CartageAddressSearch({ label, value, onText, onPick }: Props) {
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<Prediction[]>([])
  const [cursor, setCursor] = useState(0)
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const seq = useRef(0)

  useEffect(() => { void loadPlaces().then(setReady) }, [])
  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [open])

  function type(v: string) {
    onText(v)
    if (!ready) return
    const n = ++seq.current
    window.setTimeout(() => {
      if (n !== seq.current) return
      void predict(v, 'nz').then((r) => { if (n === seq.current) { setList(r); setCursor(0); setOpen(r.length > 0) } })
    }, 220)
  }

  async function pick(p: Prediction) {
    setOpen(false); setBusy(true)
    const d = await details(p.place_id)
    setBusy(false)
    if (d) onPick(d); else onText(p.description)
  }

  return (
    <div ref={box} className="relative">
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <div className="relative">
        {busy ? <Loader2 size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
          : <MapPin size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />}
        <input
          className="nqd-input" style={{ paddingLeft: 28 }} autoComplete="off" value={value}
          placeholder={ready ? 'Search address' : 'Street address'}
          onChange={(e) => type(e.target.value)}
          onFocus={() => { if (list.length && value) setOpen(true) }}
          onKeyDown={(e) => {
            if (!open) return
            if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(list.length - 1, c + 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)) }
            else if (e.key === 'Enter' && list[cursor]) { e.preventDefault(); void pick(list[cursor]) }
            else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) }
          }}
        />
      </div>
      {open && (
        <ul className="absolute left-0 right-0 z-10 mt-1 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-md">
          {list.map((p, i) => (
            <li key={p.place_id}>
              <button type="button"
                className={`flex w-full items-start gap-2 px-3 py-1.5 text-left text-sm ${i === cursor ? 'bg-slate-100' : ''}`}
                onMouseEnter={() => setCursor(i)} onMouseDown={(e) => { e.preventDefault(); void pick(p) }}>
                <MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" />
                <span>{p.main}{p.secondary && <span className="text-slate-500"> {p.secondary}</span>}</span>
              </button>
            </li>
          ))}
          <li className="px-3 pt-1 text-right text-[11px] text-slate-400">powered by Google</li>
        </ul>
      )}
    </div>
  )
}
