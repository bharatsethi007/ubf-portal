import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import QuoteResponseLinesGrid from '../quotes/QuoteResponseLinesGrid'
import { newQuoteResponseLine, type QuoteResponseLine } from '../quotes/quoteResponseLinesApi'
import {
  createChargeTemplate,
  deleteChargeTemplate,
  fetchChargeTemplateLines,
  fetchChargeTemplates,
  updateChargeTemplate,
  type ChargeTemplate,
} from './chargeTemplatesApi'

const ACCENT = '#3B5BFE'

export default function ChargeTemplatesPage() {
  const [templates, setTemplates] = useState<ChargeTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftLines, setDraftLines] = useState<QuoteResponseLine[]>([])
  const [saving, setSaving] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(false)

  const reload = useCallback(async () => {
    setTemplates(await fetchChargeTemplates())
  }, [])

  useEffect(() => {
    reload()
      .catch(() => toast.error('Failed to load charge templates'))
      .finally(() => setLoading(false))
  }, [reload])

  const cancelEdit = () => {
    setEditingId(null)
    setDraftName('')
    setDraftLines([])
  }

  const startNew = () => {
    setEditingId('new')
    setDraftName('')
    setDraftLines([newQuoteResponseLine(0, 'NZD')])
  }

  const startEdit = async (t: ChargeTemplate) => {
    setLoadingEdit(true)
    setEditingId(t.id)
    setDraftName(t.name)
    try {
      const lines = await fetchChargeTemplateLines(t.id)
      setDraftLines(lines.length ? lines : [newQuoteResponseLine(0, 'NZD')])
    } catch {
      toast.error('Failed to load template lines')
      setEditingId(null)
    } finally {
      setLoadingEdit(false)
    }
  }

  const handleSave = async () => {
    const name = draftName.trim()
    if (!name) {
      toast.error('Template name is required')
      return
    }
    setSaving(true)
    try {
      if (editingId === 'new') {
        await createChargeTemplate(name, draftLines)
        toast.success('Template created')
      } else if (editingId) {
        await updateChargeTemplate(editingId, name, draftLines)
        toast.success('Template saved')
      }
      await reload()
      cancelEdit()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (t: ChargeTemplate) => {
    if (!window.confirm(`Delete template "${t.name}"?`)) return
    try {
      await deleteChargeTemplate(t.id)
      await reload()
      toast.success('Template deleted')
      if (editingId === t.id) cancelEdit()
    } catch {
      toast.error('Could not delete template')
    }
  }

  if (editingId) {
    return (
      <div className="quotes-page">
        <div className="card quotes-page__card">
          <Link to="/setup" style={{ color: ACCENT, fontSize: 13, textDecoration: 'none' }}>← Setup</Link>
          <header className="quotes-page__head" style={{ marginTop: 8 }}>
            <h1>{editingId === 'new' ? 'New charge template' : 'Edit charge template'}</h1>
          </header>

          {loadingEdit ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <>
              <label style={{ display: 'block', marginBottom: 16 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Template name</span>
                <input
                  className="input"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="e.g. Standard FCL import charges"
                  style={{ maxWidth: 420 }}
                />
              </label>

              <QuoteResponseLinesGrid lines={draftLines} currency="NZD" onChange={setDraftLines} />

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  type="button"
                  className="nqd-btn nqd-btn--accent"
                  style={{ background: ACCENT, borderColor: ACCENT }}
                  disabled={saving || !draftName.trim()}
                  onClick={() => void handleSave()}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="nqd-btn nqd-btn--ghost" disabled={saving} onClick={cancelEdit}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <Link to="/setup" style={{ color: ACCENT, fontSize: 13, textDecoration: 'none' }}>← Setup</Link>
        <header className="quotes-page__head" style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h1 style={{ margin: 0 }}>Charge templates</h1>
          <button
            type="button"
            className="nqd-btn nqd-btn--accent"
            style={{ background: ACCENT, borderColor: ACCENT }}
            onClick={startNew}
          >
            <Plus size={16} aria-hidden />
            New template
          </button>
        </header>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : templates.length === 0 ? (
          <p className="text-muted-foreground" style={{ marginTop: 16 }}>No templates yet.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>Name</th>
                  <th style={{ width: 80 }}>Lines</th>
                  <th style={{ width: 120 }} />
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td className="mono">{t.line_count ?? '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button type="button" className="icon-btn" title="Edit" onClick={() => void startEdit(t)}>
                          <Pencil size={14} aria-hidden />
                        </button>
                        <button type="button" className="icon-btn" title="Delete" onClick={() => void handleDelete(t)}>
                          <Trash2 size={14} aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
