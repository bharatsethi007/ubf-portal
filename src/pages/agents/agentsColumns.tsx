import type { ColumnDef } from '@tanstack/react-table'
import { fmt } from '../../components/Customers/profileUi'
import type { AgentDirectoryRow } from './agentsApi'
import AgentTrustedTick from './AgentTrustedTick'

function StatusPill({ status }: { status: string }) {
  const cls =
    status === 'active' ? 'pill arrived' : status === 'inactive' ? 'pill booked' : 'pill scheduled'
  return <span className={cls}>{status[0].toUpperCase() + status.slice(1)}</span>
}

function NetworkChips({ codes }: { codes: string[] }) {
  if (!codes.length) return <span className="pill agent-pill-unassigned">No network</span>
  return (
    <span className="agent-networks-cell">
      {codes.map((c) => (
        <span key={c} className="pill scheduled">
          {c}
        </span>
      ))}
    </span>
  )
}

function SortableHeader({
  label,
  sorted,
  onToggle,
  alignRight,
}: {
  label: string
  sorted: false | 'asc' | 'desc'
  onToggle: () => void
  alignRight?: boolean
}) {
  const arrow = sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : '↕'
  return (
    <button
      type="button"
      className="agents-sort-th"
      style={alignRight ? { marginLeft: 'auto' } : undefined}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      {label}
      <span aria-hidden style={{ opacity: sorted ? 1 : 0.45, fontSize: 11 }}>{arrow}</span>
    </button>
  )
}

export function agentsColumns(): ColumnDef<AgentDirectoryRow>[] {
  return [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Agent',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="customer-name-cell">
          <span className="customer-name-cell__name agent-name-row">
            {row.original.name}
            {row.original.trusted && <AgentTrustedTick size={18} />}
            {!row.original.erp_account_code && (
              <span className="pill agent-notcf-pill" title="Not present in the ERP (CargoFinder)">
                Not on CF
              </span>
            )}
          </span>
          <span className="customer-name-cell__code">
            {row.original.erp_account_code ? `#${row.original.erp_account_code}` : 'Portal-only'}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'country',
      header: 'Country',
      enableSorting: false,
      cell: ({ getValue }) => getValue<string | null>() ?? '—',
    },
    {
      id: 'networks',
      header: 'Networks',
      enableSorting: false,
      cell: ({ row }) => <NetworkChips codes={row.original.network_codes} />,
    },
    {
      accessorKey: 'last_activity',
      header: ({ column }) => (
        <SortableHeader
          label="Last activity"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        />
      ),
      enableSorting: true,
      cell: ({ getValue }) => fmt.date(getValue<string | null>()),
    },
    {
      accessorKey: 'job_count',
      header: ({ column }) => (
        <div style={{ textAlign: 'right' }}>
          <SortableHeader
            label="Jobs"
            sorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            alignRight
          />
        </div>
      ),
      enableSorting: true,
      cell: ({ getValue }) => (
        <span className="agents-jobs-cell">{fmt.int(getValue<number>())}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ getValue }) => <StatusPill status={getValue<string>()} />,
    },
  ]
}
