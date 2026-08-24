import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-english',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'en-GB',
      },
    },
    {
      name: 'rtl-arabic',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'ar-SA',
        extraHTTPHeaders: {
          'Accept-Language': 'ar-SA,ar;q=0.9',
        },
      },
    },
    {
      name: 'rtl-hebrew',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'he-IL',
        extraHTTPHeaders: {
          'Accept-Language': 'he-IL,he;q=0.9',
        },
      },
    },
    {
      name: 'mobile-safari-english',
      use: {
        ...devices['iPhone 14'],
        locale: 'en-GB',
      },
    },
  ],
  webServer: [
    {
      command: 'cd ../backend && npm run build && node dist/main',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 180000,
    },
    {
      command: 'cd ../frontend && npm run build && npm run start -- --host 127.0.0.1',
      url: 'http://localhost:4200',
      reuseExistingServer: !process.env.CI,
      timeout: 300000,
    },
  ],
});
