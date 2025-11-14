# Playwright Bot for Rentman Automation

This document provides instructions on how to set up and run the Playwright bot for automating tasks in Rentman.

## 1. Installation

Before running the bot, you need to install the necessary dependencies and browser binaries.

1.  **Install Node.js dependencies:**
    Navigate to the `playwright_bot` directory and run:
    ```bash
    npm install
    ```

2.  **Install Playwright browsers:**
    This command downloads the browser binaries (like Chromium, Firefox, WebKit) that Playwright uses.
    ```bash
    npx playwright install
    ```

3.  **Install OS-level dependencies:**
    This command installs the necessary system libraries required for the browsers to run correctly in a headless environment on Linux.
    ```bash
    npx playwright install-deps
    ```

## 2. Configuration

The bot requires environment variables for authentication. Create a `.env` file in the `playwright_bot` directory or set these variables in your shell:

```
RENTMAN_URL="https://your-workspace.rentmanapp.com/"
RENTMAN_USER="your-email@example.com"
RENTMAN_PASSWORD="your-password"
```

**Important:** Ensure that the `RENTMAN_URL` does not have extra quotes if you are setting it directly in a script or some shell environments, as this can cause navigation errors.

## 3. Authentication (Login)

The bot uses a programmatic login process to create a persistent authentication state. This avoids storing sensitive user data in the repository and is suitable for automated environments.

You must run the `login` command once before executing other commands. This will generate an authentication file in `playwright_bot/.auth/user.json`.

```bash
node bot.js login
```

If the login is successful, you will see a confirmation message, and the `user.json` file will be created.

## 4. Usage

Once authenticated, you can run the bot's main commands.

### Scrape Done Tasks

To scrape all completed tasks and save the output to a `log.md` file, use the `testScrape` command:

```bash
node bot.js testScrape > ../log.md
```
*(Note: The output is redirected to the root directory's `log.md` as requested.)*

The output will be a JSON array of YouTrack issue IDs extracted from the completed tasks.

### Create a Task

To create a new task, use the `createTask` command with the `--data` argument. The data must be a JSON string.

```bash
node bot.js createTask --data='{"youtrackId":"PROJ-123","title":"New Task Title","assignee":"John Doe","deadline":"2024-12-31T23:59:59"}'
```

The `assignee` and `deadline` fields are optional.
