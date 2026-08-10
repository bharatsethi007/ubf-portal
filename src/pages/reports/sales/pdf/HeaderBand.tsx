import { View, Text } from '@react-pdf/renderer'
import { C, PAGE_MARGIN, pdfStyles } from './pdfTheme'

type Props = {
  title: string
  subtitle: string
  compact?: boolean
}

export default function HeaderBand({ title, subtitle, compact }: Props) {
  const padV = compact ? 16 : 28
  return (
    <View style={{
      marginHorizontal: -PAGE_MARGIN,
      marginTop: -PAGE_MARGIN,
      backgroundColor: C.navy,
      paddingHorizontal: PAGE_MARGIN,
      paddingTop: padV,
      paddingBottom: padV,
      marginBottom: compact ? 16 : 28,
    }}>
      <Text style={{ ...pdfStyles.h1, color: C.paper, fontSize: compact ? 16 : 22 }}>{title}</Text>
      <View style={{ width: 48, height: 3, backgroundColor: C.accent, marginTop: 8, marginBottom: 8 }} />
      <Text style={{ fontSize: compact ? 9 : 11, color: C.paper, opacity: 0.92 }}>{subtitle}</Text>
    </View>
  )
}
