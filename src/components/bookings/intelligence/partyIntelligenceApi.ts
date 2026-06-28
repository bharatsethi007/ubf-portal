import { supabase } from '../../../supabase'
import type { IntelligenceJob, PartyIntelligence, VolumeRow } from './types'

function parseVolume(raw: unknown): VolumeRow | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const mode = row.mode === 'air' || row.mode === 'sea' ? row.mode : null
  const dir = row.dir === 'export' || row.dir === 'import' ? row.dir : null
  const dest = typeof row.dest === 'string' ? row.dest : ''
  const count = Number(row.count ?? 0)
  if (!mode || !dir || !dest || !Number.isFinite(count) || count <= 0) return null
  return { mode, dir, dest, count }
}

function parseJob(raw: unknown): IntelligenceJob | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const job = typeof row.job === 'string' ? row.job : ''
  const mode = row.mode === 'air' || row.mode === 'sea' ? row.mode : null
  const dir = row.dir === 'export' || row.dir === 'import' ? row.dir : null
  if (!job || !mode || !dir) return null
  return {
    job,
    mode,
    dir,
    dest: typeof row.dest === 'string' ? row.dest : '',
    route: typeof row.route === 'string' ? row.route : '',
    etd: typeof row.etd === 'string' ? row.etd : null,
    eta: typeof row.eta === 'string' ? row.eta : null,
    date: typeof row.date === 'string' ? row.date : null,
  }
}

function parsePartyIntelligence(raw: unknown): PartyIntelligence | null {
  if (raw == null) return null
  const row = raw as Record<string, unknown>
  const volume = Array.isArray(row.volume)
    ? row.volume.map(parseVolume).filter((v): v is VolumeRow => v != null)
    : []
  const jobs = Array.isArray(row.jobs)
    ? row.jobs.map(parseJob).filter((j): j is IntelligenceJob => j != null)
    : []
  const due = Number(row.due_invoices ?? 0)
  const ytd = Number(row.ytd_spend ?? 0)
  if (!volume.length && !jobs.length && due <= 0 && ytd <= 0) return null
  const name = typeof row.name === 'string' ? row.name.trim() : undefined
  const email = typeof row.email === 'string' ? row.email.trim() || null : null
  return {
    name,
    email,
    volume,
    due_invoices: Number.isFinite(due) ? due : 0,
    ytd_spend: Number.isFinite(ytd) ? ytd : 0,
    jobs,
  }
}

export async function fetchPartyIntelligence(accountId: string | undefined): Promise<PartyIntelligence | null> {
  const id = accountId?.trim()
  if (!id) return null

  const { data, error } = await supabase.rpc('get_party_intelligence', {
    p_account_id: id,
  })
  if (error || data == null) return null
  return parsePartyIntelligence(data)
}
