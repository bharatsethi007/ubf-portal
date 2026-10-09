import type { ReactNode } from 'react'
import { Image, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { BadgeTone, TimelineRow } from './clearanceAdviceFormat'

export const NAVY = '#0A2472'
const INK = '#111111'
const MUTED = '#6B7280'
const LINE = '#E5E7EB'

const TONE: Record<BadgeTone, { bg: string; fg: string }> = {
  ok: { bg: '#ECFDF5', fg: '#047857' },
  warn: { bg: '#FFFBEB', fg: '#B45309' },
  wait: { bg: '#F1F5F9', fg: '#475569' },
}

export const s = StyleSheet.create({
  page: { fontFamily: 'General Sans', fontSize: 9, color: INK, paddingTop: 34, paddingBottom: 54, paddingHorizontal: 40 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 12, borderBottomWidth: 1.5, borderBottomColor: NAVY, marginBottom: 14 },
  logo: { width: 110, height: 'auto', marginBottom: 6 },
  title: { fontSize: 16, fontWeight: 600, color: NAVY },
  sub: { fontSize: 8, color: MUTED, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3, fontSize: 9, fontWeight: 600 },
  section: { fontSize: 8, fontWeight: 600, color: NAVY, letterSpacing: 0.6, marginTop: 14, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '33.33%', paddingRight: 10, marginBottom: 9 },
  cellWide: { width: '100%', marginBottom: 9 },
  label: { fontSize: 7.5, color: MUTED, marginBottom: 2 },
  value: { fontSize: 9.5, fontWeight: 500 },
  small: { fontSize: 7.5, color: MUTED, marginTop: 1 },
  hero: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderWidth: 0.5, borderColor: LINE, borderRadius: 4, padding: 10, marginBottom: 4 },
  heroCell: { flex: 1, paddingRight: 8 },
  heroValue: { fontSize: 13, fontWeight: 600, color: NAVY },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 4 },
  th: { fontSize: 7.5, color: MUTED, fontWeight: 600 },
  c1: { width: 92 }, c2: { width: 58 }, c3: { flex: 1 },
  note: { marginTop: 12, padding: 8, borderWidth: 0.5, borderColor: '#FCD34D', backgroundColor: '#FFFBEB', borderRadius: 3, color: '#92400E', fontSize: 8.5 },
  foot: { position: 'absolute', bottom: 22, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: LINE, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: MUTED },
})

export function Badge({ text, tone }: { text: string; tone: BadgeTone }) {
  const t = TONE[tone]
  return <Text style={[s.badge, { backgroundColor: t.bg, color: t.fg }]}>{text}</Text>
}

export function Header({ logo, title, sub, badge }: {
  logo: string; title: string; sub: string; badge: { text: string; tone: BadgeTone }
}) {
  return (
    <View style={s.head}>
      <View>
        <Image src={logo} style={s.logo} />
        <Text style={s.title}>{title}</Text>
        <Text style={s.sub}>{sub}</Text>
      </View>
      <Badge {...badge} />
    </View>
  )
}

export type Field = { label: string; value: string; small?: string; wide?: boolean }

export function Fields({ items }: { items: Field[] }) {
  return (
    <View style={s.grid}>
      {items.map((f) => (
        <View key={f.label} style={f.wide ? s.cellWide : s.cell}>
          <Text style={s.label}>{f.label}</Text>
          <Text style={s.value}>{f.value}</Text>
          {f.small ? <Text style={s.small}>{f.small}</Text> : null}
        </View>
      ))}
    </View>
  )
}

export function Hero({ items }: { items: { label: string; value: string; extra?: ReactNode }[] }) {
  return (
    <View style={s.hero}>
      {items.map((h) => (
        <View key={h.label} style={s.heroCell}>
          <Text style={s.label}>{h.label}</Text>
          <Text style={s.heroValue}>{h.value}</Text>
          {h.extra ? <View style={{ marginTop: 4, flexDirection: 'row' }}>{h.extra}</View> : null}
        </View>
      ))}
    </View>
  )
}

export function Timeline({ rows }: { rows: TimelineRow[] }) {
  if (!rows.length) return <Text style={s.small}>No responses received yet.</Text>
  return (
    <View>
      <View style={s.tr}>
        <Text style={[s.th, s.c1]}>Time (NZ)</Text>
        <Text style={[s.th, s.c2]}>Code</Text>
        <Text style={[s.th, s.c3]}>Response</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={s.tr} wrap={false}>
          <Text style={s.c1}>{r.at}</Text>
          <Text style={s.c2}>{r.code}</Text>
          <Text style={s.c3}>{r.text}</Text>
        </View>
      ))}
    </View>
  )
}

export function Footer({ left, generated }: { left: string; generated: string }) {
  return (
    <View style={s.foot} fixed>
      <Text>{left}</Text>
      <Text render={({ pageNumber, totalPages }) => `${generated}  ·  Page ${pageNumber} of ${totalPages}`} />
    </View>
  )
}
