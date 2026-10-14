import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/supabase'
import type { CustomerPickerValue } from '@/components/bookings/CustomerPicker'
import { useDebouncedAutosave } from '@/hooks/useDebouncedAutosave'
import { fetchQuote, updateQuote, setQuoteStatus, type QuoteRecord } from '../quotesApi'
import {
  fetchQuoteContainers, replaceQuoteContainers, emptyContainerGroup, type QuoteContainerDraft,
} from '../quoteContainersApi'
import { fetchQuoteCargo, saveQuoteCargo, newQuoteCargoLine, computeCargoLine, type QuoteCargoLine } from '../quoteCargoApi'
import type { CargoEntryMode } from '../QuoteCargoEntry'
import type { LostInfo } from '../quoteLostReasons'
import { modeOf } from './quoteMode'

export type Fields = {
  movement_type: string | null; shipping_line: string | null; service_type: string | null
  incoterms: string | null; customer_po: string | null
  shipper: string | null; consignee: string | null; shipper_address: string | null; consignee_address: string | null
  sales_executive_id: string | null; pricing_executive_id: string | null
  internal_notes: string | null; external_notes: string | null
}
export type Cargo = {
  cargo_value: number | null; cargo_value_currency: string | null
  need_insurance: boolean; need_refrigeration: boolean; reefer_temp_c: number | null
  is_hazardous: boolean; dg_un_number: string | null; dg_class: string | null; stackable: boolean
}

const pickFields = (q: QuoteRecord): Fields => ({
  movement_type: q.movement_type, incoterms: q.incoterms, customer_po: q.customer_po,
  shipping_line: q.shipping_line, service_type: q.service_type, shipper: q.shipper, consignee: q.consignee,
  shipper_address: q.shipper_address, consignee_address: q.consignee_address,
  sales_executive_id: q.sales_executive_id, pricing_executive_id: q.pricing_executive_id,
  internal_notes: q.internal_notes, external_notes: q.external_notes,
})
const pickCargo = (q: QuoteRecord): Cargo => ({
  cargo_value: q.cargo_value, cargo_value_currency: q.cargo_value_currency ?? 'NZD',
  need_insurance: q.need_insurance, need_refrigeration: q.need_refrigeration, reefer_temp_c: q.reefer_temp_c,
  is_hazardous: q.is_hazardous, dg_un_number: q.dg_un_number, dg_class: q.dg_class, stackable: q.stackable === 'true',
})

