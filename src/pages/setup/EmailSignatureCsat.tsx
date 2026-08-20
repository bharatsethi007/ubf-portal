import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Download } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../supabase'
import {
  buildEmailSignatureHtml,
  copyEmailSignature,
  copyEmailSignatureHtml,
  downloadEmailSignature,
  EMAIL_SIGNATURE_CSAT_BASE,
} from './emailSignatureCsatHtml'

const ACCENT = '#3B5BFE'

type StaffRow = { user_id: string; initials: string | null; email: string | null }

export default function EmailSignatureCsat() {
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('staff_users')
        .select('user_id, initials, email')
        .order('initials')
      if (cancelled) return
      if (error) {
        toast.error(error.message)
        setStaff([])
      } else {
        setStaff((data ?? []) as StaffRow[])
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const selected = useMemo(
    () => staff.find((s) => s.user_id === selectedId) ?? null,
    [staff, selectedId],
  )

  const initials = selected?.initials?.trim() ?? ''
  const sig = initials ? buildEmailSignatureHtml(initials) : ''

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <Link to="/setup" style={{ color: ACCENT, fontSize: 13, textDecoration: 'none' }}>← Setup</Link>
        <header className="quotes-page__head" style={{ marginTop: 8 }}>
          <h1>Email signature CSAT</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted-foreground)', fontSize: 14 }}>
            Generate emoji rating links for staff email signatures. Set{' '}
            <code>EMAIL_SIGNATURE_CSAT_BASE</code> in{' '}
            <code>emailSignatureCsatHtml.ts</code> to your deployed portal domain.
          </p>
        </header>

        <div className="table-wrap">
          <table className="data-table data-table--compact">
            <thead>
              <tr>
                <th style={{ width: 48 }} />
                <th>Initials</th>
                <th>Email</th>
                <th>User ID</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="text-muted-foreground">Loading staff…</td></tr>
              ) : staff.length === 0 ? (
                <tr><td colSpan={4} className="text-muted-foreground">No staff users found.</td></tr>
              ) : staff.map((s) => (
                <tr key={s.user_id} className="row-clickable" onClick={() => setSelectedId(s.user_id)}>
                  <td>
                    <input
                      type="radio"
                      name="staff"
                      checked={selectedId === s.user_id}
                      onChange={() => setSelectedId(s.user_id)}
                      aria-label={`Select ${s.initials ?? s.email}`}
                    />
                  </td>
                  <td>{s.initials?.trim() || '—'}</td>
                  <td>{s.email ?? '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{s.user_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && !initials && (
          <p style={{ color: '#B4791F', fontSize: 13, marginTop: 16 }}>
            This staff member has no initials — set initials on their staff profile before generating a signature.
          </p>
        )}

        {initials && (
          <section style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Signature for {initials}</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button
                  type="button"
                  className="btn"
                  style={{ marginTop: 0 }}
                  onClick={() => copyEmailSignature(sig)}
                >
                  Copy signature
                </button>
                <button
                  type="button"
                  className="btn btn--inline"
                  style={{ marginTop: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => copyEmailSignatureHtml(sig)}
                >
                  <Copy size={15} /> Copy HTML code
                </button>
                <button
                  type="button"
                  className="btn btn--inline"
                  style={{ marginTop: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => downloadEmailSignature(sig, initials)}
                >
                  <Download size={15} /> Download .htm
                </button>
              </div>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600 }}>Preview</h3>
              <div
                id="sig-preview"
                style={{
                  padding: 16,
                  background: '#fff',
                  border: '1px solid var(--color-line)',
                  borderRadius: 8,
                }}
                dangerouslySetInnerHTML={{ __html: sig }}
              />
              <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>
                Base URL: <code>{EMAIL_SIGNATURE_CSAT_BASE}</code>
              </p>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted-foreground)' }}>
              HTML source
              <textarea className="input input--sm" readOnly rows={5} value={sig} style={{ fontFamily: 'monospace', fontSize: 11 }} />
            </label>
          </section>
        )}
      </div>
    </div>
  )
}
