const LABELS: Record<string, string> = {
  LOPRELEASE: 'Line released',
  LOPRELEASECANCELLED: 'Line release cancelled',
  CUSTOMSRELEASE: 'Customs cleared',
  CUSTOMSRELEASECANCELLED: 'Customs clearance cancelled',
  MPIRELEASE: 'MPI released',
  MPIRELEASECANCELLED: 'MPI release cancelled',
  VBSCHANGED: 'VBS slot booked',
  VBSCHANGEDCANCELLED: 'VBS slot cancelled',
  VESSELARRIVAL: 'Vessel arrived',
  VESSELARRIVALCANCELLED: 'Vessel arrival cancelled',
  DISCHARGE: 'Discharged',
  DISCHARGECANCELLED: 'Discharge cancelled',
  GATEOUT: 'Gate out',
  GATEOUTCANCELLED: 'Gate out cancelled',
  GATEIN: 'Gate in depot',
  GATEINCANCELLED: 'Gate in cancelled',
  AVAILABLE: 'Available for pickup',
  LFTCHANGED: 'Last free day changed',
  LFTCHANGEDCANCELLED: 'Last free day cancelled',
  CLEARED: 'Cleared',
  DELIVERED: 'Delivered',
  DELIVEREDCANCELLED: 'Delivery cancelled',
}

export function portConnectEventLabel(code: string): string {
  const key = code.trim().toUpperCase().replace(/[\s-]+/g, '')
  if (LABELS[key]) return LABELS[key]
  return code
    .trim()
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function isCancelledEventCode(code: string): boolean {
  return /CANCELLED$/i.test(code.trim())
}
