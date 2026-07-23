import type { Invoice } from '../../../types/invoice'
import { invoiceStatus } from '../../../types/invoice'
import EmptyTab from './EmptyTab'

type Props = { invoices: Invoice[]; matched: boolean }

function money(amount: number | null, currency: string | null): string {
  if (amount == null) return '—'
  return `${currency ?? 'NZD'} ${amount.toLocaleString('en-NZ', { minimumFractionDigits: 2 })}`
}

export default function InvoicesTab({ invoices, matched }: Props) {
  if (!matched) {
    return <EmptyTab title="No shipment linked" hint="Invoices are loaded from the matched ERP job." />
  }
  if (invoices.length === 0) {
    return <EmptyTab title="No invoices" hint="Debtor invoices for this job will show here after sync." />
  }

  return (
    <ul className="space-y-2 px-1">
      {invoices.map((inv) => (
        <li
          key={`${inv.invoice_no}-${inv.doc_date}`}
          className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2"
        >
          <div>
            <div className="nums text-[13px] font-medium">{inv.invoice_no}</div>
            <div className="text-xs text-muted-foreground">
              {inv.doc_date ?? '—'} · {invoiceStatus(inv)}
            </div>
          </div>
          <div className="text-right">
            <div className="nums text-[13px]">{money(inv.amt_local, inv.currency)}</div>
            <div className="nums text-xs text-muted-foreground">
              Bal {money(inv.balance, inv.currency)}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
