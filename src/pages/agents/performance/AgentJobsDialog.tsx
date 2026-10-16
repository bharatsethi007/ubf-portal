import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Download, Search } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { usePerm } from '../../../access/PermissionsProvider'
import AgentJobsTable from './AgentJobsTable'
import { CLASS_LABEL, isoMonthsAgo, listAgentJobs, setJobClass, type JobClass, type JobRow } from './agentsPerformanceApi'

export type JobsFilter = { months: number; cls?: JobClass | 'all' | 'edited'; network?: string; agentId?: string; agentName?: string; direction?: 'all' | 'import' | 'export' }
type Props = { open: boolean; onClose: () => void; initial: JobsFilter; onChanged: () => void }

const CLASSES: (JobClass | 'all' | 'edited')[] = ['all', 'freehand', 'nomination', 'exception', 'unbilled', 'excluded', 'edited']
const chip = (on: boolean) => `rounded-full border px-3 py-1 text-[12px] ${on ? 'border-[#0A2472] bg-[#0A2472] text-white' : 'border-[#E6E8EE] bg-white text-[#334155]'}`
const sel = 'h-8 rounded-md border border-[#E6E8EE] bg-white px-2 text-[12.5px]'

/** Agent jobs list: filters, bulk select, mark free hand or nomination, exclude or send back to the billing rule. */
export default function AgentJobsDialog({ open, onClose, initial, onChanged }: Props) {
  const canEdit = usePerm('agents', 'edit')
  const [months, setMonths] = useState(initial.months)
  const [rows, setRows] = useState<JobRow[] | null>(null)
  const [cls, setCls] = useState<JobClass | 'all' | 'edited'>(initial.cls ?? 'all')
  const [dir, setDir] = useState(initial.direction ?? 'all')
  const [network, setNetwork] = useState(initial.network ?? '')
  const [agentId, setAgentId] = useState(initial.agentId ?? '')
  const [mode, setMode] = useState('')
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setMonths(initial.months); setCls(initial.cls ?? 'all'); setDir(initial.direction ?? 'all')
    setNetwork(initial.network ?? ''); setAgentId(initial.agentId ?? ''); setMode(''); setQ(''); setPicked(new Set()); setNote('')
  }, [open, initial])

  const load = () => { setRows(null); listAgentJobs(isoMonthsAgo(months), new Date().toLocaleDateString('en-CA')).then(setRows).catch((e) => { toast.error(e.message); setRows([]) }) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) load() }, [open, months])

  const base = useMemo(() => (rows ?? []).filter((r) =>
    (dir === 'all' || r.direction === dir) &&
    (!network || (network === 'No network' ? r.networks.length === 0 : r.networks.includes(network))) &&
    (!agentId || r.agent_id === agentId) && (!mode || r.mode === mode) &&
    (!q.trim() || `${r.job_no} ${r.house_bill} ${r.agent} ${r.customer} ${r.customer_account_id} ${r.origin} ${r.destination}`.toLowerCase().includes(q.trim().toLowerCase()))), [rows, dir, network, agentId, mode, q])
  const shown = useMemo(() => base.filter((r) => cls === 'all' || (cls === 'edited' ? r.overridden : r.class === cls)), [base, cls])
  const count = (c: typeof cls) => base.filter((r) => c === 'all' || (c === 'edited' ? r.overridden : r.class === c)).length

  const networks = useMemo(() => [...new Set((rows ?? []).flatMap((r) => r.networks))].sort(), [rows])
  const agents = useMemo(() => [...new Map((rows ?? []).map((r) => [r.agent_id, r.agent])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [rows])
  const modes = useMemo(() => [...new Set((rows ?? []).map((r) => r.mode).filter(Boolean) as string[])].sort(), [rows])

  async function apply(ids: number[], c: JobClass | 'auto') {
    if (!ids.length) return
    setBusy(true)
    try {
      const n = await setJobClass(ids, c, note)
      toast.success(`${n} job${n === 1 ? '' : 's'} ${c === 'auto' ? 'back to the billing rule' : `marked ${CLASS_LABEL[c as JobClass].toLowerCase()}`}`)
      setPicked(new Set()); load(); onChanged()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setBusy(false) }
  }

  function exportCsv() {
    const head = ['Job', 'House bill', 'Date', 'Direction', 'Mode', 'Agent', 'Networks', 'Customer', 'Origin', 'Destination', 'Freight billed to', 'Freight sell', 'GP', 'Class', 'Rule class', 'Edited']
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const body = shown.map((r) => [r.job_no, r.house_bill, r.dt, r.direction, r.mode, r.agent, r.networks.join(' '), r.customer, r.origin, r.destination, r.frt_bill_to, r.frt_sell, r.gp, CLASS_LABEL[r.class], CLASS_LABEL[r.auto_class], r.overridden ? 'yes' : ''].map(esc).join(','))
    const url = URL.createObjectURL(new Blob([[head.join(','), ...body].join('\n')], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = `agent-jobs-${months}m.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500)
  }

  const ids = [...picked].filter((id) => shown.some((r) => r.job_unique === id))
  const title = initial.agentName ?? (network ? `${network} jobs` : 'Agent jobs')
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex h-[90vh] max-w-[min(1500px,96vw)] flex-col gap-3 sm:max-w-[min(1500px,96vw)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">{title}
            {agentId && <Link to={`/agents/${agentId}`} className="text-[12.5px] font-normal">Open agent</Link>}
          </DialogTitle>
          <p className="m-0 text-[12px] text-[#5B6474]">Free hand: import with no freight billed by us, or export with freight billed to the agent. Nomination: freight billed to the customer. Your changes override the rule.</p>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          {CLASSES.map((c) => (
            <button key={c} type="button" className={chip(cls === c)} onClick={() => setCls(c)}>
              {c === 'all' ? 'All' : c === 'edited' ? 'Edited by staff' : CLASS_LABEL[c]} {rows ? count(c) : ''}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative"><Search size={14} className="absolute left-2 top-2 text-[#98A2B3]" />
            <input className="h-8 w-[240px] rounded-md border border-[#E6E8EE] pl-7 pr-2 text-[12.5px]" placeholder="Job, HB, agent, customer, port" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <select className={sel} value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="Period">
            {[1, 3, 6, 12, 24].map((m) => <option key={m} value={m}>Last {m} months</option>)}</select>
          <select className={sel} value={dir} onChange={(e) => setDir(e.target.value as typeof dir)} aria-label="Direction">
            <option value="all">Import and export</option><option value="import">Import</option><option value="export">Export</option></select>
          <select className={sel} value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Mode"><option value="">All modes</option>{modes.map((m) => <option key={m}>{m}</option>)}</select>
          <select className={sel} value={network} onChange={(e) => setNetwork(e.target.value)} aria-label="Network">
            <option value="">All networks</option><option value="No network">No network</option>{networks.map((n) => <option key={n}>{n}</option>)}</select>
          <select className={`${sel} max-w-[240px]`} value={agentId} onChange={(e) => setAgentId(e.target.value)} aria-label="Agent">
            <option value="">All agents</option>{agents.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
          <span className="flex-1" />
          <button type="button" className="btn btn--inline" onClick={exportCsv} disabled={!shown.length}><Download size={14} /> CSV</button>
        </div>

        {canEdit && ids.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#C7D0E6] bg-[#F5F8FF] px-3 py-2 text-[12.5px]">
            <b className="font-medium">{ids.length} selected</b>
            <input className="h-8 w-[220px] rounded-md border border-[#E6E8EE] px-2" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <button type="button" className="btn btn--inline" disabled={busy} onClick={() => void apply(ids, 'freehand')}>Mark free hand</button>
            <button type="button" className="btn btn--inline" disabled={busy} onClick={() => void apply(ids, 'nomination')}>Mark nomination</button>
            <button type="button" className="btn btn--inline" disabled={busy} onClick={() => void apply(ids, 'excluded')}>Exclude</button>
            <button type="button" className="btn btn--inline" disabled={busy} onClick={() => void apply(ids, 'auto')}>Back to rule</button>
            <button type="button" className="text-[12px] text-[#5B6474]" onClick={() => setPicked(new Set())}>Clear</button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[#E6E8EE]">
          {!rows ? <p className="pad-inline text-muted-foreground">Loading jobs…</p> : (
            <AgentJobsTable rows={shown} selected={picked} canEdit={canEdit}
              onToggle={(id) => setPicked((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x })}
              onToggleAll={(on) => setPicked(on ? new Set(shown.map((r) => r.job_unique)) : new Set())}
              onSet={(i, c) => void apply(i, c)} />
          )}
        </div>
        <span className="text-[11.5px] text-[#5B6474]">{shown.length} of {rows?.length ?? 0} jobs. Not billed yet and excluded jobs are left out of stats.</span>
      </DialogContent>
    </Dialog>
  )
}
