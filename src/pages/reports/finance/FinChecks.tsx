import { C, Card, Title } from '../reportsUi'
import { fetchFlags, fetchSync } from './financeApi'
import { compact } from './financeUtil'
import { ErrorBox, Loading, Pill, useAsync } from './finUi'

const RANK: Record<string, number> = { high: 0, medium: 1, low: 2 }

export default function FinChecks() {
  const q = useAsync(() => Promise.all([fetchFlags(), fetchSync()]), [])
  if (q.loading) return <Loading />
  if (q.error) return <ErrorBox msg={q.error} />
  const [flags, sync] = q.data!
  const sorted = [...flags].sort((a, b) => RANK[a.severity] - RANK[b.severity])
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 14 }}>
      <Card>
        <Title>Ledger health checks</Title>
        {!sorted.length && <div style={{ fontSize: 13, color: C.mut }}>No issues found.</div>}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {sorted.map((f) => (
            <div key={f.code} style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: `1px solid ${C.line}` }}>
              <div style={{ width: 64 }}><Pill tone={f.severity}>{f.severity}</Pill></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{f.title}</div>
                <div style={{ fontSize: 12.5, color: C.ink2, marginTop: 3, lineHeight: 1.5 }}>{f.detail}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {f.amount != null ? compact(f.amount) : ''}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <Title>Data feed</Title>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <tbody>
            {[...sync].sort((a, b) => a.table_name.localeCompare(b.table_name)).map((s) => (
              <tr key={s.table_name} style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={{ padding: '6px 4px' }}>{s.table_name}</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.rows.toLocaleString('en-NZ')}</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', color: C.mut }}>{new Date(s.synced_at).toLocaleDateString('en-NZ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 11.5, color: C.mut, marginTop: 10, lineHeight: 1.5 }}>
          Refresh: run sync_finance.py against the latest UBNZ.FDB copy. Detail kept from 1 Apr 2025; open invoices kept regardless of date.
        </div>
      </Card>
    </div>
  )
}
