import { supabase } from '@/supabase'

export interface CsComplaintsSummary {
  total_complaints: number
  open_complaints: number
  resolved_complaints: number
  avg_resolution_days: number | null
  accounts_affected: number
  repeat_accounts: number
  high_severity_open: number
  negative_sentiment_comms: number
}

export interface CsComplaintsListRow {
  comm_id: string
  booking_id: string | null
  occurred_at: string
  account_id: string | null
  customer_name: string | null
  complaint_type: string | null
  complaint_severity: string | null
  complaint_status: string | null
  sentiment: string | null
  subject: string | null
  body: string | null
  resolved_at: string | null
  age_days: number | null
  resolution_days: number | null
}

export interface CsComplaintsByCustomerRow {
  account_id: string | null
  customer_name: string | null
  complaints: number
  open_complaints: number
  at_risk_touches: number
  last_complaint_at: string | null
  avg_resolution_days: number | null
}

export interface CsBreakdownRow {
  label: string
  value: number
}

export type CsFilters = {
  from: string | null
  to: string | null
  customer: string | null
  severity: string | null
  status: string | null
  type: string | null
}

export type CsBreakdownDimension = 'type' | 'severity' | 'status' | 'sentiment'

function filterParams(f: CsFilters) {
  return {
    p_from: f.from,
    p_to: f.to,
    p_customer: f.customer,
    p_severity: f.severity,
    p_status: f.status,
    p_type: f.type,
  }
}

export async function fetchCsComplaintsSummary(f: CsFilters): Promise<CsComplaintsSummary | null> {
  const { data, error } = await supabase.rpc('report_cs_complaints_summary', filterParams(f))
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return (row ?? null) as CsComplaintsSummary | null
}

export async function fetchCsComplaintsList(f: CsFilters, limit = 200): Promise<CsComplaintsListRow[]> {
  const { data, error } = await supabase.rpc('report_cs_complaints_list', { ...filterParams(f), p_limit: limit })
  if (error) throw error
  return (data ?? []) as CsComplaintsListRow[]
}

export async function fetchCsComplaintsByCustomer(f: CsFilters): Promise<CsComplaintsByCustomerRow[]> {
  const { data, error } = await supabase.rpc('report_cs_complaints_by_customer', filterParams(f))
  if (error) throw error
  return (data ?? []) as CsComplaintsByCustomerRow[]
}

export async function fetchCsComplaintsBreakdown(
  dimension: CsBreakdownDimension,
  f: CsFilters,
): Promise<CsBreakdownRow[]> {
  const { data, error } = await supabase.rpc('report_cs_complaints_breakdown', {
    p_dimension: dimension,
    ...filterParams(f),
  })
  if (error) throw error
  return (data ?? []) as CsBreakdownRow[]
}
