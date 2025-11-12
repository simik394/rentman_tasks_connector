import { chromium } from "playwright";
import path from "path";
import "dotenv/config";

const USER_DATA_DIR = path.join(process.cwd(), "playwright-user-data");

// --- Funkce ---

/**
 * Initiates an interactive login process using the system's installed Google Chrome.
 * @param {string} loginUrl
 */
async function login(loginUrl) {
  console.log(`Using user data directory: ${USER_DATA_DIR}`);
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    channel: "chrome", // Use the system's installed Google Chrome
  });
  const page = context.pages().length
    ? context.pages()[0]
    : await context.newPage();

  console.log(`Navigating to ${loginUrl}...`);
  await page.goto(loginUrl);

  console.log("---------------------------------------------------------");
  console.log("MANUAL ACTION REQUIRED:");
  console.log("Please complete the login in the browser window.");
  console.log(
    "Once you are logged in and see the dashboard, you can close this window.",
  );
  console.log("---------------------------------------------------------");

  // The user will manually close the browser. We add a long timeout
  // to keep the script alive while they do this.
  await new Promise((resolve) => setTimeout(resolve, 300000)); // 5-minute timeout
}

/**
 * Creates a new task in Rentman.
 * @param {import('playwright').Page} page
 * @param {object} taskData
 */
async function createTask(page, taskData) {
  const rentmanUrl = process.env.RENTMAN_URL;
  if (!rentmanUrl) {
    throw new Error("RENTMAN_URL environment variable must be set.");
  }
  const tasksUrl = `${rentmanUrl}#/tasks`;

  console.log(`Navigating to tasks page: ${tasksUrl}`);
  await page.goto(tasksUrl);

  console.log('Clicking "Add task" button...');
  await page.click('[data-testid="tasks-overview-add-task-button"]');

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
  const rentmanUrl = process.env.RENTMAN_URL;
  if (!rentmanUrl) {
    throw new Error("RENTMAN_URL environment variable must be set.");
  }
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
      const loginUrl = process.env.RENTMAN_URL;
      if (!loginUrl) {
        throw new Error(
          "RENTMAN_URL environment variable must be set for login.",
        );
      }
      await login(loginUrl);
      return;
    }

    // For other commands, use the persistent context in headless mode
    const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: true,
      channel: "chrome", // Use the system's installed Google Chrome
    });
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

    await context.close();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
})();
