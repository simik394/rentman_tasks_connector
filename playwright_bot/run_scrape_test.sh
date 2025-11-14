#!/bin/bash

# This script automates the process of running the "testScrape" command
# to fetch completed tasks from Rentman and save them to a log file.

# --- Important Note on Authentication ---
# The Playwright bot has shown instability in maintaining a valid login session.
# While the 'login' command often succeeds in creating an authentication file,
# the subsequent 'testScrape' command may fail if the session is rejected by the server.
# If the script fails, re-running the 'login' command might resolve the issue.

# Step 1: Navigate to the bot's directory
cd "$(dirname "$0")"

# Step 2: Run the login command to ensure a fresh authentication state.
# This creates the .auth/user.json file.
echo "Attempting to log in to Rentman..."
node bot.js login

# Step 3: Check if the login was successful by checking the exit code.
if [ $? -ne 0 ]; then
  echo "Login failed. Please check your credentials and environment variables."
  exit 1
fi

echo "Login successful. Proceeding to scrape tasks."

# Step 4: Run the testScrape command and redirect the output to log.md in the parent directory.
node bot.js testScrape > ../log.md

# Step 5: Check the exit code of the scrape command.
if [ $? -eq 0 ]; then
  echo "Successfully scraped tasks. The output has been saved to log.md."
else
  echo "Failed to scrape tasks. The session might have been invalid."
  # You might want to include the error output in log.md as well
  # For now, we just log a failure message.
  echo "Scraping failed." > ../log.md
fi
