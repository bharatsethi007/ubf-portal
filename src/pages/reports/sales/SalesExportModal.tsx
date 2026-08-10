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

export type AccountLimit = 25 | 50 | 100 | 'all'

export type SalesExportOptions = {
  period: Period
  sections: { leaderboard: boolean; newVsExisting: boolean; topAccounts: boolean; tradeLanes: boolean }
  repScope: 'all' | string
  preparedFor: string
  accountLimit: AccountLimit
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

const ACCOUNT_LIMITS: { value: AccountLimit; label: string }[] = [
  { value: 25, label: 'Top 25' },
  { value: 50, label: 'Top 50' },
  { value: 100, label: 'Top 100' },
  { value: 'all', label: 'All accounts' },
]

const fieldLabel: CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: C.ink2, marginBottom: 8,
}

function CheckRow({
  label, checked, disabled, onChange, hint,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange?: (v: boolean) => void
  hint?: string
}) {
  return (
    <div>
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
      {hint && disabled ? (
        <span style={{ display: 'block', fontSize: 11, color: C.mut, marginLeft: 23, marginTop: 2 }}>{hint}</span>
      ) : null}
    </div>
  )
}

export default function SalesExportModal({ open, onClose, currentPeriod, reps, onGenerate }: Props) {
  const [period, setPeriod] = useState<Period>(currentPeriod)
  const [leaderboard, setLeaderboard] = useState(true)
  const [newVsExisting, setNewVsExisting] = useState(true)
  const [topAccounts, setTopAccounts] = useState(true)
  const [tradeLanes, setTradeLanes] = useState(true)
  const [accountLimit, setAccountLimit] = useState<AccountLimit>(25)
  const [repScope, setRepScope] = useState<'all' | string>('all')
  const [preparedFor, setPreparedFor] = useState('')
  const [generating, setGenerating] = useState(false)

  const bookWideDisabled = repScope !== 'all'

  useEffect(() => {
    if (!open) return
    setPeriod(currentPeriod)
    setLeaderboard(true)
    setNewVsExisting(true)
    setTopAccounts(true)
    setTradeLanes(true)
    setAccountLimit(25)
    setRepScope('all')
    setPreparedFor('')
    setGenerating(false)
  }, [open, currentPeriod])

  useEffect(() => {
    if (repScope !== 'all') {
      setTopAccounts(false)
      setTradeLanes(false)
    }
  }, [repScope])

  async function handleGenerate() {
    if (generating) return
    const effectiveTopAccounts = !bookWideDisabled && topAccounts
    const effectiveTradeLanes = !bookWideDisabled && tradeLanes
    if (!leaderboard && !newVsExisting && !effectiveTopAccounts && !effectiveTradeLanes) {
      toast.error('Select at least one section')
      return
    }
    setGenerating(true)
    try {
      await onGenerate({
        period,
        sections: {
          leaderboard,
          newVsExisting,
          topAccounts: effectiveTopAccounts,
          tradeLanes: effectiveTradeLanes,
        },
        repScope,
        preparedFor: preparedFor.trim(),
        accountLimit,
      })
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
              <CheckRow
                label="Top accounts"
                checked={topAccounts}
                disabled={bookWideDisabled}
                onChange={setTopAccounts}
                hint="Book-wide — available for All reps"
              />
              <CheckRow
                label="Trade lanes"
                checked={tradeLanes}
                disabled={bookWideDisabled}
                onChange={setTradeLanes}
                hint="Book-wide — available for All reps"
              />
            </div>
          </div>

          {topAccounts && !bookWideDisabled ? (
            <div>
              <label style={fieldLabel} htmlFor="sales-export-account-limit">Account limit</label>
              <select
                id="sales-export-account-limit"
                className="input"
                value={String(accountLimit)}
                onChange={(e) => {
                  const v = e.target.value
                  setAccountLimit(v === 'all' ? 'all' : Number(v) as AccountLimit)
                }}
                style={{ width: '100%' }}
              >
                {ACCOUNT_LIMITS.map((o) => (
                  <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                ))}
              </select>
            </div>
          ) : null}

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
