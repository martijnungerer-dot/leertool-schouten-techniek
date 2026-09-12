# Leerplatform techniek — 12 september 2026

## Welke versie?

Gebruik **Leerplatform_techniek.html**. De oudere bestanden met `demo` of `2026-09-11` in de naam zijn niet aangepast. Er is niets op GitHub gepubliceerd of samengevoegd.

## Inhoud uit jouw ontwerpen

De startinhoud bevat twaalf technische lesbomen: Elektra, Hydrauliek, Veiligheid op de werkvloer, Basis meten, Pneumatiek, Besturingstechniek, Mechanisch onderhoud, Verbindingstechniek, Technisch tekeninglezen, Materiaalkennis, Kwaliteit en registratie, Energie en duurzaamheid.

Elektra heeft twaalf onderwerpen en 24 lesopzetten uit het ontwerp. Dit zijn beschrijvingen en geplande inhoud, geen uitgewerkte lessen. Ze zijn als lesopzet gemarkeerd; bekijken levert geen afgeronde voortgang op. Twee Elektra-onderwerpen hebben nog geen lesopzet. De overige elf lesbomen hebben alleen een naam en omschrijving omdat de aangeleverde schermen daarvoor geen lesinhoud bevatten. Er is geen cursusinhoud of voorbeeldvoortgang verzonnen.

De oude startinhoud Eten, Bewegen en Slaap is verwijderd uit deze versie. Aparte opslagnamen voorkomen dat de oude demo-inhoud vanzelf terugkomt. Oude bestanden en oude browsergegevens blijven behouden.

## Opgeschoond en aangepast

- Oude AI-generatieonderdelen, demo-antwoorden, ongebruikte schermen en dubbele helpers uit de actieve broncode verwijderd.
- AI uitgeschakeld: geen Anthropic-koppeling, API-sleutel of verzending naar een AI-dienst.
- Compiler alleen nog als bouwgereedschap; het zelfstandige HTML-bestand is ongeveer 1,3 MB in plaats van circa 4,5 MB.
- Lokale rolkeuze zonder schijnlogin of niet-werkende wachtwoordvelden.
- Handmatig een lesboom/onderwerp met leestekst en een meerkeuzevraag toevoegen.
- Vragen kunnen niet worden overgeslagen om een les af te ronden. Lesafronding wordt meteen verwerkt.
- Zoeknavigatie en de bereikbaarheid van instellingen en herhalen vanuit beheer aangepast.
- Opslagfouten worden niet meer als geslaagd opslaan gemeld. Back-up export/import toegevoegd.
- Contrast, minder beweging en herinneringen in de app zijn lokale instellingen.

## Gecontroleerd

Acht geautomatiseerde controles slagen: technische startinhoud, aantal en conceptstatus van lesopzetten, toegankelijkheid van opzetten, herhaalintervallen, lege herhaalwachtrij, vraagvalidatie, herkenning van opslagfouten en ontbreken van de oude AI-koppeling/Babel-runtime in het eindbestand.

In de browser gecontroleerd: twaalf technische kaarten, Elektra openen, een lesopzet doorlopen, instellingen vanuit beheer openen en met Escape sluiten, herhalen openen, handmatig een testles toevoegen, bewaren na opnieuw laden, fout antwoord en herkansing, blokkeren van afronden zonder goed antwoord, afronden en behoud van 100% voortgang na herladen. Er verschenen daarbij geen JavaScript-fouten in de testtab. De testles is op een aparte lokale oorsprong opgeslagen en staat niet in het geleverde HTML-bestand of jouw preview.

Dit is een gerichte functionele controle, geen volledige test van alle mogelijke schermgroottes, browservarianten, importbestanden of combinaties van oude lesblokken.


## Verbeterronde na de opschoning

Doorgevoerd op basis van de afvinklijst:

1. **Kopregel** blijft één regel tot 620 pixels breed. Onder 1000 pixels vallen de
   bijschriften van Zoeken en Instellingen weg, onder 700 pixels neemt het beeldmerk
   de plaats van het volledige logo in. Bij 766 × 698 staan terugknop, logo en
   navigatie dus naast elkaar, aan de leerkant én bij de lesvoorbereiding. De losse
   '‹ Terug' die in de beheerkant nergens heen ging, is weg. (punten 1, 2, 9)
3. **Legenda** staat naast de lesboomnaam en blijft altijd beschikbaar; hij verdween
   eerder na drie keer openen van een onderwerp. (punt 3)
4. **De honingraat** leest weer als één raat: aansluitende tegels met een crème naad,
   warm zand voor onderwerpen die nog moeten komen, korte bruggen in plaats van
   doorlopende lijnen die onder doorzichtige tegels uit staken, en een zachte gloed
   met een ademende tegel op de aanbevolen stap. Een onderwerp waar je mee bezig bent
   toont een balkje met je werkelijke voortgang. Er is geen voortgang verzonnen om
   kleur te krijgen. (punt 4)
