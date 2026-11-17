# Leerplatform — Sites-pilot in voorbereiding

Status 28 oktober 2026: broncode voorbereid, niet gepubliceerd. Dit is geen werkende Sites-oplevering. De complete officiële Vinext-starter, Sites-auth-helper en lokale Sites-build/publicatiehelpers ontbreken in deze uitvoeromgeving. Er is nog geen gehoste database aangemaakt en geen echte OpenAI-aanvraag uitgevoerd.

De bestaande private Site is geregistreerd in `.openai/hosting.json`. Hergebruik dat project; maak geen tweede Site. De laatst gecontroleerde toegang is uitsluitend de eigenaar. Testers kunnen later worden toegevoegd zonder wijzigingen aan de lesstructuur. Er zijn nog geen uitnodigingen verstuurd.

## Voorbereid

- Persoonlijke lesbomen, voortgang en concepten via serveropslag; gebruikersidentiteit uitsluitend vanuit de officiële Sites-serverauthenticatie.
- Optimistische documentversies: een oud tabblad kan nieuwere wijzigingen niet stilzwijgend overschrijven. Opslagfouten vallen niet terug op lokale browseropslag.
- TXT/Markdown of geplakte lesstof, leerdoel en handmatig samenstellen. Voorbereide AI-route maakt maximaal zes lesvoorstellen met oefenvragen en letterlijk broncitaat; gebruiker moet deze nakijken.
- OpenAI Responses API vanaf de server, zonder sleutel in frontend. Standaard uit. Activatie vereist expliciet `AI_ENABLED=true`, een model en een veilig ingestelde sleutel.
- Maximaal 10 aanvragen per persoon per dag en 50 voor de pilot, met begrensde uitvoer en bescherming tegen dubbele aanvragen met dezelfde code. Limieten zijn geen eurobudget. Afgewezen/mislukte pogingen kunnen meetellen; verbruiksoverzicht is geen factuur.
- Privélessen blijven per gebruiker afgeschermd; gedeelde lesprogramma's en beheerdersrollen zijn nog niet geïmplementeerd.

## Controleerbaar

Met Node 24:

```sh
node build/test-server.mjs
node build/test-runtime.mjs
node build/frontend.cjs
```

De servertests gebruiken echte lokale SQLite en gesimuleerde providerantwoorden. Zij controleren gebruikersscheiding, conflictsituaties, bronvalidatie, limieten en foutafhandeling. De runtimetests controleren laden, schrijfvolgorde en blokkeren na een conflict. De frontendbuild compileert de JSX. Dit vervangt geen volledige Vinext-build, Sites-inlogtest, D1-migratietest of browseracceptatietest van de gepubliceerde app.

`source/Leerplatform.html` en `server/generated-ui.mjs` zijn gegenereerde uitvoer, geen zelfstandige offline app. Bewerk `source/src` en bouw opnieuw. Het meegekopieerde `source/build/test.cjs` hoort bij het eerdere lokale prototype; de bovenstaande tests richten zich op deze serverport.

## Vervolg zodra de Sites-omgeving compleet is

1. Lees de actuele Sites-skill en materialiseer de officiële serverstarter met de Sites-helper. Behoud dit project-ID en de owner-only toegang.
2. Integreer de voorbereide routes met de officiële `app/chatgpt-auth.ts`, `sites()`-integratie en vereiste starterconfiguratie. Er is bewust geen namaak-login toegevoegd.
3. Zet `db/schema.sql` om naar de officiële Drizzle-schema/migratieroute en configureer de D1-binding via het ondersteunde Sites-proces. Het SQL-bestand is een kandidaat-schema, geen toegepaste productie-migratie.
4. Bouw en test de volledige app, inclusief twee echte gebruikers, aanmaak/heropenen van lessen en voortgang, export, concepten en conflicten. Controleer ontwerp en toegankelijkheid in de browser.
5. Bewaar/push de exacte bronversie via de officiële workflow, publiceer privé en controleer de deployment. Pas daarna een werkende link opleveren.
6. Voeg door de eigenaar gekozen testers toe. AI blijft uit totdat API-project, kostenkeuze en servergeheimen zijn ingericht. De OpenAI Developers-plugin aansluiten is op zichzelf geen modelaanvraag; echte API-aanvragen hebben afzonderlijke kosten. Gratis Sites-hosting/databasegebruik is hier niet bevestigd.

Het ontbreken van de Sites-bouwomgeving is de actuele publicatieblokkade. De eerdere formele huisstijlcontrole is voor dit prototype door de gebruiker vrijgesteld en vormt geen extra toestemmingseis.
