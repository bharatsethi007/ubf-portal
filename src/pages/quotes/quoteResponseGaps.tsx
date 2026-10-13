import { Sparkles } from 'lucide-react'

type GapLine = { charge_group: string | null; buy_rate: string | number | null; sell_rate: string | number | null }

const num = (v: string | number | null) => Number(v) || 0

/** What is still missing before a response is a full door-to-door quote. Live from the lines. */
export function responseGaps(lines: GapLine[]): string[] {
  const groups = new Set(lines.map((l) => (l.charge_group ?? '').toLowerCase()))
  const gaps: string[] = []
  if (!groups.has('origin')) gaps.push('Origin charges missing')
  if (!groups.has('dest') && !groups.has('destination')) gaps.push('Destination charges missing')
  if (lines.some((l) => num(l.sell_rate) > 0 && num(l.buy_rate) === 0)) gaps.push('Buy rate not on file')
  return gaps
}

/** UBF Intelligence note shown above the charge lines while gaps remain. */
export function ResponseGapsNote({ lines, ai }: { lines: GapLine[]; ai: boolean }) {
  const gaps = responseGaps(lines)
  if (!lines.length || !gaps.length) return null
  return (
    <div className="qr-gaps" role="note">
      <Sparkles size={15} />
      <div>
        <b>{ai ? 'UBF Intelligence quoted freight only.' : 'Not a full quote yet.'}</b>
        <span> {gaps.join(' · ')}. Add them before sending for approval, or note on the quote that they are excluded.</span>
      </div>
    </div>
  )
}
