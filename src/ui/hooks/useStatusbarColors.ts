import { useStore } from "@/core/state/store"

/** Resolve statusbar color: config override → theme fallback */
function c(configVal: string, themeFallback: string | undefined, hardFallback: string): string {
  return configVal || themeFallback || hardFallback
}

export function useStatusbarColors() {
  const sb = useStore((s) => s.config?.statusbar)
  const colors = useStore((s) => s.theme?.colors)
  return {
    bg: c(sb?.background ?? "", colors?.bg_alt, "#16161e"),
    accent: c(sb?.accent_color ?? "", colors?.accent, "#7aa2f7"),
    text: c(sb?.text_color ?? "", colors?.fg, "#a9b1d6"),
    muted: c(sb?.muted_color ?? "", colors?.fg_muted, "#565f89"),
    dim: c(sb?.dim_color ?? "", colors?.fg_dim, "#292e42"),
    promptColor: c(sb?.prompt_color ?? "", colors?.accent, "#7aa2f7"),
    inputColor: c(sb?.input_color ?? "", colors?.fg, "#c0caf5"),
    cursorColor: c(sb?.cursor_color ?? "", colors?.cursor, "#7aa2f7"),
    prompt: sb?.prompt ?? "[$channel] > ",
    separator: sb?.separator ?? " | ",
  }
}
