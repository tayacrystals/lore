/**
 * Markdown-aware versions of Lore's built-in MDX components.
 *
 * These are plain functions (no Preact `h()`) that receive *already-rendered*
 * string children from the custom markdown JSX runtime and return markdown
 * text. They replace the HTML-producing originals when a page is rendered
 * for `.md` output.
 */


// ---------------------------------------------------------------------------
// Callout
// ---------------------------------------------------------------------------

interface CalloutProps {
  type?: 'note' | 'tip' | 'info' | 'warning' | 'danger'
  title?: string
  children?: string
}

export function MarkdownCallout(props: CalloutProps): string {
  const type = props.type ?? 'note'
  const title = props.title ?? type.charAt(0).toUpperCase() + type.slice(1)
  const body = (props.children ?? '').replace(/\n$/, '').split('\n').join('\n> ')
  const emoji: Record<string, string> = {
    note: '\u2139\ufe0f',
    tip: '\ud83d\udca1',
    info: '\u2139\ufe0f',
    warning: '\u26a0\ufe0f',
    danger: '\u26a0\ufe0f',
  }
  return `> ${emoji[type] ?? ''} **${title}**\n> ${body}\n\n`
}

// ---------------------------------------------------------------------------
// Steps → ordered list
// ---------------------------------------------------------------------------

interface StepsProps {
  children?: string
}

export function MarkdownSteps(props: StepsProps): string {
  // Children arrive as raw markdown. We convert heading children to list items.
  const body = (props.children ?? '').trim()
  if (!body) return ''
  // Headings inside steps become numbered items.
  const items: string[] = []
  let counter = 1
  for (const line of body.split('\n')) {
    const heading = line.match(/^#{1,6}\s+(.+)/)
    if (heading) {
      items.push(`${counter}. **${heading[1]}**`)
      counter++
    }
  }
  return items.length ? `${items.join('\n')}\n\n` : `${body}\n\n`
}

// ---------------------------------------------------------------------------
// FileTree → indented listing
// ---------------------------------------------------------------------------

interface FileTreeProps {
  children?: string
}

export function MarkdownFileTree(props: FileTreeProps): string {
  const body = (props.children ?? '').trim()
  if (!body) return ''
  // Children are plain text lines already. Wrap as a code block.
  return `\`\`\`\n${body}\n\`\`\`\n\n`
}

interface FileProps {
  children?: string
}

export function MarkdownFile(props: FileProps): string {
  return (props.children ?? '') as string
}

interface FolderProps {
  name: string
  children?: string
}

export function MarkdownFolder(props: FolderProps): string {
  const body = (props.children ?? '').trim()
  const name = props.name ?? ''
  if (!body) return `📁 ${name}/\n`
  const indented = body.split('\n').map((l) => `  ${l}`).join('\n')
  return `📁 ${name}/\n${indented}\n`
}

// ---------------------------------------------------------------------------
// Tabs → section-per-tab
// ---------------------------------------------------------------------------

interface TabsProps {
  children?: string
}

interface TabProps {
  label: string
  children?: string
}

export function MarkdownTabs(props: TabsProps): string {
  const body = (props.children ?? '').trim()
  return body ? `${body}\n` : ''
}

/** Individual tab content: prefix with a heading showing the label. */
export function MarkdownTab(props: TabProps): string {
  const label = props.label ?? 'Tab'
  const body = (props.children ?? '').trim()
  if (!body) return `### ${label}\n\n`
  return `### ${label}\n\n${body}\n`
}

// ---------------------------------------------------------------------------
// Map of component name → markdown function, matching the plugin-components keys
// ---------------------------------------------------------------------------

export const markdownComponentMap: Record<string, unknown> = {
  Callout: MarkdownCallout,
  Steps: MarkdownSteps,
  Tabs: MarkdownTabs,
  Tab: MarkdownTab,
  FileTree: MarkdownFileTree,
  File: MarkdownFile,
  Folder: MarkdownFolder,
}
