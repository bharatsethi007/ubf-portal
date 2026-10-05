import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '@/supabase'
import type { BookingRecord, BookingRecordPatch } from '../bookingRecordTypes'
import ContainerDatesTable from './ContainerDatesTable'
import CustomerTaskList from './CustomerTaskList'
import PushTaskDialog from './PushTaskDialog'
import { useCustomerTasks } from './useCustomerTasks'

type Props = {
  booking: BookingRecord
  onPatch: (ui: Partial<BookingRecord>, db: BookingRecordPatch) => void | Promise<void>
}

const head = { fontSize: 13, fontWeight: 600, color: '#0A2472', margin: 0 } as const

export default function CustomerTasksCard({ booking, onPatch }: Props) {
  const { tasks, dates, loading, reload, push, cancel, reopen } = useCustomerTasks(booking.id)
  const [open, setOpen] = useState(false)
  const [days, setDays] = useState<string>(booking.detention_free_days != null ? String(booking.detention_free_days) : '')

  useEffect(() => {
    setDays(booking.detention_free_days != null ? String(booking.detention_free_days) : '')
  }, [booking.detention_free_days])

  // Tasks only reach customers who can log in to the portal.
  const acct = booking.importer_account_id ?? booking.account_id ?? booking.consignee_account_id
  const [onPortal, setOnPortal] = useState<boolean | null>(null)
  useEffect(() => {
    if (!acct) { setOnPortal(false); return }
    void supabase.from('portal_users').select('user_id', { count: 'exact', head: true }).eq('account_id', acct).eq('status', 'active')
      .then(({ count }) => setOnPortal((count ?? 0) > 0))
  }, [acct])

  const containers = useMemo(() => dates.map((d) => d.container_no), [dates])
  const openCount = tasks.filter((t) => t.status === 'open').length

  async function saveDays() {
    const v = days.trim() === '' ? null : Math.max(0, Math.min(60, Math.round(Number(days))))
    if (v !== null && Number.isNaN(v)) return
    if (v === (booking.detention_free_days ?? null)) return
    await Promise.resolve(onPatch({ detention_free_days: v }, { detention_free_days: v }))
    await reload()
  }

  return (
    <section className="card" style={{ marginTop: 16, padding: 16, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="btn quotes-page__new-btn"
            title="Send task to customer"
            aria-label="Send task to customer"
            onClick={() => setOpen(true)}
            disabled={onPortal === false}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 30, padding: 0, opacity: onPortal === false ? 0.4 : 1 }}
          >
            <Plus size={15} />
          </button>
          <h3 style={head}>Customer tasks{openCount ? ` (${openCount} open)` : ''}</h3>
          {onPortal === false ? (
            <span style={{ fontSize: 11, color: '#B54708', background: '#FEF4E6', borderRadius: 10, padding: '1px 8px' }}>
              Customer has no portal login, tasks can't be sent
            </span>
          ) : null}
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }} title="Blank uses shipping line default">
          <span className="text-muted-foreground">Detention free days</span>
          <input
            className="input input--sm"
            type="number"
            min={0}
            max={60}
            placeholder="Line"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            onBlur={() => void saveDays()}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            style={{ width: 64 }}
          />
        </label>
      </div>

      {loading ? (
        <p className="text-muted-foreground" style={{ fontSize: 12 }}>Loading…</p>
      ) : (
        <>
          <ContainerDatesTable rows={dates} />
          <div style={{ marginTop: 12 }}>
            <CustomerTaskList tasks={tasks} onCancel={(id) => void cancel(id)} onReopen={(id) => void reopen(id)} />
          </div>
        </>
      )}

      <PushTaskDialog open={open} onClose={() => setOpen(false)} containers={containers} onSend={push} />
    </section>
  )
}
