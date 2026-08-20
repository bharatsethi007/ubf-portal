import type { ViewMode } from './conferencesApi'
import { dayTabLabel } from './conferenceDays'

type Props = {
  conferenceId: string
  day: string
  dayIndex: number
  viewMode: ViewMode
  defaultMinutes: number
}

export default function ConferenceDaySchedule({
  conferenceId,
  day,
  dayIndex,
  viewMode,
  defaultMinutes,
}: Props) {
  void conferenceId
  void viewMode
  void defaultMinutes

  return (
    <div className="cp-card">
      <div className="cp-card-head">
        <h3 className="cp-card-title">Schedule — {dayTabLabel(day, dayIndex)}</h3>
      </div>
      <p className="text-muted-foreground pad-inline">
        Meetings for this day appear here (Step 4).
      </p>
    </div>
  )
}
