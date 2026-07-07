import type { PortalUserStatus } from '../../lib/portalActivationApi'

const LABELS: Record<PortalUserStatus, string> = {
  pending: 'Pending',
  active: 'Active',
  revoked: 'Revoked',
}

export default function PortalStatusPill({ status }: { status: PortalUserStatus }) {
  return <span className={`portal-access-pill portal-access-pill--${status}`}>{LABELS[status]}</span>
}
