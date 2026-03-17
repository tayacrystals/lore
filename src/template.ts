import type { Config } from "./types.ts";
import type { SidebarItem } from "./types.ts";
import { resolveColor } from "./config.ts";
import { linkIcon, linkHref } from "./icons.ts";

const CHEVRON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`;

function sectionContainsUrl(items: SidebarItem[], url: string): boolean {
  for (const item of items) {
    if (item.type === "page" && item.url === url) return true;
    if (item.type === "section") {
      if (item.url === url || sectionContainsUrl(item.items, url)) return true;
    }
  }
  return false;
}

function renderSidebarItems(items: SidebarItem[], currentUrl: string): string {
  return items
    .map((item) => {
      if (item.type === "page") {
        const active = item.url === currentUrl;
        return `<li><a href="${item.url}" class="sidebar-row${active ? " active" : ""}">${escHtml(item.title)}</a></li>`;
      } else {
        const open = sectionContainsUrl(item.items, currentUrl) || item.url === currentUrl;
        const active = item.url === currentUrl;
        const titleEl = item.url
          ? `<a href="${item.url}" class="section-link">${escHtml(item.title)}</a>`
          : `<span class="section-link">${escHtml(item.title)}</span>`;
        const inner = item.items.length > 0
          ? `<ul class="section-items">${renderSidebarItems(item.items, currentUrl)}</ul>`
          : "";
        return `<li class="section${open ? " open" : ""}" data-section="${escHtml(item.title)}">
          <div class="sidebar-row${active ? " active" : ""}">
            ${titleEl}
            <button class="section-toggle" aria-label="Toggle section">${CHEVRON}</button>
          </div>
          ${inner}
        </li>`;
      }
    })
    .join("\n");
}

function renderHeaderLinks(links: Config["links"]): string {
  if (!links || links.length === 0) return "";
  return links
    .map((link) => {
      const url = escHtml(linkHref(link));
      const icon = linkIcon(link);
      return `<a href="${url}" class="header-icon-link" target="_blank" rel="noopener" aria-label="${url}">${icon}</a>`;
    })
    .join("");
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SUN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
const MOON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>`;

function minifyCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")  // strip comments
    .replace(/\s+/g, " ")               // collapse whitespace
    .replace(/ *([{}:;,]) */g, "$1")    // remove spaces around punctuation
    .replace(/;}/g, "}")                // remove trailing semicolons
    .trim();
}

export interface PageTemplateOptions {
  config: Config;
  title: string;
  description?: string;
  contentHtml: string;
  sidebar: SidebarItem[];
  currentUrl: string;
  logoSrc?: string;
  devMode?: boolean;
}

