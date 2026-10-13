// src/features/sli/SliRail.tsx
// Sticky progress rail (desktop) and bottom bar (mobile): where you are, what's left, one submit button.
import React from "react";
import { ArrowRight, Check, Mail, Phone } from "lucide-react";
import type { SecState } from "./SliUI";
import { SECTIONS, type SecKey } from "./sliProgress";

type Props = {
  states: Record<SecKey, SecState>; prefilledCount: number; submitting: boolean; onSubmit: () => void;
};

const go = (k: SecKey) => document.getElementById(`sec-${k}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
const complete = (s: SecState) => s === "done" || s === "optional";

export default function SliRail({ states, prefilledCount, submitting, onSubmit }: Props) {
  const done = SECTIONS.filter((s) => complete(states[s.key])).length;
  const total = SECTIONS.length;
  const next = SECTIONS.find((s) => !complete(states[s.key]));
  const pct = Math.round((done / total) * 100);
  const ready = done === total;

  const click = ready ? onSubmit : () => next && go(next.key);
  const button = (
    <button type="button" onClick={click} disabled={submitting}
      className={`flex h-11 w-full items-center justify-center gap-2 rounded-lg text-[14.5px] font-semibold text-white transition disabled:opacity-60 ${
        ready ? "bg-[#F7941D] hover:bg-[#E3830F]" : "bg-[#0A2472] hover:bg-[#081C5A]"}`}>
      {submitting ? "Submitting…" : ready ? "Sign & submit SLI" : <>Next: {next?.title} <ArrowRight size={16} /></>}
    </button>
  );
  return (
    <>
      <aside className="sticky top-[84px] hidden self-start lg:block">
        <div className="rounded-xl border border-[#E4E7EC] bg-white">
          <div className="border-b border-[#F2F4F7] px-4 py-3.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[14px] font-semibold">Your progress</span>
              <span className="text-[13px] text-[#475467]"><b className="text-[#101828]">{done}</b> of {total}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F2F4F7]">
              <div className="h-full rounded-full bg-[#0A2472] transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            {prefilledCount ? <p className="m-0 mt-2 text-[12px] text-[#667085]">{prefilledCount} fields prefilled from your booking.</p> : null}
          </div>
          <nav className="flex flex-col p-1.5">
            {SECTIONS.map((s, i) => {
              const st = states[s.key];
              const isNext = next?.key === s.key;
              return (
                <button key={s.key} type="button" onClick={() => go(s.key)}
                  className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-[#F9FAFB] ${isNext ? "bg-[#F5F7FC]" : ""}`}>
                  {complete(st)
                    ? <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ECFDF3] text-[#067647]"><Check size={13} strokeWidth={3} /></span>
                    : <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ring-1 ${
                        st === "error" ? "bg-[#FEF3F2] text-[#B42318] ring-[#FECDCA]" : isNext ? "bg-[#0A2472] text-white ring-[#0A2472]" : "bg-white text-[#667085] ring-[#D0D5DD]"}`}>{i + 1}</span>}
                  <span className="min-w-0">
                    <span className={`block text-[13.5px] ${complete(st) ? "text-[#475467]" : "font-medium text-[#101828]"}`}>{s.title}</span>
                    <span className={`block text-[12px] ${st === "error" ? "text-[#B42318]" : "text-[#98A2B3]"}`}>
                      {st === "error" ? "Needs attention" : st === "optional" ? "Optional · recommended" : s.short}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
          <div className="border-t border-[#F2F4F7] p-3">
            {button}
            <p className="m-0 mt-2 text-center text-[11.5px] text-[#98A2B3]">UB Freight is notified as soon as you submit.</p>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-[#E4E7EC] bg-white px-4 py-3 text-[12.5px] text-[#475467]">
          <div className="mb-1 font-medium text-[#101828]">Questions about this shipment?</div>
          <a href="mailto:exportair.nz@ubfreight.com" className="flex items-center gap-1.5 text-[#0A2472] no-underline hover:underline"><Mail size={13} /> exportair.nz@ubfreight.com</a>
          <a href="tel:+6499663850" className="mt-0.5 flex items-center gap-1.5 text-[#0A2472] no-underline hover:underline"><Phone size={13} /> +64 9 966 3850</a>
        </div>
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E4E7EC] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-[1240px] items-center gap-3">
          <div className="w-24 shrink-0">
            <div className="text-[12px] text-[#475467]"><b className="text-[#101828]">{done}</b> of {total} done</div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#F2F4F7]"><div className="h-full rounded-full bg-[#0A2472]" style={{ width: `${pct}%` }} /></div>
          </div>
          <div className="flex-1">{button}</div>
        </div>
      </div>
    </>
  );
}
