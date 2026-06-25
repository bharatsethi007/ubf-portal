export type Consol = {
  consol_key: string
  module: string
  mode: string
  direction: string
  master_bill: string | null
  origin: string | null
  destination: string | null
  vessel_flight: string | null
  etd: string | null
  eta: string | null
  departed: string | null
  arrived: string | null
  relevant_date: string | null
  job_count: number
}
