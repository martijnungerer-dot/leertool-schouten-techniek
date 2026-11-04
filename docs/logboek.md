# Logboek leertool

## 4 november 2026 — bronnen eerst en meerdere lessen

**Opdracht:** [issue 73](https://github.com/martijnungerer-dot/leertool-schouten-techniek/issues/73).
Martijn wil bronnen op meerdere manieren aanleveren, daaruit een hele lesboom
laten uitwerken en de server/API pas als laatste activeren. Concepten en
gepubliceerde leerlinginhoud blijven gescheiden. Geen merge of publicatie.

**Gebouwd:** nieuwe auteurswerkruimte met Bronnen, Lesboom, Uitwerken en Controleren;
centrale bronselectie, tekst/bestanden/links aanleveren, meerdere handmatige
conceptlessen, bewaren/heropenen, testweergave en expliciete selectiepublicatie.
Vaste IDs, publicatieversies, conflictcontrole en behoud van ongewijzigde vragen.
Concepten opgenomen in bestaande inhoudsopslag en back-up. Uitwerkopdracht kan
worden klaargezet; contract sluit leerlinggegevens uit.

**Gecontroleerd:** 43 automatische controles; browser 1180/766 met twee lessen,
herladen, publicatie en back-up. Tijdens de test een gedeelde objectreferentie
tussen concept en publicatie gevonden en verholpen; regressiecontrole toegevoegd.

**Open:** volledige serververwerking van PDF/Office/scans/links, automatische
lesboom- en lesvoorstellen, uitvoerder voor hervatbare bulktaken, tokens/kosten,
bronpassages, boomafhankelijkheden en bestaande publicaties als concept openen.
Browserbestanden voorlopig maximaal 2 MB; hele handboeken vereisen serveropslag.
AI is uit. Geen gegevens naar een provider verstuurd. Niet klaar voor productie.

**Airtable-overdracht:** status 'In ontwikkeling / concept-PR', niet 'Af'. Issue 73
blijft open. Deze tekst kan via de aparte Airtable-chat worden verwerkt.

## 4 november 2026 — correctie ingang en eerste raat

**Opdracht van Martijn:** geen aparte knop 'Maak een lesboom uit bronnen'. Alleen
'Maak een nieuwe lesboom' opent de bron-eerst stroom; Bronnen is de eerste raat.

**Gewijzigd:** aparte knop verwijderd, bestaande nieuwe-lesboomkaart aangesloten
op een nieuw leeg auteursconcept. Opgeslagen concepten blijven kiesbaar. De vier
fasen gebruiken nu de bestaande stappenraat. Bovenaan Bronnen staat zoeken in de
eigen bibliotheek, met meerdere zoekwoorden, titelsortering, tekstfragmenten,
resultaattelling en selectie die behouden blijft bij zoeken en stapwisseling.
Er wordt niet op internet gezocht. Broninvoer blijft in dezelfde eerste stap.
De bestaande ingang Onderwerp toevoegen blijft beschikbaar.

**Controle:** build en 44 controles groen. Browser op 1180/766/390: oude knop
ontbreekt, nieuwe-lesboomkaart opent met Bronnen als actieve raat, nieuw concept
is leeg, zoeken/selecteren en stapwisseling werken, opgeslagen inhoud blijft
ongewijzigd bij sluiten zonder bewaren en Onderwerp toevoegen blijft bereikbaar.

**Status:** aanvulling op concept-PR 74. Geen merge, publicatie of AI-activering.
