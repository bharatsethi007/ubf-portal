import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Box, Package, Plane, Container as ContainerIcon, ChevronDown, Search, Zap, Sparkles } from 'lucide-react'
import CustomerPicker, { type CustomerPickerValue } from '../../components/bookings/CustomerPicker'
import ContainerGroupsEditor from './ContainerGroupsEditor'
import QuoteOriginDestField from './QuoteOriginDestField'
import AirCargoPanel from './AirCargoPanel'
import { type CargoEntryMode } from './QuoteCargoEntry'
import { createQuote, emptyQuoteDraft, updateQuote, type QuoteDraft } from './quotesApi'
import { newQuoteCargoLine, saveQuoteCargo, type QuoteCargoLine } from './quoteCargoApi'
import { emptyContainerGroup, replaceQuoteContainers, type QuoteContainerDraft } from './quoteContainersApi'
import { createQuoteResponse, updateQuoteResponseHeader } from './quoteResponsesApi'
import { saveQuoteResponseLines, type QuoteResponseLine } from './quoteResponseLinesApi'
import { searchFclRates, type RateOption, type QuoteLane } from '../rates/rateSearchApi'
import { buildBuyLinesFromOption, createQuoteWithBuyRates, createQuoteWithLclBuyRates } from '../rates/quoteFromRate'
import { searchLclRates, type LclRateOption, type LclQuoteLane } from '../rates/lclRateSearchApi'
import RateSearchModal from '../rates/RateSearchModal'
import RateOptionCard from '../rates/RateOptionCard'
import LclRateOptionCard from '../rates/LclRateOptionCard'
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

