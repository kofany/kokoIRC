// Test fixture script for manager tests
export const meta = { name: "test-script", version: "1.0.0", description: "Test script" }
export const config = { greeting: "hello" }

export default function init(api: any) {
  api.command("testcmd", {
    handler() {},
    description: "Test command",
  })

  api.on("irc.privmsg", () => {})

  return () => {
    // cleanup
  }
}
