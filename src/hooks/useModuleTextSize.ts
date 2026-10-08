import { useStaffPref } from './useStaffPref'

export const TEXT_SIZES = ['default', 'large', 'xlarge'] as const
export type TextSize = (typeof TEXT_SIZES)[number]

export const TEXT_SIZE_OPTIONS: { key: TextSize; label: string; scale: number }[] = [
  { key: 'default', label: 'Default', scale: 1 },
  { key: 'large', label: 'Large', scale: 1.25 },
  { key: 'xlarge', label: 'Extra large', scale: 1.5 },
]

/** Modules that support a per-user text size. Add more here as they are ready. */
export const TEXT_SIZE_MODULES = [{ key: 'quotes', label: 'Quotes' }] as const
export type TextSizeModule = (typeof TEXT_SIZE_MODULES)[number]['key']

/** Per-user text size for one module, saved to the user's account. */
export function useModuleTextSize(module: TextSizeModule) {
  return useStaffPref<TextSize>(`text_size.${module}`, 'default', TEXT_SIZES)
}

export const scaleOf = (s: TextSize) => TEXT_SIZE_OPTIONS.find((o) => o.key === s)?.scale ?? 1
