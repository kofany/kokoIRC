// ─── Help Display Formatter ─────────────────────────────────
// Three display modes using addLocalEvent() for in-buffer output.

import { addLocalEvent } from "./helpers"
import { getHelp, getCategories, type CommandHelp } from "./docs"
import { commands, findByAlias, getCanonicalName } from "./registry"

const CATEGORY_ORDER = [
  "Connection", "Channel", "Messaging", "Moderation",
  "Configuration", "Statusbar", "Info",
]

// ─── /help (no args) — categorized command list ─────────────

export function showCommandList(): void {
  const cats = getCategories()

  // Collect commands that have doc files
  const documented = new Set<string>()
  for (const list of cats.values()) {
    for (const name of list) documented.add(name)
  }

  // Commands without doc files go under "Other"
  const other: string[] = []
  for (const name of Object.keys(commands)) {
    if (!documented.has(name)) other.push(name)
  }
  if (other.length > 0) cats.set("Other", other.sort())

  addLocalEvent(`%Z7aa2f7───── Commands ─────────────────────────────────%N`)

  // Ordered categories first, then any extras
  const seen = new Set<string>()
  const orderedCats = [...CATEGORY_ORDER, ...cats.keys()].filter((c) => {
    if (seen.has(c)) return false
    seen.add(c)
    return cats.has(c)
  })

  for (const cat of orderedCats) {
    const list = cats.get(cat)!
    addLocalEvent(`  %Z7aa2f7${cat}%N`)
    for (const name of list) {
      const help = getHelp(name)
      const desc = help?.description ?? commands[name]?.description ?? ""
      addLocalEvent(`    %Zc0caf5${"/" + name}${" ".repeat(Math.max(1, 16 - name.length))}%Z565f89${desc}%N`)
    }
  }

  addLocalEvent(`%Z7aa2f7─────────────────────────────────────────────────%N`)
  addLocalEvent(`  %Z565f89Type %Z7aa2f7/help <command>%Z565f89 for details%N`)
}

// ─── /help <command> — full command help ────────────────────

export function showCommandHelp(name: string): void {
  const canonical = getCanonicalName(name)
  const help = getHelp(canonical)
  const def = commands[canonical] ?? findByAlias(name)

  if (!help && !def) {
    addLocalEvent(`%Zf7768eUnknown command: ${name}%N`)
    return
  }

  addLocalEvent(`%Z7aa2f7───── /${canonical} ─────────────────────────────────%N`)

  if (help) {
    if (help.description) {
      addLocalEvent(`  %Za9b1d6${help.description}%N`)
    }
    if (help.syntax) {
      addLocalEvent("")
      for (const line of help.syntax.split("\n")) {
        addLocalEvent(`  %Zc0caf5${line}%N`)
      }
    }
    if (def?.aliases?.length) {
      addLocalEvent(`  %Z565f89Aliases: ${def.aliases.map((a) => "/" + a).join(", ")}%N`)
    }
    if (help.subcommands.length > 0) {
      addLocalEvent("")
      addLocalEvent(`  %Z7aa2f7Subcommands:%N`)
      for (const sub of help.subcommands) {
        const aliasNote = sub.aliases.length > 0 ? ` %Z565f89(${sub.aliases.join(", ")})%N` : ""
        addLocalEvent(`    %Zc0caf5${sub.name.padEnd(14)}%Z565f89${sub.description}%N${aliasNote}`)
      }
    }
    if (help.body) {
      addLocalEvent("")
      for (const line of help.body.split("\n")) {
        addLocalEvent(`  %Za9b1d6${line}%N`)
      }
    }
    if (help.examples.length > 0) {
      addLocalEvent("")
      addLocalEvent(`  %Z7aa2f7Examples:%N`)
      for (const ex of help.examples) {
        addLocalEvent(`    %Zc0caf5${ex}%N`)
      }
    }
    if (help.seeAlso.length > 0) {
      addLocalEvent("")
      addLocalEvent(`  %Z565f89See also: ${help.seeAlso.map((s) => "/" + s).join(", ")}%N`)
    }
  } else if (def) {
    // Fallback for commands without doc files
    addLocalEvent(`  %Zc0caf5${def.usage}%N`)
    addLocalEvent(`  %Za9b1d6${def.description}%N`)
    if (def.aliases?.length) {
      addLocalEvent(`  %Z565f89Aliases: ${def.aliases.map((a) => "/" + a).join(", ")}%N`)
    }
  }

  addLocalEvent(`%Z7aa2f7─────────────────────────────────────────────────%N`)
}

// ─── /help <command> <subcommand> — subcommand detail ───────

export function showSubcommandHelp(cmdName: string, subName: string): void {
  const canonical = getCanonicalName(cmdName)
  const help = getHelp(canonical)

  if (!help) {
    showCommandHelp(cmdName)
    return
  }

  const sub = help.subcommands.find(
    (s) => s.name === subName || s.aliases.includes(subName)
  )

  if (!sub) {
    addLocalEvent(`%Zf7768eUnknown subcommand: /${canonical} ${subName}%N`)
    if (help.subcommands.length > 0) {
      const names = help.subcommands.map((s) => s.name).join(", ")
      addLocalEvent(`  %Z565f89Available: ${names}%N`)
    }
    return
  }

  addLocalEvent(`%Z7aa2f7───── /${canonical} ${sub.name} ─────────────────────────%N`)

  if (sub.description) {
    addLocalEvent(`  %Za9b1d6${sub.description}%N`)
  }
  if (sub.syntax) {
    addLocalEvent("")
    for (const line of sub.syntax.split("\n")) {
      addLocalEvent(`  %Zc0caf5${line}%N`)
    }
  }
  if (sub.aliases.length > 0) {
    addLocalEvent(`  %Z565f89Aliases: ${sub.aliases.join(", ")}%N`)
  }

  // Show flags and extra body content (after first paragraph and syntax)
  const bodyLines = sub.body.split("\n")
  let inFlags = false
  const extraLines: string[] = []
  for (const line of bodyLines) {
    if (line.startsWith("**Flags:**")) {
      inFlags = true
      extraLines.push("")
      addLocalEvent(`  %Z7aa2f7Flags:%N`)
      continue
    }
    if (inFlags) {
      if (line.startsWith("- ")) {
        const flagText = line.slice(2)
        const dashIdx = flagText.indexOf(" — ")
        if (dashIdx > 0) {
          addLocalEvent(`    %Zc0caf5${flagText.slice(0, dashIdx)}%Z565f89${flagText.slice(dashIdx)}%N`)
        } else {
          addLocalEvent(`    %Zc0caf5${flagText}%N`)
        }
      } else if (line.trim() === "") {
        inFlags = false
      }
    }
  }

  addLocalEvent(`%Z7aa2f7─────────────────────────────────────────────────%N`)
}
