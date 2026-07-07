// src/features/sli/useSli.ts
// Public SLI page logic: load, upload, validate, submit. Uses anon Supabase client.
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const anonHeaders = {
  "Content-Type": "application/json",
  apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
};

export type SliState = "loading" | "form" | "expired" | "endorsed" | "invalid" | "success" | "error";

export function useSli(token: string) {
  const [state, setState] = useState<SliState>("loading");
  const [data, setData] = useState<any>(null);
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${FN}/sli-get`, {
          method: "POST", headers: anonHeaders, body: JSON.stringify({ token }),
        });
        const body = await res.json();
        if (body.status === "expired") return setState("expired");
        if (body.error === "invalid_link") return setState("invalid");
        if (body.status === "endorsed") { setData(body.sli); setAttachments(body.attachments ?? []); return setState("endorsed"); }
        setData(body.sli);
        setCountries(body.countries ?? []);
        setAttachments(body.attachments ?? []);
        setAnswers(body.sli?.sli_answers ?? {});      // pre-suggested country_of_origin lands here
        setState("form");
      } catch { setState("error"); }
    })();
  }, [token]);

  const setEdit = useCallback((k: string, v: any) => setEdits((p) => ({ ...p, [k]: v })), []);
  const setAnswer = useCallback((k: string, v: any) => setAnswers((p) => ({ ...p, [k]: v })), []);

  const uploadFile = useCallback(async (file: File, docType: string) => {
    const path = `${token}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("sli-uploads").upload(path, file);
    if (error) throw error;
    const rec = { doc_type: docType, file_name: file.name, storage_path: path };
    setAttachments((p) => [...p, rec]);
    return rec;
  }, [token]);

  const removeAttachment = useCallback((path: string) =>
    setAttachments((p) => p.filter((a) => a.storage_path !== path)), []);

  // mirrors sli-submit server validation
  const validate = useCallback((signedName: string, signature: string) => {
    const a = answers, errs: string[] = [];
    const yn = (v: any) => v === true || v === false || v === "yes" || v === "no";
    const isYes = (v: any) => v === true || v === "yes";
    if (!signedName?.trim()) errs.push("signed_name");
    if (!signature?.trim()) errs.push("signature");
    if (!yn(a.is_paying)) errs.push("is_paying");
    if (!yn(a.insurance_required)) errs.push("insurance_required");
    if (isYes(a.insurance_required) && !(Number(a.insurance_amount) > 0)) errs.push("insurance_amount");
    if (!yn(a.dangerous_goods)) errs.push("dangerous_goods");
    if (!a.country_of_origin) errs.push("country_of_origin");
    if (!yn(a.drawback_required)) errs.push("drawback_required");
    if (!a.purpose_of_export) errs.push("purpose_of_export");
    if (a.purpose_of_export === "other" && !a.purpose_other?.trim()) errs.push("purpose_other");
    if (!yn(a.caa_screening_auth)) errs.push("caa_screening_auth");
    const batteries = Array.isArray(a.batteries) ? a.batteries : [];
    const dgReq = isYes(a.dangerous_goods) || batteries.some((b: string) => /lithium/i.test(b));
    if (dgReq && !attachments.some((x) => x.doc_type === "dg_cert")) errs.push("dg_cert_attachment");
    setFieldErrors(errs);
    return errs;
  }, [answers, attachments]);

  const submit = useCallback(async (signedName: string, signature: string) => {
    const errs = validate(signedName, signature);
    if (errs.length) return { ok: false, errs };
    setSubmitting(true);
    try {
      const res = await fetch(`${FN}/sli-submit`, {
        method: "POST", headers: anonHeaders,
        body: JSON.stringify({
          token, customer_edits: edits, sli_answers: answers,
          signed_name: signedName, signature, attachments,
        }),
      });
      const body = await res.json();
      if (body.status === "endorsed") { setState("success"); return { ok: true }; }
      if (body.fields) { setFieldErrors(body.fields); return { ok: false, errs: body.fields }; }
      return { ok: false, errs: [body.error ?? "submit_failed"] };
    } finally { setSubmitting(false); }
  }, [token, edits, answers, attachments, validate]);

  return {
    state, data, countries, attachments, edits, answers, fieldErrors, submitting,
    setEdit, setAnswer, uploadFile, removeAttachment, submit,
  };
}
