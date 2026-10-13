import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowRight, Building2, Check, ChevronDown, Mail, MessageCircle, MonitorSmartphone, Plane, Sparkles, Truck, User } from 'lucide-react'
import { dmy } from '@/features/bookingRecord/progress/progressApi'
import CustomerUpdateDialog, { type Channel } from '@/features/bookingRecord/progress/CustomerUpdateDialog'
import '@/features/bookingRecord/progress/progress.css'
import type { EaDetail, TmsJob } from '../useEaBooking'
import type { AirConsol } from '../eaTypes'
import { eaMilestones, eaPlan, eaProgress, type EaAction, type EaMilestone } from './eaProgress'

const OWNER_ICON = { ubf: Building2, customer: User, carrier: Plane, port: Truck } as const
const OWNER_LABEL = { ubf: 'UBF', customer: 'Supplier', carrier: 'Airline', port: 'Port' } as const
const KEY = 'bp-collapsed-ea'

function Step({ m, current, onAction }: { m: EaMilestone; current: boolean; onAction: (a: EaAction) => void }) {
  const Icon = OWNER_ICON[m.owner] ?? Building2
  const when = m.done ? dmy(m.at) : m.due ? `by ${dmy(m.due)}` : ''
  return (
    <div className={`bp-step bp-step--${m.state}${current ? ' bp-step--now' : ''}`}>
      <span className="bp-dot">{m.done ? <Check size={11} strokeWidth={3} /> : m.state === 'late' ? <AlertTriangle size={10} strokeWidth={2.6} /> : null}</span>
      <span className="bp-step__l">{m.label}</span>
      <span className="bp-step__w">{[when, m.note].filter(Boolean).join(' · ')}</span>
      {!m.done && <span className="bp-step__o" title={`Waiting on ${OWNER_LABEL[m.owner]}`}><Icon size={10} /> {OWNER_LABEL[m.owner]}</span>}
      {m.ctas.length ? (
        <span className="mt-1.5 flex flex-wrap gap-1">
          {m.ctas.map((c) => (
            <button key={c.label} type="button" disabled={c.disabled} title={c.title} onClick={() => onAction(c.action)}
              className={`inline-flex h-[22px] w-auto items-center rounded-full px-2 text-[10.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                c.tone === 'quiet' ? 'border border-[#D6DCE6] bg-white text-[#0A2472] hover:border-[#0A2472]'
                  : 'border border-[#0A2472] bg-[#0A2472] text-white hover:bg-[#081C5A]'}`}>
              {c.label}
            </button>
          ))}
        </span>
      ) : null}
    </div>
  )
}

type Props = { b: EaDetail; tms: TmsJob | null; best: AirConsol | undefined; onAction: (a: EaAction) => void; onChanged: () => void }

/** Import Sea style progress for export air: segmented bar, milestone track, one next step with its button. Collapsible. */
export default function EaProgressPanel({ b, tms, best, onAction, onChanged }: Props) {
  const ms = eaMilestones(b, tms)
  const p = eaProgress(b, ms)
  const plan = eaPlan(b, tms, best)
  const [fill, setFill] = useState(0)
  const [dialog, setDialog] = useState<Channel | null>(null)
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(KEY) === '1' } catch { return false } })
  const toggle = () => setCollapsed((c) => { try { localStorage.setItem(KEY, c ? '0' : '1') } catch { /* ignore */ } return !c })
  const currentIdx = p.milestones.findIndex((m) => !m.done)
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0
  useEffect(() => { const t = window.setTimeout(() => setFill(pct), 60); return () => window.clearTimeout(t) }, [pct])

  const due = dueText(b.urgency, b.action_due)
  const go = () => plan.primary && onAction(plan.primary.action)

  return (
    <section className={`bp bp--wide${collapsed ? ' bp--collapsed' : ''}`} style={{ margin: '14px 0 0' }}>
      <div className="bp-top">
        <div className="bp-count">{p.done} of {p.total} done</div>
        <div className="bp-bar">
          {p.milestones.map((m, i) => <span key={m.key} title={m.label} className={`bp-seg bp-seg--${m.state}${i === currentIdx ? ' bp-seg--now' : ''}`} style={{ animationDelay: `${i * 45}ms` }} />)}
        </div>
        <div className="bp-pct">{fill}%</div>
        <button type="button" className="bp-toggle" onClick={toggle} title={collapsed ? 'Expand' : 'Collapse'} aria-label={collapsed ? 'Expand progress' : 'Collapse progress'} aria-expanded={!collapsed}>
          <ChevronDown size={15} />
        </button>
      </div>

      {collapsed ? (
        <div className="bp-mini">
          <span className="bp-ai__icon bp-ai__icon--sm"><Sparkles size={11} /></span>
          <span className="bp-mini__t">{plan.title}</span>
          {plan.why && <span className="bp-mini__w">· {plan.why}</span>}
          {due ? <span className={`bp-due bp-due--${plan.tone}`}>{due}</span> : null}
          {plan.primary && <button type="button" className="bp-mini__go" onClick={go}>{plan.primary.label} <ArrowRight size={12} /></button>}
        </div>
      ) : (
        <div className="bp-body">
          <div className="bp-track">{ms.map((m, i) => <Step key={m.key} m={m} current={i === currentIdx} onAction={onAction} />)}</div>
          <div className={`bp-ai bp-ai--${plan.tone}`}>
            <span className="bp-ai__icon"><Sparkles size={14} /></span>
            <div className="bp-ai__body">
              <div className="bp-ai__k">UBF Intelligence<span className={`bp-ai__dot bp-ai__dot--${plan.tone}`} />{toneLabel(plan.tone)}</div>
              <div className="bp-ai__t">{plan.title}{due ? <span className={`bp-due bp-due--${plan.tone}`}>{due}</span> : null}</div>
              {plan.why && <div className="bp-ai__w">{plan.why}</div>}
              {plan.secondary && (
                <button type="button" className="bp-suggest" onClick={() => onAction(plan.secondary!.action)}>{plan.secondary.label} <ArrowRight size={12} /></button>
              )}
            </div>
            <div className="bp-next__cta">
              {plan.primary && <button type="button" className="bp-primary" onClick={go}>{plan.primary.label}</button>}
              <div className="bp-ch">
                <button type="button" className="bp-ib" title="Email update" aria-label="Email update" onClick={() => setDialog('email')}><Mail size={15} /></button>
                <button type="button" className="bp-ib" title="WhatsApp update" aria-label="WhatsApp update" onClick={() => setDialog('whatsapp')}><MessageCircle size={15} /></button>
                <button type="button" className="bp-ib" title="Post to customer portal" aria-label="Post to customer portal" onClick={() => setDialog('portal')}><MonitorSmartphone size={15} /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {dialog && (
        <CustomerUpdateDialog open onClose={() => setDialog(null)} progress={p} initialTemplate="status" channel={dialog}
          containers={[]} vessel={b.consol_flight} onSent={onChanged} />
      )}
    </section>
  )
}

function toneLabel(t: string) {
  return t === 'red' ? 'Needs attention' : t === 'amber' ? 'Watch' : t === 'blue' ? 'Next step' : 'On track'
}

function dueText(u: string | null, due: string | null) {
  if (u === 'blocked') return 'on hold'
  if (!due || u === 'ok') return ''
  const ms = new Date(due).getTime() - Date.now()
  const h = Math.round(Math.abs(ms) / 3_600_000)
  const span = h < 24 ? `${Math.max(1, h)}h` : `${Math.round(h / 24)}d`
  return u === 'overdue' ? `${span} late` : u === 'today' ? 'due today' : `due in ${span}`
}
