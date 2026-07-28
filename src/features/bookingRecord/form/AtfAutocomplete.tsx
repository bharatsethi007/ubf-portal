import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../../supabase'

type AtfHit = { atf_code: number; facility: string; address: string | null; city: string | null }

type Props = {
  value: string | null
  onChange: (code: string | null) => void
}

export default function AtfAutocomplete({ value, onChange }: Props) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<AtfHit[]>([])
  const [open, setOpen] = useState(false)
  const [resolved, setResolved] = useState<AtfHit | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    const code = value ? parseInt(value, 10) : NaN
    if (!Number.isFinite(code)) {
      setResolved(null)
      return
    }
    supabase
      .from('atf_facilities')
      .select('atf_code, facility, address, city')
      .eq('atf_code', code)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setResolved(data ?? null)
      })
    return () => {
      active = false
    }
  }, [value])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      return
    }
    const t = setTimeout(async () => {
      const asCode = /^\d+$/.test(q)
      let req = supabase.from('atf_facilities').select('atf_code, facility, address, city').limit(8)
      req = asCode ? req.eq('atf_code', parseInt(q, 10)) : req.ilike('facility', `%${q}%`)
      const { data } = await req
      setHits(data ?? [])
      setOpen(true)
    }, 200)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const pick = (h: AtfHit) => {
    onChange(String(h.atf_code))
    setResolved(h)
    setQuery('')
    setHits([])
    setOpen(false)
  }

  return (
    <div className="atf-combobox" ref={boxRef}>
      <input
        type="text"
        className="input input--sm"
        placeholder={value ? `${value}` : 'Search ATF code or facility…'}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          if (hits.length) setOpen(true)
        }}
      />
      {value ? (
        <div className="atf-combobox__resolved">
          <span>{resolved ? `${value} — ${resolved.facility}` : `ATF ${value}`}</span>
          <button
            type="button"
            className="text-link"
            onClick={() => {
              onChange(null)
              setResolved(null)
            }}
          >
            Clear
          </button>
        </div>
      ) : null}
      {open && hits.length > 0 ? (
        <ul className="atf-combobox__list">
          {hits.map((h) => (
            <li key={h.atf_code}>
              <button type="button" className="atf-combobox__opt" onClick={() => pick(h)}>
                <strong>{h.atf_code}</strong> — {h.facility}
                {h.city ? <span className="atf-combobox__city"> · {h.city}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
