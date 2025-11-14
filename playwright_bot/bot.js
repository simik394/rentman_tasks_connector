import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from 'url';
import "dotenv/config";
import { programmaticLogin } from "./auth.js";
import fs from "fs";

// Use __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTH_FILE = path.join(__dirname, ".auth", "user.json");

// --- Funkce ---

/**
 * Creates a new task in Rentman.
 * @param {import('playwright').Page} page
 * @param {object} taskData
 */
async function createTask(page, taskData) {
  let rentmanUrl = process.env.RENTMAN_URL;
  if (!rentmanUrl) {
    throw new Error("RENTMAN_URL environment variable must be set.");
  }
  rentmanUrl = rentmanUrl.replace(/^"|"$/g, '');
  const tasksUrl = `${rentmanUrl}#/tasks`;

  console.log(`Navigating to tasks page: ${tasksUrl}`);
  await page.goto(tasksUrl);

  console.log('Clicking "Add task" button...');
  await page.click('[data-qa="add-item"]');

  console.log("Waiting for task modal...");
  await page.waitForSelector('[data-testid="task-form-title-input"]');

  console.log(`Filling task title for YouTrack ID: ${taskData.youtrackId}`);
  const taskTitle = `[${taskData.youtrackId}] ${taskData.title}`;
  await page.fill('[data-testid="task-form-title-input"]', taskTitle);

  if (taskData.assignee) {
    console.log(`Assigning to: ${taskData.assignee}`);
    await page.click('[data-testid="task-form-assignees-select"]');
    await page.waitForSelector('input[placeholder="Hledat..."]');
    await page.fill('input[placeholder="Hledat..."]', taskData.assignee);
    await page.click(`div.user-list-item:has-text("${taskData.assignee}")`);
  }

  if (taskData.deadline) {
    console.log(`Setting deadline to: ${taskData.deadline}`);
    const deadline = new Date(taskData.deadline);
    const day = String(deadline.getDate()).padStart(2, "0");
    const month = String(deadline.getMonth() + 1).padStart(2, "0");
    const year = deadline.getFullYear();
    const date = `${day}-${month}-${year}`;

    const hours = String(deadline.getHours()).padStart(2, "0");
    const minutes = String(deadline.getMinutes()).padStart(2, "0");
    const time = `${hours}:${minutes}`;

    await page.click('[data-testid="task-form-deadline-select"]');
    await page.waitForSelector('input[name="date"]');
    await page.fill('input[name="date"]', date);
    await page.fill('input[name="time"]', time);
    await page.click('button:has-text("Uložit")');
  }

  console.log("Saving the task...");
  await page.click('button[data-qa="modal-save"]:has-text("Confirm")');
  console.log("Task created successfully.");
}

/**
 * Scrapes completed tasks from the Rentman tasks table view, handling virtual scrolling.
 * @param {import('playwright').Page} page
 * @returns {Promise<string[]>} A list of YouTrack issue IDs from completed tasks.
 */
async function scrapeDoneTasks(page) {
  let rentmanUrl = process.env.RENTMAN_URL;
  if (!rentmanUrl) {
    throw new Error("RENTMAN_URL environment variable must be set.");
  }
  rentmanUrl = rentmanUrl.replace(/^"|"$/g, '');
  const tasksUrl = `${rentmanUrl}#/tasks`;

  console.log(`Navigating to tasks page: ${tasksUrl}`);
  await page.goto(tasksUrl);

  console.log("Waiting for task grid to load...");
  await page.waitForSelector('.ui-grid-canvas .ui-grid-row', { timeout: 30000 });

  const youtrackIds = new Set(); // Use a Set to automatically handle duplicates
  const processedRowIds = new Set();
  const idRegex = /\[([A-Z0-9]+-[0-9]+)\]/;

  const viewportSelector = '.ui-grid-render-container-body .ui-grid-viewport';

  let lastScrollHeight = -1;
  // Loop to handle virtual scrolling
  while (true) {
    const bodyRows = await page.locator('.ui-grid-render-container-body .ui-grid-row').all();

    console.log(`Processing ${bodyRows.length} visible rows...`);

    for (const row of bodyRows) {
        const rowIdElement = row.locator('div[rowid]');
        const rowId = await rowIdElement.getAttribute('rowid');

        // Skip if we've already processed this row
        if (!rowId || processedRowIds.has(rowId)) {
            continue;
        }

        const completedOnCell = row.locator('.ui-grid-coluiGrid-000C .ui-grid-cell-contents__overflow-container');
        // Use catch to prevent timeouts on rows that might be disappearing during scroll
        const completedOnText = await completedOnCell.textContent({ timeout: 1000 }).catch(() => null);

        if (completedOnText && completedOnText.trim() !== '--/--/---- --:--') {
            console.log(`Found completed task in row ${rowId} with date "${completedOnText.trim()}".`);

            const leftRow = page.locator(`.ui-grid-render-container-left div[rowid="${rowId}"]`);
            const titleCell = leftRow.locator('.ui-grid-cell-contents--title-cell-contents');
            const title = await titleCell.getAttribute('title');

            if (title) {
                const match = title.match(idRegex);
                if (match && match[1]) {
                    console.log(`Extracted YouTrack ID: ${match[1]}`);
                    youtrackIds.add(match[1]);
                }
            }
        }

        processedRowIds.add(rowId);
    }

    // Scroll down inside the virtual viewport and get current scroll height
    const currentScrollHeight = await page.evaluate((selector) => {
        const viewport = document.querySelector(selector);
        if (viewport) {
            const height = viewport.scrollHeight;
            viewport.scrollTop = height;
            return height;
        }
        return -1;
    }, viewportSelector);

    // Wait for a moment to let new content load
    await page.waitForTimeout(2000);

    // If the scroll height hasn't changed, we're at the bottom.
    if (currentScrollHeight === lastScrollHeight) {
        console.log("Scroll height hasn't changed. Assuming end of list.");
        break;
    }
    lastScrollHeight = currentScrollHeight;
  }

  const finalIds = Array.from(youtrackIds);
  console.log(`Extracted a total of ${finalIds.length} unique YouTrack IDs: ${JSON.stringify(finalIds)}`);
  return finalIds;
}

// --- Hlavní Dispatcher ---
(async () => {
  const command = process.argv[2];

  try {
    if (command === "login") {
      await programmaticLogin();
      return;
    }

    if (!fs.existsSync(AUTH_FILE)) {
        throw new Error(`Authentication file not found at ${AUTH_FILE}. Please run the 'login' command first.`);
    }

    // For other commands, launch a new browser with the saved storage state
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox"],
    });
    const context = await browser.newContext({ storageState: AUTH_FILE });
    const page = await context.newPage();

    const dataArg = process.argv.find((arg) => arg.startsWith("--data="));
    const taskData = dataArg
      ? JSON.parse(dataArg.substring("--data=".length))
      : {};

    switch (command) {
      case "createTask":
        await createTask(page, taskData);
        console.log(
          JSON.stringify({
            status: "success",
            action: "createTask",
            id: taskData.youtrackId,
          }),
        );
        break;
      case "scrapeDoneTasks":
        const tasks = await scrapeDoneTasks(page);
        console.log(JSON.stringify(tasks));
        break;
      case "testScrape":
        console.log("Running in test scrape mode...");
        const testTasks = await scrapeDoneTasks(page);
        console.log("--- Test Scrape Results ---");
        console.log(JSON.stringify(testTasks, null, 2));
        console.log("---------------------------");
        break;
      default:
        throw new Error(`Neznámý příkaz: ${command}`);
    }

    await browser.close();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
})();
