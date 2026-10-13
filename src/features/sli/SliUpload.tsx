// src/features/sli/SliUpload.tsx
// Section 6: documents. Drag and drop or browse; pick the type first with one click.
import React, { useRef, useState } from "react";
import { CloudUpload, FileText, X } from "lucide-react";
import { Section, type SecState } from "./SliUI";

const DOC_TYPES = [
  { v: "commercial_invoice", t: "Commercial invoice" },
  { v: "packing_list", t: "Packing list" },
  { v: "dg_cert", t: "DG declaration" },
  { v: "cert_origin", t: "Certificate of origin" },
  { v: "export_permit", t: "Export permit" },
  { v: "letter_of_credit", t: "Letter of credit" },
  { v: "other", t: "Other" },
];
const label = (v: string) => DOC_TYPES.find((d) => d.v === v)?.t ?? v;

type Props = {
  attachments: any[]; uploadFile: (f: File, t: string) => Promise<any>; removeAttachment: (path: string) => void;
  dgRequired: boolean; errors: string[]; state: SecState;
};

export default function SliUpload({ attachments, uploadFile, removeAttachment, dgRequired, errors, state }: Props) {
  const hasInvoice = attachments.some((a) => a.doc_type === "commercial_invoice");
  const [docType, setDocType] = useState(dgRequired && hasInvoice ? "dg_cert" : hasInvoice ? "packing_list" : "commercial_invoice");
  const [busy, setBusy] = useState(0);
  const [over, setOver] = useState(false);
  const [failed, setFailed] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function add(files: FileList | File[] | null) {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    setFailed("");
    setBusy((n) => n + list.length);
    for (const f of list) {
      try { await uploadFile(f, docType); } catch { setFailed(`Couldn't upload ${f.name}. Please try again.`); }
      finally { setBusy((n) => n - 1); }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  const dgMissing = dgRequired && !attachments.some((a) => a.doc_type === "dg_cert");
  const showDgErr = dgMissing && errors.includes("dg_cert_attachment");

  return (
    <Section id="sec-docs" n={6} title="Documents" state={state}
      sub={dgRequired ? "Commercial invoice recommended. DG declaration required." : "Commercial invoice and packing list help us clear faster."}>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {DOC_TYPES.map((d) => {
          const on = docType === d.v;
          const need = d.v === "dg_cert" && dgMissing;
          return (
            <button key={d.v} type="button" onClick={() => setDocType(d.v)}
              className={`h-8 rounded-full border px-3 text-[13px] font-medium transition ${on ? "border-[#0A2472] bg-[#0A2472] text-white"
                : need ? "border-[#FEC84B] bg-[#FFFAEB] text-[#93370D]" : "border-[#D5D9E0] bg-white text-[#344054] hover:border-[#B4BBC6]"}`}>
              {d.t}{need ? " *" : ""}
            </button>
          );
        })}
      </div>

      <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void add(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        className={`flex cursor-pointer items-center gap-4 rounded-lg border-2 border-dashed px-5 py-5 transition ${
          over ? "border-[#0A2472] bg-[#EEF2FB]" : showDgErr ? "border-[#FDA29B] bg-[#FFFBFA]" : "border-[#D5D9E0] bg-[#FCFCFD] hover:border-[#98A2B3]"}`}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#0A2472] ring-1 ring-[#E4E7EC]"><CloudUpload size={20} /></span>
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-[#101828]">
            {busy ? `Uploading ${busy} file${busy > 1 ? "s" : ""}…` : <>Drop files here or <span className="text-[#0A2472] underline underline-offset-2">browse</span></>}
          </div>
          <div className="text-[12.5px] text-[#667085]">Saved as <b className="text-[#344054]">{label(docType)}</b> · PDF, image, Word or Excel</div>
        </div>
        <input ref={inputRef} type="file" hidden multiple onChange={(e) => void add(e.target.files)} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" />
      </div>

      {showDgErr ? <p className="m-0 mt-2 text-[13px] font-medium text-[#B42318]">A DG declaration is required before you can submit.</p> : null}
      {failed ? <p className="m-0 mt-2 text-[13px] text-[#B42318]">{failed}</p> : null}

      {attachments.length ? (
        <ul className="m-0 mt-3 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
          {attachments.map((a) => (
            <li key={a.storage_path ?? a.id ?? a.file_name} className="flex items-center gap-3 rounded-lg border border-[#EAECF0] bg-white px-3 py-2.5">
              <FileText size={18} className="shrink-0 text-[#0A2472]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium text-[#101828]">{a.file_name}</div>
                <div className="text-[12px] text-[#667085]">{label(a.doc_type)}</div>
              </div>
              {a.storage_path ? (
                <button type="button" aria-label={`Remove ${a.file_name}`} onClick={() => removeAttachment(a.storage_path)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-[#667085] hover:bg-[#FEF3F2] hover:text-[#B42318]"><X size={16} /></button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}
