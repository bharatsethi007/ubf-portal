import { cargoLineToDb, computeCargoTotals, isCargoLineEmpty } from '../../components/bookings/cargoLineUtils'
import type { CustomerPickerValue } from '../../hooks/useBookings'
import type { Booking, BookingModule, BookingServiceType, BookingSource, BookingStatus, BookingSupplier } from '../../types/booking'
import type { BookingCargoLine, CargoLineRow } from '../../types/bookingCargoLine'

export type CustomerRef = CustomerPickerValue | null

export type SupplierRowState = {
  id: string
  customer: CustomerRef
  companyName: string
  address: string
  city: string
  country: string
  pieces: string
  weight: string
  cbm: string
  goodsDescription: string
}

export type BookingFormState = {
  serviceType: BookingServiceType | ''
  incoterm: string
  origin: string
  destination: string
  airline: string
  airlineName: string
  flightNo: string
  cargoReadyDate: string
  etd: string
  eta: string
  hawb: string
  mawb: string
  isConsolidation: boolean
  shipperCustomer: CustomerRef
  shipperCompany: string
  shipperPhone: string
  shipperEmail: string
  shipperContact: string
  shipperAddress: string
  shipperCity: string
  shipperState: string
  shipperPostcode: string
  shipperCountry: string
  suppliers: SupplierRowState[]
  consigneeCustomer: CustomerRef
  consigneeCompany: string
  consigneePhone: string
  consigneeEmail: string
  consigneeContact: string
  consigneeAddress: string
  consigneeCity: string
  consigneeState: string
  consigneePostcode: string
  consigneeCountry: string
  packingType: string
  commodity: string
  isDg: boolean
  unNumber: string
  dgClass: string
  isTempControlled: boolean
  tempRange: string
  isValuable: boolean
  isOog: boolean
  specialInstructions: string
  notifyName: string
  notifyAddress: string
  notifyCountry: string
}

export function newSupplierRow(): SupplierRowState {
  return {
    id: crypto.randomUUID(),
    customer: null,
    companyName: '',
    address: '',
    city: '',
    country: '',
    pieces: '',
    weight: '',
    cbm: '',
    goodsDescription: '',
  }
}

export function emptyFormState(): BookingFormState {
  return {
    serviceType: '',
    incoterm: 'EXW',
    origin: '',
    destination: '',
    airline: '',
    airlineName: '',
    flightNo: '',
    cargoReadyDate: '',
    etd: '',
    eta: '',
    hawb: '',
    mawb: '',
    isConsolidation: false,
    shipperCustomer: null,
    shipperCompany: '',
    shipperPhone: '',
    shipperEmail: '',
    shipperContact: '',
    shipperAddress: '',
    shipperCity: '',
    shipperState: '',
    shipperPostcode: '',
    shipperCountry: '',
    suppliers: [newSupplierRow()],
    consigneeCustomer: null,
    consigneeCompany: '',
    consigneePhone: '',
    consigneeEmail: '',
    consigneeContact: '',
    consigneeAddress: '',
    consigneeCity: '',
    consigneeState: '',
    consigneePostcode: '',
    consigneeCountry: '',
    packingType: '',
    commodity: '',
    isDg: false,
    unNumber: '',
    dgClass: '',
    isTempControlled: false,
    tempRange: '',
    isValuable: false,
    isOog: false,
    specialInstructions: '',
    notifyName: '',
    notifyAddress: '',
    notifyCountry: '',
  }
}

function str(v: string | number | null | undefined): string {
  return v == null ? '' : String(v)
}

function customerRef(accountId: string | null | undefined, name: string | null | undefined): CustomerRef {
  if (!accountId) return null
  return { account_id: accountId, name: name ?? accountId }
}

function customerFullAddress(c: CustomerPickerValue): string {
  return [c.address1, c.address2, c.address3].filter(Boolean).join(', ')
}

export function applySupplierCustomer(c: CustomerPickerValue | null): Partial<SupplierRowState> {
  if (!c) {
    return {
      customer: null,
      companyName: '',
      address: '',
      city: '',
      country: '',
    }
  }
  return {
    customer: c,
    companyName: c.name,
    address: customerFullAddress(c),
    city: c.city ?? '',
    country: c.country ?? '',
  }
}

export function applyShipperCustomer(c: CustomerPickerValue | null): Partial<BookingFormState> {
  if (!c) {
    return {
      shipperCustomer: null,
      shipperCompany: '',
      shipperPhone: '',
      shipperEmail: '',
      shipperContact: '',
      shipperAddress: '',
      shipperCity: '',
      shipperState: '',
      shipperPostcode: '',
      shipperCountry: '',
    }
  }
  return {
    shipperCustomer: c,
    shipperCompany: c.name,
    shipperPhone: c.phone ?? '',
    shipperEmail: c.email ?? '',
    shipperContact: c.contact ?? '',
    shipperAddress: customerFullAddress(c),
    shipperCity: c.city ?? '',
    shipperState: c.state ?? '',
    shipperPostcode: c.postcode ?? '',
    shipperCountry: c.country ?? '',
  }
}

