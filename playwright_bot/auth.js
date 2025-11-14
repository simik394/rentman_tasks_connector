import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from 'url';

// Use __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTH_FILE = path.join(__dirname, ".auth", "user.json");

/**
 * Programmatically logs into Rentman and saves the authentication state.
 */
export async function programmaticLogin() {
  let { RENTMAN_URL, RENTMAN_USER, RENTMAN_PASSWORD } = process.env;
  if (!RENTMAN_URL || !RENTMAN_USER || !RENTMAN_PASSWORD) {
    throw new Error(
      "Missing environment variables: RENTMAN_URL, RENTMAN_USER, RENTMAN_PASSWORD"
    );
  }

  // Clean the URL of any surrounding quotes
  RENTMAN_URL = RENTMAN_URL.replace(/^"|"$/g, '');

  console.log("Launching browser for authentication...");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log(`Navigating to ${RENTMAN_URL}...`);
    await page.goto(RENTMAN_URL, { waitUntil: 'load' });

    console.log("Waiting for login form...");
    await page.waitForSelector('input[name="email"]', { timeout: 15000 });

    console.log("Attempting to log in...");
    await page.fill('input[name="email"]', RENTMAN_USER);
    await page.fill('input[name="password"]', RENTMAN_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for a few seconds to allow the page to process the login
    await page.waitForTimeout(5000);

    console.log("Navigating to tasks page to verify login...");
    await page.goto(`${RENTMAN_URL}#/tasks`, { waitUntil: 'load' });

    // Wait for a known element on the tasks page
    await page.waitForSelector('[data-qa="add-item"]', { timeout: 30000 });

    console.log("Login successful. Saving authentication state...");
    await context.storageState({ path: AUTH_FILE });

    console.log(`Authentication state saved to ${AUTH_FILE}`);
  } catch (error) {
    console.error("An error occurred during login:", error.message);
    await page.screenshot({ path: path.join(__dirname, 'login_failure.png') });
    console.log("Screenshot of the failure saved to login_failure.png");
    throw error;
  } finally {
    await browser.close();
  }
}
