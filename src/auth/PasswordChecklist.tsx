import { Check, Circle } from 'lucide-react'
import { PASSWORD_RULES } from './passwordPolicy'

export default function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '-6px 0 16px', display: 'grid', gap: 4 }}>
      {PASSWORD_RULES.map((r) => {
        const met = r.test(password)
        return (
          <li key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: met ? '#15803d' : '#64748b' }}>
            {met ? <Check size={14} /> : <Circle size={10} style={{ margin: '0 2px' }} />}
            {r.label}
          </li>
        )
      })}
    </ul>
  )
}
