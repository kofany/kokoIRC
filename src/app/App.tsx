import { useRenderer, useKeyboard } from "@opentui/react"

export function App() {
  const renderer = useRenderer()

  useKeyboard((key) => {
    if (key.name === "q" && key.ctrl) {
      renderer.destroy()
    }
  })

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      border
      borderStyle="rounded"
      title="OpenTUI IRC"
      titleAlignment="center"
    >
      <box flexGrow={1} justifyContent="center" alignItems="center">
        <text>
          <span fg="#7aa2f7">OpenTUI IRC</span> — press <strong>Ctrl+Q</strong> to exit
        </text>
      </box>
    </box>
  )
}
