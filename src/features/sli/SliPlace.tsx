// src/features/sli/SliPlace.tsx
// Address field with Google Places suggestions in our own dropdown. Free typing always works.
import React, { useEffect, useRef, useState } from "react";
import { Building2, Loader2, MapPin } from "lucide-react";
import { details, loadPlaces, predict, type PlaceValue, type Prediction } from "@/features/portal/v2/contacts/googlePlaces";
import { Label, inputCls, type TagKind } from "./SliUI";
import { HelpBubble, useTip } from "./SliHelp";

type Props = {
  id: string; label: string; value: string; onText: (v: string) => void; onPick: (p: PlaceValue) => void;
  required?: boolean; error?: boolean; tag?: TagKind | null; help?: string; placeholder?: string; className?: string; country?: string;
};

export default function SliPlace({ id, label, value, onText, onPick, required, error, tag, help, placeholder, className, country }: Props) {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Prediction[]>([]);
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const tip = useTip(id, help);

  useEffect(() => { void loadPlaces().then(setReady); }, []);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [open]);

  function type(v: string) {
    onText(v);
    if (!ready) return;
    const n = ++seq.current;
    window.setTimeout(() => {
      if (n !== seq.current) return;
      void predict(v, country).then((r) => { if (n === seq.current) { setList(r); setCursor(0); setOpen(r.length > 0); } });
    }, 220);
  }

  async function pick(p: Prediction) {
    setOpen(false);
    setBusy(true);
    const d = await details(p.place_id);
    setBusy(false);
    if (d) onPick(d); else onText(p.description);
  }

  function key(e: React.KeyboardEvent) {
    if (!open || !list.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, list.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); void pick(list[cursor]); }
    else if (e.key === "Escape") setOpen(false);
  }

  return (
    <div className={className} ref={box}>
      <Label htmlFor={id} required={required} tag={tag} help={help ? { id, label } : null}>{label}</Label>
      <div className="relative">
        {busy ? <Loader2 size={16} className="pointer-events-none absolute left-3 top-3 animate-spin text-[#667085]" />
          : <MapPin size={16} className="pointer-events-none absolute left-3 top-3 text-[#98A2B3]" />}
        <input id={id} role="combobox" aria-expanded={open} aria-autocomplete="list" autoComplete="off" value={value ?? ""}
          placeholder={placeholder ?? (ready ? "Start typing an address" : "Street address")}
          onChange={(e) => type(e.target.value)} onKeyDown={key} {...tip}
          className={`${inputCls(error)} pl-9`} />
        {open ? (
          <ul role="listbox" className="absolute left-0 right-0 top-full z-30 m-0 mt-1 list-none overflow-hidden rounded-lg border border-[#E4E7EC] bg-white p-1 shadow-[0_12px_32px_rgba(16,24,40,.14)] duration-150 animate-in fade-in-0">
            {list.map((p, i) => (
              <li key={p.place_id} role="option" aria-selected={i === cursor}
                onMouseDown={(e) => { e.preventDefault(); void pick(p); }} onMouseEnter={() => setCursor(i)}
                className={`flex cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 ${i === cursor ? "bg-[#F2F5FC]" : ""}`}>
                {/\d/.test(p.main) ? <MapPin size={15} className="mt-0.5 shrink-0 text-[#0A2472]" /> : <Building2 size={15} className="mt-0.5 shrink-0 text-[#0A2472]" />}
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium text-[#101828]">{p.main}</span>
                  <span className="block truncate text-[12px] text-[#667085]">{p.secondary}</span>
                </span>
              </li>
            ))}
            <li className="px-2.5 pb-1 pt-1.5 text-right text-[10.5px] text-[#98A2B3]">Powered by Google</li>
          </ul>
        ) : <HelpBubble id={id} text={help} />}
      </div>
    </div>
  );
}
