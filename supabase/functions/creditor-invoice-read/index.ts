// creditor-invoice-read — STAFF. Reads a creditor invoice PDF/image from S3 with Claude, fills the
// creditor_invoices row, then runs the deterministic creditor_invoice_check (SQL). AI never approves.
// Body: { invoice_id }. verify_jwt=true.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { cors, json, requireStaff } from "../booking-customer-notify/staffGate.ts";
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
import { getObject } from "../_shared/s3.ts";
setApiFn("creditor-invoice-read");

const CLAUDE_MODEL = "claude-sonnet-4-6";
const MAX_BYTES = 20 * 1024 * 1024;

const SYSTEM = "You read supplier (creditor) invoices sent to UB Freight, a NZ freight forwarder. " +
  "Suppliers are shipping lines, LCL co-loaders, ports, transport and customs providers. " +
  "Return ONLY JSON. Use numbers without currency symbols or thousands separators. Dates as YYYY-MM-DD. " +
  "vendor_name = the company issuing the invoice, never UB Freight. currency = ISO code. " +
  "total = amount payable incl. tax. references = every shipment identifier printed (bill of lading, " +
  "container numbers, booking, job, vessel/voyage, customer reference). If a value is not printed use null.";

const SHAPE = `{"vendor_name":null,"invoice_no":null,"invoice_date":null,"due_date":null,"currency":null,
"subtotal":null,"tax":null,"total":null,"is_credit_note":false,"references":[],
"lines":[{"description":null,"amount":null}]}`;

type Extract = {
  vendor_name: string | null; invoice_no: string | null; invoice_date: string | null; due_date: string | null
  currency: string | null; subtotal: number | null; tax: number | null; total: number | null
  is_credit_note?: boolean; references?: string[]; lines?: { description: string | null; amount: number | null }[]
};

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const date = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;

function parse(text: string): Extract {
  const t = text.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1);
  return JSON.parse(raw) as Extract;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const gate = await requireStaff(req);
  if (!gate.ok) return gate.response;
  const db = gate.db;
  const { invoice_id } = (await req.json().catch(() => ({}))) as { invoice_id?: string };
  if (!invoice_id) return json({ error: "invoice_id required" }, 400);

  const { data: inv } = await db.from("creditor_invoices").select("id, booking_id, document_id, status").eq("id", invoice_id).maybeSingle();
  if (!inv) return json({ error: "Invoice not found" }, 404);
  if (inv.status === "approved") return json({ error: "Approved invoices are not re-read" }, 400);
  if (!inv.document_id) return json({ error: "No document attached" }, 400);
  const { data: doc } = await db.from("booking_documents").select("storage_path, mime_type, file_name, size_bytes").eq("id", inv.document_id).maybeSingle();
  if (!doc) return json({ error: "Document missing" }, 404);

  await db.from("creditor_invoices").update({ ai_status: "reading", ai_error: null }).eq("id", invoice_id);
  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
    const obj = await getObject(`booking-documents/${String(doc.storage_path).replace(/^\/+/, "")}`);
    const bytes = new Uint8Array(await obj.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) throw new Error("File over 20 MB");
    const mime = String(doc.mime_type || "").toLowerCase();
    const isPdf = mime === "application/pdf" || /\.pdf$/i.test(String(doc.file_name));
    const isImg = /^image\/(png|jpe?g|gif|webp)$/.test(mime);
    if (!isPdf && !isImg) throw new Error("Only PDF or image invoices can be read");
    const data = encodeBase64(bytes);
    const fileBlock = isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: mime === "image/jpg" ? "image/jpeg" : mime, data } };

    const res = await apiFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: CLAUDE_MODEL, max_tokens: 2048, system: SYSTEM,
        messages: [{ role: "user", content: [fileBlock, { type: "text", text: "Extract this invoice as JSON in this shape:\n" + SHAPE }] }],
      }),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const out = await res.json();
    const text = (out.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
    const x = parse(text);

    const currency = (x.currency || "NZD").toUpperCase().slice(0, 3);
    let fx = 1;
    if (currency !== "NZD") {
      const { data: r } = await db.from("exchange_rates").select("rate, buy_correction_pct")
        .eq("base_currency", "NZD").eq("quote_currency", currency).maybeSingle();
      if (r?.rate) fx = Number(r.rate) * (1 + Number(r.buy_correction_pct || 0) / 100);
    }
    const sign = x.is_credit_note ? -1 : 1;
    const total = num(x.total);
    const vendor = x.vendor_name?.trim() || null;

    // Cost type from known vendor lists. Deterministic.
    let costType: string | null = null;
    if (vendor) {
      const v = vendor.toLowerCase();
      const [{ data: lines }, { data: cls }] = await Promise.all([
        db.from("shipping_lines").select("name, code"), db.from("co_loaders").select("name, code"),
      ]);
      const hit = (rows: { name: string | null; code: string | null }[] | null) => (rows ?? []).some((r) => {
        const n = (r.name ?? "").toLowerCase();
        return n.length > 2 && (v.includes(n) || n.includes(v));
      });
      if (hit(cls)) costType = "co_loader"; else if (hit(lines)) costType = "shipping_line";
      else if (/port|terminal/i.test(vendor)) costType = "psc";
      else if (/transport|cartage|logistics|haulage|trucking/i.test(vendor)) costType = "cartage";
    }

    await db.from("creditor_invoices").update({
      vendor_name: vendor, invoice_no: x.invoice_no?.trim() || null, invoice_date: date(x.invoice_date), due_date: date(x.due_date),
      currency, subtotal: num(x.subtotal) != null ? sign * num(x.subtotal)! : null, tax: num(x.tax) != null ? sign * num(x.tax)! : null,
      total: total != null ? sign * total : null, fx_rate: fx, cost_type: costType,
      references_found: (x.references ?? []).map(String).filter(Boolean).slice(0, 40),
      extracted: x, ai_status: "read", ai_error: null,
    }).eq("id", invoice_id);

    const { data: check, error: ce } = await db.rpc("creditor_invoice_check", { p_id: invoice_id });
    if (ce) throw new Error(ce.message);
    await db.rpc("ci_log", { p_inv: invoice_id, p_action: "read", p_detail: { verdict: check?.verdict ?? null, total, currency } });
    return json({ ok: true, check });
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e).slice(0, 300);
    await db.from("creditor_invoices").update({ ai_status: "failed", ai_error: msg }).eq("id", invoice_id);
    return json({ error: msg }, 502);
  }
});
