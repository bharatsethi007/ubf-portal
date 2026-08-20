import { supabase } from '@/supabase'

export interface CsatSummary {
  responses: number
  avg_score: number | null
  csat_pct: number | null
  satisfied: number
  neutral: number
  dissatisfied: number
  requests_sent: number
  response_rate: number | null
  distinct_accounts: number
  with_comment: number
}

export interface CsatTrendRow {
  period: string
  responses: number
  avg_score: number | null
  csat_pct: number | null
}

export interface CsatByChannelRow {
  channel: string
  responses: number
  avg_score: number | null
  csat_pct: number | null
  response_rate: number | null
}

export interface CsatByRepRow {
  staff_user_id: string | null
  initials: string | null
  responses: number
  avg_score: number | null
  csat_pct: number | null
}

export interface CsatByCustomerRow {
  account_id: string | null
  customer_name: string | null
  responses: number
  avg_score: number | null
  csat_pct: number | null
  last_response_at: string | null
}

export interface CsatCommentRow {
  created_at: string
  channel: string | null
  account_id: string | null
  customer_name: string | null
  staff_initials: string | null
  score: number | null
  sentiment: string | null
  comment: string | null
  booking_id: string | null
}

export type CsatBucket = 'day' | 'week' | 'month'

export type CsatFilters = {
  from: string | null
  to: string | null
  channel: string | null
  account: string | null
  staff: string | null
}

function baseParams(f: CsatFilters) {
  return {
    p_from: f.from,
    p_to: f.to,
    p_channel: f.channel,
    p_account: f.account,
    p_staff: f.staff,
  }
}

export async function fetchCsatSummary(f: CsatFilters): Promise<CsatSummary | null> {
  const { data, error } = await supabase.rpc('report_cs_csat_summary', baseParams(f))
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return (row ?? null) as CsatSummary | null
}

export async function fetchCsatTrend(f: CsatFilters, bucket: CsatBucket = 'month'): Promise<CsatTrendRow[]> {
  const { data, error } = await supabase.rpc('report_cs_csat_trend', { p_bucket: bucket, ...baseParams(f) })
  if (error) throw error
  return (data ?? []) as CsatTrendRow[]
}

export async function fetchCsatByChannel(f: CsatFilters): Promise<CsatByChannelRow[]> {
  const { data, error } = await supabase.rpc('report_cs_csat_by_channel', {
    p_from: f.from,
    p_to: f.to,
    p_account: f.account,
    p_staff: f.staff,
  })
  if (error) throw error
  return (data ?? []) as CsatByChannelRow[]
}

export async function fetchCsatByRep(f: CsatFilters): Promise<CsatByRepRow[]> {
  const { data, error } = await supabase.rpc('report_cs_csat_by_rep', {
    p_from: f.from,
    p_to: f.to,
    p_channel: f.channel,
  })
  if (error) throw error
  return (data ?? []) as CsatByRepRow[]
}

export async function fetchCsatByCustomer(f: CsatFilters): Promise<CsatByCustomerRow[]> {
  const { data, error } = await supabase.rpc('report_cs_csat_by_customer', {
    p_from: f.from,
    p_to: f.to,
    p_channel: f.channel,
    p_staff: f.staff,
  })
  if (error) throw error
  return (data ?? []) as CsatByCustomerRow[]
}

export async function fetchCsatComments(f: CsatFilters, limit = 100): Promise<CsatCommentRow[]> {
  const { data, error } = await supabase.rpc('report_cs_csat_comments', { ...baseParams(f), p_limit: limit })
  if (error) throw error
  return (data ?? []) as CsatCommentRow[]
}
