# Leerplatform — Schouten Techniek

Microlearning voor de technische dienst: lesbomen als honingraat, korte lessen,
en herhaling op het moment dat je iets dreigt te vergeten. Eén zelfstandig
HTML-bestand dat je in de browser opent — geen server, geen installatie.

**Status: testfase.** De tool wordt klaargemaakt om met collega's te testen.
Waar de grenzen van deze versie liggen, staat onderaan.

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
in [`CONTRIBUTING.md`](CONTRIBUTING.md). Martijn geeft opdrachten via Claude;
Claude stuurt Codex aan via GitHub.

## Grenzen van deze versie

- **Geen AI-koppeling.** Er gaat geen tekst naar een AI-dienst en er staat geen
  sleutel in het bestand. In een les kun je een zin selecteren en om hulp vragen;
  het paneel zegt dan dat de koppeling niet aanstaat.
- **Geen accounts.** De rolkeuze bij aanmelden bepaalt wat bereikbaar is, maar is
  een demonstratie van rollen en geen beveiliging.
- **Gegevens staan per browser.** Inhoud en voortgang leven in de browseropslag
  van het apparaat waarop je het bestand opent. Wie van browser wisselt of het
  bestand verplaatst, kan andere browseropslag krijgen. Maak via Instellingen
  een back-up; het terugzetten controleert het bestand, maar niet tegen elke
  mogelijke beschadiging.
- **De app start leeg.** Er is geen lesstof meegeleverd. Je maakt lesbomen,
  onderwerpen en lessen zelf in de lesvoorbereiding.

## Veiligheid van de lesinhoud

Lesstof komt alleen in de app doordat een mens hem invoert, of hem door de
AI-functie van de app laat maken uit bronnen die een mens aanlevert. Lesstof over
werken aan elektrische installaties wordt pas gepubliceerd nadat iemand die NEN
3140-vakbekwaam is hem heeft goedgekeurd. De tool dwingt dat nog niet af: wie
publiceert, regelt die controle zelf vooraf.

## Huisstijl

De vormgeving volgt de huisstijl van Schouten Techniek. De kleuren staan bovenaan
de broncode in `ST` en `UI`, de statuskleuren van de honingraat in `RAAT_STATUS`.
