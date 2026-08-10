import { StyleSheet } from '@react-pdf/renderer'
import { NAVY, ORANGE } from '../../reportsUi'

export const C = {
  navy: NAVY,
  accent: ORANGE,
  ink: '#1A1A2E',
  body: '#3F3F4B',
  muted: '#6B7280',
  hair: '#E5E7EB',
  pos: '#1F8A55',
  neg: '#C0392B',
  track: '#F1F2F6',
  paper: '#FFFFFF',
}

export const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 46,
    paddingBottom: 54,
    paddingHorizontal: 48,
    fontFamily: 'General Sans',
    fontSize: 9.5,
    color: C.body,
    backgroundColor: C.paper,
  },
  coverPage: {
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: 'General Sans',
    fontSize: 10,
    color: C.navy,
    backgroundColor: C.paper,
  },
  kicker: {
    fontSize: 8,
    fontWeight: 600,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: C.muted,
    marginBottom: 6,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: C.navy,
    marginBottom: 14,
    lineHeight: 1.35,
  },
  exhibitLabel: {
    fontSize: 7.5,
    fontWeight: 600,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: C.muted,
    marginBottom: 8,
  },
  th: {
    fontSize: 7,
    fontWeight: 700,
    color: C.navy,
    paddingVertical: 6,
    paddingHorizontal: 3,
    borderBottomWidth: 1,
    borderBottomColor: C.navy,
    borderBottomStyle: 'solid',
  },
  td: {
    fontSize: 8.5,
    paddingVertical: 5,
    paddingHorizontal: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: C.hair,
    borderBottomStyle: 'solid',
    color: C.body,
  },
  tdMuted: {
    fontSize: 8.5,
    paddingVertical: 5,
    paddingHorizontal: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: C.hair,
    borderBottomStyle: 'solid',
    color: C.muted,
  },
  source: {
    fontSize: 7,
    color: C.muted,
    marginTop: 10,
    lineHeight: 1.45,
  },
  num: {
    textAlign: 'right',
  },
  footerRule: {
    position: 'absolute',
    bottom: 38,
    left: 48,
    right: 48,
    borderTopWidth: 0.5,
    borderTopColor: C.hair,
    borderTopStyle: 'solid',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 48,
    right: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLeft: { fontSize: 7.5, color: C.muted, width: 40 },
  footerCenter: { fontSize: 7.5, color: C.muted, textAlign: 'center', flex: 1 },
  footerRight: { fontSize: 7.5, color: C.muted, width: 120, textAlign: 'right' },
})

export function fmtReportDate(d: Date): string {
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })
}
