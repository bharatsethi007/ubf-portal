import { useEffect, useRef, useState } from 'react'
import { Building2, Loader2, MapPin } from 'lucide-react'
import { details, loadPlaces, predict, type PlaceValue, type Prediction } from './googlePlaces'

type Props = {
  id: string
  label: string
  value: string
  onText: (text: string) => void
  onPick: (place: PlaceValue) => void
  placeholder?: string
}

/** Address search with Google Places in the portal's own dropdown. Free typing always works. */
export default function PlaceInput({ id, label, value, onText, onPick, placeholder }: Props) {
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<Prediction[]>([])
  const [cursor, setCursor] = useState(0)
  const [busy, setBusy] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const seq = useRef(0)

  useEffect(() => { void loadPlaces().then(setReady) }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function type(v: string) {
    onText(v)
    if (!ready) return
    const n = ++seq.current
    window.setTimeout(() => {
      if (n !== seq.current) return
      void predict(v).then((r) => { if (n === seq.current) { setList(r); setCursor(0); setOpen(r.length > 0) } })
    }, 220)
  }

  async function pick(p: Prediction) {
    setOpen(false)
    setBusy(true)
    const d = await details(p.place_id)
    setBusy(false)
    if (d) onPick(d)
    else onText(p.description)
  }

  return (
    <div className="pv3-field" ref={boxRef}>
      <label htmlFor={id}>{label}</label>
      <div className="pv3-combo">
        {busy ? <Loader2 size={15} className="pv3-combo__ico pv3-spin" aria-hidden /> : <MapPin size={15} className="pv3-combo__ico" aria-hidden />}
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          autoComplete="off"
          value={value}
          placeholder={placeholder ?? (ready ? 'Start typing a company or street address' : 'Street, city, postcode, country')}
          onChange={(e) => type(e.target.value)}
          onFocus={() => { if (list.length && value) setOpen(true) }}
          onKeyDown={(e) => {
            if (!open) return
            if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(list.length - 1, c + 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)) }
            else if (e.key === 'Enter' && list[cursor]) { e.preventDefault(); void pick(list[cursor]) }
            else if (e.key === 'Escape') setOpen(false)
          }}
        />
        {open && (
          <ul className="pv3-combo__list" id={`${id}-list`} role="listbox">
            {list.map((p, i) => (
              <li key={p.place_id} role="option" aria-selected={i === cursor}>
                <button type="button" className={i === cursor ? 'pv3-combo__opt pv3-combo__opt--on' : 'pv3-combo__opt'}
                  onMouseEnter={() => setCursor(i)} onMouseDown={(e) => { e.preventDefault(); void pick(p) }}>
                  {/\d/.test(p.main) ? <MapPin size={14} aria-hidden /> : <Building2 size={14} aria-hidden />}
                  <span className="pv3-combo__name"><b style={{ fontWeight: 500 }}>{p.main}</b>{p.secondary && <span className="pv3-muted"> {p.secondary}</span>}</span>
                </button>
              </li>
            ))}
            <li className="pv3-combo__empty" style={{ textAlign: 'right', fontSize: 11, padding: '4px 8px' }} aria-hidden>powered by Google</li>
          </ul>
        )}
      </div>
    </div>
  )
}
