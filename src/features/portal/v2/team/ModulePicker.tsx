import { Check } from 'lucide-react'
import { MODULES, type ModuleKey } from '../access'

type Props = { value: ModuleKey[]; onChange: (v: ModuleKey[]) => void; disabled?: boolean }

/** Tick which portal modules a member can use. Home, Shipments and Messages are always on. */
export default function ModulePicker({ value, onChange, disabled }: Props) {
  const toggle = (k: ModuleKey) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k])
  return (
    <fieldset className="pv3-team__mods" disabled={disabled}>
      <legend>Access <i>(Home, Shipments and Messages always on)</i></legend>
      <div className="pv3-team__modgrid">
        {MODULES.map((m) => {
          const on = value.includes(m.key)
          return (
            <label key={m.key} className={`pv3-team__mod${on ? ' pv3-team__mod--on' : ''}`}>
              <input type="checkbox" checked={on} onChange={() => toggle(m.key)} />
              <span className="pv3-team__modbox" aria-hidden>{on && <Check size={12} />}</span>
              <span className="pv3-team__modtext"><b>{m.label}</b><small>{m.help}</small></span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
