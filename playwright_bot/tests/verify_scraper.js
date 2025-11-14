import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const botPath = path.join(__dirname, '..', 'bot.js');
const fixturePath = path.join(__dirname, '..', 'fixtures', 'full_task_list.html');

console.log('Running scraper verification test...');

// 1. Parse the reference HTML fixture
const html = fs.readFileSync(fixturePath, 'utf-8');
const $ = cheerio.load(html);

const expectedTasks = [];
// Target only the rows in the pinned-left container to get the unique task titles
$('.ui-grid-pinned-container-left .ui-grid-row').each((i, row) => {
    const rowId = $(row).attr('rowid');
    const title = $(row).find('.ui-grid-cell-contents--title-cell-contents').attr('title');

    // Find the corresponding "completed on" cell in the body container, not the pinned one
    const completedOn = $(`div.ui-grid-render-container-body .ui-grid-row[rowid="${rowId}"] .ui-grid-coluiGrid-0008 .ui-grid-cell-contents__overflow-container`).text().trim();

    if (title) { // Only add rows that have a title
        expectedTasks.push({
            rowId: rowId,
            title: title.trim(),
            completedOn: completedOn === '--/--/---- --:--' ? null : completedOn,
        });
    }
});

console.log(`Parsed ${expectedTasks.length} tasks from the HTML fixture.`);

// 2. Run the bot script to get the actual scraped data
exec(`node ${botPath} scrapeAllTasks`, (error, stdout, stderr) => {
    if (error) {
        console.error(`Execution error: ${error}`);
        return;
    }
    if (stderr) {
        console.error(`stderr from bot: ${stderr}`);
    }

    // Extract the JSON part of the stdout
    const jsonOutputMatch = stdout.match(/--- All Tasks Results .*---\s*(\[[\s\S]*\])/);
    if (!jsonOutputMatch) {
        console.error("Could not find JSON output from the bot script.");
        console.log("Full stdout:", stdout);
        return;
    }

    let actualTasks;
    try {
        actualTasks = JSON.parse(jsonOutputMatch[1]);
        console.log(`Scraped ${actualTasks.length} tasks from the bot.`);
    } catch (parseError) {
        console.error("Failed to parse JSON output from bot:", parseError);
        return;
    }

    // 3. Compare the results
    const expectedTitles = new Set(expectedTasks.map(t => t.title));
    const actualTitles = new Set(actualTasks.map(t => t.title));

    let success = true;

    console.log('\n--- Verification Results ---');

    const missingTasks = [...expectedTitles].filter(title => !actualTitles.has(title));
    if (missingTasks.length > 0) {
        success = false;
        console.error(`\n[FAIL] Missing ${missingTasks.length} tasks:`);
        missingTasks.forEach(title => console.log(`  - ${title}`));
    }

    const extraTasks = [...actualTitles].filter(title => !expectedTitles.has(title));
    if (extraTasks.length > 0) {
        success = false;
        console.error(`\n[FAIL] Found ${extraTasks.length} unexpected tasks:`);
        extraTasks.forEach(title => console.log(`  - ${title}`));
    }

    if (success) {
        console.log('\n[SUCCESS] The scraped tasks match the expected tasks.');
    } else {
        console.log(`\nExpected ${expectedTasks.length} tasks, but found ${actualTasks.length}.`);
    }

    console.log('--------------------------');
});
