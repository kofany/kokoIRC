/**
 * Terminal I/O helpers for image write operations.
 *
 * Bun uses kqueue on macOS for stdin I/O. Calling process.stdin.pause()/resume()
 * triggers a buffer overwrite race in Bun's streams.zig (issue #8695) that causes
 * a malloc double-free crash. Instead of pause/resume, we:
 *
 * 1. Disable mouse tracking at the terminal level (caller's responsibility)
 *    — the terminal stops generating mouse events entirely
 * 2. Call tcflush(TCIFLUSH) to discard any already-queued input at the kernel level
 *
 * This avoids touching Bun's stdin stream state while still preventing event
 * accumulation during synchronous image writes.
 */

let tcflushFn: ((fd: number) => void) | null = null

try {
  const { dlopen, FFIType } = require("bun:ffi")
  const TCIFLUSH = process.platform === "darwin" ? 1 : 0
  const lib = dlopen(
    process.platform === "darwin" ? "libSystem.B.dylib" : "libc.so.6",
    {
      tcflush: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 },
    },
  )
  tcflushFn = (fd) => lib.symbols.tcflush(fd, TCIFLUSH)
} catch {}

/** Flush the kernel stdin buffer — discards any queued input data */
export function flushStdin() {
  try { tcflushFn?.(0) } catch {}
}
