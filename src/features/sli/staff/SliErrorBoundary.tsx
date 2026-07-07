import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export default class SliErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[SliTab]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <p className="muted" style={{ padding: '12px 0' }}>
          SLI panel failed to load. The rest of the booking form is unaffected.
        </p>
      )
    }
    return this.props.children
  }
}
