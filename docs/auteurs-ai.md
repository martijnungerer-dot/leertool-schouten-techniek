# Auteurs-AI: open configuratie voor de pilot

Gecontroleerd op 4 november 2026 tegen main `45ebf8a` en de afzonderlijke
serveroverdracht in PR 57 (`03564255`). De huidige hoofdapp heeft geen backend.
De statische Sites-pilot bewaart inhoud en voortgang per browser.

## Benodigde besluiten vóór activering

- Martijn kiest provider en model voor het product. De OpenAI-code in PR 57 is
  voorbereidende code, geen vastgelegde keuze of actieve koppeling.
- Martijn en beheer kiezen de servervoorziening voor de huidige statische app:
  hosting, endpoint, toegangscontrole en toegestane oorsprong. Een CORS-header
  alleen is geen authenticatie. Geen accounts of gedeelde voortgang toevoegen
  alleen om auteurs-AI mogelijk te maken.
- Leg het budget in euro's vast, stel het leveranciersplafond in en bepaal wie
  verbruik en overschrijdingen volgt. De oude pilotlimieten (10 aanvragen per
  persoon en 50 totaal per dag) zijn geen europlafond.
- Leg onder issue 5 vast welke auteursbronnen, titels, leerdoelen en passages
  naar de provider mogen, met bewaartermijn, logbeleid en verwerkersovereenkomst.
  De bestaande toestemming voor geselecteerde leerlingtekst dekt dit niet.
- Configureer de sleutel uitsluitend in servergeheimen. Als OpenAI wordt
  gekozen zijn in de oude port `OPENAI_API_KEY`, `OPENAI_MODEL` en
  `AI_ENABLED=true` voorzien. Dit zijn geen instellingen voor het HTML-bestand.

## Wat uit PR 57 bruikbaar is

Servervalidatie, begrensde uitvoer, aanvraagcodes tegen dubbele verwerking,
annulering/time-out, tokenregistratie en controle op letterlijk broncitaat.
De port mist nog de officiële Sites-starter/auth-integratie en toegepaste
D1-migraties. Zijn persoonlijke serveropslag hoort niet bij deze opdracht.
Het bestaande schema vraagt één vraag per les en ondersteunt de nieuwe
bronvoorstellen en 1–3-vragenafspraak nog niet. Niet rechtstreeks activeren.

## Expliciet open

- Issue 59: rangschikken van werkelijk beschikbare leesbare bibliotheekbronnen,
  met reden en menselijke selectie. Geen netwerkzoekfunctie of verzonnen bronnen.
- Issue 60: voorstel van titel en lesblokken met bron/passagereferenties,
  ontoereikende-bronmelding en expliciet overnemen vóór vervanging/publicatie.
- AI-deel van issue 61: 1–3 vragen met brononderbouwing, beginnersniveau/richting
  en Te makkelijk / Te moeilijk / Zelf schrijven per voorstel.

Deze onderdelen worden pas op de overeengekomen servervoorziening aangesloten.
De hoofdapp verstuurt nu niets en levert geen fictieve AI-resultaten. Issue 65
blijft open zolang deze afhankelijkheden of vereiste acceptatiecontroles openstaan.
