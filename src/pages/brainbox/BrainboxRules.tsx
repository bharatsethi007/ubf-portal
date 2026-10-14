import { useCallback, useEffect, useState } from 'react'
import { Check, X, Archive } from 'lucide-react'
import { toast } from 'sonner'
import { usePerm } from '../../access/PermissionsProvider'
import { decideRule, fetchRules, type BrainboxRule } from './brainboxApi'
import { money } from './sourceMeta'

type Props = { onChanged: () => void }

function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
}

/** Suggested rules wait here for Bharat or a Pricing Lead; active rules are what the system follows. */
export default function BrainboxRules({ onChanged }: Props) {
  const canApprove = usePerm('brainbox', 'edit')
  const [rules, setRules] = useState<BrainboxRule[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(() => {
    fetchRules(['suggested', 'active']).then(setRules).catch(() => setRules([]))
  }, [])
  useEffect(load, [load])

  const decide = async (r: BrainboxRule, d: 'active' | 'rejected' | 'retired') => {
    setBusy(r.id)
    try {
      await decideRule(r.id, d)
      toast.success(d === 'active' ? 'Rule is live' : d === 'rejected' ? 'Rule rejected, it will not be suggested again' : 'Rule retired')
      load(); onChanged()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not update rule') } finally { setBusy(null) }
  }

  const suggested = (rules ?? []).filter((r) => r.status === 'suggested')
  const active = (rules ?? []).filter((r) => r.status === 'active')

  const row = (r: BrainboxRule) => {
    const ev = r.evidence
    return (
      <tr key={r.id}>
        <td>
          <div>{r.prose}</div>
          <div className="text-[11px] text-[#8A93A5]">{r.action.charge_code ?? ''} · {r.origin === 'learned' ? 'learned from quotes' : 'written by staff'} · {when(r.status === 'active' ? r.decided_at : r.created_at)}</div>
        </td>
        <td className="text-xs text-[#5B6577]">
          {ev?.n_quotes != null ? `${ev.n_quotes} quotes · ${Math.round((ev.mode_share ?? 0) * 100)}% at this price` : ''}
          {ev?.min != null && ev.max != null && ev.min !== ev.max ? ` · range ${money(ev.min)} to ${money(ev.max)}` : ''}
        </td>
        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
          {canApprove && r.status === 'suggested' && (
            <div className="inline-flex gap-1">
              <button type="button" className="btn h-8 px-3 text-xs" disabled={busy === r.id} onClick={() => void decide(r, 'active')}>
                <Check size={13} /> Approve
              </button>
              <button type="button" className="btn h-8 w-8 px-0" aria-label="Reject" title="Reject" disabled={busy === r.id} onClick={() => void decide(r, 'rejected')}>
                <X size={13} className="mx-auto" />
              </button>
            </div>
          )}
          {canApprove && r.status === 'active' && (
            <button type="button" className="btn h-8 w-8 px-0" aria-label="Retire rule" title="Retire" disabled={busy === r.id} onClick={() => void decide(r, 'retired')}>
              <Archive size={13} className="mx-auto" />
            </button>
          )}
          {!canApprove && r.status === 'suggested' && <span className="text-xs text-[#5B6577]">Waiting for approval</span>}
        </td>
      </tr>
    )
  }

  return (
    <>
      <section className="mt-5">
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px' }}>
          To approve <span className="ml-2 text-xs font-normal text-[#5B6577]">Bharat or a Pricing Lead turns these on</span>
        </h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Rule</th><th>Evidence</th><th /></tr></thead>
            <tbody>
              {rules == null && <tr><td colSpan={3} className="text-muted-foreground pad-inline">Loading…</td></tr>}
              {rules != null && suggested.length === 0 && <tr><td colSpan={3} className="text-muted-foreground pad-inline">Nothing waiting. Use Make rule on the Learned tab or on a quote.</td></tr>}
              {suggested.map(row)}
            </tbody>
          </table>
        </div>
      </section>
      <section className="mt-6">
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px' }}>Active</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Rule</th><th>Evidence</th><th /></tr></thead>
            <tbody>
              {rules != null && active.length === 0 && <tr><td colSpan={3} className="text-muted-foreground pad-inline">No active rules yet. The auto-pricer (next step) applies these to new quotes.</td></tr>}
              {active.map(row)}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
