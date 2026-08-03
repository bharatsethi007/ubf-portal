import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Box, Package, Plane, Container as ContainerIcon, ChevronDown, Search, Zap } from 'lucide-react'
import CustomerPicker, { type CustomerPickerValue } from '../../components/bookings/CustomerPicker'
import ContainerGroupsEditor from './ContainerGroupsEditor'
import QuoteOriginDestField from './QuoteOriginDestField'
import { createQuote, emptyQuoteDraft, type QuoteDraft } from './quotesApi'
import { emptyContainerGroup, replaceQuoteContainers, type QuoteContainerDraft } from './quoteContainersApi'
import { createQuoteResponse, updateQuoteResponseHeader } from './quoteResponsesApi'
import { saveQuoteResponseLines, type QuoteResponseLine } from './quoteResponseLinesApi'
import { searchFclRates, type RateOption, type QuoteLane } from '../rates/rateSearchApi'
import { buildBuyLinesFromOption } from '../rates/quoteFromRate'
import RateOptionCard from '../rates/RateOptionCard'
import './newQuoteSearch.css'

const SIZE_LABEL: Record<string, string> = { '20': '20ft', '40': '40ft', '40HC': '40ft HC', '45HC': '45ft HC' }

function loadsSummary(groups: QuoteContainerDraft[]): string {
  if (groups.length === 1) {
    const g = groups[0]
    return `${g.qty} × ${SIZE_LABEL[g.container_size] ?? g.container_size}`
  }
  const total = groups.reduce((n, g) => n + g.qty, 0)
  return `${groups.length} groups · ${total} containers`
}

