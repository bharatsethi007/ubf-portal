import { useEffect, useMemo, useState } from 'react'
import { Download, Send } from 'lucide-react'
import Pagination from '@/components/Pagination'
import { Card, Seg, Th, Td, C } from './reportsUi'
import BrevoExportModal from './marketing/BrevoExportModal'
import {
  fetchMarketingParties, dedupContacts, downloadContactsCsv, partyEmail, partyPhone, partyContactName,
  type MarketingPartyRow, type MktMode, type MktDirection, type MktParty,
} from './marketing/marketingApi'

const PAGE_SIZE = 25
const MODES = [{ k: 'sea', label: 'Sea' }, { k: 'air', label: 'Air' }] as const
const DIRS = [{ k: 'export', label: 'Export' }, { k: 'import', label: 'Import' }] as const
const PERIODS = [{ k: '3', label: '3 mo' }, { k: '6', label: '6 mo' }, { k: '12', label: '12 mo' }] as const

const BTN_BASE: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  height: 36, padding: '0 14px', borderRadius: 8, fontSize: 14, fontWeight: 400,
  boxSizing: 'border-box', lineHeight: 1, whiteSpace: 'nowrap',
}
const BTN_NAVY: React.CSSProperties = { background: '#0A2472', color: '#fff', border: '1px solid #0A2472', cursor: 'pointer' }
const BTN_GREY: React.CSSProperties = { background: '#e5e7eb', color: '#9ca3af', border: '1px solid #e5e7eb', cursor: 'not-allowed' }

function Pill({ value, kind }: { value: string | null; kind: 'email' | 'phone' }) {
  if (!value) return <span style={{ color: C.mut }}>—</span>
  const bg = kind === 'email' ? C.navySoft : C.chip
  const fg = kind === 'email' ? '#0A2472' : C.ink2
  return (
    <span style={{
      display: 'inline-block', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle',
      background: bg, color: fg, borderRadius: 999, padding: '3px 10px', fontSize: 11.5, fontWeight: 500,
    }} title={value}>{value}</span>
  )
}