export function renderPage(opts: PageTemplateOptions): string {
  const { config, title, description, contentHtml, sidebar, currentUrl, logoSrc, devMode } = opts;
  const accent = resolveColor(config.color);
  const siteTitle = config.title ?? "Docs";
  const pageTitle = title ? `${title} — ${siteTitle}` : siteTitle;
  const metaDesc = description ?? config.description ?? "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escHtml(pageTitle)}</title>
  ${logoSrc ? `<link rel="icon" href="${escHtml(logoSrc)}">` : ""}
  ${metaDesc ? `<meta name="description" content="${escHtml(metaDesc)}">` : ""}
  <script>
    // Apply saved theme before render to prevent flash
    (function() {
      var t = localStorage.getItem('lore-theme');
      if (t) document.documentElement.classList.add(t);
    })();
  </script>
  <style>${CSS_MIN.replace("__ACCENT__", accent)}${COMPONENT_CSS_MIN}</style>
  <noscript><style>
    .section-items { display: block !important; }
    .section-toggle { display: none !important; }
    .tab-panel { display: block !important; }
    .tab-list { display: none !important; }
    @media (max-width: 768px) {
      .sidebar { transform: none !important; position: static; border-right: none; border-bottom: 1px solid var(--border); }
      .menu-btn { display: none !important; }
      .layout { flex-direction: column; }
      .content { margin-left: 0; }
    }
  </style></noscript>
</head>
<body>
  <header>
    <div class="header-inner">
      <div class="header-left">
        <button class="menu-btn" aria-label="Toggle menu" onclick="toggleSidebar()">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
            <line x1="2" y1="4.5" x2="16" y2="4.5"/>
            <line x1="2" y1="9" x2="16" y2="9"/>
            <line x1="2" y1="13.5" x2="16" y2="13.5"/>
          </svg>
        </button>
        <a href="/" class="logo">${logoSrc ? `<img src="${escHtml(logoSrc)}" alt="" width="24" height="24" class="logo-img">` : ""}${escHtml(siteTitle)}</a>
      </div>
      <div class="header-right">
        <nav class="header-links">
          ${renderHeaderLinks(config.links)}
        </nav>
        <button class="header-icon-link theme-btn" onclick="toggleTheme()" aria-label="Toggle theme">
          <span class="icon-sun">${SUN_SVG}</span>
          <span class="icon-moon">${MOON_SVG}</span>
        </button>
      </div>
    </div>
  </header>

  <div class="overlay" onclick="toggleSidebar()"></div>

  <div class="layout">
    <aside class="sidebar">
      <nav>
        <ul class="sidebar-nav">
          ${renderSidebarItems(sidebar, currentUrl)}
        </ul>
      </nav>
    </aside>

    <main class="content">
      <article>
        ${contentHtml}
      </article>
    </main>
  </div>
  <script>
    function toggleSidebar() {
      document.body.classList.toggle('sidebar-open');
    }
    document.querySelectorAll('.sidebar-row').forEach(function(link) {
      link.addEventListener('click', function() {
        document.body.classList.remove('sidebar-open');
      });
    });
    document.querySelectorAll('.section[data-section]').forEach(function(section) {
      var key = 'sidebar:' + section.dataset.section;
      if (section.classList.contains('open')) {
        localStorage.setItem(key, '1');
      } else {
        if (localStorage.getItem(key) === '1') section.classList.add('open');
      }
    });
    document.querySelectorAll('.section-toggle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var section = btn.closest('.section');
        section.classList.toggle('open');
        var key = section.dataset.section;
        if (key) localStorage.setItem('sidebar:' + key, section.classList.contains('open') ? '1' : '0');
      });
    });
    // Tabs
    function activateTab(tabs, index) {
      tabs.querySelectorAll('.tab-btn').forEach(function(b, i) { b.classList.toggle('active', i === index); });
      tabs.querySelectorAll('.tab-panel').forEach(function(p, i) { p.classList.toggle('active', i === index); });
    }
    document.querySelectorAll('.tabs').forEach(function(tabs) {
      var group = tabs.dataset.group;
      // Restore saved tab for this group
      if (group) {
        var saved = localStorage.getItem('tab:' + group);
        if (saved) {
          tabs.querySelectorAll('.tab-btn').forEach(function(btn, i) {
            if (btn.textContent === saved) activateTab(tabs, i);
          });
        }
      }
      tabs.querySelectorAll('.tab-btn').forEach(function(btn, i) {
        btn.addEventListener('click', function() {
          activateTab(tabs, i);
          if (group) {
            var label = btn.textContent;
            localStorage.setItem('tab:' + group, label);
            // Sync other tab groups with the same group name
            document.querySelectorAll('.tabs[data-group="' + group + '"]').forEach(function(other) {
              if (other !== tabs) {
                other.querySelectorAll('.tab-btn').forEach(function(ob, oi) {
                  if (ob.textContent === label) activateTab(other, oi);
                });
              }
            });
          }
        });
      });
    });

    function toggleTheme() {
      var html = document.documentElement;
      var isDark = html.classList.contains('dark') ||
        (!html.classList.contains('light') && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) {
        html.classList.replace('dark', 'light') || html.classList.add('light');
        localStorage.setItem('lore-theme', 'light');
      } else {
        html.classList.replace('light', 'dark') || html.classList.add('dark');
        localStorage.setItem('lore-theme', 'dark');
      }
    }
  </script>
  ${devMode ? `<script>new EventSource("/_lore/reload").onmessage = () => location.reload();</script>` : ""}
