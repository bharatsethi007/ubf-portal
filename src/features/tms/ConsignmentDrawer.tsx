import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { format } from 'date-fns'
import { fetchConsignment, type TmsConsignmentDetail } from './tmsApi'

type Props = { id: string | null; onClose: () => void }

function fmt(v: string | null) { return v ? format(new Date(v), 'd MMM yyyy, h:mm a') : '—' }

const FLAGS: { key: keyof TmsConsignmentDetail; label: string }[] = [
  { key: 'signature_required', label: 'Signature' },
  { key: 'photo_pod_required', label: 'Photo POD' },
  { key: 'tail_lift_required', label: 'Tail Lift' },
  { key: 'temperature_control', label: 'Temp Control' },
  { key: 'customs_mpi', label: 'Customs/MPI' },
  { key: 'fragile', label: 'Fragile' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'saturday_delivery', label: 'Saturday' },
]

function Party(p: { title: string; company?: string | null; address?: string | null; contact?: string | null; phone?: string | null; email?: string | null }) {
  return (
    <div className="mb-4">
      <h3 className="mb-1 text-sm font-semibold text-[#0A2472]">{p.title}</h3>
      <div className="text-sm text-neutral-700">{p.company ?? '—'}</div>
      <div className="text-sm text-neutral-500">{p.address ?? '—'}</div>
      <div className="mt-1 text-xs text-neutral-500">{[p.contact, p.phone, p.email].filter(Boolean).join(' · ') || '—'}</div>
    </div>
  )
}

export default function ConsignmentDrawer({ id, onClose }: Props) {
  const open = Boolean(id)
  const [data, setData] = useState<TmsConsignmentDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!id) { setData(null); return }
    let cancelled = false
    setLoading(true)
    fetchConsignment(id).then((d) => { if (!cancelled) setData(d) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle>{data?.consignment_no ?? 'Consignment'}</SheetTitle>
          <SheetDescription>{data ? `${data.order_type} · ${data.status}` : 'Consignment detail'}</SheetDescription>
        </SheetHeader>

        {loading || !data ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">{loading ? 'Loading…' : 'Consignment not found.'}</p>
        ) : (
          <Tabs defaultValue="consignment" className="flex min-h-0 flex-1 flex-col px-6 pb-6">
            <TabsList variant="line" className="mb-3 w-full justify-start">
              <TabsTrigger value="consignment">Consignment</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="consignment" className="min-h-0 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 py-3 text-sm">
                <div><div className="text-xs text-neutral-500">Preferred Pick-up</div>{fmt(data.preferred_pickup_at)}</div>
                <div><div className="text-xs text-neutral-500">Preferred Delivery</div>{fmt(data.preferred_delivery_at)}</div>
                <div><div className="text-xs text-neutral-500">Estimated Delivery</div>{fmt(data.estimated_delivery_at)}</div>
                <div><div className="text-xs text-neutral-500">Driver</div>{data.driver1 ? `${data.driver1.first_name} ${data.driver1.last_name}` : '—'}</div>
              </div>
              <Party title="Sender" company={data.sender_company} address={data.sender_address} contact={data.sender_contact} phone={data.sender_phone} email={data.sender_email} />
              <Party title="Receiver" company={data.receiver_company} address={data.receiver_address} contact={data.receiver_contact} phone={data.receiver_phone} email={data.receiver_email} />
              {data.goods_type === 'dangerous' && (
                <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">Dangerous goods{data.dangerous_goods_reason ? ` — ${data.dangerous_goods_reason}` : ''}</div>
              )}
              <div className="mb-3 flex flex-wrap gap-1">
                {FLAGS.filter((f) => data[f.key]).map((f) => (
                  <span key={f.label} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">{f.label}</span>
                ))}
              </div>
              <h3 className="mb-1 text-sm font-semibold text-[#0A2472]">Order Details</h3>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-neutral-500"><th className="py-1">Type</th><th>Units</th><th>L</th><th>W</th><th>H</th><th>Kg</th><th>CBM</th></tr></thead>
                <tbody>
                  {(data.cargo ?? []).length === 0 ? (
                    <tr><td colSpan={7} className="py-2 text-neutral-400">No cargo lines.</td></tr>
                  ) : data.cargo.map((l) => (
                    <tr key={l.id} className="border-t border-neutral-100">
                      <td className="py-1 capitalize">{l.type}</td><td>{l.units ?? '—'}</td><td>{l.length_cm ?? '—'}</td><td>{l.width_cm ?? '—'}</td><td>{l.height_cm ?? '—'}</td><td>{l.weight_kg ?? '—'}</td><td>{l.total_cube_m3 ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabsContent>

            <TabsContent value="notes" className="min-h-0 flex-1 overflow-y-auto py-3 text-sm">
              {data.delivery_instructions && <div className="mb-3"><div className="text-xs text-neutral-500">Delivery Instructions</div>{data.delivery_instructions}</div>}
              {(data.special_instructions ?? []).length === 0 ? (
                <p className="text-neutral-400">No notes.</p>
              ) : (
                <ul className="space-y-2">
                  {data.special_instructions.map((n, i) => (
                    <li key={i} className="rounded-md bg-neutral-50 px-3 py-2"><div>{n.text}</div><div className="mt-1 text-xs text-neutral-500">{[n.byName, n.createdAt].filter(Boolean).join(' · ')}</div></li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  )
}
