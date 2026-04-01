import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    // Surface to console for debugging without crashing the UI.
    // eslint-disable-next-line no-console
    console.error(error)
  }

  render() {
    const { error } = this.state
    if (error) {
      return (
        <div style={{ padding: 16 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>This section crashed.</div>
          <div style={{ opacity: 0.8, marginBottom: 10, lineHeight: 1.5 }}>
            Copy/paste this error to fix it:
          </div>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              background: 'rgba(0,0,0,0.04)',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 12,
              padding: 12,
              fontSize: 12,
              overflow: 'auto',
              maxHeight: 260,
            }}
          >
            {String(error?.message ?? error)}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