</body>
</html>`;
}

const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #ffffff;
  --bg-sidebar: #f6f8fa;
  --bg-hover: #eef0f2;
  --text: #1c1c1e;
  --text-muted: #636366;
  --border: #e5e5ea;
  --accent: __ACCENT__;
  --sidebar-w: 272px;
  --header-h: 56px;
}

/* Dark theme via explicit class (user override) */
:root.dark {
  --bg: #111113;
  --bg-sidebar: #1c1c1e;
  --bg-hover: #2c2c2e;
  --text: #f5f5f7;
  --text-muted: #98989f;
  --border: #2c2c2e;
}

/* Dark theme via system preference (when no explicit override) */
@media (prefers-color-scheme: dark) {
  :root:not(.light) {
    --bg: #111113;
    --bg-sidebar: #1c1c1e;
    --bg-hover: #2c2c2e;
    --text: #f5f5f7;
    --text-muted: #98989f;
    --border: #2c2c2e;
  }
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: var(--text);
  background: var(--bg);
}

/* Header */
header {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: var(--header-h);
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  z-index: 100;
  display: flex;
  align-items: center;
}
.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0 20px;
}
.header-left { display: flex; align-items: center; gap: 8px; }
.header-right { display: flex; align-items: center; gap: 2px; }
.logo-img { height: 24px; width: auto; }
.logo {
  display: flex; align-items: center; gap: 8px;
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  text-decoration: none;
  letter-spacing: -0.01em;
}
.menu-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: none;
  border: none;
  border-radius: 6px;
  color: var(--text);
  cursor: pointer;
  flex-shrink: 0;
}
.menu-btn:hover { background: var(--bg-hover); }
.header-links { display: flex; gap: 2px; align-items: center; }
.header-icon-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  color: var(--text-muted);
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-decoration: none;
  transition: color 0.15s, background 0.15s;
}
.header-icon-link:hover { color: var(--text); background: var(--bg-hover); }

/* Theme toggle icons */
.theme-btn .icon-sun { display: none; }
.theme-btn .icon-moon { display: flex; }
:root.dark .theme-btn .icon-sun { display: flex; }
:root.dark .theme-btn .icon-moon { display: none; }
@media (prefers-color-scheme: dark) {
  :root:not(.light) .theme-btn .icon-sun { display: flex; }
  :root:not(.light) .theme-btn .icon-moon { display: none; }
}

/* Overlay (mobile) */
.overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 49;
}
body.sidebar-open .overlay { display: block; }

/* Layout */
.layout {
  display: flex;
  margin-top: var(--header-h);
  min-height: calc(100vh - var(--header-h));
}

/* Sidebar */
.sidebar {
  position: fixed;
  top: var(--header-h);
  bottom: 0;
  left: 0;
  width: var(--sidebar-w);
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  overflow-y: auto;
  padding: 16px 0;
  z-index: 50;
}
.sidebar-nav { list-style: none; }
.sidebar-nav li { list-style: none; }
/* Unified sidebar row — used by both page links and section headers */
.sidebar-row {
  display: flex;
  align-items: center;
  padding: 5px 8px 5px 16px;
  margin: 1px 8px;
  border-radius: 6px;
  font-size: 14px;
  color: var(--text-muted);
  text-decoration: none;
  transition: color 0.15s, background 0.15s;
}
.sidebar-row:hover { color: var(--text); background: var(--bg-hover); }
.sidebar-row.active {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  font-weight: 500;
}
/* Section-specific: title link inherits row style, toggle sits at the end */
.section-link {
  flex: 1;
  color: inherit;
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.section-toggle {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
}
.section-toggle svg { transition: transform 0.2s ease; }
.section.open .section-toggle svg { transform: rotate(90deg); }
.section-items {
  display: none;
  list-style: none;
  padding-left: 12px;
}
.section.open .section-items { display: block; }

/* Content */
.content {
  margin-left: var(--sidebar-w);
  padding: 48px 64px;
  flex: 1;
  min-width: 0;
}
article { max-width: 780px; }

/* Typography */
article h1 { font-size: 2rem; font-weight: 700; margin-bottom: 16px; line-height: 1.2; }
article h2 { font-size: 1.4rem; font-weight: 600; margin: 40px 0 12px; padding-top: 8px; border-top: 1px solid var(--border); }
article h3 { font-size: 1.15rem; font-weight: 600; margin: 28px 0 8px; }
article h4 { font-size: 1rem; font-weight: 600; margin: 20px 0 8px; }
article h1, article h2, article h3, article h4 { position: relative; }
.heading-anchor { margin-left: 0.4em; color: var(--text-muted); opacity: 0; text-decoration: none; font-weight: 400; transition: opacity 0.15s; }
:is(h1, h2, h3, h4):hover .heading-anchor { opacity: 1; }
.heading-anchor:hover { color: var(--accent); }
article p { margin-bottom: 16px; }
article ul, article ol { margin-bottom: 16px; padding-left: 24px; }
article li { margin-bottom: 4px; }
article a { color: var(--accent); text-decoration: none; }
article a:hover { text-decoration: underline; }
article strong { font-weight: 600; }
article code {
  font-family: 'SF Mono', ui-monospace, Consolas, monospace;
  font-size: 0.85em;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 5px;
}
article pre {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px 20px;
  overflow-x: auto;
  margin-bottom: 16px;
}
article pre code {
  background: none;
  border: none;
  padding: 0;
  font-size: 0.875rem;
  line-height: 1.7;
}
article blockquote {
  border-left: 3px solid var(--accent);
  padding-left: 16px;
  margin: 0 0 16px;
  color: var(--text-muted);
}
article hr { border: none; border-top: 1px solid var(--border); margin: 32px 0; }
article table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
article th, article td { padding: 8px 12px; text-align: left; border: 1px solid var(--border); }
article th { background: var(--bg-sidebar); font-weight: 600; }

/* Mobile */
@media (max-width: 768px) {
  .menu-btn { display: flex; }
  .sidebar {
    transform: translateX(-100%);
    transition: transform 0.25s ease;
  }
  body.sidebar-open .sidebar { transform: translateX(0); }
  .content {
    margin-left: 0;
    padding: 32px 20px;
  }
  article h1 { font-size: 1.6rem; }
  article h2 { font-size: 1.25rem; }
}
`;

