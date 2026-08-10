import { View, Text } from '@react-pdf/renderer'
import { C, pdfStyles } from './pdfTheme'

type Props = { n: number; title: string }

export default function SectionHeader({ n, title }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18, marginTop: 4, gap: 10 }}>
      <View style={{
        width: 14, height: 14, backgroundColor: C.navy,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: C.paper, fontSize: 8, fontWeight: 700, lineHeight: 1 }}>{n}</Text>
      </View>
      <Text style={pdfStyles.sectionTitle}>{title}</Text>
      <View style={{ flex: 1, height: 0.5, backgroundColor: C.hair }} />
    </View>
  )
}
