import { Search } from 'lucide-react'
import type { InboxRow } from '@/pages/inbox/inboxApi'
import { timeAgo } from '@/pages/inbox/inboxFormat'

export type MailTab = 'job' | 'all' | 'mine' | 'unassigned'

type Props = {
  rows: InboxRow[]
  tab: MailTab
  tabs: { id: MailTab; label: string; n?: number }[]
  q: string
  selected: string | null
  loading: boolean
  empty: string
  onTab: (t: MailTab) => void
  onQ: (q: string) => void
  onPick: (id: string) => void
}

/** Compact conversation list for a shared mailbox. */
export default function MailList({ rows, tab, tabs, q, selected, loading, empty, onTab, onQ, onPick }: Props) {
  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-[#E6E8EE] bg-[#FAFBFC]">
      <div className="flex flex-col gap-2 border-b border-[#E6E8EE] px-3 pb-2 pt-3">
        <label className="relative">
          <span className="sr-only">Search mailbox</span>
          <Search size={13} className="absolute left-2.5 top-[9px] text-[#98A2B3]" />
          <input value={q} onChange={(e) => onQ(e.target.value)} placeholder="Search sender, subject, ref"
            className="h-[30px] w-full rounded-[7px] border border-[#E3E6EB] bg-white pl-7 pr-2 text-[12.5px] outline-none focus:border-[#0A2472]" />
        </label>
        <div role="tablist" aria-label="Mail views" className="flex gap-3">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => onTab(t.id)}
              className={`w-auto border-0 border-b-2 bg-transparent px-0 pb-1 text-[12px] ${tab === t.id ? 'border-[#0A2472] font-semibold text-[#14161A]' : 'border-transparent text-[#5B616E] hover:text-[#14161A]'}`}>
              {t.label}{t.n != null ? <span className="bk-mono ml-1 text-[10.5px] text-[#98A2B3]">{t.n}</span> : null}
            </button>
          ))}
        </div>
      </div>
      <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0">
        {loading && !rows.length ? <li className="px-4 py-6 text-center text-[12px] text-[#6B7280]">Loading…</li> : null}
        {!loading && !rows.length ? <li className="px-4 py-6 text-center text-[12px] text-[#6B7280]">{tab === 'job' ? empty : 'Nothing here.'}</li> : null}
        {rows.map((r) => {
          const on = r.id === selected
          return (
            <li key={r.id}>
              <button type="button" onClick={() => onPick(r.id)} aria-current={on || undefined}
                className={`flex w-full flex-col gap-0.5 border-0 border-b border-[#EEF0F3] px-3 py-2.5 text-left ${on ? 'bg-[#EAF0FA]' : 'bg-transparent hover:bg-white'}`}>
                <span className="flex items-center gap-1.5">
                  {r.unread > 0 ? <span aria-label="Unread" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#2E6BD8]" /> : null}
                  <span className={`truncate text-[12.5px] ${r.unread ? 'font-semibold text-[#14161A]' : 'font-medium text-[#14161A]'}`}>{r.account_name ?? r.who}</span>
                  <span className="ml-auto shrink-0 text-[10.5px] text-[#98A2B3]">{timeAgo(r.last_message_at)}</span>
                </span>
                <span className="truncate text-[12px] text-[#334155]">{r.subject || '(no subject)'}</span>
                <span className="flex items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-[#6B7280]">{r.last_preview}</span>
                  {r.booking_ref || r.quote_no ? <span className="bk-mono shrink-0 rounded bg-[#EEF1F9] px-1 text-[10px] leading-[15px] text-[#0A2472]">{r.booking_ref ?? r.quote_no}</span> : null}
                  {r.assignee_initials ? <span className="shrink-0 text-[10px] font-semibold text-[#5B616E]">{r.assignee_initials}</span> : null}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
