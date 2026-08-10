import type { ReactNode } from 'react'
import { View, Text } from '@react-pdf/renderer'
import { C, pdfStyles } from './pdfTheme'

export type DataTableColumn = {
  key: string
  label: string
  align?: 'left' | 'right'
  accent?: 'orange' | 'navy'
  bold?: boolean
  flex?: number
}

type Props = {
  columns: DataTableColumn[]
  rows: Record<string, ReactNode>[]
  totals?: Record<string, ReactNode>
}

function accentColor(accent?: 'orange' | 'navy'): string | undefined {
  if (accent === 'orange') return C.accent
  if (accent === 'navy') return C.navy
  return undefined
}

function cellText(
  content: ReactNode,
  col: DataTableColumn,
  variant: 'head' | 'body' | 'total',
  zebra?: boolean,
) {
  const align = col.align ?? 'left'
  const base = variant === 'head'
    ? {
      fontSize: 8,
      fontWeight: 700 as const,
      color: C.paper,
      paddingVertical: 5,
      paddingHorizontal: 6,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.4,
    }
    : {
      fontSize: 8.5,
      fontWeight: (variant === 'total' || col.bold ? 700 : 400) as 700 | 400,
      color: accentColor(col.accent) ?? C.body,
      paddingVertical: 5,
      paddingHorizontal: 6,
      backgroundColor: variant === 'body' && zebra ? C.zebra : C.paper,
    }
  return (
    <Text style={{ ...base, flex: col.flex ?? 1, textAlign: align, ...(align === 'right' ? pdfStyles.num : {}) }}>
      {content}
    </Text>
  )
}

export default function DataTable({ columns, rows, totals }: Props) {
  return (
    <View>
      <View style={{ flexDirection: 'row', backgroundColor: C.navy }}>
        {columns.map((col) => cellText(col.label, col, 'head'))}
      </View>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row' }} wrap={false}>
          {columns.map((col) => cellText(row[col.key] ?? '—', col, 'body', i % 2 === 1))}
        </View>
      ))}
      {totals ? (
        <View style={{ flexDirection: 'row', borderTopWidth: 1.5, borderTopColor: C.navy, borderTopStyle: 'solid' }} wrap={false}>
          {columns.map((col) => cellText(totals[col.key] ?? '', { ...col, bold: true }, 'total'))}
        </View>
      ) : null}
    </View>
  )
}
