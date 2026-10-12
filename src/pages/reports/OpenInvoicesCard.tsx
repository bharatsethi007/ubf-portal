import { useEffect, useState } from 'react'
import Pagination from '@/components/Pagination'
import { BLUE, ORANGE, C, cf, nf, Card, Th, Td } from './reportsUi'

export type OpenInv = {
  invoice_no: string; doctype: string; account_id: string; customer_name: string | null
  doc_date: string; date_due: string; days_overdue: number; balance: number
}

const PAGE_SIZE = 12
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOC: Record<string, string> = { FRT: 'Freight', FIN: 'Final', DIS: 'Disb' }
const num = (v: unknown) => Number(v || 0)

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '-'
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y.slice(2)}`
}

function DocChip({ code }: { code: string }) {
  return (
    <span style={{
      display: 'inline-block', marginLeft: 8, padding: '1px 6px', borderRadius: 5,
      background: C.chip, color: C.ink2, fontSize: 10.5, fontWeight: 500, verticalAlign: 1,
    }}>{DOC[code] || code}</span>
  )
}

function OverduePill({ days }: { days: number }) {
  const [fg, bg] = days <= 0 ? [C.green, '#E6F6EE']
    : days <= 30 ? [BLUE, '#EAF0FD']
    : days <= 60 ? [ORANGE, '#FEF2E3']
    : days <= 90 ? ['#C55F08', '#FDEBDD']
    : [C.red, '#FCE8EC']
  return (
    <span style={{ display: 'inline-block', minWidth: 44, textAlign: 'center', padding: '2px 7px', borderRadius: 99, background: bg, color: fg, fontSize: 11.5, fontWeight: 600 }}>
      {days <= 0 ? 'Current' : `${days}d`}
    </span>
  )
}

export default function OpenInvoicesCard({ rows, showCustomer }: { rows: OpenInv[]; showCustomer: boolean }) {
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [rows])
  const slice = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const total = rows.reduce((s, r) => s + num(r.balance), 0)
  const cols = showCustomer ? 5 : 4

  return (
    <Card pad={0}>
      <div style={{ padding: '16px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Open invoices</span>
        <span style={{ fontSize: 12, color: C.mut }}>{nf.format(rows.length)} · {cf.format(total)} · worst first</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: 128 }} />
          {showCustomer ? <col /> : null}
          <col style={{ width: 86 }} />
          <col style={{ width: 84 }} />
          <col style={{ width: 96 }} />
        </colgroup>
        <thead>
          <tr><Th>Invoice</Th>{showCustomer ? <Th>Customer</Th> : null}<Th>Due</Th><Th right>Overdue</Th><Th right>Balance</Th></tr>
        </thead>
        <tbody>
          {slice.map((r) => (
            <tr key={`${r.invoice_no}-${r.doctype}`} style={{ borderTop: `1px solid ${C.line}` }}>
              <Td strong title={`${r.invoice_no} ${DOC[r.doctype] || r.doctype}`}>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.invoice_no}</span><DocChip code={r.doctype} />
              </Td>
              {showCustomer ? <Td trunc title={r.customer_name || r.account_id}>{r.customer_name || r.account_id}</Td> : null}
              <Td muted title={r.date_due}>{fmtDate(r.date_due)}</Td>
              <Td right><OverduePill days={num(r.days_overdue)} /></Td>
              <Td right strong>{cf.format(num(r.balance))}</Td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={cols} style={{ padding: '24px 12px', textAlign: 'center', color: C.mut, fontSize: 12.5 }}>Nothing outstanding.</td></tr>
          )}
        </tbody>
      </table>
      <div style={{ padding: '10px 14px' }}><Pagination page={page} total={rows.length} pageSize={PAGE_SIZE} onPageChange={setPage} /></div>
    </Card>
  )
}
