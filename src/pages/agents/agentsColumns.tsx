import type { ColumnDef } from '@tanstack/react-table'
import { fmt } from '../../components/Customers/profileUi'
import type { AgentDirectoryRow } from './agentsApi'
import AgentTrustedTick from './AgentTrustedTick'
import AgreementPill from './AgreementPill'
import CompanySplit from '../../features/company/CompanySplit'
import { fmtHours, pct } from './agentStatsApi'

function StatusPill({ status }: { status: string }) {
  const cls =
    status === 'active' ? 'pill arrived' : status === 'inactive' ? 'pill booked' : 'pill scheduled'
  return <span className={cls}>{status[0].toUpperCase() + status.slice(1)}</span>
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
      header: ({ column }) => (
        <SortableHeader
          label="Agent"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        />
      ),
      enableSorting: true,
      cell: ({ row }) => (
        <div className="customer-name-cell">
          <span className="customer-name-cell__name agent-name-row">
            {row.original.name}
            {row.original.trusted && <AgentTrustedTick size={18} />}
            {(!row.original.erp_account_code || row.original.erp_account_code.startsWith('P-')) && (
              <span className="pill agent-notcf-pill" title="Not present in the ERP (CargoFinder)">
                Not on CF
              </span>
            )}
          </span>
          <span className="customer-name-cell__code" title={(row.original.codes ?? []).join(', ')}>
            {row.original.erp_account_code ? `#${row.original.erp_account_code}` : 'Portal-only'}
            {(row.original.codes?.length ?? 0) > 1 ? ` +${(row.original.codes?.length ?? 1) - 1}` : ''}
          </span>
          <CompanySplit data={row.original.jobs_by_company} label="jobs" />
          {row.original.network_codes.map((c) => (
            <span key={c} title={`Network: ${c}`}
              className="ml-1.5 inline-flex h-[18px] items-center rounded-full bg-[#EEF1F8] px-2 text-[10.5px] font-medium tracking-[0.02em] text-[#0A2472]">
              {c}
            </span>
          ))}
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
      id: 'agreement',
      header: 'Agreement',
      enableSorting: false,
      cell: ({ row }) => (
        <AgreementPill state={row.original.agreement_state} expiry={row.original.agreement_expiry} daysLeft={row.original.agreement_days_left} />
      ),
    },
    {
      accessorKey: 'quotes_12m',
      header: ({ column }) => (
        <div style={{ textAlign: 'right' }}>
          <SortableHeader label="Quotes" sorted={column.getIsSorted()} alignRight
            onToggle={() => column.toggleSorting(column.getIsSorted() === 'asc')} />
        </div>
      ),
      enableSorting: true,
      cell: ({ row }) => <span className="agents-jobs-cell" title="Quotes in the last 12 months">{row.original.quotes_12m || '–'}</span>,
    },
    {
      id: 'won',
      header: () => <div style={{ textAlign: 'right' }}>Won</div>,
      enableSorting: false,
      cell: ({ row }) => <span className="agents-jobs-cell" style={{ color: '#067647' }}>{row.original.won_12m || '–'}</span>,
    },
    {
      id: 'conversion',
      header: 'Conversion',
      enableSorting: false,
      cell: ({ row }) => {
        const c = pct(row.original.won_12m, row.original.quotes_12m)
        if (c == null) return <span style={{ color: '#94A3B8' }}>–</span>
        const color = c >= 35 ? '#067647' : c >= 20 ? '#0A2472' : '#DC6803'
        return (
          <span className="inline-flex items-center gap-2" title="Won out of quotes, last 12 months">
            <span className="flex h-1.5 w-16 overflow-hidden rounded-full bg-[#F1F3F7]"><span style={{ width: `${c}%`, background: color }} /></span>
            <span className="w-8 text-[12px] tabular-nums">{c}%</span>
          </span>
        )
      },
    },
    {
      id: 'hrs_to_win',
      header: () => <div style={{ textAlign: 'right' }}>Time to win</div>,
      enableSorting: false,
      cell: ({ row }) => <span className="agents-jobs-cell">{fmtHours(row.original.hrs_to_win)}</span>,
    },
    {
      id: 'top_lane',
      header: 'Top lane',
      enableSorting: false,
      cell: ({ row }) => <span className="font-mono text-[12px] text-[#334155]">{row.original.top_lane ?? '–'}</span>,
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
      accessorKey: 'freehand_12m',
      header: ({ column }) => (
        <div style={{ textAlign: 'right' }} title="Free hand from this agent, last 12 months (from billing)">
          <SortableHeader label="Free hand" sorted={column.getIsSorted()} alignRight
            onToggle={() => column.toggleSorting(column.getIsSorted() === 'asc')} />
        </div>
      ),
      enableSorting: true,
      cell: ({ getValue }) => {
        const v = getValue<number>()
        return <span className="agents-jobs-cell" style={{ color: v ? '#0F172A' : '#94A3B8' }}>{v ? fmt.int(v) : '–'}</span>
      },
    },
    {
      accessorKey: 'booked_12m',
      header: ({ column }) => (
        <div style={{ textAlign: 'right' }} title="Our nominations to this agent, last 12 months (from billing)">
          <SortableHeader label="Booked" sorted={column.getIsSorted()} alignRight
            onToggle={() => column.toggleSorting(column.getIsSorted() === 'asc')} />
        </div>
      ),
      enableSorting: true,
      cell: ({ getValue }) => {
        const v = getValue<number>()
        return <span className="agents-jobs-cell" style={{ color: v ? '#0F172A' : '#94A3B8' }}>{v ? fmt.int(v) : '–'}</span>
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ getValue }) => <StatusPill status={getValue<string>()} />,
    },
  ]
}
