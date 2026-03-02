/**
 * Terminal I/O helpers for image write operations.
 *
 * Bun uses kqueue on macOS for stdin I/O. During synchronous writes to stdout,
 * Bun's internal I/O layer continues reading stdin, accumulating data in internal
 * buffers. When the event loop resumes, the burst of data can trigger a malloc
 * double-free in Bun's buffer management.
 *
 * This module provides:
 * 1. pauseStdin/resumeStdin — stops Bun from scheduling stdin reads + flushes kernel buffer
 * 2. forceFullRepaint — uses ioctl TIOCSWINSZ to trigger a real terminal resize,
 *    forcing OpenTUI to do a full (non-differential) repaint. Needed because
 *    OpenTUI's processResize skips repaint when dimensions are unchanged.
 */

import { writeSync } from "node:fs"

let tcflushFn: ((fd: number) => void) | null = null
let ioctlFn: ((fd: number, request: number, buf: Buffer) => number) | null = null

// macOS ioctl constants for terminal size manipulation
const TIOCGWINSZ = 0x40087468  // get terminal size
const TIOCSWINSZ = 0x80087467  // set terminal size

try {
  const { dlopen, FFIType } = require("bun:ffi")
  const TCIFLUSH = process.platform === "darwin" ? 1 : 0
  const lib = dlopen(
    process.platform === "darwin" ? "libSystem.B.dylib" : "libc.so.6",
    {
      tcflush: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 },
      ioctl: { args: [FFIType.i32, FFIType.u64, FFIType.ptr], returns: FFIType.i32 },
    },
  )
  tcflushFn = (fd) => lib.symbols.tcflush(fd, TCIFLUSH)
  ioctlFn = (fd, req, buf) => lib.symbols.ioctl(fd, req, buf) as number
} catch {}

/** Pause stdin reading + flush kernel buffer before image writes */
export function pauseStdin() {
  try { process.stdin.pause() } catch {}
  try { tcflushFn?.(0) } catch {}
}

/** Flush kernel buffer + resume stdin reading after image writes */
export function resumeStdin() {
  try { tcflushFn?.(0) } catch {}
  try { process.stdin.resume() } catch {}
}

/**
 * Force OpenTUI to do a full repaint by triggering a real terminal resize.
 *
 * OpenTUI's processResize() has: if (width === _terminalWidth && height === _terminalHeight) return
 * So SIGWINCH with unchanged dimensions is a no-op. We use ioctl TIOCSWINSZ to
 * briefly change the PTY's reported size, which triggers a real SIGWINCH that
 * OpenTUI processes as a dimension change → full layout recalculation + full redraw.
 *
 * Also clears the terminal display (\x1b[2J) to remove non-kitty images from
 * the cell buffer before the repaint overwrites them with real content.
 */
export function forceFullRepaint() {
  if (!ioctlFn) {
    // Fallback: just clear screen + SIGWINCH (may not trigger full redraw)
    writeSync(1, "\x1b[2J")
    process.kill(process.pid, "SIGWINCH")
    return
  }

  // struct winsize { unsigned short ws_row, ws_col, ws_xpixel, ws_ypixel }
  const winsz = Buffer.alloc(8)
  const ret = ioctlFn(1, TIOCGWINSZ, winsz)
  if (ret !== 0) {
    // Not a TTY — fallback
    writeSync(1, "\x1b[2J")
    process.kill(process.pid, "SIGWINCH")
    return
  }

  const rows = winsz.readUInt16LE(0)
  const cols = winsz.readUInt16LE(2)
  const xpix = winsz.readUInt16LE(4)
  const ypix = winsz.readUInt16LE(6)

  if (cols < 2) return // safety: don't go below 1 col

  // Clear the terminal display — removes iTerm2/sixel images from cell buffer
  writeSync(1, "\x1b[2J")

  // Set terminal to cols-1 → triggers SIGWINCH, OpenTUI sees width change → full redraw
  const shrunk = Buffer.alloc(8)
  shrunk.writeUInt16LE(rows, 0)
  shrunk.writeUInt16LE(cols - 1, 2)
  shrunk.writeUInt16LE(xpix, 4)
  shrunk.writeUInt16LE(ypix, 6)
  ioctlFn(1, TIOCSWINSZ, shrunk)

  // Restore original size after a short delay (let OpenTUI process the shrunk size first)
  setTimeout(() => {
    const restored = Buffer.alloc(8)
    restored.writeUInt16LE(rows, 0)
    restored.writeUInt16LE(cols, 2)
    restored.writeUInt16LE(xpix, 4)
    restored.writeUInt16LE(ypix, 6)
    ioctlFn!(1, TIOCSWINSZ, restored)
  }, 32)
}
