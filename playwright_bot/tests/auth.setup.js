import { test as setup, expect } from '@playwright/test';
import { STORAGE_STATE } from '../playwright.config.js';

const { RENTMAN_URL, RENTMAN_USER, RENTMAN_PASSWORD } = process.env;

setup('authenticate', async ({ page }) => {
  console.log("Authenticating...");
  await page.goto(RENTMAN_URL);

  console.log("Filling login credentials...");
  await page.fill('input#email', RENTMAN_USER);
  await page.fill('input#password', RENTMAN_PASSWORD);

  console.log("Submitting login form...");
  await page.click('button[type="submit"]');

  // Čekání na přihlášení - toto je místo, které vyžaduje vaši pozornost.
  // Musíte najít spolehlivý selektor nebo událost, která potvrdí úspěšné přihlášení.
  // Příklad: čekání na URL, které se objeví po přihlášení.
  await page.waitForURL('**/dashboard/**', { timeout: 30000 });

  // Můžete také zkusit čekat na zmizení načítacího indikátoru, pokud se objeví
  // await page.waitForSelector('#rm-loading-indicator', { state: 'hidden', timeout: 30000 });

  console.log("Login appears successful. Saving storage state...");
  await page.context().storageState({ path: STORAGE_STATE });
  console.log(`Storage state saved to ${STORAGE_STATE}`);
});
