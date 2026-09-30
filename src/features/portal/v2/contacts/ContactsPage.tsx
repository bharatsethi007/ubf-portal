import { useEffect, useMemo, useState } from 'react'
import { BookUser, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import ContactModal from './ContactModal'
import { ROLE_LABEL, deleteContact, listContacts, type Contact, type ContactRole } from './contactsApi'
import './contacts.css'

type Filter = 'all' | 'shipper' | 'consignee'
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'shipper', label: 'Shippers' }, { key: 'consignee', label: 'Consignees' },
]
const fits = (r: ContactRole, f: Filter) => f === 'all' || r === 'both' || r === f

/** Settings > Contacts: the shippers and consignees this account books with. */
export default function ContactsPage() {
  const [rows, setRows] = useState<Contact[] | null>(null)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Contact | null | 'new'>(null)

  const load = () => listContacts().then(setRows).catch((e) => setErr(e instanceof Error ? e.message : 'Could not load'))
  useEffect(() => { void load() }, [])

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase()
    return (rows ?? []).filter((c) => fits(c.role, filter)
      && (!n || [c.company, c.contact_name, c.email, c.address, c.city, c.country].join(' ').toLowerCase().includes(n)))
  }, [rows, filter, q])

  async function remove(c: Contact) {
    if (!window.confirm(`Delete ${c.company}? Past bookings keep their details.`)) return
    try { await deleteContact(c.id); setRows((r) => (r ?? []).filter((x) => x.id !== c.id)) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not delete') }
  }

  return (
    <div className="pv3-page">
      <div className="pv3-head pv3-rise">
        <div>
          <h1>Contacts</h1>
          <p>Your shippers and consignees. Pick them in a booking instead of typing them again.</p>
        </div>
        <div className="pv3-head__actions">
          <button type="button" className="pv3-btn pv3-btn--primary" onClick={() => setEditing('new')}><Plus size={15} /> New contact</button>
        </div>
      </div>

      {err && <div className="pv3-error">{err}</div>}

      <div className="pv3-contacts__bar">
        <div className="pv3-tabs" role="tablist" aria-label="Contact type">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" role="tab" aria-selected={filter === f.key}
              className={`pv3-tabs__btn${filter === f.key ? ' pv3-tabs__btn--on' : ''}`} onClick={() => setFilter(f.key)}>
              {f.label}<span className="pv3-tabs__n">{(rows ?? []).filter((c) => fits(c.role, f.key)).length}</span>
            </button>
          ))}
        </div>
        <label className="pv3-contacts__search"><Search size={15} aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company, person, city" aria-label="Search contacts" />
        </label>
      </div>

      <section className="pv3-card pv3-table-card pv3-rise" style={{ animationDelay: '.06s' }}>
        <div className="pv3-table-wrap">
          <table className="pv3-table">
            <thead><tr><th>Company</th><th>Contact</th><th>Address</th><th>Use as</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {rows === null && [0, 1, 2].map((i) => <tr key={i}><td colSpan={5}><span className="pv3-skel" /></td></tr>)}
              {rows && shown.length === 0 && (
                <tr><td colSpan={5} className="pv3-empty-cell">
                  <BookUser size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                  {rows.length === 0 ? 'No contacts yet. Add your regular suppliers and customers, or tick "Save to contacts" on a booking.' : 'No contacts match.'}
                </td></tr>
              )}
              {shown.map((c) => (
                <tr key={c.id} onClick={() => setEditing(c)} style={{ cursor: 'pointer' }}>
                  <td><span className="pv3-strong">{c.company}</span>{c.country && <span className="pv3-cell-sub">{c.country}</span>}</td>
                  <td>{c.contact_name || <span className="pv3-muted">—</span>}<span className="pv3-cell-sub">{[c.email, c.phone].filter(Boolean).join(' · ')}</span></td>
                  <td style={{ maxWidth: 320 }}><span className="pv3-ellipsis" title={c.address}>{c.address || [c.city, c.postcode].filter(Boolean).join(' ') || '—'}</span></td>
                  <td><span className={`pv3-contacts__role pv3-contacts__role--${c.role}`}>{ROLE_LABEL[c.role]}</span></td>
                  <td>
                    <div className="pv3-contacts__acts">
                      <button type="button" className="pv3-iconbtn" aria-label={`Edit ${c.company}`} title="Edit" onClick={(e) => { e.stopPropagation(); setEditing(c) }}><Pencil size={14} /></button>
                      <button type="button" className="pv3-iconbtn" aria-label={`Delete ${c.company}`} title="Delete" onClick={(e) => { e.stopPropagation(); void remove(c) }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <ContactModal initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
          onSaved={(c) => { setEditing(null); setRows((r) => [...(r ?? []).filter((x) => x.id !== c.id), c].sort((a, b) => a.company.localeCompare(b.company))) }} />
      )}
    </div>
  )
}
