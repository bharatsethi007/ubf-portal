import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useCustomerSearch, type CustomerPickerValue } from '../../hooks/useBookings'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { createPortalCustomer, type NewCustomerInput } from './quickCustomerApi'
import NotInCfBadge from './NotInCfBadge'

type Props = {
  open: boolean
  initialName?: string
  onClose: () => void
  /** Called with the new customer, or an existing one the user picked instead. */
  onCreated: (c: CustomerPickerValue) => void
}

const EMPTY: NewCustomerInput = {
  name: '', contact: '', email: '', phone: '', address1: '', city: '', postcode: '', country: 'NZ',
  isImporter: false, isExporter: false,
}

const label = { fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)' } as const
const field = { display: 'flex', flexDirection: 'column', gap: 4 } as const

export default function QuickCustomerDialog({ open, initialName = '', onClose, onCreated }: Props) {
  const [form, setForm] = useState<NewCustomerInput>(EMPTY)
  const [busy, setBusy] = useState(false)
  const debouncedName = useDebouncedValue(form.name, 300)
  const { data: similar } = useCustomerSearch(open ? debouncedName : '')

  useEffect(() => {
    if (open) setForm({ ...EMPTY, name: initialName })
  }, [open, initialName])

  const set = (p: Partial<NewCustomerInput>) => setForm((f) => ({ ...f, ...p }))
  const canSave = form.name.trim().length >= 2 && !busy

  async function save() {
    if (!canSave) return
    setBusy(true)
    try {
      const c = await createPortalCustomer(form)
      toast.success(`${c.name} added (${c.account_id})`)
      onCreated(c)
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create customer')
    } finally {
      setBusy(false)
    }
  }

  const input = (key: keyof NewCustomerInput, lab: string, opts: { type?: string; width?: number | string } = {}) => (
    <label style={{ ...field, width: opts.width ?? '100%' }}>
      <span style={label}>{lab}</span>
      <input
        className="input input--sm"
        type={opts.type ?? 'text'}
        value={String(form[key] ?? '')}
        onChange={(e) => set({ [key]: e.target.value } as Partial<NewCustomerInput>)}
      />
    </label>
  )

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New customer</DialogTitle>
          <DialogDescription>
            Added to Customers with a "Not in CF" badge until it is set up in CyberFreight.
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={field}>
            <span style={label}>Company name *</span>
            <input
              className="input input--sm"
              autoFocus
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') void save() }}
            />
          </label>

          {similar.length > 0 && (
            <div style={{ border: '1px solid #FCD9A6', background: '#FFFBF2', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 12, color: '#B45309', marginBottom: 4 }}>Already exists? Pick it instead:</div>
              {similar.slice(0, 5).map((c) => (
                <button
                  key={c.account_id}
                  type="button"
                  className="text-link"
                  onClick={() => { onCreated(c); onClose() }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '3px 0', fontSize: 13 }}
                >
                  <span>{c.name}</span>
                  <span className="mono text-muted-foreground" style={{ fontSize: 11 }}>{c.account_id}</span>
                  <NotInCfBadge source={c.source} />
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            {input('contact', 'Contact person')}
            {input('phone', 'Phone')}
          </div>
          {input('email', 'Email', { type: 'email' })}
          {input('address1', 'Address')}
          <div style={{ display: 'flex', gap: 10 }}>
            {input('city', 'City')}
            {input('postcode', 'Postcode', { width: 120 })}
            {input('country', 'Country', { width: 90 })}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={!!form.isExporter} onChange={(e) => set({ isExporter: e.target.checked })} /> Exporter
            </label>
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={!!form.isImporter} onChange={(e) => set({ isImporter: e.target.checked })} /> Importer
            </label>
          </div>
        </div>

        <DialogFooter style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" className="text-link" disabled={busy} onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn--inline"
            title="Create customer"
            aria-label="Create customer"
            disabled={!canSave}
            onClick={() => void save()}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 'auto' }}
          >
            <Save size={16} />
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
