import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Container, FileUp, HelpCircle, Sparkles, ThumbsUp, Truck, Upload } from 'lucide-react'
import DateField from '../../../../components/DateField'
import { dayDiff, nzToday, shortDay, suggestDelivery, type PortalContainerDates, type PortalTask } from './portalActionsApi'
import { actionInsight } from './actionInsight'

type Props = {
  task: PortalTask
  /** Customer-facing shipment number + link. Omit on the shipment page itself. */
  ship?: { no: string; to: string } | null
  po?: string | null
  bookingRef?: string | null
  dates: PortalContainerDates[]
  busy: boolean
  docsTo?: string | null
  onRespond: (response: Record<string, unknown>) => Promise<boolean>
}

const ICON = {
  empty_ready: Container, confirm_delivery: Truck, upload_docs: FileUp, approve: ThumbsUp, question: HelpCircle, todo: Check,
} as const

function dueLine(due: string | null, today: string): { text: string; tone: string } | null {
  if (!due) return null
  const n = dayDiff(today, due)
  if (n < 0) return { text: `${-n} ${n === -1 ? 'day' : 'days'} overdue`, tone: 'text-red-600' }
  if (n === 0) return { text: 'Due today', tone: 'text-red-600' }
  if (n === 1) return { text: 'Due tomorrow', tone: 'text-amber-600' }
  return { text: `Due ${shortDay(due)}`, tone: 'text-slate-500' }
}