async function fetchCustomerPick(accountId: string): Promise<CustomerPickerValue | null> {
  const { data } = await supabase.from('customers')
    .select('account_id,name,address1,address2,address3,city,state,postcode,country').eq('account_id', accountId).maybeSingle()
  if (!data) return null
  const o = data as Record<string, string | null>
  const v = (k: string) => o[k] ?? undefined
  return { account_id: String(o.account_id), name: String(o.name ?? ''), address1: v('address1'), address2: v('address2'),
    address3: v('address3'), city: v('city'), state: v('state'), postcode: v('postcode'), country: v('country') }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** All quote record state: load, local edits, debounced autosave, status changes. */
export function useQuoteDetail(id: string | undefined) {
  const [quote, setQuote] = useState<QuoteRecord | null>(null)
  const [status, setStatus] = useState('open')
  const [fields, setFields] = useState<Fields | null>(null)
  const [initial, setInitial] = useState<Fields | null>(null)
  const [cargo, setCargo] = useState<Cargo | null>(null)
  const [initialCargo, setInitialCargo] = useState<Cargo | null>(null)
  const [groups, setGroups] = useState<QuoteContainerDraft[]>([])
  const [initialGroups, setInitialGroups] = useState<QuoteContainerDraft[]>([])
  const [cargoLines, setCargoLines] = useState<QuoteCargoLine[]>([])
  const [initialCargoLines, setInitialCargoLines] = useState<QuoteCargoLine[]>([])
  const [cargoMode, setCargoMode] = useState<CargoEntryMode>('individual')
  const [initialCargoMode, setInitialCargoMode] = useState<CargoEntryMode>('individual')
  const [customerPick, setCustomerPick] = useState<CustomerPickerValue | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusBusy, setStatusBusy] = useState(false)

  const load = useCallback(async (quiet = false) => {
    if (!id) return
    if (!quiet) setLoading(true)
    try {
      const [q, cons] = await Promise.all([fetchQuote(id), fetchQuoteContainers(id)])
      if (!q) { setQuote(null); return }
      const g = cons.map((c) => ({ ord: c.ord, container_size: c.container_size, container_type: c.container_type,
        qty: c.qty, weight_per_container_mt: c.weight_per_container_mt, commodity: c.commodity }))
      let cl: QuoteCargoLine[] = []
      if (modeOf(q.shipment_type, q.shipment_mode) !== 'FCL') {
        const fetched = await fetchQuoteCargo(id)
        cl = fetched.length ? fetched : [newQuoteCargoLine(0)]
      }
      // Addresses are never auto-filled. The customer is offered in the "From CF" picker instead.
      setCustomerPick(q.customer_account_id ? await fetchCustomerPick(q.customer_account_id) : null)
      const em: CargoEntryMode = q.cargo_entry_mode === 'total' ? 'total' : 'individual'
      setQuote(q); setStatus(q.status)
      setFields(pickFields(q)); setInitial(pickFields(q))
      setCargo(pickCargo(q)); setInitialCargo(pickCargo(q))
      setGroups(g); setInitialGroups(g)
      setCargoLines(cl); setInitialCargoLines(cl)
      setCargoMode(em); setInitialCargoMode(em)
    } catch {
      toast.error('Failed to load quote'); setQuote(null)
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { void load() }, [load])

  const mode = modeOf(quote?.shipment_type ?? null, quote?.shipment_mode ?? null)
  const isAir = mode === 'Air'
  const usesCargoLines = mode !== 'FCL'

  const dirty = Boolean(fields && initial && !same(fields, initial))
  const cargoDirty = Boolean(cargo && initialCargo && !same(cargo, initialCargo))
  const loadsDirty = usesCargoLines
    ? !same(cargoLines, initialCargoLines) || cargoMode !== initialCargoMode
    : !same(groups, initialGroups)

  async function saveFields() { if (id && fields) { await updateQuote(id, fields); setInitial(fields) } }
  async function saveCargo() {
    if (!id || !cargo) return
    await updateQuote(id, { ...cargo, stackable: cargo.stackable ? 'true' : 'false' }); setInitialCargo(cargo)
  }
  async function saveLoads() {
    if (!id) return
    if (usesCargoLines) {
      await saveQuoteCargo(id, cargoLines, isAir ? 'air' : 'sea')
      await updateQuote(id, { cargo_entry_mode: cargoMode })
      setInitialCargoLines(cargoLines); setInitialCargoMode(cargoMode)
    } else { await replaceQuoteContainers(id, groups); setInitialGroups(groups) }
  }

  const saveState = useDebouncedAutosave([
    { key: 'fields', dirty: !loading && dirty, signature: JSON.stringify(fields), save: saveFields },
    { key: 'cargo', dirty: !loading && cargoDirty, signature: JSON.stringify(cargo), save: saveCargo },
    { key: 'loads', dirty: !loading && loadsDirty,
      signature: JSON.stringify(usesCargoLines ? { cargoLines, cargoMode } : { groups }), save: saveLoads },
  ])
  const pending = dirty || cargoDirty || loadsDirty || saveState === 'saving'

  const cargoSize = useMemo(() => {
    if (usesCargoLines) {
      let w = 0, v = 0
      for (const l of cargoLines) { const c = computeCargoLine(l, isAir ? 'air' : 'sea'); w += c.grossTotal; v += c.totalCbm }
      return { w: w || null, v: v || null }
    }
    const w = groups.reduce((s, g) => s + (g.qty || 0) * (g.weight_per_container_mt || 0) * 1000, 0)
    return { w: w || null, v: null }
  }, [usesCargoLines, cargoLines, groups, isAir])

  const patch = (p: Partial<Fields>) => setFields((f) => (f ? { ...f, ...p } : f))
  const patchCargo = (p: Partial<Cargo>) => setCargo((c) => (c ? { ...c, ...p } : c))
  const patchQuote = (p: Partial<QuoteRecord>) => setQuote((q) => (q ? { ...q, ...p } : q))

  function setDirection(v: string) {
    setFields((f) => {
      if (!f) return f
      const next: Fields = { ...f, movement_type: v || null }
      const cust = quote?.customer_name ?? null
      if (v === 'export' && !f.shipper && cust) next.shipper = cust
      if (v === 'import' && !f.consignee && cust) next.consignee = cust
      return next
    })
  }

  async function changeCustomer(v: CustomerPickerValue | null) {
    if (!v || !id) return
    try {
      const p = { customer_account_id: v.account_id, customer_name: v.name, contact_name: null, contact_email: null, contact_phone: null }
      await updateQuote(id, p); patchQuote(p)
      setCustomerPick(await fetchCustomerPick(v.account_id))
      toast.success('Customer updated')
    } catch { toast.error('Failed to update customer') }
  }

  async function savePort(which: 'from' | 'to', code: string) {
    if (!id) return
    const p = which === 'from' ? { from_port_code: code || null } : { to_port_code: code || null }
    try { await updateQuote(id, p); patchQuote(p) } catch { toast.error('Failed to update port') }
  }

  async function mark(next: string, lost?: LostInfo) {
    if (!id) return false
    setStatusBusy(true)
    try {
      await setQuoteStatus(id, next, lost); setStatus(next)
      toast.success(`Marked ${next === 'crosswin' ? 'cross win' : next}`)
      return true
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to update status'); return false }
    finally { setStatusBusy(false) }
  }

  const containers = {
    patch: (i: number, p: Partial<QuoteContainerDraft>) => setGroups((gs) => gs.map((g, j) => (j === i ? { ...g, ...p } : g))),
    add: () => setGroups((gs) => [...gs, emptyContainerGroup(gs.length)]),
    remove: (i: number) => setGroups((gs) => gs.filter((_, j) => j !== i)),
  }
  const addCargoLine = () => setCargoLines((ls) => [...ls, newQuoteCargoLine(ls.length)])

  return {
    quote, status, fields, cargo, groups, cargoLines, cargoMode, customerPick, loading, statusBusy,
    mode, isAir, usesCargoLines, saveState, pending, cargoSize,
    reload: () => load(true), patch, patchCargo, patchQuote, setDirection, changeCustomer, savePort, mark,
    containers, setCargoLines, setCargoMode, addCargoLine,
  }
}
