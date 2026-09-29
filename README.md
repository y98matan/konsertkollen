# Konsertkollen på GitHub Pages

Installerbar webbapp med datumfilter, val av flera orter och en egen källsida. GitHub Actions hämtar konserter och publicerar fyra gånger per dygn. GitHub Pages visar en statisk version mellan uppdateringarna.

## Slutför publiceringen

1. Öppna **Settings → Pages** i detta repository och välj **GitHub Actions** under **Build and deployment → Source**.
2. Öppna **Settings → Secrets and variables → Actions → New repository secret**. Skapa hemligheten `TICKETMASTER_API_KEY` och ange din Ticketmaster consumer key som värde. Lägg aldrig nyckeln i en fil eller ett commit.
3. Öppna **Actions → Uppdatera och publicera Konsertkollen → Run workflow**. När både build och deploy är gröna visas webbappens adress under **Settings → Pages**.
4. Öppna webbappen i telefonen och välj **Lägg till på hemskärmen** eller **Installera app** i webbläsaren.

Arbetsflödet körs även automatiskt fyra gånger per dygn. Om färre än tre konsertkällor svarar avbryts publiceringen, så en kraftigt ofullständig lista inte ersätter den senaste fungerande. GitHub kan fördröja schemalagda körningar.

## Lokal kontroll

Med Node.js 22 eller senare: `npm install && npm run build`, sedan `python3 -m http.server -d site 8000`. Utan `TICKETMASTER_API_KEY` hoppas Ticketmaster över.

## Viktigt

GitHub Pages är publik. Den tidigare privata Sites-versionen ändras inte. Kontrollera alltid tider och biljettstatus hos arrangören. Källhämtningen kan behöva justeras när arrangörernas webbplatser ändras.
