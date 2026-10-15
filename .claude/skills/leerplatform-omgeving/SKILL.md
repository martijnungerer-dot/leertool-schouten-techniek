---
name: leerplatform-omgeving
description: Werkomgeving van het Leerplatform Schouten Techniek in de cloud: checkout, bouwen en testen, browsercontroles met een tijdelijke server, en wat er niet nodig is. Gebruik bij het opzetten van de omgeving, vóór het draaien van build en tests, of bij een browsercontrole van Leerplatform.html.
---

# Leerplatform Schouten Techniek

Werk in de bestaande checkout; elke cloudtaak heeft al een eigen omgeving. Alle
commando's hieronder draai je vanuit de hoofdmap van de checkout. Bewaar
bestaande lokale wijzigingen.

## Wat nodig is

Alleen Node.js. CI gebruikt Node 22. Er is geen npm-installatie, backend,
database, omgevingsvariabele of sleutel nodig: React, Tailwind en de compiler
staan in `build/vendor/`. Voeg geen sleutels toe.

## Bouwen en testen

```bash
node --version
node build/build.cjs && node build/test.cjs
```

De build moet slagen en alle controles moeten groen zijn. Was
`Leerplatform.html` vóór de build schoon en heb je `src/` niet aangeraakt, dan
moet `git diff --exit-code -- Leerplatform.html` daarna ook slagen. Onderzoek
een afwijking voordat je bijgehouden bestanden wijzigt.

## Browsercontrole

Het eindproduct is één zelfstandig bestand; er is geen blijvende server nodig.
Chromium blokkeert `file://` in de cloud. Start daarom voor een controle een
tijdelijke HTTP-server op loopback:

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory . &
```

Open `http://127.0.0.1:8765/Leerplatform.html` met Playwright (zie de skill
`webapp-testing`). Controleer minstens: de pagina laadt (status 200), de knoppen
"Naar mijn lesbomen" en "Naar lesvoorbereiding" werken, en er zijn geen
JavaScript-fouten in de console.

Testdata die je nodig hebt (een lesboom, vragen, herhaalgeschiedenis) zet je
alleen in de browseropslag van die tijdelijke browser, nooit in `src/`. Stop
daarna de server en de browser die je zelf hebt gestart. Geef de gebruiker geen
localhost-link: die werkt alleen in jouw omgeving.
