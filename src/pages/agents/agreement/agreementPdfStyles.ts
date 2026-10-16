import { StyleSheet } from '@react-pdf/renderer'

export const NAVY = '#0A2472'
export const ORANGE = '#E8742A'
export const INK = '#0F172A'
export const MUTE = '#5B6474'
export const LINE = '#E6E8EE'

export const s = StyleSheet.create({
  page: { fontFamily: 'General Sans', fontSize: 9, color: INK, paddingTop: 64, paddingBottom: 56, paddingHorizontal: 54, lineHeight: 1.45 },
  cover: { fontFamily: 'General Sans', color: INK, padding: 0 },
  band: { backgroundColor: NAVY, height: 330, paddingHorizontal: 54, paddingBottom: 44, justifyContent: 'flex-end' },
  stripe: { height: 5, backgroundColor: ORANGE },
  logo: { width: 110, height: 60, objectFit: 'contain', objectPosition: 'left' },
  ref: { color: '#5B6474', fontSize: 8, textAlign: 'right', lineHeight: 1.5 },
  eyebrow: { color: '#F2A66E', fontSize: 8.5, letterSpacing: 2.4, marginBottom: 12 },
  title: { color: '#FFFFFF', fontSize: 34, fontWeight: 500, lineHeight: 1.15 },
  cap: { fontSize: 7, letterSpacing: 1.6, color: '#8A93A6', marginBottom: 4 },
  partyName: { fontSize: 15, fontWeight: 500, marginBottom: 3 },
  partyAddr: { fontSize: 8.5, color: MUTE, lineHeight: 1.4 },
  boxRow: { flexDirection: 'row', borderWidth: 1, borderColor: LINE, borderRadius: 4, marginHorizontal: 54, marginTop: 22 },
  boxCell: { flex: 1, paddingVertical: 10, paddingHorizontal: 12 },
  boxVal: { fontSize: 11.5 },
  officeRow: { flexDirection: 'row', marginHorizontal: 54, marginTop: 6 },
  office: { flex: 1, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8, marginRight: 14 },
  coverFoot: { position: 'absolute', bottom: 22, left: 54, right: 54, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: '#8A93A6' },
  head: { position: 'absolute', top: 26, left: 54, right: 54, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 8 },
  headLogo: { width: 52, height: 20, objectFit: 'contain' },
  headText: { fontSize: 7, letterSpacing: 1.2, color: '#8A93A6' },
  foot: { position: 'absolute', bottom: 24, left: 54, right: 54, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: '#8A93A6' },
  h: { flexDirection: 'row', alignItems: 'baseline', marginTop: 14, marginBottom: 6 },
  hn: { fontSize: 8, color: ORANGE, letterSpacing: 1, width: 26 },
  ht: { fontSize: 11.5, fontWeight: 500, color: NAVY },
  cl: { flexDirection: 'row', marginBottom: 4 },
  cn: { width: 26, color: '#8A93A6' },
  ct: { flex: 1 },
  p: { marginBottom: 6 },
  partyBox: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 4, padding: 10 },
  th: { flexDirection: 'row', backgroundColor: NAVY, color: '#FFFFFF', fontSize: 7, letterSpacing: 1.2 },
  tr: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: LINE },
  tk: { width: 130, padding: 6, color: MUTE, backgroundColor: '#FAFBFC', fontSize: 8 },
  tv: { flex: 1, padding: 6, fontSize: 8 },
  sigBox: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 5, padding: 14 },
  sigLine: { height: 62, borderBottomWidth: 1, borderBottomColor: '#94A3B8', justifyContent: 'flex-end', paddingBottom: 4, marginTop: 6, marginBottom: 12 },
  sigName: { fontFamily: 'Signature', fontSize: 30, color: NAVY, lineHeight: 1.1 },
  kv: { flexDirection: 'row', marginBottom: 4, fontSize: 8.5 },
  secCap: { fontSize: 8, letterSpacing: 1.6, color: ORANGE, marginBottom: 4 },
  secTitle: { fontSize: 17, color: NAVY, marginBottom: 8, lineHeight: 1.25 },
  k: { width: 70, color: MUTE },
})
