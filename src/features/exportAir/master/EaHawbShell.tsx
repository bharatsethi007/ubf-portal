import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import EaBookingView from '../EaBookingView'
import EaFamilyTabs from './EaFamilyTabs'
import EaAddSubDialog from './EaAddSubDialog'
import { consolidate, dissolve, unconsolidate } from '../eaMaster'
import { useEaFamily } from '../useEaFamily'
import type { EaRow } from '../eaTypes'
import type { EaDetail } from '../useEaBooking'

export type FamilyCtl = {
  master: EaRow | null
  subs: EaRow[]
  setActive: (id: string) => void
  openAdd: () => void
  make: () => Promise<void>
  remove: (id: string) => Promise<void>
  dissolve: () => Promise<void>
}

type Props = { bookingId: string; embedded?: boolean; onClose?: () => void; onChanged?: () => void }

/** A HAWB, or a buyers consolidation shown as master + sub-HAWB tabs. Same page and popup for both. */
export default function EaHawbShell({ bookingId, embedded, onClose, onChanged }: Props) {
  const fam = useEaFamily(bookingId)
  const [active, setActive] = useState(bookingId)
  const [adding, setAdding] = useState(false)
  useEffect(() => { setActive(bookingId) }, [bookingId])

  const changed = async () => { await fam.reload(); onChanged?.() }
  const run = async (fn: () => Promise<void>) => { try { await fn() } catch (e) { toast.error((e as Error).message) } }

  const ctl: FamilyCtl = {
    master: fam.master, subs: fam.subs, setActive, openAdd: () => setAdding(true),
    make: () => run(async () => {
      const mid = await consolidate([active])
      await changed()
      setActive(mid)
      toast.success('Buyers consolidation created. Add the other suppliers.')
      setAdding(true)
    }),
    remove: (id) => run(async () => {
      if (!window.confirm('Take this HAWB out of the consolidation? It stays on the same consol as a normal HAWB.')) return
      await unconsolidate(id)
      await changed()
      setActive(fam.master?.id ?? id)
      toast.success('Taken out of the consolidation')
    }),
    dissolve: () => run(async () => {
      const m = fam.master
      if (!m) return
      if (!window.confirm(`Dissolve ${m.booking_ref}? The ${fam.subs.length} sub-HAWBs become normal HAWBs again and the main HAWB is archived.`)) return
      const next = fam.subs[0]?.id
      await dissolve(m.id)
      await changed()
      toast.success('Consolidation dissolved')
      if (next) setActive(next); else onClose?.()
    }),
  }

  const tabs = fam.master
    ? <EaFamilyTabs master={fam.master} subs={fam.subs} active={active} onPick={setActive} onAdd={() => setAdding(true)} />
    : null

  return (
    <>
      <EaBookingView key={active} bookingId={active} embedded={embedded} onClose={onClose} onChanged={() => void changed()} family={ctl} tabs={tabs} />
      {adding && fam.master ? (
        <EaAddSubDialog m={fam.master as unknown as EaDetail} onClose={() => setAdding(false)}
          onDone={(id) => { setAdding(false); void changed().then(() => { if (id) setActive(id) }) }} />
      ) : null}
    </>
  )
}
