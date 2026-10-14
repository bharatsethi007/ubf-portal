import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase'
import { toast } from 'sonner'
import { useChargeCodes } from '../../hooks/useQuoteRefData'
import { describeEvidence, mapErpCode, type Evidence, type TreatAs } from './evidenceApi'
import { normDesc } from './brainboxApi'
import { money } from './sourceMeta'

type Props = { rows: Evidence[]; sheetId: string | null; sheetTitle: string | null; canEdit: boolean; onSaved: () => void }

const TREAT: { v: TreatAs; label: string }[] = [
  { v: 'standard', label: 'Standard charge' },
  { v: 'contingent', label: 'Extra, only if it applies' },
  { v: 'freight', label: 'Freight (rate card)' },
  { v: 'passthrough', label: 'Pass-through (duty, GST)' },
  { v: 'ignore', label: 'Ignore' },
]

/** ERP codes on this lane that are not confirmed yet. Mapping once unlocks the evidence. */
export default function CodeMapPanel({ rows, sheetId, sheetTitle, canEdit, onSaved }: Props) {
  const { items: codes } = useChargeCodes()
  const [cardLabels, setCardLabels] = useState<string[]>([])
  useEffect(() => {
    if (!sheetId) return
    supabase.from('air_local_charge_lines').select('label').eq('sheet_id', sheetId).order('ord')
      .then(({ data }) => setCardLabels((data ?? []).map((r) => String(r.label))))
  }, [sheetId])
  // Card lines first, so ERP codes get mapped to the same charge the sheet uses.
  const onCard = useMemo(() => {
    const byDesc = new Map(codes.map((c) => [normDesc(c.description), c]))
    return cardLabels.map((l) => byDesc.get(normDesc(l))).filter((c): c is NonNullable<typeof c> => !!c)
  }, [codes, cardLabels])
  const [draft, setDraft] = useState<Record<string, { code: string; treat: TreatAs }>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const val = (r: Evidence) => draft[r.erp_code] ?? { code: r.charge_code ?? '', treat: r.treat_as }
  const save = async (r: Evidence) => {
    const v = val(r)
    setBusy(r.erp_code)
    try {
      await mapErpCode(r.erp_code, v.code || null, v.treat)
      toast.success(`${r.erp_code} mapped`)
      onSaved()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save') } finally { setBusy(null) }
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr><th>ERP code</th><th>Billed as</th><th>Pattern</th><th>Portal charge</th><th>Treat as</th><th /></tr></thead>
        <tbody>
          {rows.map((r) => {
            const v = val(r)
            return (
              <tr key={r.erp_code}>
                <td className="mono">{r.erp_code}</td>
                <td className="text-xs text-[#5B6577]" style={{ maxWidth: 280 }}>{r.descs.slice(0, 2).join(' · ')}</td>
                <td className="text-xs text-[#3D4757]" style={{ maxWidth: 240 }}>{describeEvidence(r, money)}</td>
                <td>
                  <select className="input input--sm" style={{ width: 230 }} aria-label={`Portal charge for ${r.erp_code}`} disabled={!canEdit}
                    value={v.code} onChange={(e) => setDraft({ ...draft, [r.erp_code]: { ...v, code: e.target.value } })}>
                    <option value="">Not mapped</option>
                    {onCard.length > 0 && (
                      <optgroup label={`On ${sheetTitle ?? 'the charge sheet'}`}>
                        {onCard.map((c) => <option key={`card-${c.code}`} value={c.code}>{c.description} · {c.code}</option>)}
                      </optgroup>
                    )}
                    <optgroup label="All charge codes">
                      {codes.map((c) => <option key={c.code} value={c.code}>{c.description} · {c.code}</option>)}
                    </optgroup>
                  </select>
                </td>
                <td>
                  <select className="input input--sm" style={{ width: 190 }} aria-label={`Treat ${r.erp_code} as`} disabled={!canEdit}
                    value={v.treat} onChange={(e) => setDraft({ ...draft, [r.erp_code]: { ...v, treat: e.target.value as TreatAs } })}>
                    {TREAT.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                  </select>
                </td>
                <td style={{ textAlign: 'right' }}>
                  {canEdit && (
                    <button type="button" className="h-8 rounded-lg bg-[#0A2472] px-3 text-xs font-medium text-white disabled:opacity-60"
                      disabled={busy === r.erp_code || (v.treat === 'standard' && !v.code)} onClick={() => void save(r)}>
                      Confirm
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
