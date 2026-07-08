import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export default class EmailSourceErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[EmailSourcePanel]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <aside className="bf-email-panel">
          <p className="muted" style={{ padding: '12px 14px', margin: 0, fontSize: 12 }}>
            Source email panel failed to load. The booking form is unaffected.
          </p>
        </aside>
      )
    }
    return this.props.children
  }
}
