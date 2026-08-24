import { defineConfig, devices } from '@playwright/test';

const backendHealthUrl = 'http://127.0.0.1:3000/api/health';
const frontendUrl = 'http://127.0.0.1:4200';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: frontendUrl,
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
      url: backendHealthUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 180000,
    },
    {
      // Playwright launches array entries concurrently. Gate Angular on NestJS
      // readiness so SSR HttpClient requests cannot race the backend boot and
      // flood QA output with undici AggregateError/ECONNREFUSED failures.
      command:
        'E2E_BACKEND_HEALTH_URL=http://127.0.0.1:3000/api/health node ./backend-readiness.mjs && cd ../frontend && npm run start -- --host 127.0.0.1',
      url: frontendUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 300000,
    },
  ],
});
