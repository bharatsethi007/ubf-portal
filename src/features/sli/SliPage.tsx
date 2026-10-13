// src/features/sli/SliPage.tsx
// Public route /sli/:token. Wide two-column form with a sticky progress rail. No auth guard.
import React, { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useSli } from "./useSli";
import { Notice, Shell } from "./SliUI";
import SliSummary from "./SliSummary";
import SliCargo from "./SliCargo";
import SliDeclarations from "./SliDeclarations";
import SliUpload from "./SliUpload";
import SliSign from "./SliSign";
import SliRail from "./SliRail";
import { SECTIONS, dgRequired, sectionOfError, sectionStates } from "./sliProgress";

const EDIT_KEYS = ["supplier_name", "supplier_contact", "supplier_address", "supplier_city", "supplier_phone", "supplier_email",
  "supplier_country", "pieces", "weight_kg", "cbm", "po_number", "goods_description"];

function Skeleton() {
  return (
    <Shell>
      <div className="animate-pulse space-y-4">
        <div className="h-[150px] rounded-xl bg-white ring-1 ring-[#E4E7EC]" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-[220px] rounded-xl bg-white ring-1 ring-[#E4E7EC]" />)}</div>
          <div className="hidden h-[420px] rounded-xl bg-white ring-1 ring-[#E4E7EC] lg:block" />
        </div>
      </div>
    </Shell>
  );
}

export default function SliPage() {
  const { token = "" } = useParams();
  const sli = useSli(token);
  const [signedName, setSignedName] = useState("");
  const [signature, setSignature] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [localErr, setLocalErr] = useState<string[]>([]);

  const staff = sli.data?.staff_fields ?? {};
  const prefilled = sli.data?.prefilled ?? {};
  const a = sli.answers;
  const errors = useMemo(() => [...sli.fieldErrors, ...localErr], [sli.fieldErrors, localErr]);
  const val = (k: string) => (k in sli.edits ? sli.edits[k] : prefilled[k]);
  const suggestedKeys: string[] = Array.isArray(staff.suggested) ? staff.suggested : [];
  const suggested = (k: string) => suggestedKeys.includes(k) && !touched.has(k) && a[k] != null && a[k] !== "";
  const setAnswer = (k: string, v: any) => { setTouched((p) => new Set(p).add(k)); sli.setAnswer(k, v); };

  const states = sectionStates({ val, a, attachments: sli.attachments, errors, signedName, signature, accepted });
  const prefilledCount = EDIT_KEYS.filter((k) => prefilled[k] != null && prefilled[k] !== "").length + suggestedKeys.length;

  if (sli.state === "loading") return <Skeleton />;
  if (sli.state === "expired") return <Notice kind="expired" title="This link has expired" msg="Please contact UB Freight for a new link." />;
  if (sli.state === "invalid") return <Notice kind="invalid" title="Link not found" msg="This SLI link is invalid. Please check the link or contact UB Freight." />;
  if (sli.state === "error") return <Notice kind="error" title="Something went wrong" msg="Please refresh, or contact UB Freight." />;
  if (sli.state === "success") return <Notice kind="success" title="Thank you, your SLI is signed" msg="UB Freight has been notified and will take it from here. You can close this page." />;
  if (sli.state === "endorsed") return <Notice kind="success" title="Already signed" msg="This SLI has already been completed and submitted." />;

  const jump = (errs: string[]) => {
    const first = SECTIONS.find((s) => errs.some((e) => sectionOfError(e) === s.key));
    document.getElementById(`sec-${first?.key ?? "sign"}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const onSubmit = async () => {
    // The declaration tick is page-only; useSli/sli-submit check everything else.
    if (!accepted) { setLocalErr(["accepted"]); return jump([...sli.validate(signedName, signature), "accepted"]); }
    setLocalErr([]);
    const res = await sli.submit(signedName, signature);
    if (!res.ok) jump(res.errs ?? []);
  };

  return (
    <Shell right={staff.booking_ref ? <span className="rounded-md bg-[#F2F4F7] px-2 py-1 font-mono text-[12.5px] font-medium text-[#344054]">{staff.booking_ref}</span> : null}>
      <SliSummary staff={staff} expiresAt={sli.data?.expires_at} />

      {errors.length ? (
        <div role="alert" className="mt-4 rounded-lg border border-[#FECDCA] bg-[#FEF3F2] px-4 py-2.5 text-[13.5px] text-[#B42318]">
          A few answers are still needed. Sections marked in red show what's missing.
        </div>
      ) : null}

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-4">
          <SliCargo prefilled={prefilled} edits={sli.edits} setEdit={sli.setEdit} states={{ shipper: states.shipper, cargo: states.cargo }} />
          <SliDeclarations answers={a} setAnswer={setAnswer} countries={sli.countries} errors={errors} suggested={suggested}
            states={{ customs: states.customs, dg: states.dg, security: states.security }} />
          <SliUpload attachments={sli.attachments} uploadFile={sli.uploadFile} removeAttachment={sli.removeAttachment}
            dgRequired={dgRequired(a)} errors={errors} state={states.docs} />
          <SliSign signedName={signedName} setSignedName={setSignedName} signature={signature} setSignature={setSignature}
            accepted={accepted} setAccepted={(v) => { setAccepted(v); if (v) setLocalErr([]); }} errors={errors} state={states.sign} />
        </div>
        <SliRail states={states} prefilledCount={prefilledCount} submitting={sli.submitting} onSubmit={() => void onSubmit()} />
      </div>
    </Shell>
  );
}
