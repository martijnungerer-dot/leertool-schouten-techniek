# Lokale feedbackmodule

Reviewversie `2026.11.17-feedback.1`, gewijzigd op 17 november 2026.
Opdracht: [issue 80](https://github.com/martijnungerer-dot/leertool-schouten-techniek/issues/80).
De module is geïntegreerd in het zelfstandige HTML-bestand. Geen server,
installatie, account, netwerkverkeer of aanvullende runtime-afhankelijkheden.
Het bestaande React blijft bij de bouw volledig ingebed.

## Gebruik

Onderaan elk scherm staan de potloodknop **Markeren**, **Over dit scherm**,
**Feedback downloaden** en het direct zichtbare logboek **Mijn feedback**.
Markeren onderschept de tik/sleepbeweging zodat de onderliggende bediening niet
wordt geactiveerd. De selectie is geel. Escape annuleert alleen feedback en
herstelt de focus. Zonder markering kan de gehele route met het toetsenbord.
Type, één herkenningswoord en feedbacktekst worden gevalideerd. De eenvoudige
woordsuggestie beschrijft het soort onderdeel: Knop, Antwoord, Uitleg, Titel,
Link, Afbeelding, Invoer of Algemeen. Er worden geen veldwaarden of schermteksten
gekopieerd. Verschillende meldingen met hetzelfde woord blijven aparte knoppen.

Het logboek is begrensd en scrollbaar. De app en feedbackbalk hebben aparte
ruimte; bij korte vensters kan het leergedeelte scrollen. Het formulier gebruikt
een native dialoog met focusbegrenzing, zichtbare focus en gekoppelde labels.

## Modulegrens

- `src/modules/feedback-kern.jsx`: algemene interface, validatie, selectie,
  opslagadapter en export. Geen Schouten-tokens of afhankelijkheid van lesopslag.
- `src/modules/feedback-schouten.jsx`: bestaande ST/UI-tokens, potlood,
  versie, opslagnaamruimte, gereserveerde schermruimte en contextadapter.
- `build/bron.cjs`: neemt beide modules op vóór de app.
- De leerschermen bieden alleen `data-feedback-*`-attributen voor context.
  De inhoud van lessen en het berekenen/bewaren van voortgang zijn niet gewijzigd.

De kleine interface:

```js
<FeedbackModule
  opslag={{ list, save }}
  getContext={element => ({ schermnaam, lesId, lesnaam, vraagId, versie })}
  potlood={/* lokaal icoon */}
  privacytekst="..."
/>
```

`list()` retourneert de opgeslagen meldingen, nieuwste eerst; `save(melding)`
retourneert de werkelijk bewaarde melding. Beide mogen een Promise teruggeven.
Fouten moeten gooien/rejecten, nooit worden omgezet naar een leeg succesresultaat.
`save` is idempotent op `id`: een herhaalde poging levert dezelfde bewaarde melding
terug. Een toekomstige toegestane adapter moet dit contract en de foutafhandeling
behouden. Er is nu geen SharePoint-koppeling of netwerkadapter geïmplementeerd.
De interface en invoer hoeven voor zo'n latere koppeling niet opnieuw gebouwd.
Een afrondende trage opslag wist geen nieuw concept dat ondertussen is geopend.

`getContext(element)` wordt aangeroepen bij openen en na markeren. Het leest
uitsluitend expliciete contextattributen, geen formulierwaarden, resultaten,
accounts of andere browseropslag. Bij herhalen worden de IDs van de werkelijk
actieve les en vraag meegegeven. Een ontbrekende ID is `null`.

## Opslag en export

Per melding één localStorage-sleutel:
`schouten-leerplatform:feedback:v1:<id>`. Afzonderlijke sleutels voorkomen dat
twee tabbladen elkaars hele logboek overschrijven. De ID wordt één keer bij het
openen van het concept met browsercryptografie gemaakt, en blijft bij opnieuw
proberen gelijk. Een synchrone vergrendeling voorkomt dubbele submits.

Elke melding bevat `id`, `type`, `woord`, `tekst`, `tijdstip` (ISO met tijdzone),
`context` (schermnaam, les-ID/-naam, vraag-ID, appversie) en `markering` of `null`.
Markering bevat een rechthoek in CSS-viewportpixels, schermformaat in CSS-pixels
en een korte soortbeschrijving. Geen screenshot, DOM-tekst, invoerwaarde of
volledige leerresultaten. Het tijdstip wordt bij de eerste opslagpoging bepaald.
De melding **lokaal bewaard** verschijnt pas nadat de adapter slaagt.

Het overzicht blijft na herladen of opnieuw openen in hetzelfde browserprofiel
beschikbaar, zolang de browser opslag voor die locatie toestaat. Verplaatsen van
het HTML-bestand, een andere browser, privémodus of het wissen van sitegegevens
kan de opslag veranderen of verwijderen. Rollen zijn geen beveiliging. De app
vermeldt expliciet dat anderen in een gedeeld browserprofiel de feedback kunnen
zien. De bestaande leerplatformback-up bevat geen feedback; exporteer deze apart.

**Feedback downloaden** leest opnieuw uit de feedbackadapter en maakt leesbare
JSON met `formaatversie: 1`, `geexporteerdOp` en alle volledige `meldingen`.
De naam is `feedback-JJJJ-MM-DD.json`. Downloaden wist niets en verstuurt niets;
de gebruiker geeft het bestand zelf aan de beheerder. Beschadigde/niet leesbare
opslag wordt gemeld en niet stilzwijgend als een leeg logboek geëxporteerd.

## Controles en open punten

Zie `feedback-controle.md` voor uitgevoerd bewijs en grenzen. De wijziging is
voor onafhankelijke review; niet gemerged of gehost. De oude bijlage op de
ChatGPT Page is niet vervangen en geen Sites-project is gewijzigd.
