import { supabase } from '../../supabase'

// Company = legal entity + own TradeWindow FDB + own finance (NZ, FJ, AU).
// Branch  = office inside a company (AKL, SUV, LTK, NAN, SYD). Ref prefix, address.

export type Company = {
  code: string; name: string; country_code: string; base_currency: string; timezone: string
  fy_start_month: number | null; erp_label: string | null; legal_name: string | null
  tax_label: string | null; tax_number: string | null; is_active: boolean; sort_order: number
  trading_name: string | null; website: string | null; terms_url: string | null; customs_code: string | null
  remit_to: string | null; bank_name: string | null; bank_swift: string | null
  bank_accounts: string[]; payment_notes: string[]; invoice_queries: string | null; invoice_terms: string | null
}

export type Branch = {
  code: string; company_id: string; name: string; city: string | null; unlocode: string | null
  erp_branch_code: string | null; ref_prefix: string; address: string | null; phone: string | null
  email: string | null; sales_email: string | null; is_active: boolean; sort_order: number
}

export type StaffCompany = {
  user_id: string; company_id: string; access: 'full' | 'network_viewer'
  is_default: boolean; home_branch: string | null
}

export type CompanyContext = {
  current: string | null
  is_admin: boolean
  is_super_admin: boolean
  view_branch: string | null
  companies: { code: string; name: string; is_active: boolean; currency: string }[]
  branches: { code: string; name: string; is_active: boolean }[]
}

const COMPANY_COLS = 'code,name,country_code,base_currency,timezone,fy_start_month,erp_label,legal_name,tax_label,tax_number,is_active,sort_order,' +
  'trading_name,website,terms_url,customs_code,remit_to,bank_name,bank_swift,bank_accounts,payment_notes,invoice_queries,invoice_terms'
const BRANCH_COLS = 'code,company_id,name,city,unlocode,erp_branch_code,ref_prefix,address,phone,email,sales_email,is_active,sort_order'

let ctxPromise: Promise<CompanyContext> | null = null

export async function fetchCompanyContext(): Promise<CompanyContext> {
  const { data, error } = await supabase.rpc('my_company_context')
  if (error) throw error
  const ctx = data as CompanyContext
  ctxPromise = Promise.resolve(ctx)
  return ctx
}

/** Cached per page load (switching companies reloads the page). */
export function companyContext(): Promise<CompanyContext> {
  if (!ctxPromise) ctxPromise = fetchCompanyContext().catch((e) => { ctxPromise = null; throw e })
  return ctxPromise
}

/** Company whose settings a page edits. "All companies" falls back to the first one. */
export async function workingCompany(): Promise<string> {
  const ctx = await companyContext()
  return ctx.current ?? ctx.companies[0]?.code ?? 'NZ'
}

/** Base currency of the company being viewed. "All companies" falls back to the first one. */
export async function workingCurrency(): Promise<string> {
  const ctx = await companyContext()
  const code = ctx.current ?? ctx.companies[0]?.code
  return ctx.companies.find((c) => c.code === code)?.currency ?? 'NZD'
}

/** null = all branches of the current company */
export async function setMyBranch(code: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_my_branch', { p_branch: code })
  if (error) throw error
}

/** null = all my companies */
export async function setMyCompany(code: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_my_company', { p_company: code })
  if (error) throw error
}

export async function fetchCompanies(): Promise<Company[]> {
  const { data, error } = await supabase.from('companies').select(COMPANY_COLS).order('sort_order')
  if (error) throw error
  return (data ?? []) as unknown as Company[]
}

export async function updateCompany(code: string, patch: Partial<Company>): Promise<void> {
  const { error } = await supabase.from('companies')
    .update({ ...patch, updated_at: new Date().toISOString() }).eq('code', code)
  if (error) throw error
}

export async function fetchBranches(): Promise<Branch[]> {
  const { data, error } = await supabase.from('branches').select(BRANCH_COLS)
    .order('company_id').order('sort_order')
  if (error) throw error
  return (data ?? []) as Branch[]
}

export async function upsertBranch(b: Branch): Promise<void> {
  const { error } = await supabase.from('branches')
    .upsert({ ...b, updated_at: new Date().toISOString() }, { onConflict: 'code' })
  if (error) throw error
}

export async function fetchStaffCompanies(): Promise<StaffCompany[]> {
  const { data, error } = await supabase.from('staff_companies')
    .select('user_id,company_id,access,is_default,home_branch')
  if (error) throw error
  return (data ?? []) as StaffCompany[]
}

export async function upsertStaffCompany(r: StaffCompany): Promise<void> {
  const { error } = await supabase.from('staff_companies')
    .upsert(r, { onConflict: 'user_id,company_id' })
  if (error) throw error
}

export async function removeStaffCompany(userId: string, companyId: string): Promise<void> {
  const { error } = await supabase.from('staff_companies').delete()
    .eq('user_id', userId).eq('company_id', companyId)
  if (error) throw error
}

export function errText(e: unknown, fallback = 'Save failed'): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: string }).message)
  return fallback
}
