import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { lbl } from '@/features/exportAir/eaUi'

// Quote record shares the Export Air skin: same card, tag, button and label tokens.
export { Card, Tag, Code, btn, btnPrimary, lbl } from '@/features/exportAir/eaUi'

export const inp =
  'h-[30px] w-full min-w-0 rounded-[7px] border border-[#E3E6EB] bg-white px-2 text-[12.5px] text-[#14161A] outline-none focus:border-[#0A2472] disabled:bg-[#F8F9FB]'
export const area =
  'min-h-[76px] w-full resize-y rounded-[7px] border border-[#E3E6EB] bg-white px-2 py-1.5 text-[12.5px] leading-[1.45] text-[#14161A] outline-none focus:border-[#0A2472]'
export const iconBtn =
  'inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[7px] border border-[#E3E6EB] bg-white text-[#5B616E] hover:bg-[#F6F7F9] hover:text-[#14161A]'

export function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className={lbl}>{label}{hint ? <span className="ml-1 normal-case tracking-normal text-[#98A2B3]">· {hint}</span> : null}</span>
      {children}
    </label>
  )
}

type SegOpt<T extends string> = { value: T; label: string; icon?: ReactNode; title?: string; tone?: { fg: string; bg: string } }

/** Grey track. Plain options get a white thumb (Export Air style); toned options get a pastel thumb. */
export function Seg<T extends string>({ value, options, onChange, disabled, label, title }: {
  value: T | null; options: SegOpt<T>[]; onChange: (v: T) => void; disabled?: boolean; label: string; title?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} title={title} className={`inline-flex gap-0.5 rounded-[7px] bg-[#F2F4F7] p-0.5 ${disabled ? 'opacity-60' : ''}`}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} disabled={disabled} title={o.title} onClick={() => !on && onChange(o.value)}
            style={on && o.tone ? { background: o.tone.bg, color: o.tone.fg, boxShadow: `inset 0 0 0 1px ${o.tone.fg}26` } : undefined}
            className={`inline-flex w-auto items-center gap-1.5 rounded-[5px] border-0 px-2.5 py-1 text-[11.5px] disabled:cursor-not-allowed ${
              on ? `font-medium ${o.tone ? '' : 'bg-white text-[#14161A] shadow-[0_1px_2px_rgba(16,24,40,.08)]'}` : 'bg-transparent text-[#5B616E] hover:bg-white/70 hover:text-[#14161A]'}`}>
            <span className="inline-flex" style={!on && o.tone ? { color: o.tone.fg, opacity: 0.75 } : undefined}>{o.icon}</span>{o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Toggle chip for yes/no cargo flags. */
export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`inline-flex h-[28px] w-auto items-center gap-1.5 rounded-full border px-3 text-[12px] ${
        on ? 'border-[#0A2472] bg-[#EEF1F9] font-medium text-[#0A2472]' : 'border-[#E3E6EB] bg-white text-[#5B616E] hover:bg-[#F6F7F9]'}`}>
      {on ? <Check size={12} /> : null}{children}
    </button>
  )
}
