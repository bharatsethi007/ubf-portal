import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { assign, type InboxDetail } from './inboxApi'
import { buildSuggestions } from './suggestions'

type Props = { detail: InboxDetail; who: string; me: string; onPick: (text: string) => void; onChanged: () => void }

export default function SuggestionBar({ detail, who, me, onPick, onChanged }: Props) {
  const c = detail.conversation
  const quick = useMemo(() => buildSuggestions(detail, who), [detail, who])

  const lastIsIn = [...detail.messages].reverse().find((m) => m.kind === 'message')?.direction === 'in'
  const focus = detail.shipments.find((s) => s.focus) ?? null

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
      {(lastIsIn ? quick : []).map((s) => (
        <button key={s.key} type="button" className="ibx-sugg__chip" title={s.text} onClick={() => onPick(s.text)}>{s.label}</button>
      ))}
    </div>
  )
}
