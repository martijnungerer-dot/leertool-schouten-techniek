# Werkafspraken

Aan dit project werken drie partijen: Martijn, Claude en ChatGPT (Codex). Twee
daarvan zijn AI en zien elkaars werk alleen via deze repo. Daarom staan de
afspraken hier, en niet in iemands hoofd.

## Bouwen en controleren

Node.js is genoeg; er is geen npm-installatie nodig.

```bash
node build/build.cjs   # bouwt Leerplatform.html uit src/
node build/test.cjs    # draait de geautomatiseerde controles
```

Beide moeten slagen voordat je een pull request opent. De controles draaien ook
in GitHub Actions bij elke PR.

## Vier regels waar niet van afgeweken wordt

1. **Bewerk `Leerplatform.html` nooit met de hand.** Het is gebouwd uit `src/`.
   Een handmatige wijziging is bij de volgende build weg. De controles in CI
   bouwen opnieuw en vergelijken; loopt het uit de pas, dan faalt de PR.
2. **Geen sleutels in de repo en geen sleutel in het eindbestand.** Alles in dat
   HTML-bestand is leesbaar voor wie het opent. Een sleutel erin is een gelekte
   sleutel. Sleutels horen aan de serverkant.
3. **Lesinhoud over elektrotechniek gaat pas op `concept: false` als iemand die
   NEN 3140-vakbekwaam is hem heeft nagekeken.** Wij schrijven geen
   veiligheidsinstructies die iemand in de praktijk volgt zonder die controle.
4. **Verzin geen voortgang, scores of herhaalgeschiedenis** om een scherm voller
   te laten lijken. Leeg is leeg, en dat mag je zien.

## Van idee naar main

1. **Issue eerst.** Elk stuk werk heeft een issue. Staat er geen issue, maak er
   een.
2. **Claim hem.** Zet jezelf erop (of zet een reactie eronder) vóór je begint.
   Twee werkers in hetzelfde bestand kost meer tijd dan het oplevert.
3. **Eigen branch**, genoemd naar wie het werk doet:
   `claude/<korte-naam>`, `codex/<korte-naam>`, `martijn/<korte-naam>`.
4. **Pull request naar `main`.** Vul het sjabloon in; vertel ook wat je *niet*
   hebt gedaan.
5. **Groene controles en één review.** De andere AI-werker of Martijn kijkt mee.
   Een AI die zijn eigen PR goedkeurt is geen review.

## Niet in elkaars vaarwater

De broncode zit grotendeels in één groot bestand (`src/leerplatform.jsx`).
Zolang dat zo is, botsen twee werkers daar gegarandeerd. Daarom:

- Werk aan één onderwerp tegelijk en houd PR's klein.
- Begin pas aan een gebied waar een ander een open PR heeft als die binnen is.
- Het opsplitsen van dat bestand in modules heeft voorrang boven nieuwe functies;
  daarna is parallel werken pas prettig.

## Skills

Vier skills staan in `.claude/skills/`; Codex leest ze via de koppelingen in
`.agents/skills/`. Eén bron, dus pas ze alleen in `.claude/skills/` aan. De
bestanden zijn ongewijzigd overgenomen; wat voor dit project anders is, staat
hier.

| Skill | Gebruik bij | Let op in dit project |
| --- | --- | --- |
| `webapp-testing` | Echte gebruikershandelingen doorlopen: les openen, antwoorden, herhalen, herladen. | Open `Leerplatform.html` rechtstreeks met een `file://`-adres; er is geen server en `with_server.py` is niet nodig. Playwright voor Python is een hulpmiddel op de machine van de werker en hoort niet in `build/` of CI. |
| `accessibility` | Toetsenbord, contrast, schermlezer, klikdoelen (WCAG 2.2). | Vooral de honingraatnavigatie en de interactieve vragen. |
| `performance` | Opstarttijd en trage interacties meten. | Het product is één HTML-bestand: laat wat over servers, CDN's en caching gaat links liggen. |
| `frontend-design` | Een nieuw scherm ontwerpen. | De huisstijl van Schouten Techniek is leidend. Botst de skill met de huisstijl of met `design`, `design-system` of `ui-ux-pro-max`, dan wint de huisstijl. |

De skills verwijzen soms naar `core-web-vitals` en `web-quality-audit`; die zijn
niet overgenomen.

## Stijl

- **Nederlands**, overal: schermteksten, commitberichten, commentaar, issues,
  documentatie. Codenamen mogen Engels blijven waar dat al zo is.
- **Geen uitlegteksten in de schermen.** De werking spreekt voor zich. Een
  waarschuwing bij iets onomkeerbaars mag; een toelichting bij een knop niet.
- De coderichtlijnen in `CLAUDE.md` gelden voor iedereen: kleinst mogelijke
  wijziging, geen abstracties voor eenmalig gebruik, geen opschoning van code
  die je toch niet aanraakt.
- Ruim op wat jouw wijziging ongebruikt maakt; laat bestaande dode code met rust
  en meld hem in plaats daarvan.

## Wat niet zonder overleg gebeurt

- Een nieuwe afhankelijkheid of bouwstap toevoegen.
- De opslagstructuur van inhoud of voortgang wijzigen (bestaande gegevens van
  testers gaan dan kapot).
- Iets koppelen dat geld kost of gegevens naar buiten stuurt.
