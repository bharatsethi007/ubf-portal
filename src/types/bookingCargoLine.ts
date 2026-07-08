export type LengthUnit = 'CM' | 'M' | 'IN'
export type WeightUnit = 'KG' | 'LB'

export type BookingCargoLine = {
  id: string
  booking_id: string
  ord: number
  pieces: number | null
  length_unit: LengthUnit
  length: number | null
  width: number | null
  height: number | null
  cbm: number | null
  weight_unit: WeightUnit
  weight: number | null
  goods_desc: string | null
}

export type CargoLineRow = {
  id: string
  goodsDesc: string
  pieces: string
  lengthUnit: LengthUnit
  length: string
  width: string
  height: string
  /** Stored CBM when no L×W×H (from extraction or DB). */
  cbm: string
  weightUnit: WeightUnit
  weight: string
}
