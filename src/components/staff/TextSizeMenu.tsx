import { Type } from 'lucide-react'
import { TEXT_SIZE_MODULES, TEXT_SIZE_OPTIONS, useModuleTextSize, type TextSizeModule } from '../../hooks/useModuleTextSize'

function ModuleRow({ module, label }: { module: TextSizeModule; label: string }) {
  const [size, setSize] = useModuleTextSize(module)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '4px 10px' }}>
      <span style={{ fontSize: 12, color: '#475569' }}>{label}</span>
      <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 6, padding: 2 }} role="radiogroup" aria-label={`${label} text size`}>
        {TEXT_SIZE_OPTIONS.map((o, i) => (
          <button key={o.key} type="button" role="radio" aria-checked={size === o.key} title={`${o.label} (${Math.round(o.scale * 100)}%)`}
            onClick={() => setSize(o.key)}
            style={{
              border: 'none', borderRadius: 4, cursor: 'pointer', padding: '2px 8px', lineHeight: '18px',
              fontSize: 11 + i * 2, background: size === o.key ? '#EEF2FF' : 'transparent', color: size === o.key ? '#0A2472' : '#64748b',
            }}>
            A
          </button>
        ))}
      </div>
    </div>
  )
}

/** Text size controls inside the top-right user menu. Saved per user. */
export default function TextSizeMenu() {
  return (
    <div style={{ borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '4px 10px', color: 'var(--ink)' }}>
        <Type size={15} /> Text size
      </div>
      {TEXT_SIZE_MODULES.map((m) => <ModuleRow key={m.key} module={m.key} label={m.label} />)}
    </div>
  )
}
