/**
 * A custom JSX runtime that produces Markdown strings instead of Preact VNodes.
 *
 * Designed to be swapped into `run(String(code), runtime)` in place of
 * `preact/jsx-runtime`. Handles:
 *
 *   - String tag names (`'h1'`, `'p'`, `'strong'`, …) → markdown syntax
 *   - Function components → calls them with already-rendered string children
 *   - Fragment → concatenates children
 *   - `components` prop (MDX component overrides) → resolved before call
 *
 * Limitations (v1):
 *   - Components that use Preact hooks (`useState`, `useMemo`) won't work.
 *     Lore-2's built-in components don't use hooks, so this is fine.
 *   - User components that return Preact `h()` VNodes produce empty output
 *     for that element (children still pass through since they were rendered
 *     by this runtime).
 */

const Fragment = Symbol('mdFragment')

/** Render a JSX tree to a Markdown string. */
export function mdJsx(
  type: string | symbol | ((props: Record<string, unknown>) => unknown),
  props: Record<string, unknown>,
  _key?: string,
): string {
  // --- Fragment: join children ---
  if (type === Fragment) return renderChildren(props.children)

  // --- Function component: call with string children ---
  if (typeof type === 'function') {
    const resolved: Record<string, unknown> = { ...props }
    if (props.children !== undefined) {
      resolved.children = renderChildren(props.children)
    }
    const result = type(resolved)
    return typeof result === 'string' ? result : renderChildren(result)
  }

  // --- String tag: convert to Markdown ---
  return elementToMarkdown(type as string, props)
}

/** Alias — the runtime is the same for static and dynamic children. */
export const mdJsxs = mdJsx

export { Fragment as mdFragment }

// ---------------------------------------------------------------------------
// Element → Markdown mapping
// ---------------------------------------------------------------------------

type MdHandler = (props: Record<string, unknown>) => string

const TAG_HANDLERS: Record<string, MdHandler> = {
  h1:  (p) => `# ${renderChildren(p.children)}\n\n`,
  h2:  (p) => `## ${renderChildren(p.children)}\n\n`,
  h3:  (p) => `### ${renderChildren(p.children)}\n\n`,
  h4:  (p) => `#### ${renderChildren(p.children)}\n\n`,
  h5:  (p) => `##### ${renderChildren(p.children)}\n\n`,
  h6:  (p) => `###### ${renderChildren(p.children)}\n\n`,

  p:   (p) => `${renderChildren(p.children)}\n\n`,

  strong: (p) => `**${renderChildren(p.children)}**`,
  em:     (p) => `*${renderChildren(p.children)}*`,
  b:      (p) => `**${renderChildren(p.children)}**`,
  i:      (p) => `*${renderChildren(p.children)}*`,
  s:      (p) => `~~${renderChildren(p.children)}~~`,
  del:    (p) => `~~${renderChildren(p.children)}~~`,

  code: (p) => `\`${renderChildren(p.children)}\``,

  a:   (p) => `[${renderChildren(p.children)}](${p.href ?? ''})`,
  img: (p) => `![${p.alt ?? ''}](${p.src ?? ''})`,

  hr:  () => `---\n\n`,

  blockquote: (p) =>
    `> ${renderChildren(p.children).replace(/\n$/, '').split('\n').join('\n> ')}\n\n`,

  pre: (p) => renderCodeBlock(p),

  ul:  (p) => renderList(p.children, '-'),
  ol:  (p) => renderList(p.children, 'ordered'),
  li:  (p) => renderListItem(p, 0),

  table: (p) => renderTable(p),
}

function elementToMarkdown(tag: string, props: Record<string, unknown>): string {
  const handler = TAG_HANDLERS[tag]
  if (handler) return handler(props)
  // Unknown HTML element — transparent wrapper, render children.
  return renderChildren(props.children)
}

// ---------------------------------------------------------------------------
// Children
// ---------------------------------------------------------------------------

function renderChildren(children: unknown): string {
  if (children == null) return ''
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map((c) => renderChildren(c)).join('')
  return ''
}

// ---------------------------------------------------------------------------
// Code blocks
// ---------------------------------------------------------------------------

function renderCodeBlock(props: Record<string, unknown>): string {
  let code = renderChildren(props.children)
  // The MDX compiler wraps <pre> children in a <code> element.
  // Extract the actual code text.
  if (code.startsWith('`') && code.endsWith('`')) {
    code = code.slice(1, -1)
  }
  const lang = (props as Record<string, string>).className?.[0]?.replace(/^language-/, '') ?? ''
  return `\`\`\`${lang}\n${code.replace(/\n$/, '')}\n\`\`\`\n\n`
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

function renderList(children: unknown, marker: string | 'ordered'): string {
  const items = Array.isArray(children) ? children : [children]
  const lines: string[] = []
  let counter = 1
  for (const item of items) {
    const text = renderChildren(item).trim()
    if (!text) continue
    const prefix = marker === 'ordered' ? `${counter}.` : marker
    lines.push(indentListItem(text, prefix))
    counter++
  }
  return `${lines.join('\n')}\n\n`
}

function renderListItem(props: Record<string, unknown>, _depth: number): string {
  // List item content
  let content: string
  if (props.children !== undefined) {
    // Children may include nested lists; flatten them.
    const kids = Array.isArray(props.children) ? props.children : [props.children]
    content = kids.map((c: unknown) => {
      const text = renderChildren(c)
      // If a child is itself a list render, preserve its structure.
      return text
    }).join('')
  } else {
    content = ''
  }
  return content
}

function indentListItem(text: string, prefix: string): string {
  const lines = text.split('\n')
  const first = `${prefix} ${lines[0] ?? ''}`
  const rest = lines.slice(1).map((l) => `  ${l}`).join('\n')
  return rest ? `${first}\n${rest}` : first
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

function renderTable(props: Record<string, unknown>): string {
  return renderTableSimple(props)
}

function renderTableSimple(props: Record<string, unknown>): string {
  const children = asArray(props.children)
  const rows: string[][] = []
  for (const child of children) {
    const text = renderChildren(child)
    const cells = text.split('|').map((c) => c.trim()).filter(Boolean)
    if (cells.length) rows.push(cells)
  }
  if (rows.length === 0) return ''
  const colCount = Math.max(...rows.map((r) => r.length))
  const header = `| ${rows[0]!.join(' | ')} |`
  const sep = `| ${Array(colCount).fill('---').join(' | ')} |`
  const body = rows.slice(1).map((r) => `| ${r.join(' | ')} |`).join('\n')
  return `${header}\n${sep}\n${body}\n\n`
}

function asArray(v: unknown): unknown[] {
  if (v == null) return []
  if (Array.isArray(v)) return v
  return [v]
}
