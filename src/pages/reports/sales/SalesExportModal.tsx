import { useEffect, useState, type CSSProperties } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Seg, NAVY, C, FONT } from '../reportsUi'

type Period = '3m' | '6m' | '12m'

export type SalesExportOptions = {
  period: Period
  sections: { leaderboard: boolean; newVsExisting: boolean }
  repScope: 'all' | string
  preparedFor: string
}

type Props = {
  open: boolean
  onClose: () => void
  currentPeriod: Period
  reps: string[]
  onGenerate: (opts: SalesExportOptions) => Promise<void> | void
}

const PERIODS = [
  { k: '3m' as const, label: '3M' },
  { k: '6m' as const, label: '6M' },
  { k: '12m' as const, label: '12M' },
]

const fieldLabel: CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: C.ink2, marginBottom: 8,
}

function CheckRow({
  label, checked, disabled, onChange,
}: { label: string; checked: boolean; disabled?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: disabled ? C.mut : C.ink, cursor: disabled ? 'default' : 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        style={{ width: 15, height: 15, accentColor: NAVY }}
      />
      {label}
    </label>
  )
}

export default function SalesExportModal({ open, onClose, currentPeriod, reps, onGenerate }: Props) {
  const [period, setPeriod] = useState<Period>(currentPeriod)
  const [leaderboard, setLeaderboard] = useState(true)
  const [newVsExisting, setNewVsExisting] = useState(true)
  const [repScope, setRepScope] = useState<'all' | string>('all')
  const [preparedFor, setPreparedFor] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!open) return
    setPeriod(currentPeriod)
    setLeaderboard(true)
    setNewVsExisting(true)
    setRepScope('all')
    setPreparedFor('')
    setGenerating(false)
  }, [open, currentPeriod])

  async function handleGenerate() {
    if (generating) return
    if (!leaderboard && !newVsExisting) {
      toast.error('Select at least one section')
      return
    }
    setGenerating(true)
    try {
      await onGenerate({ period, sections: { leaderboard, newVsExisting }, repScope, preparedFor: preparedFor.trim() })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !generating) onClose() }}>
      <DialogContent className="sm:max-w-md" style={{ fontFamily: FONT }}>
        <DialogHeader>
          <DialogTitle>Export sales report</DialogTitle>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <span style={fieldLabel}>Period</span>
            <Seg options={PERIODS} value={period} onChange={setPeriod} />
          </div>

          <div>
            <span style={fieldLabel}>Sections</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <CheckRow label="Executive summary" checked disabled />
              <CheckRow label="Sales leaderboard" checked={leaderboard} onChange={setLeaderboard} />
              <CheckRow label="New vs existing" checked={newVsExisting} onChange={setNewVsExisting} />
            </div>
          </div>

          <div>
            <label style={fieldLabel} htmlFor="sales-export-rep">Rep scope</label>
            <select
              id="sales-export-rep"
              className="input"
              value={repScope}
              onChange={(e) => setRepScope(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="all">All reps</option>
              {reps.map((rep) => (<option key={rep} value={rep}>{rep}</option>))}
            </select>
          </div>

          <div>
            <label style={fieldLabel} htmlFor="sales-export-prepared">Prepared for</label>
            <input
              id="sales-export-prepared"
              className="input"
              type="text"
              value={preparedFor}
              onChange={(e) => setPreparedFor(e.target.value)}
              placeholder="Optional — client or audience name"
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={generating}>Cancel</Button>
          <Button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={generating}
            style={{ background: NAVY, color: '#fff' }}
          >
            {generating ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Loader2 size={15} className="animate-spin" /> Generating…
              </span>
            ) : 'Generate PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
