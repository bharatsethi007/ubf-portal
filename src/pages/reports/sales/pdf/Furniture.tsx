import { View, Text } from '@react-pdf/renderer'
import { pdfStyles, fmtReportDate } from './pdfTheme'

type Props = { generatedAt: Date }

export default function Furniture({ generatedAt }: Props) {
  const dateStr = fmtReportDate(generatedAt)
  return (
    <>
      <View style={pdfStyles.footerRule} fixed />
      <View style={pdfStyles.footer} fixed>
        <Text style={pdfStyles.footerLeft}>UB Freight — Confidential — Internal use</Text>
        <Text style={pdfStyles.footerCenter}>{dateStr}</Text>
        <Text style={pdfStyles.footerRight} render={({ pageNumber }) => `${pageNumber}`} />
      </View>
    </>
  )
}
