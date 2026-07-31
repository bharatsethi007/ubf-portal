import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ChargeTemplate } from '../setup/chargeTemplatesApi'

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
}: Props) {
  return (
    <>
      <Dialog open={useTplOpen} onOpenChange={onUseTplOpenChange}>
        <DialogContent className={`sm:max-w-md ${TPL_DIALOG_Z}`} overlayClassName={TPL_DIALOG_Z}>
          <DialogHeader>
            <DialogTitle>Use a charge template</DialogTitle>
          </DialogHeader>
          {templates.length === 0 ? (
            <p className="qrl-tpl-empty">No templates yet</p>
          ) : (
            <ul className="qrl-tpl-list">
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="qrl-tpl-row"
                    disabled={applyingTpl}
                    onClick={() => onApplyTemplate(t)}
                  >
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

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
