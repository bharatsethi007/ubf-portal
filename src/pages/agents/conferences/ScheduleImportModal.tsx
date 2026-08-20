import { useState, type ChangeEvent } from 'react'
import * as XLSX from 'xlsx'
import { FileSpreadsheet, ImageIcon, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import ScheduleImportReviewTable from './ScheduleImportReviewTable'
import {
  commitParsedMeetings,
  parseScheduleImage,
  parseScheduleSheet,
  toReviewRows,
  type ReviewMeetingRow,
} from './scheduleImportApi'
import './scheduleImport.css'

type Props = {
  conferenceId: string
  days: string[]
  defaultMinutes: number
  onClose: () => void
  onImported: () => void
}

type Step = 'upload' | 'review'

async function readExcelSheet(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' })
}

async function readImageBase64(file: File): Promise<{ media_type: string; data_base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1] ?? ''
      resolve({ media_type: file.type || 'image/jpeg', data_base64: base64 })
    }
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.readAsDataURL(file)
  })
}

export default function ScheduleImportModal({
  conferenceId,
  days,
  defaultMinutes,
  onClose,
  onImported,
}: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [rows, setRows] = useState<ReviewMeetingRow[]>([])

  const selectedCount = rows.filter((r) => r.included).length
  const busy = parsing || importing

  async function handleExcel(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setParsing(true)
    try {
      const sheet = await readExcelSheet(file)
      const parsed = await parseScheduleSheet(conferenceId, days, defaultMinutes, sheet)
      if (!parsed.length) {
        toast.error('No meetings found in the sheet')
        return
      }
      setRows(toReviewRows(parsed))
      setStep('review')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to parse schedule')
    } finally {
      setParsing(false)
    }
  }

  async function handleImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setParsing(true)
    try {
      const image = await readImageBase64(file)
      const parsed = await parseScheduleImage(conferenceId, days, defaultMinutes, image)
      if (!parsed.length) {
        toast.error('No meetings found in the image')
        return
      }
      setRows(toReviewRows(parsed))
      setStep('review')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to parse schedule')
    } finally {
      setParsing(false)
    }
  }

  async function importSelected() {
    const selected = rows.filter((r) => r.included)
    if (!selected.length) {
      toast.error('Select at least one meeting to import')
      return
    }
    setImporting(true)
    try {
      const n = await commitParsedMeetings(conferenceId, selected)
      toast.success(`${n} meetings imported`)
      onImported()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="agent-modal-backdrop" onClick={() => !busy && onClose()}>
      <div
        className="agent-modal sched-import-modal"
        style={{ maxWidth: 720 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="agent-modal__head">
          <h2>AI schedule import</h2>
          <button type="button" className="agent-modal__close" aria-label="Close" onClick={onClose} disabled={busy}>
            <X size={18} />
          </button>
        </div>

        {step === 'upload' && (
          <div className="sched-import-upload">
            <p className="text-muted-foreground agent-modal__hint">
              Upload an Excel schedule or a photo of the printed agenda. AI will extract meetings for review before import.
            </p>
            <div className="sched-import-upload__options">
              <label className="btn btn--inline sched-import-upload__btn">
                <FileSpreadsheet size={16} />
                Excel / CSV
                <input type="file" accept=".xlsx,.xls,.csv" hidden disabled={busy} onChange={(e) => void handleExcel(e)} />
              </label>
              <label className="btn btn--inline sched-import-upload__btn">
                <ImageIcon size={16} />
                Photo
                <input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => void handleImage(e)} />
              </label>
            </div>
            {parsing && (
              <p className="sched-import-upload__busy">
                <Loader2 size={16} className="sched-import-spin" />
                Reading schedule with AI…
              </p>
            )}
          </div>
        )}

        {step === 'review' && (
          <>
            <ScheduleImportReviewTable rows={rows} days={days} onChange={setRows} />
            <div className="agent-modal__actions sched-import-review__actions">
              <span className="text-muted-foreground">{selectedCount} selected</span>
              <button type="button" className="btn btn--inline" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="btn quotes-page__new-btn" onClick={() => void importSelected()} disabled={busy}>
                {importing ? 'Importing…' : 'Import selected'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
