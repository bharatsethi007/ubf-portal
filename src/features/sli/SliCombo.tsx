// src/features/sli/SliCombo.tsx
// Searchable picker styled like the address dropdown. Used for country of origin.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Label, inputCls, type TagKind } from "./SliUI";
import { HelpBubble } from "./SliHelp";

type Opt = { code: string; name: string };
type Props = {
  id: string; label: string; value: string | null | undefined; options: Opt[]; top?: string[]; onChange: (code: string) => void;
  required?: boolean; error?: boolean; tag?: TagKind | null; help?: string; placeholder?: string; className?: string;
};

export default function SliCombo({ id, label, value, options, top = [], onChange, required, error, tag, help, placeholder, className }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const sel = options.find((o) => o.code === value);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) {
      const pinned = top.map((c) => options.find((o) => o.code === c)).filter(Boolean) as Opt[];
      return [...pinned, ...options.filter((o) => !top.includes(o.code))];
    }
    const starts = options.filter((o) => o.name.toLowerCase().startsWith(t) || o.code.toLowerCase() === t);
    return [...starts, ...options.filter((o) => !starts.includes(o) && o.name.toLowerCase().includes(t))];
  }, [q, options, top]);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setQ(""); } };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [open]);
  useEffect(() => { list.current?.children[cursor]?.scrollIntoView({ block: "nearest" }); }, [cursor]);

  const choose = (o: Opt) => { onChange(o.code); setOpen(false); setQ(""); };
  function key(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) { e.preventDefault(); setOpen(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, shown.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter" && shown[cursor]) { e.preventDefault(); choose(shown[cursor]); }
    else if (e.key === "Escape") { setOpen(false); setQ(""); }
  }

  return (
    <div className={className} ref={box}>
      <Label htmlFor={id} required={required} tag={tag} help={help ? { id, label } : null}>{label}</Label>
      <div className="relative">
        <input id={id} role="combobox" aria-expanded={open} autoComplete="off"
          value={open ? q : sel?.name ?? ""} placeholder={open ? "Type to search" : placeholder}
          onFocus={(e) => { setOpen(true); setCursor(0); e.currentTarget.select(); }}
          onChange={(e) => { setQ(e.target.value); setCursor(0); setOpen(true); }} onKeyDown={key}
          className={`${inputCls(error)} pr-9`} />
        <ChevronDown size={16} className={`pointer-events-none absolute right-3 top-3 text-[#667085] transition ${open ? "rotate-180" : ""}`} />
        {open ? (
          <ul ref={list} role="listbox" className="absolute left-0 right-0 top-full z-30 m-0 mt-1 max-h-[260px] list-none overflow-y-auto rounded-lg border border-[#E4E7EC] bg-white p-1 shadow-[0_12px_32px_rgba(16,24,40,.14)] duration-150 animate-in fade-in-0">
            {help && !q ? <li className="px-2.5 pb-1.5 pt-1 text-[12px] leading-snug text-[#667085]">{help}</li> : null}
            {shown.length ? shown.map((o, i) => (
              <li key={o.code} role="option" aria-selected={o.code === value}
                onMouseDown={(e) => { e.preventDefault(); choose(o); }} onMouseEnter={() => setCursor(i)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] ${i === cursor ? "bg-[#F2F5FC]" : ""} ${
                  !q && i === top.length - 1 && top.length ? "mb-1 border-b border-[#F2F4F7] pb-2.5" : ""}`}>
                <span className="w-7 font-mono text-[12px] text-[#667085]">{o.code}</span>
                <span className="flex-1 text-[#101828]">{o.name}</span>
                {o.code === value ? <Check size={15} className="text-[#0A2472]" /> : null}
              </li>
            )) : <li className="px-2.5 py-2 text-[13px] text-[#667085]">No match</li>}
          </ul>
        ) : <HelpBubble id={id} text={help} />}
      </div>
    </div>
  );
}
