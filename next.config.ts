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
      // The chat moved to /app/chat; old chat links (?c=, ?prompt=) keep working. The query carries over.
      { source: '/app', has: [{ type: 'query', key: 'c' }], destination: '/app/chat', permanent: false },
      { source: '/app', has: [{ type: 'query', key: 'prompt' }], destination: '/app/chat', permanent: false },
      { source: '/app/ideas', destination: '/app', permanent: false },
      { source: '/app/plan', destination: '/app', permanent: false },
    ]
  },
}

export default nextConfig
