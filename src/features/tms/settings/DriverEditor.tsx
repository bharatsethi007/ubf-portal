import { useState, type ChangeEvent } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { User, Upload, Loader2, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { updateDriver, uploadDriverPhoto, uploadDriverLicenseDoc, getLicenseDocSignedUrl, ENDORSEMENTS, type FleetDriver } from './fleetApi'

type Props = { driver: FleetDriver; open: boolean; onClose: () => void; onSaved: () => void }

export default function DriverEditor({ driver, open, onClose, onSaved }: Props) {
  const [firstName, setFirstName] = useState(driver.first_name ?? '')
  const [lastName, setLastName] = useState(driver.last_name ?? '')
  const [phone, setPhone] = useState(driver.phone ?? '')
  const [photoUrl, setPhotoUrl] = useState<string | null>(driver.photo_url ?? null)
  const [licenseNumber, setLicenseNumber] = useState(driver.license_number ?? '')
  const [licenseExpiry, setLicenseExpiry] = useState(driver.license_expiry ?? '')
  const [endorsements, setEndorsements] = useState<string[]>(driver.endorsements ?? [])
  const [licenseDocPath, setLicenseDocPath] = useState<string | null>(driver.license_doc_url ?? null)
  const [active, setActive] = useState(driver.active ?? true)
  const [uploading, setUploading] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [saving, setSaving] = useState(false)

  const toggle = (key: string) => setEndorsements((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try { setPhotoUrl(await uploadDriverPhoto(file)) }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed') }
    finally { setUploading(false); e.target.value = '' }
  }

  async function onDoc(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploadingDoc(true)
    try { setLicenseDocPath(await uploadDriverLicenseDoc(file)) }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed') }
    finally { setUploadingDoc(false); e.target.value = '' }
  }

  async function viewDoc() {
    if (!licenseDocPath) return
    const url = await getLicenseDocSignedUrl(licenseDocPath)
    if (url) window.open(url, '_blank'); else toast.error('Could not open document')
  }

  async function save() {
    if (!firstName.trim()) { toast.error('First name is required'); return }
    setSaving(true)
    try {
      await updateDriver(driver.id, {
        first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() || null,
        photo_url: photoUrl, license_number: licenseNumber.trim() || null,
        license_expiry: licenseExpiry || null, endorsements, license_doc_url: licenseDocPath, active,
      })
      toast.success('Driver updated'); onSaved()
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Save failed') }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Edit {driver.first_name} {driver.last_name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {photoUrl
              ? <img src={photoUrl} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
              : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#0A2472]/[0.08] text-[#0A2472]"><User size={22} /></span>}
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {photoUrl ? 'Change photo' : 'Upload photo'}
              <input type="file" accept="image/*" className="hidden" onChange={onPhoto} disabled={uploading} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">First name *</span>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-[#0A2472]" /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">Last name</span>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-[#0A2472]" /></label>
          </div>

          <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">Mobile</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="+64…" className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-[#0A2472]" /></label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">License number</span>
              <input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-[#0A2472]" /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">License expiry</span>
              <input type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-[#0A2472]" /></label>
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium text-neutral-600">Endorsements</span>
            <div className="flex flex-wrap gap-2">
              {ENDORSEMENTS.map((e) => {
                const on = endorsements.includes(e.key)
                return (
                  <button key={e.key} type="button" onClick={() => toggle(e.key)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${on ? 'border-[#0A2472] bg-[#0A2472] text-white' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}>
                    {e.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium text-neutral-600">License copy</span>
            <div className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
                {uploadingDoc ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {licenseDocPath ? 'Replace' : 'Upload'}
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={onDoc} disabled={uploadingDoc} />
              </label>
              {licenseDocPath
                ? <button type="button" onClick={viewDoc} className="inline-flex items-center gap-1 text-sm font-medium text-[#0A2472] hover:underline"><FileText size={14} />View</button>
                : <span className="text-xs text-neutral-400">No copy uploaded</span>}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded border-neutral-300" />Active
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={saving || uploading || uploadingDoc} className="!bg-ub-navy !text-white hover:!bg-ub-navy/90 !border-ub-navy" onClick={save}>{saving ? 'Saving…' : 'Save changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
