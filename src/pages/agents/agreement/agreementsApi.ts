import { supabase } from '../../../supabase'
import type { AgentRow } from '../agentsApi'
import { addYears, filledCount, toIso, type Agreement, type AgreementEvent, type AgreementPatch, type ContactSet } from './agreementModel'

export * from './agreementModel'

export async function listAgreements(agentId: string): Promise<Agreement[]> {
  const { data, error } = await supabase
    .from('agency_agreements').select('*').eq('agent_id', agentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as Agreement[]) ?? []
}

export async function listEvents(agreementId: string): Promise<AgreementEvent[]> {
  const { data, error } = await supabase
    .from('agency_agreement_events').select('*').eq('agreement_id', agreementId)
    .order('created_at', { ascending: false }).limit(50)
  if (error) throw error
  return (data as AgreementEvent[]) ?? []
}

async function actorEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.email ?? null
}

export async function logEvent(agreementId: string, kind: string, detail?: Record<string, unknown>): Promise<void> {
  await supabase.from('agency_agreement_events').insert({ agreement_id: agreementId, kind, detail: detail ?? null, actor: await actorEmail() })
}

function roleKey(role: string | null): keyof ContactSet | null {
  const r = (role ?? '').toLowerCase()
  if (/account|finance|billing/.test(r)) return 'accounts'
  if (/commercial|sales|pricing/.test(r)) return 'commercial'
  if (/op|branch|customer service|cs\b/.test(r)) return 'operational'
  return null
}

/** New draft, filled from the agent, its ERP account and contacts. 3 years from today. */
export async function createDraft(agent: AgentRow): Promise<Agreement> {
  const [cust, contacts, me] = await Promise.all([
    agent.erp_account_code
      ? supabase.from('customers').select('name, address1, address2, address3, city, state, postcode, country, email, tax_number').eq('account_id', agent.erp_account_code).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('agent_contacts').select('name, role, email, is_prime').eq('agent_id', agent.id),
    supabase.auth.getUser(),
  ])
  const c = (cust.data ?? null) as Record<string, string | null> | null
  const list = ((contacts.data ?? []) as { name: string | null; role: string | null; email: string | null; is_prime: boolean | null }[]).filter((x) => x.email)
  const prime = list.find((x) => x.is_prime) ?? list[0]
  const set: ContactSet = {}
  for (const x of list) {
    const k = roleKey(x.role)
    if (k && !set[k]) set[k] = x.name ? `${x.name} · ${x.email}` : x.email!
  }
  if (prime) {
    const p = prime.name ? `${prime.name} · ${prime.email}` : prime.email!
    set.operational ??= p; set.commercial ??= p; set.notices ??= p
  }
  if (!set.accounts && c?.email) set.accounts = c.email
  const address = c ? [c.address1, c.address2, c.address3, [c.city, c.state, c.postcode].filter(Boolean).join(' '), c.country].filter((s) => s && s.trim()).join(', ') : null

  let signerName: string | null = null, signerTitle: string | null = null
  if (me.data.user) {
    const { data: su } = await supabase.from('staff_users').select('full_name, job_title').eq('user_id', me.data.user.id).maybeSingle()
    signerName = (su as { full_name: string | null } | null)?.full_name ?? null
    signerTitle = (su as { job_title: string | null } | null)?.job_title ?? null
  }
  const today = toIso(new Date())
  const { data, error } = await supabase.from('agency_agreements').insert({
    agent_id: agent.id,
    effective_date: today,
    expiry_date: addYears(today, 3),
    agent_legal_name: c?.name ?? agent.name,
    agent_address: address || null,
    agent_company_no: c?.tax_number ?? null,
    agent_territory: agent.country ?? c?.country ?? null,
    signatory_name: prime?.name ?? null,
    signatory_title: prime?.role ?? null,
    signatory_email: prime?.email ?? null,
    agent_contacts: set,
    ubf_signer_id: me.data.user?.id ?? null,
    ubf_signer_name: signerName,
    ubf_signer_title: signerTitle,
  }).select('*').single()
  if (error) throw error
  const a = data as Agreement
  await logEvent(a.id, 'created', { filled: filledCount(a) })
  return a
}

export async function updateAgreement(id: string, patch: AgreementPatch): Promise<Agreement> {
  const { data, error } = await supabase.from('agency_agreements').update(patch).eq('id', id).select('*').single()
  if (error) throw error
  return data as Agreement
}
