import { useEffect, useState } from 'react'
import AgentsPage from './AgentsPage'
import ConferencesHub from './conferences/ConferencesHub'
import './agents.css'

type AgentsTab = 'directory' | 'conferences'

const TAB_KEY = 'ubf.agents.activeTab'

const TABS: { key: AgentsTab; label: string }[] = [
  { key: 'directory', label: 'Directory' },
  { key: 'conferences', label: 'Conferences' },
]

function readStoredTab(): AgentsTab {
  try {
    const stored = localStorage.getItem(TAB_KEY)
    if (stored === 'directory' || stored === 'conferences') return stored
  } catch {
    /* ignore */
  }
  return 'directory'
}

function AgentsTabBar({
  active,
  onChange,
}: {
  active: AgentsTab
  onChange: (tab: AgentsTab) => void
}) {
  return (
    <div className="agents-area__tabbar-wrap">
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
        <AgentsTabBar active={active} onChange={setActive} />
        <AgentsPage />
      </>
    )
  }

  return (
    <div className="customers-page agents-page">
      <AgentsTabBar active={active} onChange={setActive} />
      <header className="customers-page__head">
        <h1>Conferences</h1>
      </header>
      <ConferencesHub />
    </div>
  )
}
