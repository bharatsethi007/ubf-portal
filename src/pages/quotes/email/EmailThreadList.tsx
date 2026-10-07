import { MailPlus, Search, Star } from 'lucide-react'
import type { EmailThread } from './quoteEmailApi'

type Props = {
  threads: EmailThread[]
  loading: boolean
  selected: string | null
  onSelect: (t: EmailThread | null) => void
  search: string
  onSearch: (v: string) => void
}

const MATCH: Record<string, string> = { account: 'Customer', contact: 'Contact', domain: 'Same company', search: 'Search' }

function when(iso: string) {
  const d = new Date(iso)
  const today = new Date().toDateString() === d.toDateString()
  return today ? d.toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
}

export default function EmailThreadList({ threads, loading, selected, onSelect, search, onSearch }: Props) {
  const card = (on: boolean) =>
    `w-full rounded-lg border px-3 py-2 text-left transition ${on ? 'border-[#0A2472] bg-[#F5F7FC]' : 'border-slate-200 bg-white hover:border-slate-300'}`
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">Send as</div>
      <button type="button" className={card(selected === null)} onClick={() => onSelect(null)}>
        <span className="flex items-center gap-2 text-sm text-slate-900"><MailPlus size={15} /> New email</span>
        <span className="block text-xs text-slate-500">Start a new chain from Sales Support</span>
      </button>

      <div className="mb-2 mt-4 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-slate-500">Or reply in a thread</span>
        {loading && <span className="text-[11px] text-slate-400">Loading…</span>}
      </div>
      <div className="relative mb-2">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input input--sm" style={{ paddingLeft: 26 }} placeholder="Search subject or sender" value={search} onChange={(e) => onSearch(e.target.value)} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto pr-1">
        {!loading && !threads.length && <p className="px-1 py-4 text-center text-xs text-slate-400">No email threads found for this customer.</p>}
        {threads.map((t) => (
          <button key={t.id} type="button" className={card(selected === t.id)} onClick={() => onSelect(t)}>
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0 truncate text-sm text-slate-900" title={t.subject ?? ''}>{t.subject || '(no subject)'}</span>
              <span className="shrink-0 text-[11px] text-slate-400">{when(t.last_message_at)}</span>
            </span>
            <span className="block truncate text-xs text-slate-500">{t.contact_name || t.contact_email || 'Unknown sender'} · {t.mailbox.split('@')[0]}</span>
            {t.last_preview && <span className="mt-0.5 block truncate text-xs text-slate-400">{t.last_preview}</span>}
            <span className="mt-1 flex items-center gap-1.5">
              {t.suggested && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]" style={{ background: '#FEF6E7', color: '#B45309' }}>
                  <Star size={10} /> Mentions this quote
                </span>
              )}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{MATCH[t.match] ?? t.match}</span>
              <span className="text-[10px] text-slate-400">{t.messages} msg{t.messages === 1 ? '' : 's'}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
