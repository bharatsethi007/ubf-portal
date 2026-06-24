export function pillClass(status: string): string {
  if (status.startsWith('Arrived')) return 'arrived'
  if (status === 'In transit') return 'transit'
  if (status === 'Scheduled') return 'scheduled'
  return 'booked'
}

export function progressStep(status: string): number {
  if (status.startsWith('Arrived')) return 2
  if (status === 'In transit') return 1
  return 0
}

export const STATUS_OPTIONS = [
  'Booked',
  'Scheduled',
  'In transit',
  'Arrived (est.)',
  'Arrived',
] as const
