import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { listBrevoLists, syncToBrevo, type BrevoList, type MktContact } from './marketingApi'

const BTN: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  height: 36, padding: '0 16px', borderRadius: 8, fontSize: 14, fontWeight: 400,
  boxSizing: 'border-box', lineHeight: 1, whiteSpace: 'nowrap', width: 'auto', cursor: 'pointer',
}
const NAVY: React.CSSProperties = { background: '#0A2472', color: '#fff', border: '1px solid #0A2472' }
const PLAIN: React.CSSProperties = { background: '#fff', color: '#111827', border: '1px solid #d1d5db' }

export default function BrevoExportModal({ contacts, onClose }: { contacts: MktContact[]; onClose: () => void }) {
  const [lists, setLists] = useState<BrevoList[]>([])
  const [defaultFolderId, setDefaultFolderId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [target, setTarget] = useState<'existing' | 'new'>('existing')
  const [listId, setListId] = useState<number | null>(null)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    listBrevoLists()
      .then((r) => { if (!alive) return; setLists(r.lists); setDefaultFolderId(r.defaultFolderId); if (r.lists[0]) setListId(r.lists[0].id); if (!r.lists.length) setTarget('new') })
      .catch((e) => { if (alive) setErr(e?.message ?? 'Failed to load lists') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const run = async () => {
    setBusy(true)
    try {
      if (target === 'existing' && listId == null) throw new Error('Pick a list')
      if (target === 'new' && !newName.trim()) throw new Error('Enter a list name')
      const args = target === 'existing'
        ? { contacts, listId: listId ?? undefined }
        : { contacts, newListName: newName.trim(), folderId: defaultFolderId }
      const res = await syncToBrevo(args)
      toast.success(`Synced ${res.queued} contacts to Brevo`)
      onClose()
    } catch (e) {
      toast.error((e as Error).message ?? 'Brevo sync failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 22, width: 440, maxWidth: '92vw' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Export to Brevo</div>
        <div className="text-muted-foreground" style={{ marginBottom: 16 }}>{contacts.length} unique contacts will be added or updated.</div>

        {loading ? <div>Loading lists…</div> : err ? <div className="text-red-600">{err}</div> : (
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="radio" checked={target === 'existing'} onChange={() => setTarget('existing')} disabled={!lists.length} />
              <span>Existing list</span>
            </label>
            {target === 'existing' ? (
              <select className="input input--sm" value={listId ?? ''} onChange={(e) => setListId(Number(e.target.value))}>
                {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            ) : null}

            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="radio" checked={target === 'new'} onChange={() => setTarget('new')} />
              <span>New list</span>
            </label>
            {target === 'new' ? (
              <input className="input input--sm" placeholder="List name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            ) : null}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} disabled={busy} style={{ ...BTN, ...PLAIN, opacity: busy ? 0.5 : 1 }}>Cancel</button>
          <button onClick={run} disabled={busy || loading || !!err}
            style={{ ...BTN, ...NAVY, opacity: (busy || loading || !!err) ? 0.5 : 1 }}>
            {busy ? 'Syncing…' : 'Sync'}
          </button>
        </div>
      </div>
    </div>
  )
}
