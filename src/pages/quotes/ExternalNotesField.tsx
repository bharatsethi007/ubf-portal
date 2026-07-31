import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import { LayoutTemplate, Pencil, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  createNoteTemplate,
  deleteNoteTemplate,
  fetchNoteTemplates,
  updateNoteTemplate,
  type NoteTemplate,
} from './noteTemplatesApi'
import './externalNotesField.css'

type Props = {
  value: string
  onChange: (value: string) => void
}

function oneLinePreview(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  return flat.length > 120 ? `${flat.slice(0, 120)}…` : flat
}

export default function ExternalNotesField({ value, onChange }: Props) {
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [saveTplOpen, setSaveTplOpen] = useState(false)
  const [templates, setTemplates] = useState<NoteTemplate[]>([])
  const [newTplName, setNewTplName] = useState('')
  const [savingTpl, setSavingTpl] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editBody, setEditBody] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const loadTemplates = useCallback(async () => {
    const list = await fetchNoteTemplates('external')
    setTemplates(list)
  }, [])

  const clearEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditBody('')
  }

  useEffect(() => {
    loadTemplates().catch(() => {})
  }, [loadTemplates])

  useEffect(() => {
    if (templatesOpen) loadTemplates().catch(() => toast.error('Could not load templates'))
    else clearEdit()
  }, [templatesOpen, loadTemplates])

  const insertTemplate = (t: NoteTemplate) => {
    const cur = value
    onChange(cur.trim() ? `${cur}\n${t.body}` : t.body)
    setTemplatesOpen(false)
    toast.success('Template inserted')
  }

  const startEdit = (t: NoteTemplate) => {
    setEditingId(t.id)
    setEditName(t.name)
    setEditBody(t.body)
  }

  const handleUpdateTemplate = async () => {
    if (!editingId || !editName.trim()) return
    setSavingEdit(true)
    try {
      await updateNoteTemplate(editingId, editName.trim(), editBody)
      await loadTemplates()
      clearEdit()
      toast.success('Template updated')
    } catch {
      toast.error('Could not update template')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDeleteTemplate = async (t: NoteTemplate, e: MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(`Delete template "${t.name}"?`)) return
    try {
      await deleteNoteTemplate(t.id)
      if (editingId === t.id) clearEdit()
      await loadTemplates()
      toast.success('Template deleted')
    } catch {
      toast.error('Could not delete template')
    }
  }

  const handleSaveTemplate = async () => {
    const name = newTplName.trim()
    if (!name) return
    setSavingTpl(true)
    try {
      await createNoteTemplate(name, value, 'external')
      await loadTemplates()
      setSaveTplOpen(false)
      setNewTplName('')
      toast.success('Template saved')
    } catch {
      toast.error('Could not save template')
    } finally {
      setSavingTpl(false)
    }
  }

  const canSaveAsTpl = Boolean(value.trim())

  return (
    <div className="nqd-field">
      <div className="nqd-field__label-row">
        <span className="nqd-field__label nqd-field__label--inline">External notes (shown on quote)</span>
        <div className="nqd-note-actions">
          <button type="button" className="nqd-note-link" onClick={() => setTemplatesOpen(true)}>
            <LayoutTemplate size={14} aria-hidden />
            Templates
          </button>
          <button
            type="button"
            className="nqd-note-save"
            title="Save as template"
            aria-label="Save as template"
            disabled={!canSaveAsTpl}
            onClick={() => setSaveTplOpen(true)}
          >
            <Save size={16} />
          </button>
        </div>
      </div>
      <textarea
        className="nqd-input nqd-textarea nqd-textarea--scroll nqd-note-external"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="nqd-tpl-dialog sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Insert a template</DialogTitle>
          </DialogHeader>
          {templates.length === 0 ? (
            <p className="nqd-tpl-empty">No templates yet</p>
          ) : (
            <ul className="nqd-tpl-list">
              {templates.map((t) => (
                <li key={t.id} className="nqd-tpl-item">
                  {editingId === t.id ? (
                    <div className="nqd-tpl-edit">
                      <input
                        className="nqd-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Template name"
                      />
                      <textarea
                        className="nqd-input nqd-textarea nqd-tpl-edit-body"
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={3}
                      />
                      <div className="nqd-tpl-edit-actions">
                        <Button type="button" variant="outline" size="sm" onClick={clearEdit}>Cancel</Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={!editName.trim() || savingEdit}
                          onClick={() => void handleUpdateTemplate()}
                        >
                          {savingEdit ? 'Saving…' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="nqd-tpl-row">
                      <button type="button" className="nqd-tpl-text" onClick={() => insertTemplate(t)}>
                        <span className="nqd-tpl-name">{t.name}</span>
                        <span className="nqd-tpl-preview">{oneLinePreview(t.body)}</span>
                      </button>
                      <div className="nqd-tpl-actions">
                        <button
                          type="button"
                          className="nqd-tpl-icon-btn"
                          title="Edit template"
                          aria-label="Edit template"
                          onClick={(e) => { e.stopPropagation(); startEdit(t) }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="nqd-tpl-icon-btn nqd-tpl-icon-btn--danger"
                          title="Delete template"
                          aria-label="Delete template"
                          onClick={(e) => void handleDeleteTemplate(t, e)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={saveTplOpen} onOpenChange={setSaveTplOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
          </DialogHeader>
          <input
            className="nqd-input"
            placeholder="Template name"
            value={newTplName}
            onChange={(e) => setNewTplName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !savingTpl && newTplName.trim() && void handleSaveTemplate()}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSaveTplOpen(false)}>Cancel</Button>
            <Button type="button" disabled={!newTplName.trim() || savingTpl} onClick={() => void handleSaveTemplate()}>
              {savingTpl ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
