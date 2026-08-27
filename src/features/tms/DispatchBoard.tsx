import DispatchBoardView from './DispatchBoardView'
import DispatchKanban from './DispatchKanban'
import DispatchCalendar from './DispatchCalendar'

export type DispatchMode = 'board' | 'kanban' | 'calendar'

export default function DispatchBoard({ mode }: { mode: DispatchMode }) {
  return (
    <div>
      {mode === 'board' && <DispatchBoardView />}
      {mode === 'kanban' && <DispatchKanban />}
      {mode === 'calendar' && <DispatchCalendar />}
    </div>
  )
}
