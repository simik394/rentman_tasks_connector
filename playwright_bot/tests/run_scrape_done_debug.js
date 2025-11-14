import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const botPath = path.join(__dirname, '..', 'bot.js');
const logPath = path.join(__dirname, '..', 'logs', 'scrape_done_debug.log');

console.log('Running scrapeDoneTasks debug test...');

// Append a header to the log file to separate test runs
fs.appendFileSync(logPath, `\n--- New Test Run at ${new Date().toISOString()} ---\n`);

exec(`node ${botPath} testScrape >> ${logPath}`, (error, stdout, stderr) => {
  if (error) {
    console.error(`Execution error: ${error}`);
    fs.appendFileSync(logPath, `Execution error: ${error}\n`);
    return;
  }
  if (stderr) {
    console.error(`stderr: ${stderr}`);
    fs.appendFileSync(logPath, `stderr: ${stderr}\n`);
  }
  console.log(`stdout has been appended to ${logPath}`);
  console.log('Debug test finished.');
});
