import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Calendar,
  FileText,
  Plus,
  Receipt,
  Users,
} from 'lucide-react'

type Props = {
  title: string
  description: string
  icon: LucideIcon
}

export default function ComingSoon({ title, description, icon: Icon }: Props) {
  return (
    <div className="stub-page">
      <div className="coming-soon card">
        <div className="coming-soon__icon" aria-hidden="true">
          <Icon size={28} strokeWidth={1.75} />
        </div>
        <h1>{title}</h1>
        <span className="coming-badge">Coming soon</span>
        <p className="coming-soon__desc">{description}</p>
      </div>
    </div>
  )
}

export function NewBookingPage() {
  return (
    <ComingSoon
      title="New Booking"
      icon={Plus}
      description="Create and edit shipment bookings once the transactional backend is ready."
    />
  )
}

export function EstimatesPage() {
  return (
    <ComingSoon
      title="Estimates & Quotes"
      icon={FileText}
      description="Prepare freight estimates and customer quotes when pricing services are connected."
    />
  )
}

export function InvoicesPage() {
  return (
    <ComingSoon
      title="Invoices"
      icon={Receipt}
      description="Review and issue invoices after billing integration is available."
    />
  )
}

export function SchedulesPage() {
  return (
    <ComingSoon
      title="Schedules"
      icon={Calendar}
      description="Manage sailing schedules and cut-offs when schedule data is synced."
    />
  )
}

export function ReportsPage() {
  return (
    <ComingSoon
      title="Reports"
      icon={BarChart3}
      description="Run saved operational reports once the reporting backend is built."
    />
  )
}

export function UsersPage() {
  return (
    <ComingSoon
      title="Users"
      icon={Users}
      description="Administer staff accounts and permissions when user management is enabled."
    />
  )
}
