// Export Air booking from an inbox conversation. Opens on "ibx:ea-booking": email or files on the left,
// booking form on the right, parties linked to TradeWindow accounts. Logic lives in features/exportAir/intake.
import { useEffect, useState } from 'react'
import EaIntakeDialog from '@/features/exportAir/intake/EaIntakeDialog'
import type { InboxDetail } from './inboxApi'

export default function EaBookingDialog({ detail, onChanged }: { detail: InboxDetail; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const convId = detail.conversation.id

  useEffect(() => {
    const on = () => setOpen(true)
    window.addEventListener('ibx:ea-booking', on)
    return () => window.removeEventListener('ibx:ea-booking', on)
  }, [])
  useEffect(() => { setOpen(false) }, [convId])

  if (!open) return null
  const who = [...detail.messages].reverse().find((m) => m.direction === 'in' && m.sender_name)?.sender_name
    ?? detail.conversation.contact_name ?? detail.conversation.contact_email ?? 'Sender'
  return <EaIntakeDialog key={convId} detail={detail} who={who} onClose={() => setOpen(false)} onChanged={onChanged} />
}
