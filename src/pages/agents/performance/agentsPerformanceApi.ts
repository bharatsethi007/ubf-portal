import { supabase } from '../../../supabase'

export type PerfKpis = {
  quotes: number; won: number; lost: number; quotes_prior: number
  freehand: number; freehand_prior: number; freehand_gp: number
  nominations: number; nominations_prior: number; nominations_gp: number
  freehand_agents: number; nomination_agents: number; reciprocal_agents: number; quoting_agents: number
  exceptions?: number; unbilled?: number
}
export type NetworkRow = {
  network: string; agents: number; active_agents: number; quotes: number; won: number; lost: number
  fh: number; fh_gp: number; nom: number; nom_gp: number; reciprocal: number; fh_prior: number; nom_prior: number
}
export type ReciprocalRow = { id: string; name: string; country: string | null; networks: string[]; fh: number; fh_gp: number; nom: number; nom_gp: number; quotes: number; won: number; last_any: string | null }
export type AgingBucket = 'slipping' | 'cooling' | 'dormant' | 'inactive' | 'never'
export type AgingRow = {
  id: string; name: string; country: string | null; networks: string[]; last_fh: string | null; last_nom: string | null; last_quote: string | null
  last_any: string | null; days_idle: number | null; jobs_12m: number; prior_jobs: number; bucket: AgingBucket
}
export type AgentsPerformance = {
  months: number; since: string; kpis: PerfKpis; networks: NetworkRow[]; reciprocal: ReciprocalRow[]
  one_way: { freehand_only: number; nomination_only: number }
  aging: AgingRow[]
  buckets: Record<'active' | 'cooling' | 'dormant' | 'inactive' | 'never' | 'slipping', number>
}

export async function fetchAgentsPerformance(months: number): Promise<AgentsPerformance> {
  const { data, error } = await supabase.rpc('agents_performance', { p_months: months })
  if (error) throw new Error(error.message)
  return data as AgentsPerformance
}

export const pctOf = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null)

/** +12% vs prior period, null when nothing to compare. */
export function change(now: number, prior: number): number | null {
  if (!prior) return null
  return Math.round(((now - prior) / prior) * 100)
}

export function fmtDay(iso: string | null): string {
  if (!iso) return '–'
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: '2-digit' })
}

export type JobClass = 'freehand' | 'nomination' | 'exception' | 'unbilled' | 'excluded'
export type JobRow = {
  job_unique: number; job_no: string | null; house_bill: string | null; direction: 'import' | 'export'; mode: string | null; load_type: string | null
  origin: string | null; destination: string | null; dt: string; agent_id: string; agent: string; networks: string[]
  customer_account_id: string | null; customer: string | null; auto_class: JobClass; class: JobClass; overridden: boolean
  override_note: string | null; frt_bill_to: string | null; frt_sell: number | null; gp: number | null; charge_lines: number
}

export async function listAgentJobs(from: string, to: string): Promise<JobRow[]> {
  const { data, error } = await supabase.rpc('agent_jobs_list', { p_from: from, p_to: to })
  if (error) throw new Error(error.message)
  return (data ?? []) as JobRow[]
}

export async function setJobClass(jobs: number[], cls: JobClass | 'auto', note: string): Promise<number> {
  const { data, error } = await supabase.rpc('agent_jobs_set_class', { p_jobs: jobs, p_class: cls, p_note: note })
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}

export const CLASS_LABEL: Record<JobClass, string> = {
  freehand: 'Free hand', nomination: 'Nomination', exception: 'Check', unbilled: 'Not billed yet', excluded: 'Excluded',
}
export const CLASS_STYLE: Record<JobClass, [string, string]> = {
  freehand: ['#EEF1F8', '#0A2472'], nomination: ['#FFF6ED', '#C4320A'], exception: ['#FEF3F2', '#B42318'],
  unbilled: ['#F1F3F7', '#475467'], excluded: ['#F1F3F7', '#98A2B3'],
}

export function isoMonthsAgo(m: number): string {
  const d = new Date(); d.setMonth(d.getMonth() - m)
  return d.toLocaleDateString('en-CA')
}
