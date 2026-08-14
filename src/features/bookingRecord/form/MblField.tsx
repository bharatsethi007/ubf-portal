import { useEffect, useState } from 'react'

type Props = { value: string | null; onCommit: (v: string | null) => void }

export default function MblField({ value, onCommit }: Props) {
  const [text, setText] = useState(value ?? '')
  useEffect(() => { setText(value ?? '') }, [value])
  const commit = () => {
    const v = text.trim().toUpperCase() || null
    if (v !== (value ?? null)) onCommit(v)
  }
  return (
    <label className="filter-field booking-form-field">
      <span className="filter-field__label">Master B/L (tracking)</span>
      <input
        className="input input--sm"
        value={text}
        placeholder="e.g. COSU9508591340"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      />
    </label>
  )
}
