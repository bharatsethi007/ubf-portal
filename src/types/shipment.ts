export type Shipment = {
  job_unique: number
  module: string
  mode: 'air' | 'sea' | string
  direction: 'import' | 'export' | string
  customer_account_id: number | null
  house_bill: string | null
  job_no: string | null
  shipment_no: string | null
  origin: string | null
  destination: string | null
  vessel_flight: string | null
  etd: string | null
  eta: string | null
  departed: string | null
  arrived: string | null
  doc_date: string | null
  relevant_date: string | null
  consol_key: string | null
  goods_desc: string | null
  pack_qty: number | null
  pack_type: string | null
  weight_kg: number | null
  volume_m3: number | null
  marks: string | null
  final_dest: string | null
  status: string
  customers: { name: string } | null
}

export type StatCounts = {
  total: number
  notYetDeparted: number
  inTransit: number
  arrivingIn7Days: number
  watchlist: number
}

export type DashboardFilters = {
  modes: string[]
  statuses: string[]
  origins: string[]
  etdFrom: string
  etdTo: string
  etaFrom: string
  etaTo: string
  shipper: string
  client: string
  portCode: string
  search: string
  showMap: boolean
}

export const DEFAULT_FILTERS: DashboardFilters = {
  modes: [],
  statuses: [],
  origins: [],
  etdFrom: '',
  etdTo: '',
  etaFrom: '',
  etaTo: '',
  shipper: '',
  client: '',
  portCode: '',
  search: '',
  showMap: true,
}
