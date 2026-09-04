import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Box, Package, Plane, Container as ContainerIcon, ChevronDown, Search, Zap, Info, Boxes, Handshake } from 'lucide-react'
import type { CustomerPickerValue } from '../../components/bookings/CustomerPicker'
import ContainerGroupsEditor from './ContainerGroupsEditor'
import QuoteOriginDestField from './QuoteOriginDestField'
import AirCargoPanel from './AirCargoPanel'
import { type CargoEntryMode } from './QuoteCargoEntry'
import { createQuote, emptyQuoteDraft, updateQuote, type QuoteDraft } from './quotesApi'
import { computeCargoLine, newQuoteCargoLine, saveQuoteCargo, type QuoteCargoLine } from './quoteCargoApi'
import { emptyContainerGroup, replaceQuoteContainers, type QuoteContainerDraft } from './quoteContainersApi'
import { createQuoteResponse, updateQuoteResponseHeader } from './quoteResponsesApi'
import { saveQuoteResponseLines, type QuoteResponseLine } from './quoteResponseLinesApi'
import { searchFclRates, type RateOption, type QuoteLane } from '../rates/rateSearchApi'
import { buildBuyLinesFromOption, createQuoteWithAirBuyRates, createQuoteWithBuyRates, createQuoteWithLclBuyRates } from '../rates/quoteFromRate'
import { searchLclRates, type LclRateOption, type LclQuoteLane } from '../rates/lclRateSearchApi'
import { searchAirRates, type AirRateOption } from '../rates/airRateSearchApi'
import RateOptionCard from '../rates/RateOptionCard'
import LclRateOptionCard from '../rates/LclRateOptionCard'
import AirRateOptionCard from '../rates/AirRateOptionCard'
import { useEffectiveRates } from '../../hooks/useEffectiveRates'
import { chargeLegsFor, serviceTypeForIncoterm, defaultFreightTerms } from '../rates/incotermLegs'
import PartySearch from './PartySearch'
import FreightIntelligence from './FreightIntelligence'
import { type Party } from './partySearchApi'
import { type AgentPick } from './agentLookupApi'
import { overseasOfficeForPort } from '../rates/offices'
import './newQuoteSearch.css'

const SIZE_LABEL: Record<string, string> = { '20': '20ft', '40': '40ft', '40HC': '40ft HC', '45HC': '45ft HC' }

