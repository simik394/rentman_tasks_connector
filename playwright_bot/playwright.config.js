// @ts-check
import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';

// Načtení .env souboru pro přístup k proměnným
dotenv.config({ path: path.resolve(process.cwd(), 'playwright_bot', '.env') });


export const STORAGE_STATE = path.join(process.cwd(), 'playwright_bot', 'auth.json');

export default defineConfig({
  testDir: './tests',
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: true,
  reporter: 'html',

  use: {
    actionTimeout: 0,
    baseURL: process.env.RENTMAN_URL,
    trace: 'on-first-retry',
    headless: true, // Změňte na false pro headed režim (`npm run test:headed`)
    channel: 'chrome',
    launchOptions: {
      args: ["--no-sandbox"]
    },
  },

  projects: [
    // Projekt pro autentizaci
    { name: 'setup', testMatch: /auth\.setup\.js/ },

    // Hlavní projekt, který používá uložený stav
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
    },
  ],
});
