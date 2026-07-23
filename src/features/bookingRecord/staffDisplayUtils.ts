export function staffDisplayName(email: string): string {
  const local = email.split('@')[0] ?? email
  return local.replace(/[._-]+/g, ' ').trim() || email
}

export function staffInitials(email: string, stored?: string | null): string {
  if (stored?.trim()) return stored.trim().toUpperCase()
  const name = staffDisplayName(email)
  const parts = name.split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
