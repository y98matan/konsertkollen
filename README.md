# Konsertkollen på GitHub Pages

Installerbar webbapp med orts- och datumfilter, källsida och automatiskt uppdaterad konsertlista. GitHub Actions samlar uppgifterna fyra gånger per dygn och publicerar statiska filer. Ticketmaster-nyckeln används enbart under bygget och ska läggas in som en GitHub Actions-hemlighet.

## Publicera

1. Skapa ett nytt **publikt** repository på GitHub, till exempel `konsertkollen`.
2. Ladda upp alla filer i den här mappen, inklusive `.github/workflows/pages.yml`, till `main`.
3. I repot: **Settings → Secrets and variables → Actions → New repository secret**. Namn: `TICKETMASTER_API_KEY`. Klistra in din Ticketmaster consumer key som värde. Lägg aldrig nyckeln i en fil eller ett commit.
4. Under **Settings → Pages**, välj **GitHub Actions** som källa.
5. Öppna **Actions → Uppdatera och publicera Konsertkollen → Run workflow**. När körningen är grön visas adressen under **Settings → Pages**. Den brukar se ut som `https://DITT-NAMN.github.io/konsertkollen/`.
6. Öppna sidan i telefonen och välj webbläsarens **Lägg till på hemskärmen** eller **Installera app**.

Uppdateringsjobbet körs även automatiskt fyra gånger per dygn. Om en källa tillfälligt fallerar publiceras de andra källorna; om allt fallerar avbryts publiceringen. GitHub Actions kan skjuta på schemalagda körningar vid hög belastning.

## Lokal kontroll

Med Node.js 22 eller senare: `npm install && npm run build`, sedan `python3 -m http.server -d site 8000`. Utan `TICKETMASTER_API_KEY` hoppas Ticketmaster över.

## Viktigt

GitHub Pages är publik. Konsertdata och länklistan blir tillgängliga för alla. Den tidigare privata Sites-versionen ändras inte. Kontrollera alltid tider och biljettstatus hos arrangören. Källhämtningen bygger på respektive webbplats struktur och kan behöva justeras när arrangören ändrar den.
