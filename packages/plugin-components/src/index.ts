import type { ComponentChildren, JSX } from 'preact'
import { h } from 'preact'
import type { LorePlugin } from '@loredocs/lore'

export interface ComponentsOptions {
  /** Enable Callout component. Defaults to true. */
  callout?: boolean
  /** Enable FileTree component. Defaults to true. */
  fileTree?: boolean
  /** Enable Steps component. Defaults to true. */
  steps?: boolean
  /** Enable Tabs component. Defaults to true. */
  tabs?: boolean
}

/**
 * Built-in MDX components plugin.
 *
 * Registers Callout, FileTree, Steps, and Tabs components
 * usable directly in `.mdx` files.
 */
export function components(options?: ComponentsOptions): LorePlugin {
  const opts = { callout: true, fileTree: true, steps: true, tabs: true, ...options }

  const comps: Record<string, unknown> = {}
  if (opts.callout) comps.Callout = Callout
  if (opts.fileTree) {
    comps.FileTree = FileTree
    comps.File = File
    comps.Folder = Folder
  }
  if (opts.steps) comps.Steps = Steps
  if (opts.tabs) {
    comps.Tabs = Tabs
    comps.Tab = Tab
  }

  return {
    name: 'lore:components',
    components: comps,
    async clientAssets() {
      const css = await Bun.file(`${import.meta.dir}/styles.css`).text()
      return [
        {
          id: 'lore:components:style',
          kind: 'style',
          order: 5,
          content: css,
          inline: true,
        },
      ]
    },
  }
}

// --- Callout ---

type CalloutType = 'note' | 'tip' | 'info' | 'warning' | 'danger'

interface CalloutProps {
  type?: CalloutType
  title?: string
  children?: ComponentChildren
}

function Callout(props: CalloutProps): JSX.Element {
  const type = props.type ?? 'note'
  const title = props.title ?? type.charAt(0).toUpperCase() + type.slice(1)
  const children = props.children

  return h(
    'div',
    { class: `lore-callout lore-callout-${type}`, role: 'alert' },
    h('div', { class: 'lore-callout-title' }, title),
    children ? h('div', { class: 'lore-callout-body' }, children) : null,
  )
}

// --- FileTree ---

interface FileTreeProps {
  children?: ComponentChildren
}

interface FileProps {
  children?: ComponentChildren
}

interface FolderProps {
  name: string
  defaultOpen?: boolean
  children?: ComponentChildren
}

function FileTree(props: FileTreeProps): JSX.Element {
  return h('div', { class: 'lore-file-tree' }, props.children)
}

function File(props: FileProps): JSX.Element {
  return h('div', { class: 'lore-file' }, props.children)
}

function Folder(props: FolderProps): JSX.Element {
  return h(
    'details',
    { class: 'lore-folder', open: props.defaultOpen ? true : undefined },
    h('summary', { class: 'lore-folder-name' }, props.name),
    h('div', { class: 'lore-folder-contents' }, props.children),
  )
}

// --- Steps ---

interface StepsProps {
  children?: ComponentChildren
}

function Steps(props: StepsProps): JSX.Element {
  return h('div', { class: 'lore-steps' }, props.children)
}

// --- Tabs ---
interface TabsProps {
  children?: ComponentChildren
}
interface TabProps {
  label: string
  children?: ComponentChildren
}

let tabGroupCounter = 0

function Tab(_props: TabProps): null {
  return null
}

function Tabs(props: TabsProps): JSX.Element {
  const groupId = `lore-tabs-${++tabGroupCounter}`
  const children = Array.isArray(props.children)
    ? props.children
    : props.children
      ? [props.children]
      : []
  const tabs = children
    .filter((c: unknown) => c && typeof c === 'object' && 'props' in (c as JSX.Element))
    .map((c: unknown) => (c as JSX.Element).props as TabProps)

  const elements: JSX.Element[] = []
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i]
    if (!tab) continue
    elements.push(
      h('input', {
        type: 'radio',
        name: groupId,
        id: `${groupId}-${i}`,
        class: 'lore-tab-input',
        defaultChecked: i === 0,
      }),
    )
    elements.push(
      h('label', { class: 'lore-tab-label', for: `${groupId}-${i}` }, tab.label),
    )
    elements.push(
      h(
        'div',
        {
          class: 'lore-tab-panel',
        },
        tab.children,
      ),
    )
  }
  return h('div', { class: 'lore-tabs' }, ...elements)
}

// Also export for use in MDX (they need to be available as JSX elements)
export { Callout, File, FileTree, Folder, Steps, Tabs }
