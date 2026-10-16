import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../supabase'
import MultiChipSelect from '../../components/MultiChipSelect'
import InvoicesTable from '../../components/InvoicesTable'
import { useCustomerInvoices } from '../../hooks/useInvoices'
import { CustomerShipmentsTab } from '../../components/Customers/CustomerShipmentsTab'
import AgentTrustedTick from './AgentTrustedTick'
import {
  fetchAgent,
  listFreightNetworks,
  setAgentNetworks,
  updateAgent,
  type AgentRow,
  type AgentStatus,
  type FreightNetwork,
} from './agentsApi'
import AgreementPill from './AgreementPill'
import AgentOverviewStats from './AgentOverviewStats'
import AgentQuotesTab from './AgentQuotesTab'
import { TabBtn, TradeLanesTab } from './AgentTradeLanesTab'
import { fetchAgentAgreementState, fetchAgentStats, type AgentAgreementSummary, type AgentStats } from './agentStatsApi'
import './agents.css'

type Tab = 'overview' | 'quotes' | 'shipments' | 'lanes' | 'invoices'
const TABS: Tab[] = ['overview', 'quotes', 'shipments', 'lanes', 'invoices']

export default function AgentRecordPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [agent, setAgent] = useState<AgentRow | null>(null)
  const [networks, setNetworks] = useState<FreightNetwork[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab') as Tab | null
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'overview'
  const setTab = (t: Tab) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true })
  const [stats, setStats] = useState<AgentStats | null>(null)
  const [agreement, setAgreement] = useState<AgentAgreementSummary | null>(null)

  // editable local state
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [status, setStatus] = useState<AgentStatus>('active')
  const [codes, setCodes] = useState<string[]>([])
  const [notes, setNotes] = useState('')

  const accountId = agent?.erp_account_code ?? null
  const { invoices, outstandingByCurrency, loading: invoicesLoading } = useCustomerInvoices(accountId)

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    Promise.all([fetchAgent(id), listFreightNetworks()])
      .then(([a, nets]) => {
        setNetworks(nets)
        if (a) {
          setAgent(a)
          setName(a.name)
          setCountry(a.country ?? '')
          setStatus(a.status)
          setCodes(a.network_codes)
          setNotes(a.notes ?? '')
        }
      })
      .catch((e) => toast.error(e.message ?? 'Failed to load agent'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!id) return
    fetchAgentStats(id).then(setStats).catch(() => setStats(null))
    fetchAgentAgreementState(id).then(setAgreement).catch(() => setAgreement(null))
  }, [id])

  async function save() {
    if (!id) return
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      await updateAgent(id, {
        name: name.trim(),
        country: country.trim() || null,
        status,
        notes: notes.trim() || null,
      })
      await setAgentNetworks(id, codes)
      toast.success('Saved')
      load()
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function toggleTrusted() {
    if (!id || !agent) return
    const next = !agent.trusted
    setSaving(true)
    try {
      let approver: string | null = null
      if (next) {
        const { data: auth } = await supabase.auth.getUser()
        approver = auth.user?.id ?? null
      }
      await updateAgent(id, {
        trusted: next,
        approved_by: approver,
        approved_at: next ? new Date().toISOString() : null,
      })
      toast.success(next ? 'Marked trusted' : 'Trusted removed')
      load()
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="detail-page pad">Loading…</div>
  if (!agent)
    return (
      <div className="empty card">
        Agent not found.{' '}
        <button type="button" className="text-link" onClick={() => navigate('/agents')}>
          Back to agents
        </button>
      </div>
    )

  const netOptions = networks.map((n) => ({ value: n.code, label: `${n.code} — ${n.name}` }))

  return (
    <div className="detail-page" style={{ maxWidth: 'none', width: '100%' }}>
      <header className="cp-header">
        <button type="button" className="detail-back" onClick={() => navigate('/agents')}>
          ← Agents
        </button>
        <div className="agent-record__head-row">
          <div>
            <div className="cp-title-wrap">
              <h1 className="cp-title">{agent.name}</h1>
              {agent.trusted && <AgentTrustedTick />}
              <AgreementPill state={agreement?.state ?? 'none'} expiry={agreement?.expiry_date} daysLeft={agreement?.days_left} long />
            </div>
            <div className="cp-sub">
              {agent.erp_account_code && !agent.erp_account_code.startsWith('P-') ? (
                <span className="cp-sub-code">#{agent.erp_account_code}</span>
              ) : (
                <span className="pill agent-notcf-pill" title="Not present in the ERP (CargoFinder)">
                  Not on CF
                </span>
              )}
              <span>· {agent.source === 'erp' ? 'From ERP' : 'Portal-only'}</span>
              {agent.country && <span>· {agent.country}</span>}
              {agent.network_codes.map((c) => (
                <span key={c} className="cp-badge cp-badge--indigo">
                  {c}
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="btn btn--inline agent-trusted-btn"
            onClick={toggleTrusted}
            disabled={saving}
          >
            {agent.trusted ? 'Remove trusted' : 'Mark trusted'}
          </button>
        </div>

        <div className="cp-tabs">
          <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>
            Overview
          </TabBtn>
          <TabBtn active={tab === 'quotes'} onClick={() => setTab('quotes')}>
            Quotes{stats ? ` (${stats.quotes})` : ''}
          </TabBtn>
          <TabBtn active={tab === 'shipments'} onClick={() => setTab('shipments')}>
            Shipments
          </TabBtn>
          <TabBtn active={tab === 'lanes'} onClick={() => setTab('lanes')}>
            Trade lanes
          </TabBtn>
          <TabBtn active={tab === 'invoices'} onClick={() => setTab('invoices')}>
            Invoices
          </TabBtn>
        </div>
      </header>

      <div className="cp-body">
        {tab === 'overview' && <AgentOverviewStats stats={stats} outstanding={outstandingByCurrency} />}

        {tab === 'quotes' && id && <AgentQuotesTab agentId={id} stats={stats} />}

        {tab === 'overview' && (
          <section className="cp-card">
            <div className="cp-card-head">
              <h3 className="cp-card-title">Agent details</h3>
            </div>
            <div className="agent-form agent-record__form">
              <label className="agent-form__field">
                <span>Name</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="agent-form__field">
                <span>Country</span>
                <input className="input" value={country} onChange={(e) => setCountry(e.target.value)} />
              </label>
              <label className="agent-form__field">
                <span>Status</span>
                <select
                  className="input"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AgentStatus)}
                >
                  <option value="active">Active</option>
                  <option value="prospect">Prospect</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <div className="agent-form__field">
                <span>Networks</span>
                <MultiChipSelect
                  options={netOptions}
                  value={codes}
                  onChange={setCodes}
                  placeholder="Add networks…"
                />
              </div>
              <label className="agent-form__field agent-form__field--wide">
                <span>Notes</span>
                <textarea
                  className="input"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </div>
            <div className="agent-record__actions">
              <button type="button" className="btn quotes-page__new-btn" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </section>
        )}

        {tab === 'shipments' &&
          (accountId ? (
            <CustomerShipmentsTab accountId={accountId} scopeColumn="os_agent_code" showExport />
          ) : (
            <NoErpNote what="shipments" />
          ))}

        {tab === 'lanes' &&
          (accountId ? <TradeLanesTab accountId={accountId} /> : <NoErpNote what="trade lanes" />)}

        {tab === 'invoices' &&
          (accountId ? (
            <section className="cp-card">
              <div className="cp-card-head">
                <h3 className="cp-card-title">Invoices</h3>
              </div>
              <InvoicesTable
                invoices={invoices}
                loading={invoicesLoading}
                showShipment
                paginate
                pageSize={25}
                outstandingByCurrency={outstandingByCurrency}
                emptyMessage="No invoices for this agent."
              />
            </section>
          ) : (
            <NoErpNote what="invoices" />
          ))}
      </div>
    </div>
  )
}

function NoErpNote({ what }: { what: string }) {
  return (
    <section className="cp-card">
      <p className="text-muted-foreground pad-inline">
        This agent isn't linked to an ERP account yet, so there are no {what} to show. Once an ERP
        account with a matching code syncs in, this will populate automatically.
      </p>
    </section>
  )
}
