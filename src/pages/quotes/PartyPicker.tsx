import { useEffect, useState } from 'react'
import { Check, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import AddressAutocomplete, { type AddressComponents } from '../../components/bookings/AddressAutocomplete'
import { useCustomerSearch, type CustomerPickerValue } from '../../hooks/useBookings'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { createSavedParty, searchSavedParties, type SavedParty } from './savedPartiesApi'
import './partyPicker.css'

type Props = {
  kind: 'shipper' | 'consignee'
  name: string
  address?: string
  onPick: (v: { name: string; address: string }) => void
  onNameChange: (name: string) => void
}

function composeAddress(c: CustomerPickerValue): string {
  return [
    c.address1,
    c.address2,
    c.address3,
    c.city,
    [c.state, c.postcode].filter(Boolean).join(' '),
    c.country,
  ].filter(Boolean).join(', ')
}

const emptyComponents = (): AddressComponents => ({})

export default function PartyPicker({ kind, name, address = '', onPick, onNameChange }: Props) {
  const [focused, setFocused] = useState(false)
  const [linked, setLinked] = useState(false)
  const [savedFlag, setSavedFlag] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [savedHits, setSavedHits] = useState<SavedParty[]>([])
  const [savedLoading, setSavedLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dlgName, setDlgName] = useState('')
  const [contact, setContact] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [addr, setAddr] = useState('')
  const [components, setComponents] = useState<AddressComponents>(emptyComponents())
  const debounced = useDebouncedValue(name, 300)
  const { data: customers, loading: customersLoading } = useCustomerSearch(debounced)

  useEffect(() => {
    const q = debounced.trim()
    if (q.length < 2) {
      setSavedHits([])
      setSavedLoading(false)
      return
    }
    let cancelled = false
    setSavedLoading(true)
    searchSavedParties(kind, q)
      .then((rows) => { if (!cancelled) setSavedHits(rows) })
      .catch(() => { if (!cancelled) setSavedHits([]) })
      .finally(() => { if (!cancelled) setSavedLoading(false) })
    return () => { cancelled = true }
  }, [kind, debounced])

  useEffect(() => {
    if (!dialogOpen) return
    setDlgName(name)
    setContact('')
    setPhone('')
    setEmail('')
    setAddr(address)
    setComponents(emptyComponents())
  }, [dialogOpen, name, address])

  const term = name.trim()
  const showMenu = focused && term.length >= 2
  const kindLabel = kind.charAt(0).toUpperCase() + kind.slice(1)

  function handleNameChange(v: string) {
    onNameChange(v)
    setLinked(false)
    setSavedFlag(false)
  }

  function pickCustomer(c: CustomerPickerValue) {
    onPick({ name: c.name, address: composeAddress(c) })
    setLinked(true)
    setFocused(false)
  }

  function pickSaved(p: SavedParty) {
    onPick({ name: p.name, address: p.address ?? '' })
    setLinked(true)
    setFocused(false)
  }

  async function handleSaveParty() {
    setSaving(true)
    try {
      await createSavedParty({
        kind,
        name: dlgName.trim(),
        contact: contact.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: addr.trim() || null,
        city: components.city ?? null,
        state: components.state ?? null,
        postcode: components.postcode ?? null,
        country: components.country ?? null,
        account_id: null,
      })
      setSavedFlag(true)
      setLinked(true)
      setDialogOpen(false)
      onPick({ name: dlgName.trim(), address: addr })
      toast.success(`${kindLabel} saved`)
    } catch {
      toast.error('Could not save contact')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="party-picker">
      <div className="party-picker__wrap">
        <input
          className="nqd-input party-picker__input"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
        />
        {savedFlag ? (
          <Check size={16} className="party-picker__saved" aria-label="Saved party" />
        ) : name.trim() && !linked ? (
          <button
            type="button"
            className="party-picker__save"
            title="Save contact"
            aria-label="Save contact"
            onClick={() => setDialogOpen(true)}
          >
            <Save size={16} />
          </button>
        ) : null}
      </div>

      {showMenu && (
        <ul className="party-picker__menu" role="listbox">
          <li className="party-picker__group" aria-hidden>Customers</li>
          {customersLoading ? (
            <li className="party-picker__empty">Searching…</li>
          ) : customers.length === 0 ? (
            <li className="party-picker__empty">No customers</li>
          ) : (
            customers.map((c) => (
              <li key={c.account_id} role="option">
                <button
                  type="button"
                  className="party-picker__option"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickCustomer(c)}
                >
                  <span className="party-picker__name">{c.name}</span>
                  <span className="party-picker__meta mono">{c.account_id}</span>
                </button>
              </li>
            ))
          )}
          <li className="party-picker__group" aria-hidden>Saved</li>
          {savedLoading ? (
            <li className="party-picker__empty">Searching…</li>
          ) : savedHits.length === 0 ? (
            <li className="party-picker__empty">No saved parties</li>
          ) : (
            savedHits.map((p) => (
              <li key={p.id} role="option">
                <button
                  type="button"
                  className="party-picker__option"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSaved(p)}
                >
                  <span className="party-picker__name">{p.name}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Save {kindLabel}</DialogTitle>
          </DialogHeader>
          <div className="party-picker__dialog">
            <label className="party-picker__field">
              <span className="party-picker__label">Name</span>
              <input className="nqd-input" value={dlgName} onChange={(e) => setDlgName(e.target.value)} />
            </label>
            <label className="party-picker__field">
              <span className="party-picker__label">Point of contact</span>
              <input className="nqd-input" value={contact} onChange={(e) => setContact(e.target.value)} />
            </label>
            <label className="party-picker__field">
              <span className="party-picker__label">Phone</span>
              <input className="nqd-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className="party-picker__field">
              <span className="party-picker__label">Email</span>
              <input className="nqd-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <AddressAutocomplete
              label="Address"
              value={addr}
              usePlaces
              onChange={(a, comp) => {
                setAddr(a)
                if (comp) setComponents(comp)
              }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="button" disabled={saving || !dlgName.trim()} onClick={handleSaveParty}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
