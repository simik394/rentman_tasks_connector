# Průvodce Nasazením Bota na Cloud Server

Tento dokument popisuje krok-za-krokem postup, jak nasadit a zprovoznit synchronizačního bota na čisté cloudové instanci (např. VPS, VM). Jako příklad je použit operační systém **Ubuntu 22.04 LTS**, ale postup bude velmi podobný pro jiné Debian-based distribuce.

## 1. Příprava Serveru

### 1.1. Aktualizace Systému

Přihlaste se na svůj server přes SSH a nejprve aktualizujte seznam balíčků a samotné balíčky na nejnovější verze.

```bash
sudo apt-get update
sudo apt-get upgrade -y
```

### 1.2. Instalace `git` a `Node.js`

Budete potřebovat `git` pro stažení repozitáře a `Node.js` pro spuštění bota. Doporučujeme použít Node.js verze 18 nebo novější.

```bash
# Instalace Gitu
sudo apt-get install -y git

# Instalace Node.js (zde použijeme NodeSource pro instalaci verze 20.x)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Ověřte instalaci:
```bash
node -v  # Mělo by ukázat v20.x.x
npm -v   # Mělo by ukázat verzi npm
```

### 1.3. Instalace Google Chrome

Bot vyžaduje plnohodnotný Google Chrome prohlížeč pro obcházení bezpečnostních mechanismů.

```bash
# Nainstalujte potřebné závislosti
sudo apt-get install -y wget gnupg

# Přidejte oficiální Google klíč
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -

# Přidejte Chrome repozitář do systému
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list'

# Aktualizujte seznam balíčků a nainstalujte Chrome
sudo apt-get update
sudo apt-get install -y google-chrome-stable
```

Ověřte instalaci:
```bash
google-chrome --version  # Mělo by ukázat nainstalovanou verzi
```

## 2. Příprava a Konfigurace Bota

### 2.1. Stažení Repozitáře

Naklonujte si repozitář s botem na váš server.

```bash
git clone <URL_VAŠEHO_REPOZITÁŘE>
cd rentman-youtrack-sync  # Nebo název vašeho repozitáře
```

### 2.2. Vytvoření Přihlašovací Session (Lokálně)

Tento krok je **jediný, který musíte provést na svém lokálním počítači**, nikoli na serveru.

1.  **Na vašem PC/notebooku** (kde máte grafické rozhraní a prohlížeč):
    a. Ujistěte se, že máte naklonovaný stejný repozitář.
    b. V adresáři `playwright_bot` spusťte `npm install`.
    c. Spusťte jednorázový přihlašovací příkaz:
       ```bash
       cd playwright_bot
       node bot.js login
       ```
    d. Otevře se okno prohlížeče Chrome. **Manuálně se přihlaste** do Rentmanu přes váš Google účet.
    e. Po úspěšném přihlášení a načtení hlavní stránky můžete okno zavřít.
    f. Tím se v adresáři `playwright_bot` vytvořila složka `playwright-user-data`.

### 2.3. Nahrání Přihlašovací Session na Server

Nyní potřebujete dostat složku `playwright-user-data` na server.

1.  **Zabalte složku** na vašem lokálním počítači:
    ```bash
    cd playwright_bot
    tar -czvf user-data.tar.gz playwright-user-data
    ```
2.  **Nahrajte archiv na server** pomocí `scp` (nahraďte `uzivatel@vas-server` a cestu):
    ```bash
    scp user-data.tar.gz uzivatel@vas-server:/cesta/k/repozitari/playwright_bot/
    ```
3.  **Na serveru archiv rozbalte**:
    ```bash
    # Přihlaste se zpět na server
    ssh uzivatel@vas-server

    # Přejděte do správného adresáře
    cd /cesta/k/repozitari/playwright_bot/

    # Rozbalte archiv
    tar -xzvf user-data.tar.gz
    ```
    Nyní byste měli mít na serveru v `playwright_bot` složku `playwright-user-data`.

### 2.4. Instalace Závislostí Bota na Serveru

V adresáři `playwright_bot` na serveru nainstalujte `npm` závislosti.

```bash
cd /cesta/k/repozitari/playwright_bot/
npm install
```

## 3. Spuštění a Testování Bota

Nyní je vše připraveno pro spouštění bota z vašeho orchestrátoru (např. n8n).

### 3.1. Manuální Test

Doporučujeme nejprve provést manuální test přímo na serveru, abyste ověřili, že vše funguje.

```bash
# Přejděte do adresáře bota
cd /cesta/k/repozitari/playwright_bot/

# Spusťte například scraper hotových úkolů
node bot.js scrapeDoneTasks
```

Pokud příkaz proběhne bez chyb a vrátí JSON pole (i když třeba prázdné `[]`), znamená to, že bot se úspěšně spustil v headless režimu, načetl si vaši přihlašovací session a komunikuje s Rentmanem.

### 3.2. Integrace s n8n

V `Execute Command` node ve vašich n8n workflows použijte absolutní cesty pro spuštění bota. Příklad příkazu:

```bash
cd /home/uzivatel/rentman-youtrack-sync/playwright_bot && node bot.js scrapeDoneTasks
```

Nebo pro vytvoření úkolu:

```bash
cd /home/uzivatel/rentman-youtrack-sync/playwright_bot && node bot.js createTask --data '{{ $json.taskData }}'
```

**Hotovo!** Váš bot je nyní plně nasazen a připraven k použití na headless serveru.
