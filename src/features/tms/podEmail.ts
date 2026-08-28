// Proof-of-Delivery email. Pure function, no deps. Uses the shared chrome in emailShared.ts.
import {
  type EmailParty, type EmailCargoLine,
  idRow, introRow, attachmentChips, partiesRow, detailStrip, manifestSection, wrapEmailDocument,
} from './emailShared'

export type PodEmailInput = {
  consignment_no: string
  delivered_date: string     // preformatted, e.g. "28 Aug 2026, 2:41 pm"
  driver?: string
  sender: EmailParty
  receiver: EmailParty
  cargo: EmailCargoLine[]
}

export function buildPodEmailHtml(input: PodEmailInput): string {
  const pieces = input.cargo.reduce((t, c) => t + (Number(c.qty) || 0), 0)
  const inner =
    idRow(input.consignment_no, 'Delivered', input.delivered_date) +
    introRow('This confirms that the consignment below has been delivered. The proof of delivery is attached.') +
    attachmentChips(['Proof of Delivery']) +
    partiesRow('Delivered to', input.receiver, 'Sender', input.sender) +
    detailStrip([
      { k: 'Delivered', v: input.delivered_date },
      { k: 'Driver', v: input.driver || '—' },
      { k: 'Items', v: `${pieces} ${pieces === 1 ? 'piece' : 'pieces'}` },
    ]) +
    manifestSection(input.cargo)

  return wrapEmailDocument({
    title: `Proof of delivery \u2014 UB Freight consignment ${input.consignment_no}`,
    preheader: `Consignment ${input.consignment_no} delivered ${input.delivered_date}. Proof of delivery attached.`,
    innerHtml: inner,
  })
}
