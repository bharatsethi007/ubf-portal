import { STATUS_LABEL, STATUS_STYLE } from './rateCardModel'

export function RateCardPill({ status }: { status: string }) {
  const [bg, fg] = STATUS_STYLE[status] ?? STATUS_STYLE.draft
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] leading-4" style={{ background: bg, color: fg }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: fg }} />{STATUS_LABEL[status] ?? status}
    </span>
  )
}