export default function MarketingTab() {
  const [mode, setMode] = useState<MktMode>('sea')
  const [direction, setDirection] = useState<MktDirection>('export')
  const [months, setMonths] = useState('6')
  const [party, setParty] = useState<MktParty>('customer')
  const [rows, setRows] = useState<MarketingPartyRow[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [showBrevo, setShowBrevo] = useState(false)

  const agentLabel = direction === 'export' ? 'Dest. Agent' : 'Origin Agent'
  const PARTIES = [
    { k: 'customer', label: 'Customer' },
    { k: 'agent', label: agentLabel },
    { k: 'shipper', label: 'Shipper' },
    { k: 'consignee', label: 'Consignee' },
  ] as const

  useEffect(() => {
    let alive = true
    setLoading(true); setErr(null)
    fetchMarketingParties(mode, direction, Number(months))
      .then((d) => { if (alive) { setRows(d); setPage(1) } })
      .catch((e) => { if (alive) setErr(e?.message ?? 'Failed to load') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [mode, direction, months])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter((r) =>
      [r.customer_name, r.shipper_name, r.consignee_name, r.agent_name, r.destination, r.origin, r.house_bill]
        .some((v) => (v ?? '').toLowerCase().includes(s)))
  }, [rows, q])

  const contacts = useMemo(() => dedupContacts(filtered, party), [filtered, party])

  const partyKey = (r: MarketingPartyRow): string => {
    switch (party) {
      case 'customer': return r.customer_account_id || r.customer_name || ''
      case 'agent': return r.os_agent_code || r.agent_name || ''
      case 'shipper': return (r.shipper_name ?? '').trim().toUpperCase()
      case 'consignee': return (r.consignee_name ?? '').trim().toUpperCase()
    }
  }
  const stats = useMemo(() => {
    const m = new Map<string, { hbls: Set<string>; rows: number; last: string | null }>()
    for (const r of filtered) {
      const k = partyKey(r)
      if (!k) continue
      let e = m.get(k)
      if (!e) { e = { hbls: new Set(), rows: 0, last: null }; m.set(k, e) }
      e.rows += 1
      if (r.house_bill) e.hbls.add(r.house_bill)
      if (r.shipment_date && (!e.last || r.shipment_date > e.last)) e.last = r.shipment_date
    }
    return m
  }, [filtered, party])
  const withEmail = useMemo(() => filtered.filter((r) => partyEmail(r, party)).length, [filtered, party])
  const withPhone = useMemo(() => filtered.filter((r) => partyPhone(r, party)).length, [filtered, party])
  const partyLabel = PARTIES.find((p) => p.k === party)?.label ?? ''

  const total = filtered.length
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const csvName = `marketing-${mode}-${direction}-${party}-${new Date().toISOString().slice(0, 10)}.csv`

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button disabled={!contacts.length}
            style={{ ...BTN_BASE, ...(contacts.length ? BTN_NAVY : BTN_GREY) }}
            onClick={() => downloadContactsCsv(contacts, csvName)}>
            <Download size={15} /> Export CSV
          </button>
          <button disabled={!contacts.length}
            style={{ ...BTN_BASE, ...(contacts.length ? BTN_NAVY : BTN_GREY) }}
            onClick={() => setShowBrevo(true)}>
            <Send size={15} /> Export to Brevo
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-3">
        <Seg options={MODES as any} value={mode} onChange={(k) => setMode(k as MktMode)} />
        <Seg options={DIRS as any} value={direction} onChange={(k) => setDirection(k as MktDirection)} />
        <Seg options={PERIODS as any} value={months} onChange={setMonths} />
        <span className="text-muted-foreground pad-inline">Contact:</span>
        <Seg options={PARTIES as any} value={party} onChange={(k) => setParty(k as MktParty)} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-3">
        <input className="input input--sm quotes-page__search" placeholder="Search name, port, HBL…"
          value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        <span className="text-muted-foreground">
          {loading ? 'Loading…' : `${total} shipments · ${withEmail} with ${partyLabel} email · ${withPhone} with phone · ${contacts.length} unique contacts`}
        </span>
      </div>

      {err ? <div className="text-red-600 mt-3">{err}</div> : null}

      <div className="table-wrap mt-3">
        <table className="data-table">
          <thead>
            <tr>
              <Th>Date</Th><Th>HBL</Th><Th>Origin</Th><Th>Dest</Th>
              <Th>Shipper</Th><Th>Consignee</Th><Th>{agentLabel}</Th><Th>Customer</Th>
              <Th>Contact name</Th><Th>Selected email</Th><Th>Selected phone</Th><Th right>Shipments</Th><Th>Last shipment</Th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => {
              const em = partyEmail(r, party)
              const ph = partyPhone(r, party)
              const cn = partyContactName(r, party)
              const st = stats.get(partyKey(r))
              const shipCount = st ? (st.hbls.size || st.rows) : 0
              return (
                <tr key={`${r.house_bill ?? 'x'}-${i}`}>
                  <Td>{r.shipment_date ?? ''}</Td>
                  <Td>{r.house_bill ?? ''}</Td>
                  <Td>{r.origin ?? ''}</Td>
                  <Td>{r.destination ?? ''}</Td>
                  <Td trunc title={r.shipper_name ?? ''}>{r.shipper_name ?? ''}</Td>
                  <Td trunc title={r.consignee_name ?? ''}>{r.consignee_name ?? ''}</Td>
                  <Td trunc title={r.agent_name ?? ''}>{r.agent_name ?? ''}</Td>
                  <Td trunc title={r.customer_name ?? ''}>{r.customer_name ?? ''}</Td>
                  <Td trunc muted={!cn} title={cn ?? ''}>{cn ?? '—'}</Td>
                  <Td><Pill value={em} kind="email" /></Td>
                  <Td><Pill value={ph} kind="phone" /></Td>
                  <Td right>{shipCount || ''}</Td>
                  <Td muted={!st?.last}>{st?.last ?? '—'}</Td>
                </tr>
              )
            })}
            {!loading && !pageRows.length ? (
              <tr><Td>No shipments for this filter.</Td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {showBrevo ? <BrevoExportModal contacts={contacts} onClose={() => setShowBrevo(false)} /> : null}
    </Card>
  )
}
