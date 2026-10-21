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

// Welke vragen zijn aan de beurt in één lesboom (topic.domeinId)?
function vragenAanDeBeurtInLesboom(topics, kennis, nu, domeinId) {
  return vragenDieAanDeBeurtZijn(topics.filter((t) => t.domeinId === domeinId), kennis, nu);
}

const SESSIE_MAX = 10;
// Een vraag in doos 4 of 5 rekenen we als "waarschijnlijk bekend".
const BEKEND_VANAF_DOOS = 4;

// Een herhaalsessie voor één lesboom: maximaal SESSIE_MAX vragen, ongeveer de
// helft werk (aan de beurt, laagste doos eerst) en ongeveer de helft
// waarschijnlijk bekend (eerst doos 4-5 die aan de beurt zijn, daarna doos 4-5
// die nog niet aan de beurt zijn). Elke vraag krijgt `soort` ("werk" of
// "bekend") en `meetelt`: bekende vragen die nog niet aan de beurt waren, tellen
// niet mee voor het schema. De sessie begint en eindigt met een bekende vraag en
// wisselt daartussen af.
// Keuze bij weinig vragen: er wordt niets aangevuld. Is er te weinig van de ene
// soort, dan wordt de sessie korter; van beide soorten kiezen we er hoogstens de
// helft van SESSIE_MAX. Is er niets aan de beurt, dan is de sessie leeg.
function herhaalsessieVoorLesboom(topics, kennis, nu, domeinId) {
  const lesboom = topics.filter((t) => t.domeinId === domeinId);
  const due = vragenDieAanDeBeurtZijn(lesboom, kennis, nu);
  if (due.length === 0) return [];

  const helft = SESSIE_MAX / 2;
  const bekendDue = due.filter((v) => v.doos >= BEKEND_VANAF_DOOS).map((v) => ({ ...v, meetelt: true }));
  const bekendRust = [];
  lesboom.forEach((topic) => {
    topic.orbs.forEach((orb) => {
      (orb.vragen || []).forEach((vraag) => {
        const staat = kennis[vraag.id];
        if (staat && staat.doos >= BEKEND_VANAF_DOOS && staat.volgende > nu) {
          bekendRust.push({ vraag, topic, orb, doos: staat.doos, meetelt: false });
        }
      });
    });
  });

  const bekend = [...bekendDue, ...bekendRust].slice(0, helft).map((v) => ({ ...v, soort: "bekend" }));
  const gekozen = new Set(bekend.map((v) => v.vraag.id));
  const werk = due
    .filter((v) => !gekozen.has(v.vraag.id))
    .slice(0, helft)
    .map((v) => ({ ...v, soort: "werk", meetelt: true }));

  if (bekend.length === 0) return werk;

  // Bekend, werk, bekend, werk ... met de laatste bekende vraag aan het eind.
  const eind = bekend.length > 1 ? bekend.pop() : null;
  const sessie = [];
  let i = 0;
  let j = 0;
  let bekendAanDeBeurt = true;
  while (i < bekend.length || j < werk.length) {
    const neemBekend = (bekendAanDeBeurt && i < bekend.length) || j >= werk.length;
    sessie.push(neemBekend ? bekend[i++] : werk[j++]);
    bekendAanDeBeurt = !bekendAanDeBeurt;
  }
  if (eind) sessie.push(eind);
  return sessie;
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


