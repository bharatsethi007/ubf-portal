import { Document, Page } from '@react-pdf/renderer'
import { registerQuoteFonts } from '../../../quotes/pdf/quotePdfFonts'
import type { SalesReportData } from '../salesExportApi'
import CoverPage from './CoverPage'
import ExecutiveSummary from './ExecutiveSummary'
import LeaderboardExhibit from './LeaderboardExhibit'
import Furniture from './Furniture'
import { pdfStyles } from './pdfTheme'

registerQuoteFonts()

type Props = { data: SalesReportData }

export default function SalesReportPdf({ data }: Props) {
  return (
    <Document title={`UBF Sales Review ${data.meta.periodLabel}`} author="UB Freight">
      <CoverPage data={data} />
      <Page size="A4" style={pdfStyles.page} wrap>
        <ExecutiveSummary data={data} />
        <Furniture generatedAt={data.meta.generatedAt} />
      </Page>
      {data.sections.leaderboard ? (
        <Page size="A4" style={pdfStyles.page} wrap>
          <LeaderboardExhibit data={data} />
          <Furniture generatedAt={data.meta.generatedAt} />
        </Page>
      ) : null}
    </Document>
  )
}
