# Leerplatform (Schouten Techniek)

Een microlearning-platform in één standalone HTML-bestand. Je opent het in de
browser — geen server, geen installatie, geen account. Inhoud en voortgang
worden in de browseropslag van dat apparaat bewaard.

## Bestanden

| Pad | Wat het is |
| --- | --- |
| `src/leerplatform.jsx` | **De broncode** — hier bewerk je alles (uiterlijk, gedrag, didactiek). Leesbaar React. |
| `src/technische-startinhoud.js` | De technische startinhoud: twaalf lesbomen en de Elektra-onderwerpen. |
| `build/build.cjs` | Bouwt het standalone bestand uit de broncode en de meegeleverde bibliotheken. |
| `build/test.cjs` | De geautomatiseerde controles. |
| `build/vendor/` | React, Tailwind en de compiler. De compiler is alleen bouwgereedschap en komt niet in het eindbestand. |
| `Leerplatform.html` | **Het eindproduct** — dit deel je / open je. Wordt gegenereerd, niet met de hand bewerkt. |
| `LEESMIJ.md` | Wat er in deze versie zit, wat er is gecontroleerd en wat de grenzen zijn. |

## Werkwijze

1. Bewerk de broncode in **`src/leerplatform.jsx`** (of de startinhoud).
2. Bouwen en controleren — Node.js is genoeg, er is geen npm-installatie nodig:

   ```bash
   node build/build.cjs
   node build/test.cjs
   ```

3. Open `Leerplatform.html` in je browser om te testen.
4. Commit zowel de broncode als het gegenereerde bestand.

> Bewerk `Leerplatform.html` **nooit** met de hand — je wijziging gaat verloren
> bij de volgende build. De broncode is de baas.

## Grenzen

- **Geen AI-koppeling.** Er wordt geen tekst naar een AI-dienst gestuurd en er
  staat geen API-sleutel in het bestand. In een les kun je een stuk tekst
  selecteren en om hulp vragen; het paneel zegt dan eerlijk dat de koppeling
  niet aanstaat.
- **Geen echte accounts.** De rolkeuze bij het aanmelden bepaalt wél wat
  bereikbaar is, maar het is een demonstratie van rollen en geen beveiliging:
  wie het bestand kan openen, kan opnieuw laden en een andere rol kiezen.
- **Gegevens staan per browser.** Maak via Instellingen regelmatig een back-up.

## Huisstijl

De vormgeving volgt de huisstijl van Schouten Techniek. De kleuren staan
bovenaan de broncode in `ST` en `UI`; de statuskleuren van de honingraat in
`RAAT_STATUS`.
