import { supabase } from '../../supabase'

export type LaneChargeStat = { code: string; description: string; pct: number; avgSell: number | null; jobs: number; jobCount: number }
export type LaneQuote = { id: string; quoteNo: string | null; customer: string | null; status: string | null; createdAt: string }

// Past-shipment charge-set for a lane (validated algorithm, staff-gated RPC).
export async function laneChargeStats(origin: string, dest: string, mode: string, direction: string): Promise<LaneChargeStat[]> {
  const { data, error } = await supabase.rpc('lane_charge_stats', {
    p_origin: origin, p_dest: dest, p_mode: mode, p_direction: direction,
  })
  if (error) throw error
  return ((data as Record<string, any>[]) ?? []).map((r) => ({
    code: String(r.charge_code),
    description: r.description ? String(r.description) : '',
    pct: Number(r.pct) || 0,
    avgSell: r.avg_sell == null ? null : Number(r.avg_sell),
    jobs: Number(r.jobs_with) || 0,
    jobCount: Number(r.job_count) || 0,
  }))
}

export async function lastQuotesForLane(from: string, to: string, limit = 5): Promise<LaneQuote[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select('id, quote_no, customer_name, status, created_at')
    .eq('from_port_code', from)
    .eq('to_port_code', to)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return ((data as Record<string, any>[]) ?? []).map((r) => ({
    id: String(r.id),
    quoteNo: r.quote_no ? String(r.quote_no) : null,
    customer: r.customer_name ? String(r.customer_name) : null,
    status: r.status ? String(r.status) : null,
    createdAt: String(r.created_at),
  }))
}

// Plain-English incoterm summary (static; no DB). Kept short for the panel.
const INCOTERM_DESC: Record<string, string> = {
  EXW: 'Ex Works — buyer takes over at the seller’s door and bears everything onward (all legs).',
  FCA: 'Free Carrier — seller clears export and hands to the carrier; buyer bears main carriage on.',
  FAS: 'Free Alongside Ship — seller delivers alongside the vessel; buyer takes it from there.',
  FOB: 'Free On Board — seller loads on board and clears export; buyer bears freight and destination.',
  CFR: 'Cost & Freight — seller pays freight to destination port; risk passes at origin, buyer bears destination.',
  CIF: 'Cost, Insurance & Freight — as CFR plus seller-arranged insurance to destination port.',
  CPT: 'Carriage Paid To — seller pays carriage to the named place; buyer bears destination charges.',
  CIP: 'Carriage & Insurance Paid To — as CPT plus seller-arranged insurance.',
  DAP: 'Delivered At Place — seller delivers to the named place, not unloaded; buyer handles import duties.',
  DPU: 'Delivered At Place Unloaded — seller delivers and unloads at destination; buyer handles import duties.',
  DDP: 'Delivered Duty Paid — seller delivers cleared and duty-paid to the buyer’s door (all legs).',
}
export function incotermDescription(code: string | null | undefined): string | null {
  return INCOTERM_DESC[(code || '').toUpperCase()] ?? null
}
