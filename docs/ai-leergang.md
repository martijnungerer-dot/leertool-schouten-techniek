# Slim werken met AI — meegeleverde leerboom

Werkende kandidaat voor onafhankelijke review, 17 november 2026. Opdrachtgever:
Martijn Ungerer. [Issue 78](https://github.com/martijnungerer-dot/leertool-schouten-techniek/issues/78).
Basis: hoofdapp op `bef7f80d8ce30f8fc1ae96a67594f4faf57614a3`.

## Besluit en beperkte uitzondering

Martijn vraagt in Codex een kant-en-klaar lesblok volgens de aangeleverde
`Codex_opdracht_AI_leergang_Schouten_Techniek.md`. Die opdracht omvat één
meegeleverde AI-leerboom in de bestaande hoofdapp. Daarom geldt voor uitsluitend
**deze aangeleverde en geredigeerde AI-leergang** een uitzondering op de regel
“geen lesstof in de broncode” uit CONTRIBUTING.md. Het is geen toestemming om
andere lessen of technische testdata in de app te zetten. De bestaande afspraak
voor NEN 3140-beoordeling blijft gelden; deze leergang bevat geen instructies
voor werkzaamheden aan elektrische installaties.

De bronbrief heeft SHA-256
`8304601b854f8b905239d01fe860cd00401bf81931fba7b813a448ef47033e8b`.
De uitvoerbare bron is `src/technische-startinhoud.js`; het JSON-back-upomhulsel
en de lege `leren`-gegevens uit de bijlage zijn niet als upgrade opgenomen.

[PR 77](https://github.com/martijnungerer-dot/leertool-schouten-techniek/pull/77)
wijzigt de algemene werkafspraken en stond tijdens implementatie open. Deze PR
legt de beperkte uitzondering hier vast en verandert CONTRIBUTING.md, AGENTS.md,
CLAUDE.md en README.md niet parallel. Neem na de besluitvorming over PR 77 daar
een verwijzing naar deze uitzondering op. De aangeleverde opdracht en dit
besluit bepalen de beperkte scope; er is geen algemene herziening van rollen.

## Wat de gebruiker krijgt

| Onderwerp | Niveau/positie | Lessen | Vragen |
| --- | --- | ---: | ---: |
| ChatGPT in je dagelijkse werk | 1 / 1 | 5 | 10 |
| Van losse vraag naar workflow | 2 / 1 | 5 | 10 |
| Wat ervaren AI-gebruikers anders doen | 2 / 2 | 8 | 16 |
| Zelf digitale ondersteuning maken | 3 / 1 | 3 | 6 |

Alle vier onderwerpen zijn direct bereikbaar. De tabel in de opdracht is
leidend boven de afwijkende tiers 1/2/3/4 in de bron-JSON. Iedere les heeft vier
korte leesblokken, een praktijkopdracht en twee vragen. Alle 21 herhaalde tweede
vragen zijn vervangen door eigen toepassingssituaties met feedback. Ze hebben
nieuwe, vaste IDs (`<les-id>-toepassing-01`); de generieke oude vraag krijgt zo
geen onterechte leergeschiedenis mee. Eerste vragen houden hun identiteit;
antwoordposities wisselen zonder de correcte antwoordtekst te veranderen.

De redactie maakt voorbeelden concreet voor monteurs, werkvoorbereiding,
administratie en teamleiding. Token hygiene behandelt relevante context en
overdracht, zonder extra gebruiksuren te beloven. Beschikbaarheid en rechten
bij projecten, connectors en terugkerende taken zijn expliciet voorwaardelijk.
De voorbeelden bevatten geen werkelijke klant- of personeelsgegevens. De
AI-voorziening van deze leertool blijft uit.

## Starten en bestaande gegevens

`laden()` voegt de meegeleverde boom in het geheugen toe aan geldige inhoud
waarin **geen enkel meegeleverd domein-, onderwerp-, les- of vraag-ID** bestaat.
Het is één atomaire toevoeging van de complete boom, geen gedeeltelijke merge.

- Nieuwe opslag: één leerboom, vier onderwerpen, 21 lessen, 42 vragen. Geen
  afgeronde lessen of beantwoorde vragen. De bestaande app registreert wel het
  werkelijke bezoek als openingsdag.
- Bestaande eigen inhoud: ongewijzigd behouden, inclusief bronnen en aanvullende
  velden. De AI-boom verschijnt daarnaast. Er is geen achtergrondwrite van
  lesinhoud bij openen. Een gewone bewaaractie neemt de zichtbare inhoud mee;
  een back-up bevat deze ook direct.
- Bestaande meegeleverde IDs, ook bij een onvolledige eerdere import: de gehele
  opgeslagen inhoud krijgt voorrang. Geen overschrijven, aanvullen of hernoemen.
  Dat voorkomt dubbele IDs en verwisselde voortgang. Een eerder geïmporteerde
  AI-bronset krijgt dus niet stilzwijgend de nieuwe vragen; daarvoor is later een
  expliciete inhoudsmigratie nodig.
- Herladen en herhaald initialiseren: geen duplicaten. Bewerkte titels, vragen en
  verwijderde lessen binnen een bestaande AI-boom blijven behouden.
- Verwijderen van de **volledige** AI-boom en al zijn IDs: bij opnieuw openen
  verschijnt de meegeleverde boom weer. Dit is vaste startinhoud, geen
  eenmalige installatie. In deze kandidaat bestaat geen aparte uitzetoptie.
- Herstel: een back-up met de AI-boom behoudt exact die inhoud en identiteiten.
  Een oude back-up zonder die boom wordt gewoon teruggezet; bij de volgende
  paginalaad verschijnt de vaste boom weer volgens dezelfde regels.

De inhoudsloader schrijft niets naar voortgang, kennis of voorkeuren. De
bestaande leerlogica blijft verantwoordelijk voor bewaren en herhalen. Een
latere build mag bestaande inhoud onder dezelfde IDs niet stil aanpassen.
Plan inhoudsupdates apart, met review en een bewuste migratie wanneer de
betekenis van een vraag verandert.

## Controles

- `node build/build.cjs`: geslaagd; gegenereerd HTML-bestand meegenomen.
- `node build/test.cjs`: 44 controles geslaagd. De lege-starttest is vervangen
  door controles op aantallen, unieke vragen/IDs, geldigheid, vrije toegang,
  idempotentie, conflicten, ongewijzigde opslag, back-up en echte voortgang.
- Chromium/Playwright: alle 21 lessen op **1180 × 850** en **390 × 844** via de
  echte honingraat geopend en met toetsenbordbediening doorlopen. Alle 84
  leesblokken per viewport inhoudelijk tegen de bron vergeleken, alle vragen
  beantwoord, lessen afgerond en voortgang/antwoorden na reload gecontroleerd.
  Ook fout antwoord en opnieuw proberen getest. Geen JavaScript-fouten.
- Bestaande eigen boom, bron, beantwoorde vraag, afgeronde les en voorkeuren op
  1180 en 390 pixels: behouden. Werkelijke back-updownload en -import via
  Instellingen geslaagd; beide start-/beheerrollen bruikbaar.
- Herhalen op 766 en 390 pixels: na echte beantwoording de testklok twee dagen
  vooruitgezet. Beide vragen verschenen en schoven na goed beantwoorden naar
  doos 2. Dit waren geïsoleerde testbrowsers, geen geleverde voorbeeldvoortgang.
- Schermvergelijkingen op 390, 766, 1180, 1536, 1920, 2560 en 3440 pixels.
  Overzicht, honingraat en token-hygieneles zijn met dezelfde tijdelijke inhoud
  pixelgelijk aan de hoofdapp op de basiscommit. Alle vier onderwerpen zijn op
  die maten doorklikbaar. Geen horizontale pagina-overloop in die controles.
- Handmatige assistentcontrole van inhoud, mobiele toepassingsvragen en
  representatieve vergelijkingsbeelden: bestaande kleuren, typografie,
  leesbare afbreking en bediening behouden. Lange mobiele vragen scrollen in
  het hoofdvlak; de afrondknop is bereikbaar.

Het lokale browserdossier bevat 296 captures met build- en beeldhashes plus de
scripts en aanvullende gegevens-/herhaalproeven. Het is geen menselijke of
onafhankelijke review. De HTML-hash van de geteste build is
`f15c7065ea53a98c7cd3351587e8dbc82f99e4fd1559582084084760dd74fdb2`.

## Open voor definitieve vrijgave

1. **Onafhankelijke review door Claude.** Er is hier geen Claude-uitvoeromgeving
   beschikbaar. De PR vraagt die review; er is geen onafhankelijke goedkeuring
   verzonnen en er wordt niet zelf gemerged.
2. **Formele huisstijlvrijgave.** De cloudskill verwijst naar
   `snelle_huisstijl_check.py`, `maak_huisstijl_vergelijking.py` en
   `check_huisstijl_vrijgave.py`. De leesbare skill en referenties zijn
   beschikbaar, maar deze scripts en de broninventaris konden niet via de
   skillprovider worden opgehaald en staan niet in de werkomgeving. Daarom is
   de voorgeschreven automatische eindpoort niet uitgevoerd. Werkelijke
   browser-, inhouds- en vergelijkingscontroles zijn hierboven afzonderlijk
   vastgelegd; dit is een reviewkandidaat, geen definitief vrijgegeven release.
3. **Airtable.** De beschikbare connector heeft alleen leesgereedschap; de CLI
   en een CLI-token ontbreken. Taak/besluit zijn in issue 78 vastgelegd maar
   niet in Airtable bijgewerkt. Geen andere accountkoppeling geactiveerd.

## Korte gebruiksroute voor de kandidaat

Open het gebouwde `Leerplatform.html`, kies **Naar mijn lesbomen** en daarna
**Slim werken met AI**. Kies een van de vier raten en een les. Lees met
**Volgende**, beantwoord de twee vragen en kies **Les afronden**. Voortgang
blijft in dezelfde browser. Via **Instellingen → Back-up downloaden** bewaar je
je inhoud en voortgang. De oefeningen worden in een toegestane AI-omgeving
uitgevoerd; er is geen werkende AI-koppeling in deze leertool.

## Afzonderlijk Sites-publicatievoorstel

Op 17 november 2026 is via Sites gecontroleerd:

- Bestaand project: `appgprj_6ae1af457a948191a491aff0e677cd81`, **Leerplatform pilot**.
- Huidige URL: <https://leerplatform-pilot.schouten-tec-9159.chatgpt.site>.
- Status actief, opgeslagen versie 1; toegang **custom** (beperkte toegangslijst),
  nul externe bezoekers. Geen toegang gewijzigd.
- Versie 1 verwijst naar broncommit `00ed8e68dbff1f9c6ddfb1ebc60b3ce6f46a8a4f`.
  Dit is een afzonderlijke Sites-versie, geen automatische GitHub-release.
  Het archief van deze versie was via de bestandsprovider niet op te halen;
  de actieve bestanden zijn dus niet inhoudelijk opnieuw geïnspecteerd.

**Voorstel:** publiceer na review, vrijgave en Martijns expliciete akkoord de
gecontroleerde hoofdapp naar dit bestaande project en behoud de huidige
beperkte doelgroep. Alleen de meegeleverde AI-lesstof en appcode worden in de
HTML gedeeld, geen browsergegevens. Dezelfde origin en opslagsleutels blijven
nodig om bestaande lokale gegevens te blijven zien. Publiceren zelf migreert
geen gegevens tussen browsers. De toevoegstrategie hierboven geldt bij de
volgende paginalaad.

Voor uitvoering: de actuele Sites-bron/configuratie openen met de officiële
source-workflow, bestaande bindings behouden, de goedgekeurde HTML als
statische `index.html` opnemen, bron synchroniseren en een nieuwe versie
opslaan/deployen. Controleer de bereikbaarheid daarna als toegestane bezoeker
met lege browseropslag, en laat een tweede beoordelaar dezelfde route nalopen.
“Zonder import” betekent niet “zonder de bestaande toegangscontrole”.

Nieuwe deelnemers of een bredere interne doelgroep vragen een afzonderlijke
keuze over toegang. Openbare publicatie valt buiten dit voorstel en verloopt
volgens de ST-ontwikkelstandaard via beheerder Marnix of Bram.

Er is geen Sites-versie opgeslagen, geen deployment gestart en geen release of
merge uitgevoerd. De serverport uit
[PR 57](https://github.com/martijnungerer-dot/leertool-schouten-techniek/pull/57),
de auteurswerkruimte uit
[PR 74](https://github.com/martijnungerer-dot/leertool-schouten-techniek/pull/74)
en de schermreparaties uit
[PR 76](https://github.com/martijnungerer-dot/leertool-schouten-techniek/pull/76)
zijn niet in deze kandidaat opgenomen. De enige runtimewijziging buiten de
startinhoud is de aanroep in `laden()`; de gewijzigde tests en gegenereerde HTML
moeten bij toekomstige merges opnieuw worden samengevoegd/opgebouwd.
