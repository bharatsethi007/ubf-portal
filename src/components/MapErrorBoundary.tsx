import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }

type State = { hasError: boolean }

export function RouteUnavailableFallback({ reason }: { reason?: string }) {
  return (
    <div className="route-map route-map--empty">
      <p className="empty-state__title">Route unavailable</p>
      <p className="empty-state__detail muted">
        {reason ?? 'The route map could not be loaded for this shipment.'}
      </p>
    </div>
  )
}

export default class MapErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[RouteMap]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) return <RouteUnavailableFallback />
    return this.props.children
  }
}
