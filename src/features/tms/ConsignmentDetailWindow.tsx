import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ArrowRight, Pencil, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import ConsignmentMiniMap from './ConsignmentMiniMap'
import { fetchConsignment, type TmsConsignmentDetail } from './tmsApi'
import { fetchConsignmentActivity, activityLabel, type ActivityRow } from './tmsActivityApi'

const fmt = (v: string | null) => (v ? format(new Date(v), 'd MMM yyyy, h:mm a') : '—')

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  unassigned: { label: 'Unassigned', cls: 'bg-amber-50 text-amber-700' },
  assigned: { label: 'Assigned', cls: 'bg-blue-50 text-blue-700' },
  inTransit: { label: 'In transit', cls: 'bg-indigo-50 text-indigo-700' },
  atDepot: { label: 'At depot', cls: 'bg-sky-50 text-sky-700' },
  assignedLeg2: { label: 'Assigned (leg 2)', cls: 'bg-blue-50 text-blue-700' },
  inTransitLeg2: { label: 'In transit (leg 2)', cls: 'bg-indigo-50 text-indigo-700' },
  onHold: { label: 'On hold', cls: 'bg-orange-50 text-orange-700' },
  complete: { label: 'Complete', cls: 'bg-emerald-50 text-emerald-700' },
  checked_in: { label: 'Checked in', cls: 'bg-emerald-50 text-emerald-700' },
  failed: { label: 'Failed', cls: 'bg-red-50 text-red-700' },
  inComplete: { label: 'Incomplete', cls: 'bg-red-50 text-red-700' },
  cancel: { label: 'Cancelled', cls: 'bg-neutral-100 text-neutral-600' },
  archived: { label: 'Archived', cls: 'bg-neutral-100 text-neutral-600' },
  draft: { label: 'Draft', cls: 'bg-neutral-100 text-neutral-600' },
}

const FLAGS: { key: keyof TmsConsignmentDetail; label: string }[] = [
  { key: 'signature_required', label: 'Signature' }, { key: 'photo_pod_required', label: 'Photo POD' },
  { key: 'tail_lift_required', label: 'Tail lift' }, { key: 'temperature_control', label: 'Temp control' },
  { key: 'customs_mpi', label: 'Customs/MPI' }, { key: 'fragile', label: 'Fragile' },
  { key: 'urgent', label: 'Urgent' }, { key: 'saturday_delivery', label: 'Saturday' },
]

function Micro({ children }: { children: ReactNode }) {
  return <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">{children}</div>
}
function NavyLabel({ children }: { children: ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-wide text-[#0A2472]">{children}</div>
}
function Field({ label, value }: { label: string; value: ReactNode }) {
  return <div className="space-y-0.5"><Micro>{label}</Micro><div className="text-sm text-neutral-900">{value ?? '—'}</div></div>
}
function Party(p: { title: string; dot: string; company?: string | null; address?: string | null; contact?: string | null; phone?: string | null; email?: string | null }) {
  return (
    <div>
      <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: p.dot }} /><NavyLabel>{p.title}</NavyLabel></div>
      <div className="mt-1 text-sm font-medium text-neutral-900">{p.company ?? '—'}</div>
      <div className="text-sm text-neutral-500">{p.address ?? '—'}</div>
      {(p.contact || p.phone || p.email) && <div className="mt-1 text-xs text-neutral-500">{[p.contact, p.phone, p.email].filter(Boolean).join('  ·  ')}</div>}
    </div>
  )
}

type Props = { id: string | null; onClose: () => void }

