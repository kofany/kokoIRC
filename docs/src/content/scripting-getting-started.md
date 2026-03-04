# Scripting — Getting Started

kokoIRC supports TypeScript scripts loaded from `~/.kokoirc/scripts/`. Scripts can register custom commands, listen to IRC events, send messages, and interact with the store.

## Script structure

Scripts export a default `init` function that receives the `KokoAPI` object. Optionally export `meta` (name, version, description) and `config` (default values for per-script configuration):

```typescript
import type { KokoAPI } from "kokoirc/api"

export const meta = {
  name: "my-script",
  version: "1.0.0",
  description: "My first script",
}

export const config = {
  timeout: 300,
}

export default function init(api: KokoAPI) {
  // Your script logic here

  return () => {
    // cleanup on unload (optional)
  }
}
```

The `meta.name` is used as the script identifier. If omitted, the filename is used instead.

The returned cleanup function is called when the script is unloaded or reloaded. Use it to clean up any resources your script created outside of the API (e.g. external connections). Event handlers, commands, and timers registered through the API are cleaned up automatically.

## Import rules

Scripts live outside the project tree (`~/.kokoirc/scripts/`), so the `@/` path alias that works inside the kokoIRC codebase is **not available at runtime**.

- **`import type`** — Works with `@/` paths because type imports are stripped at compile time:
  ```typescript
  import type { KokoAPI, IrcMessageEvent } from "kokoirc/api"  // OK
  ```
- **Runtime values** — Use the `api` object instead of importing. For example, use `api.EventPriority` instead of importing `EventPriority` directly:
  ```typescript
  // WRONG — will fail at runtime
  import { EventPriority } from "kokoirc/api"

  // CORRECT — use the api object
  api.on("irc.privmsg", handler, api.EventPriority.HIGH)
  ```

## Loading scripts

Manage scripts at runtime with the `/script` command:

| Command | Description |
|---|---|
| `/script load <name>` | Load a script from `~/.kokoirc/scripts/<name>.ts` |
| `/script unload <name>` | Unload a running script |
| `/script reload <name>` | Unload and re-import a script (cache-busted) |
| `/script list` | Show all loaded scripts |
| `/script available` | List `.ts` files in the scripts directory |

## Autoloading

Configure scripts to load automatically on startup in `config.toml`:

```toml
[scripts]
autoload = ["slap", "auto-away"]
```

Enable debug logging for script load/unload events:

```toml
[scripts]
autoload = ["slap", "auto-away"]
debug = true
```

## Per-script configuration

Declare default values by exporting a `config` object from your script:

```typescript
export const config = {
  timeout: 300,
  message: "AFK",
}
```

Users override these defaults in their `config.toml` under `[scripts.<name>]`:

```toml
[scripts.auto-away]
timeout = 600
message = "Gone fishing"
```

Access config values in your script with `api.config.get()`:

```typescript
const timeout = api.config.get("timeout", 300)
const message = api.config.get("message", "AFK")
```

The lookup order is: user TOML override > script `config` export > `defaultValue` argument.

You can also write config values at runtime with `api.config.set()`:

```typescript
api.config.set("lastSeen", Date.now())
```
