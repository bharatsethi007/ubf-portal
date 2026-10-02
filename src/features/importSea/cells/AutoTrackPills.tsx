import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { restartTrackingAutomation } from '../importSeaApi'
import type { ImportSeaRow } from '../types'

type Kind = 'portconnect' | 'carrier'

const REASON: Record<string, { text: string; done: boolean }> = {
  gated_out: { text: 'All containers gated out', done: true },
  eta_plus_10: { text: 'ETA + 10 days and not gated out. Check the container.', done: false },
  empty_returned: { text: 'All empties returned', done: true },
  eta_plus_17: { text: 'ETA + 17 days', done: false },
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })

function Pill({ row, kind }: { row: ImportSeaRow; kind: Kind }) {
  const [busy, setBusy] = useState(false)
  const [gone, setGone] = useState(false)
  const at = kind === 'portconnect' ? row.pc_auto_stopped_at : row.carrier_auto_stopped_at
  const code = (kind === 'portconnect' ? row.pc_auto_stop_reason : row.carrier_auto_stop_reason) ?? ''
  if (!at || gone) return null
  const r = REASON[code] ?? { text: code || 'Stopped', done: false }
  const label = kind === 'portconnect' ? 'PC' : 'SL'
  const what = kind === 'portconnect' ? 'PortConnect daily refresh' : 'Shipping line sync (2-hourly)'

  async function restart() {
    setBusy(true)
    try {
      await restartTrackingAutomation(row.id, kind)
      setGone(true)
      toast.success(`${what} restarted. Runs on the next cycle.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not restart')
    } finally { setBusy(false) }
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button type="button" onClick={(e) => e.stopPropagation()}
            className={`import-sea-auto ${r.done ? 'import-sea-auto--done' : 'import-sea-auto--cut'}`}
            aria-label={`${what} auto-stopped`} title={`${what} off: ${r.text}`}>
            {label}
          </button>
        }
      />
      <PopoverContent className="import-sea-auto-pop" side="bottom" align="end">
        <div onClick={(e) => e.stopPropagation()}>
          <div className="import-sea-auto-pop__t">{what} off</div>
          <div className="import-sea-auto-pop__s">{r.text}. Stopped {fmt(at)}.</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button type="button" className="import-sea-auto-pop__btn" disabled={busy} onClick={restart}
              title="Restart auto-refresh" aria-label="Restart auto-refresh">
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Shows only when tracking automation has stopped. Green = finished, amber = ETA cut-off. */
export default function AutoTrackPills({ row }: { row: ImportSeaRow }) {
  if (!row.pc_auto_stopped_at && !row.carrier_auto_stopped_at) return null
  return (
    <>
      <Pill row={row} kind="portconnect" />
      <Pill row={row} kind="carrier" />
    </>
  )
}
