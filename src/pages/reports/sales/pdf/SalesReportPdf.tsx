import type { ReactNode } from 'react'
import { Document, Page } from '@react-pdf/renderer'
import { registerQuoteFonts } from '../../../quotes/pdf/quotePdfFonts'
import type { SalesReportData } from '../salesExportApi'
import CoverPage from './CoverPage'
import ExecutiveDashboard from './ExecutiveDashboard'
import LeaderboardExhibit from './LeaderboardExhibit'
import TopAccountsExhibit from './TopAccountsExhibit'
import TradeLanesExhibit from './TradeLanesExhibit'
import Furniture from './Furniture'
import { pdfStyles } from './pdfTheme'
import { reportTitle } from './pdfReportHelpers'

registerQuoteFonts()

type Props = { data: SalesReportData }

function ContentPage({ data, children }: { data: SalesReportData; children: ReactNode }) {
  return (
    <Page size="A4" style={pdfStyles.page} wrap>
      {children}
      <Furniture generatedAt={data.meta.generatedAt} />
    </Page>
  )
}

export default function SalesReportPdf({ data }: Props) {
  return (
    <Document title={reportTitle(data)} author="UB Freight">
      <CoverPage data={data} />
      <ContentPage data={data}>
        <ExecutiveDashboard data={data} />
      </ContentPage>
      {data.sections.leaderboard ? (
        <ContentPage data={data}>
          <LeaderboardExhibit data={data} />
        </ContentPage>
      ) : null}
      {data.sections.topAccounts && data.accounts ? (
        <ContentPage data={data}>
          <TopAccountsExhibit data={data} />
        </ContentPage>
      ) : null}
      {data.sections.tradeLanes && data.lanes ? (
        <ContentPage data={data}>
          <TradeLanesExhibit data={data} />
        </ContentPage>
      ) : null}
    </Document>
  )
}
