import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Save, Send } from 'lucide-react'
import { type AlertSettings as Settings, saveAlertSettings, sendTestAlert } from './logsApi'

const RULES = [
  ['API down', 'Last 2 probes failed (15 min apart)'],
  ['API failing', '5+ calls and half failing in 30 min'],
  ['TWF sync late', 'No run within the late threshold'],
  ['TWF sync failed', 'Latest run ended in error'],
  ['Job failing', 'A scheduled job failed twice running'],
  ['Database', 'Connections or size over 85%'],
]

export default function AlertSettings({ settings, isAdmin, onSaved }: { settings: Settings; isAdmin: boolean; onSaved: () => void }) {
  const [enabled, setEnabled] = useState(settings.enabled)
  const [emails, setEmails] = useState(settings.emails.join('\n'))
  const [hours, setHours] = useState(settings.sync_late_hours)
  const [resolved, setResolved] = useState(settings.notify_resolved)
  const [busy, setBusy] = useState<'save' | 'test' | null>(null)

  useEffect(() => {
    setEnabled(settings.enabled); setEmails(settings.emails.join('\n'))
    setHours(settings.sync_late_hours); setResolved(settings.notify_resolved)
  }, [settings])

  const save = async () => {
    setBusy('save')
    try {
      const list = emails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean)
      await saveAlertSettings({ enabled, emails: list, sync_late_hours: hours, notify_resolved: resolved })
      toast.success('Alert settings saved'); onSaved()
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)) } finally { setBusy(null) }
  }
  const test = async () => {
    setBusy('test')
    try {
      const r = await sendTestAlert()
      if (!r.ok) throw new Error(r.error ?? 'Send failed')
      toast.success(`Test sent to ${r.to.join(', ')} and your bell`)
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)) } finally { setBusy(null) }
  }

  return (
    <div className="bs-panel">
      <div className="bs-ph"><h2>Alert settings</h2>{!isAdmin && <small>Admins can edit</small>}</div>
      <div style={{ padding: 16 }}>
        <label className="bs-toggle" style={{ marginBottom: 16 }}>
          <input type="checkbox" checked={enabled} disabled={!isAdmin} onChange={(e) => setEnabled(e.target.checked)} />
          Send alert emails
        </label>
        <div className="bs-field">
          <label htmlFor="al-emails">Email recipients</label>
          <textarea id="al-emails" className="bs-input" value={emails} disabled={!isAdmin} onChange={(e) => setEmails(e.target.value)} />
          <small>One per line. Admins also get every alert in their bell.</small>
        </div>
        <div className="bs-field">
          <label htmlFor="al-hours">TWF sync late after</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input id="al-hours" type="number" min={1} max={72} className="bs-input" style={{ width: 80 }} value={hours}
              disabled={!isAdmin} onChange={(e) => setHours(Number(e.target.value) || 3)} />
            <span style={{ color: 'var(--muted)' }}>hours. Critical after 24h.</span>
          </div>
        </div>
        <label className="bs-toggle" style={{ marginBottom: 18 }}>
          <input type="checkbox" checked={resolved} disabled={!isAdmin} onChange={(e) => setResolved(e.target.checked)} />
          Also email when an alert resolves
        </label>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <button type="button" className="bs-btn bs-ib" title="Send test alert" aria-label="Send test alert" onClick={test} disabled={busy != null}>
            <Send size={14} />
          </button>
          {isAdmin && (
            <button type="button" className="bs-btn bs-btn--p bs-ib" title="Save settings" aria-label="Save settings" onClick={save} disabled={busy != null}>
              <Save size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="bs-ph" style={{ borderTop: '1px solid var(--line-soft)' }}><h2>Rules</h2><small>Checked every 5 min</small></div>
      <div style={{ padding: '6px 16px 14px' }}>
        {RULES.map(([t, d]) => (
          <div key={t} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--line-soft)', fontSize: 12.5 }}>
            <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{t}</span><span style={{ color: 'var(--muted)', textAlign: 'right' }}>{d}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
