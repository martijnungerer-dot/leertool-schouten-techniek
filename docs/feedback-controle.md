# Controleverslag feedback — 17 november 2026

Status: technisch geteste reviewversie; geen formele huisstijlvrijgave.
Build: `2026.11.17-feedback.1`, gebaseerd op main `4e4c6e1`.
HTML SHA-256: `d971d63c7b7792db8d920ab60beb61fbfed076746faba7127fa3ce2b7b8c8f34`.

## Uitgevoerd

- `node build/build.cjs`: geslaagd, HTML uitsluitend gegenereerd uit de bron.
- `node build/test.cjs`: 49 controles geslaagd (44 bestaande, 5 feedbackcontroles).
- `git diff --check`: geslaagd.
- Chromium 154.0.8037.57 via geïnstalleerde Playwright, geen installatie toegevoegd.
- Browsernetwerk uitgeschakeld. Alleen het HTML-document wordt via Playwright
  request-interceptie uit het bestand geleverd; overige aanvragen worden afgebroken.
  Geen webserver of hosting gestart. In de geteste routes alleen documentaanvragen,
  geen externe requests of JavaScript-fouten.
- Tik en muisklik selecteren zonder de onderliggende knop te activeren; slepen
  bewaart de juiste rechthoek. Mobiele tikken zijn met touch-events getest.
- Lokale suggestie Knop/Invoer, aanpassen herkenningswoord, ongeldige meervoudige
  woorden en lege feedback, types, opslaan/annuleren en Escape.
- Direct zichtbaar logboek, nieuwste eerst; twee gelijke woorden openen elk hun
  eigen tekst. Lange lijst blijft begrensd, scrollbaar en via toetsen bereikbaar.
- Twee submits in dezelfde beurt geven één melding; fout/herstel geeft één ID.
- Geïnjecteerde QuotaExceededError: invoer blijft intact, geen succesmelding;
  opnieuw proberen bewaart eenmaal. Leesfouten worden zichtbaar gemaakt.
- Herladen en opnieuw openen behouden meldingen. JSON-export is gedownload en
  geparseerd, inclusief formaatversie, datumnaam, tekst en markering; lokaal blijft
  alles staan. De unitcontroles toetsen ook export van les-/vraagcontext.
- Les- en vraag-ID van een werkelijk geopende les komen mee. Na een echt gegeven
  antwoord blijven de volledige bestaande inhouds-/voortgangsleutels bytegelijk
  tijdens feedback geven. De 44 bestaande controles toetsen ook de AI-leergang,
  bestaande eigen inhoud, voortgang, herhaling en back-up/herstel.
- Escape vanuit feedback sluit niet de les of de open instellingen eronder.
  Focus keert terug; Tab/Shift+Tab blijven binnen het feedbackformulier.
- Lesvoorbereiding en herhaaloefenen zijn doorlopen; de actieve herhaalvraag
  krijgt de juiste les-/vraag-ID. Een veld met een geheime testwaarde is gemarkeerd;
  die waarde komt niet in feedbackopslag terecht. Opnieuw openen in een tweede
  tabblad en beschadigde feedbackopslag zijn gecontroleerd.
- Extra adapterproef: een vertraagde bewaaractie wist een daarna geopend concept niet.

## Schermcontrole

Werkelijke browservensters: 1180×820, 766×900, 390×844, 320×568, 1536×864,
1920×1080, 2560×1440 en 3440×1440 CSS-pixels. Dit zijn testvensters, geen claim
over de fysieke Dell-monitor. Op iedere maat: welkom, formulier, overzicht,
les, vraag met antwoord, instellingen, vol logboek en detail bekeken/getest.
De screenshots en hun bronhash zijn in de taakwerkmap vastgelegd onder
`/tmp/feedback-controle/bewijs.json`; tijdelijke browsers bevatten uitsluitend
testfeedback en de bestaande startinhoud. Ze zijn niet meegeleverd aan gebruikers.

Visuele beoordeling door de uitvoerende assistent, geen onafhankelijke of
menselijke goedkeuring: de bestaande ST/UI-kleuren, randen en letterfamilie
worden hergebruikt. De nieuwe oranje potloodknop heeft donkere tekst en het
formulier zichtbare focus. Inhoud blijft gescheiden van de feedbackbalk.
Een aanvankelijk te klein lesvlak op 320×568 is hersteld met scrollruimte in
het leergedeelte. Horizontale overflow en overlap van appvlak en feedbackbalk
zijn op alle bovenstaande maten gecontroleerd. Op kleine vensters moet de
gebruiker binnen het leergedeelte en binnen het logboek kunnen scrollen.

## Resterende grenzen

1. **Werkelijk file:// openen.** De beheerde Chromium weigert file:// met
   `ERR_BLOCKED_BY_ADMINISTRATOR`. Het exacte HTML-bestand is offline getest via
   request-interceptie, maar rechtstreeks openen/dubbelklikken en persistentie
   na browserherstart moeten nog in een gewone Chrome/Edge worden bevestigd.
   Browserbeleid is niet omzeild. Het product bevat geen test-URL of serververeiste.
2. **Formele huisstijlpoort.** De cloudskill schrijft een goedgekeurde webreferentie
   en `scripts/snelle_huisstijl_check.py` voor. `approved_references` in de gelezen
   broninventaris bevat geen webmal; het script is niet aanwezig in de werkmap
   en kon ook niet via skills.read worden opgehaald. De bestaande app is als
   stijlbron behouden, maar niet zelf als formeel goedgekeurde mal verklaard.
   Daarom geen formele PASS, definitieve downloadpublicatie of Page-bijlage.
   Dit verslag vervangt die vrijgave niet. De gebruiker vroeg expliciet een
   potlood; dat bedieningssymbool is behouden als Unicode-teken, geen nieuw
   Schouten-categoriesymbool of gewijzigde logo-asset.
3. **Onafhankelijke review.** Nog door Claude conform CONTRIBUTING.md. Geen merge
   of Sites-publicatie uitgevoerd. Open auteurswerkruimte PR 74 niet overgenomen;
   in de lesmodule is uitsluitend een contextattribuut toegevoegd.
4. **Airtable.** De beschikbare connector biedt alleen leesgereedschap en
   `airtable-mcp` is niet geïnstalleerd. Projectstatus is in issue/PR vastgelegd,
   niet in Airtable bijgewerkt. Geen andere koppeling of credentials toegevoegd.
5. **Browsergrenzen.** Geen algemene WCAG-certificering, echte mobiele hardware-
   of Safari/Firefox-test. Lokale opslag is gebonden aan browserbeleid/profiel/
   bestandslocatie; er is geen centrale ontvangst, toegangsscheiding of automatische
   back-up van feedback.
