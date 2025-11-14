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
 * @returns {Promise<object[]>} A list of YouTrack issue IDs from completed tasks.
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

  const completedTasks = [];
  const processedRowIds = new Set();
  const idRegex = /\[([A-Z0-9]+-[0-9]+)\]/;

  const viewportSelector = '.ui-grid-render-container-body .ui-grid-viewport';

  let lastProcessedCount = -1;

  // Loop to handle virtual scrolling
  while (processedRowIds.size > lastProcessedCount) {
    lastProcessedCount = processedRowIds.size;
    const bodyRows = await page.locator('.ui-grid-render-container-body .ui-grid-row').all();

    console.log(`Processing ${bodyRows.length} visible rows...`);

    for (const row of bodyRows) {
      const rowIdElement = row.locator('div[rowid]');
      const rowId = await rowIdElement.getAttribute('rowid');

      if (!rowId || processedRowIds.has(rowId)) {
        continue;
      }

      const completedOnCell = row.locator('.ui-grid-coluiGrid-000C .ui-grid-cell-contents__overflow-container');
      const completedOnText = await completedOnCell.textContent({ timeout: 1000 }).catch(() => null);

      if (completedOnText && completedOnText.trim() !== '--/--/---- --:--') {
        const leftRow = page.locator(`.ui-grid-render-container-left div[rowid="${rowId}"]`);
        const titleCell = leftRow.locator('.ui-grid-cell-contents--title-cell-contents');
        const title = await titleCell.getAttribute('title');

        const match = title ? title.match(idRegex) : null;
        const youtrackId = match ? match[1] : null;

        completedTasks.push({
          rowId: rowId,
          title: title,
          completedOn: completedOnText.trim(),
          youtrackId: youtrackId,
        });
      }
      processedRowIds.add(rowId);
    }

    // Scroll down multiple times to ensure new content is loaded
    await page.locator(viewportSelector).click(); // Ensure the viewport is focused
    for (let i = 0; i < 5; i++) {
        await page.keyboard.press('PageDown');
        await page.waitForTimeout(200); // Short delay between presses
    }

    // Wait for new content to load
    await page.waitForTimeout(3000);
  }

  console.log(`Extracted a total of ${completedTasks.length} completed tasks.`);
  return completedTasks;
}


/**
 * Scrapes all tasks from the Rentman tasks table view for debugging purposes.
 * @param {import('playwright').Page} page
 * @returns {Promise<object[]>} A list of all visible tasks with their properties.
 */
async function scrapeAllTasks(page) {
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

  const tasks = [];
  const processedRowIds = new Set();
  const viewportSelector = '.ui-grid-render-container-body .ui-grid-viewport';

  let lastScrollHeight = -1;
  // Loop to handle virtual scrolling
  while (true) {
    const bodyRows = await page.locator('.ui-grid-render-container-body .ui-grid-row').all();

    for (const row of bodyRows) {
      const rowIdElement = row.locator('div[rowid]');
      const rowId = await rowIdElement.getAttribute('rowid');

      if (!rowId || processedRowIds.has(rowId)) {
        continue;
      }

      const leftRow = page.locator(`.ui-grid-render-container-left div[rowid="${rowId}"]`);
      const titleCell = leftRow.locator('.ui-grid-cell-contents--title-cell-contents');
      const title = await titleCell.getAttribute('title');

      const completedOnCell = row.locator('.ui-grid-coluiGrid-000C .ui-grid-cell-contents__overflow-container');
      const completedOnText = await completedOnCell.textContent({ timeout: 1000 }).catch(() => null);

      tasks.push({
        rowId: rowId,
        title: title,
        completedOn: completedOnText ? completedOnText.trim() : null,
      });

      processedRowIds.add(rowId);
    }

    const currentScrollHeight = await page.evaluate((selector) => {
      const viewport = document.querySelector(selector);
      if (viewport) {
        const height = viewport.scrollHeight;
        viewport.scrollTop = height;
        return height;
      }
      return -1;
    }, viewportSelector);

    await page.waitForTimeout(2000);

    if (currentScrollHeight === lastScrollHeight) {
      break;
    }
    lastScrollHeight = currentScrollHeight;
  }

  console.log(`Scraped a total of ${tasks.length} tasks.`);
  return tasks;
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
        const youtrackIds = tasks.map(t => t.youtrackId).filter(id => id);
        console.log(JSON.stringify(youtrackIds));
        break;
      case "testScrape":
        console.log("Running in test scrape mode...");
        const testTasks = await scrapeDoneTasks(page);
        console.log("--- Test Scrape Results ---");
        console.log(JSON.stringify(testTasks, null, 2));
        console.log("---------------------------");
        break;
      case "scrapeAllTasks":
        console.log("Running in scrape all tasks mode...");
        const allTasks = await scrapeAllTasks(page);

        // Save to file for verify_scraper.js
        const logDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logDir)){
            fs.mkdirSync(logDir);
        }
        fs.writeFileSync(path.join(logDir, 'scrape_all_output.json'), JSON.stringify(allTasks, null, 2));

        console.log("--- All Tasks Results (also saved to log file) ---");
        console.log(JSON.stringify(allTasks, null, 2));
        console.log("-------------------------------------------------");
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
