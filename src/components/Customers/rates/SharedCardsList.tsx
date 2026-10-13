import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, X } from 'lucide-react'
import { toast } from 'sonner'
import { listSharedCards, unshareCard, type SharedCard } from './customerRatesApi'

const TYPE: Record<string, string> = { fcl: 'Sea FCL', lcl: 'Sea LCL', air: 'Air' }
const fmt = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: '2-digit' }) : 'open')

/** Rate cards shared privately with this customer. Add more from the card page. */
export default function SharedCardsList({ accountId }: { accountId: string }) {
  const [rows, setRows] = useState<SharedCard[]>([])

  const load = useCallback(async () => {
    try { setRows(await listSharedCards(accountId)) } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not load') }
  }, [accountId])
  useEffect(() => { void load() }, [load])

  async function remove(c: SharedCard) {
    if (!window.confirm(`Stop sharing "${c.title ?? 'this card'}" with this customer?`)) return
    try { await unshareCard(c.id, accountId); void load() } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not update') }
  }

  return (
    <section className="cp-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Lock size={14} /> Private rate cards</h3>
        <span className="text-muted-foreground" style={{ fontSize: 12.5 }}>Share a card from its page under Setup &gt; Rates.</span>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Card</th><th>Type</th><th>Status</th><th>Valid to</th><th>Also shared with</th><th /></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>{TYPE[c.rate_type] ? <Link to={`/setup/rates/${c.rate_type}/${c.id}`}>{c.title ?? 'Untitled card'}</Link> : (c.title ?? 'Untitled card')}</td>
                <td>{TYPE[c.rate_type] ?? c.rate_type}</td>
                <td style={{ textTransform: 'capitalize' }}>{c.status}</td>
                <td>{fmt(c.valid_to)}</td>
                <td>{c.others ? `${c.others} other${c.others > 1 ? 's' : ''}` : <span className="text-muted-foreground">Only them</span>}</td>
                <td style={{ textAlign: 'right' }}>
                  <button type="button" className="btn" onClick={() => void remove(c)} aria-label="Stop sharing" title="Stop sharing"><X size={14} /></button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="text-muted-foreground pad-inline">No private cards. They see public rates only.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}
