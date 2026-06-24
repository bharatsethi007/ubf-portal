import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  EMPTY_FILTER_FIELDS,
  tabToModule,
  type DateBasis,
  type ModuleTab,
  type ShipmentFilterFields,
  type ShipmentView,
} from '../types/shipmentFilters'
import {
  computePresetRange,
  currentMonthDefault,
  type DatePreset,
  type DateRange,
} from '../utils/dateRange'
import { useDebouncedValue } from './useDebouncedValue'

type ShipmentFiltersContext = {
  activeModule: ModuleTab
  setActiveModule: (tab: ModuleTab) => void
  moduleCode: ReturnType<typeof tabToModule>
  view: ShipmentView
  setView: (view: ShipmentView) => void
  dateRange: DateRange
  setPreset: (preset: DatePreset) => void
  setCustomRange: (from: string, to: string) => void
  dateBasis: DateBasis
  setDateBasis: (basis: DateBasis) => void
  activePort: string | null
  setActivePort: (port: string | null) => void
  togglePort: (code: string) => void
  filters: ShipmentFilterFields
  setFilter: <K extends keyof ShipmentFilterFields>(key: K, value: ShipmentFilterFields[K]) => void
  debouncedFilters: ShipmentFilterFields
  clearFilters: () => void
  page: number
  setPage: (page: number) => void
  moreOpen: boolean
  setMoreOpen: (open: boolean) => void
  jobDrawer: { jobUnique: number; consolKey: string } | null
  openJobDrawer: (jobUnique: number, consolKey: string) => void
  closeJobDrawer: () => void
}

const Context = createContext<ShipmentFiltersContext | null>(null)

export function ShipmentFiltersProvider({ children }: { children: ReactNode }) {
  const [activeModule, setActiveModule] = useState<ModuleTab>('IS')
  const [view, setView] = useState<ShipmentView>('consols')
  const [dateRange, setDateRange] = useState<DateRange>(currentMonthDefault)
  const [dateBasis, setDateBasis] = useState<DateBasis>('etd')
  const [activePort, setActivePort] = useState<string | null>(null)
  const [filters, setFilters] = useState<ShipmentFilterFields>(EMPTY_FILTER_FIELDS)
  const [page, setPage] = useState(1)
  const [moreOpen, setMoreOpen] = useState(false)
  const [jobDrawer, setJobDrawer] = useState<{ jobUnique: number; consolKey: string } | null>(null)
  const debouncedFilters = useDebouncedValue(filters, 300)
  const moduleCode = tabToModule(activeModule)

  const setPreset = useCallback((preset: DatePreset) => {
    if (preset === 'custom') {
      setDateRange((prev) => ({ ...prev, preset: 'custom' }))
      return
    }
    setDateRange(computePresetRange(preset))
  }, [])

  const setCustomRange = useCallback((from: string, to: string) => {
    setDateRange({ from, to, preset: 'custom' })
  }, [])

  const togglePort = useCallback((code: string) => {
    setActivePort((prev) => (prev === code ? null : code))
  }, [])

  const setFilter = useCallback(<K extends keyof ShipmentFilterFields>(
    key: K,
    value: ShipmentFilterFields[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTER_FIELDS)
  }, [])

  const openJobDrawer = useCallback((jobUnique: number, consolKey: string) => {
    setJobDrawer({ jobUnique, consolKey })
  }, [])

  const closeJobDrawer = useCallback(() => {
    setJobDrawer(null)
  }, [])

  useEffect(() => {
    setPage(1)
  }, [activeModule, dateRange, dateBasis, activePort, debouncedFilters, view])

  const value = useMemo(
    () => ({
      activeModule,
      setActiveModule,
      moduleCode,
      view,
      setView,
      dateRange,
      setPreset,
      setCustomRange,
      dateBasis,
      setDateBasis,
      activePort,
      setActivePort,
      togglePort,
      filters,
      setFilter,
      debouncedFilters,
      clearFilters,
      page,
      setPage,
      moreOpen,
      setMoreOpen,
      jobDrawer,
      openJobDrawer,
      closeJobDrawer,
    }),
    [
      activeModule,
      moduleCode,
      view,
      dateRange,
      setPreset,
      setCustomRange,
      dateBasis,
      activePort,
      togglePort,
      filters,
      setFilter,
      debouncedFilters,
      clearFilters,
      page,
      moreOpen,
      jobDrawer,
      openJobDrawer,
      closeJobDrawer,
    ],
  )

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useShipmentFilters(): ShipmentFiltersContext {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('useShipmentFilters must be used within ShipmentFiltersProvider')
  return ctx
}
