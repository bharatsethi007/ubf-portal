import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { listAddressBook, deleteAddressBook, findDuplicates, type AddressBookEntry, type DupePair } from './partyApi'

type Props = { open: boolean; onClose: () => void }

export default function AddressBookManager({ open, onClose }: Props) {
  const [tab, setTab] = useState<'all' | 'dupes'>('all')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<AddressBookEntry[]>([])
  const [dupes, setDupes] = useState<DupePair[]>([])
  const [loading, setLoading] = useState(false)

  const loadAll = () => { setLoading(true); listAddressBook(q).then(setRows).catch(() => {}).finally(() => setLoading(false)) }
  const loadDupes = () => { setLoading(true); findDuplicates().then(setDupes).catch(() => {}).finally(() => setLoading(false)) }

  useEffect(() => { if (open) { if (tab === 'all') loadAll(); else loadDupes() } }, [open, tab])
  useEffect(() => { if (open && tab === 'all') { const t = setTimeout(loadAll, 250); return () => clearTimeout(t) } }, [q])

  async function del(id: string, name: string) {
    try { await deleteAddressBook(id); toast.success(`Deleted ${name}`); if (tab === 'all') loadAll(); else loadDupes() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Delete failed') }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>TMS address book</DialogTitle></DialogHeader>
        <div className="flex gap-1 border-b border-neutral-200">
          {([['all', 'All'], ['dupes', 'Possible duplicates']] as const).map(([k, label]) => {
            const on = tab === k
            return <button key={k} type="button" onClick={() => setTab(k)} className={`relative px-3 py-2 text-[13px] font-medium ${on ? 'text-[#0A2472]' : 'text-neutral-500 hover:text-neutral-800'}`}>{label}{on && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#0A2472]" />}</button>
          })}
        </div>

        {tab === 'all' ? (
          <>
            <label className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2">
              <Search size={15} className="text-neutral-400" />
              <input className="w-full bg-transparent text-sm outline-none" placeholder="Search company…" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <div className="max-h-80 overflow-y-auto">
              {loading ? <p className="py-3 text-sm text-neutral-400">Loading…</p>
                : rows.length === 0 ? <p className="py-3 text-sm text-neutral-400">No saved addresses.</p>
                : rows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 border-b border-neutral-100 px-1 py-2">
                    <span className="min-w-0"><span className="block truncate text-sm font-medium">{r.company_name}</span>{r.address && <span className="block truncate text-xs text-neutral-500">{r.address}</span>}</span>
                    <button type="button" onClick={() => del(r.id, r.company_name)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-neutral-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                ))}
            </div>
          </>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {loading ? <p className="py-3 text-sm text-neutral-400">Scanning…</p>
              : dupes.length === 0 ? <p className="py-3 text-sm text-neutral-400">No likely duplicates found.</p>
              : dupes.map((d) => (
                <div key={`${d.a_id}-${d.b_id}`} className="mb-2 rounded-lg border border-neutral-200 p-2">
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-amber-600">~{Math.round(d.sim * 100)}% match</div>
                  {[[d.a_id, d.a_company, d.a_address], [d.b_id, d.b_company, d.b_address]].map(([id, company, address]) => (
                    <div key={id as string} className="flex items-center justify-between gap-2 py-1">
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{company as string}</span>{address && <span className="block truncate text-xs text-neutral-500">{address as string}</span>}</span>
                      <button type="button" onClick={() => del(id as string, company as string)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-neutral-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
