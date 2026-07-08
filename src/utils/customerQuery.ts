const PAGE_SIZE = 25

export { PAGE_SIZE }

export function customerPageRange(page: number): { from: number; to: number } {
  const from = (page - 1) * PAGE_SIZE
  return { from, to: from + PAGE_SIZE - 1 }
}

export function customerDisplayName(row: { name: string | null; account_id: string }): string {
  return row.name?.trim() || row.account_id
}

export function contactName(c: { first_name: string | null; last_name: string | null }): string {
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || '—'
}
