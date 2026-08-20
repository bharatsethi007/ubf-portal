import { supabase } from '../../../supabase'

export type ReviewQueueRow = {
  code: string
  name: string | null
  country: string | null
  jobs: number
  imp: number
  exp: number
  last_activity: string | null
  suggested_class: string | null
}

export type ReviewFlagRow = {
  code: string
  reason: string
  name: string | null
  imp: number
  exp: number
  jobs: number
}

export type ExcludeReason = 'self' | 'own office' | 'carrier' | 'customer' | 'not agent'

export const EXCLUDE_REASONS: ExcludeReason[] = [
  'self',
  'own office',
  'carrier',
  'customer',
  'not agent',
]

export const SUGGESTED_CLASS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'agent', label: 'Agent' },
  { key: 'customer', label: 'Customer' },
  { key: 'carrier', label: 'Carrier' },
  { key: 'unknown', label: 'Unknown' },
] as const

export type SuggestedClassFilter = (typeof SUGGESTED_CLASS_FILTERS)[number]['key']

export function suggestedToExcludeReason(suggested: string | null): ExcludeReason | null {
  const norm = suggested?.toLowerCase() ?? ''
  if (norm === 'customer') return 'customer'
  if (norm === 'carrier') return 'carrier'
  if (norm === 'unknown') return 'not agent'
  return null
}

export async function fetchReviewQueueCount(): Promise<number> {
  const { count, error } = await supabase
    .from('v_agent_review_queue')
    .select('*', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

export async function fetchReviewQueue(): Promise<ReviewQueueRow[]> {
  const { data, error } = await supabase
    .from('v_agent_review_queue')
    .select('code, name, country, jobs, imp, exp, last_activity, suggested_class')
    .order('jobs', { ascending: false })
  if (error) throw error
  return (data as ReviewQueueRow[]) ?? []
}

export async function fetchReviewFlags(): Promise<ReviewFlagRow[]> {
  const { data, error } = await supabase
    .from('v_agent_review_flags')
    .select('code, reason, name, imp, exp, jobs')
  if (error) throw error
  return (data as ReviewFlagRow[]) ?? []
}

export async function acceptAgentReview(args: {
  code: string
  networkCode?: string | null
  name?: string | null
}): Promise<void> {
  const { error } = await supabase.rpc('agent_review_accept', {
    p_code: args.code,
    p_network_code: args.networkCode ?? null,
    p_name: args.name ?? null,
  })
  if (error) throw error
}

export async function excludeAgentReview(code: string, reason: ExcludeReason): Promise<void> {
  const { error } = await supabase.rpc('agent_review_exclude', {
    p_code: code,
    p_reason: reason,
  })
  if (error) throw error
}
