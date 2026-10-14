import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronDown, ChevronUp, Lightbulb, X } from 'lucide-react'
import { toast } from 'sonner'
import { fetchResponseInsight, suggestRule, type InsightPrompt, type ResponseInsight } from './brainboxApi'
import { GROUP_META, GROUP_ORDER, SOURCE_GROUP, money, type SourceGroup } from './sourceMeta'
import SourceRing from './SourceRing'

type Props = { responseId: string; refreshKey: unknown }

const OPEN_KEY = 'brainbox.sourcesOpen'
const DISMISS_KEY = 'brainbox.dismissed'
const readLs = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v == null ? d : (JSON.parse(v) as T) } catch { return d } }
const writeLs = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private window */ } }
const promptId = (p: InsightPrompt) => (p.kind === 'make_rule' ? `rule:${p.key}|${p.currency}|${p.unit_class}` : `sheet:${p.path}`)
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

/** Right half of a response card: where the price came from. Collapsed until the user opens it. */
export default function ResponseSources({ responseId, refreshKey }: Props) {
  const nav = useNavigate()
  const [ins, setIns] = useState<ResponseInsight | null>(null)
  const [open, setOpen] = useState<boolean>(() => readLs(OPEN_KEY, false))
  const [hidden, setHidden] = useState<string[]>(() => readLs(DISMISS_KEY, []))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    fetchResponseInsight(responseId).then((d) => { if (live) setIns(d) }).catch(() => {})
    return () => { live = false }
  }, [responseId, refreshKey])

  const groups = useMemo(() => {
    const m = new Map<SourceGroup, number>()
    for (const s of ins?.sources ?? []) {
      const g = SOURCE_GROUP[s.source] ?? 'manual'
      m.set(g, (m.get(g) ?? 0) + Math.max(0, Number(s.sell) || 0))
    }
    const total = [...m.values()].reduce((a, b) => a + b, 0)
    return { total, rows: GROUP_ORDER.filter((g) => (m.get(g) ?? 0) > 0).map((g) => ({ g, sell: m.get(g) ?? 0, share: total > 0 ? (m.get(g) ?? 0) / total : 0 })) }
  }, [ins])

  if (!ins || groups.total <= 0) return null
  if (groups.rows.length === 1 && groups.rows[0].g === 'legacy') return null // priced before tracking began

  const cur = ins.currency
  const cardShare = groups.rows.find((r) => r.g === 'card')?.share ?? 0
  const cardPct = `${Math.round(cardShare * 100)}%`
  const editPct = ins.edited.base > 0 ? (ins.edited.delta / ins.edited.base) * 100 : 0
  const outCount = ins.manual.outliers.length
  const prompts = ins.prompts.filter((p) => !hidden.includes(promptId(p))).slice(0, 2)
  const toggle = () => { setOpen(!open); writeLs(OPEN_KEY, !open) }
  const hide = (p: InsightPrompt) => { const next = [...hidden, promptId(p)]; setHidden(next); writeLs(DISMISS_KEY, next) }
  const makeRule = async (p: Extract<InsightPrompt, { kind: 'make_rule' }>) => {
    setBusy(true)
    try {
      await suggestRule(p.key, p.currency, p.unit_class)
      toast.success(`${p.label} rule suggested. A pricing lead approves it in Brainbox.`)
      hide(p)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not suggest rule') } finally { setBusy(false) }
  }

  const summary = [
    ins.edited.count > 0 ? `${ins.edited.count} edited` : null,
    ins.manual.count > 0 ? `${ins.manual.count} manual` : null,
    prompts.length > 0 ? `${prompts.length} tip${prompts.length > 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(' · ')

  if (!open) {
    return (
      <div className="flex min-w-[260px] flex-1 justify-end" onClick={stop} onKeyDown={stop} role="presentation">
        <button type="button" onClick={toggle} aria-expanded={false}
          className="inline-flex items-center gap-2.5 rounded-full border border-[#E6E9F0] bg-[#F7F8FC] py-1 pl-1 pr-3 text-xs text-[#3D4757] hover:border-[#C9D2EE] hover:bg-white">
          <SourceRing size={26} stroke={4} parts={groups.rows.map((r) => ({ share: r.share, color: GROUP_META[r.g].bar }))} />
          <span><b className="font-semibold text-[#141B2D]">{cardPct}</b> from cards{summary ? ` · ${summary}` : ''}</span>
          <ChevronDown size={14} className="text-[#8A93A5]" aria-hidden />
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-w-[520px] flex-1 flex-col gap-3 rounded-[10px] bg-[#F7F8FC] px-4 py-3.5" onClick={stop} onKeyDown={stop} role="presentation">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-[#6B7486]">Price sources · by sell value</span>
        <button type="button" onClick={toggle} aria-expanded className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-[#6B7486] hover:bg-white">
          Hide <ChevronUp size={13} aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-[104px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-5">
        <div className="relative h-[104px] w-[104px]">
          <SourceRing size={104} stroke={11} label={groups.rows.map((r) => `${GROUP_META[r.g].label} ${Math.round(r.share * 100)}%`).join(', ')}
            parts={groups.rows.map((r) => ({ share: r.share, color: GROUP_META[r.g].bar }))} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[22px] font-semibold tracking-tight">{cardPct}</span>
            <span className="text-[10px] uppercase tracking-wider text-[#6B7486]">from cards</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {groups.rows.map((r) => (
            <div key={r.g} className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-x-2">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: GROUP_META[r.g].bar }} />
              <span className="truncate text-[13px]">{GROUP_META[r.g].label}</span>
              <span className="font-mono text-xs text-[#3D4757]">{money(r.sell, 0)} <span className="text-[#8A93A5]">{Math.round(r.share * 100)}%</span></span>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-[10px] border border-[#ECEEF4] bg-white">
          <Fact label="Lines from card" value={`${ins.card.lines} of ${ins.card.total_lines}`}
            title={[ins.card.vendor, ins.card.valid_to ? `valid to ${new Date(ins.card.valid_to).toLocaleDateString('en-NZ')}` : null].filter(Boolean).join(' · ')} />
          <Fact label="Edited vs card"
            value={ins.edited.count > 0 ? `${ins.edited.delta >= 0 ? '+' : '-'}${cur} ${money(Math.abs(ins.edited.delta), 0)} · ${editPct >= 0 ? '+' : ''}${editPct.toFixed(1)}%`
              : ins.card.lines > 0 ? 'None' : 'Nothing to compare'}
            tone={ins.edited.count > 0 ? 'warn' : ins.card.lines > 0 ? 'good' : 'mute'}
            title={ins.edited.lines.map((l) => `${l.description}: ${money(Number(l.suggested))} to ${money(Number(l.final))}`).join('\n')} />
          <Fact label="Manual lines" last
            value={ins.manual.count === 0 ? 'None' : outCount > 0 ? `${ins.manual.count} · ${outCount} off usual price` : `${ins.manual.count} · ${ins.manual.in_range} at usual price`}
            tone={outCount > 0 ? 'warn' : undefined}
            title={ins.manual.outliers.map((o) => `${o.description}: ${money(Number(o.sell))}, usual ${money(Number(o.med))} (${o.n} quotes)`).join('\n')} />
        </div>
      </div>

      {prompts.map((p) => (
        <div key={promptId(p)} className="flex items-center gap-3 rounded-[10px] border border-[#E3E8FB] bg-white px-3 py-2.5">
          <span className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg ${p.kind === 'make_rule' ? 'bg-[#EEF2FF] text-[#2F4FD8]' : 'bg-[#FFF3E8] text-[#B4560F]'}`}>
            {p.kind === 'make_rule' ? <Lightbulb size={15} aria-hidden /> : <AlertTriangle size={15} aria-hidden />}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[13px] font-medium">
              {p.kind === 'make_rule' ? `${p.label} is ${p.currency} ${money(Number(p.value))} on ${p.n} quotes` : `${p.n_manual} charges typed by hand`}
            </span>
            <span className="text-xs text-[#6B7486]">
              {p.kind === 'make_rule' ? 'Make it a rule and the system adds it for you.'
                : `Same on ${p.lane_manual} of ${p.lane_quotes} quotes on this lane. Use the charge sheet, or add these to it.`}
            </span>
          </div>
          {p.kind === 'make_rule'
            ? <button type="button" className="h-8 shrink-0 rounded-lg bg-[#0A2472] px-3.5 text-xs font-medium text-white hover:bg-[#13308F] disabled:opacity-60" disabled={busy} onClick={() => void makeRule(p)}>Make rule</button>
            : <button type="button" className="h-8 shrink-0 rounded-lg bg-[#0A2472] px-3.5 text-xs font-medium text-white hover:bg-[#13308F]" onClick={() => nav(`/setup/rates/${p.path}`)}>Open charge sheets</button>}
          <button type="button" aria-label="Dismiss" title="Dismiss" className="h-8 w-8 shrink-0 rounded-md text-[#8A93A5] hover:bg-[#F3F4F7]" onClick={() => hide(p)}>
            <X size={14} className="mx-auto" />
          </button>
        </div>
      ))}
    </div>
  )
}

function Fact({ label, value, tone, last, title }: { label: string; value: string; tone?: 'warn' | 'good' | 'mute'; last?: boolean; title?: string }) {
  const color = tone === 'warn' ? 'text-[#8A4A17]' : tone === 'good' ? 'text-[#0F7A4F]' : tone === 'mute' ? 'text-[#8A93A5]' : 'text-[#3D4757]'
  return (
    <div className={`flex items-center justify-between gap-3 px-3 py-2 ${last ? '' : 'border-b border-[#ECEEF4]'}`} title={title || undefined}>
      <span className="text-xs text-[#6B7486]">{label}</span>
      <span className={`truncate text-[13px] font-medium ${color}`}>{value}</span>
    </div>
  )
}
