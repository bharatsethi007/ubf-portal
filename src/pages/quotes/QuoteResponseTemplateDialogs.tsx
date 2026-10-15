import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { deleteChargeTemplate, type ChargeTemplate } from '../setup/chargeTemplatesApi'
import { useEffect, useMemo, useState } from 'react'
import { Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

type Props = {
  templates: ChargeTemplate[]
  useTplOpen: boolean
  onUseTplOpenChange: (open: boolean) => void
  saveTplOpen: boolean
  onSaveTplOpenChange: (open: boolean) => void
  newTplName: string
  onNewTplNameChange: (name: string) => void
  savingTpl: boolean
  applyingTpl: boolean
  onApplyTemplate: (t: ChargeTemplate) => void
  onSaveTemplate: () => void
  onTemplatesChanged?: () => void
}

const TPL_DIALOG_Z = 'z-[110]'

export default function QuoteResponseTemplateDialogs({
  templates,
  useTplOpen,
  onUseTplOpenChange,
  saveTplOpen,
  onSaveTplOpenChange,
  newTplName,
  onNewTplNameChange,
  savingTpl,
  applyingTpl,
  onApplyTemplate,
  onSaveTemplate,
  onTemplatesChanged,
}: Props) {
  return (
    <>
      <UseTemplateDialog
        open={useTplOpen}
        onOpenChange={onUseTplOpenChange}
        templates={templates}
        applying={applyingTpl}
        onApply={onApplyTemplate}
        onChanged={onTemplatesChanged}
      />

      <Dialog open={saveTplOpen} onOpenChange={onSaveTplOpenChange}>
        <DialogContent className={`sm:max-w-md ${TPL_DIALOG_Z}`} overlayClassName={TPL_DIALOG_Z}>
          <DialogHeader>
            <DialogTitle>Save charge lines as template</DialogTitle>
          </DialogHeader>
          <input
            className="qrl-in"
            placeholder="Template name"
            value={newTplName}
            onChange={(e) => onNewTplNameChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !savingTpl && newTplName.trim() && onSaveTemplate()}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onSaveTplOpenChange(false)}>Cancel</Button>
            <Button type="button" disabled={!newTplName.trim() || savingTpl} onClick={onSaveTemplate}>
              {savingTpl ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

type UseProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  templates: ChargeTemplate[]
  applying: boolean
  onApply: (t: ChargeTemplate) => void
  onChanged?: () => void
}

// Searchable, scrollable template picker. Delete asks inline before removing.
function UseTemplateDialog({ open, onOpenChange, templates, applying, onApply, onChanged }: UseProps) {
  const [q, setQ] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  useEffect(() => { if (open) { setQ(''); setConfirmId(null) } }, [open])
  useEffect(() => { setHidden(new Set()) }, [templates])

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return templates.filter((x) => !hidden.has(x.id) && (!t || x.name.toLowerCase().includes(t)))
  }, [templates, q, hidden])

  async function remove(t: ChargeTemplate) {
    setBusyId(t.id)
    try {
      await deleteChargeTemplate(t.id)
      setHidden((h) => new Set(h).add(t.id))
      toast.success(`Deleted "${t.name}"`)
      onChanged?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusyId(null)
      setConfirmId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-lg ${TPL_DIALOG_Z} flex max-h-[80vh] flex-col gap-3 overflow-hidden`} overlayClassName={TPL_DIALOG_Z}>
        <DialogHeader>
          <DialogTitle>Use a charge template</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            className="qrl-in w-full pl-8"
            placeholder={`Search ${templates.length} templates`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && list.length === 1 && !applying) onApply(list[0]) }}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-slate-200">
          {list.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-slate-400">{templates.length ? 'No match' : 'No templates yet'}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {list.map((t) => (
                <li key={t.id} className="group flex items-center gap-2 px-3 py-2 hover:bg-slate-50">
                  <button
                    type="button"
                    disabled={applying || busyId === t.id}
                    onClick={() => onApply(t)}
                    className="min-w-0 flex-1 text-left text-[13px] text-slate-800 disabled:opacity-50"
                    title={t.name}
                  >
                    <span className="block truncate">{t.name}</span>
                  </button>
                  {t.line_count != null && <span className="shrink-0 text-[11px] text-slate-400">{t.line_count} lines</span>}
                  {confirmId === t.id ? (
                    <span className="flex shrink-0 items-center gap-1 text-[11px]">
                      <span className="text-slate-500">Delete?</span>
                      <button type="button" className="rounded px-1.5 py-0.5 text-red-700 hover:bg-red-50" disabled={busyId === t.id} onClick={() => void remove(t)}>
                        {busyId === t.id ? '…' : 'Yes'}
                      </button>
                      <button type="button" className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-100" onClick={() => setConfirmId(null)}>No</button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="icon-btn shrink-0 text-slate-400 opacity-0 hover:text-red-600 group-hover:opacity-100"
                      title="Delete template"
                      aria-label={`Delete ${t.name}`}
                      onClick={() => setConfirmId(t.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
