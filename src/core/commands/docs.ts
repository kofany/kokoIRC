// ─── Command Documentation Parser & Cache ──────────────────
// Parses docs/commands/*.md into structured help objects.
// Single source of truth for /help output and subcommand tab completion.

import { DOCS_DIR } from "@/core/constants"

export interface SubcommandHelp {
  name: string
  aliases: string[]
  description: string   // first paragraph of prose
  syntax: string        // indented code lines
  body: string          // full subsection text
}

export interface CommandHelp {
  category: string
  description: string   // from frontmatter
  syntax: string        // from ## Syntax
  body: string          // from ## Description
  subcommands: SubcommandHelp[]
  examples: string[]
  seeAlso: string[]
}

const helpCache = new Map<string, CommandHelp>()

// ─── Parsing ────────────────────────────────────────────────

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const meta: Record<string, string> = {}
  if (!raw.startsWith("---")) return { meta, body: raw }

  const end = raw.indexOf("---", 3)
  if (end === -1) return { meta, body: raw }

  const block = raw.slice(3, end).trim()
  for (const line of block.split("\n")) {
    const idx = line.indexOf(":")
    if (idx > 0) {
      meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    }
  }
  return { meta, body: raw.slice(end + 3).trim() }
}

function splitSections(body: string): Map<string, string> {
  const sections = new Map<string, string>()
  const parts = body.split(/^## /m)
  for (const part of parts) {
    if (!part.trim()) continue
    const nlIdx = part.indexOf("\n")
    if (nlIdx === -1) continue
    const heading = part.slice(0, nlIdx).trim()
    const content = part.slice(nlIdx + 1).trim()
    sections.set(heading.toLowerCase(), content)
  }
  return sections
}

function extractIndented(text: string): string {
  return text
    .split("\n")
    .filter((l) => l.startsWith("    "))
    .map((l) => l.slice(4))
    .join("\n")
    .trim()
}

function parseSubcommands(text: string): SubcommandHelp[] {
  const subs: SubcommandHelp[] = []
  const parts = text.split(/^### /m)

  for (const part of parts) {
    if (!part.trim()) continue
    const nlIdx = part.indexOf("\n")
    if (nlIdx === -1) continue

    const name = part.slice(0, nlIdx).trim().toLowerCase()
    const body = part.slice(nlIdx + 1).trim()

    const syntax = extractIndented(body)

    // Extract aliases from "Aliases: del, rm" line
    const aliases: string[] = []
    const aliasMatch = body.match(/^Aliases?:\s*(.+)$/im)
    if (aliasMatch) {
      for (const a of aliasMatch[1].split(",")) {
        const trimmed = a.trim().toLowerCase()
        if (trimmed) aliases.push(trimmed)
      }
    }

    // First paragraph of prose (skip indented lines and Aliases line)
    const descLines: string[] = []
    for (const line of body.split("\n")) {
      if (line.startsWith("    ")) continue
      if (/^Aliases?:/i.test(line)) continue
      if (line.startsWith("**Flags:**")) break
      const trimmed = line.trim()
      if (trimmed) descLines.push(trimmed)
      else if (descLines.length > 0) break
    }

    subs.push({
      name,
      aliases,
      description: descLines.join(" "),
      syntax,
      body,
    })
  }
  return subs
}

function parseDoc(raw: string): CommandHelp {
  const { meta, body } = parseFrontmatter(raw)
  const sections = splitSections(body)

  const syntax = sections.has("syntax") ? extractIndented(sections.get("syntax")!) : ""
  const description = meta.description ?? ""
  const category = meta.category ?? "Other"
  const bodyText = sections.get("description") ?? ""

  const subcommands = sections.has("subcommands")
    ? parseSubcommands(sections.get("subcommands")!)
    : []

  const examples = sections.has("examples")
    ? extractIndented(sections.get("examples")!).split("\n").filter(Boolean)
    : []

  const seeAlso = sections.has("see also")
    ? sections.get("see also")!
        .split(",")
        .map((s) => s.trim().replace(/^\//, ""))
        .filter(Boolean)
    : []

  return { category, description, syntax, body: bodyText, subcommands, examples, seeAlso }
}

// ─── Cache & Public API ─────────────────────────────────────

export async function loadAllDocs(): Promise<void> {
  helpCache.clear()
  const glob = new Bun.Glob("*.md")
  for await (const file of glob.scan(DOCS_DIR)) {
    const name = file.replace(/\.md$/, "").toLowerCase()
    try {
      const raw = await Bun.file(`${DOCS_DIR}/${file}`).text()
      helpCache.set(name, parseDoc(raw))
    } catch {
      // skip unreadable files
    }
  }
}

export function getHelp(command: string): CommandHelp | null {
  return helpCache.get(command.toLowerCase()) ?? null
}

export function getSubcommands(command: string): string[] {
  const help = helpCache.get(command.toLowerCase())
  if (!help) return []
  const names: string[] = []
  for (const sub of help.subcommands) {
    names.push(sub.name)
    for (const alias of sub.aliases) names.push(alias)
  }
  return names.sort()
}

export function getCategories(): Map<string, string[]> {
  const cats = new Map<string, string[]>()
  for (const [name, help] of helpCache) {
    const list = cats.get(help.category) ?? []
    list.push(name)
    cats.set(help.category, list)
  }
  // Sort commands within each category
  for (const list of cats.values()) list.sort()
  return cats
}
