'use client'

import { useEffect } from 'react'

/** Removes one-time parameters (error, code, reset, token) from the address bar once the page has read them. */
export function CleanUrl({ params }: { params: string[] }) {
  useEffect(() => {
    const url = new URL(window.location.href)
    if (params.some((p) => url.searchParams.has(p))) {
      params.forEach((p) => url.searchParams.delete(p))
      window.history.replaceState(null, '', url)
    }
  }, [params])
  return null
}
