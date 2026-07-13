import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@dr-code\/viewer$/,
        replacement: new URL(
          './src/test/dr-code-viewer-mock.tsx',
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@dr-code\/viewer\/styles.css$/,
        replacement: new URL(
          './node_modules/@dr-code/viewer/src/styles.css',
          import.meta.url,
        ).pathname,
      },
      {
        find: '@',
        replacement: new URL('./src', import.meta.url).pathname,
      },
    ],
  },
  test: {
    environment: 'jsdom',
    exclude: ['e2e/**', '**/node_modules/**', '**/dist/**', '.worktrees/**'],
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
