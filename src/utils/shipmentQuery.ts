import type { DateBasis, ModuleCode, ShipmentFilterFields, ShipmentView } from '../types/shipmentFilters'
import type { DateRange } from './dateRange'

const PAGE_SIZE = 25

export { PAGE_SIZE }

type FilterableQuery = {
  eq(column: string, value: string | number): FilterableQuery
  gte(column: string, value: string): FilterableQuery
  lte(column: string, value: string): FilterableQuery
  lt(column: string, value: string): FilterableQuery
  or(filters: string): FilterableQuery
  ilike(column: string, pattern: string): FilterableQuery
  filter(column: string, operator: string, value: string): FilterableQuery
}

export type ShipmentQueryContext = {
  module: ModuleCode
  dateRange: DateRange
  dateBasis: DateBasis
  port: string | null
  view: ShipmentView
  filters: ShipmentFilterFields
}

function addOneDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`)
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function getSortColumn(view: ShipmentView, dateBasis: DateBasis): string {
  if (dateBasis === 'etd') return 'relevant_date'
  return view === 'consols' ? 'booked_date' : 'created_src'
}

export function applyModuleFilter<Q extends FilterableQuery>(query: Q, module: ModuleCode): Q {
  return query.eq('module', module) as Q
}

export function applyDateBasisFilter<Q extends FilterableQuery>(
  query: Q,
  view: ShipmentView,
  dateBasis: DateBasis,
  range: DateRange,
): Q {
  if (dateBasis === 'etd') {
    return query.gte('relevant_date', range.from).lte('relevant_date', range.to) as Q
  }
  if (view === 'consols') {
    return query.gte('booked_date', range.from).lte('booked_date', range.to) as Q
  }
  const endExclusive = addOneDay(range.to)
  return query
    .gte('created_src', `${range.from}T00:00:00`)
    .lt('created_src', `${endExclusive}T00:00:00`) as Q
}

export function applyPortFilter<Q extends FilterableQuery>(query: Q, port: string | null): Q {
  if (!port) return query
  return query.or(`origin.eq.${port},destination.eq.${port}`) as Q
}

function applySearchFilter<Q extends FilterableQuery>(
  query: Q,
  view: ShipmentView,
  search: string,
): Q {
  const term = search.trim()
  if (!term) return query
  if (view === 'consols') return query.ilike('consol_key', `%${term}%`) as Q
  const parts = [`house_bill.ilike.%${term}%`, `job_no.ilike.%${term}%`]
  if (/^\d+$/.test(term)) parts.push(`customer_account_id.eq.${term}`)
  return query.or(parts.join(',')) as Q
}

function applyFieldFilters<Q extends FilterableQuery>(
  query: Q,
  view: ShipmentView,
  filters: ShipmentFilterFields,
): Q {
  let q = query
  if (filters.origin) q = q.eq('origin', filters.origin) as Q
  if (filters.destination) q = q.eq('destination', filters.destination) as Q
  if (filters.vesselFlight.trim()) {
    q = q.ilike('vessel_flight', `%${filters.vesselFlight.trim()}%`) as Q
  }
  if (filters.mode) q = q.eq('mode', filters.mode) as Q
  if (view === 'jobs' && filters.status) q = q.eq('status', filters.status) as Q
  if (view === 'jobs' && filters.customer.trim()) {
    const c = filters.customer.trim()
    if (/^\d+$/.test(c)) q = q.eq('customer_account_id', Number(c)) as Q
    else q = q.filter('customers.name', 'ilike', `%${c}%`) as Q
  }
  return q
}

export function applyShipmentQueryFilters<Q extends FilterableQuery>(
  query: Q,
  ctx: ShipmentQueryContext,
): Q {
  let q = applyModuleFilter(query, ctx.module)
  q = applyDateBasisFilter(q, ctx.view, ctx.dateBasis, ctx.dateRange)
  q = applyPortFilter(q, ctx.port)
  q = applySearchFilter(q, ctx.view, ctx.filters.search)
  q = applyFieldFilters(q, ctx.view, ctx.filters)
  return q
}

/** Base scope for map port counts and filter combobox options (module + date basis + range). */
export function applyBaseScope<Q extends FilterableQuery>(
  query: Q,
  module: ModuleCode,
  view: ShipmentView,
  dateBasis: DateBasis,
  dateRange: DateRange,
): Q {
  return applyDateBasisFilter(applyModuleFilter(query, module), view, dateBasis, dateRange)
}

export function pageRange(page: number): { from: number; to: number } {
  const from = (page - 1) * PAGE_SIZE
  return { from, to: from + PAGE_SIZE - 1 }
}
