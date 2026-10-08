import type { ReactNode } from 'react'
import { scaleOf, useModuleTextSize, type TextSizeModule } from '../../hooks/useModuleTextSize'

/**
 * Scales a whole module (text, inputs, icons, spacing) like browser zoom, for this user only.
 * Zoom also scales vh/vw, so pop-ups inside size themselves with calc(Nvh / var(--mz, 1)) to stay on screen.
 */
export default function ModuleTextScale({ module, children }: { module: TextSizeModule; children: ReactNode }) {
  const [size] = useModuleTextSize(module)
  const scale = scaleOf(size)
  if (scale === 1) return <>{children}</>
  return <div style={{ zoom: scale, ['--mz' as string]: scale }}>{children}</div>
}
