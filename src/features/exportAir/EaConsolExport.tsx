import { useState, type ReactNode } from 'react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import type { AirConsol, EaRow } from './eaTypes'
import { btn, btnPrimary } from './eaUi'
import { buildConsolXml, downloadText, xmlIssues } from './eaXml'
import { patchConsol } from './useEaConsol'

/** Close + export strip. Builds the Consolidation2 file staff import into the TW consol (Document tab > Import XML). */
export default function EaConsolExport({ consol: c, houses, subsOf, onDone }: { consol: AirConsol; houses: EaRow[]; subsOf: Map<string, EaRow[]>; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const issues = xmlIssues(c, houses, subsOf)
  const notIn = houses.filter((h) => (h.is_consolidation ? (subsOf.get(h.id) ?? []).some((s) => s.stage < 2 && s.act_pcs == null) : h.stage < 2))
  const plain = issues.filter((i) => !i.sub)
  const bySub = new Map<string, { master: string; supplier: string; ref: string; problems: string[] }>()
  for (const i of issues) if (i.sub) {
    const k = i.sub.ref
    const g = bySub.get(k) ?? { master: i.ref, supplier: i.sub.supplier, ref: i.sub.ref, problems: [] }
    g.problems.push(i.problem); bySub.set(k, g)
  }
  const locked = c.status === 'exported' || c.status === 'departed'

  async function exportXml(close: boolean) {
    if (close && issues.length) return toast.error('Fix the listed items first')
    if (close && !window.confirm(`Close ${c.flight_no} and lock ${houses.length} houses? Changes after this happen in TradeWindow.`)) return
    setBusy(true)
    try {
      const { xml, fileName } = await buildConsolXml(c, houses)
      downloadText(fileName, xml)
      if (close) {
        await patchConsol(c.id, { status: 'exported', exported_at: new Date().toISOString() })
        toast.success('Exported. Import the file in TW: consol > Document > Import XML')
        onDone()
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (locked) {
    return (
      <Strip bg="#ECFDF3" dot="#17B26A">
        <span><b className="font-semibold">Exported to TradeWindow</b>{c.exported_at ? ` ${format(parseISO(c.exported_at), 'EEE d MMM HH:mm')}` : ''}. <span className="text-[#475467]">Houses locked. HAWBs and job numbers arrive with the next sync.</span></span>
        <button type="button" className={`${btn} ml-auto`} disabled={busy} onClick={() => void exportXml(false)}>Download XML again</button>
      </Strip>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Strip bg={issues.length ? '#FFFAEB' : '#F3F5FB'} dot={issues.length ? '#F79009' : '#17B26A'}>
        <span>
          <b className="font-semibold">{issues.length ? `${issues.length} item${issues.length > 1 ? 's' : ''} to fix before export.` : 'Ready to close.'}</b>{' '}
          <span className="text-[#5B616E]">
            {notIn.length ? `${notIn.length} house${notIn.length > 1 ? 's' : ''} not checked in yet. ` : ''}
            Staff create the consol in TW first, then import this file.
          </span>
        </span>
        <div className="ml-auto flex gap-2">
          <button type="button" className={btn} disabled={busy || !houses.length} onClick={() => void exportXml(false)}>Preview XML</button>
          <button type="button" className={btnPrimary} disabled={busy || issues.length > 0} onClick={() => void exportXml(true)}>Close &amp; export</button>
        </div>
      </Strip>
      {plain.length ? (
        <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 px-3.5 text-[12px] text-[#B54708]">
          {plain.map((i, n) => <li key={n}><span className="bk-mono">{i.ref}</span> · {i.problem}</li>)}
        </ul>
      ) : null}
      {bySub.size ? (
        <div className="mx-3.5 overflow-hidden rounded-lg border border-[#FEDF89] text-[12px]">
          <div className="bg-[#FFFAEB] px-3 py-1.5 font-medium text-[#93370D]">Buyers consol sub-HAWBs still missing items</div>
          <ul className="m-0 list-none p-0">
            {[...bySub.values()].map((g) => (
              <li key={g.ref} className="grid grid-cols-[110px_120px_minmax(0,1fr)] gap-3 border-t border-[#FEF0C7] bg-white px-3 py-1.5">
                <span className="bk-mono text-[#5B616E]">{g.master}</span>
                <span className="truncate"><span className="bk-mono text-[#0A2472]">{g.ref}</span></span>
                <span className="truncate text-[#14161A]"><b className="font-medium">{g.supplier}</b> · <span className="text-[#B54708]">{g.problems.join(' · ')}</span></span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function Strip({ bg, dot, children }: { bg: string; dot: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3.5 rounded-[10px] px-3.5 py-2.5 text-[12.5px]" style={{ background: bg }}>
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot }} />
      {children}
    </div>
  )
}
