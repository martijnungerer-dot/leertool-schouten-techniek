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
      goed: aantalGoed(huidig) + (juist ? 1 : 0),
    },
  };
}

// Hoe vaak is een vraag goed beantwoord? Voortgang van vóór dit getal heeft
// alleen een doos; wie in doos n zit, heeft minstens n keer goed geantwoord.
function aantalGoed(staat) {
  if (!staat) return 0;
  return Number.isFinite(staat.goed) ? staat.goed : (staat.doos || 0);
}

// Een antwoord dat niet meetelt voor het schema (een bekende vraag die nog niet
// aan de beurt was): doos en moment blijven gelijk, alleen "goed" telt op.
function noteerGoedBuitenSchema(kennis, vraagId, juist) {
  const staat = kennis[vraagId];
  if (!staat || !juist) return kennis;
  return { ...kennis, [vraagId]: { ...staat, goed: aantalGoed(staat) + 1 } };
}

// Welke vragen zijn vandaag aan de beurt? Dwars door alle onderwerpen heen.
function vragenDieAanDeBeurtZijn(topics, kennis, nu) {
  const due = [];

  topics.forEach((topic) => {
    topic.orbs.forEach((orb) => {
      // Een les in concept of een vraag die niet heel is, kun je niet herhalen.
      if (orb.concept) return;
      (orb.vragen || []).filter(vraagIsHeel).forEach((vraag) => {
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

// Welke vragen zijn aan de beurt in één lesboom (topic.domeinId)?
function vragenAanDeBeurtInLesboom(topics, kennis, nu, domeinId) {
  return vragenDieAanDeBeurtZijn(topics.filter((t) => t.domeinId === domeinId), kennis, nu);
}

const SESSIE_MAX = 10;
// Een vraag in doos 4 of 5 rekenen we als "waarschijnlijk bekend".
const BEKEND_VANAF_DOOS = 4;

// Een herhaalsessie voor één lesboom: hoogstens SESSIE_MAX vragen, werk (aan de
// beurt, doos 1-3, laagste doos eerst) en waarschijnlijk bekend (doos 4-5: eerst
// die aan de beurt zijn, daarna die nog niet aan de beurt zijn). Elke vraag
// krijgt `soort` ("werk" of "bekend") en `meetelt`: bekende vragen die nog niet
// aan de beurt waren, tellen niet mee voor het schema.
// De sessie wisselt strikt af en begint en eindigt met een bekende vraag:
// bekend, werk, bekend ... bekend. Er komen dus precies één bekende vraag meer
// dan werkvragen in, en hoogstens vier werkvragen (samen negen). Er wordt niets
// aangevuld. Randgevallen:
// - geen bekende vragen: alleen werk, hoogstens de helft van SESSIE_MAX;
// - één bekende vraag: bekend, werk;
// - geen werk aan de beurt: alleen de bekende vragen die aan de beurt zijn.
// Is er niets aan de beurt, dan is de sessie leeg.
// Bekende vragen die nog niet aan de beurt zijn, rouleren: ze worden willekeurig
// gekozen, met minder kans naarmate ze vaker goed zijn beantwoord (gewicht
// 1 / (1 + aantal keer goed)). `kies` geeft een getal van 0 tot 1; de controles
// geven een vaste waarde mee.
function herhaalsessieVoorLesboom(topics, kennis, nu, domeinId, kies = Math.random) {
  const lesboom = topics.filter((t) => t.domeinId === domeinId);
  const due = vragenDieAanDeBeurtZijn(lesboom, kennis, nu);
  if (due.length === 0) return [];

  const helft = SESSIE_MAX / 2;
  const alsWerk = (v) => ({ ...v, soort: "werk", meetelt: true });
  const alsBekend = (v) => ({ ...v, soort: "bekend" });
  const werkPool = due.filter((v) => v.doos < BEKEND_VANAF_DOOS);
  const bekendDue = due.filter((v) => v.doos >= BEKEND_VANAF_DOOS).map((v) => ({ ...v, meetelt: true }));
  const bekendRust = [];
  lesboom.forEach((topic) => {
    topic.orbs.forEach((orb) => {
      if (orb.concept) return;
      (orb.vragen || []).filter(vraagIsHeel).forEach((vraag) => {
        const staat = kennis[vraag.id];
        if (staat && staat.doos >= BEKEND_VANAF_DOOS && staat.volgende > nu) {
          bekendRust.push({ vraag, topic, orb, doos: staat.doos, meetelt: false });
        }
      });
    });
  });
  const aantalBekendBeschikbaar = bekendDue.length + bekendRust.length;

  if (werkPool.length === 0) return bekendDue.slice(0, helft).map(alsBekend);
  if (aantalBekendBeschikbaar === 0) return werkPool.slice(0, helft).map(alsWerk);

  const aantalWerk = Math.min(werkPool.length, helft - 1, Math.max(aantalBekendBeschikbaar - 1, 1));
  const aantalBekend = Math.min(aantalBekendBeschikbaar, aantalWerk + 1);
  const uitRust = Math.max(0, aantalBekend - bekendDue.length);
  const bekendPool = [
    ...bekendDue,
    ...kiesGewogen(bekendRust, uitRust, (v) => 1 / (1 + aantalGoed(kennis[v.vraag.id])), kies),
  ];
  const sessie = [];
  for (let i = 0; i < aantalBekend; i++) {
    sessie.push(alsBekend(bekendPool[i]));
    if (i < aantalWerk) sessie.push(alsWerk(werkPool[i]));
  }
  return sessie;
}

// Kiest `aantal` items zonder teruglegging; de kans per item is evenredig met
// zijn gewicht.
function kiesGewogen(lijst, aantal, gewicht, kies) {
  const pool = [...lijst];
  const gekozen = [];
  while (gekozen.length < aantal && pool.length > 0) {
    const totaal = pool.reduce((som, item) => som + gewicht(item), 0);
    let rest = kies() * totaal;
    let i = 0;
    for (; i < pool.length - 1; i++) {
      rest -= gewicht(pool[i]);
      if (rest < 0) break;
    }
    gekozen.push(pool.splice(i, 1)[0]);
  }
  return gekozen;
}

// Telt een antwoord in een sessie mee voor het herhaalschema? Niet bij oefenen,
// en niet bij een bekende vraag die nog niet aan de beurt was.
function antwoordTeltMee(item, oefenModus) {
  return !oefenModus && item.meetelt !== false;
}

// ---------------------------------------------------------------------------
// OPENINGSDAGEN EN PULSEREN
//
// Pulseren hangt aan gebruik, niet aan de kalender: wie een week weg was, krijgt
// bij terugkomst geen knipperend scherm. Een openingsdag is een kalenderdag
// (lokale tijd) waarop de app geopend is; hoogstens één per dag.
// ---------------------------------------------------------------------------
const OPENINGSDAGEN_MAX = 60;
const PULS_AANTAL = 10;
const PULS_DAGEN = 3;

// Kalenderdag in lokale tijd als "JJJJ-MM-DD"; zo sorteert hij als tekst goed.
function dagSleutel(ms) {
  const d = new Date(ms);
  const twee = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${twee(d.getMonth() + 1)}-${twee(d.getDate())}`;
}

// Oude opslag heeft dit veld niet; alles wat geen lijst met dagen is, telt als leeg.
function normaliseerOpeningsdagen(dagen) {
  if (!Array.isArray(dagen)) return [];
  return dagen.filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d));
}

// De openingsdagen bij het laden van opgeslagen voortgang, met vandaag erbij.
// `vg` kan ontbreken of uit een versie zonder dit veld komen.
function openingsdagenBijLaden(vg, nu) {
  return voegOpeningsdagToe(normaliseerOpeningsdagen(vg && vg.openingsdagen), nu);
}

// Telt de dag van `nu` als openingsdag. Was hij al geteld, dan komt dezelfde
// lijst terug, zodat herladen op dezelfde dag niets verandert.
function voegOpeningsdagToe(dagen, nu) {
  const vandaag = dagSleutel(nu);
  if (dagen.includes(vandaag)) return dagen;
  return [...dagen, vandaag].sort().slice(-OPENINGSDAGEN_MAX);
}

// Op hoeveel openingsdagen was deze vraag al aan de beurt? Dat zijn de
// openingsdagen op of na de dag van zijn `volgende`-moment.
function dagenAanDeBeurt(staat, openingsdagen) {
  if (!staat) return 0;
  const vanaf = dagSleutel(staat.volgende);
  return openingsdagen.filter((d) => d >= vanaf).length;
}

// Pulseren bij PULS_AANTAL of meer vragen aan de beurt, of als er een vraag op
// PULS_DAGEN of meer openingsdagen is blijven liggen. `due` is een lijst uit
// vragenDieAanDeBeurtZijn: alles, of die van één lesboom.
function moetPulseren(due, kennis, openingsdagen) {
  if (due.length >= PULS_AANTAL) return true;
  return due.some((v) => dagenAanDeBeurt(kennis[v.vraag.id], openingsdagen) >= PULS_DAGEN);
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

// Geheugensterkte van een onderwerp, 0 tot 1: het gemiddelde van zijn lessen
// met vragen. null als er nog geen enkele vraag van is beantwoord; leeg is leeg.
function sterkteVanOnderwerp(topic, kennis) {
  const lessen = topic.orbs.filter((orb) => (orb.vragen || []).length > 0);
  if (!lessen.some((orb) => orb.vragen.some((v) => kennis[v.id]))) return null;
  const som = lessen.reduce((s, orb) => s + geheugensterkte(orb, kennis), 0);
  return som / lessen.length / 5;
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


