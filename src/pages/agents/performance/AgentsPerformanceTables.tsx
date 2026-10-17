import { useState } from 'react'
import { fmtMoney } from '../agentStatsApi'
import { CompanyFlag } from '../../../features/company/CompanySplit'
import { fmtDay, type AgentsPerformance, type AgingBucket, type AgingRow, type ReciprocalRow } from './agentsPerformanceApi'

export function NetPills({ codes }: { codes: string[] }) {
  return <>{codes.map((c) => <span key={c} className="mr-1 inline-flex h-[18px] items-center rounded-full bg-[#EEF1F8] px-2 text-[10.5px] font-medium tracking-[0.02em] text-[#0A2472]">{c}</span>)}</>
}

/** Bar: free hand received (navy) vs nominations given (orange). */
export function Balance({ fh, nom }: { fh: number; nom: number }) {
  const t = fh + nom
  if (!t) return <span className="text-[#5B6474]">–</span>
  const p = Math.round((fh / t) * 100)
  return (
    <span className="inline-flex items-center gap-2" title={`${fh} free hand received, ${nom} nominated by us`}>
      <span className="flex h-2 w-24 overflow-hidden rounded-full bg-[#F1F3F7]"><span style={{ width: `${p}%`, background: '#0A2472' }} /><span style={{ width: `${100 - p}%`, background: '#F79009' }} /></span>
      <span className="text-[11.5px] tabular-nums text-[#5B6474]">{p}:{100 - p}</span>
    </span>
  )
}

