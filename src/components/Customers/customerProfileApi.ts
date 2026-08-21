// customerProfileApi.ts
// Data layer for the staff-side Customer Profile.
import { supabase } from '../../supabase';

export interface CustomerStats {
  account_id: string;
  name: string;
  branch: string | null;
  is_importer: boolean;
  is_exporter: boolean;
  closed: boolean;
  sales_manager: string | null;
  has_portal_access: boolean;
  contact_count: number;
  total_shipments: number;
  imports: number;
  exports: number;
  in_transit: number;
  this_month: number;
  arrived: number;
  last_activity: string | null;
}

export interface MonthlyPoint { month: string; count: number; volume_m3: number; weight_kg: number; }
export interface Insights {
  monthly: MonthlyPoint[];
  modes: { mode: string; count: number }[];
  lanes: { origin: string; destination: string; count: number }[];
  direction: { direction: string; count: number }[];
  status: { status: string; count: number }[];
  performance: {
    measured: number;
    avg_delay_days: number | null;
    on_time_pct: number | null;
    avg_transit_days: number | null;
  };
  totals: { volume_m3: number; weight_kg: number };
}

export interface ShipmentRow {
  job_unique: number;
  module: string | null;
  mode: string | null;
  direction: string | null;
  status: string | null;
  origin: string | null;
  destination: string | null;
  final_dest: string | null;
  vessel_flight: string | null;
  master_bill: string | null;
  house_bill: string | null;
  etd: string | null;
  eta: string | null;
  relevant_date: string | null;
  goods_desc: string | null;
  shipper_name: string | null;
  weight_kg: number | null;
  volume_m3: number | null;
  pack_qty: number | null;
  pack_type: string | null;
  consol_key: string | null;
  load_type: string | null;
  customer_account_id: string | null;
  billing_party?: string | null;
}

export interface ShipmentFilters {
  module?: string;
  mode?: string;
  direction?: string;
  status?: string;
  search?: string;
}

const SHIPMENT_COLS =
  'job_unique,module,mode,direction,status,origin,destination,final_dest,' +
  'vessel_flight,master_bill,house_bill,etd,eta,relevant_date,goods_desc,' +
  'shipper_name,weight_kg,volume_m3,pack_qty,pack_type,consol_key,load_type,customer_account_id';

export async function fetchCustomerStats(accountId: string): Promise<CustomerStats> {
  const { data, error } = await supabase
    .from('v_customer_stats')
    .select('*')
    .eq('account_id', accountId)
    .single();
  if (error) throw error;
  return data as CustomerStats;
}

export async function fetchCustomerInsights(accountId: string): Promise<Insights> {
  const { data, error } = await supabase.rpc('get_customer_insights', {
    p_account_id: accountId,
  });
  if (error) throw error;
  return data as Insights;
}

export type ShipmentScopeColumn = 'customer_account_id' | 'os_agent_code'

export async function fetchCustomerShipments(
  accountId: string,
  page: number,
  pageSize: number,
  filters: ShipmentFilters = {},
  scopeColumn: ShipmentScopeColumn = 'customer_account_id',
  withBillingParty = false,
): Promise<{ rows: ShipmentRow[]; total: number }> {
  if (!accountId.trim()) return { rows: [], total: 0 }

  let q = supabase
    .from('shipments')
    .select(SHIPMENT_COLS, { count: 'exact' })
    .eq(scopeColumn, accountId);

  if (filters.module) q = q.eq('module', filters.module);
  if (filters.mode) q = q.eq('mode', filters.mode);
  if (filters.direction) q = q.eq('direction', filters.direction);
  if (filters.status) q = q.eq('status', filters.status);

  if (filters.search?.trim()) {
    const t = `%${filters.search.trim()}%`;
    q = q.or(
      `house_bill.ilike.${t},master_bill.ilike.${t},origin.ilike.${t},` +
      `destination.ilike.${t},goods_desc.ilike.${t},vessel_flight.ilike.${t}`,
    );
  }

  const from = page * pageSize;
  const to = from + pageSize - 1;
  q = q.order('relevant_date', { ascending: false, nullsFirst: false }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as ShipmentRow[];
  if (withBillingParty) await attachBillingParty(rows);
  return { rows, total: count ?? 0 }
}

async function attachBillingParty(rows: ShipmentRow[]): Promise<void> {
  const codes = Array.from(
    new Set(rows.map((r) => r.customer_account_id).filter((c): c is string => !!c)),
  );
  if (codes.length === 0) return;
  const { data } = await supabase.from('customers').select('account_id, name').in('account_id', codes);
  const map = new Map<string, string>(
    (data ?? []).map((c: { account_id: string; name: string | null }) => [c.account_id, c.name ?? c.account_id]),
  );
  for (const r of rows) {
    r.billing_party = r.customer_account_id ? map.get(r.customer_account_id) ?? r.customer_account_id : null;
  }
}

export async function fetchAllCustomerShipments(
  accountId: string,
  filters: ShipmentFilters = {},
  scopeColumn: ShipmentScopeColumn = 'customer_account_id',
  withBillingParty = false,
): Promise<ShipmentRow[]> {
  if (!accountId.trim()) return []
  const pageSize = 1000
  const all: ShipmentRow[] = []
  const first = await fetchCustomerShipments(accountId, 0, pageSize, filters, scopeColumn, withBillingParty)
  all.push(...first.rows)
  const total = first.total
  let page = 0
  while (all.length < total && page < 500) {
    page += 1
    const next = await fetchCustomerShipments(accountId, page, pageSize, filters, scopeColumn, withBillingParty)
    if (next.rows.length === 0) break
    all.push(...next.rows)
  }
  return all
}
