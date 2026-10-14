# Leerplatform — Schouten Techniek

Microlearning voor de technische dienst: lesbomen als honingraat, korte lessen,
en herhaling op het moment dat je iets dreigt te vergeten. Eén zelfstandig
HTML-bestand dat je in de browser opent — geen server, geen installatie.

**Status: testfase.** De tool wordt klaargemaakt om met collega's te testen. Wat
er wel en niet in zit, en waar de grenzen liggen, staat in [`LEESMIJ.md`](LEESMIJ.md).

## Snel beginnen

```bash
node build/build.cjs   # bouwt Leerplatform.html uit src/
node build/test.cjs    # draait de controles
```

Open daarna `Leerplatform.html` in je browser. Node.js is genoeg; er is geen
npm-installatie nodig.

## Opbouw

| Pad | Wat het is |
| --- | --- |
| `src/leerplatform.jsx` | De broncode — hier bewerk je alles. Leesbaar React. |
| `src/technische-startinhoud.js` | De inhoud die bij de start meegeleverd wordt. Nu leeg. |
| `build/build.cjs` | Bouwt het zelfstandige bestand. |
| `build/test.cjs` | De geautomatiseerde controles. |
| `build/vendor/` | React, Tailwind en de compiler. De compiler is bouwgereedschap en komt niet in het eindproduct. |
| `Leerplatform.html` | **Het eindproduct — gegenereerd, nooit met de hand bewerken.** |

## Meewerken

Aan dit project werken Martijn, Claude en ChatGPT (Codex). De werkafspraken staan
in [`CONTRIBUTING.md`](CONTRIBUTING.md); AI-werkers lezen daarnaast
[`AGENTS.md`](AGENTS.md) en [`CLAUDE.md`](CLAUDE.md).

Kort: issue eerst, eigen branch, pull request naar `main`, groene controles en
één review van iemand anders.

## Grenzen van deze versie

- **Geen AI-koppeling.** Er gaat geen tekst naar een AI-dienst en er staat geen
  sleutel in het bestand. In een les kun je een zin selecteren en om hulp vragen;
  het paneel zegt dan dat de koppeling niet aanstaat.
- **Geen accounts.** De rolkeuze bij aanmelden bepaalt wat bereikbaar is, maar is
  een demonstratie van rollen en geen beveiliging.
- **Gegevens staan per browser.** Inhoud en voortgang leven in de browseropslag
  van het apparaat waarop je het bestand opent. Maak via Instellingen een back-up.
- **De app start leeg.** Er is geen lesstof meegeleverd. Je maakt lesbomen,
  onderwerpen en lessen zelf in de lesvoorbereiding.

## Veiligheid van de lesinhoud

Lesinhoud over werken aan elektrische installaties wordt pas gepubliceerd nadat
iemand die NEN 3140-vakbekwaam is hem heeft nagekeken. De tool dwingt dat niet
af; de afspraak staat in `CONTRIBUTING.md` en in het sjabloon voor pull requests.

## Huisstijl

De vormgeving volgt de huisstijl van Schouten Techniek. De kleuren staan bovenaan
de broncode in `ST` en `UI`, de statuskleuren van de honingraat in `RAAT_STATUS`.
