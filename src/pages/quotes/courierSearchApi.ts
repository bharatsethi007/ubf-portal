import { supabase } from '../../supabase'

export type CourierSearchLocation = {
  countryCode: string
  city: string
  postcode: string
}

export type CourierSearchDestination = CourierSearchLocation & {
  residential: boolean
}

export type CourierSearchPiece = {
  qty: number
  weightKg: number
  lengthCm: number
  widthCm: number
  heightCm: number
}

export type DhlCourierSearchBody = {
  origin: CourierSearchLocation
  destination: CourierSearchDestination
  isDocuments: boolean
  pieces: CourierSearchPiece[]
}

export type DhlCourierOption = {
  service?: string
  product?: string
  productCode?: string
  total?: number
  amount?: number
  charge?: number
  currency?: string
  transitDays?: number
}

export type DhlCourierQuote =
  | { ok: true; best?: DhlCourierOption; options?: DhlCourierOption[]; currency?: string }
  | { ok: false; reason: string; detail?: string }

export async function runDhlCourier(body: DhlCourierSearchBody): Promise<DhlCourierQuote> {
  try {
    const { data, error } = await supabase.functions.invoke('courier-dhl-quote', { body })
    if (error) return { ok: false, reason: error.message }
    return (data ?? { ok: false, reason: 'no response' }) as DhlCourierQuote
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'DHL courier call failed' }
  }
}

export async function runFedexCourier(body: DhlCourierSearchBody): Promise<DhlCourierQuote> {
  try {
    const { data, error } = await supabase.functions.invoke('courier-fedex-quote', { body })
    if (error) return { ok: false, reason: error.message }
    return (data ?? { ok: false, reason: 'no response' }) as DhlCourierQuote
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'FedEx courier call failed' }
  }
}
