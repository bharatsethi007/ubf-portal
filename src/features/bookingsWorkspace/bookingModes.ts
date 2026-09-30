import { Plane, Ship, type LucideIcon } from 'lucide-react'
import type { BookingModule } from '@/types/booking'

export type WorkspaceSlug = 'import-sea' | 'import-air' | 'export-sea' | 'export-air'

export type WorkspaceMode = {
  slug: WorkspaceSlug
  module: BookingModule
  label: string
  icon: LucideIcon
}

export const WORKSPACE_MODES: readonly WorkspaceMode[] = [
  { slug: 'import-sea', module: 'IS', label: 'Import Sea', icon: Ship },
  { slug: 'import-air', module: 'IA', label: 'Import Air', icon: Plane },
  { slug: 'export-sea', module: 'ES', label: 'Export Sea', icon: Ship },
  { slug: 'export-air', module: 'EA', label: 'Export Air', icon: Plane },
] as const

export const WORKSPACE_SLUGS: readonly WorkspaceSlug[] = WORKSPACE_MODES.map((m) => m.slug)

export function modeBySlug(slug: string | undefined): WorkspaceMode | undefined {
  return WORKSPACE_MODES.find((m) => m.slug === slug)
}

export function slugForModule(module: string | undefined): WorkspaceSlug {
  return WORKSPACE_MODES.find((m) => m.module === module)?.slug ?? 'import-sea'
}

export function workspaceHref(module: string | undefined): string {
  return `/bookings/${slugForModule(module)}`
}
