import React, { useState, useEffect, useRef } from "react";

// ============================================================================
// HET DATAMODEL
//
//   DOMEIN   (Eten, Bewegen, Slaap, BHV…)  — data, geen code. Zelf aan te maken.
//     └ TOPIC   (Eiwit en spierbehoud)      — hoort bij één domein, heeft een tier in de boom
//         └ ORB   (Hoeveel heb je nodig)    — één les
//             ├ BLOKKEN  tekst | vergelijking | tijdlijn | afbeelding
//             ├ VRAGEN   meerkeuze | sorteren | matchen
//             └ HAAKJE   de zin die naar het volgende trekt
//
// De app-logica kent geen enkel onderwerp. Voeg BHV toe en alles werkt hetzelfde.
// ============================================================================

const START_DOMEINEN = [
  { id: "eten", naam: "Eten", omschrijving: "Voeding en vitaliteit", kleur: "#F6A923" },
  { id: "bewegen", naam: "Bewegen", omschrijving: "Kracht, uithouding, herstel", kleur: "#4A9D8F" },
  { id: "slaap", naam: "Slaap", omschrijving: "Herstel en waakzaamheid", kleur: "#6B7FD7" },
];

// Taalniveau is geen keuze per onderwerp maar een grondwet voor de hele app:
// alles moet werkbaar zijn op B2. Diepere stof mag moeilijkere begrippen
// bevatten, maar de taal eromheen blijft altijd even helder.
const TAALNIVEAU = "B2";

// Tiers bepalen de structuur van de boom en hoeveel voorkennis je mag aannemen.
// Niet de taal — die is overal gelijk (zie TAALNIVEAU).
const TIERS = [
  { tier: 1, naam: "Stam", doel: "Familiariseren met het onderwerp", nieuweVakwoorden: 2 },
  { tier: 2, naam: "Tak", doel: "Voortbouwen op de basis", nieuweVakwoorden: 3 },
  { tier: 3, naam: "Takje", doel: "Verdiepen voor wie verder wil", nieuweVakwoorden: 4 },
];

function tierInfo(tier) {
  return TIERS.find((t) => t.tier === tier) || TIERS[0];
}

// Het plafond van het platform. Hierboven zeggen we eerlijk: dit is niet
// waar deze app voor is. Dat is geen tekortkoming maar een keuze.
const SCOPE = `Dit platform gaat over kennis die je gedrag verandert. De vuistregel:
zodra extra diepgang niets meer verandert aan wat iemand doet of gelooft, valt het
BUITEN de scope.

Voorbeeld met eiwit:
- Hoeveel eiwit je nodig hebt -> binnen scope (verandert je boodschappenlijst)
- Waarom spreiding over de dag werkt -> binnen scope (verandert je dagindeling)
- De mTOR-signaalcascade en leucine-drempelwaarden -> BUITEN scope (fascinerend, maar
  je doet er niets anders door)

Buiten scope is geen diskwalificatie van de lezer. Het is een grens van de app.`;

const START_TOPICS = [
  {
    id: "macros",
    domeinId: "eten",
    prerequisites: [],
    gridPos: { tier: 1, track: 1 },
    titel: "Macronutriënten zonder mythes",
    ondertitel: "Wat koolhydraten, eiwit en vet écht doen",
    orbs: [
      {
        id: "macros-1",
        titel: "De drie bouwstenen",
        blokken: [
          {
            type: "tekst",
            tekst: "Alles wat je eet levert energie via drie macronutriënten: koolhydraten, eiwit en vet. Ze zijn geen kampen die tegen elkaar strijden — ze doen elk iets anders.",
          },
          {
            type: "tekst",
            tekst: "Koolhydraten zijn je snelste brandstof, vooral bij zwaar werk. Eiwit is bouwmateriaal: spieren, enzymen, afweer. Vet is trage energie én onmisbaar voor hormonen en de opname van vitamine A, D, E en K.",
          },
          {
            type: "vergelijking",
            titel: "Energie per gram",
            eenheid: "kcal",
            items: [
              { label: "Vet", waarde: 9 },
              { label: "Koolhydraten", waarde: 4 },
              { label: "Eiwit", waarde: 4 },
              { label: "Vezels", waarde: 2 },
            ],
            toelichting:
              "Vet levert ruim twee keer zoveel energie per gram. Dat maakt het niet 'slecht' — het maakt het compact.",
          },
          {
            type: "tekst",
            tekst: "Een tekort aan één ervan los je niet op met méér van een ander. Ze zijn niet uitwisselbaar.",
          },
        ],
        haakje:
          "Maar als ze alle drie nodig zijn — waarom raadt vrijwel elk dieet er dan één af?",
        begrippen: [
          {
            term: "macronutriënt",
            uitleg: "een voedingsstof die je in grote hoeveelheden nodig hebt en die energie levert: eiwit, vet of koolhydraten",
          },
        ],
        vragen: [
          {
            id: "macros-1-v1",
            type: "meerkeuze",
            vraag: "Wat is de belangrijkste functie van eiwit?",
            opties: [
              "Snelle energie leveren tijdens inspanning",
              "Bouwmateriaal voor onder andere spieren en afweer",
              "De opname van vitamine A, D, E en K mogelijk maken",
              "Energie opslaan voor later",
            ],
            juisteIndex: 1,
            uitleg:
              "Eiwit is vooral bouwmateriaal. Energie leveren kan het ook, maar daar gebruikt je lichaam het niet primair voor.",
          },
          {
            id: "macros-1-v2",
            type: "sorteren",
            vraag: "Zet op volgorde: meeste energie per gram bovenaan.",
            items: ["Vet", "Koolhydraten", "Vezels"],
            juisteVolgorde: [0, 1, 2],
            uitleg:
              "Vet levert 9 kcal per gram, koolhydraten 4, vezels ongeveer 2. Eiwit zit gelijk met koolhydraten.",
          },
        ],
      },
      {
        id: "macros-2",
        titel: "Waarom 'goed' en 'fout' voedsel niet bestaat",
        blokken: [
          {
            type: "tekst",
            tekst: "De meeste voedingshypes draaien op één trucje: ze wijzen één stof aan als schuldige. Suiker. Vet. Gluten. Koolhydraten.",
          },
          {
            type: "mythe",
            mythe: "Vet maakt dik. Kies light-producten, dan val je af.",
            klopt: "Light-producten kregen vaak suiker in plaats van vet. Mensen werden er niet slanker van. Vet in je eten wordt niet één-op-één vet op je lichaam.",
          },
          {
            type: "tekst",
            tekst: "Bijna geen enkel voedingsmiddel is puur goed of puur fout. Wat telt is hoevéél, hoe váák, en waar het de rest van je voeding voor verdringt. Een appelflap na een dag dakwerk is iets anders dan drie per dag achter een bureau.",
          },
          {
            type: "tekst",
            tekst: "Zodra je stopt met voedsel in kampen indelen, wordt de vraag bruikbaarder: wat levert dit me, en wat schuift het opzij?",
          },
        ],
        haakje:
          "Toch werken die diëten vaak wél — even. Waar zit dat effect dan in, als het niet aan de verboden stof ligt?",
        vragen: [
          {
            id: "macros-2-v1",
            type: "meerkeuze",
            vraag: "Wat is het gemeenschappelijke trucje achter de meeste voedingshypes?",
            opties: [
              "Ze schrijven precies voor hoeveel je moet eten",
              "Ze wijzen één stof aan als de schuldige",
              "Ze zijn gebaseerd op langlopend onderzoek",
              "Ze richten zich op het totale voedingspatroon",
            ],
            juisteIndex: 1,
            uitleg:
              "Eén schuldige aanwijzen is simpel en overtuigend — maar het klopt zelden met hoe voeding werkt.",
          },
        ],
      },
    ],
  },
  {
    id: "eiwit",
    domeinId: "eten",
    prerequisites: ["macros"],
    gridPos: { tier: 2, track: 2 },
    titel: "Eiwit en spierbehoud",
    ondertitel: "Hoeveel, wanneer, en waarom het met de jaren méér wordt",
    orbs: [
      {
        id: "eiwit-1",
        titel: "Hoeveel heb je echt nodig",
        blokken: [
          {
            type: "tekst",
            tekst: "De officiële ondergrens is ongeveer 0,8 gram eiwit per kilo lichaamsgewicht per dag. Dat getal is bedoeld om een tekort te voorkomen — niet om je optimaal te laten functioneren.",
          },
          {
            type: "vergelijking",
            titel: "Eiwit per dag voor iemand van 80 kilo",
            eenheid: "gram",
            items: [
              { label: "Officiële ondergrens", waarde: 64 },
              { label: "Kantoorwerk", waarde: 96 },
              { label: "Fysiek werk", waarde: 128 },
              { label: "Zwaar trainend", waarde: 160 },
            ],
            toelichting:
              "Het verschil tussen 'geen tekort' en 'goed onderhouden' is bijna een verdubbeling. Dat haal je niet per ongeluk.",
          },
          {
            type: "tekst",
            tekst: "Bewijskracht: sterk. Dit is een van de best onderzochte gebieden in de sportvoeding, met consistente uitkomsten over veel studies heen.",
          },
        ],
        haakje:
          "Meer dan de ondergrens dus. Maar maakt het uit wanneer op de dag je het binnenkrijgt?",
        begrippen: [
          {
            term: "gram per kilo lichaamsgewicht",
            uitleg: "de manier waarop eiwitbehoefte wordt uitgedrukt: weeg jezelf, vermenigvuldig met het getal, en je hebt je dagdoel in grammen",
          },
        ],        vragen: [
          {
            id: "eiwit-1-v1",
            type: "meerkeuze",
            vraag: "Waar is de officiële norm van 0,8 g/kg op gericht?",
            opties: [
              "Optimale spieropbouw",
              "Het voorkomen van een tekort",
              "Maximaal herstel na inspanning",
              "Gewichtsverlies",
            ],
            juisteIndex: 1,
            uitleg: "Een ondergrens is geen streefwaarde. Het is het punt waaronder het misgaat.",
          },
          {
            id: "eiwit-1-v2",
            type: "matchen",
            vraag: "Koppel elke situatie aan de bijbehorende eiwitbehoefte.",
            paren: [
              { links: "Officiële ondergrens", rechts: "0,8 g/kg" },
              { links: "Kantoorwerk", rechts: "1,2 g/kg" },
              { links: "Fysiek werk", rechts: "1,6 g/kg" },
              { links: "Zwaar trainend", rechts: "2,0 g/kg" },
            ],
            uitleg:
              "De behoefte schaalt met wat je van je spieren vraagt — niet met hoe graag je wilt afvallen.",
          },
        ],
      },
      {
        id: "eiwit-2",
        titel: "Ouder worden: de behoefte gaat omhóóg",
        blokken: [
          {
            type: "tekst",
            tekst: "Contra-intuïtief maar goed onderbouwd: naarmate je ouder wordt heb je méér eiwit nodig, niet minder.",
          },
          {
            type: "tijdlijn",
            titel: "Wat er met je spieren gebeurt",
            punten: [
              { label: "Tot ~30", beschrijving: "Spiermassa bouwt op of blijft gelijk." },
              { label: "30–50", beschrijving: "Langzaam verlies begint, meestal onopgemerkt." },
              { label: "Vanaf ~50", beschrijving: "Spieren reageren zwakker op dezelfde hoeveelheid eiwit." },
              { label: "70+", beschrijving: "Spiermassa bepaalt zelfredzaamheid en valrisico." },
            ],
          },
          {
            type: "tekst",
            tekst: "Op het moment dat je spieren méér prikkel nodig hebben, gaan mensen juist minder eten. Die twee samen verklaren een groot deel van wat we voor 'gewoon ouder worden' aanzien.",
          },
        ],
        haakje:
          "Spierverlies is dus deels een voedingskwestie, geen onvermijdelijkheid. Wat betekent dat voor wat je vandaag op je bord legt?",
        begrippen: [
          {
            term: "sarcopenie",
            uitleg: "het verlies van spiermassa en spierkracht dat met de jaren optreedt — deels onvermijdelijk, deels te beïnvloeden",
          },
        ],
        vragen: [
          {
            id: "eiwit-2-v1",
            type: "meerkeuze",
            vraag: "Wat gebeurt er met de eiwitbehoefte naarmate je ouder wordt?",
            opties: [
              "Die gaat omlaag, omdat je minder actief bent",
              "Die blijft gelijk",
              "Die gaat omhoog, omdat spieren minder sterk op eiwit reageren",
              "Die is niet meer relevant na je vijftigste",
            ],
            juisteIndex: 2,
            uitleg:
              "Er is méér eiwit nodig voor hetzelfde effect — terwijl mensen juist minder gaan eten.",
          },
        ],
      },
    ],
  },
  {
    // Tak A: volgt op de stam, naast eiwit. Nog geen lesstof — demonstreert
    // dat een vertakking al in de structuur kan bestaan voor hij gevuld is.
    id: "micros",
    domeinId: "eten",
    prerequisites: ["macros"],
    gridPos: { tier: 2, track: 1 },
    titel: "De vier die vaak tekortschieten",
    ondertitel: "Vitamine D, B12, magnesium en omega-3",
    orbs: [],
  },
  {
    // Lineair vervolg op tak B (eiwit): tier 3, zelfde track.
    id: "energie",
    domeinId: "eten",
    prerequisites: ["eiwit"],
    gridPos: { tier: 3, track: 2 },
    titel: "Energie door de dag",
    ondertitel: "Waarom die dip om drie uur geen karakterzwakte is",
    orbs: [],
  },
];

// ============================================================================
// OPSLAG
// ============================================================================

const SLEUTEL = "leerplatform-v3";
const VOORTGANG_SLEUTEL = "leerplatform-voortgang-v1";

// ============================================================================
// HET LEITNER-SYSTEEM
//
// Elke vraag zit in een doos. Goed antwoord = een doos verder, dus je ziet hem
// pas veel later terug. Fout = terug naar doos 1, en hij blijft rondzingen tot
// hij blijft hangen. Zo richt het systeem zichzelf op wat je nog niet weet.
//
// De termijnen zijn een gangbare keuze, geen wet. Het patroon van steeds groter
// wordende tussenpozen is wat telt (spacing effect — bewijskracht: sterk).
// ============================================================================

const DOZEN = [
  { doos: 1, dagen: 1, naam: "1 dag" },
  { doos: 2, dagen: 3, naam: "3 dagen" },
  { doos: 3, dagen: 7, naam: "1 week" },
  { doos: 4, dagen: 21, naam: "3 weken" },
  { doos: 5, dagen: 60, naam: "2 maanden" },
];

const DAG = 24 * 60 * 60 * 1000;

function termijn(doos) {
  const d = DOZEN.find((x) => x.doos === doos) || DOZEN[0];
  return d.dagen * DAG;
}

// Verwerkt één antwoord. Goed schuift op, fout valt terug naar doos 1.
function verwerkAntwoord(kennis, vraagId, juist, nu) {
  const huidig = kennis[vraagId] || { doos: 0 };
  const nieuweDoos = juist ? Math.min(huidig.doos + 1, 5) : 1;

  return {
    ...kennis,
    [vraagId]: {
      doos: nieuweDoos,
      volgende: nu + termijn(nieuweDoos),
      // hoe vaak fout gehad — handig om te zien waar iemand blijft struikelen
      fouten: (huidig.fouten || 0) + (juist ? 0 : 1),
    },
  };
}

// Welke vragen zijn vandaag aan de beurt? Dwars door alle onderwerpen heen.
function vragenDieAanDeBeurtZijn(topics, kennis, nu) {
  const due = [];

  topics.forEach((topic) => {
    topic.orbs.forEach((orb) => {
      (orb.vragen || []).forEach((vraag) => {
        const staat = kennis[vraag.id];
        // nooit gezien = niet aan de beurt; die leer je via de gewone les
        if (!staat) return;
        if (staat.volgende <= nu) {
          due.push({ vraag, topic, orb, doos: staat.doos });
        }
      });
    });
  });

  // laagste doos eerst: waar je het zwakst staat, oefen je eerst
  return due.sort((a, b) => a.doos - b.doos);
}

// Hoe stevig zit een orb erin? Gemiddelde doos van zijn vragen, 0 tot 5.
// Dit is wat de orb laat oplichten: de geheugensterkte, zichtbaar gemaakt.
function geheugensterkte(orb, kennis) {
  const vragen = orb.vragen || [];
  if (vragen.length === 0) return 0;

  const som = vragen.reduce((s, v) => {
    const staat = kennis[v.id];
    return s + (staat ? staat.doos : 0);
  }, 0);

  return som / vragen.length; // 0 = nooit gedaan, 5 = zit er stevig in
}

async function laadVoortgang() {
  try {
    const r = await window.storage.get(VOORTGANG_SLEUTEL);
    return r ? JSON.parse(r.value) : null;
  } catch {
    return null;
  }
}

