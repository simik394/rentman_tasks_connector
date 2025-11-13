/**
 * Scrapes completed tasks from the Rentman tasks table view, handling virtual scrolling.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>} A list of YouTrack issue IDs from completed tasks.
 */
export async function scrapeDoneTasks(page) {
  const tasksUrl = `#/tasks`;
  console.log(`Navigating to tasks page: ${tasksUrl}`);
  await page.goto(tasksUrl);

  console.log("Waiting for loading indicator to disappear...");
  await page.waitForSelector('#rm-loading-indicator', { state: 'hidden', timeout: 30000 });

  console.log("Waiting for task grid to load...");
  await page.waitForSelector('.ui-grid-canvas .ui-grid-row', { timeout: 30000 });

  const youtrackIds = new Set();
  const processedRowIds = new Set();
  const idRegex = /\[([A-Z0-9]+-[0-9]+)\]/;
  const viewportSelector = '.ui-grid-render-container-body .ui-grid-viewport';
  let lastScrollHeight = -1;

  while (true) {
    const bodyRows = await page.locator('.ui-grid-render-container-body .ui-grid-row').all();
    console.log(`Processing ${bodyRows.length} visible rows...`);

    for (const row of bodyRows) {
      const rowId = await row.locator('div[rowid]').getAttribute('rowid');
      if (!rowId || processedRowIds.has(rowId)) continue;

      const completedOnCell = row.locator('.ui-grid-coluiGrid-000C .ui-grid-cell-contents__overflow-container');
      const completedOnText = await completedOnCell.textContent({ timeout: 1000 }).catch(() => null);

      if (completedOnText && completedOnText.trim() !== '--/--/---- --:--') {
        const leftRow = page.locator(`.ui-grid-render-container-left div[rowid="${rowId}"]`);
        const title = await leftRow.locator('.ui-grid-cell-contents--title-cell-contents').getAttribute('title');
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

    const currentScrollHeight = await page.evaluate((selector) => {
      const viewport = document.querySelector(selector);
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
        return viewport.scrollHeight;
      }
      return -1;
    }, viewportSelector);

    await page.waitForTimeout(2000);

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