export default function NewQuoteSearch() {
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<CustomerPickerValue | null>(null)
  const [draft, setDraft] = useState<QuoteDraft>(() => ({
    ...emptyQuoteDraft(),
    shipment_mode: 'sea',
    shipment_type: 'FCL',
    origin_location_type: 'Port/Airport',
    dest_location_type: 'Port/Airport',
  }))
  const [groups, setGroups] = useState<QuoteContainerDraft[]>([emptyContainerGroup(0)])
  const [loadsOpen, setLoadsOpen] = useState(false)
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [options, setOptions] = useState<RateOption[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const creating = busyId !== null

  // Any change to the request invalidates a prior search.
  function invalidate() { setSearched(false); setOptions([]) }
  function patch(p: Partial<QuoteDraft>) {
    setDraft((d) => ({ ...d, ...p }))
    invalidate()
  }
  function onCustomerChange(c: CustomerPickerValue | null) {
    setCustomer(c)
    invalidate()
  }
  function onGroupsChange(g: QuoteContainerDraft[]) {
    setGroups(g)
    invalidate()
  }

  const canSearch = useMemo(
    () => Boolean(customer && draft.from_port_code && draft.to_port_code),
    [customer, draft.from_port_code, draft.to_port_code],
  )

  async function runSearch() {
    if (!canSearch) return
    setSearched(true)
    setSearching(true)
    try {
      const lane: QuoteLane = {
        from_port_code: draft.from_port_code ?? null,
        to_port_code: draft.to_port_code ?? null,
        currency: null,
        containers: groups.map((g) => ({ size: g.container_size, qty: g.qty })),
      }
      setOptions(await searchFclRates(lane))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rate search failed')
      setOptions([])
    } finally {
      setSearching(false)
    }
  }

  function buildBuyLines(o: RateOption): QuoteResponseLine[] {
    return buildBuyLinesFromOption(o, groups.map((g) => ({ size: g.container_size, qty: g.qty })))
  }

  async function handleCreate(chosen?: RateOption) {
    if (!customer) return
    setBusyId(chosen?.cardId ?? '__plain__')
    try {
      const payload: QuoteDraft = {
        ...draft,
        customer_account_id: customer.account_id,
        customer_name: customer.name,
      }
      const { id } = await createQuote(payload)
      await replaceQuoteContainers(id, groups)
      if (chosen) {
        const { id: responseId } = await createQuoteResponse(id)
        await saveQuoteResponseLines(responseId, buildBuyLines(chosen))
        if (chosen.currency) await updateQuoteResponseHeader(responseId, { currency: chosen.currency })
      }
      toast.success(chosen ? 'Quote created with buy rates' : 'Quote created')
      navigate(`/quotes/${id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create quote')
      setBusyId(null)
    }
  }

  return (
    <div className="nqs-page">
      <div className="nqs-card">
        <div className="nqs-head">
          <div>
            <h1 className="nqs-title">New quote</h1>
            <p className="nqs-sub">Build a rate request, then create the quote</p>
          </div>
          <Link to="/quotes" className="nqs-quoteno">Cancel</Link>
        </div>

        <div className="nqs-customer">
          <CustomerPicker label="Customer" required value={customer} onChange={onCustomerChange} />
        </div>

        <div className="nqs-modes">
          <button type="button" className="nqs-mode nqs-mode--active">
            <Box size={15} /> FCL
          </button>
          <button type="button" className="nqs-mode nqs-mode--disabled" disabled>
            <Package size={15} /> LCL <span className="nqs-soon">soon</span>
          </button>
          <button type="button" className="nqs-mode nqs-mode--disabled" disabled>
            <Plane size={15} /> Air <span className="nqs-soon">soon</span>
          </button>
        </div>

        <div className="nqs-bar">
          <QuoteOriginDestField side="origin" draft={draft} onPatch={patch} />
          <QuoteOriginDestField side="destination" draft={draft} onPatch={patch} />

          <button type="button" className="nqs-loads-btn" onClick={() => setLoadsOpen((v) => !v)}>
            <ContainerIcon size={16} color="#64748b" />
            <span style={{ flex: 1 }}>
              <span className="nqs-loads-btn__label" style={{ display: 'block' }}>Loads</span>
              <span className="nqs-loads-btn__val">{loadsSummary(groups)}</span>
            </span>
            <ChevronDown size={15} color="#94a3b8" />
          </button>

          <button
            type="button"
            className="nqs-search-btn"
            disabled={!canSearch}
            title={canSearch ? '' : 'Pick a customer and both ports'}
            onClick={runSearch}
          >
            <Search size={16} /> Search
          </button>
        </div>

        {loadsOpen && (
          <ContainerGroupsEditor
            groups={groups}
            onChange={onGroupsChange}
            onApply={() => setLoadsOpen(false)}
            onCancel={() => setLoadsOpen(false)}
          />
        )}

        {searched && (
          <div className="nqs-results">
            {searching ? (
              <div className="nqs-results__empty"><div className="nqs-results__title">Searching your rate cards…</div></div>
            ) : options.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="text-muted-foreground" style={{ fontSize: 12 }}>{options.length} rate{options.length === 1 ? '' : 's'} for {draft.from_port_code} → {draft.to_port_code}</span>
                  <button type="button" className="btn btn--inline" style={{ marginTop: 0, background: 'transparent', color: 'var(--color-ink)', border: '1px solid var(--color-line)' }} disabled={creating} onClick={() => handleCreate()}>
                    {busyId === '__plain__' ? 'Creating…' : 'Create without a rate'}
                  </button>
                </div>
                {options.map((o) => (
                  <RateOptionCard key={o.cardId} option={o} fromCode={draft.from_port_code ?? ''} toCode={draft.to_port_code ?? ''} onUse={() => handleCreate(o)} busy={busyId === o.cardId} />
                ))}
              </div>
            ) : (
              <div className="nqs-results__empty">
                <div className="nqs-results__icon"><Zap size={20} /></div>
                <div className="nqs-results__title">No live rates for this lane</div>
                <div className="nqs-results__text">No active rate card matches {draft.from_port_code} → {draft.to_port_code} for these containers. Create the quote and add a priced response manually.</div>
                <button type="button" className="nqs-results__create" disabled={creating} onClick={() => handleCreate()}>
                  {busyId === '__plain__' ? 'Creating…' : 'Create quote from this request'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