export function ReciprocalTable({ rows, months, onOpen }: { rows: ReciprocalRow[] | null; months: number; onOpen: (id: string, name: string) => void }) {
  return (
    <section className="cp-card">
      <div className="cp-card-head">
        <h3 className="cp-card-title">Reciprocal business</h3>
        <span className="flex items-center gap-3 text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#0A2472]" />Free hand to us</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#F79009]" />Our nominations</span>
        </span>
      </div>
      <div className="table-wrap">
        <table className="data-table" style={{ minWidth: 980 }}>
          <thead><tr>
            <th>Agent</th><th style={{ textAlign: 'right' }}>Free hand</th><th style={{ textAlign: 'right' }}>Free hand GP</th>
            <th style={{ textAlign: 'right' }}>Nominations</th><th style={{ textAlign: 'right' }}>Nomination GP</th><th>Give vs receive</th>
            <th style={{ textAlign: 'right' }}>Quotes</th><th style={{ textAlign: 'right' }}>Last activity</th>
          </tr></thead>
          <tbody>
            {!rows ? <tr><td colSpan={8} className="text-muted-foreground pad-inline">Loading…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={8} className="text-muted-foreground pad-inline">No agent both gave and received jobs in the last {months} month{months > 1 ? 's' : ''}.</td></tr>
              : rows.map((r) => (
                <tr key={r.id} className="row-clickable" onClick={() => onOpen(r.id, r.name)} title="Show jobs">
                  <td><div>{r.name}</div><div className="mt-0.5"><NetPills codes={r.networks} />{r.country && <span className="text-[11px] text-[#5B6474]">{r.country}</span>}
                    {(r.companies?.length ?? 0) > 1 && <span className="ml-2 inline-flex gap-1 align-middle" title={`Active in ${r.companies!.join(', ')}`}>{r.companies!.map((c) => <CompanyFlag key={c} code={c} size={10} />)}</span>}</div></td>
                  <td style={{ textAlign: 'right' }}>{r.fh}</td><td style={{ textAlign: 'right' }}>{fmtMoney(r.fh_gp)}</td>
                  <td style={{ textAlign: 'right' }}>{r.nom}</td><td style={{ textAlign: 'right' }}>{fmtMoney(r.nom_gp)}</td>
                  <td><Balance fh={r.fh} nom={r.nom} /></td>
                  <td style={{ textAlign: 'right' }}>{r.quotes ? `${r.quotes}${r.won ? ` · ${r.won} won` : ''}` : '–'}</td>
                  <td style={{ textAlign: 'right' }}>{fmtDay(r.last_any)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const BUCKET: Record<AgingBucket, { label: string; tip: string; bg: string; fg: string }> = {
  slipping: { label: 'Slipping', tip: 'Still active but jobs in the last 12 months are under half of the 12 before', bg: '#FFFAEB', fg: '#B54708' },
  cooling: { label: 'Cooling', tip: 'No job or quote for 90 to 180 days', bg: '#FFF6ED', fg: '#C4320A' },
  dormant: { label: 'Dormant', tip: 'No job or quote for 180 to 365 days', bg: '#FEF3F2', fg: '#B42318' },
  inactive: { label: 'Inactive', tip: 'Nothing for over a year', bg: '#F1F3F7', fg: '#475467' },
  never: { label: 'Never traded', tip: 'No jobs or quotes on record', bg: '#F1F3F7', fg: '#475467' },
}

export function AgingTable({ rows, buckets, onOpen }: { rows: AgingRow[] | null; buckets: AgentsPerformance['buckets'] | null; onOpen: (id: string, name: string) => void }) {
  const [f, setF] = useState<AgingBucket | 'all'>('all')
  const shown = (rows ?? []).filter((r) => f === 'all' || r.bucket === f)
  const keys: AgingBucket[] = ['slipping', 'cooling', 'dormant', 'inactive']
  return (
    <section className="cp-card">
      <div className="cp-card-head">
        <h3 className="cp-card-title">Aging agents</h3>
        <span className="text-muted-foreground">Agents we used to trade with that have gone quiet. Not tied to the period.</span>
      </div>
      <div className="flex flex-wrap gap-2 px-[18px] pb-3">
        <button type="button" onClick={() => setF('all')} className={`rounded-full border px-3 py-1 text-[12px] ${f === 'all' ? 'border-[#0A2472] bg-[#0A2472] text-white' : 'border-[#E6E8EE] text-[#334155]'}`}>All {rows?.length ?? ''}</button>
        {keys.map((k) => (
          <button key={k} type="button" title={BUCKET[k].tip} onClick={() => setF(k)}
            className={`rounded-full border px-3 py-1 text-[12px] ${f === k ? 'border-[#0A2472] bg-[#0A2472] text-white' : 'border-[#E6E8EE] text-[#334155]'}`}>
            {BUCKET[k].label} {buckets ? buckets[k] : ''}
          </button>
        ))}
        {buckets && <span className="self-center text-[11.5px] text-[#5B6474]">{buckets.active} active in the last 90 days · {buckets.never} never traded</span>}
      </div>
      <div className="table-wrap">
        <table className="data-table" style={{ minWidth: 1000 }}>
          <thead><tr>
            <th>Agent</th><th>Status</th><th style={{ textAlign: 'right' }}>Last free hand</th><th style={{ textAlign: 'right' }}>Last nomination</th>
            <th style={{ textAlign: 'right' }}>Last quote</th><th style={{ textAlign: 'right' }}>Days quiet</th><th style={{ textAlign: 'right' }}>Jobs, last 12m</th><th style={{ textAlign: 'right' }}>Jobs, 12m before</th>
          </tr></thead>
          <tbody>
            {!rows ? <tr><td colSpan={8} className="text-muted-foreground pad-inline">Loading…</td></tr>
              : shown.length === 0 ? <tr><td colSpan={8} className="text-muted-foreground pad-inline">None.</td></tr>
              : shown.map((r) => (
                <tr key={r.id} className="row-clickable" onClick={() => onOpen(r.id, r.name)} title="Show jobs">
                  <td><div>{r.name}</div><div className="mt-0.5"><NetPills codes={r.networks} /></div></td>
                  <td><span className="inline-flex rounded-full px-2.5 py-[3px] text-[11.5px]" style={{ background: BUCKET[r.bucket].bg, color: BUCKET[r.bucket].fg }} title={BUCKET[r.bucket].tip}>{BUCKET[r.bucket].label}</span></td>
                  <td style={{ textAlign: 'right' }}>{fmtDay(r.last_fh)}</td>
                  <td style={{ textAlign: 'right' }}>{fmtDay(r.last_nom)}</td>
                  <td style={{ textAlign: 'right' }}>{fmtDay(r.last_quote)}</td>
                  <td style={{ textAlign: 'right', color: (r.days_idle ?? 0) > 180 ? '#B42318' : undefined }}>{r.days_idle ?? '–'}</td>
                  <td style={{ textAlign: 'right' }}>{r.jobs_12m}</td>
                  <td style={{ textAlign: 'right', color: '#5B6474' }}>{r.prior_jobs}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
