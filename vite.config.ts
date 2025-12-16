import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
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
    plugins: [react()],
    
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
            // Core React libraries
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            // UI framework
            'vendor-ui': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-tabs',
              '@radix-ui/react-select',
              '@radix-ui/react-popover',
            ],
            // Data fetching
            'vendor-query': ['@tanstack/react-query', 'axios'],
            // Maps (large bundle, load separately)
            'vendor-maps': ['leaflet', 'react-leaflet'],
            // Charts (large bundle, load separately)
            'vendor-charts': ['recharts'],
            // Forms
            'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          },
        },
      },
      // Increase chunk size warning limit slightly (maps/charts are large)
      chunkSizeWarningLimit: 600,
    },
  }
}) 