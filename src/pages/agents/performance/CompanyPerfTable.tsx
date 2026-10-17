import { fmtMoney } from '../agentStatsApi'
import { CompanyFlag } from '../../../features/company/CompanySplit'
import { pctOf, type CompanyPerf } from './agentsPerformanceApi'

/** Agents performance by company (NZ / FJ / AU). Only shown when more than one company has activity. */
export default function CompanyPerfTable({ rows, months }: { rows: CompanyPerf[] | undefined; months: number }) {
  if (!rows || rows.length < 2) return null
  const r = (v: number | null | undefined) => (v ? v.toLocaleString('en-NZ') : '–')
  return (
    <section className="cp-card">
      <div className="cp-card-head">
        <h3 className="cp-card-title">By company</h3>
        <span className="text-muted-foreground">Last {months} month{months > 1 ? 's' : ''}. GP in each company's currency.</span>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr>
            <th>Company</th><th style={{ textAlign: 'right' }}>Active agents</th>
            <th style={{ textAlign: 'right' }}>Free hand</th><th style={{ textAlign: 'right' }}>Free hand GP</th>
            <th style={{ textAlign: 'right' }}>Nominations</th><th style={{ textAlign: 'right' }}>Nomination GP</th>
            <th style={{ textAlign: 'right' }}>Quotes</th><th style={{ textAlign: 'right' }}>Conversion</th>
          </tr></thead>
          <tbody>
            {rows.map((c) => {
              const conv = pctOf(c.won, c.quotes)
              return (
                <tr key={c.company}>
                  <td><span className="inline-flex items-center gap-2"><CompanyFlag code={c.company} size={12} />{c.company}</span></td>
                  <td style={{ textAlign: 'right' }}>{r(c.agents)}</td>
                  <td style={{ textAlign: 'right' }}>{r(c.fh)}</td>
                  <td style={{ textAlign: 'right' }}>{c.fh ? fmtMoney(c.fh_gp) : '–'}</td>
                  <td style={{ textAlign: 'right' }}>{r(c.nom)}</td>
                  <td style={{ textAlign: 'right' }}>{c.nom ? fmtMoney(c.nom_gp) : '–'}</td>
                  <td style={{ textAlign: 'right' }}>{r(c.quotes)}</td>
                  <td style={{ textAlign: 'right' }}>{conv == null ? '–' : `${conv}%`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
