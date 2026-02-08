# Lore

A modern, Fumadocs-inspired documentation site template built with Astro 5, Tailwind CSS v4, and MDX.

## ✨ Features

- 🚀 **Lightning Fast** — Built on Astro's zero-JS architecture with partial hydration
- 🌙 **Dark Mode** — Seamless dark/light theme switching with system preference detection
- 📝 **MDX Support** — Rich content authoring with custom components (Callouts, Tabs, Steps, Cards)
- 🔍 **Full-Text Search** — Fast client-side search powered by Pagefind (Cmd+K / Ctrl+K)
- 🎨 **Tailwind CSS v4** — Modern CSS-first configuration using @theme design tokens
- 📱 **Fully Responsive** — Three-column docs layout that adapts to any screen size
- 🎯 **Type-Safe** — Content collections with Zod schema validation
- 💅 **Syntax Highlighting** — Beautiful code blocks via Expressive Code
- 🗺️ **Auto-Generated** — Sidebar, table of contents, and prev/next navigation
- ♿ **Accessible** — Semantic HTML with ARIA labels and keyboard navigation

## 🏗️ Project Structure

```
├── src/
│   ├── content/
│   │   └── docs/              # MDX documentation pages
│   │       ├── index.mdx
│   │       ├── getting-started/
│   │       └── guides/
│   ├── components/
│   │   ├── global/            # Navbar, Footer, Theme toggle, Search
│   │   ├── docs/              # Sidebar, TOC, Breadcrumbs, PrevNext
│   │   ├── mdx/               # Callout, Card, Tabs, Steps, Accordion
│   │   └── home/              # Hero, Features, CodeDemo, Testimonials
│   ├── layouts/
│   │   ├── BaseLayout.astro   # Root layout with dark mode script
│   │   ├── DocsLayout.astro   # 3-column docs layout
│   │   └── HomeLayout.astro   # Landing page layout
│   ├── pages/
│   │   ├── index.astro        # Homepage
│   │   ├── docs/[...slug].astro # Dynamic docs routes
│   │   └── 404.astro
│   ├── styles/
│   │   ├── global.css         # Tailwind v4 @theme tokens + base styles
│   │   └── prose.css          # MDX typography styles
│   ├── utils/
│   │   ├── sidebar.ts         # Sidebar tree builder
│   │   ├── toc.ts             # Table of contents generator
│   │   └── navigation.ts      # Prev/next page navigation
│   ├── data/
│   │   └── navigation.ts      # Navigation config
│   └── content.config.ts      # Content collection schema
├── public/                    # Static assets
├── astro.config.mjs          # Astro configuration
└── package.json
```

## 🚀 Quick Start

1. **Install dependencies**

   ```bash
   bun install
   # or
   npm install
   # or
   pnpm install
   ```

2. **Start development server**

   ```bash
   bun run dev
   ```

   Open [http://localhost:4321](http://localhost:4321) in your browser.

3. **Build for production**

   ```bash
   bun run build
   ```

4. **Preview production build**

   ```bash
   bun run preview
   ```

## 📝 Writing Documentation

### Creating Pages

Add `.mdx` files to `src/content/docs/`:

```mdx
---
title: My Page
description: A brief description
order: 1
group: guides  # Optional: for grouping in sidebar
---

Your content here...
```

### Using Components

Import and use custom components in your MDX:

```mdx
import Callout from '../../../components/mdx/Callout.astro';

<Callout type="tip">
  This is a helpful tip!
</Callout>
```

Available components:
- **Callout** — Note, tip, warning, danger alerts
- **Card & CardGrid** — Link cards with icons
- **Tabs & Tab** — Tabbed content switcher
- **Steps & Step** — Numbered sequential instructions
- **Accordion** — Collapsible content sections

See the `/docs/guides/components` page for full examples.

## 🎨 Customization

### Design Tokens

Edit `src/styles/global.css` to customize colors, fonts, and spacing:

```css
@theme {
  --color-fd-primary: oklch(0.623 0.214 259);
  --color-fd-background: oklch(1 0 0);
  --font-sans: "Inter Variable", sans-serif;
  /* ... */
}
```

### Navigation

Configure top navigation and sidebar groups in `src/data/navigation.ts`:

```typescript
export const topNav: NavLink[] = [
  { label: "Docs", href: "/docs" },
  { label: "Guides", href: "/docs/guides/writing-content" },
];

export const sidebarGroups: SidebarConfig = {
  "getting-started": { label: "Getting Started", order: 1 },
  guides: { label: "Guides", order: 2 },
};
```

## 🔧 Tech Stack

- **Framework:** [Astro 5](https://astro.build)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com)
- **Content:** [MDX](https://mdxjs.com) + [Content Layer API](https://docs.astro.build/en/guides/content-collections/)
- **Code Highlighting:** [Expressive Code](https://expressive-code.com)
- **Search:** [Pagefind](https://pagefind.app) via [astro-pagefind](https://github.com/shishkin/astro-pagefind)
- **Icons:** [astro-icon](https://github.com/natemoo-re/astro-icon) + [Lucide](https://lucide.dev)
- **Fonts:** [Inter Variable](https://rsms.me/inter/) + [Geist Mono](https://vercel.com/font)

## 📄 License

MIT

## 🙏 Acknowledgments

Inspired by [Fumadocs](https://www.fumadocs.dev) — a beautiful documentation framework.