function formatCustomerAddress(c: CustomerPickerValue): string {
  return [c.address1, c.address2, c.address3, c.city, c.state, c.postcode, c.country]
    .map((x) => (x ?? '').trim())
    .filter(Boolean)
    .join(', ')
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
  const [lclOptions, setLclOptions] = useState<LclRateOption[]>([])
  const [lclWm, setLclWm] = useState('')
  const [lclCbm, setLclCbm] = useState('')
  const [airLines, setAirLines] = useState<QuoteCargoLine[]>([newQuoteCargoLine(0)])
  const [airMode, setAirMode] = useState<CargoEntryMode>('total')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [aiQuery, setAiQuery] = useState('')
  const creating = busyId !== null

  // Any change to the request invalidates a prior search.
  function invalidate() { setSearched(false); setOptions([]); setLclOptions([]) }
  function patch(p: Partial<QuoteDraft>) {
    setDraft((d) => ({ ...d, ...p }))
    invalidate()
  }
  function onCustomerChange(c: CustomerPickerValue | null) {
    setCustomer(c)
    // Prefill the customer-side address (export -> origin/pickup, import -> delivery).
    // The user can still edit or clear it in the loads panel.
    const addr = c ? formatCustomerAddress(c) : ''
    if (addr) {
      if (draft.movement_type === 'import') patch({ drop_address: addr })
      else patch({ pickup_address: addr })
    } else {
      invalidate()
    }
  }
  function onGroupsChange(g: QuoteContainerDraft[]) {
    setGroups(g)
    invalidate()
  }
  function addAirLine() { setAirLines((ls) => [...ls, newQuoteCargoLine(ls.length)]) }

  const isLcl = draft.shipment_type === 'LCL'
  const isAir = draft.shipment_type === 'Air'
  useEffect(() => { if (isAir && draft.from_port_code && draft.to_port_code) setLoadsOpen(true) }, [isAir, draft.from_port_code, draft.to_port_code])
  const wmNum = Math.max(0, Number(lclWm) || 0)
  const cbmNum = (Number(lclCbm) || 0) > 0 ? Number(lclCbm) : wmNum

  const canSearch = useMemo(() => {
    if (!customer || !draft.from_port_code || !draft.to_port_code) return false
    if (draft.shipment_type === 'LCL') return wmNum > 0
    return true
  }, [customer, draft.from_port_code, draft.to_port_code, draft.shipment_type, wmNum])

  function setMode(t: 'FCL' | 'LCL' | 'Air') {
    if (draft.shipment_type === t) return
    patch({ shipment_type: t, shipment_mode: t === 'Air' ? 'air' : 'sea' })
  }

  async function runSearch() {
    if (!canSearch) return
    setSearched(true)
    setSearching(true)
    try {
      if (isAir) {
        // No air rate cards yet — funnel to manual pricing via the empty state.
        setOptions([]); setLclOptions([])
      } else if (draft.shipment_type === 'LCL') {
        const lane: LclQuoteLane = {
          from_port_code: draft.from_port_code ?? null,
          to_port_code: draft.to_port_code ?? null,
          currency: null,
          wm: wmNum,
          cbm: cbmNum,
        }
        setLclOptions(await searchLclRates(lane))
      } else {
        const lane: QuoteLane = {
          from_port_code: draft.from_port_code ?? null,
          to_port_code: draft.to_port_code ?? null,
          currency: null,
          movement: draft.movement_type ?? null,
          containers: groups.map((g) => ({ size: g.container_size, qty: g.qty })),
        }
        setOptions(await searchFclRates(lane))
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rate search failed')
      setOptions([]); setLclOptions([])
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
      if (draft.shipment_type === 'FCL') await replaceQuoteContainers(id, groups)
      if (isAir) { await updateQuote(id, { cargo_entry_mode: airMode }); await saveQuoteCargo(id, airLines) }
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

  async function useRateFromChat(o: RateOption, lane: QuoteLane) {
    if (!customer) throw new Error('Pick a customer above first, then tap Use rate again.')
    const { quoteId } = await createQuoteWithBuyRates({
      customerAccountId: customer.account_id,
      customerName: customer.name,
      fromPortCode: lane.from_port_code!,
      toPortCode: lane.to_port_code!,
      containers: lane.containers,
      option: o,
    })
    navigate(`/quotes/${quoteId}`)
  }

  async function useLclRateFromChat(o: LclRateOption, lane: LclQuoteLane) {
    if (!customer) throw new Error('Pick a customer above first, then tap Use rate again.')
    const { quoteId } = await createQuoteWithLclBuyRates({
      customerAccountId: customer.account_id,
      customerName: customer.name,
      fromPortCode: lane.from_port_code!,
      toPortCode: lane.to_port_code!,
      option: o,
    })
    navigate(`/quotes/${quoteId}`)
  }

  async function handleCreateLcl(o: LclRateOption) {
    if (!customer || !draft.from_port_code || !draft.to_port_code) return
    setBusyId(o.cardId)
    try {
      const { quoteId } = await createQuoteWithLclBuyRates({
        customerAccountId: customer.account_id,
        customerName: customer.name,
        fromPortCode: draft.from_port_code,
        toPortCode: draft.to_port_code,
        option: o,
      })
      toast.success('Quote created with LCL buy rates')
      navigate(`/quotes/${quoteId}`)
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

        <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Sparkles size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#3B5BFE' }} />
            <input value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && aiQuery.trim()) setChatOpen(true) }}
              placeholder="Ask AI to find rates — e.g. “Ningbo to Auckland, 2×40ft”"
              style={{ width: '100%', height: 46, padding: '0 16px 0 40px', border: '1px solid var(--color-line)', borderRadius: 12, fontSize: 14, outline: 'none' }} />
          </div>
          <button type="button" disabled={!aiQuery.trim()} onClick={() => setChatOpen(true)}
            style={{ height: 46, padding: '0 18px', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 600, cursor: aiQuery.trim() ? 'pointer' : 'not-allowed', opacity: aiQuery.trim() ? 1 : .5, display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(120deg,#0A2472,#3B5BFE 55%,#F5A623 150%)', boxShadow: '0 6px 18px rgba(59,91,254,.28)' }}>
            <Search size={16} /> Search
          </button>
        </div>
        {chatOpen && (
          <RateSearchModal initialQuery={aiQuery} onUseRate={useRateFromChat} onUseLclRate={useLclRateFromChat} onClose={() => setChatOpen(false)} />
        )}
        <div className="nqs-customer">
          <CustomerPicker label="Customer" required value={customer} onChange={onCustomerChange} />
        </div>

        <div className="nqs-modes">
          <button type="button" className={`nqs-mode${!isLcl && !isAir ? ' nqs-mode--active' : ''}`} onClick={() => setMode('FCL')}>
            <Box size={15} /> FCL
          </button>
          <button type="button" className={`nqs-mode${isLcl ? ' nqs-mode--active' : ''}`} onClick={() => setMode('LCL')}>
            <Package size={15} /> LCL
          </button>
          <button type="button" className={`nqs-mode${isAir ? ' nqs-mode--active' : ''}`} onClick={() => setMode('Air')}>
            <Plane size={15} /> Air
          </button>
        </div>

        <div className="nqs-bar">
          <QuoteOriginDestField side="origin" draft={draft} onPatch={patch} mode={isAir ? 'air' : 'sea'} hideType={isAir} />
          <QuoteOriginDestField side="destination" draft={draft} onPatch={patch} mode={isAir ? 'air' : 'sea'} hideType={isAir} />

          {isLcl ? (
            <div className="nqs-loads-btn" style={{ cursor: 'default', gap: 12 }}>
              <ContainerIcon size={16} color="#64748b" />
              <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: 'var(--muted-foreground)' }}>
                Chargeable W/M
                <input type="number" min={0} inputMode="decimal" value={lclWm} onChange={(e) => { setLclWm(e.target.value); invalidate() }}
                  placeholder="e.g. 3.5" style={{ width: 84, border: 'none', outline: 'none', fontSize: 14, background: 'transparent' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: 'var(--muted-foreground)' }}>
                CBM (opt.)
                <input type="number" min={0} inputMode="decimal" value={lclCbm} onChange={(e) => { setLclCbm(e.target.value); invalidate() }}
                  placeholder="= W/M" style={{ width: 72, border: 'none', outline: 'none', fontSize: 14, background: 'transparent' }} />
              </label>
            </div>
          ) : isAir ? (
            <button type="button" className="nqs-air-arrow" onClick={() => setLoadsOpen((v) => !v)} aria-label="Toggle cargo & incoterm">
              <ChevronDown size={18} style={{ transform: loadsOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
            </button>
          ) : (
            <button type="button" className="nqs-loads-btn" onClick={() => setLoadsOpen((v) => !v)}>
              <ContainerIcon size={16} color="#64748b" />
              <span style={{ flex: 1 }}>
                <span className="nqs-loads-btn__label" style={{ display: 'block' }}>Loads</span>
                <span className="nqs-loads-btn__val">{loadsSummary(groups)}</span>
              </span>
              <ChevronDown size={15} color="#94a3b8" />
            </button>
          )}

          <button
            type="button"
            className="nqs-search-btn"
            disabled={!canSearch}
            title={canSearch ? '' : (isLcl ? 'Pick a customer, both ports and W/M' : isAir ? 'Pick a customer and both airports' : 'Pick a customer and both ports')}
            onClick={runSearch}
          >
            <Search size={16} /> Search
          </button>
        </div>

        {loadsOpen && isAir && (
          <AirCargoPanel
            incoterm={draft.incoterms ?? ''}
            onIncotermChange={(v) => patch({ incoterms: v || null })}
            incotermPlace={draft.incoterm_place ?? ''}
            onIncotermPlaceChange={(v) => patch({ incoterm_place: v || null })}
            originAddress={draft.pickup_address ?? ''}
            onOriginAddressChange={(v) => patch({ pickup_address: v || null })}
            deliveryAddress={draft.drop_address ?? ''}
            onDeliveryAddressChange={(v) => patch({ drop_address: v || null })}
            lines={airLines}
            entryMode={airMode}
            onEntryModeChange={setAirMode}
            onLinesChange={setAirLines}
            onAddLine={addAirLine}
          />
        )}

        {isAir && (
          <div className="nqs-air-actions">
            <button type="button" className="nqs-air-plain" disabled={creating} onClick={() => handleCreate()}>
              {busyId === '__plain__' ? 'Creating…' : 'Create without a rate'}
            </button>
            <button type="button" className="nqs-search-btn" disabled={!canSearch} onClick={runSearch}>
              <Search size={16} /> Get rates
            </button>
          </div>
        )}

        {loadsOpen && !isLcl && !isAir && (
          <ContainerGroupsEditor
            groups={groups}
            onChange={onGroupsChange}
            movement={draft.movement_type ?? ''}
            onMovementChange={(v) => patch({ movement_type: v || null })}
            incoterm={draft.incoterms ?? ''}
            onIncotermChange={(v) => patch({ incoterms: v || null })}
            originAddress={draft.pickup_address ?? ''}
            onOriginAddressChange={(v) => patch({ pickup_address: v || null })}
            deliveryAddress={draft.drop_address ?? ''}
            onDeliveryAddressChange={(v) => patch({ drop_address: v || null })}
            onApply={() => setLoadsOpen(false)}
            onCancel={() => setLoadsOpen(false)}
          />
        )}

        {searched && (
          <div className="nqs-results">
            {searching ? (
              <div className="nqs-results__empty"><div className="nqs-results__title">Searching your rate cards…</div></div>
            ) : (isLcl ? lclOptions.length : options.length) > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="text-muted-foreground" style={{ fontSize: 12 }}>{(isLcl ? lclOptions.length : options.length)} rate{(isLcl ? lclOptions.length : options.length) === 1 ? '' : 's'} for {draft.from_port_code} → {draft.to_port_code}</span>
                  <button type="button" className="btn btn--inline" style={{ marginTop: 0, background: 'transparent', color: 'var(--color-ink)', border: '1px solid var(--color-line)' }} disabled={creating} onClick={() => handleCreate()}>
                    {busyId === '__plain__' ? 'Creating…' : 'Create without a rate'}
                  </button>
                </div>
                {isLcl
                  ? lclOptions.map((o) => (
                      <LclRateOptionCard key={o.cardId} option={o} fromCode={draft.from_port_code ?? ''} toCode={draft.to_port_code ?? ''} onUse={() => handleCreateLcl(o)} busy={busyId === o.cardId} />
                    ))
                  : options.map((o) => (
                      <RateOptionCard key={o.cardId} option={o} fromCode={draft.from_port_code ?? ''} toCode={draft.to_port_code ?? ''} onUse={() => handleCreate(o)} busy={busyId === o.cardId} />
                    ))}
              </div>
            ) : (
              <div className="nqs-results__empty">
                <div className="nqs-results__icon"><Zap size={20} /></div>
                <div className="nqs-results__title">{isAir ? 'Air quoting is priced manually' : 'No live rates for this lane'}</div>
                <div className="nqs-results__text">{isAir
                  ? `No air rate cards yet. Create the quote for ${draft.from_port_code} → ${draft.to_port_code}, then add a priced response manually.`
                  : `No active rate card matches ${draft.from_port_code} → ${draft.to_port_code} for this ${isLcl ? 'cargo' : 'equipment'}. Create the quote and add a priced response manually.`}</div>
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
