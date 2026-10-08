import type { ReactNode } from 'react'
import { Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { money, monthLabel, pct } from '../financeUtil'

export const K = {
  navy: '#0A2472', orange: '#F7941D', ink: '#1A1A2E', body: '#3F3F4B', mut: '#6B7280', faint: '#9CA3AF',
  hair: '#E5E7EB', rule: '#C9CED8', zebra: '#F7F8FA', track: '#EEF0F4', light: '#B9C4E2', paper: '#FFFFFF',
  pos: '#1F8A55', neg: '#C0392B', warn: '#B26A00',
}
const M = 36

export const S = StyleSheet.create({
  page: { paddingTop: 62, paddingBottom: 54, paddingHorizontal: M, fontFamily: 'General Sans', fontSize: 8.5, color: K.body, backgroundColor: K.paper },
  title: { fontSize: 15, fontWeight: 600, color: K.navy, lineHeight: 1.25 },
  lead: { fontSize: 9.5, color: K.body, lineHeight: 1.45, marginTop: 5, marginBottom: 14, maxWidth: 470 },
  h3: { fontSize: 8, fontWeight: 600, color: K.mut, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 },
  note: { fontSize: 7, color: K.mut, lineHeight: 1.45, marginTop: 6 },
  num: { textAlign: 'right' },
})

export const fullMonth = (m: string) => new Date(`${m}T00:00:00`).toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' })
export const shortM = monthLabel

/* Page frame: running header, action title + lead, footer with page numbers. */
export function BpPage({ section, month, title, lead, children }: { section: string; month: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <Page size="A4" style={S.page} wrap>
      <View fixed style={{ position: 'absolute', top: 24, left: M, right: M, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: K.hair }}>
        <Text style={{ fontSize: 7, color: K.mut }}>UB Freight · Board pack · {fullMonth(month)}</Text>
        <Text style={{ fontSize: 7, color: K.navy, fontWeight: 500 }}>{section}</Text>
      </View>
      <Text style={S.title}>{title}</Text>
      {lead ? <Text style={S.lead}>{lead}</Text> : <View style={{ height: 12 }} />}
      {children}
      <View fixed style={{ position: 'absolute', bottom: 22, left: M, right: M, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6, borderTopWidth: 0.5, borderTopColor: K.hair }}>
        <Text style={{ fontSize: 6.5, color: K.mut }}>Confidential. Unaudited management accounts from the TradeWindow ledger. No depreciation or income tax is posted.</Text>
        <Text style={{ fontSize: 6.5, color: K.mut }} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  )
}

export function Kpi({ label, value, sub, delta, good }: { label: string; value: string; sub?: string; delta?: string; good?: boolean | null }) {
  const dc = good == null ? K.mut : good ? K.pos : K.neg
  return (
    <View style={{ flex: 1, borderTopWidth: 2, borderTopColor: K.navy, paddingTop: 7, paddingRight: 6 }}>
      <Text style={{ fontSize: 6.8, color: K.mut, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: 600, color: K.ink, marginTop: 4 }}>{value}</Text>
      {delta ? <Text style={{ fontSize: 7.2, color: dc, marginTop: 2 }}>{delta}</Text> : null}
      {sub ? <Text style={{ fontSize: 7, color: K.mut, marginTop: 2 }}>{sub}</Text> : null}
    </View>
  )
}
export const KpiRow = ({ children }: { children: ReactNode }) => <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>{children}</View>

/* Generic financial table. Cells are pre-formatted strings. */
export type Kind = 'section' | 'line' | 'sub' | 'total' | 'pct' | 'memo' | 'head2'
export type Col = { label: string; w?: number; align?: 'left' | 'right' }
export type Row = { kind?: Kind; cells: (string | null)[]; neg?: boolean[] }

export function Table({ cols, rows, dense }: { cols: Col[]; rows: Row[]; dense?: boolean }) {
  const pad = dense ? 3 : 4
  const cell = (c: Col, i: number, txt: string | null, r?: Row) => {
    const k = r?.kind ?? 'line'
    const strong = k === 'sub' || k === 'total'
    const right = (c.align ?? (i === 0 ? 'left' : 'right')) === 'right'
    return (
      <Text key={i} style={{
        flex: c.w ?? (i === 0 ? 3 : 1), textAlign: right ? 'right' : 'left', paddingVertical: pad, paddingHorizontal: 4,
        paddingLeft: i === 0 && (k === 'line' || k === 'memo' || k === 'pct') ? 12 : 4,
        fontSize: k === 'section' ? 7 : 8, fontWeight: strong ? 600 : 400,
        color: k === 'section' ? K.mut : r?.neg?.[i] ? K.neg : k === 'pct' || k === 'memo' ? K.mut : K.ink,
        textTransform: k === 'section' ? 'uppercase' : 'none', letterSpacing: k === 'section' ? 0.6 : 0,
      }}>{txt ?? ''}</Text>
    )
  }
  return (
    <View>
      <View style={{ flexDirection: 'row', borderBottomWidth: 0.8, borderBottomColor: K.navy }} fixed>
        {cols.map((c, i) => (
          <Text key={i} style={{ flex: c.w ?? (i === 0 ? 3 : 1), textAlign: (c.align ?? (i === 0 ? 'left' : 'right')), fontSize: 6.8, color: K.navy,
            fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, paddingVertical: 4, paddingHorizontal: 4 }}>{c.label}</Text>
        ))}
      </View>
      {rows.map((r, j) => {
        const k = r.kind ?? 'line'
        return (
          <View key={j} wrap={false} style={{
            flexDirection: 'row',
            borderTopWidth: k === 'sub' ? 0.5 : k === 'total' ? 0.8 : 0, borderTopColor: k === 'total' ? K.ink : K.rule,
            borderBottomWidth: k === 'total' ? 0.8 : k === 'section' ? 0 : 0.3, borderBottomColor: k === 'total' ? K.ink : K.hair,
            backgroundColor: k === 'total' ? K.zebra : K.paper, marginTop: k === 'section' && j ? 6 : 0,
          }}>
            {cols.map((c, i) => cell(c, i, r.cells[i], r))}
          </View>
        )
      })}
    </View>
  )
}

/* formatting */
export const m0 = (v: number | null | undefined) => (v == null ? '–' : money(Math.round(v)))
export const k0 = (v: number | null | undefined) => (v == null ? '–' : `${v < 0 ? '(' : ''}${Math.round(Math.abs(v) / 1000).toLocaleString('en-NZ')}${v < 0 ? ')' : ''}`)
export const p1 = (v: number | null | undefined) => (v == null || !isFinite(v) ? '–' : pct(v))
export const chg = (a: number | null, b: number | null) => (a == null || b == null || !b ? null : ((a - b) / Math.abs(b)) * 100)
export const chgTxt = (a: number | null, b: number | null) => {
  const c = chg(a, b)
  return c == null ? '–' : `${c >= 0 ? '+' : ''}${c.toFixed(0)}%`
}

export function Callout({ tone, title, body }: { tone: 'good' | 'warn' | 'bad' | 'info'; title: string; body: string }) {
  const c = tone === 'good' ? K.pos : tone === 'bad' ? K.neg : tone === 'warn' ? K.orange : K.navy
  return (
    <View wrap={false} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
      <View style={{ width: 2.5, backgroundColor: c }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 8.6, fontWeight: 600, color: K.ink }}>{title}</Text>
        <Text style={{ fontSize: 8, color: K.body, lineHeight: 1.45, marginTop: 1.5 }}>{body}</Text>
      </View>
    </View>
  )
}