export default function ConsignmentDetailWindow({ id, onClose }: Props) {
  const open = Boolean(id)
  const navigate = useNavigate()
  const [d, setD] = useState<TmsConsignmentDetail | null>(null)
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'map' | 'activity'>('map')

  useEffect(() => {
    if (!id) { setD(null); setActivity([]); return }
    let cancelled = false
    setLoading(true); setTab('map')
    Promise.all([fetchConsignment(id), fetchConsignmentActivity(id)])
      .then(([det, act]) => { if (!cancelled) { setD(det); setActivity(act) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  const origin = d?.sender_address || d?.sender_company || '—'
  const dest = d?.receiver_address || d?.receiver_company || '—'
  const activeFlags = d ? FLAGS.filter((f) => d[f.key]) : []
  const badge = d ? (STATUS_BADGE[d.status] ?? { label: d.status, cls: 'bg-neutral-100 text-neutral-600' }) : null
  const dd = d as any

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex flex-col gap-0 p-0 sm:max-w-none w-[80vw] max-w-[1200px] h-[85vh] overflow-hidden rounded-2xl">
        {(!d || loading) ? (
          <div className="flex flex-1 items-center justify-center text-sm text-neutral-400">{loading ? 'Loading…' : 'Consignment not found.'}</div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 bg-gradient-to-r from-[#0A2472]/[0.05] to-transparent px-6 py-4">
              <div className="min-w-0">
                <DialogTitle asChild>
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[#0A2472]" />
                    <span className="truncate">{origin}</span>
                    <ArrowRight size={18} className="shrink-0 text-neutral-400" />
                    <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                    <span className="truncate">{dest}</span>
                  </h2>
                </DialogTitle>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
                  <span className="tabular-nums font-medium text-neutral-700">{d.consignment_no}</span>
                  <span className="text-neutral-300">·</span>
                  <span className="capitalize">{d.order_type.replace('-', ' ')}</span>
                  {badge && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>}
                  {d.goods_type === 'dangerous' && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600"><AlertTriangle size={12} />Dangerous goods</span>}
                </div>
              </div>
              <button type="button" onClick={() => navigate(`/tms/${d.id}/edit`)}
                className="mr-8 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                <Pencil size={14} /> Edit
              </button>
            </div>

            <div className="flex min-h-0 flex-1">
              <div className="min-w-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
                <section className="grid grid-cols-2 gap-4 rounded-xl border border-l-2 border-neutral-200 border-l-[#0A2472] bg-[#0A2472]/[0.03] p-4 sm:grid-cols-4">
                  <Field label="Preferred pick-up" value={fmt(d.preferred_pickup_at)} />
                  <Field label="Preferred delivery" value={fmt(d.preferred_delivery_at)} />
                  <Field label="Estimated delivery" value={fmt(d.estimated_delivery_at)} />
                  <Field label="Driver" value={d.driver1 ? `${d.driver1.first_name} ${d.driver1.last_name}` : '—'} />
                </section>

                <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Field label="PO number" value={d.po_number} />
                  <Field label="Supplier" value={d.supplier_name} />
                  <Field label="Reference" value={d.reference} />
                  <Field label="Booking" value={d.booking_id ? <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">Linked</span> : '—'} />
                </section>

                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <Party title="Sender" dot="#0A2472" company={d.sender_company} address={d.sender_address} contact={d.sender_contact} phone={d.sender_phone} email={d.sender_email} />
                  <Party title="Receiver" dot="#f43f5e" company={d.receiver_company} address={d.receiver_address} contact={d.receiver_contact} phone={d.receiver_phone} email={d.receiver_email} />
                </section>

                {activeFlags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {activeFlags.map((f) => <span key={f.label} className="rounded-full border border-[#0A2472]/20 bg-[#0A2472]/[0.04] px-2.5 py-0.5 text-xs font-medium text-[#0A2472]">{f.label}</span>)}
                  </div>
                )}

                <section>
                  <NavyLabel>What's shipping</NavyLabel>
                  <div className="mt-2 overflow-hidden rounded-xl border border-neutral-200">
                    <table className="w-full text-sm">
                      <thead className="bg-[#0A2472]/[0.04] text-[11px] uppercase tracking-wide text-[#0A2472]">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Type</th>
                          <th className="px-3 py-2 text-right font-semibold">Units</th>
                          <th className="px-3 py-2 text-right font-semibold">L</th>
                          <th className="px-3 py-2 text-right font-semibold">W</th>
                          <th className="px-3 py-2 text-right font-semibold">H</th>
                          <th className="px-3 py-2 text-right font-semibold">Kg</th>
                          <th className="px-3 py-2 text-right font-semibold">CBM</th>
                        </tr>
                      </thead>
                      <tbody className="tabular-nums">
                        {(d.cargo ?? []).length === 0 ? (
                          <tr><td colSpan={7} className="px-3 py-3 text-neutral-400">No cargo lines.</td></tr>
                        ) : d.cargo.map((l) => (
                          <tr key={l.id} className="border-t border-neutral-100">
                            <td className="px-3 py-2 capitalize">{l.type}</td>
                            <td className="px-3 py-2 text-right">{l.units ?? '—'}</td>
                            <td className="px-3 py-2 text-right">{l.length_cm ?? '—'}</td>
                            <td className="px-3 py-2 text-right">{l.width_cm ?? '—'}</td>
                            <td className="px-3 py-2 text-right">{l.height_cm ?? '—'}</td>
                            <td className="px-3 py-2 text-right">{l.weight_kg ?? '—'}</td>
                            <td className="px-3 py-2 text-right">{l.total_cube_m3 ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {d.delivery_instructions && <Field label="Delivery instructions" value={d.delivery_instructions} />}
              </div>

              <div className="flex w-[38%] min-w-[340px] flex-col border-l border-neutral-200">
                <div className="flex gap-4 px-5 pt-3">
                  {(['map', 'activity'] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setTab(t)}
                      className={`relative pb-2 text-sm font-medium capitalize transition-colors ${tab === t ? 'text-neutral-900' : 'text-neutral-400 hover:text-neutral-600'}`}>
                      {t}
                      {tab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[#0A2472]" />}
                    </button>
                  ))}
                </div>
                <div className="min-h-0 flex-1 border-t border-neutral-200">
                  {tab === 'map' ? (
                    <ConsignmentMiniMap
                      originAddress={d.sender_address} originLat={dd.sender_lat} originLng={dd.sender_lng}
                      destAddress={d.receiver_address} destLat={dd.receiver_lat} destLng={dd.receiver_lng} />
                  ) : (
                    <div className="h-full overflow-y-auto p-5">
                      {activity.length === 0 ? (
                        <p className="text-sm text-neutral-400">No activity yet.</p>
                      ) : (
                        <ol className="space-y-4 border-l border-neutral-200 pl-4">
                          {activity.map((a) => (
                            <li key={a.id} className="relative">
                              <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-[#0A2472] ring-2 ring-white" />
                              <div className="text-sm text-neutral-900">{activityLabel(a)}</div>
                              {a.note && <div className="text-xs text-neutral-500">{a.note}</div>}
                              <div className="mt-0.5 text-[11px] tabular-nums text-neutral-400">{fmt(a.created_at)}</div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
