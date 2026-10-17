// Company split as small flag chips: "🇳🇿 1,021  🇫🇯 2,393". Shows nothing for a single company
// unless `always` is set, so NZ-only screens stay as they were.

export type SplitInput = Record<string, number | null | undefined> | { company: string; value: number }[] | null | undefined

const nf = new Intl.NumberFormat('en-NZ')

export function splitEntries(input: SplitInput): { company: string; value: number }[] {
  if (!input) return []
  const list = Array.isArray(input)
    ? input
    : Object.entries(input).map(([company, v]) => ({ company, value: Number(v ?? 0) }))
  return list.filter((e) => e.company && e.value).sort((a, b) => b.value - a.value)
}

export function CompanyFlag({ code, size = 14 }: { code: string; size?: number }) {
  return (
    <span className={`fi fi-${code.toLowerCase()}`} aria-hidden
      style={{ width: Math.round(size * 1.33), height: size, borderRadius: 2, flexShrink: 0 }} />
  )
}

type Props = {
  data: SplitInput
  always?: boolean
  label?: string          // used in the tooltip, eg "jobs"
  format?: (n: number) => string
  size?: 'sm' | 'md'
}

export default function CompanySplit({ data, always = false, label = '', format = (n) => nf.format(n), size = 'sm' }: Props) {
  const items = splitEntries(data)
  if (items.length === 0 || (items.length === 1 && !always)) return null
  const fs = size === 'sm' ? 11 : 12.5
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: fs, color: 'var(--muted-foreground)' }}>
      {items.map((e) => (
        <span key={e.company} title={`${e.company}: ${format(e.value)}${label ? ` ${label}` : ''}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontVariantNumeric: 'tabular-nums' }}>
          <CompanyFlag code={e.company} size={size === 'sm' ? 10 : 12} />
          {format(e.value)}
        </span>
      ))}
    </span>
  )
}
