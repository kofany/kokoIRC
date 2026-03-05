import { useState, useEffect, useRef } from "react"
import { useKeyboard } from "@opentui/react"

const BIRD = [
  "⠀⠀⠀⠀⠀⠀⠀⠀⠀⣾⣿⣿⣷⣦⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣷⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⣀⣀⣤⣤⣤⣬⣻⣿⣿⣿⣿⣿⣿⣿⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  "⢀⣴⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⣠⣤⣤⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  "⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⠿⠿⣿⣿⣿⣿⣿⡿⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⣾⣿⣿⣿⡿⠟⠉⠀⠀⠀⠀⠀⠀⠉⠻⡿⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠈⠛⠛⡟⠀⠀⠀⠀⠀⢀⡴⠦⣄⠀⠀⠈⣖⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⣖⣚⡁⣀⢠⢠⣠⣖⣉⣤⣤⢞⡆⠀⠀⠈⢻⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⢸⣤⣬⣭⡻⣏⣿⠝⠓⠊⣉⣹⠃⠀⠀⠀⠀⠙⢄⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⢀⢘⣯⣉⣴⣿⣿⣿⣷⣿⣿⣿⣿⣷⠤⢤⣄⡀⠀⠀⠙⢦⡀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⣴⠟⠁⠀⡀⠀⠀⠈⠙⠻⠿⠿⠿⢛⡋⠀⠀⠀⠙⣆⠀⠀⠀⠈⠑⠦⠤⢄⡀",
  "⠀⠀⢸⢻⠀⢠⠊⠀⠀⠀⠀⠀⣀⣠⠴⣞⠉⠙⢯⡉⠙⢢⢘⡆⠀⠀⠀⠀⠀⠀⢤⡞",
  "⠀⠀⢸⡜⡀⠀⠀⠀⠀⢀⣴⡛⠙⢦⡀⠈⠳⡀⠀⠓⣄⢈⣧⡟⠀⠀⠀⠀⣀⣀⡀⠙",
  "⠀⠀⠈⢧⠀⠀⠀⢀⡔⠋⣠⠽⠶⠤⠬⠦⠴⠿⠶⠒⠛⠋⣾⡅⠀⠀⠀⠀⠈⠳⣍⠉",
  "⠀⠀⠀⠹⣦⠀⠀⡎⠀⠀⠙⠓⠦⢤⢄⣀⣀⣀⣀⣤⣴⣾⣿⣷⣦⣀⠀⢠⢤⣤⣄⣣",
  "⠀⠀⠀⠀⠉⠳⡼⠁⠀⠀⠀⠀⠀⠀⠀⢸⠟⠻⣿⣿⣿⣿⣿⣿⣿⣿⣷⡸⡇⠀⠀⠀",
  "⠀⠀⣠⡴⠴⠤⣀⠀⠀⠀⠀⠀⠀⠀⢠⠏⣠⠈⣿⣿⣿⣿⣿⣿⣿⣿⣿⣟⠃⠀⠀⠀",
  "⠀⢰⠃⠀⠀⢀⡴⠟⠲⢤⡀⠀⠀⠠⣏⣴⣿⢀⣿⣿⣿⣿⠛⠉⡽⠋⠉⠙⠒⢤⡀⠀",
  "⢀⡼⠓⠦⣄⡟⠀⠀⢀⠀⣳⠀⠀⠀⠉⣸⢻⣠⠟⢿⡇⠉⠀⠘⠃⠀⠀⡴⢃⡼⠧⡀",
  "⢸⠀⠀⠀⢸⠁⠀⠀⣴⠀⡗⢆⡀⠀⣠⡇⠀⠀⠀⢸⠀⠀⠀⠀⠀⠀⠀⠙⠋⠀⠀⢳",
  "⠈⡗⣤⡀⠸⣆⠀⢠⡏⠊⠀⠀⠑⢋⣹⠀⠀⠀⠀⠸⣆⠀⠀⠀⠀⠀⠀⠀⠀⠀⡴⠓",
  "⠰⣇⠀⠉⠉⠉⠳⢾⠀⠀⠀⠀⠀⠀⡇⠀⠀⠀⠀⠀⠘⠢⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠈⠓⠦⢤⣀⡤⢞⠀⠀⠀⠀⠀⠈⡇⠀⠀⠀⠀⠀⠀⠀⠈⠓⢦⡀⠀⠀⠀⠀⠀⠀",
]

const LOGO = [
  "   __        __        _______  _____",
  "  / /_____  / /_____  /  _/ _ \\/ ___/",
  " /  '_/ _ \\/  '_/ _ \\_/ // , _/ /__  ",
  "/_/\\_\\\\___/_/\\_\\\\___/___/_/|_|\\___/  ",
]

const SUBTITLE = "koko maxed terminal irc client"

const BG = "#1a1b26"
const BIRD_COLOR = "#e0af68"
const LOGO_COLOR = "#7aa2f7"
const DIM = "#565f89"

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [visibleLines, setVisibleLines] = useState(0)
  const [showLogo, setShowLogo] = useState(false)
  const doneRef = useRef(false)
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    onDone()
  }

  useKeyboard(() => finish())

  useEffect(() => {
    let count = 0
    const timer = setInterval(() => {
      count++
      setVisibleLines(count)
      if (count >= BIRD.length) {
        clearInterval(timer)
        setShowLogo(true)
        finishTimer.current = setTimeout(finish, 2500)
      }
    }, 50)
    return () => {
      clearInterval(timer)
      if (finishTimer.current) clearTimeout(finishTimer.current)
    }
  }, [])

  return (
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      backgroundColor={BG}
    >
      <box flexDirection="column" alignItems="center">
        {BIRD.map((line, i) => (
          <text key={i}>
            <span fg={i < visibleLines ? BIRD_COLOR : BG}>{line}</span>
          </text>
        ))}
      </box>
      <box flexDirection="column" alignItems="center" marginTop={1}>
        {LOGO.map((line, i) => (
          <text key={`l${i}`}>
            <span fg={showLogo ? LOGO_COLOR : BG}>{line}</span>
          </text>
        ))}
        <text>
          <span fg={showLogo ? DIM : BG}>{SUBTITLE}</span>
        </text>
      </box>
    </box>
  )
}
