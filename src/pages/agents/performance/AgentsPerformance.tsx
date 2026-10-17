import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { fmtMoney } from '../agentStatsApi'
import { AgingTable, Balance, NetPills, ReciprocalTable } from './AgentsPerformanceTables'
import AgentJobsDialog, { type JobsFilter } from './AgentJobsDialog'
import CompanyPerfTable from './CompanyPerfTable'
import CompanySplit from '../../../features/company/CompanySplit'
import { change, fetchAgentsPerformance, pctOf, type AgentsPerformance as Perf } from './agentsPerformanceApi'

const PERIODS = [1, 3, 6, 12]
const tile = 'flex min-w-0 flex-col gap-0.5 rounded-[10px] border border-[#E6E8EE] bg-white px-4 py-3'
const lbl = 'text-[11.5px] text-[#5B6474]'
const val = 'text-[22px] leading-7 tracking-[-0.01em] text-[#0F172A]'

function Delta({ now, prior, months }: { now: number; prior: number; months: number }) {
  const c = change(now, prior)
  if (c == null) return <span className={lbl}>No prior {months}m to compare</span>
  return <span className={lbl}><span style={{ color: c >= 0 ? '#067647' : '#B42318' }}>{c >= 0 ? '+' : ''}{c}%</span> vs prior {months}m</span>
}

