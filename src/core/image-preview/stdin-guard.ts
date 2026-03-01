/**
 * Stdin guard for image write operations.
 *
 * Bun uses kqueue on macOS for stdin I/O. During synchronous writes to stdout,
 * Bun's internal I/O layer continues reading stdin, accumulating data in internal
 * buffers. When the event loop resumes, the burst of data can trigger a malloc
 * double-free in Bun's buffer management.
 *
 * This module provides pause/resume helpers that:
 * 1. process.stdin.pause() — stops Bun from scheduling stdin reads
 * 2. tcflush(TCIFLUSH) via FFI — discards data already in kernel stdin buffer
 */

let tcflushFn: ((fd: number) => void) | null = null
try {
  const { dlopen, FFIType } = require("bun:ffi")
  const TCIFLUSH = process.platform === "darwin" ? 1 : 0
  const lib = dlopen(
    process.platform === "darwin" ? "libSystem.B.dylib" : "libc.so.6",
    { tcflush: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 } },
  )
  tcflushFn = (fd) => lib.symbols.tcflush(fd, TCIFLUSH)
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
