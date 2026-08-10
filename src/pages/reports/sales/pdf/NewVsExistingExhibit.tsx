import { View, Text } from '@react-pdf/renderer'
import type { NewVsExistingRow } from '../../salesAnalyticsNewVsExisting'
import type { SalesReportData } from '../salesExportApi'
import { cf, nf } from '../../reportsUi'
import { C, pdfStyles } from './pdfTheme'

type Props = { data: SalesReportData }

const num = (v: unknown) => Number(v || 0)

const COLS = [
  { key: 'name', label: 'SALES MANAGER', flex: 1.5, align: 'left' as const },
  { key: 'newAccts', label: 'NEW ACCTS', flex: 0.75, align: 'right' as const },
  { key: 'newGp', label: 'NEW GP', flex: 0.9, align: 'right' as const },
  { key: 'existAccts', label: 'EXISTING ACCTS', flex: 0.85, align: 'right' as const },
  { key: 'existGp', label: 'EXISTING GP', flex: 0.9, align: 'right' as const },
  { key: 'totalGp', label: 'TOTAL GP', flex: 0.9, align: 'right' as const },
  { key: 'newPct', label: 'NEW GP%', flex: 0.65, align: 'right' as const },
]

function actionTitle(rows: NewVsExistingRow[]): string {
  const assigned = rows.filter((r) => !r.is_unassigned)
  const totalGp = assigned.reduce((s, r) => s + num(r.total_gp), 0)
  const newGp = assigned.reduce((s, r) => s + num(r.new_gp), 0)
  const pct = totalGp > 0 ? (newGp / totalGp) * 100 : 0
  return `New business is ${pct.toFixed(1)}% of GP across the book`
}

function StackedBar({ row }: { row: NewVsExistingRow }) {
  const total = num(row.total_gp)
  const newGp = Math.max(0, num(row.new_gp))
  const existGp = Math.max(0, num(row.existing_gp))
  const newPct = total > 0 ? (newGp / total) * 100 : 0
  const existPct = total > 0 ? (existGp / total) * 100 : 0
  const name = row.sales_manager?.trim() || '—'
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7, gap: 8 }}>
      <Text style={{ width: 108, fontSize: 8.5, color: C.body }}>{name}</Text>
      <View style={{ flex: 1, height: 12, flexDirection: 'row', backgroundColor: C.track, borderRadius: 2, overflow: 'hidden' }}>
        {newPct > 0 ? <View style={{ width: `${newPct}%`, height: 12, backgroundColor: C.accent }} /> : null}
        {existPct > 0 ? <View style={{ width: `${existPct}%`, height: 12, backgroundColor: C.navy }} /> : null}
      </View>
      <Text style={{ width: 118, fontSize: 8, textAlign: 'right', color: C.ink }}>
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
          textAlign: col.align,
          ...(i === 2 ? { color: C.accent, fontWeight: 600 as const } : {}),
          ...(i === 4 ? { color: C.navy, fontWeight: 600 as const } : {}),
          ...(i === 5 ? { fontWeight: 700 as const, color: C.ink } : {}),
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
      <Text style={pdfStyles.exhibitLabel}>Exhibit 2</Text>
      <Text style={pdfStyles.actionTitle}>{actionTitle(data.newVsExisting ?? [])}</Text>

      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 10, height: 10, backgroundColor: C.accent, borderRadius: 1 }} />
          <Text style={{ fontSize: 8, color: C.muted }}>New GP</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 10, height: 10, backgroundColor: C.navy, borderRadius: 1 }} />
          <Text style={{ fontSize: 8, color: C.muted }}>Existing GP</Text>
        </View>
      </View>

      <View style={{ marginBottom: 18 }}>
        {rows.map((row) => (
          <StackedBar key={row.sales_manager ?? 'row'} row={row} />
        ))}
      </View>

      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.navy, borderBottomStyle: 'solid' }}>
        {COLS.map((col) => (
          <Text key={col.key} style={[pdfStyles.th, { flex: col.flex, textAlign: col.align }]}>{col.label}</Text>
        ))}
      </View>

      {rows.map((row) => (
        <TableRow key={row.sales_manager ?? 'row'} row={row} />
      ))}

      {!rows.length ? (
        <Text style={{ ...pdfStyles.td, marginTop: 8, color: C.muted }}>No new vs existing data for this period.</Text>
      ) : null}

      <Text style={pdfStyles.source}>
        Source: UBF portal new vs existing report · {data.meta.periodLabel} period · generated {data.meta.generatedAt.toLocaleString('en-NZ')}
        {data.meta.scoped ? ' · scoped to single rep' : ''}
      </Text>
    </View>
  )
}
