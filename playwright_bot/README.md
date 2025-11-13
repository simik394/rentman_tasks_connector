# Playwright Bot pro automatizaci Rentmanu

Tento projekt obsahuje sadu Playwright testů pro automatizaci úkolů v aplikaci Rentman. Je navržen tak, aby byl robustní, snadno laditelný a bezpečný.

## Rychlý start

### 1. Instalace závislostí

Nejprve je nutné nainstalovat všechny potřebné balíčky. Z kořenového adresáře `playwright_bot` spusťte:

```bash
npm install
```

### 2. Nastavení prostředí

Testy vyžadují přihlašovací údaje. Ty se nastavují pomocí souboru `.env`.

1.  Zkopírujte šablonu:
    ```bash
    cp .env.example .env
    ```
2.  Otevřete nově vytvořený soubor `.env` a vyplňte své přihlašovací údaje:
    ```dotenv
    # Rentman URL
    RENTMAN_URL=https://pragosoundsro.rentmanapp.com

    # User credentials
    RENTMAN_USER=VASE_JMENO@email.com
    RENTMAN_PASSWORD=VASE_HESLO
    ```

### 3. Spuštění testů

Máte k dispozici několik příkazů pro spouštění testů:

- **Spuštění všech testů (headless režim):**
  Ideální pro CI/CD nebo když nepotřebujete vidět prohlížeč.
  ```bash
  npm test
  ```

- **Spuštění testů ve viditelném prohlížeči (headed režim):**
  **Klíčové pro ladění!** Uvidíte přesně, co se na stránce děje.
  ```bash
  npm run test:headed
  ```

- **Spuštění testů v debug režimu:**
  Poskytuje pokročilé nástroje jako krokování kódu a Playwright Inspector.
  ```bash
  npm run test:debug
  ```

- **Generování kódu (Codegen):**
  Otevře prohlížeč a zaznamená vaše akce, které převede na Playwright kód. Skvělé pro rychlé zjištění správných selektorů.
  ```bash
  npm run test:codegen
  ```

## Jak ladit testy (Důležité!)

Tato sada je připravena tak, abyste mohli snadno odhalit a opravit problémy s čekáním na prvky, které se nám nedařilo vyřešit.

### Krok 1: Zprovoznění přihlášení

Nejdůležitější je zajistit, aby fungovala autentizace.

1.  Otevřete soubor `tests/auth.setup.js`.
2.  Spusťte test v headed režimu:
    ```bash
    npm run test:headed tests/auth.setup.js
    ```
3.  Sledujte, co se děje v prohlížeči. Pokud se přihlášení zasekne, upravte v `auth.setup.js` řádek `await page.waitForURL('**/dashboard/**', ...)` tak, aby čekal na spolehlivý prvek nebo událost, která se objeví po úspěšném přihlášení.
    - **Tip:** Použijte `npm run test:codegen`, nechte se přihlásit a podívejte se, jaký kód Playwright vygeneruje.

### Krok 2: Oprava testu `scrapeDoneTasks`

Jakmile je přihlášení spolehlivé, můžete opravit samotný test.

1.  Otevřete soubor `tests/tasks.spec.js`.
2.  Odstraňte `.fixme` z řádku `test.fixme(...)`, aby se test začal spouštět.
3.  Spusťte test v headed režimu:
    ```bash
    npm run test:headed tests/tasks.spec.js
    ```
4.  Sledujte běh a identifikujte, proč selhává čekání v `bot.actions.js` (např. `waitForSelector('#rm-loading-indicator', ...)`). Upravujte selektory a čekací strategie, dokud test neprojde.

### Playwright Trace Viewer

Pokud test selže, automaticky se vygeneruje podrobný report v adresáři `playwright-report`. Otevřete soubor `index.html` v tomto adresáři a uvidíte **Trace**. To je interaktivní záznam celého testu, kde uvidíte screenshoty, akce, stav DOM a síťové požadavky pro každý krok. **Toto je váš nejdůležitější ladicí nástroj.**