export default function TaskActionRow({ task, ship, po, bookingRef, dates, busy, docsTo, onRespond }: Props) {
  const today = nzToday()
  const mine = dates.filter((d) => d.booking_id === task.booking_id && (!task.container_no || d.container_no === task.container_no))
  const ldd = (task.payload?.last_detention_day as string | undefined) ?? mine[0]?.last_detention_day ?? null
  const [mode, setMode] = useState<'idle' | 'date'>('idle')
  const [date, setDate] = useState<string | null>(task.kind === 'confirm_delivery' ? suggestDelivery(mine, today) : null)
  const [windowSel, setWindowSel] = useState('Any time')
  const [text, setText] = useState('')
  const Icon = ICON[task.kind] ?? Check
  const due = dueLine(task.due_date, today)
  const docs = Array.isArray(task.payload?.docs) ? (task.payload.docs as string[]) : []
  const plannedOn = typeof task.response?.ready_on === 'string' ? task.response.ready_on : null
  const portLfd = mine.map((d) => d.port_last_free_day).filter((x): x is string => !!x).sort()[0] ?? null
  const limit = task.kind === 'confirm_delivery' ? portLfd : ldd
  const lateDate = Boolean(date && limit && date > limit)
  const boxes = [...new Set(mine.map((d) => d.container_no))]
  const tip = actionInsight(task, mine, task.kind === 'confirm_delivery' ? date : null, today)

  const send = (r: Record<string, unknown>) => void onRespond(r).then((ok) => { if (ok) { setMode('idle'); setText('') } })
  const btn = 'pv3-btn'
  const primary = `${btn} pv3-btn--primary`
  const ghost = `${btn} pv3-btn--ghost`

  return (
    <div className="flex flex-col gap-2 border-b border-slate-100 py-3 last:border-b-0 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Icon size={16} /></span>
        <div className="min-w-0">
          {ship
            ? <Link to={ship.to} className="block truncate text-sm font-medium text-slate-900 hover:underline">{task.title}</Link>
            : <div className="truncate text-sm font-medium text-slate-900">{task.title}</div>}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
            {ship ? <Link to={ship.to} className="pv3-mono font-medium text-slate-800 hover:underline">{ship.no}</Link>
              : bookingRef ? <span className="pv3-mono">{bookingRef}</span> : null}
            {po ? <span>PO <span className="pv3-mono text-slate-700">{po}</span></span> : null}
            {boxes.length > 0 ? <span className="pv3-mono text-slate-700">{boxes.join(', ')}</span> : null}
            {task.description ? <span>{task.description}</span> : null}
            {due ? <span className={due.tone}>{due.text}</span> : null}
          </div>
          {plannedOn ? <div className="text-xs text-slate-500">You said ready <b className="font-medium text-slate-700">{shortDay(plannedOn)}</b></div> : null}
          {docs.length > 0 ? <div className="text-xs text-slate-500">Needed: {docs.join(', ')}</div> : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {task.kind === 'empty_ready' && mode === 'idle' && (
          <>
            <button type="button" className={primary} disabled={busy} onClick={() => send({ ready: 'now' })}><Check size={14} /> Ready now</button>
            <button type="button" className={ghost} disabled={busy} onClick={() => setMode('date')}>{plannedOn ? 'Change date' : 'Pick a date'}</button>
          </>
        )}
        {task.kind === 'empty_ready' && mode === 'date' && (
          <>
            <DateField value={date} onChange={setDate} width={150} placeholder="Ready on" />
            <button type="button" className={primary} disabled={busy || !date || date < today} onClick={() => send({ ready_on: date })}>Confirm</button>
            <button type="button" className="pv3-textbtn" onClick={() => setMode('idle')}>Cancel</button>
          </>
        )}

        {task.kind === 'confirm_delivery' && (
          <>
            <DateField value={date} onChange={setDate} width={150} placeholder="Delivery date" />
            <select className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm" value={windowSel} onChange={(e) => setWindowSel(e.target.value)} aria-label="Delivery window">
              <option>Any time</option><option>Morning</option><option>Afternoon</option>
            </select>
            <button type="button" className={primary} disabled={busy || !date || date < today}
              onClick={() => send({ date, window: windowSel === 'Any time' ? null : windowSel })}><Check size={14} /> Confirm</button>
          </>
        )}

        {task.kind === 'upload_docs' && (
          <>
            {docsTo ? <Link to={docsTo} className={ghost}><Upload size={14} /> Upload</Link> : null}
            <button type="button" className={primary} disabled={busy} onClick={() => send({})}><Check size={14} /> Done</button>
          </>
        )}

        {task.kind === 'approve' && (
          <>
            <input className="h-9 w-40 rounded-lg border border-slate-200 px-2 text-sm" placeholder="Note (optional)" value={text} onChange={(e) => setText(e.target.value)} />
            <button type="button" className={primary} disabled={busy} onClick={() => send({ approved: true, note: text || null })}>Approve</button>
            <button type="button" className={ghost} disabled={busy} onClick={() => send({ approved: false, note: text || null })}>Decline</button>
          </>
        )}

        {task.kind === 'question' && (
          <>
            <input className="h-9 w-56 rounded-lg border border-slate-200 px-2 text-sm" placeholder="Your answer" value={text}
              onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) send({ answer: text.trim() }) }} />
            <button type="button" className={primary} disabled={busy || !text.trim()} onClick={() => send({ answer: text.trim() })}>Send</button>
          </>
        )}

        {task.kind === 'todo' && (
          <button type="button" className={primary} disabled={busy} onClick={() => send({})}><Check size={14} /> Mark done</button>
        )}
      </div>

      {tip ? (
        <div className="flex w-full items-start gap-2 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs leading-5 text-indigo-900 sm:order-last">
          <Sparkles size={14} className="mt-0.5 shrink-0 text-indigo-500" aria-hidden />
          <span>{tip}</span>
        </div>
      ) : null}

      {lateDate && (task.kind === 'empty_ready' || task.kind === 'confirm_delivery') ? (
        <p className="w-full text-xs text-amber-700 sm:order-last">
          {task.kind === 'empty_ready'
            ? `This is after free time ends (${shortDay(limit)}). Detention charges may apply.`
            : `This is after port free time ends (${shortDay(limit)}). Storage charges may apply.`}
        </p>
      ) : null}
    </div>
  )
}
