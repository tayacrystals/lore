# Complex Example - Versioning & Internationalization

This example demonstrates Lore's versioning and internationalization features working together.

## Structure

```
complex-example/
├── lore.yml                          # Configuration with both features enabled
├── en/                                # English locale
│   ├── v1/                            # Version 1
│   │   ├── index.mdx                  # Homepage
│   │   ├── installation.mdx           # Installation guide
│   │   └── configuration.mdx          # Configuration guide
│   └── v2/                            # Version 2 (newer)
│       ├── index.mdx                  # Updated homepage
│       ├── installation.mdx           # Updated installation guide
│       ├── configuration.mdx          # Configuration guide
│       └── api.mdx                    # New API guide (v2 only)
└── fr/                                # French locale
    ├── v1/
    │   ├── index.mdx                  # French homepage
    │   ├── installation.mdx           # French installation (with translation-of)
    │   └── configuration.mdx          # French configuration (with translation-of)
    └── v2/
        ├── index.mdx                  # French v2 homepage (with translation-of)
        ├── installation.mdx           # French v2 installation (with translation-of)
        └── api.mdx                    # French API guide (with translation-of)
```

## Features Demonstrated

### 1. Versioning
- Multiple documentation versions (v1, v2)
- Version switcher in header
- Different content per version
- v2 has additional pages (API guide)

### 2. Internationalization
- Multiple languages (English, French)
- Language switcher in header
- Fully translated content
- Locale-aware URLs (`/en/v2/...`, `/fr/v2/...`)

### 3. Translation Links
- `translation-of` frontmatter links related pages
- Language switcher can navigate to equivalent pages
- Works across versions

### 4. Combined Routing
- URLs follow pattern: `/{locale}/{version}/{path}`
- Example: `/fr/v2/installation`
- Root redirects to `/en/v2/` (defaults from config)

## Building

Build the example:

```bash
cd /home/taya/projects/lore-2
bun run build ./complex-example
```

Output will be in `build/` with structure:

```
build/
├── index.html                        # Redirects to /en/v2/
├── en/
│   ├── v1/
│   │   ├── index.html
│   │   ├── installation.html
│   │   └── configuration.html
│   └── v2/
│       ├── index.html
│       ├── installation.html
│       ├── configuration.html
│       └── api.html
└── fr/
    ├── v1/
    │   ├── index.html
    │   ├── installation.html
    │   └── configuration.html
    └── v2/
        ├── index.html
        ├── installation.html
        └── api.html
```

## Development Server

Run with hot reload:

```bash
cd /home/taya/projects/lore-2
bun run dev ./complex-example
```

Visit `http://localhost:3000` - it will redirect to `/en/v2/`.

## Test Navigation

1. Try switching between v1 and v2 using the version switcher
2. Try switching between English and French using the language switcher
3. Notice how v2 has additional content (API guide)
4. Navigate to `/fr/v2/installation` - it links to the English version

## Configuration

The `lore.yml` shows how to enable both features:

```yaml
title: Lore Complex Example
description: A demonstration of versioning and internationalization
color: blue
versioning: true           # Enable versioning
defaultVersion: v2         # Default version
internationalization: true # Enable i18n
defaultLocale: en          # Default locale
```

## Translation Links

French pages use `translation-of` to link to English equivalents:

```yaml
---
translation-of: installation
---

# Guide d'Installation
```

This allows the language switcher to navigate to the equivalent page in other locales.