const COMPONENT_CSS = `
/* ── Shiki dual-theme ───────────────────────────────────── */
.shiki, .shiki span { color: var(--shiki-light) !important; background-color: var(--shiki-light-bg) !important; }
:root.dark .shiki, :root.dark .shiki span { color: var(--shiki-dark) !important; background-color: var(--shiki-dark-bg) !important; }
@media (prefers-color-scheme: dark) {
  :root:not(.light) .shiki, :root:not(.light) .shiki span { color: var(--shiki-dark) !important; background-color: var(--shiki-dark-bg) !important; }
}

/* ── Code blocks ────────────────────────────────────────── */
.code-block { margin-bottom: 16px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.code-block .shiki { margin: 0; border: none; border-radius: 0; padding: 16px 20px; }
.code-frame {
  display: flex; align-items: center;
  padding: 0 16px;
  height: 36px;
  background: var(--bg-hover);
  border-bottom: 1px solid var(--border);
  font-family: 'SF Mono', ui-monospace, Consolas, monospace;
  font-size: 12px;
  color: var(--text-muted);
  gap: 8px;
}
.code-frame::before {
  content: '';
  display: block;
  width: 10px; height: 10px;
  border-radius: 50%;
  background: var(--border);
  box-shadow: 16px 0 0 var(--border), 32px 0 0 var(--border);
  flex-shrink: 0;
}
.code-frame-terminal::before { background: #ff5f57; box-shadow: 16px 0 0 #febc2e, 32px 0 0 #28c840; }
.code-frame span { margin-left: 16px; }

/* ── Callouts ───────────────────────────────────────────── */
.callout {
  display: flex; gap: 12px;
  padding: 14px 16px; margin-bottom: 16px;
  border-radius: 8px; border: 1px solid;
}
.callout-note    { background: color-mix(in srgb, #3b82f6 10%, transparent); border-color: color-mix(in srgb, #3b82f6 30%, transparent); }
.callout-tip     { background: color-mix(in srgb, #22c55e 10%, transparent); border-color: color-mix(in srgb, #22c55e 30%, transparent); }
.callout-warning { background: color-mix(in srgb, #eab308 10%, transparent); border-color: color-mix(in srgb, #eab308 30%, transparent); }
.callout-danger  { background: color-mix(in srgb, #ef4444 10%, transparent); border-color: color-mix(in srgb, #ef4444 30%, transparent); }
.callout-icon { flex-shrink: 0; display: flex; align-items: flex-start; padding-top: 2px; }
.callout-note    .callout-icon { color: #3b82f6; }
.callout-tip     .callout-icon { color: #22c55e; }
.callout-warning .callout-icon { color: #eab308; }
.callout-danger  .callout-icon { color: #ef4444; }
.callout-body { flex: 1; min-width: 0; }
.callout-body > *:last-child { margin-bottom: 0; }

/* ── File tree ──────────────────────────────────────────── */
.file-tree {
  font-family: 'SF Mono', ui-monospace, Consolas, monospace;
  font-size: 13px;
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.file-tree ul { list-style: none; padding-left: 20px; margin-bottom: 0; }
.file-tree > ul { padding-left: 0; }
.file-tree li { padding: 2px 0; }
.tree-row { display: flex; align-items: center; gap: 6px; }
.tree-icon { display: flex; flex-shrink: 0; color: var(--text-muted); }
.tree-dir-icon { color: var(--accent); }

/* ── Steps ──────────────────────────────────────────────── */
.steps { margin-bottom: 16px; }
.step { display: flex; gap: 16px; margin-bottom: 28px; }
.step-num {
  flex-shrink: 0;
  width: 26px; height: 26px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 600;
  margin-top: 1px;
}
.step-body { flex: 1; min-width: 0; }
.step-title { font-weight: 600; margin-bottom: 8px; }
.step-body > *:last-child { margin-bottom: 0; }

/* ── Tabs ───────────────────────────────────────────────── */
.tabs { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; margin-bottom: 16px; }
.tab-list {
  display: flex;
  background: var(--bg-sidebar);
  border-bottom: 1px solid var(--border);
  padding: 8px 8px 0;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
}
.tab-list::-webkit-scrollbar { display: none; }
.tab-btn {
  padding: 6px 14px;
  border: none; border-radius: 6px 6px 0 0;
  background: none;
  font-size: 13px; font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s, background 0.15s;
}
.tab-btn:hover { color: var(--text); background: var(--bg-hover); }
.tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); background: var(--bg); }
.tab-panels { }
.tab-panel { display: none; padding: 16px 20px; }
.tab-panel.active { display: block; }
.tab-panel > *:last-child { margin-bottom: 0; }
`;

const CSS_MIN = minifyCss(CSS);
const COMPONENT_CSS_MIN = minifyCss(COMPONENT_CSS);
