import { TextAttributes } from "@opentui/core"
import type { StyledSpan } from "@/types/theme"

interface Props {
  spans: StyledSpan[]
}

export function StyledText({ spans }: Props) {
  return (
    <text>
      {spans.map((span, i) => {
        let content: any = span.text
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
