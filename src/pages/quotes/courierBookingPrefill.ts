import { newCourierPiece, type CourierDestination, type CourierLocation, type CourierPiece } from './CourierCargoPanel'
import {
  DEFAULT_PAYER_ACCOUNT, emptyAddressParty, newCommodityLine, type CourierBookingFormState,
} from './courierBookingTypes'

export type CourierBookingPrefill = {
  isDocuments: boolean
  fromAddress: string
  from: CourierLocation
  toAddress: string
  to: CourierDestination
  pieces: CourierPiece[]
  incoterm?: string | null
}

export function buildCourierBookingFormState(p: CourierBookingPrefill): CourierBookingFormState {
  const inc = (p.incoterm ?? '').toUpperCase()
  const validInc = ['DDP', 'DAP', 'DDU', 'EXW', 'FCA', 'CIP', 'CPT'].includes(inc) ? inc : 'DDP'
  return {
    isDocuments: p.isDocuments,
    purpose: 'Commercial',
    commodities: [newCommodityLine()],
    invoiceNumber: '',
    remarks: '',
    shipper: {
      ...emptyAddressParty(),
      countryCode: p.from.countryCode,
      city: p.from.city,
      postcode: p.from.postcode,
      state: p.from.state ?? '',
      address1: p.from.street?.trim() || p.fromAddress,
    },
    receiver: {
      ...emptyAddressParty(),
      countryCode: p.to.countryCode,
      city: p.to.city,
      postcode: p.to.postcode,
      state: p.to.state ?? '',
      address1: p.to.street?.trim() || p.toAddress,
      residential: p.to.residential,
    },
    pieces: p.pieces.length ? p.pieces.map((x) => ({ ...x })) : [newCourierPiece()],
    payerAccount: DEFAULT_PAYER_ACCOUNT,
    dutiesPaidBy: 'Sender',
    incoterm: validInc,
  }
}
