import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ALL_MODULES, type ModuleKey } from '../access'
import ModulePicker from './ModulePicker'
import { setModules, type Member } from './teamApi'

type Props = { m: Member; onDone: (msg: string) => void; onCancel: () => void }

/** Admin edits which modules a member can use. Takes effect on their next page load. */
export default function AccessEdit({ m, onDone, onCancel }: Props) {
  const [mods, setMods] = useState<ModuleKey[]>(ALL_MODULES.filter((k) => (m.modules ?? []).includes(k)))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const who = m.name || m.email

  async function save() {
    setBusy(true); setErr('')
    try { await setModules(m.user_id, mods); onDone(`${who}'s access is saved.`) }
    catch (x) { setErr(x instanceof Error ? x.message : 'Could not save'); setBusy(false) }
  }

  return (
    <li className="pv3-team__person pv3-team__edit">
      <div className="pv3-team__editbody">
        <b className="pv3-team__edit-title">Access for {who}</b>
        <ModulePicker value={mods} onChange={setMods} disabled={busy} />
        {err && <div className="pv3-team__err" role="alert">{err}</div>}
        <div className="pv3-team__row">
          <span className="pv3-muted">Changes apply next time they open a page.</span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="pv3-textbtn" onClick={onCancel} disabled={busy}>Cancel</button>
            <button type="button" className="pv3-btn pv3-btn--primary" onClick={() => void save()} disabled={busy}>{busy && <Loader2 size={15} className="pv3-spin" />} Save</button>
          </span>
        </div>
      </div>
    </li>
  )
}
