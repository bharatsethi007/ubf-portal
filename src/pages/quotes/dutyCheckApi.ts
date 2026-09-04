import { supabase } from '../../supabase'

export type DutyResult = {
  commodity: string
  originCountry: string | null
  value: number
  currency: string
  hsCode: string
  hsDescription: string
  dutyRatePct: number
  gstRatePct: number
  estimatedDuty: number
  estimatedGst: number
  confidence: string
  notes: string
  disclaimer: string
}

export async function checkDuty(input: { commodity: string; value: number; originCountry: string; currency?: string }): Promise<DutyResult> {
  const { data, error } = await supabase.functions.invoke('duty-check', {
    body: {
      commodity: input.commodity,
      value: input.value,
      originCountry: input.originCountry,
      currency: input.currency ?? 'NZD',
    },
  })
  if (error) throw new Error(error.message || 'Duty check failed')
  if (data?.error) throw new Error(String(data.error))
  return data as DutyResult
}

// One-line note summary to prepend to the quote's external notes.
export function dutyNoteLine(r: DutyResult): string {
  const cur = r.currency || 'NZD'
  const duty = r.dutyRatePct > 0 ? `${r.dutyRatePct}% (~${cur} ${r.estimatedDuty.toLocaleString()})` : 'Free'
  return `DUTY (indicative): HS ${r.hsCode} — ${r.hsDescription}. Duty ${duty}; GST ${r.gstRatePct}% (~${cur} ${r.estimatedGst.toLocaleString()}). Verify against NZ Working Tariff.`
}
