import { Check, Users } from 'lucide-react'
import type { ContactSuggestion } from './composerPresets'

type Props = { contacts: ContactSuggestion[]; to: string[]; cc: string[]; onTo: (v: string[]) => void }

/** Customer contacts on file. Click to add to or remove from To. Already in Cc shows as such. */
export default function ContactPicker({ contacts, to, cc, onTo }: Props) {
  if (!contacts.length) {
    return (
      <div className="flex items-center gap-2 border-b border-slate-100 py-2 text-[12px] text-slate-500">
        <Users size={13} /> No customer emails on file. Type one in To.
      </div>
    )
  }
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 py-2">
      <span className="w-10 shrink-0 pt-1 text-slate-400" title="Customer contacts"><Users size={14} /></span>
      <div className="flex flex-1 flex-wrap gap-1.5">
        {contacts.map((c) => {
          const on = to.includes(c.email), inCc = cc.includes(c.email)
          return (
            <button
              key={c.email} type="button" disabled={inCc}
              title={`${c.email} · ${c.source}${inCc ? ' · in Cc' : ''}`}
              onClick={() => onTo(on ? to.filter((x) => x !== c.email) : [...to, c.email])}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                on ? 'border-blue-600 bg-blue-600 text-white'
                  : inCc ? 'border-slate-200 bg-slate-50 text-slate-400'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'}`}
            >
              {on && <Check size={12} />}
              <span className="font-medium">{c.name || c.email.split('@')[0]}</span>
              <span className={on ? 'text-blue-100' : 'text-slate-400'}>{c.email}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
