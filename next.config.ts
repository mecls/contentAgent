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
}

export default nextConfig
