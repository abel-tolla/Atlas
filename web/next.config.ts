import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Pages are never cached, so the back button can't show private data after log out (#210).
        source: '/((?!_next/static|_next/image|brand/|favicon\\.ico).*)',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ]
  },
}

export default nextConfig
