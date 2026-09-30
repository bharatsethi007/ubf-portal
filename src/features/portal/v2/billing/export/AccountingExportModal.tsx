import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Loader2, X } from 'lucide-react'
import DateField from '../../../../../components/DateField'
import { addDays, todayIso } from '../../homeModel'
import { download, type BillInvoice } from '../billingApi'
import BrandMark from './BrandMark'
import { DEFAULTS, loadLines, loadSettings, myobCsv, saveSettings, xeroCsv, type ExportSettings, type Target } from './accountingExport'
import '../../contacts/contacts.css'
import './accountingExport.css'

type Props = { target: Target; rows: BillInvoice[]; onClose: () => void }

const NAME: Record<Target, string> = { xero: 'Xero', myob: 'MYOB' }
const STEPS: Record<Target, string[]> = {
  xero: ['In Xero go to Business, Bills to pay, Import.', 'Choose this file and set amounts to Tax exclusive.', 'Review the bills and approve them.'],
  myob: ['In MYOB go to Settings, Import data, Purchases.', 'Choose this file as a comma separated service purchase import.', 'Match the fields, then import.'],
}
const HINT: Record<Target, Record<keyof ExportSettings, string>> = {
  xero: { accountCode: 'Your freight expense account, e.g. 425', taxStandard: 'Exact name of your 15% purchases rate', taxZero: 'Rate for zero-rated charges', supplier: 'Must match the contact in Xero' },
  myob: { accountCode: 'Your freight expense account, e.g. 6-1100', taxStandard: 'Tax code for 15% GST', taxZero: 'Tax code for zero-rated', supplier: 'Must match the supplier card in MYOB' },
}

/** Bills file for the customer's own ledger. Settings stick for next time. */
export default function AccountingExportModal({ target, rows, onClose }: Props) {
  const [s, setS] = useState<ExportSettings>(() => loadSettings(target))
  const [from, setFrom] = useState(addDays(todayIso(), -31))
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)
  const [err, setErr] = useState('')
  const picked = useMemo(() => rows.filter((r) => !from || r.doc_date >= from), [rows, from])
  const set = (k: keyof ExportSettings, v: string) => setS((x) => ({ ...x, [k]: v }))

  async function run() {
    if (!picked.length) { setErr('No invoices in that range.'); return }
    if (!s.accountCode.trim() || !s.taxStandard.trim() || !s.taxZero.trim()) { setErr('Fill in the account and tax settings.'); return }
    setBusy(true); setErr(''); setDone(0)
    try {
      saveSettings(target, s)
      const data = await loadLines(picked, setDone)
      const csv = target === 'xero' ? xeroCsv(data, s) : myobCsv(data, s)
      download(`ub-freight-bills-${target}-${todayIso()}.csv`, new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Export failed')
    } finally { setBusy(false) }
  }

  const field = (k: keyof ExportSettings, label: string) => (
    <div className="pv3-field"><label htmlFor={`ax-${k}`}>{label}</label>
      <input id={`ax-${k}`} value={s[k]} onChange={(e) => set(k, e.target.value)} placeholder={DEFAULTS[target][k]} />
      <span className="pv3-muted" style={{ fontSize: 12 }}>{HINT[target][k]}</span>
    </div>
  )

  return createPortal(
    <div className="pv3-modal" role="dialog" aria-modal="true" aria-label={`Export to ${NAME[target]}`}>
      <button type="button" className="pv3-modal__scrim" aria-label="Close" onClick={() => !busy && onClose()} />
      <div className="pv3-modal__panel">
        <header className="pv3-modal__head">
          <div className="pv3-ax__title">
            <span className="pv3-xmenu__ico"><BrandMark brand={target} /></span>
            <div><h2>Export bills to {NAME[target]}</h2><p>Your UB Freight invoices as supplier bills, with every charge line and the right GST.</p></div>
          </div>
          <button type="button" className="pv3-iconbtn" onClick={onClose} aria-label="Close" disabled={busy}><X size={16} /></button>
        </header>
        <div className="pv3-modal__body pv3-form">
          <div className="pv3-form__grid">
            <div className="pv3-field"><label>Invoices dated from</label>
              <DateField value={from || null} onChange={(v) => setFrom(v)} width="100%" placeholder="All dates" />
              <span className="pv3-muted" style={{ fontSize: 12 }}>{picked.length} invoice{picked.length === 1 ? '' : 's'} from the list on screen</span>
            </div>
            {field('supplier', 'Supplier name')}
          </div>
          <div className="pv3-form__grid">
            {field('accountCode', 'Expense account')}
            {field('taxStandard', 'Tax for GST charges')}
            {field('taxZero', 'Tax for GST-free charges')}
          </div>
          <div className="pv3-ax__steps">
            <b>Then in {NAME[target]}</b>
            <ol>{STEPS[target].map((x) => <li key={x}>{x}</li>)}</ol>
          </div>
        </div>
        <footer className="pv3-modal__foot">
          {err && <span className="pv3-form__err" role="alert">{err}</span>}
          {busy && <span className="pv3-muted" style={{ marginRight: 'auto', fontSize: 13 }}>Preparing {done} of {picked.length}…</span>}
          <button type="button" className="pv3-textbtn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="pv3-btn pv3-btn--primary" disabled={busy || !picked.length} onClick={() => void run()}>
            {busy ? <Loader2 size={14} className="pv3-spin" /> : <Download size={14} />} Download {NAME[target]} file
          </button>
        </footer>
      </div>
    </div>,
    document.querySelector('.pv2-root') ?? document.body,
  )
}