/** Agents > Performance: network groups, quote conversion, free hand vs nominations, reciprocal and aging agents. */
export default function AgentsPerformance() {
  const [months, setMonths] = useState(3)
  const [d, setD] = useState<Perf | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<JobsFilter | null>(null)
  const [rev, setRev] = useState(0)

  useEffect(() => {
    let off = false
    setLoading(true)
    fetchAgentsPerformance(months).then((r) => { if (!off) setD(r) })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not load'))
      .finally(() => { if (!off) setLoading(false) })
    return () => { off = true }
  }, [months, rev])

  const k = d?.kpis
  const conv = k ? pctOf(k.won, k.quotes) : null
  const aging = d ? d.buckets.cooling + d.buckets.dormant + d.buckets.slipping : 0
  const split = (key: 'fh' | 'nom' | 'quotes') => d?.by_company?.map((c) => ({ company: c.company, value: c[key] }))

  return (
    <div className="flex flex-col gap-4" style={{ opacity: loading && d ? 0.6 : 1 }}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="customers-segment" role="group" aria-label="Period">
          {PERIODS.map((m) => (
            <button key={m} type="button" onClick={() => setMonths(m)} className={`customers-segment__btn${months === m ? ' customers-segment__btn--on' : ''}`}>{m}m</button>
          ))}
        </div>
        <button type="button" className="btn btn--inline" onClick={() => setJobs({ months, cls: 'freehand' })}>Free hand jobs</button>
        <span className={lbl}>{d ? `Since ${new Date(`${d.since}T00:00:00`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}. Free hand and nomination come from what we billed. Click any row to see the jobs.` : 'Loading…'}</span>
      </div>

      {k && (k.exceptions ?? 0) > 0 && (
        <button type="button" onClick={() => setJobs({ months, cls: 'exception' })}
          className="flex w-full items-center gap-3 rounded-[10px] border border-[#FECDCA] bg-[#FEF3F2] px-4 py-2.5 text-left text-[12.5px] text-[#B42318]">
          <b className="font-medium">{k.exceptions} job{(k.exceptions ?? 0) > 1 ? 's' : ''} to check.</b>
          <span>The billing rule could not tell if they are free hand or nomination. Review and mark them.</span>
          <span className="ml-auto underline">Review</span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className={tile}><span className={lbl}>Agent quotes</span><span className={val}>{k?.quotes ?? '–'}</span>{k && <Delta now={k.quotes} prior={k.quotes_prior} months={months} />}<CompanySplit data={split('quotes')} label="quotes" /></div>
        <div className={tile} title="Won out of all agent quotes"><span className={lbl}>Quote conversion</span><span className={val}>{conv == null ? '–' : `${conv}%`}</span><span className={lbl}>{k ? `${k.won} won · ${k.quoting_agents} agents quoting` : ''}</span></div>
        <button type="button" onClick={() => setJobs({ months, cls: 'freehand' })} className={`${tile} text-left hover:border-[#C7D0E6]`}><span className={lbl}>Free hand from agents</span><span className={val}>{k?.freehand ?? '–'} <span className="text-[13px] text-[#5B6474]">jobs</span></span>{k && <Delta now={k.freehand} prior={k.freehand_prior} months={months} />}<span className={lbl}>{k ? `${fmtMoney(k.freehand_gp)} GP · ${k.freehand_agents} agents` : ''}</span><CompanySplit data={split('fh')} label="free hand jobs" /></button>
        <button type="button" onClick={() => setJobs({ months, cls: 'nomination' })} className={`${tile} text-left hover:border-[#C7D0E6]`}><span className={lbl}>Our nominations</span><span className={val}>{k?.nominations ?? '–'} <span className="text-[13px] text-[#5B6474]">jobs</span></span>{k && <Delta now={k.nominations} prior={k.nominations_prior} months={months} />}<span className={lbl}>{k ? `${fmtMoney(k.nominations_gp)} GP · ${k.nomination_agents} agents` : ''}</span><CompanySplit data={split('nom')} label="nominations" /></button>
        <div className={tile} title="Agents who gave us free hand and got nominations from us in the period"><span className={lbl}>Reciprocal agents</span><span className={val} style={{ color: '#067647' }}>{k?.reciprocal_agents ?? '–'}</span><span className={lbl}>{d ? `${d.one_way.freehand_only} give only · ${d.one_way.nomination_only} receive only` : ''}</span></div>
        <div className={tile} title="Slipping, cooling (90 to 180 days) and dormant (180 to 365 days)"><span className={lbl}>Aging agents</span><span className={val} style={{ color: aging ? '#C4320A' : undefined }}>{d ? aging : '–'}</span><span className={lbl}>{d ? `${d.buckets.slipping} slipping · ${d.buckets.dormant} dormant` : ''}</span></div>
      </div>

      <CompanyPerfTable rows={d?.by_company} months={months} />

      <section className="cp-card">
        <div className="cp-card-head"><h3 className="cp-card-title">Network groups</h3><span className="text-muted-foreground">Last {months} month{months > 1 ? 's' : ''}. Agents in two networks count in both.</span></div>
        <div className="table-wrap">
          <table className="data-table" style={{ minWidth: 1100 }}>
            <thead><tr>
              <th>Network</th><th style={{ textAlign: 'right' }}>Agents</th><th style={{ textAlign: 'right' }}>Quotes</th><th style={{ textAlign: 'right' }}>Won</th><th>Conversion</th>
              <th style={{ textAlign: 'right' }}>Free hand</th><th style={{ textAlign: 'right' }}>Free hand GP</th><th style={{ textAlign: 'right' }}>Nominations</th><th style={{ textAlign: 'right' }}>Nomination GP</th>
              <th>Give vs receive</th><th style={{ textAlign: 'right' }}>Reciprocal</th><th style={{ textAlign: 'right' }}>Jobs vs prior</th>
            </tr></thead>
            <tbody>
              {!d ? <tr><td colSpan={12} className="text-muted-foreground pad-inline">Loading…</td></tr> : d.networks.map((n) => {
                const c = pctOf(n.won, n.quotes)
                const ch = change(n.fh + n.nom, n.fh_prior + n.nom_prior)
                return (
                  <tr key={n.network} className="row-clickable" onClick={() => setJobs({ months, network: n.network })} title="Show jobs">
                    <td>{n.network === 'No network' ? <span className="text-[#5B6474]">No network</span> : <NetPills codes={[n.network]} />}</td>
                    <td style={{ textAlign: 'right' }}>{n.active_agents}<span className="text-[11px] text-[#5B6474]"> / {n.agents}</span></td>
                    <td style={{ textAlign: 'right' }}>{n.quotes || '–'}</td>
                    <td style={{ textAlign: 'right', color: '#067647' }}>{n.won || '–'}</td>
                    <td>{c == null ? '–' : <span className="inline-flex items-center gap-2"><span className="flex h-1.5 w-16 overflow-hidden rounded-full bg-[#F1F3F7]"><span style={{ width: `${c}%`, background: '#0A2472' }} /></span><span className="text-[12px]">{c}%</span></span>}</td>
                    <td style={{ textAlign: 'right' }}>{n.fh || '–'}</td>
                    <td style={{ textAlign: 'right' }}>{n.fh ? fmtMoney(n.fh_gp) : '–'}</td>
                    <td style={{ textAlign: 'right' }}>{n.nom || '–'}</td>
                    <td style={{ textAlign: 'right' }}>{n.nom ? fmtMoney(n.nom_gp) : '–'}</td>
                    <td><Balance fh={n.fh} nom={n.nom} /></td>
                    <td style={{ textAlign: 'right' }}>{n.reciprocal || '–'}</td>
                    <td style={{ textAlign: 'right', color: ch == null ? undefined : ch >= 0 ? '#067647' : '#B42318' }}>{ch == null ? '–' : `${ch >= 0 ? '+' : ''}${ch}%`}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <ReciprocalTable rows={d?.reciprocal ?? null} months={months} onOpen={(id, name) => setJobs({ months, agentId: id, agentName: name })} />
      <AgingTable rows={d?.aging ?? null} buckets={d?.buckets ?? null} onOpen={(id, name) => setJobs({ months: 24, agentId: id, agentName: name })} />
      {jobs && <AgentJobsDialog open initial={jobs} onClose={() => setJobs(null)} onChanged={() => setRev((r) => r + 1)} />}
    </div>
  )
}
