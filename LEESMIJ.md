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
