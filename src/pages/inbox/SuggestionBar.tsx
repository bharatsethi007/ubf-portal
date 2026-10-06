import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Sparkles, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { aiSuggest, assign, type InboxDetail } from './inboxApi'
import { buildSuggestions } from './suggestions'

type Props = { detail: InboxDetail; who: string; me: string; onPick: (text: string) => void; onChanged: () => void }

export default function SuggestionBar({ detail, who, me, onPick, onChanged }: Props) {
  const c = detail.conversation
  const quick = useMemo(() => buildSuggestions(detail, who), [detail, who])
  const [ai, setAi] = useState<{ label: string; text: string }[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => { setAi([]) }, [c.id])

  const lastIsIn = [...detail.messages].reverse().find((m) => m.kind === 'message')?.direction === 'in'
  const focus = detail.shipments.find((s) => s.focus) ?? null

  async function draft() {
    setBusy(true)
    try {
      const r = await aiSuggest(c.id)
      if (!r.length) toast.message('No draft this time')
      setAi(r)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Draft failed') }
    finally { setBusy(false) }
  }

  async function takeIt() {
    try { await assign(c.id, me); onChanged() } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  return (
    <div className="ibx-sugg">
      {!c.assignee_id && me ? (
        <button type="button" className="ibx-sugg__chip ibx-sugg__chip--act" onClick={takeIt}><UserPlus size={13} />Assign to me</button>
      ) : null}
      {focus ? (
        <Link to={`/bookings/${focus.id}`} className="ibx-sugg__chip ibx-sugg__chip--act"><ExternalLink size={13} />{focus.booking_ref}</Link>
      ) : null}
      {(ai.length ? ai : lastIsIn ? quick : []).map((s, i) => (
        <button key={`${s.label}-${i}`} type="button" className={`ibx-sugg__chip${ai.length ? ' ibx-sugg__chip--ai' : ''}`}
          title={s.text} onClick={() => onPick(s.text)}>{s.label}</button>
      ))}
      <button type="button" className="ibx-sugg__chip ibx-sugg__chip--ai" disabled={busy} onClick={draft} style={{ marginLeft: 'auto' }}>
        <Sparkles size={13} />{busy ? 'Drafting…' : ai.length ? 'Redraft' : 'Draft reply'}
      </button>
    </div>
  )
}
