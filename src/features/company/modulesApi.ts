import { supabase } from '../../supabase'

// Module rollout per company. off = hidden, pilot = super admin only, live = everyone (role permissions apply).
// 'super' = module is always super admin only (not releasable).
export type ModuleStatus = 'off' | 'pilot' | 'live'
export type ModuleRolloutRow = {
  module_key: string; label: string; sort_order: number; super_only: boolean
  company_id: string; status: ModuleStatus | 'super'
}

export async function fetchModuleRollout(): Promise<ModuleRolloutRow[]> {
  const { data, error } = await supabase.rpc('company_modules_list')
  if (error) throw error
  return (data ?? []) as ModuleRolloutRow[]
}

export async function setModuleStatus(company: string, module: string, status: ModuleStatus): Promise<void> {
  const { error } = await supabase.rpc('set_company_module', { p_company: company, p_module: module, p_status: status })
  if (error) throw error
}
