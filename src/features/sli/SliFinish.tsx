// src/features/sli/SliFinish.tsx
// After signing: offer to save a template for next time and to email a PDF copy. Choices are remembered.
import React, { useState } from "react";
import { Bookmark, Check, Download, FileText, Loader2 } from "lucide-react";
import { inputCls } from "./SliUI";

type Prefs = { save_template?: boolean; email_pdf?: boolean; pdf_email?: string | null } | null;
type Props = {
  ref_: string; prefs: Prefs; supplierEmail: string; buildPdf: () => Promise<Blob>;
  finish: (o: { save_template: boolean; email_pdf: boolean; pdf_email?: string; pdf?: Blob | null }) => Promise<{ emailed: boolean }>;
};

function Toggle({ on, onChange, icon, title, sub, children }: { on: boolean; onChange: (v: boolean) => void; icon: React.ReactNode; title: string; sub: string; children?: React.ReactNode }) {
  return (
    <div className={`rounded-lg border px-4 py-3 transition ${on ? "border-[#0A2472] bg-[#F5F7FC]" : "border-[#E4E7EC]"}`}>
      <label className="flex cursor-pointer items-start gap-3">
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${on ? "bg-[#0A2472] text-white" : "bg-[#F2F4F7] text-[#475467]"}`}>{icon}</span>
        <span className="flex-1"><span className="block text-[14px] font-semibold text-[#101828]">{title}</span><span className="block text-[12.5px] leading-snug text-[#667085]">{sub}</span></span>
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-[18px] w-[18px] accent-[#0A2472]" />
      </label>
      {on && children ? <div className="mt-3 pl-11">{children}</div> : null}
    </div>
  );
}

export default function SliFinish({ ref_, prefs, supplierEmail, buildPdf, finish }: Props) {
  const [tpl, setTpl] = useState(prefs?.save_template ?? true);
  const [mail, setMail] = useState(prefs?.email_pdf ?? true);
  const [email, setEmail] = useState(prefs?.pdf_email || supplierEmail || "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { emailed: boolean }>(null);
  const [error, setError] = useState("");
  const [pdf, setPdf] = useState<Blob | null>(null);

  const getPdf = async (): Promise<Blob> => pdf ?? (await buildPdf().then((b) => { setPdf(b); return b; }));
  const valid = !mail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function save() {
    if (!valid) return setError("Enter a valid email for the PDF copy.");
    setBusy(true); setError("");
    try {
      const blob = await getPdf().catch(() => null);
      const r = await finish({ save_template: tpl, email_pdf: mail, pdf_email: mail ? email.trim() : undefined, pdf: blob });
      setDone({ emailed: r.emailed });
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function download() {
    const b = await getPdf();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = `SLI ${ref_}.pdf`; a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(16,24,40,.45)] p-4">
      <div role="dialog" aria-label="SLI signed" className="w-full max-w-[480px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_rgba(16,24,40,.3)] duration-200 animate-in fade-in-0 zoom-in-95">
        <div className="px-6 pb-2 pt-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#ECFDF3] text-[#067647] ring-8 ring-[#F6FEF9]"><Check size={24} strokeWidth={2.5} /></div>
          <h2 className="m-0 text-[19px] font-semibold text-[#101828]">SLI signed and sent</h2>
          <p className="m-0 mt-1 text-[13.5px] text-[#667085]">UB Freight has been notified for booking <b className="font-mono text-[#344054]">{ref_}</b>.</p>
        </div>

        {done ? (
          <div className="px-6 pb-6 pt-3">
            <ul className="m-0 list-none space-y-2 rounded-lg bg-[#F9FAFB] p-4 text-[13.5px] text-[#344054]">
              <li className="flex items-center gap-2"><Check size={15} className="text-[#067647]" />{tpl ? "Template saved. Your next SLI will be filled in for you." : "No template saved."}</li>
              <li className="flex items-center gap-2"><Check size={15} className="text-[#067647]" />{mail ? (done.emailed ? `PDF copy emailed to ${email}.` : "PDF copy is on its way.") : "No PDF email."}</li>
            </ul>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => void download()} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-[#D0D5DD] bg-white text-[14px] font-semibold text-[#344054] hover:bg-[#F9FAFB]"><Download size={16} /> Download PDF</button>
              <button type="button" onClick={() => window.close()} className="h-11 flex-1 rounded-lg bg-[#0A2472] text-[14px] font-semibold text-white hover:bg-[#081C5A]">Close</button>
            </div>
            <p className="m-0 mt-2 text-center text-[12px] text-[#98A2B3]">You can close this tab.</p>
          </div>
        ) : (
          <div className="px-6 pb-6 pt-3">
            <div className="space-y-2.5">
              <Toggle on={tpl} onChange={setTpl} icon={<Bookmark size={15} />} title="Save as a template"
                sub="Next time we fill in your company, address, pickup and standing answers. Cargo details are never saved." />
              <Toggle on={mail} onChange={setMail} icon={<FileText size={15} />} title="Email me a PDF copy" sub="One-page copy of this signed SLI for your records.">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={inputCls(!valid)} />
              </Toggle>
            </div>
            {error ? <p className="m-0 mt-2 text-[13px] text-[#B42318]">{error}</p> : null}
            <button type="button" onClick={() => void save()} disabled={busy}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0A2472] text-[14.5px] font-semibold text-white hover:bg-[#081C5A] disabled:opacity-60">
              {busy ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : "Done"}
            </button>
            <p className="m-0 mt-2 text-center text-[12px] text-[#98A2B3]">We'll remember these choices for your next SLI.</p>
          </div>
        )}
      </div>
    </div>
  );
}