export function applyConsigneeCustomer(c: CustomerPickerValue | null): Partial<BookingFormState> {
  if (!c) {
    return {
      consigneeCustomer: null,
      consigneeCompany: '',
      consigneePhone: '',
      consigneeEmail: '',
      consigneeContact: '',
      consigneeAddress: '',
      consigneeCity: '',
      consigneeState: '',
      consigneePostcode: '',
      consigneeCountry: '',
    }
  }
  return {
    consigneeCustomer: c,
    consigneeCompany: c.name,
    consigneePhone: c.phone ?? '',
    consigneeEmail: c.email ?? '',
    consigneeContact: c.contact ?? '',
    consigneeAddress: customerFullAddress(c),
    consigneeCity: c.city ?? '',
    consigneeState: c.state ?? '',
    consigneePostcode: c.postcode ?? '',
    consigneeCountry: c.country ?? '',
  }
}

function supplierFromRow(s: BookingSupplier): SupplierRowState {
  return {
    id: s.id || crypto.randomUUID(),
    customer: customerRef(s.supplier_account_id, s.supplier_name),
    companyName: s.supplier_name ?? '',
    address: s.supplier_address ?? '',
    city: s.supplier_city ?? '',
    country: s.supplier_country ?? '',
    pieces: str(s.pieces),
    weight: str(s.gross_weight_kg ?? s.weight_kg),
    cbm: str(s.cbm ?? s.volume_m3),
    goodsDescription: s.goods_description ?? '',
  }
}

export function formFromBooking(booking: Booking, suppliers: BookingSupplier[]): BookingFormState {
  const base = emptyFormState()
  const first = suppliers[0]
  const shipperFromSupplier = !booking.is_consolidation && first

  return {
    ...base,
    serviceType: booking.service_type ?? '',
    incoterm: booking.incoterm ?? 'EXW',
    origin: booking.origin ?? '',
    destination: booking.destination ?? '',
    airline: booking.airline ?? '',
    airlineName: booking.airline_name ?? '',
    flightNo: booking.flight_no ?? '',
    cargoReadyDate: booking.cargo_ready_date ?? '',
    etd: booking.etd ?? '',
    eta: booking.eta ?? '',
    hawb: booking.hawb ?? '',
    mawb: booking.mawb ?? '',
    isConsolidation: booking.is_consolidation,
    shipperCustomer: shipperFromSupplier
      ? customerRef(first.supplier_account_id, first.supplier_name)
      : null,
    shipperCompany: shipperFromSupplier ? (first.supplier_name ?? '') : '',
    shipperPhone: booking.shipper_phone ?? first?.supplier_phone ?? '',
    shipperEmail: booking.shipper_email ?? first?.supplier_email ?? '',
    shipperAddress: booking.shipper_address ?? first?.supplier_address ?? '',
    shipperCity: booking.shipper_city ?? first?.supplier_city ?? '',
    shipperCountry: booking.shipper_country ?? first?.supplier_country ?? '',
    suppliers: booking.is_consolidation && suppliers.length ? suppliers.map(supplierFromRow) : [newSupplierRow()],
    consigneeCustomer: customerRef(
      booking.consignee_account_id ?? booking.importer_account_id,
      booking.consignee_name ?? booking.importer_name,
    ),
    consigneeCompany: booking.consignee_name ?? booking.importer_name ?? '',
    consigneePhone: booking.consignee_phone ?? '',
    consigneeEmail: booking.consignee_email ?? '',
    consigneeAddress: booking.consignee_address ?? '',
    consigneeCity: booking.consignee_city ?? '',
    consigneeCountry: booking.consignee_country ?? '',
    packingType: booking.packing_type ?? '',
    commodity: booking.commodity ?? '',
    isDg: booking.is_dg ?? false,
    unNumber: booking.un_number ?? '',
    dgClass: booking.dg_class ?? '',
    isTempControlled: booking.is_temp_controlled ?? false,
    tempRange: booking.temp_range ?? '',
    isValuable: booking.is_valuable ?? false,
    isOog: booking.is_oog ?? false,
    specialInstructions: booking.special_instructions ?? '',
    notifyName: booking.notify_name ?? '',
    notifyAddress: booking.notify_address ?? '',
    notifyCountry: booking.notify_country ?? '',
  }
}

