# rentman_tasks_connector

# Projektový Plán: Obousměrná Synchronizace YouTrack Issues ↔ Rentman Tasks

Datum: 23. října 2025

Cíl: Vytvořit automatizovaný systém pro obousměrnou synchronizaci úkolů mezi platformou YouTrack a Rentman.

Kontakt (PM):

$$Doplňte jméno$$

## 1. Projektový Záměr a Kontext

### 1.1. Cíl

Vytvořit robustní 2-směrnou synchronizaci, která umožní:

1. **Směr (YouTrack → Rentman):** Automaticky vytvořit (nebo později aktualizovat) úkol v Rentmanu, pokud je v YouTracku vytvořeno/aktualizováno issue s tagem `#RM` a tagem uživatele (např. `#pavel`).
    
2. **Směr (Rentman → YouTrack):** Automaticky změnit stav issue v YouTracku (např. na "Done"), pokud je odpovídající úkol v Rentmanu přesunut do stavu "Hotovo".
    

### 1.2. Klíčový Problém a Architektonické Rozhodnutí

Standardní přístup přes API zde selhává. **API Rentmanu v současné době NEPODPORUJE práci s úkoly (Tasks).**

Z tohoto důvodu je celé řešení postaveno na **GUI automatizaci** (Robotic Process Automation - RPA).

