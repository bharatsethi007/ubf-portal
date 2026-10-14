// src/features/sli/SliUI.tsx
// Shared primitives for the public SLI page. White, roomy type, compact grids. UBF navy #0A2472, orange #F7941D.
import React from "react";
import { Bookmark, Check, Lock, Mail, Phone, Sparkles } from "lucide-react";
import { HelpBubble, InfoButton, useTip } from "./SliHelp";

export const err = (errors: string[], key: string) => errors.includes(key);
export const isYes = (v: any) => v === true || v === "yes";
export const isNo = (v: any) => v === false || v === "no";

const ring = (bad?: boolean) =>
  bad ? "border-[#F04438] ring-2 ring-[#FEE4E2]" : "border-[#D5D9E0] hover:border-[#B4BBC6] focus:border-[#0A2472] focus:ring-2 focus:ring-[#E4E9F7]";
export const inputCls = (bad?: boolean, ro?: boolean) =>
  `h-10 w-full rounded-lg border bg-white px-3 text-[14px] text-[#101828] outline-none transition placeholder:text-[#98A2B3] ${ring(bad)} ${ro ? "bg-[#F8F9FB] text-[#475467]" : ""}`;

export type TagKind = "prefilled" | "suggested" | "template";
const TAGS: Record<TagKind, { t: string; tip: string; cls: string }> = {
  prefilled: { t: "Prefilled", tip: "Filled in by UB Freight from your booking. Change it if it's wrong.", cls: "bg-[#EEF2FB] text-[#0A2472]" },
  suggested: { t: "Suggested", tip: "UB Freight's best guess. Please confirm.", cls: "bg-[#FFF4E5] text-[#B54708]" },
  template: { t: "From template", tip: "Saved from your last SLI. Change it if it's different this time.", cls: "bg-[#ECFDF3] text-[#067647]" },
};

/** Marker next to a label showing where the value came from. */
export function Tag({ kind }: { kind: TagKind }) {
  const k = TAGS[kind];
  return (
    <span title={k.tip} className={`ml-1.5 inline-flex items-center gap-0.5 rounded px-1.5 py-[1px] text-[10.5px] font-medium ${k.cls}`}>
      {kind === "template" ? <Bookmark size={10} /> : <Sparkles size={10} />}<span className="hidden sm:inline">{k.t}</span>
    </span>
  );
}

export function Label({ children, required, tag, htmlFor, help }: {
  children: React.ReactNode; required?: boolean; tag?: TagKind | null; htmlFor?: string; help?: { id: string; label: string } | null;
}) {
  return (
    <div className="mb-1.5 flex items-center text-[13px] font-medium text-[#344054]">
      <label htmlFor={htmlFor}>{children}</label>{required ? <span className="ml-0.5 text-[#F7941D]">*</span> : null}
      {help ? <InfoButton id={help.id} label={help.label} /> : null}
      {tag ? <Tag kind={tag} /> : null}
    </div>
  );
}

type FieldProps = {
  label: string; value: any; onChange?: (v: string) => void; required?: boolean; error?: boolean;
  type?: string; readOnly?: boolean; placeholder?: string; tag?: TagKind | null;
  className?: string; suffix?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; help?: string;
};

export function Field({ label, value, onChange, required, error, type = "text", readOnly, placeholder, tag, className, suffix, inputMode, help }: FieldProps) {
  const id = `f-${label.replace(/\W+/g, "-").toLowerCase()}`;
  const tip = useTip(id, help);
  return (
    <div className={className}>
      <Label htmlFor={id} required={required} tag={tag} help={help ? { id, label } : null}>{label}</Label>
      <div className="relative">
        <HelpBubble id={id} text={help} />
        <input id={id} type={type} value={value ?? ""} placeholder={placeholder} readOnly={readOnly} inputMode={inputMode} {...tip}
          onChange={(e) => onChange?.(e.target.value)} className={`${inputCls(error, readOnly)} ${suffix ? "pr-12" : ""}`} />
        {suffix ? <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-[#667085]">{suffix}</span> : null}
      </div>
    </div>
  );
}

/** Segmented control. Used for yes/no and short option sets. */
export function Segmented<T extends string>({ value, options, onChange, error }: {
  value: any; options: { v: T; t: string }[]; onChange: (v: T) => void; error?: boolean;
}) {
  return (
    <div role="radiogroup" className={`inline-flex rounded-lg border bg-[#F2F4F7] p-0.5 ${error ? "border-[#F04438] ring-2 ring-[#FEE4E2]" : "border-[#E4E7EC]"}`}>
      {options.map((o) => {
        const on = value === o.v || (o.v === "yes" && value === true) || (o.v === "no" && value === false);
        return (
          <button key={o.v} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.v)}
            className={`h-9 min-w-[64px] rounded-md px-3.5 text-[13.5px] font-medium transition ${
              on ? "bg-white text-[#0A2472] shadow-[0_1px_2px_rgba(16,24,40,.12)] ring-1 ring-[#D0D5DD]" : "text-[#475467] hover:text-[#101828]"}`}>
            {o.t}
          </button>
        );
      })}
    </div>
  );
}

