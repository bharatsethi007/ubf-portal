import { Font, StyleSheet, View, Text } from '@react-pdf/renderer'
import type { TmsConsignmentDetail } from '../tmsApi'

export const NAVY = '#0A2472'
export const INK = '#111111'
export const MUTED = '#666666'

let fontsReady = false
export function registerConsignmentPdfFonts() {
  if (fontsReady) return
  fontsReady = true
  Font.register({ family: 'General Sans', fonts: [
    { src: '/fonts/pdf/GeneralSans-400.ttf', fontWeight: 400 },
    { src: '/fonts/pdf/GeneralSans-500.ttf', fontWeight: 500 },
    { src: '/fonts/pdf/GeneralSans-600.ttf', fontWeight: 600 },
    { src: '/fonts/pdf/GeneralSans-700.ttf', fontWeight: 700 },
  ]})
  Font.registerHyphenationCallback((w) => [w])
}

export const MODE: Record<string, string> = { EA: 'EXPORT AIR', ES: 'EXPORT SEA', IA: 'IMPORT AIR', IS: 'IMPORT SEA' }

export const fmtDate = (v: unknown) =>
  v ? new Date(v as string).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

export function refFooterText(d: TmsConsignmentDetail): string {
  const x = d as any
  return [
    d.reference ? `Ref: ${d.reference}` : '',
    d.po_number ? `PO: ${d.po_number}` : '',
    x.booking?.booking_ref ? `Booking: ${x.booking.booking_ref}` : '',
    d.shipment_ref ? `Shipment: ${d.shipment_ref}` : (d.job_unique != null ? `Shipment: #${d.job_unique}` : ''),
  ].filter(Boolean).join('   \u00b7   ')
}

export const cargoTotals = (d: TmsConsignmentDetail) => {
  const c = d.cargo ?? []
  return {
    units: c.reduce((t, l) => t + (l.units ?? 0), 0),
    cube: c.reduce((t, l) => t + (l.total_cube_m3 ?? 0), 0),
    kg: c.reduce((t, l) => t + (l.weight_kg ?? 0), 0),
  }
}

const m = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  box: { borderWidth: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2 },
  g: { borderColor: INK, color: INK },
  dg: { borderColor: '#e11d1d', color: '#e11d1d' },
  fr: { borderColor: INK, color: INK },
  t: { fontSize: 12, fontWeight: 700, letterSpacing: 0.5 },
})

/** Goods markers: G / DG (+ Fragile) — mirrors the print-doc markers. */
export function GoodsMarkers({ d }: { d: TmsConsignmentDetail }) {
  const dg = d.goods_type === 'dangerous'
  return (
    <View style={m.wrap}>
      <View style={[m.box, dg ? m.dg : m.g]}><Text style={[m.t, { color: dg ? '#e11d1d' : INK }]}>{dg ? 'DG' : 'G'}</Text></View>
      {d.fragile ? <View style={[m.box, m.fr]}><Text style={[m.t, { color: INK }]}>FRAGILE</Text></View> : null}
    </View>
  )
}
