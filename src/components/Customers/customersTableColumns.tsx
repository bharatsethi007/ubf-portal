import type { ColumnDef } from '@tanstack/react-table'
import { fmtShort } from '../../utils/format'
import { customerDisplayName } from '../../utils/customerQuery'
import type { CustomerStats } from '../../types/customer'

function RoleBadges({ row }: { row: CustomerStats }) {
  return (
    <span className="customer-badges">
      {row.is_importer && <span className="pill scheduled">Importer</span>}
      {row.is_exporter && <span className="pill booked">Exporter</span>}
      {!row.is_importer && !row.is_exporter && <span className="text-muted-foreground">—</span>}
    </span>
  )
}

function PortalBadge({ active }: { active: boolean }) {
  return active
    ? <span className="pill arrived">Active</span>
    : <span className="pill booked">No access</span>
}

export function customersTableColumns(): ColumnDef<CustomerStats>[] {
  return [
    {
      id: 'customer',
      accessorFn: (row) => customerDisplayName(row).toLowerCase(),
      header: 'Customer',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="customer-name-cell">
          <span className="customer-name-cell__name">{customerDisplayName(row.original)}</span>
          <span className="customer-name-cell__code">#{row.original.account_id}</span>
        </div>
      ),
    },
    {
      accessorKey: 'branch',
      header: 'Branch',
      cell: ({ getValue }) => getValue<string | null>() ?? '—',
    },
    {
      id: 'role',
      header: 'Role',
      enableSorting: false,
      cell: ({ row }) => <RoleBadges row={row.original} />,
    },
    {
      accessorKey: 'sales_manager',
      header: 'Sales manager',
      cell: ({ getValue }) => getValue<string | null>() ?? '—',
    },
    {
      accessorKey: 'total_shipments',
      header: 'Total',
      enableSorting: false,
      cell: ({ getValue }) => <span className="mono nums">{getValue<number>()}</span>,
    },
    {
      accessorKey: 'in_transit',
      header: 'In transit',
      enableSorting: false,
      cell: ({ getValue }) => <span className="mono nums">{getValue<number>()}</span>,
    },
    {
      accessorKey: 'this_month',
      header: 'This month',
      enableSorting: false,
      cell: ({ getValue }) => <span className="mono nums">{getValue<number>()}</span>,
    },
    {
      accessorKey: 'last_activity',
      header: 'Last activity',
      enableSorting: false,
      cell: ({ getValue }) => <span className="mono nums">{fmtShort(getValue<string | null>())}</span>,
    },
    {
      id: 'portal',
      header: 'Portal',
      enableSorting: false,
      cell: ({ row }) => <PortalBadge active={row.original.has_portal_access} />,
    },
  ]
}
