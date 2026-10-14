// src/features/sli/staff/SliSendPanel.tsx
// Send an SLI link three ways: new email from the module mailbox, reply in a linked thread, or copy.
import React, { useEffect, useState } from "react";
import { Check, Copy, Link2, Mail, MessagesSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/supabase";
import { sendBookingEmail } from "@/features/bookingRecord/email/emailApi";
import { replyEmail } from "@/pages/inbox/inboxApi";

type Mode = "email" | "thread" | "copy";
type Thread = { conversation_id: string; subject: string | null; last_sender: string | null; last_message_at: string | null };
type Props = { bookingId: string; link: string; sli: any; recipient?: string | null; onSent?: () => void };

const inp = "h-[30px] w-full rounded-[7px] border border-[#E3E6EB] bg-white px-2 text-[12.5px] outline-none focus:border-[#0A2472]";
const lbl = "text-[10.5px] uppercase tracking-[.04em] text-[#6B7280]";
const split = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inviteHtml(msg: string, link: string, rows: [string, string][]) {
  const base = (import.meta.env.VITE_SLI_PUBLIC_BASE_URL as string | undefined) ?? window.location.origin;
  const body = msg.split("\n").map((l) => (l ? esc(l) : "&nbsp;")).join("<br>");
  const tr = rows.filter(([, v]) => v).map(([k, v]) => `<tr><td style="padding:3px 0;color:#64748b;width:80px">${k}</td><td style="padding:3px 0;color:#0f172a;font-weight:600">${esc(v)}</td></tr>`).join("");
  return `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#334155;line-height:1.55">
    <img src="${base}/ub-freight-logo-ink.png" alt="UB Freight" height="34" style="display:block;margin-bottom:14px">
    <div>${body}</div>
    <table style="font-size:13px;border-collapse:collapse;margin:14px 0;background:#f8fafc;padding:8px 12px">${tr}</table>
    <p style="margin:16px 0"><a href="${link}" style="background:#0A2472;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Review &amp; sign SLI</a></p>
    <p style="color:#64748b;font-size:12px">Link: ${link}</p></div>`;
}

export default function SliSendPanel({ bookingId, link, sli, recipient, onSent }: Props) {
  const sf = sli?.staff_fields ?? {};
  const pf = sli?.prefilled ?? {};
  const name = (pf.supplier_contact || pf.supplier_name || "").split(" ")[0] || "there";
  const ref = sf.booking_ref ?? "";
  const [mode, setMode] = useState<Mode>("email");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState("");
  const [to, setTo] = useState(recipient ?? pf.supplier_email ?? "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(`SLI for signing – ${ref}${sf.customer_ref ? ` / ${sf.customer_ref}` : ""}`);
  const [msg, setMsg] = useState(`Hi ${name},\n\nPlease check and sign the Shipper's Letter of Instruction for ${ref}. We've filled in what we know, so it should only take a couple of minutes.\n\nKind regards,\nUB Freight Export Air`);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"" | "link" | "msg">("");

  useEffect(() => {
    void supabase.from("booking_threads")
      .select("conversation_id, inbox_conversations(subject, last_sender, last_message_at, email_mailbox)").eq("booking_id", bookingId)
      .then(({ data }) => {
        const rows = ((data ?? []) as any[]).filter((t) => t.inbox_conversations?.email_mailbox)
          .map((t) => ({ conversation_id: t.conversation_id, ...t.inbox_conversations }))
          .sort((a, b) => String(b.last_message_at ?? "").localeCompare(String(a.last_message_at ?? ""))) as Thread[];
        setThreads(rows);
        if (rows[0]) setThreadId(rows[0].conversation_id);
      });
  }, [bookingId]);

  const plain = `${msg}\n\nSign the SLI here: ${link}`;
  const log = (event: string, detail: Record<string, unknown>) =>
    void supabase.from("sli_events").insert({ sli_id: sli.id, event, detail }).then(() => undefined, () => undefined);

  async function send() {
    setBusy(true);
    try {
      if (mode === "email") {
        const list = split(to);
        if (!list.length) throw new Error("Add a recipient");
        const html = inviteHtml(msg, link, [["Booking", ref], ["Route", `${sf.origin ?? "AKL"} → ${sf.destination ?? ""}`], ["Flight", [sf.flight_no, sf.flight_date].filter(Boolean).join(" · ")]]);
        const r = await sendBookingEmail({ booking_id: bookingId, to: list, cc: split(cc), subject, html, document_ids: [], purpose: "customer" });
        log("email_sent", { recipient: list.join(", "), from: r.from, via: "mailbox" });
        toast.success(`SLI link sent to ${list.join(", ")}`);
      } else if (mode === "thread") {
        if (!threadId) throw new Error("Pick a thread");
        await replyEmail(threadId, plain);
        log("email_sent", { via: "thread_reply", conversation_id: threadId });
        toast.success("SLI link sent in the thread");
      }
      onSent?.();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function copy(what: "link" | "msg") {
    await navigator.clipboard.writeText(what === "link" ? link : plain);
    setCopied(what); window.setTimeout(() => setCopied(""), 1500);
    if (what === "link") log("link_copied", {});
  }

  const tab = (m: Mode, icon: React.ReactNode, t: string, disabled = false) => (
    <button type="button" disabled={disabled} onClick={() => setMode(m)} title={disabled ? "No email thread linked to this booking" : undefined}
      className={`inline-flex h-[28px] items-center gap-1.5 rounded-[6px] px-2.5 text-[12px] font-medium transition disabled:opacity-40 ${mode === m ? "bg-white text-[#0A2472] shadow-[0_1px_2px_rgba(16,24,40,.12)]" : "text-[#5B616E] hover:text-[#14161A]"}`}>
      {icon}{t}
    </button>
  );

  return (
    <div className="mt-3 rounded-lg border border-[#E6E8EE] bg-white p-3 text-[12.5px]">
      <div className="mb-3 inline-flex rounded-[8px] bg-[#F2F4F7] p-0.5">
        {tab("email", <Mail size={13} />, "Email")}
        {tab("thread", <MessagesSquare size={13} />, `Reply in thread${threads.length ? ` (${threads.length})` : ""}`, !threads.length)}
        {tab("copy", <Link2 size={13} />, "Copy link")}
      </div>

      {mode === "copy" ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input readOnly value={link} className={`${inp} font-mono text-[11.5px]`} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" onClick={() => void copy("link")} className="inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-[7px] border border-[#0A2472] bg-[#0A2472] px-3 text-[12px] font-medium text-white">
              {copied === "link" ? <Check size={13} /> : <Copy size={13} />}{copied === "link" ? "Copied" : "Copy link"}
            </button>
          </div>
          <button type="button" onClick={() => void copy("msg")} className="w-auto self-start border-0 bg-transparent p-0 text-[12px] text-[#0A2472] hover:underline">
            {copied === "msg" ? "Message copied" : "Copy link with message (for WhatsApp, Teams…)"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {mode === "email" ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1"><span className={lbl}>To</span><input value={to} onChange={(e) => setTo(e.target.value)} placeholder="supplier@company.com" className={inp} /></label>
              <label className="flex flex-col gap-1"><span className={lbl}>Cc</span><input value={cc} onChange={(e) => setCc(e.target.value)} className={inp} /></label>
              <label className="col-span-2 flex flex-col gap-1"><span className={lbl}>Subject</span><input value={subject} onChange={(e) => setSubject(e.target.value)} className={inp} /></label>
            </div>
          ) : (
            <label className="flex flex-col gap-1"><span className={lbl}>Thread</span>
              <select value={threadId} onChange={(e) => setThreadId(e.target.value)} className={inp}>
                {threads.map((t) => <option key={t.conversation_id} value={t.conversation_id}>{t.subject || "(no subject)"} · {t.last_sender ?? ""}</option>)}
              </select>
              <span className="text-[11px] text-[#6B7280]">Replies to everyone on the latest email in the thread.</span>
            </label>
          )}
          <label className="flex flex-col gap-1"><span className={lbl}>Message</span>
            <textarea rows={5} value={msg} onChange={(e) => setMsg(e.target.value)} className={`${inp} h-auto py-1.5 leading-snug`} />
          </label>
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[11px] text-[#6B7280]">{mode === "email" ? "Sent from the Export Air mailbox with a Review & sign button" : "Link is added under your message"}</span>
            <button type="button" onClick={() => void send()} disabled={busy} className="inline-flex h-[30px] items-center gap-1.5 rounded-[7px] border border-[#0A2472] bg-[#0A2472] px-3 text-[12px] font-medium text-white disabled:opacity-50">
              <Send size={13} />{busy ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
