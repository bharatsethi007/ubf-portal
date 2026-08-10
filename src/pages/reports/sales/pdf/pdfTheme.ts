import { StyleSheet } from '@react-pdf/renderer'
import { NAVY, ORANGE } from '../../reportsUi'

export const EXHIBIT_SOURCE = 'Source: UBF Portal — mv_job_financials via customers.sales_manager'

export const C = {
  navy: NAVY,
  accent: ORANGE,
  ink: '#1A1A2E',
  body: '#3F3F4B',
  muted: '#6B7280',
  hair: '#E5E7EB',
  track: '#F1F2F6',
  paper: '#FFFFFF',
}

const PAGE_MARGIN = 48

export const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: PAGE_MARGIN,
    paddingBottom: 62,
    paddingHorizontal: PAGE_MARGIN,
    fontFamily: 'General Sans',
    fontSize: 9.5,
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
  num: {
    textAlign: 'right',
  },
  footerRule: {
    position: 'absolute',
    bottom: 40,
    left: PAGE_MARGIN,
    right: PAGE_MARGIN,
    borderTopWidth: 0.5,
    borderTopColor: C.hair,
    borderTopStyle: 'solid',
  },
  footer: {
    position: 'absolute',
    bottom: 22,
    left: PAGE_MARGIN,
    right: PAGE_MARGIN,
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
