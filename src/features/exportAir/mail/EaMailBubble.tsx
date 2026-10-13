import MailBubble from '@/features/mail/MailBubble'
import { EA_MAILBOX } from '@/features/mail/mailTypes'

type Props = { bookingId?: string; bookingRef?: string; onChanged?: () => void }

/** Export air mailbox on every EA screen. Stacks above the UBF Intelligence bubble, bottom right. */
export default function EaMailBubble({ bookingId, bookingRef, onChanged }: Props) {
  return <MailBubble box={EA_MAILBOX} record={bookingId ? { kind: 'booking', id: bookingId, ref: bookingRef } : undefined} onChanged={onChanged} />
}
