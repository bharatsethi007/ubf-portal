// DCSA (Maersk carrier feed) + SeaVantage event codes -> friendly labels.
const LABELS: Record<string, string> = {
  // DCSA transport
  ARRI: 'Vessel arrived',
  DEPA: 'Vessel departed',
  // DCSA equipment
  LOAD: 'Loaded',
  DISC: 'Discharged',
  GTIN: 'Gated in',
  GTOT: 'Gated out',
  STUF: 'Stuffed',
  STRP: 'Stripped',
  PICK: 'Picked up',
  DROP: 'Dropped off',
  RSEA: 'Resealed',
  RMVD: 'Removed',
  INSP: 'Inspected',
  // DCSA shipment
  RECE: 'Booking received',
  DRFT: 'Draft B/L',
  PENA: 'Pending approval',
  PENU: 'Pending update',
  REJE: 'Rejected',
  APPR: 'Approved',
  ISSU: 'B/L issued',
  SURR: 'B/L surrendered',
  SUBM: 'Submitted',
  VOID: 'Voided',
  CONF: 'Confirmed',
  REQS: 'Requested',
  CMPL: 'Completed',
  HOLD: 'On hold',
  RELS: 'Released',
  // SeaVantage container event codes
  EE: 'Empty dispatched',
  ER: 'Empty returned',
  I: 'Gate in',
  O: 'Gate out',
  AE: 'Loaded on vessel',
  UV: 'Discharged from vessel',
  VD: 'Vessel departed',
  VA: 'Vessel arrived',
  VB: 'Vessel berthed',
  RD: 'Rail departed',
  RA: 'Rail arrived',
  BD: 'Barge departed',
  BA: 'Barge arrived',
  // UBF TMS cartage milestones
  TMS_ALLOCATED: 'Cartage allocated',
  TMS_ONBOARD: 'Collected — on truck',
  TMS_DELIVERED: 'Delivered (cartage)',
  TMS_FAILED: 'Delivery failed',
  TMS_POD: 'Proof of delivery',
}

export function carrierEventLabel(code: string, fallback?: string | null): string {
  const c = code.trim().toUpperCase()
  return LABELS[c] ?? (fallback && fallback.trim() ? fallback.trim() : code.trim())
}
