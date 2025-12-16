import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@spannerwork/shared': path.resolve(__dirname, './packages/shared/dist'),
    },
    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    css: true,
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    exclude: ['backend/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      exclude: [
        'backend/**',
        'node_modules/**',
        'dist/**',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/setupTests.ts',
        'src/pages/index.tsx', // Router with lazy imports - not practical to unit test
        'src/pages/guides/**', // Static content/documentation pages
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
})
