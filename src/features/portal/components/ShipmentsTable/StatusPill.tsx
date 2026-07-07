import { mapShipmentStatus } from '../../dashboard/portalStatus'

type Props = { status: string | null | undefined }

export default function StatusPill({ status }: Props) {
  const { label, color, bg } = mapShipmentStatus(status)
  return (
    <span className="portal-pill" style={{ color, background: bg }}>{label}</span>
  )
}
