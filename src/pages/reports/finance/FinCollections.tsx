import { useMemo, useState } from 'react'
import Pagination from '@/components/Pagination'
import { C, Card, KpiRail, NAVY, ORANGE, Seg, Th, Td } from '../reportsUi'
import { fetchQueue, type QueueRow } from './financeApi'
import { KIND_LABEL, STAGE_LABEL, type Stage } from './collectionsTemplates'
import { compact, money } from './financeUtil'
import { ErrorBox, Loading, Pill, Toggle, useAsync } from './finUi'
import FinCollectionDetail from './FinCollectionDetail'

const PAGE = 20
const STAGE_TONE: Record<Stage, string> = { friendly: 'info', firm: 'warn', final: 'bad' }
const ago = (d: string | null) => {
  if (!d) return null
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  return days <= 0 ? 'today' : `${days}d ago`
}

export default function FinCollections() {
  const [tick, setTick] = useState(0)
  const q = useAsync(fetchQueue, [tick])
  const [stage, setStage] = useState<'all' | Stage>('all')
  const [hideRelated, setHideRelated] = useState(true)
  const [onlyUntouched, setOnlyUntouched] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<QueueRow | null>(null)

  const v = useMemo(() => {
    const all = q.data ?? []
    const base = all.filter((r) => !hideRelated || !r.is_related)
    const rows = base
      .filter((r) => stage === 'all' || r.stage === stage)
      .filter((r) => !onlyUntouched || !r.last_at || Date.now() - new Date(r.last_at).getTime() > 14 * 86400000)
      .filter((r) => !search || `${r.accountid} ${r.name ?? ''}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.priority - a.priority)
    const sum = (f: (r: QueueRow) => number) => base.reduce((a, r) => a + f(r), 0)
    return {
      rows, overdue: sum((r) => r.overdue), over60: sum((r) => r.d61_90 + r.d90_plus),
      broken: base.filter((r) => r.promise_broken).length, noEmail: base.filter((r) => !r.email).length,
      untouched: base.filter((r) => !r.last_at).length, related: all.filter((r) => r.is_related).reduce((a, r) => a + r.overdue, 0),
      count: base.length,
    }
  }, [q.data, stage, hideRelated, onlyUntouched, search])

  if (q.loading && !q.data) return <Loading />
  if (q.error) return <ErrorBox msg={q.error} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <KpiRail items={[
        { label: 'Overdue to chase', value: compact(v.overdue), sub: `${v.count} customers`, accent: NAVY },
        { label: 'Over 60 days', value: compact(v.over60), sub: 'final-notice stage', accent: C.red },
        { label: 'Broken promises', value: String(v.broken), sub: 'promised date passed', accent: ORANGE },
        { label: 'Never chased', value: String(v.untouched), sub: 'no action logged', accent: C.faint },
        { label: 'No email on file', value: String(v.noEmail), sub: 'add in Customers', accent: C.faint },
        { label: 'Related companies', value: compact(v.related), sub: hideRelated ? 'hidden from list' : 'shown in list', accent: C.faint },
      ]} />
      <div style={{ display: 'grid', gridTemplateColumns: open ? 'minmax(0, 1.35fr) minmax(360px, 1fr)' : 'minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
        <Card pad={0}>
          <div style={{ padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <Seg options={[{ k: 'all', label: 'All' }, { k: 'final', label: '60+ days' }, { k: 'firm', label: '31-60' }, { k: 'friendly', label: '1-30' }]}
              value={stage} onChange={(k) => { setStage(k as 'all' | Stage); setPage(1) }} />
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <Toggle on={onlyUntouched} onChange={(b) => { setOnlyUntouched(b); setPage(1) }} label="Not chased in 14 days" />
              <Toggle on={hideRelated} onChange={setHideRelated} label="Hide related companies" />
              <input className="input" placeholder="Search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} style={{ width: 160 }} />
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>#</Th><Th>Customer</Th><Th>Stage</Th><Th right>Overdue</Th><Th right>60+</Th><Th right>Oldest</Th><Th right>Pays late</Th><Th>Last action</Th><Th>Promise</Th></tr></thead>
              <tbody>
                {v.rows.slice((page - 1) * PAGE, page * PAGE).map((r, i) => (
                  <tr key={r.accountid} onClick={() => setOpen(r)} style={{ borderTop: `1px solid ${C.line}`, cursor: 'pointer',
                    background: open?.accountid === r.accountid ? '#F4F6FB' : 'transparent' }}>
                    <Td muted>{(page - 1) * PAGE + i + 1}</Td>
                    <Td><span style={{ fontWeight: 600 }}>{r.name ?? r.accountid}</span>
                      <span style={{ color: C.mut, marginLeft: 6, fontSize: 11.5 }}>{r.accountid}{r.email ? '' : ' · no email'}</span></Td>
                    <Td><Pill tone={STAGE_TONE[r.stage]}>{STAGE_LABEL[r.stage]}</Pill></Td>
                    <Td right strong>{money(r.overdue)}</Td>
                    <Td right>{r.d61_90 + r.d90_plus ? money(r.d61_90 + r.d90_plus) : '–'}</Td>
                    <Td right>{r.oldest_days}d</Td>
                    <Td right muted>{r.avg_days_late != null ? `${r.avg_days_late}d` : '–'}</Td>
                    <Td muted>{r.last_kind ? `${KIND_LABEL[r.last_kind] ?? r.last_kind} ${ago(r.last_at)}` : 'Never'}</Td>
                    <Td>{r.promise_date ? <span style={{ color: r.promise_broken ? C.red : C.ink }}>{r.promise_date}{r.promise_broken ? ' missed' : ''}</span> : '–'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '8px 16px 14px' }}><Pagination page={page} total={v.rows.length} pageSize={PAGE} onPageChange={setPage} /></div>
        </Card>
        {open && <FinCollectionDetail key={open.accountid} row={open} onClose={() => setOpen(null)} onChanged={() => setTick((t) => t + 1)} />}
      </div>
      <div style={{ fontSize: 11.5, color: C.mut }}>
        Ranked by overdue dollars weighted by age (60+ days counts three times as much as 1-30), boosted when a promise to pay was missed.
        Balances refresh with each finance sync; history and promises are saved instantly.
      </div>
    </div>
  )
}
