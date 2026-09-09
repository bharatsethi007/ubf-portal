import type { CourierPartyPick } from './CourierPartyPicker'
import type { CourierPiece } from './CourierCargoPanel'

export type CourierSearchPiecePayload = {
  qty: number
  weightKg: number
  lengthCm: number
  widthCm: number
  heightCm: number
}

export type CourierAddressParty = {
  fullName: string
  company: string
  businessContact: boolean
  countryCode: string
  address1: string
  address2: string
  address3: string
  postcode: string
  city: string
  state: string
  residential: boolean
  email: string
  phone: string
  vatTaxId: string
}

export type CourierCommodityLine = {
  id: string
  description: string
  hsCode: string
  qty: string
  value: string
  currency: string
  countryOfManufacture: string
}

export type CourierBookingFormState = {
  isDocuments: boolean
  purpose: string
  commodities: CourierCommodityLine[]
  invoiceNumber: string
  remarks: string
  shipper: CourierAddressParty
  receiver: CourierAddressParty
  pieces: CourierPiece[]
  payerAccount: string
  dutiesPaidBy: 'Sender' | 'Receiver'
  incoterm: string
}

export const COURIER_PURPOSES = ['Sample', 'Commercial', 'Gift', 'Return', 'Personal Effects', 'Repair'] as const
export const COURIER_INCOTERMS = ['DDP', 'DAP', 'DDU', 'EXW', 'FCA', 'CIP', 'CPT'] as const
export const DEFAULT_PAYER_ACCOUNT = '969644637'

export function emptyAddressParty(): CourierAddressParty {
  return {
    fullName: '', company: '', businessContact: false, countryCode: '',
    address1: '', address2: '', address3: '', postcode: '', city: '', state: '',
    residential: false, email: '', phone: '', vatTaxId: '',
  }
}

export function newCommodityLine(): CourierCommodityLine {
  return { id: crypto.randomUUID(), description: '', hsCode: '', qty: '1', value: '', currency: 'NZD', countryOfManufacture: 'NZ' }
}

export function partyPickToAddress(p: CourierPartyPick, residential = false): CourierAddressParty {
  return {
    fullName: p.name,
    company: p.company,
    businessContact: true,
    countryCode: p.countryCode,
    address1: p.address1 ?? '',
    address2: p.address2 ?? '',
    address3: p.address3 ?? '',
    postcode: p.postcode ?? '',
    city: p.city ?? '',
    state: p.state ?? '',
    residential,
    email: p.email ?? '',
    phone: p.phone ?? '',
    vatTaxId: '',
  }
}

export type DhlCourierBookBody = {
  quoteId?: string
  service: string
  serviceCode?: string
  rateCharge: number
  rateCurrency: string
  isDocuments: boolean
  purpose: string
  shipper: CourierAddressParty
  receiver: CourierAddressParty
  commodities: { description: string; hsCode: string; qty: number; value: number; currency: string; countryOfManufacture: string }[]
  invoiceNumber?: string
  remarks?: string
  pieces: CourierSearchPiecePayload[]
  payerAccount: string
  dutiesPaidBy: 'Sender' | 'Receiver'
  incoterm: string
}

export function piecesToSearch(pieces: CourierPiece[]): CourierSearchPiecePayload[] {
  return pieces.map((p) => ({
    qty: Number(p.qty) || 0,
    weightKg: Number(p.weightKg) || 0,
    lengthCm: Number(p.lengthCm) || 0,
    widthCm: Number(p.widthCm) || 0,
    heightCm: Number(p.heightCm) || 0,
  }))
}

export function commoditiesToPayload(lines: CourierCommodityLine[]) {
  return lines.map((l) => ({
    description: l.description,
    hsCode: l.hsCode,
    qty: Number(l.qty) || 0,
    value: Number(l.value) || 0,
    currency: l.currency,
    countryOfManufacture: l.countryOfManufacture,
  }))
}
