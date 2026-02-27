import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App } from "./app/App"
import { ErrorBoundary } from "./ui/ErrorBoundary"

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  autoFocus: true,
  useMouse: true,
})

createRoot(renderer).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