5. **Het sluitkruis** staat op elke kaart en elk paneel vast rechtsboven. (punt 5)
6. **'Spanning, stroom en weerstand' is een echte les**: vijf leesblokken met
   inhoudelijke koppen, praktijkvoorbeelden, een 'Onthoud dit'-regel per blok,
   begrippen en vier vragen met antwoordfeedback. De les blijft binnen wat je
   spanningsloos doet en verwijst voor werken onder spanning naar Veilig werken.
   **Laat de vakinhoud nakijken door een NEN 3140-vakbekwaam persoon voordat je
   hem echt gebruikt.** De andere 23 lessen blijven lesopzet. (punt 6)
7. **AI-hulp bij geselecteerde tekst**: selecteer een zin in een les en er verschijnt
   een pil 'Vraag het de AI'. Het paneel toont de geselecteerde tekst als context en
   zegt erbij dat de koppeling niet aanstaat: er gaat niets naar een AI-dienst en er
   worden geen antwoorden verzonnen. Een antwoord zal de lestekst nooit wijzigen.
   Voor een werkende koppeling zijn een keuze van provider en afspraken over kosten
   nodig; die staan nog open. (punt 7)
8. **Herhalen** toont zonder wachtrij de Leitner-dozen met echte aantallen en een
   knop 'Nu alvast oefenen'. Oefenen schrijft niets in het herhaalschema. (punt 8)
10. **'Contentbeheer' heet overal 'Lesvoorbereiding'**, inclusief navigatie, titels,
    het aanmeldscherm en de toegankelijke labels. (punt 10)
11. **Rollen**: de keuze bij het aanmelden bepaalt echt wat bereikbaar is. Een lerende
    ziet de knop niet en komt er ook niet langs de knop om, met de tekst 'Neem contact
    op met de beheerder'. Aanmeldscherm en Instellingen zeggen erbij dat dit een
    rollendemo is en geen beveiliging. (punt 11)
12. **Les toevoegen** aan een bestaand onderwerp in vier stappen: plaats, lesinhoud,
    vraag, nakijken. Bestaande lessen, volgorde en voortgang blijven staan. Was het
    onderwerp al compleet, dan waarschuwt de laatste stap dat het weer op 'bezig'
    komt te staan. (punt 12)

Verder opgelost: lange lesboomnamen werden afgekapt door de statuspil, de
miniatuurraat op een kaartje was een grijs vlekje, lege lesbomen staan nu apart
onder 'Nog niet gevuld', de lesvoorbereiding sorteert met hetzelfde pilmenu als de
leerkant, toetsenbordfocus op een tegel is oranje in plaats van een zwarte
rechthoek, en '2 blok(ken) · 0 vra(a)g(en)' is gewoon Nederlands geworden.

### Gecontroleerd in deze ronde

Elf geautomatiseerde controles slagen (twee nieuwe: de samenstelling van de
uitgewerkte les, en koppen, onthoudregels en geldige vragen daarin). In een echte
browser gecontroleerd op 1180 × 720, 766 × 698 en 420 × 760: geen horizontale
overloop, kopregel op één regel tot 620 pixels, legenda openen en met Escape sluiten,
sluitkruis rechtsboven, Escape terug naar het overzicht, en geen fouten in de console.
De nieuwe les is volledig doorlopen met een fout en een goed antwoord, afgerond, en na
herladen stond de voortgang er nog (1 van 3 lessen, 33%) met vier vragen in de doos
'1 dag'. Een les toevoegen aan Basiselektra is gedaan en gecontroleerd: het onderwerp
ging van drie naar vier lessen zonder verlies van bestaande inhoud.

Nog niet getest: alle browservarianten, alle schermmaten, en het terugzetten van
oude of beschadigde back-upbestanden.

### Wat open blijft

- Een werkende AI-koppeling (keuze van provider, kosten, welke tekst verstuurd wordt).
- Echte accounts en server-side autorisatie; de rollendemo vervangt dat niet.
- De 23 overgebleven lesopzetten zijn nog geen uitgewerkte lessen.

## Grenzen van deze lokale versie

- Gegevens staan in deze browser, niet in het HTML-bestand en niet automatisch op GitHub. Maak via Instellingen regelmatig een back-up. Verplaatsen van het bestand of wisselen van browser kan andere browseropslag gebruiken.
- Er zijn geen echte accounts, beveiligde beheerdersrollen of gedeelde voortgang tussen apparaten.
- AI-generatie blijft uit. Brontekst kan handmatig worden toegevoegd; PDF-inlezen en automatisch ophalen van webpagina's zijn niet aangesloten.
- Lesopzetten worden niet automatisch volwaardige lessen als je de tekst bewerkt. Gebruik de handmatige invoer voor publicatie van nieuwe, zelf gecontroleerde lessen.
- Back-upterugzetten heeft basisvalidatie, maar is niet met alle mogelijke beschadigde of oude bestanden getest. Bewaar altijd een export voordat je inhoud vervangt.

## Broncode

`Leerplatform_broncode.zip` bevat de gebruikte broncode, de technische startinhoud, de benodigde meegeleverde bibliotheken en de bouw- en testprogramma's. Met Node.js:

```text
node build/build.cjs
node build/test.cjs
```

Het bouwen maakt `Leerplatform.html`. Er is geen npm-installatie nodig. De zip bevat niet de oude demobestanden en verouderde bouwschillen.
