import { test, expect } from '@playwright/test';
import { scrapeDoneTasks } from '../bot.actions.js';

test.describe('Rentman Tasks', () => {
  // Tento test je označen jako 'fixme', protože vyžaduje manuální doladění
  // selektorů a čekacích strategií přímo v prostředí Rentmanu.
  // Odstraňte 'fixme', až budete mít test plně funkční.
  test.fixme('should scrape done tasks and return a list of IDs', async ({ page }) => {

    // Protože tento test závisí na 'setup', měl by být již přihlášen.
    await page.goto('/'); // Začněte na hlavní stránce

    const doneTasks = await scrapeDoneTasks(page);

    // Základní ověření - zkontroluje, že výsledek je pole.
    expect(Array.isArray(doneTasks)).toBe(true);

    // Příklad pokročilejšího testu:
    // expect(doneTasks.length).toBeGreaterThan(0);
  });
});
