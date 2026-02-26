import { test, expect, describe } from "bun:test"
import { loadConfig, mergeWithDefaults, loadCredentials } from "@/core/config/loader"
import { DEFAULT_CONFIG } from "@/core/config/defaults"

describe("config defaults", () => {
  test("DEFAULT_CONFIG has all required fields", () => {
    expect(DEFAULT_CONFIG.general.nick).toBe("opentui")
    expect(DEFAULT_CONFIG.display.nick_column_width).toBe(8)
    expect(DEFAULT_CONFIG.display.nick_alignment).toBe("right")
    expect(DEFAULT_CONFIG.sidepanel.left.width).toBe(20)
    expect(DEFAULT_CONFIG.sidepanel.right.width).toBe(18)
  })
})

describe("mergeWithDefaults", () => {
  test("partial config merges with defaults", () => {
    const partial = {
      general: { nick: "kofany" },
      servers: {
        ircnet: {
          label: "IRCnet",
          address: "irc.example.com",
          port: 6697,
          tls: true,
          autoconnect: true,
          channels: ["#test"],
        },
      },
    }
    const result = mergeWithDefaults(partial)
    expect(result.general.nick).toBe("kofany")
    expect(result.general.username).toBe("opentui")
    expect(result.display.nick_column_width).toBe(8)
    expect(result.servers.ircnet.label).toBe("IRCnet")
  })
})

describe("loadCredentials", () => {
  test("maps ENV vars to server configs", () => {
    const env = {
      IRCNET_SASL_USER: "kofany",
      IRCNET_SASL_PASS: "secret123",
    }
    const servers = {
      ircnet: {
        label: "IRCnet",
        address: "irc.example.com",
        port: 6697,
        tls: true,
        autoconnect: true,
        channels: [],
      },
    }
    const result = loadCredentials(servers, env)
    expect(result.ircnet.sasl_user).toBe("kofany")
    expect(result.ircnet.sasl_pass).toBe("secret123")
  })

  test("ignores servers without matching env vars", () => {
    const servers = {
      libera: {
        label: "Libera",
        address: "irc.libera.chat",
        port: 6697,
        tls: true,
        autoconnect: true,
        channels: [],
      },
    }
    const result = loadCredentials(servers, {})
    expect(result.libera.sasl_user).toBeUndefined()
  })
})
