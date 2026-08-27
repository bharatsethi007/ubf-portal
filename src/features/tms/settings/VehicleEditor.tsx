import { useState, type ChangeEvent } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Truck, Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createVehicle, updateVehicle, uploadVehiclePhoto, type FleetVehicle } from './fleetApi'
import VehicleReminders from './VehicleReminders'

type Props = { vehicle: FleetVehicle | null; open: boolean; onClose: () => void; onSaved: () => void }

export default function VehicleEditor({ vehicle, open, onClose, onSaved }: Props) {
  const isNew = !vehicle
  const [rego, setRego] = useState(vehicle?.registration_number ?? '')
  const [model, setModel] = useState(vehicle?.model ?? '')
  const [photoUrl, setPhotoUrl] = useState<string | null>(vehicle?.photo_url ?? null)
  const [regoExpiry, setRegoExpiry] = useState(vehicle?.rego_expiry ?? '')
  const [cofExpiry, setCofExpiry] = useState(vehicle?.cof_expiry ?? '')
  const [lastService, setLastService] = useState(vehicle?.last_service_at ?? '')
  const [nextService, setNextService] = useState(vehicle?.next_service_at ?? '')
  const [active, setActive] = useState(vehicle?.active ?? true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try { setPhotoUrl(await uploadVehiclePhoto(file)) }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed') }
    finally { setUploading(false); e.target.value = '' }
  }

  async function save() {
    if (!rego.trim()) { toast.error('Registration is required'); return }
    setSaving(true)
    const input = {
      registration_number: rego.trim(),
      model: model.trim() || null,
      photo_url: photoUrl,
      rego_expiry: regoExpiry || null,
      cof_expiry: cofExpiry || null,
      last_service_at: lastService || null,
      next_service_at: nextService || null,
      active,
    }
    try {
      if (isNew) await createVehicle(input)
      else await updateVehicle(vehicle!.id, input)
      toast.success(isNew ? 'Vehicle added' : 'Vehicle updated')
      onSaved()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      toast.error(/duplicate|unique/i.test(msg) ? 'That registration already exists' : msg)
    } finally { setSaving(false) }
  }

  const dateFields: [string, string, (v: string) => void][] = [
    ['Rego expiry', regoExpiry, setRegoExpiry],
    ['COF expiry', cofExpiry, setCofExpiry],
    ['Last service', lastService, setLastService],
    ['Next service', nextService, setNextService],
  ]

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{isNew ? 'Add vehicle' : `Edit ${vehicle?.registration_number}`}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {photoUrl
              ? <img src={photoUrl} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
              : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#0A2472]/[0.08] text-[#0A2472]"><Truck size={22} /></span>}
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {photoUrl ? 'Change photo' : 'Upload photo'}
              <input type="file" accept="image/*" className="hidden" onChange={onPhoto} disabled={uploading} />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Registration *</span>
            <input value={rego} onChange={(e) => setRego(e.target.value)} placeholder="e.g. ABC123"
              className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-[#0A2472]" />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Model</span>
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Auto from telematics if left blank"
              className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-[#0A2472]" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            {dateFields.map(([label, val, set]) => (
              <label key={label} className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-600">{label}</span>
                <input type="date" value={val} onChange={(e) => set(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-[#0A2472]" />
              </label>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded border-neutral-300" />
            Active
          </label>

          {!isNew && vehicle
            ? <VehicleReminders vehicleId={vehicle.id} />
            : <p className="rounded-lg border border-dashed border-neutral-200 px-3 py-2 text-xs text-neutral-400">Save the vehicle first to add reminders.</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={saving || uploading} className="!bg-ub-navy !text-white hover:!bg-ub-navy/90 !border-ub-navy" onClick={save}>
            {saving ? 'Saving…' : isNew ? 'Add vehicle' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
