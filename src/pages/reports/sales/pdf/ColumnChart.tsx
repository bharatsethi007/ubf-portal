import { View, Text } from '@react-pdf/renderer'
import { C } from './pdfTheme'

type Point = { label: string; value: number }

type Props = {
  points: Point[]
  height?: number
  highlightLast?: boolean
  showValues?: boolean
}

export default function ColumnChart({ points, height = 90, highlightLast = false, showValues = false }: Props) {
  const max = points.reduce((m, p) => Math.max(m, p.value), 0) || 1
  const barWidth = points.length ? Math.min(28, Math.floor(240 / points.length)) : 20

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: height + (showValues ? 14 : 0), paddingBottom: 2 }}>
        {points.map((p, i) => {
          const barH = Math.max(2, (p.value / max) * height)
          const isLast = i === points.length - 1
          const color = highlightLast && isLast ? C.accent : C.navy
          return (
            <View key={`${p.label}-${i}`} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              {showValues && p.value > 0 ? (
                <Text style={{ fontSize: 7, color: C.muted, marginBottom: 3 }}>{p.value}</Text>
              ) : null}
              <View style={{ width: barWidth, height: barH, backgroundColor: color }} />
            </View>
          )
        })}
      </View>
      <View style={{ height: 0.5, backgroundColor: C.hair, marginTop: 2 }} />
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
        {points.map((p, i) => (
          <Text key={`lbl-${p.label}-${i}`} style={{ flex: 1, fontSize: 7, color: C.muted, textAlign: 'center' }}>
            {p.label}
          </Text>
        ))}
      </View>
    </View>
  )
}