export function parseNum(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function supplierPayload(row: SupplierRowState): Partial<BookingSupplier> {
  return {
    supplier_name: row.companyName.trim() || row.customer?.name || null,
    supplier_account_id: row.customer?.account_id ?? null,
    supplier_address: row.address.trim() || null,
    supplier_city: row.city.trim() || null,
    supplier_country: row.country.trim() || null,
    pieces: parseNum(row.pieces) != null ? Math.trunc(parseNum(row.pieces)!) : null,
    gross_weight_kg: parseNum(row.weight),
    cbm: parseNum(row.cbm),
    goods_description: row.goodsDescription.trim() || null,
    weight_kg: parseNum(row.weight),
    volume_m3: parseNum(row.cbm),
  }
}

export function formToSavePayload(
  state: BookingFormState,
  module: BookingModule,
  status: BookingStatus,
  cargoLines: CargoLineRow[],
  bookingId?: string,
  existingSource?: BookingSource | null,
): { payload: Partial<Booking>; suppliers: Partial<BookingSupplier>[]; cargoLines: Partial<BookingCargoLine>[] } {
  const activeLines = cargoLines.filter((row) => !isCargoLineEmpty(row))
  const totals = computeCargoTotals(activeLines)
  const firstDesc = activeLines.find((row) => row.goodsDesc.trim())?.goodsDesc.trim() ?? null
  const source: BookingSource = bookingId ? (existingSource ?? 'manual') : 'manual'

  const payload: Partial<Booking> = {
    ...(bookingId ? { id: bookingId } : {}),
    module,
    source,
    status,
    account_id: state.consigneeCustomer?.account_id ?? null,
    is_consolidation: state.isConsolidation,
    importer_name: state.consigneeCompany.trim() || state.consigneeCustomer?.name || null,
    importer_account_id: state.consigneeCustomer?.account_id ?? null,
    origin: state.origin.trim() || null,
    destination: state.destination.trim() || null,
    etd: state.etd || null,
    eta: state.eta || null,
    cargo_ready_date: state.cargoReadyDate || null,
    airline: state.airline.trim() || null,
    airline_name: state.airlineName.trim() || null,
    flight_no: state.flightNo.trim() || null,
    vessel_flight: [state.airline, state.flightNo].filter(Boolean).join(' ') || null,
    service_type: state.serviceType || undefined,
    incoterm: state.incoterm.trim() || null,
    shipper_address: state.shipperAddress.trim() || null,
    shipper_city: state.shipperCity.trim() || null,
    shipper_country: state.shipperCountry.trim() || null,
    shipper_phone: state.shipperPhone.trim() || null,
    shipper_email: state.shipperEmail.trim() || null,
    consignee_account_id: state.consigneeCustomer?.account_id ?? null,
    consignee_name: state.consigneeCompany.trim() || state.consigneeCustomer?.name || null,
    consignee_address: state.consigneeAddress.trim() || null,
    consignee_city: state.consigneeCity.trim() || null,
    consignee_country: state.consigneeCountry.trim() || null,
    consignee_phone: state.consigneePhone.trim() || null,
    consignee_email: state.consigneeEmail.trim() || null,
    pieces: totals.totalPieces != null ? Math.trunc(totals.totalPieces) : null,
    gross_weight_kg: totals.totalWeightKg,
    weight_kg: totals.totalWeightKg,
    cbm: totals.totalCbm,
    volume_m3: totals.totalCbm,
    chargeable_weight_kg: totals.chargeableWeightKg,
    goods_description: firstDesc,
    packing_type: state.packingType.trim() || null,
    is_dg: state.isDg,
    un_number: state.unNumber.trim() || null,
    dg_class: state.dgClass.trim() || null,
    is_temp_controlled: state.isTempControlled,
    temp_range: state.tempRange.trim() || null,
    is_valuable: state.isValuable,
    is_oog: state.isOog,
    special_instructions: state.specialInstructions.trim() || null,
  }

  let suppliers: Partial<BookingSupplier>[]
  if (state.isConsolidation) {
    suppliers = state.suppliers.filter((r) => r.customer?.name || r.companyName.trim()).map(supplierPayload)
  } else {
    suppliers = [
      supplierPayload({
        ...newSupplierRow(),
        customer: state.shipperCustomer,
        companyName: state.shipperCompany,
        address: state.shipperAddress,
        city: state.shipperCity,
        country: state.shipperCountry,
        pieces: totals.totalPieces != null ? String(Math.trunc(totals.totalPieces)) : '',
        weight: totals.totalWeightKg != null ? String(totals.totalWeightKg) : '',
        cbm: totals.totalCbm != null ? String(totals.totalCbm) : '',
        goodsDescription: firstDesc ?? '',
      }),
    ]
  }

  if (!state.isConsolidation) {
    payload.shipper_address = state.shipperAddress.trim() || null
    payload.shipper_city = state.shipperCity.trim() || null
    payload.shipper_country = state.shipperCountry.trim() || null
  }

  const cargoLinePayload = activeLines.map((row, index) => cargoLineToDb(row, index))
  return { payload, suppliers, cargoLines: cargoLinePayload }
}
