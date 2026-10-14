// src/features/sli/SliHelp.tsx
// Field tips. A tip opens when a field gets focus. Closing one with X turns auto tips off (remembered on this
// device); the (i) next to a label still opens that field's tip on demand.
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Info, X } from "lucide-react";

const KEY = "ubf_sli_tips_off";
const readOff = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
const writeOff = (v: boolean) => { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* private mode */ } };

type Ctx = {
  open: string | null; auto: boolean;
  focus: (id: string) => void; blur: (id: string) => void; toggle: (id: string) => void; dismiss: () => void; enable: () => void;
};
const HelpCtx = createContext<Ctx | null>(null);

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [auto, setAuto] = useState(() => !readOff());
  const [open, setOpen] = useState<string | null>(null);
  const focus = useCallback((id: string) => { if (auto) setOpen(id); }, [auto]);
  const blur = useCallback((id: string) => setOpen((o) => (o === id ? null : o)), []);
  const toggle = useCallback((id: string) => setOpen((o) => (o === id ? null : id)), []);
  const dismiss = useCallback(() => { setAuto(false); writeOff(true); setOpen(null); }, []);
  const enable = useCallback(() => { setAuto(true); writeOff(false); }, []);
  const v = useMemo(() => ({ open, auto, focus, blur, toggle, dismiss, enable }), [open, auto, focus, blur, toggle, dismiss, enable]);
  return <HelpCtx.Provider value={v}>{children}</HelpCtx.Provider>;
}

export const useHelp = () => useContext(HelpCtx);

/** Small (i) beside a label. */
export function InfoButton({ id, label }: { id: string; label: string }) {
  const h = useHelp();
  if (!h) return null;
  return (
    <button type="button" aria-label={`What is ${label}?`} title="What's this?"
      onMouseDown={(e) => e.preventDefault()} onClick={() => h.toggle(id)}
      className={`ml-1 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full transition ${h.open === id ? "bg-[#0A2472] text-white" : "text-[#98A2B3] hover:text-[#0A2472]"}`}>
      <Info size={13} />
    </button>
  );
}

/** The tip itself, anchored under the field. */
export function HelpBubble({ id, text }: { id: string; text?: string }) {
  const h = useHelp();
  if (!h || !text || h.open !== id) return null;
  return (
    <div role="tooltip" onMouseDown={(e) => e.preventDefault()}
      className="absolute left-0 top-full z-20 mt-1.5 w-max min-w-[240px] max-w-[min(340px,90vw)] rounded-lg bg-[#0A2472] px-3.5 py-2.5 text-[12.5px] leading-snug text-white shadow-[0_8px_24px_rgba(10,36,114,.25)] duration-150 animate-in fade-in-0 slide-in-from-top-1">
      <span className="absolute -top-1 left-5 h-2 w-2 rotate-45 bg-[#0A2472]" />
      <div className="flex items-start gap-3">
        <span className="flex-1">{text}</span>
        {h.auto ? (
          <button type="button" onClick={h.dismiss} title="Stop showing tips automatically"
            className="-mr-1 -mt-0.5 inline-flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-[11.5px] text-[#C7D2F0] hover:bg-white/10 hover:text-white">
            <X size={13} /> Hide tips
          </button>
        ) : (
          <button type="button" aria-label="Close tip" onClick={() => h.toggle(id)} className="-mr-1 -mt-0.5 rounded p-0.5 text-[#C7D2F0] hover:text-white"><X size={13} /></button>
        )}
      </div>
    </div>
  );
}

/** Focus handlers for any input that has a tip. */
export function useTip(id: string, text?: string) {
  const h = useHelp();
  return text && h ? { onFocus: () => h.focus(id), onBlur: () => h.blur(id) } : {};
}
