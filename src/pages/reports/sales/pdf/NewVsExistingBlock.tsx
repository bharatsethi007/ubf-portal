import { View, Text } from '@react-pdf/renderer'
import type { NewVsExistingRow } from '../../salesAnalyticsNewVsExisting'
import { cf } from '../../reportsUi'
import { C, pdfStyles } from './pdfTheme'
import { num } from './pdfReportHelpers'

type Props = { rows: NewVsExistingRow[] }

function StackedBar({ row }: { row: NewVsExistingRow }) {
  const total = num(row.total_gp)
  const newGp = Math.max(0, num(row.new_gp))
  const existGp = Math.max(0, num(row.existing_gp))
  const newPct = total > 0 ? (newGp / total) * 100 : 0
  const existPct = total > 0 ? (existGp / total) * 100 : 0
  const name = row.sales_manager?.trim() || '—'
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7, gap: 8 }}>
      <Text style={{ width: 88, fontSize: 8, color: C.body }}>{name}</Text>
      <View style={{ flex: 1, height: 8, flexDirection: 'row', backgroundColor: C.track }}>
        {newPct > 0 ? <View style={{ width: `${newPct}%`, height: 8, backgroundColor: C.accent }} /> : null}
        {existPct > 0 ? <View style={{ width: `${existPct}%`, height: 8, backgroundColor: C.navy }} /> : null}
      </View>
      <Text style={{ width: 72, fontSize: 7.5, textAlign: 'right', color: C.muted }}>{newPct.toFixed(0)}% new</Text>
    </View>
  )
}

export default function NewVsExistingBlock({ rows }: Props) {
  const assigned = rows.filter((r) => !r.is_unassigned).sort((a, b) => num(b.total_gp) - num(a.total_gp))
  const totalGp = assigned.reduce((s, r) => s + num(r.total_gp), 0)
  const newGp = assigned.reduce((s, r) => s + num(r.new_gp), 0)
  const pct = totalGp > 0 ? (newGp / totalGp) * 100 : 0

  if (!assigned.length) return null

  return (
    <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 0.5, borderTopColor: C.hair, borderTopStyle: 'solid' }}>
      <Text style={{ ...pdfStyles.sectionTitle, marginBottom: 6, fontSize: 10 }}>New vs existing</Text>
      <Text style={{ fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 12 }}>
        New business is {pct.toFixed(1)}% of GP ({cf.format(newGp)} of {cf.format(totalGp)})
      </Text>
      {assigned.slice(0, 6).map((row) => (
        <StackedBar key={row.sales_manager ?? 'r'} row={row} />
      ))}
    </View>
  )
}
