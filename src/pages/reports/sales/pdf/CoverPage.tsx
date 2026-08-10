import { Page, View, Text } from '@react-pdf/renderer'
import type { SalesReportData } from '../salesExportApi'
import HeaderBand from './HeaderBand'
import { C, pdfStyles, fmtReportDate } from './pdfTheme'
import { dashboardInsight, reportTitle } from './pdfReportHelpers'

type Props = { data: SalesReportData }

export default function CoverPage({ data }: Props) {
  const dateStr = fmtReportDate(data.meta.generatedAt)
  const subtitle = `${data.meta.periodLabel} · to ${dateStr}`
  return (
    <Page size="A4" style={pdfStyles.coverPage}>
      <HeaderBand title={reportTitle(data)} subtitle={subtitle} />
      <View style={{ paddingTop: 24 }}>
        <Text style={{ fontSize: 10, color: C.body, lineHeight: 1.5, marginBottom: 12 }}>
          {dashboardInsight(data)}
        </Text>
        <Text style={{ fontSize: 9, color: C.muted }}>Generated {dateStr}</Text>
      </View>
    </Page>
  )
}
