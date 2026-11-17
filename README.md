# Leerplatform — Schouten Techniek

Microlearning voor de technische dienst: lesbomen als honingraat, korte lessen,
en herhaling op het moment dat je iets dreigt te vergeten. Eén zelfstandig
HTML-bestand dat je in de browser opent — geen server, geen installatie.

**Status: testfase.** De tool wordt klaargemaakt om met collega's te testen.
Waar de grenzen van deze versie liggen, staat onderaan.

## Nieuwste versie downloaden

**[Download de nieuwste versie](https://github.com/martijnungerer-dot/leertool-schouten-techniek/releases/latest/download/Leerplatform.html)**.
Deze link wijst altijd naar de laatste versie en start meteen een download.

1. Maak in je huidige versie eerst een back-up (Instellingen → Back-up
   downloaden).
2. Verwijder je oude `Leerplatform.html`. Zo krijgt de nieuwe dezelfde naam
   en dezelfde plek, en blijft je voortgang erbij.
3. Klik op de link. Je moet op GitHub zijn ingelogd: de repository is privé.
4. Open het gedownloade bestand in Chrome.

Na elke merge naar `main` zet GitHub automatisch een nieuwe versie klaar onder
[Releases](https://github.com/martijnungerer-dot/leertool-schouten-techniek/releases),
maar alleen als de controles groen zijn. Oudere versies staan daar ook; de link
hierboven geeft altijd de nieuwste.

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
| `src/modules/` | De broncode — hier bewerk je alles. Leesbaar React, in onderdelen per scherm of taak. |
| `src/technische-startinhoud.js` | De meegeleverde AI-leergang en het toevoegen daarvan met behoud van bestaande inhoud. |
| `build/bron.cjs` | De vaste volgorde waarin de modules aan elkaar gezet worden. Een nieuwe module voeg je hier toe. |
| `build/build.cjs` | Bouwt het zelfstandige bestand. |
| `build/test.cjs` | De geautomatiseerde controles. |
| `build/vendor/` | React, Tailwind en de compiler. De compiler is bouwgereedschap en komt niet in het eindproduct. |
| `Leerplatform.html` | **Het eindproduct — gegenereerd, nooit met de hand bewerken.** |

## Meewerken

Aan dit project werken Martijn, Claude en ChatGPT (Codex). De werkafspraken staan
in [`CONTRIBUTING.md`](CONTRIBUTING.md). Martijn geeft opdrachten via Claude;
Claude en Codex bouwen en reviewen elkaars werk.

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
- **AI-leergang meegeleverd.** Via **Naar mijn lesbomen → Slim werken met AI**
  vind je vier direct toegankelijke onderwerpen met 21 lessen en 42 vragen.
  Je begint zonder scores of afgeronde lessen. Eigen lesbomen en voortgang
  blijven behouden; bestaande AI-inhoud wordt niet automatisch bijgewerkt.
  Het [toevoeg- en verwijdergedrag](docs/ai-leergang.md#starten-en-bestaande-gegevens)
  staat beschreven. Andere inhoud maak je zelf in de lesvoorbereiding.

## Veiligheid van de lesinhoud

Naast de op verzoek meegeleverde AI-leergang komt lesstof in de app doordat een
mens hem invoert. Straks kan een mens hem ook door de AI-functie laten maken uit
bronnen die hij aanlevert; die is nog niet aangesloten. Lesstof over
werken aan elektrische installaties wordt pas gepubliceerd nadat iemand die NEN
3140-vakbekwaam is hem heeft goedgekeurd. De tool dwingt dat nog niet af: wie
publiceert, regelt die controle zelf vooraf.

## Huisstijl

De vormgeving volgt de huisstijl van Schouten Techniek. De kleuren staan bovenaan
de broncode in `ST` en `UI`, de statuskleuren van de honingraat in `RAAT_STATUS`.

## Feedback tijdens het testen

Onderaan ieder scherm staan **Markeren**, **Over dit scherm**, **Mijn feedback**
en **Feedback downloaden**. Meldingen worden apart in deze browser bewaard;
het JSON-bestand geef je zelf aan de beheerder. Downloaden verstuurt niets.
Werking, adapterinterface en opslag staan in [docs/feedback.md](docs/feedback.md);
uitgevoerde controles en open verificatiepunten in
[docs/feedback-controle.md](docs/feedback-controle.md).
