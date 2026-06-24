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
  'shipper_name,weight_kg,volume_m3,pack_qty,pack_type,consol_key';

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

export async function fetchCustomerShipments(
  accountId: string,
  page: number,
  pageSize: number,
  filters: ShipmentFilters = {},
): Promise<{ rows: ShipmentRow[]; total: number }> {
  let q = supabase
    .from('shipments')
    .select(SHIPMENT_COLS, { count: 'exact' })
    .eq('customer_account_id', accountId);

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
  return { rows: (data ?? []) as unknown as ShipmentRow[], total: count ?? 0 }
}
