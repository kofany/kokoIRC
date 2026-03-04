import { TextAttributes } from "@opentui/core"
import type { StyledSpan } from "@/types/theme"

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi

interface Props {
  spans: StyledSpan[]
}

/** Split text into segments, wrapping URLs in <a href> for OSC 8 hyperlinks */
function linkify(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  URL_RE.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const url = match[0]
    parts.push(<a key={match.index} href={url}>{url}</a>)
    lastIndex = match.index + url.length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
}

export function StyledText({ spans }: Props) {
  return (
    <text>
      {spans.map((span, i) => {
        let content: any = linkify(span.text)
        if (content.length === 1 && typeof content[0] === "string") {
          content = content[0]
        }
        if (span.bold) content = <strong>{content}</strong>
        if (span.italic) content = <em>{content}</em>
        if (span.underline) content = <u>{content}</u>
        if (span.dim) content = <span attributes={TextAttributes.DIM}>{content}</span>
        return (
          <span key={i} fg={span.fg} bg={span.bg}>
            {content}
          </span>
        )
      })}
    </text>
  )
}
