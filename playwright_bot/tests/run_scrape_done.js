import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const botPath = path.join(__dirname, '..', 'bot.js');

console.log('Running scrapeDoneTasks test...');

const botProcess = exec(`node ${botPath} scrapeDoneTasks`);

botProcess.stdout.on('data', (data) => {
    console.log(`${data}`);
});

botProcess.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
});

botProcess.on('close', (code) => {
    console.log(`Child process exited with code ${code}`);
});
