import { View, Text } from '@react-pdf/renderer'
import { pdfStyles, fmtReportDate } from './pdfTheme'

type Props = { generatedAt: Date }

export default function Furniture({ generatedAt }: Props) {
  const dateStr = fmtReportDate(generatedAt)
  return (
    <>
      <View style={pdfStyles.footerRule} fixed />
      <View style={pdfStyles.footer} fixed>
        <Text style={pdfStyles.footerLeft} render={({ pageNumber }) => `${pageNumber}`} />
        <Text style={pdfStyles.footerCenter}>UB Freight — Confidential</Text>
        <Text style={pdfStyles.footerRight}>{dateStr}</Text>
      </View>
    </>
  )
}
