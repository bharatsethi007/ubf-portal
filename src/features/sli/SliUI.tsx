// src/features/sli/SliUI.tsx
// Small shared primitives for the SLI page. UBF branding: navy #0A2472, orange #F7941D.
import React from "react";

export const err = (errors: string[], key: string) => errors.includes(key);

export function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
      {children} {required && <span className="text-[#F7941D]">*</span>}
    </label>
  );
}

export function Field({
  label, value, onChange, required, error, type = "text", readOnly, placeholder,
}: {
  label: string; value: any; onChange?: (v: string) => void; required?: boolean;
  error?: boolean; type?: string; readOnly?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <input
        type={type} value={value ?? ""} placeholder={placeholder}
        readOnly={readOnly} onChange={(e) => onChange?.(e.target.value)}
        className={`w-full rounded-lg border px-3 py-2 text-sm ${
          readOnly ? "bg-slate-50 text-slate-500" : "bg-white"
        } ${error ? "border-red-400 ring-1 ring-red-300" : "border-slate-200"}`}
      />
    </div>
  );
}

export function YesNo({
  label, value, onChange, required, error,
}: {
  label: string; value: any; onChange: (v: "yes" | "no") => void;
  required?: boolean; error?: boolean;
}) {
  const opt = (v: "yes" | "no", txt: string) => {
    const active = value === v || value === (v === "yes");
    return (
      <button type="button" onClick={() => onChange(v)}
        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
          active ? "bg-[#0A2472] text-white border-[#0A2472]" : "bg-white text-slate-600 border-slate-200"
        }`}>
        {txt}
      </button>
    );
  };
  return (
    <div>
      <Label required={required}>{label}</Label>
      <div className={`flex gap-2 ${error ? "rounded-lg ring-1 ring-red-300 p-0.5" : ""}`}>
        {opt("yes", "Yes")}{opt("no", "No")}
      </div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5">
      <h2 className="text-sm font-bold text-[#0A2472] mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="bg-[#0A2472] text-white px-5 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="font-bold tracking-tight">UB FREIGHT</span>
          <span className="text-xs text-blue-200">Shipper's Letter of Instruction</span>
        </div>
      </header>
      <main className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">{children}</main>
      <footer className="max-w-2xl mx-auto px-5 py-6 text-[11px] text-slate-400">
        173 Montgomerie Road, Mangere, Auckland 2022 · Ph: 09 966 3850
      </footer>
    </div>
  );
}

export function Notice({ kind, title, msg }: { kind: "expired" | "invalid" | "error" | "success"; title: string; msg: string }) {
  const color = kind === "success" ? "text-emerald-600" : "text-slate-700";
  return (
    <Shell>
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <h1 className={`text-lg font-bold ${color} mb-2`}>{title}</h1>
        <p className="text-sm text-slate-500">{msg}</p>
      </div>
    </Shell>
  );
}
