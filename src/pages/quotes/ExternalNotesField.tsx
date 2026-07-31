import { useCallback, useEffect, useState } from 'react'
import { LayoutTemplate, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createNoteTemplate, fetchNoteTemplates, type NoteTemplate } from './noteTemplatesApi'
import './externalNotesField.css'

type Props = {
  value: string
  onChange: (value: string) => void
}

function oneLinePreview(body: string): string {
  return body.replace(/\s+/g, ' ').trim()
}

export default function ExternalNotesField({ value, onChange }: Props) {
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [saveTplOpen, setSaveTplOpen] = useState(false)
  const [templates, setTemplates] = useState<NoteTemplate[]>([])
  const [newTplName, setNewTplName] = useState('')
  const [savingTpl, setSavingTpl] = useState(false)

  const loadTemplates = useCallback(async () => {
    const list = await fetchNoteTemplates('external')
    setTemplates(list)
  }, [])

  useEffect(() => {
    loadTemplates().catch(() => {})
  }, [loadTemplates])

  useEffect(() => {
    if (templatesOpen) loadTemplates().catch(() => toast.error('Could not load templates'))
  }, [templatesOpen, loadTemplates])

  const insertTemplate = (t: NoteTemplate) => {
    const cur = value
    onChange(cur.trim() ? `${cur}\n${t.body}` : t.body)
    setTemplatesOpen(false)
    toast.success('Template inserted')
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert a template</DialogTitle>
          </DialogHeader>
          {templates.length === 0 ? (
            <p className="nqd-tpl-empty">No templates yet</p>
          ) : (
            <ul className="nqd-tpl-list">
              {templates.map((t) => (
                <li key={t.id}>
                  <button type="button" className="nqd-tpl-row" onClick={() => insertTemplate(t)}>
                    <span className="nqd-tpl-name">{t.name}</span>
                    <span className="nqd-tpl-preview">{oneLinePreview(t.body)}</span>
                  </button>
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
