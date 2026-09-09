import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { CourierShipmentListRow } from './courierBookingsApi'

export const COURIER_STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'created', label: 'Created' },
  { key: 'booked', label: 'Booked' },
  { key: 'in_transit', label: 'In transit' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'error', label: 'Error' },
] as const

const STATUS_COLORS: Record<string, { bg: string; fg: string; label?: string }> = {
  booked: { bg: '#E7EEFF', fg: '#2447C0' },
  in_transit: { bg: '#FFF4E5', fg: '#B45309', label: 'In transit' },
  delivered: { bg: '#E4F6EC', fg: '#1B7F4B' },
  cancelled: { bg: '#FBE9E9', fg: '#B23B3B' },
  error: { bg: '#FBE9E9', fg: '#B23B3B' },
  created: { bg: '#EEF1F5', fg: '#5B6472' },
}

export function courierStatusPill(status: string | null | undefined) {
  const key = (status ?? 'created').toLowerCase()
  const c = STATUS_COLORS[key] ?? STATUS_COLORS.created
  const label =
    c.label ??
    key
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: c.bg,
        color: c.fg,
      }}
    >
      {label}
    </span>
  )
}

function fmtLocation(city: string | null, country: string | null): string | null {
  const parts = [city?.trim(), country?.trim()].filter(Boolean) as string[]
  return parts.length ? parts.join(', ') : null
}

function PartyCell({
  name,
  company,
  city,
  country,
}: {
  name: string | null
  company: string | null
  city: string | null
  country: string | null
}) {
  const primary = name?.trim() || company?.trim() || '—'
  const sub = fmtLocation(city, country)
  return (
    <div>
      <div>{primary}</div>
      {sub ? (
        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
          {sub}
        </div>
      ) : null}
    </div>
  )
}

function CarrierCell({ carrier }: { carrier: string | null }) {
  const [broken, setBroken] = useState(false)
  if (!carrier) return <>—</>
  const logo = `/couriers/${carrier.toLowerCase()}.png`
  if (!broken) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', height: 28 }}>
        <img
          src={logo}
          alt={carrier}
          onError={() => setBroken(true)}
          style={{ maxHeight: 24, maxWidth: 72, objectFit: 'contain' }}
        />
      </span>
    )
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: 'var(--color-accent-soft, #EEF1F5)',
        color: 'var(--color-ink, #1a1a1a)',
      }}
    >
      {carrier}
    </span>
  )
}

export function courierBookingsColumns(): ColumnDef<CourierShipmentListRow>[] {
  return [
    {
      header: 'Carrier',
      accessorKey: 'carrier',
      cell: ({ row }) => <CarrierCell carrier={row.original.carrier} />,
    },
    {
      header: 'Tracking',
      accessorKey: 'waybill_no',
      cell: ({ row }) => row.original.waybill_no ?? <span className="muted">—</span>,
    },
    {
      header: 'Ref',
      accessorKey: 'booking_ref',
      cell: ({ row }) => row.original.booking_ref ?? <span className="muted">—</span>,
    },
    {
      header: 'Shipper',
      cell: ({ row }) => (
        <PartyCell
          name={row.original.shipper_name}
          company={row.original.shipper_company}
          city={row.original.shipper_city}
          country={row.original.shipper_country}
        />
      ),
    },
    {
      header: 'Consignee',
      cell: ({ row }) => (
        <PartyCell
          name={row.original.receiver_name}
          company={row.original.receiver_company}
          city={row.original.receiver_city}
          country={row.original.receiver_country}
        />
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => courierStatusPill(row.original.status),
    },
  ]
}
