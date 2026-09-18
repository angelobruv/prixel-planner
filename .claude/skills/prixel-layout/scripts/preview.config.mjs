import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
export default defineConfig({
  testDir: dirname(fileURLToPath(import.meta.url)),
  testMatch: 'preview.spec.mjs',
  reporter: [['line']],
  use: {
    baseURL: process.env.PRIXEL_URL || 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 1000 },
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {},
  },
})
