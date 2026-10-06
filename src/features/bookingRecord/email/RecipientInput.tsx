import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { searchEmailContacts, type EmailContact } from './emailApi'

type Props = { label: string; value: string[]; onChange: (v: string[]) => void; kind?: string; autoFocus?: boolean }

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

export default function RecipientInput({ label, value, onChange, kind, autoFocus }: Props) {
  const [text, setText] = useState('')
  const [hits, setHits] = useState<EmailContact[]>([])
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    let live = true
    const t = window.setTimeout(() => {
      void searchEmailContacts(text, kind).then((r) => { if (live) { setHits(r.filter((h) => !value.includes(h.email))); setIdx(0) } })
    }, 150)
    return () => { live = false; window.clearTimeout(t) }
  }, [text, open, kind, value])

  function add(raw: string) {
    const parts = raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)
    const good = parts.filter(isEmail)
    if (good.length) onChange([...new Set([...value, ...good])])
    setText(parts.filter((p) => !isEmail(p)).join(' '))
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && hits.length) { e.preventDefault(); setIdx((i) => Math.min(i + 1, hits.length - 1)) }
    else if (e.key === 'ArrowUp' && hits.length) { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' || e.key === 'Tab' || e.key === ',' || e.key === ';') {
      if (open && hits[idx] && !isEmail(text.trim())) { e.preventDefault(); add(hits[idx].email); return }
      if (text.trim()) { e.preventDefault(); add(text) }
    } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div className="relative flex items-start gap-3 border-b border-slate-100 py-2" onClick={() => inputRef.current?.focus()}>
      <span className="w-10 shrink-0 pt-1 text-[12px] font-medium text-slate-500">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {value.map((v) => (
          <span key={v} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12.5px] ${isEmail(v) ? 'border-blue-100 bg-blue-50 text-blue-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {v}
            <button type="button" title="Remove" aria-label={`Remove ${v}`} className="text-slate-400 hover:text-slate-700"
              onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== v)) }}>
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef} autoFocus={autoFocus} value={text}
          onChange={(e) => { setText(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => { setOpen(false); if (text.trim()) add(text) }, 150)}
          onKeyDown={onKey}
          onPaste={(e) => { const t = e.clipboardData.getData('text'); if (/[,;\s]/.test(t)) { e.preventDefault(); add(t) } }}
          className="min-w-[180px] flex-1 border-0 bg-transparent py-1 text-[13.5px] outline-none"
          placeholder={value.length ? '' : 'Type a name or email'}
        />
      </div>
      {open && hits.length > 0 && (
        <div className="absolute left-12 top-full z-50 mt-1 w-[360px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {hits.map((h, i) => (
            <button key={h.email} type="button"
              onMouseDown={(e) => { e.preventDefault(); add(h.email) }}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left ${i === idx ? 'bg-slate-50' : ''}`}>
              <span className="min-w-0">
                <span className="block truncate text-[13px] text-slate-800">{h.name || h.company || h.email}</span>
                {(h.name || h.company) && <span className="block truncate text-[11.5px] text-slate-500">{h.email}</span>}
              </span>
              {h.kind !== 'other' && <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] uppercase text-slate-500">{h.kind}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
