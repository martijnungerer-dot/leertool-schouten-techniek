import React, { useState, useEffect, useRef } from "react";


// ============================================================================
// OPSLAG
// ============================================================================

const SLEUTEL = "leerplatform-techniek-content-v1";
const VOORTGANG_SLEUTEL = "leerplatform-techniek-voortgang-v1";

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
// Alle vragen uit gepubliceerde lessen. Hiermee kun je oefenen voordat er iets
// in het herhaalschema staat; het schema zelf blijft daarbij ongemoeid.
function oefenbareVragen(topics) {
  const vragen = [];
  topics.forEach((topic) => {
    topic.orbs.forEach((orb) => {
      if (orb.concept) return;
      (orb.vragen || []).filter(vraagIsHeel).forEach((vraag) => vragen.push({ vraag, topic, orb }));
    });
  });
  return vragen;
}

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
  const doelTier = vTier + 1;

  return {
    prerequisites: [voorgangerId],
    gridPos: { tier: doelTier, track: eersteVrijeTrack(doelTier) },
  };
}

function isTopicUnlocked(topic, topics, voortgang) {
  // De aangeleverde lesopzetten zijn vrij te bekijken, maar leveren geen voortgang op.
  if (topic.ontwerpopzet) return true;
  const eisen = topic.prerequisites || [];
  if (eisen.length === 0) return true; // stam

  return eisen.every((eisId) => {
    const vereist = topics.find((t) => t.id === eisId);
    if (!vereist) return false; // prerequisite bestaat niet (meer) -> niet ontgrendeld
    const totaal = vereist.orbs.length;
    if (totaal === 0) return false; // een leeg topic kun je niet afronden
    const afgerond = voortgang[eisId] || 0;
    return afgerond >= totaal;
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

// De zichtbare naam van de beheerkant. Overal via deze constante, zodat de
// naam op één plek staat (afvinklijst 10).
const BEHEER_NAAM = "Lesvoorbereiding";

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
  html, body, #root { height: 100%; }
  body { margin: 0; overflow: hidden; }
  .app-shell { height: 100dvh; padding: 22px 26px 24px; box-sizing: border-box; }
  .app-layout { height: 100%; display:flex; flex-direction:column; min-height:0; }
  .app-content { position:relative; flex:1 1 0%; min-height:0; }
  .app-header { display:flex; align-items:center; gap:10px; flex:none; margin-bottom:16px; position:relative; z-index:65; }
  .app-nav { display:flex; align-items:center; gap:7px; margin-left:auto; flex-wrap:wrap; }
  .app-columns { display:flex; flex:1 1 0%; min-height:0; gap:16px; overflow:hidden; }
  .app-sidebar { flex:0 0 288px; min-width:0; min-height:0; }
  .app-actions { display:flex; flex:none; flex-wrap:wrap; gap:10px; padding-top:14px; }
  .app-alert { background:#FBF1F0; border:1px solid #E8A9A5; border-radius:14px; padding:10px 14px; margin-bottom:12px; font-size:13px; }
  .app-shell button:disabled { cursor:not-allowed; opacity:.45; }
  .app-shell p { text-wrap:pretty; }
  .app-shell [role="alert"] { overflow-wrap:anywhere; }
  .app-high-contrast { --tekst-secundair:#1D1D1D; --rand-zacht:#667085; }
  .app-high-contrast [style*="color: rgb(177, 178, 180)"] { color:#667085!important; }
  .app-high-contrast input, .app-high-contrast button { border-color:#667085!important; }
  /* De kopregel blijft één regel tot ver onder 766px breed: eerst verliezen de
     icoonknoppen hun label, daarna maakt het volledige logo plaats voor het
     beeldmerk. Pas als ook dat niet meer past breekt de navigatie af — anders
     staat het logo op een eigen regel boven de navigatie (afvinklijst 1, 2, 9). */
  .app-logo-vol { display:block; }
  .app-logo-merk { display:none; }
  @media(max-width:1000px) {
    .app-nav { gap:6px; }
    .app-nav .lb-chrome { padding:0 10px; gap:6px; }
    .lb-chrome-bijschrift { display:none; }
  }
  @media(max-width:700px) {
    .app-logo-vol { display:none; }
    .app-logo-merk { display:block; }
  }
  @media(max-width:850px) {
    .app-shell { padding:12px; }
    .app-columns { flex-direction:column; overflow:auto; }
    .app-columns > div { flex:none!important; min-height:220px; }
    .app-columns > .app-sidebar { width:100%; max-width:none!important; min-height:170px; }
    .lb-zoekveld { max-width:calc(100vw - 48px); }
    .app-search-results { max-width:calc(100vw - 32px); left:0; right:auto!important; }
    .app-card-head { flex-wrap:wrap!important; }
    .app-card-head > div { min-width:0!important; }
  }
  @media(max-width:620px) {
    .app-header { flex-wrap:wrap; }
    .app-nav { flex:1 1 100%; margin-left:0; }
  }
  @media(prefers-reduced-motion:reduce) {
    *,*::before,*::after { animation:none!important; transition:none!important; scroll-behavior:auto!important; }
  }
  .lb-rustig *, .lb-rustig *::before, .lb-rustig *::after { animation:none!important; transition:none!important; }
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

  /* Zachte, natuurlijke schermwissel: nieuwe inhoud komt rustig omhoog en fade-in,
     verankerd waar de vorige stond. Zo voelt de overgang van boom naar les vloeiend
     in plaats van hard. Reduced motion: alleen een korte cross-fade, geen beweging. */
  @keyframes scherm-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes scherm-in-zacht {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .scherm-in { animation: scherm-in 0.34s cubic-bezier(0.22, 0.61, 0.36, 1) both; }
  @media (prefers-reduced-motion: reduce) {
    .scherm-in { animation: scherm-in-zacht 0.2s ease both; transform: none; }
  }
  /* "Beweging beperken" in het instellingenpaneel: dezelfde regels als
     prefers-reduced-motion, maar handmatig aan te zetten. */
  .lb-rustig .scherm-in { animation: scherm-in-zacht 0.2s ease both; transform: none; }

  /* De app is bewust een licht ontwerp. Wordt hij in een donker-thema omgeving
     getoond (bijv. ingebed in een host in dark mode), dan zouden invoervelden
     zonder eigen kleur zwart worden en onleesbaar zijn. We pinnen daarom de
     lichte modus vast en geven alle formuliervelden een expliciete lichte kleur. */
  :root { color-scheme: light; }
  input, textarea, select {
    color-scheme: light;
    background-color: #FFFFFF;
    color: var(--st-donker);
    border-color: var(--rand-zacht);
  }
  input::placeholder, textarea::placeholder { color: #9AA0A6; opacity: 1; }

  /* Focus overal in het oranje, nooit de blauwe browserring (herontwerp §Focus). */
  *:focus-visible { outline: 2px solid var(--st-oranje); outline-offset: 2px; }

  /* Primaire/secundaire knop uit design/herontwerp/09 — de enige twee knelknoppen
     buiten de chromepills en de lesboomkaarten om (o.a. het aanmeldscherm). */
  .knop, .knop2 {
    display: inline-flex; align-items: center; justify-content: center;
    height: 36px; padding: 0 18px; border-radius: 999px;
    font-family: inherit; font-size: 13px; cursor: pointer; white-space: nowrap;
    flex: none; transition: background .18s ease;
  }
  .knop { border: 0; font-weight: 700; background: var(--st-donker); color: #FFFFFF; }
  .knop:hover { background: #333030; }
  .knop2 { font-weight: 600; background: #FFFFFF; color: var(--st-donker); border: 1px solid var(--rand-zacht); }
  .knop2:hover { background: #FDEED3; }

  /* Honingraat-vormtaal (herontwerp): chromepills, lesboomkaartjes, tegel-hover,
     het inschuivende lesboompaneel en het zoekveld in de chromerij. Waarden uit
     design/herontwerp/09 - onderdelen (de enige toegestane bouwstenen).md. */
  .lb-chrome {
    height: 34px; display: inline-flex; align-items: center; gap: 7px; padding: 0 12px;
    border-radius: 999px; background: #FFFFFF; border: 1px solid var(--rand-zacht);
    font-size: 12px; font-weight: 600; color: var(--st-donker); cursor: pointer;
    transition: background .18s ease; white-space: nowrap; font-family: inherit;
  }
  .lb-chrome:hover { background: #FDEED3; }
  .lb-chrome[data-actief="ja"] { background: var(--st-donker); color: #FFFFFF; border-color: var(--st-donker); }
  .lb-kaartje {
    position: relative; text-align: left; font-family: inherit; color: inherit; background: var(--kaart-zacht);
    border: 1px solid var(--rand-zacht); border-radius: 18px; padding: 0; cursor: pointer;
    display: flex; flex-direction: column;
    box-shadow: 0 1px 2px rgba(29,29,29,.04);
    transition: transform .2s cubic-bezier(.32,.9,.3,1), box-shadow .2s ease, background .2s ease, opacity .2s ease;
  }
  .lb-kaartje:hover, .lb-kaartje:focus-within { background: #FFFFFF; transform: translateY(-2px); box-shadow: 0 4px 14px rgba(29,29,29,.09); }
  /* Een lesboom zonder onderwerpen is wél te openen — je ziet dan een lege raat.
     De onderbroken rand zegt dat er nog niets in zit. */
  .lb-kaartje[data-leeg="ja"] { border-style: dashed; border-color: var(--pad-neutraal); }
  .lb-kaartje[data-sleept="ja"] { opacity: .5; transform: none; }
  /* De hele kaart is de knop; de speld ligt er als tweede knop overheen. */
  .lb-kaart-hoofd {
    flex: 1 1 auto; display: flex; flex-direction: column; gap: 9px;
    padding: 14px 15px 12px; border: 0; border-radius: 18px; background: transparent;
    font-family: inherit; color: inherit; text-align: left; cursor: inherit;
  }
  .lb-kaart-pin {
    position: absolute; top: 10px; right: 10px; width: 26px; height: 26px; padding: 0;
    display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid transparent; border-radius: 999px; background: transparent;
    color: var(--pad-neutraal); cursor: pointer; font-family: inherit;
    transition: color .16s ease, background .16s ease, border-color .16s ease;
  }
  .lb-kaartje:hover .lb-kaart-pin { color: var(--tekst-secundair); }
  .lb-kaart-pin:hover { background: #FDEED3; border-color: var(--rand-zacht); color: var(--st-donker); }
  .lb-kaart-pin[data-vast="ja"] { color: var(--st-oranje); border-color: var(--rand-zacht); background: #FFFFFF; }
  .lb-tegel { transition: scale .25s cubic-bezier(.34,1.3,.64,1); transform-box: fill-box; transform-origin: center; }
  .lb-tegel-groep:hover .lb-tegel, .lb-tegel-groep:focus-visible .lb-tegel { scale: 1.06; }
  /* De aanbevolen tegel: een zachte radiale gloed die langzaam op- en afzwelt en
     een tegel die nauwelijks merkbaar ademt. Samen maakt dat de raat levend in
     plaats van een stilstaand schema (ontwerp: Lesboom Elektra). */
  .lb-gloed { animation: lb-gloedpuls 4s ease-in-out infinite; }
  @keyframes lb-gloedpuls { 0%, 100% { opacity: .4; } 50% { opacity: .75; } }
  .lb-adem { animation: lb-adem 4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
  @keyframes lb-adem { 0%, 100% { scale: 1; } 50% { scale: 1.035; } }
  /* Met de muis klikken mag geen ring geven; toetsenbordfocus wel, in het oranje. */
  .lb-tegel-groep:focus { outline: none; }
  .lb-tegel-groep:focus-visible { outline: 2px solid var(--st-oranje); outline-offset: 3px; border-radius: 10px; }
  .lb-paneel {
    position: absolute; inset: 0; z-index: 40; background: #FFFFFF;
    border: 1px solid var(--rand-zacht); border-radius: 22px; box-shadow: 0 1px 3px rgba(29,29,29,.06);
    visibility: hidden; pointer-events: none; overflow: hidden; display: flex; flex-direction: column;
  }
  .lb-paneel[data-open="ja"] { visibility: visible; pointer-events: auto; animation: lb-inschuif .3s cubic-bezier(.22,.9,.3,1) forwards; }
  @keyframes lb-inschuif { from { transform: translateY(14px); opacity: .4; } to { transform: translateY(0); opacity: 1; } }
  .lb-sluit {
    width: 29px; height: 29px; border-radius: 999px; border: 1px solid var(--rand-zacht);
    background: #FFFFFF; color: var(--st-donker); font-size: 14px; line-height: 1;
    cursor: pointer; flex: none; font-family: inherit;
  }
  .lb-sluit:hover { background: #FDEED3; }
  /* Het sluitkruis staat overal op dezelfde plek: vast rechtsboven in de kaart
     of het paneel, niet los naast voortgang of legenda (afvinklijst 5). */
  .kaart-sluit { position: absolute; top: 16px; right: 18px; z-index: 45; }
  .lb-sortopt, .lb-trefrij {
    display: flex; align-items: center; width: 100%; cursor: pointer; font-family: inherit;
    text-align: left; border: 0; background: transparent; color: var(--st-donker);
    border-radius: 12px; transition: background .14s ease;
  }
  .lb-sortopt { justify-content: space-between; gap: 14px; font-size: 12.5px; font-weight: 600; padding: 8px 12px; }
  .lb-trefrij { padding: 9px 11px; border-radius: 14px; gap: 11px; }
  .lb-sortopt:hover, .lb-trefrij:hover { background: #FDEED3; }
  .lb-legknop {
    border: 1px solid var(--rand-zacht); background: #FFFFFF; color: var(--tekst-secundair);
    cursor: pointer; font-family: inherit; font-size: 11.5px; font-weight: 700;
    padding: 5px 11px; border-radius: 999px; transition: background .16s ease, color .16s ease;
  }
  .lb-legknop:hover { background: #FDEED3; color: var(--st-donker); }
  .lb-lesrij { cursor: pointer; transition: border-color .16s ease, background .16s ease, transform .16s ease; }
  .lb-lesrij:hover, .lb-lesrij:focus-visible { border-color: var(--st-oranje); background: #FFFFFF; transform: translateY(-1px); }
  .lb-zoekveld {
    display: flex; align-items: center; gap: 8px; box-sizing: border-box; width: 294px; height: 34px;
    padding: 0 8px 0 13px; border-radius: 999px; background: #FFFFFF; border: 1px solid var(--st-oranje);
    animation: lb-zoekop .2s cubic-bezier(.32,.9,.3,1);
  }
  @keyframes lb-zoekop { from { width: 104px; opacity: .4; } }
  /* De zwevende "Vraag het de AI"-pill bij een tekstselectie (herontwerp §9/Les). */
  .lb-selpil {
    position: absolute; z-index: 30; display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px;
    border-radius: 999px; background: #FFFFFF; border: 1px solid var(--st-oranje); box-shadow: 0 4px 14px rgba(29,29,29,.14);
    font-family: inherit; font-size: 12px; font-weight: 700; color: var(--st-donker); cursor: pointer; white-space: nowrap;
    transform: translateX(-50%); animation: lb-pilop .16s ease-out;
  }
  .lb-selpil:hover { background: #FDEED3; }
  @keyframes lb-pilop { from { opacity: 0; transform: translateX(-50%) translateY(4px); } }
  #leesgebied ::selection { background: #FDEED3; }
  @media (prefers-reduced-motion: reduce) {
    .lb-kaartje, .lb-tegel, .lb-paneel { transition: none; }
    .lb-kaartje:hover, .lb-kaartje:focus-within { transform: none; }
    .lb-tegel-groep:hover .lb-tegel, .lb-tegel-groep:focus-visible .lb-tegel { scale: 1; }
    .lb-gloed { animation: none; opacity: .55; }
    .lb-adem { animation: none; }
    .lb-paneel[data-open="ja"] { animation: none; }
    .lb-zoekveld { animation: none; }
    .lb-selpil { animation: none; }
  }
  .lb-rustig .lb-kaartje, .lb-rustig .lb-tegel, .lb-rustig .lb-paneel, .lb-rustig .instellingen-paneel { transition: none; }
  .lb-rustig .lb-kaartje:hover, .lb-rustig .lb-kaartje:focus-within { transform: none; }
  .lb-rustig .lb-tegel-groep:hover .lb-tegel, .lb-rustig .lb-tegel-groep:focus-visible .lb-tegel { scale: 1; }
  .lb-rustig .lb-gloed { animation: none; opacity: .55; }
  .lb-rustig .lb-adem { animation: none; }
  .lb-rustig .lb-paneel[data-open="ja"] { animation: none; }
  .lb-rustig .lb-zoekveld { animation: none; }
  .lb-rustig .lb-selpil { animation: none; }
  .lb-rustig .instellingen-paneel[data-open="ja"] { animation: none; }

  /* Instellingenpaneel: dezelfde inschuifbeweging als het lesdetail (lb-inschuif),
     maar als vast rechterpaneel boven de hele app. */
  .instellingen-paneel {
    position: fixed; top: 16px; right: 16px; bottom: 16px; width: 320px; max-width: calc(100vw - 32px);
    z-index: 70; background: #FFFFFF; border: 1px solid var(--rand-zacht); border-radius: 22px;
    box-shadow: 0 8px 24px rgba(29,29,29,.14); padding: 20px; box-sizing: border-box;
    display: flex; flex-direction: column; gap: 16px; overflow: hidden;
    visibility: hidden; pointer-events: none;
  }
  .instellingen-paneel[data-open="ja"] { visibility: visible; pointer-events: auto; animation: lb-inschuif .3s cubic-bezier(.22,.9,.3,1) forwards; }
  @media (prefers-reduced-motion: reduce) { .instellingen-paneel[data-open="ja"] { animation: none; } }
`;


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

// Antwoordoptie + letterrondje uit 09 — goed groen, fout rood, verder neutraal.
const VRAAG_LETTERS = ["A", "B", "C", "D", "E", "F"];

function vraagLetterStijl(status) {
  const grond = status === "goed" ? "#E8F4EC" : status === "fout" ? "#FBF1F0" : "#FFFCF7";
  const rand = status === "goed" ? "#9CCBAD" : status === "fout" ? "#E8A9A5" : UI.randZacht;
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24,
    borderRadius: 999, flex: "none", background: grond, border: `1px solid ${rand}`,
    fontSize: 11.5, fontWeight: 700, boxSizing: "border-box",
  };
}

function antwoordStijl(status) {
  const basis = {
    display: "flex", alignItems: "flex-start", gap: 11, padding: "12px 14px", borderRadius: 14,
    border: `1px solid ${UI.randZacht}`, background: "#FFFFFF", width: "100%", boxSizing: "border-box",
    textAlign: "left", fontFamily: "inherit",
  };
  if (status === "goed") return { ...basis, background: "#E8F4EC", border: "1px solid #9CCBAD" };
  if (status === "fout") return { ...basis, background: "#FBF1F0", border: "1px solid #E8A9A5" };
  return basis;
}

function MeerkeuzeVraag({ vraag, gekozen, setGekozen, opAntwoord }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {vraag.opties.map((optie, i) => {
        const isGekozen = gekozen === i;
        const isJuist = i === vraag.juisteIndex;
        const status = gekozen === null ? null : isJuist ? "goed" : isGekozen ? "fout" : null;

        return (
          <button
            key={i}
            type="button"
            disabled={gekozen !== null}
            onClick={() => {
              setGekozen(i);
              opAntwoord(i === vraag.juisteIndex);
            }}
            className="lb-lesrij"
            style={{ ...antwoordStijl(status), opacity: gekozen !== null && status === null ? 0.5 : 1 }}
          >
            <span style={vraagLetterStijl(status)}>{VRAAG_LETTERS[i] || i + 1}</span>
            <span style={{ flex: "1 1 0%", minWidth: 0, fontSize: 13.5, lineHeight: 1.45, color: "#1D1D1D" }}>{optie}</span>
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

function SORTEER_PIJL_STIJL(uit) {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26,
    borderRadius: 999, flex: "none", background: "#FFFFFF", border: `1px solid ${UI.randZacht}`,
    fontSize: 12, fontFamily: "inherit", cursor: uit ? "default" : "pointer", opacity: uit ? 0.35 : 1,
  };
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
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {volgorde.map((itemIndex, pos) => {
        const opJuistePlek = itemIndex === vraag.juisteVolgorde[pos];
        const status = beantwoord ? (opJuistePlek ? "goed" : "fout") : null;

        return (
          <div key={itemIndex} style={antwoordStijl(status)}>
            <span style={vraagLetterStijl(status)}>{pos + 1}</span>
            <span style={{ flex: "1 1 0%", minWidth: 0, fontSize: 13.5, lineHeight: 1.45, color: "#1D1D1D" }}>
              {vraag.items[itemIndex]}
            </span>
            {!beantwoord && (
              <div style={{ display: "flex", gap: 6, flex: "none" }}>
                <button type="button" onClick={() => verplaats(pos, -1)} disabled={pos === 0} aria-label="Omhoog" style={SORTEER_PIJL_STIJL(pos === 0)}>↑</button>
                <button type="button" onClick={() => verplaats(pos, 1)} disabled={pos === volgorde.length - 1} aria-label="Omlaag" style={SORTEER_PIJL_STIJL(pos === volgorde.length - 1)}>↓</button>
              </div>
            )}
          </div>
        );
      })}

      {!beantwoord && (
        <button type="button" className="knop2" style={{ width: "100%", marginTop: 2 }} onClick={controleer}>
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
          {vraag.paren.map((paar, i) => {
            const gekoppeldAan = koppels[i];
            const isActief = actiefLinks === i;
            const isJuist = gekoppeldAan === i;
            const status = beantwoord ? (isJuist ? "goed" : "fout") : null;

            const stijl = { ...antwoordStijl(status), flexDirection: "column", alignItems: "stretch", gap: 2, cursor: beantwoord ? "default" : "pointer" };
            if (!beantwoord && isActief) { stijl.borderColor = "#F6A923"; stijl.borderWidth = 2; stijl.background = "#FDEED3"; }
            else if (!beantwoord && gekoppeldAan !== undefined) { stijl.borderColor = "#1D1D1D"; }

            return (
              <button key={i} type="button" disabled={beantwoord} onClick={() => setActiefLinks(isActief ? null : i)} style={stijl}>
                <span style={{ fontSize: 13.5, color: "#1D1D1D" }}>{paar.links}</span>
                {gekoppeldAan !== undefined && (
                  <span style={{ fontSize: 12, color: UI.tekstSecundair }}>→ {vraag.paren[gekoppeldAan].rechts}</span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
          {rechtsVolgorde.map((rechtsIndex) => {
            const alGebruikt = Object.values(koppels).includes(rechtsIndex);
            const stijl = { ...antwoordStijl(null), cursor: beantwoord || actiefLinks === null ? "default" : "pointer" };
            if (beantwoord) { stijl.background = "#FFFCF7"; stijl.opacity = 0.6; }
            else if (alGebruikt) { stijl.background = "#FFFCF7"; stijl.opacity = 0.5; }
            else if (actiefLinks !== null) { stijl.borderColor = "#1D1D1D"; }

            return (
              <button key={rechtsIndex} type="button" disabled={beantwoord || actiefLinks === null} onClick={() => kiesRechts(rechtsIndex)} style={stijl}>
                <span style={{ fontSize: 13.5, color: "#1D1D1D" }}>{vraag.paren[rechtsIndex].rechts}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!beantwoord && (
        <>
          <p style={{ margin: "10px 0 0", fontSize: 11.5, color: ST.zilver }}>
            {actiefLinks === null
              ? "Klik links op een item, daarna rechts op de match."
              : "Kies nu rechts de bijbehorende waarde."}
          </p>
          <button type="button" className="knop2" style={{ width: "100%", marginTop: 8, opacity: allesGekoppeld ? 1 : 0.4, cursor: allesGekoppeld ? "pointer" : "not-allowed" }} disabled={!allesGekoppeld} onClick={controleer}>
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

// ============================================================================
// HERHALEN — herontwerp §9, checklist §7
// ============================================================================
function Herhaalsessie({ due, oefenVragen = [], kennis = {}, domeinen, opAntwoord, opKlaar, opNaarLes }) {
  // De wachtrij wordt bij de start bevroren. Antwoorden veranderen de actuele
  // Leitner-status, maar mogen de lopende sessie niet onder de gebruiker vandaan
  // herschikken of inkorten.
  const [sessieVragen, setSessieVragen] = useState(() => (Array.isArray(due) ? [...due] : []));
  const [oefenModus, setOefenModus] = useState(false);
  const [index, setIndex] = useState(0);
  const [gekozen, setGekozen] = useState(null);
  const [juist, setJuist] = useState(false);
  const [score, setScore] = useState({ goed: 0, fout: 0 });

  // Oefenen staat los van het herhaalschema: er wordt niets in de Leitner-dozen
  // bijgewerkt, zodat een geplande herhaling op zijn eigen moment blijft komen.
  function startOefenen() {
    setSessieVragen(oefenVragen.map((v) => ({ ...v, doos: null })));
    setOefenModus(true);
    setIndex(0);
    setGekozen(null);
    setJuist(false);
    setScore({ goed: 0, fout: 0 });
  }

  useEffect(() => {
    function bijToets(e) {
      if (e.key === "Escape") opKlaar();
    }
    window.addEventListener("keydown", bijToets);
    return () => window.removeEventListener("keydown", bijToets);
  }, [opKlaar]);

  const huidig = sessieVragen[index];

  // De dozen met echte aantallen. Staat er nog niets in, dan staan er nullen —
  // geen verzonnen herhaalgeschiedenis (afvinklijst 8).
  const dozenUitKennis = DOZEN.map((d) => ({
    ...d,
    aantal: Object.values(kennis).filter((k) => k && k.doos === d.doos).length,
  }));

  if (!huidig) {
    const klaarMetSessie = sessieVragen.length > 0;
    return (
      <div style={KAART_STIJL}>
        <div style={{ flex: "none", display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ST.zilver }}>Herhalen</div>
            <div style={{ fontSize: 23, fontWeight: 700, lineHeight: 1.15, marginTop: 2 }}>
              {klaarMetSessie ? (oefenModus ? "Oefenen afgerond" : "Herhaling afgerond") : "Nog niets ingepland"}
            </div>
            {klaarMetSessie && (
              <div style={{ fontSize: 13, color: UI.tekstSecundair, marginTop: 3 }}>
                {score.goed} goed, {score.fout} fout.
              </div>
            )}
          </div>
          <button type="button" className="lb-sluit kaart-sluit" aria-label="Herhalen sluiten" onClick={opKlaar}>✕</button>
        </div>

        <div className="app-columns" style={{ flex: "1 1 0%", minHeight: 0 }}>
          <div style={{ flex: "1 1 0%", minWidth: 0, background: UI.kaartZacht, border: `1px solid ${UI.randZacht}`, borderRadius: 18, padding: 20, boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
            {oefenVragen.length > 0 ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Alvast oefenen</div>
                <div style={{ fontSize: 13, color: UI.tekstSecundair }}>
                  {oefenVragen.length} {oefenVragen.length === 1 ? "vraag" : "vragen"} uit de gepubliceerde lessen.
                </div>
                <button type="button" className="knop" style={{ alignSelf: "flex-start" }} onClick={startOefenen}>
                  Nu alvast oefenen
                </button>
              </>
            ) : (
              <div style={{ fontSize: 13, color: UI.tekstSecundair }}>Nog geen vragen om mee te oefenen.</div>
            )}
            <button type="button" className="knop2" style={{ alignSelf: "flex-start" }} onClick={opKlaar}>Terug naar overzicht</button>
          </div>

          <aside className="app-sidebar" style={{ background: UI.kaartZacht, border: `1px solid ${UI.randZacht}`, borderRadius: 18, padding: 16, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ST.zilver }}>Geheugensterkte</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, overflow: "hidden auto" }}>
              {dozenUitKennis.map((d) => (
                <div key={d.doos} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 14, background: UI.kaart, border: `1px solid ${UI.randZacht}` }}>
                  <span style={{ width: 9, height: 9, borderRadius: 999, flex: "none", background: d.aantal > 0 ? ST.oranje : UI.randZacht }} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, flex: "1 1 0%", minWidth: 0 }}>{d.naam}</span>
                  <span style={{ fontSize: 12, color: UI.tekstSecundair, flex: "none" }}>
                    {d.aantal} {d.aantal === 1 ? "vraag" : "vragen"}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  const domein = domeinen.find((d) => d.id === huidig.topic.domeinId) || { kleur: ST.zilver, naam: "" };
  const domeinNamen = [...new Set(
    sessieVragen.map((v) => (domeinen.find((d) => d.id === v.topic.domeinId) || {}).naam).filter(Boolean)
  )];
  const dozenTelling = DOZEN.map((d) => ({ ...d, aantal: sessieVragen.filter((v) => v.doos === d.doos).length }));

  function antwoord(isJuist) {
    setJuist(isJuist);
    setScore((s) => ({ goed: s.goed + (isJuist ? 1 : 0), fout: s.fout + (isJuist ? 0 : 1) }));
    if (!oefenModus) opAntwoord(huidig.vraag.id, isJuist);
  }

  function verder() {
    setIndex(index + 1);
    setGekozen(null);
    setJuist(false);
  }

  return (
    <div style={KAART_STIJL}>
      <div style={{ flex: "none", display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "nowrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ST.zilver }}>
            {oefenModus ? "Oefenen" : "Herhalen"}
          </div>
          <div style={{ fontSize: 23, fontWeight: 700, lineHeight: 1.15, marginTop: 2 }}>
            {oefenModus
              ? `${sessieVragen.length} ${sessieVragen.length === 1 ? "oefenvraag" : "oefenvragen"}`
              : `${sessieVragen.length} ${sessieVragen.length === 1 ? "vraag is" : "vragen zijn"} aan de beurt`}
          </div>
          <div style={{ fontSize: 13, color: UI.tekstSecundair, marginTop: 3 }}>
            {oefenModus ? "Oefenen telt niet mee voor je herhaalschema." : domeinNamen.length > 0 ? `Uit ${domeinNamen.join(", ")}.` : ""}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, flex: "none" }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: UI.tekstSecundair, whiteSpace: "nowrap" }}>
            vraag {index + 1} van {sessieVragen.length}
          </span>
          <button type="button" className="lb-sluit" aria-label="Herhaalsessie sluiten" onClick={opKlaar}>✕</button>
        </div>
      </div>

      <div style={{ flex: "1 1 0%", minHeight: 0, display: "flex", gap: 16, alignItems: "stretch", flexWrap: "nowrap", overflow: "hidden" }}>
        <div style={{ flex: "1 1 0%", minWidth: 0, background: UI.kaartZacht, border: `1px solid ${UI.randZacht}`, borderRadius: 18, display: "flex", flexDirection: "column", overflow: "hidden", padding: "18px 20px", boxSizing: "border-box" }}>
          <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8 }}>
            {sessieVragen.map((_, i) => (
              <span key={i} style={{ width: 9, height: 9, borderRadius: 999, flex: "none", background: i < index ? UI.succes : i === index ? "#F6A923" : UI.randZacht }} />
            ))}
          </div>
          <div style={{ flex: "1 1 0%", minHeight: 0, overflow: "hidden auto", marginTop: 16 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ST.zilver }}>
              {domein.naam} · {huidig.topic.titel}
            </div>
            <div style={{ fontSize: 19, fontWeight: 700, marginTop: 7, maxWidth: "52ch" }}>{huidig.vraag.vraag}</div>
            <div style={{ marginTop: 14, maxWidth: "64ch" }}>
              <Vraag key={`${huidig.vraag.id}-${index}`} vraag={huidig.vraag} gekozen={gekozen} setGekozen={setGekozen} opAntwoord={antwoord} />
            </div>
            {gekozen !== null && (
              <div style={{ fontSize: 12.5, color: UI.tekstSecundair, marginTop: 12, maxWidth: "60ch", lineHeight: 1.5 }}>
                <span style={{ fontWeight: 700, color: juist ? UI.succes : "#E32118" }}>
                  {juist ? "Goed — schuift een doos op. " : "Niet juist — terug naar doos 1. "}
                </span>
                {huidig.vraag.uitleg}
                {!juist && opNaarLes && (
                  <div style={{ marginTop: 6 }}>
                    <button
                      type="button"
                      onClick={() => opNaarLes(huidig.topic.id)}
                      style={{ fontSize: 12.5, color: UI.tekstSecundair, textDecoration: "underline", background: "none", border: 0, cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                    >
                      Lees de les terug: {huidig.orb.titel}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, paddingTop: 14 }}>
            <button
              type="button"
              className="knop"
              onClick={gekozen !== null ? verder : undefined}
              disabled={gekozen === null}
              style={gekozen === null ? { opacity: 0.4, cursor: "default" } : undefined}
            >
              {index + 1 === sessieVragen.length ? "Afronden" : "Volgende vraag"}
            </button>
            <button type="button" className="knop2" onClick={opKlaar}>Later afmaken</button>
          </div>
        </div>

        <div style={{ flex: "0 0 288px", maxWidth: 288, display: "flex", flexDirection: "column", overflow: "hidden", padding: 16, boxSizing: "border-box", background: UI.kaartZacht, border: `1px solid ${UI.randZacht}`, borderRadius: 18 }}>
          <div style={{ flex: "none", fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ST.zilver }}>
            Geheugensterkte
          </div>
          <div style={{ fontSize: 13, color: UI.tekstSecundair, marginTop: 8, lineHeight: 1.5 }}>
            Goed antwoord schuift een vraag naar een ruimer interval. Fout antwoord zet hem terug naar dagelijks.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 14, flex: "1 1 0%", minHeight: 0, overflow: "hidden auto" }}>
            {dozenTelling.map((d) => (
              <div key={d.doos} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 14, background: "#FFFFFF", border: `1px solid ${UI.randZacht}` }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, flex: "none", background: d.doos === huidig.doos ? "#F6A923" : UI.padNeutraal }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, flex: "1 1 0%", minWidth: 0 }}>{d.naam}</span>
                <span style={{ fontSize: 12, color: UI.tekstSecundair, flex: "none" }}>{d.aantal}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SCHERMEN
// ============================================================================

// ============================================================================
// DE HONINGRAAT — vormtaal van het herontwerp
//
// Eén tegelvorm (punt boven), kolom = tier, rij = track in een zigzag rond het
// midden. Status bepaalt vulling en rand, en niets anders. Naden lopen van
// middelpunt tot middelpunt, onder de tegels. Precies één tegel is aanbevolen.
// Zie design/herontwerp/01 - vormtaal lesboom (spec).md, secties 2 t/m 4, en
// design/herontwerp/09 - onderdelen (de enige toegestane bouwstenen).md.
// ============================================================================
const RAAT_HEX_PAD =
  "M -9.7 34.4 Q 0 40 9.7 34.4 L 24.94 25.6 Q 34.64 20 34.64 7.68 L 34.64 -7.68 Q 34.64 -20 24.94 -25.6 L 9.7 -34.4 Q 0 -40 -9.7 -34.4 L -24.94 -25.6 Q -34.64 -20 -34.64 -7.68 L -34.64 7.68 Q -34.64 20 -24.94 25.6 Z";
const RAAT_DX = 69;
const RAAT_DY = 60;

// De raat leest als één honingraat: de tegels raken elkaar (RAAT_DX/DY sluiten
// precies aan) en worden gescheiden door een naad in de kleur van het paneel,
// zoals in de ontwerpschermen. De vulling draagt de status; `later` is bewust
// een warm zand en niet het bijna-witte paneelgrijs, anders oogt een lesboom
// zonder voortgang koud en leeg (afvinklijst 4). Kleur is nooit het enige
// onderscheid: elke status heeft ook een eigen merkteken en aria-woord.
const RAAT_NAAD = "#FFFCF7";
const RAAT_STATUS = {
  af: { vulling: "#E3F1E8", rand: RAAT_NAAD, randDik: 3.5, merkPad: "M -12 1 L -4 9 L 13 -9", merkKleur: "#2E7D4F", woord: "afgerond" },
  bezig: { vulling: "#FFFFFF", rand: "#F6A923", randDik: 2.5, merkPad: "", merkKleur: "#F6A923", woord: "bezig" },
  later: { vulling: "#F7EBD7", rand: RAAT_NAAD, randDik: 3.5, merkPad: "", merkKleur: "#B87B12", woord: "later" },
  leeg: { vulling: "#F1EAE0", rand: RAAT_NAAD, randDik: 3.5, merkPad: "M -10 0 L 10 0", merkKleur: "#AE9C86", woord: "nog geen lessen" },
};

// Vulling/rand van een tegel: alleen dit bepaalt de status.
function topicRaatStatus(topic, voortgang) {
  const totaal = topic.orbs.length;
  if (totaal === 0) return "leeg";
  const gedaan = voortgang[topic.id] || 0;
  if (gedaan >= totaal) return "af";
  if (gedaan > 0) return "bezig";
  return "later";
}

// Rijindex rond het midden: eerste track in het midden (0), tweede erboven
// (-1), derde eronder (+1), vierde twee erboven (-2), enz. — spec §2.
function raatRijIndexen(tracksOplopend) {
  const indexen = {};
  tracksOplopend.forEach((track, i) => {
    if (i === 0) { indexen[track] = 0; return; }
    const magnitude = Math.ceil(i / 2);
    indexen[track] = i % 2 === 1 ? -magnitude : magnitude;
  });
  return indexen;
}

// Bouwt de tegels en naden van één lesboom (domein). Levert ook op welke tegel
// aanbevolen is: de eerste ontgrendelde, niet-afgeronde in tier-volgorde.
//
// Aanname: elk onderwerp heeft hoogstens één voorganger (`prerequisites[0]`),
// zoals de beheer-wizard ze ook aanmaakt; de spec-uitzondering "twee
// voorgangers op één topic" komt in het datamodel niet voor en wordt hier niet
// apart afgehandeld.
function bouwRaat(domeinTopics, alleTopics, voortgang, domeinKleur) {
  if (domeinTopics.length === 0) {
    return { tegels: [], naden: [], viewBox: "0 0 100 100", viewBoxKrap: "0 0 100 100", aanbevolenId: null };
  }

  const gesorteerd = [...domeinTopics].sort((a, b) => {
    const tierA = topicTier(a), tierB = topicTier(b);
    if (tierA !== tierB) return tierA - tierB;
    const trackA = a.gridPos ? a.gridPos.track : 1;
    const trackB = b.gridPos ? b.gridPos.track : 1;
    return trackA - trackB;
  });

  const tracksAanwezig = [...new Set(gesorteerd.map((t) => (t.gridPos ? t.gridPos.track : 1)))];
  const rijIndexen = raatRijIndexen(tracksAanwezig);

  let aanbevolenId = null;
  const tegels = gesorteerd.map((topic) => {
    const kolom = topicTier(topic) - 1;
    const track = topic.gridPos ? topic.gridPos.track : 1;
    const rij = rijIndexen[track] || 0;
    const rijOneven = ((rij % 2) + 2) % 2 === 1;
    const x = 40 + kolom * RAAT_DX + (rijOneven ? RAAT_DX / 2 : 0);
    const y = 100 + rij * RAAT_DY;

    const status = topicRaatStatus(topic, voortgang);
    const ontgrendeld = isTopicUnlocked(topic, alleTopics, voortgang);
    if (!aanbevolenId && ontgrendeld && status !== "af" && status !== "leeg") aanbevolenId = topic.id;
    const deel = topic.orbs.length > 0 ? Math.min(1, (voortgang[topic.id] || 0) / topic.orbs.length) : 0;

    return { topic, x, y, status, ontgrendeld, deel };
  });
  tegels.forEach((t) => { t.aanbevolen = t.topic.id === aanbevolenId; });

  const naden = [];
  tegels.forEach((tegel) => {
    (tegel.topic.prerequisites || []).forEach((voorgangerId) => {
    const bron = tegels.find((t) => t.topic.id === voorgangerId);
    if (!bron) return;
    let kleur = domeinKleur, dekking = 0.4;
    if (!tegel.ontgrendeld) { kleur = UI.padNeutraal; dekking = 0.55; }
    else if (bron.status === "af" && tegel.status === "bezig") { dekking = 0.75; }
    // Een korte brug rond het midden van de twee tegels in plaats van een lijn
    // van middelpunt tot middelpunt: die laatste steekt onder een doorzichtig
    // gemaakte tegel vandaan en leest dan als een losse streep.
    const mx = (bron.x + tegel.x) / 2, my = (bron.y + tegel.y) / 2;
    const lengte = Math.hypot(tegel.x - bron.x, tegel.y - bron.y) || 1;
    const halve = 13 / lengte;
    naden.push({
      x1: mx - (tegel.x - bron.x) * halve, y1: my - (tegel.y - bron.y) * halve,
      x2: mx + (tegel.x - bron.x) * halve, y2: my + (tegel.y - bron.y) * halve,
      kleur, dekking, van: bron.topic.id, naar: tegel.topic.id,
    });
    });
  });

  // Marge onderin is ruimer: de hover/gekozen-naamlabel (spec §5) hangt tot
  // ~67 eenheden onder een tegelmiddelpunt en moet altijd in beeld blijven,
  // ook als de onderste tegel toevallig de gehoverde is.
  const xs = tegels.map((t) => t.x), ys = tegels.map((t) => t.y);
  const margeX = 58, margeBovenY = 58, margeOnderY = 80;
  const x0 = Math.min(...xs) - margeX, y0 = Math.min(...ys) - margeBovenY;
  const breedte = Math.max(...xs) + margeX - x0, hoogte = Math.max(...ys) + margeOnderY - y0;

  // De miniatuur toont geen naamlabels en heeft die ruime marge dus niet nodig;
  // met een krappe uitsnede blijven de tegels op een kaartje herkenbaar in
  // plaats van een grijs vlekje.
  const kx0 = Math.min(...xs) - 38, ky0 = Math.min(...ys) - 43;
  const kBreedte = Math.max(...xs) + 38 - kx0, kHoogte = Math.max(...ys) + 43 - ky0;

  return {
    tegels, naden, aanbevolenId,
    viewBox: `${x0} ${y0} ${breedte} ${hoogte}`,
    viewBoxKrap: `${kx0} ${ky0} ${kBreedte} ${kHoogte}`,
  };
}

// Eén tegel. `groot`=false is de stille miniatuur op een lesboomkaartje;
// `groot`=true is de echte raat (nu: het geopende lesboompaneel op het
// overzicht), met hover-schaal, focus en — op de aanbevolen tegel — de
// ademende gloed. Klikken op een tegel volgt in het volgende scherm (de
// lesboom als eigen route met lesdetail); hier staat de tegel al wel
// focusbaar met het juiste aria-label klaar.
function RaatTegelSvg({ tegel, groot }) {
  const s = RAAT_STATUS[tegel.status];
  return (
    <g
      className={groot ? "lb-tegel-groep" : undefined}
      transform={`translate(${tegel.x},${tegel.y})`}
      tabIndex={groot ? 0 : undefined}
      role={groot ? "button" : undefined}
      aria-label={groot ? `${tegel.topic.titel}, ${s.woord}` : undefined}
    >
      {groot && tegel.aanbevolen && (
        <circle className="lb-gloed" r="62" fill="url(#lb-gloedverloop)" style={{ pointerEvents: "none" }} />
      )}
      <g className={groot && tegel.aanbevolen ? "lb-adem" : undefined}>
        <path className={groot ? "lb-tegel" : undefined} d={RAAT_HEX_PAD} fill={s.vulling} stroke={tegel.aanbevolen ? ST.oranje : s.rand} strokeWidth={tegel.aanbevolen ? 2.5 : s.randDik} />
        {s.merkPad && (
          <path d={s.merkPad} fill="none" stroke={s.merkKleur} strokeWidth={groot ? 5 : 6} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {tegel.status === "bezig" && (
          <>
            <rect x="-16" y="-3" width="32" height="6" rx="3" fill={UI.randZacht} />
            <rect x="-16" y="-3" width={Math.max(4, 32 * (tegel.deel || 0))} height="6" rx="3" fill={ST.oranje} />
          </>
        )}
      </g>
    </g>
  );
}

// De miniatuurraat op een lesboomkaartje: puur het voortgangssignaal, geen
// voortgangsbalk ernaast (spec §8).
function MiniRaat({ raat }) {
  return (
    <svg viewBox={raat.viewBoxKrap} width="100%" height="62" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style={{ display: "block", marginTop: "auto" }}>
      {raat.naden.map((n, i) => (
        <line key={i} x1={n.x1} y1={n.y1} x2={n.x2} y2={n.y2} stroke={n.kleur} strokeOpacity={n.dekking} strokeLinecap="round" strokeWidth="4" />
      ))}
      {raat.tegels.map((t) => (
        <RaatTegelSvg key={t.topic.id} tegel={t} groot={false} />
      ))}
    </svg>
  );
}

// Klein tegeltje voor een zoektreffer in de chromerij (22×24 viewBox, spec §8).
function TrefferTegelSvg({ status }) {
  const s = RAAT_STATUS[status];
  return (
    <svg width="19" height="21" viewBox="-40 -42 80 84" aria-hidden="true" style={{ flex: "none" }}>
      <path d={RAAT_HEX_PAD} fill={s.vulling} stroke={s.rand} strokeWidth="5.5" />
      {s.merkPad && <path d={s.merkPad} fill="none" stroke={s.merkKleur} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

const LESBOOM_SORTERINGEN = [
  { id: "gebruik", label: "Waar je mee bezig bent" },
  { id: "naam", label: "Naam A–Z" },
  { id: "voortgang", label: "Voortgang" },
  { id: "nieuw", label: "Nog niet begonnen" },
];

function sorteerLesbomen(lijst, hoe, vastgezet = []) {
  return zetVastVooraan(sorteerOpKeuze(lijst, hoe), vastgezet);
}

function sorteerOpKeuze(lijst, hoe) {
  const l = [...lijst];
  if (hoe === "naam") return l.sort((a, b) => a.domein.naam.localeCompare(b.domein.naam, "nl"));
  if (hoe === "voortgang") return l.sort((a, b) => b.pct - a.pct || a.domein.naam.localeCompare(b.domein.naam, "nl"));
  if (hoe === "nieuw") return l.sort((a, b) => a.pct - b.pct || a.domein.naam.localeCompare(b.domein.naam, "nl"));
  return l; // "gebruik": de volgorde die de aanroeper al meegaf (bepaalGeordendeDomeinen)
}

// Vastgezette lesbomen staan altijd vooraan, in de volgorde waarin ze zijn
// vastgezet. De rest houdt de volgorde die de sortering opleverde (sort is
// stabiel, dus die blijft staan).
function zetVastVooraan(lijst, vastgezet) {
  if (!vastgezet || vastgezet.length === 0) return lijst;
  const rang = (id) => {
    const i = vastgezet.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...lijst].sort((a, b) => rang(a.domein.id) - rang(b.domein.id));
}

function verrijkLesboom(domein, alleTopics, voortgang) {
  const domeinTopics = alleTopics.filter((t) => t.domeinId === domein.id);
  const raat = bouwRaat(domeinTopics, alleTopics, voortgang, domein.kleur);
  const totaal = domeinTopics.length;
  const klaar = domeinTopics.filter((t) => topicRaatStatus(t, voortgang) === "af").length;
  const pct = totaal > 0 ? Math.round((klaar / totaal) * 100) : 0;
  return { domein, domeinTopics, raat, totaal, klaar, pct };
}

// Aantal leerroutes: onderwerpen die zelf nergens voorganger van zijn — elk
// zo'n blad is het einde van één pad vanaf de wortel(s).
function aantalLeerroutes(domeinTopics) {
  const gebruikt = new Set();
  domeinTopics.forEach((t) => (t.prerequisites || []).forEach((id) => gebruikt.add(id)));
  const bladeren = domeinTopics.filter((t) => !gebruikt.has(t.id));
  return bladeren.length || (domeinTopics.length ? 1 : 0);
}

function routeTekst(topic, domeinTopics, isAanbevolen) {
  const keten = voorgangers(topic, domeinTopics).reverse();
  const basis = keten.length === 0 ? "Startpunt van dit leerpad." : `Na ${keten.map((t) => t.titel).join(" → ")}.`;
  return isAanbevolen ? `${basis} Dit is nu je aanbevolen stap.` : basis;
}

const LEGENDA_ITEMS = [
  { label: "aanbevolen", vulling: "#FFFFFF", rand: ST.oranje, randDik: 2, gloed: true },
  { label: "afgerond", vulling: RAAT_STATUS.af.vulling, rand: "#9CCBAD" },
  { label: "bezig", vulling: RAAT_STATUS.bezig.vulling, rand: ST.oranje },
  { label: "later", vulling: RAAT_STATUS.later.vulling, rand: "#E4D2B4" },
  { label: "nog geen lessen", vulling: RAAT_STATUS.leeg.vulling, rand: "#DDD0BE" },
];

const BLOK_SOORT_LABEL = {
  tekst: "tekstblok", vergelijking: "vergelijking", tijdlijn: "tijdlijn", verhouding: "verhoudingsblok",
  stappen: "stappenblok", mythe: "mythe-blok", pictogram: "pictogram", afbeelding: "afbeelding",
};

const LESRIJ_PIL_STIJL = {
  af: { display: "inline-flex", alignItems: "center", height: 19, padding: "0 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap", background: "#E8F4EC", color: "#2E7D4F" },
  bezig: { display: "inline-flex", alignItems: "center", height: 19, padding: "0 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap", background: "#FDEED3", color: "#1D1D1D" },
  nieuw: { display: "inline-flex", alignItems: "center", height: 19, padding: "0 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap", background: "#FFFCF7", color: UI.tekstSecundair, border: `1px solid ${UI.randZacht}` },
};
const LESRIJ_PIL_LABEL = { af: "af", bezig: "bezig", nieuw: "nieuw" };

// ============================================================================
// LESBOOMDETAIL — de raat zelf, met contextpaneel en lesdetail (herontwerp §3-5)
//
// Klik op een tegel kiest het onderwerp: het contextpaneel (rechts, 288px)
// toont de lessen van dat onderwerp. Klik op een les schuift een lesdetail
// over de raat (nooit over het contextpaneel) met een korte samenvatting en
// de knop om de les echt te starten — die stapt over naar de bestaande
// TopicDetail/LesScherm-navigatie. Die schermen zelf herstijlen is opdracht 3.
// ============================================================================
function LesboomDetail({ domein, domeinTopics, raat, klaar, totaal, pct, voortgang, kennis, opSluiten, opOrbStarten }) {
  const [gekozenId, setGekozenId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [legendaOpen, setLegendaOpen] = useState(false);

  useEffect(() => {
    function bijToets(e) {
      if (e.key !== "Escape") return;
      if (legendaOpen) { setLegendaOpen(false); return; }
      if (gekozenId) { setGekozenId(null); return; }
      opSluiten();
    }
    window.addEventListener("keydown", bijToets);
    return () => window.removeEventListener("keydown", bijToets);
  }, [legendaOpen, gekozenId, opSluiten]);

  function kiesTopic(topicId) {
    if (!raat.tegels.find(t => t.topic.id === topicId)?.ontgrendeld) return;
    setGekozenId(topicId);
    setLegendaOpen(false);
  }

  const padTopic = (hoverId || gekozenId) ? domeinTopics.find((t) => t.id === (hoverId || gekozenId)) : null;
  const padSet = padTopic ? new Set([padTopic.id, ...voorgangers(padTopic, domeinTopics).map((t) => t.id)]) : null;

  const maxTier = domeinTopics.length ? Math.max(...domeinTopics.map(topicTier)) : 1;
  const gekozenTopic = gekozenId ? domeinTopics.find((t) => t.id === gekozenId) : null;
  const aanbevolenTopic = raat.aanbevolenId ? domeinTopics.find((t) => t.id === raat.aanbevolenId) : null;
  const [vbX0, , vbW] = raat.viewBox.split(" ").map(Number);

  return (
    <>
      <div style={{ flex: "none", padding: "18px 22px 0", display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "10px 20px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: "1 1 260px", minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: ST.zilver }}>
            Lesbomen › {domein.naam}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "nowrap", minWidth: 0 }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", flex: "none", background: domein.kleur }} />
            <h1 style={{ fontSize: 23, margin: 0, letterSpacing: "-.02em", lineHeight: 1.15, whiteSpace: "nowrap" }}>{domein.naam}</h1>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "0 1 auto", minWidth: 0, paddingRight: 34 }}>
          <div style={{ flex: "1 1 150px", minWidth: 148, maxWidth: 210, display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11.5, fontWeight: 700, color: UI.tekstSecundair, whiteSpace: "nowrap" }}>
              <span>{klaar} van {totaal} afgerond</span>
              <span style={{ color: "#1D1D1D" }}>{pct}%</span>
            </div>
            <div style={{ height: 7, borderRadius: 999, background: "#F1E7D8", overflow: "hidden" }}>
              <div style={{ display: "block", height: "100%", width: `${pct}%`, borderRadius: 999, background: "#F6A923" }} />
            </div>
          </div>
          <div style={{ position: "relative", flex: "none" }}>
            <button type="button" className="lb-legknop" aria-expanded={legendaOpen} onClick={() => setLegendaOpen((v) => !v)}>
              Legenda
            </button>
            {legendaOpen && (
              <div style={{ position: "absolute", top: 34, right: 0, zIndex: 55, background: "#FFFFFF", border: `1px solid ${UI.randZacht}`, borderRadius: 16, padding: "12px 14px", boxShadow: "0 8px 24px rgba(29,29,29,.09)", display: "flex", flexDirection: "column", gap: 7, width: 186 }}>
                {LEGENDA_ITEMS.map((it) => (
                  <span key={it.label} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11.5, color: UI.tekstSecundair }}>
                    <i style={{ width: 11, height: 11, borderRadius: 3, flex: "none", background: it.vulling, border: it.rand ? `${it.randDik || 1}px solid ${it.rand}` : "none", boxSizing: "border-box" }} />
                    {it.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <button type="button" className="lb-sluit kaart-sluit" aria-label="Terug naar de lesbomen" onClick={opSluiten}>✕</button>
      </div>

      <div style={{ flex: "1 1 auto", minHeight: 0, padding: "14px 22px 22px", display: "flex", gap: 16, alignItems: "stretch" }}>
        <div style={{ flex: "1 1 0%", minWidth: 0, minHeight: 0, position: "relative", background: UI.kaartZacht, border: `1px solid ${UI.randZacht}`, borderRadius: 18, display: "flex", overflow: "hidden" }}>
          {totaal > 0 ? (
            <svg
              viewBox={raat.viewBox}
              preserveAspectRatio="xMidYMid meet"
              role="group"
              aria-label={`Lesboom ${domein.naam}, ${totaal} onderwerpen`}
              style={{ display: "block", margin: "auto", width: "100%", height: "100%", minWidth: 0, minHeight: 0, maxWidth: "min(100%, 620px)", maxHeight: "min(100%, 340px)", overflow: "hidden" }}
            >
              <defs>
                <radialGradient id="lb-gloedverloop" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#F6A923" stopOpacity=".42" />
                  <stop offset="58%" stopColor="#F6A923" stopOpacity=".12" />
                  <stop offset="100%" stopColor="#F6A923" stopOpacity="0" />
                </radialGradient>
              </defs>
              {raat.naden.map((n, i) => {
                const buitenPad = padSet && !(padSet.has(n.van) && padSet.has(n.naar));
                return (
                  <line key={i} x1={n.x1} y1={n.y1} x2={n.x2} y2={n.y2} stroke={n.kleur} strokeLinecap="round"
                    strokeOpacity={buitenPad ? n.dekking * 0.4 : n.dekking} strokeWidth="3.5" />
                );
              })}
              {raat.tegels.map((t) => {
                const gedimd = padSet ? !padSet.has(t.topic.id) : false;
                const naamZichtbaar = t.aanbevolen || hoverId === t.topic.id || gekozenId === t.topic.id;
                const naamBreedte = Math.min(t.topic.titel.length * 6.6 + 28, vbW - 8);
                const naamX = Math.min(Math.max(t.x, vbX0 + naamBreedte / 2 + 4), vbX0 + vbW - naamBreedte / 2 - 4);
                return (
                  <g
                    key={t.topic.id}
                    style={{ opacity: gedimd ? 0.45 : 1, transition: "opacity .22s ease" }}
                    onMouseEnter={() => setHoverId(t.topic.id)}
                    onMouseLeave={() => setHoverId((h) => (h === t.topic.id ? null : h))}
                  >
                    <g onFocus={() => setHoverId(t.topic.id)} onBlur={() => setHoverId((h) => (h === t.topic.id ? null : h))} onClick={() => kiesTopic(t.topic.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); kiesTopic(t.topic.id); } }}>
                      <RaatTegelSvg tegel={t} groot />
                    </g>
                    {naamZichtbaar && (
                      <g transform={`translate(${naamX},${t.y + 44})`} style={{ pointerEvents: "none" }}>
                        <rect x={-naamBreedte / 2} y="0" width={naamBreedte} height="23" rx="11.5"
                          fill="#FFFFFF" stroke={gekozenId === t.topic.id ? "#F6A923" : "#E9DED0"} />
                        <text x="0" y="15.5" textAnchor="middle" fontSize="11.5" fontWeight={gekozenId === t.topic.id ? 700 : 600} fill="#1D1D1D">
                          {t.aanbevolen && !hoverId && !gekozenId ? "Start hier" : t.topic.titel}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          ) : (
            <div style={{ margin: "auto", fontSize: 13, color: UI.tekstSecundair }}>Nog geen onderwerpen in dit domein.</div>
          )}

        </div>

        <div style={{ flex: "0 0 288px", minWidth: 0, minHeight: 0, position: "relative", display: "flex" }}>
          {gekozenTopic ? (
            <TopicZijpaneel
              topic={gekozenTopic}
              tier={topicTier(gekozenTopic)}
              maxTier={maxTier}
              route={routeTekst(gekozenTopic, domeinTopics, gekozenTopic.id === raat.aanbevolenId)}
              voortgang={voortgang}
              opSluiten={() => setGekozenId(null)}
              opLesStarten={(orbIndex) => opOrbStarten(gekozenTopic.id, orbIndex)}
            />
          ) : (
            <div style={{ position: "absolute", inset: 0, border: "1px dashed #D8CDBF", borderRadius: 18, padding: 18, boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: ST.zilver }}>Aanbevolen volgende stap</span>
              {aanbevolenTopic ? (
                <>
                  <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.01em", lineHeight: 1.25 }}>{aanbevolenTopic.titel}</span>
                  <button type="button" className="knop" style={{ alignSelf: "flex-start" }} onClick={() => kiesTopic(aanbevolenTopic.id)}>
                    Start hier
                  </button>
                </>
              ) : (
                <span style={{ fontSize: 12, lineHeight: 1.55, color: UI.tekstSecundair }}>
                  {totaal === 0
                    ? "Nog geen onderwerpen in deze lesboom."
                    : "Alle onderwerpen in deze lesboom zijn afgerond."}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function TopicZijpaneel({ topic, tier, maxTier, route, voortgang, opSluiten, opLesStarten }) {
  const gedaan = voortgang[topic.id] || 0;
  const totaal = topic.orbs.length;
  const pct = totaal > 0 ? Math.round((gedaan / totaal) * 100) : 0;

  return (
    <div style={{ position: "absolute", inset: 0, background: UI.kaartZacht, border: `1px solid ${UI.randZacht}`, borderRadius: 18, padding: 16, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: ST.zilver }}>
            Stap {tier} van {maxTier}
          </span>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.01em", lineHeight: 1.25 }}>{topic.titel}</span>
        </div>
        <button type="button" className="lb-sluit" aria-label="Paneel sluiten" onClick={opSluiten}>✕</button>
      </div>

      {totaal > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 700, color: UI.tekstSecundair }}>
            <span>{gedaan} van {totaal} {totaal === 1 ? "les" : "lessen"} af</span>
            <span style={{ color: "#1D1D1D" }}>{pct}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "#F1E7D8", overflow: "hidden" }}>
            <div style={{ display: "block", height: "100%", width: `${pct}%`, borderRadius: 999, background: "#F6A923" }} />
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, lineHeight: 1.55, color: UI.tekstSecundair }}>{route}</div>

      <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column", gap: 9, paddingRight: 2 }}>
        {totaal === 0 ? (
          <div style={{ fontSize: 12.5, color: UI.tekstSecundair }}>Nog geen lessen in dit onderwerp.</div>
        ) : (
          topic.orbs.map((orb, i) => {
            const status = i < gedaan ? "af" : i === gedaan ? "bezig" : "nieuw";
            const orbBlokken = Array.isArray(orb.blokken) ? orb.blokken : [];
            const orbVragen = Array.isArray(orb.vragen) ? orb.vragen : [];
            return (
              <div
                key={orb.id}
                className="lb-lesrij"
                tabIndex={0}
                role="button"
                onClick={() => opLesStarten(i)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); opLesStarten(i); } }}
                style={{ border: `1px solid ${UI.randZacht}`, borderRadius: 15, padding: "11px 12px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 6, background: "#FFFFFF" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 9 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}>{orb.titel}</span>
                  <span style={LESRIJ_PIL_STIJL[status]}>{orb.concept ? "lesopzet" : LESRIJ_PIL_LABEL[status]}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: UI.tekstSecundair }}>
                  {orbBlokken.length} {orbBlokken.length === 1 ? "blok" : "blokken"} · {orbVragen.length} {orbVragen.length === 1 ? "vraag" : "vragen"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================================================
// OVERZICHT — de lesboomkaarten (herontwerp §8)
//
// Elke lesboom (domein) is een kaartje met zijn eigen raat in het klein. Klik
// legt de volledige raat van die lesboom over het rooster. Sorteren is een
// zuivere weergavekeuze (niet opgeslagen); "waar je mee bezig bent" is de
// volgorde die de aanroeper al meegeeft via bepaalGeordendeDomeinen.
//
// Welke lesboom open staat (`actiefDomein`) leeft in LeerplatformApp, niet
// hier: de chromerij erboven moet ‹ Lesbomen en de actieve pillnaam kunnen
// tonen zodra dat scherm boven élk leerscherm komt te staan (opdracht 4).
// ============================================================================
// Het sorteermenu uit de ontwerpschermen: een pil die een lijstje opent. Zowel
// het lesbomenoverzicht als de lesvoorbereiding gebruikt hem, zodat sorteren
// zich aan beide kanten hetzelfde gedraagt.
function SorteerMenu({ opties, waarde, opKies }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function bijToets(e) { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } }
    window.addEventListener("keydown", bijToets, true);
    return () => window.removeEventListener("keydown", bijToets, true);
  }, [open]);

  const huidig = opties.find((o) => o.id === waarde) || opties[0];
  return (
    <div style={{ position: "relative", flex: "none" }}>
      <button type="button" className="lb-chrome" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={UI.tekstSecundair} strokeWidth="2.75" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h13M4 12h9M4 17h5" />
        </svg>
        <span className="lb-chrome-bijschrift" style={{ color: UI.tekstSecundair, fontWeight: 600 }}>Sorteer op</span>
        <span>{huidig.label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ST.zilver} strokeWidth="3" strokeLinecap="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div role="menu" style={{ position: "absolute", top: 40, right: 0, zIndex: 60, minWidth: 216, padding: 6, background: "#FFFFFF", border: `1px solid ${UI.randZacht}`, borderRadius: 16, boxShadow: "0 8px 24px rgba(29,29,29,.12)" }}>
          {opties.map((o) => (
            <button key={o.id} type="button" role="menuitemradio" aria-checked={waarde === o.id} className="lb-sortopt"
              style={waarde === o.id ? { fontWeight: 700 } : undefined}
              onClick={() => { opKies(o.id); setOpen(false); }}>
              <span>{o.label}</span>
              <span style={{ color: ST.oranje, fontWeight: 700, visibility: waarde === o.id ? "visible" : "hidden" }}>✓</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Overzicht({ domeinen, topics, voortgang, kennis, vastgezet, eigenVolgorde, opVolgorde, opVastWisselen, actiefDomein, opDomeinOpen, opDomeinSluiten, opOrbStarten }) {
  const [sortering, setSortering] = useState("gebruik");
  const [sleepId, setSleepId] = useState(null);

  const lesbomen = domeinen.map((d) => verrijkLesboom(d, topics, voortgang));
  const getoond = sorteerLesbomen(lesbomen, sortering, vastgezet);
  const actief = actiefDomein ? lesbomen.find((l) => l.domein.id === actiefDomein) : null;

  // Slepen schrijft je eigen volgorde. Dat kan alleen in de eigen volgorde:
  // bij sorteren op naam of voortgang zou je een volgorde vastleggen die je
  // niet ziet.
  const magSlepen = sortering === "gebruik";

  function schrijfVolgorde(nieuweLijst) {
    opVolgorde(nieuweLijst.map((lb) => lb.domein.id));
  }

  // Tijdens het slepen: de gesleepte kaart neemt de plaats van de kaart waar
  // hij overheen komt, zodat de rij live meebeweegt.
  function verplaatsNaar(doelId) {
    if (!magSlepen || !sleepId || sleepId === doelId) return;
    const van = getoond.findIndex((lb) => lb.domein.id === sleepId);
    const naar = getoond.findIndex((lb) => lb.domein.id === doelId);
    if (van < 0 || naar < 0) return;
    const lijst = [...getoond];
    lijst.splice(naar, 0, lijst.splice(van, 1)[0]);
    schrijfVolgorde(lijst);
  }

  // Zelfde verplaatsing met het toetsenbord: Ctrl + pijl links/rechts.
  function verschuif(index, richting) {
    if (!magSlepen) return;
    const naar = index + richting;
    if (naar < 0 || naar >= getoond.length) return;
    const lijst = [...getoond];
    lijst.splice(naar, 0, lijst.splice(index, 1)[0]);
    schrijfVolgorde(lijst);
  }

  return (
    <>
      <div
        style={{
          position: "absolute", inset: 0,
          background: UI.kaart, border: `1px solid ${UI.randZacht}`, borderRadius: 22,
          boxShadow: "0 1px 3px rgba(29,29,29,.06)",
          padding: "20px 22px 22px", boxSizing: "border-box",
          display: "flex", flexDirection: "column", gap: 14, overflow: "hidden",
        }}
      >
        <div style={{ flex: "none", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "nowrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 23, fontWeight: 700, lineHeight: 1.15, color: ST.donker }}>Jouw lesbomen</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "none" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ST.zilver, whiteSpace: "nowrap" }}>
              {lesbomen.length} {lesbomen.length === 1 ? "lesboom" : "lesbomen"}
            </div>
            <SorteerMenu
              opties={LESBOOM_SORTERINGEN.map((o) => (o.id === "gebruik" && eigenVolgorde ? { ...o, label: "Mijn volgorde" } : o))}
              waarde={sortering}
              opKies={setSortering}
            />
          </div>
        </div>

        <div style={{ flex: "1 1 0%", minHeight: 0, overflow: "hidden auto", margin: "0 -4px", padding: "0 4px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(238px, 1fr))", gap: 12 }}>
            {getoond.map((lb, i) => {
              const vast = vastgezet.includes(lb.domein.id);
              const leeg = lb.totaal === 0;
              return (
                <div
                  key={lb.domein.id}
                  className="lb-kaartje"
                  data-leeg={leeg ? "ja" : "nee"}
                  data-sleept={sleepId === lb.domein.id ? "ja" : "nee"}
                  draggable={magSlepen}
                  onDragStart={(e) => { setSleepId(lb.domein.id); e.dataTransfer.effectAllowed = "move"; }}
                  onDragEnd={() => setSleepId(null)}
                  onDragOver={(e) => { if (magSlepen && sleepId) e.preventDefault(); }}
                  onDragEnter={() => verplaatsNaar(lb.domein.id)}
                >
                  <button
                    type="button"
                    className="lb-kaart-hoofd"
                    aria-label={`${lb.domein.naam}, ${leeg ? "nog geen onderwerpen" : `${lb.klaar} van ${lb.totaal} onderwerpen afgerond`}${vast ? ", vastgezet" : ""}`}
                    onClick={() => opDomeinOpen(lb.domein.id)}
                    onKeyDown={(e) => {
                      if (!e.ctrlKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
                      e.preventDefault();
                      verschuif(i, e.key === "ArrowLeft" ? -1 : 1);
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "nowrap", paddingRight: 26 }}>
                      <span style={{ width: 11, height: 11, borderRadius: 999, flex: "none", background: lb.domein.kleur, opacity: leeg ? 0.6 : 1 }} />
                      <span style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.2, flex: "1 1 0%", minWidth: 0, overflowWrap: "anywhere" }}>{lb.domein.naam}</span>
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.5, color: UI.tekstSecundair }}>{lb.domein.omschrijving}</div>
                    {leeg ? (
                      <div style={{ height: 62, display: "flex", alignItems: "center", fontSize: 12, color: ST.zilver }}>
                        Nog geen onderwerpen
                      </div>
                    ) : (
                      <MiniRaat raat={lb.raat} />
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontSize: 11.5, fontWeight: 700, color: UI.tekstSecundair, flexWrap: "nowrap" }}>
                      <span style={{ whiteSpace: "nowrap" }}>{lb.klaar} van {lb.totaal} onderwerpen</span>
                      <span style={{ whiteSpace: "nowrap", color: leeg ? ST.zilver : "#1D1D1D" }}>{lb.pct}%</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="lb-kaart-pin"
                    data-vast={vast ? "ja" : "nee"}
                    aria-pressed={vast}
                    aria-label={vast ? `${lb.domein.naam} losmaken` : `${lb.domein.naam} vastzetten`}
                    title={vast ? "Losmaken" : "Vastzetten"}
                    onClick={() => opVastWisselen(lb.domein.id)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={vast ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                      <path d="M9.5 3h5l-.8 5.2 3.3 3.3v1.8h-5.5v6.2L12 21l-.5-1.5v-6.2H6v-1.8l3.3-3.3z" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="lb-paneel" data-open={actief ? "ja" : "nee"} aria-hidden={!actief}>
        {actief && (
          <LesboomDetail
            key={actief.domein.id}
            domein={actief.domein}
            domeinTopics={actief.domeinTopics}
            raat={actief.raat}
            klaar={actief.klaar}
            totaal={actief.totaal}
            pct={actief.pct}
            voortgang={voortgang}
            kennis={kennis}
            opSluiten={opDomeinSluiten}
            opOrbStarten={opOrbStarten}
          />
        )}
      </div>
    </>
  );
}

// Gedeelde vormgeving voor de "kaart" van elk leerscherm (Onderwerp, Les,
// Herhalen): witte kaart die het beschikbare vlak vult, zelf overflow:hidden
// zodat alleen de eigen werkgebied/paneel-kolommen intern scrollen.
const KAART_STIJL = {
  position: "absolute", inset: 0, background: "#FFFFFF", border: `1px solid ${UI.randZacht}`, borderRadius: 22,
  boxShadow: "0 1px 3px rgba(29,29,29,.06)", padding: "20px 22px 22px", boxSizing: "border-box",
  display: "flex", flexDirection: "column", gap: 14, overflow: "hidden",
};

// Statusmerk + statuspil, gedeeld door de lessenlijst (Onderwerp) en de
// blokkenlijst (Les) — dezelfde vier tekens als spec §9: groen vinkje,
// oranje ring, witte ring, streepje.
function OrbMerk({ status }) {
  if (status === "af") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 999, flex: "none", background: "#E8F4EC", border: "1px solid #9CCBAD", color: "#2E7D4F", fontSize: 12, fontWeight: 700 }}>✓</span>
    );
  }
  if (status === "bezig") {
    return <span style={{ width: 22, height: 22, borderRadius: 999, flex: "none", background: "#FDEED3", border: "2px solid #F6A923", boxSizing: "border-box" }} />;
  }
  if (status === "leeg") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 999, flex: "none", background: "#FBF8F2", border: `1px solid ${UI.randZacht}`, color: ST.zilver, fontSize: 12, fontWeight: 700 }}>–</span>
    );
  }
  return <span style={{ width: 22, height: 22, borderRadius: 999, flex: "none", background: "#FFFFFF", border: `1px solid ${UI.randZacht}`, boxSizing: "border-box" }} />;
}

function ORB_RIJ_STIJL(status) {
  const basis = { display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 14, textAlign: "left", width: "100%", boxSizing: "border-box" };
  if (status === "af") return { ...basis, background: "#E8F4EC", border: "1px solid #9CCBAD" };
  if (status === "bezig") return { ...basis, background: "#FFFFFF", border: "2px solid #F6A923" };
  if (status === "leeg") return { ...basis, background: "#FBF8F2", border: `1px solid ${UI.randZacht}`, color: UI.tekstSecundair, cursor: "default" };
  return { ...basis, background: "#FFFFFF", border: `1px solid ${UI.randZacht}` };
}
const ORB_PIL_LABEL = { af: "af", bezig: "bezig", later: "nieuw", leeg: "leeg" };

function orbStatus(orb, i, gedaan) {
  const leeg = (!orb.blokken || orb.blokken.length === 0) && (!orb.vragen || orb.vragen.length === 0);
  if (leeg) return "leeg";
  if (i < gedaan) return "af";
  if (i === gedaan) return "bezig";
  return "later";
}

function onderwerpSubregel(gedaan, totaal) {
  if (totaal === 0) return "Nog geen lessen.";
  if (gedaan === 0) return "Je bent nog niet begonnen.";
  if (gedaan >= totaal) return "Je rondde ze allemaal af.";
  return `Je rondde de eerste ${gedaan} af.`;
}

function orbRegel(orb, status, kennis) {
  if (status === "leeg") return "Onvolledig — nog geen inhoud.";
  const orbBlokken = Array.isArray(orb.blokken) ? orb.blokken : [];
  const orbVragen = Array.isArray(orb.vragen) ? orb.vragen : [];
  const meta = `${orbBlokken.length} ${orbBlokken.length === 1 ? "blok" : "blokken"} · ${orbVragen.length} ${orbVragen.length === 1 ? "vraag" : "vragen"}`;
  if (status === "af") {
    const sterkte = geheugensterkte(orb, kennis);
    const woord = sterkte >= 4 ? "zit erin" : sterkte >= 2 ? "wordt sterker" : "zakt weg";
    return `Afgerond · ${woord}`;
  }
  return status === "bezig" ? `Nu aan de beurt · ${meta}` : `Nog niet gestart · ${meta}`;
}

function plaatsTekst(vorige, volgende) {
  const v = vorige[0], n = volgende[0];
  if (!v && !n) return "Startpunt van dit leerpad.";
  if (v && n) return `Na ${v.titel}. Hierna opent ${n.titel}.`;
  if (v) return `Na ${v.titel}.`;
  return `Hierna opent ${n.titel}.`;
}

// ============================================================================
// ONDERWERP — herontwerp §9, checklist §5
// ============================================================================
function TopicDetail({ topic, domein, alleTopics, voortgang, kennis, nu, opTerug, opOrbStarten, opHerhalen }) {
  const gedaan = voortgang[topic.id] || 0;
  const totaalOrbs = topic.orbs.length;
  const pct = totaalOrbs > 0 ? Math.round((gedaan / totaalOrbs) * 100) : 0;

  const domeinTopics = alleTopics.filter((t) => t.domeinId === domein.id);
  const maxTier = domeinTopics.length ? Math.max(...domeinTopics.map(topicTier)) : 1;
  const raat = bouwRaat(domeinTopics, alleTopics, voortgang, domein.kleur);
  const vorige = voorgangers(topic, domeinTopics);
  const volgende = domeinTopics.filter((t) => (t.prerequisites || []).includes(topic.id));
  const dueHier = vragenDieAanDeBeurtZijn([topic], kennis, nu);

  return (
    <div style={KAART_STIJL}>
      <div style={{ flex: "none", display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "nowrap" }}>
        <span style={{ width: 13, height: 13, borderRadius: 999, flex: "none", marginTop: 8, background: domein.kleur }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ST.zilver }}>
            {domein.naam} · stap {topicTier(topic)} van {maxTier}
          </div>
          <div style={{ fontSize: 23, fontWeight: 700, lineHeight: 1.15, marginTop: 2 }}>{topic.titel}</div>
          <div style={{ fontSize: 13, color: UI.tekstSecundair, marginTop: 3 }}>
            {totaalOrbs} {totaalOrbs === 1 ? "les" : "lessen"}. {onderwerpSubregel(gedaan, totaalOrbs)}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, flex: "none" }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: UI.tekstSecundair, whiteSpace: "nowrap" }}>{pct}% afgerond</span>
          <button type="button" className="lb-sluit" aria-label="Terug naar de lesboom" onClick={opTerug}>✕</button>
        </div>
      </div>

      <div style={{ flex: "1 1 0%", minHeight: 0, display: "flex", gap: 16, alignItems: "stretch", flexWrap: "nowrap", overflow: "hidden" }}>
        <div style={{ flex: "1 1 0%", minWidth: 0, background: UI.kaartZacht, border: `1px solid ${UI.randZacht}`, borderRadius: 18, display: "flex", flexDirection: "column", overflow: "hidden", padding: 14, boxSizing: "border-box" }}>
          <div style={{ flex: "none", marginBottom: 10, fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ST.zilver }}>
            Lessen in dit onderwerp
          </div>
          <div style={{ flex: "1 1 0%", minHeight: 0, overflow: "hidden auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {topic.orbs.map((orb, i) => {
              const status = orbStatus(orb, i, gedaan);
              return (
                <button
                  key={orb.id}
                  type="button"
                  className="lb-lesrij"
                  style={ORB_RIJ_STIJL(status)}
                  disabled={status === "leeg"}
                  onClick={() => status !== "leeg" && opOrbStarten(topic.id, i)}
                >
                  <OrbMerk status={status} />
                  <span style={{ minWidth: 0, flex: "1 1 0%" }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{orb.titel}</span>
                    <span style={{ display: "block", fontSize: 12, color: UI.tekstSecundair, marginTop: 2 }}>{orbRegel(orb, status, kennis)}</span>
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, border: `1px solid ${UI.randZacht}`, background: "#FFFCF7", flex: "none" }}>
                    {ORB_PIL_LABEL[status]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ flex: "0 0 288px", maxWidth: 288, display: "flex", flexDirection: "column", overflow: "hidden", padding: 16, boxSizing: "border-box", background: UI.kaartZacht, border: `1px solid ${UI.randZacht}`, borderRadius: 18 }}>
          <div style={{ flex: "none", fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ST.zilver }}>
            Waar dit staat
          </div>
          <div style={{ fontSize: 13, color: UI.tekstSecundair, marginTop: 8, flex: "none" }}>
            {plaatsTekst(vorige, volgende)}
          </div>
          {domeinTopics.length > 0 && (
            <svg viewBox={raat.viewBox} role="img" aria-label="Positie in de lesboom" style={{ display: "block", width: "100%", height: "auto", marginTop: 14, flex: "none" }}>
              {raat.tegels.map((t) => (
                <path
                  key={t.topic.id}
                  d={RAAT_HEX_PAD}
                  transform={`translate(${t.x},${t.y})`}
                  fill={t.topic.id === topic.id ? domein.kleur : "#D8CDBF"}
                  fillOpacity={t.topic.id === topic.id ? 1 : 0.3}
                  stroke="#FFFFFF"
                  strokeWidth="2.4"
                />
              ))}
            </svg>
          )}
          <div style={{ marginTop: "auto", flex: "none", paddingTop: 14 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ST.zilver }}>
              Herhalen
            </div>
            <div style={{ fontSize: 13, color: UI.tekstSecundair, marginTop: 6 }}>
              {dueHier.length === 0
                ? "Niets uit dit onderwerp is nu aan de beurt."
                : `${dueHier.length} ${dueHier.length === 1 ? "vraag" : "vragen"} uit dit onderwerp ${dueHier.length === 1 ? "is" : "zijn"} aan de beurt.`}
            </div>
            {dueHier.length > 0 && (
              <button type="button" className="knop2" style={{ marginTop: 10, width: "100%" }} onClick={opHerhalen}>
                {dueHier.length === 1 ? "Herhaal deze vraag" : `Herhaal deze ${dueHier.length}`}
              </button>
            )}
          </div>
        </div>
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
        Wijzigingen worden direct lokaal opgeslagen. Lessen met het kenmerk
        lesopzet blijven concept; alleen de tekst aanpassen publiceert ze niet.
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
                  {orbBlokken.length} {orbBlokken.length === 1 ? "blok" : "blokken"} · {orbVragen.length} {orbVragen.length === 1 ? "vraag" : "vragen"}
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
// BEHEER — honingraat-vormtaal (herontwerp §10, checklist §8)
//
// "Lesboom" op de beheerkant = domein: dat is de eenheid die het datamodel al
// kent en waar de leerkant ook rond bouwt. De raat toont contentvolledigheid
// (heeft dit onderwerp al lessen), geen leerling-voortgang — vandaar de
// synthetische "voortgang" hieronder in plaats van een echte gebruiker s'n.
// ============================================================================
function beheerLesboomInfo(domein, alleTopics) {
  const domeinTopics = alleTopics.filter((t) => t.domeinId === domein.id);
  const inhoudVoortgang = {};
  domeinTopics.forEach((t) => {
    if (t.orbs.length > 0 && t.orbs.every(o => !o.concept)) inhoudVoortgang[t.id] = t.orbs.length;
  });
  const raat = bouwRaat(domeinTopics, alleTopics, inhoudVoortgang, domein.kleur);
  const totaal = domeinTopics.length;
  const metInhoud = domeinTopics.filter((t) => t.orbs.length > 0 && t.orbs.every(o => !o.concept)).length;
  const aantalLessen = domeinTopics.reduce((s, t) => s + t.orbs.length, 0);
  const pil = totaal === 0 ? "leeg" : metInhoud === totaal ? "gepubliceerd" : "concept";
  return { domein, domeinTopics, raat, totaal, metInhoud, aantalLessen, pil };
}

// Checklist §8 noemt vijf sorteringen (laatst gewijzigd, naam, domein, niveau,
// status); dit datamodel houdt geen wijzigingsdatum, niveau of los domeinveld
// per lesboom bij (een lesboom ís hier al één domein), dus alleen wat echt
// bestaat: naam, status, aantal onderwerpen.
const BEHEER_SORTERINGEN = [
  { id: "naam", label: "Naam A–Z" },
  { id: "status", label: "Status" },
  { id: "onderwerpen", label: "Aantal onderwerpen" },
];
const BEHEER_STATUSORDE = ["concept", "gepubliceerd", "leeg"];
function sorteerBeheerLesbomen(lijst, hoe) {
  const l = [...lijst];
  if (hoe === "status") {
    return l.sort(
      (a, b) =>
        BEHEER_STATUSORDE.indexOf(a.pil) - BEHEER_STATUSORDE.indexOf(b.pil) ||
        a.domein.naam.localeCompare(b.domein.naam, "nl")
    );
  }
  if (hoe === "onderwerpen") {
    return l.sort((a, b) => b.totaal - a.totaal || a.domein.naam.localeCompare(b.domein.naam, "nl"));
  }
  return l.sort((a, b) => a.domein.naam.localeCompare(b.domein.naam, "nl"));
}

function BEHEER_PIL_STIJL(pil) {
  const basis = { fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, flex: "none", whiteSpace: "nowrap" };
  if (pil === "gepubliceerd") return { ...basis, background: "#E8F4EC", border: "1px solid #9CCBAD", color: "#2E7D4F" };
  return { ...basis, background: "#FFFCF7", border: `1px solid ${UI.randZacht}`, color: UI.tekstSecundair };
}
const BEHEER_PIL_LABEL = { leeg: "leeg", concept: "concept", gepubliceerd: "gepubliceerd" };


// ---------------------------------------------------------------------------
// BRONNENBEHEER
// Per domein lever je de documenten aan die als waarheid gelden. Wat er niet in
// staat, komt niet in de les. Dit is wat het platform dummyproof maakt: de
// KAM-coördinator kan niets toevoegen dat niet in het handboek staat.
// ---------------------------------------------------------------------------
// Vak-stijl (het "zacht vak" onderdeel, #09): witte kaartranden binnen de kaart.
function BRON_VAK_STIJL(extra) {
  return { background: "#FFFCF7", border: `1px solid ${UI.randZacht}`, borderRadius: 18, padding: 16, boxSizing: "border-box", ...extra };
}
const BRON_VELD_STIJL = { height: 34, borderRadius: 999, background: "#FFFFFF", border: `1px solid ${UI.randZacht}`, padding: "0 14px", fontSize: 12.5, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
function BRON_SOORT_PIL_STIJL() {
  return { display: "inline-flex", alignItems: "center", height: 20, padding: "0 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", flex: "none", background: "#FFFCF7", border: `1px solid ${UI.randZacht}`, color: UI.tekstSecundair };
}
const BRON_SOORT_LABEL = { tekst: "Tekst", hoofdstuk: "Hoofdstuk", hergebruik: "Hergebruik" };

// Alle bronnen in dit datamodel zijn tekst — er is geen PDF-parser of
// link-ophaler achter de knoppen. "PDF uploaden" en "Link toevoegen" staan er
// zoals de vormtaal vraagt, maar wijzen eerlijk door naar "Tekst typen" in
// plaats van iets te doen alsof — zelfde aanpak als "Vraag het de AI" in de les.
function BronBeheer({ domeinen, topics, bronnen, opOpslaan, startDomeinId }) {
  const [domeinId, setDomeinId] = useState(
    startDomeinId || (domeinen[0] ? domeinen[0].id : "")
  );
  const [vorm, setVorm] = useState(null); // "tekst" | "hergebruik" | "komt-eraan" | null
  const [komtEraanTekst, setKomtEraanTekst] = useState("");
  const [naam, setNaam] = useState("");
  const [tekst, setTekst] = useState("");
  const [hergebruikDomeinId, setHergebruikDomeinId] = useState("");
  const [hergebruikBronId, setHergebruikBronId] = useState("");

  const huidige = bronnen[domeinId] || [];
  const andereDomeinen = domeinen.filter((d) => d.id !== domeinId && (bronnen[d.id] || []).length > 0);

  function voegToe() {
    if (naam.trim().length < 2 || tekst.trim().length < 100) return;
    const nieuw = {
      ...bronnen,
      [domeinId]: [
        ...huidige,
        { id: `bron-${Date.now()}`, naam: naam.trim(), tekst: tekst.trim(), soort: "tekst" },
      ],
    };
    opOpslaan({ domeinen, topics, bronnen: nieuw });
    setNaam("");
    setTekst("");
    setVorm(null);
  }

  function neemOver() {
    const bronDomein = bronnen[hergebruikDomeinId] || [];
    const bron = bronDomein.find((b) => b.id === hergebruikBronId);
    if (!bron) return;
    opOpslaan({
      domeinen,
      topics,
      bronnen: {
        ...bronnen,
        [domeinId]: [
          ...huidige,
          { id: `bron-${Date.now()}`, naam: bron.naam, tekst: bron.tekst, soort: "hergebruik" },
        ],
      },
    });
    setHergebruikDomeinId("");
    setHergebruikBronId("");
    setVorm(null);
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
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: UI.tekstSecundair, maxWidth: "64ch", textWrap: "pretty" }}>
        Per domein lever je de documenten aan die als waarheid gelden — het KAM-handboek,
        een richtlijn, een Gezondheidsraad-advies. Alles wat de omzetter schrijft wordt
        hiertegen getoetst. <strong style={{ color: "#1D1D1D" }}>Wat niet in de bron staat, wordt gemarkeerd.</strong>
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <select value={domeinId} onChange={(e) => setDomeinId(e.target.value)} style={{ ...BRON_VELD_STIJL, width: "auto", minWidth: 220 }}>
          {domeinen.map((d) => (
            <option key={d.id} value={d.id}>
              {d.naam} ({(bronnen[d.id] || []).length} bron(nen))
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="knop2" onClick={() => setVorm(vorm === "komt-eraan" ? null : "komt-eraan")}>PDF uploaden</button>
        <button type="button" className="knop2" onClick={() => setVorm(vorm === "komt-eraan" ? null : "komt-eraan")}>Link toevoegen</button>
        <button type="button" className="knop2" onClick={() => setVorm(vorm === "tekst" ? null : "tekst")}>Tekst typen</button>
        {andereDomeinen.length > 0 && (
          <button type="button" className="knop2" onClick={() => setVorm(vorm === "hergebruik" ? null : "hergebruik")}>Uit andere lesboom</button>
        )}
      </div>

      {vorm === "komt-eraan" && (
        <div style={BRON_VAK_STIJL()}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: UI.tekstSecundair }}>
            Automatisch overnemen uit een PDF of link komt nog niet — plak de tekst voor nu.
          </p>
          <button type="button" className="knop2" style={{ marginTop: 10 }} onClick={() => setVorm("tekst")}>Tekst typen</button>
        </div>
      )}

      {vorm === "hergebruik" && (
        <div style={{ ...BRON_VAK_STIJL(), display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select
              value={hergebruikDomeinId}
              onChange={(e) => { setHergebruikDomeinId(e.target.value); setHergebruikBronId(""); }}
              style={{ ...BRON_VELD_STIJL, width: "auto", minWidth: 180 }}
            >
              <option value="">Kies een lesboom…</option>
              {andereDomeinen.map((d) => (
                <option key={d.id} value={d.id}>{d.naam}</option>
              ))}
            </select>
            <select
              value={hergebruikBronId}
              onChange={(e) => setHergebruikBronId(e.target.value)}
              disabled={!hergebruikDomeinId}
              style={{ ...BRON_VELD_STIJL, width: "auto", minWidth: 220, opacity: hergebruikDomeinId ? 1 : 0.5 }}
            >
              <option value="">Kies een bron…</option>
              {(bronnen[hergebruikDomeinId] || []).map((b) => (
                <option key={b.id} value={b.id}>{b.naam}</option>
              ))}
            </select>
          </div>
          <button type="button" className="knop2" style={{ alignSelf: "flex-start", opacity: hergebruikBronId ? 1 : 0.4 }} disabled={!hergebruikBronId} onClick={neemOver}>
            Overnemen
          </button>
        </div>
      )}

      {vorm === "tekst" && (
        <div style={BRON_VAK_STIJL()}>
          <input
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            placeholder="Naam, bijv. KAM-handboek hoofdstuk 4 — Gereedschap"
            style={{ ...BRON_VELD_STIJL, marginBottom: 8 }}
          />
          <textarea
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            rows={8}
            placeholder="Plak hier de tekst van het document. Dit wordt de waarheid waaraan getoetst wordt — dus plak de echte tekst, geen samenvatting."
            style={{ width: "100%", boxSizing: "border-box", borderRadius: 14, background: "#FFFFFF", border: `1px solid ${UI.randZacht}`, padding: "11px 14px", fontSize: 13, lineHeight: 1.5, fontFamily: "inherit" }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, color: ST.zilver }}>{tekst.trim().length} tekens</span>
            <button type="button" className="knop" disabled={naam.trim().length < 2 || tekst.trim().length < 100} style={{ opacity: naam.trim().length < 2 || tekst.trim().length < 100 ? 0.4 : 1 }} onClick={voegToe}>
              Bron opslaan
            </button>
          </div>
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
                  soort: "hoofdstuk",
                })),
              ],
            },
          });
        }}
      />

      {huidige.length === 0 ? (
        <div style={{ ...BRON_VAK_STIJL(), display: "flex", flexDirection: "column", gap: 4 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>Nog geen bronnen voor dit domein</p>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: UI.tekstSecundair }}>
            Zonder bronnen kan er niet op waarheid getoetst worden. De redacteur kijkt dan
            alleen naar kwaliteit, niet naar juistheid.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {huidige.map((b) => (
            <div key={b.id} style={ORB_RIJ_STIJL(null)}>
              <span style={BRON_SOORT_PIL_STIJL()}>{BRON_SOORT_LABEL[b.soort] || "Tekst"}</span>
              <div style={{ flex: "1 1 0%", minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.naam}</p>
                <p style={{ margin: "1px 0 0", fontSize: 11.5, color: ST.zilver }}>{b.tekst.length.toLocaleString("nl-NL")} tekens</p>
              </div>
              <button type="button" onClick={() => verwijder(b.id)} style={{ flex: "none", fontSize: 11.5, fontWeight: 600, color: ST.zilver, background: "none", border: 0, cursor: "pointer", fontFamily: "inherit" }}>
                Verwijder
              </button>
            </div>
          ))}
          <p style={{ margin: 0, fontSize: 11.5, color: ST.zilver }}>
            Samen {totaalTekens.toLocaleString("nl-NL")} tekens.
            {totaalTekens > 12000 &&
              " Let op: bij toetsing wordt het eerste deel gebruikt. Splits erg grote handboeken per onderwerp."}
          </p>
        </div>
      )}
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
      <div style={BRON_VAK_STIJL()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>Groot document opsplitsen</p>
            <p style={{ margin: "3px 0 0", fontSize: 12, lineHeight: 1.5, color: UI.tekstSecundair, maxWidth: "60ch" }}>
              Heb je een compleet handboek of curriculum? Plak het in één keer; het
              wordt per hoofdstuk als aparte bron klaargezet, met de opmaak die de
              omzetter nodig heeft.
            </p>
          </div>
          <button type="button" className="knop2" style={{ flex: "none" }} onClick={() => setOpen(true)}>Openen</button>
        </div>
        {toegevoegd > 0 && (
          <p style={{ margin: "10px 0 0", fontSize: 11.5, fontWeight: 700, color: "#2E7D4F" }}>
            {toegevoegd} hoofdstuk{toegevoegd === 1 ? "" : "ken"} toegevoegd als bron
            {toegevoegd === 1 ? "" : "nen"}.
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ ...BRON_VAK_STIJL(), border: "2px solid #F6A923" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>Groot document opsplitsen</p>
          <p style={{ margin: "3px 0 0", fontSize: 12, lineHeight: 1.5, color: UI.tekstSecundair }}>
            Komt terecht in domein <strong style={{ color: "#1D1D1D" }}>{domeinNaam}</strong>.
            Er wordt niets herschreven — alleen de indeling wordt hersteld.
          </p>
        </div>
        <button type="button" className="lb-sluit" style={{ flex: "none" }} aria-label="Opsplitsen sluiten" onClick={() => { setOpen(false); setAnalyse(null); }}>✕</button>
      </div>

      <textarea
        value={docTekst}
        onChange={(e) => {
          setDocTekst(e.target.value);
          setAnalyse(null);
        }}
        rows={8}
        placeholder="Plak hier het volledige document, met alle hoofdstukken achter elkaar. Hoofdstukken worden herkend aan regels als 'Hoofdstuk 1'."
        style={{ width: "100%", boxSizing: "border-box", borderRadius: 14, background: "#FFFFFF", border: `1px solid ${UI.randZacht}`, padding: "11px 14px", fontSize: 13, lineHeight: 1.5, fontFamily: "inherit" }}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11.5, color: ST.zilver }}>
          {docTekst.trim().length.toLocaleString("nl-NL")} tekens
        </span>
        <button type="button" className="knop" disabled={docTekst.trim().length < 200} style={{ opacity: docTekst.trim().length < 200 ? 0.4 : 1 }} onClick={analyseer}>
          Bekijk de indeling
        </button>
      </div>

      {analyse && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${UI.randZacht}`, display: "flex", flexDirection: "column", gap: 10 }}>
          {analyse.delen.length === 1 && analyse.delen[0].naam === "Volledig document" && (
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "#1D1D1D", background: "#FDEED3", border: "1px solid #F6A923", borderRadius: 14, padding: 11 }}>
              Geen hoofdstukken herkend. Het document wordt als één bron toegevoegd.
              Begint elk hoofdstuk met een regel als "Hoofdstuk 1"? Dan wordt er wel
              per hoofdstuk gesplitst.
            </p>
          )}
          {analyse.voorwerkTekens > 0 && (
            <p style={{ margin: 0, fontSize: 12, color: UI.tekstSecundair }}>
              De {analyse.voorwerkTekens.toLocaleString("nl-NL")} tekens vóór het eerste
              hoofdstuk (voorwoord, inhoudsopgave) worden niet meegenomen.
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {analyse.delen.map((d, i) => (
              <div key={i} style={{ background: "#FFFFFF", border: `1px solid ${d.waarschuwing ? "#F6A923" : UI.randZacht}`, borderRadius: 14, padding: 11 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{d.naam}</p>
                  <p style={{ margin: 0, fontSize: 11.5, color: UI.tekstSecundair, flex: "none" }}>
                    {d.tekens.toLocaleString("nl-NL")} tekens · {d.aantalPassages} passages ·
                    grootste {d.grootstePassage.toLocaleString("nl-NL")}
                    {d.waarschuwing ? "" : " ✓"}
                  </p>
                </div>
                {d.koppenAangepast > 0 && (
                  <p style={{ margin: "4px 0 0", fontSize: 11.5, color: ST.zilver }}>
                    {d.koppenAangepast} kopregel{d.koppenAangepast === 1 ? "" : "s"} zonder
                    slotleesteken gezet, zodat de indeling meetelt.
                  </p>
                )}
                {d.waarschuwing && (
                  <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "#1D1D1D" }}>{d.waarschuwing}</p>
                )}
              </div>
            ))}
          </div>

          <button type="button" className="knop" style={{ width: "100%" }} onClick={voegAlleToe}>
            Voeg toe als {analyse.delen.length} bron{analyse.delen.length === 1 ? "" : "nen"}
          </button>
        </div>
      )}
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
const LOGO_PAD = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA88AAAFmCAYAAABTB6jMAAAWfmNhQlgAABZ+anVtYgAAAB5qdW1kYzJwYQARABCAAACqADibcQNjMnBhAAAAFlhqdW1iAAAAR2p1bWRjMm1hABEAEIAAAKoAOJtxA3VybjpjMnBhOmE1MjkwZGU3LTRmZGUtNDM5NC1hOGNmLTBlMDM4ZjYyOWVlNQAAAAOTanVtYgAAAClqdW1kYzJhcwARABCAAACqADibcQNjMnBhLmFzc2VydGlvbnMAAAAAuGp1bWIAAABEanVtZGNib3IAEQAQgAAAqgA4m3ETYzJwYS5pbmdyZWRpZW50LnYzAAAAABhjMnNo5FmciAgwRA2dXTCoeTGoAwAAAGxjYm9yo2lkYzpmb3JtYXRpaW1hZ2UvcG5namluc3RhbmNlSUR4LHhtcDppaWQ6NWQ5OWM2MWEtZmY3Yi00OWE1LWI1ODUtYWNkY2I2NmYzZGJmbHJlbGF0aW9uc2hpcGhwYXJlbnRPZgAAAeJqdW1iAAAAQWp1bWRjYm9yABEAEIAAAKoAOJtxE2MycGEuYWN0aW9ucy52MgAAAAAYYzJzaIxS5d9Be6XizjZgKKOkX08AAAGZY2JvcqJnYWN0aW9uc4KiZmFjdGlvbmtjMnBhLm9wZW5lZGpwYXJhbWV0ZXJzoWtpbmdyZWRpZW50c4GiY3VybHgtc2VsZiNqdW1iZj1jMnBhLmFzc2VydGlvbnMvYzJwYS5pbmdyZWRpZW50LnYzZGhhc2hYINAGW3KOA548R5RfJ9H1HobpyWOx3PH4PdGQ+H+BtZlPpGZhY3Rpb254HWNvbS5hbnRocm9waWMuY2xhdWRlLnByb3ZpZGVkanBhcmFtZXRlcnOheB9jb20uYW50aHJvcGljLm9yaWdpbi1jb25maWRlbmNlZ3Vua25vd25rZGVzY3JpcHRpb254ZkNsYXVkZSBwcm92aWRlZCB0aGlzIGZpbGUgYXQgdGhlIHJlcXVlc3Qgb2YgYSB1c2VyIGFuZCBtYXkgaGF2ZSBjcmVhdGVkIG9yIG1vZGlmaWVkIHRoZSBmaWxlIGNvbnRlbnRzLm1zb2Z0d2FyZUFnZW50oWRuYW1lZkNsYXVkZXJhbGxBY3Rpb25zSW5jbHVkZWT1AAAAyGp1bWIAAABAanVtZGNib3IAEQAQgAAAqgA4m3ETYzJwYS5oYXNoLmRhdGEAAAAAGGMyc2gtZIz+zqTOsMH8Vn3NcFWBAAAAgGNib3KlY2FsZ2ZzaGEyNTZjcGFkTQAAAAAAAAAAAAAAAABkaGFzaFgglEZzkY05n/c7diXok/Ed8Ui2ReCQeZXLxiZBVIefPeRkbmFtZW5qdW1iZiBtYW5pZmVzdGpleGNsdXNpb25zgaJlc3RhcnQYIWZsZW5ndGgZFooAAAI+anVtYgAAACdqdW1kYzJjbAARABCAAACqADibcQNjMnBhLmNsYWltLnYyAAAAAg9jYm9ypWNhbGdmc2hhMjU2aXNpZ25hdHVyZXhNc2VsZiNqdW1iZj0vYzJwYS91cm46YzJwYTphNTI5MGRlNy00ZmRlLTQzOTQtYThjZi0wZTAzOGY2MjllZTUvYzJwYS5zaWduYXR1cmVqaW5zdGFuY2VJRHgseG1wOmlpZDoyNjk3ZTNlYy03MDMxLTQ4OTctYjk4OS1jMmVjMDUzMDFlMTNyY3JlYXRlZF9hc3NlcnRpb25zg6JjdXJseC1zZWxmI2p1bWJmPWMycGEuYXNzZXJ0aW9ucy9jMnBhLmluZ3JlZGllbnQudjNkaGFzaFgg0AZbco4DnjxHlF8n0fUehunJY7Hc8fg90ZD4f4G1mU+iY3VybHgqc2VsZiNqdW1iZj1jMnBhLmFzc2VydGlvbnMvYzJwYS5hY3Rpb25zLnYyZGhhc2hYIJZFPpII0b2x9xy9hbbuoMolzVGwqB9+2xP3oMkiLh70omN1cmx4KXNlbGYjanVtYmY9YzJwYS5hc3NlcnRpb25zL2MycGEuaGFzaC5kYXRhZGhhc2hYIAxG/jcZoKdS80kTej2xM+8MDQ2pvi+Ak6SkuONs/+DFdGNsYWltX2dlbmVyYXRvcl9pbmZvo2RuYW1lb0FudGhyb3BpYyBGaWxlc2d2ZXJzaW9uZTEuMC4wa3NwZWNWZXJzaW9uZTIuNC4wAAAQOGp1bWIAAAAoanVtZGMyY3MAEQAQgAAAqgA4m3EDYzJwYS5zaWduYXR1cmUAAAAQCGNib3LShFkCEqIBJhghWQIKMIICBjCCAY2gAwIBAgIUQOWgCu7COdC+uIP6BkIFPWdVEwAwCgYIKoZIzj0EAwMwSTEXMBUGA1UEChMOQW50aHJvcGljLCBQQkMxLjAsBgNVBAMTJUFudGhyb3BpYyBDb250ZW50IENyZWRlbnRpYWxzIFJvb3QgQ0EwHhcNMjYwODA3MTg0MzU2WhcNMjgwODA2MTk0MzU2WjBEMRcwFQYDVQQKEw5BbnRocm9waWMsIFBCQzEpMCcGA1UEAxMgQW50aHJvcGljIENsYXVkZSBDb250ZW50IFNpZ25pbmcwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAASYegpry1AYBRTVNL1CpTlbROnY3dey+UrsF9C3phYrATN3ZHf93Mo8RQN0KOUuOn19P4oWNFWe5n2/She9N7eTo1gwVjAOBgNVHQ8BAf8EBAMCB4AwFQYDVR0lBA4wDAYKKwYBBAGD6F4CATAMBgNVHRMBAf8EAjAAMB8GA1UdIwQYMBaAFM5R4gSBTmRbI/jjxM+aPpzB11zCMAoGCCqGSM49BAMDA2cAMGQCMDFzHRSeAXrSy1WOzkbhPZ6Km2wGTmZ/2gK18k8BQGXyqz88Rdrz6CTX9flAnYNVxgIwcF9c3fVhqmJKpi+UhasNUMko69cyX6STPfta3Q8EjyzDjzoyrol46FP6VFHhvUcJoWNwYWRZDZ4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2WEBzgBqBNMAiA1192wuJIydgGrr/g/NbX41bNtm4+s8FoXNIwwXwCn5UjpC5eYabn5KtYI1YeYpjl14NA2BwEq4tYxwsnwAAEABJREFUeAHsnQdgFFX+x79v2vbdZNMpCSUBJLSgEFSwgQUbqIflwAJ3nt55cJ54Ra+A3ol/TzwVPIU7DyxgAQtYwAIWsBBEQgstoSQE0jfZvjvt/d9bCYZiO/EsN8P+9k155fc+82aZ7/vNbgRYi0XAImARsAhYBCwCFgGLgEXAImARsAhYBCwCn0vgByCeP7d/1kGLgEXAImARsAhYBCwCFgGLgEXAImARsAh8bQKWeP7aCI9DBVYVFgGLgEXAImARsAhYBCwCFgGLgEXAIvCdJmCJ5+/06fn+OGd5ahGwCFgELAIWAYuARcAiYBGwCFgEfsgELPH8Qz67Vt++CgErr0XAImARsAhYBCwCFgGLgEXAImAR+EwClnj+TDTWAYvA942A5a9FwCJgEbAIWAQsAhYBi4BFwCLwTRGwxPM3Rdaq1yJgEfjqBKwSFgGLgEXAImARsAhYBCwCFoHvKAFLPH9HT4zllkXAIvD9JGB5bRGwCFgELAIWAYuARcAi8MMkYInnH+Z5tXplEbAIWAT+UwJWOYuARcAiYBGwCFgELAIWgWMQsMTzMaBYuywCFgGLgEXg+0zA8t0iYBGwCFgELAIWAYvA8Sdgiefjz9Sq0SJgEbAIWAQsAl+PgFXaImARsAhYBCwCFoHvHAFLPH/nTonlkEXAImARsAhYBL7/BKweWAQsAhYBi4BF4IdGwBLPP7QzavXHImARsAhYBCwCFoHjQcCqwyJgEbAIWAQsAocRsMTzYTisDYuARcAiYBGwCFgELAI/FAJWPywCFgGLgEXgeBKwxPPxpGnV9YMlQClVotHwDeFwcPoPtpNWxywCFgGLgEXAIvBdI2D5YxGwCFgEvkMELPH8HToZlivfLQKUBv2URnKp2lpSVfFBcvnShXMWLXxsWnhfM9WaI7fRIPV/lscRVu6zjln7LQIWAYuARcAiYBH43yFg9dQiYBH44RCwxPMP51xaPTnOBMJhc862zbvq5v5rwfo7756FmbMfxSPzn8Avbr8ZL6xYNmNPc00Lj0i3N8vFdCwWy+fbUtJw89Qyi4BFwCJgEbAIWAQsAt9zApb7FgGLwEEClng+CMJKLALtBNoikRkbt2ylr7y6Yty8x5/B408+j5dfew9r1m3H+k3bsXjZ85i/6PGULXltWXJP7X4aj2sj4nLc7dAcEV6Pzeat56llFgGLgEXAImARsAhYBCwC3zYBq32LwPEhYInn48PRquV7TIBHjxOJ6OhIMLDgwP59tPyjj257btFizP7HI3h47qNY+1E5QsEYBMiATpBIxvHa66/iwYfuxwP/eACvvfkaNm7ZuCoSilSrgpoHthBCUiKarVovi4BFwCJgEbAIWAQsAhYBi8DXI2CV/k4QsMTzd+I0WE58mwTqA83J1khs2YH65vFPzn8CN//8Jjx47z1Y9+FqJGKtkEQVdhKHw4zCRuOACRCDINzYhvfeeAu//dXNmPqrX2HlijcRDAW2JEPRMVooPgLWYhGwCFgELAIWAYuARcAiYBGwCKQI/BDeLPH8QziLVh++FoH6tggee/YF/OJXUzHv0fnYV10NPZkAoToIMUCNJGRDhcvUkGaYyEyISFMBj07h0AyY0SgqK7bg7rv+ilt+cyuefv65JWE9eW80qpZ8nmMs4v2ZPzj2eeWsYxYBi4BFwCJgEbAIWAQsAhYBi8B/nQAs8fzfZ261eBwJNFLqbrevUm00Gh1dWVlJH3zwQfrwQ7Ox+NlF+PD9MtTtq4eW0FlwWYDJrg4qAYZoQmep5LDD7fRAMRXYTBsUKkOiBAIT1HEmoLfv2IE33nwT8594An/7+99Lly1/ef3u3bspPmMhhAQ+45C12yJgEbAIWAQsAhYBi4BFwCJgEfiOEWDy4Dvm0Vd1x8r/P00gC1BtgOJFMpfSRjeL5iqf/ImpxsN+7ZrtPxTlra2tpWVlZcueffZZPPDAA1gw/1FsWPsh1FgUEvtHBDuoYIMpO0CZWKbZeZC794azaADc3Yoh+3JBHBnsuAuGoMAURJiEAAJBS0sz3n9vNR75x8N47LH5WLp0KdatW0fD4fBkSukhH/6nT5rVeYuARcAiYBGwCFgELAIWAYvA95CAJZ6/AyfNcuE/J0AIUX0sgkvUWCk0WzGiTePNYOx2BIXJ7bVy0RqPx4t4tLmpqYmuXLkSM2fOxB133IHq6mokExEISEKgKlQj8YkgVtJgunKB7F6QBp6FzLOvRtaoa+E+6UKk9zkJTiamxZwuMD1pUEUFSUpBBAGyKLJoNIUZj2Plmyvw17/+FXfddRd27tw5q7GxsSUYDC6whDSsxSJgEbAIWAQsAhYBi4BFwCLwvSMgfO88thz+LhL41n1SqFgGNdk3vq92XnL7zqlm7b4ZsVgsnwtm7hwTrGuWseWXv/wlZsyYgdWrV8MwDBBCQE0KGCYTvcwgsKizDOrvBKH/qZDPuQriKZeirdspaMgZjFiPYcg59RT84p7p+Plf/oSTL7oQcpqbRaElEC6cWRRaMQGiqdCZMbGMt99+G1dffTVuv/12fPDBB+M1TZtCmOCHtVgELAIWAYuARcAiYBGwCFgELALfGwKWeP7enCrL0c8iwCLLCpLa6Na15fP2v7QM1U8+hQMLn0V07/7q+so9y156ZnHLff93Dx55+GGsem819tZUIxqLAgJJVemgChxUgazYkZbfGWdccSlKLh2HrGFnQ+pRCt1/AiL2Tmh1ZKIpLQvVmZ2R3qMHRp4xAr/42dW4dfpkDB9XCl++BwYxYFIJmulmYtwNwZQRDUexq6oSb7zxBmbP/gcefmhO4TsrVtFgS2gZrMUiYBGwCFgELAIWAYuARcAiYBH4XhAQvhdeWk7+YAhQSg99FzlCI7kxGiz9rM4FKfWzyPEYNdg8S2vdv0KPtEzk32duz8/rYqawbcVQtfGN27ajaf0GNK9Zi+q33sFbL76MJU89g6cffxzPP/MsPvzgAwQCASZuTRCRDX2mnSkzG1HQrXM3nD5yJMZOuAKXXHs5Thl9Nrr27g+bPQMiccMkMjSRIumQQDt1h+Jxo0tu9vLSk0rKx145FlddewXGXHohSocOQW52HgzZDklkghwSBNaIbuioq9ufing/+8xiPPn4Qry4eMnoD9/9kNbtO8C6wRQ868jXelmFLQIWAYuARcAiYBGwCFgELAIWgW+MgPCN1WxVbBE4NgGVRiK5lFJFgKCYunhITB+Z3Rlumyg21i5JbPxocmLdhyO1vVXzjObIMl6e5yWERJipQEiBiYyYaaBVS6A+HsXW/fvw2L8fxdw5D6f+/nJDQz0MTU89pi0IrGUiQBJFZKT70b2wJ0addw5+ftON+PXUKRh5WunS0hN6oF+uH3ms4ixo8AkJuKQo0t0mehUVgTLBfaAtMbqmTS9JiFk459TLMGXSr3HjdT/DmaefgdyiTnD77JBlwtqk4P8IE9/8Ue5du3bhueeew/+xaPi8+Y/h7VWrsLOqKsmE/RrGxZ9IJAojkcj4WCz2mRML+IEuVrcsAhYBi4BFwCJgEbAIWAQsAt9VAsJ31THLrx8mAS52idtdz1MHHPVu2b3yWD2lodAIaf++mdG330DFzLux7a93oPaZpxHZsaMULtehP/GUik5DVIw099i8YUOwy+3Ec82NeLq+DpurqxCKxZj8JaBMLJuUQlc1ZjpEEORkZuOSMWPx4CMP4Q93/gmnDh+yOt/vzEun5tLSbEfZuL7ZGNMzHYNcMfS0taFnuoo+XWwo9Ep4Y00dZr5cjbuWNWLOWzFsq/Egw9EbY8+7Yu6fZtyJqTNuRr9TT4AtXYYp6pBsgG5SaJoKQ08iocaxq3YPFrzwLP74l2n46913YfPmzaVMQFfa7fYql8u13DCM0bCW7xsBy1+LgEXAImARsAhYBCwCFoEfKAFLPP9AT+x3vVup6HEwMUINfkZ01YiPpC31IHt3w1FTg87NLYhs346mmn3gwru9f3I8XtRS21b3+htvb/njrNlYsHYN1sYj2MYkc9jUkWBpkppMuBpgBQEmoDvl5uLSSy7F/X+/H1MmT0GPXoVQnPa5kiLfAba4oG7tJBu/GewX5l8+MB03nVWAm8/ug/EnFaDQBXywbi02tYSwISbjo6gbZW1ePLU5jI9bNUQUye/LSr9j9Mkn49Y//xm/vOPPGH7ZWBjuDEBysNpFUNMETA0mVZHQYtjfeAAr316JP/7xj7j33nv9q1atoqFQaJbH45nOClgvi8B/mYDVnEXAImARsAhYBCwCFgGLwLEICMfaae2zCHxTBCKRSG7Lli20+s0VdftffWkF2bR5jRqNlhzVniLUwWaHYHdBFJ0QYIMsOyDKMlLCmxUI1DXSj9esW/PMwqfxz3/Nw7K3V2PLgXocMAwEJAFJAiSpAY0JaCJJ8Pl8OP200zHxuomYeO11OOv0M9BvYH/i8/hGyZK80G4n5aqqlZoyWuxSvNonGNN7e2jBkE6efkO7pE3JlyniTU2oCkdRw7R4g+xEi+LGASKirLke5eEm1NLYOMkhL+2SljUsu08JfCUj4Bt8FrJPPAf2zsUgzkwIRIHERLzERL0A5l8yjgYWKS8rK8NLL72Ef/7zn3j22WfH79ixg0aj0dGsq9bLImAR+CoErLwWAYuARcAiYBGwCFgEvgEClnj+BqBaVR6bAKVUcaiRmXXvv43qF59B43MLkHjzJQiRyINHlkgSSTGycyEVD4br5LOAE0+Hf8ip8OXnI5yIVG7buJG+tWIlnl34DJ56bAHeXPYGGhvbEE9QqKYAXWAmCjBY6vJ6UdSrF84999yUcP7JpJ/g7NHnEpfT24+363Y7VjocjtWE+AIqJP4DZFAhe0TR8LD9gQxCKtw6NiQbQ9i3uxEhux9tTDgnbCyrjUIwW6FFdqE5uButiQB02Qzrqjj840Yda0Nu1Pv6wz/sUqQVj0J6/kB4fbmwixLsTEDLTOgLzMCi0QZLq6qq8Pzzz+Nf//oXlixZwv/M1bI9e/ZYIhrWYhH43yJg9dYiYBGwCFgELAIWge8eAeG755Ll0feBQAulxRFKc8PR1lmJcHAyjYdGGKHm24xo0w00GS4+Zh+irePQUD3+wHtvQKjaAPfu9Qi+sRhobh7RHk3m5bjIDurm7fH03Ln2M88d2+32O5fm3HlvTdaPr1spde+Jyuo97of+MRu3/nYqnnz8MdTt3Qev5IBNEyCqAogqgugCZIcdXn8a+g8aiOsmTcScR+YsnXDt1aSgRzcWkwZsHlsFjlg8Ns/iGGRVA8kliq4QQiKhuDbCiJoTIy0G2hoBg2SByi4QyYRDa0LXxq0YXL8RXas3wNFcCz0hjNgTNme+WNGGV3eZ2JLMQ1vGScg56SL0GXYBevYugd/lg0cQ4TAIZINCZH7ILKqu6zqSyST//jPuueceXH/99XjhhRdQU1OzLBwOz2Js/NzY+nRmk1kxsGj+eJ5aZhGwCFgEvkMELFcsAgTGmIkAABAASURBVBYBi4BFwCLwgyMg/OB6ZHXoGycQoDQ/AaPQQNItE6FSDrXNCq0vX1X++LwZGxfOn9OyfcOWYwpoarjBBKLX5waIAUMw4M1KA+HKUTAKcHAhhKiawz0/4bStjHqcqxNp7ruDLu/q97fvGDnjwQfwkxtuwAsvvYS2YBBgMljVEkioEYjUhI3tsFEBaQ4vThkxAn9/4AHMnv0QfnzVj+FN943FFyxMmCoKTNU0tHxT04ZTGskV7FJlfdSYuDcsIaD54Ii6IZoiJDOKvNZqnLlpDSa9+z5Oe+4VpL+xCrXVdfNeOBDDzrCMMMlE1NYZzUIWWh15MDO6oHPRCTj15JMxrH8vZLld4P6KJgEXzqx9cBEtsIh5KBRCS0sLZs2ahRtYn++6667JbLuF8Qnw70Mzm83y+1neqi/olnXYImARsAhYBL4yAauARcAiYBGwCFgEDidgiefDeVhbX4KADrDYLo14YasXVbUgvqMSLW++hfDb76Bt5ZsIr3kP6t5dW46qijiWkrScld1HX4JuP/4JMq+5AY4rrwXxZy6Hw1veMX+apMwiJvG3NLe0rKnYvOZvs+8bf/9Ds7Bk6cvYtnUbGpubETdUJIiGODNNolCZGHd63ThtxGn44+9vx5Rf/hJnnnkm+hcX2/I65RF8iYUJU1WIC4ojnBwjBWKz9IZgeTSYnPf2thqsagij2ZsFj2oy8cwo6HE4o63IbzyA/vX70WV3FZz798OMJRAxKKgRB6FJMJ0N1a6gxSYh6fcir/8JGHnJxfjpr3+FP/31Dvxi8i9xyvDhUBQFTAjDNE1omgbDMFKCuqGhARs3bsSLL76I3//+92wyYDbdsmULbe+O0+ksa1+3UouARcAiYBGwCBwiYK1YBCwCFgGLwHElIBzX2qzK/icIZBNS74BRzYRmRFTNvub+BpCK7fDs3gvnzkqIe3bBbK0/igVxu+tJRqex6SefuTD74ivgu2QCyKgxNUJ2zvmsLrVjATMUWFS5bu2c5c8twuIn5mPhE//CiuWvYs/OnTBVJlyZFNZhMMGsQ7dRSGlODBh+Es7/0Rhcdd0EXHXNeJx75siirrmdWNXksLo7tnOsdaWuoTq8ZsOYA6+vwt63P8zdun776LJdtdgaVxHxuKCAiWJorCj3w4TokCBm2EC6eCDnuJHmtqOP04YcIQIbWgGWUjmBmE1DzC3A0yMPg84ajhEXXVRz6TXXLP3xT36CKydcjbFjx6Jv375gYjglnJnj4MYFNX+Um38f+sknn8S8efOwYMECvPzyy3TTpk0t1o+KsVNhvSwCFgGLgEXgB0nA6pRFwCJgEfguEbDE83fpbHyPfPERexWl1E1Msd5h9yDD60e2Kw05rnT4vOmQnQ5QGvQf2SUmBiOKP2uCrWt3onQrIlJOl0OPa/O8yUhwfMOBvXT7ujUjXvj3XDx0x3Q8/fDDaNq7FzQWg6gbEEFgkyUQIsDlciO3S2ecUNIPP7/ll/jDXdNwyYQfDXNlpvWz2+2px5mZnwozNz5jSdBEYTIZLqaJYCENt42Lb9yAfYsWo+KRf2Hz/AVYv3QZWgJt0Jw2qDYgqSRhskg3lRQkfeloLuqJxrNOQuKysyCdPhjZOWl3nJnmQpHPgM8RhSi0gRgtUOxJKB4CT24asrt3uVV2+8bq3sxJ/foNJFf8+MpJM/56J6664nKUDBqAjEw/RJsMIompSDTzH0Qg0NmEwYZNGzF71iz8+Y9/xDMLF2Lntm3LWIQ+/Bnds3ZbBCwCFgGLgEXAIvDtEbBatghYBH5ABIQfUF++112JUJoboZHcY3WijUZGttDQxCOPtdBkMaWNuTRWP5mGGycnEsHRNVQ/Kl97uQCl+fVUG8nz7Kd0TL1KS5koU9qP87SR0pL9VB/D180DrYuS1Y20qSUQ3k71BXxfRyOEREhu5iScfsbdxuSbEZlyG8xb7gYZcyPEgtMyCPEFOubn6/F4fARPOxpr0839UGOx0pp91Qvum/U33HDrzXh88XPY3xiAaogszmtDUpKhMjHJ1CjSHG644MDwgadj+s13YtFDT+GK08bMLvCn97PTeEQS4imWEca1CeqYgBm4lcbrJtK2mmU01jKOt9fugw22GpvNUwGbt8YUQqPr930AqXE9ilp3YcDeXciv2IW8liQ8xAfNl4Om3BwmYl0wNA9a3T1QedJ5sE29G9mT/rw448RzTnP5fNMLu9hI8bBeyC/KgkMKw5aswwCnih+d2AsjB/aGXXLMVxRXuY+QFCO7qG3o6pfKf/nT8Xjgb3fiF7+6HmksQk3dtpSbhFJAEWBkSKCyDINF32u3bcNzc+fi1kk/xYtPP++u2rWPZUplh9HWdoPOJiJYPz9z0uCTnNa7RcAiYBGwCFgELAIWgc8jYB2zCFgE2glY4rmdxLecugmpdxP30c86M798cJXJQFWQ0sMiuQaUZBvspapoq4HieEu3ecsJRDVAY/k4xuKOtY72NOxf4azYPM9XW7skPdx2gxbTDvtl7GxCytNi4ZLo5s008OgT45pm3IvI7IfczndfGx+PHC3geTNytvd2V0H+pC4nD0POkCFwdO40ivg+EYX8eEdzOByrO27zdVlVR5Zv2JL89/zH1vxx2h147vlXsKOyBuG4Cl0kMEUBoiJBJiLsogyP14ecHt3xi9/cgim/uRnnjj4b3bK7Zrj8rilcBNtsGRX2pFTB63YBEUUNj8auXdNqn3xuXuWsR0dXv7h0UWD7hiQ/zo1NAqjtKZXsy309e0Iu6IJElhtqrhOdB3eHP12DzTgAotZDirVC0iKwqxHk2CkGntAJrvT0hS5P9uXE4T/Uv7EOZ8X/dcvB40ML8c8RvXHH4G64NC8dvWXl/HbRzNvlJstpFboj42qk54zNPmGAetHYq3Dv72bg5st+jkH5A5FBvMhKiujWasBtSDBYoTaqoVYN4ePdO/HIP/+Je6bPwJP/eoq2NLfVhWU6MsEGDct22IuJ6cPG0GEHrQ2LgEXAImARsAhYBCwCP0QCVp8sAseJgHCc6rGq+QYJMHEXkSBVh5G4oWMzTOhWJSD7VcVZRVjklAtwCdjghKZ0zMfXabR5jL5z65zYSy9BfWwh6JKlECq3ThT16HB+vKMp0dDU6LYK6GXvQXzvLcjvvg6sWgYSi8zomK/jupLumO/NzyLurhlETnOs7Hjss9bD4fCsiq1b6SsvvLDksSf+jSeeXojX33oH1dX1SCQpdCaWdUGAaWMmGEh3ejCg1wBceMGl+PFPf4Ixl1+CYcMGV3VNd2XAi0iQJgr5BAMTiApcrlREF2j1y8GWieb2SsSWvQPjzQ/R9tZ7CLH+URbpjyZDY1L5DzppEluN54RB8J91NtIvuQhpl5+PLqOHoO+gzijya8hJ1CI9FkCWFkQfr45hXe0Y2sUDnyDefbCKQ0kRSZ4/zG/2O7eLe9R53dKmlOb6Ck7IsBOfXVp+KNPBFXaOVUVxV1LFudru8Rf1LOw99vzTz8U5oy/BgAsuQ2bpaaBZBUioLhAWiacE0GSKuELRZsawbUcF3l7+OhY98RQe+sc/cl9Z/c64yob6BaFkZOLBJlIJayfA+msJ6BQN680iYBGwCFgELAIWAYvA94OA5eV3g4Dw3XDD8uJYBLgQbN+vwRFRYZa0b7enIg9BJvXh8Uh8JBNF7jxCKnSIES4M2/Ow/YoRb1sS3rwRjYtfhPb0EsSfZ+nOzTARGdeerz01Tc2t6WEW9Y3ClGMwSRBavB6EGl9bdPEftwoGgwuqq6vp2rVrJ7/w/POY+9CDeHLhY/hwXRmC4SgEKkEkCkwIMCQBiteOzl2ycfLQobh0zI8wcdL1uHbSxNsLO2dBajpQmNxT1ZLYtSNpJiMzDCRLQ0nkowl+Shvd0PUCEouCNrZC2HMAzvo20NoGJBubYRixkqQZvS2sJ0rb+y7LYrWU3+s035nnI+PH18Lz46tgKx1UXzS4CKf0zMDwDIJBmTKGZYs4r6cH5xal44Q0+5QMG0lFutvr4WlUiY9MSonz4opaSBU94HeSGr7/88xHSMBPSA0xhUhEsqG1S1fgrHNAzxuD4LDT0VA4AFJ6BmQbmx8RCSCy2iQCFp9Ha0sjPvhgNe6dORP/euwxvPr6ayjftHnWvn37KOfOclovi4BFwCJgEbAIWAQsAhYBi8C3QeAH0aYlnr+jp7GR6qMj0Ma0u+cNAW5Ii9u329MsPaQ4a3fPUWqqV9DallV8P3/8m3R4BDyJZH4sGkO4qRlqUwDZVIQYCoEmgkwQJ4p5mY5G0txTPMMHom5QATb2ycLuYb3gunoMBK/n/I75/tP1hoaG8c8++yz+8Ic/4M4778C6D8oQiYQhMDEoUAqHJkDmfw6KRZ1tLgc6dc7DdZOuxrS7puPnv77p1pNOGjTMThL1ie0b0bLoaTQ+9A+EX3ge7ra6cQp0FSYyICKDkOyIQUy/6GTkMrKh+9IRVhQo2bnw5ORBFKWKdHvuaV7500fJOTdZ9q+O+XtmNOX2nbDLU4At8ObGbT4M7VOEX54/HD89fzBuunAgxg8rWD28i2dwV4XMxjGWkCgXtQrimKigj0mKenEzjY/8rEfqeXFCiMpTbo2h2IoXa2px57ZaLAwY2FzQH4mx4yHd8DN0GXYqMjJzIUEGLyEkKAxdR5zqiDFLqCree2U57vvzHfjrn6fhrbfeQlNT07K2trZlXESzdgK8DcssAhYBi4BFwCJgEbAIWAQsAhaBL0sALLT35fNaOb8BApRS5chqYzSWryCU70QUwWRkfDKcLCY+EsgmtsUd8+rB/Uua33p7TsPfH8DuP/0Ou/51T4nasIUmEsHCjvkiEDJUf16Ve+BJSB9+OmqzcqCVDoPZuy80t+/Wjnn5esTm20Bzet7Ra+IUnDztfvT72Z8hdjsTsiNtJT/+n1gikSisqqqi8+bNW/arX/0KjzzyCCoqKljEFEgBME1QU4eNWWeo6GkTcNrAYtz4i+sxa+4juGr8eHTv2X21LBk1mha8yxZsnlf/2utIvvkuXB+uh/by66B79kBr3b/C0FsehIFq7qck5S4laTnD3MOGomDa79Djz79H95/9FJmlp4AQfw0TkinBys6Dmwapn5cJJ2lxTdKseKMuseCeD+twxxtV+NvyKjzy6h68troOdmogU6Q16cB9LH8ls2O+/CHPvE6tnj9khxx3dA05Z2bAXuYnzqOiz2EaLm7WW+btD1XTph0f05bN62jV9o+xsrIc+wSCuJoNIZgPMV4IM+tEjLrmavzq17fg+tGXoq9pR75OYGce6DKQlJD6dW5HgsJsiWBj2Trcfffd4MyXLl06uqGhYRnLeujF+s0i9NTPRfWhndaKRcAiYBGwCFgELAIWAYuARcAicBQB4ag937Md32d3mXBRooj6Gyk97BeRpURkpC3SPMcea56p6PEiRTSO+WeIjHh4TODdVTDXfgxh62YkKjfiQNVHMNX4zI6UKYdZAAAQAElEQVRcTBbHpU7PTEefYmReegnSf349nJdeCrWwH0KiS2mlaknH/OlM5PlsGdO93frY0joNzsjIHJiX6ejq6Zjny66Hw+HJ27ZtowsXLqy888478fjjj+ODDz5AdXU1mGBjszcCZPYugsAGIItQFMsCJvQfgJ9ffAF+NGY0evfrg7zO+WM96eJYprS32mRzg6RrkONJmKEoVGYkoYFEElDYfptkriXZJMKqA2fcJntboll5Y20nDrzRftqw5cqAvhOUvC6H+sPyuFnou4BJz5R4jgrI3Vwfz31zWxCrdidR3mjDxjYXPmoU8f7uCD7YuA+haDJfFsEmNEiExgL5vK0jze4jVbJfXu30KWXERwJMqKd8OjKfhGQuArUTm1e9hvCj/4Y+7wkYb7yBeM1uqIkknEkb0mNueGMuUFOBnJmJ/ieehDGnjcKlfU9CP3c6fHY7iCKASiYIEeCiImw6RSwYQmVlZYr5/Pnz8dBDD+GZZ56h+/fvp5FIZDzzifsVcDqdZbAWi4BFwCJgEbAIWAQsAhYBi4BF4DMJCJ95xDrwjRNgwkU1YKg2IBV85Q3SUGgEramdl3j/fURWvukntfumIamP5MeONCb6YDJxldQMxE0BMUoQ0TSA6oeJOVZ/NRVsS8XOmXmuYYOHZfzootsdpcNOIzldz2cSFBpoYce6uV98uz2FC1xgHVP48XzHMibMcg8cOEDfeuutWfwRbS6aefrxxx8jFAqliggCE3uUQmL/FFlBpzQPhnTKwDnp6TgvIx0jOmWhKDsdCiH11CT1gDeiKO5qQbIvFhTH6qzigbCXlEAf2A/Ok0shpGVBUlz1oiId+kGuViA3ARQnREUV09LmCnlZ50s+30LWt479UUFIC5BMPc4cB0buqAth854gmqMSIroHYdGHJtGBnTEd725tRG1EZczN4Z90RFRS6We8MZWaqycCoyltdB8ri103VbExgOiK1RBfeRvyy28ibd1GFMTicCQTsBs6nKYGhxmDaIZAJBGZOXkYPGQoxo69BGMuuACXXjIGpacMgzfDD4BAEiQIRARf+Dhpa2vDe++9h6effhqPPfYYF9AoLy9f0NjYSHkexiPVd75umUXAImARsAhYBCwCFgGLgEXAInA0AUs8H83kv7rHR3wBHyH8F5AVJnIUPRheFSsrR8PcJ1B77yxEV38Io7ll3rGckpy+hRnDT0fohP7Y36Ungl2L4e5zCiSHMrtjfl5/NiGpP4VFnL4ykpl2t+x1rPZL0nIWx1wpgBz1KPGh8l5EDq1/5sonB/jj5Vo8PiLUGlxSX1dXt2rVKkybNg0zZ87E2rVrIUkSmEhLmSiK+EQ8Ax5HGgq6FODkASfgshNPwLi8LGRU70RkQxmie3fBISmzbKbQwsqqzJiAZn1I735aznkXBHzXToD006vhnng1zKK+95m2rAnEkA/1RwdUEQABPlMcsjpV4nbXE58vwH+krdnEbY2hIELhEGyyHQKTl4ZgIGk30WanqIoC+zUTQdOcEqGRXNi8h9pDhyWSjIyPBPbSeNvWumTDpmVmpK0imWwdw87z4SLasNUhIoLuC8NjSlBiMWSzCPqw7CzkKKxCKQpNboZsa0CeJ4T8rDT4M/3I6lM4bPC1P8JP77wNM2fPmv3rW6bixKHDkJ2TDdPhRIIx1tkEBWet6zoMw0BTUxPefvtt/P73v8fcuXOxevVq1NbWMpc+eWSdtWa9LAIWAYuARcAiYBGwCFgELAIWgWMQEI6xz9r1XyTAVAuXR+ACLplM5uv76mFuroJzazV6tsRA3vsQ6o6diMVi+a20dXJH1yRfpwl+Jp77/mk6Rvz9YQz9+e8gZPS6j8qIUHrsR4k7lufrTFRXZRLlsEd2GynNraGJqW00PjKGWHHQiIzZb0Rn8fyfZzaPrSLaFl71xquvjpn+xz/jlltuwbZt21LfwWX95H1IrX8imin4vnRfOi495wrMvvcBTPvNrzG0RwGcLfVwBRogMqORNjBZGbHZbPVHth3x556vDj15vnr2uRWNxcX3BVy+Orvdtdpm81S057UBqgw9oOh6anKCtiSL248dlrINNoORHwDGJJnapoIO0YhAiLVCFpNM6IdBhVaoQgQtuggVAigRVLCwPBDl4V5Ww6cv1jfFuXnrgsQj81D9i1uxY/JvkHhheb68u34JonB/mhMgdl+Vmd8F5JJRqCjOQnXfDPhO64dRY89Bab+eSHNrcLHA+CCPit/16YrhXbORluYsID5nGbJtY5HtWio4pKVnn3zq/Dn33oe58+cjv6QYhscOpv7BhTPzB4qigAtpTdNS+1asWIGpU6diypQp2Lp1a0sgEFgDa7EIWAQsAhYBi4BFwCJgEbAIWASOSeB/WjwnaUvxsagwoeEO0iD/ISXlWMe/zL4gTRSyerhgc9OGljn0tZconTOT0gUPU3Pje5QmgqnjXDS312e326tMrwut/kzs8uZguzMH9TYb4nIcDjlRkE7SD4so83JSXgFR+hZ5nAN7krQeOSRfVm5NQFJUyIe+08vztVuQUn+E0tz2be7jYb5S6maCuj5DE97ywV5GQFokMVpoIw3jKGPSsVz7Ok+b6hrpS88voX/4858w+6FHsOrdD9FcH4ShAqqqgUduJbcIZ7oDPJTbLb8HfjzuGvz93gdxza0/QUnpkPoufUvhOvMSbL/oMuy/8jpI51+FzBNOgU9Mn804RXg7Hc2nKGV5DsekfKdzcCfFfmuObL+P5WMtfpKL9bWQRZ7zAKlOl6Ryfoxk2A4J609yffrO/0RUN2BhF4JbC512dLXLsOlhJpOjIExMU0lgEV0bzGw7XCqBMwS3xCweFxQ24ZASxPxHx2g8MCJKd6/SKj+AXv4hzJ17IDVr2FWxFy2hMOA6Ogru8flvLDrlbBTddCs6/fZP8F56OTJyc2df3TsT007LxR3nFeAXp/XA2fk56CY6hnFfwRZiy11quOyL45I2iLqxPC8/4/LSkwbU3HH7H3H77Xdi1EVXQPZ3huBi+l50wEZFsIGNTFY2FGhBbXM9Vq//GL+5/S+YcdfM0rfeeJe2NQctEc34WC+LgEXAImARsAhYBCwCFgGLQEcCQseN/7V1A0bfY/U5iWSuACEvhFBKELXn4UKzfb1jyvYfysfWFao2l2qgBQGgKBSJT9QaGm4Iv/kaIq+8iJbXlqL+/XeRDLVWarFYccd6+LqYlVHhGDgAnlGjIZ9xNpynnAy5axZgJg8JXp6voxFCIh23AXtVAmbd4fs+2UoCauyT1dQ7K8vEZuq7vkpCD5fEtXgx64PbpShcbEacxFmjwAw4oEWQIJ/6G4/nxkORiXt27KIrl79Bn3ziccx/bB5eWPIi1n68Dg1NTSwySyASAsk0YDcMpLH1Tg4bLjpnFK67egKuvmYCLrpk7Nx+wwcSX1ZmnsPVLcM18GTYx/0YTmaek0fCk9+H4AsWQgjrw9GZDNZXZtVsMqCK2RGMjs7P+q3wupwClhbmpKOocybsggmiaxBMAtmUkZ5MoiSwCWnvvA7bqnf84r5tlVDUUhPGyFiM5sOIuw1DzE8Q0a07FGgs2hszJYRUkQlvL0y7LfWUwZGtK660uVk9+pCck88oSDvtrCJHv+KMdHv6lBPT5YKLu6UXjemdmXdOj0zSy+siPicpw8GF+ezWRXsZiFBDTOoWTbHG5UsrPXH4iBt7nXkuPMNGQRp+DtB/KIyMLqBsTkUkdiggqX5B1xFsasbqN1bi+cUv4LHHnsDTTz9buuqd92hLQyDJ6z/YVCo5cju18/i9WTVZBCwCFgGLgEXAImARsAhYBL6zBITvrGf/BccE2MqP1Yyd2Ks8xFPBv4/c8XgUnz6ey0SEYrQ135Y4UEX1pj1hPZr6LqvCf6AKFLkZsK/mwg26UZoIhdC0fQca9tWietde7NmyDWYowgSZedgPdfG2bNmZw3JKBlQVX3Ypel96GbqMHAV7freFGhH8/PiXMR9xlh3pe3s5LiKZ1bdv87Q9b0wSCqMyHdSq64f9+rYM10pC7csNleazfrsjLaF5e6r3V69bUzbvlZeW4uF//AP3//0+vLrsVTS3tEAzNeiiBsg6E88GuGjuTAUUMvE50O7Gr667Br+48TqcclppgSfdPgUHF+IjAU+XPNL7rBGk+/BSj69bV3Lw0H+U+AmpYX39TNHMo8XMcoNqrDSuRUbGtVBJjMaYADaKcnLTkV+QBVGUQAwBRJOgJAR0amnFmM0vI+/ZRyA+90+Q9a9B0mvnqWZ8dFJCRlRxqDHiisSQ+5raZwhw0nCQ4hIkO+Ujr2Qg3FkZn9sX4nTW8Me4CfEFeEY/m7zwEVLlJuSwc8aP8ch6AGqBnfiqHFH/SpduWykmxUg0ao6vIcKcjdSG7Rk9QEdeBpx+IWi/YVDzChFzZyEhyUxvC8x3AwqbEHBqMdTW7sWi55/F3x+8H//696N454NVyuaKreGm1tZqsCWYSBSSoyZq2AHr1YGAtWoRsAhYBCwCFgGLgEXAIvBDJSD8UDv2ZfrFRceXycfzcNFoaEoBX+dmtjTMU3dUzAi//jr0d1eDHDiwJJGIjuDHoNkjTGSoKeEmCFVwOhFyuVEnyGimIlTRDpvNC5HSQ4KI1c8f8VZYuYjo9I22F+Tf6igqulVMSxuVlJWqiCj7U3V/Q2+hVLSdBAT+oLWkHoqk8+YIF2dC/u1JnY5JRBOl27dtnTj7/vsx8brrMO2OaVj22jLUNTbCNCkEUQTYi4o6qJSELJjooogo9XlwXm4OzumcjxNycuFzyfeZSnJknR5ewNs4yiJqwVH7jvMOG6BI3PTYeJJsmyoa0TGSpuWZNDlCkCgIO5g0NAiKjc2HSKAqkBYK44w9m3DC3nJ41iyH+sFr0Fvr3KppjmmTzfOaRMyoNsQl1dQ2ta1b3/L0H12DwX+egTPv+CuyTz/1PjnTM+x4dSMOLcMAUVL1JVkwOeLIgKqwl6C+3xrDOw0JbA87EHf2ZpHnsyGfNx7SqLEwevVDyOtFwiHCkAHCzpEEFYRoSBpx7KqpxLMvPIuf33Qj7v77Pfjg47L8Ni0+MmEm5zDB/o2OQ1jLt0/A8sAiYBGwCFgELAIWAYuAReCYBP6nxfOxiDAR62b2iSDpkIGwiBv/ji3fxb/7W7eubPzOZ59F3TMvoPqxZ9H6YTmMxrYV6Z/8qnMFz8dNFJ1zHJ3yyvLHjkGPy36E4suuQP/zLoTgSxtLvN7VPE+7sTZUvk589ipkembDbnsNLl+5JjrLIDg38GPflHlhq7eFIlOVtsA8Wyx4w1HtROFWk9q41195ZcUjD/8DS15eiqZAMxLJJBOWTC8LAggzwzQAAZBlCbnZWZg08XJcfO5IDBswCCUn9EfpySPg9vpYHqpSqhdQ6LlHtcV2EI/tEEO2+Y28vEBEZCZX101Ovvb26Ob5T97WtuylNY6Gutvcagx2moRi01ln2ESAncJkajsi13tEkwAAEABJREFUK6i0d0ONtxDh3P4guf1A5C5oiku5r5YHZ8xcXjPxT0t24PdLt2LG+7Ulr4UkNOV2VUnXLlM0u1JhEMInSQ6bnPhPO5cDuTybKO1PT0QgocUgCKsEGZqgQTRNuFQJrqQDQlyGKLpR0LcEF/3ketz6f3fj5LGj4euWC50JaDanA4GakJiJ1ICpq2hra8XKN97AX++8A7f97rcr1rz/3shYqLnlP/XXKmcR+G8RsNqxCFgELAIWAYuARcAi8E0QEL6JSr8PdSZosLCjn+FksrgtGRsXbt0fjjRWJeOB6hYukjvm4euUUgVxFAX3VyO0YzuUffth7NwDva4JiCdY9I5E4HIFeF5ubjepl7yuyz2lpcg4bzSyRp2DtAEDAeo5pnDmZbgRQlQuIFkaUERnuQ5bu0jih7+SRWjkmAK1vZJYTC2N76gKx5atGBFasBihl5eNSdbvovF4aESQUn/TgRa6/oOP6uY88gjmz/s33nn3bdTV1yGpqizabMKkTFgyCU2ZiZKEzKwsDB8+Ajf+/Be4avw1uPi6STjjqh9j0IUXo/s558KWnsn0tVwhQV7tIMrcdj/+62kIbmc4UWy+txbqK68h8tob2PfSEtCd25AWC6GTS0IXvwMijTLXEjBEA61ONz7oMgSVA0chfOalwJBzEJOzKyrqY3h3Tyve2R9FWauBj5tUrGjU8NqBGD5uTSok0zdbE5UNVKJqFNHjIp7Z2FCZY6mX6mCRejGpwB6HDM1dRHT00aPonGxDuso6asTgEk10ysvCkKFDMHr0efjppJ/h2vFXY8TQoXCzM2JnNSkmhWRQCLoJQ9XQ3NCIzes34NWlL+HfD8/BM088jg0b17OxER/Jslsvi4BF4JshYNVqEbAIWAQsAhYBi8B3kIDwHfTpa7tEaeMxo8ftFfPvtcYgFbVvRyKRXCEemSrsq1kU+uB9NL21Em0frfUnq5lqPPir2O15EYJbJ4ZiczvgTvfC6XXDm5EOm8sBIompbB1FDd9BnM4auXOXIqlf//OV4j6DxS7dPPz7vfzYlzE3IfXZzL5M3o55uNBX1WCpaMRHqmrrYd9jbs8XYcI6pkUeaSgrQ/Sl16E9/RISLy5HePtWNDXvX7V924aWN95ZgUXPPIVHH/0XVr71Fmr3H0gJZsoqMbkx8QxBgNvrQd9+xTj37PMw4aqrce2ESRhSekrRwFGjR/UZfUGg86iRcJeU3CF60y4HHCsdctpKv+ReyKo47i/ed6NuD1W5tTXOO9ZECOS4WzKhJCsqkNy0EdqeXQhsLodRuxfuRAQ9vHYM7Z6NAp+MdJnCLhLo3nTs6n8qImefDzr6AhiDh9a0im7PxoY2VLRFUMOAtNldUCUnajUJHzdEsOHAJ3MpVKZ1GpO2AgTlP+0w79cxy7Ia4w4zQ6KJ0fbavVMLNm1Ar12bUBTchQJSjwJbGH0yJQzo4sOA/CwUdu582sVnnDN44mU/xuVnX4i+6V2Q53LDI4pQ2IllXKAQkU0cSNDjGg5U12Ll8tex4N/z8exTT/O/Fb2iqqqKhsPhybAWi4BFwCJwFAFrh0XAImARsAhYBH54BIQfXpeAONz+JkAJsqhpOBkujscjI2kwVpoyGvQnIWVokPztfXcRkmdvaJsor1qD+n8+garZ/0L1wkUIrV3Lo6u3hlV1dFRVPxGfXkQ0u13tMmQwepx3FoSS3sg8Zzg8/QtB09zlAUrz2+vtmPIfgZLs/uVESS9n4jrS8dg3sU5jsXw93DSdhBvWiG1NC4RkbKqqRj/pw8EGmRBzGzBGMkYlOz98H3T7LmTWtsBRuQ/7V61G2Yfv4N8L5+GvM/+KR5+ci7qGA9D5Y9mEgB40FmqHYrchKzsLAweVYNKkn+D2392GiVdfR7rm5RPeb+J2rxS6dM4QenSzCf60GSQtbTHbV49vaOF91/bXh401ZUi+/wH07dsmGs2RZUc2FzUdapKQ6qRbgea1AR4bbB47mwcwIJsa8j325ecW52PkCQU4gU0M5Ek2ZPgz4BtWgk6jS+Ea0uO+RK5jUqtk5u+JtKGJaIgoAhJEgkhc0A2CQDSBxmgcjLViQEpFnE2YhyLGR/r0WdusvJtP+sQRKol0+FNj7fkNxQgTOaEg0jBHemsF9H88grRXn8cJDZsw1NmEEVkaxhZn48K+eRiQqQzrRMjqdKKUF3fp2W/0yedizJCzMbiwEAU5Wch0u+FWGAuRmeSAJNggEQl2Scb2Tdvw4N8fwB//8Ac8++yz2LZt26ympiaaSCQOe5ID1mIRsAhYBL7vBCz/LQIWAYuARcAicAQB4YjtH8SmkzhrnIgySRQuthmRG2xt9StQV70GkeAjSNr8MuS6JEQmrg/e8KvIF5qjUCpqkF/Thh4NMfgPtEGt3g8tnrjBhKFEZaCe0tJ6JjYDEIYnuxTMdow+B1m3/ALydT8CBvRarae57o4BRd8FiIaul6h7d99Wt/RF7F64AOG1ZePR2Lie+9Z4UHzxx4dF0HqbIiOjSy6Ix4MwizbWtIbw0iuv4e7pd2MRizLu3bcHcTMBnZqg7B9hEVhRkkBEAen+dIwaNQp//NOfMWfuHIy7fBw6de3CIsu8pcON8EfRmR2+9/hsMXGptNfUXN9aXfHWKmXvAw9jy6x/YOfCZ9Cydl0pjz7zfHxShU9yGC6odp+9yjPhR7BfewXkM05G70vHwHXiiRC9voCiqrnpIMi3KehMFGQmAb+qoUcGgdNmQifJoRoS4ylUiFIMRGaaWNAhqDqUuAiRUMhEh83UwfvuI/aqJBwVbuL+0hMH/OsE3GdNaytyREPj7aHWu6J65MYWmixu72+QxkqjMEYbpjFUb21G44qVyK6sRr/6Azg5XI/zHSpuGlSIMV2za05QlEm5hJTxsrzekNtdl9anZ9W5v/gJfnztePzuN7dg0k8momdRb1AmmnVDgG6KzATEWL8Mynqr69i6bRtmz56Nm266CY8++ii2bt1a2S6g21PehmUWAYuARcAi8O0RsFq2CFgELAIWgeNLQDi+1X13ajMT5mhJjQ1v2bh28vZnnsCuJ/6N0BsrSvTd+yqFuFYgQazywlbDPdZFIWB4naDdO0HO80P2e+FkkdS0/O5MENnLIJCAzDLaoKkKxBoJ4gZd9szV/XnDSNeeU8QuXW4U09wTJNGx2glUsqzf+ovW7V8SWbMGzS8vQ+S1t9D0xjsIVWxHIhzlPwYWYQLaLYNmiIaZSyRRzTx9BKp75+MlJgCfaK7D2zv3Yc+eeoTq26DF4jAlysQUYPKeEQKP14vSYcPwm9/9Djf/+tc459xzkN+t++A0j7fI43Qu5tn+m0YIUdvbi0diaK2thftADdz1+yHsr4ZWXwskjGKezwtEdDDFywpwDiS/4Fbfmecgd9x4pJ19AaS8bssNp296Q8wseX/TAaxatweVBwJoiidQF4riw4934sOtu9AQCI6wA+VZQP2QzEzkSQIUJpQFxkpLRCHGW9GZZeiZ7mYtffLKJiTyydqXe/fYbBVmODA59PGG9dsff2LG1gcfHhks/2gaaWve0l6DAaIQCPWgYr2seJDdqy9saRlIc9jQw+PAwJx0FDiUlTlEKc1zkPk4uISQzDeQKNb8rtvTTuq1dPAZp+KUs8/CZRMm4LfTp+OXv/0dep94EhSvD4YgMWAEmiCAMtM0DSzizEUznnnmGdx77734xz/+Ubl582YehZ51sAkrsQhYBCwCFgGLwNchYJW1CFgELALfKQLCd8qb4+iMjZKI2twwo3XTejStWonoe6vR9va7LJp8AEiaQyWmnriQ4k1GbII/nOuGcUpfyJeeAfe4c+A5dwScJ/SGJNvny1QMSCpVbZquOOIIC5DKMoitwkl8ZYo9dzZROs0lxF/Dv5ucDnzyBVcg9agui+59qpzYvq/7ikci4w9UV9PaPXtopK1t3mfWFw5D2Lcf0rZdcO6shlBVA9rUCmoY/vYyRDPd0bbwgqqtu5SXN5Tjqfq9eDrRileTEWwJJ5FISiyKKoJqgM5GCiEC3B4vBg0ejKuvvQaTJk3C5ZdfjrPOPJMUdu9BXIpSrttsX0kctvtyPFOn04mcznnw+hVkZDrgz2aTIekuwNBTjxbz885EbL2PkAATvkg6Muc7CrpneAcN9Chd+xYQX5fLo6I9sIdJ7FWVdfi4PozdiSQaRIoDgowtrXa8syuCPY0apJiiZqjyzLNy8nBq52x0y3DC5gBkL9Ary45TevhRkp+Br7NoDc0zg2vL0fzS60i+ugKxt96FsWcvaDww4pN67dUCSLmkO8tEb/bStDNHwnnphUgfcy5yR5wIf7dcSIq41OXCEefGFmBnVyXEqHFm+cZm98ifn9Mjf1LvE4fazhw9+sZzLrsEJWeciS79B8Kd1wlcQBuKlBLPvF02thGLxVIC+rXXXsOTTz6ZikIvW7Zs9I4dO7iITvHmeS2zCFgELAIWAYvA/yYBq9cWAYvAD4mA8H3rTIRGcuPBpgXBvVW0bU8VjTTX1x2rD4rDvVRtCkBvaIEUjEJiUcPI/gNQgxEISaNISUJpLxdTiD+e6ZxLSwrPd0y4ZKH/polLvZeev5Dk599uc5uLnbJc6da0FjFpRBxaUsn+vOhhU3utLI2HShCNljKRcagttvcLXzwaGqE0N0gThazsIfHNhEp+qHLbggNvv4m615Yh+vHHE7VIZOSRFdJg0C867XBn5yI7rxsycroiK7czPOl+iLL9NSfglmKRGbU1+9ese38dXnnmJUy/627MfXsF3gk2Y48soBkswkhliIYIgYqwMUVYmN8NQ0pLMe6aq/G76dMqrrvuOpLftStBh4VPILRvUho8JNTb9x2ZduzfkceO3NYaGtbEd+6g0W1bafJALaWf8T3bjJ6dbCecMgzy8KHwDC9F5vBhSO9XDBDh0MQGDi7k4LkkxBcgJDtCnP4avi9MxXH74knsDAYRdHoQtTsRdSiIet2IZvTD9qAX+wIyknFlpEd3LD6lk5+M7d0VFxRmY3COhMF9vBg7MA8XDMhBr+7pGQebOywJNwYqG/lESPUeWlN3gO4Px1axc1/CLJef/0iE5jI+SjzQhiSbCLFX70dBcyvopm3QaxuBBEmJUz8hNX7irLHb7VVCZqexZFhJketn107y/2JSmefic+uNgry7dbdtacehyR3xsckDH3GWeWWtkrcjeOQZsNuWsv6rCVFWEq4MZPQfjk4nj0baoOEsIt8VxO+DaRNTPxhHwP7RTywSjmLTpi2YNeshPPjgLCxdshSbN26q3F+9j/K2LLMIWAQsAhYBi4BF4HtKwHLbImAROERAOLT2X1xhN+qHBGHHZhNBWkiZYOi4j6/TRupuienj9hvRWYG2urp9a18dv+a+6Xjr//6Aza8+nZvUG8dxsZFsocWxIC3l3wflAsCXUYCsvP4Q0otQRdygTECJuT7YJL3S50Lqe5+8/s5Emd+JeG+0k+zlosieaJMAABAASURBVKPHBOLqMZZ4CiaQtMy7PxFVJELc7nrF7a6Mem2sKarwcscykk0i+ygdHY8zUZvQzoIWH8R9YYIoJXQ6lglS6ufWvq+RqiXVNDk9Af0GFVD4d2TZMbbK3tmLomlJ2/xZKHjkXvSf+Ve4pv0J4q49K+pjsQXVlI5rVtVSGgqNUMX4TJqfd6s07kdw3DMT5C93Q775V7ANP3mC4lLKucBt3LN78n3/dx9+cvX1ePyhhxBuaAN4eJkKYJFISFIcohiCJMThtUso7t4D99/+F8x6+J8456fXot5NiplLn/vi7Ni5VuI0MCKkt07kaccCjIm7AerIqFq1RTNqb+t47Mh1mgwXty17sXTPn3+P7VN/ifon/olE9Y5KmggexZXzFop6EPrnf0yR/vDAHfjRjUWk1xBCXJlLj6yXb3sBdk6P+HNeanSMofNArQGX6oMv7oWb8VHEJGCKcBs2QBMRgzmC+EkNpdR9tiwV/LWnb9jLJ3eZ8Hhpxn2/6akuLXW33u1FUwFvp6NFmprXl7+1vPClfz6Ixx/4Gx59agEWbNs+YkMstj5mJm8Xw+GJ9pbQomgwNj2ekwGlUyYyHRTp8Vo4e+ZC7JQNpKUd85fKid1XRbzp84XMrsMkf488m63T7U4mrrMJ4R3q6EZqnZ8nzoxteHRdK2nTIiPrVTrrpa0GlgeKsDnrIsRG3ADfVT+DWNoXyHYDIgELQUNh/1ySBzbRxbYlUCLj4/Wb8Nc778YvJt6If9//MAL1DZTVfdiL8VL45EqShosjNDKyjYbHHZbB2rAIWAQsAhYBi4BFwCJwnAhY1VgEjhcB4XhV9FXqYTfqh93ER1iUNaqqJZpdtYVcSXeAxkdQJkba6+SCVBAN1a7FCl01B0CeXoE+7+1CnzV7kfZ+BWIfbVqkRNtG2zJIhdNHygiUMC9LPN7b04cNQe9rrsKJP/8Juv7oYjgKu4Nk+mYf6QPP/0XGyqhcePL0s/I2Mr+ZrFAdDvdK4s+8O25zLW755MedDutzTA2WSlqswBGLFWitrdP1ml3Uu2/X+oxo81lpiK9NB+p5G+1tcR5GEiWNsTia4jG0EgNhlw3U0CAbNOIAquyyXM0Ub0SR5fsEUVwruDw3Orv3XOrr1Qe29MzZCUqLd27fSu/92//R3/7uNixf/gZCkQgiqgqdGqC6AajcKEzTBEQJ/QeX4IZfTsbf7p+Nk049HZlZWQvTFNsUP7FP4f4daczPwyYWuP8O4l/tldLn87SVRkuYWMpV1WiJo2ZPOPnSsiVb/nRP8cZ7Zs+ofWMppa0tU4+qM9g8GU0NW1q3VSK25wDE1gRqNmxDsjnI/DWLj8zfvm33+WY7fOnT7Swi277vWCn3MXrEAZtTnm13OWDY7IhoJlSiQIcNmqYD5gGYzihUr4mgS/CzyZLxTYaREtF8/Pl8ZKFHUssVNftWWex+OyHZ5e3VMz5uWr9/jbhjQ4nnzSUY/OFKnPzxeuSv2YXaN2vx4fvbsbcxPFlVnBuoy3lHzCTDlYycxemnn4a0X0xC8tYbkTf6HPi6dAb3u73e45GykcQmTYRKYkjVOhsH1W2taLbpCHoExDxeiHn9MGTwlbj1V3/FTTdOQaesXEiiiKQaZ8MmwcYLBSSDzcGoiJhRbKvbhceXPoNrfjIRTzz5BN3Douzcz0gkkst9J8QXsBEP/wG1lT64l/JjllkELAIWAYuARcAiYBGwCBxFwNrxHSEgfNt+RJhwVrXA9MiBHeuD69/bEln7QSXCTauCiJZ29E0QE26Zqm5HXIWnLojMVhWZIQ2+sAo5nmBCIlnUnl/Hwe8d++zzbQWd7vYNLUHOmafCfULRQinTfShfe/7jmWYxOefEpz8apjkckTiUvmx/oL0dJqCUhGiMgRmdaNRWrY+vfH1a3WPz0fLsM1A/XD1Cqqte1Z63PY0j7pfhWpgxaCgwcCCiA4uhDx0EpPsgK9JyVj8TIaQeTr0air8SRKwziVIFh2M2UewrK3bsnPzCCy/e9vCcf+Kpp5/Fex+Uob6hiQlCiqTABLMsgLB/gkngtLvRq1cxrphwDSbd+HNcesWVKBl2yvn+nE4FGV7HjV2JMpsbOixBFkVvZZFzJsSLEolEYYRGcjscPrQah9Q3AWOckWh7kOzaDvOVZUhf8RHw+mrEyz5CoqF6Js/MJxx4HSqbZIChlsIwmXQVIVEJZioC7GDeigDrJM//dc0F16Hzw+uSRKEi0+9Bvz5d4HfJsBEKolF2dlU4SSP6dbOja64TgkzK4tBGa6JeGI2Gb0jU7qWtmz+ixq4NCxBN3MrrOszicb8RD5dqtXuBPbuR2dCMnKYYnA0EkWYfNu0KYW9QRVgQ85N2qUJyiHNlt/tGZ8/e8+1nn4f4mEvhKCqC4nLdeFi9x2FDh62FDah6H5ts8ApAfo4IxReH7kpAdwisrxko7noqRp18PiZcOR6/mjwFV1wxDvndukCSCIjAJlzYWBIUgEomImoYu+uq8dbqVZj3xON4eN6jeOqVl2l9LFbXpmmHfd2AdPjBN1iLRcAiYBGwCFgELAIWAYvAD4zAD6M77Bb52+2IikSR0Vh3g/7eB9AXPA/96SXQNm6A1tayIkZj+Ye8E9maROqJzw33oL4wBxRB6N8Ltt49YcvNBhWFOnrwO7bZBx9PJfxPAnmEGUJuVp5U0DlPyHBM4Y+0spq+sRcXAfw7qEwgu9VotMRU1RESU398f4dGFRXw60gOT1RvR2DlctQvWoym55Yi+O570KqrWdbWw8SnA46AXXBPzz9tJNIvugi2MefDfvbpoBn+SV6bLfU9VVYIPJrHU9gQUFVtcl3NgRUfrF078rkXXsQ/H52Hx59cgI1bKhBlEWwKAoMAGhM6YOLH6XSiW353jDjldIy7/Er87Be/ZML5qoUnDSohrI2V/PFk1o9Iqv4Ob7yvBpKlBuLDlXh4qr5vT6W2aXtdcPtGatY1raCNidHt2ZNQFA3IoIY6gra1QNi7C12CSXgbW0GamJiPBhGnzSMNaEOTMEerMPuaAqkHE3RpRb3g698fSu9eyCspgS2Nxedluaq97q+Tkg7ijdJGN4Gudkpz4Mzizji9hwul2QQD0oD+6TJG5Ei4qKcfg/wuMA/mOmBU2Q09YhzYNyf84YcIvszG8GtLYOzbc4Pe9snjyHxioZFNFLU5pIxWIqBWI9jryMQed1fs9XTDPk9XHHDkoDIhsWMUIQGjYy5E/A7bQh8hAUda5iR7wQCP1mPgXLj8t0KQ1n6d/h5Zlp1Ddl4ckXYOflmacnoPL07KpeiTpqKnj+KEdBdKCvLRIy8Ppaec6PnZjT8ru/7Gn2HsJRdj6JAS5HfKhp0QyKxy0TRB2IQHKGUkVax+913Mm/9vzJ3/KF56fRk+/Hjdiqr9dTQWYxMjLL/1sghYBCwCFgGLgEXAImARsAh8pwkw5wRm3+pLBFXjW3ZAWboKnR57A7lPrkTTM68iXsUic8wzflPPEvaSqzTBtjXZvVM9/flViP76x0jefBXo5efCKOw2RbfZ1h4Sjix3+4uQ7AhhIvoT8x0WXWzPc7xT2kjd5p66sFi7f723uXZJht52mOAkTNwrgm2pLAhb4/EQYm0BOBM6pKYwSF0baFvsKJd4GeKzV7m6FZ2We/GFU7pceeWUzJOHjZK86fOPzJxMJvOjCWX0vv31Y159dTn++OdpePhf/8IHH32EYCQCSgj4nxrSDI1NOlCITgk2WUZhQQ9cfunl+Osdf8Ed0/5Ihp1YQjI97gm8fsLEJQ1SP18/0kKAYsJQFF1ziw0HJra99jpq5sxBLRNLxraKkTQZmcbL8HNJAb8C+2JZ9twuZOVA6lOImN8LI9MPJTcXjsxsQJcgQojoEBVDEFRB8c2C03u7e8Rw5EycgK7XX4vcMaMhds6+m7hc5bzu42WfTMBIfrthBnIFMvfkNCkyucSJWweL+PVgO245MQd/PbEXfpzhHTXIpZBOkrSwK3FM9+vG6kTZZrQuegWxJ5+FNn8BYlvZREi8ZpFKm0uBxKAkjJGtkM/a5fBjTU4vrBx4Lp7qdx6eHXQ2Xu83CB/4dBxIUxCySUgIKMxm4wRsoSySTyMR/qhzxIH02yVH5lziSi9nh5g2pQpPv67FESoxAHd7PRluYe4Zabb6m3Jl3JihYnxGEjcM8mLUEHskL1vqx8ZDxJvlGzbstFPIH6b9YfGdf7odl549Cp1sTnjjgD1mQkkCokohqwZEJqRb6+qxetkr+P3Nv8Ddd92JN954Ew0NzWvibfGRnzW22v2xUouARcAiYBGwCFgELAIWAYvAt01A+LYdAIQWpgDAjTBnqGlCkiQIggAhKSgIfXJD74WjnAqe5TFb9qxobo/5ypBTV3uGnLrU0aPPjTY5a76T+MpY8W/0xcVfewNcZLHtQ2Kjfb8ebhuXCL8Xbpx/L+qm/R7199yD5tdfX5GINc1sz8NTP3Etl+Ce7Snsh/RTT4fQuxjOfiVIHzoC7sL+IMRfw/N1NNaeQrze1SEprapF9iIouTsePrS+YfvWyofnzF3wu9tvx8z778f2nVWIxGIw2D9KKCCwl0DAgs1wOx3o07cPbr/t93jwgQcx+aZfonef3lMOVdZxxR7JU9VoCfej426+LhjUTZL6yNDHW6C9/zEc738E3+r3kFj9OoxgTWlMjZWymYuiNGBxBrFVyO7Mu+39Su7IvPkm2P7wK3T582+RfcklEP2dL7dLvtUZxLk4h7jm+iTfQuJ01hBP2mKha9fBtgGFd7tKes+l+dkTVKdj8bF84f58VQtS6o/FYvmIy26oskc0xRp7MlnoqDvgdm0uR5et6zG0YTdGCjF0d9iGuSBVUDaZwEUtjQXyoZI8IaFBjquwMbEoRxMIJloRM0IsEqsjDYnFXuhlMlAv+NJg9uqLHUUleLffELzZuzfWd3ZD8wXRo0saitwO5JrG3YlEsDBk1M00pFARuyAUyiZlfCwK3QSU7DHobVUanbkXGM8i2oX4goXlcfM+8myMmTsZTh76rniURkvCMMf5CTk05sxg4wzXvorczs8/gZMWPIJRHyzFCFqPNLSpohIPo8NCPPKUkhMHByb86ApcduLJGJqZi56yDTmUIIMNNju7pp0mhcugUHQTRiSB8g/ew/33/hW/v+0WPLfk+RW1Lftb1Kha0l4t89Hfvm6lFgGLgEXAImARsAhYBCwCFoHvAgHhm3KCxoKlelvtssT+nVRr2EVppGEquyFWjmzPgFFk79Ud5tmlCIw7Ha2XjkDa6NOgdO0EjRAb8RGmuQBCiJpJlLJOxHF3ruKd5HdnnOb1ZI512dPmsmMRfMNLjAbyVbV5nBFtuoGGWicihlLE46kb/I79MmLxmS0HtiC89SNgyybo5Rux/8MyqPHY1ABl4qyDn7ou19G8wirn8FHIvWYisq6+Go6TTwbJzj2meGX9VHlxQ3RWmHBu0KFEuCjl+6KB0JwpXO5nAAAQAElEQVRtm7bQf897lM6e/RCefupplK1Zg/rGBiacw9DZP8LOtkBMEKrD41Bw0sD+uO6qq/D7X0/Fjy4ei8EDBi/v3L0z8fics3md3Lig1GoO0NBbH9D6N5dtCWwqWx9prE7yY+3GBZ1syBsEUwqIkg3EJCBMRIqxBIhEwRQTqExVCajrKNBa0jJntuUX3pE8ZRjoiSeCdOs+gYvk9n6219+ehpzO6ognbV7S45kbVRw1UVlxtwK57ce/Tsr74HA4IjAMj6YLSlMosX7b9j0jy99cgdolzyD6/HyEFz+Kfa+/iA2RyJommBPhhcrbTDpEBQqtUwoLoAwdBDrsRBinD4Oz90lQPN0rCMkt409AeGGr9yZR1hnilGK/B2cMKkK/E7qiW7d09O7qxNk9fbiiRxZOsjuQHqM1ko5SnWhDY8QYGZe0vKDDGP1uIEGf2LB31Zz3ts14vKxy6ortTfNqIlplo0ZHcF+OZY2Uum1I5gLxoiib/NAT4RJJjY2jbW3jKLtOYaj5OqTDrk1TjUwNb1iH9I/XoMe695G/bhWEDe/Alqj3C9AOy+sm7nq3w1fSo2cvjL3oUlw6+lJccckEnHfuJeja/QRoNj9UkU0dEDuoAUgsCq0Gw9i/dzdWr34Lc/79CP426x689PrL6/fu3csGDPj1nrruYS0WAYuARcAiYBGwCFgELAIWge8IAeGb8IPfkOt1NWva3nt/dN3rryGwahXUnTtnIto8jgtNfjPPU962AEGVuxQsJiNHQLv2EhhXj4G9dChs/swJRFFaeJ7vggm19dWRNR8uqH31tTnRj9bNM+sbl+mmWsR9Y5HAlIjm6yAski7bkYSEOBMKGksFhwsmkSBCOEx0mA6HSt2+CWKP3pPSTj99rvP0U+ebPbreGrM730rV9RlvXIDaWORT1KCqujpux/YK+sbK1294/Mkn8Nj8J7Hs5VeweeMGBFqawdUKi/WxmkzmGoXDYUOP7l0x+tyR+PFVV2A8E89jzr1geZ+CnnneLN/5LGPqxaOU/ByJ0eCS2I7taFjyEloXP4e6115By87NqTyH3tiKx2argGhbaevWDa7Bg1KTAOKQYZD7DwBJ84GC1nGByrIeemUTEklKzmozs/PlRnr2YJvDd8w/vcQLcF+SABOrtgCFs06HGBHBxDpwPCdOVKbaWqKSlF/RksCqHfX4aFMV9m/ajOim9Wj76H1sW/MhluxpxC5TnRFiwj3kcqkxSEURm2CTenWDe+RpcF92MWw/GgtX0UB4fLn9uP8HTfWGUN/Jhvm9JOHyC7pn4vLeuRjfJxcTeufgGrZ+frZH7SnJp9l1qRqGFDBhqzcFuUUXpNzdmr7o6ZomLKpqxQs7A1i6vRmvbGE+7m1Bczy56mAbx0xkmKqcjA2lTTXroxvKVoXXrJqm7ty+yAwE1gga/ARSHWPsbi9M2WjVVB3JcAR6WyvMtgDMYBCiQWADDglb/oN/QRr0axLNcHm9yweecSbOvGwcLphwHc5lVjJmHKQBw6Hl9ITqzIAuutiYlCCaBJTV39LUiLUff4hnX3wWjz/5GBYtWoR33nmHNjY20kQiUdjuj5VaBCwCFgGLgEXAImARsAhYBL5tAsI34QCLaK3SNpWjfvEi1D65EA2LX0Dk/bVANDkV0egIJ+AmLJLM204jjpWS4rlD7tl7sO+Ms/v5Th/Vj6Z1Hswf12WZUn+uief7No1Gg6NjH2/G/n8vxNaZDyHw1AtQt1ZBSmqjD/p1SHQoDufV6d2GQiw+BaFeA6ANLEHByHMg2H23+oi96mD+VBIDIqIsVwuSfSXcynTdZ7svZiNKXDLO4uI1lengG2UChdvBTUgxrcAMRlbV7d039eVXl+Lvs+7D/Q88gLL3P0KwJQCqq4CpwzBVCIRClkT4vB706tUTY8dcgFum/grjr/4xBg4YeLeTyPN5vfwxZJ5ySwIFMcSKzWBLSWTrFrQuXwZp5Sq0vvYGmjeuB9Uaj4p06k73YrlXzxs9F42G9ycTIV8zCcLJZ5SbabnDXEf8mjVvg5sPWG2DUp4GuYJvf5bx8cLFto+QAB8X2UQpzyCkgm9/Vpmvsj8lHLWWYuJ21zcRadzaFgOr6oDdmg8h0QdT8sCgdtQFDby87QB2RpJgynYc46QkIOZrkPMdeV0yvKcM9+SMvvA071mj7xazfHmH+RCN+uFN5rJrwO13iMsHpdnJ5d2zyS+L88nkvvlkXH4mOcEj27xespr4SY3kcy0XiGupD/JcNab03dmSxFO76rBJtaNGykAVS8tqg3h3Wx3qQ/HDmuq4wbk5oEVs8fAN8S3rUfPsk6h/ch7Cr70Gfdc+iBqbhgDZAEQPjWM40m50nXAi2lg0ua57T4R79IWz5xAQqcvyjr8tYCDpFiDkGVTvS2zyclenXp7uFwy3dRs5fFj3c89CjyuuhOOCcSADTwXt1BvUkweVOJl7MgQmxAUTEClFU2MjXn3lVdx///148MEH8f7776O6urqyra1tGctsvSwCFgGLgEXAImARsAhYBCwC3zqBb0Q8o7lZoZs3Q9m9F52DYbj21iKxdScQSpQgnhyB6OH99hBbRTpxlbuhVLqjSks6E0aH5/h0i4vKekpLWfS6hNmnN/ssSyuNlvA/ccRWj+8rEFymbdwO4f1y9GqKQi/bBHVXLWhMvYEmgiw6puc1UprLGyUeTwU8Pc8vvO4WDJh+Dwp/MQWeAQNvTDhcc/nxduOPgWexDTch9U4nqeGijSpyUpMkVQXN06AVscOpV0IPjA6ZiSmqoY7Wo6ExtFUtSTQG169/t8x9y69uxv2zHsTa9ethGBQSkWCTZciiCFEA2yYsJcjOysAFF5yLadNvx+9//1v06V2kauEgAtV7b0sEIotoUJsD7dM2dah9CXRFZOLbrSbRldVdwIROVxYtTE8mAUPviw4L67+b7VXiPt/SZFHBMP3kITdGhw65O5SZd7Wi+Mq4+O2QHfwXrTk7bzyU4W6NjERropQJWKVjno7rn3esY772dT5O2te/XNoEnejuGI3lN4kYv0OVsNNMR2t6IYKefATkLASVbERY2sRUczTJYGhmAROm9Z2Ifa6f2JmoJAHWzwhx+Fe3CtnV/HHm9rbjtHFi3BUeH5NbJqiu2Ai2n81usPeDL94/ZoeNZ37IT9wLEfUqCAg3aq1AmNqQZEJe5WbzQXVloD5iIKyZPPtnWxJ+o25/cWjDOjR+sBrirp1oeXMFQhsqIMSN0dnMf0BV+PeseSWKJ22ut/+QUfk/vRHdfnc7Ol0/GWmDzzlNM3xrY0FayvNwM2CqGiS/qUhbBa+wEFlQQzFj5AFoy1a17Me/N3yExi49IIweC8dZF8KW35dNJGVBZP5LRIFgsKGUpGDw2SSPiJaWFixfvhzXX389/u///g/vvffe6ACLjvO2LLMIWAQsAhYBi4BFwCJgEbAIfJsEhG+icZKdW2aUnIy6omJsTs/CgYLuoCecAHhdq+GwrXa7yTEjykx4qOQzjrX7ySONuYSUse3KbEIiLGVC7JNfHE5nAjyDCXG+74ssqTePSUZep7Fn/4/GH/07Tb7zGlXVxom1RnRGI/30h4tS9Ui2lZovHcGcXFRn+VHTyY+wx5Y6hCQC2URezXw51CeXy75c6ZFJpB6FGVLnnAzF5Z+bfdDXTwoBTuKvYf1N+d++z84i0znEfV8X0XV7JlF4H1OHbGL6aq9gn6WIjpWxcHLRa2+8tv6uu2fgj3ffhbKNFWhsC0MlJgw7RZLFQSkTvPzv7FK3Am+XrvjRpJvw53vuxy9v/g2GnDgUHpmWhV9YrODuv0H5418QmfE3GLU7xkAITOTikQnh3E7EttBJfGWir9tcc9gI1F13JdaeczYSP/oxvMPPBrF3OmwygPePTQYEYoBbl8WIItuWdlaU6UwbtTBRqKQ6cvCtkeqjm+AdEaViAXSzb8IZLYm6E2wS4mCGYySMVUpsdqwrQGk+q7y4JZksprFYPm1uu40GoqODCVoYBw5NPrRXt48GF6j0wA3GxvdobN7DtGnGVNq6/jGaDFYmeR5JEsqcxFnjTBC49BhUJ7C5+wl44oxrcOeFf8RfT/8Tnut+OZLUYEIPkAQhFS2P0sDoBA0WUvrJOOR1RSEWR2gkNaHCtx0ke74B92u6kL48AW95e3/4Mf7oc5NhjKwzjDF8u914/4KU+vk1YbhJGXUlkR7bC1tQB5EIDE8ERK/CKfs2I//NNxF55w0aq91Ew/onfx6L18PrCOj6aE2QPDAlwFRgQkKcmojAgCrJgGxfyvMSNibtdl8VX+cmpzlWenudcLlv4JC57qLeE4hfXp2eJU53yPE6SgP5PI+f8fITx2onnIyFN3WOFINGxKTpT8YFBJM2IO6E5uuC5JBTkPaT6/GzfzyMk0adBk9OGlSZMLcEyAaDTQjYBAaSmo5AWxyvv/k27pxxF/505x9K31+zkgaDddU4uHRkfXCXlVgELAIWAYuARcAiYBGwCFgEvlECwjdSe06nUUq/gci98AJ0Hnsxci46H56hJwJOx2xIxqEb4K/TdjYhkfbyHYUI38ejZ+zm2n3QDhNu/Dg3GgwvSb66DFj8KvSFryDx0tvQd9fOY3G08SaIn+dpN83lWOgsGYDcy8YgZ8x5yLnkfDiLe4E4HLOJ77P//BXxkcDnHW+v/4tS1r9IfUOs5dXl79Q9NGeuMu+Jx/DKa8vwUfl6BFrboPNfedYo3IaJdENDtm5gYF4nXHr22Zg8eTImjB+P0eeMxtABJxK/x18k6VD2b6lA06ZNCG3ajLqytVADzaBmcuiRvgiu9On2oqKKdNbntCuvQMZ558PVu+/KI/Pxbeanys5LFZ/AcLOIOt9m+/l5OuwcqBDdGmyKISoRUKGe2oQySRZWH8zPinz2q2MeVqkqaJpi0+Lj9QN7q5tefGFGcMkLy4SPP6i0x9qmcuHYXhOlQb9AtVytJTBHX7UW9Pk3gdffx/7nXkC8ppZVlQVCsrmvSBfJfT09Irq4TSYyY6j2eVCRm4ed2bmI+rw4MY0iSyFICGbJzqS2ZlNUWrbNkCrrdH0qF7t83KXpgb4UNKO9fZ56iKfCR5xlPjZJwrfbzc1YQRTLbYa4oX0frwOIFYuIKolgotAum0u7e2Sc6/Giu5ZAWrINWWoAxZFGnLhtG7JffgPRpxbjwOvLQNvqFsXjkZGsDkUHAgqrW1VpneDLg6/Pieh86ijY+pfAz8aHq7g3dJEJ8w7Cv90Hnkoez2K7P+NGyedbyLdT5nDUq6Ce1PrBN0KIenBVsUtatYOQci+RkS7a4IcAp5pEhlPGwH49cdlFZ+GnP70WP7l+EkadMxI2hx2CIICyCkyWlxIJpklw4EAD1n20DkuXLMWcuf/EI3P+mb/mw1W0LdBcmUgkSln2797L8sgiYBGwCFgELAIWAYuAReAHS+AbEc+ECVtbVk5er1Fn3Xri5ZcGis4/u9zb5MdidQAAEABJREFUv8+NEFk01eY9FKH9Jqhq0foZZrC2MlJfGY6HGpZE1dA4JiKOehxWatOgv1EF4eMWJMuqEf5wO4SaVriTZp0AqQwdFl2SVroG9puff/kY9Lr8YhRdckEk/YReE5CRPr1DtuO+yvz219fX0/Lycrr8tdfw8KP/wj0P/B2vvPEaauv2M5lhsrkIAw7VYGLKQKekiROYhDlZceFHffrjl5eOw9Rf/GLw2acPI50y0wh30Gbz1jDV/1IszY/m3Bw0dc5FLCcbhs0OU1SqeOSVCeBPz5ELAUduRr/u/UtIv3NLPZ0GnEScaTmjeF1fxrLAguJsPHTMy+KfNSJQD1muJD7fcjfJnm8nvqqOefg667+btkZLaCN1c1HK93U0NxOdafF4tdLYeFvw/dVoevpxtC58FPo7r8JZv3scayMlhnkZQnyBNFO4jwQ0aFv2A9saIDYS1K7YgWhdKhsjx3MC6TbMKMnz4LQcB4q1BuRHdqFzdDu6k10YktmKKwrTYTd1lNeHJr60N1z6/F4JS2oErArQGfsjeoumxYqy1eZc5VCNn9T7ee+ceYaNVPA8NBLJ1WN1tzsC+5c5mpor5UT0Vq9pbu3rciy+ulsvnN9JwWk+AyNdEsZ43OjBRKbyUTkCr7+FAytXwdbSBLsWH8SuQz6ZEeGcXC5XIJ6d2085aTjyLv0x0i64BLk/GgfPwD532Ly2+hBw1DXCfTmW8XoV+CuPcUxV1UgBHI6AWxbv6OZz4qTOWTjBL6NEiGKUFMPFPooSr3n5jy8ZY5v885tww6Sf4awzzkSfAT3gTfOBEAUCEWEnBAqLjgu6ibp9dXh64XO47+//wJMsfefdDwt3bKtcFQwGF3T0IRaLWYK6I5D/cN0qZhGwCFgELAIWAYuARcAicGwCwrF3f/29cZegEG/Wfcj2lyLDM5a4suYSp/OoR5W/fkuf1sDEliJW194mMgHRtvxVGLt2jnSEQ7exHEfLGNEJMbsPVHcumkSZGYHoyoBM5NeYkEmpKRxcnMzvpE+ZH8tOvyOe3+nuqM9zH7zicvJptO1gzuObJJNJ/9tvv40///nP+NWvfoXlr7yCSCIOnVCoVGONGXBKAnIEgnwWuesjiDhFkHFtTg/8uPdADMnvAdnpPEzkcJ8Fyb20N4tEO08bAWPoSSgaMxbOwj4QZc8UVulhL56f74jQSC45GJnl29z448Y8/TxrL98xTw5Q7gAqfYQc+tXmjscbKeV/S9qN+sAsNIXWG9HGsBGN3RpOJos75qNMVANSaXjfXmx94SnQ+l0w9+9AYud6JPdsxZH1O0WxzCY4YPoyEfH60SbYEHVmQFWcHatNlTuxU9r5E07oiond/DhTaMEgcy+GZQVx8UmZuLK0ZNK2A0HMem0T7nphC/69sgn3L23BnA+DeLdeRRjCIKrKHhZaDx9W8eds8LHL+pNLg9HRphaaKe7fd5ttzVqQ999zk8CBG2DEzvOD3HF+SWfyu7N7TLr73L41fz5nCCaOGoYMv4QoE6YREocp6CCUwtRJARfh7U02aSiuE6Wp+3JzV7cNO+U++2WXF5lde9xo2m38KQLVhpC/Pe+XSckRY5+ds9w2aMW6KOSz8mq6S1o6oFPWlOvOGoJRhZn4RVE2/tg7B5M6u+ELN05GW2Byhictb+yll5OnHl84/3fTp2AQG4sOuwc2CmQrEryCCQdMSCZgaiaaG1vxzzmP4eYpv8PMe2dh+7bt45ubm1lu1iJ7sev0sEkvtst6/W8SsHptEbAIWAQsAhYBi4BF4BshIHwjtbJKncRZwxJEIUZCzPj61zEuLr6ofNPeymT9KyvRdu9jiMxZjNgzy6FtrCxGW9sNR5alOd7TlAljYF5/KXKn34Iev/81YoVdAnG7IxX9Oyo/PBWa4lmuiq4yQ3aUERbJPDLP8dquqamhzz//PJ0wYULlX/7yF3z44YfQdQOUReSoYcJk4ojyM8dCuElTQ0aWH6f264dLS4fjtD6DkJ+egUhrC+rq90FPBEuPjMgRl6vc06tvVRGLPBb/7GdIH30uRG/aKOJ21x/ZBy7AIlpkpAqM5N+H5sYfhw5S6ucRzSPzf5ltLrx8nyGceXkNRn4yHJhOP/poYnT+46h9+GHQ3Ztu07Tgkx0FNMkmEXj1MmR7oQzqjQPpDtS4ZbRl+iDmZvGqDrNW2EqjeVnz5R9fCPvvfgrx55dj8F3TkNa/mEU8CesiwMZZ6nF/n2HUFHpc940d1A9TxpyLX14+FheNOgN5BQXYGce8d1m0uorISGZ4YYgGWJgU25oDeKemAR83J+eZyJ7OJ4vaHWil0RLOLkGDhSptLUnScDHt8Kg0Z8L6Uw+ZVAQrt4+vWfQ8ds18GAf+/ggCr7yE+P6qGSTDlhqbXgOrMwRzpkMxlsezJfhvPB/SjRfCc/1YdL3yIkidO60UBPtSqIISC6qlNXF9zhs1sfUPlrVO/MM7TSOmrw1OXdREK3eItjlhiU1jMO8FLT663devkxKRcB8VXofbhoV93dKNZ/dOQ0niANKWL0b0/jsRfmnhCL25aSaScgaN0FzRFNRTTxmCu+74I/42/U+4YMQpkI04eHTfxiqSCIHAJrgcTjcENlHU1FCHt958HT//xS9w++238x8YS/1Zq0Qi8bnfm4e1WAS+NwQsRy0CFgGLgEXAImAR+C4S4BLsG/XLBVfA9zWFZozG8kMAFzXK5zlrJFWYLUFI++oh1jcjubcGWksAMNXiI8vJDu/qUI9eNea5Z0G5cCSkIf3LkuneWw1FjDRSetQjrFzsZRKlLFOyLfVL9uVH1vdlt5lgcieT4aP84eUbGhroyy+/TOfMmYO5c+fi3XffRVVVFVpbW6GpKgjTaAIImMKDIIrI7JyLcddchRt/ezOu+OXPUHLuGRAzvYg4RIids+DomoO4SPOpRFVef0cT3Gmjlc7dilydO2fI3TsTkubmEciOWVLrXFAbklRtgkScbEKEWzpQ7wUiqQxf8Y1GW0uYjeE/8MWLHou1AM2f2LNtanTNe4i/+w4SH76H6reXIVS3t0QTtUGM4aFxEIKXCeVO6Dr6QnQffw3yx09CxpkXQM7ryas/zGKQ3DG7q9woLLhbOG0obOeNhDjoRAge77D2jEmEctm6arPZKnxptululzsjI8c/SmcR0QOajK1BExuagF1JAa0QockSNJsIlZhoozr2JZLYHY7BkGxraThcnEgER0f0lomyGRwnRRsXSfW1laSpaT2MZGESSR6lZc19+krIekGguRGt1dUw9zcgycZworYaWqSFnfagP8gmLVhzEZeA92ySNJ86PcsxeABcY0cjfexF8Aw5BXFH2n0grnKkO+pDAsZva03c8PquBry9N4j361S8VavjmY8bsblNR4sh3hbTYkXEkLZ+6sUXr8ViNOU7PxfxeHyEoieKTVDVhKkSwiY1WBU+NkHSRSRzu9rMu4XdFYiveRvx999GzdtvIlx/gE0CJS8mblIv28S5fr9neb/evZZecM5IXH3FJTh9YG/06pQFn8sJIsgAEWFQClADhhZDW0sDKrZsxmuvvYZHHnkEDzzwQCW7XiqtX+aGtVgEvhsELC8sAhYBi4BFwCLwAyQgfNN9IoQcJdy+aptKNDnSFQ+O1BPhUhqJcHFzzCrsDifsuZmgPTtD78oij12yYKa7oEvCURFVXoFmT5+DHkWn6b16ZESz00dBlleLTBge+dg2z3u8TFUjBaLGBGAHAc0fPS0rK6NLly7FE088gaeffjolnNva2mCaJhNNFAaLPBODglAg05+JkpISXHzJJZjw00m4+JrxGHLJ+eg68lRkDB8MxymD4S0tgaNnNyaehQJdFsNH+m+326u4EZ8vcOSxI7f5D1zJEHlEMXWIn1NuqY0j3rgYjlB6zHNEWZ/Nlvr15p5dS2hjXbUaCk20AUqQJg77pWo7NJjNdYjv24PkgWqQQCMCFVugtTaBEC2XT6S0N8sFmpyWMThj0LApBReOQ/7FVyF9yMh6OaOItOdpTyWINRBsa+HyzHJ3yvPY8rsPpnbfHT7FWdaeh6ftfYvH4Q8ROqeiLrHincoAXt/WgJU7m7BmVzOaNUAVJOhM1GmSAk0QYLKoqG4aUA12kFWkEyOXklipoAcn2wJNt9H3PypNvLISybc/BN1Vu8RQ1eIgE8Ms66GXSUS34HGCZKZDzfJBy0oHSfeA2GVEISpe8EmLKFyKUu6EslIirrnEnzvW0WvAFFefktvt2T0m6aKzkvhIgBCitlE6uaothk2NbaiJa2jRRdRHTXxUFcCeFh2RJEaLphiWiFx9yIkvsUKIXkCbojdgT11SDrbNk9XYCAmG+1hFPUSvjjXsQ+jAPiQCATRVszQahUZRwPMrLle5SMUNTiaiu3bNu3zE6afg4nPOwpATT0R+YR+4c7qCKowFFcGGPwRisnGgQ9d11NbW4s0338Sjjz6KBQsW8PXS7du3s3mL8Cxet2UWAYuAReA/JWCVswhYBCwCFgGLwJEEvnHxfGSDX3WbNlI3aWqcZ9RULzLq6lZp8cgSNXbsHwbypGeOtZ3YD/GxwxEdeSJsF54OsV9PqC5bORd1R7bNxMdCPxPMXIBxwcysiln5kfmOxzaL0KWEhULNpKlpo2MNjVtaD9TSfdV76bp16/DPf/4Tf/nLX/DSSy+hpqYGhmGkRDMTQEwoEAhMmDkcNmT6/Th12Mn42aTr8bvf/h4nDj1lgisjazDS0k5LG1Q8+6SfTsCAG3+CtFNPqVD96bfrguDXQZhGxddauID+ogpYHxUbkrlJqBl8/cj8ZrjtycimjxB7ewUSH6+DVl8/TwQUgsOfDLCBbrW7nRD8bpgZHpb64HOnwSVKsBsIiIgq6LC4WJTVZsuaK3ftbZM8vT1yTue8DocPreYSUsaNP27OuEbSZLnSr0uLD2VgKwzUocmEJpgzNgaS4xaVt+CFjY14vaIJ729twNrtuxBlEWZBkNm5kVlElAlnUYZsAH4m2XPtApO5sUKqyAEWtQ+bSaOE7G1AbN4StD64EG2PLUXi3Y8hxLQxrIi7o4Amph7I7dULGacOQ2hwP+g8Qn5iCWy5neCCKyWIycHH6/m4zRHF5c6oZ7VNdy91Ce75HqQt9sKW+soErzdGTYRUFTFdA5tEAiSA6CoIDGgJytYJ+CQKkjZ8lUWJh4drB2rmJMvZedy1s1AINE+zaYlBbuI+aqLKTo2tAjufuj8LWmYXSBnM3B5Qm3Bo0kIylZWiiApRJuXezPT6Eeeci5NGnY/eI85FzqARkDv1AfFkA4oDRBQgEOY7YbCZ08lkEnv27MFzzz2He+65B8888ww2btw4mT/JEQ6HJ7MsqdeRX19I7bTeLAIWAYvAD5eA1TOLgEXAImAROM4EhONc33GvztACy8ILn0LlAw9g2z/nou6dt0plPdmX3QjnH9mY5PUulUsGLnZffw16/vLncA4tXW1k5EzRqLb+AJYAABAASURBVBxhojhyZH4/ISmRceT+b2KbEBKhsUB+rLG5ct+68vHvLX4BLzz+OP7652m47bbbsGTJEjQ2NqZEM8sLbkyAplzh6770NAw59WRMnz4dd0ybhnGXXLq8R06eRxHty3WI4aSkVMLtnmVmZc41cnImaU7PfaCOGjuUuRnkk+/Kpipjb1xUseS4vJiPCqWNbkqDfiDkFqFHnLrpTyJ01PkJtdSVrH/hGVQvfho75v0Le159CWqoZRkxTIX1UW13yEl8ZbbCE+rTzjsH6eMuhnPUmSi+6EfI7NIDIrCBichIe972lJdPGf8edPvOL0hZ/ohbQWXHbIR8EolvZNHzHa2x8YvLa7Gipgn7DAcScjYSJA1tIoFkCvCw0KknqUJRQ1C0NnQVDAzyujEgOx0gmr+F0PGNxFUaMN0IhUUEdwXgDBIogSSadlSBxqITbZqWwUUwDi4OGZWKL/v8zFPPiPT79S3o+aubkTbs9CrFm3v5wSyI0E+fvmB9UAmPMjudNYS469l2hFmKJa/XJ0tlXdwOZNI4XLFm2KL18BktKHKbKEwD0myYz+slPnsVT7+sJap3zDiweAG2/OshrH/w7zjwxnJIbW1zjlVednhX9xx5NnqMn4TMH03E4Ek3I71HDxBFWt2eX5JyVhPiryF2X5Xo9Y9KGzz0xrzho+EbMhrO0ovR5Uc3wjV0FIRO3aDbHEhSoP2pjPY6kkxEs6gz/vGPf2Dq1Kl48MEHeWR6FhPQ03kep9N5SKzzbcssAhYBi4BF4LtOwPLPImARsAh8twgI3y13DveGBhOFtLlpRPLDMshbKhDfuBH15euBSHCOBBwzumjY3HcTX6e7BV/O3cTmvUOW5aWqZP9u3DRTUlK9fSdeW/QcXlzwFJ5+YgF/zDT1vWY2GXBIDHBRwCPPPM3MzMSoUaMwhYmoX9/2W5x9/rnoWdhzii/Dez4TSZGUQCL2KiYoWcTUWyO4XbdL3vT5bod3vi7alx5LOIeBkgClR4nbw+l/8RalgXyEm6bq+0JhdXtti76npcXRqk6UVdVti8spAdexFpqMQavbB3dLAzyN9bA1N4IkYiU2Uz5KuAmOjLFmvwEQLjgPrssug3DCQJi+rBtN08Hcx1F1B494/Llju5+1zoS/G004LIrdnjcJY2RNPI4NzQ1osYuIs7AoEZ0QHZmI2DKRjErIl2SMyFYwqhNweZEL1w/Kw+huWcgQbLeGid2/dj+ZunBd07hH1lbhxX0N2OzzoCrDjZbOaRB7dYLuFCOgWn4kQnO5L8lwspiLd9GWvhL2zLE0r8fdJK/7+aI9bSzivuWEEJXlUzSQw8Y+baTuYJD62TE2gdHeg0/SNJD7BmS6MPqEbjg114UTvQZOzhZwSb9cDMhUkCbqC1k59ye5v9w7jQdGxBqq0VT+AXzNB2Dbtxvm7l3Q6+s/swKhe8/7pOFnwTbyIrh6nwTJ5ztftal5zTQ+MlWoCWwShqb8IDZPhejxz90QMLAp7sYBT0+0ZhcjbcjZGDXpF7j0Zzdg8MmlcLpdENl5SZVnb4IgQNM0tLW1YceOHVi6dCl+//vfY968edPWr19PmYiezLJZL4uARcAiYBGwCPz3CFgtWQQsAj8oAt8Z8WyEWqYatfuotncPpeG2cTQSydUpLTAEMfVYrJ7QQJMqiGEAlCqE6McUPU7ZWSlT22JC7EshuSqcxFmTzaK+X+esMXGRaqs97VgX30dDoTHRnTtpeMMGGt++k7b/GFbHfIGm/XTjuvVLVry5Eq+//S7KK7Zh646dqGeCI85Ems76ZVIK/k+URKT7/SgdNgw//vGPMWniRFz6o8tQOvyU2T26FRCnzzm7Y918nQurT+yTyCnfd6x+M3puAUYu0TT+aHVKrPC8/5HFzJLwtu0z9r+xAlUvvIiaZcuR3LVnhhBJTIWgpZh1rFexO5DXoyc8OblIK8hHeufOsMtymSw7D32f+lB+h7dSzcyboBcW3aH37jVFzcg4LWlTNvCni3k/D+VjK/w71hSJkgQNHvbdaXboM1/BBC2MqCiIOuFOlWdjimemLE1F0XWjyDB1JGgCmkRhsnNiUhEmG3aGnAVBldGTGjiNtGFkbCfGKPU4LwMY4LNPoSYyPg4kZ76zI47lO6J4qTaBl2ICygp7Yf/wYdBHjWDR1EEwHdJqCt0ty2pGNAp3u4zn/VPtrnJdcqy0213LYbrrkAUunN37YIznfna0aBbcpgMFbZpWEOkQlaZMUDsglnV1iaed3TMHP+qbiyuLc1majbN7pKGrU7zcZ5dY9DfEhatCY8HSRENtMrZvF1Xr9yU7ttFx3YCRL7EQuTczDXanAx6HC067G4Ls6JjtsPWQxz+d5uUNM7vlX25mpI8CFcuJYeYysoVBPvHB+scCx7n8XPCCPPIfFF0ISW5EmMXtXjg6F2DAaadhzBWXYzy7Lk4b1B89fT74iQAHpRAJARUoDJiIRiPYu2sXVrzxBhY9tRBPzJ+Pl15aOmtHVSVtDYcX8DYsswhYBCwCFgGLgEXgiwlYOSwCFoFPCXzr4rmVqiWhlt1U3fzxTHPlGzBWvonY3q2LwslwZVwW3EaGv145eQRQPBBuZtnFA8Du2OdKhnDY47btXSJMKLsUVzn/ESg3IfXt+79qykVUkCYKuX+tSJSGKY8KEpXd1Lt5Xfw4NzPSdEN819YlgbeXo23Js4i9+Sqaa2qr9WBwPD8eCgaWVFZto2+vfg8Ln30Ozy97Het216BOpUhCBIgIQpH68SMQwOX1oFvPnhh+xumYOGkibrrplxh3+eUZA07oS9yycwa+xJJIpERkys8js4tAxKlr9RI9+he42/Ny8RhTmyeHk03TVTVa0r6/YxqjsXxTpSNCa9ehYekS1C5+BnuXvoD4tq0wwuGRsHmPYm/359UUnDsWtrNYNPmc8+EbWgqHP28YYRHVjnXz9WgUikBdq3W7fbEhk4AugYkiovBjHY2fjxi0PAPUz2RTHhA6Zr87luHnRSew6URTBFdcSULNYMKzOBkPjjcCtSuCVTUtxt4903yhVnR32yDrCYgCYRMbBFrChEAd8AkC8oON6L9zPYZ+9Dr6bV6Jro274VbjSljVb3t5dwDv7w1gextBpZmBNXJnfFh4ImpOOwfGGWfD3affrYKorCSQIoZhpHxOKEpdu59edp6IZH7CUGSyujWeG4tpRUmYI2wgLeiwxNi6JgOCbIbZKptbCvppLJAPOe52mFGVf6+/Z5bdc17P7NMu79fl/NE9cwcPzbCRbJvEJpmISogvoCfCpeE9O9e0rXlbCb79CmJlbynJA3tofSy2YENUp6tb4nTTgTYabA4v0XRhhK1rd3Q993xIJ53MzuNp8BafBDG7y1zefkfjrPl2FqByH1Wmr5M2tsfF/AWJyAYJsL4yH4gKI1Yk6okiXkYFirt0zUL3Tj7k+ghy/EDXPDcKOmViaP9+5Zefcw6uGjIAo7IzUer1oZeXCXlZBmXjhIqUNcBM16ElE9i4di2eeeJx/OOhh7D0lZew9uP14/dU76excHIcy2i9LAIWAYuARcAiYBH4YROwemcROG4EhONW039QEYs4FUahj6/fthatTz0K9a/TkbznL9j98pOob6h0x+00l3r9JRlTfjWsxx/vQJ+pt6FgzFVFJCPnRnLwR5OO1Sy/+eZiN8jEL1t3HyvP5+1jZZSgnhhh6IlJipHIRzRyF5LqcF6mYzRXVSNFejgwq/rlxWh+Yg70+bOgLfwnNi5fjkhL84JEW8u8HVu3jnn4kbn45a2/xQPzn8Tq7btQDxn7mQ5MSDYWIyMwWQRTkkTY7DY2RzAA1/7sp7j73r/hhut/Rnr06M60JQmALe5jTAZQGshP0GAhO/zpS4yNUdEw8tMdn675CAn4JPtqj81WwSqOfHqEBfQjjHciUagntBIj1DjLaDswzYi3LKJBJsYa2bFYsJSyyCwvE1OVEhqlY5Rde1FQV4N+8RZkBg+ABhtADQ1H1s3LSJn5Bd6LryPCLX++3H79TR75pGGE7+d1MjvsPLndpN7pJDX8sfNs2BeLUN12qOqRP1z2yfmQKyU4VlLYqwEv011ILWymo4TVe5TgZr6pTDtWpCtKuZxIFEhQ6iSaLFQjjQvUqvUjdjw5B3v+NRe+tR/hwsx0ZMbDUFQViqRAUWwgoQjynTF4KtfC8fxTOGHRs9D+9Qji772NRHPDzIakjmXVdditBRATBahCJzSSPvjYV4L3aD4qE2lw2dJme+X0+1w211KHw1HuciGAOIq449zniKoWGRD8MTZJASGuQNQiomiGbdDqncRZw/O1G2NQz6ycs3ETNxPcSRUSyYDDVOEy1FgsVuqLqAXZMlmdLZHl2Qopby/bnhLNKNz70vPY/ci9OHD/NLTMvRfhtR9ge23L+Geropix6gAeeOkjbN20Z0wgpN6QyO81wXHVT225t911Y85v7zzfPfzSPDEj68b2+tpTzpqv85Sdv2oTWmHEHp2YhOF2Sb7laZKTC/gIzyORhNtuxNkwJyrTwJFTuiv3jR1gx2UDFVxSIuGq4Z1wUq4b6aFwSdr+Wpwta5iQ5sWU3gMw8aRTkZeTCRub7BDtMiTGXTYMSOwTzslMj4ZRvv4j3H77bbiZXYsvLFmKpgNNi5L1dAy+YAl3+NGxL8hqHbYIWAQsAhYBi4BFwCLwDRCwqvyuEGC3ld+eK94QAp3huN3cx2K7B8Iw48wdVUFg+36IjSH4NKx0GXCDsqBrZvokJT192Jf5YSN+o+4htgouJth66sb8q/Uy5HaFwje4dtfehtVrl7jqAyMcGhM3HSph9aqKYtaxcB90lxuaPxNhXxraHA7IXjf27d6NB2f+ffyvf/1rvMAisy1NLdANnQllE9Q0WfSSQtc0gMnHNFZu4MCBmDX7Ifzt/+7BuEsvRW529mx8qUWM6BAP66NNEufaSO7SI4tHKM3lkfQQkvlMoB0mVnnekAuqGg/OjG3cvGLDn/+GrX+8F/uefLYwuHdnC8kmTJTxXCwKyhICsQpe162+kwbAKC5CU64ftGcB7EWFkLy+CnzO4nR+Kph4Ns6S2WF94PvbjR1TfcS33El8x/zuOhOOER+bFHAyUcnyHqonnoVqVofCJxgobSlOMuP9ZtHqwhZKizmPmN2uegFVpnI5AlFUv/IWHB9thee9j5H1/hoM2b8HtwzogfMygUKtFp30GnTNCePCMwswuNALD2GimoqQNGaCAyYT2AmFjeNsF0S/H4LiACgFFJFNKsTYahQQkswtpsej0ZIgm6yo0c2pG0LJ5MbG1jVVwWS4PmlOjkK4WFO1G1J9cjpriM8XsNvtVZRNEHBBzfqh8EqOZYRkR4iSXh5nrTMRPsVMNq8Skq0PGm1tN/BHuY9VxmQ7XfVRNgEC+JJ2ICEj0KbhhbU7sWRrDdYkTbwuu/D3mjpsZJzsqlDFWKuqnV0X6bbV5NPxwWr69MUZt28DU0elAAAQAElEQVTF4IowEG/Zddd8O/Ed9j33VD4qseNiJc+fS0hZkUhuHZHmuGN89wxc09mPMyVU9QyGAuoHZdj68L/Q9s77cMUi6DV0AC77zWQ8Nv/fuO66G3FCfl84DDYxJchI2ghaHQRBiUDXCewJgX2+7MHcBx7CDTffhJmP3bekcu8uGk1Gx/B2j7REIlHo8XhmH7nf2rYIWAQsAhYBi4BFwCJgEfgKBH4gWdld/rfYEwOpKJPTnQniyUCU3ZxHJAfSMrvC40iHLWkLIIwCmLRSlIXlgFb5eaLhePSERiK5qI+UxT4uH1f95LOoX7gIwZdeh7q9ctGR9RPiCwh2x/KcIaVw9BsAFPVBKCMTazduwD/nzcPzS15E+caN2L//ALRkEtSkLBImwCaKEMDkCjXRr7gfrr3mWky9ZSrOO/c8DB5YMqp3QQ/id3mmHNnesba5D0fu5+LpyH2cm4lwEUGMRamTGXEtXsz3tecLsAingVhpMNA0Jrh+EzLer0Dmqk3AB+sRrNqGKG0ewxRJHRNMTOAAfgWVose5Uj5pELzjxiBn4tXIu3wcbL37gHh9V7fX+22mIaA0gkiB2hKojm3dvCX00ZotbS1VYdOITEnAKGTHi3Q28cD7JJhmhpTU4Iwn4WoMIK2uHtnNjSg0YxjV1YMr+mfiJ6VZuPGUTPxysBejCjwYOKgnup46APKAnvCOGg57316Q07xL0yURJ2VkQDENaCoTynocJNwMDw2jc4aCrEwnx6LGRTG8N6FVvr2rdsYT67dibkUl7lu/yf1cbf3Mnao+gxBpNc/Y0RwQFgrQmHD+4sfT1bZQeWjDxmk7nlyo7HhswcjAex/MSbbtZfMGVGFvxR3r1SVbxN+jN9yZnSF7MqHkFMBd0Av11I79SRGtggv1ShpW6w7sYyOAJmhKbCYcQiSEeHGQf2+5Y4VsPUgThVGoI9lq6sUnOXKJUpYmO1amdhx8Y+PQHUXoxrgk1BC77zBRneOSp/eitozeCk7rLKjTPWrIT+r3w9y5E57WCEgixiarbMgtysfgE0tmX3PZlbjtxltw7WVXo1NeNwiKwmiJ0GQZRFDgNAnYNY7avVV4b91qPPPGIvz1b3/F66+/uGTfvu1UPeJrCnzC4qCbVmIRsAhYBCwCFgGLgEXAIvA/TIB3XeBv35rpUHkkzNuzEK6ThwFnDAdGnIxOI4bD0akzkITK4pwB4meRN/6YtvfTR3K/OZ/1YrS2FEYrtmD/668j9M4qBN9+F8nKXeA3+Ue2ayrO+Rl9B5Qnu3bDLpcPH7bG8Nqqd/Hcyy9jy47tUFm0OVWGAiQVcQZcdhu653fFWWeeiSuvvALXXnstrrrqKtIlL4+4HYcLC3yJxZ16VPezM1La6I7W7UhGNn+8qm3dh4tQvXcNTcRvSCZTEWiF/8CZCVKkAfmqqoG2RZEb1NGpTYWLCRQjEoSG5BgNJKO9FUII/55qhHTLP99xxumrsy4Zq2addfZyKS+viLhc5e35vuXUT5tDW5LrNrIJkOUIvfQKWtesBm2onWyDFrEBARJXwo0sIq8Ss5C4HMgo7gNvUTf4mKUxQebumgWfX67J9gMF2QQDciScl+FCN0W4vFOfnsi84CxIY8+F90cXQe7fB45M7+W5RLzvYlagJMuOAh/QWTHQTUrgxE5ODCpIQ16Gq6INWnFEkkZ8tL8Vy7bVY+nOFiytjeLJXU1YtLsR5c1RSLK8Ekcs2YRE7CxqS8inPwx3RBZwIdtKoyVCfa2fvl+G2FMvIfjEi0i+sQp09x52UUWKDCTzO5ZLKErEUzoErjNOg+OMM+EacTrcvXpD8WVAEGwQDBkSnEhSD3QW1YVO3Ly8Kcr1MZC+GtQRvF2+L/WdeT4Zk4zdGmusW1C//gMa3bWdJtvaZvDjR1oSoVwRml9QBKWRnYs6qo9m15rC89FIJFcXWV/MGMOqutmMBGwZbqR36wq71w97bi6kTD/gUEAkZfGwoUPIVZdeOWridT/BJRePxRlDT0aXtEzmucA+SsD6YICy0UyJjkisDZu3bcTjTz6GJ5gtXfoiPvzgg/VNTU2secoq5R5YZhGwCFgELAIWAYuARcAiYBH4hIDwSfLtvJNsUt/khWI/oUdR+hVjyjL+9Gtk//FmpJ171q1ml+xh0Sy4WZ5DQowJtggz9VNv/7M1dmfsDtDE6GOWlkwFRhyCFoON3WQ7qAZBjYGqCSAc5t+hTYkGXjagaSPakuac/a2hkvJAEE9v242HVpXho63b0BaPQ6OE3aiLkCUJLHqeSj1MoBV06YLLLhqD+/9+Pyb/8uZ+AweXEF7fN2W0NbYqsHolds19BJX33Y/oy8sgNLdM5O2FmIDWTZNFpIV6CqXKmZ6NjF59kMjLAe2UC1e3Ang6dWKRclKvGciP0EguL9duxJ69XHP57lDd6bcnHZ7FsB39Q2Hteb9u2pKkxXU6Hd1ItRGJRKJQT7aO0eJtIymNpYRggNJ8bkyApc5RV0IWGtv3Irj0LYTmvwB96Urse/oFGCxqmQH76gxCKvxOUmMkMDosK4rZOedW27lnwnPtFfDccDWEK8ei+cQB2CoI+S+yyZPHPizH0jXbsGN7EPVhY1Hcn3M3GTb8duGqqxcrp4wYq+QV2AibVMil0oxzc30FPz2lC64akIFzuzox5oRcXHtyEU7JT1/tk/CriIaJBwxx3qrKFqyvI2hBd8SEQkSdRdhYb2BTdTNMHQUdmcVYP9nYVfTW0MRkS8u8cGvrktZoeHqQRX0D7FiQxkpDtHWMgsbRLrQOdTbuQ3ZVDQbWRtBnbyvSttZAqKkHVG2QolOV1ZXiFInQ3Kgo+vVBRTe6r7uyJvOWX8J75WVVyUzfhGyPA7nERFoshq4aUEIldHLY4cxy3M59SydKuQJhLWDUy4in6gOSqiORKCCNjTcE17yPHY/8HS1LngW2bb6Nth79A3Q2eGvSDKNMj8WnafHIoqRpjq6DOi6ZDBdDVIuokOgbk1AcFVGU8PtutA8djOwrL0e0uBg5541G5pBSkLS002SHdzXYQnLllf2H9O/3x9/djDuvm4RzO/VEDx1IN5NQBQ0RQYcqUsCgIEEVhPXrlVfewvQ778Wdf7kb7733Hnbv3t0SDoens+qsl0XAImARsAhYBCwCFgGLgEUgReBbFc8pDwB3HA6Pke6dIHXO7id1ye2nOtxv6RAjLiBwMM9XTpgwUGgjzW0v2MgiWmyfm8aaS4N6/bwwbVvQfuywlNAa5GbVOwb0gX/oAMS758B96olw9e4JeDxlTBxF2vPX7tu36vGnn/Zf+ZPr8dd/zsOKrTtwQNcRNwwWUjchKzIUZsl4EqAmivv0wU0//znmMBF7829uQY/e3YbZPLaK9vr+k5SGQiNopHEi1QIjKIswcyHVXk+Axke0qnUr9MZ9JbG3V8H/1lqcsGYn4vNfhLZ7H6KaOkMTbBmy270yg9gqcom8UszplGEfcfritHv/COme2+C84RqkDy4t8yBvuktKX3qsKHcYGWWakD3foaTP78in3Y8vSoM0UdieJxb7VAjXUXrY48ASRZJQXbUlE4PEpprK5Kb1S8xdW1fQpsYyHqH0E1LDjUdn2+uTkwaUhAF7TIcQZCMtYUJihkikiOfhTz7kOcj8PEmZr9k8S0l27gR5+IiF9Oxzlu8rHoCX4sAfPtiGRXtNrA1k4o1aG25hAvq+7Q34MCTcFjMzXyNq7h02KXcp67vK6yQ+EogjNulEB5k0qcg39/en5FRNOdG/dKTPVtTHLp2WyyLKIiF1oQQQSrqhadmwaXnwxrPhSOTAFvNCissQdaTGb4wJ4/20bV49ba0+oFYmW+fMmbfz17dN3DB92pi9rz43DZGaOgHqaBXGIBNEIbCXyarjPSGvC0hxIYSCdJA8H6Ti7hC75cEkVFEJ8qNRuLm/LjZcJWBDq81bE/bmTtLTuwzW032jqSKuvGhQLm44MQfXF7pxUy8P/jC8G07s4Tvsx+b42MkkzjIncaZ+yIyQ7AiNGFPbPqpkEzaL0WVjOeLLX0TLB2+CxhvW8zabNW1kkIl+vo5odATZHVpgrtsyRqwoH+EO1k52mQm/orgricO/WnXYFycF7+qg4K9rFNylLRmdK8zTzkLutGlwXT0RYt9Bk3g+dn0rqfrYW1LbvyW8+X3QJUswrk3H9dkFGNIpBzGfCNUDGA4ZouCELeGAojogw8vcMFH20ceYPGUKfv3rX+PFF1+cVl/P5pRYfdbLImARsAhYBCwCFgGLgEXAIiB82wiY0KlKZ9ErO/FVEVtGBTcXcZXzG/J2MfJVfGymamm1GlsQC4anwxlFOJksbqDJ8UosMCv01qpw82PPrwnNWTAOr63003Cy+Mi6k1TKN13uGc5+/dBp/FXI/9Uv4DnnLIhdOoHdXfvVWKy0asdOOm/+Y3TmjBngfz9209btONDcgiATzglZAiUElAIa25YlGX379sXvf/c7/PFPf8RVV/8YJwwonutJTytSnM5j/gDWkT4da9tobZ0a3bCR7n75+VV1K1fMi1buWqVpNtafpJ/nZ0LCTaGnxBcVRLhlJ9KoHV5VhF9wQmKxZMM0C03ByOf5281HSCCR7Z8SHtA7EB1SDK2o22LRljaWEJIShu35OqbsHKZ+sKvjvq+yLoDYUv7SoN9BaYYaaZ0oIp5HoLljQF57XT47qUqPm25xV92s/YuWoGb+AlT/6zE0LX0tl7bFl+hNyfGsnkMCipcTe3SBY/hJcJx3BuxnnIK8s0fB1b07iMdTwY9zoctTbj5ir5KknIWip+uEsMd/dyVj9fq2ALY2KmiJ5yCqdkEw0Qn7aB7ergpjbV0YdZQ8STJsFR3b5UI+DcmyLDG8oZstcnsvl1TU3SmN5f7zdrhJwHs+G9AjNwN+p4KEFkbckYSuNsOfzs5Rjhe6jE+YMwGfppll/piuKvta4Cx7B3kfvYvMsvcRXfEmpLoGxaEikEU8c9NI2mL7wWtJz8wrV88aCvq7a2C/43rQK0ch0qcAraJcGidCkdv9yY/AER8J5LEofB6RlqfJjpWK4irndbDzWt/Lo0w6i0XOx/Z14+w+bvTrKs+1e4Tf8D58lnEWpiEFBNYBEiNQWaoZEkzKrgvBYNcGVUzJ9GvQipLR6JjkvqYVVc8sR/OjT6Nt3lNoePl1KLFEqRGKjeSTG27irnckpWonhIVeQ77PQ+W5suhYKWTnTBA653tIevp87gshn4zRKI2WhBNBtB3YDaW6Bl2iBgrdGRhcMhDX/f5XOPun49GlVxEkjcJtinAyE3QCQzORiCdQX1eHDz/8EP/6178wg13jjz/+OK2rY1M5lKauLd6WZRYBi4BFwCJgEbAIWAQsAv97BIQfWpeTSI6PCpHxRIz1hWAU6FLiLJPGxijxtnGx19+GsXg5bMwcr69CNNy6hd3ouzsy0G1iuSHZ1iIjb5SzZMiktDNG3qH07Ts3pijYubemaTb3lQAAEABJREFU7pWXX1nz+GPzsfCJJ/DGK69g+6ZNSMZiMA0KFvUDFRhSIsDucKJPn7648IILMem6ibjqqqsw6pxRC0/o15d4/N4bbV5bKkrXse0vu859Thyontm0+nU0L3sBDa++jMiGjSDB6COALcDrYUIiogBbJdiXEl82PCedDMfIUSBnng7PuaMgZWVDloW3ZNGswhGLCwhoHvfMZJrvDs3pmQuX61C0/Yisx2XThOHWtFAxAuoUtLUtk4KRWfa4mu+A2SICLR0bURJqPhqa0fDe+0h8vA7RDz9AeN06kJbWUjGpF7fn5QI2QGm+kJM51j58CNyXj4F33KXIOOMsKHld7+D5GEeGiK/hqDfDIO5AWMOufa2IazYYpgMmM8ADm5iDxmYV1W1x1FO9mNdTDYxrpDQ3VZEgKM6kWClDAyFHfzeZ0ka3QzIDGbJ+d2mBG8O6y+iVE0NeRhtOyI6jtJsNvTu7oItQwBaHaarOhLTVFXWuloJOtCY0tJkGomzMJZkwFJI2KIZSxrIe9lJdnvtiPXvWJM8+E+aFZ9XrJX3nqv7MuzXBVg9Bqjss82dsdJbI/IEeiZycZSP9Mm0k222bIoliauLhM4qwPhPVdNjm0twc6H2LsSm3Lxp7nwy9Wz+YTt/dIYTcYBMjIhK50KJjjFArGjdthr6uHPraj9G6cTNk3VQoFdT2Nrw21PtD0ZHy1oot0ZUrZjUuXz4yUPbxgmT9gXB7nvaUFzLsDsjpGYA7Da2+dERzOiGj7wCMuuhSXH7FtZhw+QRcfNa5KO5WALcssKkkVoroAAEX92htbcU6Nq6ef/55LFiwIGVvvPFGy969eymsxSJgEbAIWAQsAhYBi4BF4H+SAFN6P6x+C+G2ycq+PVCqasYYNfvWoC0wS6bRQkWPIrmxHMrOHfDs3g15VyWiLDoVj8cPCS5Ogke54rKXBR2dAZU6VuqKe3Fj3LxhQ+UuvPjqS7j37/fhodmzsea91YiwG2zZpBB0A4SnLNwsCyIyM7IwaGAJrrriKtzy61vw85/9bEL37t2n2Gy26bwNboRFyZjocvP1jqYGY6XxlvB0buy40vFY+7oRbhuX3F+F4JoVkDevRXLtB0hu3QYSCJb4CEmJZ57XQzwVbjltoZydlaGMOhdk0jVI3nAtjGsuB7p0vk82PTPTIB8lhLhvToNsYJKsnEI8VB+v85swFndVaDjy79iefdPaPtqcG66ocottwUUOzfBkH/G3rU2T5pmCxoRsFA5FhV1OgpAoqBmB4aCV3PcIjeTGFaNABCI2l3ep3CvP4zxj+DDvqLNPc/YZRGy+jEPnIURDY3j+I/slm2JA0nTwX3MWRQ1UjMKQozCVJBwgEKgBg1nSNNFgYDSL4hez9jJS50xzRFQi2DTIOPYi+W0Iu/2Curq0E+aP6SPjRz0pznE2YFwniku7yChJJ6DQc1l97qQhuXXdg6DmLaqiGVhZMAAvF5ZgVfdBqM0fhGYhA3FNyjuyLVMkEQOu1YaUdZ+m+G83iGelBMdyD5R5DgiL8R8sTYDiJ+QzJ37CB5/miDoktaFLOnad1B/L+p6Oj/qfg/3dTkRYyprjhZdNxpi5ipnMlYWEX5A1SC4Clw1wyoBgF6DKgqo6xQC87dH3uF8MNCwIvbsMBx77B+offQiNTzwNbdcOGJGmqZxTe3c0OCttabn3+QcOhTj0FOwZXILagQMg9R6Izpk9cM6g0+/79TU/x+9u/jWb3DoHXbumw+EyIYgqO7NGqho2jqBpGhobG/HBBx9g5syZePjhh7F8+XJs27aNtrAlldF6swhYBCwCFgGLgEXAImAR+J8hIHybPQ3SWOnntc9uiJVWevQPDH1WGcpEk+3jHbDf8wyiv3oIsfuehcz/Zq+WAJV1mPkuxPII6vN0JjoI5AwXHA7HUeKRC1CXopQnJUdGc5I8+9zyFZj+f/fgr//3f/iIRTs1XWeRKuYFu7kmzKCqANvH/xRVhj8TF114MR584AH88hc3re7Xu18/h9u90OPxzLbb7VWsT24u1lrj4ensBp2JCFbPwRc7prQ0NKzZs3PntL27d0+Lt4TmHTx0WEKMZIliJOCnceTpSeToKly6CRjksHx8g7UR4NHPcE7n80ODBt4ROfXk+xp7dZsSd/nmSAbcyVhsZJw2jed5O1p6NFmWEY+WpxOlnNVxmJ9BmihsoPGjyvDyjZS6W6nKf1hN4dtfxuxIL4vt3lu8/YWX8c7fHsDaBx9GuGIH5HBoMo5Ykn5pKemRie7nnAS9swNin0yklfaCWZBeo/qFlfupOrEJ5ryQpN7GzyMvTgj/u8eZZcThX8232431S7Vr8dykIYyoo/GJjTQ8OULbRvLzYJdR7bMRZPkIiNwKw96MuLcJbWnNaLE3QfepyLQDBQaQE01W9BTF2zMI4d8FVomPBA4o7uGNcA1tpNoIzqS9TV43kCiQERrqRPOgAjky/TSvcOt1ioEbdlZi0oF6nB1qQ5EaWmhHoLQG4XkRr5DRmA7/B24t/9ZYE24fdg7+Nuoq/LvkXDyXXoTlB4KoSybXtLeh05qJKt25wGaESjMT4uLskG1+WsSz0hd0lKeHpEB6EwJHTkq0l/2ilJU7bCwcmd/jsVXw/m6Pxda/GmrCUySCV3qXYj6y8FyLgSpVq+ZlbIa4QaI0QCSzRmYgO5f2hu2ETnCW9ET26SfigKKM2y9i6n6gNEZj+ZoRup1GdkGv/gi+fRvQt7karrffgbBtC0iwYSa0lkOTYNzHdHvarVJB73751/4EwqTxcFx5GXqcORLds3IHd1GUW3Ny08iJw4YNnvSbm3D+Jaejc2d/Sjib1IQkSWxyxoQgCBBFkV3aOgKBAF5//XXceeedmDp1Kj766CM/088tvC+WWQQsAhYBi4BFwCJgEbAI/G8Q+FbFs484j3rUtCN2Lm7Siau8477PWzcjiXFybRWLxr4DvX4dEuvehlm2CUJluEQUs5Y7fzIJgZtuQuwntyL3kpuR7vUwvUOOKQYO1NXTVa+/uv4Pt9xc/MTDD2Hb2rUsjhmBjWnUJItIxhi5uE1CkqksQxBR2DUfP7viCsyecRem/uLX6NK7d0Xc67ov6GahyoNOc+HUBLgNuFQbdR8mjI3QgTnqmleS6lP3Qvr775B2/3QoCx8fb27dTiPx+Kc/rsTqEtJybpd6nQrx0pux/cIbsP8K1qczz4fYuev57PAxX9mStLxAtE3vJiq3diXKbJ+dVNl9zFyu5Q6StfDIQsTnCxCnv+bI/Z9um+4WGh4XpId/DzQLUJ1IqhE1UsT669fD4XFmw/4ttHHfehpsPkoM8/r4eaa7a5FRtQkn1G1FlwNViG7YjnB9MPWL4DwPqysVpXcqzjJbZvdhvouvR6c/zkHGrQ9COm88NE/GBCdx1nQmyvxu8IzNIZkTeDluNBLJVdVoSSuLMrfosXHtdfFjLUK6qpixEU4jXCLAcCch+qNR+N2E1Pdwyzitpwc5RgC5YYqi+jT0qcsAEYFT0/NxkisH2ZJtEvHZq3i9dUZ4eoBGRycSicKsutANyluvzEm++uQqrWx5ONhWQ3meBugjmlj1YeRtMFX/S4jb8/R162caC+Yg++kHgH8/CKx6F0pDYLxHk5b7DLLYFSaKMwaYcR27a4No1XsioPRDvaMHaqQ0bGoMoDWR4N1JmYiuC2Wk3agonpmS17uUZNgqiJ/UxN1QI4xiaxb8fOKKfzc4wiacUoU+441PSCWT4eIvyndk8caQhOqWDDSQfizG3hM1phO7IzqaoxoIIapX1MsU0bkajswZSOs+NuuscUi7ZTrSbvoNsk46BYqk1ktCPNeAOiICuUAXvfPh7AY5rQiGNx+tzkwYRX1AO/WA5sydDznj0CRYMEj9LZQWRxQl3+ySdUdJ/54YdkIB8vPSy9jlq9RrdGSzSktDDjPscfsWXtZrJKZ1Oxu/63IKzs07ARmMqU9Ig930QGB+gygwBJOFwJNoDbZgw5qP8Lff/RUz777X/8Ybb9Dm5mba3n8rtQhYBCwCn0eA///wecetYxYBi4BFwCLw3SYgfLfd+2remYQoMS2BpmQQLYqGxkQI0XgCRCOggm210q+4Jm3kSGSOPA++fqVVPCJ7ZAv8P7ZVq1bRfz/6L/xzziN46403sH1bBQKhFmjESAV32X00JBZxdIsKuud2xZWXjMPPmSi/konzU84ZhT6De5Ncr3uwTTRrnNHwGL2uoTK+q5rGWpoqXGqs1EdIwOkkNe1tUxr0U10dGajZheadWxHcuQ3xnTtY9HUzjHAI7IY/Xwfy2vMz8RER03NP85w0Ap0vvgKdLrgUnn4DQXyu5UwYKu35vmrKy3L7onJe2OqdhhmwgQRkMEnWoQDzTVUQr1YMo2+8dn9L09tvL2p8cWlx8K13S9Q9u2fRSNtI/iNujSxC3aEY0ycKBK8CkiYhaTMhOB1sHwvttmeKx/3tq4rTWebo2pP4+w0jGScMJb68XsQhe1e3H+c+MIuwNnL5PuJ21+s6aaGgbkGkKt/Xbk5RXioZ9qWupG25Q5Nf88O91O3+5Ie0MjzOucO7d8Glxb1QkudGVqaGrLw4zu6s4pIiDwZmOeHxiAspE+eiaEARaLWiU1UMRmeZH20vUZauBH3mZUSXvI7Emg2QQ/GpEjuR0Gz1XuJYbbN5KqAB4ZYmNO7ZgXhjNRp370CspRmCbkIipEph40zQzICgo95umLCpKkxRhOawIeGUEVJMtAkqYnyUHOwU67tKSHbkyPHNx5zHRipENg0kGXquBFN1E3f9wWKfkbgCiuKu/KJ8QZoobKHJYsbczSO/PlmAj326kEgMQjwKNzHhsYkQFQKWpzBskBFxGAWAoYoez/J4QdfTlJMG2uz9TiRefy+bj7hvdEGZb4Ow2gmp0qE5Kqk7c653xEikXfVjKFeMRfr4iyH16gbTbueTP6nzys+F3R7Jc2hxtxPxQJbLMb2b5BrcXXCOyjDky3OAcoeUrJYRh6zHxwhafEyPYf1Ret2FuHDqNZj02xsw5dabcMrpJyMzxw8i8GteAxVNmDJlAlpFU7gVayu2YMlLL6V+VOzxxx/nkWgaDAYXfAbE79Nuy9fvKQH22e3/nrr+P+W23W6v+p/q8He8s/yej9t33E3Lva9BwPps/BrwrKLHJCAcc+93fCe7EJRjuaiL8tpkdi4iJ5yAlh49EOvbG2a3fNB0H6gibaAu1/TMrvkFOYW9PXJuVsmx6giFQpWvvfYa5s2bB542NDQgoWtQBYKkKLAUkCUJnX0ZGNanP64YfTF+cf3PcNWkiSg586wMZ05uUXu93mjwLMe+PTPNt94tTLyyDOqaDwqF2j1LeDSP9cHdng/wqpCUct2RhoS/EyLZXRHO7gzNnwnqUADBPOp7x7LfsdrTLZv0Gj6Y9Bjcl6R3zia8vng8nhKMfP2rGmERQW6fVa6e0lLmt4JQMtcZSRa6kkbqERFYQFMAABAASURBVNwj8xMm3MRo4gZ1TxXqXnoZLc8vResrryG0bh1MGhmXlJIXC9CKU3UdLKx0L4ByyhAI5wyHcPoQuAb0gS3DN/vgYSQdmtK+/mXTKDCmPa/T6ayRYd8gQF/N+njoaQMfm8hwONwrJZdvuUtx8UfUUyKMlzNl2+oMtx8led1RlGNHp25RFPVqwjWuWpzrb0W+K3If4q25ULQ8B7DVj8RiV8wopyF1dLhyF4x122Gs2YZE2TZEP94OWyhR6tS0yiwZlbz+lMmoo2keqF06IdipEyJdu0LLyWEy3wNDEutMQt2KTWnxelHhVyQm2L3wO6Jwym1w2iNI81Hk5npgc8ip6r7MG++zZJAqBWZdauKGNro7nouOdTBWTIiTFBMaC5bSaGB0UI+OZgL4sHGWhOChQKFbixcnom03FAhxDPNpONOXQLEcxPAcG07M8yDDLSEIc0KSGCMQj9yVCASrw4EDyYQUvC2macW8bd6mj7iW5xDHQgekcikUGWe07m8xA0032Ip6wD3mAjivvARpY86CUJB1I7Eb1VFE/TQRLDRa6urIji1bxJ2b1rjq69dQ1jdnEi0+FZXpDtTzur1xNmlQ37QGm7bObPtojTsutMF+Vk8UXXcGzv3JhfWTbrgcl10yEuedNRSDT+gGH9HhZI4x7Qz+fQ2NTVhEZB2Ve3elvgO9YMECvPXWW4jFYuNZNuv1rRP433SAffYf+r/n8wiwa93P7fPyWMcsAv9LBEzTzPhf6u/3qa/H47Pqy342fp+4WL5+uwSEb7f5r946v2lvAvJZ2kF8flKPw+Fd7Rl4IvKunADz9NORO24c0k8dBpqdPVi0pa/U4KhhxiJyJGWflDr8vbm5Gdu3b0dNTQ1EUYSqqiCUQCQKREGBYrMhLcuPU085GTf97EbcOX3afaecdxbJzsoiXhbRY3YwotyUj3DTTP3jjxB75BEEZ8/Ggcfno2Xt+6Dh1llAqx8HF3ZDH2HqZ2Hu0BHIGXEu3CePhDzsdGRccBHkvJyVYKFCDfphYuVg0aMSJxOJR+08Dju4CIlCHxNsiyxAS1uFUBeZQcOxOWaCHPOGzQgHRyaqtqJt/TqQql2If7QOTavfBRLhGwxDL2YxvMKEHmZi7JPvtDsLe+Vl/+jS5T1/ezP6/f5X8A4ZUKT406e0u56EDexD1N2+/WVSGThsht9DbBU+4jtqIuJYdTUm6Oi6iLZgY30c63a0QA2FUWyL4UKpCRfseBeFe8rgbt0xFSR4O2ShWoG7EsgCYPNTkfXOB7QpAiJ2BapDQdzUYZoG+PkhhESiqlrCMoOw85XV9wR0P/98mKUnI/viMXCdeBKETl09duKrIhA3wIUAL9PF47j7shIWBXdrKDRb0FeO49QuaTizTw90dbvuxmcsYRYRPhBPztgX1RY1xIypQUr9qah3HEVmS2iF0RgIo3VXJQ3E8o9VBY1GS4y6uvVaw741Rv3eZSTcskwyYin/2/M7Idc5jITqiAXHkd275uTu34OLHRpmnlKEiQP8+MmQrji/KLs+1y6PooDfZugQ9zaNxNqtbrJ2LVyBraOTaHgyqn4yHtrr9QaDI6UDe2Yl1zBx+ubLiGzfhCQ1QTp3u9zwZw1WZddSnpcYWqmpNS2Kf/QuQvMeR/SfT0L/4COYbdE1sMeBdNTz8RZLNMykyeBMde1GtM5bhD33PoI9856AsWMbHLEApHBdrtxSg4sG9sJfJv4Y0674EU6S7OihEWSyahwq188URFAhiEh9PtTX12Pjxo1g0QvuimX/RQKMeWE0Gh0dDoent7W1LQsEApVNTU2UnRPK/7zYgQMH6P79+2ltbW3K+DrfxyZFKc/Hv7fOy/HykUhkPJsA4ROEhz6b/4tdObypr7jFPhv9DoejkveB9WUWfwqC96s95Vx4XzkXxqBl3759Lez/uMOYcC6cWWNjI+X5eVlW13TO99viwvvFfJjMbDrv25HGfePHePoVkR237O1jkKfcP+YP93cyX+9o3EeehzfccZ1v/zeMt8158rZ4yn3gvvJxwscGvx74uedjhI8FNk5S186RKT/Gx0nHa6h9rLD6UueJt/FtGu8r8+WY54GfE3ZsOje+brPZAuz/5bJvyl/O+si6uX+cP2//i+w/vfba6+cpty9q57tynPvKzk3q+uHsCCFf6p6tI2POl3PjKa9DEIQWXu93pY8d/eB+dvT966zzPvL6uPH1ju181XXOrqMvR253PPZV13ld3NrL8fUv4y/vV3uZbzv93onnbELqs9DEjYupo6KRcpe8vLzhZ88e9OPrkDty1EJHt/x+istVzkGzW16FidsIX/8sYyeQiRwT7GLj9UNRFLhMCX5NQJEvCxddOBaPLJyPaQ/dgxE/OgeaT5jTqIVmBNVPfvyMXejs9prXnlWjx2JMP9ehubEGgmzgQN0+HDiwH4bGom5IP/SBwC5uRaeCKrlz8rqedf7y4km/QI8JkyD0OuEOZDovJ6JZpcBQeK3ftHFfjtVGBI4CB0KF4oayceaCpxT9H/9E22vLRtLm/SsiNHKYsGd1+A27DUKmH3pWGgJ+J4I5aTBys0Ek52oXUeZnwrXYwR+11p2p6HUC4siI7KkJe7OXt7o8AWL3VXX0wwsbk7Fx/7EmTTrm67jehZCVHbePtd5MY6VBSgtZvanHjiMH+1K5N7Zs0QeteGBNA15ujaJyRzXMp96A/89z4H7g38CcJ2GWb4emK+4I7HlsQsfPzn2E+OxVJFeZ4j+/P1ovLUXjpafC/NHpyLn8bBg57ru5kG2mammSkNREAGOliJ70seknllb0/9nPUXDJpXAW9hzF6+L+8mg4EErl7eSQbz81y3PHXaf0wZzzhuK+UcPwq5P6Y7g37fw8uzKd5+9ovO6quL5qZZ2+ZVZZ9W1/Xb1r3Ozy+plv1yRagglaqB1oXtP62uslDQ8/BHXBY/lmy4HqIwV0siE6PbHnwPrmd98pKZ/+Z+z/vztBPnof3kTisHPuYhNH9obYHHPNxqmBB+eg8bbbEZt5D/zr3sOoLm4MzXLc2MsjFPBz4mHRf3NH3VTz0WWQbp0F+x9mIfGvpxDf9XGxKgXu7dgHxA4sohvehPbIPZAW/gvmgsdA33kXrmBynByV69zEXc8nGQCqwjCKql96Ddqba6Gs+BitC19AeH91cQsaq1vMxnkqwlMlre0GtDSMM7ZsgL28HL3qWtDpPbb+wgrgiReh/mM+dv/+T9hz+3Q03Pk35CxZjskuLyY77RjLJtNKdII8JqKVuAFTNVKuyrKc+rzQdT21bb19cwRisVgpu7Gazm/e169fT1955ZXKRx55ZNn06dOn/epXvxp97bXXFo4dOxbnn38+zjvvvJSde+65OOeccw4ZP3bRRRfh0ksvxRVXXOG/5pprRt9yyy3THnjggQUvv/zyGlZvCxcIXBDw/9S/ud4cn5rZde5nN0ZTmOhp2bVr14LVq1dPfvrpp8fPmDFj9OTJk8dPmDBhNOtr4ZgxY/y837z/7UzOPvvsFBe+3c6L82NMChnP8X/961+nzZ07dxmrc82OHTtaOHfW1pd6wuLr9I5z5+28++67LStXrpz15ptvTluxYsWCjvbWW28teOedd5atWrVqGju+7L333qONjY3067T7n5TdunVrJfeD+Vb5xhtvLOD+cmPbh/n7+uuvL2P9qeTni7djsM8rnv63jEdXW1tbl/FzuGnTphbu81NPPTXrwQcfHH3bbbf5b7jhBvz4xz8GHyP8emkfG3y93fi+UaNGpa4vdu3gJz/5CW6++WY/u/7Gz58/fxqrc9ru3bsX8PPAr1N+vf63+se58nHD22VjopKNCT5uZh15Hti54eNmGhs/09j1vuD9999vYWVYQOOb8ZT9Xx7oWDMf12vWrKlk7S870rdjbZeXl69hn0ctHev4MuvsfJc2NTUtYCyWsXH5pdo6Vvv/zX383Lz99tv8OkmdN3YO+UQfO7WH/7bO5/Wfjzk2scPP/xr+/8OLL77Ywq49vv2dZLBu3bo11dXVlPv9ef36omOVlZWU9XMZuwbXcPuy4+tY55efB1ZHZS2bdObtshPgt9vtVXz9eBivixuvl/2/Rdk5r+S+H8uXjvs++uijNezz5b/+GX+sPn/vxDONBfKRwDi0xlagrW4BDTZPpqHQiPbO8ZtpxZc5xZXXiShZ/gnE46ngx9gHmJpHpOU85dufZe2imX3wpEQ0T6EbGNJ3ECZfdyMm3/RzDCnpj665GZenOWynSTCKBKrms+hjS8e6+TpJy4wIPZm7/Yqw1SnC6FMIT1FvEJv3VnY80u4DW1ftdt9y4nbX27Kyznd260zsPToRkpM+nbBIKQFpoSA17fmPdxpMxsfrbeFxtLV1IosMl7IB7Q6y6GTHdgSY+fZE0zh1fRnib62AuuYD7H13JRIHdsMWjY/vmDeiqnnweGd7+vVH319ejx6/m4zut/wCnS+5hIln/8/dsnsl7zMvQ3yfzCraXfalpuRcnJDSVlI5bSY/1tFY/ogDjnobQkrH/V9nnT/m647Hh9tamud4WupWOqMN/xbM8PiWRGRqeUsAqxrasFNT0KjZ0BaxQWuUIDOpb9RLqK5OoD4io1XyohryvUFgSiOlhdwfQ1Y2SNnepZ3ZzXvRuCvQ9ayzoRTkLzac9qUESosMudIvy6nvaLN+qZLXu1TO6tTPkV9QZOvchchu9xGi33torBTI8vSBfrunn8uVd1KWhxR5nMTnOva4rgNKdwSTIxaVN+LlAxpea9GxtD6MpfuaUEfV1etXv4+aN98B3vkA5KVlaDmwE3EEl/A+tJsk0HC8thpta94H3bQBWPcREtu3Id7SPI9G6KcCms0e6KFIfsPH6xGt3AlU74ZUuRXSlvXoTMLIJMlD154MUpMIhJCsbQLd1wCjoRltOyuBUAg2Q2SNABFKc/dSY+puCuxVk6hpa0WoJYxobQBqc5yNI8aSXS/tfjpFsYwIzuUtlCKqCIgLBtpCrWBtwdUcRnLlB+P3PfCvMdX3P+pOsn6TtjqochTNRhMSbD1exsb1q29AX/EuMnZUIXtvNTJ27Ubn2gMYagIjbU5cmpmF09N8yGI+OUwThBm7AUa7aBZFsd0dKz2OBNgNIOXC6C9/+Qv9zW9+s4YJwmnshh1//vOfwW788cQTT+DFF18Eu0EEy4f169dj8+bNqKioSBkTN9i2bdsh27JlC/iTAh9//DHK2HlnwhDLli0DExKYNWtWqt5f//rX+OUvfzmepZV33XUXZcdT0Vh+g8Nv0I9j975yVezz2b9v3z66ZMkSescdd9Drr7++5aabbprGJgDwpz/9Cffee2/qu/gvvPDCISbspgO8v7zfnAt/uoqJYfCUs+H7uHE2nB/nyG5m8Pzzz+Oxxx7DPffcAyawwNtgTBY89NBDlNVJmeiY/pU78CUK8BureDy+4LnnnsPDDz+M+++/H3//+98Ps/vuuw9rjw6JAAAQAElEQVT8T8jx/vJjjAcYly9R+5fO8oUZ+VhgAizlB/eFTcAc5iP3q934WH3mmWfAxNN09llR+U1GO9sdb25upuxGmDLfKDtva5iVMsMf//jH1Dj55z//iaeffjo1/pmwT10PfIwcec3wMdLR+PXFzj/4tfPmm2+Cs583b16KA6+bTbyAj8nbb799zb///W/Kxhb71Gz36ptJ2f+lAT5uQqHQtGefffYzxw0/H4xH6jzNnj0bjA/7ryc0+Zvx6uha2flfsHTpUrBJv5QP3J/PM852//79R1f0BXuSyeS0nTt34tFHHz3m9fN5bX5bx9qv6fbz8+STT4J/TrFz+qUnNxjfNRs2bEh9Bj7wwAOpvvN6v60+fVG7L730EpjYB39y6AtO6Wce5p/DvM/8M4az45+JX6fPvOzf/va31P+nzDfKxpL/Mxv/GgfYuZrOJg7Az/OxPuOPZMe/Iscmk75Gi8evqHD8qvrma+KPj5qRcFly88Z5TStXlja++ea4cPnGWQhGF9BA7JiPnH5VrwRBALs5SQlnnvKbY5UayM3vitIRIzDopP53+2BU0Yqdi7QP16/C9l3L7GqctX30d2Z0d9okqbg/fJeOheviC9HpgovgHzAYktu/8Kv45Sbu+gxiS00CfNlyzHfly+Rl+dxSMj5C2FW9CNur5tEDB1ZpaCtKAv6O5VWYubZkElpTPUL1tWhrrcP+miqo4QATEcnS9ry8Pr5uKK659tzuBRmjzr7De+F5q33nnjPXPbh0MDk4mcHzdDT2H18kTXasJFDeMuGb3/FY+zrLo/rYZEL79uelzI/P7T8NBv1mMLpI/2D9TGPJyyP1F5/P195fVSqHgzObTG3mDi2GXXocMcUBVXcgJPhR4+6CzVk9UJ5ZhC2d++M9Nhm6tDo6/rntTaPfqGy7bWezWtmYMCbbJVohU8fSzK79RnXtObQgt6B7hmTz3OqFo8JNSL2PfDJhcKT/xH54tP3I4+3bjEPE7f7kR83a9/H+cmvfZiKyOGKaE/eHVXy8J4Q9MYJ9pojKeBJbWtvQZJq5+2pqEdhbC622EequfYhFA1BprIRPKrC63LwuwWZWUTUCva0FRFVhRhOIJ5JIGBrgQoDn4RZ1wq0x4qoDaFVMBNh61CFBcNnggFHDLqoMzpzn5Wa4HYjkeFHfOQ378jyIds2EZMuArNuX8rYrVVS8Wt028+nqCF6OObG+czG2Z/dCtKAfhE7dkbTZyng97cYnmUzRNV8+aQDCQ4sQHtITjqHFIM2tkD7YCGHpSujPvAptyVuIrXoPRrgRhp8g4GDnGDHodfvZVb0btHY/3LoKD9Fhpwkm5mPwEQ25ioheXgfyXQ7IhMAkFPyfYRjgxnwG/+xo98dKvx4BLlIbGhr4TDrlN/f8P00ukvl/snx90aJFePXVV1P/ubMoGthsNFhEDSyyBia6oGkadF1PnRuTTXLw88ONr/P97GaAf0cd7KYjVYbfnHLBwKJQqXp5/bwd3uZjjz2W+g0Mtl74zjvvrKmpqan8er37z0pzHh988AFlYqSFRfnAjfv2+OOPg/vKfeZC7u23304J5aqqKrBZfbS1tYE/UcW58K8htY9XzoMbZ8KN7+fGBGGqDOfJ6+B833rrrZRAWrx4caqtxx57LNU+257GhDafWFjDyqUmD/+z3h1divvKRdqHH36YEmksgoaO9u677+Kdd95JGRdxTKAhGAweXdE3uIeNpVLeLveFG/ejo48d1xkncJZsbI622Wz8qziHPj+Pl4v8umHnexkby5RNBtHHH388NfnBxm7qvC1cuBBcWPJx8g5jxydUtm/fDhZhQktLS+p64Nz5eOg4Nvg2N76PG+t3akzx642PsT179oDfvHMGXAzwSQI+Jnm7fKxwYc3GbWoSio0perzHSkd+fJxzznzccOYdzwFf5z5y4+vsesKuXbvAPw861vFNrnO+7PyA+8d9+CLj44t/Tn1Vn9g4A5t4xNq1aw+7br6ovW/7OD83fGxyP/hEHu8DG2+jv2z/2dgC/zzn/eaf5593TfI2vm3jY4FdtyDk2PeFX6bf7Fyfd+DAAfD+cn7t9nX6xv8f4dfP3r17wT+vvowfXzUPuxbGs88rcEHM2/oif3k+fm6/ajvfRH7hm6j0m6gzdeOdiNyg79+X2/LKy9jz2GPYy2bUml59Bfr+2nzTNMZ8E+3yOpMwEFeAmIMilAjfFtuztzD6ykpEH3se2ivvwNYaHKFr6jgWrT1088DW/RHFVY+CwrFdLrty1PBbfnNj0XmXjLIX9Pkv/TBFE/OYew8c/QNln+zn79FocLJRv++G5Or3kHx9BbSNG2CEgstkaB5+nBv7z1KhpqQophNCRg4S+blozfOBZqVBcNhARLKV5ztoKlG0FreiVBKnsyZud68M23xrw3ZXRVx2srjtwVyfkWQTpTybCczPOPyZu2kkkoqC8pTG20aaseaJNFE7NWi0Tq6jsan1VBt5eGGpVG9oK2l8+hW0PfgQmu+fjaZFL4E2hNCsUgREICl/UkJPCmixp2N9l3y82O8ELOlfgnVDhuN504O/r63BrFU1mLe6Du9uC6O2xZjFhZysOpdLqr0aEf4tWW/ESZw1hJBDEeRPaj76vZHSo368K4lQfowee3KohSaLAzQ+IoR4SQRqUStVSxppYnQc2vAkNUZqBoVgEIhMSAhsHBPogKFChQBPTh6UrFwk0rKQyCuAzeODKInQBC1DVSMF4IukKXKmB46e3UDye8Ds1gfoxOaK0n38w17lWRqZzwmXVqBmuiPeUwcj0a8Izb17IDhoAIThp0JU3LczJVNNfL7UzaIO4la6dULi1GLUjRqIfcP7Qhx9JpTs3pDC6eUNYfP2dU2q/4mP6/DQ+hY8HkzDmuJzUHXqaJjnjYF98GAkBSGjWU8eds2LzvSVnUafBXrByVDPPxE5o0oRXleO6AsvQ161Bpl1jchk0e1oxWbEGmtBJQOCXWCil0JmAksyKSgBkhJFVDYRsRmI2jXEbBoSssoi1TpU0UCC5WFzETB455mx64NdY994YIW19MN8MX6HTdSxG8Xp7D/INfymh89+s4hzKirMb9C5COQCr50EK9u+elxTXi83fiPG232eRWB/97vfgUeq+H/wbLb8GznhrM3DWPBOMR6z2OQA5e3yaBWP/t55553gAoj5wS4tPTXZy8UNz/9NGfv8SlXNhQa/qf3Xv/6FO+64A0wU8Zuf0kgkUpnKYL19KwT42GETO2tY5Hg0fxKDj1cW+QUXslwgsxvV1Fhh+b5x/3gbfDy2tbWlbuh5BHDy5MmpKCCPVLMb8kp2bNmXcuQHlqn9OvqBdcvqzn9I4Ls8HrhY5U8j8a6x/wsP6Ru+/b9u3xvxzCJNfjMeviG+ayeq3loBqYbNhrBoUXLLZjS9+xbUeHgWf9TzmzmhFJJNhNNjh1OWaj5c8iL2vP4mEqs+RODlZQjt2AY1GpqaRLKovf0k2H02pAAVlQriSFtJPFlz7XZXmRdICSgaZGHL9szHOaXRwGjEhJE02VLMxSST/bzNlNA5sqnAnqoZHzz6D+x4aiH2vvACat9cgUDF5lzRSDCFdCi3YgpCPbFln59xwSXIuuEnyLjyEpx6/c+Q0bs/RFfn6e052QeB6maRcp7yfX7iWO0UlDkSxKW+rzGzxuv6POOPvNNQy0TosYlIxG4Qgq1z0Nwy05kMjbQjqUpcNHaowIRaqCWiaGTRGb2tAVq0FcHGNoT2BWFnYtMDEQ5VhxQLMq0ZRkgmqM3IxPZefbB1+Cl40+nBe20qdgcpwpIflTHgla0NWFnZgr1RYx5crkjUa4uEsqC2s+jQ/GeuZjOBfWR+FUpeAqSAi9SOBfk2k38sfiqy86tVEmgtLi2uuNWE24/4hq6iMamvR8SQXAc88QbIwTr4tQh6sLGcxfo39OzR6H/VBGRffQ18U6Ygs2hQxO0tsClKZpnN5qmglCqqCDiKey/vcuWV6PPzXyF/6h+RMfwcOF3+wR18cSeAQQmPfbnSr2/Fib/4OUb8aRp6/Wwy6KBTbyXurIXtwpmXySXySsWfXpRzwaiF/W6/GScxUdJ5yHk1Dl/e+SSbRJqS2m0vv1eN2piCoKsLGnxF2NdlAPrd9BPkjCytEdKV1Q69ZZwr0ThVjwf4jzylxiohRO3apdet/U8Zga4F+Qh8vBY1L72EQHkZ9Eg94NIRYqi0ZBuCe/Yisn0PfG1JZJoybCwqz/QzGyWEXbgiYjJBRAHCzCKKiQQT07pgwmARZ5N1gvJPTiai2ar1+poE2HkL8CrY7HvqCRYWmZrGReoUNib5TDqPiDFhlpqg4DfkPC83Nj558o2YIAhgfh0SpXydRT/w7rvvpgQAf8SMRWYpE/Ojj6cDrJ3DWLC+t6xZs2by73//e/z2t79NPUbNOKWaZHlTafubJEkpn9u3j3fK2bdPXLS33djYmHpknos0Lu7ZOfEf73at+r6YALs+xrMIcMs//vEP/PznPwefdOJRYX6++HljkamUcObj+otrOz45eFtsPKQq4ymPCPNI71133QU+IbZ3797Rx/v6STX2HXyzXLIIfN8I8GuWP/mzYcMG/gRDi91ur2L7rM/3gydSOJh+p5M6SosNySiCoLFbfhVuIwmPGoM7GYXLVOFg0SNITA7p+iHxejw7JIMwWdKKaE0t7NCrZaJDMBOgTIikzEhApirsOmUiBvwmT5GQKKHQcwXVZmv3JQQorUAuj0pDjCpsILJb8/ajxzMVoQdCS+J7DmyJ7K+uMwOYhWQoJTCOaiUWgVa7B47mRngCbVCCIejxCONsfJo1BIVCcItO72o1r8sd+rBhkM+/CPKAITDTss7/NOOx18SoHrHHP+FyZI4kE/hRGvzMG1AuEI8s85nbIqlHJDijce3acRv+/TgiDz4G/YOPxyhNTbPs+if94cwDmjaCCaMMMcuBTqV9EenuRUMXD+KFneEu6IbOkn31cG8mTktLR6YahuBMgjLxJIlO2J2doRX2AptJQJDYYSo+mCxNMDG9m4hYp5n4IEonPl8VDv/toz11M9fuavn39jq6tjVBG5J0/Gf6zg4w39wsOeqlG8TNIsV+CTjsg4sL7WwirxYgV9uSNr8joI0XD4TX2DbsWmRbV7XGXtOyotCuBK44MRcTSgpwZZ8uuLqYpcXdkQdyoyst/XLHSScBF16I+uGnw3RmT2A3xSoOLlFE/XFRQZvdqQZyc1Wt9GRESk4Ezcy71Sk7Kw5mQxYQcAFrbURcLsi212zpeeVKXuFSmpl/e9jm3tCer2PqI/Yq0W2/HRkZg+2+zsNshv9WIhlKNBkao9tU5HaiSJejcLDx6TIldO3eAw6fHXYSzBcr146IP/Xo1OScf45o/WDlgmCwtro9Ci1s2Dsz8vjraHnkWSTfeBe+hiY42ecENeOICYlUJDmhx9nEiIFsTUKGrsDUKPhj5kG7CCopkHURIhPT1sYCqQAAEABJREFUYAqZEgLCHBdNQGFDyMGNgoltQGApO2S9jhMBp9NZxqJmlD/2uWzZMgQCAfBoWXv1XAS0r7enhJD21eOasmsxVZ/ARLQoiql1vo+LEP69Wh4944+ksgj5cY2etc/ucxb8B2BYxNs/Y8aM1GPLTBylHkfnPnEWhBDwde4fNy6UuI/4hpaObfH2CCGpx+K5KGITHnj88cexaNGilm+oeavazyAQDoens5vcBXyC5Y033gCLPvPvVae+vsDHCS9GCAEhBO3nDf+FpX0sEvJJ23ybj1H+aP3777+PO++8k4/rZWwCxvok/S+cj6/ZhFX8f5AAn6jl4pn/f8wnugghgf9BDMfssnDMvd+xnUx9holJAtThXi136YasU06D0H8w0G8g5EGD4OzXD8RmW0pM058Sph38Zx/Ybkob3R12feZqOJksNogJiQB2lou1C5ERIuwuORQKoqm+EZJom99z6MnIPPN02EedDveoM+HoUgCHzbncI9nLWTH2alJsMCMyjGq3gkOPKvvYwPMTUsNTMLUBhL6UX6zCr/ZqaloWeu9DHHj6RRx4dimiZR9P1JvaKikNHia+eKWutEx0718KW3F/CAP6Q+7TG46cPDD1zCcBPvHPC1WCuJVdOBFD9s4Rs7NPE/PzJ5le/+VJEYd995TX2dE4f0FQCgT29v/svQeAXNV1N/67r06f3dmusquyqw5IAiSaaAKMwCCacBEu4AJ2AingfDFOAvzjQPIFJzEkXyB2wI4lF7CNwSBRJIpEkQRohdCq7arsrqTtszt9Xv+fM2LESqzECkkE4307Z247995zzy3v/u5585byF4AZxRUODcil8qV61/HIHZxrvz/u5eZJyM7Petla5vUS+Xovmz1wCEBxhQOIgptOV0PI8YF9begli2P2lVeRfv41ZNa8A29fNzTPKkx6QdZJV/FMV9UaRSy6uvTSC1H6uc+h8otkgV1wGVBZeVtYVu45LRbEFeNiWECgem6pi1NLgXNqArhgQiVmTR6NgN8l0GwQvnLgCQmupCAhOWg28nixM4tfvNuL327fi1+37MWvtu7FU9va0GlklwxYuflD9QO3Acgc0EM269X2p8xbub3Kns5lysatv5M2bWx143t/d2h+Hk+KaU53Wnfdn33uWfT86leI/+Y3MNatQzQZj82q8j98xeQqfG5qDa6cUIHTK8L3VQTlh/Uy/XFfXbUQtXWznerRD9qaXegf1n6Hbd74VkbqeLbbeOyFHnfhJjOo5WJVdzilpReRVX2pID0yHxP7LajNGvR1nuRb6QZLvmP5At9zNG2p58nxQ+dkr2Ev5AMMA0oZVJDupD6fLToVkauGnFwYkfOYXxvEpVV+XDm6BFdMrMKZk6sRJguw07sH+Q1vIbvseVjPrEDfCy8gtXkD3O7W3+XWveallq+E9dzrEGu3QLR2EuC1ocAChEV9ZRMBqlDooEvAl/egmwKAQF72kFdIFgrSdCdgLCBRvOSR6wrQ2dx+om2eDFAKRq7jrAECAbfyo9p8o2YAMBg4F6uisQZaS8Aux7HLxP4jEfMMpqF4D5fOAITmZ6FOdnlDwfLxC7n4sbaenh4aFUOVePRxxd+WscX51VdfLfw+lV9qRgCj8LtMloWJ5WC3WAOHi352i21h/+HoSDyHpnGYy+F6uF4GQUWybRvUd4WXTbHM/Nts5h2hj0cD27Ztu4sOWVCcN3QAw/fuwlMT3F8sxeD+4/BwifMdSofLW+QrphfrZpeJ03nM8GP/HR0dDJwLLyvj33ym0+kjHiwXyxxxj04DrPejyzE0N/fdoSkcx/Rh8YPX60N5hwoX+blslp9pKL7jHcf1DabjXf6Ryvu42liUgdtZ1HMx7lCXeXit53cC8O+faY4e14PiQ+v7QwtLfwgCM+D0q/5GWS+7QamfsTZ21RegLLweMpH2mc9COWX2UkkP3EN735YIcAAAcNtoAKSBioPiOP5QSnj5+oxkLbaEB5USAxAIkKvQptpRgLzkIi8ENH/lo3VnXfiDyusWIfDlxQh//vMI1E29IRgcdZkQguoChKhMB0WwMUrWtWIcPnBl00mKo0lTAJLk/dBPOpebn0+lbraSuXmHy1c4KNi7G+lXViP+298j8dTzGFj9GozeTjiGM/fQfIHKsfc0fOY6+K++DtL110CffwGCdRNbPIg0WR4LYI7bUCq0wsFAKCQ6I6p/tSKLdZAdRBAptHko4fnR9Lhp1qU1qdYSgs8i+KauUXmm53laEka1CUXTHHnzofkZcNmwZ7ouyZzP3GS0tKSMpi3Nxuadrdl9HV6vbSzscZz5SQO1SCJkWVqNpbhmMt0Po2cf/N09yPUOwOiKw0tn4apSqtvbD9LLhba2RA6s1CP6ZeqcOXdUXvMVjL/+6/GaeZ+5yY5EHgeUptqIcsa5dSHzmmlV+GxtCJfUBfGZhhAunxbGBbVRNJQIlKppqG4KMm0eNdMCg7usk8fbewfw4u4cmgdMbO+38WZ7Di83dSCeycJG5uYcjPl5L8H/Hqug30LbcwQcyeORXohCKc2cF1fMO41M/1pv9TpIj/8e3rNPId32+kInlVhCrAd9BMxpVus2DLzwFLqffRLdLzyNROM6eL37MCqs3DKrOlJz6egScVZ5UIzxy3cOzlyqaY0RWb7fVXP1XHfCNOfuTrmP/KYtg5+0ZPDL7Vmsas2T/Pb9kiO0IJAenJ/9lTT2w0JvCirR5ao/tFIPh5sCgUCb4nmmAdRlMt4sL+HFEkR9Em5Ow1touO45huNNc0V+luTlZ9pdbQ/lt228Ud2+CWcrJhaNiuBrBPhvmDEaZ9QGV4cV53En3o/czr3IbtsDe9c+OBu3wKVDAuuVFej/3W+QfGklsGMHfOkcFMejfhdwaQ4LIkkICIrToEDYFG+5oAFJB2QULzx4cKgpTBRPIUEhiiYgDSJRIBCY5lTm8jByHS8N0LiLtba2PsDgq7GxsWBh5Rt3sXxKL3iFELS+7ie++TMJIQ5K4zgmIUSBt5BIX0K8HxZiv18IcQCMC7Hfz3lBF9fJm32Wg/0UBfYz5fN58Ik8v/SHwAuDxwc4/VhJ0AErl0EW+BhbEbl8ButcPxPLY9N6w36Wg4n9nIflLhKVU2g7u5zGxP7DEacPRUV+TuO6uP5DqRhPhwggCyj40VySufAIPucboROngXg8voZfjMS/f+/t7T1wwMI1ct/x2BhM3HfFNE4vjhd2OXxoGocPR8x/JOIyOS+PD5aB/ZZlFZ4mYTeZTBYA/5o1a0AHLh+4pzH/CB2bBo7UPx81jfu1mPdw0hXTi+7gPMW4o3EPV8+xxh8qw+DyDk07UWGuk8tm90QT1zNUXwxVL/My0UFu4UWH/Lb9gYGBEQD9nrKk99xPvEOdaArejJePOSM07xJRfvUXbqj53A0N5RdeIuTyqhu0YLAxrOtNxPeBjT3FmUdqIG2E6l03t9AS9hxLEKck0/ZageIpkOjPJS2FqitQNXECJQJqSdUdvtmnC9/8C4U8e7YQoYqlhYSj+GKAHRVRfuPmEWUrFpnJZxagf98Ks2XTQ07nrlVub+8jxbSD3QoTA91QE32IGCYqSP5MdzfMfIaAm1ufw36QVszjL43erc+eKapu+ryo+uoNovTsC4USKrlKgtYcRLBgrS3yDnZDCDWThlYfTrd0s9QM3YgJTUs5spwOaVoz52d+TiPgXEu2wDohibiuh5s4bTBFaRPpc7w2n5Wr13q77zKffhrJ//ovpH/5S9jvbqAjksyNhMumKQ7CiCCtSmqrBQ167RgC/2MhwiFYY6qhja+DHIuBAE+ZC3N+sQ6SI8194AuV/UCpGS/U8rF1ji/8JIEiU6LGg6yVIb905/hRwc6Tp4zBpEmVGD3Oj6pyF5M13HRWVRgnRSWMEhmUGRlUWjnMrgig1i+hn0B7Wi8H9LGQ1DqYbhVSAxoyaRe2aS3ybHtW3pFmCcdcOJCz5mez5lzTkcPIkHS5XDWdzFdL5BWwqtN7dlcP/OK3SP3Xz5B+/DfY/dyvYaS7D3rMnfXpyHaN5SSon3vhV0x4bgZ5g7RsZKkkICREZ8GDob9jQrQpkktzpwcDWfd3G1oT+MWbe/BCq4EVzUm8uH4Ptu/oh2nk/pnl4zqHLungWFc4obybX+SZuQvhWnWRCEyhiBZP8tISKVu1vZCwrelONvXAwIpV2PPgj9H+H/8Je8ManKwbOKfa13DaGFVU+MQNikCnqkeg+MphyxHYPh+qND/8b29Az8MPoePJ38DtbIFrD8Ai67WrEhyWSOeKDEdR4NG8tm0XOYLzhnBh+SheVwBNhiIkkI8Ah0f42N1P8CAAov3fnhBwyGsB4HXCIz95Rz7HQQM0pmL8KDQDUd5Y0/gqlMobb6bBYcehgUOpqqqCSYj9HVHkkWW5EK9pGhTqdyZJkiCEALucznFFYj6OE0Ic4CmWBbqKfq6X/UzsZxDLwIWt5bt27bqVWI/Lh8qP/eY3vymAUNaFEHTQ49KY9LwD5QuxX1biBRPrgdvD7RPi/TTOIMT+cNHPPMX2Do4T4n0+LpPTmJeJ/Ycj5mV9MPGBwo9+9CN+bHjN4fhH4o+fBpqbm+fSQQvo4KkwDrgvuHR2ed6wn10mjhNCoNj3Qgjw2Gcq9rEQ+9N5LAkhDpTJeZlAF/MKIQrlMB8Tl8npTJzOcezivYvjmd4LFsrlsd3f318Y59yGYtqIe3w0wH1e7Afui49KQojCoSFLVSxDiP1xg/uU04skhCiMDyEEilcx74e5XKYQ4sBa/N7Y+sBTk8Vyj8UVQhTuCSwTDrmE2C+DECfW5bpPZBsHN0sIUbgnchyPD3aFEOx8gLgfOJLvc/wm78cee4wPuQ7ae3L6HytJf6gND4VCS/kH7Mcif59nTOf8um7E/Z632Q9vsysJsjAryAoNeeiwHY024zICehAR2vkz//8Gua07l/X/8D5s/Zf7sOU//hWdLzy92Oveu+pQWQQ/TnvaLHjz5sA8dRqyU8eh6vyzoNVUw1KUTguSdmgeDtNECbHLpItwU0AE+O3QJoeHIkH1hETosICM030+XwuDshohlnO4WE6/Y8w3Yc2X7fwC18wddtPpM73OQH98kffuRrQv/33hcd3U22uw56XnEMj0LYy4VmfAQ0ehXALQfbKyyBtT31K54BpMvuOvUPfXtyF66YXA6NEr87RN8KC1FHiH/jIFUtOZ4M8hqWNOYyp1/4/f3lr9jyvfxD+/9BZ+sLIRP31tG/p7co9cNnkSvkF6vuGkBlw5tRxfOnMsvnTyaMyvKcVo2rAzcBNOKSQjCJm0KAkCb3IAwi19XKS0aXJr12O5d95dsmfTphVbW1rXNMdTmzqE/7Zc3g89q5uhrNRWZpqNbnwAQgIkVQdsHVrSDzjyQS2gTmgwdb3RP3kqKi+5FPJJJ6Pk3PNQceaZiE4YfxDvkQI+6E8KUZm2TLs6kyMkb2Wg2DkEHQu6lYY3nrkAABAASURBVEdPfy9S8KaDROFyaMxo/MRG3PNqOTwUOaoUs9D3XS+3736ke5dZydz0MtgP10ra/RU5fWnIkDeoOdT3t1Er3tiG0rd3Q9nZjqd/9RN097bA9dKL7ER6sS+Xq9E8aa0+apxZev5FqFl0DfI1EQKzDuRUBr7+FEIOjSopi5yeg6XlILw0fFaKyhAwJR/UWBnqL6S5MDYKowTIBCykdQu+iiiCJSVQNR9c14MkSaRzCRAAkyTIj5HrRGogmUw282On/IiYEKz4D9ZG4+3AhswlMMk3dQZszCkTYGYQEAgEUFZWhjFjxmDixImYNm0aTjnlFMyaNQuzZ88u0MyZMwvx48ePR3l5Obi/mYQQhU09l81lDkUsA8ezy8SPnLLcDPw5/liJLInNZHnv27p1a+FfaHG7uJ5Dyx0cx34GIqwLlr1IHM/5hBAHtRF0cRoTeSGE+ACxPpiEEMwybEqn0wUgx4/lplKpu4edcYTxI2mAxkrB2m+adJN5r4Riv74XPMjhNB4nHMn9y36eRzxmhBAH5pcQ4gNjQoj347gczjOYhHg/P5fJPBjiYkDHVEzipxX43zGxEaMYN+IeHw3kcjm6p7nHRNyPvA7x+iqEKJQlxP6xMJSUQohCNI8tzjt4jAzXXyjgvS+um8t5L3hcHZZHiP3ysp8L53by+OQ6Pw5iPfH6LchgxPWfSOL2cDt57lN9hfmu6+9t6A6pmNOZl/PQWg7+d4Wtra0g/62HsP5RBv+od4UShGb29ixBe7xP3de7zDfQf6vk2rCFgCFkGGSL8lwVZLaijThxU/z/1ijR+uMIrFmN8OaNMDe8iTS57kDPvEN//8ry5UsijwbPOxs1X/4Cqj93NYJnnA5RVvakCzXtwH3/LsvM75EQgqyO7wVOoEMTUfNks1qk4g9JzVtv115du9B8Z7OX7xt4iNIOAHgWQfUUU3IdeEYadi6OnNFHFIdlJKhnTOoTIwaHLJkE5JnfhdJn6NGH3NENj/pPPSuuzJkN1I7+gR2MPGhCIfsidSkzDkHUflOGHRLIzzThNuxMph5Y3d6HV1oz2Niro7lHQ3O3wDt781ixrYPqlzG7qqzp0oYKXD49jIsn+HB6VOk8Parh9FE6AvyKL7KQ+dwsyoIZjBktIxyUIds0nJpaFyZ/+Vt0/WwJmp94AmtefAUvbNiKl/akvpsSzv3QYPo8p8Mni2cDo8vhmzERyrRJ0CdMQcXkMyH7Ige1gJb+kCmrpjeqFv5581H2hRtQcs11CMw+FVos2nAQ8xECQkTjnKyqcjwS1hDzewhYaYRzSZSTomvKo3BUGRaEzvpiXgtSmQ2rLOF5MQ4PJu5PJ5/65/41z6L9t0vR/dwz1c7O5jUxaB2UP029YQJSn1B8q4WsQkpZUPrzUA0bPuFAyieQ27zh3vizy5akX1m1Ru7qXiJLylqpuhryxDqkNAd9nXtgdXQgmMlSPgLMkgVPoTFD+enUCxI8eMIHoYWglZUjNGsGyk6bArWuBAap0aYRl8hnkKH8jkF1Ug5Jlgsbx/1tERAMpsX+0PH6HinnfQ3Qzfhu/g3x3r17kc1m3084xCeE+MDGjW/8DIIvuOAC3Hjjjfjbv/3bwpt8+WVEd999N/7u7/4Of/M3f4M777zzAHGY4++55x58//vfL/DfdNNNOOuss1BVVVXoe948CTF0p9O4LkjGLsmO3bt3gyyAhbhj/aJDhPqf//zn4EME3vgyCBHig3II8X6cEOIA6NfI2h6NRlFNc2QiHR7wQcG5556LSy+9FFdeeSWuvfbaAl133XW4/vrrsWjRIlxxxRW46KKLcPbZZ4P5OV9lZSX8fjpOJms3t5NpOG3jjWAmk0F3dzdbn++i/pw7nHwjPEenAeqPGB20rGHQuWvXrsK8GFwCpQ8OHuTnNCFE4emMcDhcGPPc53zIxGNg/vz5WLBgAa6++urCGOFxUiSO+8xnPoMLL7wQc+bMwdSpUzF27FgUx4sQoiCLEKIwjw6q+L2AEAK8eQddvDnnx0J30xwiKjydRtEjn+OgAdaxqtJ9le5f7Bdif58IcXQug1cuh/uKx86HicY8Qgjw2szrKK9JnF+I4dXLsjJx3mI+Chf2Jh9W90dJp7ILB65TpkzBhAkTUFdXh3HjxhX8HD7RNGrUKASDwY8i+lHnEeL9Pij2C/fXUAUV44UQ4PtQZ2cn+Emr9vb2B5if0mPs/rGS9MfacG63ku+/2dzUuLj/2efQ9dQz6H7tVWCgFx7hS1u4cIQH0Ef2BDyHwgSGON/xorSXrk542blJO7kwQW7cK7wYSxuqfMV24cuZCNoONMuGYFloUA/Fa4tAo69hyi2l5519fezcc27Sxo5pgB66R5KVNhn+9FB5jmdct+eFmGhyaUyDyzaQrNVcM2S3tCD/wip4jy1H75PPwN68+WYn3n//YF66+/Y5wUCnGF2F0rmnQDu5HjpR6SlT4Pm0OCRhIgKT8wgC0D5JelWDsk5RgvciWtPgVlTNNoPB+y1ZaZGg8OJL5k0c9lLhxnWYpge3trUvhXf3pNA24EPWqKb+HwU7H8O+fhlPtXVjX85AVFO/Vl/ma5hWpd0zKeRcNNpMNE2Rcjh/jA+n1fswZZyKmeMFLpgkY8G0KEYHpLQvZ0yzmpuReG4ZzFdeQPqN17FnYxPebGnHM7s6sMuxFmUFagA9LvuU1dqY8ib/BafBf/Ul8C+4FJFZ8yAFSm8Z3AgPSNvQ25xo5WVyw9QbIvMuuE05/czbvFGjG4QveiRr++BiDvgDfu3O2soIzmqoooOAEpw5uhRn1ZVj8ugyQEGb5ey3NCcNo1bOO9N8thNSkQt5WRq/qdR0L5OZxX7DSM5T+runO08/A+f3y5F8fgV61q1FzkzPp3EREpUiDUPvNHVls68yBt9JM+CbNQul02Zg5rzzoPb1I/Pyy0g99QTiTz+B/DtvIdu6Y166uwPZZBweWcWtvh64vX2QMjlIZCEXZDlWHAmyo9LU9cPwRWFJfrieCsu00b1vD7SQgtCEKujjKuD6gEw2AztjQDB4dt+/uQACfNHYIme/nzwjn/0aOG7fBLbuYvDJYPHDNmjFdL7xM0C86qqr8KUvfQk3EnD+2te+hpsIBFO4YfHixeL6668XBBYFbfjFNddcU3CJXzBx/Be+8AVB/GWUb/lXvvIVfPnLX8Zll11W2DTxhupwDdw/HujW8B6wTCQSYEsrtWPB4fIMN551wP/yaWBgADRHwO09XF5O5zSW1e/346STTirIf8MNNxTawm1ivRSJ2lrQT9H9+te/Dmp7IY55mL9IpMMCyOYDhZKSkgOP+nF9TEUdsH8wsUyGYWDLli3gg4XBaSP+46cBHmv79u2bS4ATBKLB/cHENXAfsFsMF/08ThRFKRysnH766YXDFJonhfnDY/+rX/0qiv3Pfh4nPEYGE8cxD7s8ZpiPwzxePve5zxVAdUNDA3g8cv1MXP9gYvl4XHMa+3m8tJJFa+TR7cFaOnY/rZHx2tpaXH755YW5TGveR3J5TZw5c2ahT7m/WDJ2mdh/KFG9GD9+fOHwhdZe0NpboOHWX+TnvHxIU1NTAyrzwUPrOV5hBvknn3wyeCzzPPjiF78IXkN5XH8cxAeX3Mbj1Z4PK4fXAZ/Ph/r6enC9fOA5VB7uX56jnMZ+nqd8b+IDO15/OP6PmaQ/1sbn8/l6Jb735iSBmD0P/xe2P/DveHfJz2G17YRkpgDCZSBcJns2VAbR7z0miGFcNNAOAOCi3yOg7OV653vZeG2xCBq08/PZ/jXJTN/v0pn+Na5rL+5BbmG/Z84q8hRdLxiBN3UW3HGTEZxyMsKTpwOV1fcUrYVFPnbDWumDhlr6uBIoe1xESh+FHmkLasHGsNCbokIwiGS2oyLP8w60aaiMcc+r5QOAPiNxt5pP3qGbmYVxmA2dcOYTkK4u5tEhp31Wvi7zThPiT76I/BMvovUXS5Bc9zq8rq6bi3zsikCgzYjGbvBOOmn56C9/EWWfvxaVi65GzWWXwwxF786r/haa3AcOA6qFWDtKiNVRn2iBAVOjNodEqLOM2l0pRCPRAV4u/1BSUdaoQlvnUkI/wdF4ArCtEhoPZfA5FZCsUvRlFLxm5LCbDi8ywuXNcqcOtIbz2Xlq69b5sfYtOFWk8PmTSrDonFIsnleKG+eU4Yszyq6vd/W6gJmv8ZJ9sLvbESJrepCsnqCDkS6ytr7e3YUWYSOhY5qIirgri047qD6rnHvqct8NVz+sXb/wemP81BotGHuYRDzwkYE+QGkMKsHlIhRbKqLlDxp+/3LfRwDOXKimS49PLAvft+jUBnxp7lR8dd4MXHP6pLVTKwLCp9jNcJ3afF/yfq+9uxk79jwitXWtUvpSjwBWjamZ03KyeU5GMea7bm6xkhhA6WubMXZHD/Qdbdj37gbk7cy9OeRiXBcqYOZVN6ZXxWb4rrsc4W9+FWOuuQanXvOFuOiII7d2Hey31iD92gvoeeVZdL/yPHpWvYgkxUfTacQcG6phwsjl4cgCwpah53T4jDAgyjEQGYO8rMPKm0i178W2Xz2Gga1NCJQGUVI/Bg5swHER8GT4iSQC3zTWCRlRdhQvjzxM5Ix8jrsG+FFfBs/86NqHFU7zvcBSWlqKc845B/feey/uuusuQSBAkCVMkAVM0MZgmAdGYNARLykpuYyA5w0EEsS3v/1tfIYsawwycISrKAe7DHj5ZU0Eoo/5ZSp0XwIDZy6XrS680SmMx0NkKcaxVSgSiWDGjBmFAwS2uD/44INl//RP/yTIui5uu+02QRtAcd111wmyMAuyQBeI2iho0yYuueQSQRZp8fnPf15w+//sz/5MkPVe/PM//7OgMvCXf/mXYKDF+maZWAyWiakY5rjBRNZmvPHGG2x5RiAQWDs4bcR/fDRA/d/A7wfgl7TZts3juEAUX6iA+4aJA+xyfzGgZavaBRdcgG9961v4x3/8R9BYEeQW+pz7nkCx4EMlAi6CrM/i4osvPogIiAkCyYLAhbj55pvFHXfcIe65557CePnXf/3Xpd/73vcK1urJkydD1/WCTFw/y1Ek2veAicMsF8vPT568/fbboPFfz/EjdOwaoP6+jEDhcloT4tTP+OEPf/iR6O///u9B6wcqKioK/cmSHdqnHFcktqLOnTsX9913H2hM4P7778cPfvCDYdf9b//2bwXef/mXf8Htt9/Oa9s94XD47mL5x9tlec8880z89V//teB7CbkN7PL6+XEQr710yCGOd7uGKq+4PpA+cd555xV+0sRz8Uj9yeVwPqa33noLjY2N6OvrW0Z5PhKW4PI+DSR9GhpxpDYwqOv2rHlM/XZmId3Ya5lfzuRvyba1wmpqQnR3G6rJeqW17oa3rw0im4TkmRCEwARygGtAlrzCY06cdxikFXlogJkFfzazEMn+FcimfuflE4UbRIDi8hvXo+PZ36N/7WsIpBM3+bLZBTCc8neVAAAQAElEQVTMCwt5Bn3JE+pv8P/532DM3/wjxn/nblQsuPZJOVp12AUlKt4HyQdkGFTecL0EfEP7PG9eO5zFh8uTJYu5bmXLAnlb8+/adZd/1467An09S/xwUrqdnUmgtfNA3pykyYY7DWzpy+ShWhYUuw+uF4cjJeF53aEib8LzYmkEkfNV/MBtmHVn4PyFS32nXXSPHR53kYnoiy6CzUXewS5Ncg06mYsHRw7Dz3oSorLRcQKdkh6E7A8ACq1pQiCVt9FHIDfh98ENRGEqKshEXVsBmCX5fEtu49t3df7o39H6D3+L1KMP4cx4D25SrHuuC4s7G4JuZ9JLPJaMJOfaQf3xcOVo1NRNQbdcgq0VNdhUXYHWKNWlyTCpLkOgMEZteH1ZT69NaOGW/kB0ba/fb3bpuKXD86bzW6uLTWL9Eh1yMKDHue+KPMNxib+63zAWqrlcQ42EBybAXTo3Jh6cVS6uGlOOc7mMOhG5KpyXNve93XT7mv/vB1j313+PTf/4AHpefmO+4zr1GS3Q2aWGanZL4ZtbEV2clstQWjUeihZCMFSC0aNHwyfsVjVvNtjJ/huNdN/9jrBrCWwvzoyrvsU6+4zrlXPOvR6+0pvKR41BOOyDYsYRyOxD4q2X0fPMkxh48hm4q99EtGMApYYHvybBDglkghqE8CFgRxC0ywG5GvtKqmn8qFAkG3468IjaHvqb29C3thHpDVuQH8hCoTGoWw58DqBCgmPb4BsKjSMajx44TEZGbv4InQAN0IYZ27dvB7tCCOpDMWQt3B9CCGiaBtoUgoFuWVnZGUMyH2Ukv0ODs4wbN27tZWR9Li8vP8jaKsT7MrEcrusyO3icMOin+wrIEohUKnVrIeEjfBH4XsKPrvPjcVQOTNNEsZ6himPgHIvFwNYZfknXDTfcEJ8+fbqgKz4U/9HGVVdXM8C+jQ8o5s2bB5/PBwY7XC8fLrA7VJksd0tLC8g6MVTySNxx0ABZge5qor1Lf39/YYzwOGEqFl0co9xfHMdzZtKkSYWfKPzDP/wDWwJvI+vg+4OamY6RotHoDbNmzbqNgTkDJn6km+ZVYcwUi6axWfCyrDx3isTtaGtrK6SNfB0fDQTo4KqkpOQyWiPLqqqqxKhRoz4qgR/r58M87jceW0yHk5LXQl4D6CDzDLrfiyINt37m57WH+WtqagQBvcPucw8nw9HEc1uYinlonRv24Wsxzx+Sy33IazPPT14TeI3gtZzdQ9vBvDxH+YCL1hzQPQrr168HvyGfeamcBaS7GPv/2Ej6tDdYRq4GbmaBZcZ/p5GdiRaUwgotuSIdkP0I+8MoKY0hFA7Dos2KX5JAW3AIskDBc+EJj3J54K1SceH/cJ31gBaQAgBiXrOrc1PzL3/x0Nv/8QDe+q//nNX87PJmO5VaZDy9apHz499B/Ogp5H/6DMSrTfX+7uyNYUNs5nyDKRmJLDcbJt1k1E++xx479iKlqvyqwelFv5fIF4B5MXwsLoNX1ckskpzEjaqTWtDqZR/Y5xmL+UBicLku/KbUl1hvrVqzqvWBR9H8/QfR+uBPkFq+ujXQn1/kpdPVRX62Jgt/+Hux009F+cKLIX/mDIy/4UqUzjsJ9qggyNx6R5GXDwAkKGujCK5WCEDLVtUtSqT8Xr8/tLKMrMn8MjIMcZlIN+QDZs0QScOKsiHHysuDqKuWEBatCCktkPyt8GL9CI1ScHrVeIzW/Yh60nIhhOlL2DcnXlwDtXk3Iq3tCLz9DsrXvYuSZObSmFpyXywfu6zMKr8qKqLLLd2/fODUU9B+89ex+vJrsHrKXOwoHQ9/pBJn1o7GOFVF2MQ6FjQgYm0hEb0zY/vmvNUWf2Tpqm2/e+T55rtWbuvZ1GPn+5jH6/ZC7B5KrLsPAupDuT4QrpHJEqsauQV6b8eysenuaaOd7KPlunhSUDuZm9y0nNi9KrTnDdS1rsWoresQePdNeHTwlM5aS1qhPvLfzd3f/buVu+Z+b1kX/n1rBPEbbwS+cxuC37wR5efNg5ZMzd/2o5+sWHf3fY9seOChW/euXvmAmhv4riy7cPzaZhEueRyBspXuzFMQPH8uKs85GaOmj0V1SEN1JofqeBaxlAvXlODJOtSKGErmTMeYr18HadpouD4B18rT4YaBuG4j58/BkpKAnUEZze5ACjDaU8h2pAjI69AkAtfwIHsOQWePfNzS98l73zviOwEaoLUSu3fvLoBnuhEfsQa+wdNmEFOmTOHHlFvo5n7c1juuOBAI3EAAuvBbTtq0FYA818ly0dhnlg8QxzOA7unpYTC94AMMw4xobW1dzP+qizcp1C4wHa5erpPTTjvttMIjhvX19YVN8jCrGjYb6eBB2mDdNnv27MJvAblOJt5M8abq0IJYLo7ngwR+ouDQ9KHCI3FHrwEeI/xbZz5k4f44Ugm6roMsW4XftPPv36urq8/gfj1Sno+axuUy6OEnIb72ta+BADpYPp5DXCaPD3YPpUwmA54/NI9uODRtJPy/qwECVi18WDZcKbi/mfx+f/Nw84zwfXwa4PsKzTPwwRY/IXLKKacU7jU8N3mesjuUNNynnJf/o8JLL73Eh6MLyGrPe+Djclg7VJ2f5DjpkyzcscrGL9PS06kbA33x7wb74jE1Y86nAVAAG5KsrNUqRsN/3oXQLrqI3HMx9rJLoY8eC6H6IGjHLGgb7QjAJi155A5fHl1zyUrI/HY8vdhs7ZiefmUVcqteQv8rL2Dvqy/B2rfnMWfLVmhNzfBt2wVs2QF31x7IqTxZuZUCwOf8RTIAMxUMbsiUhB5KBX1ri/EfcFXX/EDcR4zQDSOmG/lZocTAjaG+nkWSk10gwTlwykSWyhDpU3PtfIOTHEDm3Xdhrd8Id816OOsaYW3dRla9/Cw6etYGi5BUpVZ90qS20GXzodywEKWfJdAzaRay4bLlOUmaNpiXAaAg4FagSpFmd3D6UP48VMNQ1IPqHIrvcHGKi83j/cBstQ+nxNfilH0rcUruHZwSjePM8T58cXwJJvrVNsJhy7kMyURIhR+mrCIny3CFgojrh2zQwCEGLRhstLXAavLCDmur3THVjzpnn4nShQtRO/98zDrtJFw8pRZXj6vABF15sMyHAi/z+4SvZWd7Yu6qLV1YtrUHT23rx5Pb9+HNnn70JLK/E6QT5jsepMJC9t1Nv4s/+dRdyV/8Ylby2admSV071/M8Gly+ID5FzsCvZKFIafgDgOqXQWMU3Rm7fu3OHqzelcSLbTae6ZSxdsZcDHzmEqjnngW5pgoDu1pgvP46pJUvQxDlX1oFaU8H1N1tDylt7ZvyyeTtPUDIjZU/agXDyNsePNOBsDwEyyoRmTwF6rQZSFWPxUCoBHZVJYInTUR03iRYJ4WRrsoj5+uB0DpRVp5CZKIMpVrAlfLw0YT2ZVXIaRXIqTTPdbjUOEciazORC4dCI5+PUwO5XA7t7e0w6fCS1pPCZnuo+iVJKqSxVXjs2LGIxWINtKk7/Fo4VCEfEsdWh5KSksLjbGRJK4DnYhZaew4KD47nTcXAwAC/WOUjg2e2Or/55ptcRqForo/1UQgM8aWqKnjzM2fOHPAmZgiW4xIVDocfZCsFW59YJm4r0+FkY/DMlkQ+FCFQ9JH1cVyE/3gK+dhrYfDM44V1PFTl3E88X5i4n8iCV3jB1+jRo+n8+sQ/Sh+JRBr49/JkfaTbv3SAWK6h5OW539fXh5aWlrvoQODuoXhG4kY0MKKBY9cArwe8RtO9E9OnT8fFF19cuK9yfLH0w81T5uFDLrY+E4BeFo/HmynuACYo5v9jcKVPYyPZYlpoV791s7e99Wb7jQ3w3thE4G77rcaejhRbZ3M+0WRW190kXXoZxHXXwH/9tZh0401AXT1sndAAZCpCpg23RIQCUcQwP04oJERngTlj3ex2xhFs34uKvh6Ee/bBbtsBq6cTSokK37hSBCaWIzCuDILC8AGEEvowxJWBuZCjdeADL+LieCa6Mx4A3mwhJoA7iwa3xmlHQ2wt1s3UQtG651bnrXfhvvY2xNaW+kB/4u5SoHDSxMA2DrPB9exptmzRIYOJaERDBVFpWIEelmBreWQ1Y9bgulVEQm5JyVwxdcYM5ZILr5cmnT3DCNVdZCK22nX9bR7/Ptw78m+sB5d3qD8CvS0H3379H5o4RDhn9c7PWQPzi0mVmmgcnejDzD3v4jPbXsSVG57CdbvX4vPU7C+MCeDaUd4to335G0LIxQrAUtceLzn1dDinzkJmziy4Z86B3jAZsk9b6nn7LcMGjaw+z5juQ7omoFqry0ojK88/fba56MyZ+MrpDVg8pRrza7QZ4zT5Nlq4zKIs7Da1xbFuTwKb8gJboWIVAee1vf1ozRmF8cA8wyHalNzKdDjegJmell71Krp//D9I/uhR7H3s58i2bYJlJO6ldhwYQ1449jjqpkKcOhfOnNMQOGcuApMmAKpsuqkMnK5uaASIFNlFP53lNCklGCitjksV5Q22LCGR6EKpncJ4g6i3D9GWNhhvvAP3hZfgvPwyMk2b77dSyUY7Zd6Ya08itbUb+Z396E9YcKdOgXblpRDXfhb2hRcgf/JMePUNEKPLkAgkMDDZRWa6Bbc+jdDoOKaO6iertQ/BSRHIUQWe5UCzdPjcMJ19ROAKH0ityCs2DIXGsHAOp56R+BOkAX5cm9/ObNs2aJwV6NCqaE4UgCunM7gtKysrsDDYLXiO45emaXGytiIcDh+o88OKZ7kYyDCo/DDew6XzpoR/+81lFNvLLpd9aB6OY/kYnIwaNUocmn68wlRPYWNUX19feHRTogMMlu9w5RM/OJ0PRJjIv+BwvCPxH00DNM7mFucMg+ihSuFxQxbDwvjleVVaWlo4aBmKd3/c8f3WdT1eUVEBAtFQ6ZCHxw1v1g9XC40TDAwM4HU6VKUN+V00jmKH4x2JH9HAiAY+ugZ4beD5xgCa34Fw1llngeZroUCOZw/zsDsUMQ8/KfbTn/4UdM+q5/VoKL5Pe5z0aWsggcXqJKzFhXa17bu383crsOH//hfeuu8/8fa//xid6zcgbWceSpNleI8v3JArL39UPnXWPf4Lzr9MHz/hMsNfCksKwIVO5CPQrICOTQEBkDEaw7kMyAVwSzcATXKVTp/qR5lpoTSTRpllosqnIxgNQL/iTMhfuwj6Ny9C5TcXQFswC2J8ybkiFOrEIVcFhcNuqrYCGfAjuejPVXt9xnSKPvChtofSBDw5IuF59QPAwjRwYdJALccdLTn7eu/veOo5bLrv37D57/8VW37wCFJrm2PoMRd4Ca9wczMhT7NUL6TWRFtin5mD0llj4Z9RDf+ZDYhePBvZoIUuYS9p9Yzvsj5YhoAQbSER6nQcOQV/bDkyWkjO+zoVaC9qnrIaaWMeMol5Xj5Rn/cS9b1eZmGvZ87l3633ern5cS83L+Hl67u9/cCUyxxMNPHNGiGamDfhZecyL1MvYFNwVQAAEABJREFU+Xspf79nzhrMn0fmh4acuj1NuuN2eXGvVpAFvfzZ5bjkrdVYvP4NfKPxbdza1YOvSKHwGE1+WHjd/zCAnqYeeHcoVfpS/1mnXlT9599E3X3fQ82ff71TPblaoCq9PIXUrA7Pm14pRGPY7b1Qze9Yr3t77i1TrR80qHLduY6YfZGtXDTbxIwyoTclvMwClqMo3z7Pm7cPMvZpfsRLS2CNqkCX34cOYuj3HAYaWtZLzKXgQR8G9fvJ47EYSyYHHtu5o+WBHS0tD/T19hKWP4i9EJD7B5You9oR2bUXVV398O/YBXegExk7dXMXUrfHPa8wjqSSMdcHZl1bVvvXP7hp/Pf/FVXfvi0dOG32owHYnaPNFGr7dqEuvhkTzB2YHEpiks9PZmRlJVzdlGPR+6pPm4xgbQSa30KJD5hQVo3uR3+Fff/x79j54//Exsd/jnjzlmqjeR/8HTbK01HEchHkpRDcuadB/+KVDwe+es0ddX9xK+pu+TZKL7gA2ZCOxvZGdNakoFwYRPlVFag6L4zxlX0oqbEQqY+gZEIFLNuBTwlD8YKkOx8Uf5gOeBTkdQFT8+DKBVWMfH2MGuDNPVuevCP8sJzTHMeBpmnw+/0Fl0U8UTfuUgIbPp8PvOnneo5EtN4UknlTwXIWAkf5RYdad7Plrauri8YljcP3flN9uPq5TgYnLOdRVnVU7FRPnHU8YcKEB8eNG1cAxlwAy8XE/kOJdUD5Ck8SWJa14ND0kfCxaYDmwWJ+JJ7HC88b1vWhJXIcg1WeW5wWDAZRPHDi8Ikmqj8ejUbPIIKu64UxzfJwvTw+2D2UaJyBf7ZAG3Ikk8kHaE7ceijPEcMjiSMaGNHAsDXA843WZwQCAfC9hA+5aN6Cidd2djHExYdy/f39WLFiBbq7u3luF7DAEKyf6ijp09Y6AimdY4X2ILerc/cGWHvXonagCbO6tmDi+jUIvbMBckfXfOZrEOLOkkjkJrW07G4RjC1XlNhyH1SCKg5cGHCFAdCGDa4HUwjkhtDWfitpIhb3srV9BJIYYPhElN8CTVmEacW0e6RptZC++SfIf+nbkIlKF9+EdG39anPMrDsCp1+3vPySm+Mlp1/1qFJ2shBq5WqW/VASQqQ1yWvKvJcgYoE2UaY3vRcsONSmNINSDkSFaJkgxINEP4j6xAdegGBms3O9fL6eeYvUT6Cy0zMW9nkEyoPBeL63C2JPOyo6OzGBJktnTyuSVg8gJ+dCzYU4X41QHq8QkR8Eg+Ma5HGzr/J9+//Af/c/QvrSN2HWTLlT94+bXSZpdXVCv4/aYHKeItGkbaO4tKgWa8Nh0VQtxFq/LK9OhmIr6XRhtfBFW3yky3IRfLJcaGsjyHZELDNdmvNao8LXwu0tlkU35BAtBrXF8H7XJRn9zcwbIWt0JKlA37huRc/vf7R+y7Ife/07myibFwukq7+npMtWZi15QXvAvfGX3dtbf76vG6szfnRodWgNRLBDttGGNOJ68neG0Tfd55TdE7QqLgog+gDXpZb4V8qRiQ16aMqMYGh8DccBejwMr6mGgDyHNXn0g3nfpAZbq7vMQKSZlKFppVqjKFdXZmJaX6dnzVeATp+Tme85u283nT03CzjVpeUBRIK0kc8CIqVgZiaCaXIpwoEwqDdqLeh9SS85b8BLLeqzs4syGW9WLhcJMaXM7IJ0f0tf92P3L9J/+JcovffbUP79bs3t3Mlt10CX5yViCafjgVxYSmsnRaFND8KKBuBNW4hU9Ty4+qh7yg1vQ7g/tThhmnONlDedJokmyiKPBiqr6uTS0jMk3TS9PW/V5v/tO7jtt4/g3hW/wPe6X8GfzMniUi0BWUtruzXz7h6SW7dOeTR67d9Buvc/kfnb/wN77jTUmDnUpPtQGd+G0rd/i+w//Rm6/um7SL67Dta4scjMnosJp54Jdf16dP7D927u/P5t92eX/Sfc5t+RZXoZ4iuWIfhfr6P2Z7sR2eTBlgNIj/bQVp1EnoCImlehSCqciIZUIA1+rNuVOoFcJ0J5FyWpMIKZEsi2DkGnZKpDvWcDGrn8/gP+6YahCdiqBCFAzRcQGLmOVQM0CGMMOmVZhhDiAB2uXAYDKlmyGNgyTyBw/B9BJYC+NBwOF2ThOlg2dllOdnljMZg4jtPYGkjt4eBRE7VpCdfD5XBmLof9TBw+lDh98uTJhf+xe2ja8Q6zjgWtzSQjWO/k5w1ToRr2H0qsG0VRDuivwDjyddw0kMlkbuVHtg2D9iiuO2S5PG44vZjIB06xWOwD+4Bi+olwedyMGTMGVVVVhbFAoL9wGMXj49D6eDzz/OHDI5Zd1/W7Q6HQ0kP5Pu3hT0P7uC+ZPg1t+bS1gfulSNw2utehvr4et99+O0aPHl2YpxzPPOwORTyPGXTz+vL8889j9+7dS4bi+7THSZ/mBpq0C864FnKuCVkWgG3Bc214Hu2KD9NwCcRHFhAPLpiIGeQpbKgp5QO5DDghwNAChjVddHZtMjY0tfatXOHFN2300vGeVVpIa0YsdL3/rDNRcvnVKLv4asRmnIlIJHZZIFD6A72k5jK9vLZMKam+6QOFHxKhIPh4ERwfkjSsIE2IUK6nZ03f66u9Pb/++Zq9j/1Pc3L1CsL/+1/oJUFt1aA16tD6aENkSuEgRHkJzFgEyZCG0nGj4I9RczU0wyWl4uBLCZY+qdU1CF/9dBEcNVGE9Nh9QRFsjIpo/GDOw4eiQsSZuP5DuXQg7nlSOuc/OIXbZRjZeaB4akw1hdnaqgVNO8RlFbjjZoPU2b1m4PfLkf/NU0j/7hnsWf4CjN7MnXqp/qSj+F9NCHXBNoH7n2lN4vl8GV6vnIvXJ1yMNydchBdrTsfT0mis7pfma5pI+dXQyqgWWBsqPp5PldDGskXXw03kLXwEtZupEHjvKyACbayTSjrciJEF/r1ocDmRnNLMabKjbICnb1ad4DoZ8vJ5FaW4ri6Gq8b4cGGViQUNYZwxKoixkrtS69jXnFm7rtnctHmV1N37mOqJzqTqzNyczrW+2BpvXbmx+3dvbdyLTW9tQba5DWJHO4ytu0iTOaA/P7dQf04NKZLUpLrRO8NnnIXgNz4P5U+/guqrrke4ZiJ8ivakLLIhWUnMsmDPyatGbUK2p3fb9oIev9+EFmp2aN44yQyB3a0Yva8H0/f24LT+JM7UNVQlexHN9c8PIGdqqlhtBsIP29MabrLOOq3JPuNU4KSpyM86CQPjpwJaJcZ05TH2nSbI25tg+zxI55wOfdHn4Y2dhO69Xdj71hoMNL6OxNpXYO3eimzrbmS2tCOwfQD+TWmgKQOn3YNiRBBGGdxeAwM7exBv76e5LODQ3HYlWgOECc8xIRFYFmRyZoInFVTC3xzPJKhtQpEgKTI8Wkdc4qDxSd8jn+OlgeHqk2/cNL8xXP6PIh+BxAfGjh1b+P+oX/nKV/DVr34V7N54440H/BweTFdffXXhsVhaA5Z/lDo5D7fLHQSGOMzEaUMRb3bKysqGSjrucQxkNE0Dg+Ii+BlKNk4rHgJwW4gOOqA97oL9ERbIIJOts7bNexmPtii0gB2iB+6bIhGIRSQS4YOPj/1lXDw+o9FoQToaC0PKyoksK7eHLVrsEniO0xyPc9oI/UFpYETYT7gGeK4VieYYP5FyD/+HCX4vAq/xvH4fqQnFvAygn376aWzevBnpdHr/075HyvgpS+M94qesSe83Jzi6FvL4yciOnYhEzVjYU6dCqhsDRANIeN7wHzWge5PselB51/x+8Xwj0HJQwhSVVvv6lklvboD766eAJY/CePoJeNub5lm5vpstnxKXxoy+ITBlxrnRCbPKgqNH0ZgVtMunnEfxYeB1FOwfZM0OzPe6Wuf2PP8U4k/+EqnfLIWx+mUgY93hJZPzogRcGdCF3gOEanVVOnj6bPguvRC45Fw0nH8eSul0CrqyDkFCHR+s4YTGMBA1aQNnQCnr9rx6QtK1KSO1KNe3r9Xct3OZ2NPaaiRTS7JOdn6/bc/V8vkGmugF66ol2+c4qV6k33qXrJfN0N7ejtSb70BkjRsLQvvRbAlZ22kJbOpV0SSPx/qxZ+PFyRfjlUmX4dlxF+AptR4v9WkwoXKfF7Idz69AQLRxeUIvI+RYvVJopY0EstOzfMHZ14wpxU1TQ1g82cH8aTqmxWyUde+aj1dWwPntr5F/6hm472yDaqA2IUkLX+iI45dbe/DYxn4sb0rj3VQE3YFa5GITYUXGwhMBQMj7x6Df3xkUVQ/7wqUPomH2w/bl18C94XqUnz/n+opRpULJZhYZvW2PZba/ucho3vCAle5a5hCAzsmiFgAZ1gUZ0UOroZdDJrCdGz0WGDUGkVAZYn0m0m+shfHyKyHtnXduDiW6HhGBlJYvwWYnoj0oSssfRG193P3sZzFw9ReQOvMqyBWnQjNjcEJROJNqIJ3dAPWsScj6bGQTvbC6uwkQx5Fr3wM7HocVz5BrImDIUOMS3B0mzI052GSBDrdFYezKYmB3D7JdKSi2CsmWITkKCAmTHgRcAbJUe3Bkj8IeNemQjxDgPz9tAoORKORC+BCekeBH0oCgNYcBFxMXQPOV11X2Hpb4UVU+9T4swzEm+Hy+ljFjxjx41VVX4Rvf+Aa++c1vfih97nOfA79huKSk5LKPUr3jOA1EH9r2YtmkN1RXV4PqK0adcJfrlGWaO5J0xLqYj/uR28N0ROaRxKPWAI99fmSbdcy6ZjpSIQxemQIn4CmNI9XLaaWlpQiHw+Bx4LoumFhuTjuUOI2s6gVeatMIcD5UQSPhj0kDn/5qeA7yfGOX5ufdkyZNEkTgl3HyvZjjD6cFmpso8mzatAkbN25EZ2fnksPxf1rjj3wX/ANvddmUGTfUnH8pwhdehvxpZyJ0+WcROPUUSGXRe4Ds3GE3j/bTCgFnlQB0MQ8Dt73g3xSr5wCBkLmzFbnnV8D++VLEnn4cWQKm2bffgNkffyApYWbCF9msRiKrRVQUbgpefP/vR4vlHYvLBwEEJquPVAZbZJFP3+r07UHirVcRbm1GpGULtJ3NBJ7Tt8PAnEPzq1W14fILL7xo4p/esrz+O3+BSZdc8oPI6OozoFrNDGQP5f84wjlorRZV5MKuk+x8g9TX/Zi5ZVOs/6VV6F+5Gs7u9vkwjAUWzPm0E602jGQtLQRaWvXqvIAHXySEsC+CqC+MSDAAQlNmyjCmR4C0z3NbzDx1NqJI+mqws2wC3qo9Ca/VzsS6mulo9Fdja15Bb175boIOXzzPC3mZ/lleNl5LIh3xQ7wFEH8kJq/bC3E682aAGLkhjgtYaJ48OiAWNIRqFk7Slk+rwOqo0wOr6XUkl/43/E89hewvn0D61bdovOWXdNtYuGxnD57am8ZzAxKW9/uwa/Qp6Jt6JozTz4NyxjlwKspvE6VaI9dHiyGBX/YBcaWks9s3dnU6MvoeUak/zrFud9d306+9gb4fL7UFvBIAABAASURBVEXup0sgNr6DoJGdVQvpUQL3hTIUf2ypXtOAMVcvQubS82EuPB+Y2YDMzl3Y85NfYvc//z/E/+cxSBvfqdYGOlcp6d7fKZbTIMvBR61obUPN5dcK95vf7mz96rfx9pnXYl3ZHOyZciqMmXXAhDxMZy088y2U2e2oMTOIZEyougdJtiCEA0XICEgagrYfaq8MY1MG8Re7kF1nIrUjBSdlICip8Ll+6nKVwLMMeDJcCNgSg2caUZILBtLc5sEkKMCbv1BFBUoqK+GXZAiOpPiRz7FrQCZApigK6fTIShVCFHjolBuJROLYKz5CCbShuO3kk08Wc+fOFXPmzBFnn322OPPMM4ekM844Q8yaNUuMGjVKHKHIIybRRmYBj7EjMg1KFEIUwDODomz2KO5lg8o4Gi9ZO+vJIo9YLIYKmge8yWJiy+JgKiWwxDJxmkYHnUJ8ZJUcjXh/VLx8eNTb20u3Nw88d4Q4vI6FEIUDFu6T/w0l8XgIhUIFQMzjm8Z5Qe5DZRFCFOJpnBXm+KHpI+ERDYxo4Cg0cARW2lcWUgfPRb6HnHPOOaivrz9wwCWEGHIuCiEK607xnv3OO++ACXRR2TFy/ig+tG389LZThCqWRk+Ze8uEr3yzZcJf/BUqPnuFqdXV3uPpUpMHKzTclrOSJM+DcJwDWdhCO0aIx3XgVQLi6WyiD1amG4qcgReQYWXTyPUlYaYtuFLw2TxQOxjgiphoO1DYMD2Uf0iZZUAjOQ4AoMMWp6srlVgpSqdMRToYQSZcCresHIjoj0LTnhwqn/CXrBSxsZehukGHT3scalmjEJVp5k176Wp2j5WoXdVEszo9b263Z/LbwUOel6jnF4aRW5iMfFhBPCECa+lKoTVWC3VlOJeZk1/3JvofXQrv33+C7D8/BGsZGUDb+m6tUoN3u0FtaVbXatrg3pgNKH36+NE3VXz5ejifWwhcfwVqv3wdnHL9NlXLG47Zt6DcHIidLpuYJOURcdOwRA6ZEhm9ERuGPwufz4Cie2jMeou7becRArghQmytkOzpRTkPpwvq7IX88i9aXLTD8YhKkfa87pBj9ixU8x232enuOziOid9+nnVzCy3Ycx3PnOe6DuxcHtm+Pqi6DqHIBeBnk1Uo6QmYPh1mJIREaRRtVRXonz0LZV+9AXV/+g2ErpifHijxt3SSvouyJLzs3BbHul9SlOYqW/+zWDLwuJkw51pWcp65owXS79di1G82ouynK6CsWg9vb+etSKcbvMT7T3B4JdWzyy9e8GTNt7+G0q8tQo6sxlvWvY6S3V2oae9BZP1mOL95DskfPwH7yZXV+pZdt4eTVjUfXLAcm7py1Y/EPfyf2ATcd8412Lngc/DGlcDrfQ7mjv+LWMVrqJqRRsWpJSibOwpjzqxCYIKMIJF/goa4MJGn/hGkD1kE4aYUpHdmINHMUCUZruXBNmkOE1oW/Ji2J8GjG4EjaDUg4GxLHoU9FuUg4hje+HW1tKBj505kCz/94NiD2EYCH1EDfBMeDtDyaA1mYuDALyr5iNX9wWcTQoBP/hkQkTVxKemED9piOIGXj6zxdICAv//7v8e9996Lf/zHf8Q//dM/4Z//+Z8PIo77h3/4B3z/+98HHTyAgNMZJ1CsP8qiGWCy5ZnXJCEOv8EVQtBtXQOPk2Aw+L+iq0gkwmOgULcQYsjNOCfSGAZv5vlggMMjNKKBEQ2cWA3wnCvW4Pf7my+66KLCv67iezHfX4ppQ7mcl5+AsW0br732GlauXIm9e/ce103RUPV+kuKkT5IwJ0IWraTkYa2mskGbMEootTW6HK24W5KVRhVqy3Dr4xEh4EGyDORb27z0W+u99MYmL9Pe4UXTRj1yoVigtgbW5Cq0jg3g3fIo+ifWA6PGwxeIoUaIpiiwWgdMGnRDAuDhyCKZmVuNdOcjmaZXvcTqJ7zkm896VtcuT4l3Pya2bemLv/iCl3v+956zt7PZy2ZrB5dJQI+AReBVMaa+qebzX0XtLX+Jylv/GoErrwNC+r0i6juiPoQQptDK17JbLDckQp1F/4e5hAqrE2StHYpPQU6j+BQNRk12vHoCbNOz+/Y0p/dtb87t29Nn5uM3O3ZukW7gYLBu23XGQALZzm7IqTTEQBJefADIZKk4IKX4WmX4mvyQlo4Rvh8If+Wjvpmnt5VddRVKr7gC0pRpq/OattYnoi0yRItPwupJwnuwPhZExK/QzdyCY2fhqXkEvQzkZC927u7Af6438MtNuYUbu42OpKHHoFesFiIaH9w+L5s48GQDx0swqhXk65PI0eFAIlYQ8JCvZM6aZzR3p/b+6lePtfzfe7+795Ef3pXf/LrnJLruztDeJyeFWlSU3yGL0jsl36gf+CadhpKrrseeSZOQOf0UiOn1kEv0W0pVYJJfxljFQkTKIhj0UDelDiW1o6BUxS5DaeB6TzZqNeS1bLL//lznbs/r2rmm3Nh7c8xJxks10aiXiSY1ojY5njHNk124ig5T6MhJCrIhFWZIALI5DfbAjV48vdjMmLPsgNoqhUrvMEpKH7RKym8LVo1C7fhJQEkJMmUhJK00cusbEfjV81Af/R3MlauQ6di9DEDIS3vV0xqbMXtNI2o6W6HrWeSy7TC7t0PubIEv2QVZMyHqo8AZoyFOrwLGOsjHUtCmqig/twrKVBmJWBb9wSzSfgNZan/KNaATPFcrwrAkAUlTAAiAgLMgy7MgF4WLgDMceHCJeMYXIskPuATahJBgWzZMk8YEJTuOR5aS/Twj38emAZ0OO9iayZZNWl+OWJgsy0gmk+AXCw0MDPDYOSL/H0oiAYfCi9M8GmvDkZn1wHojupuA0XLSW3w4+Y6FZ9SoUTdccMEFuPjii/GZz3ymQJdccgkGE8cvWLAAl156KcaMGXMbgfu1x1LncPJS2wuWEHaHw388eai/YhIdWCqKAiYu+0TLwb81TCQS4HqoflqHaEHiig8hTufNLY0R+P3+Q1I/nuBg8PxhsrK8NA/AhwIfj3Qjtfyxa4DHHM9fdv9YdFFsKx/CMQDmdlNcvKqqqmH8+PGorq7mqALxnC14Bn1xHM9Rdnm+8lq0fft2vP3222RPSd82iPVT7SW88mHt+/SlM1gKimDjcFtGW21Ijg2rqwP7XliOvl//EsnHH4O1ajXknsRjXI46enRbaN4chBddBlx7DWJXL0L45FOh+Upu4PSoEHGmHPpjhtc3Pe8l6jn+aMiXtaan3m26se/55ej9zWNIPPEEzFdpb/La2/Pw/KvAb5cDv3oSmY0b682+/la2VhbLJwhFYEKPZ0rKPyedfOps30WXd6qXfLbJnnnaLdAjnUW+E+EyePSQLvMhXeNlMrO8ROIAeGTrp89CjQ7EAxk061lrlmjrWDOw4kV0//ZJ9L/wIrztux/SM/Z0xbHCXBZTyjOmW5raLI8aRSC4Hv1jKuCeNAli4hjYJUEwT0wE2ljnbK0utkspr60L1c8S0Qkni1C06lzmKaRpsVZP0taFXGWpT9UhFJ2glArPJiQqa9T/AmbWxJ54Hqv3CjxPFs03e3LY54rGHtizWi3r7i7beqzdMu5Oe2SRd2x+XDzEZUdARmA6ePEb+ZDPzNXatjfLNN8H18zDlnXHNhcl334XxvIXIZ5cBunZ5bDXvwYv0XtXEMF0GXyrYwg+rhDl/SV3a3VT7owuuBqBa69FydUL4Zt1EkRAf7xGxh2frS3FDeNLsXhcBF+cVIbzST/V/sBKOgJp0jyR1myzQc+kbsxvXH979xO/Qf9vH4e+5s2Q2dWzbGc+v35Lxu7I5RAjzJhWx4yCOP9M9F95HnKfvxBiJumZQGR63brHWp/+7f3xt15Z4nTuXK/lU9MdaqsjaR2GpKVRVrm8cu5pCF75GYS+eCWss05CJ0yYu9qRb9qCdNs2ZLJtyNl7Hkr3bu8Y+/YruPCNp3HN9mW4qGMZpqbeRGm8HdKuDIy3XWQaPaS6fcjpBIQrAzBDFoxgHk6ZDXW8ipJTSpEr99DnyyCuppH1W1DKVQRqQwiRHrRqP3Iw4EguPIHCJTxAogAvhEyCYulGApCHXXIg0ZegL3IAeASmUSAKjHyOgwZ8Ph/q6urA7pE2MoX+EAKpVAo7duzAW2+9tYD8dx8HEf7Xi3Acp543IsMVRAgBBtCksyMeeuI4XqFQaGlNTY0YPXr0YYkAsxg7dmyBwuHwg8ex+sMWxWOmmOjR4UMmk1lQDH8MbhnXzySEgBDv04mqmwFxjhZnbmuRDlcXjSuwJYnpcDwnMp5Bu67rw66C5WUadoYRxhENHKMGeA4dYxF/kNl5HRk81/heMmvWLJx11lmF9hxOLxzPVGCiLy6jpaUFzz33HB9s30Wg/KixDRXzB/fh/eIfnNBHLfAxZhCU381kkNy+BbsfX4LUb3+O/C9/AuPZ38NqawUI/Mmx8rmx0864p+HLN2HsN/8EExZ98Y7Y6bN1pcLPj9VpVASfEGt+2JqAF3KBMo47GvLnlXhi7Qb0rXgZiedeQGr5CgKXryD9/GuwVq6BePENSM+9jO6330K6vxciFBoMitMOtD4iLakGzHR5xUWZ8vIv5QPaq/3IxfiR6KOR5Wh4ZWQ0Fa6hZclKn07+EI58YHPjOU6tlrfJNoh0KCQ6fQPmhea7LUg8+Qx6f/5LxJ94GnkClIGMMY32JZrjGHOzMOenIddmgqFnA6ecjOjln0Fm/tnQrlsAZd5sOGPKb7FgNQyWcfDjxYPj2U8LgdYDhBJaqNVSVDNHkRaBKs8lK6UXIFtkBIYbQgZBpCU/ko6MbfEMmvrT2Jo2Q9uyYtUrPcZdr3Tm5r/VY97VOiA6DNWXTiNdl8/TIUmi79Zwa+cD2q7dD8i9fY8hl7rV8swDOqDqoGVgqnlrWqa5HVpbH8p6c4h0JOBt3QVvIMubsrQQBH2FSNNWJF5Jrhwruc9/8sli/Oe/KsYtuFZUNEwXBmBWAkuvH1+h3zKlculfTa00b59efc8FoUBDnV+9ym/50wo1ULPttNrbe2Pq5VfQ+aNHEH/0Z+j/9Sps3NiKZ7oTs36TSFdvyqdbM640T54w8TbvikuQ/pMvwvnzLxJIPxnann6kf/l77H3oYex7YinSW9ZCtxK3hqxsmc8SLzqy2mlEww/aJ9dfFv7y51H17a8/qi+6Er0EvNvL/Oiv9sGscEnrfbCszYtSe1+C2P4c6gk4X976DC7d+VucYb6D6hSlb/aQeU5FdrmC3Ks2jB0WjSYBOoQAZAm2Z8KW8igdVwbf6ChEuQYvJkOvCaB0AsdpCIz3EQXR7yVhqQ7lA10eJPqWPUBxKYpBtJAg6I+iCx/SOQRZlkQhNPJ1IjTAG+yJEycWrGMMCCXS91D1CCFAcxV0c8bWrVvx61//Ghs2bLirubnZI0s0nRWmFw+V7w8hjoDzXN6EDEdWIQSEEDicnvBHcgmxXw9C7B8XPDaEECBdLiB/7GNSQ0wIUahCOgvcAAAQAElEQVSKN6NCiELfCCEKcSfii9oH0zS5nYX5cLg6SAeFJFVVwVQIfMxfPJ+ZhlMtt4t1ONx5MJwyR3hGNPBhGuBxx/RhfJ+2dG5zcY0oto3Acws/XcT3ZCGGv4bt2bMHr7zyCnbv3s335weK5X2aXenT3Ljj1TZWUqKrC/s2vYs8WcsqrW6UZNogt74D9903Qbt4AnahTkUbc7/tG32DVVZ3hxoq+4EgsMMyFN39/soWTZSvDYjoWg4Plwp8stqcT2QgHBuKKmC6Fvb09KInkURPPodOO4e4ncCu9AAStlXIUvxisEXUSdTIj5HLQJ9N0MWBZrD1leLTRd7j6SY8LxaEY+rZ/HwkM49gwJiHhPFdL57hDU5IyHKbrHidRR15pjnXbG8D+nsgZ/thDXSha1czgaXcXFk20qpstalw4zLk1WVCbwpX1YlR868QZ/zNd+pqv/TFGfqkiec6ur6ZtgvNg9shouKwjzVmgBjBZI35jQD6gkEDuheHMOJkebbgGDIMJQDLH4HnCwAii3Q+gX6C2btyNp7dncM/rWjH3z61C/e9sBu/2tiLTk9f7MKdKZzcTd6OXfc6S55Ez4M/RXbFKoiunoWKLBpp4SrUCbpCIdEJWV8Zrq9HanQtdkYqsScyBk7JBECNEsf7n6g4fFu4H4MDA4uQSC+sMJPaGDveVplLxCJONkwlmEQwhR4P+ivuzuzrRWYnjePuHlTl8tj8xmb8z4tbcf9Lu/DDF3fhp69tx9Z+8+Ze+KdnI9UPl80861wxtgGO7YezuQPqy+/gtGQGxpqX0bf+ZYj43kVqMvndCOkkYMjNWUi1e2Xlu7nKUTOSvopH1UmzEb3qSrx9Wh1y18xB2UVTUTUa8PW9BbHlKSQyG9Dv60NezsPOkqTZFMm3D8n1fQjuKcWormrEmgyE340j2u3BH/fBl/ZBz+nQ8gokOvGYMm0cZp55EmbSIcqMc2YiNnEUvHJBpn8DZtimYxwLlubCkV3a5HpkdQbI+x55oB0pfVx4rgfXc1G4wTguPEoiiUY+J0ADwWAQY8eOLYBBmhPUL2LIWrgvmHgz3tHRgZ/85Cf4kz/5E9xzzz347W9/i507dy5hqyOV8XEBpyHl/CiR3C4mkn1Y2Wm9LOhrWMyfUibWgUrAkMEWEzeTxwbFPUBpcQ6faKI+Kzy2TfUV1goKH3BPVN3c1lwuB3a5vqHGDMdxGsugk+VX0w7cajjqYyPqCyiKctg5XRSkKK9hGLSdsnkDXl9MG3FHNHCiNMDjjufuH9tBJLe7SEXd8r2T5usD/Nj2uHHjCvO2mPZhLq9F8Xi8AKB7e3sPMgx9WN4/1HTpD1Xwj1NuVlJQVhFVNWiOCcVzEPABfoIjkp82eo4IsTw0CdOSqa6W4KUHjOwiGpwH7lj7/T0Hwsw/HOIBTXkLm8FMWN4QmTsL7pRxiFdHkZpYhXHXfAaVN1yJ7Pkz0Ta5Eua8GRhz/tkIja09qHiPLKAePzKdzdZ6RCHktBLkWglstRzEeJwDBaBnWQ2JLdse2vGLX8c2/98foud/fjHd3NS8LJ/Kz1JhplOq0PpNcxYDbTvme9h3+hQYNX5kSiWIcSWonDuN/P42U8Y0xfZigZzXXHGInELE2qDFWlU1tjoi/KsL9RIPP969z0nfu9dJLemz0zdS1EGflNdzcxBIh6xkTdhse0hYu1fPrZNw9ngVk0oNlLo9KM/ECUxnwKAZTgpAAj7NhO5X0JU2sfytHWizw4gHxqLFiOKlXWm8uiu1uC+TWuL0dX83u6EJnU+9gMyr69H2wmrsa3wXkunw5kCjwgiYeaFE2lic0o2bfOeehto/+yYm/+M/oPau7yP42WshqkbdwBbslNd9a9ZpXWJ7HQs8o286v+XbS6eruQymTCa/INXTt4n8afR0PObualrktG+slzLttwLpOXY+NTenWg1ZXdNaPedmjK5GydSJiEwcg0xAwatTx+MdXw36B6qA5Gi09Qj0mTpkz7+yzPA9HNmLOdUZ6eGIT3lSjumQSlQYZh8qyhQE+/ei57FfoPl79y2yf/b8msA7e5tjcTVek/N9Jyz0phj1SYkeu2HcyXNx/t9+BxO+tBBqTIPRtB5y4xsoNdpQqgvkS4LYNsaH3lMrkQ9WQiWLv1+2kPd1IR5uRyrQAyPfA3f3XshdgJ4MImBG4XOikLLUH++2Y9erm7GLgP3eV99BvokfDe+DGxWIjo2iZgKNHN2DAzo6AiC5oPYBbHlmvyDr83sbcLp5qAWA4mEEOZOqTtgnGo22nHrqqdBpk384yxOtrYW+YJdv1LQmFvjb29uxYsUK/PCHP8TNN9+Myy+/fNlFF13Ud8kll3iXXXaZd+WVV3pXX321t2jRIu9rX/ua91d/9Vfe3//933sPPfSQ9/jjj3svvvii984773i7du3yuru7vVQqRXMFPCdjVEdh3T1hDR9UsCRJ4HHH7RsUfVgv8zEdluGPIIH6B/z7X9YbU2NjI+68805cccUVzdz/Hwdde+21i1euXAkGfdwfCgFFloX780R1AY9/ro/BMdfDdLi6WCaNgDPLdTieExlPm/HCY+OskyPVw3JyOreNidaBA+8M4fgRGtHAidAAjzsaa+DHjp944gnvCaLHHnvMW7p0qfezn/3shNAvfvELjw57C3Vs2bLFy+fz9SeibR9WJq+fTEU+OsRezj+14afA6H6J0tLSwj23mP5hLt07sWzZMuzevRvpP4L/+yx9mEL+mNL50d6gBRAupo0MbaAUASEJUoGAr6wCsVNOR+ll12P37PPROvcSZM5eAIXioMhPElPhEwgE2jTIGzSBNiFEwdKH9y4h9r+l+r3gER1z3x5v32O/8HqWPrws/uxP+8zWt7yIX11dOm0GRl1+Peq+/KeoXfxNlJ51NkKzT15b9ZmLUHfjjYh85RsoP2UWgtGS2QdVoEfa6Ei3VZB8TAERaGM6iGeYgT7PmN7hpO7OePEFptc/y+Pf+B4mL4M7u7dvTW/TO9jz+sswNzei+7VXkNzRDGHkb1egdUTUyOpSTWuMChH3lUbv0BoaGqsXfRV1X/9zjLruywiePBtqKHSTLMtrHUVq9vv9nVTdQbqlMEjfaXYHkwsnpMIyNZhpBXTyQYn8iHrc82rzXqJehqdl3N6bLZFfAFcz1ZzeNzGg45JxPpAdG1+YruGaGSW4sjaIOXofqjKNKHO24Sq5E5/ZsR7TX30eY7atg5LrhKNYSKoe9jp5tOYSyLsqDSIdrunBTqWRsyVs6zXw6u4k3tibvb/dzd+ZzFnzslmrQZOlNkXWHvIqqmYop0x5NHDOzMbgaVPvUcZU1Cix0FJdj3RKUFpSklI/AH1eXlJj8JfG+dF8PnQAXcLJzffsgeme1f9A34pliP9qCQYeX4qu3z8Ou6/9Idi5+UI4Gp39hHRbahFllY/6zp2H0q8sRsmXv4ix51+M8WENMzubcGnzG5i35W2MShJI9RKLLCl1qdDNzpCnLlXU4H3elAZ4X7wKzucWIXrpFYAWRNfqVbDWrUDfS79GfmcjZCu52HWdes/zNDuRWOxPpW4P55OoVvrhy26C1fc6sr3rYKdboEop+Cf5ED2jFBWnh1Fxig65yqKDAw9ijIRMSRYpLQNTsmEnDGSa+pF5M4HUm70wW224cQ2973Qjtz0LeR+J0wXY7Rn0t/TA7qZybAGZoFB4jh/a2eQ/04M304U90UNf0ETSTwBdt+EQivaFAwhWlkCJaLBUslQrJhzVhEsgXggXqgAUISAwch0PDRBovo1v2CUlpHMCH0IIOrhQCkULISCEYDBbIAYMTLzBZgDBN2wCveAXlqxbtw6rVq0qnH6/9NJLYFDDwPqFF17A888/j2eeeQa/+c1v8Mtf/hJstX744YfxwAMPFN4WzW+Q5jdEEz1w9913e+T2/eAHP+j76U9/6lE5Hm2uTugmR5KkFiFEoc3D+RJi+LzDKe8PkYfWlQNWXvb39vbirbfewssvvwzu/4+DeLx1dnYW5GAd8thkYnk4fCKIy+cN/3DLpvkFpuHyH08+GtcH5q8sywX/kcrntvGBCOmv4Uh8I2kjGjheGshms4V1gw5U8Z//+Z/4r//6L/z4xz/Gf//3f58Q+tGPfgS+9zzyyCMg8Awa77cdr7YcTTk0x4Zkr6ioWHv++edj8uTJiEajhZ98qKpKmOjI85fvx/xzqg0bNqCjo2PJkIV/iiKlT1FbjrkptkeWUMeFwpYmhYoj7CNJHiQI2kiXIHjSLNR84Rswr7kR2au/Bufi66FMPblGxAJtxH3gE4G/MaAFDnosWwjxAbB3IMMgDwOhVFeHl9rwDvp++RgyP3sU2V/9GPnXlyObNeeGaseLqrMX1I275sYzaj/zhRp9/FShV1SdMXr2qWLKNV8QJZd/IVxRUyuCBEYHFQuuX0Sj8cFxg/2e54W47sFxg/38/4a9uFebTnvVBtwrs1bqLnvf7mXm+rfX5996q8Pa/q7nJeKLuZzB+SBJmmcYyCX7kUp0w3MzMHL9sPMZwLJnRYCDAC/JmZbLx86uvvjzNXVf/Na5lfM/X6eOnSJCqn9lQATaQiLUSTwm00H1DBEgWTSqpDkiKY9HJbKYyupqigvJJupo81FnQIdqY4PrWnNNT445KFkqnPKHw6rv4ZMqg1gwOYrPnlyGM6dV4byxZZhfrWP+KAsXEJi7PN2Kc1Y/h9nLf4Ozd7+FmkQLfPkO+LwUIgTCmHQpaEqB8uV2dQ16JtZia914rC0bh+X5CH67M4NtGfHdhOPcJcOt9plKU4Uv8ANX0zrcoLbcieoPW0F5LYLBNDeN2psOoHS15wQ35035QseQ5lC8SQQbVL3nxSA8TaFhJrLxUO+aV9FDFrneF1ainf//eE8nZNeYI7tuWnPQXK2KlWYwepty0uw7QldfFy+7fjHOnHcmziu38Jn4Wly76UksaHwR5ZvfgBHfuSirZRd7YW+tiERWi0B0rTSu/gb5umugfOlGBC6+Bm75BCR7B+Dm44h3baax2g5XTs8zJXNu0ozfmdq5dUni9VdmpV94GtaLT8B9ZzmcjnVwjFbiy0FICtRaP2InhzFhWgijR7tQSpPAGIvmWBDK5Bi0qhIITadjEA/ZNhpTW1KIb+hCZncKZq+Frq09cPuAYD6AkB2EltOQ6bLgdUiQEzIkXUCrlxCYo8B/pgofA+mZUXjjI7DKNZh+Gi0yHXRIHlyfBEf34JCyPL8LW7Phai5AhyOgS5YFzSnyjHyOWQN84l1eXr70lFNOQWVlJelVQJKkAySEQPGi+QsmBs90Yg+ax+ANNxPHFV3akBSsgVnaGNEpOL/IBF1dXeAXjTU1NWHNmjVYQfPjd7/7HZYsWVLYLP3Hf/wH/u3f/g33338//vVf/xUPPvhgYTP16KOPgqzUWLZsWTMBMm/Tpk1eIpE43puDPm5zsZ0j7vA1wH3OxGPBoHsNu9z/HwcVf3vMAw38DQAAEABJREFU0vK4ZDmY2M9xJ4K4bK5DiP3zgsNHqoc3vkxH4jlRacUxzTIyeD5cPZzOxOncb+TGiEY+Ixo44Rrgn0DQ4WjhgPV5OmSlw1K8/PLLhUNY/h3v8Sa6h4APdPngbd++fQyeF5zwRh5SAc+1Ih2ShFgsdgYD53PPPRc1NTUF0MxzV4j9682h/MUwr0nJZBKvvvoqNm/eDLo/1xfTPo2u9Gls1NG2iQaRxiQkK5SWTORkFy6BZyED5EAlMM0DwwsEMWru6eKMG24Qs66/XtScfqoQoVDnofWJYQJlQpsxKz0w304NLDJSqelpL12tmNl5mT170fn6m7C3tKJk9wDEKxsRf+YVWInEGq5LFKzH0bWHqbsAtpjvaIhkTkfJ8nu4PKJSpEVMtIVCojNiO+sq4xnoL7yJ1ANLEf+3nyLz5AoCKd1L7ExmLukyxMRlsaxqZdUt4fqJCE6ciGQ0grJTpiMyfjS8oPLoAKzpzHcocduEP0ZA7eCDiUP5jhSmNplREY3rItykidJGQeBbCJEu00VThaKsjQpfi6LoTboReVLNBxtdB7U5Yc/LWLjRgkZjIIycGkZbXkEvQhg38SR86dKrcOsllyGypwvWa+sQXN+Isft2Y0q6B6MHujCeLM5zdQVncTsl9QZfRdll8cl1eOmc2Xjs5JPwwvTT8Ep0HF7Ya+KdLhsJx53veWY11GThpF03jJgEtcWG1paS1doevH9Z2WxDJJ2bVtKxd67Wue9+r6NzTTabrc3BmabmENJcfblPBDqRd2EofmT0MJIykeuD40gwPW8WVID7kEutFCIdCUR+4C+tK5MDYy8aO8F/z2ljbJzt7cMpOzZg9OZ30Pv8C+hv2kKY0UtzniLpodDSklG1IlQ3sUEe1dAij5lGQPckdIfHwBpNa2ZJFSRZX656tqYPdN21b+Wz2PrQf6Dthz/EwFNPQ2rvgD/jwmfq0KwSeLkSOHkVEsnpk3VongvHy0JEPYQml6Pu3OkYe+pEKGVB5Ml0bguPypeRM6mt6Qxc0nuO5qmju8h7BgzTguJqVLYGj5To9UmQ8z6oloKAHEAkGEVZeTWqJzRg0mnTUF5TAU3zwXIFunv70bWvE5lMBrKuwRcJw9FUyKEARMAHUyZLqCYDkiiqY8Q9Rg3QCfcNixYtwkknnVQAzwyABt+wad4W4odTDa09H2DjOKYPJLwXwWkMvg0CXwy2+fdbbW1tWLt2LX7+85/j7/7u73DTTTfhL/7iL/CTn/yEH/Nb3EcXjZHjsvGhtra8J8qIc4wa4L48xiI+cvaPo26uo7Af8bzCQdKHCcsAlunD+E5UOs/dYtmD/cW4Q9332jcCng9VzEj4uGuAxxoXyi7TYD+Hjzdx+X8IVFJS0nDFFVdg3LhxhTWG7418T2Z9HE5+TuN1ZvXq1XjjjTdA99Dmw/F+GuKlT0MjjrUNtLfWkkDI9cltRgCwdcAlzdD+HD6CzzokKLIEodKGGcd+0SDTCqV09valGt9Y0bVy2WNG0/pNWjy1RDWy83SHoJOk0YmUSoJESIZKBKVyCEnEvQRZGAuZT+zXARkPqYbj/Wau3tfVC+Opl+B7czusN5vQQ2A/17wVeXNgWRbZBtKnxsCOs5sB5dWq2XMx9xvfxul/cQdG3XADfCdNTbtBba0B81LmOdHEcg+uQ7x3wCEIXNtC25zYO/DI9hXrHlnz8yWL3/7d09rrL27Ab1/ahX9/qhlLX2rD0lfb8V8v7MVPVvRhe5+LuKHAkn1QFRllyOHScZX48ikT8O0zpuLG0yZhcjhwZ9SvPdlvmrM2+jT8KhpG49RZ2F0zHQP+cXBFJbIJh8CaBVc16iDnqllGXdfbbARaDQTR4wUXdDreinbbW5wyjOmiP7nKWLNmrvivB+E++iDsV5fPko2uRsW1q7ltsqXGhVf6KCrG3zPukitQMf+ziF14BWZ+/ibotQ2Q9NCdzDckZaNrdcXqiCp5REUWPjsF3ctDN00EB7IIdSTmKh3xZq87+V2v35xVLMOAjmSgdGlm+jmwr/gW7Gv/HKO+fitKTp0FRaSnqb3v3my+9jSyb70EpXMXoq6JdGc/zLgBNeeH1h9E+p00el/cg45X29C3qQdOJ2nAC5EhXcBEHqaSguVPwY6aMIIOcmQJzusu0rKFPFuHI4BcKSE0UUIqmEcuYAFBAVmoCJhBZHdmsee1Nux9pQ1KVwBqbxhKbwBStwLR6UDuyMHsSCKfMGima/D5I3AdhSyXgCN0BGvGYvScuRh31pmopAMgWZZg0Rx1afOKj3aN5BpCA3PmzIlPJP36/f5CKgMEJoms0IqigP2FhI/xSwhRqI03Dxk6TGHLNVuqv/a1r7F1Otbc3LyM4gsAmubvR97wUxvjRIW6Rr5GNHAkDdA4Kzxxwe6R+ITYP3ZlWQbTkXhPVJoQonDoJYQAyyvE/vCJqm+k3BENjGjg2DXg8/lapk2bdtvs2bMxZswYMr44ONL9SQhRSOcncfjw+c033yxY10EXzfuPfF+k7J/Yj/SJlexjFIwtcDIyGhxzprBMCNcBA2cyfQGuB0GbN4/IKUQem2A0kDSkBhZ4vb0PdD37LHp+9SvEf/049vziF0i8tHK+29N5e7AqhtjMGVAm12OgehTMmXMQOOt8+MKBy0RUHPbR66JkntdNlt/uUDF8OLcgy3uJ/DvghOfxS3IKwF68By7fSx7kJEOO7GmES2CThTUJC/3CRoZAjBuQCBRaGm00a4EkAmQh54x5+ENeSfn1voapdwROnr1WHT/hYa8kfD3Vb3rw6KiCuU4cUT1aBpkhJzC1e9bqAXP9a+9uRecLy6G88CS8559Dx6o12LJ5F5rjefSmbHTmbezIunirx8QzW/fBf+rpiJ1/NiJnzsKUi+bivLOm4TOnVGPexAimVPmvD6riWSSTIUvy6r3SGCKnn46cHILI64iRBXSco2NS0Ieo6gKKobkwZhF6m8daiMdzfas3x5c9+vLOhQ+t65j7dHtmye6stMlKZ0K9q16D8/oqpF96Dl2vv4ju3dtitm0ucF2YKFMboepLTS3yuP+0Oai46lpUX/M5RM44D1K45BbJyC1C2871xro1nrtjp+el0/O5PiZRKdKSraarxjZg1FlnQ7/4bIiLT0fVqSchsK8LAw89io5/ewC7n/v1vcnOnes5D9OAokx/K+Xe9URc4OdGFE9HxuOd2Gi0md3oa31+lrX9MWjdbyFs74MuDcASacDnQFIVECpGrtNCd1McTqtHINdEfHsKiZ1pKGYIkqsSeLXJip6BGUjDLXPhG+OHWqkjrzkEqD2ERwcQqOY4DZUnVSA8hazsFSbyah60a4NqUtqACmkfAfEWA/F1Peh9owsdqzvR8do+xN9qQ3pbF5y+PBRLguqpICGpbgUK+d2cg3hrJwZ2tCPRug/ZgQRceHD5HE3gj/g6vk1PpVJ367p+25VXXonrrrsOoRDNFSGoC/dvuj9u4CzE/rqF2O9ya2ldAx0Ign9bu23btsK/yvr1r3+N1157bVlra6snhPjQtZnLOQzFKf9hkoaOpnVt6ISR2E+1BrjfeSyye7iG8lhi4nSZwPORNr7McyKJ5WBiedllOpH1jZQ9ooERDRy7BsLh8IN0oI1Zs2ZB07QCOD7S3C3Ob7ZQ8/3x9ddfB93XHzh2ST6ZJUifTLE+fql8aXseOnoeyTTvBvpTUB0CzQSc6QObxGFyaNNM3mP7ZDIx17bm2/3xWxNvvAn31TXQ1ryN/OrXkaHTGqevB3Jp6OHgKVNQefVlCF79WWgLr4BKgEYLBNYOp3Ih+MVkunYkXhromoFkLT86znwSrOkOsnNzufi9dmd7n7Wv1ctk+u5OeNm5nF6kDGTNlIVml4ahXngmxLmnQj/vVATOOAVS3WjIPn25KiMeQcTkPGkvXS1BTrtadLUcKfuBGF11hqgqu0UORFa6imsq8FLMd6LIyqXnWwNdj2jJxJKcNTA/62UJ2O+vLUGHBRnXXvhKcgDr2nfC2L4RVVs3onRzE5ydu9Af70eKrIsMlixNIKNL6KDw2i4CcifNgG/BxQhccQmqLzoDYybUPFhX6T+3MirXlASUxy2Vmh8BATCpszoYwvxJk3F6eQVODfhwdkjDeRV+zChREFHwuAA0WxKaI3mhZM6atWVPAi82dWM5Acnfkw366d1JbIrnYJoWcvu6kenrR6a3D9neOPLJNAjNxYJB8ObbFGV6U0bWUqgeNVubNvUMfca0M7zqqjNo6IaS27ct6H5pJXqXP4Xsqy/C6WpfwfrZrw36zgbS4Vj948EzzoX0uavgfZ7G3fTJZJ3thfX0C/CeW0YW3KeR6G6Bl83S2PFCtiyqd6bzWJfIYVXWxOuWg7cSPdjVtRGZvS9B6noRsrwT5bUmYhNlsoBLCE2N0RjXSCQPVpra1GNApAWRDLvXRb7DhiAgrtoBSJ4EmyzMhpqBG3URGleCskmjEZ1Qg5KJNSifNBb+SlK0DwjU+BGbVoLI5AiUShUWbMgEwDVDh57WoPRJMHcYyG3NIL8ti1xzBrkdA6TTBNXnQYUMiea97Aia/xI0R4WSFyRTGvm2bgzsbEeqq4+s0i4E6PKIRj7HTQOSJLWcfvrpLVdffTXmz5+P0aNHg07AIcR+AH1oRUIUeuHQ6ANhIY6cjgOcB3uEeD8frZMHWcw47PJJlWnyo9t4+umnC7+HJgB9cCFHH+oT4v16Pyw7y/FhPH9M6UKIwjgRYr/7aW47A2ceg8NtI82rgm6Gy3+i+EbG7InS7Ei5x0sDQogPBYk4jhfPCaIhDTvHsZqPXNSMGTMwc+ZMFN+8LcTh11chRKEeXpv4gJlfHtbY2HgrWaLvLiR8yr6kT1l7Pnpz4snHsuua0PvyW/BooxywAMkFLAEYtEm2CDQxiPqoFdAEOQBmhePVOykCPQSCQvEUygYyCPYm4Hb1wsnl4KpKqzS26ozRX7hqdt0tX70tctVnb3EnNTQcXd2R9OA6h8irGVDLUtCmJ7xETMCoRS75gNG64/bEW2tiiXWvwdi78y5kBv6TygkV80uQtLykmUasbGXwqsvisa8sQs2XF6Hy8ksIPE+8SPKV3OIXkdVCCGogICxRExZ6U0iIg34bTulsdW5SIW3ACbpyVnKevXPHCrdx42J346b5Tu++FYZp3ESKqaY2UfsRc+HWb8umsNvIwHEsBM089JwJ13bJlCtgyRJc4cHVPNi6h5wK9JBFMlFVDvPMOXH54vmdyvQpyOty63vNKLTbUxVTiGi8VFEaJ0rKVVeHQk03ThmNxQ0RXNeg4bIpfowLuxf5JW+lIFjnKL5GW/M3pYRY2LQvjvV7B9COEPaKAN7symBbXwamoiMwaiyyo8fDrZuCwOhJCIWrIQl1QwYoPDVAlvRq248yQ/FMFf5mW/V35F33HBpXd3auXYvdTz2F7mXPIP70b2G3b4Nr9v0wYWcW8EGCZ2hpS4n8wMPiNC8AABAASURBVJ7QcJE9/8I73UsuejBfWQ2brK9afxoluSyyyT3ImQnYwq7LIReTXDMmmSkIcwCeHUc+146+zncI2G+AktkKv9MKJ9KLkqkSqk4PI3Z6CUrPqAHKSa+aBVnxoOsyAWkHiiTggw41H4CXIDTcLwNZATguHALQjmrDXxVFxeRxGDOtHpUTaxGpqYaiB2DbDoFsF+HaCCqmVxLIDiMn5+EpApIryKosQzc1+LJUQ9KPILnBvAYpK8PNc90S1Q9Ijg2/kECGbWg24CcTc0Tyw28RXyIPO5WDIIAtaPSS0Bi5jo8G6JT77kAgsDYWizXMnTu38G+nLr74YvDNm0E037x1XQc/vk1rB5gkSSq47C9SUZpi+FC3mH6oOxQfbwKYaK04wM58HOB4dt999108RXNq2bJl6KPrWF6SwmUzcbnDpRE+HBgDh44HfEwX99mhdCKr5rE3eEwO9g+ul+OZOI7lY/fjJq7/UDqcDEUZ2aW+PJanOA5XxUj8iAY+oAEeb4OJxh6YBscdLz9XXiyL5wWHP8k0fvz4sunTp6OB4EdR7qHk5TSO54M9bpdt29i7d2/h3hiPx2+lON6ffmIPCVj2oyXpaDN8Gvm9dLo6vasDm5f+DsnVjVA7B+CnjbNwAYM0lKNdsi1AN2kK4KNdNLjMQs5gNi1kebUeiUAqLYEZK0E2GoHl90ONRCECAbiqujmn6n0iGGwU5dEHtZLww2SBacGHXN6g30NzfUxDZTFSxnRKSxuQYmnXWSAcd2EATtzbsb2++zdPYMv3f4DN//Cv2Pvbp2Du2jELyISK5RCM6LQl/zrLV3KfVF4xPXjyrNmhU884V62bPDunaM2cXuRlN6gFG9kdiqIiGi8RoZVDpR0ubsDKze830zdyupdP1LPL5HmexgCQ/UxeKjXd7t2zau9Pl6Lt//sXdP7Lw+h64Xm46e67LKQWDJClvVKIljLXfTRg+JHTa9A2ZhI2jJ2AxlFjsLu8GqlwGRw1BNcXhgMZnkvfZHXykzXTlGQC04HlCMSu90KxG4TkW6dAaaUy01x/AqECmGY9VyviyRm6NOPyUfkZ18/0rr94lnfDxPH52cGgsjqoxR72JG2pBL0xCT2dE/LMjKwgI6vICwGPgJrpCKTJ71RXto1f/CVUfvUWOrD4NkYt+DwqJpxyva77HszmsaAnh4VUd00WmJbTtFYRFXHXD1Mojinn8zGzbV/hRV3h+ABS27bA7tgFke+ZLovEPNfKLBSqFbN9XnVOkWImfPG8F2rVymoh101Femw99kTKUH7a2dBHTUAO1NMEvUtziYaZid2Y1/U2ztrzMs7oeQ2n57ehwe5E1M2AsCcsJQErmgNqVSgNIcjlgOHLwg2Y8FfIiNUFYYZyyCt5+EJhVEdGwW7sQN+be5HY0ge7j/hkP2BbEK4NzzZhJAYQ37kDvRu3klW4DyoBYeGosD0Djt+AGTGRC5AbtGBrFiQ6/FAVGZSMAILQbR9kUybLtEzY3IVJCa5iQ9MFVMmmeAsK3QB0G/A7MnyWVHAZTGuegEzxwsPIdQI0UFVVJc4+++zb7r///uX//u//jj//8z8Hv/lz7NixKCkpAYNoSZJoPRaFTQ7o8uhwk0kIUYgTQoDDTMyrKApkWS6kcVgIAb6EEIU4LpN5hNifbzAPl8GbgiK5tAZwnE3jg+O6u7uxYcMGfnw7lkqlmvERLiEEPzky7Jxc/7CZP9mMH1k60lmh7wb3Ffs/coHDyMh1DkU8dvjRxmEUcdxYWI7DjQOOZzpulX3EglgGni88Twa7hxbHbSnGDfYX40bcEQ2cCA0UxxqvGzyHeYwycV0cdzyJ62LiMnmtYD/X80kmkjE+bdo08MvDWE7WDc9p9g8mnt+WZR2I4nvjnj17CuB5YGCA79V8f4sfYPgUeKRPQRuOqQk0EEKO5S6w01lk9nXAb5gIuB58tLdSiFzaIZPhCh7VIgmKIPdYPkJUpuFTX0R57Jaaa66EvnABrPPPQflVC1F21dWQCLhlbW++Cyl8tPUIAkucJ/EeiKa2aVkzO5cfsbX39qzxduzzvN29zVrOmZZOe9WqJXUqkm+1LGsbGCj4etMo35fG+K48xrYl4N/ZDSmeoSLJZEff/BFCmNVCW1su/CuFCHWKYGmj6o8QCAw2xkSgjdOZ70QQtScku+l5PjO5yMv03Oxm83d4qfjN3D6qTyM68DEN5/b2ps2QWtpRsrsbwZa9MDZsIqtyiqCTt7kEahMzRxXf2pODFdBiDXh5zOl4/Mwr8MzcC/Bu/QwMBCshDAJkGQdy3oNmuSilkTAnWoI6VYVP8t3HbwS3EVwbE/7VMSHauEymSiEKIJr9LDcDfU3KxTw9Od0KJBfm5PTtA+ATuUQsIGJtOiKdCgi7KeLxCbXlmFYXQxUVUZ6NY86oAKaMikAOaPdLVbFHtXMvhDJvPqT6KY8qJeHHy4RoiuSSs7yO9se6m7evTyXiS2TTXEBW6JBj5eo8160TodDjdTNOQe2MWfCPHofa08+Ab/QomIk+mE1vfzfQsv4RCR0PyOifG3YyWrljrQta0uM+f+XS8EULUH3XXRh7z/dRe8UNiI4dA8WJ3+y27+7Q1r5wY+C3/42pz/0El238PS5uWoY5HW9j7MA++Mii65K2JQLarqvBhgpLUpA283BlB65q0vGNh+iMGCrPr8PY+VMRHV+GdFccXW/vQ25LHr1vW+h404DXZZH+Fdj9afQ2t2LHhm2It3cjvqMPHY370LWpBz6vlIA1IIIC+mgNap2CLqUHcS2JASWFBJJ0GGbCsA1YdBDiyQKST4Kju8jrJrJKFiniGSDLuiOb8AhEOy65BJIkFwSoJciegAzyEwmikc+J0YCqqssJKF82ceLEtQsXLsTf/M3fgP9l1E9+8hN+UVfhrdd8Q589ezb4VJyBdUVFBfi30gyEeXNCZYA3KrQmHRCS5iKYOILji2RZViGe+ZkOt0ngfEMRna4X/o80geehkj80juTgzcWH8o0wvK8B7kcm7q+iy30fDAbBxGPh4yBZpgM4xwFvIFk6loeJ/SeCiodAwy2bdcM0XP7jzTe4bhrnRyye0xnEENNHOoSifCOfEQ0MWwM8T30+HyZMmID58+cXiJ94YrroootwPInL5DrOP/98nHPOObjgggvA9y26Vy0dtsD/C4yjRo168LTTTkN9fX3h/so6G44YfE/t6enByy+/jJ07d3rDyfOHxCP9IQl7ImSlxTotq1Kb4lcQriyBoTjICwdsaaZ9MkBdLvDeH/mPhwwiEF0rSmIP66eeagY/ewUii65H9PKroE09ZTUi5fcISW+SoBYsl/gIV/Q9EE1ZNdnMLszt2tza/fIzc3f+egnaf/tYvb3xncf05MBDiueZCuSmoAg2Ko7aqkXL4K+sRog2oSVVVYgSkPeFSqiY0sOeGNGNUSOGj+djJKtFV8dd/W+8vqDxZ0sf6npl9c35tj0POZ4xi/vRQS50QBBJ6lQDZM33+6DqKiQiL6ijcBBiSmTIFeZ7vGZdiQ69vBJNlVPxxriz0Dj+ZHRVj4G/JIJxQT/KPAc1jomJionTyj0sagig3ievjGlopvaHdOCw+gFdLJvwRVssRTJNiHqCY/U0tkISlE4gUgTZZimVE3Swbnp1CJfNKMfiWRX4+swYPl8fxSmlOmThvYiI+mCiZlRYGVctxJiSmzwjNd3oavHiK1+4te1Xj6Plt0+jccVL6OzueUwxjMW6K/VpmrRS+HwPhmeeirIrr0Xk8zcg+NmrYQgVnevWo/2x3yL1s18i8/baammg+7sqzLTquaY/7weZ+e7U6mpnq2fMuCp01qkPhqtrnpSMPbD2vrLY2fkyRMs6RJvfwfjdzTi5sw3TOttR3b8bAWMAkGRYCMFpB5JbsxhoTsPscqDaAUhkyRXChQg4kKolaJP88E30wQlaGOiNQ0to8PX4oHWokPZ6VJ8FkVWQ78kivS8OeyAFpAyIfgfOXhPWTgNyF6BaKjzZIeu2QOzkGAHzCPwNOkLUZ+GJUYgokJcMWJIFm8zHWZFDjkC8Vu1DeFIZglMq4Bvlh+m3kVcMAts2DNiwhQdXCHhMKCwL9D3yOVEaoA1NC5ddWlp6GW1sxKmnnirmzZsnLrzwwjMYNH/+85/H17/+ddx22224/fbb8Z3vfAff/e538b3vfa8AtP/P//k/+LM/+zN861vfwpe//GVcf/31uPLKK3HJJZeAygG/BIVBNz8SXl5ejnA4DE3TCtZpmSzUuq5DkiQW4UNJCIFMJlOwPvP/ufzQDEMwiKOwPNOag6MF90NU+amIIr0V2sF9RQctWLx4Mf76r/8ad955Z2E88Jg4HsTlMQ0ui+u54447wJYZloP75D3gB+6jgmAn4IvbWqyH6/2wKliuD5Xnwwr5iOlcL9Nws3N7uG3UxsL8H26+Eb4RDXwUDfDY5IM2Boc333wzvv3tbxd+MsR+vnccT7rlllvwzW9+E9/4xjfAfi6b1w6633yiwTPdG2/jtfWaa64BH1APV8+87vALNp955hk0N+8/C8vn8weeFh1uOZ9UvuHtDj6p0h8vuSSp2VcVRc0FcyBPrEY+rCNLmrEEQHtmSASemSiI43llK+tq5Jlzzg3Pu/Ay30mnzpbDFdcLueQRVw0sj9Jm6mjrMjPmrL6OHq+vvc/LxdP3Ip2uk7ID3+1f9yI6nvsN9j35C/Q89RgSLz4Pt6dzoeK6sZgQbVyPIHDnjh3bhjNPhrTgTLKIn4fgvNMhE4CmG1oR4DHrQURpJkfwI9Ns6WSXFqT3QSwnHi9yrOnmjt3ofPpZtCz5Ffb+/llktu+AMM15VKcmQ9IOVKXqS4N0muibOwvyedSOc2fDN/dk5P1hshDIBfnyCa++2XUf6LH70Sdb6AlUolsZh169HFLQh4ZKDQsawrhkvI7LRqu4fKyKyyaouHS8cseEsHQRt92ysg0JyLMO1PueJ+klWaZCPe9Fkd21rEn2QitVJ/isZgUfjyCynMuw4/YCoyt3v53IzyVA3jEpihkXjvPfcdPMyuXfPqX6ts/WBC6b6pdqYprWaqsegXWjulim7fXdlW9/FwPP/h6JXz+FgWdewqZlL6J9bycylnGvrdtpnxJdnvP5Wq2J9TfJ8+f/wH/1oocx7/zH+5J5dK/diIHlq2H8+lnkV22F252BDR1JWa01ZGiBQKDNDJgdQknPo8RbRXfzQq9tBdy2X8PpeA5erg0Rn4yYP4QSJYCKQACqQmCTAGlWc5B2POTeySH9ZhKJtxNIb0lDT/qh5TWQYReOsKlPDORjJqxoDnk5hVw+h4gXRTQXRVnOj2hWhheXCuDZTjjw0hYCngA/Th2xdQRTPqg9CtCrQHMDBHA9IOSgZFIE1adWouKUUpSfUo7yk6sRmBiDVEKWIrI2G4oJ/l20XKogMr4EsWlVKD1pFEqInJiEnG4RsLZJJgem4sGSAV4TbACFwzWCWadXAAAQAElEQVRyRz4nVgOGYcQG10Djce2YMWMEgemyyy+/XHzpS18StNERBKLFX/7lXwoCNIIAtPjOd75zAwMbBtb82Pef/MmfFDYsvHHh/9fMIIsB9dVXX114JI0B+aWXXoqzzz4bkyZNKpyw06ZmcNVH9JOcaG9v57eLMpBe4Hle7Gg2CpIk9XEFQgzvLkPln1CAxrJ80kmI93UlhABv8PhQhfq8gYBuYRzwWDgexOUdSlwuja2lU6dOhRD7ZWHgd6L1RmMFPDaF2F+nEPvdw9XLY4U3sodLP5HxXC/T4DqEGFpeIURBj6qqcvuaB+cZjn+EZ0QDR6sBnht0UIvJkyeD7gXi2muvFQQSBfuvuuoqcTyJy7zuuuvK6L5TxvVwmA5wy/iedrRyf9z8dIh9G8kMuvfy3Bx29fw0zrp167B169bCO0EofJTvbhp2VR87o/Sx1/hJrNB1TX1sxT2jvnwNJlx9MQITRsFQ9m+QJVlA9jxIRBjmVQSQnpeIednEXDs1sMhOJhcemj0L1OQ9Xxp2oBmWChESnYGAaCsC2kP5jxTm3zEnO/aub3p1NTa9vAa9u9u/61rZW51MH/asWwVv12ZUk7883Yu211+C1dEGLZufz2V6Ca+wQc2Vx27CJXNvC/3dTXf4/79v3uReeOoN+fKyi/gRb6/bCzHvUMSgOQtzvkB+oWxnZtGmcVbKMKazHor8ntcdYn0Uw0O5Xjp9ABQOlY68vTC3ox2Zte+gNm0jv3Ebsjv3QuTdhTCStTaETouhxnn1sN6Uqxy9NvDl69eG7/4zBP/q6yi/dB5yJWWNplBJFk/rl9wbXrfcm3+2tQmr9+6CTZgr2K9B6zdQjjzOHAN8+5zQnd+/YtT1/7Cg9pa/OGfUk5dPLlk9ThY/4DqYLNWuTnrO7d2eNY/DTJ7nhbKudeMAUoviXraW45iEEOmIEnk0ppbcGdGCj1M4bnaatybbu5clt+2+VbTuW4H+/ptDVio02km/Wm9Zt4zVxIMVMlaGhCArNZBzzMVR4Sucytte94K807Uou28rYvv2YHJvEvVxOssgy+wAAeOU6cZgy9OzJEPWkWelfIHOZDj6eCYavd/2l9zXnXOBlIsxWYEq0meoIwIvVYKECFZ3CH2hLypaOK/P6rtTSTbf7jWTpXn909B3/w6+5HII+20IAr3a1Do40ych2zAGwVNrISZUIV8iUTkD6E33INOYgtYiQWx3kNjQD2N3Gqrpo/wKTMtClkBsSjdhh0woURBiV2HnHOi2HwFLh9/W4FfCEA71jdAI2iuQTAl+T0UYIeLxQzb8gFYFz/HT4YiAIzlwAhakSgnBiRH4xoWh1AVRckYDShoqoMQU2D6H6lMwelIlQqOjQFiGCAL6pFFQqumQJSzB0BwYqgc6SIApAwygGTi7Egikc6+O0InSAM2jGG28y4Yqn+fOUPHFuFAotJR/O81W65NPPlmcddZZgqzOgjYv4qtf/aoggCW+//3viwceeED8+Mc/Fj/72c/Eb3/7W/Ff//VfBYt2WVkZFIVuAsUCj+CSnDBNkzcHSCaTsG17MbOTO5fd4RK1abisBeBMuhk2/6eRkfVe1AG7TAwsdV0/4pNAx1MXVF/cGfTINst0NP34UWWRZVqMhpmZ9cJyDZP9uLIdWveH6YbTSaf4OPvwuDb42Aobyf0xa4DHG49RJq6a5kmM3RNFVB//POdjW5+OVztUVV0+ZcqUBj6gLC0tHVax1FbwXOaDZQbPO3bsiAWDweVDZSa9DxX9iY6jLeAnWr6PRTgRCnWKaM3dSqiyxjftNJjRauRMAZiAazrk2MgpHrIyxQ1DIsIDDVb3wEP5Z17p2/NP/9+aN79782ONv3zgd707Gr3B2WuEaKrURCODFFEpGgenDeXvJlA2OJ4GnMYANRfvXJN4/pebkvf9BU760d9h/MN/jvRP7sSeN568WZECGOs/BaOy4xHs1uENpCFKXAIKNgiNxKiMkIiKwmQuEf6VAVH5oJDH/UCI2kdDomJpiepfGQqJTpIvXQTZOOSqJFBI9vqV5TCXh9TQSr/fvzqk5Tv82Wwd/x6ZzODznIy8yDGcD2wmGZy1db3hbf3vf/W2fP++jl3/8ZCX9+ILdnm5R7o9c9bgqhxPxFR/CP6SCmRtiUBWBKoWoE7az6WRI4SgXiMPfcYmwt/SzfJ7oJXdKYcjj+uS11QuUhsCshlPpTB3V8q5a8mKDrQMhGEqIdgiC0vLwEegrL8ng62dcZBl+t5eKbPE1hPzSuVEfJSR3uxlMrP6DG96NuvVBjKRxvJ85JaSnEU4sHN+wul4YJ/dtyY2EFgdSbtayLJqSJSDPtxnAxamZzL5BX3PPPVA3//9Prrv/lNs/cebkH9jxb1oz61BLtQnAoG2jJ1Y0G+3r++3Ox/JIBPy5JL78d6VRBA5qQyRyGSUSqOhWX64soSy8ZUYXRGCHvA1pRRVS8OvubK2skKWV5ZrYm3UJ1q0oNY4dcqpqJo8FYkKDW2VKTgLy6HXRhDJqU+OS6NQj9K7vjXT9ONb+9/4Pswdv4ScaofXH4XTP56GTzksdw/cuhYo8/ZCvywF++w8jFiGAK4PFf0VqGkuR0n/dJQadQg6IQjXhuUlYCCHHG0ATVmHankoMbMI0CY0Wh5EbFYUe8btwfrqnWiZRpboM33QZgaBchv+agV6hR95RaCP5manlUQuaEPxO0ht2IKWx7Zh16860PdKHs4+lTSlw5IkGAELRnkK5pg9wHwL0c+XYdSi8SifPQqdHSm0rerEvmfa0fXMDvQ+9y7Kg2UoG1UBLwz0qRnEfQlYpRmoYQs6laq6gDhoNmPkOs4aEELEB5/K01oVy2azc9k9zlUdKI5O1huuJmv0vffei1NOOQWqymPoQPKQHpLnAJjll6T09/cvzuVyDZIktQyZYYhIBtpcDidRu9k5IjFvccN3RMb/xUSS8ais7x9FVNYV6a6gf87POqG4OPs/DqK61hIVqqL2Fg5RGEyzvxB5Ar5oXIHr5DqK/iNVYxgG6ED7SCwnLI0PlSzaEBUrYLmZiuGiy21hP4Hmwpwjno+tD7neETpeGvjDKofXC6bi+Pu4x93HXd9H7R2fz9fCRFZ58CPuJHdhDdI0rTBfeR06tGzWK6/NPP9XrlyJZ5999lAWLqNZUZRCfLEPCoE/gC/pD0DGj03EAogmcObJKlzaHIM2x9yhHnkERSgeR364OK4go25n++KBdWuQf3kVgusaMfDsCvS89gaSO7ZRqR9exlAcDFIHx9MANvnxbinrzXXaeuBtakZk1z6Ud/ZhYOMW7N2yHUL3IXrO2QidMQe+2SfBP3cmaq7+DLTaakh+ja2f6cFlHskvouKwNzQhonSiFj2QzmE1EGiG3x+Hr7TJVoKrZb107aHlSwP5O+znVsH/+1UIP/cGlJfXouuNNcukVN+Nmu0cOAXkgwNT01r80yZj9Oeuxthrr8SYRVcjcvI0eD5lJfRImwvPGFx+MoDaZFhOJwOhF3N6xaM5MephA7GVO1NY/3Rb/6r/t6kNG7IpJF2J+luFQ65BgM6QfcgTEDVTKqQBoCKnPBrIBZ/0GZFHZUQeH5CkmZZkV3seyuDA5KcFDFkm223UlLzQar+rPaVkkndL8ez9ctq5kMZQKO55tUXZogQKfF7/NDW7d1lu95tw29+B0tuKVFs7nFQaLo0QEfW1ePl8vbF127L4089N73vqmRszb23sUHPugcMBAbUzq4ZNZ3IDnC9fBvGdzyN261WY+7nLUErC5da9Ob3/ueeXuW++1hzp3deMfGpuUQaWSR1Te0tk/mdR/q07UfLX90M79XQoJepNQfTPV8zWtc6Wt7z+F15C+69ewY4n3kTrG5uQ7tgEz+2H8Ms0tgChGJB8BtSQAzXiwtFNuDIRWe5l1UEgpsOtcNCvJ5HxZ6BRj6pk0VUUHT4RRAB0GCL8UD0By83AJXAanFyCqnPHo3b+BIyaOxqh8WHwC70svwmpRkN4egWqTq9DbEo1SidXI1QThuzZyOzqgt5tQt3rwmwmwNvUB3vAhZQEnG4DmT39JH8PZAjooRA8oSKxZwBOD6m00wK6bbj9FnI9aWR7E9BLS1A9ewpGnTYB1bPGYdSsSYjW1sCRBbURoGIwcn18GqD1Ls5gmt0TVStvEOrq6vj31eCXkY0aNaqwORBCHLFKmk9w6R7BLw4jgA/aTPSxrEfMNCiR+FtkWnuYBkUf1sv1EUBHOp1efFim45xAdfLbxB+gNq4hah4YGFiWSqUeOITupvDdnEZW+Accx2k4zmJ8oDiSC0wfSPgYI4TYPz5YDqYTWTWNlQNjksfch9XHwJkB9ImU6XBlc70MoIvpR5JXCFF42mO4c6BY5og7ooFj0QDPH6YDZYx4DqsBPlDmF4eRgaywBql0uCzE/rXvcJl4zu/btw87d+5EZ2enN5iP1rL4H+p8lwY3ZMQ/tAYkAiKa68BHlrGhOQ6JVWgj37EbuZ3N0HbvQfW+foS3t2PgjTcR374VbLmkyRo6JNdHDsq22il5fsDxIZMVcLIavLwOy9Zg+iPL5TknQ7viPPiuX4DgdZehZP65BGiqHoYv/KHW7o8sFGUUZJF+j+K8KSX/AXBNyYWPYhgLtKZ2hJo7EG7rhra3G3ZrO4JGGppiHgD2Eqzpeb/chwl1jSWXXIBRV1+GygUXQp8yfrXn056ksskO+T6w5MJtzYTpszXbr6YzcqDRQsnjWSsS2tBh4/fN/VjWmkDcAdS8hEhGQcAgvXk+GHIIeSmCVEZHX7sBn6U2uo4/viuvrFrdm1vxbHf/I2/3Zld0ZY31BLUacl58Hql8pmn5TPQr89Hc9d3UC4/V9q5cFhp4t/HeRHd7yoNJNkyWaj/5XFtTvTxZUTUoNSEoFeUIVE4GYjVIh/3peNarNZOpBzIr3oD02AvwfvE0jBdWQOvuavXiuXlcip5T+3QRuM+pHnWHccmZcBdfgug1F2D6qSejZHsbtKeWQzz2c+R//zik7VuqvWTqh5yPqc/C9D0+ff47ZePw8oTzsOKUz2OPrxoDbt8j6czaJUbn0zE0P0WHP6/CfHkvrPUOejbHkYnvgil1w/Gn4Sg5CMmD7KjQHD98bhCKpUAQiHCkPOxABmKUCTHTgDPFhDJJRqQhTOccYbgJD7k2A9lWAwaBVi+vIC+TNoN5oFJC2dRqjJk2CpVjSuHzKzSWDViUboWpvjod0ZmlKGWaXkaAXIOVywEJE6GsgkhKhkJ9nN+RgNmWQn5rCpl3EhhY34+BtweQa0rB2ZmD05qFsSuBQFpGMKdAN2SypitkPfKQ6k3BytlQ6PApENThDwcQisWgRaKwJQFHAYFvjFyfUg1UVlYKBs/jxo2DEKKwUeCbvBDisC326D5BVmcwYOD17rCMQyQw0FYUpQAeislCiELdxXDR5Xp4Q8Ig3TTNu4vxJ9ptb2/ve/nll2/9xS9+MXfp0qX1csN5FgAAEABJREFUS5YsWfA///M/tw6mn/3sZ3e9RwtWrVq1uKura9mJluuPrXwehzS++ICm0HQeDwXPYb74kIXH5GGST2g0j9F8ntb092phWZneCx7kCLF/ngkhDoofCYxoYEQDR6eBE8U9duzYslmzZuHkk08uVMH3IZ7PTIWIQV9C7J/HQgj+KRNaW1vx6quvgg9XB7EV7nlC7OcdHP9J90ufdAE/CfIRPiDLmAvFtYcljgyr2sr0Q8pl4M+bCCVN1JgSnL1dyHR3wBWZc/J2gh8/DA2rwA9j0rXlavUoiPpJ6I7EMKCUoLRuGirrT0LKF9pgVFaeIZ839yL/5664zbfgMw+7NWOX5vTg2gzI7PdhZX+EdLYSs6U1kc8vGDCMRX2GMZ3jhixKRp+PgKNXWQKjPAKXqKyqHD5VggILxUuBE8orEvKRyMPuqJrZgVNm6srE8bpc6bsqH5AbafJqGsg0WcxAbhWstWGYccCkENJkue+00+4dTe1pbNiXR8oKQCQCKBnQUJlUEMuoUG0fPCWArBpEO93z326LYwDejR0iv+KleAf+c+tmPPTmLjy6oRdruwwkPPuHOaT+wUTyVsUzq72OgZsTK99A74N/h7aH/y/2Pv0LZLa/jRiswguBULzc4AaEym4rPftc+OedB3HKHIw+6zJIEyZjoCS0PKW7i510ZkGWLPGxddtQsnYT7DfWwCIDsuHlb80nvHq/hXSNHL7bQuxhBMtuEmXVD/tCseUllru2dPU7qH7+FZS++ALyzz0Nb/MWuAPZWem0V819kVNR35ROL/pZ8x789do23PZmCq/t7ERbxwb07n0SmZ0/AvY8BV/rVlTGBWrMcoCOAFyRh6kkkRcJWE4WsAVEWoE84IeWDCGYD0G1FNr0u3C0PKxoAr45HsouCKL67HKUTa6EQBCJ5hQ613Riz2ud6NzQh3w3YAgJOb8NQ8nC0ww4ZgZGPIV8Vxp23ICZNZH3DBj+HJzKHKSJDuQxHvK+PFL5LAJCh0pA2JdQEUyq0Po85Lb1YeDNLgysiyOzPoN0Yw59a7qQfnMfBB2gBIk/YvkQtDSSW4VnKnBIfjsLpHb3om9DC3o3taGveS9ZqXuRT2bhACPAmXRwvD40dwuPY+fz+XrabM/NZDILDkfMw/zHq+4jlTNjxgzQZqHAous0tlQVdFJeCB/uK5FI4KMCFQbPxZN8IWhevUdD1cWbFtIV11U/VPqJiGtpaSn8uzB+kznTd77zHfzlX/7lQfQXf/EXhX8jxi9rI1CNLVu2nAhR/qjL5HESDAYLL+4RYv84OZJCaM7wODkSywlLo3mMHB9sDqMGIQQ0uosLIYbBPcIyooERDXzcGhBCxPnfbC1cuLAAek3TLDxxRfFDisLxvF7xfZPvH7/85S9B98i7isyUXrA8k1uMKrqfeFf6xEv4iRHQJUl420zOET60sdM8164vHT8R3qjRBIRKkK6qRLfmw+iz52HMzNkwbHuRK4RGAyZ9hKI+kNThedMPjSQgVK/URG7SLzgdpd/+CrQ//RpCf/qnqP3KTag84yykJFyYEliUUXRYUvhVS44+bkkVS8mO3hYECFgeWuKHhwttNFLTD/eCrwpCq6G+vnv9O3ctU7ZueyzSn/zvikxmyIMCuTxwmfbFS5G/7Xqk/+JzsG+6CqGzTnvYCJc+bEM9IEyJ8K9UoL9qQu80ECgAUdKfKUQ0LiGosf8D7emw7w6kXbNM6E2VZAXnwpKWWd8JAlCyCyFCCCTCyBLo6vcpyGgKWRRlAm4STJK2229gG/qxT3bnburYh7e3voNt2zYRiHKxslnBr/dIWJVW5prQzTK3t0x3sjErEYe5twXRngwqkr0QOzcitW09CLkuTHvvvxBNBIONIlD9IKaeXVf6uZuXj7rtr1B6zULIFaX3KJK3WXXZUm1CDgWAUJiODiJwgxEg4MdOPbtoQM/eBgOm1+2FuG0lA8HHK3P+B2N5ZbniyGktn4bu5qEptBFR/PB8JQRmA2Q1hgZYDRIsLdGzA9l0FxxiyRgCvZvfQmL767B61kN2t0EE2hGu8yDHbALLKfiiKoKVEfjIEqsJCT5Xh5zSkd2SQe+rnUSEgNtlqGk/fI4PihAwCWznyvqBGgNKlQxPVdDb1ImBxn6IZgfaLiD5TgrxTUmYfTYkW4JsAyJjIrGxDR0v7UTbc3ux+/kO9DT2wBtwoEgS8koKA75O5INx5Px5ZHTA8dFypqhQqb26CELkFQy0D0Dul1BqhFHhMfmhJ2Xk9maR6cjRgZgOlw4APEg0Hkh2KPALXwFIi4QDtzsPr9uAuSeDfe/uQseOdji2C9AHI9cxayCfz9d3d3f37dq1a8327dubd+zYsYb8yw6lnTt3LqOb77I9e/Y08yPDx1zxMAoIh8OIxWJgoEJrHhyHxoN7+I7nDQK1p3DKPoziP8DC+dmq+IGEw0RwXbx5OUzycY9mHTC5pAOul4l/zzaYOK5IzHfchRgpsLBpZcuzoijgMSOEOKxWhBAo9s9hmU5gQo6AM4/T4VZRHP+Up3CQNtx8I3wjGhjRwMejgfr6+rIzzjgDM2fOBN8jhRBH/NkMrz+8DnR0dODdd98Fu2R9vrUo7YetYUW+T5orfahAf2QMvDkoNlkIQRtqUdgnO5IMW5GR8LxYMX0otx+56oChLPWPnthS/tkrEf7mjUh/4WpUf+sbKL/oYuhjJz4s/KHvBZXo8qHyHylOg8mDNOR5iZjnxWsT5NJWrowA9CwrFrveP2NGS/klFyF05Xyos09q0Soqrg8r+j0lino/v/hL04KNfrVkZVQEl5cTGBVCFEyyQ9XpJfL1hZd9JbwYg+RcLj2f+ZyBgZuN5k3GwBuvbUo1ruuw29o9M5OZxWlFsve1G/bLzy7u/bfvo+2Bf0TPb342N7fl3Q4v2f+BN473IGJmy8c3Bc4+D5WXX4aSs84mIFTxqCeFHg+I6NpimexWCnX1aKE8GROibbDsAQpz+uA4DkMJLjU1UJ8lFiS8+OK8l6hXgrQBLs3BiqVgh3LI+WxkYgaSFTmkSnKwtTQ8KUsALoFSkcTEkI3R2RSq1r2B2S+sxMLX3sA5G15CMNePVgJ5zYYC4fo2qFauXpbMWDLmx47aWmyqmoINpVPQEpqMHq0O/U4pUvDNO3T8+P3+zmwk9Gi+IvyoFNPv0XRpSZliLimFtVwr8a+u/uJVML9yHdyv3YCSL3we6tj65dAtAm99t7py/G4H5gJuq6gUaRHWm6RIycMIYalz/ZlILF6A1NXXIfS5r8ObOQdGWcl9rt+q0ZCtL/XaFs7Re3E+9mFephlnJptxan476lIEmDNpCKHAClhQZ0govSiIMZdVo/68SfBHRkGxw1BNP5DxIc2Pcm9OIb+ddLktg663CYz3yJCyPuLxwUdAFJ4DT6aRKktk1aVs3Xn4CGBHM2GUZEMIGwEC7Db8GT+iVpTAtwJzRy+cliRCe11UdasoI1BubTRhNufhxS3QzIThd+FEBdTRGqQxCrrVFBLBPOJqFgnFgBNUyIpN89elQWD7ACKPQL3n+WDaMnKuh7wqkFJNJHx55HQDkBw6FBDQaWZQFPWzjIghI0oUyAAcp3kALCJqEn2PfI5BA2SlvXv9+vX4Uzrwu/XWW3HbbbcViP+11GDidE7767/+a6xdu/aIa/AxiHNQVk2jcUMxJCNoM18AzxQ87MfzPEh0sEPr0GF5jpQQCoVQWVlZKIMt0LIsH4kde/fuRV9f4RwRZOFbQPWfUL2wPCxXsY1UX8HqwCC5SBzHxDpgPs5zxEaMJB61BhQCzTE61OGMrHfWN/sHU1H/HEeWHiSTSfZ+7EQHY6DDrgP18phg2Q5EvOfhOB4rdD88cPjEP2V4L/moHK6Dy2L3SBk5nevlw55sNnsk1uOaZtt24UCD+244BbOMLOtweEd4RjRwojVA4zE+fvx43HjjjYXDZR6bFPeBanld4jHOxH4e93y/euKJJ0CH4A8MzsD5mQbHfdL90iddwOMh39GWwR19UB7aEFlCguGxugwCrh4B2HS1E49/197d4bntvWv4d8xpL12tQg7Tot+mVlZPD8yc1RL57AIErr4CocsuAyY13OOLld3iVyOrDyp/GAEjlZqu7ti9qffF5anu3z/T1//yq63q7j19gXxmmg60luiBx32xMQ3+mvqL7Lpx59pVkfkhzf9kpVCWh977N0cY5sXg3EnEmzPvbG4dePvlvsS76zuknvYVXjI5L7W56aGeZcvR+5tfo/fp32Ng3TrYHd1kWn2/cNFHAGrrBlhrV8J+Zw0yb72O/M7thJqyd5FuQ+9zFnwhTcS+VVoxQQ+PbRDhyjEiKgJrGdwXUo/hK+1X4nkt1KFBpHXDqVZzxoJyzXtwZqUfp1UoGCX3I+ztQ6XXiymhPObUSDijApitGjhTAy6MBXHBqAhiiS5EN2/AjI2NuGJrEz6z9RnMSKxHjdKHMFk7VUl/UrIlWJJbs8MXwHNlk/Ds9M/j2SnXYnXVhdisTUaf5JubhVyfBWqKTeJDiZSdn+sqVm1eV+KJYKgDeqTTJ6ItPsVrkv3he/Q5Mxtx+UUQVyyAfOZZyMSqb9DffBv2Y7/DwBNP3t7f1PhYKptdVCyTFiBzwKfUGadPhfjsZ+C7isDzJZfBqhtznxPAWtmK36qkWh5T2t5YWNm6FtN3vY55O1fhM62vYGKyCRW5HgRNCR6iSOsacqMtOFPyBKIdBCYGAH8UggqSDVJQXkV6TxpWHyHJNOAkHcT39MNJuRCULhFQVQmw6pZKFl4VEAQGFAmyXwHjAtl1INlEAIQmg/l0yidMGel9/fASLoFsDdF0EKXJELROGVI38VP5iqNBEQG4kgR/VQBl02LAeAVOHeCNk6FODCM4sQJuRIcrK3QAJsMBkSfDlmS4ugqpNABtbAmSIQf9gSySvixMxQCEDX45oOoAOlmlg7aKkK0gYKrw2TIYPMuuRAAeI9cxaoCsuXN7enrw8ssv45VXXsGqVasKLvsPJU57/fXX0dXVdYy1Di87bwqYk2/6TB6BYyaOG4o4jfMIIYZK/tC4aDQKfkxcluWDeIUQB4WLAf4NWVEXlKdZCBEvpp0ol9tYpCPVwTysC6Yj8Y2kHb0GdF1HRUUFWLesZ6YjldLb23vgkOVIfCcijcdnf38/aHx+aPF8KFBSUgJVVeHz+Vo+NMNhGFgfrJvDJB+IZj4O8ObeGvRGcI47kcT15nK5Dz2MK8rAbRmO/or8I+6IBk60BsrLy2+YN29e4X5Fc/Ww1fFYH5xIFmc8/fTT2Lx5Mx+qraH0GI9vuncNZvuD8Et/EFL+bwspJDieAps23oARt6y+6ea+to7spjfvTaxegey61+ZaO3euVwcyD8kEHVhcGgymXDWmITBpfF1o5qwaa9zEcC4UuZ/TPgJBSiQ22S++jP6f/xK9j/4P+h57HJlXX0NwIHFvdNCmSYRKVmZ9vngefggjOx4AABAASURBVLAMR1sXDWbNiWeXZFu2I77yefQ88Wv0LX8S2fVvwEmmVvS//Rbizy2DvepFpF5agZ7XViHT3nagGsofgmuQhdyEI3twFQHbteE6NvF4YZKJYBZ53/tUErCPqepqijffizpujuWzY6wbH8KNuqNthqFqIVu+/4LSMnw+FsUCux+nda3HRd078TnJwI21QdwwMYTPV/qweFQpFtVV4+yaWItsDsDJ9iKUGcCETBwn57Zjvq8NF5WmMCMqCJKJDg+h1abQ+9qFhpf1GgLP1+CFaZdjdcVp2CrVwPJENeiSAY0PWbx8oh7CqlHtfL1h24u6PNy+FfpDe1z3xrTnVQsRjcMXXW2Vxa7CpMnniobJZ1ilFedaqez9wd+vhPTQEiT/eyl6V7wAO5d8jIo+8Mm5erUTrbwzOPnk60tPP312dEpVGfz5PtnpfEhONi129rwGZ+sqGG+tQOmGlzFzyyrM2/w8gp1N0LID0B0FcKPISgFkNBvZYBJGuB+mLw3CwfC4xY5MFneJ/B4cQUR97aguHSA48CjsCRKH5ovkafBZQSiOTvECbsBFeHwAUqUNO5KFHc7Ci9nwjfVB1iiT7dKY8WBKFgxJkN40eATAVScEjUCs6gjIBGhVW0PQKIFk6fCHAihvKEXs1BgCJ/sRmRVB6exyRKZXQ6sMAroEV9BYfI9syYUcURGsK0X4pNGQawNwRklwqgCnlOrWDFiKRXkcSAABaYnkV6CSXhQCzTIExcsAuRi5jkkDdONsJjpQBq0ftHZ4B8KHenijyzyHxp+IMNfD9THR+nREuYr18yaXeYvho3FLCDjU1taC83OdTIfLzzxtbW0HDhJoA9NyON7jFc8HCMVNP8vGdLiyWXcMhlgfh+MZif9oGqDD+QPg+XAlsP6ZOJ3BMxM/ncDhj5P4YIwt3zwWeMyyTExDycCguaqqCqFQaKjko4rjccf1HSlTcfzyuOanS47EezzT6MAQDCKGC9hZd5qmHU8RRsoa0cAxaYDm6NLRo0ffM2fOHPCcHW5hPM82bdqEd955B/v27ZtLc5C2/yo+bK4Ot/yPk0/6OCv7Q63Low2zIny0Bw/Cbyl1ipH5bmrtK2h/9D/Q8s//H9r+5Z8x8Nxz8Nr3LvTD33lwO+U0bcHrZJh1BBQPAo4H8x055Ozbi9zPfgrttVcQercR3upX0PXEb+B2d1V7/cmDHoeOAc38aPORSxw61bKSs+x414Ku555G/OknkXl+GbIEnnt+9T+w9rZqub27ofV3YZziIpTsRaJ1BxJkaaZJMZ1LzFnJ6RhVCWvGDPRMOwVbYpUwTzsD6oyZQCA8l3k+LtIUo5lu1CH0ADkj0pTwlaxLyv5ZY/WSM76ghvC3+TS+8eYz+Kst7+DPjTS+NDp8w1VTSm748twxd3759Nq6i6ZUixK/dn22IoLeiaPQXluF9soymCedjEXnz8YXp9R0nhSU6lKuvMhRq74V8sfuCwkZjqpgcyyEljI/9vkAw7UwWhG3hWE9GwTZn217ugOnQQRLG/MIYldWnvta3MDzAzk0Zd0HUhb2P4othBkQATqZUNIS0Kc5xjSnp/fGyMbNqNi1G5GdLXBeX4VAthOmmTig21Fy5JaYHLsvoJc8rqpGH5Ca73e236/GX6m2dzyJ3KZnoHXvQGrzJmg7d2Dcvl2o3boG+bZWmNksCMJCNgWBXh1qXoFqCcgeSSzSsKReeGoekupAkJU2Vh9FLuKgV00hHTbgHxeAqJRg6SYBYBOSrkNxQwSAFeSFgXxJDqFT/AjOUqFOA5SpApHZFJ6pQ6og4KxR2RELwall6As76PZZSAYkpBWADN7wgi5k3YNGFuDQQBRhq4wswVQWxVfNrkTV3BjKZoURnOSHXKOidEwYml+iNtkFYquyJ5ng32+Hx5cjcMpYTDxnHOrOGI3KWdUITI4hE7IwIGeR1SwQbocte3CEIJLgEGy2CyUp8MjFyHVMGqBNbgsRJIn6iHRM8/WwIJXTLIv6xLaPqc7hZuZNNdfHm13OI4Rg54jEm1xuyxGZDpMYiUQwZswYCCEKOqCNReGxaG43hrho88Gn90OknJgoWuMLj/+yXMOpwe/3F6yIw+Ed4Rm+BoLBIPjxfrx3CfHBcSmEODCOGKgNDAzwi7uWvZflY3Hy+Xw9P6aZTCYLsgghDluvEAJsUefDIx43h2UcRgKvJ0eah0KIwnqD9650Og1+vPy94Al1aC7HuD7uE15fhlMZHyqwTlifw+Ef4RnRwMehgXA4fPdXv/rVwpu3h3vPE0JAURRs2LAB27ZtK4jJ857zC3H49aHA+An7kj5h8nxCxRG0ZVah0Z9qiz67ZfvCvjWrYW1aj/pcCrHOfci89gZSG5rg9vffjUOuCNJNZUJvOiT6qILCNiGnuxGwkwh6Gah2ClamF2ASdjUXlvC8GL/lWhDo4jAt1CHPSE03iBJedm6nZ83f53nzusmyyemHEvFrkmfUIp+FTECqLJlAZSaF0ngv9L1tkCUPFaMqUF4ahEjHIVtpjK2tRowMm3nhhLh+WxWaFw7cF5pzBib95Z2Y/48/xNhrvgiMn3QPIpEPHB7wI+Kcr9uz5u2z7cXdnl0AjofK9lHCNlJ3JKzs4tfsXOq+fcnWBdsSq768O/27B99qXvP608/C+PmPcf7216G8+jg6Nz2NvdnNSzZ6/Us2ZAbu3ZXKtA4MWN9V1UCzUjLmzqmXXovZN/0ZJt58J2r+9j8RO2Xek0E1cpWcQ00OUllc80/LJa15k8nSfm2twLRRXSgb1YlTGgzMGysh2Be/s9ToXSzsxGJbseqTuj9N/TBvdY/0yM/fzuG/nu/Gkhf34Im3e7GlL/8I90WxzXTo0lgBtIVMs7MkIGPjOBc7xljIV7ogGzUMNYOsnF+U8ozpxTxet1ftpdPz3XTfMrt3w2Pe9ufgbvo9tD1rUGp3QXLyCPpC8MsB6JaHEseBHfYTWJRoo2PB75mIGgLRjB+hXAn8dhg6XEAlC7SchCnngaAFrS6EqtklGH1GGWrmlKPmtCqyJFuwgibysoG+ZB+cvAOaQCSngX7K3x/ugTZFQunZUZTPK0HJKT5qSwq5UAYZPYOEPwOnTkPgJDoGGhdEskQgG5MRnlxB9UWRgYWubXuRXNOK+Bs7kNnZASczACPVhqzdAUPqhSP64dkDyOcz8BwTkmeTCEwWuRYSA73o3bMLTs9uuHIW/hIJkbooAlOqoYzyw4oKZDQbGdlCXvGovSASBaKzBHiSIFUzkTPyORYNxHmzK70HnrkgGvvsDElZOtzhzSfR4iEZjmMkb/q5Pi6SZaJ1lebG0H3OadwOXdfBLuc5WiorK8PkyZPBZeC9i8t9z3uQw/KwNZF/T/pxbapZH2xJPEiQIwQCgQAYxByBZSTpI2iAwPPysWPHwufzHQQCBxfF44MPOYrjJ5VKoetj+rlDUY6BgYFmBs9cN8vCY4HnRlGmIh+7LC+P++nTp4Pax1EfmbgOPx3c8JrC5R5aUDGOeVRVBY/prVu3Hsp2QsKkj749e/aA1xXWyXAqYb0dq06GU88Iz4gGjlYD48aNu6yhoeGgw7wPK4PH/bp168DvOqG1YS6Dac5TnJfs/0Mg6Q9ByP99GT1IwqUblQOIfF2unyx9qW7AGIBspuBHHnmKy5FFFlb2wO9PQZcQ0bgQlR8AjZR0VJ8E3QzStePRGaxCh1qN/uA4ONWTgYoqGD6ZrJNAVIj4YIsz3aTS0HKtmuZ2yHBbNSjNPqCVKq4h4FYAu+Q/6CO7Why6D+6oUcjpUbhSDKo2Gkp4PIQ/hsi8z0D9yp8i/o2/gHPbd6BffQ2UhomAysUYMQERd33RpaKi7ozA5NlXhU6aURcbXSuidEpF8pjMxWC53zNnZdlamnNCLHeAZJNkuQXw0pzOfEdD+UxmgZfpX+i89brnPPUbz33hGU9PmQuf62x96L/37cTjbT1Yv8XE5g0mXt4+gBe7urEj14tIPoGMkLBNDuLllIxfvt6Kn7/RhX9f14X/bI7fuyzlpHYJ/729o+uRJws6zpuH0ORpIhwpuT4Q0NZGA2JtpSTdG7FcsqCZ6aqovPzisTHcOW0U7iG6ZdponDmuArLqe9wVXtqTzVrJzc1S3cxME8ac7XQ4sTGTxc6Mi0SHDaWpG9q2Lhh7e/qcRNfdxY0x687RRUtvREX5wm9Av/m7wK1/jpobvwwtECFwq68NQeO+ZatVyFU3d7g9y1d4Ox6b7rY8jXz7qzAT22Hb3bClBAHZOALjFajTfDBP9sMgi608RYVRkUfKl0FOcshiHIaSrQJ2BWFvsOG2SPDlYtC8IPixbMvnwCwzIU8B/LME/NM9qFUmFE+CskuBtFqF87SM9Mu98Da7CHZGUJIpheqosAis5qlou0KGHPATDo9QvgAEQXTN0aFARtlkH8oukBD5rIHQAhOhk1U6tKE63zJgveoh+66L9CYTPY1p9Gw2IFOBqlVOczICkVXhJWygIwXbysJS87AJzAu4CJh+hHuD0DYBued70P9iJxJvdiO3IwMMSFDzfigWbUwdDY4jw3I92MKFK6g8OCSjB+FZAFyikc+xaIDGdeGxbb5xkh+SJB0RfDLfAFnRiJYcS73DycvWKKpnOKw85wpUWlr6kTf/0Wi0oba2FpqmFU7nWReHq5x1ZZEVnjfhmUxmLdFxO3Qcqk7a5NzKuqDNf6GdClkPZFkeirUQx/KxLtiaXogY+TpuGvD5fLex5bmkpKQwTnhOHK5w7gceR/y74x07dhyO7bjH83jZtWsX6JCrMF54w8yWVnaHqoxlpPEPfgyUxsxtQ/EMN47HZSxG9ymaR0fKUxzDnZ2d2LhxY+Gle0fiP9Y06qcYryn8e0+eu0cqj/uNifXCIJ90wocltD86Uq6RtI+iAdYx6/qj5P1jz0OHOsvPO+88MJG/sB4dSZ80B2hP5YDvI2x55kOr4jz8Q+sD6Y+984fXfo+2yS5c2kBDdk2EQ3DCUeT9ISQ1H5K6BrckAikSBDR59fDK3M/FQJGJBlUoZRjT7VRqkZdILLbIasjWYo5PJLwYSsuhXXopMPd8eCfPg376fJQSkJWqRt/p6moT8Wn7Szz4W4jKtCAAHxKhzpgQbUw60BoAQqqVa8h4mcKbsgv5M5mYDcnM0wZQPv9sSOfPg5g3D8r5F8L/mUshyspX67NOFdrl196GG76JwJe+Cf2MedeHq+r0CPyNUeFrCYtwk06kadG1ejDyZKDw2PHBMuWAhhy8aYakVMNRw5zKLzWrFmKt33TjWj4zy+7vXOIN9H6XdBHj9CMRyR5yXHNBfO+O33Wsfg59v/k5zCeegrthoH7Dlj682p7Gtj4PXgeQb8tiW8bCi6VR/H7qSXi+/iw0TzoXm0qmYkU8gOebDKxo9vDrFhs/3ZnHktYsHmtO4HftBp5N61gnhbHN8+7P5VBdlClKhxZBTWvUgsHGYDhw09TS8IzfNMvlAAAQAElEQVTrJ9SIr4wprbmytkaMG01ajwaXW1J0te35N8NV4rrjpv2O2xYiQBZSDYTlDKqMAYx59x1El78ILH8ulN+89i5XStxSrEfTQq22T2usOPOqe7xrvo74oq/AuvDKRxW96nrNtk0n37vQzOx5xOrdmHI7VsHZshzmW8/CWP86vO5OSHkDwnVgw4AlJ6GN9uA/SYd6RgTevDL4xtLICLkwZQcmgVfX9CHdaiOxMYXkWwnEN+SQ303SpBRIIHBKq4dD1llBPSRXCsgxF0KnEZSi/HRQYbzuQlqjI/92Etn1aUi7JJRkSuA3/ARBZdiKDNfVIBJ+aLt98PbIEL0a/MkIdAK4kVIVkUkeQrMtBOmoQask2TpzMAkwa7t0SN0q3E6B9C4LA9RfUiIK1SiDlArB6vKQ3p2C05WHazpwJZq/kkOg34NiqwhkAvB16nDeNWFszCC1MYnkpjiy2+LwaKzohgaNwLPskkzUWggPQjgFkuEBBfBMLkauY9EA3TjX6mStZRJCQCLwLITA4S7efPPjyvx738PxfJR4AqFzD83X3NwM3lgLcXh5Ds3DoCYcDheiaV2KFQ+/ChEf8kWgqIXz8uaf9cDsVAaNuaHrZx5+adhbb70VI718QH7Of7yIdPFAU1MTEolEAQwJIQ4rlxCiUC1v+INBuicWQiNfx0sDxXHCY438QxYrhCjMJR5LQgi0t7eDX7ZH/bcEh1xHM0YPyTpkkMtLJpMPvPrqqwceh6bxiSJ45jF9aEY+MOInL+rr6x+kOfDgoenDDVPZMW5zdXU1AoHAkGNUCFGIZ5mIH3yw0NLSwr/BXEZgf/Fw6zpaPir7Nl673nnnHXwYeOayhRCFNvA8orbcwHEjdHw1IIQ4vgX+EZZ26qmn4qyzzgIflvLcY+J7kxBD65bnHP8Uavv27XjjjTcKh+VH4v+kqlT6pAr2yZJL0GZfEOQgdalljaH6mU1iwixkx56E1LiT0VFWB99JcxCechLk0pqbjkb2qBDxSNKI0a5kcaBvzybs3f6Ys3fbEinetiKSzcyko9u6SATpaFnNjFFfvG715K9+AZNvuA6Tv3AtJlxx6VI5Un4fwQJTCGEOp14G6lxnMJut8WXjd2m9e9bnu7d4Xu+OlC1St2Q1Z2a2rOTx6GUXPlh165dQcvuX4fvzzyH07WuWKjUV53IdgXD4wVHVo0VNrFqE9fDjXDcTpw1FbOWmzWmtl04XACdpsU+BtlbJBVqcrDYzncvNpwmledl4bSDdf7vSvmeF807zYnP7nnudRK6V0/glWlzOUOVznCLJK1s3bcLGt97GdqKBNxqRerYd6iaqqa8KsKvguTIG5BT2Rj2sqx+PR866GnfOvwNvn3EDdhN43hCX0C3VoM9Xg36lAs0DGp54O45/fbEN//pSOx5Y1YEfNfbj1bx1OyXN43oPpZAQnQ7Q53V7oaDhhFj2Ik9WCa6FFF0irJKHVLViaZkSePycUAgXhYC5ag+mK82oevd5+Jb+GLkH/x8dAvweUjZ1ezE/6Thda0nXD+h69bZgGGvlEryUDt2YtGKa63Y9JhmNS5BYdaNJlmbz9ZXIv/Iu0qv3IvF6L3zdAQRTYQTyPui2ACFKSD4TwWoVsYYgQhN1BCQClARsdbK66gQcnZSN7ne2o+vdnehrG0Dntj50NO5GrjsNhXSpOKRbm0CmpUM1NbL4alC8AMy+DPr2xtHXm6R6qC5LRf/uXiTa++CZHmRbgkYANmgE4U8E4O6UkFuXQuqNNHIbbXgdKlmnSyAMFTAEPGs/Ie8gncwhn7cQ0BQEaVbqtgXZsIGUBa9rAG7KRb7HQHxHH7o270M+KyCbOlSbwLarwBEe+GVgpmLCVR2ougq/FoRsaTA6SYYde2AkqX3UiaoroBDpigoZ718eewV/fVQayVfUAG3+W0I0B6qqqqCQNZM3tEzF9ENd27bBJ9ZsvTk07aOGh7LaMshobGzE7t27D9zcaS6Daah6aG4W+CorK3nDu5Z5KC7O7WP/cIk3FYP1QGUUQBC7g8tgOVRV5X/bhZ/+9Kf86OldZO17YDDP8fJzub///e/x/PPPwzTNgg5YzqH6ieWU3jsA8fv9YFB0vOQYKed9DbBeR40axWOtAATfT9nv437gccQbWR4rDA6fffZZnjuLu7u7C0vYfk6wJaiB7s8f+fCFwXIxP9UVGxgYaGaL0hNPPIHW1lYuvzBmuD6Wi91DKUBAl8EzjeljGsNUfuFnIPwEBx/cUPjQqgr6Yr0wgOX1hMc06QSrVq3iebRk8HrA7RlcAIeLbR0cPxw/Wdvu4rXr3XffPTCPDpeP6inIyW9VZ6I1cunheEfiP7oGWM+HW8s+eql/XDnpnicmTpyIurq6QsN5/ef5VQgc5ov1TgeyhTlXfAklxx2G/RMZLX0ipfqECSUkAdu1kLMMXtBMuXT8jMmXLcacP/071N30F5h++10Y87kvQ5t68n00AEJHI37Cy9cbduIhb+umh9L//mP0/c0/IP7X9yDzL/8P3tZdD3lW8h8GnOyCnoB3aX+Q0M4pU+5Rzj7tYXnGpB8g5HtvQQ0Ou0oGzgXmbPp24823F/Q9/DDav3MHjP/4kSa92XRXYCC3KCakO0ulsjv85eOv8o+f9gNl9ISlSTmII4HXQplDfGW9bG0Q2QZNzs6CnF3gZLtvrUAyXilES8hCSpZFi0+O17pG+71eurvVerfxxo77/i+2/P3/RcsP/xN9z60MIT5wq7CsmiGKL0TRDTItPCdmewIZ2oDHfTr6QhpQkoMUAYQi4LmAq6nQQz4oqgxXDsGI1GNX9RwETz0DtdOmYlRpGaKagCwMeJIFwk0wCSRaSgQpKYpdho5XunL47427sSmTW9LnGdOpv7WEl4jhvYvDuoEQ5NwCiCxZ9ZMHxoMCEJ8ep01lJ8lsegSw68O+hi/OHNP0vfkN+Oo0GePlNuiim+pNItEfh2N775VcdHS82dN784/WdODvl/Xhh6/ksGl395L0nte1fMtPkNr8IOTel2BvehPJN5ox8EYP8mQ5Tq/bCycuqG1hqEKDrstwZAOGkkJO6UfK3gvJlglk+gjYalAcFY7hEL8MTdXh1wIoCfphZ1w4eReClCOTbmSH8hDQ1l0fdEeHl3Vg5Ex4skvg3CPsy7pUIZHOheSB9ANZkqFDg5cUSG9Po/vlduTeyiG31kDfqj50vtYOb2+GQLGAJnT4FCqb6pcIxJKIMKhvTJEn+28WCgwCuFQXyQLJj0z7AHY17sVusiIbCQ2SHaH2UJvpQEAQjyPbMFQDhi+PvJqH4ZF8NqCR7LqtQbUkagegOh7pwIPkuPAMi9oLCA9UJ+Bi5MJxVAFtDDFlypQC0DrSRkYIUaiVN6AbN24s+I/HlyzLzbR5LwBeLm9gYGAZWYcW82Ou/f39cF0XxFMgIfbLwHyDidO5HSUlJSAA8OxH3WBTXoTJci1J0oHiWSc8bw5EkEcIUdiAx+NxsIXvW9/6Fl577bVbaYPeR8mFD4NeBjaFwEf8ImvZ4l/84he3MvBiaz8DMpaNdXKoTFwFp3EbivrQdb2F40fo+GrA5/PFecPKY26ofuD+sSyrMHaLNTOQ5XHyk5/8BE1NTR7H8zglkLl88Pjn+KMhkqWF+r0w7qiOvqeeegrf+9738C6BRBqDBRlYRiHoPuwVqv1A8dyOarIW03iJfyDxKCNojC6fNGkSuEyu99DsHMckxH552M8W4b/927/FkiVLsGPHjmUUF+N8gowb7B4LsY5JDw+sWLECv/71r8EHGTYdAg5VJs8bJqqX95oYPXo0amoOu/UZqoiRuKPUAOuaxu9R5hphH6wBnm/XXnst7Sv1whMmhxvfg/PwCyh53tF9C+zncT84/ZPuf/8O/UmX9H9RPs+zaeNMFi7Y70tRWdOgT53+sP/00+GfdXKjNrp6tr8kcidNxPT7TB/uk2Gn3b7e+X2vv0pg5zXY296BtWMj0m+uhvnbX8Pt2bvQ53lpzRNteRHabAZKHpfLqm4RZWV3iGB0OdeQBT60TroZaMzL5CW8mNXcvHjfyy+i6/nnEHzzTaSfXY7ss8/DbWqep2fkNLXDlL3wakeLLjXV8JN5BNI6jGrOP1ziOl0ycSrZ/u/aLZt+N/D0bx9p/X///kDyuWf7zJYtnj3Q2ZpsfGdN88/++5F9v/zp7ZmXXoC1aQP6NzRC6ulGqnU3ena0wM2k77ec/KUh5Ao3tEPrp3pCBGhiE2bOQsO8C1B74SWomH8eoudEMPZkHaUVOUD0wVMdWKYDNSehnKyqU1ID+EK1D+eM8+G88To+O1rG3NIUJsh7UOa0wmfuhWz3Q1Y9uLJAXpbRTwB9KwHozryNjOvemkOS3xt9ACD3A9UE0GqgZKtNWdFyUEN474oJ0caHF6xbjhKVIq1H0Bb2S98aX+Y3T55YhZIZo9A9IYq+k8aj7JKL4PpjDzNvkQZkc2F/bxt6Eh3oyPShrasVLVtWI7nlBWDvG1TtDih2F7z0AEQuT/KTZiwPuVSGQK9BVlwHjmXDchwYlgObQKLrUemeBEEWYdkllyCiKxyoQfIHBRyfC0O2kLZMhEvD0EIKHAq7wgZDCckVEI4Ao0pZkRGIBaDEJJhhA5lABlktD0QkKKUKhN+FiSw814abNWD15eD1OgiZUZTZ5QhmAzB7c0h0dcOhAytXcklWGxbxE76FXqFDKpeQUFNI6VS2z4QIA74SjcoOIL5vAF7CQsj2wZ/1I5ANESD20fxV4UkEOBQXedVGXjdhaAZywmCxIXkKgXAFlAQaJpBtFyq1TpcUKIL0gP+fvfcAsLO47sV/M1+9/W7f1Uq7aosqqFBEE02ALYwBE4vYgfgZv5eYJH9wXuwkz35JDC8xaTh5MSn4JTFODDbFxoABUQQGRJEo6n3Vtmj73n7v17/5n7lixSJEEUgg4v32njvlmzlz5syZ+eY35967h13U3cNyJpIfUAPJZBInn3wyaBN+iAPNkUNxGZFpSTTXQV7hKmD8P//n/4jnnntO9Pb2CrlBleU+DA0PDwt6kIt/+7d/W/7Xf/3XkCfjIQFn2eZY+E78NU2r/miKBL4Uv4s2Y6PvVPbd8mX9JUuWVD8CRzwg+3yk8lImRVEQ0DyWXjP5Ayx/9Vd/hT/4gz+o/da3viX+8R//URDgvXHDhg2dBAbEwMCAkMCadHcXbeRvlqCYeFQ/Vk4AfE1PT48gb7549dVXxQMPPCD+5m/+Rtx0003ihhtuuOuOO+44pAuphzF5qP5Y9FA4lie9ZWk6SCAP6c2Hbk5EjpkGDMO46YwzzkB9ff078pRjITexY2NGBynS81wFiBLc/u7v/q649dZb19D4CgK84uWXXxbkMa7OpxwdIJGdfG/MXih+M1E1Le2FDlIEHTCJp556Svzwhz8UNF86b7zxRvGHf/iHoPlTBYjSoyTbljYs6R0FpRvSi7548WJp7xlKgmQ/4rNeihHFTAAAEABJREFU3nsvonXkpjlz5lTnI9nfEYvLeTOmGznPqD3Ig7J7770X3/72t+U8GpVz4Gc/+5kgj3S1r3v37hX9/f2jtm3f9YZevkc6uZHoZqmTUbpoLgo539asWSMIKIu/+7u/EwTK13zta1+78V//9V+r362WhxqyvSMJJvUl70mS8enTp2PKlClHKjqRdww0IO1S2sKBAwewevVqQQeR4pe//KWggw7x5JNPfiQkbaWrq0scg+58bCyamppukh/dXrBgQfXw990EkfNN6l0STRnIOUfPp+qz7N3qnWj3+Ikm0IkoDyO3pcY8GMw9JB4t0LvVptoblJktjLfXL2Y1sfWHbh5FJFYSdWGphML+vfBH+hGWCOQ5OaAwDHvDOoQE8BThZQxFf1rj0bsTzHjbr3aTF7f0Xk0Ok3NNeo5p4Z8JpbzIGjiAyoFeBEPDiIzS86qvF5Vdu2D39sNjrHrUyVIso8f09aHQqG/meoWA/nu1M/6+bJOD68WerhVDzz+HkQd+Dv/xx2Gt/AX8zWtR3r0Ovc89itIvViJPVHh+Naw9u+D4FZRI12Xuw+UBCPlAJYgTQYQExRGvkKvdyZb2M6ecfQEmX3YVUpd+CtrsVrTPqMWMeqBJyyEq8uCEJeEoSJPH9LSUgi+exDC/ycnMjju3n1cr8LmTYrhkTgwdaQeJMEseSTqaCFzIhxkIMPlCoJSx4XsklwAEHQ4oCBLjhXIZq4UeltzAdDm4TnV1YWWWFjs3ieL2dcLu6aTjkJz8qHqcTtzahCpc3Yx8o6apDc3LlyP16ysQ/dznEDv7PHh68u4x3sQn7pP3vlVk0Op1o9HdiUZvK8ziBvD8TrDSELjvQjABNWFCqSHAmA4REKn1KoTpI1Bc+HQQ4AsFoa+Be1HoXhqGX0vdMyBCgQA+fPLOiriH+PQEEjNTMKdEEJscRXp6DdQk9ZjmQ1WZjJQiOCmCQcg/JSDgrCI+LYrErCi06Sr0aRGK18BojcA3LHiKBcFdhIED3yUiXXIBqCQTJyDukr7LXo7skOabAjDOEEgQowPxyTGSKQavWaBY68FpAPQpMSTb0oCpwyo7YHaIqK8i6qiI2TqJyREqJJ3BoNfoYCkO1wxgaaQLCn0tRMBDCPpjNL4qaULKw2VIBMoj9wkFJCS9IC/GIG/hk3SdoLJKwDh//nxEIpF3lJBs/9A93/erYO7HP/4x/t//+3/453/+Z7lhX/OjH/1ISOD3yCOPVDc/ctMrN0MSEL/00ktVcCABgiSZ/8wzz4hHH31UAofOHxIAkJt+Sffccw+effZZ0Ib4UJtyIytJZjDGwNhbicBM1Usk+yCfDZJk2aMl0kVm2bJlkKCIk/eZMfaOLKRO5MbPdV3kcjnpecaDDz6Iu+++G//5n/9Z/Ti33LBL/RCYxj/90z/V/su//Mu1RN8muos29qO33357J+UvkWUoD9///vfxgx/8oAqwpB5In9iwYUOVv+z/GMm2GWNVPUgBGWOQ8oIujQ4S5CcJamtrEYvFVlLWxOsYa0DqVc4Z6ZWUNscYq+qfsYPh2FjI8QJdcrzkvKFDJtAhCZ544onqpvUnP/lJ1U7+/d//vTqXpA2QPYDsZTnRjWQXY/bybcq/kfKuJVpCcRDolvMOP/zhDyHn4r0EPGk+Yf369SBASUumfNhS44e9GHvTbqSc0l7a2togwbMsSrLWWpbVIeMfhOTcmzx5cp30ZNN8ehsL4l9dy6VuxsflXNq+fXv16wnS9qUXekwvcl5I3Uiifs8kupZ0cyOlv0ehnE9SJ7WkGznPqrqRdWlNwv333w85j6ReJECXbTLG3iaXzGCMVcdR6kQejkm9yDHGxHXcNEC2Vv3lZ7lWynGWoST5LPgo6Oc//zm2bNly3Pr3UTCmeXZ7e3s7zj33XMh1nzH2vpotFAp4/fXXq+uFnBfvq9IJUoifIHKc0GJIJWkEKAzmyEU3/m7CkgG86/3xdams7jPWDLlpJy8CiHwmEBJYUAwdQlVAuxNoGi9Kj2UzY4c+Woj3uCRv+W+gyCXT5lmlZYQxEEU5HiDoCH37DI8gErl6oESjBBzI0HXZQwE/IHTgM308+5Rp7iYYtDLO4gPj8w+PEzhvHhLuIvlx5owQbdSmKzxRN7ijEwMvvgLn1Q2o7+lHsHYN3C2vIL/jJXS99jiSO3rAtu5HcecelHIZROfPhNveCH1WG+Id7UA88l0F6iuMsdLhbcq0zI9E4iv1aGqtPmP2fP30s79SmHvqyj2sFUKpxfREFItqgGlmGTGVgBS5MHU9ifbJ9Zg3g92dSrg3R1i5NM0Q3710VvNDy06dipmtKURUEGjn8MlzK3yAkWo0EaLWFUgJhgj4agZjlHlOXOTtmVLnCqALJdA9hW9TQ3WAlZgR5kZuDffvfL741APIPXoPKq88g2C0a1VgZ1aQe78lhOr6PPlCGG09s+GiK66a+cXf+saky1Z8hU+eOR+q2gW6hMjXBl73rarVv+xkNoxzw704z9+Ec7XNOMnYg6RSAAs5Aj8KV0ShtTZAI9CrzNTAZ3BE5iSABgHX9OGbGqBEoIYJ6E4aerEGWjYNENgMafwDkHUYDuxIGYmT4qhdUI+6k+vQsqgeUQLFPE5AWQRg4KAAUjfwGUA5IfMQxALEqFwDKT29KImahXVIn1wPo0WHp1QQqB7Ztk+aCgjQh/AjPso8jyLyKKsVeDEfvAYICdyClK5CBxcamMIRbYwhNSuN+LwEeEcEWkccidl1SE6vAw0IGI0vwpAOEQKY1BeTDgNC7sHTvSpoTk9vQHxKAiKpQHqgPdKHS15om7zQLskVcgHGOKqXEAhpvOWBQkh8QGmA7subsrsynKAPrQECAnfPmjULSfJAy00jJ9B4JKZhGIIxaXsCJTpwJC9ZFSiShwg333wzyBMNGf/7v//7KqCWwFpuguQmVgLCO++8s7rRl3GZLzdKEgTI8n/+53+OvyLPrQSd8mEuQUYQBIfEoLlNw09jT+1L+STJm4wdNIQoraPy3+zIUOZ/UDJN8zrpeZbgWVEUMHaQ/+H8GGOQHqzxMvp0qCA3I+TFgPRE0yFCFQgTSMZ3vvMdyD5KPUn6sz/7M/yv//W/8M1vfrOqO/IcSsBUBUOynvzILXniITeWUu+S91hbYyFjrCofY28NJZiTfZDfYWWMveOB5+F9mki/fw1IvdJmtW7mzJlobGysjoO0ScqvxmUouY2FY2M4FspxlV4f8qZWf7TnoYceqs4NOkyBtAXpfZU2csstt1Q9sTIt7WaMZBkCkFVg+Nxzz0H++I+0FzlvpF3SoXB1vkgZxkjOIRmXMklZxyidTmPqVHrmzpx5Geii+xmaR+97r0NV3vaSPEg/II9YVR+yAOUdiktZJMn8MZ3IQyhp2+VyGf39/VUv8WOPPVZdY2Rf/+///b/4y7/8y+p8GdOHDCXJtUeSnGNyvv2QDhRWrlwJ8s5DfjQ1n89Xv2Yh25TtyXaPRFInqqpCeszlejhlyhTIteBIZSfyjo0G5HjLrwHdTYeO8rBDHijdd999VduWBx/Hm5566qnqYfCx6c3Hx4Xm7N0XXnghJk+eDHmYLG35SNLIOSBJzjU55+SBkny+HKnsiZz3xi7xRBbxBJGtihJoA/4OAG5MSlqgjwjwxu6PD6msGxA4UtIpNM6ZAyuagG+m4KtxVLQ4kqedAa2mDha0urwQM8fXfbd4xa0sCazMlSg6X4WTu021i1fCyizXPa8lajhbuYZtsRnTYdc3oF83MFITx4AZAWtrR2TSJGiIdB7OX37k+PC8w9MEzgnmuLUqgjhhn4zsHw9Ebe4AYe6ChVY9iZQVQh3NIBjuRSm7H/lSL9LkHYx6JsouQ762BnNu+ApO/Z0v47SvXIcZF50PrkVui0TiTx/e3vg0tVUi8L50VNc/vYvpP3g6oy3/7roYHtwcEvCK49Nz2/DpObVIGSB+cQJOdeim44Q9Cr+WdLCswiOuCq0TXNkQielQEymEkUYESh3IhUtNmUQcSUPFkqZatNLhhu4rGVjBEi3URmHZX0E2f73qVuZpgGtpWqdpmV16KBx2YODrwS/uR/7+H6H/x3di8IF7YK19EcJzlidUc30N09d70Po9LdmpxmoeYjV139XjyTvj0DtNGn1HjM6D0/8gsjtvVPe9ivq9r+JSZz++mhjCF/W9mCn2IuIXCcTq8P0ULNdE0FKD1GktmHzRFLQubaKDiAiCuhAeAdVQ4+A8hhivh1ZMwN/PYG+24fUWwB0BRVXgcQ8VlkcQrUBvEgSaNRhTVLjxMukjgCYMcE9HmAkRZkPAUqDIPEUlHO2QBXhQpiiIz40jQt581PlVr3Oo+FA1FQIh1JgCkwA1axUYTZUxGs+hlC6DtXCaD01QDAV+hfiXVWh+gtpTwVWGWEsMk5a0YfrFJ2HKuVORmlcP1qyDRRxE6jjxJYhLwJsTKFbpEKBiFlFJ2FBbo6hfMhutC6YhPTmOIOIhFxaRV/IoUz/duIfQZAgIQPskoS+obQCMc0jgDs6qmy8GuqpgmsKJ14fWQCqVuq6NPE9yo0txSAAtH65HYhyGNCZE4+/Lh7B8AMvvEkrQSB5nPPzww1VvmNwM/cd//EcVGEgQLUGzDCVIlhskucFds2aN/J4j5AZX8pK8x2isvTFZxvLHp2VcnrZ/5jOfQTqdfi9Pqyz+jkTtLSdeGQmIYrFYFYAwVrW4t9SRcsgMGVKdajkZlyTzx0imx0iCGtu2IQGOBE8yLTctss9jPI5U7/A8mZY8ZSg3SJIYY5A8JC/TNKseCPnRbVlmgo6PBhgdTMiPbs+dO7c6/nIs5VjIsZHjQPer+TI9RodLIvPH8mRcjqEkWV/ah7QXaSuSZFzmyfuyzlh5GY6RzB+jsbyxcHy+jMt5LkN5ACC/M0n2/qHmjuQ1nhYuXAh5KCd1IvNVAqUyLvUi0+NJyjg+PT4u78k+y75LHcsNv9SF1IkkGXcch569flXf4+vKerKO5CHzZThGMn04yXuyvCQJnNvJm0fz6O0LwOEVJ9IfSANS37KiHCdp8zIu8z5Kkm0eySZl/ieJaG6tPeuss2465ZRTIJ9fiqIcUfwx3cqbMi71LvUv4zLvk0L8kyLoxylnSI0HjNN2/8jGQLc/8IuMxlUS9U+bZy9F+1e+hIZrVqDu11ag+Td/E/yzn4FINawmRyCo5fcNyiMa+nk+c19l7Yu3dv3T91Zs+8s/v7H7zn+9z3pt7bqwYN0KhgFjctvK6cuWY+avXwdxxVVo/eoNSF19Fdx5MzEUda4nIBof36nD0+PvyTgZvq74YUfUdtqi5cpFQTG3Qtj2TJOLganz5sCcOh1dTMeAEoHfOh3aSfPRsPgMzDjnPJRrmpGva0Fkwalou/hTELNmwzjtdGhz5tzP6+sWs3h8QLbxbkTyLdrSV3z+P1/ovO1vH9+If1yzB7/oZ3h4r4WH1/Xipc1dKBMY8slNGo9jpvUAABAASURBVJCHdrDI8OzOEv728X34/sahK1/J+N/OusaVOyvKt3/ySi9e3mch60TJuxOBIVTUBy5m6C7OmqThS0smY0rMuCVlqisRhM2V7t7O/C9++s3Koz+/g21+/UHdKS0NA3WpJQUORAs8G2GlBL3sQq8IKI4GQd5vBKosocu3RsYGkkB1jMWQiIusuygoFFboTu9dyL2+xe3+5dJw2yro638Jf89GsDUvwHz4MZgPPYXS651wrACIpKCoCUhPqcvKcMwK/ISLIO7D4ZRmNgjCQjpQlUCBM2JjYEsf9r64Cz1r96P7lR7k9+YhCoLc5xo0OigQqoeQ+o1oABH14co4jxJgNpBZP4L9L/Ri5zPd2Evh6PYM1IpGtqoh5CEcas9SynD0CnzFJTgKKL4GbpmkDwVM1RFrq0XL0jakz4qh4awU2s5tQtvpTXCpvCJ0KDkD7i4foy8NobglC2/AQmi78EQZtlqEa1TgqAU4oAMZCtPTE4jPiCBsDDASKaBPG0Wxtgx9uob0jDhEmAOPqWiYM51sbwGmnDYdjQubMfnsyWhc0AStMQqHhfAVwGOABNABeb8lcJYfHZcLPaQCMXEdSw3E4/HrvvjFL0ICgQ/Dl9ah6ia2Ok7ESKZpjYVMy5CyaPiEDKqhvC+pmvE+3hRFgSRZR4a0YUBNTQ3k5l9uGtLpdNV79j5YHbFIIpG4KRKJXHb22WdXN/6yjSMW/Fgz32xc6kHqVZIEJ8lkEvL7qx0dHSBPxJlvlpyIHQ8NSIC4aNEijB06yXGQG3FpN3JsjkebH5annDPSVmSo63r1oOW00077sGzfVl9+/1JSbW1tdc7KNUDqROrnbYVPkAw5flJGOY++9KUvQR4snCCiTYgxoYF31QA9u26ndeeVSy65BCeffHL1OfyuFT7hN/knXP6PRHwhN9FMg8sjx7w92ihloMf+N5vc/i31ogtgXvFZmFdeAXXZRbBmtD0UmrV/yUM+GsNBYPW+BLC8lvy2bRh66ilYz6yC8uLzyD+1EqPPPwt7z65rJQ8WSd+QmHNyd9Oln0XD565F4qLlUGfPW++la75R5rwlQLCUFvEqgCavdy3BiSWUrgI9Wf9wCgu5r6pdvc9XVr/4g/zKJ2+1XljzA7G/pxO+fW66YyaaLr4E9Vf/GqLLr0Dic1+Efur5iM09E9OWr0D6i7+Bpi/9NzR89ioC0KfBr228wa+f1K6mJ13DYjXrD2/r8HRJiOZMyVvz4tYuvLB3FGuHXWws+hgOCuj3HHQWPGwcsrBpuAKLvFYhBGw/xBAB2VcGXDy+P48Xu8rY2usuf7lzEK9259BfDMmToiHKGBaSl/LKk9P4zUUJfH6OiUV1yv2tMeXm4ZL39f1dQ99bv+pZ5J98FPmH70Px+afh9fR+XRF6BqbXQk71Nq8uDr7gFMTmLETN/LOQIGLT5sLSouvLhOvwxsUYc6WOPcOa54bZ74SV3XeFPS8vtfc8Dav7Obij68hbTd767BD4vmE0bhtF844S8lvLKFFfXIUMVQQw4IDxIgQrA8yjjQMDo4MDFoRggQDzBbgr4OcqsAeLcAcr0PI0wj0+vH4B5BWorgYmfwSM6pHrHkIBAhZAgmJYOtxeBbmNZYR7AU5xd2+Iwk6HeIVQ5L+GYga1S5UUgVANqRAHcyld1KDkDah+EhwRKBEFequB6PwY4icnECMvtdFiQCHgbg97yFHfsq+WYW9ykdtQwMiWERR7c2C+D67YgGpDqASo1Qp8nfrRrCIxO4X0olokFqcQPz2FutNrUHNKGkabCfm9b5/7gAroSROJdro3p57ajcKYGoHeRN4+Q0OgcQQqQ8Blv6kPBJjlhk9TNXDGiDBxHUMNEHi+WwJGuVk0DOOoONOcOVSeMQbGDpLMZ+xgnDEGuVkHXYwdzJNpSYwxyn1/r7HNrawn+UuP+fnnnw+5YWhubn7/jN6lOQKday+88EJIr2INAfN3Kfqx3pL9lwJIXTDGqnqX43fVVVehqanpbtkPef+EpE+oUKTzWvJ0HvoUGun5dvkR+Ysvvrj6UV/ZLSojgxOWpHxyHum6XrVx8lZh6tSpdx9rgSdNmlQnQfnSpUurumGMVZuQ7VcjJ+ibBPtyTOW6Isf3BBVzQqwJDbxFAzSvauWaLw/z5LNLPhvfUuC/WIK2hv/FenRcusPhk9fUY0e3qXu/omjJyNZSqub79rQZZ7J5p87X55/WIabNXWxHkvcrIrqeNpPS8+q+X34I3XNLu/egvHEjjJ5e1A4Ognd2orJ5I0q7dwGM6ywa7dabJ7Un5i1k9UsuZmpLR7tuNF6sc/UFwg1dGkL5XTWdJkRcs6y4ClHCO1yiUmkLh0e/V1rzGoYfehSZBx5C/rGVKK9dg7CUv0Otrb0lfdbZA5Ou+XWkr/kCYpdfDTZ78d1qy6xrUosuuCn9+avRtOJzK5Nnn31dUNc239EST0cQGXiH5t6STfLpjhsszZQ9/bXdPdidd5HlCfJKmtD5MKKCAKTgGA1MdNoMFYV6wgnMwaMxDTBKz9OdeRsbekrYtLeIff0FlAsWeYlLqC+PoN0awPlNAT4/O4prZpu4aBK21qCyNk9e9T192dteWN+J19ZsQm5nJ6xNG2Bv3YpgYBjcUTsdRTSXDL/DbkysZ0tOR3z5Vaj97K8jft6nEc6Ys97SzG5P91oqotImSqVm4RTnhdbwV52wd02htGl5tm81nP2/hN/zEvzMZnhhD+xYHiXmEPjlSJcjSJZi8Asq3dMQshAsLMNgFagEnDlccDCoQoPmc+ihQsShhQAPBXgQVEmluMEYtIoOpWKC2xFong7uKcSPA8RDAHSYEAIyUlEQDDMC0AEihRhSVgJ6Toc3KBBkQSBZhxqaUMlzzIValcEvBSgdoLEhgJ3f4aLSE8In77+QvGMheItGpAJphtAQUBUD+e4SctvK8Dop3WMi2A8Ud5VQ7CogLNpQ6GBAJVJYQFx8eIEFYQQEgE0kZqVRe2od0mfUoubkFKJTDIQRkqFYwkhPFkN0+DDSN4J8qQxXdeHHPLBGFdrkJLSGCIIoh6cJOESuIuCpASLpKGKpGBhjqF5vBNX4xNuH1kBbW9tlciMtvUWqSrZwFBxpHThUmrGDA8PYm+EYwJPhoYIfIiL5xGIxSMB/9dVX46KLLvoQ3N5elU7u2XnnnQe5iU6n05D6YOzN/ry9xvvLYewgj/dX+silGHuTx5jeFUVBXV0dTj/9dFx55ZUgT+h1R659dLmMvdnW0dX86Eoz9tHJyBjL0H4gI3snSdO07y1cuBCf//znIcM02Yq0zbFxkWXGE9Ufnzxm8aPhK+WTntXZs2dX5Zbz/VjZy/gOkUyZ+fPn4/LLL4f8+Lacr5Q3vshb4offk2lJbyl0jBLvxNc0zaqsck2ZNm3abvLm3XSMmjxmbN5J9mPWwASj46aB4zl2juPUSsHpOc7kc0A+u2R6PB3P9se381HE+UfRyCe/DQZBECDE0W3o3k+/yZhKslyKHooOIlsNI7GVmanduh5b7yuxp1mcDcgyRIfAMz0YJajVZb0jklNeoXoWTPIaxrkK03KRJK+jYdvwc4Ru4LXhsIvVRrtZimVSur52MrTv1zN9LQoFoFyO02lSt0yPl2Gsuvwhq9C2b7B7e9H9+JPIrn4R/rp1sNasxsBTjxCYyiLw+Vw/VXsZP3keYxecwfj0qYaerr8hH0mt1FM1t/PpkxhvarjMiKfutnS9CzCq35cea+Pw0CbgWqkM3FUe7hSV4S7HLxXus/wQ3RUbIwQSQ2EiHqiIuBlMzg6jrWShlsCYqEvBiZoQdDrAJHgOi/A0C7bw0ZOzsH+0gsZ4HNP8MuaM7MKirpdxJnl8zy7txEJkMRWVW2rdEnTXXVJ2lVtf3NGLRzd0YZ8Xw7BWhzDaCFNPwQgVxFCGUMK4q3gLXUPJBE3Nt0c+87kb4ldcs5gvOXOxF03dEtCG01e8M5hfujZURm8WzsC9QXnX98qjL2OkeyWGOh+EN/IqDHsfAeIshG6hYjhgNQCvN8lDH4cdjyA9KY5YPAGNa1CEDYXaZswGp9nNKY8RiFVIHwYBWUPRoGkqoAkYKQ1GjQbEQ9hKBZqpQ48moBtRqEyt8mPETYBDgBF4BoFuDiZkLodJvAzirRLIVn0OLeTQFR0sJP7kZWa2Cu7oUGyO/L48Drw6gq5nM9j/DIXP9SC/vwhBdaAL+NQvjxOIhY+QvLwgl2+2x4YYEagl/aYqKaStJIxcBMFggMpQEWHoE/gn6RxAFKkPAxU4QxZcOvzwWQDUKgjrBbyYCzesoDKSw8CGHux7/gC6Xu7D/ld7sGPNLuzZugfFXA4izqFMjyNyUgxoAtx0CCdBYQoI6oH4tASizQkEnCFkmLiOkQZoPauVrGhzu/LXfu3Xdv+3//bfqr9cTSCh+ukFxhgYe5Pk5psxJqu8JZ/4kE2EkB/PlDcZY9X7Y/ljeTIcywvDEDIu894PqQTqdV2XH0mG/IGwq8jL+ulPf1pueNn7qf9+y8g1TgLzr3zlK1VAKr9DJvUx1nfGWLVvjB0MJV/GDsYZYzL5NmKMvaUOYwfT4wsydjCPMXYomzH2jvXGdCc95GeeeWb1EGHOnDlMyn+IwYeIMPZm2+/GhjFWvT0mTzXxEb0xxiDHRRLoYoxV9UXRt7wYY2Pp0bHIBwkZ7RXG6pmmubu9vZ3Jw5vf+Z3fgQSiciyknVK5qhxHCsfqHx6OlT08/93S71RnLH98KA9Z5A9gSe/UNddcgy984QuYMWPGIcW8Wzvv995425O6ueCCC/DFL35RtgNaY96ypozxHC/jkeJj5Y4mHONzeJ2x/LFQ2o0kGkuQvJCHZldfffVKGsclh9f9ONNj8o4P30keOQ/HwNQ7lTne+VKnUtbj3c4Jwr9O6lzKIsMxkunDabxeZLnD73/QNNnv7rG68tko1yTKe8t8+680HnyssxPhu2hABAQMPJih9y6F3rzlud23CTEUJ8PU5a9ODwnRLO+6lcoSp1hcIfNleozIoEoy3njYj5FR+ojeVypPQHpYt0V+ZkVk2oQgBCMZjJEeDkSba8AbGzEQahgxa1FJNiE6eSoapk0FFI9kG6rKNFZlfHiQP8BSqQyLxw/JQO3E5Uek5Q+SVZzcCoxdwqt1ywWM7t9FQKeMBjeLeL4XyB4AswMYZd2NWtHiWHEKdSJQ/6r9lvExknnyIEGIUrMvhpbbYuBGxx+t6kxkRJszUvpmZmBf50uP/ce1r3//O+j5t/8Lf/UqpGIMbEoDFFNDulDC5MEclLKBkzuzOHvdJszcuhre8GtgXh46j0FX6iHCOIGuChiB57IZgjVyXH1qPb6k5fHVvU/j/1t7B37nhb/Hggf/BrED2+Cz5NpQaf3NqJ/61kBFWdGJBHbWdWDzSZdg5ZyrsG/ZDeAXXYvESfOfRiyWiSvl3U3MubsG7HbG49/n8Zr7Syqf6brhRRphshYfKkhAAAAQAElEQVQF9yeCCrg/cGtQ3vrVsO/5eZVNP0dix6OYnnkNHWY/4sYwmG4TWGNQ3AhSThqTW0ykzw2h/poL8xoVzUsnI6mnyQtswAg0uCyATYC3LIBKCJKbUX0FtuOiYpVR9iso8grcZgXmyQnUnVOH2rPr0bisHfG5UYi0DUcpwddceLqAq4TwuIAeiSCmR6DXuNCn2YjMVZCPDSGjDsBLFhBpDaDWB2B0IMFozqhBBKaTBBtxYW23oe3kmDKcRnu2CXoPQ2VvDsW+DELfg6C5pfoqVALbILDNAhU6gXQtEJRHVA5gWhoSpAPd1uGUSIGKSmDJRLnbw+DqDDIrC+h/YAiDj/WjsLYfXlcWKnnXVVWrfm4i6HSgve5iRr+J6fk4JlUiqCGAX9kTorLDgd03DC/Si+jZApOW16H1U7VovCiOuotTqL+iDeY5KdhTFIySLugcAmCYuI6BBmi9yYyxkRvGK664Av/+7/9eBQJjm12VQCveuGgdqsY4nQ5pmgaqj7E8GZck0xJESxoDyGOhrCc38ZLneJL5sm6VOb3JuCwniZLVl+QhN/+XXXYZ/u7v/g7nnHMO6HDxsurNY/hmEihqbm5mF1544d3/+I//iN/7vd+r6iNCc1D2Tcok+y5D2ayUnepAAvuxPsl82QcZjpGsK+Myf6ycrDuWJ+OSryR5X/IfC2UdSbLsGMn76XQa11xzDW666SbQQUL147cky6GN1FjZowlJzlo5dhRWx/ed6o7dl3JLWSS9U9njlS/1Q/3F2OGGlOVwPcm2paySZJzuH7J5mf6w1NDQUPfZz3727r/6q7/C7/7u71ZtZUwXUjZpN1JOab+yLRmXYyxllWmSp6pnGR6elnnjSd4fT7JPY3xlOclT8pck25Ak41KelpaWqq38yZ/8CeR3emkuHfNVlPr7Ftsj3dwiD6Hkr2HLT0U0NTVByjImq4xLkn2SeVJWOY9kWvZN5kmSaUnj44DMeTuNlZGh5C11IkmmZWmpL9mOtBlJiUQCck2RMv5//9//J+VbSWWPqY3Idj8gjco+jJHshySZJhnfxlL2TdLh4/C2gscxQ8o1JqMMZVrScWzyA7OWupJrXYXwwQdmQhXH+idtVhJlve0l82V7Y2XfVuAYZdCc6zj55JOxbNky+Smk6toi25Z0vNs+Rl14TzYT4Pk9VfRGAfKGvV9lFRUjzlhjiYzE1ctwkw7ig8XRrjyzv+3pTH+D44cKJH+TpXZHWW23bOctzNT4Q5G5p6Jh2WcwaekliC8+C43nXYyacy6A2jGXiuqvAA1HvTB7Q5nHRh59on/rv/z7mm3//qP77M3r6Yyg9BhXWIankzDbJiNvaMjRRteOxsHTtWAyVPX7WYqNe6AVyIdq1ZIg7/hiLD7gkgfahjlgK5FqHx0Ful8s3hpu3g72wJNoeeJlpJ56Aerzq9G4czPOyuzH+UNbcNrgi5g9/ASW7fwJlu+7H5fufxAX7nscSwZfw0lmDmmUySNqgxHAFIkI5HeDm9IB5k9JYBrjt8wXDjqsMloLFaTLBCCHswgqFuTla1oX7dTbozHRnWo1gfYIuppCHFjcDP+iU6AtPgksbn6Nyuoa6raqrOV+lTU/VEIcm0qV0Xt27LzvX9a+ctsDm7c/tjtfdjzbvjkcGYTdvRWFnpegZvfD3bMf+df2If/KIMIuBVopAcPToQUEQJGFwjzoSQ6zRYM5SYGaDMBUH4xAHQND4AZQYcJgSah2BMGAB2QFDD+KCEtAExrCwEdIoDjSGENNRxMSsxtgzDTIo+1DmDYCaiOkgw/u8SovlRnwXR+2XQG9Q63TkJ7bisaTW9G8gGhRG2rnTQLSCiTo9hWX+BMvKl0uuPDKPnQCxCkWg2FxGA6ng4sQfklAQwQ80MHJ281UBUxhAAsQoT6yWAhbdyGSIdyoR3EHiKmI19VBY1G4mQCFvQ7KnSHimTiiwyZYD1DaZWFkZwFejng5Kpx8iGKfBaXIEXFNRGzSj2Ug6lC8rMDptuEOAwYn/ZDnnFkBmBNADQFdVaFGI+CmASgcAAMEJq7joAHGWIa8rOy0005b+ed//uf4wz/8w+oDWAI0jYAyJ8BMZSBDRVGqXuaxB7JMyw3pWLnx4skykgI6TJEkNxDyvqwjSfIbI8lD5sn7so4M5WZa/gsOufn+gz/4A8gNLnlYV5JcZ8aO4/8yTqVS15100klsxYoV+NM//VN861vfgtxkU5tVsCb7KmWVJH+hV8oq9TMm91go82V8PEk9SJL3ZH1JUgcyLUnykeHhJPNN0wT1H7/5m7+Jf/iHf6iGcrMk5T28/AdJUxsZKYuUV9antAzekeR4yr7I8B0LHacbUs4x+WQo00dqSo4VHbSA9DzuWXikkkefR+1mksnkTXPnzr3lC+TNlXYiAar8vi/Z6FsYSp1KPUmSN6S9S/uWII5kk1lVkuUOJ2qnekAj+yLLynS18BtvY+UlbxmXZVpbW3HppZdC/ksn+a/kvvzlL4NsJUMbbFpI36h4nAKSQe4zasleb5Hfw5TeeambL5IneurUqZDjIfswJi+VpwPZsEpyHKX8sq9SPzIuxZRlZHgkkrxk/lgZGY4neV/yke2STFVvuDx4kgdxX/va1yA/bUIHDHUEpm+XfD4Seo9GSA8ZaRtS9rG+SH1JkunDq1N5aeOHZ39kaalfOV5j8sm0pI9MgKNsSMombYxsYu1RVn1LcTkWY31+y41xCTmGkmRZGcqxGnf7mEXJtndPmTKl+pUJsmXItmQ/ZQOybRl+0knuBD/pfTjh5Pd54ukxoWIVQMlmv2dt3tQ2uObF5b0bX7lroGun82FPmcb4HzE0G+7WJs26IXbGhai94vNIfvZqpD51OczFZyJoaruY6Y3ryZjdI9Z9h0y3ULjeeeqppe4DP0f44CMIH1uFoUefhN1zYEnoh23GpGZMogekufg0aKcsRuSMc5E850IgkSqhLnpIH5J9gd48cJ2Cd32FULpUqKtTLLpWFgw1uE5lBO7unYhv2YeG3YMw93bB2rYO5RdX4qyNL2DF+qfx65sexWd3PYRLdz2M0/ufxanDr+Ds4a24MNeDBfEAtYoFzSshKsFmTEF7fRRntMRxer2BlO8UJ09uQN3kdihNM+G0nAz9pLOgphqhcQxontVR0MvXR6Lh3ae0JXDpKc1YuqAFC889CXULp0K0pL9RiMf7K57XwRgr4Y2rEOpXvDzk4ZHeCu7fP4yf796N13u2YqDntWan+yWEB16Gl90EZHpQ3DWAkdeyKL7mIrsuJPAbhUoeWU1Y4HyEPOUBFAKZakwBiwOBacE3iFQXgvqkEPgzRAx0pAGrs4zshixG1uVR2FmBTwBRD6Pk1dWqksmjHC2lQK9X4deVYUdzcHmJ2hAEdqndEgHGUWpjNACzGTiBSUGAmEUAszWG1NwGpOc1ItGRhtFikhwefM2Dp7lEFlzFRsAVhIwT3gwhQh8qC4iPJAFFKFBCAwp5qUNB7TCP+hCCCiA1OQlzigmnzkUhVYRVb4NP5jCmRGDUxwk8R1AetGH3e9AzBqLZBNKFGiQKKSijBqwDHtxRYkrgObA5HHLFK3RwwMg7z32dbMCETkA67mnQCgqUjAoMKihsL2B0Sxb5HXmU9pSQ6yyisi+DIOtC9al9YokAEwCaVHC8XrThv+xTn/oUk5tcudn+7//9v+O3fuu3qh+/lKfZ8ruMtMlEPB4/tFETdMA5Xh6af9WH9jvlyfJjgCsMwyofyY/Ae3VTK73Kn/vc5yC9Vl/96lfxP/7H/4CU5dd+7dfkJpdJoPhhNzzjZXu3uATQl19+Obv22msxpgspy2/8xm+API6QwEBuVqT8EgxJXvywg4axtNSLvC/7LEnqQabH58s8RVGq+q2jg6qOjg5IIHb11VdX9fHbv/3b1fGQH7EnHV1G7dfV19czyedYkZSB9AtJkUikGsr4GMk8uamXFIvFINNS5mPV/vvlI9unzSJkmEgkIGUZk3F8OJZvWda175f30Zaj9m+mQw1GYPUyebAhbeT666/HddddB3kA8+lPfxry+4jyIEjqS465tAtJY23JvMNJ3h8jOS5jJOvIshKsyB+6mjlzJuTvFlx11VWQtiFtVZKcQ1/60pdwxRVXXLd48WJGNlUn6x5vItnkV8DWUthJHmdG4JTJ+fvlL3/50DySckq7lj/Qdcopp6C5ubk6llTnLeLJ/kv7kuHh92RBmTeepI5kvixPawWmT5+OM888E+N1M6aXa6655iZqn9G4EAuWkfVOFKI1otZ13apOxuxZ2rK0n7H0+JBssDpXj+se9zDljE/KNX1MXrkeSnkkvZO842X/OOImHURK8Dy+Dx8gPirnoLQz2U+5Fkm+h/dH5sl7Ml/a8gdo531XoWf4TfKZMWPGDPkDkpCyyXalfJJk/GhJyj72fHvfghyngvw48f2VZtvIovePKSAU2ZvdPTuWB48/jtzdd6H3Jz/G/mdXIZ/pW2NZpWVj5Y5lSKuvy9Lp7/N5hN8uPK/DuPzyy/iZZ89nM04ytEj6LUD2/bRLD4Haci73g/xPf4z46mcxc/9+zOg6gMHHnoC1vwuB716rNjbeMOnTl6Htyl9D8+Ur0HDFr6P201cB8fRXSJ7S+HYUKLoD41AW8dcPJd6IlESpOay4N/uDuf6h/ftFbmhIkC5vCEQRgZVH3FNAyAyOFyKTGcD+11ejfcMrOH/dS1i+eTUu6HoV03IZ8rZaiNGmehqP4OxIPRpVDRqBP0O4SBNQ42oF50xtwSVTmjDLDL9viFJH6pTpYGedgeHF52LP3PNRPv0zsOqm0mk0mnnonJGP+EsJ3BWXpBPfvWFW+9qvLz4l8+sLF9w5tbH+Oi8Se4hwVTynaW2yD9S3uPzovheKRXszDF1eAl1Cx478ALZ3rcbgnofh9D0GtfgKdL8XwWgPKvtHYe91EXSrGN1Uhj2kgDkagcwAjJehcICrDEIX8E0XbsSGa9gEVh2EhG4NZkLzI7C7LGReGyLKYHDNKNEgiruLUGwDERYBA0gTNlxWQmBQO5ERVNQReKgQmFXJO5xA2AuUt5dQ3J6HNxjCdA1wqumrDgJqV7RwCAK0oj6o8nBZBb7qE3lwqYxrONBrktBSMfh6gIrIAyQrNzwYSQVmXIMIAC4iCAjABMIDmIAgSk6pRWpWLdQODeUpDsQMIH5yAvGZCYgY1YEKiwAtSiESPvU5G0G0VIOkW4+YkwB1C14hIP4KGFfBFQo1DQHZA+Oc9KiB+wrpSkUSMRh5jgoB56FXhzC6MYc89Tu/s4SRLRlkN3TD6soSTw+GYOQYZ4DAxHWcNUCbcQmg2c0339zx3e9+t+Mv/uIv8Pu///tVEE0AAeeeey5OPfVU6cmC/J6V/GEgCfQIQFTTMm/+/PnVuAzJ41UtK+Pkpat6T+UPF8n4woULq5vbCy+8sApIJUD8sz/7M9x2221333777eyP/uiPziSgbCCgewAAEABJREFUygik0uADjLzk+IivqVOnsquvvpqRTOzWW2+96ZZbbgHJheuvv74qswT8sh/yu68SCMh+yj7LuCSZljoZT7LvUl/jSd6X30slsIELSR8ScEivnfQekpfsdvI2s//5P/8nu+CCCxhtwjqPly6k7BLsyR+fORLJe5KknLJvcoP2UQ6J7Pe0adOqNjgmx5HklHnyvrRPubEXQkiP6DEVVcoiAYvkTeBmJW1aGXmhzyQb7virv/qrtTSH8I1vfKN6+EF2LA+AIG1F6k3OASmbtAGZlnqXobQNaQsyLvNkWpaT5cfypa3JOUjgD3SQAnnQJL3ef/u3f7ub7LSD4ozsh7W3tzMp1zHt9PtgFo/H75Y0VpTAMaMDOEYe6Dqy5TryhmekXcuvHchDhuXLl1d/qE/2WfZR9lWS7LvUgZxHMpT3x5MsK9PyniRZTpKcR/J7zBI0yzXlm9/8JuTHs2n+nvn1r3+9KguBu9vH5DsRQ07PS9knOc/GSB4ESJK2PZ7oIA20boNA7BkfV18MwwAd0lRtXMor5ZQ0Xs4TJS7tpr6+HnLeflB9aZr2ivyEh7Qz2S85BpJkfDzJPDlXpS4mTZoEqvdBm3zPetKmaW28TP4nAPn9Z/ls+rBjIW2Q5u97tv1RFOAfRSO/qm3IH66oHNj+1aEHfgg8cB9mvLQWtb98DgfuvQd7Vj0CNze86njoJi/EoX9lwVLmblZrrmQJY2uBsAdNUP1o2yyVSjcV8zkg24ukPYq0lUMkM0IgxQFKeViuh7IRG7DS9TdFLvjUdcbyK7+PU8/7Pm+YNF9NJA4dJIy164LrCgiDvPFdbQvZ5rF7Y6HmOnXelg1f3f+j/8Art/wfDN1zP0Tnrm/WxBKYdNICxI1WBNp0lJUZqPBp8HkLSgTA+owA6xs9PDUzhXXtn8OqGcvw2kkXwV5wNWZf8LtY2xtgXz6AoqhI2EUo3ijOr03itHj8L03huUKrzMw2RNduP30BVp57If6pZS7+dF8FDx9w0JPxH2MlscRA4tZ2ZvzlDJV/a05B+dr8vHLZ1GLw3SbVuLuRsd0+4GrA0zq8FriZ9hog06Gy686ZEsXMaB5N/ADa08NojfUi5u2E5u+HpuZhqIDiO4gqPoFbH2GlAuF5ECFDGKoE+jQIJQIwjpD+PHhwuAMJUgPdh1BDCBGChwrCgg9Xflx7EKixY2gCAcsKAx/1wDIu5MexRRgg1EICwT4stUjguwxoAXTFRMRLwN5axuCz/eh/bgC9q4ex6ZFuFHaV4dsCPpVztCJcI4MwXkCYsOFHA/hKCBIXAckRSA9zlCPSmkLT/EakT4rDr7OQNwcQJ0BcO68GRmsMTmhRHQZD06nvJhmGDt/y6XCAIzqjFs0XzED75+ai6aLJiC1IgbcAoVpCQPX0CIeqMuo36LQ7Cc2MAQSq/QCgAwuyEYZQJ53EGdS0AifqoaRX4FIYxgLY3ELFc8BI+WElIE99DuaQjno7hQY/jYYwQeMVgT8cIrt7EKW+EagEvhWhgtEfNTbx+gg0QCfmuyVJ8PiZz3yG/fEf/3EdAbjL7r777pWPPfZYZtWqVXjiiSdAcTzyyCN48MEH8fOf//wt9LOf/Qz3338/ZPjQQw/h0UcfxcqVK6v1ZH2K7/7pT396+x133HHTzTfffAuB1Oto81uXSqWuk12kU/K1MjxRKJFI3D558mRGnj5G3r26v/7rv+4gfdxE/d9Nfan2TYYPP/xwtc+y3w888MAhnci41JPUhSwjiericTrolbok/ey+7777bvm3f/u3y/78z/+87gtf+AKjzQujdt/yC8ByXI61TuSzM51O3/Snf/qnt/zwhz9cS+OylsZz5Xgi2VeSzLt/8YtfrLz33ntX/uEf/uEtBOTqjrUs78YvFoutvOGGG3b/6Ec/kjq+/Z577rmddHY36fbu8bLKOMl4NwGmm9ra2hhdmXfj+0HuSZ1JGx3PW6bl+JBX+Ez56QWylcuuv/76DgK2Z5I93PTUU0+tlXOGxro6b0ifVfugeyCdyz5VifpTDakfIH1X55m0rSeffLI6f2gs8J//+Z+3kJ10kCeXEXBh1GaHbPuD9OWjqCP1JEl6waVdE/Cvu/HGGzvkukL9ueXpp59eS/qBnA9SP1I34/UidTGeqE513RnTj9SNXFekfmleSt2cSbqpI/DC5EfW5di8Wz/L5fLyd7v/Ud2jcTxTfgroe9/73i3ShsnGV/74xz/eTTYhbVzSW+YlzdfqAYqiKK98VDKOb0fOLzqsufvOO++U68LtP/nJT26hOXk7yfsWOWnsTog0HQrfcvnll3eM78PRxuWaTAdC1/3gBz/IUD/Xki1miHYfoY/ynnwOrv3iF794pjzQOtq23rn82+/I9ZHm1E3/8i//cjvZjByDW0iut9nMEeQ84tjQunWTnKdvb+mjz+EffZP/9VvsFOJWArC1ajF/h9ixF8GLL6HWLyIe5NHoFTEjm0P8iZfAe4aPuTKKojgvRQDuSIyTQIkeFu6R7r1bHp3afi+eSsKdlEY/YZMe8iiORkMUowQfapPgsWjGU3jGNyLPqKn43eA13+Bq4huMALvkK94AyTIuySforQL9FNdFXtRGoOjjy7hufknYuXmL89hDiDxwL2a9uApROoCwVj6G4QND2DFjJn7wmaX4sxXL8KdXL8dtF16KH848C0+3L8WehovgKRdAcc7G2rZzsOeiLwC/9TWk/vuXkZnagFLdVJQjdQQ7NcTJg7gwXYsm3YDG0RmSQDk95u5XokseLwM/c0ysqe3A6thk/IIA57q8g1CJPB0rRx+iokABcYToYs1sbSauQ3qYZT8agEwqg3ad1ayHL2aK7Kai13OfM633r/H5yF34vbbV+I36rVgc9KDJcaGTl1Q49XRSm4ReW4/E5DhSM1XUzFMx6YwUYq0cYVSDo9TBCloRMr3q9GQCYCR0SCMa2hTxAAWkWXAwVYVBdfSoggA+HNcFZ4BqGmBmBIwAOOg0WRATwamuKqAJDUYQgUb9FhkF1h4LRi6KZCmNRDmOlKOitK8Eh3QBkiDQiK9B4FMrwyIQKgGzTgcYUT+BuEfkx2CEOsphHnqLgvrTGtB0aRsarmhHcmkN1HYfiOQJuPokdQgv46Cwv4CRHaPI7S/BzVPHpGxxD36sAC9ZhhutwDNtBKYPV3cQb4lAa9JQipYxog0go/VhxOhHIVGAMkmH2WJQ+QpUGpSauTXQWjUUUxUcUIfRqwyhVFOGNpVB74gCBK69ggvTjkC3dGi2BlWSq8JkKsrZIsqZPDQB0jMDw8T1cWmA1rGMfDCn0+nL5Oa3sbGR0Uk6kxsnAth1BCo7yEN8iCi/Y4zkPVmG0ozi1Xqyfm1tbYfchBDdTnQzrXt3y3Y+rj4eTbtSTtM05b+2uV32Q35EtaWlpdo/6mcdeQDqWltbD+njDd2cKUPSQYe8TxupOirLqByT9SUfqQepZ8n/aOT5sGXH+iLbJznOlCTH+nCi/I6xPFn2o5ZT9lPKIMEQtX+TJHnYImlMrrFQ5tH922Wd40FSZ+/FV46lLCeBm5SFZD+zubm5OgfIFqR3uGon0iYofSbZg7SRM2VaEtlGx/i5I21M2ook4nez5P1uMnwc4/Nu8oy/J2WT8ksdyb5I3ch1QfaR+i51w6ZPn/62tYX0VJ1XVKY6j0hnsgyTepV2IUnykzqXbYxv893iUo53u/9R35N9kDYs7Zl00yHjkmR6PElbkCT7+1HLONbemFwks5yTN8twvIwnUpxkq86bo7GNsX6OD+XzSj4LaWzOfCM8tDaO9Vfeq6+vZzL8qMaH+iefp3IcJN08NjZjMh1NKHl9WD2N19nb4keRwY+i7ETR96kBFYSUqSxHCDACCGFAIALQQwbDDRGreKjxJFjBUV1Db3iURT6/3O7cI4ZX/VJ0P/SQGFz9S1Hu2SlcAp1e4N74TkzJ6AiNvNPdd86neplIKnVLavlyqJ9aBu+cU+GftQB1y5fBmD4dajR6kwF1ax1jWyUX1shKkmRcgknCobUyPkbknS1psOL2wIFibtPq0W0rH+3c/9BDzuiza4Wzt1toYemM4q7NwNaNqN23Fy3DA4j2bEd5Ryf27RvBWkfHY+0deGTWYvyy4yy8PPksvFS3CC8uuATPLfs8nlx2DZ5ddCm8mS2oPWMOYqfPw3BrI14czqEgdPiqCU/VoOs6zp80HY26SWAIYAr6mVBKCnlumW/AD6KwWAyjTEe/qmLAVJGP6PFYDBnQxVIswxrZAEXh6gApt6UApw1OoU1XBq53h3cId+i1B/39T4Dv+Ckm9zyOM4dfwkXDG3BG71ZM6e9CyrUJjCkIQwNeYILFo+RtTSK9KInUaREkF2gQdTY8PYCvxBD4NQhCapG8nzxQYPgRRIMkTD8O3TPBSXZf+GCGQIS8uolZNTCnRWG2RRGfWoNIUwLCUCC4IPDHDpIA9Z9Bo/YNAs9qYED4CnyH2iQ7ZQRtNWiAKxDaHNxVoAQcgoXwVRee4lEc4L5OxwYq7L0+ytttWJ02/AEX8F1wwycAy6s/SqbNovbbA/hpC4FmU9uAO1xBbkcOI+szyGzIYWhdFkM7RlAcycMPqZxhwyXy6OAm5AGNFSM9eNBrdCSmxRHpMGBNqqBEI+BOcaCfpKNmXhp6HQPTPChmgGiTidS8RtJtMxIL65BYkEbt4nrULW6A3q4giJJMAUiHHNIGOPURAYOgPJCOQj9EGIQYuyhrLDoRnkAaYIxl5Cb43UiWOYFEPq6iyL5KOlwfcvM0lifvSzqugkwwP+E1IG1gzCakfYzRWJ4MZZkTviPHSUDZd6mDdyJ5X9Jxan6C7YQGJjRwgmiAnyByHC7GJzrd5HnPJAHXiaov+G0tUBYvgm0S6EEKHkvCS9QifupCKLXpo+onbdvrhCg1u0MHHiu+uhpDP78bA/f9Bw784qcYeXUt7OG+NdwPao+K6fssHEnV3JxedgVqP/8bSKz4PGJXXY6WKz8Lc0r7LZFI6m7ydlcB5eHshgHdBbnxDruh5Cs3u7u3YujxB9Bz/z3ov+cnGHnkERQ2bwAdOMR9pwzF8xAlaKUoBMgUgTJXcMAS2JD1scNsRE+8DcOx6chGpmMwPhXb2+dhzaIleP6ci7D17PPQcXIj5p9UD55gWJ8ZxGM796NQrAAiRKgSKNJVzPA0RAb6Ye3Y+IPS5o23+jv2rKjPF3GaEcFF6SROjzKcQoM5qzGKmrQJy0Cc+tSGwy4DKKokL/NLKxzR1VkUr369MvII7AM/h9vzBNC7HumhETSRV7V5TR9qX+qFsaUPerlEDmAXIScAKkgmwqhqkwGjIwbtJBNhK2DHKnAVG2ACis8hJJoj5KYQWNWsKLRCDHoxRl7SCKlORSA8BLoDtVVB7OQ44otTSC2uQXJ+LYyWCAQB3pCHgITOBLYl4FYCFSodGLCABGAMMAXURh1u3EMlYsON+PANATMdh5REItEAABAASURBVK5FIMtLFhJAk9TgBORZSYW120V+XQHZV3PIvZZDcQt5lrMe6CSC2g0IoLpwExXYcQuO4SIAoFiyXhHWtiK8HQ7EbgFvl4/s9hxy3VnYFYusCBBKQH0PwQJOsupQHApNHfEpCdSenII5X4N2soroAhqrU9KomZkEI9CsUH/UkENROcymJGpOakTTwkmYdGorGhc0H/xedYOoyubrgs4IfJBaQFUQshAhpzwCzYqhQyPPPakeAeQ7Jq4JDUxoYEIDExqY0MCEBiY0MKGBXyEN8F+hvn5kXY1UWBwAytH4anvOfMSu+Q3kZixCsXYa3NZZCJacA+XzVwCTm887GqFEELT5dthR2rQB2ZUPwnvyIcTWPoviyofR+4uHMbJ2HVJGw3VHw/Noyiqts1hy0fkXN1x+9Q21V1x1ndExvZ0n6299Nx4GoJtHKOAOD1yfe/1l5J78OZo2kdwS/D+zCkMvPA9CRy3pefOhzZyDcm0rcjXN2NPQCnvBPFjT29AnVLhagoBRCsKIwo8YCJMR5J0KRkfIk1k2MTc1FWecMh/T6hvWZsoVPNvVhdX9/SiWLAiHQBt3YaGC/udeQeHhn2HoX/4ee2/9cwz+6G6kdu3B8jjDTbMS+PpJCv54XgS/3R7F0jgeStoVgxyyS/qEf+2IsJZVRKUKpGsZ666zy82R4v5brcyL6DpwL6wDP4A38nP49lYwrgLFZngbY7CfAdznPBTW5ul+BSHJIbQKTN0BQWUCvw48Qqa2oSJHwM1WBQE4mzzDecREDkwNwJgC5mrwMypKnRasrgB+ltoIdZCjGI5SgpPMQ7TbMBcbiC5OQJtOwDjtIWAV+MRfUGtcKMRXh05AXBCAdslr7agWWI1Dntk4MJOh1FhGobYEvd1AYiaB1ES0Cp5VqssJ8CuEMhWbw+/3MfLaMKzNFQTbPbhbLBQIQDudRfCSAS4MeGGAsiZQUQQ8qg9bg8jqVN5CrI+hsRhHc7kGU4IGaCMc9oAFO2dB5Qo4GLXLoZGbX6t+tFoeFhhQojqi5FlvPD2NpnPr0bSkHqmZCfAoh+f7VN6AWtHh0aFLcSAHmw5HOLWvJ3UoCQWB7iGMCPCkAEv6qHAbnu7D0yQFEDpgkadfT8QRTcRAYiBgYgI+Y+Ka0MCEBiY0MKGBCQ1MaGBCA79aGuC/Wt39iHqbMtcyxkp1MFfHI03n1Z5y9vdbv/W/kfrOn6Hxlm+i/bf/B7ymttWqmVh7NBIp5N2DFS539++H2bUXMwMb010LMwggRPoGkd+xl3b5VvPR8HzXske6GUutLirJ3SMsNq8EQrCHlRFC6EXhzCuRh/zgrQI8eKWD8TffvVwO4cgA6itZTB8ZRnsugxSF4eAQCD3WGlNnlCIXfRq4YgVy51+G6HW/Df2iZQhaWuCXQzQNCEzvFZja56NuuAL5w2VgRYwGQ9ha6sbj/d3451+O4PUD3pLNOQXrywnkk5MRqPVAJAnP5CjaI/A6tyH+0KOY+tSzmLp5C6zVzyK7+imwAzvRInKYwwo4LxLilEoOLXu7r4xv3vftpu7y1xvK9oAZWM0V2Nfm/fJyv1xeHvbte5BvXIPEK89g5taXSK4C4gRIucGR08rwwlECc2VwX0HETcAa0GCPNMGrTAJEDIrIkoLKAOcIeAyOSMJX6hDAIP+7D50VwMI+hKEFz/WRHyhg32td2PdKDzpf6kL/1gG42QqYxgk8OyhoeYxEMhiNjSKvjcCitEty+JqLkAWQIFAJGRTy5ILkFJwhNEAeYQc5M4ug2UL9kjSmLJuCyedPRsupdYi0aXRowQHygCvUjypwJjctq4DG04dL45J2atHgNaDWrkWCPOJ+l40gAzDHhBJGKRKhIaaGAuqXGwOnsYlnTCobQbwcRaIcQ6wURYTc/JzUEVYCcAnQibRQJXkNhLaJcn+I4V1ZDO4dQa6Qhx8PgKhLYNelwwaP9BTCUKJwRwIMbBrCnuf3ov+1Xux9fR+2v7oHXZ0D8LwAUFUIzhGpTaJh5iSyag0OHa443IPDfFQCF2ZSRd3UZkRbGuGQnhRNAc1xTFwTGpjQwIQGJjQwoYEJDUxoYEIDvzoa4L86Xf3oekqb6pJsjUI3GdFWqw21N+gnTa0zTl90nb7wlKuSs2YlGpKp8+R9We79kqcEcaHazTA8hOR9dEOfNv0BCErBIcAkYlGwaLT7/fIbK0eANy6y2RvdTVtE+elnRP7JlSK38WXhZHo75b2xcjKUMqe1yNPNSvxbCZbYKtMyf4xkOsGMrXEWH5B5KZbKSJJ8JMk8SYYagRJtQDHSgJLB4JuAEVGR0CKAHc0UjZZbC4vOQu5zV6P3qhXYvOACvBRrxqsFDz3ZEkIthqJpoqAAbuhA9wm9GWWEegVBaKFcLmO9P4DdI4OwBgWSo0k0FVx8fvt9+PL6f8b5ex6Cbg/ALEQwABv7okWMmgUohf0wNz4L/xc/QOHuv0X5nr+D98N/AO74F7B//lew738f6g+/s4j396wyvEi3VnZWWKVXHxvp+7vHunP/F6OlXxCG7wGCKKRrUhA4RWiC8wSEqcBN++TFLWM0VQBrdcFSFoG9AAGLwGV18FmUxpRDIdBmwEckBCKBDs3XCXSrxFMhD6yGoCzg9rkI9jioGYyjdigGpStEZV8Zim9QOQ4hOIUqmNCpjkrEoPCAyIaKEozAh1JS4PcacLZQa3t1KENJGJUUDOLhq+QJb7SgT3MQmyaQaKD71B/BBXlrQ/iKB4QeeBCA+QGEBKICkH1mQoEWajQuGhiBZkb1SDBAc8A9F3HbRMxJQAW1G3Mw1GYjm7ZRIWDvSGCvqBAqyRtXoKY5PM0GtQr4GtxeF7nneuE9l0H4QhnuSzbyL1roe7kAj0C3BypD/RTch2dXUN4+St5wQuHdKvShBOL9EcT3ulC3DpN3fBBqCQh5FGFdFOo8E8mLa8GWGLDnczhzFSiLIqhZSsB5dhRBjUBJEQgMn8aJOouJa0IDExqY0MCEBiY0MKGBCQ1MaOBXRQP8V6WjH3c/WSqVIbpbTSYfIoBJ2/V3l4iApm6L/KF/OSVLk4PPhaatNqZMBps+Hbl0DYZiCeTTdVCndSB90mxZ7KipbGdvHN22+XuZJx5H/t57kf/JXRh84B7kNr460+rfXzxqhodVEOSNtmDVllBqHxIiLtNaXQOisxcAp56NvtZ2HJjWDmfhPCQWUh5P3Z3nCexINeCXja14ONGAx8lT+0h3iJf7QvSHOgoxjlLMJxAdwAhD6E5YBYeTKg4W943inN17MG1wE/TCCCaJAEuDPC7Z/jQ+s/1n+Ozme3DJ1pWYf2A/hoxW5GPTYMWmIIg0I6nVIDFqga19DcGjj0J/eiXw8AMIfvFz+E89Bu/5x1H+xd2wD2yEOLDteaNz7SJ9zyNg3T8Fyz4FWFsRBgUC9gQKCQCCQCQIRHKuA1EFRrsOc64GYy5H6uQI9MYQiu6DkfRCRACmUNwn8OwQBHSgBh5kDqP6gaojUDUCwwrgAgF5ZMNSSGcpHKojgLJHoNoFCxgU4qMKDToBb8MzoYcmZFoheQhOkwc4hGrRwUuPhcymIgobbOTWFeHscqEMqzD9KBjpNTAchHEXSAYQUYaAmglYCF/14TLSf+hCCA/EEDwG8DSJYZRQ1IooGxXYBkHZVBSc6vp0sOEqJTDmQfcZ9ECDonDi7QOzVVTaAuRqLOQTJRSIB2oZIs0R8gibECwASI9+jsHaZ6GyKQfe6UPbx6Du5vC3BchvLMEdYggdFUxIYijnSnD22VB7FCQKKSRKdUiXUkjlVah9ForkuUYpIC+1At/UweqN6g+2mW0xGiui6UlEZtUjNrsZSp1K+vfhMYEQJA9IGZi4JjQwoYETXQP0zImf6DJOyDehgQkNTGhgQgOfDA3wT4aYv3pSMsZcA8mq9xZvXAqUbj1Sd2ds9qmInn0J3MVnITvnNPDTzkPj2RehZf7iN0oeXSBc64b9Lz6LoZWPwlr5CPzHHkH+np8g88tVsHv2QJTLi46O48HStGHRLauw1PNy8xQ3SBzMRbwAxMPGxo7YktPRfPWvoXL6JRi88FMofe5KaJddCpaKrq1w3rGGgM+de/pwx+Z9eHzHKF7cWMGeARMWeaxLBMxUjKKZlTEFDBGPI1biOHNPBte+vgm/tWYVvvzSk1gweACnpfO4smYbvrD+XzG3dwum9Xfj9L27ceGOTuxsaobecDamNFyK5rZL0TB3OczW08G8epjDQEuOIzGQQzg6hIo3iqIgYNyXJ/D8AsKdd0PbdCfiux5B3VAf2kY9NJQEwsCGzctVAKcQ0OehgOAuRNRBcmoEk0+tx7QlDWic1QAzGSGgCwKSLsywDE1UKG2DMyovwSkCBEzAIy+sa3A4BiOwSiCV0lx+X7cGBDYLyEQzcGps6ouKkOqqXIVBQNkgkGr4HGqggpMsLDQIhJoUj8HLCWR3ZzC4qQ8lCrObe5HfdgBOXxGKp0MPNXACoQHjcBSGih4SGA7h8oBAdEiAU4C6hgA+EA2htKgwZ2qotJSRa8oS5SnuwJhqgtUGcAg8l3kFIfEJuEdyetSREKrJMXlqDSIdJtyTAlSml1FoySNykon4lAT0WISc1gZRAt4g8SHPM0oadMRhhFEYNFPMigo1GyIcKEEthAT+DSqvoZT1wPJUkrzpSbcGUTsKncor1DfPZ8gWfPiuj1CSFSIgcO72h9CyKnnHI0iIBI1JAkx+NEKCcpdBCUD2AUAQTbwmNDChgRNeA/Q8LZ3wQk4IOKGBCQ1MaGBCA58IDfBPhJS/okIe/sCPAVulKvSTFhg1y7+weuYf3Yr5f3MHTvlf39nduvyqa8zJzYkRSywj0BqX5Q4nytcljc8XotTsO+W2/p3boI30o9mrYIpfwTynAmPLBoR9XQgUp3l8nfcbJ/ldM+Cdmieadc86wyj5F6muu8wB2iuG4bqTmjrqzrvovLN+59tY8vt/cufkq665wZk89bpiUcwLQzGzc2gUG0dy8NPNKHlxcAJAZj4GI88JNDHEnFFMiuYwrdVFQ4OL2b37cMmrq3HxlgexcPAeXLbuZzjzqUcwe3AjWhuHkPQPYPZoHifnbEzPl1FXGsakegfJL30asdv+GDX/9p2HEv/yZw+Fv70C/WcuwO6GZvQadRjSm9AbbcKOSB32xlNobG1AfOBlqEM/hc0eR1/9XuRQgvweMhyPwJmD1qJHoM4Ed00CWwxM9ahEBpaZQ5i2gboAMF0gtKEELgE0F7ook3e4Ai5cMBFADalIqEIjCl2gQt51R9HACTZGEjHUzUhj8pl1QAeDeYqK1KIEEh1pQA+JB4NK4FDzBTRxMA0CwqHQCeya4Hoa+YwDv+AiTh7ghG+iDirYaAVufwmMDgF0+Z1koRFGVOASeLZVoKwJeADk97aNMAKTAKwiyxCw1ydFMGlpG+qWNiB5bgo156fQcnEdzGk6nKgNR7MgDIHQF5YBAAAQAElEQVQg9MCob3Q2ALghmO3B4CqaT09g8mdq0PypRkxb0YGmC9uhTDZRocMI4asEYCMIiwopQoHKYvDpQIARmdSnGB0MxF0FSt4Htxg46QwBpzKc4gapJAJD9sdXwAU16/uwfQ/QQJdKMjDYXQUMvrgf+5/ahQMvd2Pg1R4MvLgH/c9shbu5GygCKic+VJ8FVI1Cep94TWhgQgMTGpjQwIQGJjQwoYEJDfyKaID/ivTzE9lNIYbeAoLH/h0UY8xVWxrPC6dMXmzVN3/FSaevUdPR+ym/VGditQzHd1gC5rzI1wKFON0jGPbmXcbiA3oYg6rF4cei8JMmwriGguoj0BWAvI7wQXVxVJcgj7M/2r/K2/hK/+CP/vOx7EOP/IDv2/e9hFNp1l1rJnHWU8zcrUWSq7VUfXusLv2VtGl+v8FQ704k2FbGkNEJ0JlWEqwQR1hKIiSQF9UY2mM6Tq+tw2ULZ+HqczvwpXMm4xuLG/CbSh8WextRL/YgqdhoqdhI734BRqYXbvMC9J39Wwij0+H6aVRSbYifdipuvKQRcxfXQEyLfzdXr6wdTogl7uwpqP3CFaj5g68i89UvofcPfg/PfuEa3HPJMtx38QKs+40Iys15iJgFLx6FFbYg4syCE5mOcl0LrGQN9hGgtHIALyngBOpC2yIPKwHHiIuKWYZlUF3DB3QGzjkBOg5CqQAUIg0ITXAnCjVHAHVAR2w0hmSlDnGrFgp5TUEQWEkKJOfEMPmCJjSdU4/ISQbJY8EOCKQSLiRICI2HAHMgmAtf8eGqAiQOyexBo7GGqcIRDnxWRlmQB1ZXwU0d4Co1waAQ2NQCBTp5rzVJBBoNpAiMtsCoNNBBRj10pxHMTRBQBVgSiM2IITU3hfjsOLRWFWGEuqOEYOBUz0TUpfxiDGxEg+gHxBAHq8TgBCHZoA+lmcNJFFHkI3DUMmAKhLI+86HGOdlniLxSRF6voEx6dIgCzaY+2GBxARbxEXBK04FFoiWOoClAPp1DNjKEUnQEpVgeVtxGQPrTiB/XYhAFjqDHh+gWSBWiiOVNRHI6zIIGLc8xsn0EVn8Z3A6hCoCc72AU4hN0TYg6oYFfdQ3IZ+p70a+6jib6P6GBCQ1MaGBCA++uAf7utyfufhwaEPn8EpEbuhX54GZROfivkI4khx6LrQ9Mc4Mf1brG7jPG3gKO80LUDgM6h9kCJN9yb6yOymN3Np+0AIXmSehMx9HZmML+5jrw+fOhT2qDws3VY2Xfb+j19z1feu7pZSM/fwDBysfhP/QwKg8+CLFh421mJnOfZll1Y7xcjZDXWILCISEWdTu4Mldi4CWdPLkJMCUBOyZQSpQJNJWQDT0CTlEk00nMr40/dCl5Yi+ZEkNNyoOlWPCYgWxkGjpr4hiKJmHWzUXzJdeicPGnUTj7QhjnXYrpyy/DtBk1Lq+Jfrdk6P0+N0uKMFdqsdrLambNv7vlggvRfPmniZZj+hWfRfsFF6N27klQZpQRGBwZYzJ6jVMw4JyCHm0WdtZOR59bg2CDg/JrOfRvGMbo3jz8jEdeaBWmakLRVZCzlEBsAF8NEbAQEoMJgpa+UBCQLzdEFKEbgUsDN/zaMAqvjsB6LQN3SxlaNgZOIFYQKA6NAGEqgEojy5pRjXuaC6GIKrATBEYFfHAthOABPNKZTy0IlcGBC73OQIQ8u7wJKETKqKQBdUoSRksS0EEXAw8YVI/BdICoLRClQwE2EsLaVsLo2gxG12SRe70Ad78HpaISqlTAYyp4QiEgS2QqCAXJQ3y0wIRJwJmPGshsLmHk9Qyy6zPIbRhBcXMWYpSB9A+uqlCiDAH1JVA9iKqeZOhArwdkX0upCrLREsoUFmNlFKMVsIYASoMA4jY8tQSHW4jSaZI2S0O5zUF/LINMgihWwGjEg1tjomFGI1QtApEJgEG/CpQTfpwOQ0hWx4DpGdBdOmDIWPBGS0DZpeMNVtUvJq6PWgMT7U1o4ENqwNCBMZKsxuLjQ5k/QRMamNDAhAYmNDChgSNrgB85eyL349JAMDTyA6ena01h/bpvltZv+Lq/b1dX2HegS+Tzy+WJ+Xi5hoSIcw1dKcYy4/OFELRBOJhDmKfWAHTuMZknCU7RmVcqieaMEG0y5Ny4u+30c6CdcRZyp5+GzNlnwj3/fMTPuxDm1I4SO8pf8Kb24/aBHgw9sRLZZ55GZPs2GK++gsrDD2Hk8cfARgYREV6tlJDK6pZpXVF2y4tEXtT2lr37nh/JrVt1IINOCVg8QGEqWEyDk3KQi+QxEOawO1fB+gEHu4YDlMvsyjT01W3z58CdPQ/7G2dgZ3waXm8+C490nI3N6RmIGA3XzD118Vr7C1fB/eI1SF1xJVrOPfsv96tJfW1RfP210fC2fXn+PTVI3m3YyfURFvlGQ03j4qmtk77SETO6z4tFcKURw6e4jqkoo+wlsb8wHb19s2DtasH2XAzr3DS6uyPgz9jAy1kMbR3GwM5hVHptmH6KAHQMWhAFh4GQ+hQwRqGAYIJCDo+AqUvDFPAYXFtFZn8Rw+sHUVg/hMLrAyhuGkYwwiF8AaGEkJ5kh7moMBs2c+ByDwEXUDSFoDiVCwUIt4JxSjMF1AiBPg7OZLs+WAJITIsgNT8OzNShz04iOqcWRmuMgGuAgFYHRlhUcwV06pIE0IanwOsuIP/aAWRe6kP+5VFkXx5GZVuBwG8IFmgIAwGfGg5DQIQKtQmo5L02fANa2YTV5SOzMYvshhyKW4jXpgxy6wYR9AZQSxEogQ6d9rKqoYJxhjCUjALSkwOFAL7ZpsOcbkJMAvxmD16zj3AKQ2xulLzWIYKYDU+1EGo+VDrkiMw0oc41ELQxquNDTGbAZAPmtDTqOxqgaCRzwQVyDlRbVGXVQhUajYdKBxqc9BiSzsOKA/k/wqk2UH3DxDWhgaPUwETxj1MDjKUyb1Jj6c34m/kfp3wTbU9oYEIDExqY0MCJrwF+4ov4qyOhKBSWBvv3XD+88hFs/7/fxe6/vw3Fh36KcPe2NniV61GOEsp5Ux+NjJWOBJzZOO8zldmtel675nlApdIuCDgbCWNrLIYMXHeppXpXavWRp+uWLman/vYN3136v/8Mp33jf+Pcr/8pGpecf43e2EYQ680231esUlhaGR3FyP59iNo29HwesXIJyugQNj/xCKxijlCVILQCuCW3o08xrs0o2rldZnDbmmx+xZ+/tAn//tIGbMlm4cQ4HF6EiJVBbleYQR61JR8NoyZKe3xs2ulh7SA5DVMmCvNPuzNz8a9j/QXX4r6OS/DY9Avxk7oL8bI7BVbWvS+VCv4wds6SW9KXL79OP3PxxQMRc+YLpQT+YXMO31lzAD/alsV+X11VYMGiwBdLRTn/D8pw1w/Ys4+2ed//Z9T/+D+xYOsW1PAYdvpN2LUpCnFfGR0/7EXuiT3Y+1IOg1sNhP21sAlEKuCwhmxk9zlgXj3CIRXI6lCdGJQwAiE4qAhAnmCmcgiuwqG8QNVRqoTo6xoBwW2YFodSDBAWPdh5C0HoI2QBRPWP0ZBwwnIqgVSFiIGFHFwwaNyACmqnooD7MZhIwQyi1D6HzhgBXBqbRhUtS5ox87PTMeOCGUh2pBCmQvKMO/C4HCJBsjIClAws4EDJRbkvC7uvjEQ5gnqnFtFsBE63jdz+HLVDZUJAoZZV6OBUR1MBXaEcjyPI+BjenoFe0JF0U4g5SRiVKHl1Q+T3lWANulCFgSAISDUMjEArcwQdOmgIHR9QBNJT0ph9zjRMP6MR8ekR1MxNoO2cFjSc1QZRJ2BrDoTOEItEASuAmTTQdkojFixrw7RTmzCTyi5cPhkd59ZSX0mPVCwMXASOhcB3aFpYoMbBaFxCFsIlfTt+iIC0TGqDwgB5FkFJTFzHVgPyMO3Ycpzgdsw1MMFwQgMTGpjQwIQGJjTwK6wB/ivc9xOm67RhjEsKRoae373qcfQ+tRKx/XuQJjrw2EPoX/UovP2dK1g8PvBeQrNxwFmWtazSMj2o1CqOdT3ypX9ArvAvYjB7c5jPX6/61jxDuBIhyaJQ6uq+EdZMui6onfZ9EZ10GTMa76/eOOo3dcBRVWQUFSVdR5iIwzU0lFWANdWQF9kAVFb9qLnQdGcI2rxNvvq9lcP+9Q/tdbAvo6Go1MDRqK5qwzDyiLpdaM/uwZKubbh8y3pcu349PrVpA4z1r+Pxta/hT9ZsX/pCwK4P5p0K94xz8fqMmdjV0Agj3Y5kLXkXa9idIcusiLNwraqKjKeItoIbrHh9awWj/TpGenzs2DGEXX02iq73vYC58yqDe5buXXkPXrz//6H71UdR7nwR/rZN8F8U2L1Nhd0ZoqFnFHXFHagrD0IMcIzkGjCkNqHBDqES6DPJexkvAt7aA8i+dADlrXQQMKzADJNgoQE/DBEENhA60DRGAM2FS+cKoSGgJnTkbUqrIeyIQMn04ZFXNVBdCBYSdmNQQhWqH4HmRaFRqAYGOHl7QRcjD26Y12Ht9TH0ch/6frkPuVcHwA4QoJQfn/YYfPqzDBeVBIFGowyb5WGjAJ87CCVA5wJCIbTIJXHA90luHwpC6EKB5nBEfB2KQ7wsl2QK6U4ARvU4o/LkhbZD4sfKENylvgao5KiMLQAPYOSRVhSN+qOgUgpglX2A6vrCgULVDQLgJvVNtxMw/BooboLqmFA0E/HWOjR0tCA1sxG8KQZLceGZCoF+hYAwAyspMKwYHdpEoQwb5PWOw0hNgVHbAD/CUWIlFLmULYNoLRBrMMFiHJ7uwVMdIhe+GiAkEK1FFWg1MYh4FDZA4wY6/KDIxOuYaoAx5h5ThhPMPhINCCF0Id76Gx0fScPv0QjJ1Ew0U7gjS4QoUVzERanULOz8zCqVZF6+Vohx5IzOE07ftcLpXyG8oaXVcnR/fFMH+yvrCFo5xt+ZiE9o4KPTwEE7HIqPs9+ZVXsXQzIke/9o5iS1STKMl2NsXsl1QegfhUbe1MVH0+ePok9H08bBMZBrktT9r6YOjkZfH7YsbU8/LIuJ+sdCA0GhcGW5ay9sAszKwAHU5LNI50cRo7jauQ3+vl1H3YxcUBVRXO7t3bmq/7Ff3LjvRz9c2vvj/1yae/Kxbwf9XXcYQWmhpoa7xzM2zeT9mhK7TTVTK8fnH02cxWLro62TUX/a6SjV1CBrGsjHImBTJ2PmZy6FV5tGjitL87aYmbH97720JYP7Xu7BfeuG8HIv4NhNgFsLEPjTaC/dZFSwJOHjQqsfF/RswLk7nsb52x/BhTufwJxdz8Hdtw4vDOzH0+QVtRIpnDJnNpafezaWnj4XVy1uxrypMYSmupb7aokgls64kyF8ti1B4LExJZDwLZjkddSUAL7JQFjQIaA31x0dQHH9RkR6+hHPFsnxXUZpwEXPvhoMDaZgZoBmK0de1UFMHh5E3YiOgehkvDxnCmLRAFHqdzKSRtQzUdoyDGePg+z2IrJ7ywgKDAoM9Lk/+wAAEABJREFUKIoKiTEZ88HgglN/fWZDSyhomt6IxKQYWD2VmWRAnUn9aNepLwRomQATHAp5uHXfhE7AWSNSSWecQC0jbrIj7qiK4c0l5LfYcHY4qGwtoUD65lkO3dOplEIgMYRrUPuqBUWxoRDIZUQCPqgJBAqDVyUgNBQEGt3hHkLhg3AlYV0BjZCuYWgIeYBQ8REwqosAdBOBbsPXLMp3wFUfRoSBKyDeDAEHXBYiUELocQ49SnFmAVoAUL5CBRRLAxtmqOzIY+iVA+hf043MzkGUs3lwk4B7PAIpl0syksOe5KK8IIowpyCzeRhDa3IYfqmA3JpRFF/rhdOThW9JmQJ4UY9ko7FtUmC0UL1kCIcODnzNh0+yeoqHUA+RnpSGUZeAoPZ8oCo7KY9iE69joQFRBV+ZtoMbALkJq27+5AbwE0BSbtq0VIGY3Lh8+M2i1MeYXmV8nF7e2KSSjiQAPLhJ/rh0RJtzuTnOtAHZZqDBHZP5RAhJZyRT2I7AXUQnaefC6b0PlY1FoLMf3u5OuLs7RbC9X+R3jr6FKnu3oNx3F6z++2ANPA/vwGpYg/cJq+tWIUE1AfGD/VV0YPjj6vNbVEx9fdMu6BBD2owsIPcAomqXeXqgypwTg95VXjqoGJP/eElL7b+/OVOdYzS3qzqlOXcolHZP6QrN/ap+P1qwIvVDfYgDBSIQBUQOjXHFIJ0lADpFh0r2aVQPtWR5yj8urzd4U/sqtS9lkFShtJRpmPIKZJsHdXhcBCCmb+pCyqDSYdjH/fyQzwGyj0P2IuNSBzJfhsfeXhhrLAHOG+tRlHQu25R2Op5knpTh2LdPw/CuLzlG1fVISBnGy/RucVlW0od/pr6rcB/gJv8AdSaqHHMNFPRQOMt8pwz4DtQwgB6E0EMOzQ/AHRvCdXA0lzRSz3GuFaMjXx959hlkHnkYhYcfQvGRhzDy8IMovroGIjO4XFEDmnAEBmjzKvkz8vyYprlbxsdTiU7tx6fH4vIHzUT+7Q/m+KS2TPtFFyN93lIo55wNfuH5iH/qU2hddgmQritVmNKeC/3begrF5a/syuK5HRm83lNGf45Ds9PQrAhiBC7b0zFc0F6DX2uvw6fCIk4f7sSckQ2YObIWiw68glN6N6JlaC9KdgY7ixZcsui5jfUrPzd/Di4/tRXL5iTQXqeuD5k6EITJteTlXaJpgW7wcLTGx91nNqg4v1nFhdPjOLMjjeYaBaqBFxhHKfQEgryHiKUi4WrkxWTwSgKjboxu1sBWTHgEsji3MClfRMKOoL++BesWtsHoqEcteUTTk+uhmBEUBi34GYZSr4vSARthmUEhrzSHBjAGEfoAeaAVQvUSgLIYQ7I9jdp5TYjNqkNiTi1Ss9IQNQyhxiHAadBU4qGCk50ohHIpBwygO4xwpwJhcTjDIQr7K2CDAtoIg+hzUNlfBMsTB+oTFwTMqQ5jAVQRQiXAyzkBX+5BEAgOeQjCr/AI7PpqCC8ioNSpUBs4nKSDcsyBm/agNqmINJnwFReE6BEyHz7zEBAADciTK8OQ6qvkGa6ZEgdqACvmomg6qJgulFoN8RY6BKhl8LhFbQcg7AzuGRA5FcUdBQL9WRQ3jaBIgDhDhxFD24dhZezqd6xJBfBJL75gUEMTvKihvKeCwqZRjG7PIrezgPLOHJwtgyhtH0Iw6kCh3lL34aseRIpDnxxFdFoCWrMJ1Cqka4DVKzAnx5GYWUt9VmhL4oOagHTEY+L60BqQGy+/3PsDO/O6Uxna0mUN7yq6RN7Q1k5/aMsngwa3dHkDW0e9/JZ+r39jvz+yzvELe9fIvsl1+GiUVN1g+EPL/ex2xxl4Vbj9Lwm//2XHG9hTfJN2F/2BXUU/t/5j1Y87srPfHnnZseW4DXV2eeX9z0vv7tH091iVrerNGbhSVPbeFRa2CD/7qvAzO/u9kS1r3OFN9zlDm26z+59favc/BUlW/yrCxk/B7iM68CTsceQceIZw9st0yLa2Snbv2ma755VlTt8r33QHXr/LG1m3JhjZ3CVym/uR7ymKctf3pHf6WPXl/fBxKrkV5dGNojywXlj9ZCeDZBP9e4t+f2fRHaQ5NLTGcQdfIdvZMuoXyCZH948G5QPfez+8j0cZu5K9sTi8XpT71gm7b63wBnYXvYG9JGsn2TXJPvCK4/W9Iry+DaPOwOZRb3SrExSHbjzWsjiF3sfswdeE/37XFjnHBkiH/XtItyQn6dcfkDK/7LiU5+R2dXnlXf1hKbdefrrhWMt7JH5hsetBf+S16prgDpO+hnf1O8PbutzhbZ3uyI4t7siWde7w9i3e8EbK2zTqDHcV/dLedcLNLjoSvw+a59m9tznVbr/keMM014Y3dTkjWzolUfud7tD2Lm+os98bIhmGNo/aQ91FqX85Vz9om4fX863uOyrZ14Uz2ll0hreOuiNbu9yRjV3++x3f41Vu8PV+b0DayV6y7z1EnWQ/W0f9/k39/sC2UX+kpyicoRXyGXF4n442LUSmzSnu7bRG1gt7ZG/RHt7Qbw9v7HeHqN1BWgeGVzvuEI3R0FpaE3bTnFvf72X6i4E9cMzn1+Gyy+cfTfZlfnlr0ct0Fl2yV3doZ9EbfNnxBtcepKE1ZD8vO+7wy9XQG6a0zBt6xXGGuor2SF8xqOx/ULhDx9R+D5f1aNNyv320dSbKH2MNWJ7WEWghIq31BELq4KVSKEVSsCP1yJkpWM2TwafQ4f5RtFvx1HbPKn/P378f/Y8+CWXjJtT19yFJZL3+OkaeXoXK3k4wOLWSLSPQLMN3ojiLD4zdkxuFINd/m7N7m7B2bOqyenaPOr17hajkl4yViTRNqms+4+wzZ3/5y5j0e7+Dhq99DTXXXQ992qz5hl57JmNaZ86tXLk7N4Q9RRtZrsFTVTA6NDBdAnKeh+aoiXPaJ+G/LZyFFR2Tu8/kAaZZWdQiT8A6i5ZyBlMzGbTnC6gVHrTAI0AUIhZRvzIzHZ0/p5ldrCg+yiVvkZUXd3iIZGwuznVC/9wwDOtiKn/oHFVf/aWZadywuAHXEDg9Sa2sj/leJ4OxlidbYLTORsWohc9NKAwwCRxG6kKE6Sj2NNRic20tyjwOriVRiiYx2FCDkY4m6Gd0oOHMSQR6kwjqdVRUBV6oALYCtcShVARYWSC0GQJC/IFEqH4ABArCkMHjAkGSIXHyJKQWT0LtyY1Ikxeak4dcEOIL6GBBCA0MCkJIkGoh0CwIxQEhcdKjBlEmdgUXqPiIh0CMDgM0myKOgPAUBL4CQe2q1Kzp+1A8lSowhORR9rmHUAsRkhxUmgCjoHQA17ARbTeRPDkJvwPITLPhzQXUeQa0Nh2hYoPzEIwFpDMXjmof9CwTuAcdHqrRGOpPagKfpqLY6iDXQgcekwIkOlKIt8egEKh2qQ8hSD+eBoUOJPxhjsHXB+Ds92DmFZhFBX5vgOzmCsp78ggKNpgGMD2AqnIYoQ4xHCC3cRjsQEhnEj5IGvCAwbRVsvsiwgEfOnm04SoIGIevc6iT4kgtakHtKS3QpyehTDURnZ1EzamTwWcn4DeUqFwe8lIDASZkbII+jAbC8siNbq7zemvPw6jsuhv2zntg7/gpnO33fWLI3nEPnB33wtn5M1Q6Kex5DGF2xxKUy7UOaLk6OgXF4Q3/rXXgReL1c9LFj+HsuIt08ROK3wt7571wSEcO6cqR7X6MeqrsvA/lXffA3f4j2Dt+Dmdo2xLbLt18dN1999K2yM+UdHgpuQEXTv8KUd5/X1jYPhpm9xfD0fUPBn2rr/W7H4e37yE4nT8lue5DZdu9KG+5F6WtP0Vx289Q3E5EYWH7AyjsfBDF3b94K+36BR2wPUz0IErbfo7y1geqdUtbiNfWe2ks7oe/66cQe34Osf8XdCC55kaR29IZljaIwN11F8l2XDd5wrZn+vnu+8o991Affwxr109QInK3/gwu2Yq160cod/4E1s4H4FC+vec+uL3PwM/tv/FwPX4UaadYnOfnu75X6PoRyXQXqva848eo0Dyv7Pwx5ZGNb78fHo2H3fmfKO27C1bviwhyQ8cc7IcjG5a7e35GY3jf+6Mdb5ST81vON5Lb2f5jsqsfQ9p/qfMhlPc/CT/72kzh96z5KPQZFnde6Xf9As7W+2HtoLEmPZZJd9b2e1HZ/lOi+yifxp9kteQc3b0SXm7nvDAsXH+s5HMJiPu5fV+3up5CZcf9sGmO2NR2idanEq0JZQqtbQ/C3vZT0hWNJ61Xpf2PwRraudwv41vHSg473/XV4r5HUKY10d7+c9hyPdzxk/c3trLs8aKdd5Od30N9v4/oXpqHP4JDMjqdpKt9P4Pd+xhCK3cHUP3kwIdSh29n76j0vz6zsOsRGot7Ye/8CWzSgdSFTXZr7foBLDnPqK8W2XNlN93veY72TaPfE0LEP1Tj4yrTutdMNHNcFu09gyXwDqxyR5+NWz1kk/ukLP9B40QybCNdkM1YUi6SWcoo1wOb9GRJuWn9qnQ+hkrPi/DK3ctDYa94C++POcE/5vYnmicNEEjpgm7erbe3r2w971ykzjgLI41t6KtrhXr6eYiddzH0OScfAq9U5T1fDAQlHA8YyqC27KLB8pAslRArFdGqGWADIwgIeKq+u/A9mb1RIGd5yyqVShuyo53uC6u/vuP//B+8+od/hFdvvgW77voRTdBda6zR3A9sW8ykSamzaGotpk6uC2fNuIrNaLuYNSUSzKjbaul6l8eUeInA8rBpYoipKBEA9MMiwDJAZJQ8fMOYTiB1aUMUp2i4Kgmn0xQBQGCvTKAqjwgsNQmPmeAh0KAAC+piqE9oiMfZgB34n+4aLqz6t7W9+IcnuvHI2sHmvtB5vsT4ogDMECr58qPori/7A9P37EbL888g8ugjSL6+blE8W7iZh1omPuWk7hm//puo+9yVcE6dC3tOM+KnpDHrlDJqmizsaGvGz2ctxaMzP4dH538Br0ydixJ5LCdFC1BqK0BqGKjLQZksoM1MI0jpaGhIoV5RaXHvw+ir+2DtKUKUTDBOAD1MwCUPsbvPQnCA6tsu6cFCOVVEOZJBiFGkfBc+Ad0gIFWB0V+IADYcFODwAmFBCz5cBEEIFjGh18ShxjR4Mk8hezAARDUgFYUfMSDkD3mRx9l0PbBQA2MGoGgA51AVg4AnA1wduohIhzI486E1GEie0ogpl05D+1WT0XhJE8x5UYQp4kH3uR9CUPs+HWg4JFko/7WWo0NIsEpjp6UiaD1nMqZdVo+py+OYdkkD6k5vhkp86VwAUDiED3Bfg8iGCPoqELkQEU+FSfWj5DFP+yZqLGpz2IdHBwSMwLaihmCeB3lYgHwAhbzr6SCOiKGDG8SPASodGKhlwBmwabPvISISEIEOBhXSkEKTgHZTEnpHK+KzWxDrqIM+NQ2WcGGrQ/B4Vooni1IdTFwfQAP0gI0LQScpsm7odaj2ANTR1TTtn0Rk+BmYw89BG69k9ZMAABAASURBVH4e6ieEtOFfQh15mug5KBQi+yJEuQuIxTIhrQCym0dFanleWNoGJfMCjNFnYI6sgk58q+1QW7INdfgp0s+zRM9/bKQM/RLa0FOIDz4Bvf85qOVu0Gng+36evB+dKLDaQziLbALRsrygzZ6w8zNhZx4TxW33BT0vrPB2PF5rbfgpihvvQWnHT+ESoPW7HwMjr7I2+ByiIy8jmX0N8coeRN0BokHE/CHEPSIKY94gHSyOI78PcdGNeLgf8WAP4v4uJLwdiNubESm9Dj3zEnj/LxF2P45g7y/gbrof9gbaJO/8BfyRl68NK53rhNv7VSnvGEm5x+IfNKR50yzrBp69iNnDYNmVNGcehz66CizzNCJDzxE9CXX0CTrVXAU+8nz1nj76NHh+PcjTJat/ZETyzpSN6ZzrqjcCnn0MsZEnER1+EhrZtDLyLHhmFRSST6e5bgy/CDP3BMn6FER+C8JyQVY/aiqL8lsOL6T3SzKRdqMUtkMbevp9zpnVUIeehzb8LHSad8bw07Q2PQV95CnKWwV15Bmw0efpmf08gtFXwKx9oHHWZVvHk5i1n/T3HKJkg8bIE1Dlejm0msb+WZLvIEWoj1Gam3I9VUfW0iF0DzisI87No5VV6pOHvJnZg1Dzr8Egu4v2P0/tPweV1gSF9KRKfQ29AHPweRhyvDNPgufWwC8dgPC8c4+2zfHlya7iY2kunx3ZtdAHVyHS9zzp5BlqcxVUsqePj0gPw6vIRn5JRGv0yC/JVp6gMXsGRvY5aLnnEOZeAIJyLWOpzFhfPkgox0IRpWV0Cgg29CJMen7GSP9xCiNDz8IY/CXZ6yNkv09Bl2nK10afpPViPZhTAmOs9EHaPXIdn9wpbvtb7vnOknB0G7z+VfAHHoQy9BDJ+DjMoWeInqNxe4509DRUGj+l/0lo/U+QzCuhDD4KRdpQaQuiIgfDNMAVdetbeH/MCf4xtz/RPGlAenWZanb5ZuSh2MmL0brii5hx49cw5YbfxeQv/3dEzzgHfrzmG1T0/b989GvcBIunURIMZVWDG43Bi0SRJ3CjkJdUjSRB3kCaxe+PbV7nZ3io3Gpv3YrSAw+jbsMGzOzpReuu3cBzL2Lfww/DKoxcbzN3EeGTNzzaqYyi6+uhigFqJU6E/V2l4gNreu/44Uv9WNWtwA7SJEYUBoGfej+DFrcb9coBxPP7YAz0wXRExjf5tshJHTCmz4Zl1mI0lsKepIHBthokT56GpQvnYWEiglrObgFdYdG6bfWGPrw6XMRq8lCvyvdhY98AKrYeH7Yi395TEuv6+vrW+M+uWuH/9McI7v8JnAd/ir13/QdKa1+Oi+Gh+3gsfoMxu+P25quvQtPv/jai1/8GggsXgDWOYkFTH6ZPcTB6UjvuX/hp3LvgAmRmJDGn6QCWJDdDMfbC1chTmfShT9PRfE4LJp3VDr3ORCVnobC7guIWD0Nr8ihuc+H3KxjdV8Hoa1kUf5lB8ckhjL7UB9sqomyWUYxXUIpacI0yFM2GSsSZDfgOeEC4z9cI/BoIFQ22BqpDYC/mQG1R0bSgEcpklTynIXlUE6hdMBlBTMAzQ7iqT4AwgAStgeLDJ4iOUIXhx6Hlo7SwRRDsC8i7UULQH0Av6wQzOYFRAR6jdolYhBROYweqy8jWuFCgEA+N8JHJoogHKZgEdFlZg7AZGFOg6gJGmsFs5tDkljBWIr4MmmcSwNWoLxxMACL0EBIJSjDizejwhPkKgWROYF6BXyaZbZJFtkcElypRmYC89xXPR6AAOnmbo3RAYTjEO4wiJPm8QCDwqZ6g9kFykXc+15PDPrKZva90ofeVfeh/vRtDG3uQ394DXvShe5z6xcAA6ikIrlNk4vUhNRDqCH0I3yKqAAERxVElG/BPfJKyH5SbZA0lORDy9OeDaoYJQNp8QH7rgPQiifQhZEgEvwJxSE/U3semI4vGpwIm5fGknB71W7R80G4fqR6tXqujrPF+k6V2EzCJh6We25zRtZ25fauWjux+ArnuZ2ANr0FQon2VsxfC6YFv9dEGnfakHj2FaH1EEJCcNNcDRmsGzWFaHxRJ4bi4TI+RXGfg0zwfR3QQiNCFIF2HXgWBW0ZAm8/AyVNb++GWNqAw+BKG9z2D7N5fwh587Q5R3NElN7egix3LTSqjOSOoT6FV1T2TtkFjIENWtQuyj2rewfsgmxFkSyLwSZKP8kWnr4eae0NeOT+kPCSvnDeCQhAJkhdEwi/TclAhojlE68Kh6kcRCRDE31qcTm7HMmheIXi/c8Yiu7EQUvmQZK4S6VyEZYiwBBEUSf8FhHYG7kgXvEw/tZIhAEHB8XyRXhjJJMdbSN1RXPbp0JpAcxEyn/SJKtE6ItcjaTfHSi7Ji3jK+SDbkLLIUFJVJmpX3hMUgmSRNoiQxpTqQNDG4BjJIWgeiMCujlP1WSF1UW3z/Y7x8Sh30G4E2Yzsf5VoXgqph6psFtkOtStonT8GemB0+i+Cg2uTIP6s2k7lDZ2QLAHZK+XLe6BQ2o5cy3CM2n+zCy1rAZ3oYI6ojK4Iy/u/XejZAidzALBpPXYc2rvROuTTs4LWUkjZqvOoAoUcH4rnIAxztPpm4es+WLoZWuMpYFrbt6C03H+Q84nxzk8MMSakMJm5G1riad44ZXF03oKbas47b3XqggsG4qeedg1rnnKmZyafPhotRSKRAVWL3aI2t6J24ULYk1owFI9hNJGA19CI+MLFBFymAEIrvV++PnfnhbZ1rdfVBXfd60iXRtFg59GYzyDe043S6+vIUzgqHzZLHbh1b+XL4m6gLO0r2I89v2sAj+/MYVV3iNdHTHi+CS0I0ZIfxWl7d+HSTa/j9D0bMKV/B2LFAQJVtA6ovIQ586GdsRTK/NNRmjkHhcUnI3bRWZh30Tm4cFoHZut6iZ6a1QnGAg85j4Eew8jpHgY0Sgca1u0L8fDWMh7Y3I+XXt+E3BM/h7/mGWjbX4O2awNKG15GZv0a2EMHoLCgpNbW3pSYvYDFF59+k5i/APmWFtimwPzYblxUsw5nT9qOyR0ltJ6UxbmT1uNT0WewKHiNPJO0YHEFoUlTLO1Cb7ERn6pARHzYRQfeMOhkzQB6OcIuAW+/h9KuAgHVCox9LoxOF9haAh8sQCcPNGcMjqKhQFUClRZG0LAJC5wWQC2MwQhS0BzqvWMg4CocktGKOgjqfETnpJA4tQmxRU2Izq+DMS0Gx7AJOLtwlQAuD0FOXTgSSLMQCFQolQgcAs2FjRXk1xWQW5/H8IY87P0OAgKaoeJTOx4CRkR+bfkQk4sxI9CqChU6PR912uPxigJnr4vclhKGN2UwtHUIhe4RBLYDrgnwKLVtWvAjJQLLjICzCSXUqnHwANwIqQzATBJLCREqDIITEXSVbWqaCk3VQNqEcEModL7O6D4zOFiMo6zaBHoZop5O5zc6HMbhagwsakCLRMBoQy3ltAYtZPflkdtXQrmrTN6rErx9BTi7c7B2jkL0laHZCsFsHQH1MaDxENTqxOvDa4BAEZmOIAIRhVWWrPr+SXhjTMrKUA2OicCMJj8xorlNL4rQSzInYhSVDTEwgNL4uC85CaSQRHIcaQBpEfrwQjlidJ7kwthBXYhSbpk/sqVYPvDsV0s9q2CRl8kdfhVBYTNCayfN/f1g/gBYOAomirQuurQSCDBaEUCzVsAg49LBaW15L2IEqvEOF8lz6E4oaD0SPkIxBBGS19HehTC7Cd7AK/B6X6YD0Q1tyA9sPVThGEYE8ZL6FmE1BjCyB8iLwjfi1TvVcQlRLVuNDx2T8ZEtfVBioD+SkbGDISiUvN6UkdaAqqwy92Mmkk1wIKRnyhjR2QqJTM8uFpB1ufS8qiAsDcHL9sHLj24R4iPSMclGGnxDQTLGQIIdJDDQ7WqcMYbjdknekr0k2QilGWPVtumdQnqXaTB597gSY6zaCmPsuLbznsypfXpBknxjjEH+VevRmiGqJGdnNeeNt2MTVNuh9kB0KA6KMYAx+YbjdjFaqxlrLMkGhDe0NLT23ef3vwpnpBO8UqQ9vkKHlwa4MGiN1qgYh2A012mfBwgoBycaAoTwDQU83QClvgM8OWc9zJbvSv5U6YR58RNGkglBYBKA1rToVp5M38maGy9j7c0tLJ24PxqNro0zNnA0KpKGpmrGHVpz69Ntn1kOc+k5cBacDPeU+YidvxTp8y+AOam9hIAV3y9fgmUDCp0Ywa4AVg5M/opySBuVoIyIZ0MvFqFaFvTAqzWgj77J18944G7JU5bvLXrLX+zOYHNRoDdMYtAywX0X6eIo5nTvwac2vI4VL7+Iz7y6BrP3bEKkeADC9FybafHy5Glrg7POQ3T5FdAu+jSil1+OSdS3+acu+cppibrL2kLl4kBH9bRfM0V3+/QGLGxJYVFzAjMbk+BKDE9udfCjjUXcu3kQL67fiuLrLwLDe6G7GZhBATp5ErL7d6GSHUKgBLWH+mDoD9nMRN7X4LhxTObdWGqsxq/Fn8R1yefxm6ln8RvRx7BMPIP20h6wYhqoJCDIWxmIMjxlACJKp2m8Aj8Iqc86Ad44DC8BVjLgDodwBhzoFYYEAb10xURyRIXRZyGRE4hbcapTizKLw2M+nczZcomhDaIGxY4gHNRh7QfK+3zYuYA2dIBPhwZu3EFInt34yXVILW6COTOOMOnB1yyEiguhUFkJnhFAeqEDTj2mPoZZBdltJQLNBZQ2WyjvcDCyMYv8zhycgkW68eErHnxGJDeQJA1oV0EHwVBCtQqeuaPQIYSL7LosRl7JYPiVYQyv68Po5h5Yo2WIMADUAB4nfqYLxjk41WW0iIYkU6BSXhzQ6nTotSp5yn24dBrp6QF8w0cY8RBtjMNImQjJK+SRHSkaB9MElCRDbEoUJdOGYB4U7sMjfeQNC16tAr0xBjMRIZ2C9Keg1FNBuceCUgCidACRdCJIlg1Esww44NIBANl7UYDToUAYAgGnfHph4vrQGhhTIxuLEEfGWPVhz9iJH5Kg9GJSaqJj/RJVhoe4S32AgbGPn0gIgOHgNRYeTH2od7v6EW1/4RgTkS8v9/P7Vtl9q1HY9yB5dZ+j9XUrDPcAzHAYWjhCy0iGNmZ5aMKCxnwCNSE4MWBSQKbQGqBQjIPRGvWeRCWp6ttenNYnxogj0Zs3aTFgRagsiwiR/Fi4UdwNMbgOXs9aBEPbm0Vp8OviGHrbqm0LgHgSUfsUZ4wBbxBjjKIMY5fAG3EKxja3Y/c+lrAqBwNjb6WDslDewchxe2fEmTH2tvYZe3ueNCJB+SEHDhIDPZ5AhgTOArIzFzpsKF4efqGfgEI34IbL8JFcUl68pR+gi8Q9mAd5n4ECHK+LEfMxkm0w+SbzSAjGmIyBMQbQC8fhkmwZY2CMSPKnkBL0ojTFGfsYQlCbRCCi5ukdAEUYY4CglxA0bymCY3UxYi+J+DGAVf8ACsAYpcYTGI7l9ZaDojcLGSwEAAAQAElEQVQYCzs/M3B6n3fz6+EeeJkwwQHCBC502tupIgIWGiSFCnqjuUTrlwTPLKSk1ImCgEfB45OgNc6GWjsLTGm+jDHm4gS7aEk4wST6FRWHHoT6qHDm5eDNo/27TsZS+rCqYPH4AKLxr+GM07479fdvXLno1r/AKX/2J2j9g6+t1E+Z9y3U1Cxi0Vpa7d9fS5NZ/Bumaq7mNUmgtRYFuMgrITKqQDHCoTfVQzPjiAn9+/FxYF8+sH3ERweD5PKNlo4uNYm8FqNJokIl0FPn9mP24B6c1bUF5/esx6Lhjbh871ZMXf8qyjs3wxLB8qJqxLs1c8nwzJkwrr76++3/46vfb/38NbfzWXNvd5imN6psZb3O1hpAcwFah1ZjLjlvYdNV31rSMfC9s2bjd6bVo9LdjdcPlLFTpNFn1GPIEYhR+4Rw6fEXwKXZoEUMWHQ4IIEYwN03NaOUhKLQomeA5ZI06YGInkNb2IUlmW1YMrQZ00o9iHsWhJ1AuLcD7q4o3O4QYYk2c5EATCvC4RYCnUNLJeBoJsoaATwjiUokDUuPIaT2QxGH6qQJRKcoVKDkGSLFJNLOFOhWHRiBeKFqgGIAPnlCexz0PrkPW+/pxLaHejD06gDCIRdaCGrTg4VROOEQAi0PmGXKq0AzAkQIZBoMBHaJjedXQbmia5AA1hr2kN1TgZGLIm2RLJU44uR5rZD+nLIN6Xn2uQf5FzLZEMAZB0IG4TOELoNd8JDpysHd5iM1HEFDOYF4zkSl20Zmdxb2qANVKFAUDqYIYiAgTyIDHsBTXHiqAz8poLZGkJqehJfykdUKyOoF2GkHWqsCbVYKvI7aC3IE5C3ACOFTPZUAct3JLfDqgFI0h6w5hOHYIIbrMjDmxaBNMSFMQZseAZbx4ff5YCMCcVdD1I0gFSRQ48eQtA1oOY5SdxkuycvckPTPoKhqNcTEdUw0wBgjPgzyjyII6YTik0JCyipCWhuEFP2YEu2zqnxDioTUxomkE3pmjevr2Mgxd1zmB4rSqpbh0A49l4Jiz2Ol3tXIdT2ASPA6Yv5exNwMYp6DSAhECc1EuYqYosPkOjT647QOVXVFp3mh8ECrAgQ8si+a5zhIoPQYsTfyZAgqjSNcsr9vIfL6CiKd2o2o1Da1GXFtRG1aY0pdEMObUNn/EgLrwG2VoHCMARXZGtmEFHPMLmjSkOhkh0FAUVKMvEnzihMxzsAYkzkfL5EMUofVsSE5A6KQDpNlGmCg2xQcDBmOz0Waq+pHtvleFND4BjTvfJrjPunbp7SkkGxECB8IbLI2orACQd5na3gvgqD09eMj+Xiu1AuSKSR5wmoYUrsk1aE02QDJLeieoLzxNY9VnCSgtSkkEof0GVB7IR2KS5kCCqtEYyyOlww0JrItSdW2qa1QUlWO8JBc8v5HSlL3RCH1OxgnY0h5gmSTc0Dq79iMhXhjDES1v1IPkkJq56AuAhxMH7SJY9MmqM1Mmw2+5G38RO4rTmEbKgMvIizvQFwpEnB2wWhPyMm7JQIVodQJ6SKgOeTTGh3QWhzSvg+0J1YibYg1nA29+VyI5Mw7EYu5b2vjOGUcDVt+NIUnyh4/DRRQiKsI4gxuLW3Vj9n3xlgisRXpxm8hkbgJ9TVXobnpK0hoN7Da+r9kZmr30fQoL0StF099LXL6qaj99d+gk6GT4Gm1CJumIH7ueZj6pWuhTJ6821NV17Nyy4TTd61ws4uyVvHmVVuGuv7u8XXNd67twp6CD9upgJcPIF3ejXOMIawo9uDUUidKsV3YM30YI1o/tHwOXnceT23u+vZfPL/x+j9etQ5/9MRmfPuZfV/9/tbyV//8xf03/t3zu258atOBO/weca3sixOgo0J+St9X5oUD/Q8qP/hJc+GP/zd6v/11WA9+Hy1da5GwcgjUNHI1c7F+5lnoT89BTjQhayfhsRqcdOpSNEyaSuxCXYh8bVnkl5dRub6ilWET+EwwAoVuFL1eA0aoXqjXItDqkFda0VdoQ/eWGhx4vIDMM3kceHoY+18cQr63jIC2b43TY4hNU9CrjWKXXsLepjjWNzXiqfqpeHzGWXitcRH2Rk5BLnEalBlng89rgNOhw64NwYIKGvIZiIoGn4BdGEbgWRxD24cQzUQw3WtCeyEFb6MPf2sBrK8EzXGgqyG4EYBpLsAdcDh0EkjkuNAsn7zuQIxHoNMmkPYEoGcebWI46GlMdTWYuglDM6CqWvWeT5udgBY+KAyKroCrnMozyEtRFDD644oKi8D2QLePaCmBGqcWdX4dUm4aetGEO8QQkHebEThVXAPM0eHRQuppDkI9gBvaCJkH0PmFRrMiNa8VbefOwPRLOjBteQemfHomms9rhdHswY3kYUcsyJ20I8izzC0Cxj7MJgMdF85C2yWT0HJpHSZf1oKOa2ahZkkNWHOAQLWg0pjwSkh6YDAcFZqrIwIDJnmYDWaQV0GHQi6HwAU9LDgYI6KOygcTrf8Um3gdUw0wgF5gjB0Vcc7xQYixo2uHsbeXB0P1eiOoxo/VG2MMjDFwSaA+MiI+Lu+wfjN28B5jxz+kCQG5EcTYRDjY5ig+5MVYKqOx2tWSjT/S3VkafBZe7ilE2EaalwOIwqKprkP30lC9WjC3FnDSEG6CsHAMwjdpsupgUEBuDjro9IgqtP5W4ItylUJmQTCb8m1AcarEVBeSuOKDMVYlHHYxxjBmZwqtdYqiQQQJCFrfFLeOzu5qoAUaHVw65A0fRljajcrwZiiV0R/gmF4MJCDkxRgDJ6I3VPPIJhij+6CLxoZeFAHdeiMPH83l0TFxtSVGJ7xhNQYpAWO0hpJ8jOSUumScgTFGZhRCENiQwKJamlXfj/mbZCvbfS+qykdycUmcQZaXeZLAODiRSvkqQgLQPhQ3C5HrBBvdtVRUer+O43pRL6htJomxqv44xatNUhqM0xyglBx8RuFxejHG3mib9MHfJMZYVT9SZ5IYYzguF/FljEG2wan/B8M35ThSmrGDshyyM6DaB8bYMQ2JKxhwkIg33iDGGEWJcKwu4kU83+w/e0Mfb+iBUUj3GYWMMRy7S3fJ9t3D+bmDu75Z6X0dTm4bTJYBD4q0EodQmEZFNZotZJpknkwFuMKIFAiKu0qIIFqDSNPZ0CZdBW6ecYuqzvgKYyxDYxXHCXZRF04wiari/Oq9JanLBrxRjfxgCpQiJY/Zi4zPZQSUWaz+IZasu5Mdhbd5vBApMmIfTLebpzykX3gJYtffgMTvfg2p3/5dJD6/AsapZ3SzeOIaoQQl0Ek+FE7ojXdt6y99+8WuEtYOCWwv6ygaMegmMD0d4tMnJXDNme04r07HNFGiTVGBAKyDmDCgEyg9EETw0P4hrDvgYVtfiI29Pl7ab+HJPQX8sr+Cp/sz+OXAEDaVS3eVSt4yRUG34ikDPBt8PfvKHsRWvYbml59H27ZVmLP1KXx652M4tWcDEkUbPfEZuPeUy7B69pnInLUMNZ+/FpO+8N+QXroM+qQp3YrCtwKOqwQBgU27IxpUkBI2lKiFqAMkiyFiVp4A2G4CWfshPQ4YKCO720axpEEdAPReRgcAHAOdPmkkQoAuippTatFw4XTEPrUIB06ZjZeaZuHR5Gl4YtLn8OhJn8EjJ1+OJ065BC/NWoj9k1RkEkVUtBH42jDU9BAiiNGmMUmbNp02gkBmpARREIhbBtIVE/KjxlHyVlfBoNDowc7AGGijKEBuZTBavmSfNCeE4ZGM8uM0IH37ZH0+FVEYjBoDySlxuLEKckoWBYXGxfQRaTChRzWAGDLQH+PyHcQZtMCBc0ozVC/OBVQC7grnkN4F3wsBAqIaN8jjrIITQOWhAcU3wD0DUECA1kcYUjskDy9zBKMe/KxDpqTAbEkhMj0JfQaVbwfUNg4/XoFDhxq+6kEhudWQUX9VKIFAUClBZT408kzr7Rq0GTrCSQHcmgo8s4iQl8AYKYDkU3UdXFEAP6RDioDkpXZDDx4PEeocelKDYnAIRl2TGxI61QVkryk98TpmGmBgVV6CdEyvqk0djIt3jFcrfMA3xtg78n2vdsfuj5kBSfgBpXinagd1cfCdyoyLMEYJSZR9+GtMruMevqVhmgs0YNRm3VuyP0RCFDNftYdenelkVoNZWxARWfJgOFBDBTw0wQQB5TAOUaUYzdkorR0RgO4h1ADySEOQXPAAOoSjXRwETXGhMhCLapyWIwLVIXx6rxILKUZznuY39eWQ9IwxMMbelmaMo9qen4AIUhSvAQPJRusOE1k6eDuA8uBGWou6momffojBMYwwahFV2RhkSO8U4uAlu08GysAOpj+Od59Rv6uCVFuXojLGDkk0FhNURJCs8lUt+DG/MWpfkkICqSQcJ2IktWDVHMgQNP6c8uhRR8+cAri1C+W+jfCdoduEyLQRi+P4YlXe8p3Jt2pKvjGSSIaomj87GD3275Ix0VjbjLFD7TLGcCiB43zJpmR776NBmoOHhGGMKr6RkvnHikjrpPeqMY9xP5SWLTJG75LeuPuhA2J3kAcDY4yiDGN/lAAliCiHUVBN4JhcjMUHVDS8+QNh5fIi98AWUe57FcHINnJGDEOhA0pGqyuT7cp5Q/IJHsJnLgK5Ripy9ugUjyCINQANs8EnnQOmn/wtZrTfLAUtiVKzjaErZfxEIn4iCfNfSpaj7Iw8bTdZaneMxdZHWfTQR9aOks0Ri+fJY0wLAz3A3rw9JMTMN1PvP6ZCdf148i+9jlkd+NyKleqXrne1z3/haXbW0qvUpinteiy2PvTU5qyr/m1nRXmws6SPbhkOsDPHMBhEUVYjtNcwoOnAlJSG82c1Y/H86Xe2n3wS6tumI202I12uQZS1IZy8AL2tHXip4BIYpU2RHUPgR5H1VOwdrWCInI0DboAu38E+7qGk8rnkg+gk9NTJC/by7LqtMHd3oz43hMnuEBYM78cl+17ByQc2IVocxLAew+qpC7HltLNQuvwzSF17LerpEECdf/INaJ48j8kDB9ZYMsIwo7kiHq8ESOUcWKN5BJ1lhDtKcPZlMToyCC8owHArMLIliNEioAlEfB9xh4OXdBQGVfIW06aKQFhkegyp01sQnNaBPdNn4fW6U/BadAm2Jc4jec7CIwvOwU9POQMPTZmK/XEFbuCClStwymUMhwUoZRMGeWx5yCA0QrvRED5tDv3AAwIBQ2GImBEYqgmFwDMXKgSj9ulB79PpLFUDCwEJMNWQUxmVNp286nXVfAVcCaHRwUbdvCSUmRz+FA9iSghjmonUzBTMNPEFB6fNKaf6jBZGBrqqb4CgP9mAGWGob41A1AUoGCXkeJ7GvwyRYIg1RKHHDQi5oNKOlpGcgnF6yBBf8kRruQjcvSFKWyrIb8kjt3MUpQzpmznwogRqow4c04GreSARqA9aVX7TidDxE4fVbVXr5HYOIddTQDHrwnZDWrRDOjpwaVF3CFjbJDQZUYJDaaB6ZI8+XBo1AwAAEABJREFU9xEKBx61U+E2yUtxktecFIMS55D9Al0KeUgYPR8pOvE6DhqgZywOEqPwvenDiMDYe/Nn7J3LfJi2j0ddxt5ZVsaO8T06eKIBqnbj4HQQejXxId9EPr/cLe27ozL8MlDeBt0fheHTPPUitMZFabOl0ZonEPAAgULEZZwhpDUklGsKFJKAg3pLKxUoFBBcQ8BNqmvAp+NOnw7ofBLXo7XHHaNAhScXFLz1oucnrU3irZmHUgG1C+Kr0bphwld0SJmgVsB5Bl5+D4LCPoTu/jsOVZmIfCI0QE8kKHSQohIp1TWfLEooEFDH0UFbU0UZurcf5ZHN8Cq98Bz7JrIb2pJ8Irr6X15IGovqHJYhYzSOx4kOKpKBFh0cvBioqSqBcUhi+K9xMUYomLoiCOD67p511vCzcDOvQysfQNR36Y7cD3IEtB4HjCGgdVroPgIC1QFcGg8GERgQaiOU+pOhti4Bauffz5LNf1mtTG+063cZvGaKnlAvGskTSp4JYY6BBvIElkslccjYUuQxZm8Y+Tj2iXHxI0YPz6RFR4/p+voUi641kOzOpWpvL9TV31BM1nzf0RPr8cY1YGPVS8Phonv2+Hh4v409ThR5Oo23Ax8gUAICJ77n0aRBFeARHFzKzjoH0UuvQnz2JWiIn4FyyxKUl1wM64yzMaLE4dsq4RYObihgURWhHyLBdTSbMbSk40g3xWgCigHZz0bGSmFoIxzeBGYNwxYBbNoUNZQVTB91kXRyYNoodPI+pmIqEmecAvW8M+GdPK/DnDSZ8XjqTuJTwtjlGKXQjbgoUbsHXBRXj6LrqQx2PFPG5pc4tm5uRMaaASdsgkKbsyQB+bg9Shg+gxAEFmkzZhpJMAKmElS7ERvDSh5bCGxvUpuxNzIPOXM2lU3hQDKBzZNqsbq5Ds/FUqjwBBLFBOI9CbjbIti7UUFljwOe8aCFLtRoGbWzImCTBCpJB5WEj7DBgGiJAqQnWqUQCpM2dTocRSNS4NGGNwCjhz+HYAp8itt+AO5o0EhPjBY1Xy8gNsdA4zn1aDm/GS3nNqH17ElIzElBS+qQoFmhfnHBqnFGQBrEp/qdZRZA8ADRlIGWDjpNnClQaiHwXJdHqb5EsgGJmUnoDSo81YXLQwQKQA5+qL4J007D2hEit6aC7ItljL6YQ++zveh7dT/yfaN0UOEh1BkqtKEJ6GBAE1FEvASMYgzGaAzlrS4GXs5g6JUsRl/NoP/FAvrXlFDY6SPhNSAVJJAQGmibSyKXAToo0KdHoU2JQMQE5IFEEAlgmR7K8RB+kwajnTxKCQUh86ubcU0I6i0mruOgAZp7OBr6sCIcTVtHLEvzidOmiBF9WFk+bP0jyscYGDv2pHAOzhXQW5U/vZH4zKW3D/3yvZHHrMwGOPnNBJxziJAnWXFS9PhoQiCS8GnN8PQcXGMEnj4KX88i0IoIFIvWHg9CEW/IpYIRUOZEIXmqfarrvUEOeaw9SF41tEym4SNF62SS4jFwhepR/0B6o+cebfJEld7eMXkKWUCoZuGrFdhqSASSicrrpApeguJnEeYOQORHrn97/YmcE1kDjNZ5lfYPKj1rVALPCj3vyLhIZIXsQSPSD5HCPJisn7Y3PXByXQid/NcZ7b2o8MTrBNEAjQc4zevDSeYfMyL+jDNwxlANOYXszbTMY4zhv9LlV/pX2blXURp5hpwYuxENStADRmupjoDW3oBptGZzWiMDhBqtz7TvE8yHT3Mq8DRo0ekwJy2F1nzWerD0LeN1w1gqYyBx5/i8EyHOTwQhJmQ49hrQNLdO5EXtu3Au0qYg/i7333arP/SuLzrOPHmDMea2MHVlK9PvpPD+Wsaq3vL9bmHNfT07cNv6nbhjXQX/sWYIa/fnkLccAso+IaQCIDx4UNCVFXhmSwb9WXemm0h/S7lk2ff9W76FXf/vVuy/45vg/20ZGqY2gBHYGa5RMNoQIBcroRRkEKEH1VUzG/D100/CV+dPx8kx5bIapbx+rE9uwkVd/X4YyRIsPYlM2IZypRWl6AJ4ixYjflEHFp6Rxt+cXIvfnjMNixvq5hPo3j3WNxlKkgcRmbhOIMpc3RONYJejI77ORE1WRS15OWtH40hv0mBsdKFZHhJ1HE3kxWzI04OVtmMVbpHHUsP0jpNhkqeb0YM4oP2lrQFFM4m8WocyiyFkDhS1G8zvAfPy0JwQkYoGjnoUe0wCkTr8RyKY+oSJkWe6Mdp5AG45g1AtoG5uAnVntSF9ZjtqzmjHlMtORTg9gUqcwaVNYEgeFo8WL5ercCjtKgo8riBQaUGjuCWArO0g2zMKO1+mxY7GR7dQMemQocVDZIaCyHQdoi6EG3MQKmEVMPNQoVABIykB2ixS3wQLwVQGnxbGQPGh12poPLsWky5sJpqM1gunYfIFHTDbTLhRB2XVgm8KOJoPVYtCtU1Y+ysYXZcB268hnWlAkz0FDX4z7H6G4f15FEZoQ6qY0HiEvAIUkjdKdxPQ7DQqe23Yu8tQ+kLUEJiud2rQXJyEaHca1qYApa0W1LwJ3VbBvQCMuwh5DtEpOupPbkTT3CbEaqivRgitxkC6owX1Z8yDOrkOXkTqLQDngMIYGCau46IB0i0n+1TINt+LOA0GYx98JBhjNJ68Su/V1jveJxmkHJx4sY/ZKqQc7yjn+9Dn0dTligKucNAbOFcg+0/dd/EhL2ENXuuVdqI8tB48GCFiYG4d4LbTo6MNYRiDp9hw9RH4xgB8fRC+NkLrWQahIoGsBUbeaKZQPa5BkesEojDNOsSSrYjXtCHRMB3JlpOQmDQLcaJY62zEKB1vPgnR+ilQYzGoJq0tug5N06Ao1D8a57d1jQlALUBIWbQMXK0CR3NpnQ3g0FPO9UowlBB+IQe7kH9b9YmMT4AGCEAzEYKTcXM6MGbkeYZQEUKBeINkHPT846JEz6Uyhgf2Ip8d+AR07ldHRMYYrVM0ihQyxqpzemxey/CYEa0TClfAFY5qyClUDqY5xUFtVwn/dS6rNDhvuP912JXtUMIhqKED+ArtJTWaJzpCpiKgfgcsoJAeESrto1RAJYeOYSRhNs4Hj84FQ+t/Z0bd1sM1wwhAH573caf5xy3ARPsfXgMEGPXxXKSn2TCMrSzFMuPzx8cbGdvNGCuNz3uveNIv1Krcay4J0TzqiHkZIdpkHdl+piLaBnz/yv0Fe0nvkI3iqI/A5tjv+thhhYjXp3DWrMmIhRECXAJgHBnyHr8wXMD3d5SxrRDcGhixlWFj8+rujlm4T2vAI0UNo66C05riqA2LBHhCIh1NqoGLp8Vx+SQdF6dVnKwq329U1ZUmSx3qUzwWu3/K+b+HyrnL4LRPhRqpQXZSK8JLzsUVp56M77S14E+mJDF/Okddkp+ZIH3hCFeKTo7rmLHVdI1tvEQbtlwFZXsubCVGC6OLOruMqcMWIkMO8grQPyOCkaUp8AtiwGkpJM+oR9PpScSn2mCxCkJaPHkYRcrXMEfkcIb3Oi4duRdf2vp3uPmpv8afPPIj/PFT/4Y/2Prv+B/lVZhfDBEOeCjlMwT2Coj0t6K+T4W614HTJwA1iWIqivL0FPyFjVAXNEAnT2oENp386QTG6wCnFlHXRML2ELML0L0CbQQccPLmBP2Au6YM8VAW3nMWck/nUXrVhjIShRoo8PQKrEQWdjIHESlDFS7l08JHGwXBXYSajYBbtIkIoNIJo0pAlldoVbQZwoAWSoXK16vkuVVgzgK0DrKLhjwCowyFNiVR0kOMTh4jngI1DAHPB4ohvCGPPNAmzNCkfBUG06DZHMooBx/RoJR16kMARm2DFwFeAEIbVj/FMwKqYxArFZamQXUjiJQNKuIjPzBAi3cAx1RRNDQUdY5AC6FoDkw6HIjNjiJxThw159cifV4zYqenwaaXUE4OwYmR7LpKni8BVYAWekxcH0ADjDWWGB2+yXUDepgRSZqXzZfDn3wdnCkriD4Dq/1TqLRd+p5kt38a9qTPo9x6HYqTfxN+85fBzFoo8lfv6JDO1suo8BSE0MlGPbhksxAqSV1EqOThmjrZ9mJq82pq63MotX0W5fYrUGn/HCpty4neWwaL6lhTriaZPwtn8q8jaL4SqJlLbZRrI5AzjKLH+CUYYLOATu4D8mySMepRKHP/J7zTboV96l8Cp/wN+KJvwV98K7zFf43g1O8cc+ILb4Wy8G8Rnn47lCW3gLcug6rXXvOhu+oO3cWtPdCsQRi+B40xcNpsQSnS0I0Cag6MV2gOhnTfgGpxgNaPQH7CRqmhtWUmgtRSiJYVYB2/Cyz4Y5LxW2CLvwl14R9DPeUPocz7OlTSlzL796HO/ho0SXN+Hxrlsfl/BH/RnwGLvw2c+r8RLvx9+HO/DHvmFSg0n4ZcbBIqig5G9qW4JJNvAkECKgErk9YgIwhpTCKAnyY7jNN6m0HE30yy7sFxuwTpYIxoZUQV4FEegTtU0wyQRnPcBPgvwliQmui5RGsT2ZgClmhENtGBkXgLbNMhbQ7CoINtzUmABQk6KHHg6nnIZ6HHUiizyXTYM4hk+VVEMusQZvZ2/hfRzCemG4KFCLgHhCaNhQFOexXQeuHQFMjzGXBbvwi28Gaa49+Bd+pfHPN1MaD1N1j8XYSL/wqC+Atag8XCv6f0X8Nf8B1g/l/AnP1NiPjUyz4xSj1MUJofuswSft+1/uCTgvc8gcTwdtTaAa1zEUAk6FmbRJnX0NIsaK/kUT4QIYeT4XAaE5o3agg71gTR/Cnw+kuhxOZezPSa9ZLvJ4Hk6vpJkHNCRtKAKBbnUVB9kfHGPauw1O7dKbKbXnIG1r0sBjp3inwu91i1wFG8lbzSsvHFhSg1e97IMtfNL5G/Nk1t6bYtZsYC7RlTDdZXgBLTQSjFQonKWrCafSVYMuyIB7ePeugm0Ft0abMa+gghAMeBQQ1EYxoEeS6hOVDoQR64BgYLKp7tKWL7cB55y37Q9tmSHQS8X+4p44XN/RjtHcH5bUlc0BrHeU0yrMGnptXhM7PTWFCn7J4UCc6Maex2Yv+Wl6EmvhFZeNF31SsuQ/Lzn0Ljr12KyJcuR+SaCzBv3tTSZxrjbHkizmpjysWRSER6rPV3+4EPLQy7dCbIO+qgGCtDCwIkCYxG/Qo9VIsYov2TQ71UCVzpkwLwswSMU9NILKhDfKZJe6scPLVAwC2EEnCknQDzRBnniF6cm12Lc/Y8js9s+yU+s2UdLtnxEi7sexHnOjvQYjlA2YXjU10lTw9sEzFXQYUGoc/jyBoxMBZA07NgdSNwWnMoRwmclh24eyuwNuZgb8hBbCeZB0mmsgrF53BFSJ4RIDPiYHBXCU5nCOxh8Hb6qOx0YXdTXwlwU5cRMh+Ce1AY5VFdleTnNH5cji1CsJARTw0okFzk+c1vLSG7uYjc9hIqPRZEAHCTQ4kDLOEj1CsImAtGdVXiQ2soJLGQ8kKH+uhByI+RU3vgPgLY8AM2an0AABAASURBVEKLtoABmC0A2iyz0ACIg6Ay0sMdMHpYshBu2aMyjA4ONPBQAUJBUgZU1KPWXFSsEoXEU1Hgc53iNHCBhrDsw8qUkcvkkHfyKHgFVMIKXCIR5ADFAgmAkHGSh3gKjonrw2mAMeZyVV+txFu79SkXQSMQqrZ9GpyAs9J2BZT2K9+TeJsssxzq1EuJPgWl5SIwLQ5GG2CQjXuqB5eZZANyvAQCxgACWQIhQrKXUE+A1ZxMwO9C8LZl1N4y8PZLoLR9BgqBaOV9yCDLqrLOtGXQpy6HNukCKOmZDwGxDGO13R9OS+9c26VeBXTgRN0ACMzxpvOAyZ85k03+7GJ11lWMtV3ylXD6Ze2RGZ9j+rTPG8eazGlXM3Pq55g6YwUzZlzOjPq5TNdTh35A5p0lf/c7oZeDsPrB3QJU6iNHCHI9Q/AKhFKiuENTMQALGWVrFCYQIEWguQW8bi60yWdDabsIyhSypSmXuWj79FeCtkuvU6dcxnjL+Yw3n8d407mMNZzDeMPZjNe/QdX0OUxtuohpLVcZfPLnGZuyvJ21XXY7b78MytRPQW0/D6xhPrXVhIAOZKQMoE06wggUWm80euapJC4PVFrHTCiI0DpkQfP6oHjDOD4XI7bjqLo2yTTZvKBQEq2VqBImrnfRgAD9ybWDyjDOwSJpiPRMeIkpcBQFjNlQ6Nmv0HOQgZ5g3EFIzwZBz+AAGnxE6d2D6ZD95vYgzHbPJFbVl9xHVSMTb8dVA4LRGDKahEIDp0MkLseU9hs+rf2OUo8gtQiYcul13vRPt/hTl7fQupggOmbrozGd1sPp19CaeDXRlcyk9degtD6D0tOvojWT8lo/xVSzduVxVcRxZE4rmS73/n6l+y574BUEg+sRtYYRCwTt5eS+ykDAVYRyHMDB6WBRDeU9H3JPFoQxhGoLkJoLte1s8NS0G2iuPX0cRT7mrPkx5zjB8PhpwAkvksxHhTMvYxdvcwd6n6/88kUU73sYo/f/DMOrHkOhc/1yO5e9TZZ7v1RSDYy4Yon0KJdte3klU1xr9/essgf2rskPjY7mSsW7CBe1sGhqLWOpDHmtS7WMddcgMhBzgniEcIXreV/dNVDC6wd87LLjGNBiKHIbEe5jnuajuVyAPUwPFKMXmpqnCUYTyY2BeymUKgWMlnIouTbcQOgDfQVYB0aQ27EX6DmAsxpjuGb+FHx5QRP++4J6XEd0dlv0uw1xXBVGwi4Rt528ELWSxvrMotHuQm3stviFiy+r/9Jn1zbc+Buo+71ff1q/8JT5entt3Vg50ws7GW3igULcI/g5ln94yOLxAT1pINqswGvbAo0WBdWuxYhRh+enpfDk1OnoFe2IjSTQUrERTilAnaZBm2RAJAVsesC6sBDCIc+tjbhdwmTfxnzy5M4oFVA3MoKY6yJJnpaYU4FhF6G7JTDfIX0JMAIBDi9D/kq0bQbIpTSMpEzk6YGedIuocfaTl3Y7PHU3KhqBwEEPmQ3DyD2/G+UX9iC/ZhD2Ho6wUAuIOlihWpVmpGxhOO9CMBoLX4dKhx5BTqDUR2CVvMiaH4HumUQGVN8kLGsA5LFmtK3l0ME8FWoQBS+bcHtDZF4bweiaHEafLyC3uozKOg/2oA9mqVCIP6dNh0IAVHCBgAfwyT58xYOvuBC0ESEBwCIBlFgIV34EUi3CVQuwWB6B6oHpAREDVBXSmxjCgM+IOMnFNTBNA4g/p0U8Ksnx4KtlVKIluBEbiDDqq4BCXnWd+ma6cfC8Abs3wOjWPA68MoD+1/rR92ovBolymwbg7SshYptQHeLtMoSMwaVtcUibJ0xcH0oDTG1+SIlNXhKtmTU/1jDnvGjj7OuiDadcFm1ekIg2XWzEmi9h70TyfrR5mRFtmn1domnqV1KNk28y0o2AtAV6YIPsQArH5JugORQysIDshIAOiEIRpSJpmLFWmKn2Uqxu5nfjdbP+Ml435yvRpsUt0aaTE+/U9vj8aO2i+dHm2VfFmmZfHG8+qSNSu8DQou2EXmnHJts+DiQkT+oTTQIZw5gphlrYFdW0gx9709ju6Bs/PskYc4814ThdIa17vpVF4JXBeQCIAIIOCQSNqaB1RxKECtAc9n2FlqMUXL2ZQM4smO1nw5h5Hoz209eqTbMu43UzEmqk8U5X0Y9qoyp1JbsnDz9Uvf0mPT69Lpo65bJ08xKkmk6HkZwFB3UkRg1oQcKRLuJB8vPqrZDWdknVxMTbCakBAreQYyZJCiinF+MaEqlJiMSm0AFuitb+GAQLID2ZjFXIIn0wwSBtk8En6yzRE4nKuBrcYgZOYR+EPfhV4q0TX1fynaCPRwM0BtQwAziDAqU7zuIDkmhcqp+EovCYrJH4FbiiKMcjTuYbzsAuWEP74JdHae54YPAgaG8sidEuyUAWqq/SwaIO+Ts4gZ6Howh4vA08cgYi9WdDb2q7m9zSx+2Q+XgNBz9ejCf4HgcNmMr9kmsdM7aqQwNfHXnmWRz4x38C+8mPEXngXgT33ImBO/8Jpe49X3ecN73Uss67UTPTnk5aHmIZt07ZN/yY9ctX2oZ+cA96/+2HGPnFQ/C3bVjRULHevvD7w0vAnEU2czv6s9ayX6zZj1UbC9hrxVGpqYNXx6BELHxuQQO+0iBwafdWLOrcgCmjfXRCVSEwo6CQMmFqJaRSBswoEQ+xYHIKrUEWM1DGLJWh3QHOrjevu7g5euana8yWC+oNNl3TvhEJ8m0qylc6CJY48GSxt8hI2yvyceq1RTOxIR9PrR2JRGr7dHxnP9xvZYRog7w8ZV7ZdRfloSwKIZpllqQhIeJFUZwniRZdXeZpcRPxyXEkTwf2tp+M51qX4/4Z1+LvTv0t/OGM38c/8GvxSuUs+IJAtVlA2cyiEinBiZJYUQZmcnrQOlD8ErSwiEixD5PzBzAt34dJxVEkaIOVCmwk/CLU0hAqI720aXRQ16QhTmTHXGQjg+hpdBFrTmFOrBHTKjpUYQFRC6ZaRH2xgMYMMLSxhJHuCnzPo72nh9H+CkbIK1weNsBYIxTymkQ8H7XlAK1ZBe3ZGHRfAwsVAhicDjUUMN+ASsBZI9CsEOjgdB8EukNwBIxIMIRUHuR58bNAZXcJ1k4Hyf44GgZqULs/CX27juz2LLwCJzljUAh4iyCE/KsCZwLEnuLCo9DnNkQ0gNZoIEaHDmW9iLyaQSVWgJ+04UYcxFtNpBt1ks8mXioEbVd8psFTVIS6gsikWoRRBQ7pUYFHGxkXFRqHfDwPL+0j1WaAikNjOmKC5KskgAEVmfVZ5LfkoGUYkk4ctXYK5rAOd5eD/KYcRFaDWjHo8EBFyBgsYhKSHvDJuU5YSeW/vGBG3VamNa5m6qS7mdq4kmy0uqF5N6EZOwgIEWirgegGn8U2QInfL/QIBHliAQUgGz3IIwSjPy40snENCA0IESX7jSEMYhSvuZsM7zao9bcxte3OqkyssXSw7ru/V2VnrQ8x1vw0yS2/OkIT/t3rfOi7AqBXlSQv2TfQnJTxAhCXIXyuV8NP2Jtw8ggqQzQmZRoxqcrgjX6q1GnqEo0h5MEdHZqBG3QQGEEYnQK18VTok5a6LL7wPBaZcyYzpR0xyQAplqJV8YMrglF9prashNlRp6dPg1q3CK4+icyIAHTV1t7KmzEakXEU+D58eThcqSx5a8mJ1ImiAXrOHxJFxkUoaG1gUCPNUKLTaTpNhs1r4GucDk3K4LwARXjgglM9BQr3YPIiQjooVmlNCdw8KqWtCKytd/j+6FIqNPH6uDQgAPkpnTAMIOggDvhkro0fl/rGtyvEUHPU6b0vyG3+er77VYSlXuisTE9bB7RpJPJIvQE4Lb3RsAAjEGB0EhVwF7bmwtISCCMLYdR/GpGmC74LHl8JJaSFHZ+oi3+ipP0VF3bE1JbRoh73c8UVfGcf8NLriJdGEUMBdV4Gbf3daFvzGvI7d6GSLW85GnVpgdYfDgxvqTz7PAr/eRciDz+O2MMrEd5zLyo/vRf+pjVrxGhxxRhP8vLOHELyjGGWbB5UY8v3hwzb8j7ykRgC0ObU5uAsgmR9BBGRQ+Pe13HWC4/hd559Br/50mpcsHsjptjdiNXZ+MzcJsxtSCNuRq6KGuZNHTEF1y2di9/6zJm47Ow5mFwfOa/BUO+u19naWKzgilJumcj138ay+cfCA313sO59d8WGe9ali8UVIi/ItXpQyqp3vBBbWYOmb9VhysUtiF6cgnITwcQ75D1ZiqVSK8ua1knbMoJhTlyIfLV+I2OlOLyiAV9njLmCwDTtyBEYSXQ3T8OPF6/Av571ZTy64Gr0Np8DO7YQz6nzsVKdjr1GMzy1Hb7C4cOC7zvwXA+eHxKwDhBwH/Kj60AGUSOHdMxCPOoTBvDh0wMZWhGxdICGlig4Sog0G6hbUIemcxqQOKsWdUtb0DAjhhry1GrZPBg9qPNqK4a1ucgEC5DvaYYxVI9kPolIyQCxgOZHYOcFKsUQgk7TtQiHajiIJwMkUwwIy7DNEkp6CSIlkGyNgSkeQpI14FLmAEIhuRUKdQFfC2DTYuirlOYhrEoZhUyOThkV6LaGuBNDwkpCz5oo9VvwKgq1YYAR2OZMgeCCeIdEAUJ2MAwolKeTaoKh8dQ21C5ugDIjCrtJgdeqoWZxDRKzk1AbFJLNgh54UEOSiXlwNY8OK3xEp9ciPqcObKqBXKqCkWgF+YQLtHCkO2Komy43uyFCT4D5BoSXQLnbAhtRkLCTSAU1iNgJxOgAKGnHaH7p4MMBeCakIVOhksdL0KiAS4shvWHi+ug0cOSWWLS2G1q60wqNWg+a6wQK/JADjENiZ4YQjB7egA/OHDCyF7AAQv5xKqdq4KrSeRAwfziQhY/wEtQnSdUmpSkSBaATtmrGJ/jNJVBCwEOjsQoDCzR4RAqNogJB848ReGZ0iMeEApUBoLGOxltgJKbDUSd9A2j40B8dJ65HfDEC0dBbblBS06HVTkaeDMwlkHXEwpQZ0kZ9bIxCWq9Cu/Rtyp54fQI0IMdOPidooKGnOmCk5qEkmuhZQ88NzaW1pAydxlchWwwJOgh4UOk5ygMNKo9AERb88i7kel4ArMFVn4Au/5cWkXNGaz8nYv+l+3ksOkdrlv6OfJyhVV7m9aX5zmfBy/ugeMP0OC2Bk/2D0d6qSj7k81X1dHBWgVCKcFVBe8YmBOZCRJrPg1F/MpBoudkL9d0ejIF3bO8EvcFPULkmxDqCBgh/tDECdYon2ljJBssWoNOGkMEl0GIjYlUIMBVowS7D8wgwHIHHkbIqotKGmkIpM7oHg7tfR2nPJpi9e5Ee6oWxn4D45lcxtG418czdRaC5dqsddD7eX+78x9d6b/vH1we/94ueytd3+goKkWh1gjDhwyRPdnLIRWNvBrkXnsXoy48hsmc1Tu7agMt3voYVu9fjS+4B3DAnghUzmjAzFlmZjBkPJZlx//So8pdnTq7dekZH49Pm+442AAAQAElEQVQz22quiSQZeZYOSm7byiKnbN0VdvZ9ffDnq3DgP3+KgR/9BCP/+R8Qv3zyB2Jw56hTyl874lnLhsviq6PM/0a57C+SepMbn1oW7SZgfGiiSg8zpUuK6zaLkvXNIDu6tdKzW1jdu4Q3MNqlFnL/IMrDXw2c7FJB4NciL+wOswOvT12E16Z1oKshgRidsDHbR57GYVD1kKVFWgmTUAIOw2eIuCoBMoO29SadUkcRKipcxUNgVqAkK0i1KUjNSsBp4KgkQ2gtCpLTIoiRlzVQHQQxAZU8sdHZMcQWxJCYGYHR6oGls/8/e38CaNlRHnbiv6qz3f2+fevu13u3ulu7BC0WCYyEjQBbYCNiBzIOJBNwYphk7Jn/QOY/xpl/zCwwSfAkBjsBxwHbCBuQWcQisYlFEpJaW7ek3vu97n77fe/u92xV/++8VuOWWCSgtfJK5ztVp06dr6q++urb6vYTSouzqzdw1HkZN6tX8/+mL+Nv4wtYSidlDapUmx7VrkelZehLoSBOgxFhFvptlsstwh3iYLykzMrlPukWS3FXjuquEvkNLlHQJnS7RGIoJOKchk5I4vZIdETmUIsNi/UtRveInR6RtIlk/rEbkWRtleTCC54EU7QYGEoCLApQrkZELEoeNBp5wJH3rgQftfFQnktOTtarO0cYuGycgSvH6L90iOqePtS4S5gPiWQO2gj9MtAhOBFdqaMPCtsHqF4xQflFoxSv7Gf4iiHGLx4Sx7mKW1LgWGxqIdHiPAu+5RDVU3ipL2g83MjHE6HvRR6erJ3uKugkaFnLzPFHHskGn+WspecCBZTIRaN1KxUj1igHq2RtUcgqo7LbaikB1QWdQU/yEKtjAanHkKXMaMggKz/XQeaMknmiFNl/2Xgr0MogK4slH63mz6NbFC3uTcMGiPPs2FCkw5m1sTJDK2uL1MiCyZpqkaXgKEPmQPs52du5QXlb+LZSIniezjk7/m260IfXP0gSOIjv/mN7E15afSdjwqQRYdi4frVi7faco0C2Rueul9JauE6hVIBbXIc/cgk9b5KeWyCRIHLGZm6q0KKzzvBnKuUUR/Sd1KIROROdprfwILZ+HNs89T7W0rNDAYWso6ynkgIZmOedbOQZStnJckjjzC8zn9CnDWduNMuP7klP34WpHcCP5iWA1MSlJ1RNpLVBhDNWWZDgpkr6MYgd6bTpOQXi4CKK63+V3PiVuNWRjUqplu8P3emroact4MnTlPTThHcN7dNAgULKlAh3P/XUlCkFpH1lUi9Pan0R0x6NIMfKQD9+tYrn+095BCnR6k/J6uEcK90ZObVpkBP7o2Rj8qLwTavOwsljhKbnr5jo3ftWetv+8uAy//nBGn/24AqffKTB9+cionwOYzuyd5oEaZf+Zo9NRxfwv3E36QP3olrTgm+OXQuHecXxh3hj7ShvGYp4eTV/3YZK8NpswKqkZsfy+feOBuFrN+ed1/YV3E9l9dm8m7a5R3ycS7uNaKzxvYdY+tuvUr/p83T+9u9o//Vfk372M9gjh2jG3Y8fSsNbb242Pvzp+dp7vnx65dZ7ptp2uW7fleHJ8J0D27OAgNuNb0hPz1+28t07xk5/+avMfPHL1L9+O+bBR69mpfFhE0dvQQISqSjLmjvISk6xUoxpB7HMVyCKyCcrFGwNWQmKcZNciDiweQpyhp2vFfBrebScaBpTIHIcejlDXI1xN/kULunHubCPYE8/lQvlhHVrAfrkvZcSiqKOi2CzE9f1CpFHRNWQWBzvtAQr/ka+Z1/CX5lX8afONXy8cgX3D+xktrSOhtsvQks+9jSVfpdyJZap10hUg2bQI5x0sXsrJK+okruiKKe7FSoS0GA4oRd06HniFDsRiU5WIXOaMQqdujJPTwSmlccYXTS4Qw6dUsRKvkktX2e5sEK71KbcX8b3NZBitWHVecWKcaFxrY+bOapJAbdXwjZ8wloqJ+Q9wZmjsnGQwV0j9G8Xvh7Nk0g/XTck1iKsVYS2PQlSRLjipDuC0wrP+tWA8uYh+i8aZ+CKMcYuGWVk2yCl4fzqWHEMsmiA5CQk8k0q80tVQion2camwscGo6wECTIAa2IkvIrSVnIBsm9ZS88hCijrtBT4skgopZHyKpwZoqyZrK9sQFBdVnPhIatCLBFGxYPWzgu3tgcaNGRX8ZxOSoGWm9YKpRTI9dgNlVn1ZElH2f35BDbp/p6NmqikiyP70kH2mbXIJdPIJpkBZHcl+1PpFNdxcPwi2i2ITIoPcZ5Sxg/2sV8iPQ5lUJlVvo9TEjbJeeDox73+cQ9GZEgctbC9+rYf12at/tmjgOwb4bOM1+zqILTsLZTCKnDy/X/oDVxAmt9K6FRIM/kiTOmIHtSp8IDwYuYwqOyXEfKdyBPB0cVNG+jWKczSw9ju6T+wUX3V1pKXa9czTAFZSllOhdxYSz+eAhHOYIAY/k9oYsPZG0zn+E3J/IOksw/iRLPC33WRuSGO8L9QdvWLM7snK4ptaarEKhUb1CEK1uNUX05p4hX7/bHtShUKz7t/55zN6iw8Nal/tvVa/qxSYMjxP9WKou1OtXRLvHGIaM9WutURkvwI9eIoR0fW88iFu6hs20bfyGjwVAfrp1aMrND3ghxeroDjBZIXIdQ44ui5uWFMYZQVXeFE7PzBd2abfP7gIjP+GLPBCHeeTPna/Qs0ejEq7WBZgWKL6pjDRWhetKzY0/IZdfJ4BYWSU4X83HHyJw5gTx2kSpsnphLhYOMcI7bL8lgPdWlkne1hvcfU176Lc2SK0doykytLrJs7iXfXXdiT88y1E76y3OJfPTrNO+89yv/w/eP8P/tnuacZfajR4dpz+xpRap/bia5Wy/Ub44ceZvo//Sn7/9OfcODffYhTf/wn9MQxN0s1bNh+iyNkKjoxo7kG1cZ9BOFJcZ7LHCzvIcqPU5bT09G4y0S6TH/8qDjOoMQON7M57CGNOaRIT7qYZgErtGy5Dq2Cpj0g9ZsLDPzSZiZfM8nwi4fw5fQ5pEHiWhLtigBS9NyYrt9lKefQFuWN9Jdo6d8d4YvhON+LxGHO7eX7oy/mqzsu4ku7L+Kr2y7g9vFRpveM0N2dh5EuOp2nkMQUQoecxAwrfQ4Tcto8fPkghe0y1sGYzHGO5STZOuaMQZGCgycQ4Icl8nK+lWsVxDDQ4ocq8lWf4vo86TAslTrMV1ZYGlyhNdqhNF6WdddYGb+VYECiEhSgjYMX+wRRCTeqYudydA8mLN1fY+bBkzRnlom6IZkTazwlLk5MqgwyCMElCDzBmUnqyMhaaAZUEWclJVnsEq/0SGJ5mctBzgffwTqKzMDJQKYidYLLD9H9ll6+K7TtkOYjQqdD15PnXESnkNApJlIv4McYncrYrfB5DFa+l2GwBs8JClgloSSblDRG1sjImGSdrGSrl5K7PAjvoWTtSOU5RUvwREuwBJIxqSgV5Vah0pJs7XqGKZA5qmnSuVElIZ6RtRHnRD82BiuWr5UlzEBhV9dXyRrarIEXgJtD6WBKqaf279QfQ/sk2XAE3e3iRF92bkOlVAvtRkoC10p78koGJvcnu6zwmTUhOCKsn6zx2vvnBAVSkQ/WE1ni5j6lgrH9urKT1B8UCROIDnBRSSB6zMeIg2CUcKYtkjqRQBulIuFjI0H1Fsn8A6TNg9h04Q8yPn9OTG5tEGsUeAIFrLUSFlRN6J8995Xtzr8Ne+qz0cJddBfuJ26flkOLBsp00MoIOFgrIPYk6B98Km+InYrYVOtQpUupTrwCnR9aPSj7QaPnaeHvZ/k8ncAv1LAb4WQ5CPbLnCNncuN7J9/wa4z81m9Su+JKTuy8iM7LrmPjP30X+clNf6wyyS0Nn8oVuP03i9ExOzaxh6HNF9OtTDBjC8wVxjhRXEdt/UWMXPtmvhdV+PThmLtOI8pCzMzE4KcRBURJiMGT1FbIpQ55cfZG5JRvz94JNv/6xbS3D9AwAcFSkXK7j5XcIMfGBzm9YQBVLclea7343HGKsVLy6JZky0Vn6wtqYMrFtJyoe61aWaR5+hg5LRvXaYtj2SBXsqz+UZZuwMPHEv7mWyfpzqSYpI85U+EbSxH/710P81Cv+8W67T0u8l8sBjenhx6m94XP4Zw4xqYoZKcYboMLCzS+822at30ZarMocf5yusWLcnX+gXsX14bfYn3rIei20b05dvkrXFSI6HMUysYiTCq0D3eY+/JBpj/7iOQnOfXVKWr3LuPUAgJTBolcp1giN6IV1Gm7K0ReHRWE5POOHKNpOcV38RIXP1YCCcPdUSoH8thb2zK2GksHlvHnmhRbMYQ+oR7k3q0X89nLX85fv+yX+Oq1V3PqjVdR3ztCOBqL89yk1M0x3OhnYClHfr4HK3Mkpi6CrofxLI7rkXcK+Ekev1cQ57RCLhnA6VRQMyU4nEcddsgtFfDbAbmgwtCmMXa/bCOTL64yeHmOob1FNrximPzGEk4pxcopdiI0TEgAhYo0KgzQSZXOwTpLt56g9pVpuveukBxscfruaWYfOEHvtMzPaPzIkJMpZjzmCGV6AqkuiR/ch9fI09lX48QXj3L6i4dZ+OoRTn3pII985gCNQ0sS9U+FaR2ht2TWENuIGFk3v83gzn6cCV84LqKX6+ENKcJyj0W3wYLXIRx2sOtyRMWUCDF+U4MnJS3rxgskPd+nIUq/5JtwwCEdcGwi+0/WW/bw389LgXWxJgcZ2ABl/MfAk7qglclApUqzP43s/Hv8a6WfnwLhQBR1sEmElrXTNsOo5ZaBwojMMMqASqWUBdIsHSdHXBjABgMoXfoE5zEpJd4POoJoQHTS43SGItindZ8MpYgSvnoq3VqRO8YIOmUGnkr7tTbPPgXsqq7qIsoH5Q/8o+roLpzcGFaVUCYPaUFykR/CkyaL6po+UqeHcVugEnGeXYrGktYPkzYOQDh9fYzZyFpao8BzkAJnZF5SO5OfGWD2SxkbL30gnb2H1tz3iNon0DrGdw1KZW0crPC+EcfZZrJwNaKpMDoRe6pBS+LSKng5haFrCYYuuFwVCs/rE+dsxhno7LYGzxMKVMJaNlIlSr0vX3l/bt3k9sJ1r2T0n/422373X7DjN/8Rg7suP1yoDrw7a/fTQPbT5e7I6AfzL3sp4295M+5rXk346lfh3PjrxDe8nrvHx/jUI12+sr/JkcUUnABfHJBctyYnyjFbqkVGcgWpK7BBVbg638fLqprP1x/ks+tD7p6ssuANEEZDPDo0wcJVV1LYu5eJyngrId3YtOf+dfDAF2tWgMelIulU3kZLgeoxkDMocZx7XpdmkDIvplUtSWVjaxorBWZqfVTny5TFQaRdotaAg7UO01Esm9m+9VzEtlPfGy8vkM6eZkhZ+sIulV6HvADtFeKlWZJYjDpXdKjnMS6BgNcWD/KP81/id9UneW96E/82+nP+mfosV3r7cUSXdllHayaidbxJKk58f0vG0xnE3HocSgAAEABJREFUnw+Ij4V0jrfEIQ3EGfRwEpktCT0vJAliItUlSlokMg431fgSkMglGnklOjwld6uM9WtNmvtSOvfHVG87yuXfP8wlJ04w0F5EiZG25I9wonIBR4Yu5PjwVhaGJYBRsERuiHYUThTgplWUrhAHAb18ZoymGGMkCGGwkcV2FV6UI0hKeGEJ2gVaJ9o09i1R+/YsJ28/xVHJ5x9eolfr4mqXwmCBoQvGGb1wnIELBshN5tBFg/EiYh0SE8lMY5T8p62Hij1MU7N0bAU151JdrlBZzuEvgJ2LaZ+o0zi5go41/mM0cBMlTpBHR+dIdAkbyvhPJ8zdUyM3bSjPuJTkhL90UlOU54bgbiy0IVUImyBdSzEhEj5K/BBnxGVgR4n+zXlUJaVlG/T8LoE41CN7hhm/dAItblmSS8QwSlfjqq7QWGFZS88+BaydL0VRbaOD8R1kfeSET60utEE2A1bJupMlB2weK0DmQK9CALKfSXWUtViDZ4cC1tpM3peTuIdJE7RVAsjyKaxs2AxYTVbu2boajCxr180R5/tlCcvg5W6Xl+f5cpcyhDFIB1npMUiDWVQZlUowxurHKp8kE760qWAyYk0+SdO1188FCgivKYMVPZGS7vaLxX3FwU0fc/IDKFVASfCN1EeJw2ARnhQHwpoiRscYpysTEFkk+ltHiej4ZXGgj5KsnBCd2n6NvFy71ijwnKSABJFbjxtYN3qrWTk90Dj1AGn7mPB7Ay12ssWKLSk6FY0RGWiF/1kFLW20oIiJvWW84lbKQ1dTGLispmQPyYsXxJXN8AUxkV+ESajsL32eM1GVqx4Otl2kBq95+fjkdderDVe8SFUHhref0+QpF8W12BOVizfnt23/2Mh1v0z5N95E6dd/nYFfez286HLuMHDXTJPjiyu0urK3tBgBsoGqjuYScZhevX2QK3aMElQDSuUiGwQmXMX9i02+PbSOr1zwYj6365XcsuWVfHP7S5i58mXkLryEvDu0XZHbp9H+fPYXrVdH7PiQy06CpKPVijO3WPvinx32ByuMXnEZ8eAYHX+Ath6ipoaxuy6jNzhIV059TXZ6oQJ06omjqCA2NE1C01pCqx93ioCKtlGUrdBfxoih7Ytz5oijlohy7DpFnHx5VUikWpG4SICgyXbx7l6RP8ENxYd4U+k7/EbhNl7u38165xRk3ek+uktdwloPQo8cFQqiWHOJh5IT4u5C5hBalHFRNidQEkOsSqir9JwSPVHI2Rwc1cFoAWXkvbRrVFAPrmAPCd55j2BOs+7wEruOH2fLwhGq0WlcX4SW4NTWpywCbkD8goISRS6OsbUOysmRCv7UcYldTeRbIglGNMU5jMWhdbpiFLYrRHIq3nGFdI5GJb6cvru0D9QJDzRIDsvcDoU0H+1Se7RJ+7SMJ1LowCU3kKMwkscf9LDFhDDflH56MhKZr+DUqTgsmZBVCgykrZR4NkJ1NAF5iklZ5tFPQU7Ho2VDY7krDo/wm5bGgiW7jLJCpwijLXEnpjPbJDzdlW80hdCR03KPQL7P94p0JIjRWQhlHWQexoFsHQVX7KQIe2B8RWV8gMHt41R3jJDbPEBZ8qHdEwxfMEp1ooD1UrKf5mVry+pN8KzmrKVnmQKZsvd91UR2VsYhknMmWckeA+EXsvWy2boJrOYaYQYBlUEkt2f5+im6F+fSkz2pjE+sPEJVkW3hoCSw+vdY8of+vvzcLp0ZdzRgwhYmCWUu2brJ+mTrlIEMX5GiJPQGssoyfzIZInJMeX1YtyqPwY+cb6ZX6tYOCIqf+lJqQE5J/P0ewYlzP7aOrsXiQLXUELEW2jt57ONAZIbzeEhVTkYfkGpfcJ6L7ecra6NwBIwj8lBpCTp4eBIodK04cE4o/UGiHMxjdOQZSj+gmTYiYRVa5Loi22YZ8JxPEtARflOwymuiTGXEQd/I293KJGl+jJ6TJ3UzvZCQOdDgYbSRbwyu6NoswOpITgY2JW4uEtWOY7tTf2Sjxb2Cbu16WiigRUI4IHYPSvQ+Mdpo2SMaTYLK6nQ8+bR0/RxCmtlIRimyX0g4BrTYxUrmn/GpFTlhdfqko7WdpRvFYf6DaPYh0sXjeO2GHGJEgku+TZXkOazYjEb2iFUxSodSl67SOqXMcn6zHEJcQX5sN16u/DP5JjxHk36OjmttWD8FBZQqzZ7bXIS+f+7zUykrKAWwv1yuvjM3sfFy/fLr3uC89FW36G27bu94FQ4tR6yoCOW08NUKmBaJ9sjnK1w4UuXarRUu3VXGHYJ20bLiGdoiqoZyO2mUruLrW17Dn1z1Jv7Ty27k9gtfw9L2K1FjE5RKajbnjH6kQGH/MA3f2vqAOPIi4H74r++lnvKt797prps4PPBrN6CvvA61+eV4Ey/B2fJSqm/8TZLLtmArTQadWcK+iMRv4+oWRTn5rJY1OV/jWX2Yc1Lq2Zq7aQzn0otYKpWJc2V6hQFafRN0x7eR27ITv1gUh9PSFeVvHIkey6n7gJdjvOwzNNgiGFzGKXRl3CKlRFkqEdxKhIlIEmKtaYvy7JmOGHkxyotFH0fEytIWBVxXQ9TSSRa625hOt3Da2UTLG0M7siK6ReSvEAax9FwkrvUjhzMiEBV549GfOIwI7r54lnJyjBJTFLwVcrbNRDTDZdFhXsZJdsQNBmOFZwui4AWP6xA72Rg6JDKrzDGs52NSfHE8+wQGSB2PlXxIM9eTuceYFUN8sIOaS8mHAdW0Qr+cSCczlp7UmZ7CaiU4uqS6i3HC1bydWyZ2e2jjyul5WU6yM5feIRHnNdERNonF0XWIbSgGSQy6QElokpNgg5H5hULPVNYx8nvyjZE+EEgEfwMlgYWk2ySqN2XkVr5NSVQstEoEHIzMN2kqkgbYyAXlyLdKxgVG1gUtdZFGU5LAzzDlTRMM7NnA0K4NVDeNEgwUZU3j1TEqA0paWlEUhgArZdbSc4ICmZOTOH5k8SUUI2u8ujZKxmZkzVLJBVQG2bOB1XL2LJAZEWL08jxKSngwH+XESPHouj4tLftVZnruFNQTgq3nvnvayj8XYjumQtmoaRubrYmsYWaYqcxBlrkpWTOlkjM9SF0mT3KpIVBlqcugsqoHrZ0vScUProBwrKpU7QcVP2VBgjOzT6SldW0r8oq0y9tIKjvhCaCqOzgDOyXfiUTjMIVNGG8I1x255accwk9s7hoHXwzZxOuQaI2T5sjHmsDWwWkTSRA7Ur7IQoefxTbgZ0xnaZbqdEBZjY7GwPYEWwaSPUcvpdTqyIyxONYRvSX7LPFWeSt74Q3sJK1upx2IreC3SV3RiTYnc/NXy47R5BJH9Fwq4Z0Q61gS6xF2e6KnprGNBzBM32ptSwjCWjrPFLAiN4zwu3W6oJtoG6FTB1fAkXJmMxjdvqwutuZ57vo5hc5oI/JAiaqriEwAV4JpWuZvhVdT7YIjds1P4EEbz19t4sM3RfW7xL67i1ynRrEj8jY2si+Et8WewxSE7wOZt+XMH+FsCfUjHHlnnUnqA7+Kt/kl6KH+36dSaUnDF8ylXzAzWZvIk1LgTAS+t61tM8FhB0SRllotO5bliiTKDAylVNQhGHsE9dkv1zrX3zLdu/rOk4bTdZ9Y59CyKbxQ40WiiMVdOdlucnilweGFFR6dPkp3uUb92CynD51mpdnllXt2MV6s0NEOp8t5ZvqK5NetY2h0mL5K/s08lrJ+s2ILPV5SpR8oqqzuLORV5XbHBl/ThdK7edGl121+1z9hx//2P7L1ff8jF/zb3yf/Ky+hsmv87bs29nPNWB+D8TIVs0g/NXYUYn5jxyQX5QMqyt5iW3+vuFpKX5qs30b+lddRftWrmNk8wcktEyQvv5zJt7yB4Jor0QP5lkOMry2+7WBl5yQJOKGlT05Ty10jQkoRifOYKCOR/w6VSaHXhEOrHNLsj2iWWqyoDnFeU1o/QLcwwrS3jW8mO/nP3e38W7NH8h3cFm3jmLuDqLADehUxjPLiSCtip02YzNH0u6zoHk3bk7qYVDdIoynK6RG2qMOsX7mLre172BM9xIuDWa4dd9kUt+nrJQRyCq7jPJ4qkPZSVAqu9iHRVLuWgCbKW8RxlyiFEX3tUPpvEHlLxKaGkznIxoqRkKJ9LdFEB7Ff6fYier2u0MWCfgwAJf/pDDIjJDN4BZTSJE4iRn+LXr6BHgxJBiKivoiwFBMGQqu0RVuEvVtOKA4arJuSKhH2GkkKx1oKjiNroUQpODjKk/FBpC2Ra4gzg0XKRiv5TmGVjEQhYxVcBhmixhEDR8sptTZiBJ9Y4dQdB3nktvt5+Ov7OPrd+1l88BDRQl18+T48J5A+tSCQuaFgFVhLzyEKWKsjYyVmIvzF49YnW7OzIIvP2fKZ3Mp+RQwNnkdJyRwc1QZnhdRbkeBUVn68f9izZ/6qs7VWogrLl0X2/ML5J5f1s581W5PI7CzZnrVWSTcCNlurbO0ykCo0St451qzufaW8rJLHHOfS6oPcsrlr4kCKT/l6Kg0dx7u5UBk8vG77i+nb/Rbye/7FE+B35TmDf0HhQskv/BeUt7yOvv7Rjz0V/D9NG2VBRB1GRxgl9BHlpI0WColwl2dLxi0amyENG8/4iZtRumSUS0oVJJfh8LxIwnPCXqt8JhSOzo65UJ24JZDTZ+v3i7ARfaJjMKnwXorRiUxPaG+V0F8oLqd9iYnwfE+eU9L2AvHSUUiWS0nS2sOPSRnf/phXa9VPSgElLbSA8L9wnRRkDV3JREaIHQCyLvKUXZkD3RM5eT5lY2iX9jwmh7IunjUQCSp9W5QcsmjhR4XIBiGNwRUKKGxm/IXpD2SlNP7BZbPAglp5S7h8gM7C/cTd43i6iSu8rkXgqDNcjiMKVws4WLSC1CKBooBEl/HKk4xtuwa3b/wj1vWnQp552fODCT0NhYzDnga0ayifTQoocYB/VP8jSq1GfkQLrCpQadei2CZh4TKNGahZO1nv2W1HoviL//nwFP/54An+/MEp/m7/AkdmDVEkzmBSEqejiErEHhGvKfZSWnKC2RU1UnQd+nohI1GPMRMx6VuunijyxovX8+uXruP1uwd546Xj3PjSjVy8vo/AcW47d5xKTkpKlA5FUfsya23J1u1ABue28XtmxilUblel0m2NicE/bO7cONu6cDOtbSNROFT8fa31bTsGqre/9dLt/NOLxvkHewZ46xXredsVW/i10UE2RNFt+bS5uxf09jRs4+q67W2LyUVxYeiP3S0XzY791lvZ8XvvZvv//LuM/dPfwrvmxUKZ4i1y4n27MkhwLcGJPREd4kzFLv58QmF/ndK0JWgHokB9YmnoEeP19+jfk2PgxQNEWyzRui6V3ZbBC0VejY9wylvH15cn+Vz9Qr6aXMXd8UWcPj7K4r2W2TtXOHV/nXSqgFvvxyZifOSaVDa0MOsdmv2KJTmNXpLT2CURauPrLS/dZrl+/Qo3DB7lrRNH+PXxeYM5JnUAABAASURBVC5z5tH77+f01+/l2Jcf5eQ3pll5cBlV9/ASwW1lTVMXKycVZQkPOLZNVJwnLi7hG0UlKpATx9cUIuwwQosyYRl6xc4q1GmS5GPcksIrKMgEsghSMmG9asS5ctqcl6ivj5YTErBkQtu4MYmMPcq3ifsbFC9yiIYSan6LWq6+CnFfSGldjoGJMkYEtnwodNc48p9rXHKprIM4835QIjc4SE9OWNriZPdylqRoSGVcqQQa/AEla+FAHpQLjnJwhZ5eEqDDPEv3TzN/3wzRVJdyx6PQ9HGWFM1jDWqPzJKeWkHFjighLYAkK+Owkq9dz10KKBlaBpI9lcsqEYtPpeFzoY3wnsiYzFmyuofVXdAdcFoif+oD2QhbcqKg6K4a50r0gYc3c74h6+f8Qupbk8ocZH5PEbHMDZH5ZDk0fAgyePrX0h293fHK7y71r/8gA7veHfdf+tYnA92/7fJKX9/bn+LUnnozJfQSfrAqwWoBZc58K/IX66IlV+IFKpuQOOn4mZfP5N3IuCDWvkBeZLn3THb+M/clVAVlsVlgTaWitFlN1qn+oVdcj1tcJ45CETELpF72ICFGadJVUKKuBIOyOBpBE8s6dLHhMuHKaViZQae9G/gxSfg5+jGv1qqflAIWhZFWFpQCHFkLV2p8jM14z5E61apQaVXF5gyg5p1H+egTLEkHP/ES+9Y/A/M/4Kuf+MHP8FJh0QIInCk5QgNX+NPBKkGoEtBGrDkpn3Nl4zKd5Q8k8w+/o336fsLGYRy1KI7xkoiTDlbLniCjoWC1sZQitMgXxCZLbIm26iOubiYY381AZfxjnlP6Y8dx78yp6uN+8XlOl8/Lomzr5+W41wb9M1CgYzuTbhrtceN4zIu72zMDS7ZSyaR2ciUMbzo81zrx3VONQ1+aavCVkzXurofcvxLx6ErKcpRD9bREmnzQUhaNUIpaDIkyGOguM56E7O0r8+qJQa7bMszeyQG29RXYmFefesVkmTfuHuLNF4rzvHuAvevLsxsqwfbqj/gpXdxtXKaWlu5tPLCv2Tp0z1J06tElO7vwWdurb7MtOS12KjIAyE7Rw1xuX1iufCgulf84yedvNq4zm8/nWxuquWsuGSm/9VcnS9ywtcJr5eT1pckSE3d9D3PL566tf/drH21PPXKrDRv/QUdx4Gv/264tfiQYWL89v3HXhX1XXPn+yotf9EHvot1/GK+b+P2eW7grUcXDSgSDY0UwOEP02j6Nox0a9ywQ3zFL985Feoc6pCtWBIl4aDZFBR38cUX5wj76XjxG5bIq1UuK5Df74ni6HEvK3Ntdx0PJTmrRVipzBbbvD9l07wLFe6bp7DtN795l7CkH03VJnRg/16K4s4K/vYxd5xKNgr/FZXybywWjbS7PneDa/KO8KncfL+JhNiwcJr3/UZxHZ7CPrBAeaNF6uE00HeKEudX1VCJDHRGzbuyRaJdGLmC+VGI2GGZJj9NWI6RuP6pP5PymKr1hy0q+ybLfpJ3rkRvxKI4EOEUHq1MRzBZQ8p9Gi0B1U3knuSJLRuqNGA6I0JX3jiF1exQ256lcUKG4LYe70eJsSunbVWJgex+F4cxAkW9Wv3DEENGCV76PLSLR0TLe3Eg/lY0D9MqaRhDS8Dp0gjam1BUH3KcgY7R+QuY8i52JK8ECt+vAsqF9dFkYKiKoO+QbHsVWjoIANUXnVFfWuYbtWhmzFiopGb/0SwpkuWRr1xoFnlEKKGE9JdznY/Cx1pXe9WodhL48UKTTUgRTWTkDpUqz5xsyvOcbjARkxXh7imiFDtLS0Q5KnSnL4zNyKaUi1x2/xfPWvTcIhj/Wy/Xf8mTg+8V9T9/gDBLhw6pYIAWUyEl3FbRYyk6mjyTArYwd4xlKso6Zg1CyOtoogFFgMn4VOf7kQ3hutLBKZLxKWVWUjw3J94fu9HLj+OXNWG+AVJSKsANa4m+p0D1VCiMOtJEcDdoRHKaLY3s4RnRSW4LTC7I1uyvvsvbpc54eG+4vXKYQeiP7YXXm8qQcefJWwQrvWQkmZa9UtmhSUOJAn0/ZCMWaepL/ZV7W9xkYackQnpZLZi7caB7DrWX+rvCqQypMucrXIg/QvcfJA9mzJVrTH1L1I2/rntqHWTkkttIcjmpgVIdEJWTBISMHKtluVoJD2YSM5MbkSPQglLegxi5Ej+3C9wrvhYFDavVvRzw2lBdIJlv7BTKTtWn8RAok7cYNam7+RHrs8GejRx76cHT00B1qZnlGt8z1Say3Pzxb5ytHFrjp4SX+7kiDY/WYtjg8ofIJ8WTTeHhRiCsRJj/vUC1btvQWuGDuCJsOPsj4g/ez+/hRXlNMeN32KldtG2SkUhnsM+bmrdVg497x0uDLJouX752ojI8V/D3iOD8uCpU5w+2wfQMLS3d077iLxa/fwtxX/46lr3+Z1r3fvyGZWTjUMebddSfZMx9xQyIgR5ctN/XuC1Jvnx97+5xYBovsZqHEQMn9xO5i/NYrisntO1amKd/xDcJPfYLWX/0FC397EwvfvI3OsSOX+dK2qvw7y0GwX4RZS5XL+6mOvs8t5/4oyhVu7rql2brJv3i+k3vXYrdM3Y6yHGxk4ZRm+YEmnXtrRPsbtO5fofFAnehEhNNzRYgoUh1jiuBMFKheNEzf7ir5jT6q39JzEk71FNMM0VQjlLs5LjoxwysfPs7eg8fYdPwk/tS8OLsLhMdCkoYr8smFtEdxS4GBi6r0X1iluKdM9coBqptdBorLrI+PcqE5zPb4AUaXHqR44gj+kSUGFlMG6y75JY/klBWHsInpaJzUEUfU4GqFcQIaMpYTajP3qu18U2/gO+kGHgm3UEu2EOWGCXaV8S7IoSYd7JiisDHHwNYqpbE8BEZwpFiFJLmJgFW4qNVcqjAizK0YEA5ezydoBbjirJqmIQgKDG0ZYOTiQfovKq0GGQYv7qO8sYRTkr6MwRHHXmWKz1okhIxNEpQyKF/hDeQZuXADBcHBeEA6YlGjlmBLQHVrmdyQK+sRYsVZt2Kg61jhdJU4zzGxMFSh51GKc/hy6lwMC+R6eXISXJDFoX66Sdo1QidwLGjkRgqruWRr1xoFnnEKaIwpYU2fsGFZ+LIAxofsH0DLWDLjzVf9+6T4/LmM9o3sbTHgntKYlbRSSqEdBxEEPBtJrRrg7VKO1viTwdM7Psu5J88WoY6csmnR4dqAlhMibbso0139VdfTMZbMEbS2Npn9bDWyi3tjli5LmNurWXmTsivCoyEySAH9dHT/tOAUjSZDFgKSyOb6+y7c3MjtXnkT5MdErwRC7URA9L2SfSkawsiTkeaZk6JkAawJcVUooQNZg2iZaPEEpjUPYfw2abZ2nWcKKMwqRru6Fg5GOaKxhe+UknrR3TaZFDnzuDWVF+flUqsy4byg+jmRWPneCCjh4YwG7iodrFLCnYnUd2Qvtq/NfqK9unej5ctMb+oDtn3iHcns/USzD+J1Z8jZltj9EVp4O8WV8wpXvhWZi0WpWMopRuyyhDLGm8AbvRBv/GJsdeNHRA/NKiVRJWn1QruEm15oU1qbzxMpYHv1bczPfja69/ssieN47E//hPm//jjxnXfgzi9/qNf23valh07w1w+d5PPH6zwgp3EknjgTigGjqIiDIpJeHK0llNOm2m/ZI47Ty5uneemj97D+czcR/vv/m5P/+/sYuetLXJCeYkM5fmsuao0PBMEnBpSaqipV6+smSyWlZrPyE8c4olRLNRofbj7wIIf/05+wdPMnOf03f87hj/5Hjn3sP9P4/l006kvvOY256XicfvxUN/14LzJvKfScff1+6WPl2L8rFzuZQx5luEUwlnS68rbi7PGro9u/wfynb6L13a/gPryP7je+wexnPs+pr30TFbXflbU/C7ZuZbjZZq+00sQfWIm8txyuu9d//2TC92Y097T7Ocgkxx4RtXoM+psFnLgkhkEf0bGE3sNdzCKEhQJG+VjlCSk1XT8k+6NXqBZa93ADSzeNSD1XxJGhvz3H1oUHuGz2IfasnGBjvExfNoyOpXO6w5n/SVkZJJBhS236t/hMXjnB2FUb8S8ZwYxpHK9FNRFHOZqj0DuJWpxGzS4x0HIo1XNUuxWqcRWvnWf5ZJukFaHSBFfW13UgKhQ5abbwvfrl/M3SZfxZfYKPrYzx+aXt3L98IUvJKOVdHpOvGGHrqzaz/eUT7L56kokLR8U5DcSICGW+KXb1Py1jFaTiOFtlMVrqdSawLW6Sw18p4E7lUQc9OOpgpx200Cu/oUL1olGqlw2h5NQ+yfdIVShCXqERoa00gokzEdAYPAs6RuUMpZ3r2PSSC9j8sq1M7l3P5EvGmXjlJsri3KuiJaZHYhNskqJihU4cKXtEDYsTOeRtQEH+K+oS2Sm8n3r41sOE0kdshFaKM/8hSerkvnatUeDZoICV3WBtGWuqaMl9VUAlGozeno1H5J+fQVbOIPuV0fmGzFHKIMN/FqTPUs/Wt3XEiTpb99RzK2EwZI+xmpRSq/lPuiklbUR4KSW5NGzj+JI9o1d2auVTOvRkwNOVbDZ3hVWik5TIN5VKOavzUNZFS+BRp13R33Xhkdp7TDj9Ptubfdf5g5O/l4Yn/sik9Q/ZZPbDXjL7J2489x/cZPY/OMnsx514eo+OTxPQxLUie59HojOVwwIrIBur9Ljl8wb+J1WahNI6El0gm5LCgPChzfam6CkrYIBUdKwja+KpWDRYT/ROg7ghlkx9GttZ+tBz+S9vy/Cff5cshpI9YVFka5CBkbLBomWPaELZE53rSWfFcWyNZc7j+ZSNGb5ziWatFVk8X8ryc+uf7rKS+WbA6twdjAQQDA7Cy0KHEJIVsX+Wfs9E8x9K0/lbrT5xk+odekeydB/d0/fgtqfJpw0CsVNVonAd0Tc2C9jmsFZ0jbJY4WsjeYKcOjtDsh+2EYxfitO/43btDb1XOnvBXkKBF+zc1iYmFLCdziRLy4dOfuGzHPmv/4Xlmz9L5Z676X3hc9T/8i9pfvEbtOb9yWPiBM4Ux1juG5HDi4BilLK90+XCpM1Gcfy8PlHIQ21Ct8ag2+MVJc3r5qb4lVOHeMnsIS6alxPP6cPoL36a5Pbb4OT0x4NATnFlDGcvVShMnS2fm9uV1rWZg59OnxiL7vg+A1PTjC3NyMn2CpPtZdTRIxy443vctu9RPnrHIwPvu/k7vP9vvsl/+9qBt903U5vJ/p12mLonYsdpqXOiXLbIgcWjB+kdOEBh5iT5uE6VHlvClPWn6tj7j0C984521L6sbm32B9R8gnDgsbH5My1z622PLF3/kdsf4T9+/zj/darLp5tFPjnjM1MbxGmPiEEyQMfL03By8iwO2KLCrGhWPA9DBZUWEHtBFGgEnkGkNsokeLbHeCFimGVx2uaFrrPM52ZYKDbpiGPdMx7NrotVOXqxR5QGUi4Spz6J28Y4Mn5dl8OmNp1cl3aQEItvqY0hx3q9AAAQAElEQVSWPuU7z0d5AY7Ko0XgkVaJwyKRnKimq7gUNhBwxdiSsViT0pS+9nU28dX2Xr5mruOe3Mu4K/8SbuMqvtS6mHvbA3TtDHJ8jR4w+KMBqiKiWPjDOCHWSTHKyDhFqAoRbSa0lSJxEmInJtXSl5wWm4WIhe/MM/PlBRa+2mDxay2mv3SK+QdO0Wk0sDlLxAo9p0XkCt0chaM9BDkZZuvIXZzmSNxhow2Z0Rh328wfeZTG4mmsFxOsK+Ft6YNSV/rtYsV5V6soLI7n4gS+0MdF2Ri/CKmXEOuYRKATtUlVStaPHHbjBQrlapALSVYAmRtraY0CzxoFhAuFR7UOZW+0xSlZQq08imkcujVeOGCTlbvDpH5HGC/ut3HtEZtrHJ0532CWHz1hlvafSAS/tZmQAaVUC0kWNSjZT3mpSGvZZEqtfqeUyvCJoWZXn3/kTdrgOKvt2jj+j2zzDFQq0TtPBk/fMLTQyMWgRBamGGUllzJCFwGbRqStBcLTD9HZ/0Xq9/717y3d8xcfOl+weO9ffmB+31+/Z/7uT71t8e7PXF/7/meurt39mb1L935m78qDN481H/ky3RN3oDtzOGEbJbrm6aPFecaslCAUnpT7uU6RKlTv1MWxKBjejgkGhOZ5WQOhtwFl5ZvMuRCFYQVQmlW+Fic80zcuETpawi6L/dESk8g2r2ctnV8KZGsgvG9wZG00SmyIXE5RCFK8ZBnbPD4msvKL6fLDM2n92NL5lI1pY2oproncXcrgQZvU7guT5almsrwvjBbus/HKETGizu90fxw2Ky+MyAWjNCajh7WkUZewPkvn2H009n+DpQdvecvUgx/fu7j/b7atPPw5msdvJ145LHRawU1D0S0aXxUxckikTRVtxO4zoJSYZFqROAFpMIiubqO0aS9e37aWPP+OUtUaL+CkX8BzW5taRoG0dYOdmyY8dAD36CGG5mcZnZ1lTHL30YeZ/t4+bv/OEY4sxjTlpC3bYCVl2TtQ4m2XTvLOqzfxusuHqPY7JEGdVIy13lyNzvceZOKefWydmWKis0hfvMJIt0Hf1HGcRw+QnD6Z9f7UII0vTWw6HtUbxNMzDPYSKt0OpU6HYi8iCBMOT53m24+e4JsnlrinBfcmLp87tcBnj89w52L9UKMYbI8KhXOFUmQcZyYOU0w3whOFnS/42CjGjxJynUSUVxesk6myS2M6V0e05NQmXB3zXJLsPdRo8yXp89vLPe4Rh/MBp58H/DHucTezoNaLQ1uRk0yNxB3oSDBBORo/1TjGJRRny9j8atlNUxFAISrDrJzsLu0iNgZtLpUh7/aOMKROkhQcFvvLLBf7MNJXWQSVJ45zPh/gFTxS3yEsFUi9VIyjEFSI0SHZqXbXTUlEQCobgCmK01kl7RvEDFfo5A11cQrbgaaX18RFqK4v4xYSEKcXZcTBV7RbikPtKg8nkyzqnXTTraywncPebu70t/HdKE+7F4qR0MMGiTi5BuMnGCeR8aSgrIBIVbKksGI4GCmmUjIqJYMkjKgdWSI5nhJM5yme7qM0X8WfK1A/GlE/1V5do1hWJRGH2+gMp0bLCYqStbLYVcc2UYYgKBDLOs4eq3HknlOcvm+Wkw/McPy+U5x8+DT1+SWMiZHJySgyPErKAkqtjiX1DGogR2G8SDeXsOK06eZDoqL0XojouuJ45xMGJgdwZG2MY0mlfysrqWRuSnLW0hoFng0KyF5Twq/KWUarWTFsDtM6/TUax75A8+jNAn9L88inVvPu4U8QH/ov5x3ah/+a2uEvs3TkTuKlU/vEgV51XkMqNQfd/KnJok2E7M2n/J16rGX2jRKB8djjL17myJRFt+FghSZWeCOTURipNwpPZKhrm6Tt40QL38Us3QpLXz6PcCt24Tsw/33U3L2o2fvQAmpuH2buHpKFB6B5jILqZiNcVRMy4OfHlRFURs0qhKv8/YOB5/veHoxsxS1NYB0J1IpT4VhpKaCy76wjTWVN0FgBJU9KnBct0XTXNImXD686KcQLf2Dt/Ji8XrvOCwUySp+huxGbSLYAVuwPrXqY3jzh3H5ah26n/shXaR/8LOHB/3ZeZWN08L/QPfyXtI78jchgkcNHP03z6GdYOSZyefZrhK37x2x66I9kzbc9ten+fK2syEcr/GuFB7WUPZ1I8GYZUzsih+8PYGWPOrW7SOfuwtYewu2eJKfbIjdi+cLKfnUEPJTx0XKo4xiHjM+tDKuHIvTK2L5NBOsvxxu6EO2PvDZQg/vl9Qv60i/o2f0CTy4zZDq2M2mM2R7XFjHLSwSdNv1JTLnXoV9OP3W7zulTp/j+oWkWxcmME0sRw7aSx+u2j3D97onaq3aNvnbXeB6VdMU5MyTap9FImD06hz8zR67XROsI6xgcYymEMb70o3rdp0597dRCfD9xxdn0CuR7Bh2LYycOrxFl0xaHdAafQ62UqdCllhtgMd/Po6Kc7qp32LfSpO6wN0IaPdarUkrc5Pzh3PB6nOFRsp9Rx3KqEcq828oQlfLkxkZRQeEWq71Ziy4lsu0JqGUoOkrfcLIbcmBxmVnrseyUWPb6mPdHOOptZGVgE+1SiaacjGZOV91tYapKhIfMoeRjE3FuLSJ8DB49PNvBiqCxOi/oC3ipYsLWuSp/gmvzh7g6c6IHi3hjfbTKJSI3R8UpEPTlKa7L4fdZErp0xYFOdKYYFOLFgoqJnYhEHE2LQaeu1OeJVIlEAiBqSx53p0c6aUknUvQGTWl7geqOErogY9IhSo5XbRJgeh6d2KFnXHH2c1RbPkGvSNvpY7rQxyHtySm4L90qjE4xjoA2WGVkHBbIQLLsUkqeMtBowYc9I2rSOGX5pPBMXVPoFCmFZXJxAUcCN3HNiGKLMc2EVKL0aIVSGiWn6VpwKMFhFZisPxSuKdI8HbH0yAqNRxo40wnmWEj30TrLB+ZZOrhI3JLBJBotHyoZnnwu30Mq4zZeChVFeccQep1Pry+mWezQkKBGWBa6DCvyG0qUNg6gcprMkTeCxErfVpSRYF671ijwLFHAYhEeVW3ZJnWRz7PEtftJ5r4rRtA3ScVIM3O3YWbFsRGnmpPf4HxDevobRHPfoTv3oMiO5rYwDCczYlSVEnnOqhzNnn8RYN7a0pPB00YH0YPW+oJe9IIIOBF1whsaskCtsSL7YpGhLYjnoHeUIDpMPjl03iAXC674KIXoBPlwWkCM7/CU2AYncTpTKDHGVbyEpxKUyHCQsfH8SGp1rE6mMFpEziDnJMdXN7uVicjr24gKRuRNXnSSJXMstMxzda4S9LW4SO0qZHNX0tKhgxG6pI0jmNZJqYmultvadV4ooFZpfYbmGbUt2AibNDHhnAT6HiE6+X2i6e+SnPw29uS3zq9sPPUN7MzXsLO3YVdl8NdEHn9Dtt93SFbuw4ZHQS/+HmR/f+Dp+4NxMmvOyAKFET62YrdkJU8sST9tiJN8Cq91lFz7CJX2CYLGCbzOLF7alL2aopSQTdYjwyEZilSwpMLNRqwfK1WW2PEwxWGckR24Yxeh8uuvUt7I7fLy8dcL8On5I8VegMR/OqfUhgEb2ctSq0uRCHIjO8Aai5FTUEvG9Jaea1gW5++U0yPNO6LYUkZ9xVUTZV69Z+SW4T5/T5oku3vNkNZcHZ1USewADW+AWmWAsL9Ks+zRyLs0/YCuzpPmKnhDIwT9fU99en3lTzS93EAyvJ7y1t2kEuHqiuKPBG+3ELDkV0ikPhzaSBgMkug+2mkemx8iFKe2lSDigDHJMgviB/0aCrf3bb/45sLFlxJvmKSjfNJijuZQkXjPRgaveTG2VPxDx3HudMjdXlTFfUpVa1ngoWfVbgFiGYcjAQM/0rjiuCdpkXkzQG/TVrpbBmkNGcJcl8hv4mzK4W0vowa1CKE6iHGL7qKVOHZKnGuRRomuiOM2gDYF+rrLXMoxXpt7lBv7pnn9+oh1OxzSSU1vyCEYCQguLhHs0njVFkraxz0j9AmwEuVWRqMzJ1NFaOnLTWNZIyOGtENMQFQBZ7tl4Brp66qA3EVQvsRj7IoKhS0uNienEfSweCgj49ZFqqbDSG+G4cZJ1i3P0d+uE1gZu9+lEzgkTh+pymNkLnbVkTwjRBEsnJNWa1VW4eClORxxfrWIXysQduQeKbQBY1Jx9EM6bhMnMfhtjW0iig600F7jyNgErCOVGnHVseJUa3yEEVk+FBEfTxhqeEyGFTZ0Sox3chSWNK1jEeGiC5EjfWlWDRrAKLC+wgQp1utS2jlE/8VD5LYXiUYEbTXFjGr6LhhicM8Edjgv7aTOkd61fCs4LFpmLIikvHatUeAZp4AVPkwd2Rsebqplj6X4cVsCUTUK0Ryl+DSl6CTl+CT5aAWvl553yCVL5M1RcmYGR4vESZIWj6WqyNHHii/4LNMXFRpjTwZPGyGsyDgbCEM4qzLJioy1SgSVcqTOYtOuQANMHd92ydmEvOiN8wUFwVdQDYqsUKBOnqbgb4reaOCZFeHRuvTdIRFZbyUQTSbLeZ4ksZvI6IuKRHEMZGt9duQNAt+61Q/6g5twiutwdPkc51mhZJ5WvrXibmRgHstB4RCKTqxhWlPEy8fBtNecZ85PyvjfCIXNYzpadoCsRYRNGrI+y3jxrNhyJ8iFJwjEmfbDznmVjX6YiAyuUcpksMjfUnKKovSZjxfIJXXZE11kMGLAyP5kODo/s/7RWKzwmlFiqwhkLZRN0WmPwDQJRH7nohmK4Qzl9jLFbhO/1xVOlwOMxJLKt6JahO1TrApRq4HatlA1FsiwyTQCOQgaWo8/uh1d2fh25Q/deebNC+/+xBmJhH1i1drzC4ECJaVmrdGtNNGThT2XkF+3AfIFcXAVPd9lQbbGQqBY7nNp9acYWuSiNheUDK/YFBBY7mtHyx8NnfBaP59nQCKrw7VBMdLGWOyb4OH1E5zYuoHZ4Sq1QomW1ydO5Bjp5E7s5Vegd265mSdJmSKytjap5JS4rpzrw9GJVnHvNbjXXY+dnKCRE4NgfAOX3PAm9vx3/4jc1gsIQw/dVOQScQCXHbbrfq7sG2OXUu8cUerwuV2WVGnWHR5+w9C1r2L3f/9P2Xrtaxi67ErWv/G1bHrbmxi8/prbQ8dpVeWkZECpqbPfZuMR+n1i0HMYlBPggR6MJr44lIbiTBtSH3/nJH2vvpSNN1zKZa/exMteewHrr96At8nDpcYQEbhiMHgN0b0NcFoSpYMWebr0oXWVvAiqweYx1nfuZoP6Ov0Dt5F7hQjaf1Si9M824v/mBOqXDPHGWXx/lpFuj9FGgE6KZD8Jx3goCYg4EjoITE+M6C7EISSxSDVD6jXplWdoj8xQuEwxcFWZ0m4XM1jH5mukgTj9NiaKNVr103Q9KitH2XH4Nnbv/zzDM/fRH58in57CDU9SNDHt4lZ6wTBGOQLSDZKskptCZXd7pk4ybFZjNW6Sw419GausnXbwcgojxnakfqQS1wAAEABJREFUevS8Nu18g7YEBxztimHXh+P1iZLzMLFFZD1KcCgJFCD4sq5W8cYuqpGDBYdczaOvXqAym6c6X2Sw0S9OfwWvpknnFLajyb7PAEGQOf0RCYmX4vS7CONT2TbI+mt2seOGK7nwN1/C5KsvpXLxBvSgj4lWiE0HowxWK8jGIZDlrKU1CjwbFBDDXKXDqGgMwkFsO08QVwiighhAHn5XCygkNoRNDB0nPe9gdUjeaVN0Gmhtng0qPCf6VKK/cqp6+Mng6RusFqHrYcVhsGjJFcYY0igWeaVxXIUnsi7wDK4uiv4Qnok2wPmCeBgnVSgrinIVRAfJSR/msVyJrFWWbmqJJehplPv0keI8Y1aCTwlNQUdyDdDK/mkXj6UKqc6fcAfW41XX4UiQ3xG6S4wVLXpGvpF22dq4sibZnM/kVtZJif7RukW3M8PK4glZi8a7sr9QLh+sXT83BRSIfETWzSqFMKZo6wQlQaScE1IUoVjxWpTdFVzVIBI5dj7lY1elZLaL0wOvo/DF/vC6DkHXF9lcwJEgP9Hg7Uqt/5QS2cHTlKzgtTJzu5ojJQHhT5WGsgszaOHZOk60gtOO8cTG8iS45UhQ1ojXbIRPjZDP6AR0B61FzlNHIWUMrueR6xvAH9+M0yfyJC3exWPpjG1v/cceX5CZfv7N6hd3xDZs7vlJs6/b+kDH1vem9sS74u6p98kmubaWy5fu0yXuGL2E+9a/kuOVV7LYfbGw/6s4MfFr3Lv5dTyYv4Keu47YhnTtigiTiJLmE6Wk9K/Lyn33rmrCb25r4A6FxP7sqjM1VPYpv+O3GfoXv8/g23+X/Ft/m84//m0evPpN/PnKet7/nfYNf3L/vL1zvmXrYfctSLKdzqRkP7gywaEe+/+/jWje19fn7+GiyXfrf/lPKP5//g/6//WH6P9X/yvVN72Ol46PHH7NeD+X90MlPUE5epCdEzUu3pKyadj5Ac4fVfAn1iv3RS/5hPs7/wPmX/3v2De/C3Xpq2Yp9r3d+uFA9k3d2oHZxN4wlyRvqUfR3rKJ77u8v8CbLp9k04TF5JeJnRob3ZO8y3yay/K3kR/ZT7JxgWBzm9zIHO7AKUxlhbjgCS3HccSY7SmfhmvFwJUT0nhQjAePVNVErE/h+ga8QE5BPZSchHqeQ1/SYYga5dwiabVGUpVvRYg5aYCj89icQ95fIimHrJRytJI8/nzKYjPHN8w4/9G5gP8jvZD/0tzOt2rbmWtsk3PlCYyb0iu16FQiOSUPoCXfpR5x3qFe9OjGHuGDp3nlHffwP9z1Bf7V/R/n3fs+yxvu+xqvnL6DV8cP8VY1zXp9grY3xbw/S8tpCukcmWde4gQCXQ8ncc4YDkpjtUPiSleVOdo5CQL4Ft3XoronodWfYyXnEbsJ+aTF8KzC9kd0N4lgLscUdZGyrZAzgQhrQ+pGZD+1VvLsxAXcxJf6GAnfYz1LEqSEgSGSstFSLWTLiwJwQ8RwsavfGm3IHGcl7xyJrOqeDL+jUMvy3dE69X0nmfveYWbufpSVk9NEUROJdQg4pFZjJWiihJrWsSQ6wmIEwdq1RoFnngJWJ4SlBTqlJl0JhiZBkchvEfqLhG6bkAI9RuiqKrFSMkAJ+nF+QacKN6rKPhwBVZKrNMvPldyWUQ5o2cCCJ3MAJUMplWVr8GMooHQLRy+syl0r9mpm7BrhAeuJfBR5SVIWhzmHkuCnUSv0nCW67sJ5g467QlPkc0Nkb8NPaQYR7UACs14H63ZkbF3cTNiKjI5EDySuCOAfM5fnWrUSTY3oX1J/Cpvfr8rlH/xbzqoE3T3GP6aD7e/tjryC+ujFNAqp7EFROqonujCS/SEY0jzWFEnxMcpiVYySspOW8ZIEp/so0dwX0eFDd1g7fxlPSFJXekLV2uNPoIAmxlfiGNORPSG8JnvA2ipKjWDSQWwiRmRSRQv9tTiLikiwtc8jdEkIxAYsyUhyxAoSHRLLHkidWPaEQU4HyNY1+6ce0vHTcomZgm8MngSyHNEIVqWk2iP1KnSdKj0vTy+n6RUVnWJV+NYn8SCzpxwXHAlAKFPAmgoxVXqqTM8JSBxNLDK5RR5n+EKc0kUYd9O7VXDuv3Nui10990O8/LRM9FlCqp+lfn+xu/1ZZ5+anyhEHRxfiZTvoPYY4/jd1Nt9qOvu/ZupLn9T2cQnL7maP3/5tfzpS67mppe9gs9dsZe7N20jdCq4Kfi2i68ERMyPwaFi0d9XzeUOj+e9j1y3qcqbdg3wWzvy/INtBV53wSgbXnJxNPTKX6Lvl69H/fKrOfKSF3PLus18Mq7wiZOWTxxq8jfHFnmgHX98Nm79UVMnNzbDcE/mqC6Fds98Et44n/belZEjO/nNwBkp/7Hae7HKvfRV7y2/6rW35V9+zcfMjsnt4wOF7S9bV+TG3f285aIB3nzhAL928TCXri9Qzdnfz3D8JHCGR9+qL7pEBXtfpnI7L1dB36bxnJwWaPShLErmgB848ZTvmAOi0Gb6fX/fxiB466s2D/Kru4f51V0Vrt/i8OrRFteXj7PRPYTvncYU26iyQQU9JMwoEIogAWUDEc561emKlYOLL0KsTE6ET85JRDC1EN+OyHWJfBcjjrNWHkGciDPZk7ZtjO5gHIvcUHLKjJZ2rsKVSKY6bkjuiQm/GRN/w7K4b5D7pi7k883ruCl9M7e0/gFfX7qOu5cv4XSyicyIlsMoEZgpse/A6vhcPBmbYxO6S4u4B2tsOlHjkoUZLq4d4fKFY1x68iH2Lh/gFZzg5YVliszhCI+4SqPE+UYUk5GxGTEyjLKIJy2T76LlpNZJevhJKFXtTFcIPQyOblOdtFR3DeJtKxOth0iCE8HmUUq7+slPeqhcghb8ntDDkVwmj9GJGB4GUEI7F42DzincEmSOc1tHdPMRUTGl7fboirJSeYVX9hA0WG3ke0uWHKPwjcw9cjE1w9IjS9Qemqd5QAzKg0uEx5ZYOnSa2olZestN6dGVsQvIN0oUCsoKrgQr/2X41mCNAs88BSzKiVDC18Llsht8tIrluSXQJnOurUplP4YoZfAk+Ha+wcmiVILbODJ7GYvcf96rlsk4mcAqHpHLq/na7SdTQCHrrnoo4QKse0YqibwU703KGms9Aam3CmtEhhrhHclk6Tg/oCDNYdOC4M+DyQkEAjkccRy9JC/8V8C3ebQ49yqToTxPkpVxWg2+ahJQk6fHXUpODpWz+f1u/7ZZZ2irkKFKpBysNTLXBC1ulCLTFAqpERBaZRhknbRsHM+k4jQvUj91L6Z7HJLmjdnrs9CzdTHQAjHHztas5U9GASX0dlbpD8oiSfZAtje0I/RHrFtDKrIxVYm8A0fsl/MpG93Ul70IVseCvCfQAbHlUCGs9rk6qEic+daIUi2epqQEr5KulE1RohuQOQtDYrUv8w9IHcnF/jRiexo5RTYOGEfayrgdkR8Z1XTG+8KryL41ePKdQyp4M7DC52mkJCChsdadleofXEplgVS99IOKF2BBpMILcFYv0CmpQvXOnzS1kjBsXg3cHjF0W88buHkhCm6443TMZw53+ZI7yucu2MOfv+JK/uMNL+Yzv/4i7n75Nrqbyuwqd9hZ7LGzT7Ol7DPiOmRK4WxfbpD7/e1D69/7z7eMHf6f94zxrkvW86Zd6w7vqPpBZay80du8+c3NrVu5q6/MV8Qxuztf5BFd4P7FlK8er/FQN2Xe8X+t42k/daLdxPH20I1f3tTRu+q6896z/Zybe30D7/cHx67z+rzfN9oMtqwd2zrsX/OGHQMffPeLdhz+nRdfXHvDji3vv6Cv8vaSTr997rc/TbkkNMvaF6HWr/x9GRQKhamsrr/ofGpbKXfVm7aM3PI7Fw7xz7ZrXj/cZEvZ0qfaBLZHJqAyoWJ1ICLbB5FOjggrz4TyLhbBrPDjACcMUPUIZyXGbYrlEipiEdo9EeiRo0SQyadP8YoXqnC3i3NLF/XlHuntCr5XpvfgBuZmL+Vw+moOh9dzZ/dqvt7dzb3RJHU1QaoKpNoSeykm0EgFhVhR6gqOhVOU5hL8Tg5jS6Lyc7jWMtI9xe7uES6104z5KzLHUL4pMtAbJt8ZwPSKJNYj8mU+hYQ4aGPclhgObXxxnoPI4nQK4kAXUUkgBpYmX3UZu7BC/2UFvEt9kitLpK/cQN+ecSqDBRHgCakIcaMTjE7PgDJYAVbVn0E6QMupeWk4wOt36QUpLb9Lp9Clme/QrQjtJ3zcMReVR761ZJpUAY51cMXp1z2HaLbLwn5xnI+2sHKCHzQcgoYmPNlj+aAYNceXUaGHm7jyjZJvkRVG0hl8Uli71ijwjFNACRcGsUc+zJGLcgSJhy/ROM9YXDlpcEU+uXoFRy9K4K4nTox/3gHZj4nXFnlSx7rLYkD9vH/8xmkpR/aryETW0k9BASVtHUTwosTQVZnBKzWoFER+WmVF1CtS4QQljq2XFEQnFc8bBHFR+LBIISqQFwgEfKnz4zJeVBXow4/K+LHwqfCsY1Q2uucRWBlr4svtx16FQum1peo6/NIWElMRLeVhHflOTuR/4DjJCiD7FnFEyJw5k4gai1FJRGtpjnB5ljRaec+5nSQ4LQKBcyvXyj+ZAqLfMXkyOmd7QWV0VyFWdTBCysRrEmfgi63iCP1lvzji8J43kCC7Vl2UsyLLvILSTbQSGYyspshnnXmpidf6yZP4+d9aFBZxbFWGywivpWK/nAUrssIRcBHhvVqvSaW10INzIVn9TotNq4WrtWC0YhciwQlX5hPOnSBeOo7qzt+U9XIuKDXyuH9Gee67F0JZvxAmsTaHx1NgUBU+VfG8fccbIV86sMJ0WKJnhuQUdET06yj50e1cftHFvO7iS3jTnknedLHmbXuH+MdXbeGXL9jAhnLxD8/FOKJUq5hw12Tc+/AeNzd4WX+gdhX19qyNUgNTbT8/Ne0UuSuC2XK/nP71EzgDlONB1FIOHToUjPPtSlj8RLXLgUo3YbwX3zWZxv96Mk3eneH5cdDG8ZuevnSZ9NqgS7RxRb9vZ9HZvqfgDm51nPdOKvdjQ8r/oaBCzXYm27Z9WS+L3P5o5Ku12Ql4t9sdg0Yp+xlN3F251tpV7bb6frDLoW1u5627/ZX3X+QeZkd6H8PRKQbSZQpkzrOlJ85jnDmmKhDRokUQJeJYd4XWikAVKTeKpIfESfv+cU7efpiFe2eJZ1MRPf2ETplQ+1Je7e7JbxaWF3M0T3jYeY+8LjEoJ9I7TtXYc2iaDbMnpf85es48R3Mud/obuDOepGGHcZ08uDFNt0nXj8VJlrFK5NCLEvy0w1DkkUvKpEkfSVTJ4oyMxifY2XmAbc0HUM2jMh+XXLcff3EQLU580ihJ27wopUCi7i493SPWgttzsEGJ0B9i2t/GaX+SxfwGmqX1JH4Bp69N306YeOkgG66eQO0pYgdFNDux0CJEBYbUSUgEV6pSMid69SRNGa/YC2UAABAASURBVKGxETGegg8j20YY2zVMbtxj2Wmy6C3TG4zIbS/Qd+kAzkiECWQ8q99ZURZKnAhHeNIlluBO41ANpw5l2SOVsEqhUUDPKsqdPMlMysrx9t87z+KcOBa0KA8lI2AtrVHgWaKAEj70Y5cg8gniAE9O9xwJCKnUwRgwNsGIfErFYEz1MsaZPe8QuS26niXyIqyUpdc9Px853JYWWaayX5v8fIh+wb5WYB2RbS4644FVB1oYRCQpAlaLLNUOqfKxQlst8lSLgXy+wBFeC0xKkAikMZ6JJYCTih6yAhqdOSfiNLimJ/UraOHL588CZXTM4MeP2NrWGLhLbnEcb/QKYjVMqgvgIMvSw+qWlHugRGfJOpGZF1luIhwTiq0QE6QhremD9JansdHiXh5LJQnuK4HHHteyp0QBF2vF1rEeStor2QMocZ7dkNSLib1U7BJLN0DyHqlb43zKx9SZI3FWSHRboEeiEhIZRyKcbzKjRfYoaVCTqqf1stJfqpwze16cXYcYR/aqI2VtFUoOb4zJC61yKKlTpNkXAsk5EK+WV99JG41FKRm2Mui4S7h4nHDqXpK5+7HtYx+VN78wl/6FmekvwEStOH3z1paidnRZK4q22zLoCWRjrFBpdZicC3npvOLd+XX8C7/C7/ql2X9c7W+9Zttw67rJYX5p/TAX95c/VnT1B3hC8l0O2XwnSgrLe6SfUvb6bA75Q8PK4/L8MOMdCNpNQrNIt1ijOhZQlRPCnKNvKxTUlCqX9y8q98b9s+177z7Q+taBI+amE73kw3VrB/gRqUixliP4VICd0nQn02LnatvKlNWPaHxOlYMWF62wP/tp9jnVq8XTYfqeb03X7YduP2L/w9cefej/uvfoib860Vx6NC7tj3OqZVoL7zAzU0vm5NEwiU6cMPHyex29+LZULZCaGSrpPMVkGTduYVIRjNojEsc5ltwoLcLG4IoBocWI0Us+8YOWlVubmAMh+tGI7n0hp74XceoRQ7vZhzX98o0I+9XRPfktXlgkaS9RD2ocGphhqbJMUU2zo/UoFy0/RMF5kM7gAZqjS4R9WpjAw09ivKgpwrOF8Xs0HBHqriOdaRwxrHJDZbrlOo1Ci8gz+BaSdAVHnOxyNaRaEQNAcLiNAXoPdZm77RDHvrSfo7c8xPGvPkLtnhk4FeH1SvTUGNPuRr6bbuQv6xP8352LeH9rK/+ps43PpRdzwN9DKxDnX9dQ8TxOp00pauCpHtbN6BkTEgtNYxKdYByDVVZoZJEirozNlScTpbj5PP2b17HuxbvYePUu1r98J+uv3sbIleMEG1y6pRaJE2PlP1Bg9aoxp0SJJbEjxkpISTZKEOXxujnycmLSp/vJy3MQuVJnYKmNDAZtsm9VhoW1tEaBZ50CKgEBI9ZMpPJ06afrTtDzNtLxNtH2ttBdhfViKI6cd+joTXTS7fTMOnHUK2R6QG4/x5VGSrkopX8OHL+YnyqZtjZCO3EYtDhm2bMIV9ARqUKkqU+oCnQdh44f0gna5w26givyO2T/5r4XtITPWrSlrp3140fCjyGx38L4ixCInnBEl8h4XyhX5txmhwjKHfyIW7mIXP9OEqdCKAEDQ4REalGEorFSAZm12AXKSrWrpD7CRm0CCSzY1hymMYXtzdwhrdaun5ECma432mIyIoveV4JHSyRDi4y0qo9Ej9PTIh/1dtruFjr+hPDs+ZSPo3T99bT9TbT8LavQDjaKTBY57AwTaZGVbv42GdbTehnRC6kGq8SGUQnaJjirIMwnciKlSEw/oR2UvExii+Lk50Re+PKNI2NTAqAw8p2R7434EgYpoIS+WgI+VRXi1g4TT31PHOg73majox/IDqHEN/B5gSch7Qt8hi/w6c1bO/ZwHN/xhfm6/ZNHZsO/um+m+fDU7L3tdu9biWya1E+wfkrsGDoiTJaShKNL80RxRClQH9jS7w7uLAblCwuBuigXqM2u+/bspPmJZBtQasrkg1tC1z8k70QjgFJqVQtWlaqNO/4fXjtS5caJCtf2p1zR1+Dy9SE37B5gT85H/PjbZKylA5H51sdOzP3efzjY5D8eUPzpPpe/fujUO+5fbi/NJMn1PCFJH1GGf0R5t3ta70sc55AqlWbPNvtxm7RCMJV9e7bd2Xwmsdd/73T9j/7m0Xk+eazO3y6k3DSt+OyjHe58ZH6yM7N0x9xXP/ehE3/14YHDf/4hDv23j5Tmv/rl34umZseszNqKYeeaJm7aEoESijIUxw5FqlxSXKzUWOksEzgKj/h0SvJgSP5knlKtKOATLAaEMwWOPqqYORXQbZVxTFG+empXOQypRF1yaUSqZG0FHDmByhxXnUgMwhsn9cdQTkBJ99gghk1VHGdfvsmc6LwM0JWT4VQEoEyJKAiwo0PoSzy6W8Rx7esRyGmtrRqCHZrcJoVT0VivQiSr33u0TTzdRJ+OyE0l5A6F6AcaJPs7qHofLXGa9/U2cbM4y5+0L+Kr6tV8mav5XLiXzzdfxN3hJcw4fYROArYDaSpUC8mMPaOFngJGeHcVsBiJeArrItPEScFNHZzYJaqntOe6dMS5NYKjONJHaeMgxfVl3EGHtBjTDbqkWj7i75OV9cqelNy0dgS/laBIKj3JG6UkIGKkhZIxZS04k7RGKXm2kJ3sSWNW4czbtfsaBZ5RCmQGUaw79Bzhf8fS0jn0+ovwN10t8Mv4G18vcAP+5BvxN/wD3PX/3XmH3Lp/SHn8jZSHXylbYeJ2paq1n48IQVOLfAXZZzyFJHsRKzfRadZYv4gIxKfw2QuviZEpZTJOZJQ40No4q0autSGxCcUgViK7y+j8GFQ2E1e3EvVvO3/Qt52wukMCtZL3byUc2EKY5f3bifp2kvbvxFQ3EQdFIjf9IXksg39uXxk7Rk7wpIPU5Y+oYAv+0G7Ij5KqnDgklmyvriov0WmZ0sjQZSyuRM9pqXNtKs5ziBcuw/JR0voRbDJ7g7XWf9I+1xr8MAWEpkaJZaNieZfIXhAZkZ2ypmXidBRdvkxshNcKvJH8+t/EX//W8yobvfX/CH/Dm1mVvRt/DX/j60Qm/4rYUa/EX3cFTv8m8ItPu/NshcmMWDEZz2lSKSUCRh4drC6hChOo8lZsaTuquhNbkXJxkjQYomfzxMpf/coKFa2ycshiz9CSjKelLHkgRnEQLeGsPEo6cyfp8gO/l0bNj4aEk/LZC/rSL+jZvcAnV7N28lgYzdy21Nj7yeNz/MWBUwLz/O3BUxxYbg1ECYjvICekSpSWw0o5x/Giw+31RR6KYuaU/aMF8J8qmXKqevjMz4gyyfT4r4bL3vsuHsxfdcO2fn5ze4l/uDXPb20p8vrxUm2bda+pioOtOuYtBzvdq//2xGk+Nd/l5kaez8z5fPbhGe6dW2Ehir74kxRGEASzYRDUMic8O6nudDqT8Xzti52Hj9vm9w/Y7r7DNpmufSs7mVbqh8eYjXjJ2H979+kVbpta4d6uw8NUONAZZP9xw8E7jrHyte/R+Ju/ofupv6T36U/S+dSnWfzkF+neeQgn+zfBpiRorAigVASRRYtQUY85d2TCSikMGqMcrLYkiz3SqZRCPCjKsUQgJ5peVCQJB5ipVTi1mKfRyoER4KmlYKCMWyxILy650MPGmrYYTHU/LyetZXI2YKTjsLPX5VKzyAVmQZx2EXALkUQJHfLtgKIIRyWGZ+gYOoFPr1zBvdjDudzB3S1ttuTIXziIf2kfdkOByBdDwOujfbBLdKqD7liKkU9/J8fAsozjREJyKMI2KtR7ozzUXsc3e9u5w3sJU+rFTNsreSR6Efe0BFYu4JTql4isIvFS4U0Zvx+TZE6ujEkkNFYhoMQ2zgpagp0alYDOQqldCOdD6oebq3/sa/GReZaPzFGfXcbECUJ6rBxPJ1rGJIAkJWujJBessjZG1iaWU2tLflho5vTouT2Z4xkI/e7qc5oTZVPUUHSxvozFka8FSTZE7Cqy1dvabY0CzywFMuazRLpN5jx3Pejlq7gbLiXYfA3Bpl8mJ85zfvLXyE++gdzkbwi8+bxDYf2bKK97PZXxlx42evitPz8NksedPIsuQCnZcD8BcdbGZs7z6qaE4i+iA61SVoUjnJGTIjwVRp4SYhsTIzLM78cTJze37hq8Da/FXf9r5w0cwaXXvVGCNzfgbPhVnMnX4W4UmPxV3A2/hjPxWhi8Wvh1CxEDpNaTsT2fLtlvq1aSs3r/cSNX/sg+7Y+93RvegVOcALciaiIQEMWx+lG2JmfWyoquyxwSYXDkABrfJARJHerHSJYfRZznjyfJ8g9+vr36+drtKVHACsVNpvdVLOQVe8DKZxJUSpKCOM/DOOVLKa7/ZcrrX0dxww3kN7zpPMvGG0XuvpHC5A0CvybweoHrKW56Ffl1L8Lt3/z76rGf4md2rIzuabmyaYsoENwGJW5wBmS0UR42GMAd2YW/4cUEG16Gt/4VslevRk+8CCvBrtAbIlRFEhUIuJhVZJCJY6vAaLnJgxK8Hh3caIZ06X7C03dgW4dv1PHiO0U2/8T9wvM86ef5+H9hh99s2j2nOvGJb4jT+clDp/ncsXnuXOrwYDPlT04u8I3lFibSbO4W6FtR+FY2QKlAr6/Ekpy2nU5dVozji1jfeL6IWC2oO69YXwlec+HEVW/bPXnVP9k6MLjN2OvEB8Eu2T1JN3xvbXlenMV5Om5Eq99joU9xsB5yZKlBrdOhS1fC4z88oswh7sbdPWmS7NHEe9yws1c3Fk+0Hrn/2oVbv8DsX/03lr4iTu7+B642Cyszttn8oX9/l23mVpxedrrZYaaX0s31Yfw+JBSIWobkniPU/uIzFL99L5NHTrJrts52cbL11x8gvPU+3Ifn6IsCrMqJaeLD6k+ALa5NcFdNlFTeQarlKRM6bk8c2x6qqzFOVUSMpqdcgQIt1U+zsIEFiYY2Yl8MClmJH572D9co6Oxcx9K2CZp9VbzUF1/TslRpUJ9cJL/xJNuiO7lm5du8uXMfvx4e4YLF4+hDsyQHItJHA/RUgUK9IKe4hlic145n6RiNO2apXpmn7xWD5F4+SuFVm7G7JuhV+ummJTF8CnTmWySNECfReNkfKZKx5yIHt6WwywotDnWjnedUd4BTZhMNbzdI4ED1BkmSzSzHezi4OM48ZVo5R9YA2uK81wqpnERbMf6UzEcjmB4DBy2Kz5PIsRM7YiN6RLWY7K9jz981x8pDNRqPLrN4YI5pCXA0D8+QtDKl6a3icayDI7zvSHBBZQpAbsaJMV4oxiSUN5aIKhG9cod2sUmjsCInJz0a+SbpYEow4UNVI5PFaItRsuxkSQpZ9sKAtVk8zyhgsSRExDom9VxUcRD6N6MGdr/XGdxe9oauUN7Q5QKXKW9kj/JGt553cMYvUHpsl/IHNmwvFM78kcWfk4wtrWXfKv2U0GTbWWQ6NvspiM2entJnL8BGKUqFKCQXMqgMhD/AOLwuAAAQAElEQVSUMlghZSwy0Lj9BIO7KW5+3VR582+9oTz5jzaeN9jw9vHint8pFzf/042lTf9ke2X7f3d5ddtvb+zb+c9VZdc7VH79jR/U1V8mTneRJutlvUrP0zXoPOm4VWnwY27/xpvd8jqcYBilK2Bz8p0jYEDFWFmrVPJEVEj6GK+74jznTAfVPk1Sl5Pn7nTJtR1Rnqyln5ICmXMnW4BMRopVIvtC6C4VSaJEf1cQhkRXtr3TG75I+cPbz7tc9Ea3Cd5dKhi8VAX9Vym//5XKq1487lcvGfQqFysnN/7Bs1NK6e2p2/rA2efzmgt//T0+oQFGaCI00DlsfhR34lIK218RFXa++mPBttd9KrfjdfuDba/GXbcXKlsIvQEip0QitmyKI/tX5EvmNDuKVFmM8K5FY1WKnJpguifoTN9BvPggTufE75EuXPv3/b/wSiJaX3iTeqHOyNr5HziWK0n0ybtP1Phv3zrIfUfqNOIyOj8hEcsiK8U8kTD5lrzLm7eVuaYKG9IGufoc3uIiY/WIyxPLlpSPDCq1/3zSq0GjFBC2XM9GIQy0+7yZpf7EX6l2tiX+8uRI7RCXLR9i4/KD5LsHwF/AE+VSIEdRNmKeuCXz3PZDYyp2WnkvPpRz4xPFXuoXet1L61/9EnN/8afU/vrPMF/7NCs3/WcW//JPaX7ry7KXaw89EYdSKsqJQVHUhgJGnDJpYRRuUqMYz1DtnMSbP0ZFFFsOT/ScJ+88RjwRIFPHiaYfxU8axE5Z6JsXAeKg5dTZMxGeCcVJS0SIKBE2Pj0nTzdfxxs1FIc8Wp3TNKo96v0xS+WUmYJmppRjoSjv8g6Jq2QwT+1qjKd0r6ri/NIYxUsL+Ftcqr9k2fqaJV59xf38y8Ev8K+Hbuaf2a9w9ZHvUPn6PTS/Mcv8d3rMfCtl/hticD/YwY0U2klk3D3K4lxWxBFPC9AdiYjHuxwvNVkUoSneM6VeBc93cYpdlE6xEnyJnYC2GO7NnKKVt4QFgypEoCKU8JcSR9pJAqpCM9/OYW2dWPqphzkiRJDLUbLG4qZCZ6twxYF3HgMt7bQ4zTp1cAS0tHHIY9uG1skutUd65Bfy9DVLVDpFqlGREbdKa7pOdzFEyYm8Hwfi8wbyvYsWA1IJZEI/O5GO3C5JoYs7AWOXVzETmlo5kiBExEKxQyQ7rbizj+qOfkwxIfVjEseQAlbUsRJcSnJ5XLueExT4xRpExnteFhRKnNUgaRK52FSMdFP8tlIjrSdSo2fr2843PLGPn/858B3tobOfjvwUyNI0lZMRK19IFIwwksIv1qUSlOqhkRwruUVJQMGIQ6bEDrA6wOgyRg2A6v+QCsZuVoWBqfMGpdKsUqqlJICictXDwn/7lBqY4myyxdsxFWys8CTQ7GDOvnme5FbGKcpR7k92Zb+Kwyl9zK2sw8mPS/M+2ZdFML6UFagYdA8jejd2NImSfSsrtqoHTQ83WUaJHWKWj8pKtm601pZYSz8dBUQ3Y/JgPQGFyvhNAubKT1E54b0gRcyXVRkp9PVbtjXWO8/y8YkDlj0he+SH/1nLgMrfXlU/XP/E73+2Z+FbJfPNQLgpw2FEtqY6R6xFHrgjxGr83drb9m4V7Hiz8i++kNyut7sjl1Lc9GKxe9bTpSi2mod1vFXbJ7OAjNDTKEUqvJtkjrUS7pUgrqMb6GiKaOou4tP3QXv2i1mfL1TQL9SJvRDnFRLfeHZejSjZM7UcMt/26CSyEdo+7rJlUE4Id+ddNrsu6z33Y3tGvI+94WWjvHKb4ZrhFjdMKN75ok3sHHGwucbuuXTlA2dxPpW8bu1AS4TNj4qWWRH0+ZjtuZ4d8DoQUKlJRuJC2mh8tnDfA+yRk91/9re38a+++A3edvu3+OVDD3LRwDBbhwYZzAU1cHwSMq1DllaVUVbAHciyfNtEfr37DnvoyB+1v/Mt/Pu/z8SpY4zOnxQ4Su++71ATiBams+Y/BEOe+95do4NcMNxHJfsDWIkYHM4sQxMdNu7MEwYtGrmEpaLDXCnHTD5gObB0vKbMYx7rLtPVIlBEAKUiPMRKwSXGtbGowGS1v0TqY5Wj7sZEwy7+tj78zSWW+zrM5lvinMXUB1zaw3nseJW06hM56eq3T+U20j7CRHma4d09BvcWGdgb0HdxnoEJhzGvxwWmzYZ4nsqJI3j3HcY73JBARR9ObxNqeQv2RD/de2uYpQ467oiD2aUcG9yaohtalvIpC3LqujDo0pUggu3kcbo53LhFZYMlKGuM8UQA+9QDzVJByVyAdQZb6hHkepSdiFISort1jHMAUziIzc+gvDbFvhK+m+IL7YOuotB0GG4o8qESJ1ej5LhEW7Wau8ojAytRY/BJ2ynpcozT8uiPqwyaQfptH0VxnrWcfnfme/SWQnGyrRgiHkEa4IgTrsQpF4ygLKlOZS1j0nyM7reUt1eZuGKIDS8aYOyyCuOX97Nx7zgjFwzg9is6pi5zlfbaYBRY5IYDqzlraY0C54cCPw0WC55YgL7JEZCXXZoT1vZ/LIacqh4+33C2s46tTbZt7fqeGKBn6362PIwc7aC0foqfWwnIWUxqZFMKQX7wVfjjCfGDNi+kQiqTiUGlIpGsgBRFzmVkzJ6scIcVHoEC4B+Q29N6dWxnsmnP+eWX6u3Wbo3AW8BzFnBU52nt//wjt4Jy1fuV/Clcfn6/7p/A6ZvAdSso2aNkjly2MrJGVkXieKQCilQWySD8bpG3CS49dG+Z7twxbK9+LWFjjLX001FAnGdr82ADlJSzfQFdElMnsjViJbaPs/K2rq1d3aY9UMz+KO15lo8/3YCf7tZGOhAQs8UIl8U4Ys8UsKpC4vXdIi8jgTOX533K5tf/sTe6U2y9XfjVUayTxwiPWqWw2X8quytSwZMoj0S7pFKH6hGoFqo+hT25H3v60BmcL9C77NoX6MxeYNOy1pbiOFN+sGTtnmmVcoSITi4QR0axXpj3V/o0/3x7nnduW8/eoT5G+/Q7x/rdt79kU/W9b7pgmLftGuW3dw3zul3DrbFB/5qcrz7ma/1DJ89ZX53O0gfap4/Y6MTD1pw8ZM3y6Zs6UX2vpjWuSTf6pHuy/xXUE8nseRxyU30oUWqp1WK81MXPL9U+m95zN70vfIH+73yPiw88xC89eg+/+si3uPHkd3nr5jwvHswzFPhvWP23IC77zuIdUbIb5UFJJFtJhE6VSrMqSXZHM9Okp44SrMxRNC100MVTIfn5JfxHp1FHpun1etvk08dd6z3n/S8b6+O3tg/wts2af7i+xT/cpHjtniEuunwLpW0baOUL9II8Npcn9jRNz+Bt2YBav4Gmo7FuTeSx5Ek/kR2i5edIxFnUcYQbRiKwQ5ZLLRwJVus+l+QSjXlVBe/SgGSHPG9JqG5a4vKJg1xRPcIGPY8fReg0h615tA/DyoOW9gEHM+WLTCoLzgArJwnGiRE6YPM+6ZAo4HUu7voRgr4Byl7KsJFAgFkgZxVhPaE53yPuuCLmihTSPOVIE7RCFk+uEK+4BJ0ShdjHFcGndJtT3gC3eVfwp7yOT7R+nU/0Xs9fJ6/gNnax4lbxd2j8rWCGI9rFOs2i4JFTane7g79d6FBOKORW2F08ydXePq6of4XxxjJDUcJwOsNm/X2uHXqQrfES5V4Atp/Qc1BaHF6JxhsnRDl1tNPA6ohIW7oOxF5MantCCyvjdyi3NAXl4OhUABHtOdJWH/Qk0h9rrG1LXR0v7WFVRCp0MypBkeIacOTUXUUeiALx4gJ+z8XvQl7q+908A9VBCqUSjqNAvskcbqsTUEZoCfKl4GItrVHg2aGAUmIA+cLjWvZ1dj6wIOUckcnXnukBFUQ2yw7al1PVwz9P30qNtGwwADpA2VTmYwWdwa7+h9zPwJm7vJMgm7G+BNwiAdm8NPwMh8CsfLh6KaWiEqUTqw/n+SZ60k/ChbfY7uK1Nlq+zEaLe89AVs7g7PNjeTz1ezZ+5KbzPAwyAzbU+VV94xqRoyLv4uykSA3iCH0CefZFN6pMYgWFH+jW8z2Os/jytGq+PHQkqCIZIjBbxhEZ7J9EifxUUsHzJamzAxVlRBCdffpxebDKg9XDFLf9sRreCcOjorsS4WWNkwhVkrw4IgFGWalLZH0QXs+BKWPJYUSfxekCvdZB4sYh0mTxcf/7n4znlOgxsqQ78l1OvtOCzwgg5ezFLzZk9FGqizauECQQ0CA0UzoG40hR6lJvVuPVSkrsSZERvACTNho3RfZcD6NcsZ8Kwh8uihZuZktJ8DVPXk7ERUBwJimRwdob+qO0uOWD/sRegjE5gS5toy38qZyMfyOxnVL8VK/yrpX9kWYOtCqIlVREWQ83XkGv7Mec/jrd01+1ae/Eh89gf2HdhateWBN6ocwmE5LZXOaT5PrDPfPZ+1fi5v6T3ofunWvaw53ooSmVMuslmMyxC1tcXDa87cIi/98Xeb//O1dsV5dODIjdoFaF/UTgvf+6yXXqzbu3qtdsX6c2DQblSt67vd+tfKxfVT6W9ZNBMwz3tMP2DXbx9K36/rt/z/u6BKVuuZnk1ltI77rjRjU/d0e+131xnnDJQCklmsy+OwvSYUs95uCafD5K3WQsr0PfO/JIqf31r7B465fk1PC0NF+mGp9kx8oDvHLpbn5jpMslvtle8bzb5SXZBs7yHwdJTtXibGqiaBAllHqaTtmn4wf4Jk9BHCu93CUwndX5PxHP5aNF9Q+3Va/7Xy4r8Z49Ce+5aIQ37d5S23HhbsZe8SrUtj2i9Nbj9Q+SG85OjdfRf9XLcXbspe7046vTBIlQIOqjwwj1XIW27xBZF2JXnOCYXm6RSpiTU1hFd0eH3jUBg3v76ZfTzYFLfbbtrPG60bu51r2bneFxiu0Q6jKPQ5banQlL30ipfwva37ekp33oemAtxk1knutpev20HEVHPMFYD2DTArmkQ8WeIufMo72ArlNgxfHFufeJMfhJnaKZw9MLLJoOcVLCD4fJiXmZuG2yU+ND/iY+lb6W/6v53/PR6d/mT5q/xb+3r+W/Oi/mkLNZVryIf3Eg4Aiderib2lR2WfouFLrL6TqeoV+tsNc/zhvN7bzh5Cd49cFTvPzoMlcvPcJr+BI3Fj/DnugEpcQj9qu0qyndYpNOkBI6YhQ7PTGv2ihCQlnnthMJPSNiLXUisQLlkjcxqdOl5y4JNIjlu9RU8YNRvEIOch1Seadknongi9yIVMdooWGQuATdAKeRJ5716ewPqd/bprWvRfRQl+TRkOik4F+26MgVenkyFiQZMXiMjM3iCj2VqCKpXLvWKPAMU0A4Tynhe+FClZJLlynYY8LbeXy/9INwv7Wze5+pgSkxQs9HXzY38sc4OZTsb00q+86K2LOy2yxWsQpn+pHnbDfKCZMjhqBrW1n1QHZ7IqjHArBPrP8xz0+pumM7k3E0/eFe7eDHo+W7b00Wv31vvPDdO85AVr79ACOL+gAAEABJREFUnOfH6pe+/oG48Z0bs7/fkXVibX0gtEuibLKnnx1iHdDVVRwJAnpCC6NDek5AhMhCmyNPh0A1URL8O1/r9JNGm+nvQJX3uySDq+1s7j6jPLruPMaUZBELq9XPm5vYGNlYM9smy38SVHD87L0qbHo3w7tI120kDhA+1uI8C1/HJVKhgZUa10aiLo3YCzms6RMeL63q6ZAacXKccPkBbPfk1bZdu57HUsrJG5FWSslm0MLztih7wsHolFTGme2Rx5r+4mYqwtHLKCGGMkJ8PNAG13GkJPskHcaLBz8SCI++kInkivMs5ymgOyQqIKUsNHHxVU3sZDmgSCzqRwQOMhnheVt+P+67Yrs7cQ0MXEFPj2OU7Ftj8GNDPlaCI5XvY1KlSSiSWrFDhbddFeMmJzArt9M7+gnSlbvfYZonbjqX1pn8zOTfuXXPt7J+vg34F2W8GVPPW3vZKcf5g+83oxs+9tAS7/z8o7zvlv186+AcSStmvGWoziwz2mmzZSDH5i2DqOHKB39WGpWDYH+uFt2Q3PXI3sX/34dp/u8foftvPkL4v/4xvf/531H/0p2E8+FHlxmOZkz1+hZ9P/aUQ9P1PSeqIQ7s9CMPcOrR/UTNFXHgYmQL05caSq0uzC1y6sQJmkn40acy7owm7bxbCzZvJOwfIfL7cdMB+pqjJM1+juTLHN4zRvvq7ZDv/7Hjy5fyt40Ojqhdo5vUwOD4uFcuXuaMj1/T/w9+c9/4O/4p9euv4/CLL6P3+l9h+7v/OZVXvhK7fhKCKvlWCUc5JE6TlGUpW1a8ceb69rDQt5OQIXbMGfHfEkwSYwW0TSgELhsmRtmxbTObNkzQVy7haY0SIzBtJbQfOsmJu47TPLKMmusRTzc4te8wC3c8QjRdx9UVbJynf/kuxhr7GQsbDFojjuQMDsITNqQnEcKeJ7SQkRm3R5KLZCV6tMU5bjktWm6HMB/jDytU0ZB6CZFKCFMZq5ng2Mp6jiyNYnoF1nfnGWtPo3shp7pD3LMwQT0dx9++jbFfuYhdb7qYi35jNxtfupWBjWMU5bQ+X48Yryu2zlp2H2lx1X2Hec83/x/+9Zf/d9536FP8T/6jrG/fge8fw+RPY91Z8rZGKc1omadrJoVlLsBpbqTQyVGJY3kfinBWpKWAZF1Ce1uHhU0hi3qJtqxBz12h580Rl2dxRyPcEQdT8mlpj5ZXIpEcobISOmvriB51cIIKcijN0p0PceSOQ9Snm6i2g2lopg8scvL7h2ieqEHPQfU0jnHQVpMlKzeDkfvatUaBNQqcZwocskqJ9BKwimyvaTHOHKn7+36UFDNAdrURxyNGBC0k4TjPUMpjIhuH18+dOszSo39G/cH3sPzAe6g98L+w8mAG75Hn/+VxsPTQf2Hp6GHo6Kt5LCm0z3lPawifLQpkjsfZvlVh8N1OeQeOO4m1gfBygtKhaKFEdIm0Ev4mg4yVlRXHRsCk4kwnOIno8oVTpO054e3WDdJacFjhFa+FEmdQuVKlsHLPUEgmeBEcrKU1CpwXCmS/JPLKo++vjm2jOrKdlgR+bDAsEqsAKhHZGwvPJQJncyN8ndlFGV9qsv8LQrIyTzj1AGnn2I1JuHhDKAd0SCqowpRST9e/9ZYOnoHrjDX4DHS01sVTp8CstXvvbXbtf7nzkXv/7c137f13t97P508sc6y6jrujPHeeaBPXU27YsYH//pIL+SdX7uGVW0cYKtoPhnb+xqfe0w+3bE6deNuJ73yb1snj4ozOY9MVcVzqtKNZZr5+B/fdcZBP3zF14t9/7cS7Pv39+rceWIrtchRdVpNIfAZ1awcyrHnys1mOCq8tlDyK1SJ+Po8VZ9HEiSgIS2A1uVQT+D6O1vfxFNKIUvty2vljvWHTzd6v/gZHrn4Nt45exB25Czg6fgXpK15L6ZWvIj+xYZ96iicOgnN2QDaz6/bva+f7/9he/nJGfuvtbPqdf8ngm9+Ke8mVh+3gyAe1m8NROVFmZRLHwXcM1TCiIqeU0Yk8x+YHONidoKbX4SZVPO3gaosrp0M6jfCJcdMQFXXFCe5hkx5a3jkgEWZDc6pJoW0ZiAKGowLDYYExqqQL4jDOJyTdPKntY7r/cr4b/DJ/F7+em3uv5k7vEk4Ut7EUTFK3o8RGhJvboTRmqWwKCPsS6vkOK4UWtXyTZrlH/wVlvCHpWZoSAJ6iIyfls50Ki3EV4xZpOYq6a1nyckyrPva38rRsiU4a00jrtHSXMEgI3ZTQRMRRjKsL2JMrrHzvEOGdx1nfMFi/Qa5XJ33kBPPCP4muyFj7qTvjmHijBCMmcdvrSKxHLDRbPbAIh1BZyN744tz3U3O3csjbyUNDOzh5yQXYX9lNfMEY9T6flZwhrCYUtnUZuKyIPwqxmxD5BVpumVh54upqMT4clPFWAQlWhHNtmjMdynI606/LFJIiuTDPeEEQ1D1ZjxbtmRaOV8aRsSnhV0RlGBDj3pL9J8W1a40CaxQ4TxTwPO8W7fpY7WK07Fk0WivkWjXMtM12H5IUshWl3mCiDlbkqjjQEt3kGUqdlnb0fi1yzw9XCLqL5LoLAlm+KM8LPyjnVt8t4kR1kUERia9q2SC7eKWEeFtWXoMnUOB5/pj9cjBNC1OOu51C35WYYAgjOlaYQPg4QhvhXzRGKdEjRiARdk7xhNFzjl61FeLGDElzChvV3pGRYwE57COYMqKwrQDKwejsjUXbDBAcrKU1Cpw3Cmi//GG3bwuFySvxBy+ipcbomkD41SCGlPBb5jjHOMTCg7E8Sz0IXztYY1CdRcKFB0kWvo/uPPxZrZfH5PUL4lrdei+ImTyHJ5EJ0qc6vMz5bKXmbYebPW45MM13Tnd4SE7DphKflpunrgNqjR6qHXJxubTvhgsG+dXdQ1wympsquPFtlmTVeX2q/T2xXadWY2nqGKRdEcwRkRfS9jss67pEzU9w+75H+btH5rh1VvGF/U3uPFhneiW8N8FcG2NuNHG88bH5+uhkDM+Z7ZucJL9+PZ1igSXPp14ssRIUaJcqeBPr6BsexnX9jzxxLD/uOReV9/f8gT9evPAq7rviVdx64Sv49gWv5LtbXkzt6l/Gu/wqtNv3P/24739cvVKqVfb6PuUOrB/Pb9q8vbp5x4WlicmNzuD6PeI430ZqMWlKN+eKqHBIl3qk+2vE316g8+0l5u9ucOJwxPEVn3k9SKJcXGXFLzU4YmQ5YuA5ctzprOYRShxqKxFm5HTVdBI6tZQg9cgnLrlIU4gdiiKokpYhbCviJIe4enzRvIhPdK/lL1cyuIZPtC/h62Y7x91JceqHJGqNCLE2hWFN344q1R0V9DoN6xTeJo/SzhIDe8Q57VckbiyOoBHj08pyJThpIkIQWfuAVq5Ku1ClUwjoBqk4pF2wbZlLFzebRyJ8KHMwRlY/M2qt9JsamrPLhPPLeM2ezMHS0ZHkmoE5S+FQDzPnYMVR12kBN8lLn44IW4vSTRxnWfKWQELkBKzoIabNJu7vXMA3m3v4cnsP35JgwZFNL8ZetZe+l+5i5Koxhl9cpnp5mdw2F0oRhkiMbk/m5kvZFWHvrAJy8oyVNl1DshLRWzY4Qmc/8QhkLH5cQPU8AZdEAlRRPUbLmujUEbpokDC/xQpOK3fW0hoF1ihwHimQy+UOazeQLZrDKtm3VracOAYIKOknA8nkndzlQZOQJl2RXyJXTPJz/wRasD7FK/CVBD59LH4SEMQlchlERQKBXFSS/PHgioyxxCgbrzr5Rtx+ha6xll5QFMjsn5DGZJoWDytn8hPu6EugtJ40CDBOIqycCA8o4RxHQHJlsSpBDAIcpRDtI3oxwo8bqOVj2NZJer36apDFoJuGHEYJ5yn5XhnAiL63gpMzwFpao8D5oYBSA1M6P3qdN7CTwsa9JHJIEzp9pMJ7RmnhN4tjU4FEIBU+NFjp2sq7rBDELXR3it783avgRrO3ZvtDmjzvL/28n8FzfALZaWyDcFVZ/qShZgyVQUq31Owl7zhR63JsKaRu80R+GRwPP2pStCF9rmFQTgQHXfVPrtjgqSvGfbWt7G8s4ByC3NRP6ufJ3lnZCFZOFh0R6BIARTmW7N/TJDai0evywGKNfY2QKVvi/sWIuw8tMTXfIDb22oT4MhH+JRqUpB9fGa+Gw+3Fya1ULroUZ9ceamPjzI+OsbhuHd0LdhNc9VKKw8N/GJSDH/rDZYLjhy7bao21HfyW8nc/rAe4a3AH39u2l2/vfBm377iSe9dv43R5BDdXvZOfISmlWiWlZqsqd7gcBPsLhcKU1EWkacmKA5zaLlEhpb3SpXmoRfu+FvG+Ft79NYEF4gM1Zk9GHKKfjjhqWhSbk4FNcE28Ch4JnhheWb0yqeg+IwoVUjRWhJIV2htpn4pTmopTmqBIZP1jJ89K7PGV3g6+3LmIb3cv5PbexXy+dxG3diY5EvWjVIAv/WTKWJUcCutLDO4epG93P9U9/fRfNCCOcz/B+jxpPiWW/6yxOMaV7ywTpsnGZJFq3AQJ1qRBDu12qLqnmCzMUmCFQAIrOeGRII1EyYsxmM0BSVqBRBubzTYmifEz3pG8J9V5MRyHmz6D8w76lCHfdsnHPl4qLwWXcXr4NAnsIsqdJQpWaOTLHNMb+H5vC19rbOW2+gV8dekSbluRk3dzGVMbL0Ffsov+y9fJvMriOBcxAwnG68l8YhmnFXoDVstNwEpfQuPs2cYW00tJIsRmkXeJWs2FZ4nEsdaZgx0rTGhRQhstOJR8rxB0AkZZua9daxRYo8B5p4AnjkHmQGtPZKLsQXGcrcCZnSd32YQWuUnHWuRoGncwEsxTKt4m7XypfiauAWyyXYuM1mmATsqr4KSSpxW0gCPlc0HbnIzLoJJ0oxQo0mk50MrKa/DCoUDM0mWGNPKzvz/gDb5X9V94s+7bTJqrEOuMb60wsegc62BFH1mxD6xKpWyEqxXagBMn5MXW0PXjmMZRtKq/NwA/IJy1yseInrdK9oaSxhiU7I/VomAQRJyntIZmjQIob+g2nR9/Q378MvyRi7DFCSKdJ8YX+ewIL1u02KmOPAlHrlLMIPwtpUD8Fd8sykHEw/Tm7pUDp0dE4p1+r7z6wdWyrbEMflDxPCmcmeHzZLDPx2Eq3EGDaNEnHXx7gO7ymIP2O40uczMtcn4FzzjkDAwQsTmdY7upcdmoz851ZfqLat+5aHPi8OXUwC3n1j1ZWYyNUt129kruZ23zlQr9I2OoGLxESzTdpRR5VOKAXrVIY7BKq1wgdB3aXsCp5TpL9TZxardp1KxOEr/tIFF5VSv4hTuVGmmp8vDGoauuYdNv/BZ678tYEie6u/cqgte/nuIb34A32P8+nkLq9Xrb2o6zR/TEYCfW194rjvu+JYcDpUnuGt7I/dt28dlayLeOL6CUap2dU4ba2vlSHC9ea+sz77ON5bfZusy5Zceyd08Gq3iUKSVOJCe1XVxf9AsAABAASURBVHy/Q+3gaZYeaNGbCnC7RUa6mu0LLSamlomn2xzq5minWpxiu6rYXFFwrihIbxUMngbf0Xiui+N7OCVfBFOOlhPT8RO6uZiG06LpdIR7NKpaIMoFLHRDjsZVFqnKGlTpBKOcCnZxf2uAE/UUHbcFd4+el6MjuJO8orChzOil6xm7dB0Du4cJNhToikMcqXB1fK71yKkSThSwq73IS1ceZs/CQ4x3lynGdYbjo+xO9nFVcJxK2hXDMBJhGaJVgiMaW6Yh9BYZqiwIX4gvTub0x+JcR3EX62pxZi1BNyXfNngdRS708WIfeo4YBwlW6oO6Jpf9jTdnkVZumZnSEPfajXy5sZ7b2uv5frKVB6OLubd+MV+f28SXmlUecYZZyVWJfU0vF9JxOmTM66cpQRjLKX6Ma62sgQK0gAK5rJabjEt54AQOicwjlMBR4lis56B9F1yF1Ro8aUSWbHZbhayUwerD2m2NAmsUOG8UsNojdXIY7YrUlD0o+1eki2zbbMdlkD1p6U/Jjk4wSQebyr430TaR+xIO4xlI8aD4R5Np2CJJeiQSXE5JxHwUsLHIv0jKkouJmT4GVmq0yB2tRPDKCNsUSimUpLh2vYAoYEnG8iS1jBdVoTBFbvDd3vA2THGUROVR2hcG1ljhXquyoiFzno2yoo9BpUp0LHj0oHOapHGEtD39Nk1rHIaj1e8dX/aH7A3ZIWSQbQurIctZS39PgbXS+aCACsZuVpV12ysbxIEe2k7kDgp3lohsDiP2o7Cu2IRG7CzpLePpVbBie8V4toObLGDrh+idvBfTOf0HtrH0Nmm5eqW4JU26GlBcrXie3GS3PU9G+jweZoBaWnXAZA5Z3hKnbd7abfOxvXoxsnvr4hTGHSWC0Rl3SFoqjITRGvQZQ3+vwxUjLv/4pev4N9fv5n993Yt4wxVb2ThSeqeg+7kvpVRL1PylDVhV4qVNk9G6a16G2ryJlYEhFuT0r5avEg2vY+yaq8hvHMF6MUq3Cdwu68cHGB2sUHDUJ/I4d7pKnSiV1Oy5A1OFgSk1OHFV/0uu+dSu3/0fuPJ//d/Y/S//FX2v/7Vad936t5/b9ieVc7nc4TSX2ye21IC4NrNpOxUjxScWh785UmSp7NJ0PRIjbwWRUiqS7MwV2Rvc+tKtdnb6D+zUkY/a2uk70rRzWbYWdWsHMpC1WaXBmQ/OvTcyx3ljKE5tz0sIGg3c013cRo5E9bEgiixSPUajOpuWa4zMr4jj5omx52K1Q6YgMzWnsWhRdEqcNOS01koXVskbR+H2BQxcMIwdh3qpw1KxTWsgoiZ5aWuV0joRVCpkpd0gSQMRWJrUyMqlkNp+ulGBOExwkmURYA0i8QpDMUATV5E6PYzTJQ3EyPN7RLpDiDxLtNBVAY44su2jyyx/b56+797PlXd9mV/Z9xle9ejXefXivbzJ7OfNwWEudZcIkgKRE9DJQydn6foQisOZaCuzW50RxYIjvKHwtKJYdEH6b+VDlqoxtX5pN5gXc9Jj6ViD6W+fZPrLM0z9bZ2VW2R89yXYZUPo5zmph9hvJzigN3C6PCG0GKKdG6HpbWDG2cS+uJ9TDNLRFVLtEQsdEwHpEDfVuFEqJ9k9HJvKWiC0l75VihXQ/QX0aBlkxdsyvlCCFVExpluMCEsRDdXEqXqUh4sQN4EEsulJicewKdbSGgXWKHC+KWAcH+PmMLKnjdKr6LUIfbUK2aOSrZjtPtmQ4qhixMkQB1aZ+Gn/2ba11hcQqWF8xBm2SZdUtUndDqmXgTz/IM/Kfw9Ggq/WKlLtTmWzyMCBVpavwQuJAt7h7NDg7IwyB9oZ2Iw3sB2dnyARh0MLbytk9UWXrP7STKfC70qsA1d42+fMe7GzaIqzcUJO7A6QTxsvhsakUhqV7REUVr5DGZRsBawGMlCSr10vGAo8RyYiPH3Yqa7/YH70IryhC8XuGiGiT+RfAfCFB7VwpJGyER62iKjDaNBK4clBCp1FoqWHCY9+C9M8+NG0M/d72V/d9ggHYzgkHz6vLpna82q8z7vBWpKlM39ZTv3AkVvxueFILz30tZnut2490brjgcX0UFvrSyNHt9zQLY2Wc1y+ZZyLx4pct22Q12+u8ho5bb5mwH3vFYP+2yfyzoV5L7m5ZVtP6eT0JxFNDAE/l1KrKlVbCsM93Wrp/c5lFzP4T3+b6m/9BoU3vYH8P/xNqv/snVzwhtdx9Usu5WWbBrmkmnLN5iIv2z3ElpEKgfZucVG3Zw7uj+rPL1TvdPtG3hoMjV9eGN9wuTs2cmFcHbiuk8s9pT8UdhZnNk6tOZTL8YnJoRLDhRSXJdJ8C60b7Ogrsq3cTzavs9+Y5dM3tQ8c+PixT36SRz/6X3j0v36UR/7yv3H0i5/5otc8OeOGnb2GeGOL1sae7f2In/6lJattKRUhkIqC0nVQTUsaG3rK0vEldyOU7lFIGgx2V9hOSE5pUYYOFi2gODdZETMZGBxSwWFzhvzGHBNXjDF4+QCli4oULi4yftUog7uq+P1GcLSpFB1xCC2JoOsGrpy4+ngGBoF+neCJI6h0KA4jOIbVXjJn0ci71EnIwLgpru/iWgfdsYQnu5y6Z5HGoYS+Y8tcfPRRXnXwO7xm/y38Ru1O3mgP8jLnNH3dRfH5c/TEsO0Gio4HoQuJVjI2QEkujnR1/QCFsRJp0SA8ipdENMW4bI5rnD0D+GM+9bk6iwcXaR1t4sxoytNCh4dgZV9K/bC0s8O00hJLaZ5llafn5Uk8TSqTjf2UtqeYTx2aAolRKECWRmipZe0dlHGkAhHeiVDfnImKYjhLC+vFFEcC1l0yQTpgqAdt5p2GwAqtUpvSlhKVbf0E0saqruAW51mb1X6yvrRgZfWJtbRGgTUKnEcKKNfH+nmMcgSrFsguK7vNSMEKnLksFmNClI0g7kDSE8d2vnTm7dNzVxKQbdMW4ZZMIgahSkKRN0bGqp4cRGYYEVJWO48LLj89I13D+mxRIFCDP/xP0PJj7w36d+FXthJTBCXKU/jBCg9bDKsOtFKkYs2kBFhxRiySVEjaOUW48BBJZ/ajJmneqLTsCcdFGB+rDMj3mU5SwlvYrCRVa9caBZ4GCmiv/DE9uANv/V78gd3E7jCxEXFoM551REZnnWacaxCzjET4WYQ5Lh5+Jqu7J+nOf4/uzLcxjf0fCJLFGyGdqapqLfvy+QSyC59Pw33+jbWf/OMUZS1i+2wSf/ibJxf57KPz/O2Dc3xVnIiD9eijsXHHgiBp9Zf8d164cYhXXTjB6y8a45XrClyYS986nHM/OJL3PzYYBPtLqjSbwc9LESXGQBDqwxke6/ulXj5/KFo38ebCL73iztKvvo7ir7+R/Bt+He9XXkvfBduv2rt1kjduGebN4ji/4YIKV24oMVrIb6+q3OEnG0/WF4XC/gykq9VIk0n1ZNb3TwNpkUj8xv1XbO7j5RuLXC6e49b+iMtHPa7b0MdFg0V69eTqDKdttcZaJ6ZvXPjmt6l98ct0b/sana99jfpttzL/ta+wcvcdJMsrX9SYpsELU9Jyh86elgQmxAEv1W19IMTxlXFaXuLjx3lxIIs4BREWfoylJc5siHxPzzVYceYHyz22OEsESrDhYOStFcjGk4GVmxUxY6TOZO9F39kgwemPKW8K6N9VonJxmbJA/+4S+XGFk+/h6y4jeYcdep4xZ55AL5Ozi2wIp7nUqbEl6OK4CbGjxKG2+KkRB9qAjBJRspmSNqKejZw4a+nfFQczXUnoTDfpTYmDuJxSbKWMNdrsXJzm8tP3sPvUPWxpHWPEbaJFkRtxWo3gt/I9CBaj0SIllZQzvR0Ro0eLBBcM4e4ZJtzUR9K/jsb6SZoXieFw8SZxRA2dY3WSKTnBr0d4PU2hrfGWNdE01IUz3HZFxu+KyDVCIYuyYiwgoCKM2yDxGoi8xlExbhqiBRybYJXCyldIWyvGd+hZrLI4VnDI3FFZACEmFVq6ZcPAzkGqu4cpXSAO/7YS+W0FSjvLDOwZorAhhy0JziAmCz5YZYAMDzIeB1ZpwFpao8AaBc4nBbwA/AJWuQL6McxW8gyyHZjtadnnsqetibBilJmwRRp2pA2l7PZ0QjHzmrM/+pWEqMyBFrGgJBD5ZGCN6AIBV9nW2fEZ9MDZ8lr+AqaAO/gxXd6KV92OGwyS6SYe0x9W9JMR3ZLKc6I80VKBgC+gMKKvbLyErR8hrB3HhO13K0CpbF8I4yEg30sNiA6W29q1RoGnkQIDh1R+3ZudoYsorrsCtyz2nNuHyYwxHOlXobCIgZRxJtn/6SSxebSAL/zpmxVU9Ci9pe8J3IPpnPxAPlaDPPfTD40w24E/VLlW8cMUyFgi44kffvOTa5Q4p+e26EbmXQeXu3zpwHFuOzLHrQLfODLLfadqNK15hxKn2A+Sm0er/huuvnDdG166dfDyHX3O9kraug8aP5NhkP0sfLbeeOjU8opdbLU/eu54srJn7cxqDodSx5lK/fwBr3/iGm/7hdtzl++9xt9x6XWqb/Q6a91ocz53zWtHq299y9aB33/NxtwbdlVdVc2pw9n3TwUyepyFIPGWHJOM/bjvknrrLb2llQ8ny423iSPrZ+1a4gyrpLfHEG+8Yn3+rb+xc5h/uGOEN64vSD7KazdWoi396pquTq7N2ps4fsvK/kdY+Prt5A4dZXx+SWCRvlMnUQcf4eRXbyE+OYPTDloVglmLnUlJSwazPTuJDggGAjGW3NSbKYQ5ylGRKD+AO9mHO5gSqGX6oy4Fo2gHDuFoQN9mjyHnFC4xVpScUY7kmUg5B5TCrL4Tt1srsp9fpW4LW+jgjVoKm3yCjT62P8HkOmjdpqB6gjfhNe79XOPexy79MBeYA/xSvI9XO0e4wK+BnC533Zz0rQiMxUutCC5EltkzQg2ZoZHZyal55jzH4rz2FjoUQ01eTnBc7eCogJx8NxzOo2aO0G3Mr/48Oyq62HxHcMfkIkU+ZDUPEo0rUW+56OmQdgWSXUMkL93C8pU7eXTL1Txy8XU8csnVHF63i1rDw5xIKC0aKtkRugEjeeCo7Bfe9GYs7pJiUAzTcZn3sO1IXwo3dBF+kfGt4LvzDFYi+t2O0L6Jm7TlXXYKZEHojfKwrqbjKpkxQgOpx0jZkDgxsdMjDcTpHnDlZH8dIxdNMH7pGOsvG2XdZesob6ui+7K2HVI/c7gT+TYFuSsUWv5TrKU1Cjx7FDjLf1b4ERxkk/P4pKPHPz9Pnlad5zxW9rFSMuYMJCObp7KcTRb5TwJmRhzouCMBtV4TEbnjZ98/XXkXr2ST+GobtkEcaEfkqWOUyB9EzgislrPncwFZHi1GpsvZ5JKWRCL9TDr9LI61/LlPgWUbXQbFms2N/bFT3UKufz1ppp8yfl4dvnCBOM9WmN2Idk1V5jj7GKWlnRVN0xHdN0tn7jCm1xgjjUUNZftAQL6Th1UsWCV5BpKtXUL5sseqAAAQAElEQVQBkQ9yP3NldNFnigjdHiutZT8dBVTmzzjl21Vx02uLE5e2SqMXyEHSGEYXsBJAlJsgzOhryNg7cTySNABTEM52yekeOTn4Sbr76SzcQ2/+EUxcf9dZ+57nUTrLTc+fIT+bIxV++Hm7P9WI3nHnoWUekJPntnWJckXqymWuHdJJzI3CRKXsBHfMVTfnYP+IUvsKSWujb7uvUT/DTxuyn2IfXekc+tJ9D++56dt3c8v9j7zt4UbHZvXZXLKTWVUqzWblCrSkzxODSu3PNonKVQ97XuX2Uj5/W1/eu61Y9PeNeOr2CVd9Yr3nfHDIdW/OvnsiWGv9s3VSLrVsa8zKCe4q9OqrP4uWej8fS39WfXve2h8yIMzUtG0/dODj9bvufUd9/4GPhiemwrBVe0+aS68VB+160t6llV6PK73gDb89MXDd/zS57q2/VS1cc1HRCZQ2tXbhDM7uwvIH2semsFOnWN9NGYoMQ90ug+0WpeYKjUcPYOZrFDvhZTLnVkZ7hRIvFFFa2g/EoYb+Gl3XD7ouxTigWx4it3OU0mafYrlHQZSZJxOOqi52S4nijmw6Ei22CWQepSg1K2CUEoWosJKDknfOKlg5vU3FWTXGSFQ6xs21UW5D2rYweS3OG1LuoZM6JdPkH5lb+ZeFb/Ivhvfzz0YP8j/27+c1zn7WybFtEoc0yZESoIwnJyOuGHQKrWIyuae1wXM8gYI8i5KOLbZnyMmS+Y6c3rgpbadAw63SdFzCgkO3GNDI+TR1IsbfEkHUo9hVFDuGQmjJxRrXOCjHwRZ96jL94xXNHZWAv64M8H9s/mX+cOw6/o2+lD9Z2cyDyeWYbh+FZh4v+wVkWhRHV6KX4vhb3cFLUtx6g+F4ka1qie2qzminTZ/0V+rFVJImY3qOPeUFxv1F8jRQpoeTRDKOFJA5iSNuHU2qLRhHZLoi+3m8SjWx0MDmUrSXknZ6LE3PM334GDMnp2h16gjpiG0P4xmEMPSMONAqwSrBJdhl5eTuCJwpSWHtWqPAM0sBYUWNlT0MRrsCBelf+BV8KZy9mmcLz6dcOUWRf2VkU6Nl3+lsWiLLrM2RKpl1tg9tirIGJTQwJiYSxznpNYD4Urk9bVfd2gEd9q5Pe43r0/q8dFcXp7kthmFbxtpBifzKAp1adXEQmWQlV/JOt0AmkuoiqGR1jQxepHBqrKUXLAV6tr5NEQ0IZ5YSXb6F8jr06DYit0SiHJm37GGEj8VWOMPPCEdrjLwzwkFW+N1RUjJN2jPiPEsgm6iDTQ1SK3vAoq2Vj5TgyvBpybOyZL+gl7Iy/wyEbghkRfBAeUJbeSd3ERxipbCWfgYKhKFbCk0wq3Ij1+XHL8Lv2yrk7Rd+1lid2UmJYLVCYi3yUFhT+DhNHERMC9+G2KRO9qvJuHmM5akHSBen32ZaC++Qj55Xl35ejfZZGmxGJNcgxvmPHoC1T/3fWc3HhlMtMXYKkxjZ2MO5hD0jJS7bsJ6KLvy+Ukq0rDCcOKDS5WCmrD1v6DaVW//BH937D9eeHY84pWPHE/XQRx5c5COnfT5SH+BD8zn+/f5FjnXNQ91ufDVpMTqLQfqOBpSaOvv8k/KzffyoNhmes/VSXnVIoSLzcnzktE/qomYv2XsgSpe+fMw89Jf755pfmV6xp+q9b6XLy7/Xu/t2W/+zD6P+zw/i/9//geaH/piH/uzfsXDXd/7Irbc+NKyr79NO+ea46Nzm9/m3lErebcN59YmBvLo967ccBPsrTv59WdnodNWhyotzmhfnTjsG5Vpc3+KLCePJwiq/h5xCDlihea1jJ+PUm7Q4JUVm5DR8GW+LgMPdcpeVQp28nHKUih36L81R+NUhwt8QOXxjkXWv99lwuSE/YFCFUTzriCOY4KapyHCLNUqcTxEwIkyQd45IdekeL80Jbw2jkk3EsUtXpExPKyKvj6baQEMPEHoOKtfC9ebRi5ah7z7Ejk99nAv++k+IvvI56o8eJxa/rxiX6I9cApkvNhAey2FVhHKW0M4ySvWwYur1bF5wKnS/jx4sUBfjtKM0hZ5mMPTlFLpMQ76vBg5jqsFAuEgldSksb4T2oAhKD1V0ILDijGpSeael32IvwY9hqlPla9FFfLb4azw6MMGKP86cvYB71Iu4Re9l2d1CoDU5PYcpnqIm/4WehiAgzRn8aotBCQa8SE9zY+U4v1n4Pq9X3+aXzH5+WU3z5twxfsN+kcn0Ply3g/b78NMCVXHsfSVBAK8Ncro82m2S7+XpynwbyhIs5+gal6TTITmySO2bDVrf7cN5oID3QEp4xwoLXz9NciKFpo+VtVE6QAiHEsplYAEjkOWSrV1rFHiGKWCFFw3FTLZ5LmEwSNfbJjzZlXEsD8ht9VJq5Cn/Imj1g+fKLRAZk9sqc+yRs0t4sey6eIiuHafuB4RuD00XV+SkUQqtY9Ku7Nmlh7GL+z9qe6fexWMpk+mzNto7a+NrH6v6ubJc1Br3enMftkuP0Dt5JzlO4yGywnrEWtNxEfCJJABpKGMlMGikReJYovwgSXkPaaEnCgMKqjCVo7qqs36uQa19/JylQE5VD/ep0m0VaDlO0rLF4VuS4RfRHLiQbq5IIs6GsiFB3CaXdvAlCOzaWHgflPXFdsiLsvGEjyIqvVM4i49AWMf4RSJVQlvEzkhwJQcfRLez+jW/sEmJdHBkPyrVxeouKQ4JVYwaEHCRnQhp62rbav3YXz3yDKWuXby2JYdLz1B356WbJEhaqdIl5Q/dqYKL3hkMvgpn8HJ6OY+e38A6LRyjcBNNoGbxnRUcN0JuQvuSrEaR7LEgfFxoHhQ77BbMygMfCrsz7/txA7Q/hY/143Cc73p9vhG+EPGJj0PiGGI3/aHpZcq5TaGU5WdfdsQBy56zTWGfsDGGyh47JgpMlgtcNFLhVTuHePXuYXYOFfcNFfVHzuJQSkWjsK+q1E8dmRajSRxVkAO8a2ebhgen6xxpORxPSxzq+Tw422IllvmkyTactn+2z58il6bDshske4pXNp/sJ+kytsPZJ4fr3W996egs/+3Bo3z20BI33XuEOx+dvroxNfuB05//Ct3bv0ny0F2YQ/eQPnQH6Xe+Tv0736F76Lj49yoSZRSVVGk2w5vheyJkdKvF8dVOqRwVx8fwR4ZYSRN6StEJfBoCXXHURrZuww72czS0H//yw0vhp+4+euJv7zn6xe8cnf/idCO5o4H0lCFXzlS2+mn202bBo1WE26fJbSqS391HsKNIYb3GL4XiIPdEYHtYlQiEGBWR6oREjN30B5BInRh9jrxzekQ6YlaEzbeaO/lk4xr+svNSvp5Mspx0xQdskutJ70mJBWeQxRMt7KMzDB46ydiRk6ijcyw8UmfhaJt4JSavXBmxIVPKWsaLAamVuZdF4RZlfA5KlHX2rhcUON03yf7h3dTdQYwJsEksyqZBMOgyOFagXMlJvaLesczORpw+1GJ2/wpLB+t0F+VwS07MlRiHGGEJk5DYHHOdEoc76zjpX0JL5wjdHJ1cmZliH3fky8xtWEdnoCDzDgV3im+rdJQrMXqHypYcTrFLTs0xpo6wK3iQl/XdwauGb+fa0dv5peHvc1X5EbaZ05TThghjma6TF0MiwDWZSFOkWuYoCjQfu6QKlDIUrcFxpY3uJznlsLI/4eQxme+crGHDI1e3MBfRPLLC0uEFeotipMcOJAotykCLIFDSRC4haXZnLa1R4NmhgLVioCRiJhqs42Blj6E6kPZW/9bDMzUoa20p68taicxmhfMA2qm+3/GHUNqVvR3LHFPBmu1pTSzb22iDkh2ojUWJ7PGVtAmXiJcO0p26GzP7wIfM0oM26Zz6UDet3VCgNxbQLXVsZ1LG6wtk+rpUtzYLmK6OXzpYveTd6vvVh3NuUl+ynaUbveaJh+KFh2ifvp+u9OfbFRmjrIHcU6VF1mQAVmQFqzJDy1g1RnBpv4RfHpd3maCUCrmUUpFka9cLnALZOlt0ZN38zU5xgtzgZgmGVzHC4xmviJbBseLmCWS8nZFDCecoK2+sFp5J8E0Tu3IS21oCsUGM8JyShkr0mlIWlELuq8Avcsr2XkY3lWJXQfajcTCJxRE7TGuRk7otHl9vz7NNJkO+VqS4aq8/22N5qv2XxO62rprJ2qu+vo/owS23eOO7cAc3ETkFEjx5pURuW4FUANQqr/oosQ0dAsSdElutK4HRGcLaffTm7iZtHv2D7H8ny/Mk6efJOJ/VYYrsIvQS2rnoR43Dz5hJXmRK12+17Ni84Y9OxryjEzvXd2MtYXTZvI8ZGZtK3ptftaXIL2/I8eviOL9xzxjXbO1/70SJ1yqlHvf/JpbnH9mh9PWUrtQwIL4M+dSSF2c5CBNyklfEgVCi6FG6RrFYe0rIntBInaP049rKHzVPTNvZhw/Y2tGDtr00c6LbbV37hE9+8JgZLfcvNLnl+Gm+OjvPvgXDV4/WuOPQDKcfmWLp1u/AySlSWyMMxDhJ5hk9PU33+/eycuAQtta+nkb4pFFDI6FGv1C9rrzzAkovupLGxBgLxTIzpTK1wRHMpu2MXvUKlkfWc/uK4eP7F/mze+f4830z/M2Beb4306ER85bVgVs3dGMPP5EtoxTGisFkLY4YrvlCQQ5MA3RWL6fMSZKQGkPshEReSCxhtlTHoigzSCRPSJyI2O3J+y5Nv8cJN+FbSZ6/ar+MP23eyEfab+CvuxdxoAdhDH5YQLUHqDcq1KfqpHM98u2ASq9CsVkkPGmoHWuzIoGRbG1TURJGt9C2DXLSGqejhHaUGFHYKLQJaXQ1B6Mh7ijs4dvbf4n9oxdzZHiCWTE1e5siqhfmqWwo4+aqdBt5ZsQ5nzk0z+L9Kyzf1WL5zjorD60QLYnsT7vYbD7aEDoFWnGFTtQPakT6LwgtfKKcopePmC71aOweItw1QjpewZE1qRTFqBwu4WwrMLirKrgiPEfCUnaGwfQA27x9XFm5k5cP3c6L+74nzwcppYhB4chctBgXjhiuLrH2iVWe1BYhLUNSJQ5CXCckEPpOFfpZDMfpHOmj90iBbruPYix4xLx1NCLQZcidhJXpRdrCo6onaywnX4445cpmpgqrySiDlf9WH9ZuaxR4Nigg8keJsa1tD5XUoTeLbZ/4eNrYb9PWoYeS9sFDSfvAUlo/em9am/3w+QZTP3Fr2n70kGk+FNrG1JJpHPuijZYv+3lJ4Xr+zU7Qh/YHsCoARza620bpJo6KxACTHqyDFvBEtwVyAp03LXR7mnDmHsLjXyee/gZ29rvv8pfuu6m48vBn+xqHP6s7Kx9oRd0bOlHn2navt9eLu9s7cWd7Mwz3SN3eVty6thl1ru/15n/fdB++w7YfvjdtPjITLT9kw4XvN3tL99zUmfkO7VPflcDaQ5h4AceK7Fs10DUywEyySp1Fy5gcCVw6KkFlTj4uvl+iXO7DdfUJ1tIvHAU8cic83Ptcp/T+/6COpQAAEABJREFU6sAG/OII1qmI5smt8rkVQzNzfiG7nwuglBWISVrzpPVZ6K6IvZGizrbNeFB0vjAbZ76X7Bf0EkoJVbSAWqWAEgorYiFNB58mbrIAvem9Npy6NV05PGOWT332/MrGuQ+bxbmbMkiXT388bZ76eNKevilpTH/WLJ8+U7+48kfZ4IqquE+J3Z+Vn09QVbnDPxhvufhuZ3QzwfiLsbndJHqERDmgEjB5sAHK+ig5mMlAWw8ttpRDhKaOScW2X7yHeOkeTOfIrdYu7eEJSakREbRPqHyWH0XiP8sjeD50L3swFuem6/ZYsuETFrbhZ1PINkAbBmYxX7y3nb7l0W7yoUXrvyv03Ch7Dw3ftlpjYz63XFz1x//5i9e9+7d3D1zzq4M5tVWp90Mba+fH6M69wzYX3pG1tXb1/ynpr9afQfJT3QOPW9b3OVy2fpRxEsorS4xEHa7ctI5Kzqdc8G+RcUf8jCk7VU9X5v+offjh90x/8XPc/Z/+E0f+6q+o33XHZLI4e2t28luX6P656ON5e7X48HsONds83E3oDI9S10O0SuuYjRymD08TnJyj1Knj0MK4LXJioIy2m5ijx2lPnYQovAHPRLbTmTwX9xPLQ4F7s+vaE8Vdu24e/vXfoPobv87Utq0cW7eB3sWXM3H9DRRf8RoO9I3xuaUun5nt8WBuPffpUb58KubL4tAfCfnQfGyvjmId+NalqDKhAI7rglYkJiWKIxHPYjC5Dp6caPsC2tEkYvRlTrMVxaakhWPAkdMIJUavSBJSJyYW9pj1fb7tTvLhZC9/Z67iXvsyHkyv5uu9l/Hp3ot4OLiSdm4bbten/+EpCispQdMlWPYpLRfpq/czFOZxJACwfLonQWlDrGJip0fixqB8dFqRKJ+0EXlmxfHrFQf5fnOMv6tv5bP+5Xzjwl/ipstex9+96MU8+Kod2F/fTP7l/ThDRXQjjz3g0Pl6jfy+NtXDPpWpMt5Rh8Xv91h8YIbuYg0tAcfU1eLEFvDcPvJuBTeVSjtCqqsYEZg67eDlu+R3Fii/bJzqNZNULpJ+dgYMvnSEkasmyE1mbS2uRCiLPcNgrcb43FG2Lu5nd/0AO1uHWNeaoRQbghS00DPFEIqBEToOkQ6E2//eebZ+m0RbTvUmuSndwxdmJjl9dJT+U32sTzz6wxaJ7RK6Bt/zqEq/um1I65E4I4aczMFNHbSsnRATCwLZXQpr1xoFngUKKKVQImO0Y4Uvu2JUn8Kcvo9k+ruE09+iM/W1Pd2pr27rTX11IJq+7bJk6hvvON8QTn3j2vjEN8fS47f7yfG7MPMPX2+b8/f+vORQ/tCdTn4YpzKJccrY7BdfbkPmu4JrQ5GhGpUZYHj4ysONY4q6R0XX8HsP0z31VZqP/i2thz5J78FPEe+/GXvwy6jp/Tc6s6dvchbmPxusLNyaW6n9SaFe/7elZu0PcvXl/7tQq/+HwnLto15t+g+Yu2uvnfnmZeHUF8aah29i6ZH/xsIjf8HCkb+lPf8dnPg41VwXITxGItQWWQ9x5rVVMkYjEKMlqIE40KLHcXSRQn6QSqn/7UqNHP55abT2/fOPAkpO7JQau1O7lU/kKusJKhtRuRHR1SWMBHwtGjECZWJGIBWwAqCV8JTsdUfHxJ0Fovop0taicFwiYAVS0UcxqBirsm/5BU8Ki9AyA8UqfVxx1HJOFy8Ruq0cxJy6i3Tq20THvzEWnfj6DedTNqZTX3+HOfHNG83U125Mpm57Szj1pbd0pz5/Yzj9hRuik1++MTp1+43hzH3vSZeXfo8XQgoqU6q87p3O2C+RG30NJtiBmMti8/WEn10BZxVUJh+NJz61jyP2lCuBX0+3yXtL2NaDEvj8JvHcdyE89pA9D0HYp5u0GYc93X08//Fb8NKU7A9DBcRLj5tQ1ytlz/PWlh44vTDz13c9cNmHvraPD33hu3z+gSOXHanH92bvlarWKHZa0PCH2202w0cmlLo9e5dBkU4pwezBde+iZD+hSqXVnyQrpaLsvTjQ27L8p4ERpQ6PB+51b37RGO9+9Tbe86u7+Zev3sqrt/qM53nnT4Mra7ts25ct2vYNNdu9uhPV99rm8oeWvvqF98z++Z8Rf/ITbPved+n79M0sfehPOPkXf4E98tC3sn8jln17FrwRdbtxifqLBYaCAFVvy2ZK5EQ3ZrBcYHRymFYuJQ3At4p8qOSdgyKHX+nD669ATt+Gjn2SZOOTOdCqUJhSQf6D3saN+/p/7QYu/8N/w0v/6P/k4t/9Hxl6xa9MOROT5RVBVReIdYnUqdCjRJMCKxIpq4sOSyy7leOUUsRINTJeR4EWAa1Ahoh2HFDyDKRyIp051FnuitMVxHlyYZFit0KxU30MpNwrkYvyeIlPKx3kmL2QB9zX0CqNY8SJM3JK2kqv5Lv2dXy9tIdD1QCl6/Sf6qFlUF7sCT8WBHeBYliiEBXxIp+MW7RSGG1o5xxWCj5tX+GldYrRDPlklkjFHPI28unmpXw5J8GDdb/MkeoYt217HV/c/jK+sWUd+9cr2iMpRuaWzFqcgymba1W2LGjGmg7VTp5yoyh5QDpriBeMOPcypswZjWK2BU0uzB1jQ+97OFGPXBwy0K6xrTnLG90WW+wJCpXjuNtO472kRnR9DWd3HbfYIE0jnGArp7+XcvgzDY5+usvU38Yc/0vDyi1F7AMjeLURcZxTPDFOFZEYHyGJBAtiJyR2YnmWk+FsfazCkQU8Go5zU/dq/n34a/yF8xIOqfWUul0mxCEP0hk6XkLT9elJ9D/qdcUsB09pMdQVKlUIIVDyDsEnmMERxhBnnbW0RoFniwLGoiR4p0xHAorzNE/eQ/3ot2kc+zqtY1+lffQrdI59hfYJcfhOfoz2eYbeiU8TH/064dFv0Tj8bbqzB0g7c4iuKv28JFFuP5S20XGGCSUoadwOSjdwZb6ucdASyAQPQ55E5Gz2ax+bNnFUjVJeVC0nCNr7UQtymjF9B+mJ75Me/BDJQ79L/MA/J7z/d+jue+dlvfveeX103ztvDO/7nau7+/7Znt6+dwy09/0b6vu+QOPAV+kJLc3cd3Dr38dt3yeq+QRlZ4m8buGKnPJEHiiZrEWDdUQsuDJGcGwsNaG8iUUneFh3CMcbxnPGPiGVQiPrZ/ka/CJSIFgywcjHnPImbG4dIVUiVSCxnvCzRmGFd1LJjRBHtI0RPZyITjNdqW/Knl+BjNdtgrLSREGm788G6s9USv0v9KUxor+tFeKs0jOWPdkm6ZymM/sgzWPfoX7867SnPy9y8S8Fzp98bImc7Zz6KJ1Tf04nK09/jO70R6X8Z7RP/RmtmY/RnL+JNLzzA2l0/APP52Xq2Npkl+5YWw/ebP1db8iN/wpu/6WYfCa3M74Msbor0AMVI0uBMjlZiyJKbF8bGnSaUFIN3MbDpKe/hZ37HpiTN1l7/v4pEE9D0k8DzhccSkdkWCHSlHuaIo//mXPmnD024VItCjncaLB/qcvD8x1ONRIaiWLe2lVjQiLOLSVO9FnHOPtOotJ+5gCGBCJE9WTT8/3lpP+yhbZ9x1zdvi/7A1YdiuMdvHLW/qeFMU/dtmvQH3/5+tJHXr2xb98rxoqf2JlXV613nI8opaKfBl+RCD+OBvwomvSjdBud6MbGffdg77+TwelHmJg/ysjsUcoHH0TfIScg3/wW7vLKrbbVGju3nzwcumK0jzduHuX6gQp7h12u3djH3q0jrNuzgYFffhGt0WEiIZvuVWjbQabHNpJ7yVX0X7QTfP9OlasexnVPkM/Pnov7R5VVpXK7Gl53lbtx0zXFPZdcV7no0guLuy4q++NjG4UGrTFfs9FVDIvjm+u1xdHrUHVS+vOKQmDF0EnGrd+dtF5EKk5WJo9FpZHlaCVCmtVy9vz3oHCTMk6rQnrKpXZPnZlvznLyttPMf3eRziMhTi2P3ylSifKMilxZF7UpxQmO9bC6IEhzVOjSzzR5NYUKWjijI9i8g/EsZOZXoMnsyIQU11MUSwFKOTjKFRwQuxGx7sgcWuikKUZnTOp4rNgCNX+CJX+SlWCCngi7urOOml7HijNAy/MRdidVmlDG1g4NxnGJlShsN8T3DL7KkzdVTCMQXZ5HRyWcniv7pMEOjvPK4r3cMPANrs8/wKvce3lN8AC/kT/Ca/0TjLlHcHMzqEoDBlr0xhqoUgvPNdieJ/RaovNQgj1Wxjs1gp4aQp8cpv1QgeZDHul8AFhQKUrGpOWE3fVi0DJX1caojoCcDEkopB5NcFd4CZ9Pr+S0vVwCBds4PDLBfF8ZTUwn1yPyAhKdJ5b5Jq4VWitx5H103hfaWZCFVZz5j9Ukdas5a/c1CjwrFLBWY41Fm5gcPdxoAbc3jd89RtA5QtA9Sm41PygnsgfOOwTtR/Bbh3Dbx6TfGXS4hByJZbR4nLzPKn5q8Pve7/dfgC1uJXLLsi9ln1vRP0avykclOzdVikgViN0SiROQaKGHTmWvtkX+tXCp45kansS7dXcGrzlNrn6CYOU4fu2YBOCO4i4dwVk8vJp7y8fwBYL6FEFL2rdO47dPkeueJh/NUkyWRN41CEwPX+juWAdtA7KxIEllzxIZ1kZlo8MqkcoKQl0mCtb//9l7DwDJqir//3NfrFzd1blnpnsykwhDmiEjSUkSFCSJgquiK/zdlQ2yQfztrq67uu6CrqKuuCoGMGEAE4LkIQ1hZmCYgcnTaTpVrpfu/7yGYZE4IEmt13XqvnfDued+73333e89VdWETjfqyWfuzpDm8SeHgBIPtKFzV1ktc1H5uYRWBz4ZeV65MmZkDCsNKgJikXPU1J+pfEx5vhnIs1xXZYxplDz8tZxFUiYyQiSC5hEjoBEw5cSYChUak4CEIXNIOIZR2ypz1ibs+nqZF2Ueq7+y86PdWI3VWIPdiHU/iltbR6L+KFZ1Daq6CuU9Cuak2Od1y9sf7EtQXuzj92RkTFtu+7Vmere9E737YHUsIkwW8EyfwK4RGJP4qoSWay3zpAqTmFEWK8rJhmMKO9AkPOmXyXXUt9yFP3TP3KgysPKNDIyMrDeyeW8M2wwZIY5v4jbkQfnkw49nH+VkKkFbZ4H29jxdbW20Z7OkbBtL6MGzsz8RM/UQTSbHXBgLSJYHa9Z19w7Ubv7xwzu+eO3a8Y+tKjU2Dfrmvwe4MVV6otBLfM8oNdiXtC6YnzL3nuOa53QrtSJW8VI9BHbDKKXq5liibo2ZvuWoiqYxNIKaGCEVlHD0JJZZlsVFGXtwG+EDq9DFYjd4R1Z1tW9S1+fGEv+Y1+6tiXNO7mvjvHkdnLFbmtMWFNhfCHTrrI5bOk8+muigQwh22w/dvw/+bgdQfdMxJI86ktRCIc+CV2y/SolXWSkvPn8xiXFWycItKtlyg3Kzq+W6vLPMLJerDijYHNLlsiTZYEnGZ/8el7170vTY3OKa0UqFlwnlxvfMaOqRFmmNVgpE5AlnizoAABAASURBVAxZL8k1xNdPCFNkMhiyKT9So7iyTPX+GtWVVUr3lZl4sER9o49RTNLuweJgmMOjh5hfG6RDSHRBT9LnPMay5EPsHq6jo7FDFl/QmC2TTV+GsADFZIVxd5zJ1AR+ziPZlaC1J4/WCjt0SAZKJiQf25cKlENk5sTOvExaCfLiNelzS7SpEfEMj4uxLvi+9KHGFXJtGUJQo7hlgAlaSG2DBpFsHjRkMqybNUJT4YmnGZ1CkYLIQUmdrleiJ9zM3vb9nJi/hXcnf847Uj/nlPRveXPqXhapNVjOIHW3LgtfCzNM4ASu2Gxiir6wZDF2/xAMRiRKtixebZJy/zkReMUGk4MlJkfKBMqV3XpT2mRgCOm1dCCTcQNT11CqSiQLDW1WGfL7WRUuYZUxE9fP00gkWDNjOivmLmFDxxy2Zl3qRoTGl4neFywVyelZnPYECCzaFAyUBq3kBJ54l2uaRxOB1wcBLaNQy8CMJR6ajgpwZUGdiIokwwlSkUg4SSIsidRxwvBVkLLcsyNYehxbNqyUqsk94gkgUZu8/V4vy0x/1c4KucgtxHdicmGjIo0l84MpcxsaQhXhGxahlSTe+AoNhyietyRt6lY1IwwzEKkLWhW02BjPCU9IReaNCiFlApE4jJ5MN2TucKnhRiJhFTeMQw83/phhqDFlsldCktEOmgRaGdJWjZL+MCMbI5JrjehH7LJpyGZklNtNNgdnSr4/5FfT9lcKAWV330BqxmfslvnY+X68KEmoXPSTYwlCqSqWCCVxBhamCkVqclaVMejJOFMoGYdaCHQk65CYQD/xxJbBx5/yEbc/lp0YxPejgYHCMTWO8mWdUxaZxIkklLXQKzs/BliRJ+ITk0JH1i4Jz5a1mInraeyGpAchSiUwlLuaP+DDQBqKO7qzCSqdXmm37bbS6d4bs7CQwEzTUOCZDTmvEKiajPF4rWWjZN1okEWFKXHsWNjyjLIa43g7HqG25Q6C8Qf7otr663bqfqOFxhvNoDemPYpQuzSkkycrwbGjDf2M7z1Dp1LlGa0tNxy0YBZv2X0ab9ljNvv3tTEtbZ1jQvmF2qWkLOTKGnf9+pFq5tpVg/zXLRv5rzu2c/2GIhvL+sgGVrwqeSE1z0qLP/YgBHmuiBDYZyVLhCUUTIJdfZWTbV493VesOheOjquvViYjmfQt6pZJ1YaqcI1x4VCVlEkoI8uo1FF+CDrMyKTe5qP74YmFVYdrXbVXb1KdtldBnbU4u/dJs7NqdiGtrJbcyfkDD7kie8oZWCefiTr+NJKnvIO2M88is2w5RnfPkifw2lWjXzxfj8lFh3QnOGOPAifNSXLy3AxvW9TBEf0t9Jj+B9ot91obNRbKiszHFIWKnVNzHMYikVNx8flT4jmUt9aYeHgCtilainkKlVbcHS6Vx6qMPTpGWFTkgwa7sZnj3ft4E+vYP3yU/Y17OSLzG45pvYeFwSjZmi0TT5paj0dqcSvMTVLsqjLcOsxY5yhqtujZrYWW6a1o2cWzPZdMySG/A9zhkKCcouF3E3hdQkYTzA8nOMR+iP24lb7GPWTrwzKNPU5Xaju9mRItdigP6ACFTyKpSaUV+GUShsYzGkwYFcqqQTGsY7YkcfIOkeUTGaE81H1Sor8n2sqeahUnWT/n+NQvOTh5MwuMe0n76ynbdSacJHVdwCl301bsINHIoQUzWfNTGZJFgjxoHNFvhKPY9iiYw2h7B5VwhIGJMapGCw1yhFEaFSUw6oqEjyx2Q0ztocW+UG6bcVoYVW1it0NrpYjpV3ioZyY/3uNN3LDgYNa3tU0ReTMxiSp4GH0uLYvFni6H0KqjXY00CoSlKBBMaB5NBF5HBJ4YhRGObJTZoA0ZmlrGvI8l496OJQrkPET2vGRxIhNz0AqvtMiiHVUH5REZ8b0fSahBtg3l7fd6qUR+feRMO8rMLSFKTBe98SLLxvRclBBoTVyXL/d4yBRxkHk5xiMSMhuRJFSuxFsiSNmASBZvDbdKOVV+UalLPm1Iu2SeU4SCrbQoMmQKsOXcmRKNTYRFqAy0/CGipvrBxohxkVkiUIqGncBLdGG174HbMueC3wuUZuHfH4E3kIZAd1zp5GeS6ZonT1kZszKetIybeCxNidLIYJPT+P625FTLKJfnU/y9f9koNiMTJRvWxPOApERKssbCn/qhBcUQAYf4TGNIaMtcaYGcKy0xshEWb7abMYZh5hWfG6MoRxTm0UG7zIbdmPVpIj3ije7A9lox/BYI4zk5e6sY9Qf7SmCvzKvE+qc3QKVbjnM69iLZczAqOY86LfimQ2iHePEGpekTGRo9NXeaIGNX6yfmViPSUB+hPnwf3sCthOMPHqtrmz8hmd5wL+MNZ9Eb0CBfOreczLEtneOeUvm6+2r1VSsbYWNA/y6Jnmdbx+2TT19w7vzWsbMWt16+vCU5b4alrsqB93zNGtY6E390Wynl6UBl1m0e5r5tY6wzEzxqJbhLvGwDY1Upbq+Tt5f0Uio/Bqmyh9kW1/HMwkoVNj8z7oWuixl79J5a7bLvPjp87P/cs5m7tpXZbGQYS2Qo2RZVuUGKocuYLF4mMq00pvWgM1nIONekVXplRGJFXqVWPLMO2Xh46uMZsc1mYtYFrXsccHLLSW+9If+uUze3n/aWz7QtmndOsjXbn30VdurMeumknkR40cGzE0edeVDn5WfvN/3Ko2ZkPznf9C/OV+vxvzfJUDczhkyIltn2TPOf9zooC8EcLVMtBqSNNKkoRVp2mFNappzQYnxogkaxiPKrFKwye7eOcHrvSv6/6T/m4t6reXfhBvYyt+PWlJDeHJaRwGWEjBDnjkN66Tmmj7YjO+k4ppPOwwpkd3MhGaJChaonCLflqKxMMPSbMuuvf5Ttd2zCe7xGrpigo1HjgNQGTm29m9OSN3B4+Wcckv4RR3Tdzf6tm5jGMKmgjEERq6BJ9WdItDh4WhM5IumImuNhFCA928aY3qCcHqWe8ogssUNnMKWtro5kMTkgO7zbyfij5BsNcmEKdBafPL7kI7RQOkAyog0TaQF1P0RLWdMIsA2pRwgBUSQYKFAWFVlEjwcdeGo6ml5U0C5eqVbcRoqE7whpsNDKxDcUbe52eozHaKtvkXaPYtcc1iVncV3/nly7aBGN/umkF7SR3SNPbt88M47oxZ1pE7QENBIenuUTmlps4/+OyJA2/N9l86yJwGuNgJ4icEKgJQQZj7JkVLLBp4TEERO4yJV7KElEglDZr7gEcn8FUm0svmHgK4NI4sAa/X2xiDd+7WTLDYnOPcfs7BxMu12ewjlMmTtUaKIJpck1LKOCratY2seKpGaZS4zQQYkgXmAthmgVL9bq6LAAjbkvKlHYjm/V8YVwx/9eMFKKSDDW2iGKRUhOHBeaEaHho2WOUlKPEtxVZIF4oOM1YCB94jtpIc6zMXLzUIneKyRb89VEYAqBUJmZyCncYud7SWTa0CoeX3FSJHdyKCfx6EWejSZKxrIhlwYBhox9AzAiE0PGo4ocGXM2WsablpJMCX+yh5pCIhBsIojvXWUJYvH8F+PrSKoNMptAnNOcurfDV3h+jOdDzzTxDYdA1jo6FKIc5mVeSktfSX+JXXKBWCkX/MEe8Xr9mcYr1TloJKdlndZDyPaehDYX4NGKb1poNyQ0q0QiU6FRmzqXKVP6QdaFwh1cKyChBvGGbqex7SZ0ac1HdePZv8D9zHpf62vjta7wD7I+y+bRYomr16zlc7fdyeW33cGvt213tofRnU9vj1LK6zfVFf2Wd3KnWftESpd6dGXyWPyJeeL9zZS1uNieVkDL09j0vP6qX12sq9U+K/IKqVQGJ99CI5uWxXsGnRMS4tgIwSw/regun06geqrYc4s0+na50PNkvFZ76y4b3MHntg7x7R0TfOuxrYy1TseVnVPbaifl5yn4BVrcXlrm70H+8EMhk71y5w32zDZI+zNjWj+nXSqXu3ayveXyge78tRMt9oA2tJesPbdh8b8aeWxsXP96zSP654+s1bcNDenHff/Tz5372bFWQt+SdI3r2237hpmOeVG7Xb/Cre/4qD+x/dP1sR3XMVI7jyA5GDVS+FWLSMn8JyJTM1rCWJ5+Hl/HIs82mRgg/vEwP/CIwpDAl8WWDjFMRSME34hEh4cdFgW7LUx3bmRe+mfsZtxIf3EdnZNVWrwdMqUMo2SR5gUzKVkBXouH0W+SWpTEmWfidTWoJErUVRVlOxS3jDFwX42h+5JEG/K0bgtIrhkmuncDjVWbMSY1WbPGkuwW3pa7j79K38JfO7dzTvUuDtyximmjW0nVSkSG6GytU1vgEr5lN0YPmUd9ThduRwu5vi569phGao6N11FhMj1JMR1QsVPUdCfVoI+yns2IM4tRexa1YIbU24UabCE/mSXdMLHE3ig5yFjhMSZTo3jJACPrYGczUrcLOiUkPIfcENheN2ZlJro8l0a1j01DBhukXZsfKzP4aJHaUISuJTD9pBBpVxa6NoE8OGfwIEvtVcxP1pkUJPFkU8foZqwlx2MzbGlHK5k9Z+Ls24e9oBXdpmmkPGp2nZrl0TADwrifiGTwPLE8AUXzaCLweiIQyQIwElIXYaFjshyvQCROy3WEI+M/IZKUsRsSOOOvuEwRTEPmnpg4iwQioTIEEpns5P3lvuS54FSx+uPyVqp3WapnAen22ViWzAMqLXeejVKRSF2IcxlHV3CjBk4UYkcKK7RkzjAx5FzJZp9SgeStkQjHyfpDLypuNEZgVUQa+JZgZ2rB0CCUuSSS9oVKExmBiEdo1mX+DsRUjdJKxJBzCU2xwZW5KJ0nP2M+ZAvP2jSWjM3XnzACvp1ch5O8xkwXyPTIsyeRlGd8PH52gqLlJBKR19S9DUqeQYoQueGfGGtCqrXc+xoDLan8YRyvspUxEoKRYIXckwh2Op4XtY1+cr6MdoZmQGCXeCXnR98Zw3dHnhBb5hJ7klDmE21W0FYRLXHaGpZwO9gjF77KYLwu6oVAl313+slmy8G0dC7HTkwniJ9JhsylMmdGMRZmWbqmNCWRzNGBdgjCBLJQxtZFLG8r0fjD+IOr0PUdv35dGvIClRovkNZMegqBiAkhz2u37GDF1pA7Njo8usNkskEmzqIb28/WjR0nxQQ4vi6o5C2Z+Av0iewKGRkrldO6UqnOckbi4vSdopTy2lx3dcpOrSOZHNRO6pY9unMc3+dyWmuRt2dHeGuPyYK8kIidhV5CGC9CIhmCAXbGI1g2qavLXkLxZ2Xd7IWsGa+zZjLiUfEA3OWlmFiyHPPYt8EJZzB+0FuoH34S2RPPoOPYE8jssQjTcT/zLEVPRkj7y4nakxfPEfiOudq0zWsdw7jV0ImVVctqm9S68PSsw43gtHuL4aqvPlrmKxvgy49GfHutz61bw488M+/Tyz39PKHy6xsSUa2WTqtPbrvZ/+3P7gy++z/or34RvvolvGv+97Lowbspg/4qAAAQAElEQVR+zdgOzIYgWvcxQhtPJalYDp4dgJpAK59Jo5M17M/PGifyPeMA7nYXU7ankWjIos6vo5RM1jKpB1FELuPiOAGG2cDSEYm6Tc5TQqIDWn2PjOfjiAfW1AZKdpcNP4krGxSyyYIVVZGacZ0InY2oZiIaMkyMUPKWDCY2TVKR8apkkyNVqpMpKZwxRWObx9iGGsGYIx7tHB3iQZ1v7mBf9yH21xtY4A3TVfdINbKyCO3A0HkMWSBbuRB3fgJnnxYy+yZJLzMxDrUw90hgFloJjBkUozkMRNMZlzK+2GpXUyTKeSxfysXuKTOkmqpTF0nKRkJOMEmECmQzQCkZCIaPlgeZmRumd1aGpJ0njFoIVAZLbIgJ7NZUO2szCxjwdyNxZxHn9gmiu0rU7ysxubJI8eEqvtybRpDAih+cRkDSmmAPZz2npFZwdOZ2Dgvu5hD/Vg6z7uCQ9sdonVclOa2B22ZiZluIzBymPHAdP8CtN7DrgeCfkB3kJL5M8CFgmBEoLf2ppgQ5lFLy3ny9XgjYDa/bVOPHhsjGo0pJ91gkGwmSQRVTXIGGjHVbSJZhDGEaJQwV96T0IR7yxP6deUUiXp9XTSYU3ykrWRQrWewp8R6rIIXpyT3gpeVWcaUthrQtIlIRoaFFIBDi6hsm/ycGvmzQ+SZT6ZGMzVdahE5i6gYGDZQhGCoR7ce49cRvL1eUUl6K1Oq4vEok1tuFPTxr+jHovqOoFWZSSWapm2lCUmiNYBGiCDB0iBICrcIIFaipOdqUxZgRpuU8K+mW2KqfEpP/Ozeedm7KvGH5DrZvT4kV2JiBJWJOyRQ5l/k/Di3pJ1MHsjSviN4SoWBQNXNU3Hl4LQfhTjuGRGExViJ3Dr/nocSjE6sw8bstoyRjIYWh6lhRmYQ8l5DxTdCC7WVl3IMTjBOJbX6Uwo8yEFmC17CcxFpefbHpmOpD6ZRuQ55htpdHGUIgjLpUrrGkv9wY5xjbKJK2hKigHdOfJm1LYMkzTjK+5JdGr9ZaJuqnSnaMxacR4xdpyyOwXQJlPkv8eBRJvK8MSTOITEvuHQllng/x+/Qr7P3KKzXm2ta1yum/yu46HC+1t2zW9uLJvYwqCb0rYoUN0BHx4zP+fr9nuDRiEds8EwJTyzygpXkKFWMsOFq6LljWUKaIJaKrkhaAT48ulRZL5t/rpVR+TEWNRQae6InrrwtWO1BqAlvufzfUOKEvW3iTcl9UMWXcGUFG7sE0lgJlRPw+h9wH5bh83B+mtNWOArm3ixjWKMj9EAkOgbKkDy25Hw0RJRg9IaFScm1ImiF9a06dRxL30uUJfc9VTos+MzJxPUvExPEMGdMwNS8ZgGUQmQb4BiruRIl62a8GBVmYoKfGSQXDjPu6LHVV0dqTdkvdgr0VaMzQwwhNkU6prgDK5NU8XLf1WpWZc3pi+kFYbXuhrWliqoOijsGk9NmEjI2iYNNAhjjxM8yzTBn/pvSLjCuZK7zGBkpjK6iN3dYdVFY1tB7rezVtfim6jZeS+U82r0xIriy+sjKdOeRIG9NISmiHipigVezahQ2rfogQonlPx0gp5alMZvDpcc91LvnKIl48mS7ozbedPjPBRX0+F3ZXeEeXYmneVc9V7sXiYp0FnHXy2F9jETmK2iJP73jZBLpdMGiX+TIrKzJLpWlk5SbcfSnO8Sdhv/PdVM88C/+d7yTxzrNIH3H4UbqrbZ7KZp94gD6PsamU2vw8SXQqtb5b2TfkVWpFQhZRQWSXIp/+stbduj45t+pVlw03vKvvHKnxP2vLfG8kz/eHclwjJPpn60qUquEnnk/3M+NVYPZExYmr/VV3HjJx9Teof+XL8OWvoK/8EsX/vYzSL74Dj91PNqjJ4sRDyQPBUy51w0ab/tQkEIrSrfTyG/8gvlR9B19Qb+UXuSPZ3Lo7DTuFL4sG363TSPr4KU1heg43Y2KYAaJAJo+ETIItMqHmUbJgRha/oegO5WGpdQYjsEn7NZl7A/FUBzgNKReE8kwErWSBRxpTJsrqqKI8IHGVGkljEtsoy+RkEukEdWHY5QlFNGHglHMkq1kSXoijBzCNMeLv+Pq2Q+AU5FzIM1l5EGqSUZlMcpxCb43CQp/UPgHhPj71PkXDbKc+OYfJwd3YurWLwW1Q2lIGIfDJTTWyox6FagNXFnyNljHqnROYVoOkr0j4LkrsTjeS2GJ77NEhN0TPEoPkjBTjHTnWdrSxqqeLVV0FHujt5tG2XiaCHJ0rRyjcP0b64QrGow2qD5UYWzlOZZMPZQsnMLFkgeabLtPtHZzk3MT7ct/nPeZ3OT/6Ou/nGt6TWkF711bcxJAsVMoQGWjt4kZKsA7FOx7g1A0MnaMRtVAVDAMFyowALQJKqSmhebxuCMSLZSuqLDXNrfgk8IykdKU1Nb4SuoSh4v5yMJBes8ZQpodWBhGWSABKbjDeAIc2FxNFhUgWhIGOCMViLQTNEBJohi5GZImRQphNGeMqBGmXVppIGhYZBuGUqCevIwkDEB1mmOSVFksIpC3PBEPsjFRAJAtnLQJyI0utv89LybNzZ3kjvYeruo+6WM85GW/mMupdC/Ay8/DtmXiqReZVV8QSMaTvNWIJgWAi6BBqk0jwi+e+QLkEpoW/Uyz7d6+fjI9kTFi+JYs6A1NudiMAI4wE6giZHEQUhjZEbBEHLflDJa0WZhCkUjRys2h0HEw07SSc6SeXjdSctoRs0PISj/ij689ZxPB7LKOCERTQ0k5L12Sc+9LXESHynAhTMvf5WNEw8Q/0VMUzWZdxEwk6BCx9Tp2vQuRTfSgPLyU2mF4n2mgQWHVCM8QwPLFRcJbBq/DE/posrnNovxMjBJMJXs6RF3IH4907y+60wzBGzwvtgNBKCm7m74rUFslY0RLqqdACwyE0LBlD0uWEcwPHf0rnTt2/b6hUYbPK9p9D28F7hy2HUE/MpWokCVUdpUUCqSFSgpsmUhaBShAYsdjI400wC1AqwtQKW/rYEttlKhDbIyEroUiAln7XWvQERgbfeGXIh6r1axUSCl6+EeBZRUJVxRBbLW1IrCf9Oyl2lAU8Q9Y1KREHy/JRRnWxzNevwCZOYy8lbTOkPi1YRWaRgIggShApuS8FL60EDSVtVwKA4CSgwtS1YCrzItoWmxO8knOjJfef66dJyBZg0ksIebZkbSH1iQmRzM+BzDu+YYNszhmB7fESDq2fsfnly+IwUkSyWRHSIDQ86Qdf5ryA+M+3pFKdkv7wRarS9EjSWiRPCh0/A73xV3U+UC0t1xhdC5c7Xftg5RdIvTJnCY+SwYChA4wIjMCV0EFJX8kLpO8i4mtpVzBGo/gQ1a2/IRy7z9HVgTfMJ3hkZNE8XhQBg562AvvMbGf/5CAn941xRLdHV1pdPhBFn16rZ/dsYVq5aKdflCi/WFV52Y3s7+5RB+29nzp0/+UqnU0dOikk8cXKPV+6kkVIq3JWtqrclVmsa21f5rKX+f/TlrkWB6YVS6w6feE4i7IhfRlFV1tiRe+83qOWHL7vUfOOXKZa5vS6k2mnPIx70rDWS0WmJkqZMJ1J8X6X9Ohp+hkfYX8++58en0+o9a2OWpkuypNWJg0deXuVK1UmRifwJsagLpODFTKkK9w/PkCp3Hh/TLSfruP5zi3f38TIAFuu+hEjd6ylOujhRWlKymb78DY2/eanBHf/hu76CKQ8AqcuS6YGOS+gtWrIRJmkEeR4rJLkpgnNjbLYfdjak9Vdy7lr/mLumCtpHT7bMhNMdJUJdrdRe7ZDu3g6bZu6XWa8cwNjLY8xmtxA0d6GZ48RWRMY1iSmnBvWMKhtDKcMyqkUvniuyy0OdcuhUEySL2Ypey2sqyYJiz0Yfi8Nt52xbI4JN0FZHiCR8kiIWLUJWRzWMBseRi1CeQYTmZLUP8ZEfoRSbpCqDGdfSCXWCI4aJhkNko6244i3yZSFs1l3CA3R3UgwNBAy/MAEozduY8v169j0q4fZetNaRu/YQrjJwS4WxJvdOoWT4StUpGQgyvQTmahYlzxw/KibCr1UpW3Rokk4oczqNztcsXw3/mL52/iPZefzUN9+pA2P6aUHpW1j1J0SoTwEVLx4ECJe2e5RXleksVXaFWRloyOFF2alPoMextnPWcvb8is5N3cXb3fv4gDvIaZVtopdPvHCP1TSv9ZWcMbRiQZhwsRPZvDsPMUoQzlwCKQuLW1AQprHGwSBkYKRGtsfe4f01aSMiyrx99UbiRDf1fgJRd1NUzWnUTd6qZndsunTSUy+PJ2Mx6L3hmiIO3Qs1haq1nZK1hDluD2pScLMpNzvJRqZMtV0lXqygaU0qcB43cSIsjR0F5WonVKQpSbzZUhCYExskrdX9KXsvs9YhQV75+cfvaJ94cmkZxyHbjlA8BCykeqh5LYyaacldGVuNKkmfCqJMhV3lLIzSEnmU98eIbLkvjafkMgYIxSJw6eLb45SkbwVe5SylC+5Y6J3knKiSCVZEhG9ySqVRE3q8ZiwuhizFlJO7w7d+5OdfTBti99Ey/z9L7azC7Jqisy9HDhkcn6uYorRSAhWjYKM4R5CN0OUruOnK9SnpEw9VRHbZJw4RcrmMBVjK56xHazSwc+l8lWNM+zNoUpQU+1iQ56GbVBL1Kkl6zRSNfxUVcZzibIzJjLKpDkg+A/hu8Xfw6zWwWcVVslbAp0R8pB89j0TGmTkWZQRkh9LWs6TEmeF8pySZ5WOTM8SR8SzdL5CESqdXlmYPhs7P4M67dSMLspRJ1XdiQ5zz7Y3MJ4V58omUaBapWw38fxWMzupGbEu2QgXAiWkZKUqpK9/JUw2sNcForMe5alGbVTEzgrdlOiibGWoyXOz4RrSh4pGIqLm1GXuLRE4E2hrNOOz/bTJl7kOZeehrDWRysocXpD62ymFHVJ/p9Dplmdh81rOk4l4zFgBQbJGfE+GMmdrWVuFIlV3nJI1QsUcIrLj+3GHrIWfQYh3tu85w1Tmd6KjaADDHQvMHDXp+1JUoG70yHkXVTtBfI/F4sl9Fsic4CUmJX6EhtQd2VsI7YGP+Xr4kN/R+Upf2G0rUx19ZHuXYKbnyJicIfPWdDxrGoEt4vRgGHGf2eQbilzdJFdLkBdprTjkxnz0Y5sIH11NNLy5WzeGzt5p4usZGq9n5X8wdcvmzf233sKvvnIZbdvv4LT+CsuyAaNbSxdeedvoeZeuqPRdPxx8bMgL79OTuvBKtitnJ2/JO6lXZLdl6iEuAxkanhbyWtKlxTuJ7a7YPKdeu/7Pdu/mX0/dnf93ymLOP3g+e01LlFtc/5MWdUgEwlWHM0oIe7tyVvSpxGc6lVopUo71x/EG5f0jSucVGf3ihN4uMvH+OO2lSRHcwHHMaE0hZdBnRcye3MGs0iitkyPkdJWO9gStKfsKMebZD1F+95Ad/rmut3WlGtyIWr+RropJqywMbdKEhkU2m8AtT6I2rMff8giTqYiGtMEJsAAAEABJREFU7WHJbmfCb2DUI6i7+LqFMbOFbU4OXeigbBRYl+7m3jn9bDhoJtmT5zDz1G76jm8ld0iO6kyDUsLAE4+yUTNlXVMnLRNHS5SnxewiZfRg0y67qPIwMkzKdkA56xPhgLbxlcWkqwgkTddcqn6ODU4bv3DyPJyeS0nNxSp3k9qRolUIdYtvkAp8DKQ7ZBEYpkuUcnVGWjWD7S6BmRIC6RKpWGck16FMctCwDDzTILAgsgK0qTBCRzyyUoY8QxWboa2Sf23E9HVp5simf3ulHWssgb+uxo5fbaH2YBU1YuN4SWxlgtJoIxRRgI2KXOwQLNEb6DwjZoWgfwIWK+qLZzK48GgenH88W9p3I9INWiqPiz2TxJ5yYd9YkYXrZcjrVrR41qs7PFl0OESREWuXNpvUsCiSFMlR1jmqfoaG70qjHCxtkDB8Eo5gY49TN2tUHIdSqp1Rt5c7t/hc/u27ufpn91P3IwwthAuD5vHGQKCBMAiszZEQON/ppp6YSdWdJ4Rngdxjiym6SyTcnWJyd4lbQs3dnbq7AE/yBbLBFCnnFSd8LwsZ01qH3IdRsluIxQzKyT6KqX4m0jtlFsX0HGnHXKqZPNWc87pJOdlFyV4gOM/Hd+cQOb1osxUl3rSX1fYXKaRU50rlLlpOZr+9nZknXpHb493k9/8Q+b0/QHLumYQdRzOR2IdRc6H0dyzzmHD6GZfxMGF1yHzYRU33UtU9VGSjrhx2TZ3X6JW54f+kbPQybvcwJou6CXsak850iol+qqm51DLzqaXnS7/Mk7h5TCZ3w+g7jtzu76R1r3NJL347Tv8Rq8nsdjF0XvUiTXrBZGmvTEbPzuLDvLps5FWNfoosYsJawkRqAeMpsScl4yM1m3JqDjWRenIOUXoWpKYROS2izNksb6/pK4yiTBi41MyZTLKYor1I8NuNcmL+lJQS8yiLnRWxu5rtE4ynU0l0CNlKv2w7laxBnl04fUtodOC5bc+6Z2p5h1qLS11k6lyu6zmbSDaosR2UYd//ao3rnXaqbM8lZmE+YWYh48SY7MGkK3ilep5l73Pe99mU9HufYLmAcmJ3KjLnVd2FQl7nEFkdoFI38OQROzKePH1ZQWAm7g+MNnlOzqBiz5e6FlNydqfoLpJwD1mr7E3J3Utkd8piQ03mYs/tIzLb0cT96q7Jv+xNpSdMVk7nSt8oCBHtp+IsomgvZFLCksyXz4nPazZXJihluphIzxSZzWQmDvtl3p5JKTWTmswlYXIG2sqBZa9UqrP8RIte+rvK58c0idW+3UnVmcmkNUfmpd0ophZRSi6UcbAbpcQC4j4oy/1WTc7GS04jsFuJDAdD3CYvvdaXVkLF92Ky4xK7bU/Z9DxKNoEPoJLcn2JybyZSuzORFjsz02hkM4QZB51OQ0rmqkQBlWzFkGszo6jVN1IbW0UwsfGbL82CVye38cqo/ePXUhbP5saHHuLun/2Cb3/mv/jlN7/Bvbfdxr1rNrBi3Tbu3jTO1mLDUXk19kZAQwhhIf6XWltq+tKHhrReP6Y3jVT0+5UM5PhmreE5irA7RSWzq/am7eja/pR51F4t7qHLutPnL+1OXdyeMpemTOMWLEMWn84AdHgvpM8Jjc2JwLzLjZxbbJzrHZGXOpFXk1Z/yQzfUreCvdrd6NpDCg4XdWU5fccWzhrfyoUpnw/NaaMrY8sC5oWseTItaPQYKvK0ivArk+BVccKARBRie76Q47p4cT0UAdqQd8NCKy0TT4CJB8pH2NSUWIaU0zIXNoaIVJnQrhGkGgQdFmGfi9FvY/UqrJZYVxWpDEOIo1vvIjM0C+ehHP5tBsUbQ8orDMKNrahqNyFtlKwU40mHtFSXqEVYXiDngdjqy86dpuFYDKUTrM1neah/Go92dTOYaKFmpKkbJg2xTaWlTCcoeZbWUzVKCY+JlGIy4ZIsd5ErdZCu5kl4acwgLeSzBU8XqBptVMwW4l1l37AwtMYOkNYrRusNKsU6qbGIvh023eM2uapDyk+QbSQxRhR6oAETPkorIsExMBv4licE3cc3IxEwwx2kvEmSstOO0U1S2PrCyOdgo8asaAJbjxGqcSKzjKkamNI/VgR2aOLI4swWIuwKOdaRSagjIjug4dTF1oaIT2BCLelSTaZlQZElcDNEykXF7VEGSI9q2ZQIyeJZnQzW8qx4PODbN27hSz/ayC/vGWDjDiH10gak/UpLkebrDYFAgAyKsOOTyl1wTb7zTbTMOpXM/LNJzT+X5Px3k9rt3WQWnEFu8YmkF51EauGJ5Ba8hdzs5diFfkIrc80boiG0XYWed3Gu91ja5p1F627nkl5wDkmRlEhW2pObdx75ee8jsfAi7MV/8bpJYsm7ySx5Ky1LjqdrydEUZu5DMj9j/auNo0q3rjRz3RdYbYuUld9nuVU49OOJXiGwc06jfdG7aV/8XloXvoeWBeeJ9/ddtM45l5Y555Cdfhqp7lOekK6TSXWdRLLjrSTaT/gdSXWfLOPnDFpnn0nL7LNEziEun5t3LjH2ufnnk9/tCWmZfx7pmSfi9h5+g92x//lmdm6PSrQvN+3pn1EqM/hqYKHtxLVOywza5hwq4+A4UvPPILnbn5GR9mYXnCthPGbOk/C95OYIHvPeSaHvRJK5pSg14/ci9LvSnvh5XtVjT3082MrlrrVbe1YWFhxJbv7J5OaeQ37un5EVSYsk551PWnDML3gXhQXvpGvh2bTOOplE6767Ut2u54kyP07k55Duf/Oz75lFch+JWCL2Tln4/+FI/5uZOZst3Gd8j3rXq93lnNmuz6S7l9C+4Bg6lpxCfrFgtcfJpHd/17PtfY773ln8IZnbziS76BSyC08iuyCW48nPfxNO6xxwkk/NcUrWgbts13NktO32G9yWmV7L1KcsTqB1sdgrNrfufhL5BWeRmfdnpESS898j4/Pd0udyP00/nmRmX0xj2gWOan9FHEJO6+xyft7hUv/JtEr9Bak/t+TMXcLr1Zo7nUUfJrngAzJvCwYL3i335rkkZFwnZS7PzX83BZnD22edjp3at6zo/sBzwPsCUaH3zETltHwyP213uhYdJXPf8eQWnUBuyYm0LHoHrXPfQ3ae2CGSnPce0nPeSa7vVHKdR2I7Cz2fzo/bqvOWZ+p8xa+N/FUqM/sSu/tAsvNPFGxOIb3wFFKL3kpq8fEklrwdS+ZttfgvYNHFsPBvRS7BWPhRnIV/TXrJh0jOOwur60BI9Lz69u4CAPGKcRey/QlkebKJiUSCZDKJ4zjyoFFPxkYYslCvloo8uHI13/7mD/n6177JL376Ix6//3Yq2x5mYscAlXr9yfyvfzBBsn+D31h1/cD4x67esoMfbdnRd8d45YuPe+FlsXURjmdjDmZewgPecPStlhVuyiXtW6Y56srpCfWZvEqsV7KDqFSnhIXNLzYpO56x0vFz17vVzM/Tqv3alEpt3gaHiAe8O7ZrV0QMF0+BXozfOMkY2nRS12MPcMTgWo59dAUnr7+Td4ys4aRoNO6/8q7ow0qtw8xcpTNZ/NY04qSlYcocpT2cMEQ3IiFTDl6ugG7pwhKiZgnJEq5FZIVEbohOBNhWlS5zkkXGELOKD9EdrmQWa1ioBuh3I5ksDcK0hbINEkFIpuGRCOtC/sCcSKEezBPcnaB+m6J6S0Dl1jrFe4R8b7NRNUnXLkEEKd8Xx7uH7TfIyZhzo7oQwTqNRAPtRCRyCQb7kzzS77Kmx+KxTovN7RGT0yyMuWlZqGRRLRqUJ4Q1kjbK0qCRIFXKk5K9lGTdFS+uiRXaqCApHtwcUdhCpLOEUzZEINhYhi/XVfyoBH6RZKNCW61ORmxK+AGOhqQyUdrAL1cJJF6bmlAodyB1B4aHbwb4gqFnhihjXMpMkPQUybCdZDXD3GrIm7whjg0f5IDoLmY768gmJ8Fmym5HCLYlrFiFCiUEOBDtJBRGVqGTDeqJCkrqsyJpq6pi2SUsq4hpVrCoy33tSTdqAsOgoYRUR134zGHrjlZueyjihzeO8d1fbuPndw6xfrBBNVBEohHti72glBJdJul0GkN00DxeFwQyMo8pt221kZhzeqZzv09me4/4eGb6m09Pz3jL6enpxx6V7j1y70zfocvTfQedk+o/+PJU36HXpGcsvzzdvfvpdqZricz7rzrp2xVgpuZSe+ZncoXlywvTjrsk1//WyzPTT7gk3f/m4zLTj16enXbc3pneE47L9Jx8cqL/tB531rnq9RK7/y0np+ccdmVu9kFXtvTv95l894LjEtmZ83alna9UHuW0r1DJGZfahYUqM22ZKsw+UrXPO0Hl5xzdlu87/uRc31uvyM84ZbCl7+1k+k4h2XcSqVj6TyYlkuw/aSoujt8pmb6TyfefSl4Wmfn4vO+tg7npJ96QnnbcJzPTjjs5M+3YvbMzT+jJz3pzW37mkW2pjn2VnZl5lHJ6rlSqc1Ck/Eq175l6hJhmHDO6wcl19rTM2OfjuZmHXJWecdQnU70nHJrpPqI/O+uYnuy0Y5Znph1/QXraKVdkpp2yOtd73MdznQfsnWxZop6p79W6TuJ4YquzU7/T3rt3S98+h2b733Rtbtqxstg//rhs9wnL09Pesjzde9xx6enHn5+dccIl+enHndPWe8yS1ulHq2Trbq+ovfH84ORmXpnoPXjFM+8ZR+6jKZn5TjUVyrXdf7br9L7VddIL+qfuy9+TcO7E4vlCJfoTrd3ZlhnLzmmdfcSVuf7DPpObc+j5qZlHL3mmvc95PfNsNz39yHmZ/kNPzvQdcklqxiFXZmYcdE1m+j6fsbO9S1Qi/4rOccncXDfXs8dxLf2HfDw3602X52YddrGMx9PzfYcuycw4Yl6m9/i9071vOS7d9+aTs9OOuijXfdDHk4k92sxExxXPh8FLjU/k5mZz0/Y7Jzfr8Gvysw/9TOvsQ89Jzjlqb1f67/USZ+a5bqrvrXvLPH1oZvqbD031Hb08Of0th6ZkbGennyRj/6TLW7vefI6V2CMbz18vpc3xOHxmfpUoXJ9tn3tUoX/55a0zD7k+13fwVdlZB30833eE9M1xPTm5x1LTTzwn0XvCxcne46/I9ByzItO+/ON2dqHrqrYX/E2iZ9b1cq+VKmxWdv8njZbp2XTvfsszfQcele4/5Jx0/0EXJ/sP/Ljdd8T5esZblhhzz3SN+ecotds7lVpwrlIL3+lai892EwtOV8l5b80mpu3ZY+f7Dn25dryS5YxXUtkfg67W1lZmz549JS0tLVMLYkOHmPgYKsRXBpMobn3gYX75s5+y7Y6fkNh8G9nJ9Tj+JK/n8fS6xU+3/72jFb5893q+8MCjfO6etfxw3RBry/rCmKhmZLHpkFnHSzjih8+uTsDy4MyM6WrfpNaFWHZWo1KFzfi5UT/KZCbHwwu3jfp3bqt4vx5phCuGg+DYnfleKLRJDThajVljY0dO/PZGNv/vFyhd89/MvJ1y/vwAABAASURBVP9nzLr3x7TeIhusd/6McGLHJ3S53M2LHE94CFo+Tb4Tc+kSSrO62JF3mLAUkZXEt/PU2/qoTpuL1zaDVMPFjVwwLDxH4SchTAYkhJTNtUc4OrGVE7z7OTi8jqO4leOMLSy3NAVlYZspHFJCem3aGgbp0MdoVGkMTDJ++wDFRzzYbpMYsjA2VJm8+3Fqjwxgj1RpqYdkhIQiWwehU0OZDeyggUGdSqpCYBfpDMvsnzTItNXZ0Vdn7W4BaxbChoUm9f1acJd14+7WJgTeIxUEtFUUveMO08cSWL4WguwTqRraKKOMKqaQZCfQQmgNknUJax6mXyeSOrE8DD1BWghpypIRp4cx1Q4MswhCTiMhqx5V6mJrmbKUqIOFkOkItLxikZPIiAiMgNCVOMvHCIpC3gMJXZLi4Z1rDvP2zIO8s+Uujuxcx6yOCZw02JFgFBlC4GVzw/Bo2A0qThWj3cCVDYMwIRsPTl3qA0d2HRJhkVS4lXSwhWRjAKsutjZKxI7kqpFgPGxluDKN7aN93Hhnne/+ZJAf/GKUB9cryp6gHBh4oRJsIpkBApIJl0KhwPTp05k7dy62bdM8Xn8EzFz3JWa251Lldl4zJcmWG5R4K+OFimX1XmWa8y9SZs8FpjX3IsvqucZ1s6/JAuKlIBPbqtzpnzSdmRfFobI6r5+Kc1pXWnJuWd3XQnos/t7g6yWW232tcuecjznvAsPIfVqpnutfShtfzbxK5ceU236tme67wGjZrcdoXSzmLVWqb1+l+vdTxsz9lTlrubJmH6CsOQf+jph9+yujbU9lFHZXRusiNVU+P/soMz39klinkj6InxlTdUg9r2Y7nq17BKU6yyKDKj3jUpXtP0dlxK5k4Zb42TplV7yh4Ey/QiXmXGBk5y8x09MujW1+tq5XJ0Yp5U3ZIeHTa1CxjenZJ6tk/yVT4zmVX6FiSReuV8meK5Xb/0llzbhKySbY08u9kudmeub5Zrr9uOe7Z+J1S5xW1uXuCpVC3JZXsv4X0yX9Kn07Q+aoBecre+7FypkmuLStjm16MYl1KyHISuYGGdyfNE3RoRacYzqzL361MFVWz/XKnnWpkrlUmTM/Y8l8Gtc1ZUc6vVLFfSv3ocp2Xm62dlyq8mostvOVFCVzOlbXBVN4ybmjWle+GFavZrq0zZF+XKnszlumJL4f47Hv9srY7r9E+uOiKZsl4yv1Unb3DfHzTKmO0zGk38050ifyzJB1/tRzw+26SqWmf0Zl+y5QhZnLVb7r0leq7peiR3ApT9kj9sYYxGPGFFtNs/equpMW9wsFuQednTrj+y+WOE7WkP01jKfSduZ5vULj9ar4jVpvd3e3+tCHPsR//ud/ct5555HP53EsExsdr/vRZprQKuALAQrKJaJ19zBx/VVs+MW32fLg3UwMT973RmibOOxOGq5V2Tw6yGTCYEgIz6bxcbaNTmL49Mc2xoMyDl8l8Vrxy3mlxhrgDWvdLZIpSziRJPuwoe/8wVjtsv+3cuuyL9+2jt88Oty3ccK7bldsscteW6pslEsrHmTy5tth9f10lrbQ5m0hV92Et+Z2Nl/3PcoDWz4aRPXzdkWnymQGnWmzPjnrzHdSWX4gj82az8Pt03m8MIOhrll0H38q2UOOYCiREW+thfIhCDU1IYBlZVCP7yTZPOn2t3OovY33TRvlvJmbOa17C4elRukJyziNBtrTaN/CDBwMIaPC/ChXiwwUB9iui5SsCtptkBTJG1XadQNzwxb05kGcWkBLZFNMhUxmQhrJCC2kPCafkdkgFRWZXRvjMAkPKdTZcxbM2yPLvAN7WfimOXQv7cbqsfGcOoGjUIkklniS7ZqJJVJPB1RyZarZCaqpUer2MKZdwRVi6oYNHK8mHu86jtIYImFQIqPKzMj49LTUcVvGqRVGxUM/KXUUxXtfoZrwqec9glxIZEcy9rR42zOkKZAMW7DF461kE8HEpGG2SJ0u2GNotZ2GEPiaWQZ3iM70OvbIrWH/7q0sne0ze14OK2tQi4l5okQxXWQkMUZitkvrvBaSBRe/UsWJsa7JCPBdPNXFNmazJbWE4exSxtJ7MOLOpZqaz4Tq5OEBzQ9/s4l/+Mx1fPWatTz4aE3IchJlpISApxBDxC4T6UEwYOasWbz3ve/lP/7jP3jXu95FLpdbLpmarz8ABNRrTnpeeVCUkJO8tOP1kp0tiu2QRdHgzutXO9R6OKP1WJ/Wo4treuyQWBq6tDgmPFrrN8zi6tXAQXAuvxp6/5R0xvf+890zMpZlzZIfywjpiOWNgsvz2fv0eLHde6a9zxX3zDx/DNdxnz69HU/H5bU+F8xft3tUqXhjTT1rHDwdmzfiuWDm5VVifUapwfj8mTbGcVmVXZ1Sqc3PTHu9rmUJ+HpV/catd9q0aWq//fZb/853vpNPfepTnHnGO1gwfx6uHT+X48WzkCdZ7FtRhO2ViSZGWHv7rXzzC//NP1/6/5Z+61vf0oODg/Ic14XXq5UpxS0F16Y7nyZZmaDHiJiVSjA9kaDdUSteE7sqphPX06lUWWRQaJETeLVDfJvM2h0D/GbDGm4cWM/tm0a44aGNPCjhYEOfFJd5ITHCqNvyou6JNY8TbR0iryMSlo8fCEuSecPQPuFkiZENj+FVyp+Qjpiy44V0xmkV8UCNT19A/eC3MXL4mQwf+07U+R9ixkcupvUtb4HebmphHUUDYcAyAgxsIy1hjtBLCCE2yERV2sJtTA8fZZH3GLP9LbRGg7hMYCkpqz2UeFmVDVIQbTjUPShV6/hWg9CuE5pVAir41DCSJqUwohgmaZg9FPU0IYEJQsPCl/FYcVzx2jq4DU26WiXjjdKhBllsD7F/dpJ9W6osyNbodspkzAqWeIsjIdw1A2SLm4bloO202JLEjERCCxVptIqkHkVVOZIvTcXMU3daqVppPJJin0NkKlJC7rscn+5ChNsdsS1dZjBRoeJ61OyIMTOklg1ITG8lVWiDmoux3YJHAlgXYgyJ7fU8bj2F6aUIcKUsyBghdE0aGbEhK+Q7OS5e6EGywRDZVIXMnCSt+7WR2TOFs8TC3dOm/eBWWvcUUt6TxnLTJMI2UsU28TBL/wSdjLOQlfab+EH9CL4+eSjfLx7KHd4h3LS1k+/cuIOvXbuOH/52Iw9uLrGt6DHpCQaRgWE4GKYt/a5IuA7z5s/h//vLD/EP//B3nHXWWSxevPj6rq4ulUqlXpv7SoZO8/W7CMS/8fAEqdLOzvB3c/xxXj3R7knZrX/t5fVCVMkCEYIxUCWTyLNk1lCyHWgRZhBv4a7O9/wRHiXZRJjU9bnPhYHECT5v7EZrPdz9Wli4q/fNa2HLrtSxa/a+cTeOZOzJvPza2bdreL1ac+bwG/4+25Ux93rlkTkgs3O8PBHGm6Xxc/21Gz+70nZZQu9Ktj+dPNJZU4S3UCjM22OPPdpOPvlkzj7nHN5xxhkceeSRzJjRi2ODa2iSgp4pxI3AZ3xwiIfuvofrfvQjvvGNb/C1r32NX/ziF6MbNmzQrwd62Si4azchzscsmsnRMzo4Ye503jSjk7lp96ldMWmr82raVjPSv6M/B57te0vt4eGbg/Xr8R9ZI0RqK0M1xbodNTZP1KlFnPRCNonNBW34fSryFzUmJtFCOk0MAtMQb2ccSucI0VRC0vxySTiuEN1KZapPX0hvqdFYPBlx9qpygtvCHm4t7MnNM5dz06ylbN5rOZW+fsyMK/3ekLqqYPhYysAJE0LOMlhBK3aYxgxCDFnX2dFW2utFMmEVbVfx3BpaSLFh1IjMOo2YXCYMfMsV61O4osf1NG6EkNgICYjJcdFJsc3KsY42VkczeDi5O1GQxfFcojBJRchsqJO4FZNE1UfpSdE9SEFtYwbb6TNG6DRGyTGOQ0kIYINIabRhobWNV4koDZYYXzdC9cGK9EmAHrAwa1mBq5OS6mGAHjbQzXqrmw3JXibMNgKVJjQd7CAkKxsCba0mrXMz6HkW1Q6Nl7VQ2RRGRyv52R1ke9uIIpOJ9ZOM319i8p4SRZHS/UWq6wTPMQOrqgglz6SToapa0FEapSwEXBQVwaiOFQXEU2jYZWIttkjtlxJJkFjqkNorQXKmjZGIl9Y+jbU16vfUqD5QZnS9x8aBJPeP9nLb+DxuHNuNX2zu5Qd3a77+ywF+eNMANz+4Q7zPJUYaEVXARxPoEC2Sk7bssfsiTjn5JC54/wUyJ7yTY455y/rdd99dtbS0HCfZm6/XFYGc7AU9sesekyslXtmXYo7MK85Lyf9GyBsvMhpQeL3k9cTgiT4ubLZJbLJwB2zsARfGoCrjQHZQX2XjYuyf8HRPvuiz5VU25Sn18Ri28AsWYfa5xr9saWaeyvyGPZEH46tg26T+3X7alXsGQlnEvzGI0K7ZW3yj9+8rNsfGY/35homkZXYFr1crD1i7PCfIPNL9fO14JeIFi1cM81fCnhfT8X/2xmM5lnjtHuMZn79Y6dc23Xhtq/vDqk0eQGPt7e3qgEMO6T/7Xe/i/Pf9GSccfwx77T6fGT0t5FK2kBUFMdOJFGHDZ8fQADfddBOXXXYZX/7yl/nlL3/J6tWr9djY2LrXqvUyADPZKBpckE1dfKqQ5/P23o1z9pwj5Lntyjmm2a+HtTwUdGac+rJ4l/rl2KV1uTve3Xuhsn6S8pjWfcNad09qXYiKE+c5Gzd9lNvuoP2Ou1i8ajX7bNpEW71OSmA0ZDQGSj/vZCJ6MsWwuiywwkJkBm1ONoNOpKhqU6iVTeQmCRBS5+cww1aS6QyGaYLhveAEErdF9PWNeeGxdzw+yU8fr/KLUoafBW18cwJ+ORGwLVRYlkHOjsRb20ArjVlXGLJc04MKNZZET7pEVUNIbUgkXmRXyhjKoJ7Q1FKexNVRZl3CBlXbo5Iy8MSjmXCytCdayAQGKfGjOJ4pBNolsPJsM9pYn53FCmsmv2j0caO9J169BbeaQAUJfCVhlMBs2HINgd1gMjmJoUdIipc2GQ7jqjEss4wy6mJ3AEJFbSOJqihqm8uMPzDA+J2bKd48SuWOCo2HNOE28dY2ZrHdn8uD3mxuaczkRm8Wd6r5bFO9NMgJ1u5UnWbgkRIPcevcLO37FEguyJOY2UJmVieFhTOYtngmTipJaXuJ4ZWDjD84SXlNleLquO4xRu8ZpPG4h1lsUNcuW4x+NoQLGaz1MVkv4MtAMjwDN7BBNgoaVoJKUuN3VDDngLvAxpljonsUoew+VMdrFB8dZ3LFEKVbRyjeOSz1DrNhzQibHhtn66aKhGUeWLmdn1//AD/6+SrulfxDFU3VUFSlb0MJscBJmHR2tLBsvz054x1v56ILL+LDH/6I2nOv/VRroTCP5vGGQEAp5f2ehji/Z/nXvLgSD6xLbvD1Et4Ah1KZQaXy658Mx2JMXguz4noyT9QtT4DXosYXryO+B7RsJqRIPedaI7b3xbW8vjmkL19xPGUam/isAAAQAElEQVQ95NjYv0Ms3V24b6D1NRtPvMjh7pK9uTJv0CMemyKvoH3PT6bietxdwOvVyiPjZpBdPJTq3OW8u6jyd7IJFr/vc/F39L3aF7G9golsgObl3oslnt8Lm+N5IU57tet/KfqNl5L5TyGvdNCzJu9UKrV5+qyZ6vi3nqj+7ROfOP3T//r/OFZIdEtnAS0eTyLQXiSkKcITz1i9XkfIMj/96U+59NJLueSSS7jtttvmDg0N6efCcFQ3Fj+u9Ufui/Sq2xtaP9jQ68aEdD5X3l2M8xzH2TTNMq6Yp8Llh3Rm2vZvc9W0nHk+ZsXx09V5FSoZTdAdEr4kAqAndUFXq31UntuSmFDHEqfmoOzh94R4hxAWj42GNl9W/t7VDF72H2R/9F32vv92Dl27giMf/Q1vNofYqxDiut4NQpK74/LPlKTn9euAvtiDqZ3EVR2Ld8eaPpNxlaIWJqUTskRBGq3yuPleWmfMxUnmryDZOvhMXU+/jhdeISZjNZ+Vm4YZdHIM2zm2RUk2RinuH55kpB4SKRtlONSNFIQZom0RjQeLlO6bZEA8l8V7J2GbiRO1YSQLYJgIxmgl85dZF8rqiWi01BVoi8gw0CrEFS9ttluWPHkTOwSrLsOkblIN8mx0ZrC2ez9uaVnKNUJgvzPWzXBNNgnEayw5cQKwfU1oWngJh9B1ME2xAXCMCMMOCC2PuqrRMONzA8NycXWK0roJxu4ZpnF/mewWqXtMURcv8MRd4+xYUWV0aDq3j8zm+yML+MbwEr6xdTG/2LaUR2szKZLHDx20sogZdCTE3ExFtM9vp//Q2Uw7YjYdh/TRsU8Xbk+G0o4xJtaO4G+KyNeTZHWCrJnA8WxqGxpU7ykSjAYMqx5uCQ/l+/UTuKZ2OL+p7cv66gKC+nSMapqo4VKXeuuCYRiWCfwxIsooV3AwEhSHNVtXTjJ0zwRqe0RyQmHXLfzRKrX1G3DWPUB9xc8ZvvZrbP/ZdyluXE8o92ugIzylZTMCQgm1GWHZBn19vZx22il84l/+iQs/+OefXL58meK1OZq1vIYIKKXKr2F1r1hVsd2vl7xijWgqesUQiL8TGI+HV0zhH4EiwcOLcXl6UyROFujqReXpZV7P812013s9bXwt647J1AvVt4t4vWj/v0w9fzL98EJ98MeeZvyxN/CVbl82lbpmj933uOGCD32Ij/6/j3PKO86gLd+OK4REHIdUVIhhGARBMCWjo6PcfvvtfPzjH+fv/u7vuPrqq/WOHTt0bJdujC4u+yMfGS7XVt20qfLpS69ds/jffvUYP3x0fO7aerRJSGQmzvdSRW54T2RqYmh3nBV5pZ7aEFDxD2Ol0yszsmteIHNtQaWv31X91cnqhVXLO6RhCINMp71Gwy08u2xDJo5Y4pRixiEYSBFuNkZHv1ladT/bbvk1+cHHmT65kf7iehaVHubMNdfxlu13sqC6HWnwmjosi0s/U5TvjDqRfb9lOdf6dvqr6b32ofeYY+k65FDK0gejyiLqaqfloL3pOuUo0l3TbjGd5KWChdj0TG2/e+2Y7sqkbdPalsWIyhiqRsJskGtUmJPN0eKm0WYSz8ximR2EGzwhfKMUV+yg+mAZ/WiId1+RslyXH5qkMWlTNaX1toWlFQnfEOKcINAZdJgjIeQ71TAlrKOSRej3SB9TwN1XE8l5udNguKeDtTOWcH/P/qxqO4DH0nuxOZjJsLIpOiGR45OJGiTwiTLgpW20XLWXkyS9BEaYAPFKx3HaShIaNqE2kCLo8QbFDVWCwZBk1cGJCTkGCeWSKLtUN2nWPBpx53gXdzt78nDhMDZk3sTjtb3YUGphtAGG4UibIrAilC0i5DzSdTyrhJ8ZJ8zJnoW7VdpXoTQxSTBRpwULw9N41MXDWyEw6uSE+KdGYKTRyV3eAn4yvjffDQ7iq/ahfCk4kO8Ul3JPaTfGVTfaMnGljCAr/ZQUccRLb2H7Jra0o7ExxBpySJZSUDaxpM11I8cOoUab12/m0ZtvZvyem2VUPoIVjiG9hCV2mwkL5VigwdAGM6bP5Nx3votPfuJf+dCHLmTe/N0uzuQyl9A8XgICzaxNBJoINBFoItBEoIlAE4E/LgSMP67mvDataWlpPWpGf/9xBx96GOe++zz+8sN/yUEHHiTEqw0li3tbSJjWmliiKKJUKsUf3Z76CPdXv/pVPv/5z8eEWo8XJ1eFQbS0WA9Zu3WCx4ZqPPj4CGs2jjAw4Ylvjf5Xs0W7Qip31h8T+fUYl60sej96qBSu21QPL6sZRnZn+s5Qqfh7h7Eoj5qdaSU5mCO5ujQwzNaH1uAP7yDte7T4DVrrFdorRWbtGKZt82bSO0ZJwToz3KntGWEaoVz2QMN1x6Jk0tOdXcdl91tK18kn0HXu6RTOeRut55xC9tSjcJYtwUy4J8ebBc/Q8pyXonqsLWmNLZ/XwZ7dSeZlAuZnQpZNy7KsL0dbIkL7dQI/QIUG45tKVLfWYFzIVsnCrSewiibe9gaTG4v4RZ+aSlIzs3gqQyDiqxQBCTSOEDRbSJ+UFb9pZIU0WsFfmCXaP41xdBv+W3oYPGg6j8yZzfr2hexIzJOyM6TuNlCGFAyF6gY4OsQUEYVEpkIrhSX2GZKKeKcjnSDSKZR2MSNbeK6J6UM4UcWbCMBzhDzmRF9evMA50kGeZCB2VBMM7/AZixyKiRSldJJixmV7wmA4bFCR/jNMxHoPLeRZFEvdcceJThVInFRieiijCmaJWq2G1wjl2pR22HiGRcPQQugDDMMn8iqsDnu5w5/H2mqebYHBFlweMTq5i9n81u9js9uFZ0ZYagzLKFJ1XRliNoHoUTQwgwq1wTGiyTpW3G6rg2E/wz1jEbcM1blvuMrGkQmKk5N4XhWtQhxHCTYBKgpwTZPenl6OP/4EPvTnH+Kd7zyXgw8+mDlz5sgwynyG5vGnh0CzxU0Emgg0EWgi0ESgiUATgachYDztvHm6iwgIKS6Yprlu+vTpbQcccMBx73nPezjnnHM49thj2Wuvvcjn81iWeNgMQ4iBgVJqikgPDg4Sfx/6yiuv5Fvf+hbX/eyXPLx2w9mlcp3QC0mLB84OQ/EM+uKd3EVjXoNsk563rDheLf18qMH3Nkzw0/XDrNg+dvaYYb7/BT9enkyOKaU8kbI3WaE4NIoRaMxQ4UQGyUCRqkNCPLBqrIGSDQO3FnlJk5XP1SyhYZkgSVsAPR44iXT6ejV9+pL0gftfUzhdSPM7307i7SdgHrr/oO7ruVjl80953GPyz4scbY5xzgHT85wwr40T52R565wMJ+5WYM92m1bLX69C6adGnaBSZnK4jFcOpR0Otk5iR0ncKAE1RW20RlCsoP1I+t1AYz0p5pQFho4wYsIrsZFShMoktGyirEM0U2Qfl+DAJJV90kz2p6klXWzBrMvzWBDVaBWy6ApttaIQK9KCaYQhoYwyUJrIkHoNGUeGklwOxMQ5tESHgRMorEDSG4EQcS0WxHVLfVZqqj8SUo+FIfFSTAdCUhuYRhVllEVNlXKyjiek2FBCjqWOUMJIyH9kii4VIaVQsnEkZqDkSgCAqI5phiDk3lMmvpEkUAlpt41YgacCfMdnnTWdR5jNZJSRMtLDsvFUs7Jsd3t4SHeyzSlQsxRKVcGsU3cc6pZJKO1VQp7RRbRfpKEbjKJY6zvcWoJfjNW5acJndd1kBy51wyFQFmKRtFOwU4ruQivL9l7K6W9/O+effz5nnXUWQpxVZ2enipvRlCYCf6gINO1uItBEoIlAE4EmAk0EXjkEjFdO1Z+OJqXUWCKRWB+HqVRqRVdXl5IFt/rYxz7GBz/4QRYvXkx3dzeJRILY8+wJ6XFkoS/58X2fLVu28KUvfYm//4f/xze/8W22bdhIe8pkWsZit64WFkxro7tVyAWMvt6oykaBM1oO7nxoww7+Z+UwX71/K1fd8yjX3vswQ43g/XXofz4bpb3lnWnpRIp8pgWNie/5aCHRdmTihiaoBI6Tw1ZJqKv+glKbeY4jgJg0z21AYWce182u9pOZy8c6e6/c1DWNrfkOxpOtt5STiSt3qhjWutuSMjuvnx5KWvzjaY4Skt9hmrf0OcHeJ85rO+oDy6af84H9e447tj9zaGcQXJ/W4QpL7pYoDKlNjBNWPSGtBpZ4d43AQTcMzMDGDkyMekRYrJJqjJL1xZseTAqxLotUSUTVqdAWQmkQCrk10drB8m3SVY2tG/gM4zlbSRSG6S2M0m88zvzGKvZrPMiJrGaa4ZHSCBHWCH9FCUmPualwasFXo4XE6jhBImLmp7TCisAOtdQTiJ0htmvj2gZaaquGDRpWiGkOY4iExijaLtHWqmkxSmS8cZJeiWQUyGYB5BMuGSmvI0/yaQIzEgIr3mapVxqDIeTZ0Ah9VSDv2tcUZDxnWxIE0ucImVehgxG5RIJfVcZE1Jqjkuml7M4gsLpRRkGwyROpFiKzhYaRoSre5IaRlLpSUo0j7TCwxUPthIa0T4G0RuUMRpOau+sVrh4Y4Ovjo/ym4bNWm4woh4aVQFsu0lDJHREZEdN6uzjy8EP4yw9fyD//0yf6Tz75ZCX3rxKFzVcTgSYCrz8CTQuaCDQRaCLQRKCJwBsGAeMNY8kfqCFKiPRO08VLddyJJ5449rWvfY1PfepTHHLIIUJITGICHX9sNSbOkh/LsojPh4dGuOYb3+ETf/t3/PJb/8sJe2b44LGzOXGvdqYluNgCZ6fu1ysUe71G6DMwWqTsJ/DsPFVsxssVfPEMGoEwx10wrrVnGr1LFtPIpajnMlSSCSqWTc20GUklMWb24/b2ogrJW55PXa9St0xX6po41GO6T482FlclHCrbP/rVo9XzLrnmHi753r18+77B03Z46S/u1NOp1OBOsr0zbmcoafF3w734Wtpa7lTOSqnjhkLVX5Or+oOdtrqlPZs93Q6ijCEe5ESulfZCixBPGyXeYy1eZGUYxCJ8EXH2krAVlmnh+OM43hC2EGgrKIrHtyhkb1JEwqiMJUQ5LqNxhAg6JMcCUhWLljJ0FceZU13NW9tW8oG5t/OXc3/Dh3p+ytmJq+kJRnHqGtNTqJiwC6m0IwtTvPkIUQ7RQjAjUB6mqgkhr2DomtjbEH7pgwmGbNLkOmyctEdkFyE1QT0xQSlRoZHxyHTAvvOzHDXdYLk9xNyJh5i74wHelBhjn1aHHukzFfiYtkFghPgqQhuamI5LIPVJ9Roiqcz3M+Q6+8m2daGjCCdqkPBquHF5ZRIkM6iZ8+kr+MxQw6hGRGS0Q5gnVfeYVhtkL2OYWWGJXJSS+HZUJU3nZIOOkiJdTQt+7WJHN6vrDt8bKPO/gzv4eVDmPtG/TVmUxDIPOQLBQDYLFB6FtjxvOuoIvvw/X+af/vmTHH7YUSuSUTSVrV6vz5XczVcTgSYCTQReAQSaKpoINBFoItBE4I8FAeOPpSFvhHak0+nr2+To6+tTMXG+sdwb8AAAEABJREFU+OKLiX9t+8gjjxTPqjNlohavXEymDSFcgR8wMTrKlocf4qFf/ICvf/xj/Ojzn2f9irtIB+EU4fPL5SO9anXZVOHX4U3sddyUu37GjA7axfWab9SYJuGSrna6bXN90go37YpZulA4KrP7YvqPO4byrGlsy2cYzufxZs4id9LRtL75UJLzZ+6KKsSmDEHQj1YZTwcXPTxQKXz3rq3cOZLijmI7129L89NHotOersyrVJbqkaFvNu5ZqTd99wf60auu1iO336m9sdGnSPbT86fTzspY4jilVFk56asCK4NnJHHE81rosjDSESVdoWxMUHUqVKwafjLCaUuT7+5mR3IBDwe7cV+lnwcr09kSdkveApGZFCIbYQpPs7SHUnVCt041HxA4KQyjjQxZeqIyM8PbWWj9mMWpnzAvfTO9zmrM0Qkm1k6w7e5Btq8YpPp4EYREWuLJtWRjQ4vRgRD7SFcxogmpa4JIyGJo24SJDL6TxA8i8gun0bVXJ/kZGs+aYMRJM5kvYM2cTu/us5je6nNEZhvn5x/hIy33cqHza96jf8I+3nrEVFIqQehF0g2mEGcRIe6GiDiiMcQIORUSrylbmqhgkp2XpnvvLLnZNXKdJVp7a3QucJi2rBd3YY7d2x7iTbnb2L9jIz3Gdvr9NezDSo5KiqTuZ2awRrztYwShIgodTL+BGM5ENc8t6xP8zVe38JV7q/xmxOeRIGRQBVQtn8D20aYnNtVlA6NByoFTTz2BT3zqn/nLv/orFu+1L109/UtyLR3LVSYzKPCRSCTWx2FTmgg0EWgi0EQAaILQRKCJQBOBJgJTCBhT7823VxyBadOmqSOOOKLtjDPOmPoO5bnnnsu+++5LoVAQcvQE7IZS4g+LiGqTTDy+htt/9AOu/8bX+dGVX+XH377qm/esuF2Xy+O/NsP6Xro6+bIJtG6UFuvG6GKth7uFeAp1ICagzs5zXuBQSnlJ17pkzrRWjp+b5m3zWzhpUTdHzJ9Oh6nOz9EYi/81lejOvIAa7EzmBquv78r2Nx9F+oTjSL31BDJvPYn8W0+m9eS3kFy6u+dM62l7IR1PpdVqBdyq57m6XFLRSZtqPvcOVdmRmMaQ28XDfoL7JkMmtS7EZWLs1PD2+8Zvv/3soZ/9lOGf/JiRn/6YoZ/9hIHrf/L+HWse0bVi7bw47/OK494QGuJ5F3LqGYpsfwvZ2VnMHgO/UKHWUsJvDzD7MiRmd+Hnc1xvHM5Xg5P5X+84vls/lBu8paxVuzFhdhN/51fpACuqYaqyELwSlWyDhuMSqXbsqIO8tKO7MUpP/XE6G9vJ1KpUBzzGHy4yuaZI5REps2aSUZGxx0o0doi+0EYUoJUCI0AbDUIhkRUrxXZaeTTq5GHdw+O6jfK0fiGt02hZkiWzGFJCpJN795Je0k62zyGtB+kbf4i9t9zJoY/ewuEP38a+K28mt3IV3roRDMHYlPoMwQRtTtVrRgaWVkJUARURmj6N5ATl3CTeLI25Xx5j/wzOsgypfRJk91DkFvnYfWP0uQ9xkHUbJ+du57TEzZyZuoW3Ze/kyOx9LE48TIvahK3HMEwPkgZjKG7b2OA7d5X4n1vG+da9k9yyLWBTTVEVG8QiErKJoJT0iwPx8HrHScfyZ2efxrvPOo2TTj6BIw45VCXaCm2u666meTQRaCLQRKCJwB8tAs2GNRFoItBE4JVAwHgllDR1PD8CPT0988466ywV/6uqd73rXVMf5Z43bx6yWMewTAwDTCFRpl/DaJQYfHQV1333G3zy//0DX//aV7l75b0MjQ190Q+8056/lmenjFeCk8bL3nnlsu4OItX9fzlGCk8Q3WKmSDHzf/HPf9ZjWdcszDruu/fIX3XhITM2n7ts7hUHzu1pK9j2LZArPyEdwmieX0ecYrZ1n28u2f2S7jPe4c16/wX0v+8Cus4454bUPkuPcrr6XfW0j8DH+Z9LYsJfS9alSmGVGY9aUjte0sHOZXHyrRiuiUqGWK36qeLhZOm68tqH2fKj7zN83Y8x7r0D98F7Kd9wHRv/98tsu+lWyluHvvpUgec8yZWVkDUtpKyiIxzZTMgLyWzdK0NykYExN8RemCC5eyfm/B62m4pvBYfxhegdfM04nW/p47i2tg/3RgsYtKbRMDNoqcfQnhBN6XtVIxKiG8V1REkMP0eikaet0ULrZI7cWDvW9h6G7k0x+oCHtzHEGTFwd0BpncfAA2NMbCyj6jKgfAPTMFEioWFTM/NsM3q5qz6D68uz+Gl9Ab9Wi1nlzGS8qwdH2tFxUILeI1J0HCxtWBgRpUfQjS1E6x5C33wX9vUryf5qE9YvhqjcuJWxu7dSfnwCJ0iiAgdhyRiRSUyejYi4FWj1BHk2nDEmk0U2FTSP9Bd4ePd5bDpgAaN791GbkyAs7MDIPU7G38S8iVW8ZfJXvLf8I94b/ZqTjLvZ3VhH3hzFtDzR2aAe1the87hlOOIrd03y6eu38o3btjOsTIraxMfAEkmEBimxLd3axfTdFnLEMcfwj5f8Lf/yj//Am4887PJ0OnFc/J33/C6MO5pHE4EmAk0Emgg0EXh9EWjW3kSgicAbAAHjDWDDH60JjUajEEVRW9zAzs5OJeT5nM9+9rPEPyzW19eHkUzRwKQhhExeWNIbjhXnDtk2MMgXvvoN3nfhh/nqt77LSLn6kThlV2R1pK++aaL0oxuHi1/dZIYrxxPpTcptW61U5+CTUlYqP5YX2RV9cR6llDffUef0KvvIvGtespNwxPE7Jc73YqIyvZ9Umba9jY7O5Uaus0119RyF5ax7sXI70+O6QuysR7S4hn9wwuGauZ0Zjl04g7n1SWZWB9g/M8nRswRMKRST7croYGFw1X0M3Xc7reMD9Dcm6auO0LFjC50jmxj87Q0M3n8venLybK2HM1pPFqToM15j80wtvSVkt2yYhG6A2avILk3Td2QHs9/cQ8fhvThLClRbbTYJgxwXD3M9MZ9qaiGDyd143GtlKEhTJineYCGcykILuTW1S7qeoKvokKsHOFEFpSqgQTWENE/0YQ70wHoXHpgkX8qRKeexx5JYY1Km4VAf0ExsqlPdUUeFBkakiEKTepRn3JrF3cUZ/GTHXL49thffKB3AlRN78uP6PB50ZjCZz0OyRpR4CD/5IF7ycRqJcULDZ/TRSWqPNHAHk9g7ZGNgYgbJ8RaiTR4D940QTICumZihi20kpV4DJXWjtZgfSmJE3rco+S3cXOnls2Pz+OuJ/fjnyf25OtyXRxKLCZKtQsJLWBMhxupJrJ/eR/Y7vyT5/d/i3LIGZ3MVSzzmodVNWbVx1+Pwqe9s4y/+Zzvfu6fMpokIIhPE40wYoaMQT+ovqwQlKbPwuHdywb9+jks+8zl22/8glcl39zjp7ovSVv56i/pSmkcTgSYCTQSaCDQRaCLwGiDQrKKJwB8+AsYffhPeuC2IvzcZ/xr3TgszmcxVHR0dyw866CAuu+wyIcZ/yR7LD8HJFYgME6EaBMIDvAAagcI3XAZGSlz5re9x4Uf+mv/4j//Qq1at0qVS6cKdOp8Zlmu1s79+76bTvnT3Y/zvfWu56u6Hux+v+eu2an3aM/O+0HVMIp+Z7nmVpTmXwZ3E+Znpu3I9qetza06yVLETm1Q+PxaXUaqwOQ53VbIqu9rBXp/GW99uNK7ZO2tccsHCFv7lwGn8+6Gz+f8WtXJAsroyB2UYcbzKOPXRAeQE1yuSFMkGZVrDEunaGP6WdTQGxIRa+aM0rEM8jJ6y1t2xVzIm37EQNvaywpoQ2wZR/N1hU0iaK+eZCn5mnHp2gkamRDVRp5TQIjY573FaiivJlVYzI9jMNEZo0xOkdRVTB2ghzw0jLZyvFS9qR/kFAiuilN7BaOt2RgojQmwj/KxNYJbxgs0Yxghm3RCvdI502EoqzGM3ksReVi3e2OpEDddyMZSBFpJep42xaBprSt2sN/ZiS/ZwtmQO57HEgdzjzWJN2M2o0wapLFbYg/KmC+meLuNQ4ncoKo2QhqFoJFwqGYfRjEvVM1BFsKowsWWMyDMxcIh/VVsJcVZPdqRGobWNXephaKCPe3fsy2+DU7k7eR4/N/6M60pv5d7RfWnUFxIOpanebohXO0f04Exym2eT2thC5T6fbbeVGZIev+9OiyuvqfCF703wm5V1hocNgmoCw0th+w4ZuYMSWu4iWxMWMhgLF5A/8VQmZx/AnTvSXHf/COu21XRVOT3IIf2aMVEDZV3ulsvmq4lAE4EmAk0Emgg0EWgi8MIINFP/5BEw/uQReI0BSKVSK3p7e5UQ6ONOP/Vk3nveuzjzjHewePfdcVIZtGmjlUHsPVNRgF+vsWXDJm757S185zvf4fOf/zw/+MEPLnvwwQf1c5FopdTYmkl4cBxW7QhYta3MWC3CD1j8UpoqHuryM/PbdmWd6H9W/DPzvdC1CnTPSCP60b3D/sB3N47q728t6u3F6s3xx8ufXm5M675hXT92h64dOal14elpQnocKKyzMFakVH5Ft2t/cmmXo/bvz1xy0Kz8BUvbs8s7jMTJwu8y0IGAiiGbEa4HCRFbxPI1TqixxEPpBYJzGD5RRRRkjHrYbVBzXHBqtVq355XnRZG3VAg0llcj5zdQKiCwIDJNebMw5U+pEFOVyUZjzI8m2dseYrExxFx/iEXV7RxiTLAoGiUflPCl3KSdpaESUt5AIX0kxNkXdYFpSLqiYYfU3Bqe25iqS2sHFSSw/AyeEPhyRlNPKtJ+iva6Tcb3iVSFwAnRYRbDF5H89dBm1MgzkuxkMtNNLdVB1Wil5rtEUqEZGOCD7AcQn3qWBZGLMWSRHk9hNXJCoLM0nASOkNNIhXF2aAg9HqlglxtCXhsYugJWmcgQgLWB6aWF6OeouhGP1mfwsLeQgWQvE0nNkJrO6mAO9wthH5CNo4p4k/U6RXKrT36iTOB7jEl7N9Vc7t4YcNWNw3zl16N8f0WRux6rMTweEEo1KgilH33cyMeR+6Wns4Nlhx/J8tPeScebT8ff93AGWudzXyXDdZvK/GDVRrbUg/viMRSP5RzFQaHtv9eYpnk0EWgi0ESgiUATgSYCTQT+QBBomvn7IWD8fsWbpV8uAul0+vplS/doO/2kE8beJwT6He94B4cefjiz584ll8uJJ09jCjswhRSYYUBlYoL777+fb37zm/zP//wP11xzDXfcccdlGzdujEn0pUIGCrGkE4nr27I5CuksLYk0rckMCa1wNJterq07yz0Xod6Ztivhzo9Drx0qL/3Fuh1ctWYHX390kjuHJw/Z4dfXxf92Sk/qKaIcRpXTKrXadcXRyV+XN20cnVz1uJ58fJsujY7/utFo9Anx8Z5pT2fO/GQh7VyRclJCqlObG+BIvrKTzpMu9GC7ObSRwjeSQgaT1E0RK0midxqJri4ix/1xoJwxX5sFcTIvM+tTH+ntMQy/QKQzIH1CRL5RRzg7tLAAABAASURBVOlASKIh0Q7KT+IESSGfCjuq0xJMskDkoOwDHNa2koNbHuHQ1DqOSG9gobGBvB4kMOtUbUWgfOnrspDuSQK7ilZK+j2F42VwhNyaUQNNBYQQG4kEynKEKAZEVoVyukw1VcPQFonIIeGaGHnJbdcJhHiakS39HmIbNVLJgIRdxdWjpMMB2oIBZqgxuimSDioQeChVI7Bq+GYDrSOSNYtMJYHpJ2goR9I0iUYFFwVGAt+zpJyLFsattUYZgcTXiUyfUCl8scGTcvX0BGO6lZIQZUwbzFEgpGbYTJoR1XAM/3GfYNwUXCPJUmTYKbPK1NzjK3473OA79wzygwdGuX+wxngjJJL6xEgMAmwzpDWbYuH8+bz5LcdyytnncfAp7yK31+FUu+YwlmhnC2nur0b8ZO0m1pdrjIbesWIE8RiKJT5vShOBJgJNBJoINBFoItBEoInAGx6B19VA43Wt/U+8ciVe4jY5li1bpv72b/+27VOf+hRnnnkmCxcuJCbQlmVhi4cxhikQ76jneVQqFW677TY+97nPEf8I2U9+8hM2b978sXK5fGmcL5bjel1Ome5w4swMJy7qZG7W+OQ0R10Zp72eolR+rG4lWPHoEHesHeWex+vcJl7EH25exwNBKTPWyjyVV2O6XO5ur1a9zi2bSN15J94Pr2P8uz+g+OvfEjzy2JF2sXqRrlb7XqwtnUoNxnnSHd2DrYsXYc6bzURHG+MteSZaWhnJtzGSKdB34DKm7bUYw0lcVk3kN20zk+etCayrV3nmr7faiY8UVaI7MO0xI+FipxOxyl2S3XPf4i29n+dtc7/HqQtuYY/2W+lI3E/SWE+CbcLshzDNMZQ5gTJKTxDBEBK+Rabhkq855GqQ9Mu47jhO9zjmjAkpv4GUvw03Gge7wrjdYDxv4/W0Yna3UFc1QqsMbgUnUaHgTrDEHWCpt5pF47czd+RG9vNuY3lyLbOS2yTPOGHKQxsKIkUURgRKSGmLiZdp0EiUCe2ikOJJcTaPkxFSn20UqEZpih19FPPdVBNt+GYLKkiLDouaEzDaUmW4vYQbFukLG8yoKfFkZzAa0zCltT3WGPP1ANPHxkhvhzHxlm/MtvF4pp1VRpYbx3x+uXmSO7YVGaiFVAMIxT6tDbSU94VAm26KbKGTRXvszfsuuIi/v/RfOOHk0yh09FCcrAm/dlCOSegaVAxET41txToTDfUvNI8mAk0Emgg0EWgi0ESgiUATgSYCLwEBWU6+hNzPl7UZ/3sjoIRIz5kzZ9773vc+/vmf/5kPfvCD9Pf3T5HnmDiHYShEy8QwDPGWKYQs88ADD/Cv//qvfPSjH+Xb3/72hZs2bRqV+O7D2hIXn7+od/P5e/UPHjY9f3Gfa1/yexv4CinwQrrLgaIeufiI9zI0CAKfqng6S4TvHwsqx6Lqy/SqtZd53/oh3uVXYH7rGxg//Q7lb36NsW99h+Itt10YlCZ/VN0FAh2bbaayp2f3WELfuWdRPWB/ts2dw+ZpfUzMW8y0086l78g34fRP27zZNb74YCNYd8WDA8f+vxvX88lbNvOdtaXT1jXMq0vK7atFUPFrscpdkpnjmr1HaizduoOu+7ejb5+kfnuA/0ACa0s36eJcXK8fQ3eCSgkdDMR7HWEFYPsGTkOkijBGTZQxEKaLeXgH0fwMXsEWz7Vm0opo9EJ2n+mkF/QSZiwhvh7K8ogiKdwYp7U+wEH2IO/KbeDilof4m5a7+GDLnbwlcS8z1MPipR5k0oFIKK0ZmZhKJOVg9yUJehWVbIWKuYPQnoCWgIY1BO52umcEdE43cVJSl1EX8h0RGRqtIjkPiGIPtOnhuYq5LeMckljL8tod9E7ezNz6r9hX/YJ97LtoM2uUzJk8luzhFiy+NTLO5zdu5qdjRR7wYFC7lEUiHMHKxFZgWwZuMsk+y5bzF3/1t3z6Pz/HW992Gu09bfOyKef8nGNg+VJCsDTCmmBRIVIeVsLCTScwbPPnNI8mAk0Emgg0EWgi0ESgiUATgSYCLwEB4yXk/aPO+kZoXCKRWN/V1aX22GOPFWecccYUiT7nnHPYfffdSafTxMR5p53xx2Tr9ToDAwPcfvvtfPnLX+af/umf+MY3vjFQfOzRT7dH9Vtm5BPzOlKJz8Q//uXp8aUNPbo4Pt+p4/UIxQk4uHtfJws7k8wS0rUwG/KWQi8LnRQFwmudoL5IV8uX7bj+51R+9UvMRx7AGn8M33ucxNijsPJ2Jn51HWx7bKmhJz49qetzX6wdKpe7xejqOid7wHKmn3Um/e99HzMv+CCzzn8fbW85kdSsmbcYqeSlIx4n3bx5gt9uqbBiRLFiEH61Zpx7t9YZrZtnoyxMpV6suqfSncockuvnoW7uYOJak/qtWWp3ZZm4I8mOWw3qj7gYE1lMPwWRhTBOKRuiVENEiC8NhPtRTHSy1pzJTWoRN3YexaP7H0f1iINJv2k3ug7qoP3gDvKLXFKFACdqkA0t7LqJWU/iVJJkxgJmlsdZ2tjIwdFqDjfuYz/rPmbzMIVoCCuMCKKckF4bU0s52dDQRERZj+weGVr3SpHuU0SZgGoeqotCjIMC2vYJSOdHSKshkuEYhi7jx6TdDMTbHNFaiWgrwgRJevObObr9V7y77Zuc1/Id3t3xY05pu5U9sxtpuCY3OW38eKzCT7cNctNkkYcig83KYcJO0XDShIK9oQzEgUxXWwsHHrAff/k3f8P7L/xz3nLiscxZNHt5S6q1P76Hem2u6s8JsZ7WRkdYES/+GDlvjGmmx/6zpzMj55KyjWtoHk0Emgg0EWgi0ESgiUATgSYCTQReAgLGS8jbzPoaIVAoFJYLYVannXaaisnzeeedx1vf+la6u7uxLIuYOD9dRkdHueeee6a+B/21r32Nr1/5P9x282/O3rZ5XanRKC2u4S72Q92NeO5e7vc7h7Ve+ko0v1OpW/ad3sqxuxV4+6Icpy/IcnhnL7Nt9+ROnGtdHTpRudJXe/hh2LqJRKOIaZSpOSVMIWjW8ON4j9xL47EHiSpjp0F1WUk3Fr+YbWai9Rq7Z342u/9+e3cdddTJPW95y3Fdh7ypJ7lkqTJbpx9l2ub9fgjbxuoMTTQoNSxKNZNtg1V2CPn0PQNLCykVUscuHlG1QHVDhuJ9ivoaG709QzSYxt9sUVnrMf7gDoKRCZRXFeIciVabyAgJrQqhPUnglqgmLbZaPdzuLeJ75YP5Lqfz7RnHcMfiZYztNZ/kHnmyu2kSnSVca4J0rU62niLablB9NKL8YIPavZOE928ls2UrXdVtdKtttKktZNQoicjH9dO49U4h7BaWkGdbyLPSIb5bx+3TFBYl6Nw9T+vCTlJ7zKJ66EIGD92N7fN6GcmkqNnioTYSBEJ2A8MiEpJrhwhp1WQrCoIcrdYWFqXv5E25WzgxcyvHZFazxBohmKhxw0MlrtlR4jc7xnhwYoKNQYNJG9ELvqmF1EcYRKQdiz13Xyj3wvGc9e5zefu57+TQY45eP2O32fNSKWcFDuKnRtqhvHktSU5c0ssxs/MckI84tAWOn9nKWxfPYE7GvaZbqRU0jyYCTQSaCDQRaCLQRKCJQBOBJgIvAYEmeX4JYL0eWQ844AB14YUXqr/927/lqKOOYtGiRbS0tEyZEhNopVRMFqakXC5z11138an//DSf/8oX+MVvfs3aTY+vqtSC//JJZHyELU2V3PW34Vpw3kO1oLSu6t833NBCVne97PPlXJB31WkLOtX7l/W1vWfvnnn9fXmVS7vXKqXKhpCuQDzqJoqk45BybUwVEUZCKoMKKpjEaIxT3fY4UaOMjqK+wPf3r1a9Zc9X3874cSg4TutKlW69VqXz16tMZjBOU0p5KVLrUkL6Ol2HNokshD4FHdBlG3S5FhnDICaERsAuH169xPjIdiZHt4un08dOaExHIS+cqs/k+q3UhrcQ1keFPPvEv6YdWhG+U8FLTNJIVqhmEjzmt3J7cR6/KB3ML2rHcYXag6udfh7ItFEpCK1MDIE5IB7kCZLlAGfYpvywz47bJxi+YYTRm3YwdOM2iqt34I1WiaJIqGggZNdAR0lsr4V0vV0c36aQVEO8xgZ2BJ7t4ydKuN0R7Yvb6Nl/Dq2H7svAvsfx2/638pPUodxk7cOD1h5stxdQM/tBt2OEKQkt8RYrNNAq7up0Y5JUNECLUWaaEWEXFds2JLnhdov//v4gP1+/jk3VIjVDEf8OWWQ0wKhDVBG86vS0Z9lj8QJOP/MdvO8vPswJ577rErtnxmDFdgfGI06SzZ1ulVFT/SlVMi+fVMct7tj7vINmc878Auct7ObP9p7DabPb1cyEfXqcpylNBJoINBFoItBEoIlAE4EmAk0EXgoCxkvJ3Mz7+iGwZMkS9dnPfvb6r4lnOfZC5/N5TNMklUphGAZCAKeuY0LtmfDzm27i4r//R87/wId44OF1y4qlxtVGLe281BY8Wgm++ov1E5lvPzDEuh31q4dr+ryXquPp+eOPjWs91qf15NwcI4Uc497O9DFd7RNn7zyEwDZSaTwnhSJBNkrR3bDIYBJaipqtSLa0ocyUEL7kGt9O31JO2quf/u+uRH+Bpx1FyAQ84Zl8WvRTp0qpcodrX3DgjDbeNCPNnokyezgljp6V56DZCdpTnC+cD0NbT5V5zpOnRU4EWymZmwiTQxipIarGEDXKRKFFws+Sqqfwh22CyYToTYIwzUAJeTYDGlaAb0mE5TAq3tvhWpay2QWuopxpZ4AkI0GAmYxQKSGaqoawVXTZxr9rgPLKScLNinQlT1vUKeRYkH60wvDqEvURm4buoEYeH8E4soV4K+qmFlKtcQIl9ilkp4LQ8YlsT3APKSZTrLZcfjCyL/+96Uz+a+QM/mXbwXxtdB/ure9Dg71JN+bh1LrQ4s2uWCajKZPcqCFxLTSCApN+F5POcVx7dx+X/q/HJ749wQNbNaFfkt6VoRCJDUGEsHqIAiwCZvV28Z5zzuJLX/0qZ7//Qzdk5yy69tGq8YlfbSl1/2pr7ZD7J7xPD2v9VRn7DnLoajy+hjOdSq08IKfUiUtntr1tz5lq9/aUkuRnveJyVRl7cfisxGZEE4EmAk0Emgg0EWgi0ESgiUATgScRMJ4Mm8EfAAKWZV01a9asi/78z/+cf//3f+fP/uzPsG0b13WnwrgJ6XQaQxlT3KNarLJ25So+9hd/zT//zd/x42u/t2l4cEQYWZwTqlXd90Ie20fHq/r2tVv46QPruXnTKD/97R08PrD9q0+UfnnvSnWWlSpsViq/Xs5FCptjTcNaZ0D1+5a92mlpu7bR28NQvoUthsNE4GLqHJN2jh1tXTRm74Y7dykq0bnCx/VKcNo4XLojydmiZy5yiP4xCZ565ZUa61Rq8KmI5zjpdcwrFubMi96+Vw8fOnouHzpmNqfu3cq0tHFoQje8CE1o2s9R8rmjwkioX91ANTRJ2eAIxJuT+TSMAAAQAElEQVTta4NQNgQiIc94Ql7rLQS6FWVnUCoQRdJ3OiHe2wyOlyZXt+gJG0zT22kLH4ZgA7nSo8yqbmJOYwfZepmykN0Jo4UqbQSlNMUtNZwK5EwH1zap1WrYQUListS3WexYJ6Tb7yASD7GvIgJbCL07Rt1pEKoIQoQ3K8EcsUmhhXL6ymTCzbBWJVnvZRmodzIRzsHz+6kPJZlcNcnorRsp3riO4B7xhG+KsMttQs2nEUYOVXc2D03O52s32nz0n2/h2z+5n/s21hkIOilG7ZiRgSXtNkW/gS3EGebOmcYHPvhuPv2f/85Z551P2+w5V23CPvInG0ZP+s+bH+Yb923nf+58nCtueoxr7hs4drXWPxrTuk+lCjK+Oss8ecR9/+TpcwayceKlVErKKGHvz5mlGdlEoIlAE4EmAk0Emgg0EWgi0EQAo4nBHw4C4hmbl81mL99nn33ajjvuuKl/a3XhhRdy4oknMnPmTCR9SkxhO2aosbwQPVnmgdvu4MYf/5jvitf6y1d8gWu+9129ZWiL9s3KIeJIfV7CUBY9A9WADUWPrbWQoVKVihcgBDXzSqMmxFbIjt6UtJLXqkTiorZDDiJ14DIas2Yxlm2h4uSotPdg7L6UwsFHYvbtRpjIfWagqK+7e1PpE9c+sPUj160d+PS6idq6YU8vfbn2TbeLVy1q10cdMN25ePl086J5LeHerZa1wiTwQkPjycbErupOOa20uC3klSXe3LoQUV885XWRKphV3GSI26owxCceyLUSP7AScq3E0276OZx6loTsDAg9ZbG7jd3c++mx72TvYA0Hild7UTCGW6sQGGkmnS6KqotaI0NxTPq+EaCiOoGqocWLbYlet+FiTzgwYmE2ckKQTfE0N/CdCfzkMI3Yw6y0EFeFKBVCq1DIoRSBaVM0U2wXkj9mQqSr5Bpl+opFejZtI7t6HcYDj6If3krlgSEm7h6jfl8d83GXNeUq331wmK/+dowf3lbhnhVb2b5xG+XaKJ4l9bsJ8WwrtHJJJdvZbf5i3nX+u3jf+8+XMX4ahx526C09fXMv8pPO9WsmfW7eWuX27R4PS1seLrrcPRhy66Yqq4scOxZGFwNi9P+95L7IxJ7l/4tpnjURaCLQRKCJQBOBJgJNBJoINBF46QgYL71Is8TrhYBhGCviupV4UXt6etS+++67/K/+6q8uf+9738vxxx/PnnvuSUtLC45pgR9gCNF1IjDDkB1DA/z2N7/mC5+/nM//92X87Bc/5aGHH/rmyI7h+4RcOLHeZ0rSdTb3tOWZ393G/EKW3WZNJ5/L8ATR5RU/CuL9S6jE+thz2H7AAR/vPv5Y8m8+GvPAA9H7LiNx0GF0HPlmeg49grCtc++S5RYeHqzy8wd3cPW9I3z3vmHu2l5lJNA/ernG+fjzMmGxO++P92fLI5c4I5vvi0bWNnRj/KvoOsJIiaKQ+NDIn5BNHUt8PhWpUNqckmymk2znTFTHDEatDDXTETLrCZmdwMztINNXId0fYLTUCCgJUQ0xhORagYPlJ6T/HHSjQZdTZPfsVg7OPcgR6Vs4Prmag53tzKQseTSmkSFUKXzl4sdeXk9u69DA9zW1EHTSIlIhKgJLPLx2ZIKEOrIJVIBnl/ASFanbkjwW0iq04YOUiYhEt0LUyXVAggDXHCejttBXX8fioYdZuHEN/Y+vo2XLVqyxEqWBGgMPF3l8xRhrbt3Bj1cN86VfP8K3b1zPg+uLRL7C1j6mmkSLLu2EkErQNXsW+x10MG8/9XT+8sMf4T3veg9777nfOY6d+KsgiA7xtVq8veyxuRQyoRP4Vp4wVaBoJNheDSVeUwqNs3nGUaGSkdb0TGpdeEbSG/iyaVoTgSYCTQSaCDQRaCLQRKCJwBsNAeONZlDTnudHIJ1OX//01FQqtSKbzV505JFHqr/7u79b/2//9m8cffTRFNraMWwHX3q3pAMaCio6ohx4jIyNccftd/HRj3yUf/unf+W3N/yG0eHRhhDoZ3mTF6bN/lPmFcp/t3w6/7hPF2ccsOiWfXoK7tNteDnn8XeTpT4n9mAPa+85vcRma8eluSOOUdMv+MA58/7+Y/R/7J+Z/5d/u2LGSW8/PTmvO1tLpTaN+Hzxrq2j3PjYDh712rl3JMkdWxVrxqI+0f2cemMCJWnPamvcjtgmIm8v6tX3q9EdF+q1j3T7t/6Wxp2/IXz8gUyyMkirUcdreAjTRRtaiGUoxDKWiEgL0JGFEbmYYRKdaWNs7lJW7/Fmbu45hMfsaUxGSUI3wJ5RIbN3JKF0UsJCC+kFC1tIrRNEmIEvuuvU3SJWeoTd8lt4W349f51ZxantDzBfyHTCijB0K8mGpqUyRC4YxnE9ItcitFqIjOkE9FIjSdn2KSUalDM1ai1FgkQRz8yKOHhWIHlT5ErtuEGKyJExkyrScEo0zICaEaFVnS5/iEPL61gYrBOt65lXe5QF21ezaGgTcybGKVQa1GsR5VSGrU6eGwc9/vOXa/jS1UM8uKpGZTIQQh8wKe0sizc+0AZGpHFkjLZ3Teek807jHz799/zTP12iFnTttqQtO1O5bsdVTiq/orUtdbqpjJWu8rCNKtqsE5kRWtcxdFniaqRsLYRcD/CMI6Myg3mVWpGXTadnJD11Gfd9LE9FNE9+fwSaGpoINBFoItBEoIlAE4EmAn9kCBh/ZO35k22OEOljly5duuJjH/sYl3/+85xx1llM6+/HdB1C00BbJpFhiGcyIvAjauU6t/32Nj7z75/mI3/1EX70ox+Vtm7dqp8OoJCJzDTTOGrPtsTJywvJC/qzzqFKCXt5eqZdPNd6+CnCmsmowViPsHBHrCu8kAqVL1ylpvcrNXOOUh3Tl6tU2zVKdZZz4JloL2mE4g1tEFWLuCoiKwQqJ2RQdG96Lr0xgXo+z3lsk+w4OHrlw4cMfukbrPvEf7HpS9/kkf/+Xx75ty8w+r8/xl21DddOCkkzEacsghFKcBUaJwRTizAVF2P8vSDD51J9fG3GUn65+2Fs3OdgrCP2pOOYfloOasOdl0UlpEwUEOiQquHRiDwhzRCZFtoQMm0nsMKQbKPG9HpRSOoAhWAYmxqRstFmBlMId8bRpIUcu/kGnYvaqApJDtU4OVWklSqu6UHCw203aevNYRk2afE8Z8MMqUYLajKNHWiUeKLDmJQagm6YQgV5CNMSatLhOH3CTY9y13N6+mGONB6mr/gIuXCSwLHYnszxQKKF743UuHLzONeMlLlLvOCT4mkOAoWKFIZghWOjZDw6Igtmz+SiP38PX/7CZbz73DOZO6vvCuRwMs46Cah61WXFRuWk+DxlsmJRIcUerQ4d/iTJ+iiZ6hDdusj8dMCiVkWLrT4T532pomRcx/JSyzXz/3Ej0GxdE4EmAk0Emgg0EWgi0ETg6QgYT79onv/hIpBIJNYXCoXls2fPVgcddBDnnX8+F3zgAxxx5JHiiW7DdhyEGQFCYpQSAh1QnJzkscce45e/+iWfF8J9xRVX8Ktf/UqPyoEcSqlyKuWsaHXdawtpZ4rUSPRLftX15NwGbrfWOiMihjyhIiayFuHqJ65e2ntsW8FWF+05rYXD53eytA2W9brs020xM+2R9nYc+9I0gl8rHmIMjF62/Re/pX7rvaQf2UB6/WayGwdJrtoCtz1K/Q7hdHUtZNLAlD9DCcmUinQsShMZkZDfEE9I8G9VD9cn53Fbx27c17+QNX39jMybQX1+N/60HF7aJDJDlBBnU0coQ4uY0kMOBilM1YLpp4XUJsUjbIto3DDA1BotOSIsImT7QVniYY4IrAa0hrTsnsWa1cDrGKOSGqVqlvGcOm6PiTu3i3LfIu5nFvdFfTwWzqMUzRFNSSKnjG9XiMkzOoHtt+J4BQmzmKGJFVVJ2xMsNddzjFrFcnsj7WoYzw1Ypwx+XYn47nCNn5dCVoj3/FENsktCHRMtRB/ZDFAIFw99Zkzv4uS3HsuFH3wvZ73jVJbtt+fmvu6uvVszmYskC0rIbMWrLK2b4V6hGRbiONvzsvMz7spjZnZy2qI+Dm2zOaIrxckLejhhYR/TLX1lnsYtcd6mNBFoIjCFQPOtiUATgSYCTQSaCDQReAURMF5BXU1VbxAE2tvb2w4++OC2t7/97bzzne/klFNOYffdd6etrQ3btmNiwtT/+o0iGo0GQ0ND3HTTTXz3u9/lG9/4Btdee23hvvvue4pE/z7Niv9lVIiVrZBwi9A94bN4vKKf+kh1mtB7ufp7bOOqvXqy3vGLuzhlSSsnLcqzf7dNt+N/XOnaU3W8mP6Y0McS1RofCddtpHLfGuwtg7TWquQaVTJ+g0RFzBwo0dg4jleSc09jagtLWaDjlyZSEZEREoiEhs92o5Ot5jSGnQ5Gci0MZROMtSYotySopS3qUjRUCLVUOKGBU1Uw6lPfVqO8qUZls080amHWUxhRQvQbNMSzHglRBSXViihFJEQ6kLBhRgQpH2uaJreHQ3JPB7XARc3O4O6WwRZ8xvu7uTsxl+97S7jGX8gv6rvzUH0hVTNH3anhiYRivxFZQtpTOELenSAhxNkE3QCrTk8wxPxokGnpOoFdY62MoRvLda4r1flVqcEqrRgwDUqWxpPNhCjeYFAWbiJJT08PBx24nFNOPZmz33kWJ55yEvOXLN7bSGcvbignI2Mkw5OHb0b7+0bQo83IqcsGjK11o0u5J+/fkb/i7Qum8Y75rZy+sJNTF/ZyaF/bVZ2Gd0VeJdY/WfypQGvtPP2TD08lNE+aCDQR+ANAoGliE4EmAk0Emgg0EXjjIGC8cUxpWvJyEKjX63OfWa5SqRxbq9XmzZo1S5155pnqH/7hH6ZI9IEHHkhfXx+O46CUkC4hzzGJNk0hRqLk8ccf5+qrr+af//mf+drXvsY999xT2LJliy6Xy2dL8kt+aV3uhoYXkNoUF54IovMfbTTuW+fX7nus0lg30aieRoMpr2Kc/jLE680E/cv7U3u/fZ/e849bXDhnXqu9PG2qFYZhrNsVffF3oMfw5hVp9FEpnlRf9ziZUpVMvSbksYIWclgzK0IuG3i2IV5Zh0alQSjkWUUmppBCQynBE2LyHKqQSLzJOJo2nabDs2lpeOSDEimjjCW6IrOGb/rE30mPhAgbMVEt29ibIhoPTDC+YpChW7cydPtWausqhKNCyoVlew4U4+80GwGKAANfvNbxucYwLbRl4sV63RItS7J0HdRL5yEzaT9kDm2HzSTYaxqP5Nu5ttjBt+p78q1gd75X3oPfFBex0ZhGxVIEUl6rWGeIJd5wK4pDMKWNkUJq1IhTHa9hMBTZrK1rfjk0yc+GJ7mj3mCLY1ASnAIhzYb2cZDypk0mnWbWzJkcddSR/M3f/A0fvvivOOCoY86npeP6TZXwvodHG1dvqHg3T9TCy+J+09VqnyJyTFRDoRwdqB7XdTcnk4xN88xL9uhIth2/e3v2zMUd6tDea1g2rAAAEABJREFUjJqdtM7Jq9SKuOwzpUhRCHnHM6OnroVYZ6pa903KfTSp9e8zFqf0Nd+aCDQRaCLwLASaEU0Emgg0EWgi8EeDgPFH05I/0YbEH9d+ZtMzmcxVqdT/EYlp06apd73rXZd/4hOf4KMf/Sj77LMP2WwWpRRCHgiCYCo0TXMq3L59O//7v//Lhz/8YS6//HJWr179zeci6c+s9+nXotepE81TqrM89fHsmpN5bLD60X//5Wr+4foVXPPIprlbqtHVKpF/lqfw6Xpe6Fwp5aVJj2UIRhOEg6YQNcRXa5rOSuzU9S9UdmdaSC2TJCw5Qb1fezWiWp1APKmREMjQCakmG1RbJWzVlLOamguWYaMjAx2KFmGUpmGCIVgqIZZEaENj2gYHM86RjY0sK69heeUhDjK3ModB8sEYdlQXPQYK0VU2CTf4VG+eZPw2j3CtgTtgYW4O2XrrRgbvfZzK0BiBHVKx66CkrKpiqjKmrmBFPkagxDvtCIlOomyLKJQ0s0wqG+Lm0jTSbexIdPGYNYOH1VwGEguZyM5nq7mQNf6erDWW0hDuqCMLLRQZYxLMUWmLiOgRJzuBmaVBgQHdz28ed/jM1ffzlfvL/HYiZANQNCCUsYRXx/ID3FCTEpzapf4T3nwM//B3H+VfPvkJDj3yiKMy3V09I5F56W2bx4/9t5/cxz9cczuX3fwwN24ZPXuooc9WqdRm1+B6adGtFsZvElZ2pVThSJ+XVV6N5aDcqVRZ4p56aT35nOQ3r/JjcbmnMj55EpPlLSGnrav6m9b5xrpN1WB0kx9+4snkZtBEoIlAE4EmAk8i0AyaCDQRaCLQROAJBGS5+8RJ8/2PGwEhyxdNnz798je96U1TnuXYGx2fSzxCLKYaH4eGYRCGIcVikU2bNvGDH/yAf/qnf+KTn/zkuvij3BMTE9dNZX7yTT+Pt67o15bWQkc8fqCHdXd1lKu3D4SsnKhwr9/gnnKFx0q1J7X8PsGIUNwwa+JlnDAUGuoKoUqXPc/OVnW1r6x195jW8a9vixf82fUEJMdMallbeY5KJTD751BKt1C0U1RNh4aQY7/hE4nNtniV0wmLZCqFLQTVMBRavLM7Nx+m8FMGCkQUh5kPcmb6Ls4qPMjb2h7hsPxGZplbyEY7cKMGpniTzdAmKkJtW0BFCLNqpDDqaaxKkmTJpnVSY2woE24Wr/VkQELc1UoHAmpD6qiKVDBFly1Rtu9g+klUmMQggbyhLQ+dEJydCpFdJbRrhE5D4jSRsH8/ivCVIjKkbL0Vx8vjKDlPRATOBEGqRN1tUMRiMmzj5ntLfOGnG/ivX27ip49WeKQeMYLYrzTxpxhUGIkNihQu09t6OOzAA/n433+UD/35+zns0IPp6ulWyWTyhlLI0pXby33Xry1yx2SKB/wubhjx+fmGIe7dPPpNUUlC5dfnVO6WrMquVkqVY4njYxHIMnH4dFFCkp9+/ULn8Zh4pO6P/mTb6Fe/sOJhPnPDSj7/m4f43r2bPnr3mK+Hg8Zp8Ue9Y0Ku9VjfC+lqpjURaCLQRKCJwBsegaaBTQSaCDQReEUQMF4RLU0lfxAICFG+aObMmW2HHnqoOvXUU3nve9/Lueeey7JlyxBvNUJOpgiQ1nqqPfH3oTdu3Mhvf/tbvvOd7/CFL3wh/k70sXfeeaeu1+tTHxeXPIWpzM94C2yzHIWWMxUd0mb4ZIwIPCVEyzGpOxaBaU4l/35vqYwV6IIbRGPJIPCsYvm0+lj5YlUzDraq9WPNoDQvIOj3CZcNaz1l89Pri72XmrCvrthrWJusbMCW1ukMZnsZtwuEKoPdMEk3FDkcssk0ViaBshRaRUz9CV4KhaENjCdDJbpmGA+wOHkre+bvYXH+YaYnN5IzRrB1VbzGUiIwhUA7BCVNcdxj0k/QsFJ4RoIwtHElPVeD5EiIOaBROxLkgk6UyopdltQdIkwbpRtYQlqtwMIMxLZQRIsOw8KzPCHLozjmdlqMbUxztjIrtYkOYwO5cJD2aBs93mMUdqzD2hZhCZE1vSRRoKmrgIoN22ohK9aV+M71A/zwhlF+uWKYu9ePs0XsFm4v3mhk3GjMSONi09PRz+GHn8DZ53+Qs977Pk484XiW7r7k8s7e3ixPHnWTvo3jFVaN1Bmy2xl3e9iuMqwtejw6MIaMwcyTWZ8VxMS3Cj3PSngJEeNRdP5DE2V+8PAmbhgo85vBBjdsqXCTtOuOx0bYUQ2uruEuxguknsB7CaqbWZsINBFoItBEoInAq4BAU2UTgSYCbwQEjDeCEU0bXjsElFLCPXQh/j70GWecof7iL/6Cc845hyOOOAKJQ7yCQtxCDEOIoIjkp1arsX79ev7nf/6H//zP/+TrX/86t91227pHHnlE+75/0XNZX8BZhzIHp9JMRrMpLu1rt9hnegt7d7exqKOV7mx6Kvn3eathOEbDO9gZ3/Fr79E115Xvu/uyyt0rPla+774vho888kVzbPRmt1HdyyQUsknbc9WlQsMZ9Y1L7xd36A+2l7mvfR5ruxYxWJiP3bOIfOccCr3zaJkxl2TPNHANIiMgVAExgVaGYupPK4zIFBIZi4VlbcR1V5F015J0NmOYOyR/TcoqEVcIp4OKLEIvpC7e7YplUpeNhZql8U3pA/Hm2kLbnLoFJSHVxXaCYC41eqmpPJ5yiFQEqgFIfs1U/WgLjUkk7yFVCUewxdvdEY2zxBziiMRajmrczkGjd3HA4M3stelG2u+/j+ihYWrr6tQHFI1SkvFqitXbLG5a7fGDm0f44ncf4Tf3Vtg66BM0AtkoQEgu0g6wDIu2fIG999ybN7/5BN753g9y3v93Mce+8+yenq6eHssxr6dWXCyGTr0MGIv/PVddbPRsaYeTQttpaYWF5wdUq/48IdDOVOZnvAXgKPzf+eX2Z2R50csi6uzHSlVuf3yAbUGSMaeTQdp4dMLg9kcHGaz41ENzrtRUAtd7psLYI/3MuOZ1E4EmAk0Emgg0EWgi8AIINJOaCPwRICBr2D+CVjSbsMsIVKvVZUoI9M4C06ZNm/eOd7yDH/7wh+rDH/4wixYtQtIxhDjbtj11jhyJRALHcdgonuj//u//Ji7zX//1X2zYsOFCSX7WS3R47Y6a+gEn1akGU93q8oPmpN2PH737Df922FLvvDnTrlyUdfqfVfAlRqRUarNZqnyictcK7r3s09zxL3/P3Zf+FQ/9/V8x8B9foHHXfaQmxy7rwrlBBvvoc6l3rfZrN5cd59ejET91Ovl550JunbUfm/c+mvTxZ9Pz9nfTfv77SL7zTKKD9iXwK4TKJ1Ih2tBTWMV6DfE8mzF5Di1M8RybtoL417GNSPIrtDjiQzuBZ6aE/GYkTEi8ZBGynLYjkmEdS5cxVEn0VvDNGqFrUXPSlJ1uRs3ZPOTNYlN9GjuiHspGK4ESomxGRJZPaIoIqY+MkNDwsf0SqcooiXIRammSlQ4WeyneFQ7z2R3X8ak7v8QHfvk5Drz+h7g/HaF0+0Y23rCGrfeOUZmcxtah6XzpO3U+87Ud/Oi2EgOeoqRySGW4QnCdSNoeySWKVDbLfgcs578+dzn/8Z+fuOLtbztCuZ2JnoZHm8pkBq10/nqVyk+NB+RIwsrprWmmFyyC8ja0WUFVynRisbCnC8fwCgRDh9T15FzJ/juvTqXWdytnRTzGfifhJVxorQuhbHb4snlRl02TyE8Klq2MR1keHfMZ8aCunAyYZXx/3rNUP1fcszI1I5oINBFoItBEoIlAE4E/JgSabWkiYDQh+NNC4Ok/JBa33HXdMZGL4vO3vvWtfOpTn+Jf/uVf6O9/gtdGUYSQFOr1Op7niZcxwjRN8QxW439pRey5vvzyy7WQaB3reKZM6slCMSieNKnrc0WPtwcct6jIof01Li0otfmZ+V/qtT86fun4I+t45MfXklr7AHMGHmWPkcdYMvgY6RWrqP70NzQeWC3e3YkjY9L1TP1CopxYokSKensnQ5le1vQv4p7F+7D2sEPxzj4B/+3H4x29nE0L2rk/XSEQYmomLXAg1AGRDlHS+pg8G0LGzCkxUONpUqMdtBZnkKvMwCr3YnjTCKJOKlGGuhDpmpBmI6UpJGBGaZLeYpFOr0KamhBgj2LaZmMuy73Zdn7mtHP5uMmNmww2TGYomW3UE1lqpqZhBlMf0fbtOr5dE6kykc6xvTCHre0zGculqUqeKBonqm1l47qHqYyEpBs2M8KQedU6Xb4Wgm3w+MpJvvblNXz68+u488EKg0WHUpjHF7Jejhxpr4GpFJEQd1Kt7HXoMXzwox/j7z7xSeYumX9VImVcob0dy1qDrRdkePzftdaC1P8hr/VwxvKrRy7pSfGWPbrYf2aaLmuUA6cXZHDMZN8ZyRuMaOy0UNVOq0fVC0Z19TSePGJdulrt0/Vnk+onszwrmNDlI6t6ctnTExKGuiVt2WRSORw3j/KExDdMAruF/PR5JFJptBE5HkYPdrT66WWnznXwnN+hn0prvjURaCLQRKCJQBOBJgJNBN6YCDSt+j0RMH7P8s3if+AIKPFCZ7PZy+NmdHd3q7333vu4U089lb/6q7/i3e9+N3vssQexB1pICzFpNsQjHUt8PTQ0xF133cVVV13FZz/7Wa644gq9bt06XSqVLo31xWJ51iFmZG42g6D/Sa+3l8+rFanUyyPOMSnzaxNHxrr1ZH1ufeOWj03efxeNtXfhlrdhhQ1cL0tusg2rso3JR1Yw/sh9NIa3/Sgu80xRSnkS5/S4xjVHFBzOmZ3gxOmaoxcV2H33fuxpPYfq7pn9Vq7zAjuZwLI8anZDiGSAFs+lKR5mO3CxQ0mLbAxDo20P3yqhxXlaNPMMZiNKiaoQeCHZnoiui0d5nCAxQmQXUXlD6slh97qESfBDYeL1CCsIQepz+voZ6tyHWziEW9VJ/NA+luv1claF86kbXZiBlA99rMjD1L5IgCWkPhEpUmEKJ2wVkp/CJyASYm6Olkium6RzcAfdlYiMylNNpLnJ6Ob7pSzf3Rpw7boJ7txYZrCsqQdClGUTxTRBUceROgrZFhYt3Z93f/gvOObMd7PkwKPpnbFoRUsmd4Ht6QFPq7JvuKMVM+k9iTE7D6U6y6126sqZGWvJm3vz3kf27OGf9uniI7u38uYZKXqyqaNCO3+lr1uvUUb+GpfkLf9XVnkqldqMS/z1A2dnvC6Xu3WxeMjO6ziUMTqV7mCsS5JbGcftlIxS1y7IpThmbg8zE3XyaoQ+ZzuHtQ3zjnmKOSmwca9xp36srLO8s9zOULnd1+48b4ZNBJoINBFoItBEoIlAE4EmAq8VAq9vPcbrW32z9jcaAul0+vrddttNnX322ee85z3v4cwzz+TII49k4cKFSJqQwyeGjBATYqlUKqxcuZJvf/vbfPGLX+Saa67h5ptv/tijjz469aNikRf1pZ30yrSV/h3y8nLa7enxpVXDP9uL/NNqEzClkEoAABAASURBVP6RpQqXjW0bofLYBlpHd9Bar2KoiJqVpGbksY0q3ugWyls3UB9+4uvXz1WvUqrcYqnzD85Yl5+3W5ZzZ9u8bX6a/abl1ncq+5b4o+GGNgbTWgnJighUSBRGGIGF1XBQk+K1HA6ljjr18RperYaOfKkqom5XqLgjhMYI6DpIvEEDxygL/5vEUlVUVhGJ91Xv10a0uEDYn0NPy+D0pUnMTpJa0EGxs4N1qouh9N6scXfjEXoYDPNoMlihKeQdTCHLSpsobaPEQ+z6IWmvRkpCS4NhylskUlK4I5p8wyeKTDYJ8b9RyPEPqhY/LBr8Rgjz6kbEDslbE7oc6Uj0+YKtR3tLgr12X8JRx57AkWecxbxjjkfP35O1wvrv3Dy+bMM2r1SP3Hmu27YaI3NtYLY+J8kUzL025a5emHbdU2a2qfcu6lan9KfV4ryhBDgcJ78iabfckFepFUJ0n9V5SuXjfz/lxXmnRKkeQuZWq7pPxqUTSxGmvhcd919c31S+J9/E0X/9olxi8G3zO3jLzARHzbU4fr7itPma4/uUNyMVzutUaqreWNeTxZpBE4EmAk0Emgg0EWgi0ESgicCfMALGK9H2po4/PgQymcxVixcvnnfBBRdc/s///M9TPyo2a9YsxEtN7Hn2fR8hJFMSt168zTz00EN8+tOf5l//9V/5/ve/z5YtW9YJub5M5FjJO5ZKpVbEeV+u1EiWKmZm3biTGdtgq6tXN7xj15UCSkJeuytZpk8YZIUs1twdjORHSAY2yYaFWY4ISz4vRIKEKJUzrn3pgt7utn3m9/XPnFFYksmZv+PJxBASqRBPro0dOFgNm2hSUdlcY+ShYYYfGGHHQ2OU19WwxhMoYytZ/Rjd1QE6q2UcFNpMCMlNkaslKZQdkr6JTkT400XxAS2kj5lO6s3TcI7uxnpzj5xPJ1ro0yisx3dXYqceZ1rjQfq9dXRHQ6SiMkqZoBJEKo2nstRFfJWT8wjPHCNydmA4VWzHxLTiPBnGDIuhbAv32S7fkw2QK3Zs566BTWwvj1ONAuGhwvMREVItgZS1acll2W/vfXjX+z/EBy79Jw48951877ERvrZ+G1c8soErHlrHb4eLjGk+EpeJSWunSl4Zn7/qkkqtnnTd8uOBv2ll1W886gU3+0Gw9Pnqlf4e7HPMQw7pSh/6vv3nXf83b1pc/sBhu99wxJ7zj5qRa3HzKrF+Z1nZ/ijsPG+GTQSaCDQRaCLQRKCJQBOBJgJ/uggYf7pN/52WNy+eA4FEIrFeyPJFc+fOPS7+CHf8a9sXXnjh1Ee5LUtIqWmKh9BBSCkxmY7jhChPeaLjHxX74Ac/yNVXX83w8PB1vALHE4Qmc82gZ37064+OF/7xrlV8/rEt3FGDos4TRTa2OFa1XaGU3EFoJrGsHNl8Ny2FHqhWF7+QGXmlxmIpKLW5R6nVMcF6Kr8ZZTSBXGrSkSv1pMXT7LPjwRG23j7A5ANlqquqFO8rM3LbBBN3TRAI8UwkTbJYuKGNIWGoLBDPcEI81m7NEke0SU2FTDolxlIDlNsniWZrjPkm0TQPv3WcVNsgu03bykE9DzM3/DGH5x7i0NatzHOHceoj4hUOxDIbXwh0oFxC3Knr0I4gURNeXcYLyvghhEaeeqKLDVaCbw9O8N9bh7lqcpwVhrRFaWpAXcRTCm0KobcMUtk0++y9lH+RTZRPffpTvOWMkz2vo41bBypscbKM59vZke9grZHius072Or7J5XLulvUvKqv+HvPMvYycSWbS/XVP1o/ePXnV6zjsjvW8+1V25bdP1L+9XgQLJM8U57oOIzzxqK98aXJajXbq9Qti1x13N6uys701fkO1ro4/emSUZnBp183z5sINBFoItBEoIlAE4EmAk0E/jQRaJLnP5p+f/Uakk6nr+/p6VHz5s37+BlnnMFHP/pR/vIv/5L4l7ld150iz6ZpEobhFImuVqvE34e+9957+d///V/+/u//ns997nP6vvvu05L2Oz/c9FKtztRwjKpmcLLGo0ITVxfSPDxrGhvm7cZIoZeSkxN7XCG3NltTKZxl+5PdZ2+s9o7NBMp5qfX9X/7Aif8tVKg1lpBfPelR2lii+FiZxJhBRjzNufE0eZH0sEN9TZU1m2Zxz9juPOzPZ9Sahu/kiISMhqZPaHpoI0RhYkUWSeG5WTySWvzrqk5CyKxrBrhCZdtqgyz1N/F2ZyMfyjzGW1q3szCxnQLDQsfrKDP2PCuUDjB1HZsKT4iPGRlEgQt2O+NBjhVbPL551wDXbKnzm4k6q3yfAUNTFRVVhDgrhW8IcRY7k9kMBxx8EH/+oT/nEunzN7/5GGbNm32Uasu3BZZNhAGG9H/dQDfkXGrFsIhERygOblH36r5c4o9ulzcXG3fesmVy7pX3bODn2xr8ervPdesm+dnqATYWg5tHg+AQpZTsByjvKYMio2SbQempazlJpdTmgmycyGnz1USgiUATgSYCTQSaCDQRaCLQROBZCMQr3mdFNiOaCDwXAuKFvnThwoXq6KOPvvyss87i/PPP59hjj0VINY7jiOc3Qrx7U0WDIGBiYmLqo9w//elP+cY3vjElP/7xj+98/PHHn5tET5V84bekT7lFwdx8gs6WFKkZXbj77kXmlLfSOOwYyov3x5+xBLd/D9TRh5E67igSey4mymcuIJd8llfxhWt7WqrSjpa7RQuxJIKwVKc+UsUfDUjWHTL1zJRka2nSFRdz1OC+x/fj+u2H8YvKntwVdFFy84hznEA845VkmUpSCLR4d53QJeknSEUWyUDhBhGOeK1tEGKtSXl1ptfG2a++nRPCTexujNDDBJmoJvRVwNAmKtKYYR03LAnhLmLqSYxI0oJ2GtVe1m91+fm9k1x12za++9AAtxY9IfUhY2iEWJKIIFKKwDTJFFpZsteevOPMM3nXue/mjHecwRFHHH7o9FkzVDKTvEE88uUWx/R2yyfZPZ1hViNkZs1niW2zfFqBVkmLPfjI0WiUXtDbL1le9iv+3nNceLAWLVu1w+P+0YjN9QTbvBTrywYPDtbYVgnwAmP/ON/TRSXy62N5elzzvIlAE4EmAk0Emgg0EWgi0ESgicALIWC8UGIzrYnAcyEgJPqi3XffXV144YVtH/rQhzjppJOmvNDt7e1TJFopNUXI4rKxN7pcLhN7ob/2ta/xH//xH8Rk+uGHH75zbGzsZZDZIm0Jzjmir4Wje9s4bOYM9t9vbxa+7dTVmdPPxDzhNKwjTiF15Cl0nXc2ySMOQs/sPdRM5W5QSo3FNr0sMYwyhtwuQi6FleI1GgQNH+WD6VtCWl0c38XybazQxpG/R4f357ejh/Dz6kJurGUZN9NoIyA0S5SFPJfSDXxToUIXw08R6BRaOSIWkdQVmjah4YCycQOfQmWMvtIA7bUK2XqIXTfF4+uiPRflKSzZsLBDDyNsEP9gWa2RYsd4O+s3tvDzm0t8/aebuOa2Tdw9MsmgpRiTugMUsdc742kcN0H3tGnst2w5Z8jmyF//1V9z5ulnnLN08RKVTCaf+sVr5Oix9XEHdaQ4pbeF42Uj4/isw1vb0xw/q+B1OHpvyUJFjy9tON6ziGuctisiGzHOruSrhlCWPlBOHmWkwErjG0nKgaLkS6KO2nZFTzNPE4EmAk0Emgg0EWgi0ESgiUATgRdCwHihxGZaE4EXQkApNXbQQQepv/3bv70q/qGw2Avd2dlJ/BFuIT7CNQ3i70HH5zGJLhaLU9+Hjj/G/W//9m/cdNNNc18KgRY9TjUdHWLZjfKBbY76yJL+JX+7eO7pJ3X1HNfalV3SfcQhasF571WzL/jwkp7zzz8qvd8+bUFb2/KSlWQMb96w1hle7hEqT2sTbZqonE1N1wiUT2RoGr4nhFcR6ghfh4RGSGCFNOwZTDqzGDTbxBsKjZoQWyHBhgrwTZ+65PGlvK8MaqbLhJsSsSm6TMlEwqCUcqkmHHzbQgvhFfcyGT+FM5kkGHGoDSfwyi1Qz4q3OQ9WC5VGkorRweaJPDfcXeeyr6/im0KcV2+sUAmVtEHEMlCmKWJjYounW9HR1sGZZ5zN/7v0n/jzD3+kbWZ3b38+mbzqmZBVGxOnJcPK3D0ytnrXwq6efzxqt09+7KgFnzx3ae/eCwrKbXPd1XU9OddH79/AKDyz/K5eK6W8F8urtXaygs+0jENLo0xSsHXEA5/wq2QJSNlKvPfG6IvpaaY3EWgi0ESgiUATgSYCTQSaCDQReDEEjBfL0ExvIvBiCOTz+XOWLFmy4iMf+Qj/+Z//Sfy96L6+PgzDIP74dvx/omMRokNMoqvVKr/97W+Jf5X7L/7iL+b+7Gc/09u3b9cvVs8UmTKdzaZ2Vsd525Ra3WOpawppdX18HcuY1n1lIVKqJSOe5vxYSuVXtJJY0abc+AfAynGelyXaGtPKRPyYNHSZZHsCK+cSuQYqZeJZHl7Co5GsU3IqTFglktk76DZvYF7wAEudKhkdCPe1sYX85mpJ8nULVwg3ViBkOyIScm7ItYGHUnUhuXU8I6QmHmjPSRFaKeriZq3cvoEd1z/K5useY911m1h3/WNsvGMHY5sS1Opz2Fidy9dvCfin7z/Of/x8LbdsmWC0EX8f3YCaBXUXohTaSAvBz5OeuycnfuRjfO4LX+H97/kzFs7b7cr4Y9epVGrzc2GVdPLXplzr2jgtk1GDhYJ5SUuneUmqhdW6PjlX6+GMInBt3Ls6VOtn4ny7IjI+nAGtF09qvcuEOx4TszPG3m+a7nLmvAIHGOPsFQxyaEvAKXv2sqQtubozY35yV+pv5mki0ESgiUATgSYCTQSaCDQRaCLwQgjIavqFkptpTQR2DYFCobBcCHTbm970pvXnn38+8ce5TznlFHZ6omMtsRc6DoXwMDo6OvV96F/+8pd8/vOfn/o49w9/+EM9MDAw9f+h43zPJSlSq92iO7gzLSZcIgU9rDNxnMJvE3rYiM93itTn7Tx/ZrjLRE1TRshtpBSeamBnLbLdadKdSUI3pG42hIh61G2PRsLH7bSZM+chlvfexZvSj3KAXSQfNjDij3R7GbLVDJmKgwrFS214QpZ9Mh6kvYB0o05aPKdpv0ZS0p0ATN/CF+o/tH4Sb/Uo1roKia3gDloEWxWjGyIeuHecH173OF/58UauvnmS366t8fB4neFA4xs2traf+F612KBCFzPfS3rxfvQecyJL3nYq+x5wwOC8+bNVS0vmfF7gUOIRVirzVB/EGFaCyrFlf+L9oRXO87HnOYSb0iq98gXUPCtpixdcOloL7xwohZt2ePpFf1hO68mC1uXuFru4abec+Zm3797Ln+3Tw/v26+WsvXo4bGYLXWbtChkfzrMqe6NHNO1rItBEoIlAE4EmAk0Emgg0EXjDIWC84SxqGvQHi4CQqjEh0fMOP/xw9a53vYs/+7M/49RTT2W//fajq6tLCKKakriBQmiI/73V8PAX/AmIAAAQAElEQVQw119/PV/+8pf5yle+wk9+8hPuueeedZOTk9+M8z1TpA6PFJmd8RUqhRq1jOpUQi2hVTkrxWv61P/o3ZlvZyhe776YcOna2CGNiaGr9cDW0fEdg3rryIheNzymt1T8q5/7492GZ4lX2BEyG5IQwmySnGHRstjCnSvapwdE3T5M0zhzbTJ7JNlz7iaO7HqUI9LbWGSPkjKKKEKMSMr4Nk5gYOhQ4jxMGiRCj1h//INhyUZEsgHCw7G04OZpouEG/v1FzIEIp+IKGc6j3S62Ba2sGIIf3T/M1379MN/59SPc98gkI0VFpBJguBjiNbeUgWUnsPNdpGbtRXqvw8nvfyTt+x9I9+K5uKnExbyMw8DrqapwkWfSXzFNfByU6pzqj11RJ3jPvXusom8aCD768/Ve5hdry5nbNo7d+VjZW/VC5X38eWHoLcULelpzqYv3mdumTt9runrP3jPV23brUUsKGZWMgsEGxb4X0tNMe3UQaGptItBEoIlAE4EmAk0Emgj8sSHQJM9/bD36BmlPR0dH/KvcSrzK6mMf+xhHHXUUmUyGVCpFTJyjKCKWneYKWZ4i0X/7t3/LpZdeyqpVq86emJi4rl6vx9R0Z7apsGbU+qdO5C0jHtCUeu6PF0vy77yGtc5U3NHrqvUNA+GOh242Hvjtadlf/ZLaHTez+vbb+fUdD3H3huJpjYng5vj/FIudzlMKVFRwwzo5v4HlTaNmGATT6yQP9Ok42SbzJgNnmUXm4DRtb27BPlSxID/B/uEOFutR0vYOdGIU7UyirSqRVSd0fCwjIKF9IcJ1Gk6VmnixA8sRjNLgpwnFW1xP2lR0iB6sMeMRLYQ6T1ll2WxmWJlq43thks8OVPji9hI3VyLGtSYQWw0h4FbdJdFwmSLlaQmn95LYZznTzvwg0055H/ndDySZTNNpaApJ61nfb2YXjqxyV3eYuc8UjJZLGuRWpl+Cx3myrueu9aN1l28r83d3B3z0Jo+P3zTMv16/lnsGy4s3+/ojz2eCTdtKyypcr9y21c+Xx0q1XZNQ+efdTHm+cs34JgJAE4QmAk0Emgg0EWgi0ESgicDvIGD8zlXzoonAq4CAeJ4/HhPo+N9Vxf/iKv4ot3iQEXI6RaANIaKxxD80VqvVuPPOOznvvPP48Ic/fOzPfvazqV/kjn9YTLzGy2LzJO/ozvP4elelQzLmh2qL6z+6mW3/9Hm2ffQz1D/3DYqf/G9q/3kljW/8iI3f+ynFHWNL63a4bMxj3mjjie/gBliEhiIQkpmIathCeA0hqdqQeCdFbtZs2ufNJx9/1ztfwLdTKO1gRDbClMXfbEtZG1/yB8qaOg8l1NiCQ0yWU4JFlghX6tFSxBOiXcNPakpuilG7kyG7ny1OL+vb8zyUNbipNMp3HnqQ2zZtYLhaA9Ftmzam6HUNE8uI0IZPlIho68zz5x86j69+5bNc/m//wEkH7sU+XTmOX9jHWfsuYmEqsbfA83u9lFJep1KDL0WJr+mvVTw2rV1HsbSDwG1Qd+uMemNsGB1npFL79PPpi+t7vrRmfBOBJgIxAk1pItBEoIlAE4EmAk0EXkkEmuT5lUSzqes5Echms5fOnDlTLVu2bCz+OPc//uM/8ra3vY34R8WEAD1VJvZEe55HTKA3bNjAzu9D/83f/I2W87nDw8N3xpkTicT6ZDI5Rarj612WsfKxwR0P4P/iZsw7VpLfvA1r3cO0r3+EORsfY56Q0Nzah3EqkwS6cWzNabzFc8JFDfC0ZY75QkjrJphhFSsMhBwbQoodPNPFt4Qkp1xU0kXySiYTQ7zGZvz9YgkjIckxAfeVJQTaJFAmoTKIlEJjCIG2RRJybREaQp7NAB3/GrfrMBS5rPdbWUUfDyQW8t3JOleNjPGLiSKPBFVGAo/QEsNEXxiEQp5Fp46QquibP41z/uwd/N0//TVvO/NElglRPmBB7y0n7NnFGft0ctL8VvZtSVyTazRKu4zjLmaMv5Nc1ZNTGx7PV8Q1GMwYSjz6AbYqo6wJUOPU/VHBqE6kIuJPDNA8mgg0EfjTRKDZ6iYCTQSaCDQRaCLwBkLAeAPZ0jTljxyBNjn23nvveaeeeirnnnsub3/72znggANoaWkh/jGxmDzHEsMQh0NDQ9x+++18/etf51vf+hbXXnstd911lxYv9J1xHv0SfpV5Kr9Xf//kvfcRPLwWZ3QHhpDgmlXCMSfp1BPMqI3SPrqVVG0cK6zsb0VemxOGxB5r2zecAJOGYaC0hyleZ6UtIbwOITahDojwhAjXUVFNdHtCnjVKiDHakHgRIbdaKWLCHCnQT4pkklckOUMgIprKYxGRpEGWzUWbe0c0vxH5ecniuokyN5XKPOQ1GEZTncpvSnkldWvEKKZNn85Bhx3M299xKmefewannH4Suy2Yc3lLyjq5M2GdP78juWT/6Zl5u3cmegp2eInrlU6Synf5tSuEVjYdCorQeSGlGYdNBcscXNLRTm/CJ6t30GqUmF5w6c4lyDim90Llm2lNBJoINBF4oyPQtK+JQBOBJgJNBP54EDD+eJrSbMkfAgKx17izs1MdccQRy//8z/+cD3zgAxx44IHMnDmTXC6HaYoH9cmGGEJUQyGvg4ODU9+H/vznP8/XvvY17r777mUbN24cHR8fX1GpVI59MvsLBvV6fa72qkeObnqMoDIBZsC4qjDSY1Bu89HJKgkmSVd3kKyNkQ7K/TnqA4kgKDNOAZ9CGJkE5pO3jBY7tYMW4hxXbCgPpYuoMCbeRWyvDFEg6RFK6SeIdBRJHv0753FZhXiLhSZbsedViS0IcdY5grCDyWILj2zyuHXNID9/ZAM/3b6JNUKah0zNpJhQDiGIDHQQySaARVtLK30z+zn62GP4wJ9/gAsuuID99l3W35JrW6LEzx5FqjsgKPcoFf/rrvUZpQZd33fBnxfbsqsSbyjEeYVEdw/Vw/cPVcOPjNX0IXHcTnFpDGoSm3ZeP1eolCoXLOuig+f1sbwryV6ZkH3aXY5ZPIfFnW20JayjOiXPc5VtxjURaCLQRKCJwGuCQLOSJgJNBJoINBF4EgHjybAZNBF4TRFIpVIrZs+erU4++eRzLrvsMuIfCjvssMOQeAwhzeJVJibOsQc6vo7PN2/ezFVXXcVFF13E5z73OR577LG5kj53Vwz3TN2jhcxWG3XqEnqOppGOqOVNqmlF3fEJdU04dQWzUcIJagU39El5YZkAB9/IaG0QKRNEIiHNkbaFDBvihfaxVQlTCXG2Sri2T9oQD7Iw7lAFGEpy6xCr4eH4kejWWJ5ch0rKGhhCsQ1Vx7KL0va4XJpA9+LVZrLuYbjpho3cdvOD0t41jBhjQrMjSTeIhDQrZQrVFh1RRHtrK2868k18+rP/wV//499z9JuPOWdW13SVmvpBNWvAsHuvcJyuKzIqM8iTh+DsYEcNEs6VT0btUqCE0ApxnjsOl9w16X3xprHGp++tBzdv0vo0ie+OlSjVWX6i7vjqd0XqzeyM6XTVNfv0Zo/6wMHzy//vxOX87bGHct7yvT45pzXf06nsW3bma4ZNBJoINBFoItBE4OUh0CzVRKCJQBOBVwaBJnl+ZXBsanmZCGQymas6OjrOefOb38zFF19M/H3oQw45hHw+jxC0Ka1CtKbOIyGI8XeiY0/097///am8Qrwvu/XWW/Xk5OQ3X+hHxCxfb1JOcrDQNQ0nKbojm5R2cSbAEFFVA9N0SLS2oTM5Gk6iXFNmT9U1C7iMYakxpUDJX2haBIaFVuaUF9nSHiYVSakJoQ3xQptq1Ipnu4SGmvIKm57C1SncIlg7AsyiiVVzoWajPQstXu3Q11QDh+3jNrfcO8YXv3kPX/3WAzzy0Bi1ojdF7iNjHBUEWKGJLeQ9gc2Mzm7OPv0M/vHv/p6//Mhfsv8Byym0dZ6edzNP/Xq2UnmxX3k841BKeSqRX49tr3tG0gteSp84xar/ox/cN3Th1+7axJfueISvrljDzzfuuHqs7q+I019IgdRbfnp6t61u6LeNxQsd+9D5CWd5v21fIh7np0j+0/Pu6rnYkJEx0ber+Zv5mgg0EWgi0ESgicAbFoGmYU0Emgi8IRAw3hBWNI34k0YgJtDTpk1TS5cu/fjJJ5/MBz/4Qc4//3zi70MXCgXi70MbhoGQoSlvdL1eZ/v27Qhp5uqrr+ZLX/oSX/nKV85+6KGH7hyVIwYzJk26XO6Oz2Pxk8kydurKtn32x+0XZ7XbKmQ2T76WI+klQScwW7rpO/gwtJDRmp3cVDWcTN00CuTwhKkOmkaEJR7kwNRECvE6a/Eci4hrOhIJbJuy3cqw2ccWaxFFK09gCkGOXFTJpLG+yMTKcXbcNcnwvSW23T/Gjsc9apNJvKDASCnFijVlfnDTMN/5zQC/uHeIVY9NMDHmEzW01BdiqgZmBAnRO6O7lyMPPZwPvO/9nPuud4mn+WgWLlpwcU97p2pxU9fwko7c75DZFytaq/lLx+rR4rs3TLByqMaDYw3uHy5z1+PbmGz4L4uwFpTa3GmrW9odteLF6n+h9FKjsXig4l22bqJR2tiwNg14+rwXyt9MayLQRKCJQBOBJgJNBF59BJo1NBH4Y0DA+GNoRLMNf/gICNldZtv2N+fOnave/va3q/i7uvGPih199NEsXrx46vvQMYGOP74di3gup36Ve/Xq1cRe6Phj3N/97ne58cYbC6tWrdL1eu2WmhP270QmB2XDcq9P778viYMOxFy4B0ZbP8nENNyWXuyZ80nsu5zuY45GdfUMBlbq1hB7LDANbyRW4kQNixA3CogMH3H/Ysi1IWQaNJ54o4tCnLdZ03komscd/l4MhK00dEqIb5L6Fo/yyjHK95Uo3V9j4t4KAytLDDxcY+tjmrWPWdzygOKHNxf5rpDnXzwwzrrJiHIktYqICxsjMEhh0dXewT57LeWEE47nne96J+df8GccetARbYWejn5LqTW8Boen/b1qkWa0FlIObOqy+VALFBMTpakNDumfZ3m5XwOzGPa889aWvFW3bp+48LoNo/x8W4U1Oypf3VhrXPda1N+so4lAE4EmAk0Emgg0EfijRaDZsCYCsv5vgtBE4HVGoFwun73ThJhEx+fz5s1T73vf+9SnPvUpPvShD7FkyRJaWlowTZP449u+7xOT6VgajQabNm3is5/9LB/5yEf44he/yKbNm/q8eu2b4q0uxPqmyFxrYqU3s/fK5NuOJ/2udxAt25/avMVES/ch+/a3UXjPu/GX7HYo6dw5iSh1pR2611se93eA5xNlbSHOicBHqbrcOB4mYoOKxAtt0LDTDFrtrPR6uW50Ot/ePoe1xQyleoLKmMHQAzvwHoP8RJqueoaWSopUuSCeZ7j9t4N849vr+M8rB7hWKPsjowZjpmJMvNtlFKFpybtNgiS9qU4OPfgQ/vrv/oZ/+fd/vfi0c89ShWldilyRVCq1OZFOX8/LpCiDqwAAEABJREFUOKbweQnlTNtzEo6mtSVHwnKxahGZesTcQoGsZTKsdebF1JV1uTuWF8u3q+nS187jNf3Vnz68lc/d9CD/fuMqPnv7Rq57cAuPDxWPHdB68a7qauZrItBEoIlAE4EmAk0Emgj88SHQbNHvi0DT8/z7Itgs/3sjkMlkrhLityKRSKyPw6crnD59etuJJ57IF77whakfFTvooINwXXeKRAdBgJA+xGM9Rajj84GBAb7zne/w/ve9j8v+4z/mPrx61Wil4i2NdRahu5RMbK70tK/Wh+1H61+cT9slF5H/mw8RnXo0Y7M6V47bqi+MEoM5217Z7jgr2lx3tej1bB/MSGGHokn5Uq+IeJ7RQp5R1IwkA0GGhxsF7vX7edDemzVDPjvGGvglm8mNNTJeHnMiiZ7IQNDFtgG4bV2RG9aWuWtLxLaaSw2XyLCnCHPdUlSVJ7X45HOtHLj8SP7rs1/h7z/2cfY7+IBBbds/L+nGFCGMv9PcaJQW12q1Q8TCF33Feave5DIhnJkXzfxcGWw1mEtbK046pJOjF3dxzMLZnLLP7py87yw60+45nUqVn6vY0+MUqkfh9zw9Tuxxnn79Us4FzmXrR4vcP1LiYd9kR2EaQ2aah7cMsXFwBC/iiN9H/0uxpZm3iUATgSYCTQSaCDQRaCLQROBVQOB1Vtkkz69zBzSrf2EEhLiOxf/aatGiRSom0RdeeCHxv7iaOXMmyWRy6iPCsRd6p5b4fHx8nEceWcv3f/BTPvmvn+Lb3/rGfWseeVQ3YNBqRHMdlbzCTPfsrbv7l9u77TYvmrlkSaJjxpJk0j7ZMs1r21w1RZh36pwKI6MUxB9NNrKUrAR100ZLghWFOKFHUoUYlkHZsBiMhCyrJIEbYERVnMkqmdEQu5ygFGZ5sGHzAyF5/zsxyU9rDW4Xv/ajQsLL2SShVlhSTyxag1TFPvst5N3nv4MP/OUHWHj4/vTNXNDTmW/ryQqxzyp3tZgx9XLd7OpkMvm8v05dr0/O3To2rG/+/9m7E/CqygNv4P/37vtN7s1yQyBhSWST1bIXFBG+iqLYElBBHXAcalvRflj71K9WqvOBdnRmWkbrOA7WTjMtxaW4VNuKVhmVVNk3WWPCkn2967nbmfNGwIgh5LKELP+QN+fcc97znvf9ncfn8Z/3nJN9h9V1u2t2vVcrNu0JxysCqupraSCFHw6412frjfOvspt+eudAK757uR1FBTaMcFhzsg2GUy8qa69Ju7BvtYv0ra3raNc72vpzKusal0f6KXEgqhoRNzoQNdgRiQsoWnKOJ5FTA5xzOE+lL6xLAQpQgAIUoAAFKNDzBHQ9b0gcUU8VKCgoEDNnzlwmn4WeP38+ZJjWtrUMVwtdkKXlg/YjqgXST/cdwit/+ANe+PWvsPa3xdj02mv+ms+OLFRD6rV2k31rUmeuE27LQRk6zcK52yNs5WecMTUnoklhQFybGdZr4VifMEKnFX1CD2NMwKaF4Ox4CENMIUxwBzHBUY1hbhu8eos2ywwoFht2xxRsiEXwsuLHukAdNihB7NfCdw2S8Is4IiIBJJPQa+Evw5GOCaPGYsG8m3DHopux6NYi/J9rps12ZDkWORyiUhtih7/lbGs43Dy1KZ78/c7KJvxh5zH8964GrN1Zj83VEUdDPPrt1i9X60jDQoiofMHXAKNYMTnbKKb1NYmRXqNwiNT61pFztVWnrW1GYHe2w4J8txM+kwm2iAKbEPB50pGhbTMKHDjj9W2rQW6jAAUoQAEKUIACFKBAKwGG51YYXO36Ak6nc/XIkSPF8uXLD65YsQJFRUUoLCyENjvdcju3fAZaC4uQt3TLF4uFQiF88MEHePLJJ/HQQw/hnXfewcGDB6+tqqpSk8mkt8MjjsW90MKtQZsh9oQTcCk6mOJaME44gIQNRn8UA4J1uN5Qgfszj+DetM2YYffCAx+qYMWWDBd+o2vA0zEtuMar8YkIoxkqzFpedsUAaySGaHMTrHo9stJdmDB6FL7z90vxz4//E5Yu+YexXxsxSdgt9jc9VnOHZnVbj0tRlLygqi8qC2LMpkoFbxz248OaJF7dcgRbP6tBWE0shFHxtj7mUqzLt2TXh5WFjYpSJNdT7YMWjA8OTbOumpKXiclZTgwRAQy1xjD+sj4Y3DcLbj3Wp9rmRazPpilAAQpQgAIUoAAFupkAw3M3u2Ds7ucCHo+ncMiQIeLee+/FmjVrIG/nlrdym7QZRxmeZXCWRQvILQfIP2+1d+9erFy5sqXuc889B23bb1p2duBH3Jj0QEShU2NaWE4gAQFFb0TEaEbMaIGwmWEVDchp3oJRVa9gdngdXOEIDlYJvLa/Fj/fW4H/bo5giymBWrcKxSWQMAvotP8CtRlTmJOAWRUYPrA/fnz/D/Dzf/055i1YsDrNkT3NZPryrc1I8ctsNpfHTOaNR5N6HE7aUGvJQciZC782i+5PqIgkYgVJtfmeFJu94NUPJvS7/qfW/5u/7C/7/Z7aml3VSvMa7VqmdJt1vln/4DWD0pbcd/UgPD53KP7/rD64bpjnzb4eS75biPoL3ule3SAHTwEKUIACFKAABXqXgPa/7r1rwBxtzxLIyMgQw4YNK16wYAEee+wxfO9738O4ceNgNBohhGgpcsQyRMdiMdTX10OG6OLiYixbtqzg2WefVUsPl6qyTnvFkEjkGZIxGNS4FpYNCGoh2G+JoMkaRqNdQcCSQNiYRNyug2IDdpcdws/e+hiPvLEVv992FMeVhHxlN5LajLUaNUBNGBAXOjRrM82xNDcGTxyPh376EB597B8x+8bZyOnvm2jzOJc1OC1bW7+5Wq0P5bXXz7b2hRH2Cb2+PNdtxeXZLgzzWpETb8C0wRkY3dcDl95UrDPbn2jr2M7YVqmqEz6tD6prdzVh9eZm/HpnHf7tzY/wwaHji4+GGitS7UOOyfC8z2F0jnRZrxltN8wtMIm5HiHKU22H9XuBAIdIAQpQgAIUoAAFUhBgeE4Bi1W7poDb7V5UWFgopk+f/tObb74Zixcvxrx58zB48GA4nc6WAC2EgF4LqnI2OhAIYP/+/Xjttdfwwgsv4D+ffQ6v/P4lde/OnS0hWpvtdMiCE1+qWp+nRsMLdcEQjAFFm4C2wiD/6eJam2EIQ1ybhTajJunGJ9U2FG+P4ukPG7Fuaxne+6wC+5tCiGgzy8akgCWqgymigyGmh8ORhpFTJuPaRbeg6K478c0FRZg648plfQsHCZPNVlKvqnnVkUTZsYjqPxxVn2hSVQ90yUKk+GUTtnKfECX5VsPE6X3sWDIyA3ePdmPxqAxMyHHAabSsEiLrYIrNXrDqqvaLiar6ZmyvSmJTrRV/a7Tho2NR7KgIojKQ8GjXwpTqybKECGQYxQafQawXQkRTPZ71KdBdBNhPClCAAhSgAAU6T4DhufOseaaLLKAF5RVXXHGF0GahS+Rt3DJAy1no3NxcWCwWGAyGUz3QAhmam5uxadMmPPvMc3hq9VN4+cWX8PGmD9Wjx474m4L+FQE14AsHmhf7S4+XNe3ZNyO4ex9i+yuQKBWwNBjgCAk4tFhmVQxorDVj+yETXvwogV+8GcQLm3Q4XBVDMJbUgrUOMQjt3DoYkjq4TXYU9B2AK6dciYW33Y67vvMd3HTLzSV9CoZ5LTb3amhf9dHg0sNNwbJ3P6vyvFdeh111weWNQeUPMMS1vef27dMC9HivVSwekSF+OCnXOWug0znOZRReIU69sTvVllVVNcmS6nGt62sy0agSgZI0ISDcaFTTEDZloV6xoDmqb12V6xSgQM8T4IgoQAEKUIAC3UZA1216yo5SoIMCHo9n4qRJk8Sjjz4qfvKTn+CGG26Az+eDNgPZUuQMtCzy5WJy2RwKYOOHH+KJf/4X3HfvffhIWw80NC7XNya+rRyvWLP31dexbfUvsfc//gvH39iEutcrEd8eg+G4Fcb6NMSOu7Dl3TB+veYw1q47gr17VMQD2TCGHNCH9YhFgJAwoFlvQNCoR7/LCnDnkiV49l9/jn+Yd/OyUXkjchxW12x3q2dya4PRZz74tBy//OMHePbtzfjjrs9wqDk0VTjSNnSQ4SvVVKVuuBquWKyGy1ciUnFPZqwx5Vns0xttAHw1QF6TnBU/fWcHPzv0+pJstwN2k0H73UAUlkgILr0RmW4vnDaHvGbRDjbFahSgAAUugQBPSQEKUIACvUWA4bm3XOleOs7Ro0cXy+egV61ahVtvvRV9+vSBDM3yGWgZpuVbuaOxOGLJJILhEPbt24dVjzyKJ/5xJV5a8/zDG3/3Iso3lkA9UA5vbRCZTTrEqq04vC2MzZ8k8Mp7Cfyk+Aieevs4dlboEE/YYVVVGGJ1sCQisELAbNBDmFX0GzkISx+4BysefwTzb5kHb6ZnrlEv9tgTisMFBFpfoqBfQfmxOii6NNRGTDjaEENVk9K6SsrrwuzdLaw5zwtr3oOwuJ6HUVeWciOtDqhT1OHVyeSDNar6hBaiF1e38feim9QmT6tD2lx1CFGZ53HNL7pM4DtDwlikRfq7J/fD1QOc6GczLGnzIG6kAAUoQIELJ8CWKEABClCgQwK6DtViJQp0UwH5PPSQIUPElVde2fIs9A9+8ANcd9116Nu3b0uIlgEaQkDodFC1MQbk89BagH7nrbfwcnEx/vTySzi2ay/01Y1w+WMwh4CmpAubKxL43ZY6/EdJDV4vTWC7341jcSfC0MGohuFOhGEy62FNc6Bg+GVYdOcdWP5/78PConmYeMUY5GVl58OQPGjQ6Q7AZa4HYNLKqW+nxYH8nH5wp2XD6clGuteDNJft1P6OrqhqtUM9EWC1cOuoV9W8OlUZHoRdG7ZbnrejTX2pXn1MnVoaCe366/6DS/+8e8+Nfys78kRNIPyll3vJ4KxCP+ZLB57hQ5rNvO6qLLX89kID7rjcjdkFHgx1GpflWMXzZziEmylAAQpQgAKnBLhCAQpQoDMEGJ47Q5nnuOQC2dnZ4utf/7q45ZZbDt5+++341re+hcmTJ8Pr9cJiNcGgzQ7LGWkZoGPxBEqPlOOjbZvx7o7t+PB4Bd5vCuKvUYG3VRNejUTwRqOC18ub8F5ZPT4LJdAMPUIiCUX7lxRayDYakF84CNNmXo1bFt6KO5f8PRZ+s+j5CaPGmTO9PiFstnJTTNTJpRCiXiuB1kheu33sxIJc3Di0D4qG52DGwAwUeuwbW9fp2LrNEUbCEVBVnzGGwmgchbG4zhdDLEeG6Y618dVaR0OR9z840oDX99dh/ae1ePNQHUpqmlGWUJeerO2CK6BC1J/8fLZlntOePzYnwzl+YB9R4EsX6U5Ty/PfZzuO+ylAAQpQgAI9QIBDoAAFuoEAw3M3uEjs4oUTsNls186ZM8f7wAMP4Ic//CHGjx+PQQPzkabNEAudAPQGJLRZ6JAQqNJOu0dN4qVQACsDITyQNOBHBgtW1JbhRX8zDgL/AdYAAA+uSURBVGkhO57Q4mEoCKFUQqdWQ2eKwpSeDu9ll2Hm9dfj/uX34/898CMx7YpJIt2etkSIL978LByOSu0UbX6n28XW8VlG8fDETPHYeI/4uwF2UWA1TGuzcjsbhXBU2oSnXN4anW4SW31GsSHbYNhoRxBG+Gc0qNEOzQy3PkW9Nnt9wB/B2wcb8LeGNHziz8Rfqw1493gAlTr1iUo1NkPWl2NNF/atcr2jRTvmS79EOP04+XKykBrKk8vT98nPkUhTgZxpD0aDY2oU/4qKaOgXx6KJe6pVtUDuZ6EABShAAQpQ4GIJsF0K9HwBhueef405wlYC8Xh8gvwoZ6K1mefi5557Dk8//XTLTLTdbocW3lqKrCPXdVqQls9Ha2Gt5e3cFRUVkOtym9xnMBggl7Lo9Xrk5ubipptuwtq1a/H9738fw4cPny3b6kpFG1c0ltD5rFB3pwtTSuFWjsMjRLlX+0VDvlGgjxJARqAJfWJR9NfGn55Un7fE47LaRSmy7zZhK5fLtk5gsbgPHks6irZGDFvWHxMPrzmQuGdrQ/wXTYr6i/N5qVlb5+I2ClCAAhSgAAV6mACHQ4GzCDA8nwWIu3uWgMPhKA6FQhNkcbvdi1wu10Qt4JYsXboUP/vZz1pCtBasWwKxHLkMxVpQQywWg6Io0MI3ZEiW5eQ+uT8nJwd33XUXVq5cibvvvhtDhw71ZmZmCrvd/qZs51IWxa8Ml8GxQlWHazOwY7RSYNO7NpgBbRK52pFq37RfHjgGOQ3lN8jbyX1uTPfYMbuvBzPzM9FHp1vpNkRTDuSp9uFM9bUB5W2vjT7z4u5m/LKkDv+1XcHaTaXYXHr82jBQeKbjuJ0CFKAABShAAQr0BAGO4eIKMDxfXF+23kUFtOBbJ7smlx6PZ+KoUaPE3Llz6++44w7IMmXKFGRmZsoqLUXONMsiP8ilnHGW6/KZ6W984xstLyNbtGiRfBnZ6iuuuELL0x1/1le2czFLWI9hVcnkyn2R5K4doeSW4zGcCPSuAGA2yductUBs6mgf4hH/GI9OXTkmx73o+mFZ+NYIH2YN8mJkuv0aeXu4EOf+IrKO9uFM9UJaQD5Q2YyPSxuwszaBfU16bDtahwM1DWiKqj+Sx2ljTfkXBvI4FgpQgAIUoAAFKECBiy7QpU/A8NylLw87d6EFtODkkbPBFovloGz75FKua0HYO2vWLHHfffdhyZIluOqqqzBgwAA4nc6W2WYtEbfc0p1IJFpeNFZYWIirr74ay5Ytw7333ls/adIkodVdJtuSJRgMXitnuOX6pSxhg96x368s3XisEe+WNWBbVaDgWBKLtfFEPw+6ei04Bz2p9NGoxqOZZkPx9MJ0cf2obDEu3yXSrGKD5utorx1tv6lJjRRoy3brtddGe/v0gCkaDiEeCcKijcpoBOK6BELaNQvF1Rtbjq1p+ckfFKAABShAAQpQgAIUSEmgY+E5pSZZmQJdV0ALjGd9+3NWVpa47bbbvPIW7B//+MfQZpLhcrlabuWWM87abDWmTZuGxx9/HE899VSxDNwyeJ8+ahnSbTZbyenbO/OzvF27OYEHN2w7jNc+3IEX3/kE69/fhVol8Uy1qrYEWCEclcEUOmW0ujaaHOlt/gkpzTfQXlPNUPISUHPOVq+9NtrbpzX85sg+Loz1GZARKoMnfgQZNsDrtsJl0a2SHshEtL02uI8CFKAABShAAQpQgAJtCfSa8NzW4LmNAmcS0MJdfXZ29mwtGGPVqlV45JFHMH/+fEyfPh2/+tWvIF8GNnbsWBiNxi7/55SSSJoMcUAEFeiVOEx6gzYTK6BFyGtx4suhBegTqxd1kUTCaUYycPrM81FVnbFHUTftDKtlpQn1R1qw99W381bt9jo5PMO+Ye7lfbF0ykDcNsqDBRMHY9yAXNh0KHZ//mfBGJ7bA+Q+ClCAAhSgAAUoQIE2BRie22TpkhvZqU4WkDPHPp9PjBgxYuLs2bNx55134rvf/S5mzpyJYcOGLUpPTy+0Wq0HOrlbKZ0uGYvlW3WiZHS/TEzun4spWogclZcBuxGBhB7tzhKndKIOVJazvip0jjjiZdovJ06d+2gisbTkeN3bL+88NmHt5rK8P+86trIylKyIxo3n9IKvvlbz3BFe67pZA9y4YYANX891Y4DLer8eKOtAN1mFAhSgAAUoQAEKUIACbQowPLfJwo0XR6B7tipvvR44cKCYMWOGmDNnjsjJyRHyrd3yeWktBJ71NvBLOWqTdnKHPlk8Lje9/LqheZgzIh9TBmYizYwH9fq4nAGWVbRanfGttDxX7W71QjG/Xx1erSSe+cuBo3h1XxXW76rEH3ccwd7KZkQSWKr5pjxLrB0TyLGZv32Zyzh3lMtw/yCjuDxPr38yS4hTgb0zRstzUIACFKAABShAAQr0LAFdzxoOR0OBiyegqqoHJ5o/0/qJ3V1mYTeZtnr1pg2FdmPhuHyX98qCdO+IbHu+FbGDQMzXjPAYbSyOzuiwDsKsh9oShtXqz5+3VnQoqA4nsLX8KEq15ZGEAXtrmrCrtAKBULToXPulBeh6u9m+3on4OqfZvPtkO6pa7Tu5ziUFKEABClCAAhSgAAVSEdClUpl1KdCbBWQgOzn+M62f3N+VllpfA1qJyud9ZfEIUW6GuURLzCUuWHdr+zplRtYBU5k8X4uNGSa1Xs3TIRH1moFBDiMyFD88sRD6uR3o602H1Wgob6l7hh9a6D/7rLk1vbL14UJkfelz631cpwAFKEABClCAAhSgQHsCuvZ2ch8FKNAzBWSItglbuTjHW5llcNWKlr+BcDgwIxKJFJxNSp5LFllPuEW98Ihyj93wZj+TflnRZf0wrzADcwo8mD3Yh3F5aXBbdEtk3TYKN1GAAhSgAAUoQAEKUKDTBXSdfkaekAIU6NYC+5ti/nfL/cqf9lX5t1c2q41xPJzQ6ZznOiifybR6Ul6fg7OG5uIbw32YWpCF/h5LfobRuKG9NrUgHm1vf9fex95RgAIUoAAFKEABCnQ3AYbn7nbF2F8KXEIBbbbZ9MkxxfHb7U347SeV+NPeOhyNiKmK0Vh3Pt3yudIKC/p6Lx/e3zu3INuZL28tP5/2VLXaoaoBH1DjOZ92eGw7AtxFAQpQgAIUoAAFepkAw3Mvu+AcLgXOR6C6sd7/UWkt/lIewY6wDa/vKMW++gD8Sdx4Pu3KY3OE2G0BNpwMztFQaEI0Ghwj96VSZMCHYvbF49FCwGBK5VjW7V0CHC0FKEABClCAAhRIRUCXSmXWpQAFeq9AMBod47Rbp7kzvDA4bPArIdidVljNBhh0iXZf7tVRtZN/TkoLwA6jNXbAZLJv7eixretVCFvRoZjjN6VJ57LW27lOgR4mwOFQgAIUoAAFKNCJAgzPnYjNU1GgOwvIP3tlM9lKRvez4rqRTswa5cG1Y/thQLoZFiQOXsixCSECotXfg+5o26WB2Psvf3pcWVNyeOWznxzPe2ZHw/ItNX61o8ezHgUo0NkCPB8FKEABClCg+wgwPHefa8WeUqBLCIzOEv9eNMyKhWOzccPlvtWDXLqJHkQqtNli06XsYLWq+vY3KVP/vL8axVuO4Nfbq7BmRzP2VjTD7/evuJR947kpQIEeLMChUYACFKBArxFgeO41l5oDpcCFEfDodSuH6HHNZJvJ3N9gWObSgjOgmLTZ4kv69uskMLw6EEYzjFAsaWjWu9EgtBKMIhwOP3xhRs9WKEABCvQ8AY6IAhSgAAU6JsDw3DEn1qIABU4IyBd6OZORymg0UKiqTZ5o1OgEbCf2XrqFT4gNQ7MdyNUrcAdqkBVtQF8EkO22w2q1Lrt0PeOZKUABClDgIguweQpQgAKdIsDw3CnMPAkFepaA2ezcLYsQ7vrPl47Kcx1htao6GqLRlN+q3db5+luNc2cNzsWiCQNxy+hMLBqbhst8TjidztVt1ec2ClCAAhSgQNcQYC8oQIHuIMDw3B2uEvtIgR4oUB1Vx3zcrKhvlDb5i8tDW/6nslGtCoafOZ+hZpgN67+Wl77ohhF9MH9YJooGOjEo3ZJzPm3yWApQgAIUoAAFOiDAKhToBQIMz73gInOIFLiUAnJm+eT55W3essjPlfH4lrcqQnjo41os3xzE7/ZW4EBtzdLW9WW904uqBnzRaO0ENVY99fR98rPHbC4uTHOKcVluMdpmEA4hznlWXLbHQgEKUIACFKBA7xDgKClwNgGG57MJcT8FKHBeAllCBL5oQIkCrpbPoUAYweoaoOIIjM0NOHb4EI4dPQoz0O5bu4VwVJpMGSXCmLXxi3a5RgEKUIACFKAABXq9AAEusgDD80UGZvMUoMAXAkJkBU6+ldtrNQWGptkwIc2CMULBFf1y0D83F24h6r84gmsUoAAFKEABClCAAr1HoGuPlOG5a18f9o4CPVJAVVVTmkl8e3SOGwvG9MPfjcrGlYPz0Cczo6RHDpiDogAFKEABClCAAhTo9gIdCs/dfpQcAAUo0KUEAggUZphM60ZlOMX8UX3FnK/lOqfmZ4p+dvvEc+moqlb7VLVi+Lkcy2MoQAEKUIACFKAABSjQEYHeEp47YsE6FKBAJwk4hXP3ydu35Sm//Fy03NKxooZCeapSXYRY9EYkkgUnj5Iz23JdC9WntsnPLBSgAAUoQAEKUIACFDhXAYbnc5Xr9ON4QgpQ4CsC1mQUasyHJBzCkLu+SY0UHFXVGZVAYUvdeDK/ZckfFKAABShAAQpQgAIUOE8BhufzBOThKQiwKgUuuIC9Hjrz3xIG255aNTZjm990YFsj3j4cwq5qNTY1fsHPxwYpQAEKUIACFKAABXqrAMNzb73yHPc5CfCgriUgb/0WpoySurhlxrYq5e239vnx6u5GbCz141gg/j4MpmjX6jF7QwEKUIACFKAABSjQXQUYnrvrlWO/KXBuAj3yqNqQunzj7mq8sbkCr2w6gnd2VuKzujDCcWuPHC8HRQEKUIACFKAABSjQ+QIMz51vzjNSgALnJfDVg/XxIKyBSgi9HhGzEQmRhDssb9o2fLUyt1CAAhSgAAUoQAEKUOAcBBiezwGNh1CAAl1LwOswbpg8NA9uhxVmlxVerwP9061wGY0b0RW/2CcKUIACFKAABShAgW4nwPDc7S4ZO0wBCpwukGFNmz20b8b9C4e78L2RafhmQRoy002Xn16Pny+cAFuiAAUoQAEKUIACvU2A4bm3XXGOlwI9UEAIEc20WZ5cOtIlVoxJEzcPcAin2by7Bw6VQ7pwAmyJAhSgAAUoQAEKpCTA8JwSFytTgAIUoAAFuooA+0EBClCAAhSgQGcKMDx3pjbPRQEKUIACFKDAFwJcowAFKEABCnQjgf8FAAD//5/McsYAAAAGSURBVAMARC6y7gGGzKsAAAAASUVORK5CYII=";
const BEELDMERK_PAD = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYEAAAFmCAYAAACLGCYeAAAWfmNhQlgAABZ+anVtYgAAAB5qdW1kYzJwYQARABCAAACqADibcQNjMnBhAAAAFlhqdW1iAAAAR2p1bWRjMm1hABEAEIAAAKoAOJtxA3VybjpjMnBhOmEwZmJhNGEyLWQyM2EtNDcyNC1hNTk1LWViZTA1ZGNmMmI2YgAAAAOTanVtYgAAAClqdW1kYzJhcwARABCAAACqADibcQNjMnBhLmFzc2VydGlvbnMAAAAAuGp1bWIAAABEanVtZGNib3IAEQAQgAAAqgA4m3ETYzJwYS5pbmdyZWRpZW50LnYzAAAAABhjMnNoeYwlYSb+FtaOzOYtMhjsqgAAAGxjYm9yo2lkYzpmb3JtYXRpaW1hZ2UvcG5namluc3RhbmNlSUR4LHhtcDppaWQ6MWU1NDE5YmMtMmNmZS00NDNhLTk4ZjgtOTIyNTkzMWQ5MmIxbHJlbGF0aW9uc2hpcGhwYXJlbnRPZgAAAeJqdW1iAAAAQWp1bWRjYm9yABEAEIAAAKoAOJtxE2MycGEuYWN0aW9ucy52MgAAAAAYYzJzaE7ouuWj2vDR4n6/ZaKN2S0AAAGZY2JvcqJnYWN0aW9uc4KiZmFjdGlvbmtjMnBhLm9wZW5lZGpwYXJhbWV0ZXJzoWtpbmdyZWRpZW50c4GiY3VybHgtc2VsZiNqdW1iZj1jMnBhLmFzc2VydGlvbnMvYzJwYS5pbmdyZWRpZW50LnYzZGhhc2hYICXaCCax8t5xq7XdIpQWJSEL0Ar/7Isvboz5JGnNWCf0pGZhY3Rpb254HWNvbS5hbnRocm9waWMuY2xhdWRlLnByb3ZpZGVkanBhcmFtZXRlcnOheB9jb20uYW50aHJvcGljLm9yaWdpbi1jb25maWRlbmNlZ3Vua25vd25rZGVzY3JpcHRpb254ZkNsYXVkZSBwcm92aWRlZCB0aGlzIGZpbGUgYXQgdGhlIHJlcXVlc3Qgb2YgYSB1c2VyIGFuZCBtYXkgaGF2ZSBjcmVhdGVkIG9yIG1vZGlmaWVkIHRoZSBmaWxlIGNvbnRlbnRzLm1zb2Z0d2FyZUFnZW50oWRuYW1lZkNsYXVkZXJhbGxBY3Rpb25zSW5jbHVkZWT1AAAAyGp1bWIAAABAanVtZGNib3IAEQAQgAAAqgA4m3ETYzJwYS5oYXNoLmRhdGEAAAAAGGMyc2hmRdQ3lJGEI2FQ7Z9Rta1FAAAAgGNib3KlY2FsZ2ZzaGEyNTZjcGFkTQAAAAAAAAAAAAAAAABkaGFzaFggaHc4jMLZ0J7sNJ/ThGuqeoM4stLIbdRR4MA6GdRt+BBkbmFtZW5qdW1iZiBtYW5pZmVzdGpleGNsdXNpb25zgaJlc3RhcnQYIWZsZW5ndGgZFooAAAI+anVtYgAAACdqdW1kYzJjbAARABCAAACqADibcQNjMnBhLmNsYWltLnYyAAAAAg9jYm9ypWNhbGdmc2hhMjU2aXNpZ25hdHVyZXhNc2VsZiNqdW1iZj0vYzJwYS91cm46YzJwYTphMGZiYTRhMi1kMjNhLTQ3MjQtYTU5NS1lYmUwNWRjZjJiNmIvYzJwYS5zaWduYXR1cmVqaW5zdGFuY2VJRHgseG1wOmlpZDphOTY5MmNjMC1jZjM1LTQwMzgtOGJmYS0zMTY0ZWU4ZTFkMThyY3JlYXRlZF9hc3NlcnRpb25zg6JjdXJseC1zZWxmI2p1bWJmPWMycGEuYXNzZXJ0aW9ucy9jMnBhLmluZ3JlZGllbnQudjNkaGFzaFggJdoIJrHy3nGrtd0ilBYlIQvQCv/siy9ujPkkac1YJ/SiY3VybHgqc2VsZiNqdW1iZj1jMnBhLmFzc2VydGlvbnMvYzJwYS5hY3Rpb25zLnYyZGhhc2hYIKgk0BJY+fFLRW0AWPiXcCAUDsWwHPoAO5VC6JZUI7BZomN1cmx4KXNlbGYjanVtYmY9YzJwYS5hc3NlcnRpb25zL2MycGEuaGFzaC5kYXRhZGhhc2hYIB/NU/zSarfGwYELWG4Zyk4JbOrmxmbTtFovbg8c9+M6dGNsYWltX2dlbmVyYXRvcl9pbmZvo2RuYW1lb0FudGhyb3BpYyBGaWxlc2d2ZXJzaW9uZTEuMC4wa3NwZWNWZXJzaW9uZTIuNC4wAAAQOGp1bWIAAAAoanVtZGMyY3MAEQAQgAAAqgA4m3EDYzJwYS5zaWduYXR1cmUAAAAQCGNib3LShFkCEqIBJhghWQIKMIICBjCCAY2gAwIBAgIUQOWgCu7COdC+uIP6BkIFPWdVEwAwCgYIKoZIzj0EAwMwSTEXMBUGA1UEChMOQW50aHJvcGljLCBQQkMxLjAsBgNVBAMTJUFudGhyb3BpYyBDb250ZW50IENyZWRlbnRpYWxzIFJvb3QgQ0EwHhcNMjYwODA3MTg0MzU2WhcNMjgwODA2MTk0MzU2WjBEMRcwFQYDVQQKEw5BbnRocm9waWMsIFBCQzEpMCcGA1UEAxMgQW50aHJvcGljIENsYXVkZSBDb250ZW50IFNpZ25pbmcwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAASYegpry1AYBRTVNL1CpTlbROnY3dey+UrsF9C3phYrATN3ZHf93Mo8RQN0KOUuOn19P4oWNFWe5n2/She9N7eTo1gwVjAOBgNVHQ8BAf8EBAMCB4AwFQYDVR0lBA4wDAYKKwYBBAGD6F4CATAMBgNVHRMBAf8EAjAAMB8GA1UdIwQYMBaAFM5R4gSBTmRbI/jjxM+aPpzB11zCMAoGCCqGSM49BAMDA2cAMGQCMDFzHRSeAXrSy1WOzkbhPZ6Km2wGTmZ/2gK18k8BQGXyqz88Rdrz6CTX9flAnYNVxgIwcF9c3fVhqmJKpi+UhasNUMko69cyX6STPfta3Q8EjyzDjzoyrol46FP6VFHhvUcJoWNwYWRZDZ4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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";

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
// ============================================================================
// ZOEKEN OVER LESBOMEN, ONDERWERPEN EN LESSEN (herontwerp §8, chromerij)
//
// Eén platte index over de drie niveaus. Klikken of Enter op een treffer
// springt altijd naar de lesboom (het paneel op Overzicht) en niet naar het
// onderwerp of de les zelf — zo specificeert de zoekresultaten-rij het.
// ============================================================================
function bouwZoekindex(domeinen, topics, voortgang) {
  const rijen = [];
  domeinen.forEach((d) => {
    const domeinTopics = topics.filter((t) => t.domeinId === d.id);
    const klaar = domeinTopics.filter((t) => topicRaatStatus(t, voortgang) === "af").length;
    const begonnen = domeinTopics.some((t) => {
      const s = topicRaatStatus(t, voortgang);
      return s !== "later" && s !== "leeg";
    });
    const boomStatus =
      domeinTopics.length === 0 ? "leeg" : klaar === domeinTopics.length ? "af" : begonnen ? "bezig" : "later";
    rijen.push({ domeinId: d.id, soort: "lesboom", naam: d.naam, pad: d.omschrijving, status: boomStatus });

    domeinTopics.forEach((t, i) => {
      rijen.push({
        domeinId: d.id, soort: "onderwerp", naam: t.titel,
        pad: `${d.naam} › stap ${i + 1}`, status: topicRaatStatus(t, voortgang),
      });
      const gedaan = voortgang[t.id] || 0;
      t.orbs.forEach((orb, oi) => {
        rijen.push({
          domeinId: d.id, soort: "les", naam: orb.titel, pad: `${d.naam} › ${t.titel}`,
          status: oi < gedaan ? "af" : oi === gedaan ? "bezig" : "later",
        });
      });
    });
  });
  return rijen;
}

const ZOEK_SOORT_STIJL = {
  lesboom: { achtergrond: "#FFFCF7", rand: "#E9DED0" },
  onderwerp: { achtergrond: "#FDEED3", rand: "#F6A923" },
  les: { achtergrond: "#FFFFFF", rand: "#E9DED0" },
};

// ============================================================================
// CHROMERIJ (leerkant, overzichtsscherm) — herontwerp §6, §8
//
// Voorlopig alleen boven het lesboomkaarten-scherm; het optrekken tot een
// gedeelde balk boven élk leerscherm (met het instellingenpaneel) is
// opdracht 4 uit HANDOVER.md. Zoeken dekt lesbomen, onderwerpen én lessen op
// naam, pad en soort, en springt altijd naar de lesboom van de treffer.
// ============================================================================
function ChromerijLeren({
  domeinen, topics, voortgang, aantalDue, modus = "leren", magBeheren = true,
  actiefDomeinNaam, opTerug, opHerhalen, opBeheren, opNaarLeren, opSpringNaarDomein, opInstellingen,
}) {
  const [zoekAan, setZoekAan] = useState(false);
  const [term, setTerm] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!zoekAan) return;
    const id = setTimeout(() => inputRef.current && inputRef.current.focus(), 30);
    return () => clearTimeout(id);
  }, [zoekAan]);

  useEffect(() => {
    function bijToets(e) {
      if (e.key === "Escape" && zoekAan) { setZoekAan(false); setTerm(""); }
    }
    window.addEventListener("keydown", bijToets);
    return () => window.removeEventListener("keydown", bijToets);
  }, [zoekAan]);

  const getypt = term.trim().toLowerCase();
  const treffers = getypt
    ? bouwZoekindex(domeinen, topics, voortgang)
        .filter((r) => `${r.naam} ${r.pad} ${r.soort}`.toLowerCase().includes(getypt))
        .slice(0, 7)
    : [];

  function springNaar(domeinId) {
    opSpringNaarDomein(domeinId);
    setZoekAan(false);
    setTerm("");
  }

  return (
    <div className="app-header">
      {modus !== "beheren" && actiefDomeinNaam && <button className="lb-chrome" onClick={opTerug}>‹ Terug</button>}
      <img className="app-logo-vol" src={LOGO_PAD} alt="Schouten Techniek" style={{ height: 34, width: "auto", flex: "none" }} />
      <img className="app-logo-merk" src={BEELDMERK_PAD} alt="Schouten Techniek" style={{ height: 30, width: "auto", flex: "none" }} />
      <div className="app-nav">
        {modus === "beheren" ? (
          <>
            <button type="button" className="lb-chrome" onClick={opNaarLeren}>Naar leren</button>
            <button type="button" className="lb-chrome" data-actief="ja" onClick={opBeheren}>{BEHEER_NAAM}</button>
          </>
        ) : (
          <>
            <button type="button" className="lb-chrome" data-actief="ja" onClick={opNaarLeren}>
              {actiefDomeinNaam || "Leren"}
            </button>
            {magBeheren && <button type="button" className="lb-chrome" onClick={opBeheren}>{BEHEER_NAAM}</button>}
          </>
        )}
        <button type="button" className="lb-chrome" onClick={opHerhalen}>
          Herhalen
          {aantalDue > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "#F6A923", color: "#1D1D1D", fontSize: 10.5, fontWeight: 700 }}>
              {aantalDue}
            </span>
          )}
        </button>

        {!zoekAan ? (
          <button type="button" className="lb-chrome" aria-label="Zoeken" onClick={() => setZoekAan(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={UI.tekstSecundair} strokeWidth="2.75" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" />
            </svg>
            <span className="lb-chrome-bijschrift">Zoeken</span>
          </button>
        ) : (
          <div style={{ position: "relative", flex: "none" }}>
            <div className="lb-zoekveld">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={UI.tekstSecundair} strokeWidth="2.75" strokeLinecap="round" aria-hidden="true" style={{ flex: "none" }}>
                <circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={(e) => { if(e.key === "Enter" && treffers[0]) {e.preventDefault();springNaar(treffers[0].domeinId);} }}
                placeholder="Zoek een lesboom, onderwerp of les"
                aria-label="Zoeken"
                style={{ flex: "1 1 0%", minWidth: 0, border: 0, outline: 0, background: "transparent", fontFamily: "inherit", fontSize: 12.5, color: "#1D1D1D" }}
              />
              <button type="button" className="lb-sluit" aria-label="Zoeken sluiten" style={{ width: 22, height: 22, fontSize: 11 }} onClick={() => { setZoekAan(false); setTerm(""); }}>✕</button>
            </div>
            {getypt && (
              <div style={{ position: "absolute", top: 42, right: 0, zIndex: 60, width: 340, maxHeight: 330, overflowY: "auto", padding: 6, background: "#FFFFFF", border: `1px solid ${UI.randZacht}`, borderRadius: 16, boxShadow: "0 8px 24px rgba(29,29,29,.12)" }}>
                {treffers.length > 0 ? (
                  treffers.map((t, i) => (
                    <button key={i} type="button" className="lb-trefrij" onClick={() => springNaar(t.domeinId)}>
                      <TrefferTegelSvg status={t.status} />
                      <span style={{ flex: "1 1 0%", minWidth: 0, display: "flex", flexDirection: "column", gap: 2, textAlign: "left" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{t.naam}</span>
                        <span style={{ fontSize: 11.5, color: UI.tekstSecundair, lineHeight: 1.3 }}>{t.pad}</span>
                      </span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, flex: "none", padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap", background: ZOEK_SOORT_STIJL[t.soort].achtergrond, border: `1px solid ${ZOEK_SOORT_STIJL[t.soort].rand}`, color: UI.tekstSecundair }}>
                        {t.soort}
                      </span>
                    </button>
                  ))
                ) : (
                  <div style={{ padding: "14px 12px", fontSize: 12.5, color: UI.tekstSecundair, lineHeight: 1.5 }}>
                    Niets gevonden voor "{term.trim()}". Probeer een kortere zoekterm.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <button type="button" className="lb-chrome" aria-label="Instellingen" onClick={opInstellingen}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={UI.tekstSecundair} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M19.4 13.6a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V19.6a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3.6a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9.6a1.65 1.65 0 0 0 1-1.51V3.6a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9.6a1.65 1.65 0 0 0 1.51 1H20.4a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
          <span className="lb-chrome-bijschrift">Instellingen</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// AANMELDEN — herontwerp design/herontwerp/03, afvinklijst §2
//
// Geen echte authenticatie: de velden zijn bewust niet-werkend (net als in de
// vorige modal), maar de rolkeuze schakelt de app nu wél echt om, in plaats
// van alleen een infotekst te tonen.
// ============================================================================
function Aanmelden({ opKiesRol }) {

  return (
    <div style={{ minHeight: "100dvh", boxSizing: "border-box", display: "flex", flexDirection: "column", padding: "26px 26px 34px", backgroundColor: UI.achtergrond, fontFamily: 'Calibri, Carlito, Candara, "Segoe UI", system-ui, Arial, sans-serif' }}>
      <style>{APP_STIJL}</style>
      <img src={LOGO_PAD} alt="Schouten Techniek" style={{ height: 46, width: "auto", display: "block", alignSelf: "flex-start", flexShrink: 0 }} />
      <div style={{ flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative", width: "100%", maxWidth: 420 }}>
            <div style={{ background: UI.kaart, border: `1px solid ${UI.randZacht}`, borderRadius: 22, boxShadow: "0 1px 3px rgba(29,29,29,.05)", padding: "26px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: ST.zilver }}>Leerplatform</span>
                <h1 style={{ margin: 0, fontSize: 23, letterSpacing: "-.01em" }}>Welkom</h1>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <button type="button" className="knop" onClick={() => opKiesRol("lerende")}>Naar mijn lesbomen</button>
                <button type="button" className="knop2" onClick={() => opKiesRol("beheerder")}>Naar {BEHEER_NAAM.toLowerCase()}</button>
              </div>
            </div>
        </div>
      </div>
      <span style={{ fontSize: 11.5, color: ST.zilver }}>Schouten Techniek · Leerplatform</span>
    </div>
  );
}

// ============================================================================
// INSTELLINGENPANEEL — herontwerp §6 (uit de chromerij, opdracht 4)
//
// "Beweging beperken" en "voortgang terugzetten" zijn echt: de eerste zet de
// .lb-rustig-regels aan (dezelfde als prefers-reduced-motion, nu handmatig),
// de tweede wist voortgang en kennis. Notificaties/taal/contrast hebben geen
// backend om aan te haken — dezelfde "komt eraan"-aanpak als het
// aanmeldscherm, niet een verzonnen werking voorspiegelen.
// ============================================================================
function InstellingenRij({ label, toelichting, aan, opWissel, waarde }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</span>
        {opWissel ? (
          <button type="button" className="lb-chrome" data-actief={aan ? "ja" : "nee"} aria-pressed={aan} onClick={opWissel}>
            {aan ? "Aan" : "Uit"}
          </button>
        ) : (
          <span className="lb-chrome" style={{ cursor: "default" }}>{waarde}</span>
        )}
      </div>
      {toelichting && <span style={{ fontSize: 11.5, color: UI.tekstSecundair, lineHeight: 1.4 }}>{toelichting}</span>}
    </div>
  );
}

function InstellingenPaneel({ open, magBeheren, rustig, opWisselRustig, contrast, opWisselContrast, notificaties, opWisselNotificaties, opSluiten, opVoortgangTerugzetten, opBackup, opImport }) {
  const [bevestigen, setBevestigen] = useState(false);

  useEffect(() => {
    if (!open) setBevestigen(false);
  }, [open]);

  useEffect(() => {
    function bijToets(e) {
      if (e.key === "Escape" && open) { e.preventDefault(); e.stopImmediatePropagation(); opSluiten(); }
    }
    window.addEventListener("keydown", bijToets, true);
    return () => window.removeEventListener("keydown", bijToets, true);
  }, [open, opSluiten]);

  return (
    <div className="instellingen-paneel" data-open={open ? "ja" : "nee"} aria-hidden={!open}>
      {open && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: "none" }}>
            <span style={{ fontSize: 17, fontWeight: 700 }}>Instellingen</span>
            <button type="button" className="lb-sluit" aria-label="Instellingen sluiten" onClick={opSluiten}>✕</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, overflow: "auto", flex: "1 1 auto" }}>
            <InstellingenRij
              label="Beweging beperken"
              aan={rustig}
              opWissel={opWisselRustig}
            />
            <InstellingenRij
              label="Notificaties"
              aan={notificaties}
              opWissel={opWisselNotificaties}
            />
            <InstellingenRij label="Taal" waarde="Nederlands" />
            <InstellingenRij
              label="Contrast"
              aan={contrast}
              opWissel={opWisselContrast}
            />
            <InstellingenRij label="AI" waarde="Uitgeschakeld" />
            <InstellingenRij label="Rol" waarde={magBeheren ? "Beheerder" : "Lerende"} />
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <strong style={{fontSize:13.5}}>Je gegevens</strong>
              <button className="knop2" onClick={opBackup}>Back-up downloaden</button>
              <label className="knop2" style={{cursor:"pointer"}}>Back-up terugzetten<input type="file" accept="application/json,.json" style={{position:"absolute",width:1,height:1,opacity:0}} onChange={opImport} /></label>
            </div>

            <div style={{ height: 1, background: "#EFE6DA" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>Voortgang terugzetten</span>
              <span style={{ fontSize: 11.5, color: UI.tekstSecundair, lineHeight: 1.4 }}>
                Zet al je afgeronde lessen en herhaalgeschiedenis terug naar nul. Dit kan niet ongedaan worden gemaakt.
              </span>
              {!bevestigen ? (
                <button type="button" className="knop2" style={{ alignSelf: "flex-start" }} onClick={() => setBevestigen(true)}>
                  Voortgang terugzetten
                </button>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="knop"
                    onClick={() => {
                      opVoortgangTerugzetten();
                      setBevestigen(false);
                    }}
                  >
                    Ja, zet terug
                  </button>
                  <button type="button" className="knop2" onClick={() => setBevestigen(false)}>Annuleren</button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LeerplatformApp() {
  const [modus, setModus] = useState("leren");
  // De rol die bij het aanmelden is gekozen. Dit is een lokale rollendemo en
  // geen beveiliging: wie het bestand kan openen, kan opnieuw laden en dan een
  // andere rol kiezen. Wel bepaalt de rol echt wat er bereikbaar is, zodat de
  // lesvoorbereiding niet per ongeluk in handen van een lerende komt
  // (afvinklijst 11). Echte afscherming vraagt accounts en een server.
  const [rol, setRol] = useState("beheerder");
  const [domeinen, setDomeinen] = useState(START_DOMEINEN);
  const [bronnen, setBronnen] = useState(START_BRONNEN);
  const [topics, setTopics] = useState(START_TOPICS);
  const [geladen, setGeladen] = useState(false);

  const [actiefTopic, setActiefTopic] = useState(null);
  const [actieveOrb, setActieveOrb] = useState(null);
  const [voortgang, setVoortgang] = useState({});   // welke orbs zijn af
  const [kennis, setKennis] = useState({});         // Leitner-doos per vraag
  const [herhalen, setHerhalen] = useState(false);
  const [toonAanmelden, setToonAanmelden] = useState(true);
  // Welke lesboom op het overzicht is opengelegd (het paneel over het
  // kaartenrooster); null = geen enkele.
  const [actiefDomein, setActiefDomein] = useState(null);
  const [instellingenOpen, setInstellingenOpen] = useState(false);
  // "Beweging beperken" uit het instellingenpaneel — een gebruikersvoorkeur,
  // dus hoort bij hetzelfde opslagmoment als leerpadVoorkeuren.
  const [rustig, setRustig] = useState(false);
  const [contrast, setContrast] = useState(false);
  const [notificaties, setNotificaties] = useState(true);
  const [opslagFout, setOpslagFout] = useState("");
  const [importVoorstel, setImportVoorstel] = useState(null);
  // Persoonlijke volgorde van de leerpaden op het overzicht (zie §normaliseer).
  // Hoort bij voortgang/kennis: het is een gebruikersvoorkeur, geen content.
  const [leerpadVoorkeuren, setLeerpadVoorkeuren] = useState({
    volgorde: [],
    gebruik: {},
    handmatig: false,
    vastgezet: [],
  });
  // De Leitner-popup dringt zich op bij binnenkomst als er iets te herhalen is.
  // 'Straks' stelt hem uit, maar na het afronden van een les komt hij terug.
  const [herhaalPopupUitgesteld, setHerhaalPopupUitgesteld] = useState(false);
  // Testklok — alleen om het Leitner-systeem te kunnen verifiëren zonder
  // weken te wachten. Staat op 0 bij elke herstart, telt niet mee in wat er
  // ooit echt wordt uitgerold.
  const nu = Date.now();
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
        setRustig(vg.rustig === true);
        setContrast(vg.contrast === true);
        setNotificaties(vg.notificaties !== false);
      }
      if (leeft) setGeladen(true);
    });
    return () => {
      leeft = false;
    };
  }, []);

  useEffect(() => {
    const meld = () => setOpslagFout("Bewaren in deze browser is mislukt. Download een back-up voordat je dit venster sluit.");
    window.addEventListener("leerplatform-opslagfout", meld);
    return () => window.removeEventListener("leerplatform-opslagfout", meld);
  }, []);

  useEffect(() => {
    if (!geladen) return;

    const momentopname = { voortgang, kennis, leerpadVoorkeuren, rustig, contrast, notificaties };
    voortgangOpslagRij.current = voortgangOpslagRij.current.then(() =>
      bewaarVoortgang(momentopname)
    );
  }, [geladen, voortgang, kennis, leerpadVoorkeuren, rustig, contrast, notificaties]);

  async function slaOp({ domeinen: d, topics: t, bronnen: b }) {
    const nieuweBronnen = b !== undefined ? b : bronnen;
    const gelukt = await bewaren({ domeinen: d, topics: t, bronnen: nieuweBronnen });
    if (!gelukt) { setOpslagFout("De wijziging is niet opgeslagen. Maak ruimte vrij in je browser en probeer opnieuw."); return false; }
    setDomeinen(d);
    setTopics(t);
    setBronnen(nieuweBronnen);
    return true;
  }

  function downloadBackup() {
    const inhoud = {versie:1, datum:new Date().toISOString(), content:{domeinen,topics,bronnen}, leren:{voortgang,kennis,leerpadVoorkeuren,rustig,contrast,notificaties}};
    const url=URL.createObjectURL(new Blob([JSON.stringify(inhoud,null,2)],{type:"application/json"}));
    const a=document.createElement("a"); a.href=url; a.download="leerplatform-backup.json"; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  async function leesBackup(e) {
    const file=e.target.files[0]; if(!file) return;
    try {
      const data=JSON.parse(await file.text());
      const c=data.content;
      if(!c || !Array.isArray(c.domeinen) || !Array.isArray(c.topics) || !c.bronnen || typeof c.bronnen!=="object") throw Error("Geen geldige leerplatform-back-up.");
      if(c.domeinen.some(d=>!d || typeof d.id!=="string" || typeof d.naam!=="string") || c.topics.some(t=>!t || typeof t.id!=="string" || typeof t.titel!=="string" || !Array.isArray(t.orbs))) throw Error("De inhoud van deze back-up is onvolledig.");
      setImportVoorstel(data);
    } catch(err) {setOpslagFout(err.message);}
    e.target.value="";
  }

  async function herstelBackup() {
    if(!importVoorstel) return;
    const data=importVoorstel;
    if(!await slaOp(data.content)) return;
    const vg=data.leren || {};
    setVoortgang(vg.voortgang || {}); setKennis(vg.kennis || {});
    setLeerpadVoorkeuren(normaliseerVoorkeuren(vg.leerpadVoorkeuren));
    setRustig(vg.rustig === true); setContrast(vg.contrast === true); setNotificaties(vg.notificaties === true);
    setActiefDomein(null); setActiefTopic(null); setActieveOrb(null); setHerhalen(false);
    setImportVoorstel(null);
  }

  // Je eigen volgorde van de lesbomen. Zodra je sleept, telt die volgorde en
  // niet meer de automatische "waar je mee bezig bent"-sortering.
  function bewaarVolgorde(ids) {
    setLeerpadVoorkeuren((v) => ({ ...normaliseerVoorkeuren(v), volgorde: ids, handmatig: true }));
  }

  // Vastzetten haalt een lesboom naar voren en houdt hem daar, ook als de
  // automatische volgorde iets anders zou willen.
  function wisselVastgezet(id) {
    setLeerpadVoorkeuren((v) => {
      const vk = normaliseerVoorkeuren(v);
      const vast = vk.vastgezet.includes(id)
        ? vk.vastgezet.filter((x) => x !== id)
        : [...vk.vastgezet, id];
      return { ...vk, vastgezet: vast };
    });
  }

  // "Voortgang terugzetten" uit het instellingenpaneel — echt en onomkeerbaar,
  // niet nog een "komt eraan"-schakelaar.
  function zetVoortgangTerug() {
    setVoortgang({});
    setKennis({});
  }

  function rondOrbAf(topicId, orbIndex) {
    const t = topics.find((x) => x.id === topicId);
    if(t?.orbs?.[orbIndex]?.concept) {setActieveOrb(null);return;}
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

  const topic = actiefTopic ? topics.find((t) => t.id === actiefTopic) : null;
  const domein = topic ? domeinen.find((d) => d.id === topic.domeinId) : null;
  const inLes = topic && domein && actieveOrb !== null;

  const due = vragenDieAanDeBeurtZijn(topics, kennis, nu);

  // Alleen het overzicht krijgt de afgeleide volgorde; beheer, bronnen en
  // generatie blijven met de originele domeinen-array werken.
  const geordendeDomeinen = bepaalGeordendeDomeinen(domeinen, leerpadVoorkeuren);
  const magBeheren = rol === "beheerder";

  // Aanmelden is een volledig scherm (herontwerp §Aanmelden), geen dialoog
  // over de rest van de app — vandaar de vroege return.
  if (toonAanmelden) {
    return (
      <Aanmelden
        opKiesRol={(gekozenRol) => {
          setRol(gekozenRol);
          setModus(gekozenRol === "beheerder" ? "beheren" : "leren");
          setToonAanmelden(false);
        }}
      />
    );
  }

  return (
    <div
      className={`app-shell${rustig ? " lb-rustig" : ""}${contrast ? " app-high-contrast" : ""}`}
      style={{ backgroundColor: UI.achtergrond, fontFamily: 'Calibri, Carlito, Candara, "Segoe UI", system-ui, Arial, sans-serif' }}
    >
      <style>{APP_STIJL}</style>
      <div className="app-layout">
        <ChromerijLeren
          modus={modus}
          domeinen={geordendeDomeinen}
          topics={topics}
          voortgang={voortgang}
          aantalDue={due.length}
          actiefDomeinNaam={domein ? domein.naam : actiefDomein ? (domeinen.find((d) => d.id === actiefDomein) || {}).naam : null}
          opTerug={() => {
            if (herhalen) { setHerhalen(false); return; }
            if (inLes) { setActieveOrb(null); return; }
            if (actiefTopic) { setActiefTopic(null); return; }
            setActiefDomein(null);
          }}
          magBeheren={magBeheren}
          opHerhalen={() => { setModus("leren"); setHerhalen(true); }}
          opBeheren={() => { if (magBeheren) setModus("beheren"); }}
          opNaarLeren={() => {setModus("leren"); setHerhalen(false); setActiefTopic(null); setActieveOrb(null);}}
          opSpringNaarDomein={(id) => { setModus("leren"); setHerhalen(false); setActiefTopic(null); setActieveOrb(null); setActiefDomein(id); }}
          opInstellingen={() => setInstellingenOpen(true)}
        />

        {!geladen && <p className="text-sm text-gray-400">Laden…</p>}
        {opslagFout && <div role="alert" className="app-alert">{opslagFout} <button className="knop2" onClick={downloadBackup}>Back-up downloaden</button><button className="lb-sluit" aria-label="Melding sluiten" onClick={()=>setOpslagFout("")}>×</button></div>}

        {geladen && modus === "beheren" && magBeheren && (
          <BeheerLokaal
            domeinen={domeinen}
            topics={topics}
            bronnen={bronnen}
            opOpslaan={slaOp}
            kennis={kennis}
          />
        )}

        {geladen && modus === "beheren" && !magBeheren && (
          <div className="app-content">
            <div style={KAART_STIJL}>
              <div style={{ margin: "auto", textAlign: "center", display: "flex", flexDirection: "column", gap: 10, alignItems: "center", maxWidth: 380 }}>
                <div style={{ fontSize: 19, fontWeight: 700 }}>{BEHEER_NAAM} is niet beschikbaar</div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: UI.tekstSecundair }}>
                  Wil je lessen toevoegen? Neem contact op met de beheerder.
                </p>
                <button type="button" className="knop" onClick={() => setModus("leren")}>Terug naar leren</button>
              </div>
            </div>
          </div>
        )}

        {geladen && modus === "leren" && (
          <div className="app-content">
            {herhalen ? (
              <Herhaalsessie
                due={due}
                oefenVragen={oefenbareVragen(topics)}
                kennis={kennis}
                domeinen={domeinen}
                opAntwoord={noteerAntwoord}
                opKlaar={() => setHerhalen(false)}
                opNaarLes={(topicId) => {
                  setHerhalen(false);
                  openTopic(topicId);
                }}
              />
            ) : inLes ? (
              <LesLokaal
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
                alleTopics={topics}
                voortgang={voortgang}
                kennis={kennis}
                nu={nu}
                opTerug={() => setActiefTopic(null)}
                opOrbStarten={(tid, oi) => {
                  setActiefTopic(tid);
                  setActieveOrb(oi);
                }}
                opHerhalen={() => setHerhalen(true)}
              />
            ) : (
              <Overzicht
                domeinen={geordendeDomeinen}
                topics={topics}
                voortgang={voortgang}
                kennis={kennis}
                vastgezet={leerpadVoorkeuren.vastgezet || []}
                eigenVolgorde={leerpadVoorkeuren.handmatig === true}
                opVolgorde={bewaarVolgorde}
                opVastWisselen={wisselVastgezet}
                actiefDomein={actiefDomein}
                opDomeinOpen={setActiefDomein}
                opDomeinSluiten={() => setActiefDomein(null)}
                opOrbStarten={(tid, oi) => {
                  setActiefTopic(tid);
                  setActieveOrb(oi);
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* De Leitner-popup: dringt zich op bij binnenkomst als er iets te herhalen is */}
      {geladen &&
        modus === "leren" &&
        !inLes &&
        !herhalen &&
        !actiefTopic &&
        !herhaalPopupUitgesteld &&
        notificaties &&
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

      {(
        <InstellingenPaneel
          open={instellingenOpen}
          magBeheren={magBeheren}
          rustig={rustig}
          opWisselRustig={() => setRustig((v) => !v)}
          contrast={contrast} opWisselContrast={()=>setContrast(v=>!v)}
          notificaties={notificaties} opWisselNotificaties={()=>setNotificaties(v=>!v)}
          opBackup={downloadBackup} opImport={leesBackup}
          opSluiten={() => setInstellingenOpen(false)}
          opVoortgangTerugzetten={zetVoortgangTerug}
        />
      )}
      {importVoorstel && <div role="dialog" aria-modal="true" aria-label="Back-up terugzetten" style={{position:"fixed",inset:0,zIndex:90,display:"grid",placeItems:"center",background:"rgba(29,29,29,.3)",padding:20}}><div style={{background:UI.kaart,borderRadius:22,padding:24,maxWidth:430}}><h2 style={{fontSize:17,fontWeight:700}}>Back-up terugzetten?</h2><p style={{fontSize:13.5,margin:"12px 0"}}>Dit vervangt de inhoud en voortgang in deze browser door {importVoorstel.content.domeinen.length} lesbomen en {importVoorstel.content.topics.length} onderwerpen. Download eerst je huidige back-up als je die wilt bewaren.</p><div className="app-actions"><button className="knop" onClick={herstelBackup}>Terugzetten</button><button className="knop2" onClick={()=>setImportVoorstel(null)}>Annuleren</button></div></div></div>}
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
  if (!v || typeof v !== "object") return { volgorde: [], gebruik: {}, handmatig: false, vastgezet: [] };
  return {
    volgorde: Array.isArray(v.volgorde) ? v.volgorde.filter((id) => typeof id === "string") : [],
    gebruik: v.gebruik && typeof v.gebruik === "object" ? v.gebruik : {},
    handmatig: v.handmatig === true,
    vastgezet: Array.isArray(v.vastgezet) ? v.vastgezet.filter((id) => typeof id === "string") : [],
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

// Lokale lesvoorbereiding: dezelfde lesbomen als aan de leerkant, met echte opslag.
function BeheerLokaal({domeinen, topics, bronnen, opOpslaan}) {
  const [tab, setTab] = useState('lesbomen');
  const [actiefId, setActiefId] = useState(null);
  const [topicId, setTopicId] = useState(null);
  const [wizard, setWizard] = useState(false);
  const [lesWizard, setLesWizard] = useState(false);
  const [sortering, setSortering] = useState('naam');
  const actief = domeinen.find(d=>d.id===actiefId);
  const topic = topics.find(t=>t.id===topicId);
  const lijst = sorteerBeheerLesbomen(domeinen.map(d=>beheerLesboomInfo(d,topics)),sortering);
  useEffect(()=>{
    const escape=e=>{
      if(e.key!=='Escape' || e.defaultPrevented) return;
      e.preventDefault();
      if(lesWizard) setLesWizard(false); else if(wizard) setWizard(false); else if(topicId) setTopicId(null); else setActiefId(null);
    };
    window.addEventListener('keydown',escape);
    return ()=>window.removeEventListener('keydown',escape);
  },[wizard,lesWizard,topicId]);
  function wisselTab(naam) {setTab(naam);setActiefId(null);setTopicId(null);setWizard(false);setLesWizard(false);}
  return <section className="app-content beheer-lokaal">
    <div style={KAART_STIJL}>
      <header className="app-card-head" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:14,flex:'none'}}>
        <div><h1 style={{fontSize:23,fontWeight:700,letterSpacing:'-.02em',margin:0}}>{BEHEER_NAAM}</h1><p style={{fontSize:12.5,color:UI.tekstSecundair,marginTop:3}}>{domeinen.length} lesbomen · {topics.length} onderwerpen</p></div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          {tab==='lesbomen' && topics.length>0 && <button type="button" className="lb-chrome" onClick={()=>setLesWizard(true)}>+ Les toevoegen</button>}
          {tab==='lesbomen' && <SorteerMenu opties={BEHEER_SORTERINGEN} waarde={sortering} opKies={setSortering} />}
          <div role="tablist" aria-label={BEHEER_NAAM} style={{display:'flex',gap:4,padding:4,borderRadius:999,background:UI.kaartZacht,border:`1px solid ${UI.randZacht}`}}>
            {['lesbomen','bronnen'].map(t=><button key={t} role="tab" aria-selected={tab===t} className="lb-chrome" data-actief={tab===t?'ja':'nee'} onClick={()=>wisselTab(t)}>{t==='lesbomen'?'Lesbomen':'Bronnen'}</button>)}
          </div>
        </div>
      </header>
      <div style={{flex:'1 1 0%',minHeight:0,overflow:'auto'}}>
        {tab==='bronnen' ? <BronBeheer key={actiefId || 'alle'} domeinen={domeinen} topics={topics} bronnen={bronnen} opOpslaan={opOpslaan} startDomeinId={actiefId} /> :
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(min(238px,100%),1fr))',gap:12}}>
          {lijst.map(lb=><button key={lb.domein.id} className="lb-kaartje" onClick={()=>setActiefId(lb.domein.id)}>
            <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:11,height:11,borderRadius:999,background:lb.domein.kleur,flex:'none'}}/><strong style={{fontSize:14.5,flex:'1 1 0%',minWidth:0,overflowWrap:'anywhere'}}>{lb.domein.naam}</strong><span style={BEHEER_PIL_STIJL(lb.pil)}>{BEHEER_PIL_LABEL[lb.pil]}</span></div>
            <p style={{fontSize:12,color:UI.tekstSecundair,minHeight:36}}>{lb.domein.omschrijving}</p>
            <MiniRaat raat={lb.raat}/><span style={{fontSize:12,color:UI.tekstSecundair}}>{lb.totaal} onderwerpen · {lb.aantalLessen} lessen</span>
          </button>)}
          <button className="lb-kaartje" style={{minHeight:190,borderStyle:'dashed',justifyContent:'center'}} onClick={()=>{setActiefId(null);setWizard(true);}}><span style={{fontSize:25,color:ST.oranje}}>+</span><strong>Maak een nieuwe lesboom</strong><span style={{fontSize:12,color:UI.tekstSecundair}}>Werk je bronmateriaal uit in zeven stappen.</span></button>
        </div>}
      </div>
    </div>
    {actief && tab==='lesbomen' && !wizard && <div className="lb-paneel" data-open="ja" style={{padding:22,gap:16}}>
      <header style={{display:'flex',gap:12,flex:'none',alignItems:'center'}}><div style={{flex:1}}><p style={{fontSize:11,color:UI.tekstSecundair}}>LESBOMEN › {actief.naam}</p><h2 style={{fontSize:23,fontWeight:700}}>{actief.naam}</h2><p style={{fontSize:13,color:UI.tekstSecundair}}>{actief.omschrijving}</p></div><button className="lb-sluit" aria-label="Lesboom sluiten" onClick={()=>{setActiefId(null);setTopicId(null);}}>×</button></header>
      <div className="app-columns">
        <div style={{flex:'1 1 0%',minWidth:0,overflow:'auto',background:UI.kaartZacht,border:`1px solid ${UI.randZacht}`,borderRadius:18,padding:18}}>
          {topic ? <><button className="knop2" onClick={()=>setTopicId(null)}>‹ Onderwerpen</button><h3 style={{fontSize:17,fontWeight:700,margin:'16px 0'}}>{topic.titel}</h3><BestaandeOrbsBeheer topic={topic} domeinen={domeinen} topics={topics} bronnen={bronnen} opOpslaan={opOpslaan}/></> :
          <><MiniRaat raat={beheerLesboomInfo(actief,topics).raat}/><div style={{display:'flex',flexDirection:'column',gap:8,marginTop:16}}>{topics.filter(t=>t.domeinId===actiefId).map(t=><button key={t.id} className="lb-lesrij" style={ORB_RIJ_STIJL(null)} onClick={()=>setTopicId(t.id)}><span style={{flex:1,textAlign:'left',fontWeight:700,fontSize:13.5}}>{t.titel}</span><span style={{fontSize:12}}>{t.orbs.length} lessen</span></button>)}</div></>}
        </div>
        <aside className="app-sidebar" style={{background:UI.kaartZacht,border:`1px solid ${UI.randZacht}`,borderRadius:18,padding:18,display:'flex',flexDirection:'column',gap:12,overflow:'auto'}}><h3 style={{fontSize:17,fontWeight:700}}>Deze lesboom beheren</h3><p style={{fontSize:13,color:UI.tekstSecundair}}>{(bronnen[actiefId]||[]).length} {(bronnen[actiefId]||[]).length===1?'bron':'bronnen'}</p><button className="knop" onClick={()=>setLesWizard(true)}>Les toevoegen</button><button className="knop2" onClick={()=>setWizard(true)}>Onderwerp toevoegen</button><button className="knop2" onClick={()=>{setTab('bronnen');setTopicId(null);}}>Bronnen bekijken</button></aside>
      </div>
    </div>}
    {wizard && <HandmatigeWizard domeinen={domeinen} topics={topics} bronnen={bronnen} domeinId={actiefId} opOpslaan={opOpslaan} opSluiten={()=>setWizard(false)}/>}
    {lesWizard && <LesToevoegen domeinen={domeinen} topics={topics} bronnen={bronnen} domeinId={actiefId||''} opOpslaan={opOpslaan} opSluiten={()=>setLesWizard(false)}/>}
  </section>;
}


// ============================================================================
// LES TOEVOEGEN AAN EEN BESTAAND ONDERWERP
//
// De wizard hiernaast maakt altijd een nieuw onderwerp aan. Voor "er ontbreekt
// nog één les bij dit onderwerp" was dat te veel: dan moest je een onderwerp
// verzinnen dat je niet wilde. Deze vier stappen voegen alleen een les toe en
// laten de bestaande lesboom, volgorde en voortgang ongemoeid (afvinklijst 12).
// ============================================================================
const LES_STAPPEN = ["Plaats", "Lesinhoud", "Vraag", "Nakijken"];

function LesToevoegen({ domeinen, topics, bronnen, domeinId, opOpslaan, opSluiten }) {
  const [stap, setStap] = useState(0);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [d, setD] = useState({
    domeinId: domeinId || "", topicId: "",
    lestitel: "", les: "", onthoud: "",
    vraag: "", opties: ["", "", "", ""], juisteIndex: 0, uitleg: "",
  });
  const wijzig = (veld, waarde) => setD((v) => ({ ...v, [veld]: waarde }));

  const gekozenTopics = topics.filter((t) => t.domeinId === d.domeinId);
  const topic = topics.find((t) => t.id === d.topicId);
  const blokken = d.les.trim() ? d.les.trim().split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean) : [];
  const opties = d.opties.map((o) => o.trim());

  const geldig = [
    !!d.domeinId && !!d.topicId,
    d.lestitel.trim().length >= 3 && d.les.trim().length >= 30,
    d.vraag.trim().length >= 8 && opties.filter(Boolean).length >= 2 && !!opties[Number(d.juisteIndex)] && d.uitleg.trim().length >= 5,
    true,
  ];

  // Voortgang wordt geteld als "aantal afgeronde lessen ≥ aantal lessen". Een
  // les erbij bij een afgerond onderwerp zet dat onderwerp dus terug op bezig.
  // Dat is juist, maar de lesvoorbereider moet het van tevoren weten.
  const zetVoortgangTerug = !!topic && topic.orbs.length > 0 && !topic.orbs.some((o) => o.concept);

  async function publiceer() {
    if (bezig || !geldig.every(Boolean) || !topic) return;
    setBezig(true);
    setFout("");
    const uid = crypto.randomUUID();
    const nieuweOrb = {
      id: "les-" + uid,
      titel: d.lestitel.trim(),
      blokken: blokken.map((tekst, i) => ({
        type: "tekst",
        tekst,
        ...(i === blokken.length - 1 && d.onthoud.trim() ? { onthoud: d.onthoud.trim() } : {}),
      })),
      vragen: [{
        id: "vraag-" + uid, type: "meerkeuze", vraag: d.vraag.trim(),
        opties: opties.filter(Boolean), juisteIndex: Number(d.juisteIndex), uitleg: d.uitleg.trim(),
      }],
      publicatieAudit: { bronStatus: "handmatig", redactieStatus: "handmatig", gecontroleerdOp: new Date().toISOString() },
    };
    const nieuweTopics = topics.map((t) => (t.id === topic.id ? { ...t, orbs: [...t.orbs, nieuweOrb] } : t));
    try {
      if (await opOpslaan({ domeinen, topics: nieuweTopics, bronnen }) === false) {
        throw Error("Opslaan is mislukt. Je invoer staat nog in dit venster.");
      }
      opSluiten();
    } catch (e) {
      setFout(e.message);
    } finally {
      setBezig(false);
    }
  }

  function veld(label, naam, multi = false, hint = "") {
    return (
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5, fontWeight: 600 }}>
        {label}
        {multi
          ? <textarea aria-label={label} rows={8} value={d[naam]} onChange={(e) => wijzig(naam, e.target.value)}
              style={{ fontFamily: "inherit", fontSize: 13.5, fontWeight: 400, lineHeight: 1.55, padding: "10px 14px", borderRadius: 14, border: `1px solid ${UI.randZacht}`, resize: "vertical" }} />
          : <input aria-label={label} value={d[naam]} onChange={(e) => wijzig(naam, e.target.value)}
              style={{ ...BRON_VELD_STIJL, fontFamily: "inherit", fontSize: 13.5, fontWeight: 400, padding: "0 14px" }} />}
        {hint && <span style={{ fontSize: 12, fontWeight: 400, color: UI.tekstSecundair }}>{hint}</span>}
      </label>
    );
  }

  return (
    <div className="lb-paneel" data-open="ja" style={{ padding: 22, gap: 16 }}>
      <header style={{ display: "flex", gap: 12, alignItems: "flex-start", flex: "none" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: ST.zilver, margin: 0 }}>
            Les toevoegen · stap {stap + 1} van {LES_STAPPEN.length}
          </p>
          <h2 style={{ fontSize: 19, fontWeight: 700, margin: "4px 0 0" }}>{LES_STAPPEN[stap]}</h2>
        </div>
        <button type="button" className="lb-sluit kaart-sluit" aria-label="Les toevoegen sluiten" onClick={opSluiten}>✕</button>
      </header>

      <nav aria-label="Stappen" style={{ display: "flex", gap: 8, flex: "none", flexWrap: "wrap" }}>
        {LES_STAPPEN.map((naam, i) => (
          <button key={naam} type="button" className="lb-chrome" aria-current={i === stap ? "step" : undefined}
            data-actief={i === stap ? "ja" : "nee"} disabled={i > stap && !geldig.slice(0, i).every(Boolean)}
            onClick={() => setStap(i)}>
            {i + 1}. {naam}
          </button>
        ))}
      </nav>

      <div style={{ flex: "1 1 0%", minHeight: 0, overflow: "auto", padding: 20, borderRadius: 18, background: UI.kaartZacht, border: `1px solid ${UI.randZacht}`, display: "flex", flexDirection: "column", gap: 16 }}>
        {stap === 0 && (
          <>
            <label style={{ fontSize: 13.5, fontWeight: 600, display: "flex", flexDirection: "column", gap: 6 }}>
              Lesboom
              <select aria-label="Lesboom" value={d.domeinId} onChange={(e) => { wijzig("domeinId", e.target.value); wijzig("topicId", ""); }}
                style={{ ...BRON_VELD_STIJL, fontFamily: "inherit", fontSize: 13.5, fontWeight: 400, padding: "0 12px" }}>
                <option value="">Kies een lesboom</option>
                {domeinen.map((dom) => <option key={dom.id} value={dom.id}>{dom.naam}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 13.5, fontWeight: 600, display: "flex", flexDirection: "column", gap: 6 }}>
              Onderwerp
              <select aria-label="Onderwerp" value={d.topicId} disabled={!d.domeinId} onChange={(e) => wijzig("topicId", e.target.value)}
                style={{ ...BRON_VELD_STIJL, fontFamily: "inherit", fontSize: 13.5, fontWeight: 400, padding: "0 12px" }}>
                <option value="">Kies een onderwerp</option>
                {gekozenTopics.map((t) => (
                  <option key={t.id} value={t.id}>{t.titel} ({t.orbs.length} {t.orbs.length === 1 ? "les" : "lessen"})</option>
                ))}
              </select>
            </label>
            {d.domeinId && gekozenTopics.length === 0 && (
              <p style={{ fontSize: 12.5, color: UI.tekstSecundair, margin: 0 }}>
                Deze lesboom heeft nog geen onderwerpen. Maak er eerst één met 'Onderwerp toevoegen'.
              </p>
            )}
            {topic && (
              <div style={{ background: UI.kaart, border: `1px solid ${UI.randZacht}`, borderRadius: 14, padding: "12px 14px" }}>
                <p style={{ margin: 0, fontSize: 12.5, color: UI.tekstSecundair }}>De nieuwe les komt achteraan in dit onderwerp:</p>
                <ol style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 13 }}>
                  {topic.orbs.map((o) => <li key={o.id} style={{ marginTop: 3 }}>{o.titel}{o.concept ? " (lesopzet)" : ""}</li>)}
                  <li style={{ marginTop: 3, fontWeight: 700, color: "#B87B12" }}>{d.lestitel.trim() || "je nieuwe les"}</li>
                </ol>
              </div>
            )}
          </>
        )}

        {stap === 1 && (
          <>
            {veld("Titel van de les", "lestitel")}
            {veld("Lesinhoud", "les", true, "Een lege regel begint een nieuw leesblok. Schrijf minstens dertig tekens.")}
            {veld("Onthoud dit (optioneel)", "onthoud", false, "Eén zin die de lerende moet onthouden. Komt onder het laatste leesblok.")}
          </>
        )}

        {stap === 2 && (
          <>
            {veld("Controlevraag", "vraag")}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {d.opties.map((optie, i) => (
                <label key={i} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13.5 }}>
                  <input type="radio" name="juist" checked={Number(d.juisteIndex) === i} onChange={() => wijzig("juisteIndex", i)}
                    aria-label={`Antwoord ${VRAAG_LETTERS[i]} is juist`} />
                  <input aria-label={`Antwoord ${VRAAG_LETTERS[i]}`} value={optie} placeholder={`Antwoord ${VRAAG_LETTERS[i]}`}
                    onChange={(e) => wijzig("opties", d.opties.map((o, j) => (j === i ? e.target.value : o)))}
                    style={{ ...BRON_VELD_STIJL, flex: "1 1 0%", minWidth: 0, fontFamily: "inherit", fontSize: 13.5, padding: "0 14px" }} />
                </label>
              ))}
            </div>
            {veld("Uitleg na het antwoord", "uitleg", true, "Wat de lerende leest na het antwoorden, ook bij een goed antwoord.")}
          </>
        )}

        {stap === 3 && (
          <>
            <p style={{ margin: 0, fontSize: 12.5, color: UI.tekstSecundair }}>
              {(domeinen.find((x) => x.id === d.domeinId) || {}).naam} › {topic ? topic.titel : ""}
            </p>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{d.lestitel}</h3>
            {blokken.map((tekst, i) => <p key={i} style={{ fontSize: 13.5, whiteSpace: "pre-wrap", maxWidth: "64ch", margin: 0, lineHeight: 1.55 }}>{tekst}</p>)}
            {d.onthoud.trim() && <OnthoudKader tekst={d.onthoud.trim()} />}
            <div style={{ background: UI.kaart, border: `1px solid ${UI.randZacht}`, borderRadius: 14, padding: "12px 14px" }}>
              <strong style={{ fontSize: 13.5 }}>{d.vraag}</strong>
              <ul style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 13 }}>
                {opties.map((o, i) => o && (
                  <li key={i} style={{ marginTop: 3, fontWeight: Number(d.juisteIndex) === i ? 700 : 400 }}>
                    {o}{Number(d.juisteIndex) === i ? " · juist" : ""}
                  </li>
                ))}
              </ul>
              <p style={{ margin: "8px 0 0", fontSize: 12.5, color: UI.tekstSecundair }}>{d.uitleg}</p>
            </div>
            {zetVoortgangTerug && (
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, background: "#FDEED3", border: `1px solid ${ST.oranje}`, borderRadius: 14, padding: "10px 14px" }}>
                Dit onderwerp was compleet en komt na publiceren weer op 'bezig' te staan.
              </p>
            )}
          </>
        )}

        {fout && <p role="alert" className="app-alert">{fout}</p>}
      </div>

      <footer className="app-actions">
        <button type="button" className="knop2" disabled={stap === 0 || bezig} onClick={() => setStap((v) => v - 1)}>Vorige</button>
        {stap < LES_STAPPEN.length - 1
          ? <button type="button" className="knop" disabled={!geldig[stap]} onClick={() => setStap((v) => v + 1)}>Volgende</button>
          : <button type="button" className="knop" disabled={bezig || !geldig.every(Boolean)} onClick={publiceer}>Les publiceren</button>}
        <button type="button" className="knop2" onClick={opSluiten}>Annuleren</button>
      </footer>
    </div>
  );
}

const WIZARD_STAPPEN=['Onderwerp','Leerdoel','Bronnen','Structuur','Lesinhoud','Vragen','Publiceren'];
function HandmatigeWizard({domeinen,topics,bronnen,domeinId,opOpslaan,opSluiten}) {
  const [stap,setStap]=useState(0);
  const [fout,setFout]=useState('');
  const [bezig,setBezig]=useState(false);
  const [d,setD]=useState({domeinId:domeinId||'',naam:'',omschrijving:'',titel:'',leerdoel:'',bronIds:[],voorganger:'',lestitel:'',les:'',vraag:'',opties:['','','',''],juisteIndex:0,uitleg:''});
  const wijzig=(veld,waarde)=>setD(v=>({...v,[veld]:waarde}));
  const huidigeBronnen=bronnen[d.domeinId]||[];
  const geldig=[!!(d.domeinId||d.naam.trim().length>=2)&&d.titel.trim().length>=3,d.leerdoel.trim().length>=10,d.bronIds.length>0 || huidigeBronnen.length===0,true,d.lestitel.trim().length>=3&&d.les.trim().length>=30,d.vraag.trim().length>=8&&d.opties.every(o=>o.trim().length>0)&&new Set(d.opties.map(o=>o.trim().toLowerCase())).size===4&&d.uitleg.trim().length>=10];
  async function publiceer() {
    if(bezig || !geldig.every(Boolean)) return;
    setBezig(true);setFout('');
    const uid=crypto.randomUUID(); const domId=d.domeinId||'domein-'+uid;
    const plaats=berekenPlaatsing(topics,domId,d.voorganger||null);
    const nieuw={id:'topic-'+uid,domeinId:domId,...plaats,titel:d.titel.trim(),ondertitel:d.leerdoel.trim(),orbs:[{id:'les-'+uid,titel:d.lestitel.trim(),blokken:d.les.trim().split(/\n\s*\n/).map(tekst=>({type:'tekst',tekst:tekst.trim()})),vragen:[{id:'vraag-'+uid,type:'meerkeuze',vraag:d.vraag.trim(),opties:d.opties.map(o=>o.trim()),juisteIndex:Number(d.juisteIndex),uitleg:d.uitleg.trim()}],bronVerwijzingen:d.bronIds.map(bronId=>({bronId})),publicatieAudit:{bronStatus:'handmatig',redactieStatus:'handmatig',gecontroleerdOp:new Date().toISOString()}}]};
    const ds=d.domeinId?domeinen:[...domeinen,{id:domId,naam:d.naam.trim(),omschrijving:d.omschrijving.trim(),kleur:ST.oranje}];
    try {if(await opOpslaan({domeinen:ds,topics:[...topics,nieuw],bronnen})===false) throw Error('Opslaan is mislukt. Je invoer staat nog in dit venster.');opSluiten();}catch(e){setFout(e.message);}finally{setBezig(false);}
  }
  function veld(label,naam,multi=false) {return <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:13.5,fontWeight:600}}>{label}{multi?<textarea aria-label={label} value={d[naam]} onChange={e=>wijzig(naam,e.target.value)} rows={naam==='les'?9:3} style={{...BRON_VELD_STIJL,height:'auto',borderRadius:14,padding:14,lineHeight:1.55}}/>:<input aria-label={label} value={d[naam]} onChange={e=>wijzig(naam,e.target.value)} style={BRON_VELD_STIJL}/>}</label>}
  return <div className="lb-paneel" data-open="ja" style={{padding:22,gap:16}}>
    <header style={{display:'flex',gap:12,alignItems:'center',flex:'none'}}><div style={{flex:1}}><p style={{fontSize:11,color:UI.tekstSecundair}}>HANDMATIG OPBOUWEN · STAP {stap+1} VAN 7</p><h2 style={{fontSize:23,fontWeight:700}}>{d.titel||'Nieuwe lesboom'}</h2></div><button className="lb-sluit" aria-label="Wizard sluiten" disabled={bezig} onClick={opSluiten}>×</button></header>
    <nav aria-label="Stappen" style={{display:'flex',gap:8,flex:'none',overflowX:'auto',padding:4}}>{WIZARD_STAPPEN.map((naam,i)=><button key={naam} className="lb-chrome" aria-current={i===stap?'step':undefined} data-actief={i===stap?'ja':'nee'} disabled={bezig || geldig.slice(0,i).some(v=>!v)} onClick={()=>setStap(i)} style={{gap:6}}><svg width="20" height="22" viewBox="-42 -42 84 84" aria-hidden="true"><path d={RAAT_HEX_PAD} fill={i<stap?UI.succesZacht:'#FFFFFF'} stroke={i===stap?ST.oranje:UI.randZacht} strokeWidth="4"/></svg>{i+1}. {naam}</button>)}</nav>
    <div className="app-columns">
      <div style={{flex:'1 1 0%',minWidth:0,overflow:'auto',padding:20,borderRadius:18,background:UI.kaartZacht,border:`1px solid ${UI.randZacht}`,display:'flex',flexDirection:'column',gap:16}}>
        {stap===0&&<><label style={{fontSize:13.5}}>Lesboom<select aria-label="Lesboom" value={d.domeinId} onChange={e=>{wijzig('domeinId',e.target.value);wijzig('voorganger','');wijzig('bronIds',[]);}} style={BRON_VELD_STIJL}><option value="">Nieuwe lesboom</option>{domeinen.map(dom=><option key={dom.id} value={dom.id}>{dom.naam}</option>)}</select></label>{!d.domeinId&&<>{veld('Naam van de lesboom','naam')}{veld('Omschrijving','omschrijving')}</>}{veld('Naam van het onderwerp','titel')}</>}
        {stap===1&&<>{veld('Wat kan de lerende na deze les?','leerdoel',true)}<p style={{fontSize:12,color:UI.tekstSecundair}}>Formuleer een concreet leerdoel in minstens tien tekens.</p></>}
        {stap===2&&<><h3 style={{fontSize:17,fontWeight:700}}>Bronnen bij deze les</h3>{huidigeBronnen.length?huidigeBronnen.map(b=><label key={b.id} style={ORB_RIJ_STIJL(null)}><input type="checkbox" checked={d.bronIds.includes(b.id)} onChange={e=>wijzig('bronIds',e.target.checked?[...d.bronIds,b.id]:d.bronIds.filter(id=>id!==b.id))}/><span style={{fontSize:13.5}}>{b.naam}</span></label>):<p style={{fontSize:13,color:UI.tekstSecundair}}>Er zijn nog geen bronnen gekoppeld. Je kunt deze les handmatig invoeren; je blijft zelf verantwoordelijk voor de inhoudelijke controle. Bronnen voeg je toe via het tabblad Bronnen.</p>}</>}
        {stap===3&&<><h3 style={{fontSize:17,fontWeight:700}}>Plaats in de lesboom</h3><label style={{fontSize:13.5}}>Welk onderwerp komt eerst?<select aria-label="Voorgaand onderwerp" style={BRON_VELD_STIJL} value={d.voorganger} onChange={e=>wijzig('voorganger',e.target.value)}><option value="">Geen — dit is een startonderwerp</option>{topics.filter(t=>t.domeinId===d.domeinId).map(t=><option key={t.id} value={t.id}>{t.titel}</option>)}</select></label><p style={{fontSize:13,color:UI.tekstSecundair}}>Deze invoer maakt één onderwerp met één les. Via de lesboom kun je later meer onderwerpen toevoegen en de les bewerken.</p></>}
        {stap===4&&<>{veld('Titel van de les','lestitel')}{veld('Lesinhoud','les',true)}<p style={{fontSize:12,color:UI.tekstSecundair}}>Een lege regel begint een nieuw leesblok. Schrijf minstens dertig tekens.</p></>}
        {stap===5&&<>{veld('Controlevraag','vraag')}<div style={{display:'flex',flexDirection:'column',gap:10}}>{d.opties.map((optie,i)=><label key={i} style={{display:'flex',gap:10,alignItems:'center'}}><input type="radio" name="juist-antwoord" aria-label={`Antwoord ${VRAAG_LETTERS[i]} is juist`} checked={Number(d.juisteIndex)===i} onChange={()=>wijzig('juisteIndex',i)}/><span>{VRAAG_LETTERS[i]}</span><input aria-label={`Antwoord ${VRAAG_LETTERS[i]}`} value={optie} onChange={e=>wijzig('opties',d.opties.map((o,j)=>i===j?e.target.value:o))} style={BRON_VELD_STIJL}/></label>)}</div>{veld('Uitleg van het juiste antwoord','uitleg',true)}<p style={{fontSize:12,color:UI.tekstSecundair}}>Kies het juiste antwoord met het rondje. Gebruik vier verschillende antwoorden.</p></>}
        {stap===6&&<><h3 style={{fontSize:17,fontWeight:700}}>Nakijken en publiceren</h3><strong>{d.lestitel}</strong><p style={{fontSize:13.5,whiteSpace:'pre-wrap',maxWidth:'64ch'}}>{d.les}</p><strong>{d.vraag}</strong>{d.opties.map((o,i)=><p key={i} style={{fontSize:13.5,color:i===Number(d.juisteIndex)?UI.succes:ST.donker}}>{VRAAG_LETTERS[i]}. {o}{i===Number(d.juisteIndex)?' ✓':''}</p>)}<p style={{fontSize:13,color:UI.tekstSecundair}}>{d.uitleg}</p><p style={{fontSize:12}}>Met publiceren bevestig je dat je de les en de antwoorden zelf hebt gecontroleerd.</p></>}
        {fout&&<p role="alert" className="app-alert">{fout}</p>}
      </div>
      <aside className="app-sidebar" style={{padding:18,background:UI.kaartZacht,border:`1px solid ${UI.randZacht}`,borderRadius:18,overflow:'auto'}}><h3 style={{fontSize:17,fontWeight:700}}>{WIZARD_STAPPEN[stap]}</h3><p style={{fontSize:13,color:UI.tekstSecundair,marginTop:12,lineHeight:1.55}}>AI is uitgeschakeld. Je eigen tekst blijft leidend en wordt lokaal bewaard wanneer je publiceert.</p><p style={{fontSize:12,color:UI.tekstSecundair,marginTop:12}}>Sluit deze wizard pas wanneer je klaar bent; nog niet gepubliceerde invoer wordt niet bewaard.</p></aside>
    </div>
    <footer className="app-actions"><button className="knop2" disabled={stap===0||bezig} onClick={()=>setStap(s=>s-1)}>Vorige</button>{stap<6?<button className="knop" disabled={!geldig[stap]} onClick={()=>setStap(s=>s+1)}>Volgende</button>:<button className="knop" disabled={bezig||!geldig.every(Boolean)} onClick={publiceer}>{bezig?'Opslaan…':'Publiceer les'}</button>}</footer>
  </div>;
}

// Lokaal beheer staat na de opschoning in leerplatform.jsx.

// Het "Onthoud dit"-kader uit de ontwerpschermen: de kern van een leesblok,
// apart gezet zodat je die later terugvindt zonder het blok te herlezen.
function OnthoudKader({ tekst }) {
  return (
    <div style={{ marginTop: 16, background: UI.achtergrond, border: `1px solid ${UI.randZacht}`, borderRadius: 14, padding: "13px 16px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ST.zilver }}>
        Onthoud dit
      </div>
      <div style={{ fontSize: 13.5, marginTop: 6, maxWidth: "60ch", lineHeight: 1.55 }}>{tekst}</div>
    </div>
  );
}

// AI-hulp bij een stuk lestekst dat de lerende zelf heeft geselecteerd.
// De koppeling met een AI-dienst staat bewust uit: er wordt niets verstuurd en
// er worden geen antwoorden verzonnen. Het paneel laat wel precies zien welke
// tekst straks als context zou meegaan, en maakt duidelijk dat een antwoord de
// les nooit zelf verandert (afvinklijst 7).
function AiHulpPaneel({ citaat, opCitaatWeg, opSluiten }) {
  return (
    <div style={{ flex: "none", marginTop: 14, background: UI.kaart, border: `1px solid ${ST.oranje}`, borderRadius: 14, padding: "13px 15px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ST.zilver }}>
          {citaat ? "AI-hulp bij je selectie" : "AI-hulp"}
        </div>
        <button type="button" className="lb-sluit" aria-label="AI-hulp sluiten" style={{ marginLeft: "auto", width: 24, height: 24, fontSize: 12 }} onClick={opSluiten}>✕</button>
      </div>

      {citaat && (
        <div style={{ display: "flex", gap: 9, marginTop: 9, padding: "9px 12px", background: UI.kaartZacht, border: `1px solid ${UI.randZacht}`, borderRadius: 12 }}>
          <span style={{ flex: "none", width: 3, borderRadius: 999, background: ST.oranje }} />
          <span style={{ flex: "1 1 0%", minWidth: 0, fontSize: 12.5, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{citaat}</span>
          <button type="button" className="lb-sluit" aria-label="Selectie losmaken" style={{ width: 20, height: 20, fontSize: 10 }} onClick={opCitaatWeg}>✕</button>
        </div>
      )}

      <p role="status" style={{ margin: "10px 0 0", fontSize: 12.5, color: UI.tekstSecundair }}>
        AI-hulp is nog niet beschikbaar.
      </p>
    </div>
  );
}

function LesLokaal({topic,domein,orbIndex,opAfronden,opAfbreken,opVraagBeantwoord}) {
  const les=topic.orbs[orbIndex];
  const stappen=[...(les?.blokken||[]).map(blok=>({blok})),...(les?.vragen||[]).filter(vraagIsHeel).map(vraag=>({vraag}))];
  const [index,setIndex]=useState(0);
  const [bereikt,setBereikt]=useState(0);
  const [antwoorden,setAntwoorden]=useState({});
  const [gekozen,setGekozen]=useState(null);
  const [poging,setPoging]=useState(0);
  const geteld=useRef(new Set());
  const leesRef=useRef(null);
  const [selectie,setSelectie]=useState(null);   // {tekst,x,y} van de zwevende pil
  const [citaat,setCitaat]=useState(null);       // de tekst waar hulp bij gevraagd is
  const [aiOpen,setAiOpen]=useState(false);
  const stap=stappen[index];
  const correct=stap?.vraag ? antwoorden[stap.vraag.id] === true : true;
  const laatst=index===stappen.length-1;
  useEffect(()=>{
    const key=e=>{
      if(e.key!=='Escape'||e.defaultPrevented) return;
      e.preventDefault();
      if(selectie) {setSelectie(null);return;}
      if(aiOpen) {setAiOpen(false);setCitaat(null);return;}
      opAfbreken();
    };
    window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key);
  },[opAfbreken,selectie,aiOpen]);

  // Een selectie in de lestekst laat een pil verschijnen waarmee je om hulp
  // vraagt. Alleen selecties binnen het leesgebied tellen (afvinklijst 7).
  useEffect(()=>{
    function bijSelectie() {
      const gebied=leesRef.current;
      if(!gebied) return;
      const sel=window.getSelection();
      if(!sel||sel.isCollapsed||sel.rangeCount===0) {setSelectie(null);return;}
      const bereik=sel.getRangeAt(0);
      if(!gebied.contains(bereik.commonAncestorContainer)) {setSelectie(null);return;}
      const tekst=sel.toString().trim();
      if(tekst.length<3) {setSelectie(null);return;}
      const vak=bereik.getBoundingClientRect(), basis=gebied.getBoundingClientRect();
      setSelectie({
        tekst,
        x: vak.left-basis.left+vak.width/2+gebied.scrollLeft,
        y: vak.bottom-basis.top+8+gebied.scrollTop,
      });
    }
    document.addEventListener('selectionchange',bijSelectie);
    return ()=>document.removeEventListener('selectionchange',bijSelectie);
  },[]);
  function antwoord(goed){
    setAntwoorden(v=>({...v,[stap.vraag.id]:goed}));
    if(!geteld.current.has(stap.vraag.id)) {geteld.current.add(stap.vraag.id);opVraagBeantwoord?.(stap.vraag.id,goed);}
  }
  function ga(i){if(i<0||i>=stappen.length||i>bereikt+1||(i>bereikt&&!correct))return;setIndex(i);setBereikt(v=>Math.max(v,i));setGekozen(null);setPoging(0);setSelectie(null);if(leesRef.current)leesRef.current.scrollTop=0;}
  function verder(){if(!correct)return;if(laatst){if(les.concept)opAfbreken();else opAfronden();}else ga(index+1);}
  return <section style={KAART_STIJL}>
    <header className="app-card-head" style={{display:'flex',gap:12,alignItems:'flex-start',flex:'none'}}><div style={{flex:1,minWidth:0}}><p style={{fontSize:11,color:UI.tekstSecundair}}>{domein.naam} · {topic.titel} · les {orbIndex+1}</p><h1 style={{fontSize:23,fontWeight:700,letterSpacing:'-.02em'}}>{les?.titel||'Les ontbreekt'}</h1><p style={{fontSize:12.5,color:UI.tekstSecundair}}>{les?.concept?'Lesopzet uit het ontwerp · nog uit te werken':`${les?.blokken?.length||0} leesblokken · ${les?.vragen?.length||0} vragen`}</p></div><span style={{fontSize:12,whiteSpace:'nowrap'}}>blok {stap?index+1:0} van {stappen.length}</span><button className="lb-sluit" aria-label="Les sluiten" onClick={opAfbreken}>×</button></header>
    <div className="app-columns">
      <div style={{flex:'1 1 0%',minWidth:0,background:UI.kaartZacht,border:`1px solid ${UI.randZacht}`,borderRadius:18,padding:20,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div id="leesgebied" ref={leesRef} style={{flex:'1 1 0%',minHeight:0,overflow:'auto',position:'relative'}}>
          {!stap?<p>Deze les bevat nog geen inhoud.</p>:stap.blok?<div style={{maxWidth:'64ch'}}>
            {stap.blok.titel&&<h2 style={{fontSize:17,fontWeight:700,margin:'0 0 9px'}}>{stap.blok.titel}</h2>}
            <Blok blok={stap.blok} kleur={ST.oranje}/>
            {stap.blok.onthoud&&<OnthoudKader tekst={stap.blok.onthoud}/>}
            {les.begrippen?.length>0&&<div style={{marginTop:18,padding:14,border:`1px solid ${UI.randZacht}`,borderRadius:14}}><strong>Begrippen</strong>{les.begrippen.map((b,i)=><p key={i} style={{fontSize:13,marginTop:8}}><strong>{b.term}</strong> — {b.uitleg}</p>)}</div>}
          </div>:<div style={{maxWidth:'60ch'}}><h2 style={{fontSize:17,fontWeight:700,marginBottom:14}}>{stap.vraag.vraag}</h2>{correct&&gekozen===null?<p style={{color:UI.succes,fontSize:13.5}}>Deze vraag heb je goed beantwoord.</p>:<Vraag key={`${stap.vraag.id}-${poging}`} vraag={stap.vraag} gekozen={gekozen} setGekozen={setGekozen} opAntwoord={antwoord}/>}{gekozen!==null&&<div style={{fontSize:13.5,marginTop:12}}><strong style={{color:correct?UI.succes:ST.rood}}>{correct?'Goed. ':'Nog niet juist. '}</strong>{stap.vraag.uitleg}{!correct&&<button className="knop2" style={{marginTop:12,display:'block'}} onClick={()=>{setGekozen(null);setPoging(p=>p+1);}}>Probeer opnieuw</button>}</div>}</div>}
          {selectie&&(
            <button type="button" className="lb-selpil" style={{left:selectie.x,top:selectie.y}}
              onClick={()=>{setAiOpen(true);setCitaat(selectie.tekst);setSelectie(null);}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ST.oranje} strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                <path d="M12 3v4M12 17v4M4.5 12h4M15.5 12h4M6.9 6.9l2.8 2.8M14.3 14.3l2.8 2.8M17.1 6.9l-2.8 2.8M9.7 14.3l-2.8 2.8"/>
              </svg>
              Vraag het de AI
            </button>
          )}
        </div>
        {aiOpen&&<AiHulpPaneel citaat={citaat} opCitaatWeg={()=>setCitaat(null)} opSluiten={()=>{setAiOpen(false);setCitaat(null);}}/>}
        <footer className="app-actions"><button className="knop2" disabled={index===0} onClick={()=>ga(index-1)}>Vorige</button>{stap&&<button className="knop" disabled={!correct} onClick={verder}>{laatst?(les.concept?'Terug naar onderwerp':'Les afronden'):'Volgende'}</button>}<button type="button" className="knop2" style={{marginLeft:'auto',display:'inline-flex',alignItems:'center',gap:7}} aria-expanded={aiOpen} onClick={()=>setAiOpen(v=>!v)}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={ST.oranje} strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 3v4M12 17v4M4.5 12h4M15.5 12h4M6.9 6.9l2.8 2.8M14.3 14.3l2.8 2.8M17.1 6.9l-2.8 2.8M9.7 14.3l-2.8 2.8"/></svg>Vraag het de AI</button></footer>
      </div>
      <aside className="app-sidebar" style={{padding:16,background:UI.kaartZacht,border:`1px solid ${UI.randZacht}`,borderRadius:18,display:'flex',flexDirection:'column',overflow:'hidden'}}><h2 style={{fontSize:17,fontWeight:700}}>In deze les</h2><div style={{flex:1,minHeight:0,overflow:'auto',display:'flex',flexDirection:'column',gap:7,marginTop:12}}>{stappen.map((s,i)=><button key={i} className="lb-lesrij" aria-current={i===index?'step':undefined} disabled={i>bereikt} onClick={()=>ga(i)} style={{...ORB_RIJ_STIJL(i===index?'bezig':i<index?'af':'later'),padding:'10px 12px',textAlign:'left'}}><OrbMerk status={i===index?'bezig':i<index?'af':'later'}/><span style={{fontSize:13,flex:1}}>{s.vraag?`Vraag ${stappen.slice(0,i+1).filter(x=>x.vraag).length}`:s.blok?.titel||`Leesblok ${i+1}`}</span></button>)}</div></aside>
    </div>
  </section>;
}
