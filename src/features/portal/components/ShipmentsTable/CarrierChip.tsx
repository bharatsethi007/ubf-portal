import { Plane, Ship } from 'lucide-react'

type Props = { carrier: string; mode: string | null | undefined }

export default function CarrierChip({ carrier, mode }: Props) {
  const Icon = mode === 'air' ? Plane : Ship
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        width: 26, height: 26, borderRadius: 8, background: 'var(--portal-grey-bg)',
        display: 'grid', placeItems: 'center', color: 'var(--portal-muted)',
      }}>
        <Icon size={13} strokeWidth={1.5} />
      </span>
      <span className="portal-carrier-name">{carrier}</span>
    </span>
  )
}
