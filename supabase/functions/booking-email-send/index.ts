// booking-email-send — STAFF. Sends a booking email through Outlook (MS Graph) as the module's shared mailbox
// (IS = importsea.nz@ubfreight.com, from module_mailboxes), with chosen booking documents from S3 attached.
// Body: { booking_id, to[], cc?[], subject, html, document_ids?[], purpose?: delivery|empty|customer|general }
// Logs to booking_comms. Recipients feed email_contacts (autocomplete). verify_jwt=true.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors, json, requireStaff } from "../booking-customer-notify/staffGate.ts";
import { setApiFn } from "../_shared/apiFetch.ts";
import { getObject } from "../_shared/s3.ts";
import { graphToken } from "../email-inbox-sync/graph.ts";
import { sendAsMailbox, type OutAttachment } from "./graphSend.ts";
setApiFn("booking-email-send");

const FALLBACK: Record<string, string> = { IS: "importsea.nz@ubfreight.com" };
const MAX_TOTAL = 30 * 1024 * 1024;
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const clean = (l?: string[]) => [...new Set((l ?? []).map((e) => e.trim().toLowerCase()).filter(isEmail))];
const PURPOSE_CAT: Record<string, string> = { delivery: "delivery", empty: "collection", customer: "follow_up", general: "other" };

function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d)>/gi, "\n").replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n").trim();
}

type Body = { booking_id?: string; to?: string[]; cc?: string[]; subject?: string; html?: string; document_ids?: string[]; purpose?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  try {
    const gate = await requireStaff(req);
    if (!gate.ok) return gate.response;
    const db = gate.db;
    const b = (await req.json().catch(() => ({}))) as Body;
    const to = clean(b.to), cc = clean(b.cc).filter((e) => !to.includes(e));
    const subject = (b.subject ?? "").trim(), html = (b.html ?? "").trim();
    if (!b.booking_id) return json({ error: "booking_id required" }, 400);
    if (!to.length) return json({ error: "Add at least one valid To address" }, 400);
    if (!subject) return json({ error: "Subject is required" }, 400);
    if (!htmlToText(html)) return json({ error: "Message is empty" }, 400);

    const { data: booking } = await db.from("bookings").select("id, booking_ref, module").eq("id", b.booking_id).maybeSingle();
    if (!booking) return json({ error: "Booking not found" }, 404);
    const { data: mb } = await db.from("module_mailboxes").select("mailbox").eq("module", booking.module).maybeSingle();
    const mailbox = (mb?.mailbox as string | undefined) ?? FALLBACK[String(booking.module)];
    if (!mailbox) return json({ error: `No sending mailbox set for ${booking.module}` }, 400);

    // Attachments: only documents that belong to this booking.
    const ids = [...new Set(b.document_ids ?? [])];
    const attachments: OutAttachment[] = [];
    if (ids.length) {
      const { data: docs } = await db.from("booking_documents")
        .select("id, file_name, storage_path, mime_type, size_bytes").eq("booking_id", booking.id).in("id", ids);
      if ((docs ?? []).length !== ids.length) return json({ error: "Some documents are not on this booking" }, 400);
      const total = (docs ?? []).reduce((s, d) => s + Number(d.size_bytes ?? 0), 0);
      if (total > MAX_TOTAL) return json({ error: "Attachments over 30 MB. Pick fewer files." }, 400);
      for (const d of docs ?? []) {
        const r = await getObject(`booking-documents/${String(d.storage_path).replace(/^\/+/, "")}`);
        attachments.push({ name: d.file_name, contentType: d.mime_type || "application/octet-stream", bytes: new Uint8Array(await r.arrayBuffer()) });
      }
    }

    const token = await graphToken();
    try {
      await sendAsMailbox(token, mailbox, { subject, html, to, cc, attachments });
    } catch (e) {
      const msg = String(e);
      const friendly = /ErrorAccessDenied|403/.test(msg)
        ? `Portal is not allowed to send from ${mailbox} yet (Mail.Send / access policy).` : msg.slice(0, 300);
      return json({ error: friendly }, 502);
    }

    const { data: staff } = await db.from("staff_users").select("initials").eq("user_id", gate.staffId).maybeSingle();
    const files = attachments.map((a) => a.name);
    const text = htmlToText(html) + (files.length ? `\n\nAttachments: ${files.join(", ")}` : "");
    await db.from("booking_comms").insert({
      booking_id: booking.id, activity_type: "email", direction: "outgoing",
      category: PURPOSE_CAT[b.purpose ?? "general"] ?? "other",
      contact_name: [...to, ...cc].join(", ").slice(0, 300), subject: subject.slice(0, 300), body: text.slice(0, 8000),
      created_by: gate.staffId, author_initials: staff?.initials ?? null,
    });
    const kind = b.purpose === "delivery" || b.purpose === "empty" ? "trucker" : b.purpose === "customer" ? "customer" : "other";
    await db.rpc("email_contacts_touch", { p_emails: [...to, ...cc], p_kind: kind });

    return json({ ok: true, from: mailbox, to, cc, attachments: files });
  } catch (e) {
    return json({ error: String(e).slice(0, 300) }, 500);
  }
});
