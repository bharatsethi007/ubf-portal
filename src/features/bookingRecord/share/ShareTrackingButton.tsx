import { useEffect, useState, type CSSProperties } from 'react'
import { Check, Copy, ExternalLink, Link2Off, Plus, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fmtDate } from '@/utils/format'
import { createShareLink, listShareLinks, revokeShareLink, shareUrl, type ShareLink } from './shareLinkApi'

const iconBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, flexShrink: 0, margin: 0 }

/** Header icon: create / copy / revoke public live-tracking links for an Import Sea booking. */
export default function ShareTrackingButton({ bookingId, bookingRef }: { bookingId: string; bookingRef: string }) {
  const [open, setOpen] = useState(false)
  const [links, setLinks] = useState<ShareLink[]>([])
  const [busy, setBusy] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function load() {
    try { setLinks(await listShareLinks(bookingId)) } catch { toast.error('Could not load share links') }
  }
  useEffect(() => { if (open) void load() }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function copy(l: ShareLink) {
    try {
      await navigator.clipboard.writeText(shareUrl(l.token))
      setCopiedId(l.id)
      window.setTimeout(() => setCopiedId(null), 2000)
    } catch { toast.error('Copy failed') }
  }

  async function create() {
    setBusy(true)
    try {
      const l = await createShareLink(bookingId)
      setLinks((prev) => [l, ...prev])
      await copy(l)
      toast.success('Tracking link created and copied')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create link')
    } finally { setBusy(false) }
  }

  async function revoke(l: ShareLink) {
    setBusy(true)
    try {
      await revokeShareLink(l.id)
      setLinks((prev) => prev.filter((x) => x.id !== l.id))
      toast.success('Link turned off')
    } catch { toast.error('Could not turn off link') } finally { setBusy(false) }
  }

  return (
    <>
      <button type="button" className="master-bill-field__copy" onClick={() => setOpen(true)} title="Share live tracking" aria-label="Share live tracking">
        <Share2 size={15} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg min-w-0">
          <DialogHeader>
            <DialogTitle>Share live tracking · {bookingRef}</DialogTitle>
            <DialogDescription>
              Anyone with the link sees ETA, vessel position and milestones. No client name, job number or charges.
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0 }}>
            <button type="button" className="btn btn--inline" onClick={() => void create()} disabled={busy}
              title="Create new link (valid 90 days)" aria-label="Create new link"
              style={{ ...iconBtn, width: 36, height: 36, padding: 0, borderRadius: 8 }}>
              <Plus size={16} />
            </button>
            <span className="muted" style={{ fontSize: 12, margin: 0 }}>{links.length} active link{links.length === 1 ? '' : 's'}</span>
          </div>

          {links.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>No active links. Create one to share with the customer.</p>
          ) : (
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, margin: 0, padding: 0, listStyle: 'none' }}>
              {links.map((l) => (
                <li key={l.id} style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 6px 8px 12px', display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="mono" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={shareUrl(l.token)}>{shareUrl(l.token)}</div>
                    <div className="muted" style={{ fontSize: 11 }}>
                      Created {fmtDate(l.created_at)} · {l.view_count} view{l.view_count === 1 ? '' : 's'}
                      {l.last_viewed_at ? ` · last ${fmtDate(l.last_viewed_at)}` : ''} · expires {fmtDate(l.expires_at)}
                    </div>
                  </div>
                  <button type="button" className="icon-btn" style={iconBtn} onClick={() => void copy(l)} title="Copy link" aria-label="Copy link">
                    {copiedId === l.id ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                  <a className="icon-btn" style={iconBtn} href={shareUrl(l.token)} target="_blank" rel="noreferrer" title="Open customer view" aria-label="Open customer view">
                    <ExternalLink size={15} />
                  </a>
                  <button type="button" className="icon-btn" style={{ ...iconBtn, color: '#b42318' }} onClick={() => void revoke(l)} disabled={busy}
                    title="Turn off link" aria-label="Turn off link">
                    <Link2Off size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