async function bewaarVoortgang(data) {
  try {
    await window.storage.set(VOORTGANG_SLEUTEL, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// Bronnenset per domein: { domeinId: [{id, naam, tekst}] }
const START_BRONNEN = {};

async function laden() {
  try {
    const r = await window.storage.get(SLEUTEL);
    return r ? JSON.parse(r.value) : null;
  } catch {
    return null;
  }
}

async function bewaren(data) {
  try {
    await window.storage.set(SLEUTEL, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// DE OMZETTER — ruw materiaal naar orbs
// ============================================================================

// ---------------------------------------------------------------------------
// De gedeelde redactionele lat. Geldt voor beide stappen van de omzetter.
// ---------------------------------------------------------------------------
const LAT = `TOON: Nederlands. Direct, geen omhaal. Sceptisch tegenover hypes.
Nooit stelliger dan het bewijs of de bron toelaat.

DOELGROEP: medewerkers van een technisch bedrijf — monteurs, werkvoorbereiders,
leidinggevenden. Praktisch ingesteld, geen achtergrond in het onderwerp, prikken
snel door marketingpraat heen.

Antwoord UITSLUITEND met geldige JSON. Geen inleiding, geen markdown-backticks.`;

// ---------------------------------------------------------------------------
// STAP 1 — tekst en beeld
// ---------------------------------------------------------------------------
const REDACTIE_BLOKKEN = `Je bent redacteur van een microlearning-app. Je zet ruw bronmateriaal
om in de LEESSTOF van één leerblok ("orb"). De vragen komen later; die maak je NU NIET.

${LAT}

EEN ORB BESTAAT UIT BLOKKEN. Beschikbare bloktypes:

- {"type":"tekst","tekst":"..."} — één alinea, maximaal 55 woorden.

- {"type":"vergelijking","titel":"...","eenheid":"gram","items":[{"label":"...","waarde":12}],"toelichting":"..."}
  Voor getallen die je naast elkaar legt. 2 tot 4 items.

- {"type":"verhouding","titel":"...","delen":[{"label":"Groente","deel":50}],"toelichting":"..."}
  Voor een verdeling van een geheel. 2 tot 4 delen.

- {"type":"tijdlijn","titel":"...","punten":[{"label":"Vanaf 50","beschrijving":"..."}]}
  Voor een verloop in de tijd of opeenvolgende fasen. 2 tot 4 punten, korte beschrijvingen.

- {"type":"stappen","titel":"...","stappen":[{"label":"Bel 112","beschrijving":"..."}]}
  Voor een handeling in volgorde: werkinstructies, protocollen, een routine.
  2 tot 5 stappen. Staan er meer in de bron? Kies de belangrijkste, som niet alles op.

- {"type":"mythe","mythe":"wat mensen vaak denken","klopt":"wat er werkelijk klopt"}
  Zet een misvatting naast de nuance. Alleen waar de bron echt een misvatting ontkracht.

- {"type":"pictogram","titel":"...","totaal":10,"geraakt":3,"bijschrift":"..."}
  Voor een verhouding die je invoelbaar maakt. Totaal maximaal 20.

REGELS VOOR BEELD:
- Gebruik ALLEEN cijfers die letterlijk in de bron staan. Nooit getallen verzinnen.
- Geen bruikbaar cijfer of proces in de bron? Dan geen beeldblok. Niet forceren.
- Bij gevoelige onderwerpen (ongewenst gedrag, ziekte, ongevallen) geen pictogram of
  mythe-blok. Slachtoffers zijn geen infographic. Kies dan tekst en eventueel stappen.

OPBOUW:
1. Open met de kern. Val met de deur in huis, geen inleidende zin.
2. Maak het herkenbaar en concreet voor deze lezer.
3. Sluit af met nuance, bewijskracht of wat het praktisch betekent.
   Nooit een samenvatting van wat er al stond.

TAAL — DIT IS EEN HARDE GRENS, GEEN RICHTLIJN:
De hele app werkt op taalniveau B2, ongeacht de tier. Diepere stof mag moeilijkere
BEGRIPPEN bevatten, maar de taal eromheen blijft altijd even helder.
- Korte, heldere zinnen. Geen naamwoordstijl ("het uitvoeren van" -> "uitvoeren").
  Geen tangconstructies. Eén gedachte per zin.
- Een ingewikkeld idee mag — maar in gewone taal. Dat is de kunst.
Bij twijfel kies je de simpelere formulering. Simpel is niet hetzelfde als leeg —
een open deur is geen stam, dat is vulling.

VAKWOORDEN — hier valt of staat de leerlijn:
Je krijgt een lijst met begrippen die de lezer AL KENT uit eerdere orbs.
- Die mag je zonder uitleg gebruiken. Sterker nog: bouw erop voort. Ze opnieuw uitleggen is
  verspilling en voelt betuttelend.
- Elk ANDER vakwoord moet je in de tekst zelf uitleggen, in gewone taal, op het moment
  dat je het voor het eerst gebruikt.
- Op BASIS introduceer je hoogstens 2 nieuwe vakwoorden per orb. Meer overvraagt de lezer.
- Je legt elk nieuw vakwoord vast in het veld "begrippen".

SCOPE — je mag een onderwerp weigeren:
${SCOPE}
Valt de stof buiten de scope, zet dan "buitenScope": true en leg in "buitenScopeReden"
in één zin uit waarom. Schrijf dan geen blokken.

OMVANG: precies 3 of 4 blokken, waarvan hoogstens 1 beeldblok.
Het antwoord moet volledig in één keer passen. Kort en scherp wint van volledig.

HAAKJE: één zin die een echte open vraag achterlaat. Geen "lees verder"-taal.

ANTWOORDFORMAAT:
{"titel":"max 6 woorden",
 "blokken":[...],
 "haakje":"...",
 "begrippen":[{"term":"spiereiwitsynthese","uitleg":"het proces waarmee je lichaam spierweefsel aanmaakt"}],
 "buitenScope":false}
"begrippen" bevat alleen NIEUWE vakwoorden die je in deze orb introduceert. Geen begrippen
die de lezer al kende. Lege lijst is prima als je geen vakwoord gebruikt.
De uitleg is één zin in gewone taal — het moet te begrijpen zijn zonder de orb gelezen te hebben.`;

// ---------------------------------------------------------------------------
// STAP 2 — de vragen (aparte aanroep, zodat het antwoord klein blijft)
// ---------------------------------------------------------------------------
const REDACTIE_VRAGEN = `Je bent redacteur van een microlearning-app. Je maakt de VRAGEN
bij een leerblok dat al geschreven is. Je maakt precies 2 vragen.

${LAT}

VRAAGTYPES:
- {"type":"meerkeuze","vraag":"...","opties":["a","b","c","d"],"juisteIndex":0,"uitleg":"..."}
- {"type":"sorteren","vraag":"...","items":["a","b","c"],"juisteVolgorde":[0,1,2],"uitleg":"..."}
  juisteVolgorde verwijst naar de indexen van items in de JUISTE volgorde. 3 items.
- {"type":"matchen","vraag":"...","paren":[{"links":"...","rechts":"..."}],"uitleg":"..."}
  Precies 3 paren. Kort houden.

Varieer als de stof zich ervoor leent: niet twee keer hetzelfde type.

HIER VALT OF STAAT DE KWALITEIT:
- Toets BEGRIP, niet of iemand de tekst heeft gelezen. Een goede vraag kun je fout hebben
  ook al heb je de tekst gelezen, als je hem niet hebt begrepen.
- Foute antwoorden zijn plausibele DENKFOUTEN, geen onzin die niemand kiest.
- De uitleg verklaart waarom het juiste antwoord juist is én waar de denkfout zit.
- Geen vragen naar losse definities of naar wie iets is. Vraag naar de implicatie:
  wat betekent dit voor jou, wat doe je ermee, waar zit het misverstand.
- Bij praktische stof (protocollen, waar moet ik heen, wat doe ik als) mag de vraag
  wél gewoon toetsen of iemand weet wat te doen. Nuance is daar geen deugd.

Houd opties en uitleg kort — één zin per uitleg. Het antwoord moet volledig passen.

ANTWOORDFORMAAT:
{"vragen":[...]}`;

// Controleert of een blok compleet genoeg is om te tonen.
// Halve blokken (bijv. een grafiek zonder cijfers) gooien we weg in plaats van
// de app te laten crashen.
function blokIsHeel(b) {
  if (!b || typeof b !== "object") return false;
  if (b.type === "vergelijking") {
    return (
      Array.isArray(b.items) &&
      b.items.length >= 2 &&
      b.items.every((i) => i && typeof i.waarde === "number" && i.label)
    );
  }
  if (b.type === "verhouding") {
    return (
      Array.isArray(b.delen) &&
      b.delen.length >= 2 &&
      b.delen.every((d) => d && typeof d.deel === "number" && d.deel > 0 && d.label)
    );
  }
  if (b.type === "tijdlijn") {
    return (
      Array.isArray(b.punten) &&
      b.punten.length >= 2 &&
      b.punten.every((p) => p && p.label)
    );
  }
  if (b.type === "stappen") {
    return (
      Array.isArray(b.stappen) &&
      b.stappen.length >= 2 &&
      b.stappen.every((s) => s && s.label)
    );
  }
  if (b.type === "mythe") {
    return typeof b.mythe === "string" && b.mythe.trim() && typeof b.klopt === "string" && b.klopt.trim();
  }
  if (b.type === "pictogram") {
    return (
      Number.isInteger(b.totaal) &&
      b.totaal >= 2 &&
      b.totaal <= 20 &&
      Number.isInteger(b.geraakt) &&
      b.geraakt >= 0 &&
      b.geraakt <= b.totaal
    );
  }
  if (b.type === "afbeelding") return true;
  return typeof b.tekst === "string" && b.tekst.trim().length > 0;
}

function vraagIsHeel(v) {
  if (!v || typeof v !== "object" || !v.vraag) return false;
  if (v.type === "sorteren") {
    return (
      Array.isArray(v.items) &&
      v.items.length >= 2 &&
      Array.isArray(v.juisteVolgorde) &&
      v.juisteVolgorde.length === v.items.length &&
      v.juisteVolgorde.every((i) => Number.isInteger(i) && i >= 0 && i < v.items.length) &&
      new Set(v.juisteVolgorde).size === v.items.length
    );
  }
  if (v.type === "matchen") {
    return (
      Array.isArray(v.paren) &&
      v.paren.length >= 2 &&
      v.paren.every((p) => p && p.links && p.rechts)
    );
  }
  return (
    Array.isArray(v.opties) &&
    v.opties.length >= 2 &&
    Number.isInteger(v.juisteIndex) &&
    v.juisteIndex >= 0 &&
    v.juisteIndex < v.opties.length
  );
}

// Eén structurele controle voor alle goedkeuringsmomenten. Zo kan een orb niet
// eerst groen worden en pas bij publicatie alsnog op een leeg of half blok stuklopen.
function orbStructuurFouten(orb) {
  const fouten = [];
  if (!orb || typeof orb !== "object") return ["De orb ontbreekt."];

  if (!Array.isArray(orb.blokken) || orb.blokken.length === 0) {
    fouten.push("De orb bevat geen leesstof.");
  } else if (!orb.blokken.every(blokIsHeel)) {
    fouten.push("De orb bevat een onvolledig leesblok.");
  }

  if (!Array.isArray(orb.vragen) || orb.vragen.length === 0) {
    fouten.push("De orb bevat geen vragen.");
  } else if (!orb.vragen.every(vraagIsHeel)) {
    fouten.push("De orb bevat een onvolledige vraag.");
  }

  return fouten;
}

// ---------------------------------------------------------------------------
// DE OMZETTER
//
// Twee aanroepen per orb: eerst de leesstof, dan de vragen. Dat is bewust.
// Alles in één antwoord proppen loopt vast op de maximale antwoordlengte —
// het antwoord wordt dan halverwege afgekapt en de JSON klopt niet meer.
// Twee kleine antwoorden passen wél.
//
// Gaat een antwoord tóch over de grens, dan proberen we het één keer opnieuw
// met een strakkere opdracht voordat we de gebruiker lastigvallen.
// ---------------------------------------------------------------------------

// Centrale grenzen voor modelaanroepen. Het standaardplafond is ruim genoeg
// voor één orb, maar blijft bewust kleiner dan de gespecialiseerde controles.
const MODEL_NAAM = "claude-sonnet-4-6";
const MODEL_TIMEOUT_MS = 120000;
const MODEL_HERKANSING_WACHT_MS = 800;
const MODEL_TOKENS_ORB = 1600;
const MODEL_TOKENS_CONTROLE = 3000;
const MODEL_TOKENS_BRONKAART = 2000;
const MODEL_TOKENS_PLANNER = 6000;
const MODEL_TOKENS_SAMENHANG = 2000;

class ModelAanroepFout extends Error {
  constructor(message, { opnieuwProberen = false, status = null } = {}) {
    super(message);
    this.name = "ModelAanroepFout";
    this.opnieuwProberen = opnieuwProberen;
    this.status = status;
  }
}

function wacht(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Eerst gewoon JSON proberen. Komt het model toch met een korte inleiding of
// markdown-hekjes, pak dan het eerste volledige JSON-object zonder tekst buiten
// dat object mee te parseren.
function haalJsonUitModeltekst(invoer) {
  const tekst = String(invoer || "").replace(/```json|```/gi, "").trim();
  if (!tekst) return null;

  try {
    return JSON.parse(tekst);
  } catch {
    // ga door met een gebalanceerde object-scan
  }

  const start = tekst.indexOf("{");
  if (start < 0) return null;

  let diepte = 0;
  let inString = false;
  let ontsnapt = false;

  for (let i = start; i < tekst.length; i++) {
    const teken = tekst[i];
    if (inString) {
      if (ontsnapt) {
        ontsnapt = false;
      } else if (teken === "\\") {
        ontsnapt = true;
      } else if (teken === '"') {
        inString = false;
      }
      continue;
    }

    if (teken === '"') {
      inString = true;
    } else if (teken === "{") {
      diepte += 1;
    } else if (teken === "}") {
      diepte -= 1;
      if (diepte === 0) {
        try {
          return JSON.parse(tekst.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

async function vraagAanModel(instructie, opdracht, korter, maxTokens = MODEL_TOKENS_ORB) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL_NAAM,
        max_tokens: maxTokens,
        messages: [
          {
            role: "user",
            content: `${instructie}

${opdracht}${
              korter
                ? "\n\nLET OP: je vorige antwoord was niet volledig of geen geldige JSON. Antwoord opnieuw, uitsluitend met geldige JSON. Houd teksten en toelichtingen compacter, maar laat verplichte velden staan."
                : ""
            }`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const opnieuwProberen = [408, 409, 425, 429, 500, 502, 503, 504, 529].includes(res.status);
      throw new ModelAanroepFout(
        opnieuwProberen
          ? `De modeldienst gaf tijdelijk foutcode ${res.status}.`
          : `De modeldienst weigerde de aanvraag met foutcode ${res.status}.`,
        { opnieuwProberen, status: res.status }
      );
    }

    const data = await res.json();
    if (data.stop_reason === "max_tokens") return null;
    if (data.stop_reason === "refusal") {
      throw new ModelAanroepFout("De modeldienst weigerde deze inhoudelijke aanvraag.");
    }

    const inhoud = Array.isArray(data.content) ? data.content : [];
    const tekst = inhoud
      .map((c) => (c && c.type === "text" ? c.text : ""))
      .join("")
      .trim();

    return haalJsonUitModeltekst(tekst);
  } catch (e) {
    if (e && e.name === "AbortError") {
      throw new ModelAanroepFout(
        "De modelaanroep duurde langer dan twee minuten en is afgebroken.",
        { opnieuwProberen: true }
      );
    }
    if (e instanceof ModelAanroepFout) throw e;
    throw new ModelAanroepFout(
      "De modeldienst is niet bereikbaar. Controleer de verbinding en probeer opnieuw.",
      { opnieuwProberen: true }
    );
  } finally {
    clearTimeout(timeout);
  }
}

// Probeert maximaal twee keer. Zowel tijdelijk netwerkfalen als afgekapt of
// ongeldig JSON krijgt één herkansing; blijvende inhoudelijke fouten niet.
async function vraagMetHerkansing(instructie, opdracht, isBruikbaar, watGingMis, maxTokens) {
  let laatsteFout = null;

  for (const korter of [false, true]) {
    try {
      const uit = await vraagAanModel(instructie, opdracht, korter, maxTokens);
      if (uit && isBruikbaar(uit)) return uit;
    } catch (e) {
      laatsteFout = e;
      if (!(e instanceof ModelAanroepFout) || !e.opnieuwProberen || korter) throw e;
      await wacht(MODEL_HERKANSING_WACHT_MS);
    }
  }

  if (laatsteFout) throw laatsteFout;
  throw new Error(watGingMis);
}

// Wordt gegooid als de schrijver de stof buiten de scope van het platform vindt.
class BuitenScope extends Error {}

// opdracht is optioneel: het leerdoel uit een leerpadplan, één zin die vóór
// het bronmateriaal wordt gezet. Ontbreekt hij, dan gedraagt de functie zich
// exact zoals voorheen.
async function maakEenOrb(ruweTekst, domeinNaam, deel, totaal, opStap, tier, bekend, opdracht) {
  const welkDeel =
    totaal > 1
      ? `Dit is orb ${deel} van ${totaal}. Verdeel de stof logisch over ${totaal} orbs en werk nu ALLEEN orb ${deel} uit. Behandel één afgerond idee.`
      : `Maak één orb van dit bronmateriaal.`;
  const leerdoelRegel = opdracht ? `\nLEERDOEL VAN DEZE ORB: ${opdracht}\n` : "";

  const ti = tierInfo(tier);
  const bekendeLijst =
    bekend && bekend.length
      ? bekend.map((b) => `- ${b.term}: ${b.uitleg}`).join("\n")
      : "(nog geen — dit is de stam van de boom, dus élk vakwoord moet je uitleggen)";

  const kader = `Domein: ${domeinNaam}
Positie in de boom: ${ti.naam} (tier ${tier}) — ${ti.doel}
Taalniveau: ${TAALNIVEAU} — dit geldt voor de HELE app, ongeacht de tier.
Maximaal ${ti.nieuweVakwoorden} nieuwe vakwoorden in deze orb.

BEGRIPPEN DIE DE LEZER AL KENT (mag je zonder uitleg gebruiken):
${bekendeLijst}`;

  // --- Stap 1: leesstof ---
  if (opStap) opStap("tekst");
  const kern = await vraagMetHerkansing(
    REDACTIE_BLOKKEN,
    `${kader}

${welkDeel}
${leerdoelRegel}
BRONMATERIAAL:
${ruweTekst}`,
    (uit) =>
      uit.buitenScope === true ||
      (uit.titel && Array.isArray(uit.blokken) && uit.blokken.filter(blokIsHeel).length > 0),
    "De omzetter kreeg geen bruikbare leesstof uit dit materiaal. Probeer het opnieuw, of splits de tekst in twee kleinere onderwerpen."
  );

  if (kern.buitenScope === true) {
    throw new BuitenScope(
      kern.buitenScopeReden ||
        "Deze stof valt buiten de scope van het platform: extra diepgang verandert niets aan wat iemand doet."
    );
  }

  const blokken = kern.blokken.filter(blokIsHeel);
  const begrippen = (kern.begrippen || []).filter(
    (b) => b && b.term && b.uitleg && b.term.length < 60
  );

  // --- Stap 2: vragen, op basis van de zojuist geschreven leesstof ---
  if (opStap) opStap("vragen");
  const leesstof = blokken
    .map((b) => (b.type === "tekst" ? b.tekst : `[${b.type}: ${b.titel || b.mythe || ""}]`))
    .join("\n\n");

  const vragenUit = await vraagMetHerkansing(
    REDACTIE_VRAGEN,
    `Domein: ${domeinNaam}
Titel van de orb: ${kern.titel}

DE LEESSTOF WAAR DE VRAGEN OVER GAAN:
${leesstof}

TER ACHTERGROND, het oorspronkelijke bronmateriaal:
${ruweTekst.slice(0, 1500)}`,
    (uit) => Array.isArray(uit.vragen) && uit.vragen.filter(vraagIsHeel).length > 0,
    "De omzetter kreeg geen bruikbare vragen uit dit materiaal. De leesstof is wel gelukt — probeer opnieuw."
  );

  const vragen = vragenUit.vragen.filter(vraagIsHeel);

  const stempel = `${Date.now()}-${deel}`;
  return {
    id: `orb-${stempel}`,
    titel: kern.titel,
    haakje: kern.haakje || "",
    blokken,
    begrippen,
    vragen: vragen.map((v, j) => ({ ...v, id: `orb-${stempel}-v${j}` })),
  };
}

// ---------------------------------------------------------------------------
// ROL 3 — DE WAARHEIDSTOETSER
//
// Krijgt het concept én de bronnenset. Toetst elke bewering tegen de bron en
// wijst de passage aan. Herschrijft niets — hij wijst alleen aan.
//
// Cruciaal: hij verzint GEEN bronnen. Hij toetst alleen tegen wat jij hebt
// aangeleverd. Wat niet in de bronnenset staat, wordt gemarkeerd als ongedekt.
// ---------------------------------------------------------------------------
const TOETSER = `Je bent feitentoetser voor een leerplatform. Je krijgt een concept-leerblok
en een BRONNENSET. Je toetst of elke bewering in het concept gedekt wordt door de bronnenset.

IJZEREN REGELS:
- De bronnenset is de enige waarheid. Jouw eigen kennis telt NIET mee.
- Je verzint NOOIT een bron, auteur, jaartal of studie. Je citeert uitsluitend uit de
  aangeleverde bronnenset.
- Staat een bewering niet in de bronnenset? Dan is die "niet_gedekt". Ook als je zeker weet
  dat hij klopt. Ook als hij algemeen bekend is. Niet in de bron = niet gedekt.
- Spreekt de bron de bewering tegen? Dan "tegengesproken". Dat is de ernstigste bevinding.
- Bij "gedekt" citeer je LETTERLIJK de passage uit de bronnenset die het dekt. Maximaal 20 woorden.

Toets maximaal 5 beweringen: de inhoudelijk zwaarste. Getallen, stelligheden en instructies
gaan vóór algemene zinnen. Sla stijl en toon over — daar gaat een ander over.

ANTWOORDFORMAAT (uitsluitend JSON, geen backticks):
{"bevindingen":[{"bewering":"de bewering uit het concept, kort","oordeel":"gedekt","passage":"letterlijk citaat uit de bron","toelichting":"één zin"}]}
oordeel is één van: "gedekt", "niet_gedekt", "tegengesproken".
Bij niet_gedekt en tegengesproken laat je "passage" leeg.`;

// ---------------------------------------------------------------------------
// ROL 4 — DE REDACTEUR
//
// Kijkt het concept koud in. Kent alleen de kwaliteitslat, niet de opdracht die
// het concept heeft voortgebracht. Mag herschrijven, met een reden erbij — en
// die reden is een criterium, nooit een verzonnen literatuurverwijzing.
// ---------------------------------------------------------------------------
const REDACTEUR = `Je bent eindredacteur van een leerplatform. Je krijgt een concept-leerblok
dat door iemand anders is geschreven. Je kijkt het streng na. Je bent niet aardig; je bent nuttig.

${LAT}

Je krijgt mee: de POSITIE in de boom (tier), het vaste taalniveau B2, en de lijst BEGRIPPEN DIE DE
LEZER AL KENT uit eerdere orbs in deze leerlijn.

DE LAT — beoordeel op deze criteria:

1. TAAL — DIT IS HET ZWAARSTE CRITERIUM NA SCHADELIJKE AFLEIDERS.
   De hele app werkt op B2, ongeacht de tier: korte heldere zinnen, geen naamwoordstijl,
   geen tangconstructies. Een moeilijk begrip mag, wollige taal niet.
   Elke zin die een gewone lezer moet herlezen, is een fout. Wees hier onverbiddelijk —
   de meeste leerplatforms falen precies hier. Lever bij taalfouten ALTIJD een herschreven versie.

2. ONVERKLAARD VAKWOORD — Gebruikt de tekst een vakwoord dat NIET in de lijst met bekende
   begrippen staat, en dat ook niet ter plekke wordt uitgelegd? Dat is een harde fout,
   ongeacht het niveau. Noem het woord expliciet.

3. HERKAUWEN — Vanaf tier 2: legt de tekst iets opnieuw uit dat de lezer volgens de
   begrippenlijst al kent? Verdieping die alles herhaalt is geen verdieping. Meld dit.

4. LEEG — Op tier 1 (de stam): is het een open deur? Simpele taal is de eis, maar een tekst zonder
   inhoud is geen stam, dat is vulling. De stam moet toegankelijk zijn EN iets zeggen.

5. SCHADELIJKE AFLEIDER — Kan iemand een foute antwoordoptie onthouden als wáár? Een overtuigend
   geformuleerde misvatting kan zich vastzetten, ook al is hij als fout gemarkeerd.
   Zo'n afleider MOET vervangen worden.

6. VRAGEN EN AFLEIDERS — Toetsen de vragen BEGRIP of alleen of iemand de tekst gelezen heeft?
   Zijn de foute antwoorden plausibele DENKFOUTEN, of onzin die niemand kiest?

7. STELLIGHEID — Wordt er stelliger gedaan dan de stof toelaat? Ontbreekt nuance of bewijskracht
   waar die hoort?

8. SCOPE:
${SCOPE}
Valt de orb buiten de scope, zet dan "buitenScope": true met een reden. Dat is geen bevinding
maar een oordeel over de hele orb.

VOOR ELKE BEVINDING geef je: waar het zit, hoe ernstig, wat er mis is, en een CONCREET voorstel.
Bij een tekstblok mag je een herschreven versie leveren — doe dat altijd bij taalfouten.
Je onderbouwing is altijd een criterium hierboven. NOOIT een verzonnen bron, studie of auteur.

Maximaal 4 bevindingen: de zwaarste eerst. Is er niets mis, geef dan een lege lijst.
Wees streng maar niet muggenzifterig — meld alleen wat er echt toe doet.

ANTWOORDFORMAAT (uitsluitend JSON, geen backticks):
{"oordeel":"goed",
 "buitenScope":false,
 "buitenScopeReden":"",
 "bevindingen":[{"waar":"Blok 2","ernst":"hoog","criterium":"Taal","wat":"één zin over wat er mis is","voorstel":"concreet voorstel","vervangTekstBlok":2,"nieuweTekst":"de herschreven alinea"}]}
"oordeel" is "goed", "matig" of "zwak".
"ernst" is "hoog", "midden" of "laag".
"vervangTekstBlok" en "nieuweTekst" alleen invullen als je een tekstblok herschrijft (index vanaf 0).`;

async function toetsAanBronnen(orb, bronTekst) {
  const concept = orb.blokken
    .map((b) =>
      b.type === "tekst"
        ? b.tekst
        : `[${b.type}] ${JSON.stringify(b).slice(0, 300)}`
    )
    .join("\\n\\n");

  const vragen = orb.vragen
    .map((v) => `${v.vraag} — juist: ${vraagJuisteAntwoord(v)}`)
    .join("\\n");

  // De gedeelde herkansingsroute vangt zowel tijdelijke API-fouten als
  // afgekapt/ongeldig JSON op. Alleen geldige oordelen worden bewaard.
  const uit = await vraagMetHerkansing(
    TOETSER,
    `BRONNENSET:
${bronTekst.slice(0, 12000)}

CONCEPT — TITEL: ${orb.titel}

LEESSTOF:
${concept}

VRAGEN EN JUISTE ANTWOORDEN:
${vragen}`,
    (u) =>
      Array.isArray(u.bevindingen) &&
      u.bevindingen.length > 0 &&
      u.bevindingen.every(
        (b) =>
          b &&
          typeof b.bewering === "string" &&
          ["gedekt", "niet_gedekt", "tegengesproken"].includes(b.oordeel)
      ),
    "De waarheidstoetser kwam niet tot een bruikbaar oordeel.",
    MODEL_TOKENS_CONTROLE
  );

  return uit.bevindingen;
}

function vraagJuisteAntwoord(v) {
  if (v.type === "sorteren") return v.juisteVolgorde.map((i) => v.items[i]).join(" > ");
  if (v.type === "matchen") return v.paren.map((p) => `${p.links}=${p.rechts}`).join("; ");
  return v.opties[v.juisteIndex];
}

async function laatRedigeren(orb, tier, bekend) {
  const blokken = orb.blokken
    .map((b, i) =>
      b.type === "tekst"
        ? `Blok ${i} (tekst): ${b.tekst}`
        : `Blok ${i} (${b.type}): ${JSON.stringify(b).slice(0, 300)}`
    )
    .join("\\n\\n");

  const vragen = orb.vragen
    .map((v, i) => `Vraag ${i} (${v.type}): ${JSON.stringify(v).slice(0, 500)}`)
    .join("\\n\\n");

  const ti = tierInfo(tier);
  const bekendeLijst =
    bekend && bekend.length
      ? bekend.map((b) => b.term).join(", ")
      : "(geen — dit is de stam van de boom)";
  const nieuweBegrippen = (orb.begrippen || [])
    .map((b) => `${b.term}: ${b.uitleg}`)
    .join("\n") || "(geen)";

  // Zelfde centrale herkansing als de toetser. Een redactie-uitkomst telt
  // alleen wanneer oordeel, scopevelden en bevindingen structureel kloppen.
  return vraagMetHerkansing(
    REDACTEUR,
    `POSITIE IN DE BOOM: ${ti.naam} (tier ${tier}) — ${ti.doel}
VEREIST TAALNIVEAU: ${TAALNIVEAU} (geldt voor de hele app, ongeacht tier)
BEGRIPPEN DIE DE LEZER AL KENT: ${bekendeLijst}

BEGRIPPEN DIE DEZE ORB INTRODUCEERT:
${nieuweBegrippen}

CONCEPT — TITEL: ${orb.titel}

${blokken}

${vragen}

HAAKJE: ${orb.haakje}`,
    (u) =>
      ["goed", "matig", "zwak"].includes(u.oordeel) &&
      typeof u.buitenScope === "boolean" &&
      Array.isArray(u.bevindingen),
    "De eindredacteur kwam niet tot een bruikbaar oordeel.",
    MODEL_TOKENS_CONTROLE
  );
}

async function maakOrbs(
  ruweTekst,
  aantal,
  domeinNaam,
  opVoortgang,
  bronTekst,
  tier,
  startBegrippen
) {
  const orbs = [];
  // De begrippenlijst groeit mee: orb 2 kent wat orb 1 heeft geïntroduceerd.
  let bekend = [...(startBegrippen || [])];

  for (let i = 1; i <= aantal; i++) {
    const orb = await maakEenOrb(
      ruweTekst,
      domeinNaam,
      i,
      aantal,
      (stap) => {
        if (opVoortgang) opVoortgang(i, aantal, stap);
      },
      tier,
      bekend
    );

    // --- Rol 3: toetsen aan de bronnenset (alleen als die er is) ---
    let bronControle = null;
    if (bronTekst && bronTekst.trim().length > 100) {
      if (opVoortgang) opVoortgang(i, aantal, "bron");
      try {
        bronControle = await toetsAanBronnen(orb, bronTekst);
      } catch {
        bronControle = null;
      }
    }

    // --- Rol 4: de redacteur ---
    if (opVoortgang) opVoortgang(i, aantal, "redactie");
    let redactie = null;
    try {
      redactie = await laatRedigeren(orb, tier, bekend);
    } catch {
      redactie = null;
    }

    orbs.push({ ...orb, bronControle, redactie });

    // wat deze orb introduceerde, kent de lezer bij de volgende orb al
    bekend = [...bekend, ...(orb.begrippen || [])];
  }
  return orbs;
}

// ============================================================================
// LEERPADGENERATIE — van bronnenset naar volledig leerpad
//
// De losse omzetter hierboven maakt één topic tegelijk. De leerpadgeneratie
// zet daar één laag boven: een planner (Rol 0) die uit de bronnen een heel
// pad ontwerpt, een lus die per gepland orb de bestaande pijplijn draait,
// een poortwachter (Rol 5, puur code) die de controle-uitslagen machinaal
// beoordeelt, en een samenhangscontrole (Rol 6) over het geheel.
//
// Zie ONTWERP_Leerpadgeneratie.md voor het volledige ontwerp. Alles hier is
// netto nieuw; de bestaande omzetter, leerlingkant en Leitner blijven
// onaangeraakt.
// ============================================================================

const RUN_SLEUTEL = "leerplatform-leerpadrun-v1";
const ARCHIEF_SLEUTEL = "leerplatform-leerpadarchief-v1";

async function laadRun() {
  try {
    const r = await window.storage.get(RUN_SLEUTEL);
    return r ? JSON.parse(r.value) : null;
  } catch {
    return null;
  }
}

async function bewaarRun(run) {
  try {
    await window.storage.set(RUN_SLEUTEL, JSON.stringify(run));
    return true;
  } catch {
    return false;
  }
}

async function laadRunArchief() {
  try {
    const r = await window.storage.get(ARCHIEF_SLEUTEL);
    return r ? JSON.parse(r.value) : [];
  } catch {
    return [];
  }
}

// Bewaart de volledige controlehistorie van een run: het auditdossier.
// Idempotent op run-id — dezelfde run overschrijft zijn eigen archiefpost.
async function archiveerRun(run, archiefStatus) {
  const archief = await laadRunArchief();
  const post = { ...run, archiefStatus, gearchiveerdOp: new Date().toISOString() };
  const zonder = archief.filter((a) => a.id !== run.id);
  try {
    await window.storage.set(ARCHIEF_SLEUTEL, JSON.stringify([...zonder, post]));
    return true;
  } catch {
    return false;
  }
}

// Deterministische checksum (djb2). Geen cryptografie — alleen om te zien of
// een bron is gewijzigd sinds de run of de publicatie.
function checksumVanTekst(tekst) {
  let h = 5381;
  for (let i = 0; i < tekst.length; i++) {
    h = ((h << 5) + h + tekst.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

// ---------------------------------------------------------------------------
// STAP 1 — bronnen deterministisch opknippen in passages (puur, geen LLM)
//
// Passages zijn offsets in de brontekst, geen kopieën. De bron blijft leidend.
// Een kop (korte regel zonder punt) begint altijd een nieuwe passage; een
// alinea wordt nooit doorgeknipt.
// ---------------------------------------------------------------------------
const PASSAGE_MAX = 2500;

function splitsInPassages(bron) {
  const tekst = bron.tekst;

  // alinea's mét hun offsets in de brontekst
  const alineas = [];
  const scheider = /\n\s*\n/g;
  let vorige = 0;
  let m;
  while ((m = scheider.exec(tekst)) !== null) {
    if (m.index > vorige) alineas.push({ van: vorige, tot: m.index });
    vorige = m.index + m[0].length;
  }
  if (vorige < tekst.length) alineas.push({ van: vorige, tot: tekst.length });

  const isKop = (a) => {
    const t = tekst.slice(a.van, a.tot).trim();
    return t.length > 0 && t.length <= 60 && !t.includes("\n") && !/[.!?]$/.test(t);
  };

  const passages = [];
  let huidige = null;
  let laatsteKop = "";

  const sluitAf = () => {
    if (!huidige) return;
    passages.push({
      id: `p-${bron.id}-${passages.length + 1}`,
      bronId: bron.id,
      van: huidige.van,
      tot: huidige.tot,
      kop: huidige.kop,
    });
    huidige = null;
  };

  alineas.forEach((a) => {
    const lengte = a.tot - a.van;
    if (isKop(a)) {
      laatsteKop = tekst.slice(a.van, a.tot).trim();
      sluitAf();
    }
    if (huidige && huidige.tot - huidige.van + lengte > PASSAGE_MAX) sluitAf();
    if (!huidige) {
      huidige = { van: a.van, tot: a.tot, kop: laatsteKop };
    } else {
      huidige.tot = a.tot;
    }
  });
  sluitAf();

  return passages;
}

// ---------------------------------------------------------------------------
// DE DOCUMENTSPLITSER — puur rekenwerk, geen AI, geen netwerk.
//
// Eén groot document (een handboek, een compleet curriculum) omzetten in losse
// hoofdstukbronnen met opmaak die splitsInPassages hierboven aankan. Zonder
// witregels wordt een heel document namelijk één reuzenpassage; dat is de
// meest voorkomende oorzaak van een mislukte leerpad-run.
//
// Deterministisch: hetzelfde document geeft altijd hetzelfde resultaat.
// ---------------------------------------------------------------------------

function isOpsommingsregel(regel) {
  return /^\s*([*\-•·]|\d+[.)])\s+/.test(regel);
}

// Een regel die zich als kop gedraagt: kort, op zichzelf staand, geen hele zin.
function lijktOpKop(regel) {
  const t = regel.trim();
  if (!t || t.length > 60) return false;
  if (isOpsommingsregel(regel)) return false;
  if (/[.!]$/.test(t)) return false;
  return true;
}

function hoofdstukGrens(regel) {
  const m = regel.trim().match(/^hoofdstuk\s+(\d+)\s*[—–\-:]?\s*(.*)$/i);
  return m ? { nummer: parseInt(m[1], 10), titelOpZelfdeRegel: m[2].trim() } : null;
}

// Word- en PDF-tekst is vaak hard afgebroken op ~80 tekens. Zonder deze stap
// zou iedere afgebroken regel als losse alinea worden gelezen.
function voegAfgebrokenRegelsSamen(regels) {
  const uit = [];
  for (const regel of regels) {
    const vorige = uit[uit.length - 1];
    const t = regel.trim();
    const looptDoor =
      vorige !== undefined &&
      vorige.trim() !== "" &&
      t !== "" &&
      !isOpsommingsregel(regel) &&
      !isOpsommingsregel(vorige) &&
      !lijktOpKop(vorige) &&
      !/[.!?:;]$/.test(vorige.trim()) &&
      /^[a-zà-ÿ(]/.test(t);
    if (looptDoor) uit[uit.length - 1] = vorige + " " + t;
    else uit.push(regel);
  }
  return uit;
}

// De app knipt uitsluitend op witregels. Hier wordt bepaald waar er één hoort.
function herstelWitregels(regels) {
  const uit = [];
  for (const regel of regels) {
    const t = regel.trim();
    if (t === "") {
      if (uit.length && uit[uit.length - 1] !== "") uit.push("");
      continue;
    }
    const vorige = uit.length ? uit[uit.length - 1] : "";
    if (vorige !== "") {
      const beideOpsomming = isOpsommingsregel(regel) && isOpsommingsregel(vorige);
      const wisselOpsomming = isOpsommingsregel(regel) !== isOpsommingsregel(vorige);
      if (
        !beideOpsomming &&
        (wisselOpsomming ||
          lijktOpKop(vorige) ||
          lijktOpKop(regel) ||
          /[.!?]$/.test(vorige.trim()))
      ) {
        uit.push("");
      }
    }
    uit.push(regel);
  }
  return uit;
}

// splitsInPassages ziet een regel niet als kop wanneer die op een leesteken
// eindigt. "1.2 Wat is gezondheid?" telt dus niet mee. Het vraagteken gaat
// eraf zodat de kop wél een passage afdwingt. Dit is de ENIGE plek waar de
// splitser tekens weghaalt — het aantal wordt geteld en getoond.
function maakKoppenHerkenbaar(regels) {
  let aangepast = 0;
  const uit = regels.map((regel, i) => {
    const t = regel.trim();
    if (!t || t.length > 60 || isOpsommingsregel(regel)) return regel;
    if (!/[?:]$/.test(t)) return regel;
    const vorigeLeeg = i === 0 || regels[i - 1].trim() === "";
    const volgendeLeeg = i === regels.length - 1 || regels[i + 1].trim() === "";
    if (!vorigeLeeg || !volgendeLeeg) return regel;
    aangepast++;
    return regel.replace(/[?:]\s*$/, "");
  });
  return { regels: uit, aangepast };
}

function maakOpmaakGoed(tekst) {
  let regels = tekst.split(/\r?\n/).map((r) => r.replace(/[ \t]+$/, ""));
  regels = voegAfgebrokenRegelsSamen(regels);
  regels = herstelWitregels(regels);
  const kop = maakKoppenHerkenbaar(regels);
  return {
    tekst: kop.regels.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    koppenAangepast: kop.aangepast,
  };
}

function splitsInHoofdstukken(document) {
  const regels = document.split(/\r?\n/);
  const hoofdstukken = [];
  const voorwerk = [];
  let huidig = null;

  regels.forEach((regel, i) => {
    const grens = hoofdstukGrens(regel);
    if (grens) {
      if (huidig) hoofdstukken.push(huidig);
      let titel = grens.titelOpZelfdeRegel;
      if (!titel) {
        for (let j = i + 1; j < regels.length; j++) {
          const t = regels[j].trim();
          if (!t) continue;
          if (t.length <= 90) titel = t;
          break;
        }
      }
      huidig = { nummer: grens.nummer, titel, regels: [regel] };
      return;
    }
    if (huidig) huidig.regels.push(regel);
    else voorwerk.push(regel);
  });
  if (huidig) hoofdstukken.push(huidig);

  return { hoofdstukken, voorwerk: voorwerk.join("\n").trim() };
}

// Het eindresultaat: per hoofdstuk een kant-en-klare bron mét de cijfers die
// de app straks werkelijk zal meten.
function bereidBronnenVoor(document) {
  const { hoofdstukken, voorwerk } = splitsInHoofdstukken(document);
  const delen = hoofdstukken.length
    ? hoofdstukken
    : [{ nummer: null, titel: "", regels: document.split(/\r?\n/) }];

  return {
    voorwerkTekens: voorwerk.length,
    delen: delen.map((d) => {
      const opgemaakt = maakOpmaakGoed(d.regels.join("\n"));
      const passages = splitsInPassages({ id: "meting", tekst: opgemaakt.tekst });
      const lengtes = passages.map((p) => p.tot - p.van);
      const grootste = lengtes.length ? Math.max(...lengtes) : 0;
      return {
        naam: d.nummer
          ? `Hoofdstuk ${d.nummer}${d.titel ? " — " + d.titel : ""}`
          : "Volledig document",
        tekst: opgemaakt.tekst,
        tekens: opgemaakt.tekst.length,
        aantalPassages: passages.length,
        grootstePassage: grootste,
        koppenAangepast: opgemaakt.koppenAangepast,
        waarschuwing:
          passages.length === 0
            ? "Geen passages — controleer de opmaak."
            : passages.length < 4
            ? "Weinig passages; dit levert een dun leerpad."
            : grootste > 2500
            ? "Een passage is groter dan 2.500 tekens en kan bij het schrijven vastlopen."
            : opgemaakt.tekst.length > 12000
            ? "Meer dan 12.000 tekens; splits dit hoofdstuk voor een stabielere run."
            : null,
      };
    }),
  };
}

function passageTekst(domeinBronnen, passage) {
  const bron = domeinBronnen.find((b) => b.id === passage.bronId);
  return bron ? bron.tekst.slice(passage.van, passage.tot) : "";
}

function tekstVanPassages(domeinBronnen, run, passageIds) {
  return passageIds
    .map((pid) => {
      const p = run.passages.find((x) => x.id === pid);
      return p ? passageTekst(domeinBronnen, p) : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// ROL 0a — DE BIBLIOTHECARIS: bronkaart + passagecatalogus
//
// Vat per groep passages samen wat erin staat, en levert per passage een
// compact catalogusitem. De planner werkt straks uitsluitend hiermee — hij
// ziet de volledige brontekst nooit.
// ---------------------------------------------------------------------------
const BRONKAART = `Je bent bibliothecaris van een leerplatform. Je krijgt een reeks PASSAGES
uit één brondocument, elk met een id. Je maakt twee dingen: een deelkaart van dit stuk van
de bron, en een compact catalogusitem per passage.

${LAT}

IJZEREN REGELS:
- Je beschrijft wat er STAAT. Geen oordeel, geen aanvulling uit eigen kennis.
- Elk catalogusitem hoort bij precies één aangeleverde passage-id. Verzin nooit een id.
- kernbegrippen zijn 1 tot 4 vaktermen die letterlijk in de passage voorkomen.
- Maximaal 5 kernpunten per deelkaart.

ANTWOORDFORMAAT (uitsluitend JSON, geen backticks):
{"deelkaart":{"samenvatting":"2 tot 4 zinnen over wat dit deel van de bron behandelt",
  "kernpunten":["..."]},
 "catalogus":[{"passageId":"p-...","kop":"...","samenvatting":"één zin","kernbegrippen":["..."]}]}`;

const BRONKAART_GROEP = 10;

async function maakBronkaart(bron, passages, domeinBronnen) {
  const deelkaarten = [];
  const catalogus = [];

  for (let i = 0; i < passages.length; i += BRONKAART_GROEP) {
    const groep = passages.slice(i, i + BRONKAART_GROEP);
    const invoer = groep
      .map((p) => {
        const t = passageTekst(domeinBronnen, p);
        return `[${p.id}]${p.kop ? ` (${p.kop})` : ""}\n${t}`;
      })
      .join("\n\n---\n\n");

    const uit = await vraagMetHerkansing(
      BRONKAART,
      `BRON: ${bron.naam}\nDit is deel ${Math.floor(i / BRONKAART_GROEP) + 1} van de bron.\n\nPASSAGES:\n${invoer}`,
      (u) =>
        u.deelkaart &&
        typeof u.deelkaart.samenvatting === "string" &&
        Array.isArray(u.catalogus) &&
        u.catalogus.length > 0,
      `De bibliothecaris kreeg geen bruikbare bronkaart uit "${bron.naam}".`,
      MODEL_TOKENS_BRONKAART
    );

    deelkaarten.push(uit.deelkaart);
    const geldigeIds = new Set(groep.map((p) => p.id));
    uit.catalogus
      .filter((c) => c && geldigeIds.has(c.passageId))
      .forEach((c) => {
        const p = groep.find((x) => x.id === c.passageId);
        catalogus.push({
          passageId: c.passageId,
          bronId: bron.id,
          kop: c.kop || p.kop || "",
          samenvatting: c.samenvatting || "",
          kernbegrippen: Array.isArray(c.kernbegrippen) ? c.kernbegrippen.slice(0, 4) : [],
          // deterministisch controleanker: begin van de passage, los van de LLM
          anker: passageTekst(domeinBronnen, p).slice(0, 120),
        });
      });
  }

  return {
    bronkaart: {
      bronId: bron.id,
      samenvatting: deelkaarten.map((d) => d.samenvatting).join(" "),
      kernpunten: deelkaarten.flatMap((d) => d.kernpunten || []).slice(0, 12),
    },
    catalogus,
  };
}

// ---------------------------------------------------------------------------
// ROL 0 — DE CURRICULUMPLANNER
//
// Ontwerpt uit bronkaarten en passagecatalogus het hele leerpad: topics,
// volgorde, tiers, maximaal één directe prerequisite per topic, en per orb
// welke passages de stof leveren. Het plan wordt daarna door CODE gevalideerd
// (planIsHeel) — de planner beslist, de code bewaakt.
// ---------------------------------------------------------------------------
const PLANNER = `Je bent curriculumplanner van een microlearning-app. Je krijgt bronkaarten en
een passagecatalogus van een domein. Je ontwerpt daaruit een compleet leerpad: onderwerpen
(topics), hun volgorde, en per onderwerp 1 tot 3 lessen (orbs).

${LAT}

DE BOOM:
- Tiers: 1 = Stam (familiariseren, geen voorkennis), 2 = Tak (voortbouwen), 3 = Takje (verdiepen).
- Elk topic heeft LEEG of PRECIES ÉÉN "prerequisites"-element: de directe voorganger.
  Een langere leerroute bouw je door topics aan elkaar te rijgen.
- Zonder voorganger is een topic een stam: tier 1. Met voorganger: tier van de voorganger + 1,
  met een plafond van 3.
- Prerequisites zijn een leerroute en begrippenketen, geen slot: alles blijft aanklikbaar.

DE STOF:
- Per orb wijs je 1 tot 4 passage-id's uit de catalogus aan die samen de stof leveren.
  Kies passages die echt bij het leerdoel horen; een passage mag meerdere orbs voeden.
- Passages die je bewust niet gebruikt zet je in "nietGebruikt", met reden ("buiten scope"
  of "te diep"). Niets stilzwijgend weglaten.
- Dubbel niet met de BESTAANDE TOPICS die je meekrijgt.

SCOPE — stof die hierbuiten valt, hoort in "nietGebruikt":
${SCOPE}

ANTWOORDFORMAAT (uitsluitend JSON, geen backticks):
{"topics":[{"planTopicId":"t1","titel":"max 5 woorden","ondertitel":"één regel",
  "tier":1,"prerequisites":[],"leerdoel":"één zin",
  "orbs":[{"planOrbId":"t1-o1","titel":"max 6 woorden","leerdoel":"één zin","passageIds":["p-..."]}]}],
 "nietGebruikt":[{"passageId":"p-...","reden":"..."}]}
Maximaal 8 topics. Houd alle teksten kort; het antwoord moet volledig passen.`;

function planIsHeel(plan, passages) {
  if (!plan || !Array.isArray(plan.topics) || plan.topics.length === 0) return false;
  // De prompt en de validator gebruiken dezelfde bovengrens. Meer dan acht
  // topics maakt één run te groot en was eerder onbedoeld toch geldig.
  if (plan.topics.length > 8) return false;

  const passageIds = new Set(passages.map((p) => p.id));
  const topicIds = new Set();
  const orbIds = new Set();

  for (const t of plan.topics) {
    if (
      !t ||
      typeof t.planTopicId !== "string" ||
      !t.planTopicId.trim() ||
      typeof t.titel !== "string" ||
      !t.titel.trim() ||
      typeof t.leerdoel !== "string" ||
      !t.leerdoel.trim() ||
      !Number.isInteger(t.tier) ||
      t.tier < 1 ||
      t.tier > 3
    ) {
      return false;
    }
    if (topicIds.has(t.planTopicId)) return false;
    topicIds.add(t.planTopicId);
    if (!Array.isArray(t.prerequisites) || t.prerequisites.length > 1) return false;
    if (!Array.isArray(t.orbs) || t.orbs.length < 1 || t.orbs.length > 3) return false;
    for (const o of t.orbs) {
      if (
        !o ||
        typeof o.planOrbId !== "string" ||
        !o.planOrbId.trim() ||
        orbIds.has(o.planOrbId) ||
        typeof o.titel !== "string" ||
        !o.titel.trim() ||
        typeof o.leerdoel !== "string" ||
        !o.leerdoel.trim()
      ) {
        return false;
      }
      orbIds.add(o.planOrbId);
      if (
        !Array.isArray(o.passageIds) ||
        o.passageIds.length < 1 ||
        o.passageIds.length > 4 ||
        new Set(o.passageIds).size !== o.passageIds.length
      ) {
        return false;
      }
      if (!o.passageIds.every((pid) => passageIds.has(pid))) return false;
    }
  }

  // prerequisites bestaan, geen cycli (met max één voorganger is een cyclus
  // een lus in de keten), en tiers sluiten logisch aan op de voorganger
  const perId = {};
  plan.topics.forEach((t) => {
    perId[t.planTopicId] = t;
  });
  for (const t of plan.topics) {
    const eis = t.prerequisites[0];
    if (eis !== undefined) {
      if (!perId[eis]) return false;
      const gezien = new Set([t.planTopicId]);
      let stap = perId[eis];
      while (stap) {
        if (gezien.has(stap.planTopicId)) return false; // cyclus
        gezien.add(stap.planTopicId);
        stap = stap.prerequisites[0] !== undefined ? perId[stap.prerequisites[0]] : null;
      }
      const vTier = perId[eis].tier;
      if (t.tier !== Math.min(vTier + 1, 3)) return false;
    } else if (t.tier !== 1) {
      return false; // stam is per definitie tier 1
    }
  }
  return true;
}

// Stammen eerst, dan elk topic zodra zijn voorganger geplaatst is.
// Dit is tegelijk de generatie- én publicatievolgorde.
function topologischeVolgordePlan(planTopics) {
  const volgorde = [];
  const geplaatst = new Set();
  let rest = [...planTopics];
  while (rest.length > 0) {
    const klaar = rest.filter(
      (t) => t.prerequisites.length === 0 || geplaatst.has(t.prerequisites[0])
    );
    if (klaar.length === 0) break; // hoort niet te gebeuren: planIsHeel weert cycli
    klaar.forEach((t) => {
      volgorde.push(t);
      geplaatst.add(t.planTopicId);
    });
    rest = rest.filter((t) => !geplaatst.has(t.planTopicId));
  }
  return volgorde;
}

async function planLeerpad(domein, bronkaarten, passagecatalogus, bestaandeTopics, passages) {
  const kaarten = bronkaarten
    .map((k) => `BRON ${k.bronId}:\n${k.samenvatting}\nKernpunten: ${(k.kernpunten || []).join("; ")}`)
    .join("\n\n");

  const catalogus = passagecatalogus
    .map(
      (c) =>
        `${c.passageId}${c.kop ? ` — ${c.kop}` : ""}: ${c.samenvatting}` +
        (c.kernbegrippen.length ? ` [${c.kernbegrippen.join(", ")}]` : "")
    )
    .join("\n");

  const bestaand =
    bestaandeTopics.length > 0
      ? bestaandeTopics.map((t) => `- ${t.titel} (${t.ondertitel || ""})`).join("\n")
      : "(nog geen)";

  return vraagMetHerkansing(
    PLANNER,
    `Domein: ${domein.naam} — ${domein.omschrijving || ""}

BESTAANDE TOPICS IN DIT DOMEIN (niet dubbelen):
${bestaand}

BRONKAARTEN:
${kaarten}

PASSAGECATALOGUS:
${catalogus}`,
    (uit) => planIsHeel(uit, passages),
    "De planner kreeg geen geldig leerpadplan uit deze bronnen. Probeer het opnieuw, of controleer of de bronnen genoeg samenhangende stof bevatten.",
    // Ruim plafond: een vol plan (8 topics × 3 orbs met leerdoelen en
    // passage-verwijzingen) past niet betrouwbaar in 2500 tokens — dat was
    // de vaste oorzaak van gestrande runs bij domeinen met meerdere bronnen.
    MODEL_TOKENS_PLANNER
  );
}

// Welke begrippen kent de lezer bij dit topic, volgens het PLAN? De spiegel
// van bekendeBegrippen, maar dan over de nog niet gepubliceerde run heen.
function bekendLangsPlan(plan, planTopicId, run) {
  const perId = {};
  plan.topics.forEach((t) => {
    perId[t.planTopicId] = t;
  });

  // keten van stam naar dit topic (exclusief het topic zelf)
  const keten = [];
  let stap = perId[planTopicId];
  stap = stap && stap.prerequisites[0] !== undefined ? perId[stap.prerequisites[0]] : null;
  while (stap) {
    keten.unshift(stap);
    stap = stap.prerequisites[0] !== undefined ? perId[stap.prerequisites[0]] : null;
  }

  const lijst = [];
  const gezien = new Set();
  keten.forEach((t) => {
    t.orbs.forEach((o) => {
      const oiu = run.orbsInUitvoering[o.planOrbId];
      if (oiu && oiu.orb) {
        (oiu.orb.begrippen || []).forEach((b) => {
          const sleutel = (b.term || "").toLowerCase();
          if (sleutel && !gezien.has(sleutel)) {
            gezien.add(sleutel);
            lijst.push(b);
          }
        });
      }
    });
  });
  return lijst;
}

// ---------------------------------------------------------------------------
// ROL 5 — DE POORTWACHTER (puur code, geen LLM)
//
// Automatische goedkeuring is precies de plek waar je voorspelbaarheid wilt.
// De LLM's leveren bevindingen; dít zijn de regels die erover beslissen.
// ---------------------------------------------------------------------------
function poortwachter(oiu) {
  const redenen = orbStructuurFouten(oiu && oiu.orb);
  const bron = Array.isArray(oiu && oiu.bronControle) ? oiu.bronControle : null;
  const red = oiu && oiu.redactie;

  // Buiten scope is een inhoudelijk oordeel, geen gewone redactiefout. Laat de
  // orb daarom niet via een herstelronde alsnog automatisch groen worden.
  if (red && red.buitenScope === true) {
    return {
      besluit: "buiten-scope",
      redenen: [red.buitenScopeReden || "De eindredacteur plaatst deze orb buiten de scope."],
    };
  }

  if (
    !bron ||
    bron.length === 0 ||
    !bron.every(
      (b) => b && b.bewering && ["gedekt", "niet_gedekt", "tegengesproken"].includes(b.oordeel)
    )
  ) {
    redenen.push("De waarheidstoetser kwam niet tot een geldig bewaard oordeel.");
  } else {
    const tegengesproken = bron.filter((b) => b.oordeel === "tegengesproken").length;
    const nietGedekt = bron.filter((b) => b.oordeel === "niet_gedekt").length;
    if (tegengesproken > 0) redenen.push(`${tegengesproken} bewering(en) door de bron tegengesproken.`);
    if (nietGedekt > 0) redenen.push(`${nietGedekt} bewering(en) niet gedekt door de bron.`);
  }

  if (
    !red ||
    !["goed", "matig", "zwak"].includes(red.oordeel) ||
    !Array.isArray(red.bevindingen)
  ) {
    redenen.push("De eindredacteur kwam niet tot een geldig bewaard oordeel.");
  } else {
    if (red.oordeel === "zwak") redenen.push("De eindredacteur beoordeelt het concept als zwak.");
    const hoog = red.bevindingen.filter((b) => b && b.ernst === "hoog");
    if (hoog.length > 0) {
      redenen.push(
        `${hoog.length} bevinding(en) met ernst hoog: ${hoog
          .map((b) => b.criterium || "onbekend criterium")
          .join(", ")}.`
      );
    }
  }

  if (redenen.length === 0) return { besluit: "goedgekeurd", redenen: [] };

  const alGeprobeerd = oiu && oiu.poort && oiu.poort.herstelPogingGedaan;
  return { besluit: alGeprobeerd ? "afgekeurd" : "herstel", redenen };
}

// Past de kant-en-klare herschrijvingen van de redacteur machinaal toe.
// Raakt uitsluitend tekstblokken; ongeldige indexen worden genegeerd.
function pasHerschrijvingenToe(orb, redactie) {
  if (!redactie || !Array.isArray(redactie.bevindingen)) return orb;
  const blokken = orb.blokken.map((b) => ({ ...b }));
  redactie.bevindingen.forEach((bv) => {
    if (
      typeof bv.vervangTekstBlok === "number" &&
      typeof bv.nieuweTekst === "string" &&
      bv.nieuweTekst.trim() &&
      blokken[bv.vervangTekstBlok] &&
      blokken[bv.vervangTekstBlok].type === "tekst"
    ) {
      blokken[bv.vervangTekstBlok] = { ...blokken[bv.vervangTekstBlok], tekst: bv.nieuweTekst };
    }
  });
  return { ...orb, blokken };
}

// ---------------------------------------------------------------------------
// ROL 6 — DE SAMENHANGSCONTROLEUR
//
// De begrippenvolgorde is puur code; overlap en hiaten zijn een LLM-oordeel
// over een compacte weergave van het hele pad.
// ---------------------------------------------------------------------------
function controleerBegrippenvolgorde(plan, run) {
  const fouten = [];
  const volgorde = topologischeVolgordePlan(plan.topics);

  volgorde.forEach((t) => {
    const bekend = new Set(
      bekendLangsPlan(plan, t.planTopicId, run).map((b) => (b.term || "").toLowerCase())
    );
    t.orbs.forEach((o) => {
      const oiu = run.orbsInUitvoering[o.planOrbId];
      if (!oiu || !oiu.orb) return;
      (oiu.orb.begrippen || []).forEach((b) => {
        const sleutel = (b.term || "").toLowerCase();
        if (sleutel && bekend.has(sleutel)) {
          fouten.push({
            planOrbId: o.planOrbId,
            term: b.term,
            melding: `"${b.term}" wordt opnieuw geïntroduceerd terwijl het eerder in de leerroute al is uitgelegd.`,
          });
        } else if (sleutel) {
          bekend.add(sleutel);
        }
      });
    });
  });
  return fouten;
}

const SAMENHANG = `Je bent samenhangscontroleur van een leerplatform. Je krijgt een compacte
weergave van een volledig leerpad (topics met orbs) plus de kernpunten van de bronnen.
Je toetst het GEHEEL — de losse lessen zijn al apart gecontroleerd.

${LAT}

JE TOETST DRIE DINGEN:
1. OVERLAP: behandelen twee orbs hetzelfde punt zonder dat de tweede echt verdiept?
2. HIAAT: staat er iets wezenlijks in de bronkernpunten dat nergens in het pad landt
   en ook niet in de lijst "bewust niet gebruikt" is verantwoord?
3. VOLGORDE: bouwt een topic echt voort op zijn voorganger, of staat het los?

Maximaal 5 bevindingen: de zwaarste eerst. Niets mis? Lege lijst.

ANTWOORDFORMAAT (uitsluitend JSON, geen backticks):
{"besluit":"goed",
 "bevindingen":[{"soort":"overlap","waar":"orb t1-o2 en t2-o1","wat":"één zin","ernst":"midden"}]}
"besluit" is "goed" of "aandacht". "soort" is "overlap", "hiaat" of "volgorde".
"ernst" is "hoog", "midden" of "laag".`;

async function controleerSamenhang(run) {
  const volgorde = topologischeVolgordePlan(run.plan.topics);

  const pad = volgorde
    .map((t) => {
      const orbs = t.orbs
        .map((o) => {
          const oiu = run.orbsInUitvoering[o.planOrbId];
          if (!oiu || !oiu.orb) return `  orb ${o.planOrbId}: (niet gegenereerd)`;
          const eersteTekst = (oiu.orb.blokken.find((b) => b.type === "tekst") || {}).tekst || "";
          const begrippen = (oiu.orb.begrippen || []).map((b) => b.term).join(", ");
          return `  orb ${o.planOrbId} "${oiu.orb.titel}": ${eersteTekst.slice(0, 140)} | haakje: ${oiu.orb.haakje} | nieuwe begrippen: ${begrippen || "geen"}`;
        })
        .join("\n");
      const eis = t.prerequisites[0] ? ` (na ${t.prerequisites[0]})` : " (stam)";
      return `TOPIC ${t.planTopicId} tier ${t.tier}${eis} "${t.titel}" — ${t.leerdoel}\n${orbs}`;
    })
    .join("\n\n");

  const kernpunten = run.bronkaarten
    .flatMap((k) => k.kernpunten || [])
    .map((p) => `- ${p}`)
    .join("\n");

  const verantwoord = (run.plan.nietGebruikt || [])
    .map((n) => `- ${n.passageId}: ${n.reden}`)
    .join("\n");

  const uit = await vraagMetHerkansing(
    SAMENHANG,
    `HET LEERPAD:
${pad}

KERNPUNTEN VAN DE BRONNEN:
${kernpunten}

BEWUST NIET GEBRUIKT (verantwoord door de planner):
${verantwoord || "(niets)"}`,
    (u) => (u.besluit === "goed" || u.besluit === "aandacht") && Array.isArray(u.bevindingen),
    "De samenhangscontroleur kwam niet tot een oordeel.",
    MODEL_TOKENS_SAMENHANG
  );
  return uit;
}

// ---------------------------------------------------------------------------
// DE ORKESTRATIELUS
//
// Een hervatbare toestandsmachine: na elke afgeronde stap wordt de run
// opgeslagen. Op elk moment opnieuw aanroepbaar — hij pakt de eerste
// onvoltooide stap op en doet voltooide stappen nooit over. Een fout in één
// orb legt de rest niet stil.
// ---------------------------------------------------------------------------
function bronVersiesKloppen(run, domeinBronnen) {
  const versies = Array.isArray(run && run.bronVersies) ? run.bronVersies : [];
  const huidige = Array.isArray(domeinBronnen) ? domeinBronnen : [];

  // Ook een later toegevoegde of verwijderde bron maakt de run ongeldig. De
  // planner moet exact dezelfde bronnenset zien als bij de start.
  if (versies.length !== huidige.length) return false;

  const perId = new Map(huidige.map((bron) => [bron.id, bron]));
  return versies.every((v) => {
    const bron = perId.get(v.bronId);
    return (
      bron &&
      typeof bron.tekst === "string" &&
      bron.tekst.length === v.lengte &&
      checksumVanTekst(bron.tekst) === v.checksum
    );
  });
}

function bepaalHervatFase(run) {
  if (!run) return "bronkaarten";
  const bronAantal = Array.isArray(run.bronVersies) ? run.bronVersies.length : 0;
  if (!Array.isArray(run.bronkaarten) || run.bronkaarten.length < bronAantal) return "bronkaarten";
  if (!run.plan) return "plannen";

  const orbs = Object.values(run.orbsInUitvoering || {});
  if (orbs.length === 0 || !orbs.every((x) => x.status === "goedgekeurd")) {
    return "genereren";
  }
  if (!run.samenhang) return "samenhang";
  return "klaar";
}

function kanRunAutomatischVerder(run) {
  if (!run) return false;
  if (["bronkaarten", "plannen", "samenhang"].includes(run.fase)) return true;
  if (run.fase === "gestrand") return run.foutcode !== "bron-gewijzigd";
  if (run.fase !== "genereren") return false;

  const orbs = Object.values(run.orbsInUitvoering || {});
  if (orbs.length === 0) return true;
  if (orbs.every((x) => x.status === "goedgekeurd")) return true;
  return orbs.some((x) =>
    ["gepland", "gegenereerd", "getoetst", "geredigeerd"].includes(x.status)
  );
}

function nieuweLeerpadRun(domeinId, domeinBronnen) {
  return {
    id: `run-${Date.now()}`,
    domeinId,
    fase: "bronkaarten",
    gemaakt: new Date().toISOString(),
    bijgewerkt: new Date().toISOString(),
    publicatieStatus: "niet-gestart",
    bronVersies: domeinBronnen.map((b) => ({
      bronId: b.id,
      lengte: b.tekst.length,
      checksum: checksumVanTekst(b.tekst),
    })),
    passages: domeinBronnen.flatMap((b) => splitsInPassages(b)),
    bronkaarten: [],
    passagecatalogus: [],
    plan: null,
    orbsInUitvoering: {},
    samenhang: null,
    logboek: [],
  };
}

async function voerLeerpadRunUit(run, context, opVoortgang) {
  const { domeinen, topics, bronnen } = context;
  const r = JSON.parse(JSON.stringify(run));
  const domeinBronnen = bronnen[r.domeinId] || [];
  const domein = domeinen.find((d) => d.id === r.domeinId) || { naam: "algemeen" };

  const zeg = (wat) => {
    if (opVoortgang) opVoortgang(wat);
  };
  const log = (stap, melding) => {
    r.logboek.push({ tijd: new Date().toISOString(), stap, melding });
  };
  const sla = async () => {
    r.bijgewerkt = new Date().toISOString();
    await bewaarRun(r);
  };

  // Een gewijzigde, toegevoegde of verwijderde bron maakt de bestaande run
  // ongeldig. Hierbij heeft opnieuw proberen geen zin: het plan hoort bij de
  // bronnenset zoals die bij de start was.
  if (!bronVersiesKloppen(r, domeinBronnen)) {
    const melding =
      "De bronnenset is gewijzigd sinds de start van de run. Verwijder deze run en start opnieuw.";
    r.hervatFase = null;
    r.foutcode = "bron-gewijzigd";
    r.foutmelding = melding;
    r.fase = "gestrand";
    const laatste = r.logboek[r.logboek.length - 1];
    if (!laatste || laatste.melding !== melding) log("bronnen", melding);
    await sla();
    return r;
  }

  // Een gestrande bronkaart-, planner- of samenhangsstap kan nu echt worden
  // hervat. De oude knop riep de gestrande fase opnieuw aan en deed daardoor
  // voor iedere gestrande run niets.
  if (r.fase === "gestrand") {
    r.fase = r.hervatFase || bepaalHervatFase(r);
    delete r.hervatFase;
    delete r.foutcode;
    delete r.foutmelding;
    log("hervatten", `Run hervat bij fase ${r.fase}.`);
    await sla();
  }

  try {
    // --- FASE: bronkaarten + passagecatalogus ---
    if (r.fase === "bronkaarten") {
      for (const bron of domeinBronnen) {
        if (r.bronkaarten.some((k) => k.bronId === bron.id)) continue; // al gedaan
        zeg(`Bron "${bron.naam}" in kaart brengen…`);
        const passages = r.passages.filter((p) => p.bronId === bron.id);
        const uit = await maakBronkaart(bron, passages, domeinBronnen);
        r.bronkaarten.push(uit.bronkaart);
        r.passagecatalogus.push(...uit.catalogus);
        log("bronkaart", `Bron "${bron.naam}": ${uit.catalogus.length} catalogusitems.`);
        await sla();
      }
      r.fase = "plannen";
      await sla();
    }

    // --- FASE: plannen ---
    if (r.fase === "plannen") {
      if (!r.plan) {
        zeg("Leerpad plannen…");
        const bestaand = topics.filter((t) => t.domeinId === r.domeinId);
        r.plan = await planLeerpad(domein, r.bronkaarten, r.passagecatalogus, bestaand, r.passages);
        log(
          "plan",
          `Plan: ${r.plan.topics.length} topics, ${r.plan.topics.reduce((s, t) => s + t.orbs.length, 0)} orbs.`
        );
      }
      r.plan.topics.forEach((t) =>
        t.orbs.forEach((o) => {
          if (!r.orbsInUitvoering[o.planOrbId]) {
            r.orbsInUitvoering[o.planOrbId] = { status: "gepland" };
          }
        })
      );
      r.fase = "genereren";
      await sla();
    }

    // --- FASE: genereren — per orb de bestaande pijplijn, plus poortwachter ---
    if (r.fase === "genereren") {
      const volgorde = topologischeVolgordePlan(r.plan.topics);

      for (const t of volgorde) {
        // wat kent de lezer bij dit topic al, langs de keten van het plan
        let bekend = bekendLangsPlan(r.plan, t.planTopicId, r);

        for (let i = 0; i < t.orbs.length; i++) {
          const o = t.orbs[i];
          const oiu = r.orbsInUitvoering[o.planOrbId];
          const stof = tekstVanPassages(domeinBronnen, r, o.passageIds);
          const wie = `${t.titel} — orb ${i + 1}/${t.orbs.length}`;

          if (oiu.status === "fout" || oiu.status === "afgekeurd" || oiu.status === "buiten-scope") {
            continue; // blijft liggen voor handmatig herstel of opnieuw proberen
          }

          try {
            if (oiu.status === "gepland") {
              const orb = await maakEenOrb(
                stof,
                domein.naam,
                i + 1,
                t.orbs.length,
                (stap) => zeg(`${wie}: ${stap === "tekst" ? "tekst schrijven" : "vragen schrijven"}…`),
                t.tier,
                bekend,
                o.leerdoel
              );
              // deterministische id's uit het plan: hervatten kan nooit dubbelen
              oiu.orb = {
                ...orb,
                id: `orb-${o.planOrbId}`,
                vragen: orb.vragen.map((v, j) => ({ ...v, id: `orb-${o.planOrbId}-v${j}` })),
              };
              oiu.status = "gegenereerd";
              await sla();
            }

            if (oiu.status === "gegenereerd") {
              zeg(`${wie}: toetsen aan de bronnen…`);
              oiu.bronControle = await toetsAanBronnen(oiu.orb, stof);
              oiu.status = "getoetst";
              await sla();
            }

            if (oiu.status === "getoetst") {
              zeg(`${wie}: redactie…`);
              oiu.redactie = await laatRedigeren(oiu.orb, t.tier, bekend);
              oiu.status = "geredigeerd";
              await sla();
            }

            if (oiu.status === "geredigeerd") {
              let poort = poortwachter(oiu);

              if (poort.besluit === "herstel") {
                zeg(`${wie}: herstelronde…`);
                log("herstel", `${o.planOrbId}: ${poort.redenen.join(" ")}`);

                const bronProbleem =
                  Array.isArray(oiu.bronControle) &&
                  oiu.bronControle.some(
                    (b) => b.oordeel === "tegengesproken" || b.oordeel === "niet_gedekt"
                  );

                if (bronProbleem) {
                  // opnieuw genereren, met de bevindingen als extra instructie
                  const instructies = [
                    ...(oiu.bronControle || [])
                      .filter((b) => b.oordeel !== "gedekt")
                      .map((b) => `- Bewering "${b.bewering}" is ${b.oordeel === "tegengesproken" ? "in strijd met" : "niet gedekt door"} de bron. Laat weg of herformuleer strikt volgens de bron.`),
                    ...((oiu.redactie && oiu.redactie.bevindingen) || [])
                      .filter((b) => b.ernst === "hoog")
                      .map((b) => `- ${b.criterium}: ${b.wat}`),
                  ].join("\n");
                  const orb = await maakEenOrb(
                    stof,
                    domein.naam,
                    i + 1,
                    t.orbs.length,
                    (stap) => zeg(`${wie}: herschrijven (${stap})…`),
                    t.tier,
                    bekend,
                    `${o.leerdoel}\nHERSTEL DEZE PUNTEN UIT EEN EERDERE POGING:\n${instructies}`
                  );
                  oiu.orb = {
                    ...orb,
                    id: `orb-${o.planOrbId}`,
                    vragen: orb.vragen.map((v, j) => ({ ...v, id: `orb-${o.planOrbId}-v${j}` })),
                  };
                } else {
                  // alleen taal/vorm: de herschrijvingen van de redacteur volstaan
                  oiu.orb = pasHerschrijvingenToe(oiu.orb, oiu.redactie);
                }

                zeg(`${wie}: hertoetsen…`);
                oiu.bronControle = await toetsAanBronnen(oiu.orb, stof);
                zeg(`${wie}: herredactie…`);
                oiu.redactie = await laatRedigeren(oiu.orb, t.tier, bekend);
                oiu.poort = { ...(oiu.poort || {}), herstelPogingGedaan: true };
                await sla();
                poort = poortwachter(oiu);
              }

              oiu.poort = { ...(oiu.poort || {}), besluit: poort.besluit, redenen: poort.redenen };
              oiu.status = poort.besluit; // goedgekeurd, afgekeurd of buiten-scope
              delete oiu.hervatStatus;
              delete oiu.foutmelding;
              log("poort", `${o.planOrbId}: ${poort.besluit}${poort.redenen.length ? ` (${poort.redenen.join(" ")})` : ""}`);
              await sla();
            }
          } catch (e) {
            if (e instanceof BuitenScope) {
              oiu.status = "buiten-scope";
              oiu.foutmelding = e.message;
              log("scope", `${o.planOrbId} buiten scope: ${e.message}`);
            } else {
              // Bewaar de laatste geldige stap. Een tijdelijke fout bij toetsen of
              // redigeren hoeft daardoor niet de al geschreven orb weg te gooien.
              oiu.hervatStatus = oiu.status;
              oiu.status = "fout";
              oiu.foutmelding = e.message || "Onbekende fout.";
              log("fout", `${o.planOrbId}: ${oiu.foutmelding}`);
            }
            await sla();
            continue; // de lus gaat door met de rest
          }

          if (oiu.status === "goedgekeurd" && oiu.orb) {
            bekend = [...bekend, ...(oiu.orb.begrippen || [])];
          }
        }
      }

      const alles = Object.values(r.orbsInUitvoering);
      if (alles.every((x) => x.status === "goedgekeurd")) {
        r.fase = "samenhang";
      }
      await sla();
    }

    // --- FASE: samenhang over het hele pad ---
    if (r.fase === "samenhang") {
      zeg("Samenhang van het hele pad controleren…");
      const begrippenfouten = controleerBegrippenvolgorde(r.plan, r);
      const uit = await controleerSamenhang(r);
      r.samenhang = { begrippenfouten, bevindingen: uit.bevindingen, besluit: uit.besluit };
      r.fase = "klaar";
      delete r.hervatFase;
      delete r.foutcode;
      delete r.foutmelding;
      log("samenhang", `Besluit: ${uit.besluit}, ${begrippenfouten.length} begrippenfout(en).`);
      await sla();
    }
  } catch (e) {
    // Fout buiten één orb: bewaar exact welke fase moet worden hervat. Bronkaart,
    // planner en samenhang hoeven daardoor na een tijdelijke fout niet opnieuw.
    r.hervatFase = r.fase;
    r.foutcode = e instanceof ModelAanroepFout ? "model" : "workflow";
    r.foutmelding = e.message || "Onbekende fout.";
    r.fase = "gestrand";
    log("fout", r.foutmelding);
    await sla();
  }

  return r;
}

// ---------------------------------------------------------------------------
// DE PUBLICATIEPOORT + TRANSACTIE
//
// De enige weg waarlangs een leerpad in SLEUTEL komt. Eerst de harde poort
// (puur code), dan het auditarchief, dan precies één slaOp met alle topics.
// Idempotent op leerpadId: hervatten na een fout kan nooit dubbelen.
// ---------------------------------------------------------------------------
function publicatiePoort(run) {
  const blokkades = [];
  if (!run || !run.plan) return ["Er is geen afgeronde run."];
  if (run.fase !== "klaar") blokkades.push(`De run is nog niet klaar (fase: ${run.fase}).`);

  run.plan.topics.forEach((t) =>
    t.orbs.forEach((o) => {
      const oiu = run.orbsInUitvoering[o.planOrbId];
      const naam = `${t.titel} / ${o.titel}`;
      if (!oiu || oiu.status !== "goedgekeurd") {
        blokkades.push(`Orb "${naam}" is niet goedgekeurd (${oiu ? oiu.status : "ontbreekt"}).`);
        return;
      }

      // Handmatige goedkeuring is een geldige menselijke grondslag. Zonder die
      // grondslag moeten zowel waarheidstoets als eindredactie volledig aanwezig zijn.
      const handmatig = !!(oiu.handmatig && oiu.handmatig.reden);
      if (!handmatig && (!Array.isArray(oiu.bronControle) || oiu.bronControle.length === 0)) {
        blokkades.push(`Orb "${naam}" heeft geen bewaarde waarheidstoets.`);
      }
      if (!handmatig && (!oiu.redactie || !Array.isArray(oiu.redactie.bevindingen))) {
        blokkades.push(`Orb "${naam}" heeft geen bewaarde redactie-uitslag.`);
      }

      orbStructuurFouten(oiu.orb).forEach((fout) =>
        blokkades.push(`Orb "${naam}": ${fout}`)
      );

      (o.passageIds || []).forEach((pid) => {
        const p = (run.passages || []).find((x) => x.id === pid);
        const v = p && (run.bronVersies || []).find((b) => b.bronId === p.bronId);
        if (!v || !v.checksum) blokkades.push(`Orb "${naam}" mist een bronchecksum voor ${pid}.`);
      });
    })
  );

  if (
    run.samenhang &&
    Array.isArray(run.samenhang.begrippenfouten) &&
    run.samenhang.begrippenfouten.length > 0
  ) {
    blokkades.push(
      `${run.samenhang.begrippenfouten.length} begrippenvolgorde-fout(en) — zie samenhang.`
    );
  }
  if (!run.samenhang) blokkades.push("De samenhangscontrole is nog niet gedraaid.");

  return blokkades;
}

async function publiceerLeerpad(run, context, opOpslaan) {
  const { domeinen, topics, bronnen } = context;

  const blokkades = publicatiePoort(run);
  if (blokkades.length > 0) return { gelukt: false, blokkades };

  const r = JSON.parse(JSON.stringify(run));
  const mislukt = (melding) => ({ gelukt: false, blokkades: [melding], run: r });

  // Stap 1: eerst het volledige auditdossier archiveren. Ga alleen door als
  // zowel het archief als de hervatbare run aantoonbaar zijn opgeslagen.
  if (r.publicatieStatus === "niet-gestart") {
    if (!(await archiveerRun(r, "klaar-voor-publicatie"))) {
      return mislukt("Het auditdossier kon niet worden opgeslagen. Er is niets gepubliceerd.");
    }
    r.publicatieStatus = "audit-gearchiveerd";
    if (!(await bewaarRun(r))) {
      return mislukt("De publicatiestand kon niet worden opgeslagen. Probeer publiceren opnieuw.");
    }
  }

  // Stap 2: alle topics volledig in het geheugen bouwen, dan één keer opslaan.
  // Topics met hetzelfde leerpadId+id worden overgeslagen (idempotent).
  if (r.publicatieStatus === "audit-gearchiveerd") {
    const volgorde = topologischeVolgordePlan(r.plan.topics);
    const nieuweTopics = [...topics];
    const idVan = {};
    const nu = new Date().toISOString();

    volgorde.forEach((pt) => {
      const topicId = `topic-${r.id}-${pt.planTopicId}`;
      idVan[pt.planTopicId] = topicId;
      if (nieuweTopics.some((t) => t.id === topicId)) return; // al gepubliceerd bij eerdere poging

      const voorgangerId =
        pt.prerequisites[0] !== undefined ? idVan[pt.prerequisites[0]] : null;
      const plaatsing = berekenPlaatsing(nieuweTopics, r.domeinId, voorgangerId);

      const orbs = pt.orbs.map((o) => {
        const oiu = r.orbsInUitvoering[o.planOrbId];
        const {
          bronControle: _bronControle,
          redactie: _redactie,
          poort: _poort,
          handmatig: _handmatig,
          ...schoon
        } = oiu.orb;

        const handmatig = !!(oiu.handmatig && oiu.handmatig.reden);
        return {
          ...schoon,
          bronVerwijzingen: o.passageIds.map((pid) => {
            const p = r.passages.find((x) => x.id === pid);
            const v = p && r.bronVersies.find((b) => b.bronId === p.bronId);
            return { bronId: p.bronId, bronChecksum: v.checksum, passageId: pid };
          }),
          publicatieAudit: {
            gecontroleerdOp: nu,
            // Eerlijk spoor: wie was de grondslag. Dit veld wordt nergens aan
            // de leerkant getoond — het is uitsluitend verantwoording.
            bronStatus: handmatig ? "handmatig" : "gedekt",
            redactieStatus: handmatig
              ? "handmatig"
              : (oiu.redactie && oiu.redactie.oordeel) || "onbekend",
            herstelPogingen: oiu.poort && oiu.poort.herstelPogingGedaan ? 1 : 0,
            archiefRunId: r.id,
          },
        };
      });

      nieuweTopics.push({
        id: topicId,
        domeinId: r.domeinId,
        prerequisites: plaatsing.prerequisites,
        gridPos: plaatsing.gridPos,
        titel: pt.titel,
        ondertitel: pt.ondertitel || "Gegenereerd leerpad",
        leerpadId: r.id,
        orbs,
      });
    });

    const contentOpgeslagen = await opOpslaan({ domeinen, topics: nieuweTopics, bronnen });
    if (contentOpgeslagen === false) {
      return mislukt("De lesinhoud kon niet duurzaam worden opgeslagen. Probeer publiceren opnieuw.");
    }

    r.publicatieStatus = "content-opgeslagen";
    if (!(await bewaarRun(r))) {
      return mislukt(
        "De inhoud is aangeboden voor opslag, maar de publicatiestand kon niet worden bewaard. Probeer opnieuw; dubbele topics worden voorkomen."
      );
    }
  }

  // Stap 3: archief op gepubliceerd, dan pas de actieve run leegmaken.
  if (r.publicatieStatus === "content-opgeslagen") {
    const afgerond = {
      ...r,
      publicatieStatus: "afgerond",
      fase: "gepubliceerd",
    };
    if (!(await archiveerRun(afgerond, "gepubliceerd"))) {
      return mislukt("De definitieve publicatie kon niet in het auditarchief worden vastgelegd.");
    }
    if (!(await bewaarRun(null))) {
      return mislukt(
        "Het leerpad is opgeslagen, maar de actieve run kon niet worden leeggemaakt. Probeer publiceren nogmaals om dit af te ronden."
      );
    }
    r.publicatieStatus = "afgerond";
    r.fase = "gepubliceerd";
  }

  return { gelukt: true, aantalTopics: r.plan.topics.length };
}

// ============================================================================
// TECH TREE — ontgrendel-logica
//
// Een topic is beschikbaar zodra al zijn prerequisites VOLLEDIG zijn afgerond.
// Volledig = het aantal afgeronde orbs is exact gelijk aan het totaal aantal
// orbs in dat prerequisite-topic. Een lege prerequisites-array betekent: dit is
// de stam, altijd toegankelijk.
//
// gridPos ({ tier, track }) is de wiskundige basis voor de latere RPG-boom:
// tier = verticale groei in het leertraject, track = de horizontale tak.
// ============================================================================

// Berekent waar een nieuw onderwerp in de boom komt, op basis van de gekozen
// voorganger. De maker denkt in leerlogica ("dit komt na eiwit"); het systeem
// leidt de coördinaten af. Geen voorganger = een nieuwe stam.
function berekenPlaatsing(topics, domeinId, voorgangerId) {
  // Welke tracks zijn al bezet op een bepaald tier in dit domein?
  function eersteVrijeTrack(tier) {
    const bezet = new Set(
      topics
        .filter((t) => t.domeinId === domeinId && (t.gridPos ? t.gridPos.tier : 1) === tier)
        .map((t) => (t.gridPos ? t.gridPos.track : 0))
    );
    let track = 1;
    while (bezet.has(track)) track++;
    return track;
  }

  if (!voorgangerId) {
    // nieuwe stam: tier 1, eerste vrije track
    return { prerequisites: [], gridPos: { tier: 1, track: eersteVrijeTrack(1) } };
  }

  const voorganger = topics.find((t) => t.id === voorgangerId);
  const vTier = voorganger && voorganger.gridPos ? voorganger.gridPos.tier : 1;
  const doelTier = Math.min(vTier + 1, 3);

  return {
    prerequisites: [voorgangerId],
    gridPos: { tier: doelTier, track: eersteVrijeTrack(doelTier) },
  };
}

function isTopicUnlocked(topic, topics, voortgang) {
  const eisen = topic.prerequisites || [];
  if (eisen.length === 0) return true; // stam

  return eisen.every((eisId) => {
    const vereist = topics.find((t) => t.id === eisId);
    if (!vereist) return false; // prerequisite bestaat niet (meer) -> niet ontgrendeld
    const totaal = vereist.orbs.length;
    if (totaal === 0) return false; // een leeg topic kun je niet afronden
    const afgerond = voortgang[eisId] || 0;
    return afgerond === totaal; // exact gelijk, zoals gespecificeerd
  });
}

// ============================================================================
// BEGRIPPEN — de leerlijn
//
// Elke orb legt vast welke vakwoorden hij introduceert. Wat eerder in dit
// domein is uitgelegd, mag later als bekend worden verondersteld. Jargon dat
// nergens is geïntroduceerd, keurt de redacteur af.
// ============================================================================

function topicTier(topic) {
  return (topic.gridPos && topic.gridPos.tier) || 1;
}

// Alle onderwerpen die vóór dit onderwerp komen in de boom: de prerequisite-keten,
// helemaal terug tot de stam. Dit bepaalt welke begrippen de lezer al kent.
function voorgangers(topic, topics, gezien = new Set()) {
  const keten = [];
  (topic.prerequisites || []).forEach((eisId) => {
    if (gezien.has(eisId)) return;
    gezien.add(eisId);
    const vorige = topics.find((t) => t.id === eisId);
    if (vorige) {
      keten.push(vorige, ...voorgangers(vorige, topics, gezien));
    }
  });
  return keten;
}

// Welke begrippen kent de lezer als hij aan dit onderwerp begint?
// Alles wat is geïntroduceerd in de onderwerpen die er in de boom aan voorafgaan.
function bekendeBegrippen(topics, topic) {
  const lijst = [];
  const gezien = new Set();

  // van stam naar dit onderwerp toe, zodat de volgorde klopt
  const keten = voorgangers(topic, topics).reverse();
  keten.forEach((t) => {
    t.orbs.forEach((orb) => {
      (orb.begrippen || []).forEach((b) => {
        const sleutel = (b.term || "").toLowerCase();
        if (sleutel && !gezien.has(sleutel)) {
          gezien.add(sleutel);
          lijst.push(b);
        }
      });
    });
  });

  return lijst;
}

// ============================================================================
// VISUELE TOKENS — huisstijl Schouten Techniek + ondersteunende interfacekleuren
//
// Officiële merkkleuren volgens de huisstijlgids. Rood en blauw zeer
// terughoudend gebruiken; de hoofdinterface is oranje, donker, wit en warm
// neutraal. De ondersteunende kleuren zijn interfacekleuren, geen merkkleuren.
// Geen designsysteem — alleen deze ene kleine verzameling.
// ============================================================================
const ST = {
  oranje: "#F6A923",
  donker: "#1D1D1D",
  blauw: "#0098D4",
  rood: "#E32118",
  zilver: "#B1B2B4",
};

const UI = {
  achtergrond: "#FBF8F2",
  kaart: "#FFFFFF",
  kaartZacht: "#FFFCF7",
  randZacht: "#E9DED0",
  tekstSecundair: "#667085",
  padNeutraal: "#D8CDBF",
  succes: "#2E7D4F",
  succesZacht: "#E8F4EC",
  succesRand: "#9CCBAD",
};

// Als CSS-variabelen + globale typografie, één keer geïnjecteerd in de app-root.
const APP_STIJL = `
  :root {
    --st-oranje: ${ST.oranje};
    --st-donker: ${ST.donker};
    --st-blauw: ${ST.blauw};
    --st-rood: ${ST.rood};
    --st-zilver: ${ST.zilver};
    --app-achtergrond: ${UI.achtergrond};
    --kaart: ${UI.kaart};
    --kaart-zacht: ${UI.kaartZacht};
    --rand-zacht: ${UI.randZacht};
    --tekst-secundair: ${UI.tekstSecundair};
    --pad-neutraal: ${UI.padNeutraal};
    --succes: ${UI.succes};
  }
`;

// De studieondersteuning: nieuwe vakwoorden staan altijd zichtbaar naast de tekst,
// zodat een woord nooit onverklaard voorbijkomt.
function Begrippenkaart({ begrippen, kleur }) {
  if (!begrippen || begrippen.length === 0) return null;

  return (
    <div
      className="border rounded-lg p-4 bg-white"
      style={{ borderColor: kleur }}
    >
      <p className="text-xs uppercase tracking-wide font-semibold mb-2" style={{ color: kleur }}>
        Nieuwe woorden in deze les
      </p>
      <dl className="space-y-2">
        {begrippen.map((b, i) => (
          <div key={i}>
            <dt className="text-sm font-semibold text-gray-900">{b.term}</dt>
            <dd className="text-sm text-gray-600">{b.uitleg}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ============================================================================
// BLOKKEN RENDEREN
// ============================================================================

function TekstBlok({ blok }) {
  return <p className="text-gray-900 leading-relaxed">{blok.tekst}</p>;
}

function OnvolledigBlok({ wat }) {
  return (
    <p className="text-sm text-gray-400 border border-dashed border-gray-300 rounded-lg p-3">
      Dit {wat} is onvolledig en wordt overgeslagen.
    </p>
  );
}

function VergelijkingBlok({ blok, kleur }) {
  if (!Array.isArray(blok.items) || blok.items.length === 0) {
    return <OnvolledigBlok wat="grafiekblok" />;
  }
  const max = Math.max(...blok.items.map((i) => i.waarde || 0)) || 1;
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <p className="text-sm font-semibold text-gray-900">{blok.titel}</p>
      <div className="mt-3 space-y-2">
        {blok.items.map((item, i) => (
          <div key={i}>
            <div className="flex justify-between text-xs text-gray-600 mb-0.5">
              <span>{item.label}</span>
              <span className="font-semibold text-gray-900">
                {item.waarde} {blok.eenheid}
              </span>
            </div>
            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(item.waarde / max) * 100}%`,
                  backgroundColor: kleur,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      {blok.toelichting && (
        <p className="text-xs text-gray-500 mt-3 italic">{blok.toelichting}</p>
      )}
    </div>
  );
}

function TijdlijnBlok({ blok, kleur }) {
  if (!Array.isArray(blok.punten) || blok.punten.length === 0) {
    return <OnvolledigBlok wat="tijdlijnblok" />;
  }
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <p className="text-sm font-semibold text-gray-900 mb-3">{blok.titel}</p>
      <div className="space-y-3">
        {blok.punten.map((punt, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center shrink-0">
              <span
                className="w-2.5 h-2.5 rounded-full mt-1.5"
                style={{ backgroundColor: kleur }}
              />
              {i < blok.punten.length - 1 && (
                <span className="w-px flex-1 bg-gray-300 mt-1" />
              )}
            </div>
            <div className="pb-1">
              <p className="text-sm font-semibold text-gray-900">{punt.label}</p>
              <p className="text-sm text-gray-600">{punt.beschrijving}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Verhouding: hoe iets zich verdeelt. Denk bordverdeling, tijdsbesteding. ---
function VerhoudingBlok({ blok, kleur }) {
  if (!Array.isArray(blok.delen) || blok.delen.length === 0) {
    return <OnvolledigBlok wat="verhoudingsblok" />;
  }
  const som = blok.delen.reduce((s, d) => s + (d.deel || 0), 0) || 1;
  const tinten = [1, 0.72, 0.5, 0.34, 0.22];

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <p className="text-sm font-semibold text-gray-900 mb-3">{blok.titel}</p>

      <div className="flex h-8 w-full rounded-md overflow-hidden">
        {blok.delen.map((d, i) => (
          <div
            key={i}
            className="h-full"
            style={{
              width: `${((d.deel || 0) / som) * 100}%`,
              backgroundColor: kleur,
              opacity: tinten[i % tinten.length],
            }}
          />
        ))}
      </div>

      <div className="mt-3 space-y-1.5">
        {blok.delen.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: kleur, opacity: tinten[i % tinten.length] }}
            />
            <span className="text-gray-700 flex-1">{d.label}</span>
            <span className="font-semibold text-gray-900">
              {Math.round(((d.deel || 0) / som) * 100)}%
            </span>
          </div>
        ))}
      </div>

      {blok.toelichting && (
        <p className="text-xs text-gray-500 mt-3 italic">{blok.toelichting}</p>
      )}
    </div>
  );
}

// --- Stappen: een handeling in volgorde. Sterk voor BHV en werkinstructies. ---
function StappenBlok({ blok, kleur }) {
  if (!Array.isArray(blok.stappen) || blok.stappen.length === 0) {
    return <OnvolledigBlok wat="stappenblok" />;
  }
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <p className="text-sm font-semibold text-gray-900 mb-3">{blok.titel}</p>
      <div className="space-y-2">
        {blok.stappen.map((stap, i) => (
          <div key={i} className="flex gap-3 items-start">
            <span
              className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: kleur }}
            >
              {i + 1}
            </span>
            <div className="pt-0.5">
              <p className="text-sm font-semibold text-gray-900">{stap.label}</p>
              {stap.beschrijving && (
                <p className="text-sm text-gray-600">{stap.beschrijving}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Mythe vs. wat klopt: de "X > Y"-vorm. Zet een hype naast de nuance. ---
function MytheBlok({ blok }) {
  if (!blok.mythe || !blok.klopt) return <OnvolledigBlok wat="mytheblok" />;
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      <div className="border border-red-200 bg-red-50 rounded-lg p-4">
        <p className="text-xs uppercase tracking-wide text-red-500 font-semibold mb-1">
          Wat je vaak hoort
        </p>
        <p className="text-sm text-gray-900 leading-relaxed">{blok.mythe}</p>
      </div>
      <div className="border border-green-200 bg-green-50 rounded-lg p-4">
        <p className="text-xs uppercase tracking-wide text-green-700 font-semibold mb-1">
          Wat er klopt
        </p>
        <p className="text-sm text-gray-900 leading-relaxed">{blok.klopt}</p>
      </div>
    </div>
  );
}

// --- Pictogram: "1 op de 3". Maakt een verhouding meteen invoelbaar. ---
function PictogramBlok({ blok, kleur }) {
  const totaal = blok.totaal || 0;
  const geraakt = blok.geraakt || 0;
  if (totaal < 2 || geraakt < 0 || geraakt > totaal) {
    return <OnvolledigBlok wat="pictogramblok" />;
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <p className="text-sm font-semibold text-gray-900 mb-3">{blok.titel}</p>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: totaal }).map((_, i) => (
          <svg key={i} width="18" height="26" viewBox="0 0 18 26" aria-hidden="true">
            <circle
              cx="9"
              cy="5"
              r="4"
              fill={i < geraakt ? kleur : "#D5D3CC"}
            />
            <path
              d="M9 10c-3.3 0-5 2-5 5v8h10v-8c0-3-1.7-5-5-5z"
              fill={i < geraakt ? kleur : "#D5D3CC"}
            />
          </svg>
        ))}
      </div>
      <p className="text-sm text-gray-700 mt-3">
        <span className="font-bold text-gray-900">
          {geraakt} van de {totaal}
        </span>{" "}
        {blok.bijschrift}
      </p>
    </div>
  );
}

function AfbeeldingBlok({ blok }) {
  return (
    <figure className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
      {blok.url ? (
        <img src={blok.url} alt={blok.alt || ""} className="w-full block" />
      ) : (
        <div className="h-32 flex items-center justify-center text-sm text-gray-400">
          Nog geen afbeelding gekoppeld
        </div>
      )}
      {blok.bijschrift && (
        <figcaption className="text-xs text-gray-500 px-4 py-2 border-t border-gray-200">
          {blok.bijschrift}
        </figcaption>
      )}
    </figure>
  );
}

function Blok({ blok, kleur }) {
  if (blok.type === "vergelijking") return <VergelijkingBlok blok={blok} kleur={kleur} />;
  if (blok.type === "tijdlijn") return <TijdlijnBlok blok={blok} kleur={kleur} />;
  if (blok.type === "verhouding") return <VerhoudingBlok blok={blok} kleur={kleur} />;
  if (blok.type === "stappen") return <StappenBlok blok={blok} kleur={kleur} />;
  if (blok.type === "mythe") return <MytheBlok blok={blok} />;
  if (blok.type === "pictogram") return <PictogramBlok blok={blok} kleur={kleur} />;
  if (blok.type === "afbeelding") return <AfbeeldingBlok blok={blok} />;
  return <TekstBlok blok={blok} />;
}

// ============================================================================
// VRAAGTYPES
// Elk vraagtype meldt via opAntwoord(juist) of het goed was.
// De les-flow blokkeert doorgang tot het juist is — ongeacht het type.
// ============================================================================

function MeerkeuzeVraag({ vraag, gekozen, setGekozen, opAntwoord }) {
  return (
    <div className="space-y-2">
      {vraag.opties.map((optie, i) => {
        const isGekozen = gekozen === i;
        const isJuist = i === vraag.juisteIndex;

        let stijl = "border-gray-300 bg-white hover:border-gray-900";
        if (gekozen !== null) {
          if (isJuist) stijl = "border-green-600 bg-green-50";
          else if (isGekozen) stijl = "border-red-500 bg-red-50";
          else stijl = "border-gray-200 bg-white opacity-50";
        }

        return (
          <button
            key={i}
            disabled={gekozen !== null}
            onClick={() => {
              setGekozen(i);
              opAntwoord(i === vraag.juisteIndex);
            }}
            className={`w-full text-left border rounded-lg px-4 py-3 text-sm transition ${stijl}`}
          >
            {optie}
          </button>
        );
      })}
    </div>
  );
}

// Een sorteervraag begint altijd door elkaar. De Fisher-Yates-husseling kan
// toevallig de juiste volgorde opleveren; in dat geval wisselen we de eerste
// twee items om. Zo hoeft de gebruiker altijd daadwerkelijk te sorteren.
function maakStartvolgorde(vraag) {
  const volgorde = vraag.items.map((_, i) => i);

  for (let i = volgorde.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [volgorde[i], volgorde[j]] = [volgorde[j], volgorde[i]];
  }

  const alJuist = volgorde.every((v, i) => v === vraag.juisteVolgorde[i]);
  if (alJuist && volgorde.length > 1) {
    [volgorde[0], volgorde[1]] = [volgorde[1], volgorde[0]];
  }

  return volgorde;
}

function SorteerVraag({ vraag, gekozen, setGekozen, opAntwoord }) {
  // volgorde = lijst met item-indexen zoals de gebruiker ze heeft neergezet
  const [volgorde, setVolgorde] = useState(() => maakStartvolgorde(vraag));
  const beantwoord = gekozen !== null;

  function verplaats(pos, richting) {
    const nieuw = [...volgorde];
    const doel = pos + richting;
    if (doel < 0 || doel >= nieuw.length) return;
    [nieuw[pos], nieuw[doel]] = [nieuw[doel], nieuw[pos]];
    setVolgorde(nieuw);
  }

  function controleer() {
    const juist = volgorde.every((v, i) => v === vraag.juisteVolgorde[i]);
    setGekozen(juist ? "juist" : "fout");
    opAntwoord(juist);
  }

  return (
    <div>
      <div className="space-y-2">
        {volgorde.map((itemIndex, pos) => {
          const opJuistePlek = itemIndex === vraag.juisteVolgorde[pos];
          let stijl = "border-gray-300 bg-white";
          if (beantwoord) {
            stijl = opJuistePlek
              ? "border-green-600 bg-green-50"
              : "border-red-500 bg-red-50";
          }

          return (
            <div
              key={itemIndex}
              className={`flex items-center gap-2 border rounded-lg px-3 py-2.5 ${stijl}`}
            >
              <span className="text-xs text-gray-400 w-4 shrink-0">{pos + 1}</span>
              <span className="text-sm text-gray-900 flex-1">
                {vraag.items[itemIndex]}
              </span>
              {!beantwoord && (
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => verplaats(pos, -1)}
                    disabled={pos === 0}
                    aria-label="Omhoog"
                    className="w-7 h-7 text-sm rounded border border-gray-300 text-gray-600 hover:border-gray-900 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => verplaats(pos, 1)}
                    disabled={pos === volgorde.length - 1}
                    aria-label="Omlaag"
                    className="w-7 h-7 text-sm rounded border border-gray-300 text-gray-600 hover:border-gray-900 disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!beantwoord && (
        <button
          onClick={controleer}
          className="mt-3 w-full text-sm font-semibold px-4 py-2.5 rounded-md border border-gray-900 text-gray-900 hover:bg-gray-100"
        >
          Controleer volgorde
        </button>
      )}
    </div>
  );
}

function MatchVraag({ vraag, gekozen, setGekozen, opAntwoord }) {
  const [koppels, setKoppels] = useState({}); // linksIndex -> rechtsIndex
  const [actiefLinks, setActiefLinks] = useState(null);
  const beantwoord = gekozen !== null;

  // rechterkolom door elkaar, maar stabiel binnen deze vraag
  const [rechtsVolgorde] = useState(() => {
    const idx = vraag.paren.map((_, i) => i);
    return idx.slice().reverse(); // simpele deterministische husseling
  });

  function kiesRechts(rechtsIndex) {
    if (actiefLinks === null || beantwoord) return;
    const nieuw = { ...koppels };
    // een rechts-item kan maar aan één links-item hangen
    Object.keys(nieuw).forEach((k) => {
      if (nieuw[k] === rechtsIndex) delete nieuw[k];
    });
    nieuw[actiefLinks] = rechtsIndex;
    setKoppels(nieuw);
    setActiefLinks(null);
  }

  const allesGekoppeld = Object.keys(koppels).length === vraag.paren.length;

  function controleer() {
    const juist = vraag.paren.every((_, i) => koppels[i] === i);
    setGekozen(juist ? "juist" : "fout");
    opAntwoord(juist);
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {vraag.paren.map((paar, i) => {
            const gekoppeldAan = koppels[i];
            const isActief = actiefLinks === i;
            const isJuist = gekoppeldAan === i;

            let stijl = "border-gray-300 bg-white hover:border-gray-900";
            if (beantwoord) {
              stijl = isJuist ? "border-green-600 bg-green-50" : "border-red-500 bg-red-50";
            } else if (isActief) {
              stijl = "border-gray-900 bg-gray-100";
            } else if (gekoppeldAan !== undefined) {
              stijl = "border-gray-900 bg-white";
            }

            return (
              <button
                key={i}
                disabled={beantwoord}
                onClick={() => setActiefLinks(isActief ? null : i)}
                className={`w-full text-left border rounded-lg px-3 py-2.5 text-sm transition ${stijl}`}
              >
                <span className="text-gray-900">{paar.links}</span>
                {gekoppeldAan !== undefined && (
                  <span className="block text-xs text-gray-500 mt-0.5">
                    → {vraag.paren[gekoppeldAan].rechts}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          {rechtsVolgorde.map((rechtsIndex) => {
            const alGebruikt = Object.values(koppels).includes(rechtsIndex);
            let stijl = "border-gray-300 bg-white hover:border-gray-900";
            if (beantwoord) stijl = "border-gray-200 bg-gray-50 opacity-60";
            else if (alGebruikt) stijl = "border-gray-200 bg-gray-100 opacity-50";
            else if (actiefLinks !== null) stijl = "border-gray-900 bg-white";

            return (
              <button
                key={rechtsIndex}
                disabled={beantwoord || actiefLinks === null}
                onClick={() => kiesRechts(rechtsIndex)}
                className={`w-full text-left border rounded-lg px-3 py-2.5 text-sm transition ${stijl}`}
              >
                {vraag.paren[rechtsIndex].rechts}
              </button>
            );
          })}
        </div>
      </div>

      {!beantwoord && (
        <>
          <p className="text-xs text-gray-400 mt-3">
            {actiefLinks === null
              ? "Klik links op een item, daarna rechts op de match."
              : "Kies nu rechts de bijbehorende waarde."}
          </p>
          <button
            onClick={controleer}
            disabled={!allesGekoppeld}
            className={`mt-2 w-full text-sm font-semibold px-4 py-2.5 rounded-md border ${
              allesGekoppeld
                ? "border-gray-900 text-gray-900 hover:bg-gray-100"
                : "border-gray-200 text-gray-300 cursor-not-allowed"
            }`}
          >
            Controleer koppelingen
          </button>
        </>
      )}
    </div>
  );
}

function Vraag({ vraag, gekozen, setGekozen, opAntwoord }) {
  const props = { vraag, gekozen, setGekozen, opAntwoord };
  if (vraag.type === "sorteren") return <SorteerVraag key={vraag.id} {...props} />;
  if (vraag.type === "matchen") return <MatchVraag key={vraag.id} {...props} />;
  return <MeerkeuzeVraag {...props} />;
}

// ============================================================================
// SCHERMEN
// ============================================================================

// ============================================================================
// DE HERHAALSESSIE
// Vragen uit lessen die je eerder deed, dwars door alle onderwerpen heen.
// Dit is het onderdeel dat het verschil maakt tussen een quizapp en iets waar
// je collega's over een half jaar nog uit kunnen putten.
// ============================================================================

function Herhaalsessie({ due, domeinen, opAntwoord, opKlaar, opNaarLes }) {
  // De wachtrij wordt bij de start bevroren. Antwoorden veranderen de actuele
  // Leitner-status, maar mogen de lopende sessie niet onder de gebruiker vandaan
  // herschikken of inkorten.
  const [sessieVragen] = useState(() => (Array.isArray(due) ? [...due] : []));
  const [index, setIndex] = useState(0);
  const [gekozen, setGekozen] = useState(null);
  const [juist, setJuist] = useState(false);
  const [score, setScore] = useState({ goed: 0, fout: 0 });

  const huidig = sessieVragen[index];

  if (!huidig) {
    return (
      <div>
        <div className="bg-white border border-gray-300 rounded-lg p-6 text-center">
          <p className="text-lg font-semibold text-gray-900">Herhaling afgerond</p>
          <p className="text-sm text-gray-600 mt-1">
            {score.goed} goed, {score.fout} fout.
            {score.fout > 0 &&
              " Wat je fout had komt morgen terug."}
          </p>
          <button
            onClick={opKlaar}
            className="mt-6 w-full text-sm font-semibold px-4 py-3 rounded-md bg-gray-900 text-white hover:bg-gray-700"
          >
            Terug naar overzicht
          </button>
        </div>
      </div>
    );
  }

  const domein = domeinen.find((d) => d.id === huidig.topic.domeinId) || { kleur: "#888880", naam: "" };
  const doos = DOZEN.find((d) => d.doos === huidig.doos) || DOZEN[0];

  function antwoord(isJuist) {
    setJuist(isJuist);
    setScore((s) => ({
      goed: s.goed + (isJuist ? 1 : 0),
      fout: s.fout + (isJuist ? 0 : 1),
    }));
    opAntwoord(huidig.vraag.id, isJuist);
  }

  function verder() {
    setIndex(index + 1);
    setGekozen(null);
    setJuist(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <span
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: domein.kleur }}
          >
            {domein.naam} · {huidig.topic.titel}
          </span>
          <h1 className="text-xl font-bold text-gray-900">Herhalen</h1>
        </div>
        <button onClick={opKlaar} className="text-sm text-gray-400 hover:text-gray-900 shrink-0">
          Stoppen
        </button>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
        <span>
          Vraag {index + 1} van {sessieVragen.length}
        </span>
        <span>
          Zat in doos {huidig.doos} · {doos.naam}
        </span>
      </div>

      <div className="bg-white border border-gray-300 rounded-lg p-6">
        <p className="text-lg font-semibold text-gray-900 mb-4">{huidig.vraag.vraag}</p>

        <Vraag
          key={`${huidig.vraag.id}-${index}`}
          vraag={huidig.vraag}
          gekozen={gekozen}
          setGekozen={setGekozen}
          opAntwoord={antwoord}
        />

        {gekozen !== null && (
          <div className="mt-4">
            <p className={`text-sm font-semibold ${juist ? "text-green-700" : "text-red-600"}`}>
              {juist ? "Goed — schuift een doos op" : "Niet juist — terug naar doos 1"}
            </p>
            <p className="text-sm text-gray-600 mt-1">{huidig.vraag.uitleg}</p>
            {!juist && opNaarLes && (
              <button
                onClick={() => opNaarLes(huidig.topic.id)}
                className="text-sm text-gray-500 underline hover:text-gray-900 mt-2"
              >
                Lees de les terug: {huidig.orb.titel}
              </button>
            )}
            <button
              onClick={verder}
              className="mt-4 w-full text-sm font-semibold px-4 py-3 rounded-md bg-gray-900 text-white hover:bg-gray-700"
            >
              {index + 1 === sessieVragen.length ? "Afronden" : "Volgende"}
            </button>
          </div>
        )}
      </div>

      {huidig.orb.begrippen && huidig.orb.begrippen.length > 0 && (
        <div className="mt-4">
          <Begrippenkaart begrippen={huidig.orb.begrippen} kleur={domein.kleur} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SCHERMEN
// ============================================================================

function Overzicht({
  domeinen,
  topics,
  voortgang,
  kennis,
  aantalDue,
  opTopicKlik,
  opHerhalen,
  opVolgordeWijzigen,
}) {
  // ==========================================================================
  // Verticaal herschikken van leerpaden (domeinsecties). Alleen de weergave-
  // volgorde wijzigt; de domeinen-array zelf wordt nooit gemuteerd. Slepen
  // start uitsluitend op de handle, met pointer events (muis/touch/pen) en
  // een toetsenbordfallback. Geen library.
  // ==========================================================================
  const [tijdelijkeVolgorde, setTijdelijkeVolgorde] = useState(null); // ids tijdens slepen/verplaatsen
  const [sleepId, setSleepId] = useState(null); // welk domein hangt aan de pointer
  const [toetsModusId, setToetsModusId] = useState(null); // toetsenbord-verplaatsmodus
  const [aankondiging, setAankondiging] = useState(""); // aria-live
  const sleepRef = useRef(null); // { id, startY, actief }
  const sectieRefs = useRef({});

  const basisIds = domeinen.map((d) => d.id);
  const getoondeIds = tijdelijkeVolgorde || basisIds;
  const getoond = getoondeIds
    .map((id) => domeinen.find((d) => d.id === id))
    .filter(Boolean);

  function verplaatsInLijst(ids, id, nieuweIndex) {
    const zonder = ids.filter((x) => x !== id);
    const begrensd = Math.max(0, Math.min(nieuweIndex, zonder.length));
    return [...zonder.slice(0, begrensd), id, ...zonder.slice(begrensd)];
  }

  // --- pointerbediening -----------------------------------------------------
  function bijPointerDown(e, domId) {
    if (toetsModusId) return; // niet mengen met toetsenbordmodus
    sleepRef.current = { id: domId, startY: e.clientY, actief: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function bijPointerMove(e) {
    const s = sleepRef.current;
    if (!s) return;

    if (!s.actief) {
      if (Math.abs(e.clientY - s.startY) < 6) return; // pas slepen na ±6 px
      s.actief = true;
      setSleepId(s.id);
      setTijdelijkeVolgorde(getoondeIds);
    }

    // boven welke sectie staat de pointer? Tel de secties (zonder de gesleepte)
    // waarvan het verticale midden boven de pointer ligt.
    const huidige = tijdelijkeVolgorde || getoondeIds;
    const anderen = huidige.filter((id) => id !== s.id);
    let index = 0;
    anderen.forEach((id) => {
      const el = sectieRefs.current[id];
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (e.clientY > rect.top + rect.height / 2) index++;
    });
    const nieuw = verplaatsInLijst(huidige, s.id, index);
    if (nieuw.join("|") !== huidige.join("|")) setTijdelijkeVolgorde(nieuw);
  }

  function beeindigSleep(commit) {
    const s = sleepRef.current;
    sleepRef.current = null;
    setSleepId(null);
    if (s && s.actief && commit && tijdelijkeVolgorde) {
      opVolgordeWijzigen(tijdelijkeVolgorde);
    }
    setTijdelijkeVolgorde(null);
  }

  function bijPointerUp() {
    beeindigSleep(true);
  }

  function bijPointerCancel() {
    beeindigSleep(false);
  }

  // Escape annuleert een lopende sleep
  useEffect(() => {
    if (!sleepId) return;
    function bijToets(e) {
      if (e.key === "Escape") beeindigSleep(false);
    }
    window.addEventListener("keydown", bijToets);
    return () => window.removeEventListener("keydown", bijToets);
  });

  // --- toetsenbordbediening ---------------------------------------------------
  function bijHandleToets(e, domId, naam) {
    const inModus = toetsModusId === domId;

    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (!inModus) {
        setToetsModusId(domId);
        setTijdelijkeVolgorde(getoondeIds);
        setAankondiging(
          `Verplaatsmodus voor ${naam}. Gebruik pijl omhoog en omlaag, bevestig met Enter, annuleer met Escape.`
        );
      } else {
        if (tijdelijkeVolgorde) opVolgordeWijzigen(tijdelijkeVolgorde);
        setToetsModusId(null);
        setTijdelijkeVolgorde(null);
        setAankondiging(`${naam} staat vast op de nieuwe positie.`);
      }
      return;
    }

    if (!inModus) return;

    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const huidige = tijdelijkeVolgorde || getoondeIds;
      const index = huidige.indexOf(domId);
      const doel = e.key === "ArrowUp" ? index - 1 : index + 1;
      if (doel < 0 || doel >= huidige.length) return;
      const nieuw = verplaatsInLijst(huidige, domId, doel);
      setTijdelijkeVolgorde(nieuw);
      setAankondiging(`${naam} staat nu op positie ${doel + 1} van ${huidige.length}.`);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setToetsModusId(null);
      setTijdelijkeVolgorde(null);
      setAankondiging(`Verplaatsen van ${naam} geannuleerd.`);
    }
  }

  return (
    <div style={sleepId ? { userSelect: "none" } : undefined}>
      {/* aankondigingen voor schermlezers bij toetsenbordverplaatsing */}
      <div aria-live="polite" className="sr-only">
        {aankondiging}
      </div>

      {/* De herhaalkaart: alleen als er iets te herhalen valt. Eén button. */}
      {aantalDue > 0 && (
        <button
          onClick={opHerhalen}
          className="w-full text-left rounded-2xl p-5 mb-8 transition hover:shadow-md"
          style={{
            backgroundColor: UI.kaart,
            border: `1px solid ${UI.randZacht}`,
            boxShadow: "0 1px 3px rgba(29,29,29,0.06)",
          }}
        >
          <div className="flex items-center gap-4 flex-wrap">
            {/* decoratief herhaalicoon in zachte oranje cirkel */}
            <span
              aria-hidden="true"
              className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: "#FDEED3" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z"
                  stroke={ST.oranje}
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path
                  d="M9.5 10.5l1.8 1.8 3.2-3.6"
                  stroke={ST.oranje}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>

            <div className="flex-1 min-w-[200px]">
              <p className="text-xl font-bold" style={{ color: ST.donker }}>
                {aantalDue} {aantalDue === 1 ? "vraag is" : "vragen zijn"} vandaag aan de beurt
              </p>
              <p className="text-sm mt-0.5" style={{ color: UI.tekstSecundair }}>
                Een korte herhaling houdt je kennis sterk.
              </p>
            </div>

            <span
              className="text-sm font-semibold px-5 py-3 rounded-xl text-white shrink-0 inline-flex items-center gap-2"
              style={{ backgroundColor: ST.oranje }}
            >
              Herhalen <span aria-hidden="true">→</span>
            </span>
          </div>
        </button>
      )}

      {getoond.map((dom) => {
        const domTopics = topics.filter((t) => t.domeinId === dom.id);
        const wordtGesleept = sleepId === dom.id;
        const inToetsModus = toetsModusId === dom.id;

        return (
          <section
            key={dom.id}
            ref={(el) => {
              sectieRefs.current[dom.id] = el;
            }}
            className="mb-8 rounded-[22px] p-5 sm:p-6 transition-shadow"
            style={{
              backgroundColor: UI.kaart,
              border: `1px solid ${wordtGesleept || inToetsModus ? ST.oranje : UI.randZacht}`,
              boxShadow: wordtGesleept
                ? "0 8px 24px rgba(29,29,29,0.14)"
                : "0 1px 3px rgba(29,29,29,0.05)",
              transform: wordtGesleept ? "scale(1.01)" : undefined,
              borderTop: wordtGesleept ? `2px solid ${ST.oranje}` : undefined,
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <span
                className="w-3 h-3 rounded-full inline-block shrink-0"
                style={{ backgroundColor: dom.kleur }}
              />
              <h2 className="text-xl font-bold" style={{ color: ST.donker }}>
                {dom.naam}
              </h2>
              <span className="text-sm flex-1 min-w-0 truncate" style={{ color: UI.tekstSecundair }}>
                {dom.omschrijving}
              </span>

              {/* draghandle: alleen hiermee versleep je het leerpad */}
              <button
                aria-label={`Verplaats leerpad ${dom.naam}`}
                onPointerDown={(e) => bijPointerDown(e, dom.id)}
                onPointerMove={bijPointerMove}
                onPointerUp={bijPointerUp}
                onPointerCancel={bijPointerCancel}
                onKeyDown={(e) => bijHandleToets(e, dom.id, dom.naam)}
                className="shrink-0 rounded-lg flex items-center justify-center transition"
                style={{
                  width: 44,
                  height: 44,
                  touchAction: "none",
                  cursor: wordtGesleept ? "grabbing" : "grab",
                  color: inToetsModus ? ST.oranje : ST.zilver,
                  backgroundColor: inToetsModus ? "#FDEED3" : "transparent",
                }}
              >
                <svg width="16" height="20" viewBox="0 0 16 20" fill="currentColor" aria-hidden="true">
                  {[3, 8, 13].map((y) => (
                    <g key={y}>
                      <circle cx="5" cy={y + 2} r="1.6" />
                      <circle cx="11" cy={y + 2} r="1.6" />
                    </g>
                  ))}
                </svg>
              </button>
            </div>

            {domTopics.length === 0 ? (
              <p className="text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg p-4">
                Nog geen onderwerpen in dit domein.
              </p>
            ) : (
              <Boom
                domein={dom}
                topics={domTopics}
                alleTopics={topics}
                voortgang={voortgang}
                kennis={kennis}
                opTopicKlik={opTopicKlik}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}

// ============================================================================
// DE BOOM — de tech-tree per domein
//
// Groeit van links (stam, tier 1) naar rechts (takjes, tier 3). Onderwerpen zijn
// de knopen; de orbs zitten eronder en verschijnen als je een knoop opent.
//
// Geen blokkades: alles is altijd zichtbaar en klikbaar. Een onderwerp waar je
// nog niet aan toe bent staat er rustig bij, met een lijn naar zijn voorganger.
// De aanbevolen volgende stap licht op met de Leitner-gloed. De leerweg kent
// geen geheimen — de boom is een kaart, geen hek.
// ============================================================================

function Boom({ domein, topics, alleTopics, voortgang, kennis, opTopicKlik }) {
  // ==========================================================================
  // DE STERRENKAART — abstract, sfeervol, warm oranje.
  //
  // Elk onderwerp is een ster. Verbindingslijnen tekenen het sterrenbeeld van
  // het domein, van links (stam) naar rechts (takjes). Het aanbevolen pad gloeit
  // in de donkere domeinkleur met een leesbaar label; alle andere sterren staan
  // er zachter bij in een lichtere tint, labelloos tot je ze aanraakt of al hebt
  // aangeraakt. Afgerond = een duidelijk vinkje. De kaart tekent zichzelf uit de
  // data, dus hij schaalt mee met nieuwe domeinen.
  // ==========================================================================

  // Rustiger dan voorheen: de gloed ademt zeer subtiel, hover is een lichte
  // aanraking. Reduced motion schakelt alles uit, zoals eerder.
  const animaties = `
    @keyframes ster-adem { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
    @keyframes ster-gloed { 0%,100% { opacity: 0.5; } 50% { opacity: 0.8; } }
    .ster-knoop { transition: transform 0.2s ease, filter 0.2s ease; transform-box: fill-box; transform-origin: center; cursor: pointer; }
    .ster-knoop:hover { transform: scale(1.05); }
    .ster-knoop:active { transform: scale(1.02); }
    /* Labels zijn hover-only (expliciete wens): standaard onzichtbaar,
       zichtbaar zodra je over de ster beweegt. Alleen het aanbevolen
       anker toont zijn naam vast. */
    .ster-label { opacity: 0; transition: opacity 0.15s ease; pointer-events: none; }
    .ster-groep:hover .ster-label { opacity: 1; }
    .ster-label-vast { pointer-events: none; }
    .ster-aanbevolen { animation: ster-adem 3.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
    .ster-gloedhalo { animation: ster-gloed 3.8s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) {
      .ster-knoop, .ster-aanbevolen, .ster-gloedhalo { animation: none; transition: none; }
      .ster-knoop:hover { transform: none; }
    }
  `;

  // Decoratieve stipjes en sparkles op de achtergrond, deterministisch uit het
  // domein-id (zelfde kaart = zelfde hemel). Puur visueel.
  function decoratie(seedTekst, breedte, hoogte) {
    let zaad = 0;
    for (let i = 0; i < seedTekst.length; i++) zaad = (zaad * 31 + seedTekst.charCodeAt(i)) >>> 0;
    const volgende = () => {
      zaad = (zaad * 1664525 + 1013904223) >>> 0;
      return zaad / 4294967296;
    };
    const stippen = [];
    for (let i = 0; i < 16; i++) {
      stippen.push({
        x: 12 + volgende() * (breedte - 24),
        y: 12 + volgende() * (hoogte - 24),
        r: 1 + volgende() * 1.6,
        sparkle: i % 5 === 0,
      });
    }
    return stippen;
  }

  // klein vierpuntig fonkeltje
  function sparklePad(cx, cy, r) {
    return `M ${cx} ${cy - r} Q ${cx + r * 0.18} ${cy - r * 0.18} ${cx + r} ${cy} Q ${cx + r * 0.18} ${cy + r * 0.18} ${cx} ${cy + r} Q ${cx - r * 0.18} ${cy + r * 0.18} ${cx - r} ${cy} Q ${cx - r * 0.18} ${cy - r * 0.18} ${cx} ${cy - r} Z`;
  }

  // vijfpuntige ster in een cirkelknoop
  function sterPunten(cx, cy, r) {
    const punten = [];
    for (let i = 0; i < 10; i++) {
      const hoek = (Math.PI / 5) * i - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.45;
      punten.push(`${cx + rr * Math.cos(hoek)},${cy + rr * Math.sin(hoek)}`);
    }
    return punten.join(" ");
  }

  function statusVan(topic) {
    const totaal = topic.orbs.length;
    const gedaan = voortgang[topic.id] || 0;
    if (totaal === 0) return "leeg";
    if (gedaan >= totaal) return "af";
    if (gedaan > 0) return "bezig";
    return isTopicUnlocked(topic, alleTopics, voortgang) ? "aanbevolen" : "later";
  }

  // kleur mengen met wit (licht) of zwart (donker) — voor de warme tinten
  function meng(hex, naarWit) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if (naarWit >= 0) {
      const f = (c) => Math.round(c + (255 - c) * naarWit);
      return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
    }
    const d = 1 + naarWit; // naarWit negatief = donkerder
    return `rgb(${Math.round(r * d)}, ${Math.round(g * d)}, ${Math.round(b * d)})`;
  }

  // layout: tier = kolom (x), track = rij (y). Iets ruimer dan de boom, zodat de
  // sterren lucht om zich heen hebben.
  //
  // Vangnet: onderwerpen ZONDER gridPos (oude opslagdata) zouden allemaal op
  // dezelfde plek belanden en elkaar verbergen. Die krijgen hier elk een eigen
  // rij toegewezen, zodat alles altijd zichtbaar en klikbaar blijft.
  const zonderPos = topics.filter((t) => !t.gridPos);
  const noodTrack = new Map();
  if (zonderPos.length > 0) {
    const hoogsteTrack = Math.max(
      ...topics.filter((t) => t.gridPos).map((t) => t.gridPos.track),
      0
    );
    zonderPos.forEach((t, i) => noodTrack.set(t.id, hoogsteTrack + 1 + i));
  }
  function trackVan(topic) {
    if (topic.gridPos) return topic.gridPos.track;
    return noodTrack.get(topic.id) || 1;
  }

  const maxTier = Math.max(...topics.map((t) => topicTier(t)), 1);
  const kolBreedte = 150;
  const rijHoogte = 96;
  const tracks = topics.map((t) => trackVan(t));
  const maxTrack = Math.max(...tracks, 1);

  const marge = 60;
  const breedte = marge + maxTier * kolBreedte;
  const hoogte = 50 + maxTrack * rijHoogte;

  function positie(topic) {
    const tier = topicTier(topic);
    const track = trackVan(topic);
    return {
      x: 40 + (tier - 1) * kolBreedte,
      y: 25 + (track - 1) * rijHoogte + rijHoogte / 2,
    };
  }

  const dk = domein.kleur;
  const donker = meng(dk, -0.25); // domeinkleur-varianten (nu alleen nog reserve)
  const zacht = meng(dk, 0.42);

  const stippen = decoratie(domein.id, breedte, hoogte);

  return (
    <div className="overflow-x-auto -mx-1 px-1 py-1">
      <svg
        width={breedte}
        height={hoogte}
        viewBox={`0 0 ${breedte} ${hoogte}`}
        style={{ maxWidth: "100%", minWidth: Math.min(breedte, 320) }}
        role="img"
        aria-label={`Sterrenkaart voor ${domein.naam}`}
      >
        <style>{animaties}</style>
        <defs>
          {/* zachte oranje gloed rond de aanbevolen ster */}
          <radialGradient id={`sterglow-${domein.id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={ST.oranje} stopOpacity="0.4" />
            <stop offset="60%" stopColor={ST.oranje} stopOpacity="0.12" />
            <stop offset="100%" stopColor={ST.oranje} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* heel licht, warm veld met decoratieve stipjes */}
        <rect
          x="0"
          y="0"
          width={breedte}
          height={hoogte}
          fill={UI.kaartZacht}
          stroke={UI.randZacht}
          rx="16"
        />
        {stippen.map((s, i) =>
          s.sparkle ? (
            <path
              key={`deco-${i}`}
              d={sparklePad(s.x, s.y, s.r * 3)}
              fill={ST.oranje}
              opacity="0.25"
            />
          ) : (
            <circle key={`deco-${i}`} cx={s.x} cy={s.y} r={s.r} fill={UI.padNeutraal} opacity="0.4" />
          )
        )}

        {/* verbindingslijnen — zacht gebogen; afgelegde route in rustig groen */}
        {topics.map((topic) =>
          (topic.prerequisites || []).map((eisId) => {
            const voorganger = topics.find((t) => t.id === eisId);
            if (!voorganger) return null;
            const van = positie(voorganger);
            const naar = positie(topic);
            const voorAf =
              (voortgang[eisId] || 0) >= voorganger.orbs.length && voorganger.orbs.length > 0;
            const dx = (naar.x - van.x) * 0.5;
            return (
              <path
                key={`${eisId}-${topic.id}`}
                d={`M ${van.x} ${van.y} C ${van.x + dx} ${van.y}, ${naar.x - dx} ${naar.y}, ${naar.x} ${naar.y}`}
                fill="none"
                stroke={voorAf ? UI.succesRand : UI.padNeutraal}
                strokeWidth={voorAf ? 2 : 1.5}
                strokeLinecap="round"
                strokeDasharray={voorAf ? "0" : "3 6"}
                opacity={voorAf ? 0.9 : 0.7}
              />
            );
          })
        )}

        {/* de knopen */}
        {topics.map((topic) => {
          const { x, y } = positie(topic);
          const status = statusVan(topic);
          const gedaan = voortgang[topic.id] || 0;
          const totaal = topic.orbs.length;
          const fractie = totaal > 0 ? gedaan / totaal : 0;

          const isAanbevolen = status === "aanbevolen";
          const isAf = status === "af";
          const isBezig = status === "bezig";
          const isLeeg = status === "leeg";

          // knoopstijl per status: afgerond groen, aanbevolen wit met oranje
          // ster en gloed, bezig met voortgangsring, later crème/zilver,
          // leeg nog neutraler en niet klikbaar.
          let vulling, rand, sterKleur, straal;
          if (isAanbevolen) { vulling = "#FFFFFF"; rand = ST.oranje; sterKleur = ST.oranje; straal = 19; }
          else if (isAf) { vulling = UI.succesZacht; rand = UI.succesRand; sterKleur = UI.succes; straal = 17; }
          else if (isBezig) { vulling = "#FFFFFF"; rand = UI.randZacht; sterKleur = ST.oranje; straal = 17; }
          else if (isLeeg) { vulling = "#F3EFE7"; rand = UI.randZacht; sterKleur = null; straal = 12; }
          else { vulling = UI.kaartZacht; rand = UI.randZacht; sterKleur = ST.zilver; straal = 15; } // later

          return (
            <g key={topic.id} className="ster-groep">
              {/* zachte oranje gloed, alleen bij de aanbevolen volgende stap */}
              {isAanbevolen && (
                <circle
                  className="ster-gloedhalo"
                  cx={x}
                  cy={y}
                  r={straal * 2.3}
                  fill={`url(#sterglow-${domein.id})`}
                />
              )}

              <g
                className={`ster-knoop ${isAanbevolen ? "ster-aanbevolen" : ""}`}
                onClick={() => !isLeeg && opTopicKlik(topic.id)}
                role={isLeeg ? undefined : "button"}
                aria-label={topic.titel}
                data-topic={topic.titel}
              >
                <title>{topic.titel}</title>

                {/* voortgangsring: duidelijk maar rustig */}
                {isBezig && (
                  <>
                    <circle cx={x} cy={y} r={straal + 5} fill="none" stroke="#F0E6D8" strokeWidth="2.5" />
                    <circle
                      cx={x}
                      cy={y}
                      r={straal + 5}
                      fill="none"
                      stroke={ST.oranje}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * (straal + 5)}
                      strokeDashoffset={2 * Math.PI * (straal + 5) * (1 - fractie)}
                      transform={`rotate(-90 ${x} ${y})`}
                    />
                  </>
                )}

                {/* de knoop met geringe diepte */}
                <circle cx={x} cy={y + 1.5} r={straal} fill="rgba(29,29,29,0.07)" />
                <circle cx={x} cy={y} r={straal} fill={vulling} stroke={rand} strokeWidth="2" />

                {/* vinkje (afgerond) of ster (al het andere behalve leeg) */}
                {isAf ? (
                  <path
                    d={`M ${x - 6} ${y} l 4 4 l 7 -8`}
                    fill="none"
                    stroke={UI.succes}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : (
                  sterKleur && <polygon points={sterPunten(x, y, straal * 0.52)} fill={sterKleur} />
                )}
              </g>

              {/* label: de naam verschijnt bij hover; alleen het aanbevolen anker is vast */}
              {!isLeeg && (
                <text
                  className={isAanbevolen ? "ster-label-vast" : "ster-label"}
                  x={x}
                  y={y + straal + 14}
                  textAnchor="middle"
                  fontSize="10.5"
                  fontWeight={isAanbevolen ? "700" : "600"}
                  fill={isAanbevolen ? ST.donker : "#6B7280"}
                >
                  {topic.titel.length > 20 ? topic.titel.slice(0, 19) + "…" : topic.titel}
                </text>
              )}
              {isAanbevolen && (
                <g className="ster-label-vast">
                  <rect
                    x={x - 28}
                    y={y + straal + 19}
                    width="56"
                    height="15"
                    rx="7.5"
                    fill="#FDEED3"
                    stroke={ST.oranje}
                    strokeWidth="0.75"
                  />
                  <text
                    x={x}
                    y={y + straal + 29.5}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="600"
                    fill="#B87B12"
                  >
                    start hier
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}


function TopicDetail({ topic, domein, voortgang, kennis, opTerug, opOrbStarten }) {
  const gedaan = voortgang[topic.id] || 0;

  return (
    <div>
      <button onClick={opTerug} className="text-sm text-gray-500 hover:text-gray-900 mb-6">
        ← Terug naar overzicht
      </button>

      <header className="mb-6">
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: domein.kleur }}
        >
          {domein.naam}
        </span>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{topic.titel}</h1>
        <p className="text-gray-500">{topic.ondertitel}</p>
      </header>

      <div className="space-y-4">
        {topic.orbs.map((orb, i) => {
          const afgerond = i < gedaan;
          const beschikbaar = i === gedaan;
          const vergrendeld = i > gedaan;

          const orbBlokken = Array.isArray(orb.blokken) ? orb.blokken : [];
          const orbVragen = Array.isArray(orb.vragen) ? orb.vragen : [];
          const soorten = [...new Set(orbBlokken.map((b) => b.type))];

          // De orb licht op naar geheugensterkte: hoe hoger de Leitner-doos,
          // hoe feller. Een orb die dooft betekent dat je kennis wegzakt.
          const sterkte = geheugensterkte(orb, kennis);
          const gloed = sterkte / 5; // 0 tot 1

          return (
            <div
              key={orb.id}
              className={`border rounded-lg p-4 ${
                vergrendeld ? "border-gray-200 bg-gray-50" : "border-gray-300 bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* de orb zelf — feller naarmate de kennis steviger zit */}
                  {!vergrendeld && (
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{
                        backgroundColor: domein.kleur,
                        opacity: 0.15 + gloed * 0.85,
                        boxShadow:
                          gloed > 0.2
                            ? `0 0 ${4 + gloed * 10}px ${domein.kleur}`
                            : "none",
                      }}
                      title={`Geheugensterkte: doos ${sterkte.toFixed(1)} van 5`}
                    />
                  )}
                  <h3
                    className={`font-semibold truncate ${
                      vergrendeld ? "text-gray-400" : "text-gray-900"
                    }`}
                  >
                    {orb.titel}
                  </h3>
                </div>
                {afgerond && (
                  <span className="text-xs font-semibold text-gray-900 shrink-0">
                    {sterkte >= 4
                      ? "Zit erin"
                      : sterkte >= 2
                      ? "Wordt sterker"
                      : "Zakt weg"}
                  </span>
                )}
                {vergrendeld && (
                  <span className="text-xs text-gray-400 shrink-0">Vergrendeld</span>
                )}
              </div>

              {!vergrendeld && (
                <p className="text-xs text-gray-400 mt-1.5">
                  {orbBlokken.length} blokken · {orbVragen.length} vragen
                  {soorten.includes("vergelijking") && " · met grafiek"}
                  {soorten.includes("tijdlijn") && " · met tijdlijn"}
                </p>
              )}

              {beschikbaar && (
                <button
                  onClick={() => opOrbStarten(topic.id, i)}
                  className="mt-3 text-sm font-semibold px-4 py-2 rounded-md bg-gray-900 text-white hover:bg-gray-700"
                >
                  Start
                </button>
              )}
              {afgerond && (
                <button
                  onClick={() => opOrbStarten(topic.id, i)}
                  className="mt-3 text-sm font-semibold px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:border-gray-900"
                >
                  Nog eens lezen
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LesScherm({ topic, domein, orbIndex, opAfronden, opAfbreken, opVraagBeantwoord }) {
  const orb = topic && Array.isArray(topic.orbs) ? topic.orbs[orbIndex] : null;
  const blokken = orb && Array.isArray(orb.blokken) ? orb.blokken : [];
  const vragen = orb && Array.isArray(orb.vragen) ? orb.vragen.filter(vraagIsHeel) : [];

  // Een beschadigde of bewust leeg gemaakte orb mag nooit een wit scherm geven.
  // Zonder blokken beginnen we bij de vragen; zonder vragen kan een lees-orb
  // gewoon worden afgerond. Alleen een volledig lege orb wordt tegengehouden.
  const [fase, setFase] = useState(() =>
    blokken.length > 0 ? "lezen" : vragen.length > 0 ? "vragen" : "onvolledig"
  );
  const [blokIndex, setBlokIndex] = useState(0);
  const [vraagIndex, setVraagIndex] = useState(0);
  const [gekozen, setGekozen] = useState(null);
  const [juist, setJuist] = useState(false);
  const [foutGehad, setFoutGehad] = useState(false);
  // Welke vragen zijn al voor Leitner geteld? Alleen de EERSTE poging telt.
  // Anders kun je een fout wegpoetsen door hem meteen te verbeteren, en dan
  // zegt de doos niets meer over wat je werkelijk weet.
  const [geteld, setGeteld] = useState(() => new Set());

  const vraag = vragen[vraagIndex];
  const orbTitel = (orb && orb.titel) || "Onvolledige les";

  function opAntwoord(isJuist) {
    if (!vraag) return;

    setJuist(isJuist);
    if (!isJuist) setFoutGehad(true);

    if (!geteld.has(vraag.id)) {
      setGeteld((g) => new Set(g).add(vraag.id));
      if (opVraagBeantwoord) opVraagBeantwoord(vraag.id, isJuist);
    }
  }

  function opnieuw() {
    setGekozen(null);
    setJuist(false);
  }

  const kop = (
    <div className="flex items-center justify-between mb-6">
      <div>
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: domein.kleur }}
        >
          {domein.naam} · {topic.titel}
        </span>
        <h1 className="text-xl font-bold text-gray-900">{orbTitel}</h1>
      </div>
      <button
        onClick={opAfbreken}
        className="text-sm text-gray-400 hover:text-gray-900 shrink-0"
      >
        Sluiten
      </button>
    </div>
  );

  if (!orb || fase === "onvolledig") {
    return (
      <div>
        {kop}
        <div className="bg-white border border-amber-300 rounded-lg p-6">
          <p className="text-sm font-semibold text-amber-900">Deze orb is onvolledig</p>
          <p className="text-sm text-amber-800 mt-1">
            Er staan geen bruikbare tekstblokken of vragen in. Pas de orb aan onder Content beheren.
          </p>
          <button
            onClick={opAfbreken}
            className="mt-4 w-full text-sm font-semibold px-4 py-3 rounded-md border border-gray-900 text-gray-900 hover:bg-gray-100"
          >
            Terug
          </button>
        </div>
      </div>
    );
  }

  if (fase === "lezen") {
    const laatste = blokIndex === blokken.length - 1;
    const naLezen = vragen.length > 0 ? "vragen" : "klaar";
    return (
      <div>
        {kop}
        <p className="text-xs text-gray-400 mb-4">
          Lezen {blokIndex + 1}/{blokken.length}
        </p>
        <div className="bg-white border border-gray-300 rounded-lg p-6">
          <div className="space-y-4">
            {blokken.slice(0, blokIndex + 1).map((blok, i) => (
              <div key={i} className={i === blokIndex ? "" : "opacity-40"}>
                <Blok blok={blok} kleur={domein.kleur} />
              </div>
            ))}
          </div>

          <button
            onClick={() => (laatste ? setFase(naLezen) : setBlokIndex(blokIndex + 1))}
            className="mt-6 w-full text-sm font-semibold px-4 py-3 rounded-md bg-gray-900 text-white hover:bg-gray-700"
          >
            {laatste ? (vragen.length > 0 ? "Naar de vragen" : "Afronden") : "Verder"}
          </button>
        </div>

        {/* Studieondersteuning: staat er tijdens het hele lezen bij */}
        <div className="mt-4">
          <Begrippenkaart begrippen={orb.begrippen} kleur={domein.kleur} />
        </div>
      </div>
    );
  }

  if (fase === "vragen") {
    if (!vraag) {
      return (
        <div>
          {kop}
          <div className="bg-white border border-amber-300 rounded-lg p-6">
            <p className="text-sm font-semibold text-amber-900">Geen bruikbare vraag gevonden</p>
            <p className="text-sm text-amber-800 mt-1">
              De lesstof blijft beschikbaar. Je kunt deze orb zonder vragen afronden of later aanpassen.
            </p>
            <button
              onClick={() => setFase("klaar")}
              className="mt-4 w-full text-sm font-semibold px-4 py-3 rounded-md bg-gray-900 text-white hover:bg-gray-700"
            >
              Afronden
            </button>
          </div>
        </div>
      );
    }

    const laatsteVraag = vraagIndex === vragen.length - 1;

    return (
      <div>
        {kop}
        <p className="text-xs text-gray-400 mb-4">
          Vraag {vraagIndex + 1}/{vragen.length}
        </p>
        <div className="bg-white border border-gray-300 rounded-lg p-6">
          <p className="text-lg font-semibold text-gray-900 mb-4">{vraag.vraag}</p>

          <Vraag
            vraag={vraag}
            gekozen={gekozen}
            setGekozen={setGekozen}
            opAntwoord={opAntwoord}
          />

          {gekozen !== null && (
            <div className="mt-4">
              <p
                className={`text-sm font-semibold ${
                  juist ? "text-green-700" : "text-red-600"
                }`}
              >
                {juist ? "Goed" : "Niet juist"}
              </p>
              <p className="text-sm text-gray-600 mt-1">{vraag.uitleg}</p>

              {juist ? (
                <button
                  onClick={() => {
                    if (laatsteVraag) setFase("klaar");
                    else {
                      setVraagIndex(vraagIndex + 1);
                      opnieuw();
                    }
                  }}
                  className="mt-4 w-full text-sm font-semibold px-4 py-3 rounded-md bg-gray-900 text-white hover:bg-gray-700"
                >
                  {laatsteVraag ? "Afronden" : "Volgende vraag"}
                </button>
              ) : (
                <button
                  onClick={opnieuw}
                  className="mt-4 w-full text-sm font-semibold px-4 py-3 rounded-md border border-gray-900 text-gray-900 hover:bg-gray-100"
                >
                  Probeer opnieuw
                </button>
              )}
            </div>
          )}
        </div>

        {/* De woorden blijven ook tijdens de vragen bij de hand */}
        <div className="mt-4">
          <Begrippenkaart begrippen={orb.begrippen} kleur={domein.kleur} />
        </div>
      </div>
    );
  }

  return (
    <div>
      {kop}
      <p className="text-xs text-gray-400 mb-4">Afgerond</p>
      <div className="bg-white border border-gray-300 rounded-lg p-6">
        <p className="text-sm font-semibold text-gray-900">Orb afgerond</p>
        <p className="text-xs text-gray-500 mt-1">
          {vragen.length === 0
            ? "Deze orb bevat geen vragen. De lesstof is wel volledig doorlopen."
            : foutGehad
              ? "Je had een vraag fout. Die staat in doos 1 en komt morgen terug."
              : "Alles goed in één keer. Deze vragen komen over een paar dagen terug."}
        </p>

        {orb.haakje && (
          <div className="mt-6 border-l-4 pl-4 py-2" style={{ borderColor: domein.kleur }}>
            <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1">
              Denk hier eens over na
            </p>
            <p className="text-gray-900 italic leading-relaxed">{orb.haakje}</p>
          </div>
        )}

        <button
          onClick={opAfronden}
          className="mt-6 w-full text-sm font-semibold px-4 py-3 rounded-md bg-gray-900 text-white hover:bg-gray-700"
        >
          Terug naar {topic.titel}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// BEHEER
// ============================================================================

// ============================================================================
// BESTAANDE LESSTOF BEHEREN
//
// Vóór publicatie kun je blokken uit een concept halen. Ná publicatie was daar
// nooit een weg terug voor — dit repareert dat gat. Je kunt losse blokken uit
// een al-gepubliceerde orb verwijderen, en de allerlaatste orb van een
// onderwerp helemaal weghalen.
//
// Waarom alleen de LAATSTE orb verwijderbaar is: voortgang wordt bijgehouden
// als "aantal afgeronde orbs", geteld vanaf het begin. Haal je een orb uit het
// midden, dan schuift die telling op en klopt niemands voortgang meer. Vanaf
// het eind weghalen is altijd veilig.
// ============================================================================

function BestaandeOrbsBeheer({ topic, domeinen, topics, bronnen, opOpslaan }) {
  const [open, setOpen] = useState(null); // orbId dat uitgeklapt is
  const domein = domeinen.find((d) => d.id === topic.domeinId) || { kleur: "#888880" };

  function bewaarOrbs(nieuweOrbs) {
    const nieuweTopics = topics.map((t) =>
      t.id === topic.id ? { ...t, orbs: nieuweOrbs } : t
    );
    opOpslaan({ domeinen, topics: nieuweTopics, bronnen });
  }

  // Het leerpad zelf: titel en ondertitel zijn ook na publicatie aanpasbaar.
  function wijzigTopic(veld, waarde) {
    const nieuweTopics = topics.map((t) =>
      t.id === topic.id ? { ...t, [veld]: waarde } : t
    );
    opOpslaan({ domeinen, topics: nieuweTopics, bronnen });
  }

  function wijzigOrbTitel(orbId, titel) {
    bewaarOrbs(topic.orbs.map((o) => (o.id === orbId ? { ...o, titel } : o)));
  }

  function wijzigVraag(orbId, vraagIndex, veld, waarde) {
    bewaarOrbs(
      topic.orbs.map((o) =>
        o.id === orbId
          ? {
              ...o,
              vragen: (o.vragen || []).map((v, i) =>
                i === vraagIndex ? { ...v, [veld]: waarde } : v
              ),
            }
          : o
      )
    );
  }

  function wijzigOptie(orbId, vraagIndex, optieIndex, waarde) {
    bewaarOrbs(
      topic.orbs.map((o) =>
        o.id === orbId
          ? {
              ...o,
              vragen: (o.vragen || []).map((v, i) =>
                i === vraagIndex
                  ? { ...v, opties: (v.opties || []).map((op, oi) => (oi === optieIndex ? waarde : op)) }
                  : v
              ),
            }
          : o
      )
    );
  }

  // Vraag verwijderen is veilig: het Leitner-systeem loopt alleen over vragen
  // die nog bestaan, dus oude kennis-entries doen simpelweg niets meer.
  function verwijderVraag(orbId, vraagIndex) {
    bewaarOrbs(
      topic.orbs.map((o) =>
        o.id === orbId
          ? { ...o, vragen: (o.vragen || []).filter((_, i) => i !== vraagIndex) }
          : o
      )
    );
  }

  function verwijderBlok(orbId, blokIndex) {
    bewaarOrbs(
      topic.orbs.map((o) =>
        o.id === orbId
          ? { ...o, blokken: (o.blokken || []).filter((_, i) => i !== blokIndex) }
          : o
      )
    );
  }

  function wijzigBlok(orbId, blokIndex, veld, waarde) {
    bewaarOrbs(
      topic.orbs.map((o) =>
        o.id === orbId
          ? {
              ...o,
              blokken: (o.blokken || []).map((b, i) =>
                i === blokIndex ? { ...b, [veld]: waarde } : b
              ),
            }
          : o
      )
    );
  }

  function verwijderLaatsteOrb() {
    bewaarOrbs(topic.orbs.slice(0, -1));
    setOpen(null);
  }

  if (topic.orbs.length === 0) return null;

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-5 mb-4">
      <label className="block text-sm font-semibold text-gray-900 mb-1">
        Bestaande lesstof in dit onderwerp
      </label>
      <p className="text-xs text-gray-400 mb-3">
        Alles hieronder staat al live en is direct aanpasbaar — er is geen apart
        publiceermoment voor.
      </p>

      <div className="mb-4 space-y-2">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            Titel van het leerpad
          </label>
          <input
            value={topic.titel}
            onChange={(e) => wijzigTopic("titel", e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-gray-900 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            Ondertitel
          </label>
          <input
            value={topic.ondertitel || ""}
            onChange={(e) => wijzigTopic("ondertitel", e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-gray-900 outline-none"
          />
        </div>
      </div>

      <div className="space-y-2">
        {topic.orbs.map((orb, orbIndex) => {
          const isLaatste = orbIndex === topic.orbs.length - 1;
          const isOpen = open === orb.id;
          const orbBlokken = Array.isArray(orb.blokken) ? orb.blokken : [];
          const orbVragen = Array.isArray(orb.vragen) ? orb.vragen : [];

          return (
            <div key={orb.id} className="border border-gray-200 rounded-md">
              <button
                onClick={() => setOpen(isOpen ? null : orb.id)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-gray-50"
              >
                <span className="text-sm font-medium text-gray-800 truncate">
                  {orb.titel}
                </span>
                <span className="text-xs text-gray-400 shrink-0">
                  {orbBlokken.length} blok(ken) · {orbVragen.length} vra(a)g(en)
                  {isOpen ? " · sluiten" : " · bewerken"}
                </span>
              </button>

              {isOpen && (
                <div className="px-3 pb-3 border-t border-gray-100 pt-3 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Titel van deze orb
                    </label>
                    <input
                      value={orb.titel}
                      onChange={(e) => wijzigOrbTitel(orb.id, e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-medium focus:border-gray-900 outline-none"
                    />
                  </div>

                  {orbBlokken.length === 0 && (
                    <p className="text-xs text-gray-400 italic">
                      Geen blokken meer over — deze orb toont niets bij het lezen.
                    </p>
                  )}

                  {orbBlokken.map((blok, blokIndex) => (
                    <div key={blokIndex}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
                          {blok.type}
                        </p>
                        <button
                          onClick={() => verwijderBlok(orb.id, blokIndex)}
                          className="text-xs text-gray-400 hover:text-red-600"
                        >
                          Blok weg
                        </button>
                      </div>

                      {blok.type === "tekst" && (
                        <textarea
                          value={blok.tekst}
                          onChange={(e) =>
                            wijzigBlok(orb.id, blokIndex, "tekst", e.target.value)
                          }
                          rows={3}
                          className="w-full text-sm text-gray-700 leading-relaxed p-2 rounded border border-gray-200 focus:border-gray-900 outline-none resize-none"
                        />
                      )}

                      {blok.type !== "tekst" && (
                        <Blok blok={blok} kleur={domein.kleur} />
                      )}
                    </div>
                  ))}

                  {orbVragen.length > 0 && (
                    <div className="border-t border-gray-100 pt-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Vragen
                      </p>
                      <div className="space-y-3">
                        {orbVragen.map((vraag, vraagIndex) => (
                          <div
                            key={vraag.id || vraagIndex}
                            className="border border-gray-200 rounded-md p-3"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
                                {vraag.type}
                              </p>
                              <button
                                onClick={() => verwijderVraag(orb.id, vraagIndex)}
                                className="text-xs text-gray-400 hover:text-red-600"
                              >
                                Vraag weg
                              </button>
                            </div>

                            <textarea
                              value={vraag.vraag}
                              onChange={(e) =>
                                wijzigVraag(orb.id, vraagIndex, "vraag", e.target.value)
                              }
                              rows={2}
                              className="w-full text-sm font-medium text-gray-900 p-2 rounded border border-gray-200 focus:border-gray-900 outline-none resize-none mb-2"
                            />

                            {vraag.type === "meerkeuze" && (
                              <div className="space-y-1.5 mb-2">
                                {(vraag.opties || []).map((optie, optieIndex) => (
                                  <div key={optieIndex} className="flex items-center gap-2">
                                    <button
                                      onClick={() =>
                                        wijzigVraag(orb.id, vraagIndex, "juisteIndex", optieIndex)
                                      }
                                      title="Markeer als juiste antwoord"
                                      className={`w-5 h-5 rounded-full border-2 shrink-0 text-[10px] font-bold ${
                                        vraag.juisteIndex === optieIndex
                                          ? "border-green-600 bg-green-600 text-white"
                                          : "border-gray-300 text-transparent hover:border-green-600"
                                      }`}
                                    >
                                      ✓
                                    </button>
                                    <input
                                      value={optie}
                                      onChange={(e) =>
                                        wijzigOptie(orb.id, vraagIndex, optieIndex, e.target.value)
                                      }
                                      className="flex-1 text-sm text-gray-700 px-2 py-1.5 rounded border border-gray-200 focus:border-gray-900 outline-none"
                                    />
                                  </div>
                                ))}
                                <p className="text-xs text-gray-400">
                                  Het groene vinkje markeert het juiste antwoord.
                                </p>
                              </div>
                            )}

                            {vraag.type !== "meerkeuze" && (
                              <p className="text-xs text-gray-400 mb-2 italic">
                                De onderdelen van een {vraag.type}-vraag zijn hier niet los te
                                bewerken — verwijder de vraag als hij niet klopt.
                              </p>
                            )}

                            <label className="block text-xs font-semibold text-gray-500 mb-1">
                              Uitleg na het antwoord
                            </label>
                            <textarea
                              value={vraag.uitleg || ""}
                              onChange={(e) =>
                                wijzigVraag(orb.id, vraagIndex, "uitleg", e.target.value)
                              }
                              rows={2}
                              className="w-full text-sm text-gray-600 p-2 rounded border border-gray-200 focus:border-gray-900 outline-none resize-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-gray-100 pt-3">
                    {isLaatste ? (
                      <button
                        onClick={verwijderLaatsteOrb}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        Deze orb helemaal verwijderen (laatste in dit onderwerp)
                      </button>
                    ) : (
                      <p className="text-xs text-gray-400">
                        Deze orb kan niet los verwijderd worden — alleen de laatste orb
                        van een onderwerp, zodat ieders voortgang blijft kloppen.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// ONDERWERP-KIEZER
//
// De native <select> negeert op mobiel alle styling — je krijgt kaal
// systeemwit met radiobolletjes, geen kleur, geen structuur. Deze eigen
// kiezer toont dezelfde domeinkleuren als de sterrenkaart en bakent de
// leergang af: onderwerpen springen in per tier (stam/tak/takje), met een
// gekleurd stipje in de domeinkleur. Zo zie je in één oogopslag waar iets
// in de boom hangt, niet alleen dát het bestaat.
// ============================================================================

function OnderwerpKiezer({ domeinen, topics, waarde, opKiezen }) {
  const [open, setOpen] = useState(false);

  const gekozenTopic = topics.find((t) => t.id === waarde);
  const gekozenDomein = gekozenTopic
    ? domeinen.find((d) => d.id === gekozenTopic.domeinId)
    : null;

  const label =
    waarde === "__nieuw__"
      ? "+ Nieuw onderwerp aanmaken"
      : gekozenTopic
      ? gekozenTopic.titel
      : "Kies een onderwerp…";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Kies een onderwerp"
        className="w-full flex items-center justify-between gap-2 border border-gray-300 rounded-md px-3 py-2.5 text-sm bg-white text-left"
      >
        <span className="flex items-center gap-2 truncate">
          {gekozenDomein && (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: gekozenDomein.kleur }}
            />
          )}
          <span className={waarde ? "text-gray-900" : "text-gray-400"}>{label}</span>
        </span>
        <span className="text-gray-400 shrink-0 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <>
          {/* onzichtbare laag om buiten de kiezer te kunnen tikken en sluiten */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          <div className="absolute left-0 right-0 mt-1 z-20 border border-gray-300 rounded-md bg-white shadow-lg max-h-80 overflow-y-auto">
            {domeinen.map((dom) => {
              const domTopics = topics.filter((t) => t.domeinId === dom.id);
              if (domTopics.length === 0) return null;

              return (
                <div key={dom.id}>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border-t border-gray-100 first:border-t-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: dom.kleur }}
                    />
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {dom.naam}
                    </span>
                  </div>

                  {domTopics.map((t) => {
                    const tier = topicTier(t);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          opKiezen(t.id);
                          setOpen(false);
                        }}
                        data-topic-id={t.id}
                        style={{ paddingLeft: `${14 + (tier - 1) * 16}px` }}
                        className={`w-full flex items-center gap-2 pr-3 py-3 text-left text-sm hover:bg-gray-50 ${
                          waarde === t.id ? "bg-gray-50" : ""
                        }`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: dom.kleur }}
                        />
                        <span className="flex-1 truncate text-gray-800">{t.titel}</span>
                        <span className="text-xs text-gray-400 shrink-0">
                          {tierInfo(tier).naam} · {t.orbs.length} orb(s)
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => {
                opKiezen("__nieuw__");
                setOpen(false);
              }}
              data-topic-id="__nieuw__"
              className="w-full text-left px-3 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 border-t border-gray-200"
            >
              + Nieuw onderwerp aanmaken
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// LEERPADBEHEER — het tabblad voor automatische leerpadgeneratie
//
// Start een run, toont de voortgang, kan altijd hervatten, en publiceert
// alleen langs de publicatiepoort. Handmatig ingrijpen kan, maar hoeft niet.
// ============================================================================

// Haalt buiten-scope-orbs uit het plan. Valt een heel topic weg, dan hangen
// zijn opvolgers aan de voorganger van het weggevallen topic en worden de
// tiers langs de keten herberekend. De samenhang moet daarna opnieuw.
function verwijderBuitenScopeUitPlan(run) {
  const kopie = JSON.parse(JSON.stringify(run));
  const isWeg = (o) => {
    const s = kopie.orbsInUitvoering[o.planOrbId];
    return s && s.status === "buiten-scope";
  };

  kopie.plan.topics.forEach((t) => {
    t.orbs = t.orbs.filter((o) => !isWeg(o));
  });

  const weg = kopie.plan.topics.filter((t) => t.orbs.length === 0);
  weg.forEach((w) => {
    kopie.plan.topics.forEach((t) => {
      if (t.prerequisites[0] === w.planTopicId) t.prerequisites = [...w.prerequisites];
    });
  });
  kopie.plan.topics = kopie.plan.topics.filter((t) => t.orbs.length > 0);

  const perId = {};
  kopie.plan.topics.forEach((t) => {
    perId[t.planTopicId] = t;
  });
  topologischeVolgordePlan(kopie.plan.topics).forEach((t) => {
    const eis = t.prerequisites[0] !== undefined ? perId[t.prerequisites[0]] : null;
    t.tier = eis ? Math.min(eis.tier + 1, 3) : 1;
  });

  Object.keys(kopie.orbsInUitvoering).forEach((id) => {
    const bestaat = kopie.plan.topics.some((t) => t.orbs.some((o) => o.planOrbId === id));
    if (!bestaat) delete kopie.orbsInUitvoering[id];
  });

  kopie.samenhang = null;
  kopie.fase = "genereren";
  return kopie;
}

const ORB_STATUS_STIJL = {
  gepland: "border-gray-300 bg-gray-50 text-gray-600",
  gegenereerd: "border-blue-300 bg-blue-50 text-blue-800",
  getoetst: "border-blue-300 bg-blue-50 text-blue-800",
  geredigeerd: "border-blue-300 bg-blue-50 text-blue-800",
  goedgekeurd: "border-green-300 bg-green-50 text-green-800",
  afgekeurd: "border-red-300 bg-red-50 text-red-800",
  "buiten-scope": "border-amber-300 bg-amber-50 text-amber-900",
  fout: "border-red-300 bg-red-50 text-red-800",
};

function LeerpadBeheer({ domeinen, topics, bronnen, opOpslaan }) {
  const [run, setRun] = useState(null);
  const [geladen, setGeladen] = useState(false);
  const [domeinId, setDomeinId] = useState(domeinen[0] ? domeinen[0].id : "");
  const [bezig, setBezig] = useState(false);
  const [stand, setStand] = useState(null);
  const [melding, setMelding] = useState(null);
  const [blokkades, setBlokkades] = useState(null);
  const [autoPubliceer, setAutoPubliceer] = useState(false);
  const [openOrb, setOpenOrb] = useState(null);
  // Handmatige tekstbewerkingen kunnen zeer snel achter elkaar komen. Door alle
  // writes te serialiseren kan een trage oude opslagactie nooit de nieuwste
  // invoer overschrijven.
  const runOpslagRij = useRef(Promise.resolve());

  function bewaarRunInRij(waarde) {
    runOpslagRij.current = runOpslagRij.current
      .catch(() => false)
      .then(() => bewaarRun(waarde));
    return runOpslagRij.current;
  }

  useEffect(() => {
    let leeft = true;
    laadRun().then((r) => {
      if (leeft) {
        setRun(r);
        if (r) setDomeinId(r.domeinId);
        setGeladen(true);
      }
    });
    return () => {
      leeft = false;
    };
  }, []);

  const domeinBronnen = bronnen[domeinId] || [];

  async function publiceer(welke) {
    const res = await publiceerLeerpad(welke, { domeinen, topics, bronnen }, opOpslaan);
    if (res.gelukt) {
      setMelding(`Leerpad gepubliceerd: ${res.aantalTopics} topic(s) toegevoegd aan de boom.`);
      setBlokkades(null);
      setRun(null);
    } else {
      if (res.run) setRun(res.run);
      setBlokkades(res.blokkades);
    }
  }

  async function draai(welke) {
    setBezig(true);
    setMelding(null);
    setBlokkades(null);
    const resultaat = await voerLeerpadRunUit(welke, { domeinen, topics, bronnen }, setStand);
    setRun(resultaat);
    setStand(null);
    setBezig(false);
    // Automatisch publiceren geldt alleen wanneer álles langs de toetser en de
    // redacteur is gekomen. Heb jij ergens zelf goedgekeurd, dan blijft
    // publiceren een bewuste klik — dat was de afspraak bij handmatig vrijgeven.
    const heeftHandmatig = Object.values(resultaat.orbsInUitvoering || {}).some(
      (o) => o.handmatig && o.handmatig.reden
    );
    const samenhangVraagtAandacht =
      resultaat.samenhang &&
      (resultaat.samenhang.besluit !== "goed" ||
        (resultaat.samenhang.bevindingen || []).length > 0 ||
        (resultaat.samenhang.begrippenfouten || []).length > 0);

    if (autoPubliceer && resultaat.fase === "klaar" && heeftHandmatig) {
      setMelding(
        "Klaar, maar niet automatisch gepubliceerd: er zijn orbs die jij handmatig hebt goedgekeurd. Publiceer die bewust via de knop hieronder."
      );
    } else if (autoPubliceer && resultaat.fase === "klaar" && samenhangVraagtAandacht) {
      setMelding(
        "Klaar, maar niet automatisch gepubliceerd: de samenhangscontrole vraagt aandacht. Bekijk de bevindingen en publiceer daarna bewust."
      );
    } else if (autoPubliceer && resultaat.fase === "klaar") {
      await publiceer(resultaat);
    }
  }

  async function start() {
    const nieuw = nieuweLeerpadRun(domeinId, domeinBronnen);
    await bewaarRunInRij(nieuw);
    setRun(nieuw);
    await draai(nieuw);
  }

  // volledige hergeneratie van één orb
  async function opnieuwOrb(planOrbId) {
    const kopie = JSON.parse(JSON.stringify(run));
    kopie.orbsInUitvoering[planOrbId] = { status: "gepland" };
    kopie.fase = "genereren";
    kopie.samenhang = null;
    await bewaarRunInRij(kopie);
    setRun(kopie);
    await draai(kopie);
  }

  // Hervat precies de stap die faalde. De reeds geschreven inhoud blijft staan.
  async function hervatMislukteOrb(planOrbId) {
    const kopie = JSON.parse(JSON.stringify(run));
    const oiu = kopie.orbsInUitvoering[planOrbId];
    if (!oiu) return;
    oiu.status = oiu.hervatStatus || (oiu.orb ? "gegenereerd" : "gepland");
    delete oiu.hervatStatus;
    delete oiu.foutmelding;
    kopie.fase = "genereren";
    kopie.samenhang = null;
    await bewaarRunInRij(kopie);
    setRun(kopie);
    await draai(kopie);
  }

  // na handmatig bewerken: alleen opnieuw toetsen en redigeren
  async function opnieuwToetsen(planOrbId) {
    const kopie = JSON.parse(JSON.stringify(run));
    const oiu = kopie.orbsInUitvoering[planOrbId];
    oiu.status = "gegenereerd";
    oiu.poort = {};
    kopie.fase = "genereren";
    kopie.samenhang = null;
    await bewaarRunInRij(kopie);
    setRun(kopie);
    await draai(kopie);
  }

  async function buitenScopeWeg() {
    const kopie = verwijderBuitenScopeUitPlan(run);
    await bewaarRunInRij(kopie);
    setRun(kopie);
    await draai(kopie);
  }

  async function verwijderRun() {
    await bewaarRunInRij(null);
    setRun(null);
    setMelding(null);
    setBlokkades(null);
  }

  function vervangTekst(planOrbId, blokIndex, nieuweTekst) {
    const kopie = JSON.parse(JSON.stringify(run));
    const oiu = kopie.orbsInUitvoering[planOrbId];
    if (oiu && oiu.orb && oiu.orb.blokken[blokIndex] && oiu.orb.blokken[blokIndex].type === "tekst") {
      oiu.orb.blokken[blokIndex].tekst = nieuweTekst;
      bewaarRunInRij(kopie);
      setRun(kopie);
      setMelding("Herschrijving toegepast. Laat de orb opnieuw toetsen om hem goed te keuren.");
    }
  }

  // Vrij bewerken van een tekstblok in een afgekeurde orb.
  function bewerkBlok(planOrbId, blokIndex, nieuweTekst) {
    const kopie = JSON.parse(JSON.stringify(run));
    const oiu = kopie.orbsInUitvoering[planOrbId];
    if (!oiu || !oiu.orb || !oiu.orb.blokken[blokIndex]) return;
    if (oiu.orb.blokken[blokIndex].type !== "tekst") return;
    oiu.orb.blokken[blokIndex].tekst = nieuweTekst;
    bewaarRunInRij(kopie);
    setRun(kopie);
  }

  // Vrij bewerken van een vraag: vraagtekst, opties en uitleg.
  function bewerkVraag(planOrbId, vraagIndex, veld, waarde, optieIndex) {
    const kopie = JSON.parse(JSON.stringify(run));
    const oiu = kopie.orbsInUitvoering[planOrbId];
    const v = oiu && oiu.orb && (oiu.orb.vragen || [])[vraagIndex];
    if (!v) return;
    if (veld === "optie" && Array.isArray(v.opties) && v.opties[optieIndex] !== undefined) {
      v.opties[optieIndex] = waarde;
    } else if (veld === "juisteIndex") {
      v.juisteIndex = optieIndex;
    } else if (veld === "vraag" || veld === "uitleg") {
      v[veld] = waarde;
    }
    bewaarRunInRij(kopie);
    setRun(kopie);
  }

  // Handmatig goedkeuren: jouw oordeel als grondslag, met verplichte reden.
  // De markering blijft in de run (beheerkant) en gaat NIET mee naar de orb
  // die de lerende ziet — publiceren strijkt bronControle, redactie en poort
  // eruit, en handmatig staat buiten de orb.
  async function keurHandmatigGoed(planOrbId, reden) {
    if (!reden || reden.trim().length < 5) return;
    const kopie = JSON.parse(JSON.stringify(run));
    const oiu = kopie.orbsInUitvoering[planOrbId];
    if (!oiu || !oiu.orb) return;

    const structuurfouten = orbStructuurFouten(oiu.orb);
    if (structuurfouten.length > 0) {
      setBlokkades(
        structuurfouten.map((fout) => `Orb kan nog niet handmatig worden goedgekeurd: ${fout}`)
      );
      return;
    }

    const tijd = new Date().toISOString();
    oiu.handmatig = { reden: reden.trim(), tijd };
    oiu.status = "goedgekeurd";
    oiu.poort = { ...(oiu.poort || {}), besluit: "goedgekeurd", redenen: [] };
    kopie.fase = "genereren";
    kopie.samenhang = null;
    kopie.publicatieStatus = "niet-gestart";
    kopie.logboek = [
      ...(kopie.logboek || []),
      {
        tijd,
        stap: "handmatig",
        melding: `${planOrbId}: handmatig goedgekeurd — ${reden.trim()}`,
      },
    ];

    await bewaarRunInRij(kopie);
    setRun(kopie);
    setBlokkades(null);

    const allesGoedgekeurd = Object.values(kopie.orbsInUitvoering || {}).every(
      (x) => x.status === "goedgekeurd"
    );
    setMelding(
      allesGoedgekeurd
        ? "Orb handmatig goedgekeurd. Klik Hervatten om de samenhang van het hele pad te controleren."
        : "Orb handmatig goedgekeurd. Publiceren blijft een bewuste klik."
    );
  }

  // Handmatige goedkeuring terugdraaien.
  async function draaiHandmatigTerug(planOrbId) {
    const kopie = JSON.parse(JSON.stringify(run));
    const oiu = kopie.orbsInUitvoering[planOrbId];
    if (!oiu) return;
    delete oiu.handmatig;
    oiu.status = "afgekeurd";
    oiu.poort = {
      ...(oiu.poort || {}),
      besluit: "afgekeurd",
      redenen: ["De handmatige goedkeuring is teruggedraaid."],
    };
    kopie.fase = "genereren";
    kopie.samenhang = null;
    kopie.publicatieStatus = "niet-gestart";
    await bewaarRunInRij(kopie);
    setRun(kopie);
    setMelding("Handmatige goedkeuring teruggedraaid.");
  }

  if (!geladen) return <p className="text-gray-500">Laden…</p>;

  const alleOrbs = run && run.plan ? Object.values(run.orbsInUitvoering) : [];
  const aantalGroen = alleOrbs.filter((x) => x.status === "goedgekeurd").length;
  const heeftBuitenScope = alleOrbs.some((x) => x.status === "buiten-scope");
  const klaarVoorPublicatie = run && run.fase === "klaar";
  const kanHervatten = kanRunAutomatischVerder(run);
  const bronWijziging = run && run.fase === "gestrand" && run.foutcode === "bron-gewijzigd";
  const handmatigWerkNodig =
    run &&
    run.fase === "genereren" &&
    !kanHervatten &&
    alleOrbs.some((x) => ["fout", "afgekeurd", "buiten-scope"].includes(x.status));

  return (
    <div>
      <p className="text-gray-500 mb-6">
        Lever voldoende bronnen aan voor een heel leerpad, en het systeem plant, schrijft,
        toetst en redigeert alle lessen zelf. Publicatie is alles-of-niets: er komt nooit
        een half of ongecontroleerd pad in de boom. Ingrijpen mag, maar hoeft niet.
      </p>

      {melding && (
        <div className="mb-4 border-2 border-green-500 bg-green-50 rounded-lg p-4">
          <p className="text-sm font-semibold text-green-800">{melding}</p>
        </div>
      )}

      {!run && (
        <div className="bg-white border border-gray-300 rounded-lg p-5">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Voor welk domein?
          </label>
          <select
            value={domeinId}
            onChange={(e) => setDomeinId(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white mb-3"
          >
            {domeinen.map((d) => (
              <option key={d.id} value={d.id}>
                {d.naam} ({(bronnen[d.id] || []).length} bron(nen))
              </option>
            ))}
          </select>

          {domeinBronnen.length === 0 ? (
            <p className="text-sm text-amber-800 border border-dashed border-amber-300 bg-amber-50 rounded-lg p-3">
              Dit domein heeft nog geen bronnen. Een leerpad wordt volledig tegen de bronnen
              getoetst — zonder bronnenset kan er niets automatisch worden goedgekeurd.
              Voeg eerst bronnen toe onder het tabblad Bronnen.
            </p>
          ) : (
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-700 mb-3">
                <input
                  type="checkbox"
                  checked={autoPubliceer}
                  onChange={(e) => setAutoPubliceer(e.target.checked)}
                />
                Publiceer automatisch als alles in één keer goedgekeurd is
              </label>
              <button
                onClick={start}
                disabled={bezig}
                className={`w-full text-sm font-semibold px-4 py-2.5 rounded-md ${
                  bezig
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-gray-900 text-white hover:bg-gray-700"
                }`}
              >
                Genereer leerpad
              </button>
            </div>
          )}
        </div>
      )}

      {bezig && (
        <div className="mt-4 border border-blue-300 bg-blue-50 rounded-lg p-4">
          <p className="text-sm font-semibold text-blue-900">{stand || "Bezig…"}</p>
          <p className="text-xs text-blue-700 mt-1">
            Elke stap wordt tussentijds opgeslagen. Sluit je de browser, dan kun je hier
            gewoon hervatten.
          </p>
        </div>
      )}

      {run && !bezig && (
        <div className="mt-4 space-y-4">
          {/* --- status van de run --- */}
          <div className="bg-white border border-gray-300 rounded-lg p-4 flex items-start justify-between flex-wrap gap-2">
            <div>
              <p className="font-semibold text-gray-900">
                Run voor {(domeinen.find((d) => d.id === run.domeinId) || {}).naam || run.domeinId}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                Fase: <span className="font-semibold">{run.fase}</span>
                {run.plan &&
                  ` · ${aantalGroen}/${alleOrbs.length} orbs goedgekeurd`}
              </p>
            </div>
            <div className="flex gap-2">
              {run.fase !== "klaar" && run.fase !== "gestrand" && kanHervatten && (
                <button
                  onClick={() => draai(run)}
                  className="text-sm font-semibold px-4 py-2 rounded-md bg-gray-900 text-white hover:bg-gray-700"
                >
                  Hervatten
                </button>
              )}
              {run.fase === "gestrand" && !bronWijziging && (
                <button
                  onClick={() => draai(run)}
                  className="text-sm font-semibold px-4 py-2 rounded-md border border-gray-300 text-gray-600 hover:border-gray-900"
                >
                  Hervat mislukte stap
                </button>
              )}
              <button
                onClick={verwijderRun}
                className="text-sm font-semibold px-4 py-2 rounded-md border border-gray-300 text-gray-600 hover:border-red-600 hover:text-red-600"
              >
                Run verwijderen
              </button>
            </div>
          </div>

          {run.fase === "gestrand" && (
            <div className="border border-red-300 bg-red-50 rounded-lg p-4">
              <p className="text-sm font-semibold text-red-800">De run is gestrand.</p>
              <p className="text-sm text-red-700 mt-1">
                {run.foutmelding ||
                  (run.logboek[run.logboek.length - 1] || {}).melding ||
                  "Onbekende oorzaak."}
              </p>
              <p className="text-xs text-red-700 mt-2">
                {bronWijziging
                  ? "Deze run hoort bij een oudere bronnenset. Verwijder de run en start daarna opnieuw."
                  : `De bewaarde voortgang blijft staan. Hervatten gaat verder bij ${
                      run.hervatFase || bepaalHervatFase(run)
                    }.`}
              </p>
            </div>
          )}

          {handmatigWerkNodig && (
            <div className="border border-amber-300 bg-amber-50 rounded-lg p-4">
              <p className="text-sm font-semibold text-amber-900">
                De automatische stappen zijn klaar; één of meer orbs vragen aandacht.
              </p>
              <p className="text-sm text-amber-800 mt-1">
                Open de rode of oranje orb en kies opnieuw genereren, opnieuw toetsen,
                handmatig goedkeuren of buiten-scope verwijderen. Daarna verschijnt Hervatten
                weer voor de samenhangscontrole.
              </p>
            </div>
          )}

          {/* --- het plan met per orb de status --- */}
          {run.plan &&
            topologischeVolgordePlan(run.plan.topics).map((t) => (
              <div key={t.planTopicId} className="bg-white border border-gray-300 rounded-lg p-4">
                <div className="flex items-baseline justify-between flex-wrap gap-1">
                  <p className="font-semibold text-gray-900">{t.titel}</p>
                  <span className="text-xs text-gray-400">
                    tier {t.tier}
                    {t.prerequisites[0] ? ` · na ${t.prerequisites[0]}` : " · stam"}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-3">{t.leerdoel}</p>

                <div className="space-y-2">
                  {t.orbs.map((o) => {
                    const oiu = run.orbsInUitvoering[o.planOrbId] || { status: "gepland" };
                    const isOpen = openOrb === o.planOrbId;
                    return (
                      <div
                        key={o.planOrbId}
                        className={`border rounded-lg ${ORB_STATUS_STIJL[oiu.status] || ORB_STATUS_STIJL.gepland}`}
                      >
                        <button
                          onClick={() => setOpenOrb(isOpen ? null : o.planOrbId)}
                          className="w-full text-left px-3 py-2 flex items-center justify-between gap-2"
                        >
                          <span className="text-sm font-medium">
                            {(oiu.orb && oiu.orb.titel) || o.titel}
                          </span>
                          <span className="text-xs font-semibold uppercase tracking-wide shrink-0">
                            {oiu.status}
                          </span>
                        </button>

                        {isOpen && (
                          <div className="px-3 pb-3 bg-white rounded-b-lg">
                            {oiu.foutmelding && (
                              <p className="text-sm text-red-700 mt-2">{oiu.foutmelding}</p>
                            )}
                            {oiu.poort && oiu.poort.redenen && oiu.poort.redenen.length > 0 && (
                              <div className="text-sm text-gray-700 mt-2">
                                <p className="font-semibold">Poortwachter:</p>
                                {oiu.poort.redenen.map((rd, i) => (
                                  <p key={i}>— {rd}</p>
                                ))}
                              </div>
                            )}
                            {oiu.orb && (
                              <Scorekaart
                                orb={{
                                  ...oiu.orb,
                                  bronControle: oiu.bronControle,
                                  redactie: oiu.redactie,
                                }}
                                heeftBronnen={true}
                                opTekstVervangen={(blokIndex, nieuweTekst) =>
                                  vervangTekst(o.planOrbId, blokIndex, nieuweTekst)
                                }
                              />
                            )}
                            <div className="flex gap-2 mt-3 flex-wrap">
                              {oiu.status === "fout" && (
                                <button
                                  onClick={() => hervatMislukteOrb(o.planOrbId)}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-700"
                                >
                                  Hervat mislukte stap
                                </button>
                              )}
                              {(oiu.status === "fout" || oiu.status === "afgekeurd") && (
                                <button
                                  onClick={() => opnieuwOrb(o.planOrbId)}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:border-gray-900"
                                >
                                  Hele orb opnieuw genereren
                                </button>
                              )}
                              {oiu.status === "afgekeurd" && oiu.orb && (
                                <button
                                  onClick={() => opnieuwToetsen(o.planOrbId)}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:border-gray-900"
                                >
                                  Opnieuw toetsen (na handmatige aanpassing)
                                </button>
                              )}
                            </div>

                            {oiu.orb && (oiu.status === "afgekeurd" || oiu.handmatig) && (
                              <HandmatigeBewerking
                                oiu={oiu}
                                opBlokBewerken={(i, t) => bewerkBlok(o.planOrbId, i, t)}
                                opVraagBewerken={(i, veld, waarde, optieIndex) =>
                                  bewerkVraag(o.planOrbId, i, veld, waarde, optieIndex)
                                }
                                opGoedkeuren={(reden) => keurHandmatigGoed(o.planOrbId, reden)}
                                opTerugdraaien={() => draaiHandmatigTerug(o.planOrbId)}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

          {heeftBuitenScope && (
            <div className="border border-amber-300 bg-amber-50 rounded-lg p-4">
              <p className="text-sm text-amber-900">
                Eén of meer orbs vielen buiten de scope van het platform. Ze kunnen niet
                gepubliceerd worden; haal ze uit het plan en laat de samenhang opnieuw
                controleren.
              </p>
              <button
                onClick={buitenScopeWeg}
                className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-700"
              >
                Buiten-scope orbs uit het plan halen
              </button>
            </div>
          )}

          {/* --- samenhang --- */}
          {run.samenhang && (
            <div className="bg-white border border-gray-300 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                  Samenhang van het pad
                </p>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                    run.samenhang.besluit === "goed"
                      ? "border-green-300 bg-green-50 text-green-800"
                      : "border-amber-300 bg-amber-50 text-amber-900"
                  }`}
                >
                  {run.samenhang.besluit}
                </span>
              </div>
              {run.samenhang.begrippenfouten.length > 0 && (
                <div className="text-sm text-red-700 mb-2">
                  {run.samenhang.begrippenfouten.map((f, i) => (
                    <p key={i}>— {f.melding}</p>
                  ))}
                </div>
              )}
              {run.samenhang.bevindingen.length === 0 &&
              run.samenhang.begrippenfouten.length === 0 ? (
                <p className="text-sm text-green-700">
                  Geen overlap, hiaten of volgordeproblemen gevonden.
                </p>
              ) : (
                run.samenhang.bevindingen.map((b, i) => (
                  <p key={i} className="text-sm text-gray-700">
                    <span className="font-semibold uppercase text-xs">{b.soort}</span> ({b.waar},{" "}
                    {b.ernst}): {b.wat}
                  </p>
                ))
              )}
            </div>
          )}

          {/* --- publicatie --- */}
          {blokkades && (
            <div className="border border-red-300 bg-red-50 rounded-lg p-4">
              <p className="text-sm font-semibold text-red-800 mb-1">
                De publicatiepoort houdt dit tegen:
              </p>
              {blokkades.map((b, i) => (
                <p key={i} className="text-sm text-red-700">
                  — {b}
                </p>
              ))}
            </div>
          )}

          {/* Verantwoording aan de beheerkant: welke orbs zijn op jouw oordeel
              vrijgegeven. Dit staat bewust hier en nergens aan de leerkant. */}
          {alleOrbs.some((x) => x.handmatig && x.handmatig.reden) && (
            <div className="border border-blue-300 bg-blue-50 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-900 mb-1">
                Door jou goedgekeurd, niet door de toetser:
              </p>
              {run.plan.topics.map((t) =>
                t.orbs.map((o) => {
                  const x = run.orbsInUitvoering[o.planOrbId];
                  if (!x || !x.handmatig || !x.handmatig.reden) return null;
                  return (
                    <p key={o.planOrbId} className="text-sm text-blue-800">
                      — <strong>{t.titel} / {o.titel}</strong>: {x.handmatig.reden}
                    </p>
                  );
                })
              )}
              <p className="text-xs text-blue-700 mt-2">
                Publiceren gebeurt daarom niet automatisch. De lerende ziet deze
                markering nergens — niet bij het leerpad en niet bij de orb.
              </p>
            </div>
          )}

          {klaarVoorPublicatie && (
            <button
              onClick={() => publiceer(run)}
              className="w-full text-sm font-semibold px-4 py-3 rounded-md bg-gray-900 text-white hover:bg-gray-700"
            >
              Publiceer leerpad ({aantalGroen} orbs, alles-of-niets)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Beheer({ domeinen, topics, bronnen, opOpslaan, tijdOffset, setTijdOffset, kennis }) {
  const [tab, setTab] = useState("content"); // content | leerpad | bronnen | domeinen

  // --- domeinen ---
  const [nieuwDomein, setNieuwDomein] = useState({ naam: "", omschrijving: "", kleur: "#F6A923" });
  const [domeinMelding, setDomeinMelding] = useState(null); // { id, naam } net aangemaakt
  const [bronDomeinId, setBronDomeinId] = useState(""); // voorgeselecteerd domein voor het bronnenscherm

  function voegDomeinToe() {
    if (nieuwDomein.naam.trim().length < 2) return;
    const id = nieuwDomein.naam.trim().toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
    const naam = nieuwDomein.naam.trim();
    opOpslaan({
      domeinen: [...domeinen, { ...nieuwDomein, id, naam }],
      topics,
      bronnen,
    });
    setNieuwDomein({ naam: "", omschrijving: "", kleur: "#F6A923" });
    setDomeinMelding({ id, naam });
  }

  function verwijderDomein(id) {
    const overigeBronnen = { ...bronnen };
    delete overigeBronnen[id];
    opOpslaan({
      domeinen: domeinen.filter((d) => d.id !== id),
      topics: topics.filter((t) => t.domeinId !== id),
      bronnen: overigeBronnen,
    });
  }

  // --- content ---
  const [doel, setDoel] = useState("");
  const [nieuwTopic, setNieuwTopic] = useState({ titel: "", ondertitel: "", domeinId: "", voorgangerId: "" });
  const [ruw, setRuw] = useState("");
  const [aantal, setAantal] = useState(1);
  const [bezig, setBezig] = useState(false);
  const [stand, setStand] = useState(null); // "orb 2 van 3"
  const [fout, setFout] = useState(null);
  const [buitenScope, setBuitenScope] = useState(null);
  const [concept, setConcept] = useState(null);
  const [melding, setMelding] = useState(null);

  const nieuw = doel === "__nieuw__";
  const kan =
    ruw.trim().length > 50 &&
    (nieuw ? nieuwTopic.titel.trim().length > 2 && nieuwTopic.domeinId : doel !== "");

  // heeft het gekozen domein een bronnenset?
  const actiefDomeinId = nieuw
    ? nieuwTopic.domeinId
    : (topics.find((t) => t.id === doel) || {}).domeinId;
  const heeftBronnen = (bronnen[actiefDomeinId] || []).length > 0;

  // Welke tier krijgt dit onderwerp, en wat kent de lezer op dat punt al?
  // Voor een nieuw onderwerp leiden we het af uit de gekozen voorganger.
  let werkTopic;
  if (nieuw) {
    const plaatsing = berekenPlaatsing(topics, nieuwTopic.domeinId, nieuwTopic.voorgangerId || null);
    werkTopic = { domeinId: nieuwTopic.domeinId, ...plaatsing };
  } else {
    werkTopic = topics.find((t) => t.id === doel) || { prerequisites: [], gridPos: { tier: 1, track: 1 } };
  }
  const actiefTier = topicTier(werkTopic);
  const alBekend = actiefDomeinId ? bekendeBegrippen(topics, werkTopic) : [];

  async function genereer() {
    setBezig(true);
    setFout(null);
    setBuitenScope(null);
    setConcept(null);
    setStand(null);
    try {
      const domId = nieuw ? nieuwTopic.domeinId : topics.find((t) => t.id === doel).domeinId;
      const dom = domeinen.find((d) => d.id === domId);
      const bronTekst = (bronnen[domId] || []).map((b) => b.tekst).join("\n\n---\n\n");
      const tier = actiefTier;
      const bekend = alBekend;

      const namen = {
        tekst: "tekst schrijven",
        vragen: "vragen schrijven",
        bron: "toetsen aan de bronnen",
        redactie: "redactie",
      };
      const orbs = await maakOrbs(
        ruw,
        aantal,
        dom ? dom.naam : "algemeen",
        (i, n, stap) => {
          const wat = namen[stap] || "bezig";
          setStand(n > 1 ? `Orb ${i} van ${n} — ${wat}…` : `Bezig: ${wat}…`);
        },
        bronTekst,
        tier,
        bekend
      );
      setConcept(orbs);
    } catch (e) {
      if (e instanceof BuitenScope) {
        setBuitenScope(e.message);
      } else {
        setFout(e.message || "Er ging iets mis bij het omzetten.");
      }
    }
    setStand(null);
    setBezig(false);
  }

  function publiceer() {
    // De controle-uitslagen zijn hulpmiddelen voor jou, geen lesstof.
    // Ze gaan niet mee de app in.
    const schoon = concept.map(({ bronControle, redactie, ...orb }) => orb);
    let nieuweTopics;
    if (nieuw) {
      const plaatsing = berekenPlaatsing(
        topics,
        nieuwTopic.domeinId,
        nieuwTopic.voorgangerId || null
      );
      nieuweTopics = [
        ...topics,
        {
          id: `topic-${Date.now()}`,
          domeinId: nieuwTopic.domeinId,
          prerequisites: plaatsing.prerequisites,
          gridPos: plaatsing.gridPos,
          titel: nieuwTopic.titel.trim(),
          ondertitel: nieuwTopic.ondertitel.trim() || "Eigen lesstof",
          orbs: schoon,
        },
      ];
    } else {
      nieuweTopics = topics.map((t) =>
        t.id === doel ? { ...t, orbs: [...t.orbs, ...schoon] } : t
      );
    }

    opOpslaan({ domeinen, topics: nieuweTopics, bronnen });
    setMelding(`${concept.length} orb(s) toegevoegd.`);
    setConcept(null);
    setRuw("");
    setNieuwTopic({ titel: "", ondertitel: "", domeinId: "", voorgangerId: "" });
    setTimeout(() => setMelding(null), 6000);
  }

  const nuBeheer = Date.now() + tijdOffset;
  const aantalDueBeheer = vragenDieAanDeBeurtZijn(topics, kennis || {}, nuBeheer).length;

  return (
    <div>
      {/* ================================================================
          TESTKLOK — alleen om het Leitner-systeem zelf te kunnen
          verifiëren zonder weken te wachten. Hoort niet mee naar de
          echte uitrol; staat weer op 0 bij een herstart.
      ================================================================= */}
      <div className="mb-6 border-2 border-dashed border-blue-300 bg-blue-50 rounded-lg p-4">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <p className="text-sm font-semibold text-blue-900">
              Testklok — {tijdOffset === 0 ? "nu" : `+${Math.round(tijdOffset / DAG)} dag(en) vooruit`}
            </p>
            <p className="text-xs text-blue-700 mt-0.5 max-w-md">
              Voor het testen van het herhaalsysteem: laat de tijd voor deze sessie
              versneld verstrijken, zonder dat je echt hoeft te wachten. Dit is een
              hulpmiddel — het gaat niet mee naar de echte app.
            </p>
          </div>
          {tijdOffset !== 0 && (
            <button
              onClick={() => setTijdOffset(0)}
              className="text-xs font-semibold text-blue-700 underline shrink-0"
            >
              Terug naar nu
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {[
            ["+1 dag", 1],
            ["+3 dagen", 3],
            ["+1 week", 7],
            ["+3 weken", 21],
            ["+2 maanden", 60],
          ].map(([label, dagen]) => (
            <button
              key={label}
              onClick={() => setTijdOffset((o) => o + dagen * DAG)}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-blue-300 bg-white text-blue-800 hover:bg-blue-100"
            >
              {label}
            </button>
          ))}
        </div>

        <p className="text-xs text-blue-700 mt-2">
          Op dit moment {aantalDueBeheer === 0 ? "is niets" : `${aantalDueBeheer === 1 ? "is 1 vraag" : `zijn ${aantalDueBeheer} vragen`}`} aan de beurt om te herhalen.
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        {[
          ["content", "Lesstof toevoegen"],
          ["leerpad", "Leerpad genereren"],
          ["bronnen", "Bronnen"],
          ["domeinen", "Domeinen beheren"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`text-sm px-4 py-2 rounded-md border font-medium ${
              tab === id
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 bg-white text-gray-600 hover:border-gray-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ---------------- LEERPAD ---------------- */}
      {tab === "leerpad" && (
        <LeerpadBeheer domeinen={domeinen} topics={topics} bronnen={bronnen} opOpslaan={opOpslaan} />
      )}

      {/* ---------------- BRONNEN ---------------- */}
      {tab === "bronnen" && <BronBeheer domeinen={domeinen} topics={topics} bronnen={bronnen} opOpslaan={opOpslaan} startDomeinId={bronDomeinId} />}

      {/* ---------------- DOMEINEN ---------------- */}
      {tab === "domeinen" && (
        <div>
          <p className="text-gray-500 mb-6">
            Domeinen zijn de hoofdindeling van het platform. Voeg er een toe — bijvoorbeeld
            BHV of Veiligheid — en je kunt er meteen lesstof onder hangen. Er hoeft niets
            herbouwd te worden.
          </p>

          {domeinMelding && (
            <div className="mb-6 border-2 border-gray-900 bg-white rounded-lg p-4">
              <p className="font-semibold text-gray-900">
                Domein “{domeinMelding.naam}” aangemaakt
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Eén ding nog: voeg voor dit domein een <strong>bron</strong> toe voordat je
                lesstof maakt — bijvoorbeeld het KAM-handboek, een richtlijn of je eigen
                materiaal. Daar wordt alles tegen getoetst. Zonder bron kan de omzetter niet
                op juistheid controleren, alleen op taal en vorm.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => {
                    setBronDomeinId(domeinMelding.id);
                    setTab("bronnen");
                    setDomeinMelding(null);
                  }}
                  className="text-sm font-semibold px-4 py-2 rounded-md bg-gray-900 text-white hover:bg-gray-700"
                >
                  Nu een bron toevoegen
                </button>
                <button
                  onClick={() => setDomeinMelding(null)}
                  className="text-sm font-semibold px-4 py-2 rounded-md border border-gray-300 text-gray-600 hover:border-gray-900"
                >
                  Later
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2 mb-6">
            {domeinen.map((dom) => {
              const aantalTopics = topics.filter((t) => t.domeinId === dom.id).length;
              return (
                <div
                  key={dom.id}
                  className="flex items-center gap-3 border border-gray-300 rounded-lg bg-white px-4 py-3"
                >
                  <span
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: dom.kleur }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{dom.naam}</p>
                    <p className="text-sm text-gray-500">{dom.omschrijving}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {aantalTopics} onderwerp(en)
                  </span>
                  <button
                    onClick={() => verwijderDomein(dom.id)}
                    className="text-xs text-gray-400 hover:text-red-600 shrink-0"
                  >
                    Verwijder
                  </button>
                </div>
              );
            })}
          </div>

          <div className="bg-white border border-gray-300 rounded-lg p-5">
            <p className="text-sm font-semibold text-gray-900 mb-3">Nieuw domein</p>
            <div className="space-y-2">
              <input
                value={nieuwDomein.naam}
                onChange={(e) => setNieuwDomein({ ...nieuwDomein, naam: e.target.value })}
                placeholder="Naam, bijv. BHV"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
              <input
                value={nieuwDomein.omschrijving}
                onChange={(e) =>
                  setNieuwDomein({ ...nieuwDomein, omschrijving: e.target.value })
                }
                placeholder="Omschrijving, bijv. Eerste hulp en ontruiming"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Kleur</span>
                <div className="flex gap-2">
                  {["#F6A923", "#4A9D8F", "#6B7FD7", "#D4537E", "#639922", "#1D1D1B"].map(
                    (k) => (
                      <button
                        key={k}
                        onClick={() => setNieuwDomein({ ...nieuwDomein, kleur: k })}
                        aria-label={`Kleur ${k}`}
                        className={`w-7 h-7 rounded-full border-2 ${
                          nieuwDomein.kleur === k ? "border-gray-900" : "border-transparent"
                        }`}
                        style={{ backgroundColor: k }}
                      />
                    )
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={voegDomeinToe}
              disabled={nieuwDomein.naam.trim().length < 2}
              className={`mt-4 w-full text-sm font-semibold px-4 py-2.5 rounded-md ${
                nieuwDomein.naam.trim().length < 2
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-gray-900 text-white hover:bg-gray-700"
              }`}
            >
              Domein aanmaken
            </button>
          </div>
        </div>
      )}

      {/* ---------------- CONTENT ---------------- */}
      {tab === "content" && (
        <div>
          <p className="text-gray-500 mb-6">
            Plak je materiaal. Het wordt omgezet naar leerblokken met vragen — inclusief
            grafieken en tijdlijnen waar de stof zich ervoor leent. Je kunt alles bijschaven
            voordat het live gaat.
          </p>

          {melding && (
            <div className="mb-6 border border-green-600 bg-green-50 rounded-lg px-4 py-3 text-sm text-green-800">
              {melding}
            </div>
          )}

          <div className="bg-white border border-gray-300 rounded-lg p-5 mb-4">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Waar hoort dit bij?
            </label>
            <OnderwerpKiezer
              domeinen={domeinen}
              topics={topics}
              waarde={doel}
              opKiezen={setDoel}
            />

            {nieuw && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <select
                  value={nieuwTopic.domeinId}
                  onChange={(e) =>
                    setNieuwTopic({ ...nieuwTopic, domeinId: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                >
                  <option value="">Kies een domein…</option>
                  {domeinen.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.naam}
                    </option>
                  ))}
                </select>
                <input
                  value={nieuwTopic.titel}
                  onChange={(e) => setNieuwTopic({ ...nieuwTopic, titel: e.target.value })}
                  placeholder="Titel, bijv. Slaap en herstel"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
                <input
                  value={nieuwTopic.ondertitel}
                  onChange={(e) =>
                    setNieuwTopic({ ...nieuwTopic, ondertitel: e.target.value })
                  }
                  placeholder="Ondertitel"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Dit onderwerp bouwt voort op…
                  </label>
                  <select
                    value={nieuwTopic.voorgangerId}
                    onChange={(e) =>
                      setNieuwTopic({ ...nieuwTopic, voorgangerId: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Niets — dit is een nieuwe stam</option>
                    {topics
                      .filter((t) => t.domeinId === nieuwTopic.domeinId)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.titel} ({tierInfo(topicTier(t)).naam})
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    {nieuwTopic.voorgangerId
                      ? `Komt in de boom te staan als ${tierInfo(actiefTier).naam.toLowerCase()}, na het gekozen onderwerp. De lezer mag dan alles kennen wat daar is uitgelegd.`
                      : "Een stam is een beginpunt: geen voorkennis verondersteld, elk vakwoord wordt uitgelegd."}
                  </p>
                </div>
              </div>
            )}
          </div>

          {doel && doel !== "__nieuw__" && (
            (() => {
              const gekozenTopic = topics.find((t) => t.id === doel);
              return gekozenTopic ? (
                <BestaandeOrbsBeheer
                  topic={gekozenTopic}
                  domeinen={domeinen}
                  topics={topics}
                  bronnen={bronnen}
                  opOpslaan={opOpslaan}
                />
              ) : null;
            })()
          )}

          <div className="bg-white border border-gray-300 rounded-lg p-5 mb-4">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Je materiaal
            </label>
            <textarea
              value={ruw}
              onChange={(e) => setRuw(e.target.value)}
              rows={9}
              placeholder="Plak hier je aantekeningen, uitleg of bronmateriaal. Getallen en tegenwerpingen komen goed van pas — daar maakt de omzetter grafieken en scherpe vragen van."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm leading-relaxed"
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Verdeel over</span>
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    onClick={() => setAantal(n)}
                    className={`w-9 h-9 text-sm rounded-md border ${
                      aantal === n
                        ? "border-gray-900 bg-gray-900 text-white font-semibold"
                        : "border-gray-300 text-gray-600"
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <span className="text-sm text-gray-600">orb(s)</span>
              </div>
              <span className="text-xs text-gray-400">{ruw.trim().length} tekens</span>
            </div>
          </div>

          <button
            onClick={genereer}
            disabled={!kan || bezig}
            className={`w-full text-sm font-semibold px-4 py-3 rounded-md mb-6 ${
              !kan || bezig
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-gray-900 text-white hover:bg-gray-700"
            }`}
          >
            {bezig ? stand || "Bezig met omzetten…" : "Zet om naar leerblokken"}
          </button>

          {fout && (
            <div className="mb-6 border border-red-500 bg-red-50 rounded-lg px-4 py-3 text-sm text-red-700">
              {fout}
            </div>
          )}

          {buitenScope && (
            <div className="mb-6 border border-gray-900 bg-white rounded-lg p-5">
              <p className="font-semibold text-gray-900">Buiten de scope van dit platform</p>
              <p className="text-sm text-gray-600 mt-1">{buitenScope}</p>
              <p className="text-sm text-gray-500 mt-3 border-t pt-3">
                Dit platform gaat over kennis die gedrag verandert. Zodra extra diepgang niets
                meer verandert aan wat iemand doet of gelooft, houdt het op. Dat is een grens
                van de app, geen oordeel over de lezer.
              </p>
            </div>
          )}

          {concept && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Concept — nog niet gepubliceerd
              </h2>
              <p className="text-sm text-gray-500 mb-3">
                {tierInfo(actiefTier).naam} · taalniveau {TAALNIVEAU} ·{" "}
                {alBekend.length === 0
                  ? "begin van de leerlijn, elk vakwoord wordt uitgelegd"
                  : `${alBekend.length} woord(en) mocht de schrijver bekend veronderstellen`}
              </p>

              <div className="space-y-4">
                {concept.map((orb, i) => (
                  <div
                    key={orb.id}
                    className="bg-white border-2 border-dashed border-gray-400 rounded-lg p-5"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <input
                        value={orb.titel}
                        onChange={(e) =>
                          setConcept((c) =>
                            c.map((o, j) => (j === i ? { ...o, titel: e.target.value } : o))
                          )
                        }
                        className="text-lg font-bold text-gray-900 w-full border-b border-transparent hover:border-gray-300 focus:border-gray-900 outline-none"
                      />
                      <button
                        onClick={() =>
                          setConcept((c) => {
                            const n = c.filter((_, j) => j !== i);
                            return n.length ? n : null;
                          })
                        }
                        className="text-xs text-gray-400 hover:text-red-600 shrink-0"
                      >
                        Verwijder
                      </button>
                    </div>

                    <div className="space-y-3">
                      {orb.blokken.map((blok, j) => {
                        const wijzigBlok = (veld, waarde) =>
                          setConcept((c) =>
                            c.map((o, oi) =>
                              oi === i
                                ? {
                                    ...o,
                                    blokken: o.blokken.map((b, bi) =>
                                      bi === j ? { ...b, [veld]: waarde } : b
                                    ),
                                  }
                                : o
                            )
                          );

                        return (
                          <div key={j}>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
                                {blok.type}
                              </p>
                              <button
                                onClick={() =>
                                  setConcept((c) =>
                                    c.map((o, oi) =>
                                      oi === i
                                        ? { ...o, blokken: o.blokken.filter((_, bi) => bi !== j) }
                                        : o
                                    )
                                  )
                                }
                                className="text-xs text-gray-400 hover:text-red-600"
                              >
                                Blok weg
                              </button>
                            </div>

                            {blok.type === "tekst" && (
                              <textarea
                                value={blok.tekst}
                                onChange={(e) => wijzigBlok("tekst", e.target.value)}
                                rows={3}
                                className="w-full text-sm text-gray-700 leading-relaxed p-2 rounded border border-gray-200 focus:border-gray-900 outline-none resize-none"
                              />
                            )}

                            {blok.type === "afbeelding" && (
                              <div className="space-y-2">
                                <input
                                  value={blok.url || ""}
                                  onChange={(e) => wijzigBlok("url", e.target.value)}
                                  placeholder="Adres van de afbeelding (https://…)"
                                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                />
                                <input
                                  value={blok.bijschrift || ""}
                                  onChange={(e) => wijzigBlok("bijschrift", e.target.value)}
                                  placeholder="Bijschrift"
                                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                />
                                <input
                                  value={blok.alt || ""}
                                  onChange={(e) => wijzigBlok("alt", e.target.value)}
                                  placeholder="Beschrijving voor wie de afbeelding niet ziet"
                                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                />
                                <Blok blok={blok} kleur="#888880" />
                              </div>
                            )}

                            {blok.type !== "tekst" && blok.type !== "afbeelding" && (
                              <Blok blok={blok} kleur="#888880" />
                            )}
                          </div>
                        );
                      })}

                      <button
                        onClick={() =>
                          setConcept((c) =>
                            c.map((o, oi) =>
                              oi === i
                                ? {
                                    ...o,
                                    blokken: [
                                      ...o.blokken,
                                      { type: "afbeelding", url: "", bijschrift: "", alt: "" },
                                    ],
                                  }
                                : o
                            )
                          )
                        }
                        className="w-full text-sm px-3 py-2 rounded-md border border-dashed border-gray-300 text-gray-500 hover:border-gray-900 hover:text-gray-900"
                      >
                        + Eigen afbeelding toevoegen
                      </button>
                    </div>

                    <div className="mt-3 border-l-4 border-gray-300 pl-3">
                      <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1">
                        Haakje
                      </p>
                      <textarea
                        value={orb.haakje}
                        onChange={(e) =>
                          setConcept((c) =>
                            c.map((o, j) => (j === i ? { ...o, haakje: e.target.value } : o))
                          )
                        }
                        rows={2}
                        className="w-full text-sm italic text-gray-900 p-1 rounded border border-transparent hover:border-gray-200 focus:border-gray-900 outline-none resize-none"
                      />
                    </div>

                    {orb.begrippen && orb.begrippen.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1">
                          Introduceert {orb.begrippen.length} nieuw(e) woord(en)
                        </p>
                        <div className="border border-gray-200 rounded-lg bg-gray-50 p-3 space-y-1.5">
                          {orb.begrippen.map((b, bi) => (
                            <div key={bi}>
                              <span className="text-sm font-semibold text-gray-900">{b.term}</span>
                              <span className="text-sm text-gray-600"> — {b.uitleg}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 border-t pt-3">
                      {orb.vragen.map((v, k) => (
                        <div key={k} className="mb-3 last:mb-0">
                          <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
                            {v.type}
                          </p>
                          <p className="text-sm font-semibold text-gray-900 mt-0.5">
                            {v.vraag}
                          </p>
                          {v.type === "meerkeuze" && (
                            <ul className="mt-1 space-y-0.5">
                              {v.opties.map((o, oi) => (
                                <li
                                  key={oi}
                                  className={`text-sm ${
                                    oi === v.juisteIndex
                                      ? "text-green-700 font-medium"
                                      : "text-gray-500"
                                  }`}
                                >
                                  {oi === v.juisteIndex ? "✓ " : "· "}
                                  {o}
                                </li>
                              ))}
                            </ul>
                          )}
                          {v.type === "sorteren" && (
                            <ol className="mt-1 space-y-0.5">
                              {v.juisteVolgorde.map((idx, pos) => (
                                <li key={pos} className="text-sm text-green-700">
                                  {pos + 1}. {v.items[idx]}
                                </li>
                              ))}
                            </ol>
                          )}
                          {v.type === "matchen" && (
                            <ul className="mt-1 space-y-0.5">
                              {v.paren.map((p, pi) => (
                                <li key={pi} className="text-sm text-green-700">
                                  {p.links} → {p.rechts}
                                </li>
                              ))}
                            </ul>
                          )}
                          <p className="text-xs text-gray-500 mt-1 italic">{v.uitleg}</p>
                        </div>
                      ))}
                    </div>

                    <Scorekaart
                      orb={orb}
                      heeftBronnen={heeftBronnen}
                      opTekstVervangen={(blokIndex, nieuweTekst) =>
                        setConcept((c) =>
                          c.map((o, oi) =>
                            oi === i
                              ? {
                                  ...o,
                                  blokken: o.blokken.map((b, bi) =>
                                    bi === blokIndex && b.type === "tekst"
                                      ? { ...b, tekst: nieuweTekst }
                                      : b
                                  ),
                                }
                              : o
                          )
                        )
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={publiceer}
                  className="flex-1 text-sm font-semibold px-4 py-3 rounded-md bg-gray-900 text-white hover:bg-gray-700"
                >
                  Publiceer in het leertraject
                </button>
                <button
                  onClick={() => setConcept(null)}
                  className="text-sm font-semibold px-4 py-3 rounded-md border border-gray-300 text-gray-600 hover:border-gray-900"
                >
                  Weggooien
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BRONNENBEHEER
// Per domein lever je de documenten aan die als waarheid gelden. Wat er niet in
// staat, komt niet in de les. Dit is wat het platform dummyproof maakt: de
// KAM-coördinator kan niets toevoegen dat niet in het handboek staat.
// ---------------------------------------------------------------------------
function BronBeheer({ domeinen, topics, bronnen, opOpslaan, startDomeinId }) {
  const [domeinId, setDomeinId] = useState(
    startDomeinId || (domeinen[0] ? domeinen[0].id : "")
  );
  const [naam, setNaam] = useState("");
  const [tekst, setTekst] = useState("");

  const huidige = bronnen[domeinId] || [];

  function voegToe() {
    if (naam.trim().length < 2 || tekst.trim().length < 100) return;
    const nieuw = {
      ...bronnen,
      [domeinId]: [
        ...huidige,
        { id: `bron-${Date.now()}`, naam: naam.trim(), tekst: tekst.trim() },
      ],
    };
    opOpslaan({ domeinen, topics, bronnen: nieuw });
    setNaam("");
    setTekst("");
  }

  function verwijder(id) {
    opOpslaan({
      domeinen,
      topics,
      bronnen: { ...bronnen, [domeinId]: huidige.filter((b) => b.id !== id) },
    });
  }

  const totaalTekens = huidige.reduce((s, b) => s + b.tekst.length, 0);

  return (
    <div>
      <p className="text-gray-500 mb-6">
        Per domein lever je de documenten aan die als waarheid gelden — het KAM-handboek,
        een richtlijn, een Gezondheidsraad-advies. Alles wat de omzetter schrijft wordt
        hiertegen getoetst. <strong className="text-gray-900">Wat niet in de bron staat,
        wordt gemarkeerd.</strong>
      </p>

      <div className="bg-white border border-gray-300 rounded-lg p-5 mb-4">
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          Voor welk domein?
        </label>
        <select
          value={domeinId}
          onChange={(e) => setDomeinId(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
        >
          {domeinen.map((d) => (
            <option key={d.id} value={d.id}>
              {d.naam} ({(bronnen[d.id] || []).length} bron(nen))
            </option>
          ))}
        </select>
      </div>

      {huidige.length === 0 ? (
        <div className="border border-dashed border-amber-400 bg-amber-50 rounded-lg p-4 mb-4">
          <p className="text-sm font-semibold text-amber-900">
            Nog geen bronnen voor dit domein
          </p>
          <p className="text-sm text-amber-800 mt-1">
            Zonder bronnen kan er niet op waarheid getoetst worden. De redacteur kijkt dan
            alleen naar kwaliteit, niet naar juistheid.
          </p>
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {huidige.map((b) => (
            <div
              key={b.id}
              className="flex items-start gap-3 border border-gray-300 rounded-lg bg-white px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{b.naam}</p>
                <p className="text-sm text-gray-500 truncate">{b.tekst.slice(0, 90)}…</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {b.tekst.length.toLocaleString("nl-NL")} tekens
                </p>
              </div>
              <button
                onClick={() => verwijder(b.id)}
                className="text-xs text-gray-400 hover:text-red-600 shrink-0"
              >
                Verwijder
              </button>
            </div>
          ))}
          <p className="text-xs text-gray-400">
            Samen {totaalTekens.toLocaleString("nl-NL")} tekens.
            {totaalTekens > 12000 &&
              " Let op: bij toetsing wordt het eerste deel gebruikt. Splits erg grote handboeken per onderwerp."}
          </p>
        </div>
      )}

      <DocumentSplitser
        domeinNaam={(domeinen.find((d) => d.id === domeinId) || {}).naam || ""}
        opToevoegen={(nieuweBronnen) => {
          opOpslaan({
            domeinen,
            topics,
            bronnen: {
              ...bronnen,
              [domeinId]: [
                ...huidige,
                ...nieuweBronnen.map((b, i) => ({
                  id: `bron-${Date.now()}-${i}`,
                  naam: b.naam,
                  tekst: b.tekst,
                })),
              ],
            },
          });
        }}
      />

      <div className="bg-white border border-gray-300 rounded-lg p-5">
        <p className="text-sm font-semibold text-gray-900 mb-3">Bron toevoegen</p>
        <input
          value={naam}
          onChange={(e) => setNaam(e.target.value)}
          placeholder="Naam, bijv. KAM-handboek hoofdstuk 4 — Gereedschap"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-2"
        />
        <textarea
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          rows={10}
          placeholder="Plak hier de tekst van het document. Dit wordt de waarheid waaraan getoetst wordt — dus plak de echte tekst, geen samenvatting."
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm leading-relaxed"
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-400">{tekst.trim().length} tekens</span>
          <button
            onClick={voegToe}
            disabled={naam.trim().length < 2 || tekst.trim().length < 100}
            className={`text-sm font-semibold px-4 py-2.5 rounded-md ${
              naam.trim().length < 2 || tekst.trim().length < 100
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-gray-900 text-white hover:bg-gray-700"
            }`}
          >
            Bron opslaan
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HANDMATIG BEWERKEN EN GOEDKEUREN
//
// Wanneer de toetser of de redacteur er niet uitkomt, moet een mens verder
// kunnen. Hier is de tekst vrij te bewerken en kun je de orb op eigen gezag
// vrijgeven, met verplichte reden.
//
// De markering leeft in de RUN (beheerkant), niet in de orb zelf. Bij het
// publiceren worden bronControle, redactie en poort van de orb gestript en
// staat handmatig daar sowieso buiten — de lerende ziet dus nergens dat een
// les handmatig is vrijgegeven, niet bij het leerpad en niet bij de orb.
// ---------------------------------------------------------------------------

function HandmatigeBewerking({ oiu, opBlokBewerken, opVraagBewerken, opGoedkeuren, opTerugdraaien }) {
  const [open, setOpen] = useState(false);
  const [reden, setReden] = useState("");
  const orb = oiu.orb;
  const blokken = Array.isArray(orb.blokken) ? orb.blokken : [];
  const vragen = Array.isArray(orb.vragen) ? orb.vragen : [];

  if (oiu.handmatig) {
    return (
      <div className="mt-3 border border-blue-300 bg-blue-50 rounded-lg p-3">
        <p className="text-sm font-semibold text-blue-900">Door jou goedgekeurd</p>
        <p className="text-sm text-blue-800 mt-1">{oiu.handmatig.reden}</p>
        <p className="text-xs text-blue-700 mt-2">
          Deze orb is vrijgegeven op jouw oordeel in plaats van dat van de toetser.
          Publiceren blijft een bewuste klik; de lerende ziet hier niets van.
        </p>
        <button
          onClick={opTerugdraaien}
          className="mt-2 text-xs font-semibold text-blue-700 underline"
        >
          Goedkeuring terugdraaien
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-md border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white"
      >
        Zelf bewerken en beoordelen
      </button>
    );
  }

  return (
    <div className="mt-3 border-2 border-gray-900 rounded-lg p-3">
      <div className="flex items-start justify-between mb-2 gap-2">
        <p className="text-sm font-semibold text-gray-900">Zelf bewerken en beoordelen</p>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-gray-400 hover:text-gray-900 shrink-0"
        >
          Sluiten
        </button>
      </div>

      {/* --- leesstof --- */}
      <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-1">Leesstof</p>
      {blokken.length === 0 && <p className="text-sm text-gray-400 mb-2">Geen tekstblokken.</p>}
      {blokken.map((b, i) =>
        b.type === "tekst" ? (
          <textarea
            key={i}
            value={b.tekst}
            onChange={(e) => opBlokBewerken(i, e.target.value)}
            rows={4}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm leading-relaxed mb-2"
          />
        ) : (
          <p key={i} className="text-xs text-gray-400 mb-2">
            Blok {i + 1} is een {b.type}-blok en wordt hier niet bewerkt.
          </p>
        )
      )}

      {/* --- vragen --- */}
      <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mt-3 mb-1">Vragen</p>
      {vragen.length === 0 && <p className="text-sm text-gray-400 mb-2">Geen vragen.</p>}
      {vragen.map((v, i) =>
        v.type === "meerkeuze" ? (
          <div key={i} className="border border-gray-200 rounded-md p-2 mb-2">
            <input
              value={v.vraag}
              onChange={(e) => opVraagBewerken(i, "vraag", e.target.value)}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm mb-2"
            />
            {(v.opties || []).map((opt, j) => (
              <div key={j} className="flex items-center gap-2 mb-1">
                <button
                  onClick={() => opVraagBewerken(i, "juisteIndex", null, j)}
                  title="Markeer als juist antwoord"
                  className={`w-5 h-5 rounded-full border-2 shrink-0 ${
                    v.juisteIndex === j
                      ? "bg-green-600 border-green-600 text-white"
                      : "border-gray-300"
                  }`}
                >
                  {v.juisteIndex === j ? "✓" : ""}
                </button>
                <input
                  value={opt}
                  onChange={(e) => opVraagBewerken(i, "optie", e.target.value, j)}
                  className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-sm"
                />
              </div>
            ))}
            <textarea
              value={v.uitleg || ""}
              onChange={(e) => opVraagBewerken(i, "uitleg", e.target.value)}
              rows={2}
              placeholder="Uitleg na het antwoord"
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm mt-1"
            />
          </div>
        ) : (
          <p key={i} className="text-xs text-gray-400 mb-2">
            Vraag {i + 1} is een {v.type}-vraag; die is hier niet los te bewerken.
            Opnieuw genereren kan wel.
          </p>
        )
      )}

      {/* --- goedkeuren --- */}
      <div className="border-t border-gray-200 mt-3 pt-3">
        <p className="text-sm font-semibold text-gray-900 mb-1">Zelf goedkeuren</p>
        <p className="text-xs text-gray-500 mb-2">
          Je neemt het oordeel dan over van de toetser en de redacteur. Noteer waarom —
          dat blijft aan de beheerkant staan als verantwoording.
        </p>
        <textarea
          value={reden}
          onChange={(e) => setReden(e.target.value)}
          rows={2}
          placeholder="Bijvoorbeeld: klopt met hoofdstuk 1.3 van de bron; de toetser struikelde over het onderscheid vitaliteit / duurzame inzetbaarheid."
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
        <button
          onClick={() => opGoedkeuren(reden)}
          disabled={reden.trim().length < 5}
          className={`mt-2 text-xs font-semibold px-3 py-1.5 rounded-md ${
            reden.trim().length < 5
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-gray-900 text-white hover:bg-gray-700"
          }`}
        >
          Goedkeuren op mijn oordeel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GROOT DOCUMENT OPSPLITSEN
//
// Voor wie een compleet handboek of curriculum heeft: plak het in zijn geheel,
// bekijk wat eruit komt, en voeg het in één keer toe als losse hoofdstukbronnen.
// Er komt geen AI aan te pas — het blijft dus altijd bij jouw eigen tekst.
// ---------------------------------------------------------------------------

function DocumentSplitser({ domeinNaam, opToevoegen }) {
  const [open, setOpen] = useState(false);
  const [docTekst, setDocTekst] = useState("");
  const [analyse, setAnalyse] = useState(null);
  const [toegevoegd, setToegevoegd] = useState(0);

  function analyseer() {
    setAnalyse(bereidBronnenVoor(docTekst));
    setToegevoegd(0);
  }

  function voegAlleToe() {
    if (!analyse) return;
    opToevoegen(analyse.delen.map((d) => ({ naam: d.naam, tekst: d.tekst })));
    setToegevoegd(analyse.delen.length);
    setAnalyse(null);
    setDocTekst("");
    setOpen(false); // sluit af, zodat de bevestiging en de nieuwe bronnen in beeld komen
  }

  if (!open) {
    return (
      <div className="bg-white border border-gray-300 rounded-lg p-5 mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-gray-900">Groot document opsplitsen</p>
            <p className="text-xs text-gray-500 mt-1 max-w-lg">
              Heb je een compleet handboek of curriculum? Plak het in één keer; het
              wordt per hoofdstuk als aparte bron klaargezet, met de opmaak die de
              omzetter nodig heeft.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="text-sm font-semibold px-4 py-2 rounded-md border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white shrink-0"
          >
            Openen
          </button>
        </div>
        {toegevoegd > 0 && (
          <p className="text-xs font-semibold text-green-700 mt-3">
            {toegevoegd} hoofdstuk{toegevoegd === 1 ? "" : "ken"} toegevoegd als bron
            {toegevoegd === 1 ? "" : "nen"}.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-gray-900 rounded-lg p-5 mb-4">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Groot document opsplitsen</p>
          <p className="text-xs text-gray-500 mt-1">
            Komt terecht in domein <strong className="text-gray-700">{domeinNaam}</strong>.
            Er wordt niets herschreven — alleen de indeling wordt hersteld.
          </p>
        </div>
        <button
          onClick={() => {
            setOpen(false);
            setAnalyse(null);
          }}
          className="text-xs text-gray-400 hover:text-gray-900 shrink-0"
        >
          Sluiten
        </button>
      </div>

      <textarea
        value={docTekst}
        onChange={(e) => {
          setDocTekst(e.target.value);
          setAnalyse(null);
        }}
        rows={8}
        placeholder="Plak hier het volledige document, met alle hoofdstukken achter elkaar. Hoofdstukken worden herkend aan regels als 'Hoofdstuk 1'."
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm leading-relaxed"
      />

      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-gray-400">
          {docTekst.trim().length.toLocaleString("nl-NL")} tekens
        </span>
        <button
          onClick={analyseer}
          disabled={docTekst.trim().length < 200}
          className={`text-sm font-semibold px-4 py-2 rounded-md ${
            docTekst.trim().length < 200
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-gray-900 text-white hover:bg-gray-700"
          }`}
        >
          Bekijk de indeling
        </button>
      </div>

      {analyse && (
        <div className="mt-5 border-t border-gray-200 pt-4">
          {analyse.delen.length === 1 && analyse.delen[0].naam === "Volledig document" && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3 mb-3">
              Geen hoofdstukken herkend. Het document wordt als één bron toegevoegd.
              Begint elk hoofdstuk met een regel als "Hoofdstuk 1"? Dan wordt er wel
              per hoofdstuk gesplitst.
            </p>
          )}
          {analyse.voorwerkTekens > 0 && (
            <p className="text-xs text-gray-500 mb-3">
              De {analyse.voorwerkTekens.toLocaleString("nl-NL")} tekens vóór het eerste
              hoofdstuk (voorwoord, inhoudsopgave) worden niet meegenomen.
            </p>
          )}

          <div className="space-y-2">
            {analyse.delen.map((d, i) => (
              <div
                key={i}
                className={`border rounded-md p-3 ${
                  d.waarschuwing ? "border-amber-300 bg-amber-50" : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">{d.naam}</p>
                  <p className="text-xs text-gray-500 shrink-0">
                    {d.tekens.toLocaleString("nl-NL")} tekens · {d.aantalPassages} passages ·
                    grootste {d.grootstePassage.toLocaleString("nl-NL")}
                    {d.waarschuwing ? "" : " ✓"}
                  </p>
                </div>
                {d.koppenAangepast > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    {d.koppenAangepast} kopregel{d.koppenAangepast === 1 ? "" : "s"} zonder
                    slotleesteken gezet, zodat de indeling meetelt.
                  </p>
                )}
                {d.waarschuwing && (
                  <p className="text-xs text-amber-800 mt-1">{d.waarschuwing}</p>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={voegAlleToe}
            className="w-full mt-4 text-sm font-semibold px-4 py-2.5 rounded-md bg-gray-900 text-white hover:bg-gray-700"
          >
            Voeg toe als {analyse.delen.length} bron{analyse.delen.length === 1 ? "" : "nen"}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DE SCOREKAART — wat de toetser en de redacteur hebben gevonden
// ---------------------------------------------------------------------------

function BronBevinding({ b }) {
  const stijlen = {
    gedekt: ["border-green-200 bg-green-50", "text-green-700", "Gedekt door de bron"],
    niet_gedekt: ["border-amber-300 bg-amber-50", "text-amber-800", "Staat niet in de bron"],
    tegengesproken: ["border-red-300 bg-red-50", "text-red-700", "Bron spreekt dit tegen"],
  };
  const [rand, kleur, label] = stijlen[b.oordeel] || stijlen.niet_gedekt;

  return (
    <div className={`border rounded-lg p-3 ${rand}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${kleur}`}>{label}</p>
      <p className="text-sm text-gray-900 mt-1">{b.bewering}</p>
      {b.passage && (
        <p className="text-xs text-gray-600 mt-1.5 border-l-2 border-gray-300 pl-2 italic">
          Bron: {b.passage}
        </p>
      )}
      {b.toelichting && b.oordeel !== "gedekt" && (
        <p className="text-xs text-gray-600 mt-1">{b.toelichting}</p>
      )}
    </div>
  );
}

function Scorekaart({ orb, heeftBronnen, opTekstVervangen }) {
  const bron = orb.bronControle;
  const red = orb.redactie;

  const ongedekt = bron
    ? bron.filter((b) => b.oordeel === "niet_gedekt" || b.oordeel === "tegengesproken").length
    : 0;

  const oordeelStijl =
    {
      goed: "border-green-300 bg-green-50 text-green-800",
      matig: "border-amber-300 bg-amber-50 text-amber-900",
      zwak: "border-red-300 bg-red-50 text-red-800",
    }[red && red.oordeel] || "border-gray-300 bg-gray-50 text-gray-700";

  const ernstStijl = {
    hoog: "border-red-300 bg-red-50",
    midden: "border-amber-300 bg-amber-50",
    laag: "border-gray-300 bg-gray-50",
  };

  return (
    <div className="mt-4 border-t border-gray-300 pt-4">
      {/* --- Waarheidstoets --- */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
            Waarheidstoets
          </p>
          {bron && (
            <span
              className={`text-xs font-semibold ${
                ongedekt === 0 ? "text-green-700" : "text-amber-800"
              }`}
            >
              {ongedekt === 0
                ? "Alles gedekt door de bron"
                : `${ongedekt} bewering(en) niet gedekt`}
            </span>
          )}
        </div>

        {!heeftBronnen ? (
          <p className="text-sm text-amber-800 border border-dashed border-amber-300 bg-amber-50 rounded-lg p-3">
            Geen bronnen voor dit domein. Er is niet op juistheid getoetst — alleen op
            kwaliteit. Voeg bronnen toe onder het tabblad Bronnen.
          </p>
        ) : !bron || bron.length === 0 ? (
          <p className="text-sm text-gray-500">
            De toetser kwam niet tot een oordeel. Probeer opnieuw of controleer handmatig.
          </p>
        ) : (
          <div className="space-y-2">
            {bron.map((b, i) => (
              <BronBevinding key={i} b={b} />
            ))}
          </div>
        )}
      </div>

      {/* --- Redactie --- */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
            Redactie
          </p>
          {red && (
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded border ${oordeelStijl}`}
            >
              {red.oordeel}
            </span>
          )}
        </div>

        {!red ? (
          <p className="text-sm text-gray-500">De redacteur kwam niet tot een oordeel.</p>
        ) : red.bevindingen.length === 0 ? (
          <p className="text-sm text-green-700 border border-green-200 bg-green-50 rounded-lg p-3">
            De redacteur heeft niets aan te merken.
          </p>
        ) : (
          <div className="space-y-2">
            {red.bevindingen.map((b, i) => (
              <div
                key={i}
                className={`border rounded-lg p-3 ${ernstStijl[b.ernst] || ernstStijl.laag}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                    {b.criterium}
                  </p>
                  <span className="text-xs text-gray-500 shrink-0">
                    {b.waar} · {b.ernst}
                  </span>
                </div>
                <p className="text-sm text-gray-900 mt-1">{b.wat}</p>
                {b.voorstel && (
                  <p className="text-sm text-gray-700 mt-1.5">
                    <span className="font-semibold">Voorstel:</span> {b.voorstel}
                  </p>
                )}
                {typeof b.vervangTekstBlok === "number" && b.nieuweTekst && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-900 bg-white border border-gray-300 rounded p-2 leading-relaxed">
                      {b.nieuweTekst}
                    </p>
                    <button
                      onClick={() => opTekstVervangen(b.vervangTekstBlok, b.nieuweTekst)}
                      className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-700"
                    >
                      Deze herschrijving toepassen
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// VANGNET
// Als er ergens toch iets misgaat, zie je een nette melding in plaats van een
// leeg wit scherm — en je content blijft bewaard.
// ============================================================================

class Vangnet extends React.Component {
  constructor(props) {
    super(props);
    this.state = { fout: null };
  }
  static getDerivedStateFromError(fout) {
    return { fout };
  }
  render() {
    if (this.state.fout) {
      return (
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-3xl mx-auto">
            <div className="border border-red-500 bg-red-50 rounded-lg p-5">
              <p className="font-semibold text-red-800">Er ging iets mis</p>
              <p className="text-sm text-red-700 mt-1">
                Er zat iets onverwachts in de lesstof. Je opgeslagen content is niet
                kwijt. Ververs de pagina om verder te gaan.
              </p>
              <p className="text-xs text-red-600 mt-3 font-mono">
                {String(this.state.fout && this.state.fout.message)}
              </p>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// DE APP
// ============================================================================

// ============================================================================
// MERKTEKEN — het Schouten Techniek hexagon, als schaalbare SVG
//
// De zeshoek met stippenpatroon is het merk. We tekenen 'm zelf zodat hij
// altijd scherp is en meekleurt, in plaats van een los logobestand.
// ============================================================================

// ============================================================================
// OFFICIEEL LOGO
//
// Geen nagetekende benadering meer: Merkteken en Merknaam zijn dunne wrappers
// rond het officiële logo van Schouten Techniek. De assets zijn rechtstreeks
// uit het huisstijlhandboek (Handout logogebruik 2024) gehaald: het volledige
// logo en een correcte uitsnede van alleen het beeldmerk (de kubus), beide
// als transparante PNG. Ontbreken de bestanden, dan tonen de componenten een
// duidelijke, neutrale tekstfallback — bewust GEEN geïmiteerd logo.
// ============================================================================
// De officiële logo-assets zijn als compacte data-URI opgenomen. Daardoor blijft
// dit JSX-bestand zelfstandig werken en kan het logo niet ontbreken door een
// verkeerd public- of assetpad.
const SCHOUTEN_WEBSITE = "https://schoutentechniek.nl/";
const LOGO_PAD = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAjoAAADECAMAAAChkXuyAAABgFBMVEWiXmAjkabgn5xalaHbZFuc0+IemNHhWCKlnWJjXWDXpifZKynZlmKqTiBeqNSlJh+lmp7h4uZfdJPtzGYaGh+gN0rsyq7ttcrx9fBlj2iUstFWHxds0eefcokndp7YdorLNUwtW15hTSqsmzPhwiZeOkelz7YXMkgyiXIeecmxxVFrybUxytprkjA5QzpVe8+6wSP+/v74+/IDAgL0pyz5+vj3pxb56e/9+dTrtEzxtDH6mS/xqUvV+/sTFRT+5a/PKAX71o/86NH19fT419Pwx3HPNgf6iC/8mEvz8/L3yM7W19f4mRX52qtXV1dJSEnysxPqt2z72eo2NzdnZWiJh4i3uLjQRwXLyMn0yYonJieVl5bVqU6pqKn4eCwrAgLRGgbQ6PN1d3XqJw3RVgj1t7PtZxH+97XvdxHrVw+0KAXyqK7XtU7v7u/1aCy1NgT8iEuOR0+x+frzhxPoNwyuNi6x5/Xt7O395JfWtGvPl5Kw2e7SZwjvqGjpGg3QqKolG2yeAAAAgHRSTlP//////////////////////+7///////+f////////////////////////////////AP7//zj//v//////////////Vv//////dv//////////////////////////////////////////////lf///////////7b//////////9E3y2IAAGW2SURBVHja7b2HQ9vY0j4syzLuDUJNSNns7m3v+/4+HSzkCsY2tjEQwBRTHXpooZeEkvzr38ycI3cIsMm2y7k3C7hIss7jmWe6pP5uizE1z/SpaZXxv+CHNqQ+rb/qkn6f02hJ+I8f/00tIGx0Dh1YSf1pE56gcztw+H+Zqi/Ze3rGckwH6MSYpj3d/yfoNEZMFTR0xlLvemhJCU1fYfSs/gSfJ+jUI4dxdCCCQMyojAOnrw/+LWiqPjRkCKQn+DxBp/FC3Kgp3zNCzjMCT99zn3abeHpaT9ApQUdVE0tjJHGevWlufoPo6emZ8gNPBrn08Qk6T9C5ZdlklrJzkvPGZDKbz6/EX816Seo8Yee/GzpogKtIYDq4mgJiDGa4bLfbua6yW2LmN02e8xjzvSHNNb+kG6zoaSf+G6GjccxUP6bD/yUph2aV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";
const BEELDMERK_PAD = "data:image/png;base64,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";

// Alleen het beeldmerk (voor modals): de officiële uitsnede van de kubus.
function Merkteken({ grootte = 40 }) {
  const [mislukt, setMislukt] = useState(false);
  if (mislukt) {
    return (
      <span
        role="img"
        aria-label="Schouten Techniek"
        className="font-semibold"
        style={{ fontSize: Math.max(13, grootte * 0.32), color: ST.donker }}
      >
        Schouten Techniek
      </span>
    );
  }
  return (
    <img
      src={BEELDMERK_PAD}
      alt="Schouten Techniek"
      style={{ height: grootte, width: "auto", display: "block" }}
      onError={() => setMislukt(true)}
    />
  );
}

// Het volledige logo in de header. Zelfde fallbackgedrag.
// De publieke naam blijft Merknaam, zodat bestaande aanroepen niet wijzigen.
function Merknaam({ grootte = 40, klikbaar = false }) {
  const [mislukt, setMislukt] = useState(false);

  const logo = mislukt ? (
    <span
      role="img"
      aria-label="Schouten Techniek"
      className="font-semibold tracking-tight"
      style={{ fontSize: Math.max(15, grootte * 0.38), color: ST.donker }}
    >
      Schouten Techniek
    </span>
  ) : (
    <img
      src={LOGO_PAD}
      alt="Schouten Techniek"
      style={{ height: grootte, width: "auto", display: "block" }}
      onError={() => setMislukt(true)}
    />
  );

  // Alleen op de leerkant is het merk een link. De website opent in een nieuw
  // tabblad, zodat de leeromgeving en de huidige voortgang open blijven staan.
  if (!klikbaar) return logo;

  return (
    <a
      href={SCHOUTEN_WEBSITE}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open de website van Schouten Techniek"
      title="Naar schoutentechniek.nl"
      className="inline-flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-4"
    >
      {logo}
    </a>
  );
}

function LeerplatformApp() {
  const [modus, setModus] = useState("leren");
  const [domeinen, setDomeinen] = useState(START_DOMEINEN);
  const [bronnen, setBronnen] = useState(START_BRONNEN);
  const [topics, setTopics] = useState(START_TOPICS);
  const [geladen, setGeladen] = useState(false);

  const [actiefTopic, setActiefTopic] = useState(null);
  const [actieveOrb, setActieveOrb] = useState(null);
  const [voortgang, setVoortgang] = useState({});   // welke orbs zijn af
  const [kennis, setKennis] = useState({});         // Leitner-doos per vraag
  const [herhalen, setHerhalen] = useState(false);
  const [toonAanmelden, setToonAanmelden] = useState(false);
  // Persoonlijke volgorde van de leerpaden op het overzicht (zie §normaliseer).
  // Hoort bij voortgang/kennis: het is een gebruikersvoorkeur, geen content.
  const [leerpadVoorkeuren, setLeerpadVoorkeuren] = useState({
    volgorde: [],
    gebruik: {},
    handmatig: false,
  });
  // De Leitner-popup dringt zich op bij binnenkomst als er iets te herhalen is.
  // 'Straks' stelt hem uit, maar na het afronden van een les komt hij terug.
  const [herhaalPopupUitgesteld, setHerhaalPopupUitgesteld] = useState(false);
  // Testklok — alleen om het Leitner-systeem te kunnen verifiëren zonder
  // weken te wachten. Staat op 0 bij elke herstart, telt niet mee in wat er
  // ooit echt wordt uitgerold.
  const [tijdOffset, setTijdOffset] = useState(0);
  const nu = Date.now() + tijdOffset;
  // Voortgang en kennis horen bij één opslagmoment. De wachtrij voorkomt dat
  // twee snelle state-updates hun opslagacties in een andere volgorde afronden.
  const voortgangOpslagRij = useRef(Promise.resolve());

  useEffect(() => {
    let leeft = true;
    Promise.all([laden(), laadVoortgang()]).then(([opgeslagen, vg]) => {
      if (leeft && opgeslagen) {
        if (opgeslagen.domeinen) setDomeinen(opgeslagen.domeinen);
        if (opgeslagen.topics) setTopics(opgeslagen.topics);
        if (opgeslagen.bronnen) setBronnen(opgeslagen.bronnen);
      }
      if (leeft && vg) {
        if (vg.voortgang) setVoortgang(vg.voortgang);
        if (vg.kennis) setKennis(vg.kennis);
        // oude opslag heeft dit veld nog niet: normaliseren vult veilige defaults in
        setLeerpadVoorkeuren(normaliseerVoorkeuren(vg.leerpadVoorkeuren));
      }
      if (leeft) setGeladen(true);
    });
    return () => {
      leeft = false;
    };
  }, []);

  useEffect(() => {
    if (!geladen) return;

    const momentopname = { voortgang, kennis, leerpadVoorkeuren };
    voortgangOpslagRij.current = voortgangOpslagRij.current.then(() =>
      bewaarVoortgang(momentopname)
    );
  }, [geladen, voortgang, kennis, leerpadVoorkeuren]);

  async function slaOp({ domeinen: d, topics: t, bronnen: b }) {
    const nieuweBronnen = b !== undefined ? b : bronnen;
    setDomeinen(d);
    setTopics(t);
    setBronnen(nieuweBronnen);
    return bewaren({ domeinen: d, topics: t, bronnen: nieuweBronnen });
  }

  function rondOrbAf(topicId, orbIndex) {
    const t = topics.find((x) => x.id === topicId);
    if (!t || !Array.isArray(t.orbs)) {
      setActieveOrb(null);
      return;
    }

    setVoortgang((v) => {
      const huidig = v[topicId] || 0;
      const nieuw =
        orbIndex === huidig && huidig < t.orbs.length
          ? { ...v, [topicId]: huidig + 1 }
          : v;
      return nieuw;
    });
    setActieveOrb(null);
    setHerhaalPopupUitgesteld(false); // de herhaal-popup mag weer verschijnen
  }

  // Elk antwoord verschuift de vraag in het Leitner-systeem.
  function noteerAntwoord(vraagId, juist) {
    setKennis((k) => verwerkAntwoord(k, vraagId, juist, nu));
  }

  // De centrale route waarlangs de leerkant een topic opent. Telt het gebruik
  // van het domein (voor 'meest gebruikte bovenaan') en opent daarna het topic.
  // Het starten van een orb binnen een al geopend topic telt NIET opnieuw.
  function openTopic(topicId) {
    const t = topics.find((x) => x.id === topicId);
    if (t) {
      setLeerpadVoorkeuren((v) => {
        const vk = normaliseerVoorkeuren(v);
        const g = vk.gebruik[t.domeinId] || { openingen: 0, laatstGebruikt: 0 };
        return {
          ...vk,
          gebruik: {
            ...vk.gebruik,
            [t.domeinId]: { openingen: (g.openingen || 0) + 1, laatstGebruikt: Date.now() },
          },
        };
      });
    }
    setActiefTopic(topicId);
  }

  // Handmatig slepen: de nieuwe volgorde wint vanaf nu van de gebruikssortering.
  function wijzigVolgorde(nieuweIds) {
    setLeerpadVoorkeuren((v) => ({
      ...normaliseerVoorkeuren(v),
      volgorde: nieuweIds,
      handmatig: true,
    }));
  }

  const topic = actiefTopic ? topics.find((t) => t.id === actiefTopic) : null;
  const domein = topic ? domeinen.find((d) => d.id === topic.domeinId) : null;
  const inLes = topic && domein && actieveOrb !== null;

  const due = vragenDieAanDeBeurtZijn(topics, kennis, nu);

  // Alleen het echte overzicht wordt breder; les, topic, herhaling en beheer
  // houden hun compacte breedte.
  const opOverzicht = modus === "leren" && !herhalen && !inLes && !actiefTopic;

  // Alleen het overzicht krijgt de afgeleide volgorde; beheer, bronnen en
  // generatie blijven met de originele domeinen-array werken.
  const geordendeDomeinen = bepaalGeordendeDomeinen(domeinen, leerpadVoorkeuren);

  return (
    <div
      className="min-h-screen p-4 sm:p-6"
      style={{ backgroundColor: UI.achtergrond, fontFamily: "Calibri, Arial, sans-serif" }}
    >
      <style>{APP_STIJL}</style>
      <div className={`${opOverzicht ? "max-w-6xl" : "max-w-3xl"} mx-auto`}>
        {!inLes && !herhalen && (
          <header className="mb-8 pb-5" style={{ borderBottom: `1px solid ${UI.randZacht}` }}>
            <div className="flex items-center justify-between gap-4 flex-wrap py-1">
              <div className="py-1">
                <Merknaam grootte={44} klikbaar={modus === "leren"} />
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  onClick={() => setModus(modus === "beheren" ? "leren" : "beheren")}
                  className="text-sm px-4 py-2 font-medium rounded-lg border transition"
                  style={
                    modus === "beheren"
                      ? { backgroundColor: ST.donker, color: "#FFFFFF", borderColor: ST.donker }
                      : {
                          backgroundColor: UI.kaart,
                          color: "#374151",
                          borderColor: UI.randZacht,
                        }
                  }
                >
                  {modus === "beheren" ? "← Naar leren" : "Content beheren"}
                </button>
                {modus !== "beheren" && (
                  <button
                    onClick={() => setToonAanmelden(true)}
                    className="text-sm px-4 py-2 font-medium rounded-lg text-white hover:opacity-90 transition"
                    style={{ backgroundColor: ST.donker }}
                  >
                    Aanmelden
                  </button>
                )}
              </div>
            </div>
            {modus === "beheren" && (
              <p className="text-gray-500 mt-3">Beheer domeinen, bronnen en lesstof</p>
            )}
          </header>
        )}

        {!geladen && <p className="text-sm text-gray-400">Laden…</p>}

        {geladen && modus === "beheren" && (
          <Beheer
            domeinen={domeinen}
            topics={topics}
            bronnen={bronnen}
            opOpslaan={slaOp}
            tijdOffset={tijdOffset}
            setTijdOffset={setTijdOffset}
            kennis={kennis}
          />
        )}

        {geladen && modus === "leren" && (
          <>
            {herhalen ? (
              <Herhaalsessie
                due={due}
                domeinen={domeinen}
                opAntwoord={noteerAntwoord}
                opKlaar={() => setHerhalen(false)}
                opNaarLes={(topicId) => {
                  setHerhalen(false);
                  openTopic(topicId);
                }}
              />
            ) : inLes ? (
              <LesScherm
                key={`${topic.id}-${actieveOrb}`}
                topic={topic}
                domein={domein}
                orbIndex={actieveOrb}
                opAfronden={() => rondOrbAf(topic.id, actieveOrb)}
                opAfbreken={() => setActieveOrb(null)}
                opVraagBeantwoord={noteerAntwoord}
              />
            ) : topic && domein ? (
              <TopicDetail
                topic={topic}
                domein={domein}
                voortgang={voortgang}
                kennis={kennis}
                opTerug={() => setActiefTopic(null)}
                opOrbStarten={(tid, oi) => {
                  setActiefTopic(tid);
                  setActieveOrb(oi);
                }}
              />
            ) : (
              <Overzicht
                domeinen={geordendeDomeinen}
                topics={topics}
                voortgang={voortgang}
                kennis={kennis}
                aantalDue={due.length}
                opTopicKlik={openTopic}
                opHerhalen={() => setHerhalen(true)}
                opVolgordeWijzigen={wijzigVolgorde}
              />
            )}
          </>
        )}
      </div>

      {/* De Leitner-popup: dringt zich op bij binnenkomst als er iets te herhalen is */}
      {geladen &&
        modus === "leren" &&
        !inLes &&
        !herhalen &&
        !actiefTopic &&
        !herhaalPopupUitgesteld &&
        due.length > 0 && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
              <div className="flex justify-center mb-3">
                <Merkteken grootte={44} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 text-center">
                {due.length === 1
                  ? "1 vraag is aan de beurt"
                  : `${due.length} vragen zijn aan de beurt`}
              </h2>
              <p className="text-sm text-gray-600 mt-2 text-center">
                Kennis zakt weg als je er niets mee doet. Vijf minuten herhalen op het
                juiste moment is hoe het blijft hangen.
              </p>

              <div className="mt-4 border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  De vragen gaan over
                </p>
                <div className="space-y-1">
                  {[...new Map(due.map((d) => [d.topic.id, d])).values()].map((d) => (
                    <button
                      key={d.topic.id}
                      onClick={() => {
                        setHerhaalPopupUitgesteld(true);
                        openTopic(d.topic.id);
                      }}
                      className="w-full text-left text-sm text-gray-800 hover:text-black hover:bg-gray-50 rounded px-2 py-1 flex items-center justify-between"
                    >
                      <span>{d.topic.titel}</span>
                      <span className="text-xs text-gray-400 shrink-0">lees terug →</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    setHerhaalPopupUitgesteld(true);
                    setHerhalen(true);
                  }}
                  className="flex-1 text-sm font-semibold px-4 py-2.5 rounded-md text-white hover:opacity-90"
                  style={{ backgroundColor: "#F6A923" }}
                >
                  Nu herhalen
                </button>
                <button
                  onClick={() => setHerhaalPopupUitgesteld(true)}
                  className="text-sm font-semibold px-4 py-2.5 rounded-md border border-gray-300 text-gray-600 hover:border-gray-900"
                >
                  Straks
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                Straks = na je volgende les komt dit terug.
              </p>
            </div>
          </div>
        )}

      {toonAanmelden && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-50"
          onClick={() => setToonAanmelden(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-4">
              <Merkteken grootte={52} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 text-center">Aanmelden</h2>
            <p className="text-sm text-gray-600 mt-2 text-center">
              Straks meld je je aan met je Schouten Techniek e-mailadres en je naam, zodat je
              voortgang bij je hoort — ook als je van telefoon wisselt.
            </p>
            <div className="mt-4 space-y-2 opacity-60 pointer-events-none">
              <input
                placeholder="voornaam.achternaam@schoutentechniek.nl"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50"
                disabled
              />
              <input
                placeholder="Je naam"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50"
                disabled
              />
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">
              Deze functie komt binnenkort. Voor nu werkt de app zonder aanmelden.
            </p>
            <button
              onClick={() => setToonAanmelden(false)}
              className="mt-4 w-full text-sm font-semibold px-4 py-2.5 rounded-md bg-gray-900 text-white hover:bg-gray-700"
            >
              Sluiten
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Leerplatform() {
  return (
    <Vangnet>
      <LeerplatformApp />
    </Vangnet>
  );
}

// ============================================================================
// LEERPADVOLGORDE — persoonlijke voorkeur van de gebruiker
//
// Puur en defensief: beschadigde of ontbrekende voorkeuren vallen altijd
// terug op de originele domeinvolgorde. Handmatig gesorteerd wint van
// gebruikssortering; zonder enig gebruik blijft de originele volgorde staan.
// ============================================================================
function normaliseerVoorkeuren(v) {
  if (!v || typeof v !== "object") return { volgorde: [], gebruik: {}, handmatig: false };
  return {
    volgorde: Array.isArray(v.volgorde) ? v.volgorde.filter((id) => typeof id === "string") : [],
    gebruik: v.gebruik && typeof v.gebruik === "object" ? v.gebruik : {},
    handmatig: v.handmatig === true,
  };
}

function bepaalGeordendeDomeinen(domeinen, voorkeuren) {
  try {
    const vk = normaliseerVoorkeuren(voorkeuren);

    if (vk.handmatig) {
      // ongeldige opgeslagen id's verwijderen, ontbrekende domeinen achteraan
      const geldig = vk.volgorde.filter((id) => domeinen.some((d) => d.id === id));
      const rest = domeinen.filter((d) => !geldig.includes(d.id));
      return [...geldig.map((id) => domeinen.find((d) => d.id === id)), ...rest];
    }

    const ooitGebruikt = domeinen.some((d) => {
      const g = vk.gebruik[d.id];
      return g && g.openingen > 0;
    });
    if (!ooitGebruikt) return domeinen; // niets gebruikt: originele volgorde

    const origineleIndex = new Map(domeinen.map((d, i) => [d.id, i]));
    return [...domeinen].sort((a, b) => {
      const ga = vk.gebruik[a.id] || { openingen: 0, laatstGebruikt: 0 };
      const gb = vk.gebruik[b.id] || { openingen: 0, laatstGebruikt: 0 };
      if ((gb.openingen || 0) !== (ga.openingen || 0)) return (gb.openingen || 0) - (ga.openingen || 0);
      if ((gb.laatstGebruikt || 0) !== (ga.laatstGebruikt || 0)) return (gb.laatstGebruikt || 0) - (ga.laatstGebruikt || 0);
      return origineleIndex.get(a.id) - origineleIndex.get(b.id); // stabiele tie-breaker
    });
  } catch {
    return domeinen; // beschadigde voorkeuren: nooit crashen
  }
}
