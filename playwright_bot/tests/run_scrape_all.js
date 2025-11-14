import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const botPath = path.join(__dirname, '..', 'bot.js');
const logPath = path.join(__dirname, '..', 'logs', 'all_tasks_output.log');

console.log('Running scrapeAllTasks test...');

exec(`node ${botPath} scrapeAllTasks > ${logPath}`, (error, stdout, stderr) => {
  if (error) {
    console.error(`Execution error: ${error}`);
    return;
  }
  if (stderr) {
    console.error(`stderr: ${stderr}`);
  }
  console.log(`stdout has been redirected to ${logPath}`);
  console.log('Test finished.');
});
