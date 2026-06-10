import type { NextConfig } from 'next'
import withPWA from '@ducanh2912/next-pwa'

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: '/sw.js',
      headers: [
        { key: 'Service-Worker-Allowed', value: '/' },
        { key: 'Cache-Control', value: 'no-cache' },
      ],
    },
  ],
}

export default withPWA({
  dest: 'public',
  register: true,
  // Compiled service worker lives in service-worker/sw-custom.ts
  customWorkerSrc: 'service-worker',
  // Disable in development so Hot Reload works normally
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    // Network-only for API routes — departure data must always be fresh
    runtimeCaching: [
      {
        urlPattern: /^\/api\//,
        handler: 'NetworkOnly',
      },
    ],
  },
})(nextConfig)
