import type { IntelligenceJob, PartyIntelDisplay } from './types'
import { fmtMoney, modeIcon, volumeSentence } from './intelligenceUtils'

type Props = {
  role: string
  party: PartyIntelDisplay
  onPick: (job: IntelligenceJob) => void
}

export default function IntelligenceParty({ role, party, onPick }: Props) {
  return (
    <div className="intel-party">
      <div className="intel-party__head">
        <span className="intel-party__role">{role}</span>
        <span className="intel-party__name">{party.name}</span>
      </div>
      <p className="intel-party__volume">{volumeSentence(party.volume)}.</p>
      <div className="intel-party__stats">
        <div className={`intel-stat${party.due_invoices > 0 ? ' intel-stat--due' : ''}`}>
          <div className="intel-stat__label">Due</div>
          <div className="intel-stat__value">{fmtMoney(party.due_invoices)}</div>
        </div>
        <div className="intel-stat">
          <div className="intel-stat__label">YTD spend</div>
          <div className="intel-stat__value">{fmtMoney(party.ytd_spend)}</div>
        </div>
      </div>
      {party.jobs.length > 0 && (
        <div className="intel-party__jobs">
          {party.jobs.map((job) => (
            <button
              key={job.job}
              type="button"
              className="intel-job-pill"
              onClick={() => onPick(job)}
            >
              {modeIcon(job.mode)} {job.job}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
