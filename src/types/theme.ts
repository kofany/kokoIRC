export interface ThemeFile {
  meta: ThemeMeta
  colors: ThemeColors
  abstracts: Record<string, string>
  formats: {
    messages: Record<string, string>
    events: Record<string, string>
    sidepanel: Record<string, string>
    nicklist: Record<string, string>
  }
}

export interface ThemeColors {
  bg: string
  bg_alt: string
  border: string
  fg: string
  fg_muted: string
  fg_dim: string
  accent: string
  cursor: string
}

export interface ThemeMeta {
  name: string
  description: string
}

export interface StyledSpan {
  text: string
  fg?: string
  bg?: string
  bold: boolean
  italic: boolean
  underline: boolean
  dim: boolean
  indentMarker?: boolean
}
