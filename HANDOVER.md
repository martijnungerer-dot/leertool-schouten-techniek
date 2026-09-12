# Overdracht — Schouten Leerplatform (voor een nieuwe sessie)

> **Verouderd (12 september 2026).** Dit document beschrijft de situatie vóór de
> opschoning: de oude bron van 8098 regels, het Python-bouwscript en de
> AI-generatie. Die zijn vervangen. Lees `README.md` en `LEESMIJ.md` voor de
> huidige opzet; dit bestand blijft staan voor de geschiedenis.

Dit document brengt een nieuwe Claude Code-sessie snel op de hoogte, zodat er direct
en veilig aan de leertool gebouwd kan worden — inclusief het integreren van een
**nieuwe UI** die met Claude Design is ontworpen.

## Wat dit project is

Een AI-gestuurd **microlearning-platform** in één standalone HTML-bestand. Je opent
het in de browser (geen server). Het genereert leerpaden (domeinen → onderwerpen →
lessen) met de Anthropic API en laat een lerende erdoorheen navigeren.

## Repo & branch

- Repo: `martijnungerer-dot/Martijnswerk`
- Alle werk staat op branch **`claude/leertool-github-download-7cyk46`** (open in PR #1),
  nog **niet** naar `main` gemerged.
- **Aanbevolen vóór de nieuwe sessie:** merge PR #1 naar `main`, zodat de nieuwe sessie
  vanaf een schone, actuele `main` start. Doe je dat niet, laat de nieuwe sessie dan
  expliciet op deze branch verder werken.

## Architectuur (belangrijk!)

| Bestand | Rol |
| --- | --- |
| `src/leerplatform.jsx` | **De broncode** — dé plek om te bewerken. Leesbaar React. |
| `build/shell-head.html` | Vaste "verpakking" boven (React, Tailwind, Babel, laadscherm) **+ een demo-schil**. |
| `build/shell-tail.html` | Vaste opstartcode onder. |
| `build/build.py` | Bouwt `Leerplatform_demo_standalone.html` uit broncode + verpakking. |
| `Leerplatform_demo_standalone.html` | **Eindproduct** — gegenereerd, niet met de hand bewerken. |
| `README.md` | Werkwijze voor mensen. |

Techniek: **React (UMD) + Tailwind + Babel**, allemaal in het HTML-bestand. Babel
vertaalt de JSX **live in de browser** (`<script type="text/babel">`). Er is **geen
npm/bundler** — voeg dus geen build-tooling of npm-libraries toe; alles moet met
in-browser Babel werken.

### Demo-schil (offline testen kan!)

`build/shell-head.html` bevat een **mock** (`DEMO_MODUS = true`) die de aanroep naar
`api.anthropic.com` onderschept en geldige nep-antwoorden teruggeeft. Daardoor draait
de **hele generator-pijplijn offline** — je kunt de app dus headless renderen en
testen zonder API-sleutel. In de echte app roept `vraagAanModel(...)` het model aan.

## Werkwijze om te bouwen

1. Bewerk `src/leerplatform.jsx`.
2. Bouw: `python3 build/build.py`.
3. **Valideer de JSX** met exact de ingesloten Babel (vangt syntaxfouten):
   ```
   node -e '
   const fs=require("fs"),vm=require("vm");const g=globalThis;
   g.self=g;g.window=g;g.navigator={userAgent:"node"};
   g.document={createElement:()=>({setAttribute(){},style:{},appendChild(){}}),documentElement:{style:{}},head:{appendChild(){}},getElementsByTagName:()=>[],querySelectorAll:()=>[],addEventListener(){}};
   // pak het grote <script> (regel 322) uit shell-head als babel.js, of extraheer Babel-blok
   '
   ```
   (In de vorige sessie werd het 2,8 MB Babel-blok uit de HTML gehaald en met
   `Babel.transform(src,{presets:["react"]})` gedraaid. Chromium is voorgeïnstalleerd
   onder `/opt/pw-browsers/` voor headless render-checks via Playwright.)
4. Optioneel: headless renderen (Playwright + de Chromium in `/opt/pw-browsers/`) om
   te controleren dat de app mount zonder console-fouten.

## Datamodel

- **Domein** (kleur) → **Topic** (`titel`, `tier` 1–3, `prerequisites` [0 of 1],
  1–3 **orbs**) → **Orb** (`blokken`: tekst/vergelijking/tijdlijn/afbeelding; `vragen`).
- Kleuren staan in `ST` en `UI` (bovenaan de bron). Taalniveau = B2 (`TAALNIVEAU`),
  geldt voor de hele app. Er is een expliciete `SCOPE`-grens.
- Opslag: `window.storage` (localStorage) — dus **per browser/apparaat**, geen cloud.

## Belangrijkste componenten (zoek op naam in de bron)

- `Boom` — de lesboom (SVG honingraat-tegels, bruggen, monogrammen, hover-gloed).
- `TopicDetail` — lessenlijst van één onderwerp (met voortgangsbalk).
- `LesScherm` — het doorlopen van een les (lezen → vragen; voortgangsbalk).
- `Overzicht` — domeinsecties met `<Boom>` + `DomeinVoortgang`.
- `Beheer` — de content-/beheerkant (tabs: Leerpad maken, Losse lesstof, Bronnen, Domeinen).
- `LeerpadBeheer` + `PlanReview` — de generator met **plan-review** (zie onder).
- `voerLeerpadRunUit` — de generatie-toestandsmachine. Fasen:
  `bronkaarten → plannen → planreview → genereren → samenhang → klaar`.

## Wat al gebouwd is (in PR #1)

- Leesbare broncode + bouwscript + README losgetrokken uit het gebakken bestand.
- Lesboom: honingraat-tegels, hover-gloed, monogrammen, voortgangsbalken, zachtere
  schermovergangen (`scherm-in`).
- Generator **plan-review** (vier-ogen, nu 1 persoon): na "plannen" pauzeert de run
  in fase `planreview`; de mens zet onderwerpen aan/uit, plaatst **notities**
  (ook op gearceerde selectie) en laat de **AI meedenken** (`vraagMeedenken`); bij
  goedkeuren gaan notities mee als `sturing` naar `maakEenOrb`.
- Beheerkant warmer + versimpeld: "Zo werkt het"-stappenbalk, tabs in groepen
  (Maken / Instellingen), testklok verborgen achter "Geavanceerd".
- Fix: invoervelden onleesbaar in donkere-modus host → `color-scheme: light` +
  expliciete witte velden.

## De taak in de nieuwe sessie: nieuwe UI integreren

Er is met **Claude Design** een geheel nieuwe UI ontworpen. Doel: die UI in de app
brengen en de leertool afmaken. Aandachtspunten:

1. **Behoud de werkende logica** — vooral de generatie-pijplijn (`voerLeerpadRunUit`,
   `planLeerpad`, `maakEenOrb`, toetsen/redigeren) en de **plan-review + notities +
   AI-meedenken**. Dat is de kern; alleen de presentatie verandert.
2. **Blijf standalone** — geen npm/bundler; alles via de bestaande build (in-browser Babel).
3. **Richting die de gebruiker koos** (content-kant): leerpaden als **kaarten met
   voortgangsbalk** die je aanklikt → **wizard** per leerpad (naam → bronnen →
   genereren → losse les met AI-plaatsing). Kaarten zijn **sleepbaar** om te herordenen.
4. **Lesboom** werd te druk bevonden (honingraat + dikke bruggen + letters); de nieuwe
   UI vervangt dit waarschijnlijk — harde eis: de **volgorde/afhankelijkheid tussen
   onderwerpen moet leesbaar blijven** (of bewust losgelaten worden).
5. **Nog open / later:** echt **vier-ogen samenwerken** en voortgang die met je
   meereist vragen **hosting + accounts** (nu alleen localStorage). Dat is een aparte
   beslissing, geen onderdeel van de UI-integratie.

## Wat mee te nemen naar de nieuwe sessie

- De **nieuwe UI-code** van Claude Design (HTML/React/CSS) — het liefst als code, plus
  screenshots.
- Het **overzicht/start-prompt-bestand** dat Claude Design schreef.
- Deze `HANDOVER.md` (staat al in de repo).
