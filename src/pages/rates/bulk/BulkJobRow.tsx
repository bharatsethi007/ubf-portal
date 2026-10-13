import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, X } from 'lucide-react'
import AirlineSelect from '@/components/bookings/AirlineSelect'
import type { BulkJob, BulkKind } from './bulkImport'

type Opt = { code: string; name: string }
type Props = {
  job: BulkJob
  lines: Opt[]
  coLoaders: Opt[]
  currencies: { code: string }[]
  locked: boolean
  onChange: (p: Partial<BulkJob>) => void
  onRemove: () => void
  onRetry: () => void
}

const KIND_LABEL: Record<BulkKind, string> = { fcl: 'Sea FCL', lcl: 'Sea LCL', air: 'Air' }
const sel = { width: 'auto', maxWidth: 220 } as const

/** FCL: tick which sheets to read. Hidden sheets are listed last and unticked by default. */
function SheetPicks({ job, editable, onChange }: { job: BulkJob; editable: boolean; onChange: (p: Partial<BulkJob>) => void }) {
  const ordered = [...job.sheets].sort((a, b) => Number(!!a.hidden) - Number(!!b.hidden))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4, maxHeight: 132, overflowY: 'auto' }}>
      {ordered.map((s) => (
        <label key={s.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: s.hidden ? 'var(--muted-foreground)' : undefined }}>
          <input type="checkbox" disabled={!editable} checked={job.sheetSel.includes(s.name)}
            onChange={(e) => onChange({ sheetSel: e.target.checked ? [...job.sheetSel, s.name] : job.sheetSel.filter((n) => n !== s.name) })} />
          {s.name}{s.hidden ? ' (hidden)' : ''}
        </label>
      ))}
    </div>
  )
}

/** One file in the bulk queue: settings while ready, progress and result after. */
export default function BulkJobRow({ job, lines, coLoaders, currencies, locked, onChange, onRemove, onRetry }: Props) {
  const editable = !locked && (job.status === 'ready' || job.status === 'failed')
  const carrierOpts = job.kind === 'fcl' ? lines : coLoaders

  return (
    <tr>
      <td style={{ minWidth: 200 }}>
        <div style={{ fontWeight: 600, fontSize: 13, wordBreak: 'break-word' }}>{job.file}</div>
        {job.kind === 'fcl' ? (
          <SheetPicks job={job} editable={editable} onChange={onChange} />
        ) : job.sheets.length > 1 ? (
          <select className="input input--xs" style={{ ...sel, marginTop: 4 }} value={job.sheet} disabled={!editable} onChange={(e) => onChange({ sheet: e.target.value })} aria-label="Sheet">
            {job.sheets.filter((s) => !s.hidden).map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        ) : <div className="text-muted-foreground" style={{ fontSize: 12 }}>{job.sheet}</div>}
      </td>
      <td>
        <select className="input input--sm" style={sel} value={job.kind} disabled={!editable} aria-label="Type"
          onChange={(e) => onChange({ kind: e.target.value as BulkKind, carrier: '', carrierName: '' })}>
          {(Object.keys(KIND_LABEL) as BulkKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
      </td>
      <td style={{ minWidth: 180 }}>
        {job.kind === 'air' ? (
          editable ? <AirlineSelect value={job.carrier} onChange={(code, name) => onChange({ carrier: code, carrierName: name ?? '' })} />
            : <span>{job.carrierName || job.carrier}</span>
        ) : (
          <select className="input input--sm" style={{ ...sel, borderColor: job.carrier || job.kind === 'fcl' ? undefined : '#f59e0b' }} value={job.carrier} disabled={!editable} aria-label="Carrier"
            onChange={(e) => onChange({ carrier: e.target.value, carrierName: carrierOpts.find((o) => o.code === e.target.value)?.name ?? '' })}>
            <option value="">{job.kind === 'fcl' ? 'Auto from sheet' : 'Co-loader'}</option>
            {carrierOpts.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
          </select>
        )}
      </td>
      <td>
        <select className="input input--sm" style={sel} value={job.currency} disabled={!editable} onChange={(e) => onChange({ currency: e.target.value })} aria-label="Currency">
          {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
        </select>
      </td>
      <td>
        {job.kind === 'fcl' ? (
          <select className="input input--sm" style={sel} value={job.sellRates ? 'sell' : 'buy'} disabled={!editable} onChange={(e) => onChange({ sellRates: e.target.value === 'sell' })} aria-label="Rates are">
            <option value="buy">Buy</option><option value="sell">Sell</option>
          </select>
        ) : <span className="text-muted-foreground">Buy</span>}
      </td>
      <td>
        <input className="input input--sm" style={{ minWidth: 200 }} value={job.title} disabled={!editable} onChange={(e) => onChange({ title: e.target.value })} aria-label="Card title" />
      </td>
      <td style={{ minWidth: 220, fontSize: 13 }}>
        {job.status === 'ready' && <span className="text-muted-foreground">Ready</span>}
        {job.status === 'working' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Loader2 size={14} className="animate-spin" />{job.step}</span>}
        {job.status === 'done' && (
          <div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#15803d', fontWeight: 600 }}><CheckCircle2 size={14} />{job.saved} lines saved</span>
            <div className="text-muted-foreground" style={{ fontSize: 12 }}>
              {job.flagged ? `${job.flagged} to check · ` : ''}{job.skipped ? `${job.skipped} skipped · ` : ''}
              {!job.cards && job.cardId && <Link to={`/setup/rates/${job.kind}/${job.cardId}`}>Review draft</Link>}
            </div>
            {job.cards?.map((c) => (
              <div key={c.id} style={{ fontSize: 12 }}>
                <Link to={`/setup/rates/fcl/${c.id}`}>{c.carrier || 'Card'}</Link>
                <span className="text-muted-foreground"> · {c.lines} lines{c.surcharges ? ` · ${c.surcharges} surcharges` : ''}{c.flagged ? ` · ${c.flagged} to check` : ''}</span>
              </div>
            ))}
            {!!job.localSheets && <div style={{ fontSize: 12 }}><Link to="/setup/rates/fcl-local">{job.localSheets} local charge sheet{job.localSheets > 1 ? 's' : ''}</Link></div>}
            {!!job.warnings?.length && <div style={{ fontSize: 12, color: '#b45309' }} title={job.warnings.join('\n')}>{job.warnings.length} chunk{job.warnings.length > 1 ? 's' : ''} failed, hover for detail</div>}
          </div>
        )}
        {job.status === 'failed' && (
          <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 6, color: '#b42318' }} title={job.error}>
            <AlertTriangle size={14} style={{ flex: 'none', marginTop: 2 }} />{job.error}
          </span>
        )}
      </td>
      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
        {job.status === 'failed' && !locked && (
          <button type="button" className="btn btn--icon" onClick={onRetry} aria-label="Retry" title="Retry"><RotateCcw size={14} /></button>
        )}
        {job.status !== 'working' && job.status !== 'done' && !locked && (
          <button type="button" className="btn btn--icon btn--danger" style={{ marginLeft: 6 }} onClick={onRemove} aria-label="Remove file" title="Remove file"><X size={14} /></button>
        )}
      </td>
    </tr>
  )
}
