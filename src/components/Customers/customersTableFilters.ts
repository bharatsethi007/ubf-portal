export type RoleFilter = 'all' | 'importer' | 'exporter' | 'customs'

export type SortPreset = 'activity' | 'alpha'

export const ROLE_FILTERS: { key: RoleFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'importer', label: 'Importer' },
  { key: 'exporter', label: 'Exporter' },
  { key: 'customs', label: 'Customs only' },
]

export const SORT_PRESETS: { key: SortPreset; label: string }[] = [
  { key: 'activity', label: 'Last activity' },
  { key: 'alpha', label: 'A–Z' },
]
