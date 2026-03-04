/**
 * kokoIRC Documentation — Static Site Builder
 *
 * Reads markdown content, converts to HTML via `marked`, injects into a
 * page template, and writes the final site to docs/site/.
 *
 * Usage:  bun run docs/build.ts
 */

import { marked } from "marked";
import { join, basename } from "path";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const ROOT = import.meta.dir;
const CONTENT_DIR = join(ROOT, "src/content");
const TEMPLATE_PATH = join(ROOT, "src/templates/page.html");
const CSS_SRC = join(ROOT, "src/css/style.css");
const JS_SRC_DIR = join(ROOT, "src/js");
const SCREENSHOTS_DIR = join(ROOT, "screenshots");
const COMMANDS_DIR = join(ROOT, "commands");
const SITE_DIR = join(ROOT, "site");

// ---------------------------------------------------------------------------
// Site map — defines page order and sidebar sections
// ---------------------------------------------------------------------------
interface SiteEntry {
  slug: string;
  title: string;
  section?: string;
  source?: string;
}

const siteMap: SiteEntry[] = [
  { slug: "index", title: "Home" },
  // Getting Started
  { slug: "installation", title: "Installation", section: "Getting Started" },
  { slug: "first-connection", title: "First Connection", section: "Getting Started" },
  { slug: "configuration", title: "Configuration", section: "Getting Started" },
  // Reference
  { slug: "commands", title: "Commands", section: "Reference" },
  // Scripting
  { slug: "scripting-getting-started", title: "Getting Started", section: "Scripting" },
  { slug: "scripting-api", title: "API Reference", section: "Scripting" },
  { slug: "scripting-examples", title: "Examples", section: "Scripting" },
  // Customization
  { slug: "theming", title: "Theming", section: "Customization" },
  { slug: "theming-format-strings", title: "Format Strings", section: "Customization" },
  { slug: "logging", title: "Logging & Search", section: "Customization" },
  // Project
  { slug: "roadmap", title: "Roadmap", section: "Project" },
  { slug: "faq", title: "FAQ & Migration", section: "Project" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a text file, returning empty string if it does not exist. */
async function readText(path: string): Promise<string> {
  const file = Bun.file(path);
  if (!(await file.exists())) return "";
  return file.text();
}

/** Parse YAML-like front-matter (key: value) delimited by --- lines. */
function parseFrontMatter(raw: string): { meta: Record<string, string>; body: string } {
  const lines = raw.split("\n");
  if (lines[0]?.trim() !== "---") return { meta: {}, body: raw };
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (let i = 1; i < end; i++) {
    const m = lines[i]!.match(/^(\w[\w-]*):\s*(.+)$/);
    if (m) meta[m[1]!] = m[2]!.trim();
  }
  return { meta, body: lines.slice(end + 1).join("\n") };
}

/** Generate sidebar navigation HTML for a given active slug. */
function buildNav(activeSlug: string): string {
  let html = "";
  let currentSection: string | undefined;

  for (const entry of siteMap) {
    // Home link (no section)
    if (!entry.section) {
      if (currentSection !== undefined) {
        html += `    </ul>\n  </div>\n`;
        currentSection = undefined;
      }
      const cls = entry.slug === activeSlug ? ' class="active"' : "";
      html += `  <ul>\n    <li><a href="${entry.slug}.html"${cls}>${entry.title}</a></li>\n  </ul>\n`;
      continue;
    }

    // New section?
    if (entry.section !== currentSection) {
      if (currentSection !== undefined) {
        html += `    </ul>\n  </div>\n`;
      }
      currentSection = entry.section;
      html += `  <div class="nav-section">\n`;
      html += `    <span class="nav-section-title">${currentSection}</span>\n`;
      html += `    <ul>\n`;
    }

    const cls = entry.slug === activeSlug ? ' class="active"' : "";
    html += `      <li><a href="${entry.slug}.html"${cls}>${entry.title}</a></li>\n`;
  }

  // Close last section
  if (currentSection !== undefined) {
    html += `    </ul>\n  </div>\n`;
  }

  return html;
}

/** Build prev/next link HTML. */
function buildPrevNext(index: number): { prev: string; next: string } {
  let prev = "";
  let next = "";

  if (index > 0) {
    const p = siteMap[index - 1]!;
    prev =
      `<a href="${p.slug}.html" class="page-nav-link prev">\n` +
      `  <span class="page-nav-label">&larr; Previous</span>\n` +
      `  <span class="page-nav-title">${p.title}</span>\n` +
      `</a>`;
  }

  if (index < siteMap.length - 1) {
    const n = siteMap[index + 1]!;
    next =
      `<a href="${n.slug}.html" class="page-nav-link next">\n` +
      `  <span class="page-nav-label">Next &rarr;</span>\n` +
      `  <span class="page-nav-title">${n.title}</span>\n` +
      `</a>`;
  }

  return { prev, next };
}

// ---------------------------------------------------------------------------
// Commands page builder
// ---------------------------------------------------------------------------

interface CommandEntry {
  name: string;
  category: string;
  description: string;
  html: string;
}

async function buildCommandsPage(): Promise<string> {
  const glob = new Bun.Glob("*.md");
  const files: string[] = [];
  for await (const path of glob.scan(COMMANDS_DIR)) {
    files.push(path);
  }
  files.sort();

  const commands: CommandEntry[] = [];

  for (const file of files) {
    const raw = await Bun.file(join(COMMANDS_DIR, file)).text();
    const { meta, body } = parseFrontMatter(raw);
    const name = basename(file, ".md");
    commands.push({
      name,
      category: meta.category || "Other",
      description: meta.description || "",
      html: await marked.parse(body),
    });
  }

  // Group by category
  const categories = new Map<string, CommandEntry[]>();
  for (const cmd of commands) {
    if (!categories.has(cmd.category)) categories.set(cmd.category, []);
    categories.get(cmd.category)!.push(cmd);
  }

  // Sort categories alphabetically
  const sortedCats = [...categories.keys()].sort();

  // Build HTML
  let html = `<h1>Commands</h1>\n`;

  // Search input
  html += `<div class="search-wrapper">\n`;
  html += `  <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>\n`;
  html += `  <input type="text" class="search-input" id="command-search" placeholder="Filter commands..." autocomplete="off">\n`;
  html += `  <button class="search-clear" id="search-clear" type="button">&times;</button>\n`;
  html += `</div>\n`;
  html += `<p class="search-results-count" id="search-count"></p>\n`;

  for (const cat of sortedCats) {
    const cmds = categories.get(cat)!;
    html += `<h2 id="cat-${cat.toLowerCase().replace(/\s+/g, "-")}">${cat}</h2>\n`;
    for (const cmd of cmds) {
      html += `<div class="command-entry" data-command="${cmd.name}" data-category="${cmd.category}">\n`;
      html += cmd.html;
      html += `</div>\n`;
    }
  }

  // Inline search script for filtering commands
  html += `<script>
(function() {
  const input = document.getElementById('command-search');
  const clearBtn = document.getElementById('search-clear');
  const countEl = document.getElementById('search-count');
  const entries = document.querySelectorAll('.command-entry');
  const catHeadings = document.querySelectorAll('h2[id^="cat-"]');

  function filter() {
    const q = input.value.toLowerCase().trim();
    let visible = 0;

    entries.forEach(function(entry) {
      const name = entry.getAttribute('data-command') || '';
      const cat = entry.getAttribute('data-category') || '';
      const text = entry.textContent || '';
      const match = !q || name.includes(q) || cat.toLowerCase().includes(q) || text.toLowerCase().includes(q);
      entry.style.display = match ? '' : 'none';
      if (match) visible++;
    });

    // Hide empty category headings
    catHeadings.forEach(function(h) {
      let next = h.nextElementSibling;
      let hasVisible = false;
      while (next && !next.matches('h2')) {
        if (next.classList.contains('command-entry') && next.style.display !== 'none') {
          hasVisible = true;
          break;
        }
        next = next.nextElementSibling;
      }
      h.style.display = hasVisible ? '' : 'none';
    });

    countEl.textContent = q ? visible + ' command' + (visible !== 1 ? 's' : '') + ' found' : '';
  }

  input.addEventListener('input', filter);
  clearBtn.addEventListener('click', function() {
    input.value = '';
    filter();
    input.focus();
  });
})();
<\/script>`;

  return html;
}

// ---------------------------------------------------------------------------
// Main build
// ---------------------------------------------------------------------------

async function build() {
  const startTime = performance.now();
  console.log("Building kokoIRC documentation...\n");

  // Read template
  const template = await Bun.file(TEMPLATE_PATH).text();

  // Ensure output directories
  const { mkdir } = await import("node:fs/promises");
  await mkdir(join(SITE_DIR, "css"), { recursive: true });
  await mkdir(join(SITE_DIR, "images"), { recursive: true });
  await mkdir(join(SITE_DIR, "js"), { recursive: true });

  // Copy CSS
  const cssSrc = Bun.file(CSS_SRC);
  if (await cssSrc.exists()) {
    await Bun.write(join(SITE_DIR, "css/style.css"), cssSrc);
    console.log("  css/style.css");
  }

  // Copy screenshots
  const pngGlob = new Bun.Glob("*.png");
  for await (const png of pngGlob.scan(SCREENSHOTS_DIR)) {
    await Bun.write(join(SITE_DIR, "images", png), Bun.file(join(SCREENSHOTS_DIR, png)));
    console.log(`  images/${png}`);
  }

  // Copy JS if it exists
  const jsGlob = new Bun.Glob("*.js");
  try {
    for await (const js of jsGlob.scan(JS_SRC_DIR)) {
      await Bun.write(join(SITE_DIR, "js", js), Bun.file(join(JS_SRC_DIR, js)));
      console.log(`  js/${js}`);
    }
  } catch {
    // js dir may not exist yet
  }

  // Build each page
  let pageCount = 0;
  for (let i = 0; i < siteMap.length; i++) {
    const entry = siteMap[i]!;
    const slug = entry.slug;

    // Determine content
    let contentHtml: string;

    if (slug === "commands") {
      // Special: aggregate command docs
      contentHtml = await buildCommandsPage();
    } else {
      const srcPath = entry.source || join(CONTENT_DIR, `${slug}.md`);
      const md = await readText(srcPath);
      if (!md) {
        console.log(`  [skip] ${slug}.md — not found`);
        continue;
      }
      contentHtml = await marked.parse(md);
    }

    // Build nav and prev/next
    const nav = buildNav(slug);
    const { prev, next } = buildPrevNext(i);

    // Inject into template
    let page = template
      .replace("{{title}}", entry.title)
      .replace("{{nav}}", nav)
      .replace("{{content}}", contentHtml)
      .replace("{{prev}}", prev)
      .replace("{{next}}", next);

    // Write output
    const outFile = join(SITE_DIR, `${slug}.html`);
    await Bun.write(outFile, page);
    console.log(`  ${slug}.html`);
    pageCount++;
  }

  const elapsed = (performance.now() - startTime).toFixed(0);
  console.log(`\nDone — ${pageCount} pages built in ${elapsed}ms`);
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
