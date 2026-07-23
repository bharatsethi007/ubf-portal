import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import PortConnectDetailModal from '../tracking/PortConnectDetailModal'
import { buildPortConnectVisitViews } from '../tracking/portConnectVisitView'
import type { ContainerTrackingRow, PortConnectVisitView } from '../tracking/trackingTypes'
import {
  DETAIL_FOCUS_LABEL,
  FIELD_DETAIL_FOCUS,
  portConnectSourceContainer,
  type PortConnectFieldKey,
} from './portConnectProvenance'

type DetailState = {
  visit: PortConnectVisitView | null
  focusLabel: string | null
}

type ContextValue = {
  openDetail: (field: PortConnectFieldKey, containerNo?: string) => void
  openVisit: (visit: PortConnectVisitView, focusLabel?: string | null) => void
}

const PortConnectDetailContext = createContext<ContextValue | null>(null)

export function usePortConnectDetail(): ContextValue {
  const ctx = useContext(PortConnectDetailContext)
  if (!ctx) {
    return { openDetail: () => undefined, openVisit: () => undefined }
  }
  return ctx
}

type Props = {
  containers: ContainerTrackingRow[]
  children: ReactNode
}

export function PortConnectDetailProvider({ containers, children }: Props) {
  const [state, setState] = useState<DetailState>({ visit: null, focusLabel: null })

  const openDetail = useCallback((field: PortConnectFieldKey, containerNo?: string) => {
    const focusKey = FIELD_DETAIL_FOCUS[field]
    const row = containerNo
      ? containers.find((c) => c.container_no.trim().toUpperCase() === containerNo.trim().toUpperCase())
      : portConnectSourceContainer(field, containers)
    if (!row) return
    const visit = buildPortConnectVisitViews([row], [])[0] ?? null
    setState({
      visit,
      focusLabel: focusKey ? DETAIL_FOCUS_LABEL[focusKey] : null,
    })
  }, [containers])

  const openVisit = useCallback((visit: PortConnectVisitView, focusLabel: string | null = null) => {
    setState({ visit, focusLabel })
  }, [])

  const value = useMemo(() => ({ openDetail, openVisit }), [openDetail, openVisit])

  return (
    <PortConnectDetailContext.Provider value={value}>
      {children}
      <PortConnectDetailModal
        visit={state.visit}
        focusLabel={state.focusLabel}
        onClose={() => setState({ visit: null, focusLabel: null })}
      />
    </PortConnectDetailContext.Provider>
  )
}
