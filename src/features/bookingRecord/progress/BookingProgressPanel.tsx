import { useEffect, useState } from 'react'
import { Check, AlertTriangle, ArrowRight, Mail, MessageCircle, MonitorSmartphone, User, Ship, Building2, Anchor, Sparkles, ChevronDown } from 'lucide-react'
import { dmy, type BookingProgress, type Milestone } from './progressApi'
import { actionPlan, type GotoTarget } from './actionPlan'
import CustomerUpdateDialog from './CustomerUpdateDialog'
import type { TemplateKey } from './messageTemplates'
import type { Channel } from './CustomerUpdateDialog'
import './progress.css'

type Props = {
  progress: BookingProgress
  variant?: 'wide' | 'compact'
  containers: string[]
  vessel?: string | null
  onGoto?: (t: GotoTarget) => void          // record page: switch tab / scroll. Drawer: open record.
  onChanged?: () => void
}

const OWNER_ICON = { ubf: Building2, customer: User, carrier: Ship, port: Anchor } as const
const OWNER_LABEL = { ubf: 'UBF', customer: 'Customer', carrier: 'Carrier', port: 'Port' } as const

function Seg({ m, current, i }: { m: Milestone; current: boolean; i: number }) {
  return <span className={`bp-seg bp-seg--${m.state}${current ? ' bp-seg--now' : ''}`} style={{ animationDelay: `${i * 45}ms` }} title={m.label} />
}

function Step({ m, current }: { m: Milestone; current: boolean }) {
  const Icon = OWNER_ICON[m.owner] ?? Building2
  const when = m.done ? dmy(m.at) : m.due ? `by ${dmy(m.due)}` : ''
  return (
    <div className={`bp-step bp-step--${m.state}${current ? ' bp-step--now' : ''}`}>
      <span className="bp-dot">{m.done ? <Check size={11} strokeWidth={3} /> : m.state === 'late' ? <AlertTriangle size={10} strokeWidth={2.6} /> : null}</span>
      <span className="bp-step__l">{m.label}</span>
      <span className="bp-step__w">{[when, !m.done ? m.note : null].filter(Boolean).join(' · ')}</span>
      {!m.done && <span className="bp-step__o" title={`Waiting on ${OWNER_LABEL[m.owner]}`}><Icon size={10} /> {OWNER_LABEL[m.owner]}</span>}
    </div>
  )
}

export default function BookingProgressPanel({ progress: p, variant = 'wide', containers, vessel = null, onGoto, onChanged }: Props) {
  const [dialog, setDialog] = useState<TemplateKey | null>(null)
  const [channel, setChannel] = useState<Channel | undefined>(undefined)
  const open = (t: TemplateKey, ch?: Channel) => { setChannel(ch); setDialog(t) }
  const [fill, setFill] = useState(0)
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(`bp-collapsed-${variant}`) === '1' } catch { return false } })
  const toggle = () => setCollapsed((c) => { try { localStorage.setItem(`bp-collapsed-${variant}`, c ? '0' : '1') } catch { /* ignore */ } return !c })
  const plan = actionPlan(p)
  const vesselName = vessel ?? p.milestones.find((m) => m.key === 'arrived')?.note ?? null
  const currentIdx = p.milestones.findIndex((m) => !m.done)
  const left = p.milestones.filter((m) => !m.done)
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0
  useEffect(() => { const t = window.setTimeout(() => setFill(pct), 60); return () => window.clearTimeout(t) }, [pct])

  const runPrimary = () => {
    if (!plan.primary) return
    if (plan.primary.kind === 'notify') open(plan.primary.template)
    else onGoto?.(plan.primary.target)
  }
  const defaultTpl: TemplateKey = plan.customer?.template ?? (plan.primary?.kind === 'notify' ? plan.primary.template : 'status')

  return (
    <section className={`bp bp--${variant}${collapsed ? ' bp--collapsed' : ''}`}>
      <div className="bp-top">
        <div className="bp-count">{p.done} of {p.total} done</div>
        <div className="bp-bar">{p.milestones.map((m, i) => <Seg key={m.key} m={m} i={i} current={i === currentIdx} />)}</div>
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
          {p.action_due && p.next_action ? <span className={`bp-due bp-due--${plan.tone}`}>{dueText(p)}</span> : null}
          {plan.primary && <button type="button" className="bp-mini__go" onClick={runPrimary}>{plan.primary.label} <ArrowRight size={12} /></button>}
        </div>
      ) : (
        <div className="bp-body">
          {variant === 'wide' ? (
            <div className="bp-track">{p.milestones.map((m, i) => <Step key={m.key} m={m} current={i === currentIdx} />)}</div>
          ) : left.length > 0 ? (
            <div className="bp-left">
              <span className="bp-left__k">Left</span>
              {left.slice(0, 4).map((m) => <span key={m.key} className={`bp-chip bp-chip--${m.state}`}>{m.label}</span>)}
              {left.length > 4 && <span className="bp-chip">+{left.length - 4}</span>}
            </div>
          ) : null}

          <div className={`bp-ai bp-ai--${plan.tone}`}>
            <span className="bp-ai__icon"><Sparkles size={14} /></span>
            <div className="bp-ai__body">
              <div className="bp-ai__k">UBF Intelligence{plan.title !== toneLabel(plan.tone) && <><span className={`bp-ai__dot bp-ai__dot--${plan.tone}`} />{toneLabel(plan.tone)}</>}</div>
              <div className="bp-ai__t">{plan.title}{p.action_due && p.next_action ? <span className={`bp-due bp-due--${plan.tone}`}>{dueText(p)}</span> : null}</div>
              {plan.why && <div className="bp-ai__w">{plan.why}</div>}
              {plan.customer && (
                <button type="button" className="bp-suggest" onClick={() => open(plan.customer!.template)}>
                  Suggested: {plan.customer.label} <ArrowRight size={12} />
                </button>
              )}
            </div>
            <div className="bp-next__cta">
              {plan.primary && <button type="button" className="bp-primary" onClick={runPrimary}>{plan.primary.label}</button>}
              <div className="bp-ch">
                <button type="button" className="bp-ib" title="Email customer" aria-label="Email customer" onClick={() => open(defaultTpl, 'email')}><Mail size={15} /></button>
                <button type="button" className="bp-ib" title="WhatsApp customer" aria-label="WhatsApp customer" onClick={() => open(defaultTpl, 'whatsapp')}><MessageCircle size={15} /></button>
                <button type="button" className="bp-ib" title="Post to customer portal" aria-label="Post to customer portal" onClick={() => open(defaultTpl, 'portal')}><MonitorSmartphone size={15} /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {dialog && (
        <CustomerUpdateDialog open onClose={() => setDialog(null)} progress={p} initialTemplate={dialog} channel={channel}
          containers={containers} vessel={vesselName} onSent={onChanged} />
      )}
    </section>
  )
}

function toneLabel(t: string): string {
  return t === 'red' ? 'Needs attention' : t === 'amber' ? 'Watch' : t === 'blue' ? 'Next step' : 'On track'
}

function dueText(p: BookingProgress): string {
  if (p.urgency === 'blocked') return 'on hold'
  if (!p.action_due) return ''
  const ms = new Date(p.action_due).getTime() - Date.now()
  const h = Math.round(Math.abs(ms) / 3_600_000)
  const span = h < 24 ? `${Math.max(1, h)}h` : `${Math.round(h / 24)}d`
  if (p.urgency === 'overdue') return `${span} late`
  if (p.urgency === 'today') return 'due today'
  return `due in ${span}`
}
