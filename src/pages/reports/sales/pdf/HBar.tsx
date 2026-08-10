import { View, Text } from '@react-pdf/renderer'
import { C } from './pdfTheme'

type Props = {
  label: string
  value: number
  max: number
  display: string
  annotation?: string
  labelWidth?: number
}

export default function HBar({ label, value, max, display, annotation, labelWidth = 108 }: Props) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 2
  const right = annotation ? `${display} · ${annotation}` : display
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7, gap: 8 }}>
      <Text style={{ width: labelWidth, fontSize: 8.5, color: C.body }}>{label}</Text>
      <View style={{ flex: 1, height: 12, backgroundColor: C.track, borderRadius: 2 }}>
        <View style={{ width: `${pct}%`, height: 12, backgroundColor: C.navy, borderRadius: 2 }} />
      </View>
      <Text style={{ width: 118, fontSize: 8, textAlign: 'right', color: C.ink }}>{right}</Text>
    </View>
  )
}
