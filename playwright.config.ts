import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },
  // API tests don't need a browser — unit-level route tests use request context
  projects: [
    {
      name: 'api',
      testMatch: '**/api/**/*.spec.ts',
    },
    {
      name: 'e2e',
      testMatch: '**/e2e/**/*.spec.ts',
      use: { browserName: 'chromium' },
    },
  ],
})
