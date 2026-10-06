// Compact header controls: assign (person + icon, or the assignee's initials) and snooze (clock), each a small popover.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Clock, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { assign, setStatus, type InboxDetail, type StaffOption } from './inboxApi'
import { avatarColors, initials } from './inboxFormat'
import { SNOOZES } from './ThreadActions'

function Pop({ trigger, title, children }: { trigger: (open: boolean, toggle: () => void) => ReactNode; title: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div ref={box} style={{ position: 'relative' }}>
      {trigger(open, () => setOpen(!open))}
      {open ? <div className="ibx-menu" role="menu" aria-label={title} style={{ maxHeight: 360, overflow: 'auto' }}>{children(() => setOpen(false))}</div> : null}
    </div>
  )
}

export function AssignPicker({ detail, staff, me, onChanged }: { detail: InboxDetail; staff: StaffOption[]; me: string; onChanged: () => void }) {
  const c = detail.conversation
  const name = c.assignee_name
  const pick = (uid: string | null, label: string) => assign(c.id, uid).then(() => { toast.success(uid ? `Assigned to ${label}` : 'Unassigned'); onChanged() })
    .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed'))
  const people = [{ user_id: me, name: 'Me' }, ...staff.filter((s) => s.user_id !== me)]
  return (
    <Pop title="Assign" trigger={(open, toggle) => (
      name ? (
        <button type="button" className="ibx-av ibx-av--sm" style={{ ...avatarColors(name), border: 0, cursor: 'pointer' }}
          onClick={toggle} aria-expanded={open} title={`Assigned to ${name}`} aria-label={`Assigned to ${name}`}>{initials(name)}</button>
      ) : (
        <button type="button" className="ibx-mail__icon" onClick={toggle} aria-expanded={open} title="Assign" aria-label="Assign"><UserPlus size={18} /></button>
      ))}>
      {(close) => (
        <>
          <div className="ibx-menu__sect">Assign to</div>
          {people.map((p) => (
            <button key={p.user_id} type="button" role="menuitem" onClick={() => { close(); void pick(p.user_id, p.name) }}>
              <span className="ibx-av ibx-av--sm" style={{ ...avatarColors(p.name), width: 22, height: 22, fontSize: 9.5 }}>{initials(p.name)}</span>
              <span className="ibx-ellip">{p.name}</span>{c.assignee_id === p.user_id ? <Check size={14} style={{ marginLeft: 'auto' }} /> : null}
            </button>
          ))}
          {c.assignee_id ? <button type="button" role="menuitem" onClick={() => { close(); void pick(null, '') }}>Unassign</button> : null}
        </>
      )}
    </Pop>
  )
}

export function SnoozePicker({ detail, onChanged }: { detail: InboxDetail; onChanged: () => void }) {
  const c = detail.conversation
  if (c.eff_status !== 'open') return null
  return (
    <Pop title="Snooze" trigger={(open, toggle) => (
      <button type="button" className="ibx-mail__icon" onClick={toggle} aria-expanded={open} title="Snooze" aria-label="Snooze"><Clock size={18} /></button>
    )}>
      {(close) => (
        <>
          <div className="ibx-menu__sect">Snooze until</div>
          {SNOOZES.map((s) => (
            <button key={s.label} type="button" role="menuitem" onClick={() => {
              close()
              void setStatus(c.id, 'snoozed', s.at().toISOString()).then(() => { toast.success(`Snoozed until ${s.label.toLowerCase()}`); onChanged() })
                .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed'))
            }}><Clock size={15} />{s.label}</button>
          ))}
        </>
      )}
    </Pop>
  )
}
