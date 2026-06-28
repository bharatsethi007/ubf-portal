export type VolumeRow = {
  mode: 'air' | 'sea'
  dir: 'export' | 'import'
  dest: string
  count: number
}

export type IntelligenceJob = {
  job: string
  mode: 'air' | 'sea'
  dir: 'export' | 'import'
  dest: string
  route: string
  etd: string | null
  eta: string | null
  date: string | null
}

export type PartyIntelligence = {
  name?: string
  email?: string | null
  volume: VolumeRow[]
  due_invoices: number
  ytd_spend: number
  jobs: IntelligenceJob[]
}

export type PartyIntelDisplay = PartyIntelligence & { name: string }

export type BookingMeta = {
  mode_label: string
  ops_mailbox: string
}

export type IntelligenceBookingMeta = {
  accountId?: string | null
  consigneeAccountId?: string | null
  firstSupplierAccountId?: string | null
  bookingRef?: string | null
  vessel?: string | null
  voyage?: string | null
}

export type IntelligenceBookingSnapshot = {
  bookingRef?: string | null
  origin?: string | null
  destination?: string | null
  serviceType?: string | null
  incoterm?: string | null
  airlineName?: string | null
  vessel?: string | null
  flightNo?: string | null
  voyage?: string | null
  cargoReadyDate?: string | null
  etd?: string | null
  eta?: string | null
  accountId?: string | null
  pieces?: number | null
  weightKg?: number | null
  cbm?: number | null
  volumeM3?: number | null
  goodsDescription?: string | null
}

export type IntelligenceNote = {
  text: string
  cta?: { label: string }
}

export type ConfirmationDraftContext = {
  meta: BookingMeta | null
  booking: IntelligenceBookingSnapshot
  supplier: PartyIntelDisplay | null
  consignee: PartyIntelDisplay | null
}

export type IntelligencePanelData = {
  supplier: PartyIntelDisplay | null
  consignee: PartyIntelDisplay | null
  notes: IntelligenceNote[]
}
