import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useCustomerSearch, type CustomerPickerValue } from '../../hooks/useBookings'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { searchAgentsLite } from '../../pages/agents/agentsApi'
import { createPortalAgent, createPortalCustomer, type NewCustomerInput } from './quickCustomerApi'
import NotInCfBadge from './NotInCfBadge'

export type QuickPartyKind = 'customer' | 'agent'

type Props = {
  open: boolean
  initialName?: string
  /** Show the Customer / Agent switch (agents go to the Agents section). */
  allowAgent?: boolean
  onClose: () => void
  /** New or picked-existing party. For agents, agentId is set. */
  onCreated: (c: CustomerPickerValue, meta: { kind: QuickPartyKind; agentId: string | null }) => void
}

const EMPTY: NewCustomerInput = {
  name: '', contact: '', email: '', phone: '', address1: '', city: '', postcode: '', country: 'NZ',
  isImporter: false, isExporter: false,
}

const label = { fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)' } as const
const field = { display: 'flex', flexDirection: 'column', gap: 4 } as const
const segBtn = (on: boolean) => ({
  border: 0, borderRadius: 6, padding: '5px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
  background: on ? '#fff' : 'transparent', color: on ? '#0F172A' : '#64748B',
  boxShadow: on ? '0 1px 2px rgba(15,23,42,.08)' : 'none',
}) as const

type Similar = { key: string; name: string; code: string; source?: string; pick: () => void }

export default function QuickCustomerDialog({ open, initialName = '', allowAgent = false, onClose, onCreated }: Props) {
  const [kind, setKind] = useState<QuickPartyKind>('customer')
  const [form, setForm] = useState<NewCustomerInput>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [agentHits, setAgentHits] = useState<{ id: string; name: string; erp_account_code: string | null; country: string | null }[]>([])
  const debouncedName = useDebouncedValue(form.name, 300)
  const isAgent = kind === 'agent'
  const { data: custHits } = useCustomerSearch(open && !isAgent ? debouncedName : '')

  useEffect(() => {
    if (open) { setForm({ ...EMPTY, name: initialName }); setKind('customer') }
  }, [open, initialName])

  useEffect(() => {
    if (form.country === 'NZ' && isAgent) setForm((f) => ({ ...f, country: '' }))
    if (!form.country && !isAgent) setForm((f) => ({ ...f, country: 'NZ' }))
  }, [isAgent]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false
    if (!open || !isAgent || debouncedName.trim().length < 2) { setAgentHits([]); return }
    searchAgentsLite(debouncedName, 5)
      .then((r) => { if (!cancelled) setAgentHits(r as typeof agentHits) })
      .catch(() => { if (!cancelled) setAgentHits([]) })
    return () => { cancelled = true }
  }, [open, isAgent, debouncedName])

  const set = (p: Partial<NewCustomerInput>) => setForm((f) => ({ ...f, ...p }))
  const canSave = form.name.trim().length >= 2 && !busy

  const similar: Similar[] = isAgent
    ? agentHits.map((a) => ({
        key: a.id, name: a.name, code: a.erp_account_code ?? 'Portal-only',
        source: a.erp_account_code && !a.erp_account_code.startsWith('P-') ? 'erp' : 'portal',
        pick: () => onCreated(
          { account_id: a.erp_account_code ?? '', name: a.name, country: a.country ?? undefined },
          { kind: 'agent', agentId: a.id },
        ),
      }))
    : custHits.slice(0, 5).map((c) => ({
        key: c.account_id, name: c.name, code: c.account_id, source: c.source,
        pick: () => onCreated(c, { kind: 'customer', agentId: null }),
      }))

  async function save() {
    if (!canSave) return
    setBusy(true)
    try {
      if (isAgent) {
        const a = await createPortalAgent(form)
        toast.success(`Agent ${a.name} added`)
        onCreated(a, { kind: 'agent', agentId: a.agentId })
      } else {
        const c = await createPortalCustomer(form)
        toast.success(`${c.name} added (${c.account_id})`)
        onCreated(c, { kind: 'customer', agentId: null })
      }
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save')
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
          <DialogTitle>{isAgent ? 'New agent' : 'New customer'}</DialogTitle>
          <DialogDescription>
            {isAgent
              ? 'Added to Agents with a "Not on CF" tag until it is set up in CyberFreight.'
              : 'Added to Customers with a "Not in CF" badge until it is set up in CyberFreight.'}
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {allowAgent && (
            <div style={{ display: 'inline-flex', alignSelf: 'flex-start', gap: 2, padding: 3, borderRadius: 8, background: '#F1F5F9' }}>
              <button type="button" style={segBtn(!isAgent)} onClick={() => setKind('customer')}>Customer</button>
              <button type="button" style={segBtn(isAgent)} onClick={() => setKind('agent')}>Agent</button>
            </div>
          )}

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
              {similar.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className="text-link"
                  onClick={() => { s.pick(); onClose() }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '3px 0', fontSize: 13 }}
                >
                  <span>{s.name}</span>
                  <span className="mono text-muted-foreground" style={{ fontSize: 11 }}>{s.code}</span>
                  <NotInCfBadge source={s.source} />
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            {input('contact', 'Contact person')}
            {input('phone', 'Phone')}
          </div>
          {input('email', 'Email', { type: 'email' })}
          {isAgent ? (
            input('country', 'Country (e.g. CN)', { width: 160 })
          ) : (
            <>
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
            </>
          )}
        </div>

        <DialogFooter style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" className="text-link" disabled={busy} onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn--inline"
            title={isAgent ? 'Create agent' : 'Create customer'}
            aria-label={isAgent ? 'Create agent' : 'Create customer'}
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
