import React, { createElement } from "react"

interface Props {
  children: React.ReactNode
}

interface State {
  error: Error | null
}

class ErrorBoundaryImpl extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error)
    if (info.componentStack) {
      console.error("[ErrorBoundary] Component stack:", info.componentStack)
    }
  }

  render() {
    if (this.state.error) {
      return (
        <box width="100%" height="100%" flexDirection="column" justifyContent="center" alignItems="center" backgroundColor="#1a1b26">
          <text><span fg="#f7768e"><strong>kIRC crashed</strong></span></text>
          <text><span fg="#a9b1d6">{this.state.error.message}</span></text>
          <text><span fg="#565f89">Check console for details. Press Ctrl+C to exit.</span></text>
        </box>
      )
    }
    return this.props.children
  }
}

/** Error boundary wrapper — uses createElement to bypass OpenTUI's JSX class component types. */
export function ErrorBoundary({ children }: Props): React.ReactNode {
  return createElement(ErrorBoundaryImpl, null, children)
}
