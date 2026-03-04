import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App } from "./app/App"
import { ErrorBoundary } from "./ui/ErrorBoundary"
import { setRenderer } from "@/core/renderer-ref"

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  autoFocus: true,
  useMouse: true,
  enableMouseMovement: true,
})
setRenderer(renderer)

createRoot(renderer).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
