import { View, Text } from '@react-pdf/renderer'
import type { NewVsExistingRow } from '../../salesAnalyticsNewVsExisting'
import type { SalesReportData } from '../salesExportApi'
import { cf, nf } from '../../reportsUi'
import { C, EXHIBIT_SOURCE, pdfStyles } from './pdfTheme'

type Props = { data: SalesReportData }

const num = (v: unknown) => Number(v || 0)

const COLS = [
  { key: 'name', label: 'SALES MANAGER', flex: 1.5, num: false },
  { key: 'newAccts', label: 'NEW ACCTS', flex: 0.75, num: true },
  { key: 'newGp', label: 'NEW GP', flex: 0.9, num: true },
  { key: 'existAccts', label: 'EXISTING ACCTS', flex: 0.85, num: true },
  { key: 'existGp', label: 'EXISTING GP', flex: 0.9, num: true },
  { key: 'totalGp', label: 'TOTAL GP', flex: 0.9, num: true },
  { key: 'newPct', label: 'NEW GP%', flex: 0.65, num: true },
]

function actionTitle(rows: NewVsExistingRow[]): string {
  const assigned = rows.filter((r) => !r.is_unassigned)
  const totalGp = assigned.reduce((s, r) => s + num(r.total_gp), 0)
  const newGp = assigned.reduce((s, r) => s + num(r.new_gp), 0)
  if (totalGp <= 0) return 'No new vs existing gross profit recorded for this period'
  const pct = (newGp / totalGp) * 100
  return `New business is ${pct.toFixed(1)}% of GP across the book (${cf.format(newGp)} of ${cf.format(totalGp)})`
}

function StackedBar({ row }: { row: NewVsExistingRow }) {
  const total = num(row.total_gp)
  const newGp = Math.max(0, num(row.new_gp))
  const existGp = Math.max(0, num(row.existing_gp))
  const newPct = total > 0 ? (newGp / total) * 100 : 0
  const existPct = total > 0 ? (existGp / total) * 100 : 0
  const name = row.sales_manager?.trim() || '—'
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 9, gap: 10 }}>
      <Text style={{ width: 108, fontSize: 8.5, color: C.body }}>{name}</Text>
      <View style={{ flex: 1, height: 10, flexDirection: 'row', backgroundColor: C.track }}>
        {newPct > 0 ? <View style={{ width: `${newPct}%`, height: 10, backgroundColor: C.accent }} /> : null}
        {existPct > 0 ? <View style={{ width: `${existPct}%`, height: 10, backgroundColor: C.navy }} /> : null}
      </View>
      <Text style={{ width: 120, fontSize: 8, textAlign: 'right', color: C.body }}>
        {cf.format(total)} · {newPct.toFixed(0)}% new
      </Text>
    </View>
  )
}

function TableRow({ row }: { row: NewVsExistingRow }) {
  const name = row.sales_manager?.trim() || '—'
  const newPct = row.new_gp_pct != null ? `${num(row.new_gp_pct).toFixed(1)}%` : '—'
  const values = [
    name,
    nf.format(num(row.new_accounts)),
    cf.format(num(row.new_gp)),
    nf.format(num(row.existing_accounts)),
    cf.format(num(row.existing_gp)),
    cf.format(num(row.total_gp)),
    newPct,
  ]
  return (
    <View style={{ flexDirection: 'row' }} wrap={false}>
      {COLS.map((col, i) => {
        const style = {
          ...pdfStyles.td,
          flex: col.flex,
          textAlign: col.num ? 'right' as const : 'left' as const,
          ...(col.num ? pdfStyles.num : {}),
          ...(i === 2 ? { color: C.accent, fontWeight: 600 as const } : {}),
          ...(i === 4 ? { color: C.navy, fontWeight: 600 as const } : {}),
          ...(i === 5 ? { fontWeight: 700 as const, color: C.navy } : {}),
        }
        return (
          <Text key={col.key} style={style}>
            {values[i]}
          </Text>
        )
      })}
    </View>
  )
}

export default function NewVsExistingExhibit({ data }: Props) {
  const rows = (data.newVsExisting ?? [])
    .filter((r) => !r.is_unassigned)
    .sort((a, b) => num(b.total_gp) - num(a.total_gp))

  return (
    <View>
      <Text style={pdfStyles.exhibitLabel}>Exhibit 2 — New vs Existing</Text>
      <Text style={pdfStyles.actionTitle}>{actionTitle(data.newVsExisting ?? [])}</Text>

      <View style={{ flexDirection: 'row', gap: 20, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, backgroundColor: C.accent }} />
          <Text style={{ fontSize: 8, color: C.muted }}>New GP</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, backgroundColor: C.navy }} />
          <Text style={{ fontSize: 8, color: C.muted }}>Existing GP</Text>
        </View>
      </View>

      <View style={{ marginBottom: 24 }}>
        {rows.map((row) => (
          <StackedBar key={row.sales_manager ?? 'row'} row={row} />
        ))}
      </View>

      <View style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.navy, borderBottomStyle: 'solid' }}>
        {COLS.map((col) => (
          <Text key={col.key} style={[pdfStyles.th, { flex: col.flex, textAlign: col.num ? 'right' : 'left' }]}>{col.label}</Text>
        ))}
      </View>

      {rows.map((row) => (
        <TableRow key={row.sales_manager ?? 'row'} row={row} />
      ))}

      {!rows.length ? (
        <Text style={{ ...pdfStyles.td, marginTop: 10, color: C.muted }}>No new vs existing data for this period.</Text>
      ) : null}

      <Text style={pdfStyles.source}>{EXHIBIT_SOURCE}</Text>
    </View>
  )
}
