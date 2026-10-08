import type { ReactNode } from 'react'
import { scaleOf, useModuleTextSize, type TextSizeModule } from '../../hooks/useModuleTextSize'

/** Scales a whole module (text, inputs, icons, spacing) like browser zoom, for this user only. */
export default function ModuleTextScale({ module, children }: { module: TextSizeModule; children: ReactNode }) {
  const [size] = useModuleTextSize(module)
  const scale = scaleOf(size)
  if (scale === 1) return <>{children}</>
  return <div style={{ zoom: scale }}>{children}</div>
}
