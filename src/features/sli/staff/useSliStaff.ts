// Staff-side SLI management for one booking. Uses the app's authenticated supabase client.
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../supabase'

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function authedPost(path: string, body: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${FN}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session?.access_token ?? ""}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

export interface SupplierRow {
  booking_supplier_id: string | null;
  name: string;
  sli?: any;            // current sli_documents row, if any
}

export function useSliStaff(bookingId: string, isConsolidation: boolean) {
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // suppliers for this booking
    let suppliers: SupplierRow[] = [];
    if (isConsolidation) {
      const { data } = await supabase.from("booking_suppliers")
        .select("id, supplier_name").eq("booking_id", bookingId).order("ord");
      suppliers = (data ?? []).map((s) => ({ booking_supplier_id: s.id, name: s.supplier_name }));
    } else {
      const { data: bk } = await supabase.from("bookings")
        .select("account_id").eq("id", bookingId).single();
      const { data: cust } = bk?.account_id
        ? await supabase.from("customers").select("name").eq("account_id", bk.account_id).maybeSingle()
        : { data: null };
      suppliers = [{ booking_supplier_id: null, name: cust?.name ?? bk?.account_id ?? "Shipper" }];
    }

    // current (non-expired) SLI per supplier
    const { data: slis } = await supabase.from("sli_documents")
      .select("*").eq("booking_id", bookingId).neq("status", "expired");

    setRows(suppliers.map((s) => ({
      ...s,
      sli: (slis ?? []).find((d) =>
        s.booking_supplier_id ? d.booking_supplier_id === s.booking_supplier_id
                              : d.booking_supplier_id === null),
    })));
    setLoading(false);
  }, [bookingId, isConsolidation]);

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  const generate = useCallback(async (booking_supplier_id: string | null) => {
    setBusyId(booking_supplier_id ?? "single");
    try {
      await authedPost("sli-create", { booking_id: bookingId, booking_supplier_id });
      await load();
    } finally { setBusyId(null); }
  }, [bookingId, load]);

  const acceptEdits = useCallback(async (sli_id: string, fields?: string[]) => {
    const r = await authedPost("sli-accept-edits", { sli_id, fields });
    await load();
    return r;
  }, [load]);

  const fetchEvents = useCallback(async (sli_id: string) => {
    const { data } = await supabase.from("sli_events")
      .select("event, detail, created_at").eq("sli_id", sli_id).order("created_at");
    return data ?? [];
  }, []);

  const signedUrl = useCallback(async (path: string) => {
    const { data } = await supabase.storage.from("sli-uploads").createSignedUrl(path, 300);
    return data?.signedUrl ?? null;
  }, []);

  return { rows, loading, busyId, generate, acceptEdits, fetchEvents, signedUrl, reload: load };
}
