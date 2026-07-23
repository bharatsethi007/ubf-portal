/** True when discharge port is Lyttelton (LFT events unsupported at NZLYT). */
export function isLytteltonPort(port: string | null | undefined): boolean {
  if (!port?.trim()) return false
  const upper = port.trim().toUpperCase()
  return upper.includes('NZLYT') || upper.includes('LYTTELTON') || upper === 'LYT'
}

export function containerNumbersFromBooking(
  containers: { container_no: string | null }[] | null | undefined,
): string[] {
  return [...new Set(
    (containers ?? [])
      .map((c) => c.container_no?.trim().toUpperCase())
      .filter((v): v is string => Boolean(v)),
  )]
}
