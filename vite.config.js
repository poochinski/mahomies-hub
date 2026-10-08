import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// In Codespaces, run the server (npm run dev:server, port 3000) and Vite
// (npm run dev, port 5173) side by side. Vite forwards /api calls to the server.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: "Mahomie's Hub",
        short_name: "Mahomie's Hub",
        description: "Rollin' with Mahomies league HQ: history, stats and the Banana Book.",
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#2f3238',
        background_color: '#ececef',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Never cache API responses; league data must always be fresh.
        navigateFallbackDenylist: [/^\/api/],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}']
      }
    })
  ],
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
});
