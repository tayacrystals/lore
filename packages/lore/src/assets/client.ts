// Lore client: theme toggle, mobile sidebar, and client-side search.
// Compiled from TypeScript during the Lore build — no separate build step.

interface SearchEntry {
  title: string
  description?: string
  text?: string
  url: string
}

;(() => {
  const root = document.documentElement
  const app = document.getElementById('lore-app')!

  // --- theme ---
  const themeBtn = document.querySelector<HTMLElement>('[data-lore-theme]')
  function setTheme(t: string): void {
    root.dataset.theme = t
    try {
      localStorage.setItem('lore-theme', t)
    } catch {
      // ignore storage failures
    }
  }
  themeBtn?.addEventListener('click', () => {
    setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark')
  })

  // --- mobile sidebar ---
  function setSidebar(open?: boolean): void {
    if (open === undefined) open = app.dataset.sidebarOpen !== 'true'
    app.dataset.sidebarOpen = open ? 'true' : 'false'
  }
  document.querySelector('[data-toggle-sidebar]')?.addEventListener('click', () => {
    setSidebar()
  })
  document.querySelector('[data-close-sidebar]')?.addEventListener('click', () => {
    setSidebar(false)
  })

  // --- search ---
  const input = document.querySelector<HTMLInputElement>('[data-lore-search]')
  const results = document.querySelector<HTMLElement>('[data-lore-results]')
  if (!input || !results) return

  let basePath = ''
  let indexPromise: Promise<SearchEntry[]> | null = null
  let entries: SearchEntry[] = []
  let active = -1

  function loadIndex(): Promise<SearchEntry[]> {
    if (!indexPromise) {
      basePath = input!.getAttribute('data-base-path') || ''
      const indexUrl =
        input!.getAttribute('data-index-url') ||
        (basePath
          ? `${basePath}/__lore__/search-index.json`
          : '/__lore__/search-index.json')
      indexPromise = fetch(indexUrl)
        .then((r) => (r.ok ? r.json() : ([] as SearchEntry[])))
        .catch(() => [] as SearchEntry[])
        .then((d: SearchEntry[]) => {
          entries = d || []
          return entries
        })
    }
    return indexPromise
  }

  function score(page: SearchEntry, terms: string[]): number {
    const title = (page.title || '').toLowerCase()
    const desc = (page.description || '').toLowerCase()
    const text = (page.text || '').toLowerCase()
    let total = 0
    for (let i = 0; i < terms.length; i++) {
      const t = terms[i]
      if (!t) continue
      let hit = false
      if (title.indexOf(t) !== -1) {
        total += 10
        hit = true
      }
      if (desc.indexOf(t) !== -1) {
        total += 4
        hit = true
      }
      if (text.indexOf(t) !== -1) {
        total += 1
        hit = true
      }
      if (!hit) return 0
    }
    return total
  }

  function escapeHtml(s: string): string {
    return String(s).replace(
      /[&<>"']/g,
      (c: string) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c] ?? c,
    )
  }

  function render(q: string): void {
    const terms = q.toLowerCase().split(/\s+/)
    const scored: Array<[number, SearchEntry]> = []
    for (let i = 0; i < entries.length; i++) {
      const s = score(entries[i]!, terms)
      if (s > 0) scored.push([s, entries[i]!])
    }
    scored.sort((a, b) => b[0] - a[0])
    scored.length = Math.min(scored.length, 8)

    active = scored.length ? 0 : -1
    if (!scored.length) {
      results!.innerHTML = `<div class="lore-search-empty">No results for "${escapeHtml(q)}"</div>`
      results!.dataset.open = 'true'
      return
    }
    let html = ''
    for (let i = 0; i < scored.length; i++) {
      const p = scored[i]![1]
      const url = basePath ? basePath + p.url : p.url
      html +=
        '<a href="' +
        url +
        '">' +
        '<div class="title">' +
        escapeHtml(p.title) +
        '</div>' +
        (p.description ? `<div class="desc">${escapeHtml(p.description)}</div>` : '') +
        '</a>'
    }
    results!.innerHTML = html
    results!.dataset.open = 'true'
    markActive()
  }

  function markActive(): void {
    const links = results!.querySelectorAll('a')
    for (let i = 0; i < links.length; i++) {
      links[i]!.dataset.active = i === active ? 'true' : 'false'
    }
  }

  function moveActive(delta: number): void {
    const links = results!.querySelectorAll('a')
    if (!links.length) return
    active = (active + delta + links.length) % links.length
    markActive()
    links[active]!.scrollIntoView({ block: 'nearest' })
  }

  input!.addEventListener('focus', () => {
    void loadIndex()
  })
  input!.addEventListener('input', () => {
    const q = input!.value.trim()
    if (!q) {
      results!.dataset.open = 'false'
      return
    }
    loadIndex().then(() => {
      render(q)
    })
  })
  input!.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveActive(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveActive(-1)
    } else if (e.key === 'Enter') {
      const link = results!.querySelector<HTMLAnchorElement>('a[data-active="true"]')
      if (link) window.location.href = link.getAttribute('href')!
    } else if (e.key === 'Escape') {
      results!.dataset.open = 'false'
      input!.blur()
    }
  })
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement | null
    if (!target?.closest('#lore-search')) results!.dataset.open = 'false'
  })

  // Version switcher
  document
    .querySelector<HTMLSelectElement>('[data-lore-version-switcher]')
    ?.addEventListener('change', function (this: HTMLSelectElement) {
      if (this.value) window.location.href = this.value
    })
  // Locale switcher
  document
    .querySelector<HTMLSelectElement>('[data-lore-locale-switcher]')
    ?.addEventListener('change', function (this: HTMLSelectElement) {
      if (this.value) window.location.href = this.value
    })
})()
