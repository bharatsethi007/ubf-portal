import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../../supabase";
import { usePermissions } from "../../access/PermissionsProvider";

export type Range = "week" | "month" | "year";

/* Bumped by the page's refresh button; every tower hook reloads when it changes. */
export const TowerRefresh = createContext(0);

/* Calls an RPC only when the user can read at least one of the modules.
   No read = no network call. Optional polling keeps live cards fresh. */
export function useTowerRpc<T>(fn: string, args: Record<string, unknown> | null, modules: string[], pollMs = 0) {
  const { perms, loading: permLoading } = usePermissions();
  const tick = useContext(TowerRefresh);
  const allowed = modules.some((m) => perms[m]?.read);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(args ?? {});

  useEffect(() => {
    if (permLoading || !allowed) { setLoading(false); return; }
    let alive = true;
    const load = async (first: boolean) => {
      if (first) setLoading(true);
      const { data: d, error } = await supabase.rpc(fn, args ?? {});
      if (!alive) return;
      if (error) console.warn(`[tower] ${fn}`, error.message);
      else setData(d as T);
      setLoading(false);
    };
    load(data == null);
    const id = pollMs ? window.setInterval(() => load(false), pollMs) : 0;
    return () => { alive = false; if (id) window.clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, key, allowed, permLoading, pollMs, tick]);

  return { data, loading: loading || permLoading, allowed };
}

export function useCanAny(modules: string[]) {
  const { perms } = usePermissions();
  return modules.some((m) => perms[m]?.read);
}

/* ── Row types (match tower_* RPC output) ── */
export type Kpi = { v: number | null; delta?: string; delta_pt?: number | null; series?: number[]; outstanding?: number };
export type Pulse = Partial<Record<"jobs" | "teu" | "bookings" | "revenue" | "gp_margin" | "ar_overdue", Kpi>>;
export type ActionItem = { key: string; label: string; href: string; tone: string; n: number; oldest_h: number | null };
export type ExceptionItem = { kind: string; title: string; sub: string; pill: string; sev: "bad" | "warn"; job_no: string | null };
export type ArrivalDay = { d: string; dow: string; fcl: number; lcl: number; air: number };
export type TmsToday = { delivered: number; on_road: number; unassigned: number; failed: number; trucks_total: number; trucks_live: number };
export type QuoteFunnel = { requested: number; priced: number; sent: number; won: number; avg_reply_h: number | null };
export type Csat = { avg: number | null; prev: number | null; n: number; channels: Record<string, number> };
export type Receivables = {
  ageing: { current: number; d30: number; d60: number; d60p: number };
  debtors: { account_id: string; name: string; total: number; over60: number; overdue: number; oldest_due: string | null }[];
};
export type TopCustomer = { account_id: string; name: string; n: number; base: number };
export type VolumePoint = { x: string; sea: number; air: number; imp: number; exp: number };
export type LiveFix = { lng: number; lat: number; hdg: number | null; kn: number | null; ship: string | null; at: string };
export type TransitShipment = {
  id: number; module: string; mode: "sea" | "air"; dir: "import" | "export"; job_no: number | null; ship_no: number | null;
  hbl: string | null; mbl: string | null; customer: string | null; acct: string | null; shipper: string | null; consignee: string | null;
  goods: string | null; o: string; d: string; oname: string | null; dname: string | null;
  olng: number; olat: number; dlng: number; dlat: number; etd: string | null; eta: string; departed: string | null;
  vessel: string | null; load_type: string | null; pack_qty: number | null; pack_type: string | null;
  kg: number | null; cbm: number | null; ref: string | null; frac: number; live: LiveFix | null;
};
