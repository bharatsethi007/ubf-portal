import { useEffect, useMemo, useRef, useState } from 'react'
import { BookUser, Pencil, Plus, Search } from 'lucide-react'
import PartyFields from '../contacts/PartyFields'
import { EMPTY_PARTY, fromContact, partyLine, type Contact, type Party } from '../contacts/contactsApi'
import '../contacts/contacts.css'

type Props = {
  id: string
  role: 'shipper' | 'consignee'
  title: string
  hint: string
  required: boolean
  value: Party
  onChange: (p: Party) => void
  contacts: Contact[]
  save: boolean
  onSave: (v: boolean) => void
}

/** Pick a saved contact or type a new party, with an option to keep it in Contacts. */
export default function PartyPicker({ id, role, title, hint, required, value, onChange, contacts, save, onSave }: Props) {
  const mine = useMemo(() => contacts.filter((c) => c.role === role || c.role === 'both'), [contacts, role])
  const [mode, setMode] = useState<'card' | 'pick' | 'edit'>(value.company ? 'card' : 'pick')
  const [fromSaved, setFromSaved] = useState(false)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const list = useMemo(() => {
    const n = q.trim().toLowerCase()
    return mine.filter((c) => !n || [c.company, c.contact_name, c.city, c.country].join(' ').toLowerCase().includes(n)).slice(0, 8)
  }, [mine, q])

  const choose = (c: Contact) => { onChange(fromContact(c)); setFromSaved(true); onSave(false); setMode('card'); setOpen(false); setQ('') }
  const fresh = () => { onChange({ ...EMPTY_PARTY, company: q.trim() }); setFromSaved(false); setMode('edit'); setOpen(false) }

  return (
    <div className="pv3-party">
      <div>
        <div style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{title}{required ? '' : <span className="pv3-muted" style={{ fontWeight: 400 }}> (optional)</span>}</div>
        <span className="pv3-muted" style={{ fontSize: 12.5 }}>{hint}</span>
      </div>

      {mode === 'card' && value.company ? (
        <div className="pv3-party__chosen">
          <BookUser size={18} color="var(--muted)" aria-hidden />
          <div><b>{value.company}</b><span>{partyLine(value) || 'No address yet'}</span>{value.email && <span>{[value.email, value.phone].filter(Boolean).join(' · ')}</span>}</div>
          <button type="button" className="pv3-iconbtn" title="Edit details" aria-label="Edit details" onClick={() => setMode('edit')}><Pencil size={14} /></button>
          <button type="button" className="pv3-textbtn" onClick={() => { onChange(EMPTY_PARTY); setMode('pick') }}>Change</button>
        </div>
      ) : mode === 'pick' ? (
        <div className="pv3-field" ref={boxRef}>
          <label htmlFor={`${id}-find`}>{mine.length ? 'Choose from your contacts' : 'Company'}</label>
          <div className="pv3-combo">
            <Search size={15} className="pv3-combo__ico" aria-hidden />
            <input id={`${id}-find`} role="combobox" aria-expanded={open} autoComplete="off" value={q}
              placeholder={mine.length ? `Search ${mine.length} saved contact${mine.length === 1 ? '' : 's'} or type a new name` : 'Type the company name'}
              onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (list[0] && q) choose(list[0]); else fresh() } }} />
            {open && (
              <ul className="pv3-combo__list" role="listbox">
                {list.map((c) => (
                  <li key={c.id} role="option" aria-selected={false}>
                    <button type="button" className="pv3-combo__opt" onMouseDown={(e) => { e.preventDefault(); choose(c) }}>
                      <BookUser size={14} aria-hidden />
                      <span className="pv3-combo__name"><b style={{ fontWeight: 500 }}>{c.company}</b> <span className="pv3-muted">{[c.city, c.country].filter(Boolean).join(', ')}</span></span>
                    </button>
                  </li>
                ))}
                <li role="option" aria-selected={false}>
                  <button type="button" className="pv3-combo__opt" onMouseDown={(e) => { e.preventDefault(); fresh() }}>
                    <Plus size={14} aria-hidden /><span className="pv3-combo__name">{q.trim() ? `New ${role}: ${q.trim()}` : `Enter a new ${role}`}</span>
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>
      ) : (
        <>
          <PartyFields id={id} value={value} onChange={onChange} companyLabel={role === 'shipper' ? 'Shipper company' : 'Consignee company'} />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            {!fromSaved
              ? <label className="pv3-check pv3-party__save"><input type="checkbox" checked={save} onChange={(e) => onSave(e.target.checked)} /> Save to my contacts</label>
              : <span className="pv3-muted" style={{ fontSize: 12.5 }}>Changes apply to this booking only.</span>}
            {mine.length > 0 && <button type="button" className="pv3-textbtn" onClick={() => { onChange(EMPTY_PARTY); setMode('pick') }}>Pick a saved contact instead</button>}
          </div>
        </>
      )}
    </div>
  )
}
