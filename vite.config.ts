import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables
  const env = loadEnv(mode, process.cwd(), '')

  // CDN base URL for production (optional)
  const cdnBase = env.VITE_CDN_URL || ''

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'script-defer', // Defer SW registration to avoid render blocking
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icons/*.png'],
        manifest: false, // We use our own manifest.json
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            // CRITICAL: Never cache CSRF tokens - must always be fresh
            // This prevents stale token issues after login/logout
            {
              urlPattern: /\/api\/v1\/csrf-token/i,
              handler: 'NetworkOnly',
            },
            // CRITICAL: Never cache messages - must always be fresh
            // This ensures sent/received messages appear immediately
            {
              urlPattern: /\/api\/v1\/messages/i,
              handler: 'NetworkOnly',
            },
            // CRITICAL: Never cache feed (requests) - must always be fresh
            // This ensures newly posted jobs appear immediately
            {
              urlPattern: /\/api\/v1\/requests/i,
              handler: 'NetworkOnly',
            },
            // CRITICAL: Never cache transactions - must always be fresh
            {
              urlPattern: /\/api\/v1\/transactions/i,
              handler: 'NetworkOnly',
            },
            // CRITICAL: Never cache user listings/tools/spaces/services/reviews
            // These are dynamic content that must always show fresh data
            {
              urlPattern: /\/api\/v1\/users\/[^/]+\/listings/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /\/api\/v1\/users\/[^/]+\/tools/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /\/api\/v1\/users\/[^/]+\/spaces/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /\/api\/v1\/users\/[^/]+\/services/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /\/api\/v1\/users\/[^/]+\/reviews/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /\/api\/v1\/users\/[^/]+\/transactions/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/api\./i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24, // 24 hours
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\/api\//i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 5, // 5 minutes
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'image-cache',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    
    // Use CDN for static assets in production
    base: mode === 'production' && cdnBase ? cdnBase : '/',
    
    server: {
      allowedHosts: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          ws: true,
        },
        // Proxy /uploads to the backend server
        '/uploads': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@spannerwork/shared': path.resolve(__dirname, './packages/shared/dist'),
      },
      extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json']
    },
    build: {
      // Optimize chunk splitting for better caching
      rollupOptions: {
        output: {
          manualChunks: {
            // Core React libraries - loaded immediately
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            // UI framework - all Radix components
            'vendor-ui': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-tabs',
              '@radix-ui/react-select',
              '@radix-ui/react-popover',
              '@radix-ui/react-tooltip',
              '@radix-ui/react-accordion',
              '@radix-ui/react-avatar',
              '@radix-ui/react-checkbox',
              '@radix-ui/react-switch',
              '@radix-ui/react-slider',
              '@radix-ui/react-scroll-area',
            ],
            // Data fetching
            'vendor-query': ['@tanstack/react-query', 'axios'],
            // Maps (large bundle, load separately)
            'vendor-maps': ['leaflet', 'react-leaflet'],
            // Forms
            'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
            // Date utilities (used across many pages)
            'vendor-date': ['date-fns'],
            // Animation (framer-motion is large)
            'vendor-animation': ['framer-motion'],
            // Payment (only needed on payment pages)
            'vendor-stripe': ['@stripe/stripe-js', '@stripe/react-stripe-js'],
            // Real-time (socket.io for messages)
            'vendor-socket': ['socket.io-client'],
            // Note: recharts is NOT in manualChunks - let Vite handle it naturally
            // This prevents shared deps (clsx) from being bundled incorrectly
          },
        },
      },
      // Increase chunk size warning limit slightly (maps/charts are large)
      chunkSizeWarningLimit: 600,
      // Enable source maps for production debugging (optional)
      sourcemap: false,
      // Minify with esbuild (faster than terser)
      minify: 'esbuild',
      // Target modern browsers for smaller output
      target: 'es2020',
    },
  }
}) 