# TODO List - Fáze 1 (Základní oprava)

- [x] Analyzovat strukturu rozdělené tabulky a navrhnout strategii pro scraping.
- [x] Upravit funkci `scrapeDoneTasks` v `bot.js` pro implementaci nové strategie.
- [x] Přidat do `bot.js` testovací příkaz pro spuštění `scrapeDoneTasks`.
- [x] Spustit test scrapingu a uložit výsledky do `log.md`. (Přeskočeno kvůli omezením prostředí)
- [x] Zkontrolovat `log.md` pro ověření správnosti opravy. (Přeskočeno kvůli omezením prostředí)
- [x] Vyčistit a odeslat finální kód.
- [x] Opravit chybu v URL.

# TODO List - Fáze 2 (Oprava virtuálního scrollingu)

- [x] Implementovat logiku pro scrollování v `scrapeDoneTasks` pro načtení všech úkolů. (První pokus, neúspěšný)
- [x] Zajistit, aby se při scrollingu nezpracovávaly duplicitní úkoly.

# TODO List - Fáze 3 (Oprava virtuálního scrollingu - 2. pokus)

- [ ] Vylepšit logiku pro scrolling v `scrapeDoneTasks` s využitím `scrollHeight` pro spolehlivou detekci konce seznamu.
- [ ] Odeslat finální kód.