const termChip: CSSProperties = { fontSize: 11, fontWeight: 500, color: '#3B5BFE', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 999, padding: '2px 10px', whiteSpace: 'nowrap' }

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
  const { rates: fxRates } = useEffectiveRates('NZD')

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
  const [airOptions, setAirOptions] = useState<AirRateOption[]>([])
  const [lclWm, setLclWm] = useState('')
  const [lclCbm, setLclCbm] = useState('')
  const [airLines, setAirLines] = useState<QuoteCargoLine[]>([newQuoteCargoLine(0)])
  const [airMode, setAirMode] = useState<CargoEntryMode>('total')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [party, setParty] = useState<Party | null>(null)
  const [agentMode, setAgentMode] = useState(false)
  const [agent, setAgent] = useState<AgentPick | null>(null)
  const [freightTerms, setFreightTermsState] = useState<string | null>(null)
  const freightTouched = useRef(false)
  const creating = busyId !== null

  function setFreightTerms(v: string | null) { freightTouched.current = true; setFreightTermsState(v) }
  function onToggleAgent(on: boolean) {
    setAgentMode(on)
    if (on) { freightTouched.current = false; setFreightTermsState(defaultFreightTerms(draft.movement_type)) }
    invalidate()
  }
  function onPartySelect(pty: Party | null) {
    setParty(pty)
    setCustomer(pty && pty.isCustomer ? pty : null)
    const isAgent = !!pty?.isAgent
    setAgentMode(isAgent)
    setAgent(isAgent && pty ? { agentId: pty.agentId ?? '', name: pty.name, erpAccountCode: pty.account_id, country: pty.country ?? null } : null)
    if (isAgent) { freightTouched.current = false; setFreightTermsState(defaultFreightTerms(draft.movement_type)) }
    // Addresses never auto-fill for agents.
    const addr = pty && pty.isCustomer && !isAgent ? formatCustomerAddress(pty) : ''
    if (addr) {
      if (draft.movement_type === 'import') patch({ drop_address: addr })
      else patch({ pickup_address: addr })
    } else {
      invalidate()
    }
  }
  // Agent nomination: freight terms follow direction until the user overrides them.
  useEffect(() => {
    if (agentMode && !freightTouched.current) setFreightTermsState(defaultFreightTerms(draft.movement_type))
  }, [agentMode, draft.movement_type])

  // Any change to the request invalidates a prior search.
  function invalidate() { setSearched(false); setOptions([]); setLclOptions([]); setAirOptions([]) }
  function patch(p: Partial<QuoteDraft>) {
    setDraft((d) => ({ ...d, ...p }))
    invalidate()
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
    if (!draft.from_port_code || !draft.to_port_code) return false
    if (draft.shipment_type === 'LCL') return wmNum > 0
    return true
  }, [customer, draft.from_port_code, draft.to_port_code, draft.shipment_type, wmNum])

  const airSummary = useMemo(() => {
    let gross = 0, cbm = 0, pcs = 0
    for (const l of airLines) { const c = computeCargoLine(l, 'air'); gross += c.grossTotal; cbm += c.totalCbm; pcs += Number(l.quantity) || 0 }
    const chargeable = Math.ceil(Math.max(gross, cbm * 167) * 2) / 2
    return { gross: Math.round(gross * 10) / 10, cbm: Math.round(cbm * 1000) / 1000, chargeable, pcs }
  }, [airLines])
  const airLoadsSummary = airSummary.chargeable > 0
    ? `${airSummary.pcs || '—'} pc${airSummary.pcs === 1 ? '' : 's'} · ${airSummary.gross.toFixed(1)} kg · ${airSummary.chargeable.toFixed(1)} kg chargeable`
    : 'Add cargo'

  // Overseas-office legs whose local charges aren't in the system yet — surfaced as a
  // tip so the quoter can request them from that UBF office. Shown regardless of who
  // pays; the card decides who pays and what's included.
  const officeTips = useMemo(() => {
    if (draft.shipment_type !== 'FCL' || options.length === 0) return [] as { office: string; leg: 'origin' | 'dest'; port: string }[]
    const tips: { office: string; leg: 'origin' | 'dest'; port: string }[] = []
    const check = (leg: 'origin' | 'dest', port: string | null | undefined) => {
      if (!port) return
      const office = overseasOfficeForPort(port)
      if (!office) return
      if (!options.some((o) => o.localCharges.some((c) => c.group === leg))) tips.push({ office, leg, port })
    }
    check('origin', draft.from_port_code)
    check('dest', draft.to_port_code)
    return tips
  }, [draft.shipment_type, draft.from_port_code, draft.to_port_code, options])

  function requestOfficeRates(office: string, leg: 'origin' | 'dest') {
    toast(`We'll request ${leg === 'dest' ? 'destination' : 'origin'} charges from ${office} — the Request Rates step is coming next.`)
  }

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
        let gross = 0, cbm = 0
        for (const l of airLines) { const c = computeCargoLine(l, 'air'); gross += c.grossTotal; cbm += c.totalCbm }
        const chargeableKg = Math.ceil(Math.max(gross, cbm * 167) * 2) / 2
        setOptions([]); setLclOptions([])
        setAirOptions(await searchAirRates({
          from_port_code: draft.from_port_code ?? null,
          to_port_code: draft.to_port_code ?? null,
          currency: null,
          chargeableKg,
          grossKg: Math.round(gross * 100) / 100,
          cbm: Math.round(cbm * 1000) / 1000,
          movement: draft.movement_type ?? null,
          incoterm: draft.incoterms ?? null,
          hasPickup: !!draft.pickup_address,
          hasDelivery: !!draft.drop_address,
        }))
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
      setOptions([]); setLclOptions([]); setAirOptions([])
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
        service_type: draft.service_type ?? serviceTypeForIncoterm(draft.incoterms),
        customer_account_id: customer.account_id,
        customer_name: customer.name,
      }
      const { id } = await createQuote(payload)
      if (draft.shipment_type === 'FCL') await replaceQuoteContainers(id, groups)
      if (isAir) { await updateQuote(id, { cargo_entry_mode: airMode }); await saveQuoteCargo(id, airLines, 'air') }
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
        movement: draft.movement_type ?? null,
        incoterm: draft.incoterms ?? null,
      })
      toast.success('Quote created with LCL buy rates')
      navigate(`/quotes/${quoteId}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create quote')
      setBusyId(null)
    }
  }

  async function handleCreateAir(o: AirRateOption, selectedKeys?: string[]) {
    if (!customer || !draft.from_port_code || !draft.to_port_code) return
    setBusyId(o.cardId)
    try {
      const { quoteId } = await createQuoteWithAirBuyRates({
        customerAccountId: customer.account_id,
        customerName: customer.name,
        fromPortCode: draft.from_port_code,
        toPortCode: draft.to_port_code,
        incoterm: draft.incoterms ?? null,
        movement: draft.movement_type ?? null,
        cargoEntryMode: airMode,
        cargoLines: airLines,
        option: o,
        selectedKeys,
        agentId: agent?.agentId ?? null,
        agentName: agent?.name ?? null,
        freightTerms,
      })
      toast.success('Quote created with air buy rates')
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

        <div className="nqs-customer">
          <PartySearch value={party} agentMode={agentMode} onSelect={onPartySelect} onToggleAgent={onToggleAgent} />
        </div>
        {draft.from_port_code && draft.to_port_code && (
          <FreightIntelligence
            from={draft.from_port_code}
            to={draft.to_port_code}
            mode={isAir ? 'air' : 'sea'}
            direction={draft.movement_type ?? null}
            incoterm={draft.incoterms ?? null}
          />
        )}

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
            <button type="button" className="nqs-loads-btn" onClick={() => setLoadsOpen((v) => !v)}>
              <Boxes size={16} color="#64748b" />
              <span>
                <span className="nqs-loads-btn__label" style={{ display: 'block' }}>Loads</span>
                <span className="nqs-loads-btn__val">{airLoadsSummary}</span>
              </span>
              <span style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {draft.movement_type && <span style={termChip}>{draft.movement_type === 'import' ? 'Import' : 'Export'}</span>}
                {draft.incoterms && <span style={termChip}>{draft.incoterms}</span>}
              </span>
              <ChevronDown size={15} color="#94a3b8" style={{ transform: loadsOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
            </button>
          ) : (
            <button type="button" className="nqs-loads-btn" onClick={() => setLoadsOpen((v) => !v)}>
              <ContainerIcon size={16} color="#64748b" />
              <span>
                <span className="nqs-loads-btn__label" style={{ display: 'block' }}>Loads</span>
                <span className="nqs-loads-btn__val">{loadsSummary(groups)}</span>
              </span>
              <span style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {draft.movement_type && <span style={termChip}>{draft.movement_type === 'import' ? 'Import' : 'Export'}</span>}
                {draft.incoterms && <span style={termChip}>{draft.incoterms}</span>}
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
            movement={draft.movement_type ?? ''}
            onMovementChange={(v) => patch({ movement_type: v || null })}
            originAddress={draft.pickup_address ?? ''}
            onOriginAddressChange={(v) => patch({ pickup_address: v || null })}
            deliveryAddress={draft.drop_address ?? ''}
            onDeliveryAddressChange={(v) => patch({ drop_address: v || null })}
            lines={airLines}
            entryMode={airMode}
            onEntryModeChange={setAirMode}
            agentMode={agentMode}
            freightTerms={freightTerms ?? ''}
            onFreightTermsChange={(v) => { setFreightTerms(v); invalidate() }}
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
            ) : (isAir ? airOptions.length : isLcl ? lclOptions.length : options.length) > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="text-muted-foreground" style={{ fontSize: 12 }}>{(isAir ? airOptions.length : isLcl ? lclOptions.length : options.length)} rate{(isAir ? airOptions.length : isLcl ? lclOptions.length : options.length) === 1 ? '' : 's'} for {draft.from_port_code} → {draft.to_port_code}</span>
                  <button type="button" className="btn btn--inline" style={{ marginTop: 0, background: 'transparent', color: 'var(--color-ink)', border: '1px solid var(--color-line)' }} disabled={creating} onClick={() => handleCreate()}>
                    {busyId === '__plain__' ? 'Creating…' : 'Create without a rate'}
                  </button>
                </div>
                {isAir
                  ? airOptions.map((o) => (
                      <AirRateOptionCard key={o.cardId} option={o} fromCode={draft.from_port_code ?? ''} toCode={draft.to_port_code ?? ''} onUse={(keys) => handleCreateAir(o, keys)} busy={busyId === o.cardId} fxRates={fxRates} incoterm={draft.incoterms ?? ''} movement={draft.movement_type ?? ''} isAgent={agentMode} freightTerms={freightTerms ?? ''} />
                    ))
                  : isLcl
                  ? lclOptions.map((o) => (
                      <LclRateOptionCard key={o.cardId} option={o} fromCode={draft.from_port_code ?? ''} toCode={draft.to_port_code ?? ''} onUse={() => handleCreateLcl(o)} busy={busyId === o.cardId} />
                    ))
                  : options.map((o) => (
                      <RateOptionCard key={o.cardId} option={o} fromCode={draft.from_port_code ?? ''} toCode={draft.to_port_code ?? ''} onUse={(sel) => handleCreate(sel)} busy={busyId === o.cardId} fxRates={fxRates} containers={groups.map((g) => ({ size: g.container_size, qty: g.qty }))} incoterm={draft.incoterms ?? ''} movement={draft.movement_type ?? ''} />
                    ))}
                {officeTips.length > 0 && (
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {officeTips.map((t) => (
                      <div key={t.leg} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: '#1e40af', display: 'inline-flex', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 220 }}>
                          <Info size={15} style={{ marginTop: 1, flexShrink: 0 }} />
                          <span>
                            {t.leg === 'dest' ? 'Container delivery & customs clearance at destination' : 'Origin haulage & customs clearance'} ({t.port}) are handled by <strong>{t.office}</strong> and aren’t in the system yet. You can request them from the team on the next step.
                          </span>
                        </span>
                        <button type="button" onClick={() => requestOfficeRates(t.office, t.leg)}
                          style={{ fontSize: 12, fontWeight: 600, color: '#1d4ed8', background: '#fff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          Request from {t.office}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="nqs-results__empty">
                <div className="nqs-results__icon"><Zap size={20} /></div>
                <div className="nqs-results__title">No live rates for this lane</div>
                <div className="nqs-results__text">{isAir
                  ? `No active air rate card matches ${draft.from_port_code} → ${draft.to_port_code} for this cargo. Create the quote and add a priced response manually.`
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
