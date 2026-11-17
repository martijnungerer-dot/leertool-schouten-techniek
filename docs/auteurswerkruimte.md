# Auteurswerkruimte — architectuur en status

4 november 2026. Eigenaar/opdrachtgever: Martijn. Status: ontwikkelkandidaat.
Basis: kandidaat PR 72. Geen deployment of gewijzigde toegang.

## Ingang

Alleen de kaart Maak een nieuwe lesboom opent de auteursstroom. De eerste raat
is Bronnen, met zoeken in eigen bronnen en broninvoer. Er is geen aparte
knop voor een lesboom uit bronnen. Opgeslagen concepten zijn vanuit deze stroom
te heropenen; de kaart zelf start een nieuw leeg concept.

## Gegevens en leerkant

`content.auteurs` bewaart conceptbomen met vaste IDs, bron-ID's, conceptlessen,
publicatiebasis en voorbereide uitwerktaken. Conceptlessen staan buiten `topics`.
Alleen expliciet publiceren brengt de geselecteerde gecontroleerde lessen over
naar het bestaande leerlingmodel. De leerlingrenderer en herhaalregels worden
hergebruikt. Bestaande lessen en voortgang worden niet gemigreerd.

Iedere conceptles heeft een vaste les-ID en onderwerp-ID. Deze eerste uitvoering
publiceert één onderwerp per conceptles. De gekozen volgorde wordt de volgorde
van nieuwe onderwerpen; voorgangers en meerdere lessen binnen één onderwerp
blijven vervolgwerk. Gepubliceerde lessen uit deze werkruimte kunnen via hetzelfde
concept worden herzien. Overnemen van willekeurige oudere lessen als concept is
nog niet aangesloten; de bestaande bewerker blijft beschikbaar.

De publicatiebasis is een momentopname. Als de les elders is veranderd, weigert de
publicatie overschrijven. Ongewijzigde vragen behouden hun ID. Veranderde vragen
krijgen een nieuwe ID met vorigeId, zodat bestaande kennis niet wordt geërfd.
Concept en publicatie delen geen bewerkbare vragenobjecten.

## Opslag en bronverwerking

Alles blijft in de bestaande browseropslag. Concept bewaren is expliciet;
verlaten met onbewaarde conceptwijzigingen vraagt bevestiging. Broninvoer wordt
bewaard met de bronactie. Bewaarde concepten zitten in de normale back-up; oudere
back-ups zonder auteurs blijven geldig. Gebruik een oudere app niet om nieuwe
concepten opnieuw te exporteren: die kent het veld auteurs nog niet.

Tekst plakken, bestaande bronnen selecteren, meerdere bestanden en slepen werken.
TXT/MD/CSV/JSON worden als tekst gelezen, niet als gestructureerde tabellen.
Andere bestanden worden als data-URL bewaard met status wacht-op-extractie; links
krijgen wacht-op-ophalen. Geen automatische netwerkophaling. Geen inhoudsanalyse
claimen zolang tekst ontbreekt. Succesvolle tekstinvoer krijgt ingelezenOp; pending
bronnen hebben geen gefingeerd succesmoment.

Maximaal 2 MB per bestand in deze browserkandidaat. Browserquota kunnen eerder
bereikt worden; een fout laat het huidige venster intact en wordt gemeld. De
productieroute voor hele handboeken vereist serverobjectopslag en extractiewerkers,
met een gecontroleerde tekstpreview, pagina/passagereferenties en OCR-kwaliteitsmelding.
De beperking is tijdelijk en geen definitieve producteis van Martijn.

## Servergrens vóór providerkeuze

`maakAuteursAanvraag` vormt een expliciete whitelist: aanvraag-ID, versie, soort
(lesboom/lessen), geselecteerde bron-ID/naam/tekst, geselecteerde les-ID/onderwerp/
leerdoel en vraagprotocol 1/2/3. Geen leerlingnamen, scores, kennis, hele app-back-up
of binaire bijlagen in een modelaanvraag. Onleesbare bronnen blokkeren de aanvraag.
Dit is een voorbereid contract; er is nog geen netwerkadapter of gehost endpoint.

De voorziene server kent drie verantwoordelijkheden:
1. Broninname/objectopslag en extractie (PDF, Office, afbeeldingen/OCR, links).
2. Persistent taakbeheer: aanvraag-ID voor deduplicatie; per les wacht/bezig/klaar/
   fout/onderbroken; pauzeren en expliciet opnieuw proberen; resultaatversies.
3. Provideradapter: tokenmeting, begrensde uitvoer, kostenregistratie en schema-
   plus bronreferentievalidatie. Resultaten worden voorstellen, geen publicaties.

De browser kan een uitwerkopdracht klaarzetten. Taken blijven op wacht zolang de
AI-voorziening uitstaat. `hervatAuteursTaken` markeert onderbroken taken; uitvoerder,
resultaatcontrole en serverpersistentie zijn nog niet aangesloten. Geen nepresultaten.
Token- en kostenschatting zijn onbekend tot tokenizer/model/tarieven zijn vastgesteld.

## Nog uit te werken vóór volledige oplevering

Werkelijke serverextractie/OCR/linkophaling; AI-lesboomvoorstellen met bronpassages;
uitwerktaken uitvoeren, annuleren en hervatten; voorstellen per les overnemen;
kostenplafond; uitgebreide honingraatredactie en afhankelijkheden; bestaande lessen
als concept openen. Provider, hosting, auth, gegevensafspraken en geheimen volgens
auteurs-ai.md. Geen activering of publicatie in deze opdracht.

## Controle

Build + 43 controles, inclusief publicatieselectie, versies, onveranderde originele
inhoud, conflictweigering, vraag-ID's, whitelist en herstel van taakstatus.
Browser op 1180/766: tekstbron, twee conceptlessen, bewaren/herladen, handmatig
uitwerken, geselecteerde publicatie en back-up met concepten. Geen JS-fouten.
