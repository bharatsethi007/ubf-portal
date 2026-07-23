import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Props = {
  children: ReactNode
  backHref?: string
}

type State = {
  error: Error | null
}

export default class BookingRecordErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[BookingRecord]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      const back = this.props.backHref ?? '/bookings/import-sea'
      return (
        <div className="detail-page booking-record-page">
          <Link to={back} className="detail-back booking-record-back">
            ← Back to Import Sea board
          </Link>
          <div className="empty card booking-record-error">
            <h2>Booking record failed to render</h2>
            <p className="booking-record-error__message">{this.state.error.message}</p>
            {this.state.error.stack ? (
              <pre className="mono muted booking-record-error__stack">{this.state.error.stack}</pre>
            ) : null}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
