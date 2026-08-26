import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Search, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { listAddressBook, addAddressBook, type AddressBookEntry } from './partyApi'
import type { PartyDraft } from './consignmentFormApi'

type Props = { open: boolean; current?: PartyDraft; onClose: () => void; onPick: (p: Partial<PartyDraft>) => void }

export default function AddressBookDialog({ open, current, onClose, onPick }: Props) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<AddressBookEntry[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => { setLoading(true); listAddressBook(q).then(setRows).catch(() => {}).finally(() => setLoading(false)) }
  useEffect(() => { if (open) load() }, [open])
  useEffect(() => { if (open) { const t = setTimeout(load, 250); return () => clearTimeout(t) } }, [q])

  async function saveCurrent() {
    if (!current?.company?.trim()) { toast.error('Enter a company name first'); return }
    try { await addAddressBook(current); toast.success('Saved to address book'); load() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed') }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Address book</DialogTitle></DialogHeader>
        <div className="flex items-center gap-2">
          <label className="flex flex-1 items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2">
            <Search size={15} className="text-neutral-400" />
            <input className="w-full bg-transparent text-sm outline-none" placeholder="Search saved addresses…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          {current && <button type="button" onClick={saveCurrent} className="inline-flex items-center gap-1 rounded-lg border border-[#0A2472] px-3 py-2 text-xs font-medium text-[#0A2472] hover:bg-[#0A2472]/[0.04]"><Plus size={13} /> Save current</button>}
        </div>
        <div className="max-h-72 overflow-y-auto">
          {loading ? <p className="py-3 text-sm text-neutral-400">Loading…</p>
            : rows.length === 0 ? <p className="py-3 text-sm text-neutral-400">No saved addresses yet.</p>
            : rows.map((r) => (
              <button key={r.id} type="button" onClick={() => { onPick({ company: r.company_name, address: r.address ?? '', additional_info: r.additional_info ?? '', contact: r.contact_name ?? '', phone: r.phone ?? '', email: r.email ?? '' }); onClose() }}
                className="block w-full rounded-md px-3 py-2 text-left hover:bg-neutral-50">
                <span className="block text-sm font-medium">{r.company_name}</span>
                {r.address && <span className="block truncate text-xs text-neutral-500">{r.address}</span>}
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
