import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeStringify from "rehype-stringify";
import { codeToHtml } from "shiki";
import { lucideIcon } from "./icons.ts";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function parseAttrs(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of attrStr.matchAll(/(\w[\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g)) {
    attrs[m[1]!] = m[2] ?? m[3] ?? m[4] ?? "true";
  }
  return attrs;
}

/** Find all non-self-nesting occurrences of <TagName attrs>inner</TagName>. */
function findAll(content: string, tag: string): { full: string; attrs: string; inner: string }[] {
  const re = new RegExp(`<${tag}((?:\\s+[^>]*)?)>([\\s\\S]*?)<\\/${tag}>`, "g");
  return [...content.matchAll(re)].map((m) => ({ full: m[0], attrs: m[1]?.trim() ?? "", inner: m[2]! }));
}

// ── Code blocks ─────────────────────────────────────────────────────────────

const LANG_ALIASES: Record<string, string> = {
  sh: "bash", shell: "bash", zsh: "bash",
  js: "javascript", ts: "typescript",
  mdx: "markdown",
};

async function renderCode(lang: string, meta: string, code: string): Promise<string> {
  const attrs = parseAttrs(meta);
  const title = attrs["title"];
  const isTerminal = attrs["frame"] === "terminal";
  const noFrame = attrs["frame"] === "none";
  const wrap = "wrap" in attrs;

  const normalLang = LANG_ALIASES[lang] ?? lang;
  let pre: string;
  if (normalLang) {
    try {
      pre = await codeToHtml(code, {
        lang: normalLang,
        themes: { light: "github-light", dark: "github-dark" },
        defaultColor: false,
      });
    } catch {
      pre = `<pre><code>${esc(code)}</code></pre>`;
    }
  } else {
    pre = `<pre><code>${esc(code)}</code></pre>`;
  }

  if (wrap) pre = pre.replace("<pre ", `<pre style="white-space:pre-wrap" `);

  const hasFrame = (isTerminal || title) && !noFrame;
  if (!hasFrame) return `<div class="code-block">${pre}</div>`;

  const frameKind = isTerminal ? "terminal" : "editor";
  const titleBar = `<div class="code-frame code-frame-${frameKind}">${title ? `<span>${esc(title)}</span>` : ""}</div>`;
  return `<div class="code-block">${titleBar}${pre}</div>`;
}

// ── Callouts ─────────────────────────────────────────────────────────────────

const CALLOUT_ICONS: Record<string, string> = {
  note: lucideIcon("info") ?? "",
  tip: lucideIcon("lightbulb") ?? "",
  warning: lucideIcon("triangle-alert") ?? "",
  danger: lucideIcon("circle-x") ?? "",
};

async function processCallouts(
  content: string,
  codeBlocks: Map<string, { lang: string; meta: string; code: string }>,
): Promise<string> {
  for (const { full, attrs, inner } of findAll(content, "Callout")) {
    const type = parseAttrs(attrs)["type"] ?? "note";
    const innerHtml = await renderInner(inner.trim(), codeBlocks);
    const icon = CALLOUT_ICONS[type] ?? CALLOUT_ICONS["note"]!;
    content = content.replace(full,
      `<div class="callout callout-${esc(type)}"><span class="callout-icon">${icon}</span><div class="callout-body">${innerHtml}</div></div>`
    );
  }
  return content;
}

// ── File tree ─────────────────────────────────────────────────────────────────

type TreeNode = { name: string; isDir: boolean; children: TreeNode[] };

function parseTree(lines: string[]): TreeNode[] {
  const root: TreeNode[] = [];
  const stack: { nodes: TreeNode[]; indent: number }[] = [{ nodes: root, indent: -1 }];
  for (const line of lines) {
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    const name = line.trim();
    const isDir = name.endsWith("/");
    while (stack.length > 1 && stack[stack.length - 1]!.indent >= indent) stack.pop();
    const node: TreeNode = { name, isDir, children: [] };
    stack[stack.length - 1]!.nodes.push(node);
    if (isDir) stack.push({ nodes: node.children, indent });
  }
  return root;
}

const FOLDER_ICON = lucideIcon("folder") ?? "📁";
const FILE_ICON = lucideIcon("file") ?? "📄";

function renderTree(nodes: TreeNode[]): string {
  return nodes.map((n) => {
    const icon = `<span class="tree-icon${n.isDir ? " tree-dir-icon" : ""}">${n.isDir ? FOLDER_ICON : FILE_ICON}</span>`;
    const kids = n.isDir && n.children.length > 0 ? `<ul>${renderTree(n.children)}</ul>` : "";
    return `<li class="${n.isDir ? "tree-dir" : "tree-file"}"><div class="tree-row">${icon}<span>${esc(n.name)}</span></div>${kids}</li>`;
  }).join("");
}

function processFileTrees(content: string): string {
  for (const { full, inner } of findAll(content, "FileTree")) {
    const tree = parseTree(inner.split("\n"));
    content = content.replace(full, `<div class="file-tree"><ul>${renderTree(tree)}</ul></div>`);
  }
  return content;
}

// ── Steps ─────────────────────────────────────────────────────────────────────

async function processSteps(
  content: string,
  codeBlocks: Map<string, { lang: string; meta: string; code: string }>,
): Promise<string> {
  for (const { full, inner } of findAll(content, "Steps")) {
    const lines = inner.split("\n");
    const steps: { title: string; body: string[] }[] = [];
    for (const line of lines) {
      const m = line.match(/^\s*#{1,6}\s+(.+)$/);
      if (m) {
        steps.push({ title: m[1]!, body: [] });
      } else if (steps.length > 0) {
        steps[steps.length - 1]!.body.push(line);
      }
    }
    const items = await Promise.all(steps.map(async (s, i) => {
      const bodyHtml = s.body.length ? await renderInner(s.body.join("\n").trim(), codeBlocks) : "";
      return `<div class="step"><div class="step-num">${i + 1}</div><div class="step-body"><div class="step-title">${esc(s.title)}</div>${bodyHtml}</div></div>`;
    }));
    content = content.replace(full, `<div class="steps">${items.join("")}</div>`);
  }
  return content;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

async function processTabs(
  content: string,
  codeBlocks: Map<string, { lang: string; meta: string; code: string }>,
): Promise<string> {
  for (const { full, attrs, inner } of findAll(content, "Tabs")) {
    const group = parseAttrs(attrs)["group"];
    const tabs: { label: string; html: string }[] = [];
    for (const { attrs: ta, inner: ti } of findAll(inner, "Tab")) {
      const label = parseAttrs(ta)["label"] ?? "Tab";
      tabs.push({ label, html: await renderInner(ti.trim(), codeBlocks) });
    }
    const groupAttr = group ? ` data-group="${esc(group)}"` : "";
    const btns = tabs.map((t, i) =>
      `<button class="tab-btn${i === 0 ? " active" : ""}" data-index="${i}">${esc(t.label)}</button>`
    ).join("");
    const panels = tabs.map((t, i) =>
      `<div class="tab-panel${i === 0 ? " active" : ""}" data-index="${i}">${t.html}</div>`
    ).join("");
    content = content.replace(full,
      `<div class="tabs"${groupAttr}><div class="tab-list">${btns}</div><div class="tab-panels">${panels}</div></div>`
    );
  }
  return content;
}

// ── Main renderer ─────────────────────────────────────────────────────────────

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeSlug)
  .use(rehypeAutolinkHeadings, {
    behavior: "append",
    content: { type: "text", value: "#" },
    properties: { class: "heading-anchor", ariaHidden: "true", tabIndex: -1 },
  })
  .use(rehypeStringify, { allowDangerousHtml: true });

async function renderInner(
  content: string,
  codeBlocks: Map<string, { lang: string; meta: string; code: string }>,
): Promise<string> {
  let html = String(await processor.process(content));
  for (const [id, entry] of codeBlocks) {
    const codeHtml = await renderCode(entry.lang, entry.meta, entry.code);
    html = html.replace(new RegExp(`<p>\\s*${id}\\s*</p>`), codeHtml);
    html = html.replace(id, codeHtml);
  }
  return html;
}

export async function renderMdx(content: string): Promise<string> {
  // 1. Extract fenced code blocks and inline code spans so component regexes
  //    don't accidentally match tags inside them.
  const codeBlocks = new Map<string, { lang: string; meta: string; code: string }>();
  const inlineSpans = new Map<string, string>();
  let ci = 0;
  // Fenced code blocks
  content = content.replace(/^([ \t]*)(`{3,})(\w*)(.*)\n([\s\S]*?)\n\1\2[ \t]*$/gm, (_, indent, _fence, lang, meta, code) => {
    const id = `LORECODE${ci++}`;
    const dedented = indent ? code.replace(new RegExp(`^${indent}`, "gm"), "") : code;
    codeBlocks.set(id, { lang, meta: meta.trim(), code: dedented });
    return `\n${id}\n`;
  });
  // Inline code spans (single or multi backtick)
  let ii = 0;
  content = content.replace(/(`+)([^`]|(?!`\1)[^])*?\1/g, (m) => {
    const id = `LOREINLINE${ii++}`;
    inlineSpans.set(id, m);
    return id;
  });

  // 2. Process components
  content = await processCallouts(content, codeBlocks);
  content = processFileTrees(content);
  content = await processSteps(content, codeBlocks);
  content = await processTabs(content, codeBlocks);

  // 3. Restore inline spans, render markdown, restore code blocks
  for (const [id, raw] of inlineSpans) content = content.replace(id, raw);
  return renderInner(content, codeBlocks);
}
