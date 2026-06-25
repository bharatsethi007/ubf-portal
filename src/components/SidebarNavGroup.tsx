import { NavLink, useLocation } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'

export type NavGroupDef = {
  id: string
  label: string
  icon: LucideIcon
  basePath: string
  items: { to: string; label: string }[]
}

type Props = {
  group: NavGroupDef
  onNavigate?: () => void
}

export default function SidebarNavGroup({ group, onNavigate }: Props) {
  const location = useLocation()
  const inSection = location.pathname.startsWith(group.basePath)
  const [open, setOpen] = useState(inSection)

  useEffect(() => {
    if (inSection) setOpen(true)
  }, [inSection])

  const Icon = group.icon

  return (
    <div className="nav-group">
      <button
        type="button"
        className={`nav-group__toggle${open ? ' open' : ''}${inSection ? ' active' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon size={18} strokeWidth={1.75} />
        <span className="nav-group__label">{group.label}</span>
        <ChevronDown size={16} className="nav-group__chev" />
      </button>
      {open && (
        <div className="nav-group__items">
          {group.items.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-link nav-link--sub${isActive ? ' active' : ''}`}
              onClick={onNavigate}
            >
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}
