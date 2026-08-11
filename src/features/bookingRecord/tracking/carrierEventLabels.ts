// DCSA Track & Trace v2.2 event type codes -> friendly labels (Maersk carrier feed).
const LABELS: Record<string, string> = {
  // Transport events
  ARRI: 'Vessel arrived',
  DEPA: 'Vessel departed',
  // Equipment events
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
  // Shipment events
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
}

export function carrierEventLabel(code: string): string {
  return LABELS[code.trim().toUpperCase()] ?? code.trim()
}
