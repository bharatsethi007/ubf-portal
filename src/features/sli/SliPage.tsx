// src/features/sli/SliPage.tsx
// Public route /sli/:token. Orchestrates load -> form -> submit. No auth guard.
import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useSli } from "./useSli";
import { Shell, Section, Notice, Label, err } from "./SliUI";
import SliCargo from "./SliCargo";
import SliDeclarations from "./SliDeclarations";
import SliUpload from "./SliUpload";

const DECLARATION =
  "I hereby certify that I am aware of and accept UB Freight Limited Conditions of Trading and that the shipment particulars on the face hereof are correct. I certify that the consignment described herein does not contain any explosive or incendiary device or Dangerous Goods except as properly described, certified and in proper condition for carriage by air according to the applicable Dangerous Goods Regulations.";

export default function SliPage() {
  const { token = "" } = useParams();
  const sli = useSli(token);
  const [signedName, setSignedName] = useState("");
  const [signature, setSignature] = useState("");
  const [accepted, setAccepted] = useState(false);

  if (sli.state === "loading") return <Shell><div className="p-8 text-center text-slate-400">Loading…</div></Shell>;
  if (sli.state === "expired") return <Notice kind="expired" title="This link has expired" msg="Please contact UB Freight for a new link." />;
  if (sli.state === "invalid") return <Notice kind="invalid" title="Link not found" msg="This SLI link is invalid. Please check the link or contact UB Freight." />;
  if (sli.state === "error") return <Notice kind="error" title="Something went wrong" msg="Please refresh, or contact UB Freight." />;
  if (sli.state === "success") return <Notice kind="success" title="Thank you — SLI endorsed" msg="UB Freight has been notified. You may close this page." />;
  if (sli.state === "endorsed") return <Notice kind="success" title="Already endorsed" msg="This SLI has already been completed and submitted." />;

  const staff = sli.data?.staff_fields ?? {};
  const a = sli.answers;
  const isYes = (v: any) => v === true || v === "yes";
  const dgRequired = isYes(a.dangerous_goods) ||
    (Array.isArray(a.batteries) ? a.batteries : []).some((b: string) => /lithium/i.test(b));

  const onSubmit = async () => {
    if (!accepted) { alert("Please accept the declaration to continue."); return; }
    const res = await sli.submit(signedName, signature);
    if (!res.ok) {
      document.getElementById("sli-errors")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <Shell>
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h1 className="text-lg font-bold text-[#0A2472]">Shipper's Letter of Instruction</h1>
        <p className="text-sm text-slate-500 mt-1">
          Please review the details below, make any corrections, attach documents, and endorse.
          {staff.booking_ref && <> Booking <b>{staff.booking_ref}</b>.</>}
        </p>
      </div>

      <SliCargo staff={staff} prefilled={sli.data?.prefilled} edits={sli.edits} setEdit={sli.setEdit} errors={sli.fieldErrors} />
      <SliDeclarations answers={sli.answers} setAnswer={sli.setAnswer} countries={sli.countries}
        errors={sli.fieldErrors} declaredValue={Number(a.declared_value) || undefined} />
      <SliUpload attachments={sli.attachments} uploadFile={sli.uploadFile}
        removeAttachment={sli.removeAttachment} dgRequired={dgRequired} errors={sli.fieldErrors} />

      <Section title="Declaration & Signature">
        <p className="text-[12px] text-slate-500 leading-relaxed">{DECLARATION}</p>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <Label required>Full Name</Label>
            <input value={signedName} onChange={(e) => setSignedName(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${err(sli.fieldErrors, "signed_name") ? "border-red-400" : "border-slate-200"}`} />
          </div>
          <div>
            <Label required>Signature (type your full name)</Label>
            <input value={signature} onChange={(e) => setSignature(e.target.value)}
              placeholder="Type to sign"
              className={`w-full rounded-lg border px-3 py-2 text-lg italic ${err(sli.fieldErrors, "signature") ? "border-red-400" : "border-slate-200"}`}
              style={{ fontFamily: "cursive" }} />
          </div>
          <label className="flex items-start gap-2 text-[13px] text-slate-600">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5" />
            I accept the declaration and confirm the shipment particulars are correct.
          </label>
        </div>
      </Section>

      {sli.fieldErrors.length > 0 && (
        <div id="sli-errors" className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          Please complete all required fields before submitting.
        </div>
      )}

      <button onClick={onSubmit} disabled={sli.submitting}
        className="w-full bg-[#F7941D] hover:bg-[#e0850f] text-white font-bold rounded-xl py-3.5 disabled:opacity-50">
        {sli.submitting ? "Submitting…" : "Endorse & Submit SLI"}
      </button>
      <div className="h-6" />
    </Shell>
  );
}
