import { useEffect } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import ImportSeaBoardPage from '@/features/importSea/ImportSeaBoardPage'
import BookingsPage from '@/pages/BookingsPage'
import { useStaffPref } from '@/hooks/useStaffPref'
import './bookingsTheme.css'
import BookingModeTabs from './BookingModeTabs'
import { WORKSPACE_SLUGS, modeBySlug, type WorkspaceSlug } from './bookingModes'
import { useBookingModeCounts } from './useBookingModeCounts'

type Props = { slug?: WorkspaceSlug }

/**
 * Unified Bookings workspace. One header + mode switcher; each mode mounts its board.
 * Import Sea mounts the existing ImportSeaBoardPage unchanged.
 */
export default function BookingsWorkspacePage({ slug: slugProp }: Props) {
  const params = useParams()
  const slug = slugProp ?? (params.mode as WorkspaceSlug | undefined)
  const [lastSlug, setLastSlug] = useStaffPref<WorkspaceSlug>('bookings.mode', 'import-sea', WORKSPACE_SLUGS)
  const mode = modeBySlug(slug)
  const counts = useBookingModeCounts()

  useEffect(() => {
    if (mode && mode.slug !== lastSlug) setLastSlug(mode.slug)
  }, [mode, lastSlug, setLastSlug])

  if (!mode) return <Navigate to={`/bookings/${lastSlug}`} replace />

  return (
    <div className="bk-root">
      <header className="bk-head">
        <BookingModeTabs counts={counts} />
      </header>
      {mode.module === 'IS' ? <ImportSeaBoardPage /> : <BookingsPage module={mode.module} embedded />}
    </div>
  )
}
