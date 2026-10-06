import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import EmailComposerDialog from './EmailComposerDialog'
import { fetchModuleMailbox, fetchStaffSignature, moduleOfMode } from './emailApi'
import { buildPreset, signatureHtml, type ComposerOpen, type ComposerKind, type ComposerPreset, type PresetDeps } from './composerPresets'

type Ctx = { openComposer: (o: ComposerOpen) => void }
const EmailComposerCtx = createContext<Ctx | null>(null)

/** Null outside a booking record (e.g. workspace peek drawer): callers fall back to their old behaviour. */
export const useEmailComposer = () => useContext(EmailComposerCtx)

type Props = { deps: PresetDeps; onSent?: () => void; children: ReactNode }

export function EmailComposerProvider({ deps, onSent, children }: Props) {
  const depsRef = useRef(deps)
  depsRef.current = deps
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<ComposerKind>('blank')
  const [preset, setPreset] = useState<ComposerPreset | null>(null)
  const [mailbox, setMailbox] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const tick = useRef(0)

  const load = useCallback(async (o: ComposerOpen) => {
    const my = ++tick.current
    setKind(o.kind); setLoading(true)
    try {
      const d = depsRef.current
      const [p, sig, mb] = await Promise.all([buildPreset(o, d), fetchStaffSignature(), fetchModuleMailbox(moduleOfMode(d.booking.mode))])
      if (my !== tick.current) return
      setMailbox(mb)
      setPreset({ ...p, html: p.html + signatureHtml(sig, mb) })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not build email')
    } finally {
      if (my === tick.current) setLoading(false)
    }
  }, [])

  const openComposer = useCallback((o: ComposerOpen) => { setPreset(null); setOpen(true); void load(o) }, [load])
  const b = deps.booking

  return (
    <EmailComposerCtx.Provider value={{ openComposer }}>
      {children}
      <EmailComposerDialog
        open={open} onClose={() => setOpen(false)}
        bookingId={b.id} bookingRef={b.booking_ref ?? null} accountId={b.account_id ?? null}
        mailbox={mailbox} kind={kind} preset={preset} loading={loading}
        canCustomer={Boolean(deps.progress)}
        onSwitch={(k) => void load({ kind: k })} onSent={onSent}
      />
    </EmailComposerCtx.Provider>
  )
}
