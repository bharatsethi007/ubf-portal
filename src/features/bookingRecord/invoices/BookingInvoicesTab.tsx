import InvoicesTable from '@/components/InvoicesTable'
import { useShipmentInvoices } from '@/hooks/useInvoices'

export default function BookingInvoicesTab({ shipmentId }: { shipmentId: number | null }) {
  const { invoices, loading } = useShipmentInvoices(shipmentId)

  if (shipmentId == null) {
    return <p className="muted" style={{ fontSize: 13, padding: 16 }}>No shipment linked. Link a shipment on the Details tab to load its invoices.</p>
  }
  return (
    <div className="card" style={{ padding: 16 }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Invoices</h4>
      <InvoicesTable
        invoices={invoices}
        loading={loading}
        defaultShowPaid
        emptyMessage="No invoices for this shipment."
      />
    </div>
  )
}
