import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { fetchGlobalRateRules, saveRateRules, type RateRulesDoc } from './ratesApi'

export default function RateRulesPage() {
  const [loading, setLoading] = useState(true)
  const [doc, setDoc] = useState<RateRulesDoc | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const d = await fetchGlobalRateRules()
        if (cancelled) return
        setDoc(d); setTitle(d.title); setContent(d.content)
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const dirty = !!doc && (title !== doc.title || content !== doc.content)

  async function save() {
    if (!doc || saving || !dirty) return
    setSaving(true)
    try {
      const updatedAt = await saveRateRules(doc.id, { title, content })
      setDoc({ ...doc, title, content, updated_at: updatedAt })
      toast.success('Rules saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="quotes-page"><div className="card quotes-page__card">Loading…</div></div>

  const labelStyle = { fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)' }
  const updated = doc?.updated_at ? new Date(doc.updated_at).toLocaleString() : '—'

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <header className="quotes-page__head">
          <Link to="/setup/rates" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted-foreground)', textDecoration: 'none', marginBottom: 8 }}>
            <ArrowLeft size={15} /> Rates
          </Link>
          <h1>Rules</h1>
        </header>

        <p className="text-muted-foreground" style={{ fontSize: 13, margin: '0 0 16px', maxWidth: 720 }}>
          House rules for reading rate cards — carrier quirks, port-name conventions, surcharge conditions, default assumptions. This document is read verbatim by the AI parser when it processes an uploaded rate card, so write it as clear plain-English / markdown instructions.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 720, marginBottom: 16 }}>
          <label style={labelStyle}>Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={labelStyle}>Rules (markdown)</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%', minHeight: 420, resize: 'vertical',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: 13, lineHeight: 1.6, padding: '12px 14px',
              border: '1px solid var(--color-line)', borderRadius: 8,
              background: 'var(--color-surface)', color: 'var(--color-ink)', outline: 'none',
            }}
            placeholder={'# House rules\n\n- Matson: rates are per container, USD\n- Treat "Suva" / "SUV" as FJSUV, "Lautoka" / "LTK" as FJLTK\n- WRS applies Jun–Sep only'}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14 }}>
          <button type="button" className="btn btn--inline" onClick={save} disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save rules'}
          </button>
          <span className="text-muted-foreground" style={{ fontSize: 12 }}>Last updated: {updated}</span>
        </div>

        {err && <p style={{ color: '#B23B3B', fontSize: 13, marginTop: 10 }}>{err}</p>}
      </div>
    </div>
  )
}
