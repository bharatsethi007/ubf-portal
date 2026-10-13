// src/features/sli/SliSign.tsx
// Section 7: declaration and typed signature.
import React from "react";
import { Field, Section, err, inputCls, type SecState } from "./SliUI";

export const DECLARATION =
  "I hereby certify that I am aware of and accept UB Freight Limited Conditions of Trading and that the shipment particulars on the face hereof are correct. I certify that the consignment described herein does not contain any explosive or incendiary device or Dangerous Goods except as properly described, certified and in proper condition for carriage by air according to the applicable Dangerous Goods Regulations.";

type Props = {
  signedName: string; setSignedName: (v: string) => void; signature: string; setSignature: (v: string) => void;
  accepted: boolean; setAccepted: (v: boolean) => void; errors: string[]; state: SecState;
};

export default function SliSign({ signedName, setSignedName, signature, setSignature, accepted, setAccepted, errors, state }: Props) {
  const today = new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" });
  return (
    <Section id="sec-sign" n={7} title="Review & sign" sub="Your typed name is your signature" state={state}>
      <p className="m-0 rounded-lg bg-[#F9FAFB] px-4 py-3 text-[13px] leading-relaxed text-[#475467]">{DECLARATION}</p>
      <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <Field label="Full name" value={signedName} required error={err(errors, "signed_name")} placeholder="First and last name"
          onChange={(v) => { if (!signature || signature === signedName) setSignature(v); setSignedName(v); }} />
        <div>
          <label className="mb-1.5 flex items-center justify-between text-[13px] font-medium text-[#344054]">
            <span>Signature<span className="ml-0.5 text-[#F7941D]">*</span></span>
            <span className="text-[12px] font-normal text-[#667085]">{today}</span>
          </label>
          <input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Type to sign"
            className={`${inputCls(err(errors, "signature"))} h-12 text-[22px] text-[#0A2472]`}
            style={{ fontFamily: "'Segoe Script','Brush Script MT','Snell Roundhand',cursive" }} />
        </div>
      </div>
      <label className={`mt-4 flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-[14px] transition ${
        accepted ? "border-[#ABEFC6] bg-[#F6FEF9] text-[#085D3A]" : err(errors, "accepted") ? "border-[#FDA29B] bg-[#FFFBFA]" : "border-[#E4E7EC] text-[#344054]"}`}>
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#0A2472]" />
        <span>I accept the declaration above and confirm the shipment details are correct.</span>
      </label>
    </Section>
  );
}
