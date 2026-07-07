import type { PortalShipmentRow } from '../dashboard/portalDashboardApi'
import type { Container } from '../../../types/container'
import type { Invoice } from '../../../types/invoice'

export type PortalShipmentDetail = PortalShipmentRow & {
  master_bill: string | null
  marks: string | null
  final_dest: string | null
  created_src: string | null
}

export type TimelineMilestone = {
  key: string
  label: string
  state: 'done' | 'current' | 'pending'
  date: string | null
  estimated: boolean
}

export type ShipmentTask = {
  id: string
  label: string
  sev: 'high' | 'med'
}

export type PortalShipmentBundle = {
  shipment: PortalShipmentDetail
  containers: Container[]
  invoices: Invoice[]
  timeline: TimelineMilestone[]
  tasks: ShipmentTask[]
}

export const DETAIL_TABS = [
  'Summary',
  'Task',
  'Track & trace',
  'Invoices',
  'Cargo & containers',
  'Documents',
  'Additional services',
] as const

export type DetailTab = (typeof DETAIL_TABS)[number]
