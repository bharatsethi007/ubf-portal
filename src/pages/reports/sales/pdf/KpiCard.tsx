import { View, Text } from '@react-pdf/renderer'
import { C, pdfStyles } from './pdfTheme'

type Props = { label: string; value: string; delta?: string }

function deltaColor(delta: string): string {
  if (delta.includes('▼')) return C.neg
  if (delta.includes('▲')) return C.pos
  return C.muted
}

export default function KpiCard({ label, value, delta }: Props) {
  return (
    <View style={{
      flex: 1,
      height: 72,
      backgroundColor: C.paper,
      borderTopWidth: 3,
      borderTopColor: C.accent,
      borderTopStyle: 'solid',
      borderLeftWidth: 0.5,
      borderRightWidth: 0.5,
      borderBottomWidth: 0.5,
      borderLeftColor: C.hair,
      borderRightColor: C.hair,
      borderBottomColor: C.hair,
      borderLeftStyle: 'solid',
      borderRightStyle: 'solid',
      borderBottomStyle: 'solid',
      paddingVertical: 10,
      paddingHorizontal: 12,
      justifyContent: 'space-between',
    }}>
      <Text style={pdfStyles.label}>{label}</Text>
      <View>
        <Text style={{ fontSize: 18, fontWeight: 700, color: C.navy, lineHeight: 1.1 }}>{value}</Text>
        {delta ? (
          <Text style={{ fontSize: 8, color: deltaColor(delta), marginTop: 4, fontWeight: 600 }}>{delta}</Text>
        ) : null}
      </View>
    </View>
  )
}
