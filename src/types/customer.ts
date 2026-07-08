export type CustomerStats = {
  account_id: string
  name: string | null
  branch: string | null
  is_importer: boolean | null
  is_exporter: boolean | null
  sales_manager: string | null
  total_shipments: number
  in_transit: number
  arrived: number
  imports: number
  exports: number
  this_month: number
  last_activity: string | null
  contact_count: number
  has_portal_access: boolean
  closed: boolean
}

export type Contact = {
  account_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  is_prime: boolean | null
}

export type PortalUserRow = {
  user_id: string
  account_id: number
  email?: string | null
}
