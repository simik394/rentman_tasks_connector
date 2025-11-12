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
  const tasksUrl = `${rentmanUrl}/#/tasks`;

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
 * Scrapes the "Done" column in Rentman for YouTrack issue IDs.
 * @param {import('playwright').Page} page
 * @returns {Promise<string[]>} A list of YouTrack issue IDs.
 */
async function scrapeDoneTasks(page) {
  const rentmanUrl = process.env.RENTMAN_URL;
  if (!rentmanUrl) {
    throw new Error("RENTMAN_URL environment variable must be set.");
  }
  const tasksUrl = `${rentmanUrl}#/tasks`;

  console.log(`Navigating to tasks page: ${tasksUrl}`);
  await page.goto(tasksUrl);

  console.log("Waiting for Kanban board to load...");
  await page.waitForSelector('div[data-testid^="kanban-column-"]', {
    timeout: 30000,
  });

  console.log('Locating the "Hotovo" (Done) column...');
  const doneColumn = page.locator(
    'div[data-testid^="kanban-column-"]:has(div:text("Hotovo"))',
  );
  await doneColumn.waitFor();

  console.log('Finding all cards in the "Done" column...');
  const completedCards = await doneColumn
    .locator('[data-testid^="kanban-card-"]')
    .all();

  const youtrackIds = [];
  const idRegex = /\[([A-Z0-9]+-[0-9]+)\]/;

  console.log(
    `Found ${completedCards.length} completed cards. Extracting YouTrack IDs...`,
  );
  for (const card of completedCards) {
    const title = await card
      .locator('[data-testid="kanban-card-title"]')
      .textContent();
    if (title) {
      const match = title.match(idRegex);
      if (match && match[1]) {
        youtrackIds.push(match[1]);
      }
    }
  }

  console.log(`Extracted YouTrack IDs: ${JSON.stringify(youtrackIds)}`);
  return youtrackIds;
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
      default:
        throw new Error(`Neznámý příkaz: ${command}`);
    }

    await context.close();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
})();
