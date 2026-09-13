import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The agent route streams meaningful server work and the chat payloads (plus
  // future scraped-post analysis) can be sizeable — keep server action bodies
  // generous.
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
  // Ideas and Weekly plan were removed. Not permanent on purpose: a browser-cached
  // 308 would keep redirecting even after a revert.
  async redirects() {
    return [
      { source: '/app/ideas', destination: '/app', permanent: false },
      { source: '/app/plan', destination: '/app', permanent: false },
    ]
  },
}

export default nextConfig
