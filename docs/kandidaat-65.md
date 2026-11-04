# Gecombineerde kandidaat — 4 november 2026

Status: kandidaat voor beoordeling, niet gepubliceerd. Basis: main `45ebf8a`.
De afzonderlijke PR's blijven open; deze branch combineert hun bronwijzigingen.
Geen migratie van opslag, nieuwe accounts, serverport of AI-activering.

## Herkomst

- [PR 66](https://github.com/martijnungerer-dot/leertool-schouten-techniek/pull/66): `54802ee`, scrollen en focus.
- [PR 67](https://github.com/martijnungerer-dot/leertool-schouten-techniek/pull/67): `6257df9`, bloktitels.
- [PR 68](https://github.com/martijnungerer-dot/leertool-schouten-techniek/pull/68): `50c845d`, handmatige vragen.
- [PR 69](https://github.com/martijnungerer-dot/leertool-schouten-techniek/pull/69): `f25c578`, testmodus.
- [PR 70](https://github.com/martijnungerer-dot/leertool-schouten-techniek/pull/70): `ecc1d0d`, wizardbronnen.
- [PR 71](https://github.com/martijnungerer-dot/leertool-schouten-techniek/pull/71): `bd17e13`, AI-afhankelijkheden.

## Verwerkte reviewpunten

De overlappende wizardstatus, publicatie en blokkop zijn gecombineerd: titel,
tekst en meerdere vragen blijven samen bewaard; de blokkop heeft de scrollfocus.
De blokknoppen hebben afzonderlijke toegankelijke namen. Beide wizards gebruiken
één publicatiefunctie voor blokken, met een controle op titel/tekst en ongewijzigde
invoer.

Bronnen zonder lesboom blijven in `bronnen.bibliotheek`. Het tabblad Bronnen
biedt nu de groep Gedeelde bibliotheek, ook zonder bestaande lesboom, met bekijken
en verwijderen. Annuleren verbergt een bewaarde bron daardoor niet meer.
Naam en tekst in de wizard hebben zichtbare labels en minimale lengtes.

De reviewvragen over gedrag zijn als volgt geïnterpreteerd op basis van issue 58:
zoeken in de bestaande bibliotheek omvat alle lesbomen en handmatig invoeren blijft
mogelijk zonder bronselectie. Dit is geen nieuwe vastgelegde keuze van Martijn.
Beide wizards gebruiken minimaal twee verschillende antwoordopties en vijf tekens
uitleg, zoals PR 68; inhoudelijke kwaliteitscontrole blijft de taak van de maker.
PDF/link-knoppen waren al placeholders: de broncode heeft geen werkende import.

## Validatie

- `node build/build.cjs` en `node build/test.cjs`: 40 controles geslaagd.
- Chromium op 1180, 766 en 390 pixels: nieuwe lesboom, tekstbron, twee getitelde
  blokken verplaatsen, twee/drie vragen publiceren en volledig doorlopen.
- Scroll na lang blok staat op nul; opgeslagen bron staat in Gedeelde bibliotheek.
- Back-up via de echte downloadknop; teruggezet via bestandsinvoer na wissen van
  testinhoud. Inhoud en kennis zijn gelijk aan de back-up; titels, bron-ID's en
  vragen blijven behouden. Geen JavaScript-fouten in die gecombineerde routes.
- Testmodus op 1180 en 766 pixels: bestaande afgeronde voortgang, fout/goed,
  afronden, herstart en sluiten; volledige browseropslag vóór/na gelijk.
- Herhaling van twee/drie vragen: ieder antwoord verwerkt en doos verhoogd.

Alle lesinhoud voor deze controles stond uitsluitend in tijdelijke browseropslag.
De kandidaat start leeg. Dit is geen test met de persoonlijke browser van Martijn.

## Beoordelen en later vervangen

Open het gebouwde Leerplatform.html voor beoordeling. Een andere URL of los bestand
heeft een andere opslagcontext; gebruik een back-up om eigen inhoud over te zetten.
Controleer de kandidaat en de aanvullende reparaties vóór een merge/publicatie.
Voor Sites blijft het bestaande besloten project behouden; deze opdracht wijzigt
geen hosting of toegang. AI blijft uit; zie auteurs-ai.md. Hoofdissue 65 blijft open.
