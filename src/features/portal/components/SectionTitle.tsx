import type { LucideIcon } from 'lucide-react'

type Props = {
  title: string
  meta?: string
  icon?: LucideIcon
}

export default function SectionTitle({ title, meta, icon: Icon }: Props) {
  return (
    <div className="portal-section-title">
      {Icon && <Icon size={14} strokeWidth={1.5} className="portal-section-title__icon" aria-hidden />}
      <span className="portal-card-title">{title}</span>
      {meta && <span className="portal-card-meta">{meta}</span>}
    </div>
  )
}
