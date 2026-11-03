import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'יומן כיס – מימון',
        short_name: 'יומן מימון',
        description: 'לימוד ושינון נוסחאות מימון, יחסים פיננסיים ומושגים – עובד גם בלי אינטרנט',
        lang: 'he',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#FAE9A6',
        background_color: '#FAE9A6',
        categories: ['education', 'finance'],
        icons: [
          { src: 'icon-48.png', sizes: '48x48', type: 'image/png' },
          { src: 'icon-72.png', sizes: '72x72', type: 'image/png' },
          { src: 'icon-96.png', sizes: '96x96', type: 'image/png' },
          { src: 'icon-128.png', sizes: '128x128', type: 'image/png' },
          { src: 'icon-144.png', sizes: '144x144', type: 'image/png' },
          { src: 'icon-152.png', sizes: '152x152', type: 'image/png' },
          { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-384.png', sizes: '384x384', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 1000 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
