import { useMemo } from "react"
import { useStore } from "@/core/state/store"

export function ImagePreview() {
  const preview = useStore((s) => s.imagePreview)
  const hideImagePreview = useStore((s) => s.hideImagePreview)
  const theme = useStore((s) => s.theme?.colors)

  const termCols = process.stdout.columns || 80
  const termRows = process.stdout.rows || 24

  const layout = useMemo(() => {
    if (!preview) return null
    const popupWidth = Math.max(preview.width, 20)
    const popupHeight = Math.max(preview.height, 5)
    const left = Math.max(0, Math.floor((termCols - popupWidth) / 2))
    const top = Math.max(0, Math.floor((termRows - popupHeight) / 2))
    return { popupWidth, popupHeight, left, top }
  }, [preview?.width, preview?.height, termCols, termRows])

  if (!preview || !layout) return null

  const bg = theme?.bg ?? "#1a1b26"
  const accent = theme?.accent ?? "#7aa2f7"
  const muted = theme?.fg_muted ?? "#565f89"

  const title = preview.title
    ? ` ${preview.title.slice(0, layout.popupWidth - 4)} `
    : " Preview "

  let statusText: React.ReactNode = null
  if (preview.status === "loading") {
    statusText = <text><span fg={muted}>Loading image...</span></text>
  } else if (preview.status === "error") {
    statusText = <text><span fg="#f7768e">{preview.error ?? "Error"}</span></text>
  }

  return (
    <>
      {/* Full-screen transparent backdrop — click anywhere to dismiss */}
      <box
        position="absolute"
        left={0}
        top={0}
        width="100%"
        height="100%"
        onMouseDown={() => hideImagePreview()}
      />
      {/* Centered popup */}
      <box
        position="absolute"
        left={layout.left}
        top={layout.top}
        width={layout.popupWidth}
        height={layout.popupHeight}
        border={["top", "bottom", "left", "right"]}
        borderStyle="single"
        borderColor={accent}
        backgroundColor={bg}
        onMouseDown={() => hideImagePreview()}
      >
        <box height={1} width="100%">
          <text>
            <span fg={accent}>{title}</span>
            <span fg={muted}> [click/key to close]</span>
          </text>
        </box>

        {statusText && (
          <box width="100%" flexGrow={1} justifyContent="center" alignItems="center">
            {statusText}
          </box>
        )}
      </box>
    </>
  )
}
