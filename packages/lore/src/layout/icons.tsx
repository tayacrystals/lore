/** Minimal inline SVG icons (stroke = currentColor). */
import type { JSX } from 'preact'

const svg = (path: JSX.Element): JSX.Element => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    {path}
  </svg>
)

export const SearchIcon = () =>
  svg(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>,
  )
export const SunIcon = () =>
  svg(
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>,
  )
export const MoonIcon = () => svg(<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />)
export const MenuIcon = () => svg(<path d="M3 6h18M3 12h18M3 18h18" />)
export const CaretIcon = () => svg(<path d="m6 9 6 6 6-6" />)
export const ArrowIcon = ({ dir }: { dir: 'left' | 'right' }) =>
  dir === 'left'
    ? svg(<path d="M19 12H5M12 19l-7-7 7-7" />)
    : svg(<path d="M5 12h14M12 5l7 7-7 7" />)
