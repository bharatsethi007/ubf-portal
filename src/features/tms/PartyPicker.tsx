import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { searchParties, type PartyResult } from './partyApi'
import type { PartyDraft } from './consignmentFormApi'

type Props = { value: string; onPick: (p: Partial<PartyDraft>) => void; onType: (company: string) => void }

export default function PartyPicker({ value, onPick, onType }: Props) {
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<PartyResult[]>([])
  const [loading, setLoading] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = value.trim()
    if (q.length < 2) { setResults([]); return }
    let cancelled = false
    setLoading(true)
    const t = setTimeout(() => {
      searchParties(q).then((r) => { if (!cancelled) setResults(r) }).finally(() => { if (!cancelled) setLoading(false) })
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [value])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-md border border-neutral-300 px-3">
        <Search size={15} className="text-neutral-400" />
        <input className="w-full bg-transparent py-2 text-sm outline-none" placeholder="Search customer or type company…" value={value}
          onFocus={() => setOpen(true)} onChange={(e) => { onType(e.target.value); setOpen(true) }} />
      </div>
      {open && value.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
          {loading ? <p className="px-3 py-2 text-sm text-neutral-400">Searching…</p>
            : results.length === 0 ? <p className="px-3 py-2 text-sm text-neutral-400">No matches — keep typing to use as a new company.</p>
            : results.map((r) => (
              <button key={r.key} type="button" onClick={() => { onPick({ company: r.company, address: r.address, additional_info: r.additional_info ?? '', contact: r.contact ?? '', phone: r.phone ?? '', email: r.email ?? '' }); setOpen(false) }}
                className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left hover:bg-neutral-50">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{r.company}</span>
                  {r.address && <span className="block truncate text-xs text-neutral-500">{r.address}</span>}
                </span>
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${r.source === 'customer' ? 'bg-[#0A2472]/10 text-[#0A2472]' : 'bg-amber-100 text-amber-700'}`}>{r.source === 'customer' ? 'Customer' : 'TMS'}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
