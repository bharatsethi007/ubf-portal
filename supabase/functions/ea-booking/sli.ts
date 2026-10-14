// Free SLI read for the export air booking prefill: UBF Air SLI as .docx or text PDF. No AI.
import { readSliDocx } from "./sliDocx.ts";
import { readSliPdf } from "./sliPdf.ts";
import { type SliResult, toForm } from "./sliCommon.ts";
import type { EaForm } from "./extract.ts";

export type { SliResult } from "./sliCommon.ts";

export const looksLikeSli = (name: string) =>
  /\.(docx|pdf)$/i.test(name) && /\bSLI\b|S\.L\.I|letter.?of.?instruction|_SLI|SLI[_ -]/i.test(name);

export async function readSli(name: string, bytes: Uint8Array): Promise<SliResult | null> {
  try {
    const raw = /\.docx$/i.test(name) ? readSliDocx(bytes) : /\.pdf$/i.test(name) ? await readSliPdf(bytes) : null;
    return raw ? toForm(raw, name) : null;
  } catch (e) {
    console.error("sli read failed", name, e);
    return null;
  }
}

/** Newest SLI-looking .docx/.pdf in the conversation that reads as a filled-in UBF SLI. */
export async function sliForConversation(
  atts: { id: number; name: string; s3_key: string }[], getBytes: (key: string) => Promise<Uint8Array>,
): Promise<(SliResult & { _sli_file: string }) | null> {
  for (const a of [...atts].sort((x, y) => y.id - x.id).filter((x) => looksLikeSli(x.name)).slice(0, 3)) {
    try {
      const r = await readSli(a.name, await getBytes(a.s3_key));
      if (r) return { ...r, _sli_file: a.name };
    } catch (e) { console.error("sli fetch failed", a.name, e); }
  }
  return null;
}

const filled = <T extends Record<string, unknown>>(o: T | null | undefined) =>
  Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v != null && v !== "")) as Partial<T>;

/** SLI values win over the email guess; anything the SLI left blank keeps what the form had. */
export function applySli(form: EaForm, s: SliResult & { _sli_file: string }): EaForm {
  return {
    ...form,
    shipper: s.shipper ? { ...form.shipper, ...filled(s.shipper) } : form.shipper,
    consignee: s.consignee ? { ...form.consignee, ...filled(s.consignee) } : form.consignee,
    lines: s.lines?.length ? s.lines : form.lines,
    destination: s.destination ?? form.destination,
    incoterm: s.incoterm ?? form.incoterm,
    goods: s.goods ?? form.goods,
    ready_date: s.ready_date ?? form.ready_date,
    is_dg: form.is_dg || !!s.is_dg,
    pickup: s.pickup ? { ...form.pickup, needed: s.pickup.needed, ready_time: s.pickup.ready_time ?? form.pickup.ready_time } : form.pickup,
    notes: [form.notes, s.notes].filter(Boolean).join("\n"),
    _low_confidence: [...(form._low_confidence ?? []), `Read from ${s._sli_file}: check ${s._sli_filled.join(", ")}`],
  };
}
