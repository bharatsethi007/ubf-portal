import { useCallback, useEffect, useState } from 'react'
import { usePorts } from '../../../hooks/usePorts'
import type { PortalRange } from './portalFormat'
import { formatDateTimeLabel } from './portalFormat'
import {
  loadPortalDashboard,
  type AttentionItem,
  type GlobeBubble,
  type GlobeLane,
  type KpiMetric,
  type PaymentKpi,
  type PortalShipmentRow,
  type TradeKpiMetrics,
} from './portalDashboardApi'
import { createEmptyTradeKpis, type PortalContainerRow } from './portalTradeKpi'

export type PortalDashboardData = {
  kpis: KpiMetric[]
  trade: TradeKpiMetrics
  payments: PaymentKpi
  shipments: PortalShipmentRow[]
  containers: PortalContainerRow[]
  openCount: number
  attention: AttentionItem[]
  globe: { lanes: GlobeLane[]; bubbles: GlobeBubble[] }
  lastUpdated: Date
  lastUpdatedLabel: string
}

const EMPTY: PortalDashboardData = {
  kpis: [],
  trade: createEmptyTradeKpis(),
  payments: { total: 0, count: 0, currency: 'NZD', aging: { current: 0, days30_60: 0, days60plus: 0 } },
  shipments: [],
  containers: [],
  openCount: 0,
  attention: [],
  globe: { lanes: [], bubbles: [] },
  lastUpdated: new Date(),
  lastUpdatedLabel: '',
}

export function usePortalDashboard(range: PortalRange) {
  const { ports, loading: portsLoading } = usePorts()
  const [data, setData] = useState<PortalDashboardData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (portsLoading) return
    setLoading(true)
    setError('')
    try {
      const result = await loadPortalDashboard(range, ports)
      setData({
        ...result,
        lastUpdatedLabel: formatDateTimeLabel(result.lastUpdated),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [range, ports, portsLoading])

  useEffect(() => { refresh() }, [refresh])

  return { data, loading: loading || portsLoading, error, refresh }
}
