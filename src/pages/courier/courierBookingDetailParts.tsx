import { useState } from 'react'

export function GridField({ label, value }: { label: string; value: string }) {
  return (
    <div className="cbd-field">
      <span className="cbd-field__label">{label}</span>
      <span className="cbd-field__value">{value || '-'}</span>
    </div>
  )
}

export function CarrierLogo({ carrier }: { carrier: string | null }) {
  const [broken, setBroken] = useState(false)
  if (!carrier) return null
  const logo = `/couriers/${carrier.toLowerCase()}.png`
  if (broken) return <span className="cbd-carrier-chip">{carrier}</span>
  return (
    <span className="cbd-carrier-logo">
      <img src={logo} alt={carrier} onError={() => setBroken(true)} />
    </span>
  )
}

export function shipmentTypeLabel(type: string | null): string {
  if (!type) return '-'
  return type.charAt(0).toUpperCase() + type.slice(1)
}