import { StyleSheet } from '@react-pdf/renderer'

export const NAVY = '#0A2472'
export const ORANGE = '#E8742A'
export const INK = '#0F172A'
export const MUTED = '#5B6474'
export const LINE = '#E6E8EE'

export const s = StyleSheet.create({
  cover: { fontFamily: 'General Sans', color: INK, backgroundColor: '#FFFFFF' },
  coverTop: { paddingTop: 34, paddingHorizontal: 48, paddingBottom: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { width: 100, height: 50, objectFit: 'contain', objectPosition: 'left' },
  coverRef: { fontSize: 8, color: MUTED, textAlign: 'right', lineHeight: 1.6 },
  band: { position: 'relative', height: 316, backgroundColor: NAVY },
  bandImg: { position: 'absolute', top: 0, left: 0, width: 595.28, height: 316 },
  bandText: { position: 'absolute', left: 48, right: 48, bottom: 40 },
  kicker: { fontSize: 7.5, letterSpacing: 1.6, color: '#F4A36B', marginBottom: 10 },
  coverTitle: { fontSize: 30, lineHeight: 1.18, color: '#FFFFFF', fontWeight: 500 },
  coverFor: { fontSize: 11.5, color: '#C7D0E6', marginTop: 10 },
  facts: { flexDirection: 'row', paddingHorizontal: 48, paddingTop: 34, gap: 18 },
  fact: { flex: 1 },
  cap: { fontSize: 7.5, letterSpacing: 1.4, color: ORANGE, marginBottom: 5 },
  factV: { fontSize: 10.5, lineHeight: 1.45 },
  toc: { paddingHorizontal: 48, paddingTop: 28 },
  tocRow: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 10, paddingVertical: 6, borderBottomWidth: 0.6, borderBottomColor: LINE },
  coverFoot: { position: 'absolute', left: 48, right: 48, bottom: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 8, color: MUTED, lineHeight: 1.55 },

  page: { fontFamily: 'General Sans', color: INK, fontSize: 9, paddingTop: 74, paddingBottom: 56, paddingHorizontal: 42 },
  head: { position: 'absolute', top: 26, left: 42, right: 42, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 9, borderBottomWidth: 0.6, borderBottomColor: LINE },
  headLogo: { width: 54, height: 27, objectFit: 'contain', objectPosition: 'left' },
  headRef: { fontSize: 7, letterSpacing: 1.2, color: MUTED },
  foot: { position: 'absolute', bottom: 24, left: 42, right: 42, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: MUTED, borderTopWidth: 0.6, borderTopColor: LINE, paddingTop: 7 },
  secCap: { fontSize: 7.5, letterSpacing: 1.4, color: ORANGE, marginBottom: 4 },
  secTitle: { fontSize: 16, color: NAVY, fontWeight: 500, marginBottom: 4 },
  secNote: { fontSize: 8.5, color: MUTED, lineHeight: 1.45, marginBottom: 12 },
  grp: { fontSize: 9.5, color: NAVY, fontWeight: 500, marginTop: 12, marginBottom: 5 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.6, borderBottomColor: LINE, paddingVertical: 5.5 },
  th: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: NAVY, paddingBottom: 5 },
  thc: { fontSize: 6.8, letterSpacing: 0.8, color: MUTED, paddingHorizontal: 4 },
  td: { fontSize: 8.6, paddingHorizontal: 4 },
  num: { textAlign: 'right' },
  strong: { fontWeight: 600 },
  cols: { flexDirection: 'row', gap: 18, marginTop: 6 },
  col: { flex: 1 },
  colT: { fontSize: 9, fontWeight: 600, marginBottom: 4 },
  colB: { fontSize: 8.3, lineHeight: 1.55, color: '#334155' },
})
