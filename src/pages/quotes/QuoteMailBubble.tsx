import MailBubble from '@/features/mail/MailBubble'
import { SALES_MAILBOX_CFG } from '@/features/mail/mailTypes'

type Props = { quoteId?: string; quoteNo?: string | null; onChanged?: () => void; bottom?: number }

/**
 * Sales support mailbox on quote screens. Threads get Create quote / Link to quote, not bookings.
 * On the quote record it stacks above the preview and Freight Intelligence bubbles.
 */
export default function QuoteMailBubble({ quoteId, quoteNo, onChanged, bottom }: Props) {
  return (
    <MailBubble box={SALES_MAILBOX_CFG} record={quoteId ? { kind: 'quote', id: quoteId, ref: quoteNo } : undefined}
      onChanged={onChanged} bottom={bottom ?? (quoteId ? 152 : 24)} right={26} />
  )
}
