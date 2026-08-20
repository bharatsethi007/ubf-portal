import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { fmt } from '../../../components/Customers/profileUi'
import { listFreightNetworks, type FreightNetwork } from '../agentsApi'
import ReviewQueueTable from './ReviewQueueTable'
import { ImpExpCell } from './reviewUi'
import {
  acceptAgentReview,
  excludeAgentReview,
  fetchReviewFlags,
  fetchReviewQueue,
  SUGGESTED_CLASS_FILTERS,
  type ExcludeReason,
  type ReviewFlagRow,
  type ReviewQueueRow,
  type SuggestedClassFilter,
} from './reviewApi'
import '../agents.css'

function effectiveName(row: ReviewQueueRow, nameDrafts: Record<string, string>): string {
  return row.name?.trim() || nameDrafts[row.code]?.trim() || ''
}

export default function ReviewQueuePage() {
  const [queue, setQueue] = useState<ReviewQueueRow[]>([])
  const [flags, setFlags] = useState<ReviewFlagRow[]>([])
  const [networks, setNetworks] = useState<FreightNetwork[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [classFilter, setClassFilter] = useState<SuggestedClassFilter>('all')
  const [minJobs, setMinJobs] = useState(1)
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({})
  const [networkByCode, setNetworkByCode] = useState<Record<string, string>>({})
  const [busyCode, setBusyCode] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    return Promise.all([fetchReviewQueue(), fetchReviewFlags(), listFreightNetworks()])
      .then(([queueRows, flagRows, netRows]) => {
        setQueue(queueRows)
        setFlags(flagRows)
        setNetworks(netRows)
        setError('')
      })
      .catch((e) => {
        setError(e.message ?? 'Failed to load review queue')
        setQueue([])
        setFlags([])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const totalJobs = useMemo(() => queue.reduce((sum, r) => sum + (r.jobs ?? 0), 0), [queue])

  const filteredQueue = useMemo(() => {
    return queue.filter((row) => {
      if (row.jobs < minJobs) return false
      if (classFilter === 'all') return true
      const suggested = (row.suggested_class ?? 'unknown').toLowerCase()
      return suggested === classFilter
    })
  }, [queue, classFilter, minJobs])

  const removeFromQueue = (code: string) => {
    setQueue((prev) => prev.filter((r) => r.code !== code))
    setNameDrafts((prev) => {
      const next = { ...prev }
      delete next[code]
      return next
    })
    setNetworkByCode((prev) => {
      const next = { ...prev }
      delete next[code]
      return next
    })
  }

  const removeFlag = (code: string) => {
    setFlags((prev) => prev.filter((r) => r.code !== code))
  }

  const handleAccept = async (row: ReviewQueueRow) => {
    setBusyCode(row.code)
    try {
      await acceptAgentReview({
        code: row.code,
        networkCode: networkByCode[row.code] || null,
        name: effectiveName(row, nameDrafts) || null,
      })
      removeFromQueue(row.code)
      toast.success(`${row.code} added as agent`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add agent')
    } finally {
      setBusyCode(null)
    }
  }

  const handleExclude = async (row: ReviewQueueRow, reason: ExcludeReason) => {
    setBusyCode(row.code)
    try {
      await excludeAgentReview(row.code, reason)
      removeFromQueue(row.code)
      toast.success(`${row.code} excluded (${reason})`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to exclude code')
    } finally {
      setBusyCode(null)
    }
  }

  const handleMoveFlag = async (row: ReviewFlagRow) => {
    setBusyCode(row.code)
    try {
      await acceptAgentReview({ code: row.code })
      removeFlag(row.code)
      removeFromQueue(row.code)
      toast.success(`${row.code} moved to agents`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to move to agents')
    } finally {
      setBusyCode(null)
    }
  }

  return (
    <TooltipProvider delay={300}>
    <div className="customers-page agents-page agent-review-page">
      <header className="customers-page__head">
        <div>
          <p className="agent-review-back">
            <Link to="/agents">← Agents</Link>
          </p>
          <h1>
            Agent review — {queue.length} codes · {fmt.int(totalJobs)} jobs awaiting classification
          </h1>
        </div>
      </header>

      {error && <div className="error card pad-inline">{error}</div>}

      {flags.length > 0 && (
        <section className="card pad-inline agent-review-flags">
          <h2 className="agent-review-flags__title">Possibly misclassified</h2>
          <div className="table-wrap">
            <table className="data-table agent-review-dense-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Reason</th>
                  <th>Imp / Exp</th>
                  <th>Jobs</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {flags.map((row) => (
                  <tr key={row.code} className="agent-review-row">
                    <td>{row.name ?? row.code}</td>
                    <td>{row.reason}</td>
                    <td>
                      <ImpExpCell imp={row.imp} exp={row.exp} />
                    </td>
                    <td className="tabular-nums">{fmt.int(row.jobs)}</td>
                    <td>
                      <Button
                        type="button"
                        size="sm"
                        className="agent-review-add-btn"
                        disabled={busyCode === row.code}
                        onClick={() => void handleMoveFlag(row)}
                      >
                        <UserPlus size={14} />
                        Move
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="customers-page__filters">
        <div className="customers-segment" role="group" aria-label="Suggested class filter">
          {SUGGESTED_CLASS_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`customers-segment__btn${classFilter === key ? ' customers-segment__btn--on' : ''}`}
              onClick={() => setClassFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="customers-page__select-label">
          Min jobs
          <input
            type="number"
            min={1}
            className="input input--sm agent-review-min-jobs"
            value={minJobs}
            onChange={(e) => setMinJobs(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
      </div>

      <div className="customers-table card">
        <div className="table-wrap">
          <table className="data-table agent-review-dense-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Country</th>
                <th>Imp / Exp</th>
                <th>Last activity</th>
                <th>Suggested class</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-muted-foreground pad-inline">
                    Loading…
                  </td>
                </tr>
              ) : (
                <ReviewQueueTable
                  rows={filteredQueue}
                  networks={networks}
                  nameDrafts={nameDrafts}
                  networkByCode={networkByCode}
                  busyCode={busyCode}
                  onNameDraft={(code, value) => setNameDrafts((prev) => ({ ...prev, [code]: value }))}
                  onNetworkChange={(code, value) => setNetworkByCode((prev) => ({ ...prev, [code]: value }))}
                  onAccept={(row) => void handleAccept(row)}
                  onExclude={(row, reason) => void handleExclude(row, reason)}
                />
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </TooltipProvider>
  )
}
