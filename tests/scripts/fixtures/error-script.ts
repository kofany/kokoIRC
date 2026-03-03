// Test fixture: script that throws during init
export const meta = { name: "error-script" }

export default function init() {
  throw new Error("init failed on purpose")
}
