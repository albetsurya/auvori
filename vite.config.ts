import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const APP_VERSION = process.env.npm_package_version || '1.0.0';
const CACHE_VERSION = `v${APP_VERSION}-${Date.now()}`;

export default defineConfig({
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,svg,png,woff2,webp,wasm,mjs,bin,json,ico}'
        ],
        maximumFileSizeToCacheInBytes: 50 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /\.(?:onnx|wasm|mjs|bin|json)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'auvori-ai-models-v1',
              expiration: {
                maxEntries: 24,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          },
          {
            urlPattern: /\/assets\/(?:collections|signature-looks|studio-samples)\/.*\.(?:webp|png|jpg)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: `auvori-static-assets-${CACHE_VERSION}`,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 365
              }
            }
          },
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: `auvori-navigation-${CACHE_VERSION}`,
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7
              }
            }
          }
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/models\//,
          /^\/assets\//,
          /\.webmanifest$/,
          /\.svg$/,
          /\.(?:js|css|png|woff2|webp|wasm|mjs|bin|json)$/
        ]
      },
      manifest: {
        name: 'Auvori — Personal Photo Styling Studio',
        short_name: 'Auvori',
        description: 'Make every frame count. Personal photo styling & color grading studio directly in your browser.',
        theme_color: '#F2F2ED',
        background_color: '#F2F2ED',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
});