- **Orchestrátor (Mozek):** [n8n.io](https://n8n.io/ "null") (open-source automatizační platforma).
    
- **Robot (Ruce):** [Playwright](https://playwright.dev/ "null") (knihovna pro automatizaci prohlížeče, 3M+ stažení týdně na npm).
    
- **Zdroj dat:** [YouTrack API](https://www.jetbrains.com/help/youtrack/devportal/youtrack-rest-api.html "null").
    

### 1.3. Klíčový Mechanismus Párování

Protože Rentman tasky nemají API, nemůžeme k nim ukládat externí ID. Jediný spolehlivý způsob, jak spárovat Rentman Task s YouTrack Issue, je **vložení YouTrack Issue ID přímo do názvu Rentman Tasku**.

**Příklad:**

- YouTrack Issue: `PROJ-123 | Opravit audio na stage B`
    
- Rentman Task: `[PROJ-123] Opravit audio na stage B`
    

Veškerá logika pro čtení i zápis se bude spoléhat na tento formát a extrakci ID pomocí regulárního výrazu `\[([A-Z0-9]+-[0-9]+)\]`.

## 2. Architektura Řešení

Systém bude složen ze dvou hlavních workflow v n8n a jednoho podpůrného Playwright skriptu.

### 2.1. Komponentní Diagram

```
@startuml
!theme plain
skinparam rectangle {
  shadowing false
  BorderColor #555
  ArrowColor #333
}
skinparam node {
  FontName Arial
  BorderColor #555
}
skinparam component {
  BackgroundColor #f8f8f8
  BorderColor #555
}

[n8n] as N8N <<Orchestrator>>
[Playwright Bot] as Bot <<Robot (Node.js)>>
[Rentman GUI] as RM_GUI <<Web Aplikace>>
[YouTrack API] as YT_API <<REST API>>

N8N ..> Bot : 1. Spouští (Execute Command)\n`node bot.js [příkaz] [data]`
N8N --> YT_API : 2. Čte a zapisuje Issues
Bot -> RM_GUI : 3. Ovládá prohlížeč\n(Přihlášení, klikání, vyplňování)
@enduml

```

### 2.2. Tok 1: YouTrack → Rentman (Vytvoření Úkolu)

```
@startuml
actor Uživatel
participant "YouTrack" as YT
participant "n8n (Webhook)" as N8N
participant "Playwright Bot" as Bot
participant "Rentman GUI" as RM

Uživatel -> YT : Vytvoří/aktualizuje Issue\n(přidá tagy #RM, #pavel)
YT -> N8N : Odesílá Webhook s daty
N8N -> N8N : 1. Zpracuje data\n(Mapuje tag #pavel na jméno "Pavel Novák")
N8N -> Bot : 2. Spustí příkaz\n`node bot.js createTask --data {...}`
Bot -> RM : 3. Otevře prohlížeč, přihlásí se
Bot -> RM : 4. Klikne "Přidat úkol"
Bot -> RM : 5. Vyplní formulář (Název s ID, Assignee, Deadline)
Bot -> RM : 6. Uloží úkol
Bot --> N8N : 7. Vrací úspěch (stdout)
N8N -> YT : 8. (Volitelně) Přidá komentář\n"Úkol vytvořen v Rentmanu."
@enduml

```

### 2.3. Tok 2: Rentman → YouTrack (Dokončení Úkolu)

```
@startuml
participant "n8n (Schedule)" as N8N
participant "Playwright Bot" as Bot
participant "Rentman GUI" as RM
participant "YouTrack API" as YT_API

N8N -> Bot : 1. Spustí (každých 5 min)\n`node bot.js scrapeDoneTasks`
Bot -> RM : 2. Otevře prohlížeč, přihlásí se
Bot -> RM : 3. Přejde na Tasks, najde sloupec "Hotovo"
Bot -> RM : 4. Přečte názvy všech karet v sloupci
Bot --> N8N : 5. Vrátí seznam ID\n`["PROJ-123", "PROJ-456"]`
N8N -> N8N : 6. (Loop) Pro každé ID...
N8N -> YT_API : 7. Zjistí stav Issue `PROJ-123`
N8N -> N8N : 8. (IF) Pokud stav není "Done"...
N8N -> YT_API : 9. Aktualizuje stav `PROJ-123` na "Done"
@enduml

```

## 3. Požadavky a Nastavení

1. **GitHub Repozitář:**
    
    - Vytvořit nové (private) repozitář, např. `rentman-youtrack-sync`.
        
    - Udržovat kód Playwright bota a JSON soubory n8n workflow.
        
2. **Server / Běžící Prostředí:**
    
    - Potřebujeme server (VM nebo Docker kontejner), kde poběží:
        
        - **n8n** (self-hosted).
            
        - **Node.js v18+**.
            
        - **Playwright** (`npm install playwright`).
            
        - Prohlížeče pro Playwright (`npx playwright install --with-deps`).
            
    - n8n _musí_ mít právo spouštět `Execute Command` node na tomto serveru.
        
3. **Nastavení Nástrojů:**
    
    - **YouTrack:**
        
        - Vygenerovat API Token s právy číst a zapisovat Issues.
            
        - Zajistit existenci pole `Deadline` (typ DateTime).
            
        - Zajistit existenci stavu "Done" (nebo ekvivalent).
            
    - **Rentman:**
        
        - Vytvořit dedikovaného uživatele pro bota (např. `bot@firma.cz`) s přihlašovacími údaji.
            
    - **n8n:**
        
        - Uložit přihlašovací údaje (YouTrack Token, Rentman User, Rentman Pass) do `Credentials`.
            

## 4. Plán Implementace (Akční Kroky)

### Fáze 1: Struktura Repozitáře

Vytvořte v repozitáři následující strukturu:

```
/rentman-youtrack-sync
|-- /n8n_workflows            <-- Exportované JSON workflow
|   |-- 1_youtrack_to_rentman.json
|   |-- 2_rentman_to_youtrack.json
|
|-- /playwright_bot           <-- Node.js projekt pro bota
|   |-- package.json
|   |-- bot.js                <-- Hlavní skript
|   |-- auth.json             <-- Zde se uloží přihlašovací session
|
|-- .gitignore
|-- README.md

```

### Fáze 2: Vývoj Playwright Bota (`/playwright_bot/bot.js`)

Skript bude přijímat argumenty z příkazové řádky. Zde je základní struktura pro `bot.js` (dispatcher):

```
const { chromium } = require('playwright');

// --- Funkce (login, createTask, scrapeDoneTasks) přijdou sem ---
// ... (např. async function login() { ... })
// ... (např. async function createTask(taskData) { ... })

// --- Hlavní Dispatcher ---
(async () => {
    const command = process.argv[2]; // např. 'createTask'
    const dataArg = process.argv[3]; // např. '--data "{...}"'
    
    // Zde by měla být robustnější logika pro parsování argumentů
    const taskData = dataArg ? JSON.parse(dataArg.split(' ')[1]) : {};

    // TODO: Zkontrolovat platnost auth.json, pokud neplatné, spustit login()
    // ...

    const browser = await chromium.launch({ headless: false }); // Pro ladění, pak true
    const context = await browser.newContext({ storageState: 'auth.json' });
    const page = await context.newPage();

    try {
        switch (command) {
            case 'login':
                // (Speciální volání pro první nastavení)
                // ...
                break;
            case 'createTask':
                await createTask(page, taskData);
                console.log(JSON.stringify({ status: 'success', action: 'createTask', id: taskData.youtrackId }));
                break;
            case 'scrapeDoneTasks':
                const tasks = await scrapeDoneTasks(page);
                console.log(JSON.stringify(tasks)); // Toto přečte n8n z stdout
                break;
            default:
                throw new Error(`Neznámý příkaz: ${command}`);
        }
    } catch (err) {
        console.error(err.message); // Toto přečte n8n z stderr
        process.exit(1); // Signál chyby
    }

    await browser.close();
})();
```

Nyní mohou být `Funkce 1, 2, 3` definovány jako funkce volané tímto dispatcherem.

**Technologie:** `Playwright`, `Node.js`

#### Funkce 1: `login()`

- Spustí se jen jednou.
    
- Otevře stránku přihlášení, vyplní jméno/heslo (z `process.env`) a uloží stav (cookies) do `auth.json`.
    
- `await page.context().storageState({ path: 'auth.json' });`
    
- **Cíl:** Příští spuštění již budou přihlášená.
    

#### Funkce 2: `createTask(taskData)`

- Přijme `taskData` jako JSON string z argumentu.
    
- **Analýza `rentmanTasksCreating.html`:** Tento soubor ukazuje strukturu modálního okna po kliknutí na "Přidat úkol".
    
- **Postup skriptu:**
    
    1. Načte kontext: `browser.newContext({ storageState: 'auth.json' })`.
        
    2. Přejde na stránku úkolů (z `rentmanTasks.html`): `page.goto('.../#/tasks')`.
        
    3. Klikne na "Přidat úkol":
        
        - `await page.click('[data-testid="tasks-overview-add-task-button"]');`
            
    4. Počká na modál:
        
        - `await page.waitForSelector('[data-testid="task-form-title-input"]');`
            
    5. Vyplní Název (včetně ID):
        
        - `const taskTitle = \`
            
            $$${taskData.youtrackId}$$
            
            ${taskData.title}`;`
            
        - `await page.fill('[data-testid="task-form-title-input"]', taskTitle);`
            
    6. Vyplní Přiřadit (Assignee):
        
        - `await page.click('[data-testid="task-form-assignees-select"]');`
            
        - `await page.fill('input[placeholder="Hledat..."]', taskData.assignee);`
            
        - `await page.click(\`div.user-list-item:has-text("${taskData.assignee}")`);` (Tento vnořený selektor je odhad, nutno ověřit).
            
    7. Vyplní Deadline (pokud existuje):
        
        - Převede `taskData.deadline` (ISO string) na formáty `DD-MM-YYYY` a `HH:mm`.
            
        - `await page.click('[data-testid="task-form-deadline-select"]');`
            
        - `await page.fill('input[name="date"]', '25-10-2025');`
            
        - `await page.fill('input[name="time"]', '14:30');`
            
        - `await page.click('button:has-text("Uložit")');` (Uložení v date-pickeru).
            
    8. Uloží celý úkol (dle `rentmanTasksCreating.html`):
        
        - `await page.click('button[data-qa="modal-save"]');` (Tlačítko má text "Confirm").
            

#### Funkce 3: `scrapeDoneTasks()`

- Načte přihlášený kontext a přejde na `.../#/tasks`.
    
- **Analýza `rentmanTasks.html`:** Tento soubor ukazuje Kanban view.
    
- **Postup skriptu:**
    
    1. Počká na načtení Kanbanu.
        
    2. Najde sloupec "Hotovo":
        
        - `const doneColumn = page.locator('div[data-testid^="kanban-column-"]:has(div:text("Hotovo"))');`
            
    3. Najde všechny karty v tomto sloupci:
        
        - `const completedCards = await doneColumn.locator('[data-testid^="kanban-card-"]').all();`
            
    4. Iteruje karty, z každé extrahuje název:
        
        - `const title = await card.locator('[data-testid="kanban-card-title"]').textContent();`
            
    5. Pomocí Regex extrahuje YouTrack ID:
        
        - `const match = title.match(/\[([A-Z0-9]+-[0-9]+)\]/);`
            
    6. Sestaví pole IDček a vrátí ho jako JSON string přes `console.log`.
        
        - `console.log(JSON.stringify(results));`
            

### Fáze 3: n8n Workflow 1 (YouTrack → Rentman)

1. **Trigger:** `YouTrack Trigger` (nebo `Webhook`, pokud Trigger node nestačí).
    
    - Událost: `Issue Created`, `Issue Updated`.
        
    - Filtry: `Tags` `contains` `#RM` A `Tags` `contains` (jeden z: `#pavel`, `#tomas`, ...).
        
2. **Function Node (Mapování):**
    
    - Převede data z YouTracku do formátu pro `taskData`.
        
    - Klíčová část je mapování tagů na jména:
        
        ```
        const userTag = $json.body.tags.find(t => t.name.startsWith('#user_'));
        const userMap = { '#user_pavel': 'Pavel Novák', /* ... */ };
        const assignee = userMap[userTag.name];
        // ... sestavit taskData object
        
        ```
        
3. **Execute Command Node:**
    
    - Spustí Playwright bota s připravenými daty.
        
    - `Command`: `cd /cesta/k/botu && node bot.js createTask --data '{{ $json.taskData }}'`
        
4. **Error Handling:** Pokud `Execute Command` selže (vrátí `stderr`), poslat notifikaci (Slack/Email) a přidat komentář do YouTracku, že synchronizace selhala.
    

### Fáze 4: n8n Workflow 2 (Rentman → YouTrack)

1. **Trigger:** `Schedule` node.
    
    - Interval: `Every 5 Minutes`.
        
2. **Execute Command Node:**
    
    - Spustí scraper.
        
    - `Command`: `cd /cesta/k/botu && node bot.js scrapeDoneTasks`
        
3. **Function Node (Parse):**
    
    - Převede `stdout` (což je JSON string) na reálný JSON objekt.
        
4. **Item Lists Node (Split):**
    
    - Rozdělí pole IDček na jednotlivé položky (každé ID = 1 item ve workflow).
        
5. **YouTrack Node (Check Status):**
    
    - Operace: `Get`.
        
    - Issue ID: `{{ $json.value }}` (hodnota z rozděleného pole).
        
6. **IF Node (Check):**
    
    - Zkontroluje, zda je stav načteného Issue _jiný_ než "Done".
        
    - `{{ $json.state }}` `Not Equals` `Done`.
        
7. **YouTrack Node (Update Status):**
    
    - (Jen pokud IF projde).
        
    - Operace: `Update`.
        
    - Issue ID: `{{ $json.value }}`.
        
    - Command (nebo pole): `State` = `Done`.
        
    - Přidá komentář: "Automaticky uzavřeno na základě stavu 'Hotovo' v Rentmanu."
        

## 5. Klíčová Rizika a Plán Údržby

- **KŘEHKOST (FRAGILITY):** Toto je největší riziko. Řešení je 100% závislé na struktuře HTML, CSS a atributech `data-testid` v Rentmanu.
    
- **Plán údržby:** Pokud Rentman vydá aktualizaci svého frontendu, je téměř jisté, že se **automatizace rozbije**.
    
- **Mitigace:**
    
    1. Používat `data-testid` a `data-qa` selektory (které jsme identifikovali) má nejvyšší prioritu. Jsou méně náchylné ke změnám než třídy (class) nebo text.
        
    2. Workflow _musí_ mít robustní error handling (viz Fáze 3, krok 4). Pokud skript selže, musí okamžitě poslat notifikaci administrátorovi, který provede ruční opravu selektorů ve skriptu `bot.js`.

## 6. Manuální Kroky k Dokončení

Tento repozitář obsahuje automatizační skript (`bot.js`), ale pro plnou funkčnost je nutné provést následující kroky v externích systémech.

### 6.1. Nastavení Prostředí a Spuštění Bota

1.  **Nainstalujte Google Chrome:**
    Ujistěte se, že na stroji, kde poběží bot, je nainstalovaný **Google Chrome**. Skript je nastaven tak, aby používal existující instalaci Chrome, a tím obešel bezpečnostní omezení Google.

2.  **Nainstalujte závislosti:**
    V adresáři `playwright_bot` spusťte příkaz:
    ```bash
    npm install
    ```
3.  **Nainstalujte Playwright prohlížeče:**
    I když budeme používat systémový Chrome, tento krok zajistí, že všechny potřebné závislosti pro Playwright jsou splněny.
    ```bash
    npx playwright install --with-deps
    ```

4.  **První přihlášení a vytvoření profilu prohlížeče:**
    Tento krok je nutné provést jednou, aby si Playwright vytvořil a uložil přihlášený profil prohlížeče ve vašem **lokálním Google Chrome**.

    a. Spusťte bota s příkazem `login`:
    ```bash
    cd playwright_bot
    node bot.js login
    ```
    b. Otevře se **okno vašeho běžného prohlížeče Google Chrome**, pravděpodobně s novým, čistým profilem.

    c. **Manuálně se přihlaste do Rentmanu** pomocí vašeho Google účtu, včetně dvoufázového ověření, pokud ho máte zapnuté.

    d. Po úspěšném přihlášení a načtení hlavní stránky (Dashboardu) můžete okno prohlížeče **zavřít**. Tím se vaše přihlašovací session uloží do adresáře `playwright-user-data`.

    e. Od této chvíle budou všechny ostatní příkazy (`createTask`, `scrapeDoneTasks`) používat tento přihlášený profil a poběží již bez nutnosti interakce (headless).

### 6.2. Import a Konfigurace n8n Workflows

1.  **Importujte JSON soubory:**
    - V n8n jděte do "Workflows" a klikněte na "Import from File".
    - Nahrajte `1_youtrack_to_rentman.json` a `2_rentman_to_youtrack.json` z adresáře `n8n_workflows`.

2.  **Nastavte "Credentials" v n8n:**
    - **YouTrack API Token:** Vytvořte v YouTracku a uložte do n8n jako "YouTrack API".
    - **Rentman Údaje:** Uložte přihlašovací údaje bota do n8n (např. jako "Generic Credential"), i když je `bot.js` používá z `.env`. Pomůže to udržet přehled.

3.  **Nakonfigurujte `Execute Command` Nody:**
    - V obou workflows najděte node "Execute Command".
    - **Upravte cestu:** Změňte `cd /cesta/k/botu` na absolutní cestu k `playwright_bot` adresáři na vašem serveru.
    - Ujistěte se, že uživatel, pod kterým běží n8n, má právo spouštět `node`.

4.  **Nakonfigurujte YouTrack Nody:**
    - Propojte YouTrack nody s vašimi "YouTrack API" credentials.
    - Upravte názvy stavů ("Done") a polí (`Deadline`), aby odpovídaly vaší YouTrack konfiguraci.

5.  **Aktivujte Workflows:**
    - Zapněte oba workflows v n8n.
