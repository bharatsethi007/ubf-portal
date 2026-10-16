import { useEffect, useState } from 'react'
import AgentsPage from './AgentsPage'
import ConferencesHub from './conferences/ConferencesHub'
import AgentsPerformance from './performance/AgentsPerformance'
import './agents.css'

type AgentsTab = 'directory' | 'performance' | 'conferences'

const TAB_KEY = 'ubf.agents.activeTab'

const TABS: { key: AgentsTab; label: string }[] = [
  { key: 'directory', label: 'Directory' },
  { key: 'performance', label: 'Performance' },
  { key: 'conferences', label: 'Conferences' },
]

function readStoredTab(): AgentsTab {
  try {
    const stored = localStorage.getItem(TAB_KEY)
    if (stored === 'directory' || stored === 'performance' || stored === 'conferences') return stored
  } catch {
    /* ignore */
  }
  return 'directory'
}

function AgentsTabBar({
  active,
  onChange,
  inline = false,
}: {
  active: AgentsTab
  onChange: (tab: AgentsTab) => void
  inline?: boolean
}) {
  return (
    <div className={inline ? undefined : 'agents-area__tabbar-wrap'}>
      <div className="customers-segment" role="group" aria-label="Agents section">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`customers-segment__btn${active === key ? ' customers-segment__btn--on' : ''}`}
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AgentsArea() {
  const [active, setActive] = useState<AgentsTab>(readStoredTab)

  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, active)
    } catch {
      /* ignore */
    }
  }, [active])

  if (active === 'directory') {
    return (
      <>
        <AgentsPage tabs={<AgentsTabBar active={active} onChange={setActive} inline />} />
      </>
    )
  }

  return (
    <div className="customers-page agents-page">
      <AgentsTabBar active={active} onChange={setActive} />
      <header className="customers-page__head">
        <h1>{active === 'performance' ? 'Agent performance' : 'Conferences'}</h1>
      </header>
      {active === 'performance' ? <AgentsPerformance /> : <ConferencesHub />}
    </div>
  )
}