export const YN = [{ v: "yes" as const, t: "Yes" }, { v: "no" as const, t: "No" }];

/** One question per row: text on the left, answer on the right. Fast to scan, easy to tap. */
export function QRow({ q, hint, required, tag, error, children, below }: {
  q: React.ReactNode; hint?: React.ReactNode; required?: boolean; tag?: TagKind | null;
  error?: boolean; children: React.ReactNode; below?: React.ReactNode;
}) {
  return (
    <div className={`py-3.5 ${error ? "-mx-2 rounded-lg bg-[#FFFBFA] px-2" : ""}`}>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center text-[14px] font-medium text-[#101828]">
            {q}{required ? <span className="ml-0.5 text-[#F7941D]">*</span> : null}{tag ? <Tag kind={tag} /> : null}
          </div>
          {hint ? <div className="mt-0.5 text-[12.5px] leading-snug text-[#667085]">{hint}</div> : null}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
      {below ? <div className="mt-3">{below}</div> : null}
    </div>
  );
}

export type SecState = "done" | "todo" | "error" | "optional";

/** Numbered card. Its id is what the progress rail jumps to. */
export function Section({ id, n, title, sub, state, children, right }: {
  id: string; n: number; title: string; sub?: string; state: SecState; children: React.ReactNode; right?: React.ReactNode;
}) {
  const badge = state === "done"
    ? <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECFDF3] text-[#067647] ring-1 ring-[#ABEFC6]"><Check size={15} strokeWidth={2.5} /></span>
    : <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold ring-1 ${
        state === "error" ? "bg-[#FEF3F2] text-[#B42318] ring-[#FECDCA]" : "bg-white text-[#0A2472] ring-[#D0D5DD]"}`}>{n}</span>;
  return (
    <section id={id} className={`scroll-mt-24 rounded-xl border bg-white ${state === "error" ? "border-[#FECDCA]" : "border-[#E4E7EC]"}`}>
      <header className="flex items-center gap-3 border-b border-[#F2F4F7] px-5 py-3.5">
        {badge}
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[15.5px] font-semibold tracking-[-0.01em] text-[#101828]">{title}</h2>
          {sub ? <p className="m-0 text-[12.5px] text-[#667085]">{sub}</p> : null}
        </div>
        {right}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F7F8FA] font-sans text-[#101828] antialiased">
      <header className="sticky top-0 z-30 border-b border-[#E4E7EC] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-4 px-4 sm:px-6">
          <img src="/ub-freight-logo-ink.png" alt="UB Freight" className="h-9 w-auto rounded-[3px]" />
          <div className="hidden h-7 w-px bg-[#E4E7EC] sm:block" />
          <div className="hidden min-w-0 sm:block">
            <div className="text-[15px] font-semibold leading-tight">Shipper's Letter of Instruction</div>
            <div className="text-[12px] text-[#667085]">Export air · UB Freight Limited</div>
          </div>
          <span className="flex-1" />
          {right}
          <span className="hidden items-center gap-1 text-[12px] text-[#667085] md:flex"><Lock size={12} /> Secure link</span>
        </div>
      </header>
      <main className="mx-auto max-w-[1240px] px-4 pb-28 pt-5 sm:px-6 lg:pb-12">{children}</main>
      <footer className="border-t border-[#E4E7EC] bg-white">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-5 gap-y-1 px-4 py-4 text-[12px] text-[#667085] sm:px-6">
          <span className="font-medium text-[#344054]">UB Freight Limited</span>
          <span>173 Montgomerie Road, Airport Oaks, Auckland 2022</span>
          <a href="tel:+6499663850" className="inline-flex items-center gap-1 text-[#667085] no-underline hover:text-[#0A2472]"><Phone size={12} /> +64 9 966 3850</a>
          <a href="mailto:exportair.nz@ubfreight.com" className="inline-flex items-center gap-1 text-[#667085] no-underline hover:text-[#0A2472]"><Mail size={12} /> exportair.nz@ubfreight.com</a>
        </div>
      </footer>
    </div>
  );
}

export function Notice({ kind, title, msg }: { kind: "expired" | "invalid" | "error" | "success"; title: string; msg: string }) {
  const ok = kind === "success";
  return (
    <Shell>
      <div className="mx-auto mt-10 max-w-[520px] rounded-xl border border-[#E4E7EC] bg-white p-10 text-center">
        <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${ok ? "bg-[#ECFDF3] text-[#067647]" : "bg-[#F2F4F7] text-[#475467]"}`}>
          {ok ? <Check size={24} strokeWidth={2.5} /> : <Lock size={22} />}
        </div>
        <h1 className="m-0 mb-2 text-[20px] font-semibold">{title}</h1>
        <p className="m-0 text-[14px] text-[#667085]">{msg}</p>
      </div>
    </Shell>
  );
}
