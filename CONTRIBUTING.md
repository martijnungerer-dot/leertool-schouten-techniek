# Werkafspraken

Dit is de enige plek met de werkafspraken. `AGENTS.md` (Codex) en `CLAUDE.md`
(Claude) verwijzen hierheen. Staat iets daar anders dan hier, dan geldt dit
bestand.

## Wie doet wat

| Wie | Rol |
| --- | --- |
| **Martijn** | Opdrachtgever. Geeft opdrachten in het gesprek met Claude, beslist, en bekijkt gedrag in de app. Leest geen code. |
| **Claude** | Maakt van een opdracht issues en taken en bouwt zelf. |
| **Codex** | Werkt voorlopig niet mee. Martijn vraagt hem een review te doen als een reeks werk af is. |

De GitHub-koppeling van Codex start nog geen taken (zie #32). Daarom bouwt
Claude voorlopig alles en stuurt hij Codex niet aan. Dat verandert zodra Martijn
het zegt.

## Waar de stand van het werk staat

- **GitHub-issues en pull requests** zijn de werkvloer. Een issue is de opdracht;
  wat erin staat geldt. Elk gesprek dat aan het werk begint, kijkt eerst welke
  issues en pull requests open staan.
- **Airtable** (base "Leertool — projectbeheer") is het overzicht voor Martijn:
  taken, testbevindingen en besluiten. Wie een taak verplaatst (begonnen, in
  review, af), werkt ook Airtable bij.
- Besluiten van Martijn komen in Airtable, tabel Beslissingen, en in de issue
  waar ze over gaan.

## Bouwen en controleren

Node.js is genoeg; er is geen npm-installatie nodig.

```bash
node build/build.cjs   # bouwt Leerplatform.html uit src/
node build/test.cjs    # draait de controles
```

Beide moeten slagen, en het opnieuw gebouwde `Leerplatform.html` gaat mee in de
commit. CI bouwt opnieuw en faalt als het verschilt. Hoe je in de cloud een
browsercontrole doet, staat in de skill `leerplatform-omgeving`.

## Nooit

1. **Rechtstreeks naar `main` pushen.** `main` is technisch niet afgeschermd op
   dit abonnement; deze afspraak is het enige slot. Altijd een branch en een
   pull request.
2. **`Leerplatform.html` met de hand bewerken.** Het is gebouwd uit `src/`.
3. **Een sleutel in de repo of in het eindbestand.** Alles in dat HTML-bestand
   is leesbaar voor wie het opent. Sleutels horen aan de serverkant.
4. **Lesstof in de broncode of de repo.** Claude en Codex bouwen de leertool;
   zij zetten er nooit zelf lesstof in. Lesstof komt in de app doordat een mens
   hem daar invoert, of straks, als die is aangesloten, laat maken door de
   AI-functie van de app op basis van bronnen die een mens aanlevert. Testdata staat alleen in `build/test.cjs` of
   in een tijdelijke browsercontrole.
5. **Voortgang, scores of herhaalgeschiedenis verzinnen** om een scherm voller te
   laten lijken. Leeg is leeg.
6. **Uitlegteksten in de schermen.** De werking spreekt voor zich. Een
   waarschuwing bij iets onomkeerbaars mag; een toelichting bij een knop niet.

**Lesstof over werken aan elektrische installaties wordt pas gepubliceerd nadat
iemand die NEN 3140-vakbekwaam is hem heeft goedgekeurd.** De app dwingt dat nog
niet af: wie in de app lesstof publiceert, regelt die controle zelf vooraf. Zodra
de app een goedkeuringsstap heeft, neemt die dit over.

## Van opdracht naar main

1. **Issue eerst.** Elk stuk werk heeft een issue met "Wat moet er komen" en een
   "Klaar wanneer"-lijst die je kunt nalopen.
2. **Eén onderwerp per issue en per pull request.** Klein houden.
3. **Branch** `claude/<korte-naam>` of `codex/<korte-naam>`.
4. **Pull request naar `main`** met het sjabloon ingevuld, inclusief wat je
   *niet* hebt gedaan.
5. **Review.** Een AI keurt nooit zijn eigen werk goed. Zolang Codex niet
   meewerkt, bouwt Claude en merget Martijn. Codex reviewt achteraf, als Martijn
   hem daarom vraagt; bevindingen worden dan nieuwe issues of worden beantwoord
   met een reden.
6. **Mergen**, zie hieronder.

## Wie kijkt mee, wie merget

Martijn kijkt naar gedrag en beslist, maar leest geen code. Zolang Codex niet
meewerkt, merget Claude niets zelf: Martijn merget alles.

| Martijn beslist en kijkt mee | Claude merget zelf |
| --- | --- |
| Alles wat gebruikers zien of ervaren: nieuwe schermen, hoe het leren werkt. Martijn bekijkt het in de app. | Logica met controles die het bewijzen. |
| Werkafspraken: dit bestand, `AGENTS.md`, `CLAUDE.md`, de skills. | Bugfixes met een controle die het bewijst. |
| Sleutels, hosting, wat er naar een AI-dienst gaat (AVG). Claude en Codex adviseren. | Opruimen en opsplitsen waarbij het eindbestand gelijk blijft. |
| Wijzigingen die opgeslagen inhoud of voortgang raken. Claude en Codex adviseren. | Controles en bouwscript. |
| Een nieuwe afhankelijkheid of bouwstap, of iets dat geld kost. | |

Zodra Codex weer meewerkt, merget Claude de rechterkolom als de controles groen
zijn, de andere AI heeft gereviewd en er geen open bevindingen zijn, en meldt het
daarna aan Martijn. Na elke merge die Martijn kan zien, krijgt hij een
bijgewerkte versie om te bekijken.

## Niet in elkaars vaarwater

De broncode staat in `src/modules/`, één bestand per scherm of taak. De modules
delen één scope en worden in de volgorde van `build/bron.cjs` aan elkaar gezet;
een nieuwe module voeg je daar toe. Begin niet aan een gebied waar een ander een
open pull request heeft.

## Hoe we code schrijven

- **Eerst denken.** Benoem aannames. Zijn er meerdere uitleggen, leg ze voor in
  plaats van er stilletjes één te kiezen. Is iets onduidelijk, vraag het.
- **Zo eenvoudig mogelijk.** Niets wat niet gevraagd is: geen abstracties voor
  eenmalig gebruik, geen instelbaarheid die niemand vroeg, geen foutafhandeling
  voor wat niet kan gebeuren.
- **Chirurgisch.** Raak alleen aan wat moet. Pas aan bij de bestaande stijl.
  Ruim op wat jouw wijziging ongebruikt maakt; meld bestaande dode code in plaats
  van hem weg te halen.
- **Aantoonbaar af.** Maak van een opdracht iets dat je kunt nalopen ("schrijf
  een controle die de fout laat zien, en laat hem slagen") en ga door tot het
  klopt.
- **Nederlands**, overal: schermteksten, commitberichten, commentaar, issues,
  documentatie. Codenamen mogen Engels blijven waar dat al zo is.
- Noem je een issue of pull request, geef dan een directe link.

## Skills

De skills staan in `.claude/skills/`; Codex leest dezelfde via de koppelingen in
`.agents/skills/`. Eén bron: pas ze alleen in `.claude/skills/` aan, en koppel
een nieuwe skill ook voor Codex.

**De huisstijl van Schouten Techniek gaat altijd voor.** Geen skill kiest
kleuren of lettertypen; die staan in de broncode (`ST`, `UI`).

| Skill | Gebruik bij | Let op in dit project |
| --- | --- | --- |
| `leerplatform-omgeving` | Bouwen, testen en browsercontroles in de cloud. | Eigen skill van dit project. |
| `webapp-testing` | Echte gebruikershandelingen doorlopen: les openen, antwoorden, herhalen, herladen. | Playwright is gereedschap van de werker en hoort niet in `build/` of CI. |
| `accessibility` | Toetsenbord, contrast, schermlezer, klikdoelen (WCAG 2.2). | Vooral de honingraat en de interactieve vragen. |
| `apple-design` | Hoe een scherm aanvoelt: directe reactie, onderbreekbare beweging, beweging beperken. | Alleen het gedrag, niet het Apple-uiterlijk (glas, doorschijnendheid). |
| `ui-ux-pro-max` | De UX-regels: klikdoelen, contrast, formulieren, foutmeldingen, navigatie. | Gebruik nooit de paletten, lettertypen of de stap "design system genereren". |
| `frontend-design` | Een nieuw scherm ontwerpen. | Binnen de huisstijl. |
| `performance` | Opstarttijd en trage interacties meten. | Het product is één HTML-bestand: laat wat over servers, CDN's en caching gaat links liggen. |
| `core-web-vitals`, `web-quality-audit` | Waar `performance` en `accessibility` naar verwijzen; vooral nuttig zodra er hosting is. | `web-quality-audit` verwijst naar `best-practices` en `seo`; die zijn er niet. |
