export type JsonRecord = Record<string, unknown>

export type ParsedWebhookEvent = {
  subscriptionEventId: number | null
  subscriptionId: number | null
  subscriptionContainerId: number | null
  containerNo: string
  containerVisitId: number | null
  containerVisitUri: string | null
  partnerPortCode: string | null
  containerVisitTypeCode: string | null
  eventTypeCode: string
  eventDatetime: string
  eventLocation: string | null
  eventValue: string | null
  eventValue2: string | null
  containerIsoType: string | null
  containerStatus: string | null
  inboundVesselRef: string | null
  inboundVesselName: string | null
  inboundVesselImo: number | null
  outboundVesselRef: string | null
  outboundVesselName: string | null
  bookingReference: string | null
  operatorScac: string | null
  userDefinedReference: string | null
  raw: JsonRecord
}

export type ContainerStatePatch = Record<string, unknown>
export type BookingStatePatch = Record<string, unknown>
export type TrackingSettingsPatch = Record<string, unknown>

export type ProcessResult = {
  processed: number
  skipped: number
  errors: string[]
  visitUris: Set<string>
}
