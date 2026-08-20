import { useEffect, useRef, useState } from 'react'
import { Link2, X } from 'lucide-react'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { searchAgentsLite, type AgentLite } from '../agentsApi'

type AgentValue = { agentId: string | null; manualName: string | null }

type Props = {
  value: AgentValue
  onChange: (v: AgentValue) => void
  displayLabel?: string
}

export default function MeetingAgentPicker({ value, onChange, displayLabel }: Props) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<AgentLite[]>([])
  const debounced = useDebouncedValue(text, 250)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (displayLabel) setText(displayLabel)
  }, [displayLabel])

  useEffect(() => {
    if (value.manualName) setText(value.manualName)
  }, [value.manualName])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    searchAgentsLite(debounced)
      .then((rows) => {
        if (!cancelled) setResults(rows)
      })
      .catch(() => {
        if (!cancelled) setResults([])
      })
    return () => {
      cancelled = true
    }
  }, [debounced, open])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function pickAgent(agent: AgentLite) {
    onChange({ agentId: agent.id, manualName: null })
    setText(agent.name)
    setOpen(false)
  }

  function pickManual() {
    const name = text.trim()
    if (!name) return
    onChange({ agentId: null, manualName: name })
    setOpen(false)
  }

  function unlink() {
    onChange({ agentId: null, manualName: null })
    setText('')
  }

  return (
    <div className="conf-picker" ref={rootRef}>
      <label className="conf-settings-field">
        <span>Agent</span>
        <div className="conf-picker__row">
          <input
            className="input conf-picker__input"
            value={text}
            placeholder="Search agents or type a name"
            onChange={(e) => {
              setText(e.target.value)
              setOpen(true)
              if (value.agentId) onChange({ agentId: null, manualName: null })
            }}
            onFocus={() => setOpen(true)}
          />
          {value.agentId && (
            <span className="conf-picker__badge">
              <Link2 size={12} />
              Linked
              <button type="button" className="conf-picker__unlink" aria-label="Unlink" onClick={unlink}>
                <X size={12} />
              </button>
            </span>
          )}
        </div>
      </label>
      {open && (results.length > 0 || text.trim()) && (
        <div className="conf-picker__menu">
          {results.map((agent) => (
            <button
              key={agent.id}
              type="button"
              className="conf-picker__item"
              onClick={() => pickAgent(agent)}
            >
              <strong>{agent.name}</strong>
              <span className="conf-picker__item-sub">
                {agent.erp_account_code ? `#${agent.erp_account_code}` : 'Portal-only'}
                {agent.country ? ` · ${agent.country}` : ''}
              </span>
            </button>
          ))}
          {text.trim() && (
            <button type="button" className="conf-picker__item conf-picker__item--manual" onClick={pickManual}>
              Use &quot;{text.trim()}&quot; as manual name
            </button>
          )}
        </div>
      )}
    </div>
  )
}
