import { StyleSheet } from '@react-pdf/renderer'

export const EXHIBIT_SOURCE = 'Source: UBF Portal — mv_job_financials via customers.sales_manager'

export const C = {
  navy: '#0A2472',
  accent: '#F7941D',
  ink: '#1A1A2E',
  body: '#3F3F4B',
  muted: '#6B7280',
  hair: '#E5E7EB',
  zebra: '#F7F8FA',
  track: '#F1F2F6',
  paper: '#FFFFFF',
  pos: '#1F8A55',
  neg: '#C0392B',
}

export const PAGE_MARGIN = 40

export const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: PAGE_MARGIN,
    paddingBottom: 58,
    paddingHorizontal: PAGE_MARGIN,
    fontFamily: 'General Sans',
    fontSize: 9,
    color: C.body,
    backgroundColor: C.paper,
  },
  coverPage: {
    paddingTop: PAGE_MARGIN,
    paddingBottom: PAGE_MARGIN,
    paddingHorizontal: PAGE_MARGIN,
    fontFamily: 'General Sans',
    fontSize: 10,
    color: C.navy,
    backgroundColor: C.paper,
  },
  h1: {
    fontSize: 22,
    fontWeight: 700,
    color: C.navy,
    lineHeight: 1.2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: C.navy,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kicker: {
    fontSize: 7.5,
    fontWeight: 600,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  label: {
    fontSize: 7.5,
    fontWeight: 600,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  num: {
    textAlign: 'right',
  },
  // Legacy aliases — existing exhibit pages (not yet rewired)
  exhibitLabel: {
    fontSize: 7.5,
    fontWeight: 600,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: C.muted,
    marginBottom: 10,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: C.navy,
    marginBottom: 28,
    lineHeight: 1.4,
    maxWidth: '92%',
  },
  th: {
    fontSize: 7,
    fontWeight: 700,
    color: C.navy,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: C.navy,
    borderBottomStyle: 'solid',
  },
  td: {
    fontSize: 8.5,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: C.hair,
    borderBottomStyle: 'solid',
    color: C.body,
  },
  tdMuted: {
    fontSize: 8.5,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: C.hair,
    borderBottomStyle: 'solid',
    color: C.muted,
  },
  source: {
    fontSize: 7,
    color: C.muted,
    marginTop: 20,
    lineHeight: 1.5,
  },
  footnote: {
    fontSize: 7.5,
    color: C.muted,
    marginTop: 24,
    lineHeight: 1.5,
  },
  footerRule: {
    position: 'absolute',
    bottom: 36,
    left: PAGE_MARGIN,
    right: PAGE_MARGIN,
    borderTopWidth: 0.5,
    borderTopColor: C.hair,
    borderTopStyle: 'solid',
  },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: PAGE_MARGIN,
    right: PAGE_MARGIN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLeft: { fontSize: 7, color: C.muted, flex: 1 },
  footerCenter: { fontSize: 7, color: C.muted, textAlign: 'center', width: 140 },
  footerRight: { fontSize: 7, color: C.muted, width: 24, textAlign: 'right' },
})

export function fmtReportDate(d: Date): string {
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })
}
