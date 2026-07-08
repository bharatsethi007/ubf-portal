import { Link } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PortMap } from '../../../hooks/usePorts'
import { formatShortDate } from '../../dashboard/portalFormat'
import { shipmentDetailPath, shipmentTrackingId, type PortalShipmentRow } from '../../dashboard/portalDashboardApi'
import { formatContainerNumbers } from '../../dashboard/portalContainerLabels'
import { resolvePortCountryCode, resolvePortLabel } from '../../dashboard/portalPortDisplay'
import { counterpartyName, customerRefDisplay } from '../../dashboard/portalShipmentParty'
import { arrivalDate, departureDate } from '../../dashboard/portalShipmentDates'
import CarrierChip from './CarrierChip'
import ShipmentNumericCluster from './ShipmentNumericCluster'
import StatusPill from './StatusPill'

export type ShipmentsColumnCtx = {
  ports: PortMap
  containerMap: Map<string, string[]>
  partyHeader: string
}

function sortHeader(label: string, sorted: false | 'asc' | 'desc', onSort: () => void) {
  const Icon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown
  return (
    <Button variant="ghost" size="sm" className="-ml-3 h-8 font-medium" onClick={onSort}>
      {label}
      <Icon className="ml-1 size-3.5 opacity-60" />
    </Button>
  )
}

function portCell(code: string | null, mode: string | null, ports: PortMap, date: string | null) {
  const cc = resolvePortCountryCode(code, mode, ports)
  return (
    <>
      <div className="text-[13px] text-[var(--portal-ink2)]">
        <span className={`fi fi-${cc} mr-1.5`} aria-hidden />
        {resolvePortLabel(code, mode, ports)}
      </div>
      <div className="nums mt-0.5 text-xs text-[var(--portal-muted)]">{formatShortDate(date)}</div>
    </>
  )
}

function modeCell(row: PortalShipmentRow, containerMap: Map<string, string[]>) {
  const containers = row.mode === 'sea' && row.consol_key
    ? formatContainerNumbers(containerMap.get(row.consol_key))
    : ''

  return (
    <div className="portal-mode-cell">
      <CarrierChip carrier={row.vessel_flight ?? 'Carrier TBC'} mode={row.mode} />
      {containers && <div className="portal-mode-cell__container nums">{containers}</div>}
    </div>
  )
}

export function shipmentsTableColumns(ctx: ShipmentsColumnCtx): ColumnDef<PortalShipmentRow>[] {
  const { ports, containerMap, partyHeader } = ctx

  return [
    {
      accessorFn: (row) => shipmentTrackingId(row),
      id: 'job',
      header: ({ column }) => sortHeader('Job no.', column.getIsSorted(), () => column.toggleSorting()),
      cell: ({ row }) => (
        <Link to={shipmentDetailPath(row.original)} className="nums font-medium text-primary hover:underline">
          {shipmentTrackingId(row.original)}
        </Link>
      ),
    },
    {
      accessorFn: (row) => counterpartyName(row) ?? '',
      id: 'party',
      header: ({ column }) => sortHeader(partyHeader, column.getIsSorted(), () => column.toggleSorting()),
      cell: ({ row }) => (
        <span className="block max-w-[140px] truncate text-[12.5px] text-[var(--portal-ink2)]">
          {counterpartyName(row.original) ?? '—'}
        </span>
      ),
    },
    {
      accessorFn: (row) => customerRefDisplay(row),
      id: 'reference',
      header: ({ column }) => sortHeader('Reference', column.getIsSorted(), () => column.toggleSorting()),
      cell: ({ row }) => (
        <span className="block max-w-[120px] truncate text-[12.5px] text-[var(--portal-ink2)]">
          {customerRefDisplay(row.original)}
        </span>
      ),
    },
    {
      accessorFn: (row) => resolvePortLabel(row.origin, row.mode, ports),
      id: 'from',
      header: ({ column }) => sortHeader('From', column.getIsSorted(), () => column.toggleSorting()),
      cell: ({ row }) => portCell(row.original.origin, row.original.mode, ports, departureDate(row.original)),
    },
    {
      accessorFn: (row) => resolvePortLabel(row.destination, row.mode, ports),
      id: 'to',
      header: ({ column }) => sortHeader('To', column.getIsSorted(), () => column.toggleSorting()),
      cell: ({ row }) => portCell(row.original.destination, row.original.mode, ports, arrivalDate(row.original)),
    },
    {
      accessorFn: (row) => row.vessel_flight ?? '',
      id: 'mode',
      header: ({ column }) => sortHeader('Mode', column.getIsSorted(), () => column.toggleSorting()),
      cell: ({ row }) => modeCell(row.original, containerMap),
      enableSorting: false,
    },
    {
      accessorFn: (row) => row.pack_qty ?? 0,
      id: 'numbers',
      header: ({ column }) => sortHeader('Pcs / Wt / CBM', column.getIsSorted(), () => column.toggleSorting()),
      cell: ({ row }) => <ShipmentNumericCluster row={row.original} />,
    },
    {
      accessorFn: (row) => row.status ?? '',
      id: 'status',
      header: ({ column }) => sortHeader('Status', column.getIsSorted(), () => column.toggleSorting()),
      cell: ({ row }) => <StatusPill status={row.original.status} />,
    },
  ]
}
