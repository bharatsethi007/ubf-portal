import { Page, View, Text, Image } from '@react-pdf/renderer'
import type { SalesReportData } from '../salesExportApi'
import { C, pdfStyles, fmtReportDate } from './pdfTheme'

type Props = { data: SalesReportData }

export default function CoverPage({ data }: Props) {
  const dateStr = fmtReportDate(data.meta.generatedAt)
  const prepared = data.meta.preparedFor.trim() || '—'
  return (
    <Page size="A4" style={pdfStyles.coverPage}>
      <View style={{ minHeight: '100%', justifyContent: 'space-between' }}>
        <View>
          <Image src="/ub-logo-pdf.png" style={{ width: 96, height: 52, objectFit: 'contain', marginBottom: 48 }} />
          <View style={{ width: 72, height: 2, backgroundColor: C.navy, marginBottom: 40 }} />
          <Text style={{ fontSize: 28, fontWeight: 700, color: C.navy, letterSpacing: -0.3, marginBottom: 16 }}>
            Sales Performance Review
          </Text>
          <Text style={{ fontSize: 13, fontWeight: 500, color: C.navy, marginBottom: 10 }}>
            {data.meta.periodLabel} · to {dateStr}
          </Text>
          <Text style={{ fontSize: 11, color: C.body }}>
            Prepared for {prepared} · {dateStr}
          </Text>
        </View>
        <Text style={{ fontSize: 8.5, color: C.muted, letterSpacing: 0.3 }}>
          Confidential — for internal and authorised client use only.
        </Text>
      </View>
    </Page>
  )
}
