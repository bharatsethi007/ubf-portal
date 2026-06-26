import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export type Range = "week" | "month" | "year";
export type Dir = "import" | "export";
export type Mode = "sea" | "air";

export interface Stat { v: number; delta: string }
export interface Kpis {
  anchor: string; range: Range;
  bookings: Stat;
  lanes: Stat;
  customers: Stat;
  revenue: Stat;
  ar: Stat;
  jobs: { EA: Stat; ES: Stat; IA: Stat; IS: Stat };
}
export interface TrendPoint { x: string; Sea: number; Air: number; Imports: number; Exports: number }
export interface Lane { o: string; d: string; onm: string; dnm: string; n: number }
export interface Customer { account_id: string; name: string; n: number; o: string; d: string; onm: string; dnm: string; revenue: number }
export interface MapPoint { code: string; name: string; lat: number; lng: number; n: number; country?: string | null }
export interface Finance { revenue: number; invoiced: number; collected: number; outstanding: number; ageing: Record<string, number> }
export interface NewBooking { ref: string; module: string; o: string; d: string; onm: string; dnm: string; customer: string; source: string; status: string; created_at: string }

/* core: KPIs + trends + finance + new bookings (range-driven) */
export function useDashboard(range: Range) {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [finance, setFinance] = useState<Finance | null>(null);
  const [newBookings, setNewBookings] = useState<NewBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true); setError(null);
      const [k, t, f, nb] = await Promise.all([
        supabase.rpc("get_dashboard_kpis", { p_range: range }),
        supabase.rpc("get_dashboard_trends", { p_range: range }),
        supabase.rpc("get_finance", { p_range: range }),
        supabase.rpc("get_new_bookings"),
      ]);
      if (!active) return;
      const err = k.error || t.error || f.error || nb.error;
      if (err) { setError(err.message); setLoading(false); return; }
      setKpis(k.data); setTrends(t.data ?? []); setFinance(f.data); setNewBookings(nb.data ?? []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [range]);

  return { kpis, trends, finance, newBookings, loading, error };
}

export function useTopLanes(range: Range, dir: Dir, mode: Mode) {
  const [data, setData] = useState<Lane[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true; setLoading(true);
    supabase.rpc("get_top_lanes", { p_range: range, p_dir: dir, p_mode: mode })
      .then(({ data }) => { if (active) { setData(data ?? []); setLoading(false); } });
    return () => { active = false; };
  }, [range, dir, mode]);
  return { data, loading };
}

export function useTopCustomers(range: Range, mode: Mode) {
  const [data, setData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true; setLoading(true);
    supabase.rpc("get_top_customers", { p_range: range, p_mode: mode })
      .then(({ data }) => { if (active) { setData(data ?? []); setLoading(false); } });
    return () => { active = false; };
  }, [range, mode]);
  return { data, loading };
}

export function useMapPoints(range: Range, dir: Dir) {
  const [data, setData] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true; setLoading(true);
    supabase.rpc("get_map_points", { p_range: range, p_dir: dir })
      .then(({ data }) => { if (active) { setData(data ?? []); setLoading(false); } });
    return () => { active = false; };
  }, [range, dir]);
  return { data, loading };
}
