import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import '@fontsource/alata'
import './globals.css'

export const metadata: Metadata = {
  title: 'Atlas',
  description: 'Every calendar. One place.',
  icons: { icon: '/brand/atlas-mark-light.svg' },
}

// Runs before first paint so the page never flashes the wrong theme.
const THEME_SCRIPT = `(function () {
  var theme
  try {
    theme = localStorage.getItem('atlas-theme')
  } catch (e) {}
  if (theme !== 'light' && theme !== 'dark') {
    theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  document.documentElement.dataset.theme = theme
})()`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The theme script changes data-theme before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
