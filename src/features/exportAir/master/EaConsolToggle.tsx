import { useEffect, useRef, useState } from 'react'
import { Layers, Plus, Unlink, X } from 'lucide-react'

type Props = {
  mode: 'none' | 'master' | 'sub'
  masterRef?: string | null
  disabled?: boolean
  onMake: () => void; onAdd: () => void; onRemove: () => void; onDissolve: () => void; onOpenMaster: () => void
}

/** Header switch for buyers consolidation: turn on, add a HAWB, take a sub out, or dissolve. */
export default function EaConsolToggle({ mode, masterRef, disabled, onMake, onAdd, onRemove, onDissolve, onOpenMaster }: Props) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', down)
    return () => document.removeEventListener('mousedown', down)
  }, [open])
  const on = mode !== 'none'
  const item = 'flex w-full items-center gap-2 rounded-md border-0 bg-transparent px-2.5 py-2 text-left text-[12.5px] hover:bg-[#F3F5FB]'

  return (
    <div ref={box} className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        className={`inline-flex h-[30px] w-auto items-center gap-2 rounded-[7px] border px-2.5 text-[12px] font-medium transition disabled:opacity-50 ${on ? 'border-[#0A2472] bg-[#F3F5FB] text-[#0A2472]' : 'border-[#E3E6EB] bg-white text-[#14161A] hover:bg-[#F6F7F9]'}`}>
        <span className={`relative h-4 w-7 rounded-full transition ${on ? 'bg-[#0A2472]' : 'bg-[#D0D5DD]'}`}>
          <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${on ? 'left-[14px]' : 'left-0.5'}`} />
        </span>
        <Layers size={13} /> {mode === 'sub' ? `In ${masterRef ?? 'consol'}` : 'Buyers consol'}
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1.5 w-[300px] rounded-xl border border-[#E6E8EE] bg-white p-1.5 text-[12.5px] shadow-[0_16px_40px_rgba(15,23,42,.16)] duration-150 animate-in fade-in-0 zoom-in-95">
          {mode === 'none' ? (
            <div className="p-2">
              <div className="mb-1 font-semibold text-[#14161A]">Make this a buyers consolidation?</div>
              <p className="m-0 mb-3 text-[12px] leading-snug text-[#5B616E]">A master HAWB is created for this buyer with this HAWB as the first supplier tab. Add more suppliers after. Only the master goes to TradeWindow.</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="inline-flex h-[28px] w-auto items-center rounded-[7px] border border-[#E3E6EB] bg-white px-2.5 text-[12px]">Cancel</button>
                <button type="button" onClick={() => { setOpen(false); onMake() }} className="inline-flex h-[28px] w-auto items-center gap-1 rounded-[7px] border border-[#0A2472] bg-[#0A2472] px-2.5 text-[12px] font-medium text-white"><Layers size={12} /> Consolidate</button>
              </div>
            </div>
          ) : (
            <>
              <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); onAdd() }}><Plus size={14} className="text-[#0A2472]" /> Add HAWB<span className="ml-auto text-[11px] text-[#98A2B3]">existing or manual</span></button>
              {mode === 'sub' ? (
                <>
                  <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); onOpenMaster() }}><Layers size={14} className="text-[#5B616E]" /> Open master {masterRef}</button>
                  <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); onRemove() }}><Unlink size={14} className="text-[#B54708]" /> Take out of consolidation</button>
                </>
              ) : (
                <button type="button" role="menuitem" className={`${item} text-[#B42318]`} onClick={() => { setOpen(false); onDissolve() }}><X size={14} /> Dissolve consolidation</button>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
