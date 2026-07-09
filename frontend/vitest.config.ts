import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  // Vitest uses esbuild for transforms — no React plugin needed,
  // just tell esbuild to use the automatic JSX runtime.
  esbuild: { jsx: 'automatic' },
  // Override postcss.config.mjs — @tailwindcss/postcss is incompatible with Vite 5.
  // Tests don't need CSS processing at all.
  css: { postcss: {} },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    clearMocks: true,
  },
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
})
