import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, Package, Plane, Container as ContainerIcon, ChevronDown, Search } from 'lucide-react'
import CustomerPicker, { type CustomerPickerValue } from '../../components/bookings/CustomerPicker'
import ContainerGroupsEditor from './ContainerGroupsEditor'
import QuoteOriginDestField from './QuoteOriginDestField'
import { emptyQuoteDraft, type QuoteDraft } from './quotesApi'
import { emptyContainerGroup, type QuoteContainerDraft } from './quoteContainersApi'
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

  function patch(p: Partial<QuoteDraft>) {
    setDraft((d) => ({ ...d, ...p }))
  }

  const canSearch = useMemo(
    () => Boolean(customer && draft.from_port_code && draft.to_port_code),
    [customer, draft.from_port_code, draft.to_port_code],
  )

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
          <CustomerPicker label="Customer" required value={customer} onChange={setCustomer} />
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
            onClick={() => { /* Step 5 wires search → create quote */ }}
          >
            <Search size={16} /> Search
          </button>
        </div>

        {loadsOpen && (
          <ContainerGroupsEditor
            groups={groups}
            onChange={setGroups}
            onApply={() => setLoadsOpen(false)}
            onCancel={() => setLoadsOpen(false)}
          />
        )}
      </div>
    </div>
  )
}
